from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import re

app = Flask(__name__)
CORS(app)

# Connect to the local MongoDB instance
client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
db = client["lirr_transit"]

def convert_to_minutes(time_str):
    """Converts HH:MM:SS or HH:MM to total minutes for easier calculation."""
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

def find_direct_legs(origin_ids, dest_ids, target_mins, search_type="depart_by"):
    """Finds single seat trips between origin(s) and destination(s)."""
    if not isinstance(origin_ids, list):
        origin_ids = [origin_ids]
    if not isinstance(dest_ids, list):
        dest_ids = [dest_ids]
        
    origin_filter = get_multiple_query_filter(origin_ids)
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
            origin_stop = next(s for s in trip['stop_times'] if any(str(s['stop_id']).startswith(str(o)) for o in origin_ids))
            dest_stop = next(s for s in trip['stop_times'] if any(str(s['stop_id']).startswith(str(d)) for d in dest_ids))
            
            if origin_stop['stop_sequence'] < dest_stop['stop_sequence']:
                dep_time = origin_stop['departure_time'][:5]
                arr_time = dest_stop['arrival_time'][:5]
                dep_mins = convert_to_minutes(dep_time)
                arr_mins = convert_to_minutes(arr_time)
                
                if search_type == "depart_by" and dep_mins >= target_mins:
                    results.append({
                        "trip_id": trip.get('trip_id', 'Unknown'),
                        "departure": dep_time,
                        "arrival": arr_time,
                        "dep_mins": dep_mins,
                        "arr_mins": arr_mins
                    })
                elif search_type == "arrive_by" and arr_mins <= target_mins:
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

def get_lirr_schedule(origin_id, dest_id, search_type, target_time):
    """Queries LIRR trips from origin to destination, including transfers."""
    target_mins = convert_to_minutes(target_time)
    
    origin_list = ["105", "237"] if origin_id == "NYP" else [origin_id]
    dest_list = ["105", "237"] if dest_id == "NYP" else [dest_id]

    # 1. Search for direct trips first
    results = find_direct_legs(origin_list, dest_list, target_mins, search_type)
    
    # 2. Search for transfer options if heading to or from Penn Station
    transfer_hubs = ["102", "54", "56"]
    
    if origin_id != "NYP" and dest_id == "NYP":
        for hub in transfer_hubs:
            leg1_trips = find_direct_legs([origin_id], [hub], target_mins, search_type)
            for leg1 in leg1_trips:
                leg2_trips = find_direct_legs([hub], dest_list, leg1['arr_mins'] + 3, "depart_by")
                for leg2 in leg2_trips:
                    transfer_wait = leg2['dep_mins'] - leg1['arr_mins']
                    if transfer_wait <= 60:
                        results.append({
                            "trip_id": f"{leg1['trip_id']} (Transfer)",
                            "departure": leg1['departure'],
                            "arrival": leg2['arrival'],
                            "dep_mins": leg1['dep_mins'],
                            "arr_mins": leg2['arr_mins']
                        })
                        
    elif origin_id == "NYP" and dest_id != "NYP":
        for hub in transfer_hubs:
            leg1_trips = find_direct_legs(origin_list, [hub], target_mins, search_type)
            for leg1 in leg1_trips:
                leg2_trips = find_direct_legs([hub], [dest_id], leg1['arr_mins'] + 3, "depart_by")
                for leg2 in leg2_trips:
                    transfer_wait = leg2['dep_mins'] - leg1['arr_mins']
                    if transfer_wait <= 60:
                        results.append({
                            "trip_id": f"{leg1['trip_id']} (Transfer)",
                            "departure": leg1['departure'],
                            "arrival": leg2['arrival'],
                            "dep_mins": leg1['dep_mins'],
                            "arr_mins": leg2['arr_mins']
                        })

    if search_type == "arrive_by":
        results.sort(key=lambda x: x['dep_mins'], reverse=True)
    else:
        results.sort(key=lambda x: x['arr_mins'])
        
    unique_results = []
    seen = set()
    for r in results:
        time_key = r['departure']
        if time_key not in seen:
            seen.add(time_key)
            unique_results.append(r)
            
    print(f"DEBUG: Found {len(unique_results)} LIRR trips matching {origin_id} -> {dest_id}.", flush=True)
    return unique_results[:20]

def get_amtrak_schedule(origin_id, dest_id, search_type="depart_by", target_time="00:00"):
    """Queries Amtrak trips matching the provided origin and destination."""
    origin_filter = get_query_filter(origin_id)
    dest_filter = get_query_filter(dest_id)
    
    cursor = db.amtrak_trips.find({
        "$and": [
            {"stop_times.stop_id": origin_filter},
            {"stop_times.stop_id": dest_filter}
        ]
    })
    
    target_mins = convert_to_minutes(target_time)
    results = []
    
    for trip in cursor:
        try:
            origin_stop = next(s for s in trip['stop_times'] if str(s['stop_id']).startswith(str(origin_id)))
            dest_stop = next(s for s in trip['stop_times'] if str(s['stop_id']).startswith(str(dest_id)))
            
            if origin_stop['stop_sequence'] < dest_stop['stop_sequence']:
                dep_time = origin_stop['departure_time'][:5]
                arr_time = dest_stop['arrival_time'][:5]
                dep_mins = convert_to_minutes(dep_time)
                arr_mins = convert_to_minutes(arr_time)
                
                if search_type == "depart_by" and dep_mins >= target_mins:
                    results.append({
                        "train_num": trip.get('route_id', trip.get('trip_id', 'Amtrak')),
                        "departure": dep_time,
                        "arrival": arr_time,
                        "dep_mins": dep_mins,
                        "arr_mins": arr_mins,
                        "status": "Scheduled"
                    })
                elif search_type == "arrive_by" and arr_mins <= target_mins:
                    results.append({
                        "train_num": trip.get('route_id', trip.get('trip_id', 'Amtrak')),
                        "departure": dep_time,
                        "arrival": arr_time,
                        "dep_mins": dep_mins,
                        "arr_mins": arr_mins,
                        "status": "Scheduled"
                    })
        except StopIteration:
            continue
            
    if search_type == "arrive_by":
        results.sort(key=lambda x: x['dep_mins'], reverse=True)
    else:
        results.sort(key=lambda x: x['dep_mins'])
        
    unique_results = []
    seen = set()
    for r in results:
        train_key = r['train_num']
        if train_key not in seen:
            seen.add(train_key)
            unique_results.append(r)
            
    print(f"DEBUG: Found {len(unique_results)} Amtrak trips matching {origin_id} -> {dest_id}.", flush=True)
    return unique_results

@app.route('/api/plan', methods=['POST'])
def plan_trip():
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    search_type = data.get('search_type', 'depart_by')
    target_time = data.get('time', '08:00')
    transition_time = int(data.get('transition_time', 20))
    
    max_wait_time = min(transition_time * 2, 180)
    
    print(f"\n--- DEBUG START: Request from {origin} to {destination} ---", flush=True)
    
    AMTRAK_CODES = ["WAS", "PHL", "BOS"]
    final_results = []
    
    if origin in AMTRAK_CODES:
        amtrak_trips = get_amtrak_schedule(origin, "NYP", search_type, target_time)
        
        for amtrak in amtrak_trips:
            lirr_target_mins = amtrak['arr_mins'] + transition_time
            lirr_target_time = f"{lirr_target_mins // 60:02d}:{lirr_target_mins % 60:02d}"
            
            lirr_connections = get_lirr_schedule("NYP", destination, "depart_by", lirr_target_time)
            
            valid_lirr_options = []
            for lirr in lirr_connections:
                time_diff = lirr['dep_mins'] - amtrak['arr_mins']
                if transition_time <= time_diff <= max_wait_time:
                    valid_lirr_options.append({
                        "train_num": lirr['trip_id'],
                        "departure": lirr['departure'],
                        "arrival": lirr['arrival']
                    })
                    
            if valid_lirr_options:
                final_results.append({
                    "amtrak_trip": {
                        "train_num": amtrak['train_num'],
                        "departure": amtrak['departure'],
                        "arrival": amtrak['arrival'],
                        "status": amtrak['status']
                    },
                    "connections": valid_lirr_options,
                    "leg_type": "amtrak_first"
                })
    else:
        lirr_trips = get_lirr_schedule(origin, "NYP", search_type, target_time)
        
        for lirr in lirr_trips:
            amtrak_target_mins = lirr['arr_mins'] + transition_time
            amtrak_target_time = f"{amtrak_target_mins // 60:02d}:{amtrak_target_mins % 60:02d}"
            
            amtrak_connections = get_amtrak_schedule("NYP", destination, "depart_by", amtrak_target_time)
            
            valid_amtrak_options = []
            for amtrak in amtrak_connections:
                time_diff = amtrak['dep_mins'] - lirr['arr_mins']
                if transition_time <= time_diff <= max_wait_time:
                    valid_amtrak_options.append({
                        "train_num": amtrak['train_num'],
                        "departure": amtrak['departure'],
                        "arrival": amtrak['arrival'],
                        "status": amtrak['status']
                    })
            
            if valid_amtrak_options:
                final_results.append({
                    "lirr_trip": {
                        "trip_id": lirr['trip_id'],
                        "departure": lirr['departure'],
                        "arrival": lirr['arrival']
                    },
                    "connections": valid_amtrak_options,
                    "leg_type": "lirr_first"
                })

    print(f"DEBUG RESULT: Returning {len(final_results)} valid connection sets.", flush=True)
    return jsonify(final_results)

@app.route('/api/details', methods=['POST'])
def trip_details():
    """Fetches the specific stop times for a selected train trip."""
    data = request.json
    trip_id = str(data.get('trip_id', '')).replace(" (Transfer)", "")
    agency = data.get('agency')
    
    collection = db.amtrak_trips if agency == 'amtrak' else db.lirr_trips
    
    query = {"$or": [{"trip_id": trip_id}, {"route_id": trip_id}]} if agency == 'amtrak' else {"trip_id": trip_id}
    trip = collection.find_one(query, {"_id": 0, "stop_times": 1})
    
    if trip and 'stop_times' in trip:
        return jsonify(trip['stop_times'])
    
    return jsonify([])

if __name__ == '__main__':
    app.run(port=5000, debug=True)