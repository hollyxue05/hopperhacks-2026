from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import re

app = Flask(__name__)
CORS(app)

# Map frontend LIRR codes to numeric GTFS IDs
LIRR_MAP = {
    "STB": "14",
    "JAM": "102",
    "RON": "179",
    "BAB": "27",
    "HPT": "54", 
    "NYP": "105" 
}

# Connect to the local MongoDB instance
client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
db = client["lirr_transit"]

def convert_to_minutes(time_str):
    """Converts HH:MM:SS or HH:MM to total minutes. Handles GTFS 24h+ format."""
    try:
        parts = time_str.split(':')
        h = int(parts[0])
        m = int(parts[1])
        return h * 60 + m
    except Exception as e:
        print(f"DEBUG Error: Could not convert time '{time_str}': {e}", flush=True)
        return 0

def get_query_filter(station_id):
    """Creates a filter that matches the station ID as a string, integer, or regex."""
    try:
        int_id = int(station_id)
        return {"$in": [str(station_id), int_id, re.compile(f"^{station_id}")]}
    except ValueError:
        return {"$in": [str(station_id), re.compile(f"^{station_id}")]}

def get_multiple_query_filter(station_ids):
    """Creates a filter for multiple possible destination IDs."""
    conditions = []
    for station_id in station_ids:
        try:
            int_id = int(station_id)
            conditions.extend([str(station_id), int_id, re.compile(f"^{station_id}")])
        except ValueError:
            conditions.extend([str(station_id), re.compile(f"^{station_id}")])
    return {"$in": conditions}

def find_direct_legs(origin_id, dest_ids, target_mins):
    """Finds single seat trips between an origin and a list of possible destinations."""
    origin_filter = get_query_filter(origin_id)
    dest_filter = get_multiple_query_filter(dest_ids)
    
    cursor = db.lirr_trips.find({
        "$and": [
            {"stop_times.stop_id": origin_filter},
            {"stop_times.stop_id": dest_filter}
        ]
    })

    results = []
    for trip in cursor:
        try:
            origin_stop = next(s for s in trip['stop_times'] if str(s['stop_id']).startswith(str(origin_id)))
            dest_stop = next(s for s in trip['stop_times'] if any(str(s['stop_id']).startswith(str(d)) for d in dest_ids))
            
            if origin_stop['stop_sequence'] < dest_stop['stop_sequence']:
                dep_time = origin_stop['departure_time'][:5]
                arr_time = dest_stop['arrival_time'][:5]
                dep_mins = convert_to_minutes(dep_time)
                arr_mins = convert_to_minutes(arr_time)
                
                if dep_mins >= target_mins:
                    results.append({
                        "trip_id": trip.get('trip_id', 'Unknown'),
                        "departure": dep_time,
                        "arrival": arr_time,
                        "dep_mins": dep_mins,
                        "arr_mins": arr_mins
                    })
        except StopIteration:
            continue
            
    return results

def get_lirr_schedule(origin_code, search_type, target_time):
    """Queries LIRR trips from the origin station to Penn Station, including transfers."""
    origin_id = LIRR_MAP.get(origin_code, origin_code)
    target_mins = convert_to_minutes(target_time)
    nyp_ids = ["105", "237"]
    
    # 1. Search for direct trips first
    results = find_direct_legs(origin_id, nyp_ids, target_mins)
    
    # 2. Search for transfer options through major hubs
    transfer_hubs = ["102", "54", "56"] 
    for hub in transfer_hubs:
        leg1_trips = find_direct_legs(origin_id, [hub], target_mins)
        
        for leg1 in leg1_trips:
            # Allow at least 3 minutes to switch trains at the transfer hub
            leg2_trips = find_direct_legs(hub, nyp_ids, leg1['arr_mins'] + 3)
            
            for leg2 in leg2_trips:
                transfer_wait = leg2['dep_mins'] - leg1['arr_mins']
                # Limit the wait time at the transfer station to 60 minutes
                if transfer_wait <= 60:
                    results.append({
                        "trip_id": f"{leg1['trip_id']} (Transfer)",
                        "departure": leg1['departure'],
                        "arrival": leg2['arrival'],
                        "arr_mins": leg2['arr_mins']
                    })
    
    results.sort(key=lambda x: x['arr_mins'])
    
    # Remove duplicates by filtering trains with the exact same departure time
    unique_results = []
    seen = set()
    for r in results:
        time_key = r['departure']
        if time_key not in seen:
            seen.add(time_key)
            unique_results.append(r)
            
    print(f"DEBUG: Found {len(unique_results)} LIRR trips for {origin_code} ({origin_id}) -> NYP.", flush=True)
    return unique_results[:20]

def get_amtrak_schedule(destination_id):
    """Queries Amtrak trips from Penn Station to the user destination."""
    dest_filter = {"$in": [destination_id, re.compile(f"^{destination_id}")]}
    nyp_filter = {"$in": ["NYP", re.compile("^NYP")]}
    
    cursor = db.amtrak_trips.find({
        "$and": [
            {"stop_times.stop_id": nyp_filter},
            {"stop_times.stop_id": dest_filter}
        ]
    })
    
    results = []
    for trip in cursor:
        try:
            nyp_stop = next(s for s in trip['stop_times'] if str(s['stop_id']).startswith("NYP"))
            dest_stop = next(s for s in trip['stop_times'] if str(s['stop_id']).startswith(str(destination_id)))
            
            if nyp_stop['stop_sequence'] < dest_stop['stop_sequence']:
                dep_time = nyp_stop['departure_time'][:5]
                arr_time = dest_stop['arrival_time'][:5]
                dep_mins = convert_to_minutes(dep_time)
                
                results.append({
                    "train_num": trip.get('route_id', trip.get('trip_id', 'Amtrak')),
                    "departure": dep_time,
                    "arrival": arr_time,
                    "dep_mins": dep_mins,
                    "status": "Scheduled"
                })
        except StopIteration:
            continue
            
    results.sort(key=lambda x: x['dep_mins'])
    
    unique_results = []
    seen = set()
    for r in results:
        # Deduplicate based solely on the train number to remove variations
        train_key = r['train_num']
        if train_key not in seen:
            seen.add(train_key)
            unique_results.append(r)
            
    print(f"DEBUG: Found {len(unique_results)} Amtrak trips for NYP -> {destination_id}.", flush=True)
    return unique_results

@app.route('/api/plan', methods=['POST'])
def plan_trip():
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    search_type = data.get('search_type', 'depart_by')
    target_time = data.get('time', '08:00')
    transition_time = int(data.get('transition_time', 20))
    
    print(f"\n--- DEBUG START: Request from {origin} to {destination} ---", flush=True)
    
    lirr_trips = get_lirr_schedule(origin, search_type, target_time)
    amtrak_data = get_amtrak_schedule(destination)

    final_results = []
    for lirr in lirr_trips:
        valid_amtrak_options = []
        for amtrak in amtrak_data:
            time_diff = amtrak['dep_mins'] - lirr['arr_mins']
            # Allow connections within a 4 hour window
            if transition_time <= time_diff <= 120:
                valid_amtrak_options.append({
                    "train_num": amtrak['train_num'],
                    "departure": amtrak['departure'],
                    "arrival": amtrak['arrival'],
                    "destination": destination,
                    "status": amtrak['status']
                })
        
        if valid_amtrak_options:
            final_results.append({
                "lirr_trip": {
                    "trip_id": lirr['trip_id'],
                    "departure": lirr['departure'],
                    "arrival": lirr['arrival']
                },
                "connections": valid_amtrak_options
            })

    print(f"DEBUG RESULT: Returning {len(final_results)} valid connection sets.", flush=True)
    return jsonify(final_results)

if __name__ == '__main__':
    app.run(port=5000, debug=True)