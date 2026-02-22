import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useState, useEffect } from 'react';
import { fetchAllStations } from 'amtrak';
import './MapBackground.css';
import L from 'leaflet';
import CursorTrail from "./CursorTrail";

// This component automatically pans and zooms the map to fit the drawn route
function RouteFitter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length >= 2) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
}

export default function MapBackground({ fromStationCode, toStationCode }) {
  const [stations, setStations] = useState({});
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
        const stationDict = {};
        
        // Guarantee every station is keyed by its proper abbreviation code
        Object.entries(data).forEach(([key, val]) => {
          const code = val.code || key;
          stationDict[code] = { code, ...val };
        });
        
        setStations(stationDict);
      } catch (err) {
        console.error('Error fetching stations:', err);
      }
    }
    getStations();
  }, []);

  // Update route to always start from Penn Station (NYP)
  useEffect(() => {
    if (!toStationCode || Object.keys(stations).length === 0) {
      setRouteCoords([]);
      return;
    }

    const nypStation = stations['NYP'];
    const toStation = stations[toStationCode];

    if (nypStation && toStation && nypStation.lat && toStation.lat) {
      // Set the coordinates for Polyline from NYP to the destination
      setRouteCoords([
        [parseFloat(nypStation.lat), parseFloat(nypStation.lon)],
        [parseFloat(toStation.lat), parseFloat(toStation.lon)]
      ]);
    } else {
      setRouteCoords([]);
    }
  }, [toStationCode, stations]);

  return (
    <div className="map-box">
      <CursorTrail />
      <MapContainer
        center={[40.7506, -73.9935]} // NYC
        zoom={7}
        style={{ width: '100%', height: '100%'}}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Station markers */}
        {Object.values(stations).map(station => (
          station.lat && station.lon && (
            <Marker
              key={station.code}
              position={[parseFloat(station.lat), parseFloat(station.lon)]}
              icon={dotIcon}
            >
              <Popup>
                {station.name}, {station.city}, {station.state}
              </Popup>
            </Marker>
          )
        ))}

        {/* Route line */}
        {routeCoords.length >= 2 && (
          <>
            <Polyline
              positions={routeCoords}
              color="blue"
              weight={20}
              opacity={0.7}
            />
            <RouteFitter coords={routeCoords} />
          </>
        )}

      </MapContainer>
    </div>
  );
}