import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useState, useEffect } from 'react';
import { fetchAllStations } from 'amtrak';
import './MapBackground.css';
import L from 'leaflet';

export default function MapBackground({ fromStationCode, toStationCode }) {
  const [stations, setStations] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);

  const dotIcon = new L.DivIcon({
    className: 'station-dot',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  // Fetch stations once
  useEffect(() => {
    async function getStations() {
      try {
        const data = await fetchAllStations();
        setStations(Object.values(data));
      } catch (err) {
        console.error('Error fetching stations:', err);
      }
    }
    getStations();
  }, []);

  // Update route when from/to change
  useEffect(() => {
    if (!fromStationCode || !toStationCode || stations.length === 0) {
      setRouteCoords([]); // clear route if inputs missing
      return;
    }

    const fromStation = stations.find(s => s.code === fromStationCode);
    const toStation = stations.find(s => s.code === toStationCode);

    if (fromStation && toStation) {
      // Set the coordinates for Polyline
      setRouteCoords([
        [fromStation.lat, fromStation.lon],
        [toStation.lat, toStation.lon]
      ]);
    } else {
      setRouteCoords([]);
    }
  }, [fromStationCode, toStationCode, stations]);

  return (
    <div className="map-box">
      <MapContainer
        center={[40.7506, -73.9935]} // NYC
        zoom={12}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Station markers */}
        {stations.map(station => (
          <Marker
            key={station.code}
            position={[station.lat, station.lon]}
            icon={dotIcon}
          >
            <Popup>
              {station.name}, {station.city}, {station.state}
            </Popup>
          </Marker>
        ))}

        {/* Route line */}
        {routeCoords.length >= 2 && (
          <Polyline
            positions={routeCoords}
            color="blue"
            weight={4}
            opacity={0.7}
          />
        )}

      </MapContainer>
    </div>
  );
}