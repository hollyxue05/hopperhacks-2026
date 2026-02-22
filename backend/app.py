from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# MongoDB Setup
client = MongoClient("mongodb://localhost:27017/")
db = client["lirr_transit"]

AMTRAKER_API = "https://api-v3.amtraker.com/v3/stations/NYP"

def get_lirr_schedule_from_mongo(origin_id):
    # Find trips that contain both the origin and Penn Station (237)
    # The origin must appear before Penn Station in the stop_sequence
    cursor = db.trips.find({
        "$and": [
            {"stop_times.stop_id": origin_id},
            {"stop_times.stop_id": "237"}
        ]
    }).limit(20)

    results = []
    for trip in cursor:
        try:
            origin_stop = next(s for s in trip['stop_times'] if s['stop_id'] == origin_id)
            nyp_stop = next(s for s in trip['stop_times'] if s['stop_id'] == "237")
            
            # Ensure the origin comes before Penn Station
            if origin_stop['stop_sequence'] < nyp_stop['stop_sequence']:
                results.append({
                    "trip_id": trip['trip_id'],
                    "departure": origin_stop['departure_time'][:5],
                    "arrival": nyp_stop['arrival_time'][:5]
                })
        except StopIteration:
            continue
    
    return results

def get_amtrak_departures():
    try:
        response = requests.get(AMTRAKER_API, timeout=5)
        if response.status_code == 200:
            data = response.json()
            station_data = data.get("NYP", {})
            return station_data.get("departures", [])
        return []
    except Exception:
        return []

def calculate_connection(lirr_arrival, amtrak_departure):
    fmt = "%H:%M"
    try:
        l_arr = datetime.strptime(lirr_arrival, fmt)
        a_dep = datetime.strptime(amtrak_departure[:5], fmt)
        diff = (a_dep - l_arr).total_seconds() / 60
        return 20 <= diff <= 120
    except Exception:
        return False

@app.route('/api/plan', methods=['POST'])
def plan_trip():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    
    if not origin or not destination:
        return jsonify({"error": "Missing origin or destination"}), 400
    
    # Pull dynamic schedule from MongoDB
    lirr_trips = get_lirr_schedule_from_mongo(origin)
    
    amtrak_data = get_amtrak_departures()
    if not amtrak_data:
        return jsonify({"error": "Could not retrieve Amtrak data"}), 503

    results = []
    for lirr in lirr_trips:
        valid_connections = []
        for amtrak in amtrak_data:
            if amtrak.get('destination') == destination or destination in amtrak.get('route', ''):
                # Extract time from 'scheduled_departure' timestamp
                dep_time_str = amtrak.get('scheduled_departure', '')[11:16]
                
                if calculate_connection(lirr['arrival'], dep_time_str):
                    valid_connections.append({
                        "train_num": amtrak.get('train_number'),
                        "departure": dep_time_str,
                        "status": amtrak.get('status', 'On Time')
                    })
        
        if valid_connections:
            results.append({
                "lirr_trip": lirr,
                "connections": valid_connections
            })

    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5000, debug=True)