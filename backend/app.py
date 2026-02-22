from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# MongoDB Setup
# Ensure your MongoDB service is running before starting the app
client = MongoClient("mongodb://localhost:27017/")
db = client["lirr_transit"]

AMTRAKER_API = "https://api-v3.amtraker.com/v3/stations/NYP"

def get_lirr_schedule_from_mongo(origin_id, search_type, target_time):
    """
    Retrieves LIRR trips from MongoDB based on the user's time preferences.
    """
    cursor = db.trips.find({
        "$and": [
            {"stop_times.stop_id": origin_id},
            {"stop_times.stop_id": "237"} # 237 is the ID for Penn Station
        ]
    })

    results = []
    for trip in cursor:
        try:
            origin_stop = next(s for s in trip['stop_times'] if s['stop_id'] == origin_id)
            nyp_stop = next(s for s in trip['stop_times'] if s['stop_id'] == "237")
            
            if origin_stop['stop_sequence'] < nyp_stop['stop_sequence']:
                dep_time = origin_stop['departure_time'][:5]
                arr_time = nyp_stop['arrival_time'][:5]
                
                if search_type == "depart_by" and dep_time >= target_time:
                    results.append({
                        "trip_id": trip['trip_id'],
                        "departure": dep_time,
                        "arrival": arr_time
                    })
                elif search_type == "arrive_by" and arr_time <= target_time:
                    results.append({
                        "trip_id": trip['trip_id'],
                        "departure": dep_time,
                        "arrival": arr_time
                    })
        except StopIteration:
            continue
    
    results.sort(key=lambda x: x['departure'])
    return results[:15]

def get_amtrak_departures():
    """
    Fetches live departure data for Penn Station from the Amtraker API.
    """
    try:
        response = requests.get(AMTRAKER_API, timeout=5)
        if response.status_code == 200:
            data = response.json()
            station_data = data.get("NYP", {})
            return station_data.get("departures", [])
        return []
    except Exception:
        return []

def calculate_connection(lirr_arrival, amtrak_departure, buffer_minutes):
    """
    Determines if a connection is viable given the user's required transition time.
    """
    time_format = "%H:%M"
    try:
        lirr_arr_dt = datetime.strptime(lirr_arrival, time_format)
        # Amtrak times often include seconds or dates so we slice for HH:MM
        amtrak_dep_dt = datetime.strptime(amtrak_departure[:5], time_format)
        
        time_diff = (amtrak_dep_dt - lirr_arr_dt).total_seconds() / 60
        
        # We ensure the gap is at least the buffer but no more than 3 hours
        return buffer_minutes <= time_diff <= 180
    except Exception:
        return False

@app.route('/api/plan', methods=['POST'])
def plan_trip():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    search_type = data.get('search_type', 'depart_by')
    target_time = data.get('time', '08:00')
    
    # We extract the transition time and default to 20 minutes if missing
    try:
        transition_time = int(data.get('transition_time', 20))
    except (ValueError, TypeError):
        transition_time = 20
    
    if not origin or not destination:
        return jsonify({"error": "Missing origin or destination"}), 400
    
    lirr_trips = get_lirr_schedule_from_mongo(origin, search_type, target_time)
    amtrak_data = get_amtrak_departures()
    
    if not amtrak_data:
        return jsonify({"error": "Unable to reach Amtrak real-time data"}), 503

    final_results = []
    for lirr in lirr_trips:
        valid_amtrak_options = []
        for amtrak in amtrak_data:
            # Match by destination code or route name
            is_match = amtrak.get('destination') == destination or destination in amtrak.get('route', '')
            
            if is_match:
                dep_time_str = amtrak.get('scheduled_departure', '')[11:16]
                
                if calculate_connection(lirr['arrival'], dep_time_str, transition_time):
                    valid_amtrak_options.append({
                        "train_num": amtrak.get('train_number'),
                        "departure": dep_time_str,
                        "status": amtrak.get('status', 'On Time')
                    })
        
        if valid_amtrak_options:
            final_results.append({
                "lirr_trip": lirr,
                "connections": valid_amtrak_options
            })

    return jsonify(final_results)

if __name__ == '__main__':
    app.run(port=5000, debug=True)