import pandas as pd
import requests
import zipfile
import io
from pymongo import MongoClient, ASCENDING

LIRR_GTFS_URL = "http://web.mta.info/developers/data/lirr/google_transit.zip"
AMTRAK_GTFS_URL = "https://content.amtrak.com/content/gtfs/GTFS.zip"

def process_gtfs(db, url, collection_name):
    print(f"Fetching GTFS data for {collection_name}...")
    try:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            print(f"Failed to download data for {collection_name}.")
            return

        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            print("Extracting and reading files...")
            stop_times_df = pd.read_csv(z.open('stop_times.txt'))
            trips_df = pd.read_csv(z.open('trips.txt'))

        print("Processing data into document format...")
        grouped_stop_times = stop_times_df.sort_values('stop_sequence').groupby('trip_id')
        
        trips_to_insert = []
        for _, trip in trips_df.iterrows():
            trip_id = trip['trip_id']
            if trip_id in grouped_stop_times.groups:
                stop_times = grouped_stop_times.get_group(trip_id).to_dict('records')
                trip_doc = trip.to_dict()
                trip_doc['stop_times'] = stop_times
                trips_to_insert.append(trip_doc)

        print(f"Inserting {len(trips_to_insert)} documents into {collection_name}...")
        if trips_to_insert:
            db[collection_name].insert_many(trips_to_insert)
            db[collection_name].create_index([("stop_times.stop_id", ASCENDING)])
            db[collection_name].create_index([("trip_id", ASCENDING)])
            
    except Exception as e:
        print(f"An error occurred while processing {collection_name}: {e}")

def download_and_build_mongo():
    client = MongoClient("mongodb://localhost:27017/")
    db = client["lirr_transit"]
    
    db.lirr_trips.drop()
    db.amtrak_trips.drop()

    process_gtfs(db, LIRR_GTFS_URL, "lirr_trips")
    process_gtfs(db, AMTRAK_GTFS_URL, "amtrak_trips")
    
    print("MongoDB build complete.")

if __name__ == "__main__":
    download_and_build_mongo()