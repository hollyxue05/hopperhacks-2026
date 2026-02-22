import pandas as pd
import requests
import zipfile
import io
from pymongo import MongoClient, ASCENDING

# MTA GTFS Static Link for LIRR
GTFS_URL = "http://web.mta.info/developers/data/lirr/google_transit.zip"

def download_and_build_mongo():
    # Setup MongoDB client
    client = MongoClient("mongodb://localhost:27017/")
    db = client["lirr_transit"]
    
    # Drop existing collections to start fresh
    db.trips.drop() 
    db.stops.drop()

    print("Fetching LIRR GTFS data...")
    response = requests.get(GTFS_URL)
    
    if response.status_code != 200:
        print("Failed to download data.")
        return

    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        print("Extracting and reading files...")
        stops_df = pd.read_csv(z.open('stops.txt'))
        stop_times_df = pd.read_csv(z.open('stop_times.txt'))
        trips_df = pd.read_csv(z.open('trips.txt'))

    print("Processing data into document format...")
    
    # Insert stops
    stops_data = stops_df.to_dict('records')
    db.stops.insert_many(stops_data)
    db.stops.create_index([("stop_id", ASCENDING)])

    # Group stop times by trip_id to create nested documents
    # This avoids expensive joins later
    grouped_stop_times = stop_times_df.sort_values('stop_sequence').groupby('trip_id')
    
    trips_to_insert = []
    total_trips = len(trips_df)
    
    print(f"Nesting stop times for {total_trips} trips...")
    for _, trip in trips_df.iterrows():
        trip_id = trip['trip_id']
        if trip_id in grouped_stop_times.groups:
            stop_times = grouped_stop_times.get_group(trip_id).to_dict('records')
            trip_doc = trip.to_dict()
            trip_doc['stop_times'] = stop_times
            trips_to_insert.append(trip_doc)

    print("Inserting documents into MongoDB...")
    if trips_to_insert:
        db.trips.insert_many(trips_to_insert)
        
    # Create indexes for the fields your Flask app will query most
    db.trips.create_index([("stop_times.stop_id", ASCENDING)])
    db.trips.create_index([("trip_id", ASCENDING)])

    print("MongoDB build complete.")

if __name__ == "__main__":
    download_and_build_mongo()