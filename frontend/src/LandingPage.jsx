import { useState } from 'react'
import './LandingPage.css'
import "react-datepicker/dist/react-datepicker.css";
import MapBackground from './MapBackground';
import lightImg from './images/light-image.png';
import darkImg from './images/dark-image.png'; 

// Dictionary to translate GTFS/Database IDs to readable names
const stationMap = {
  // Transfer Hubs & Terminals
  "105": "Penn Station",
  "237": "Penn Station", 
  "NYP": "New York Penn Station",
  "102": "Jamaica", 
  "214": "Woodside", 
  "54": "Woodside",
  "55": "Forest Hills", 
  "56": "Forest Hills",
  "107": "Kew Gardens", 

  // Port Jefferson & Ronkonkoma Shared Stops
  "132": "Mineola", 
  "39": "Carle Place", 
  "213": "Westbury", 
  "92": "Hicksville", 

  // Port Jefferson Branch
  "205": "Syosset", 
  "40": "Cold Spring Harbor", 
  "91": "Huntington", 
  "78": "Greenlawn", 
  "153": "Northport", 
  "111": "Kings Park", 
  "202": "Smithtown", 
  "193": "St. James", 
  "14": "Stony Brook", 
  "164": "Port Jefferson", 

  // Ronkonkoma Branch
  "20": "Bethpage", 
  "59": "Farmingdale", 
  "165": "Pinelawn", 
  "220": "Wyandanch", 
  "44": "Deer Park", 
  "29": "Brentwood", 
  "33": "Central Islip", 
  "179": "Ronkonkoma", 

  // Amtrak Stations
  // Amtrak Northeast Regional Stops (BOS to WAS)
  "BOS": "Boston South Station",
  "BBY": "Boston Back Bay",
  "RTE": "Route 128",
  "PVD": "Providence",
  "KIN": "Kingston",
  "WLY": "Westerly",
  "MYS": "Mystic",
  "NLC": "New London",
  "OSW": "Old Saybrook",
  "NHV": "New Haven Union Station",
  "BDP": "Bridgeport",
  "STM": "Stamford",
  "NRO": "New Rochelle",
  "NWK": "Newark Penn Station",
  "EWR": "Newark Airport",
  "MET": "Metropark",
  "NBK": "New Brunswick",
  "PNC": "Princeton Junction",
  "TRE": "Trenton",
  "PHL": "Philadelphia 30th Street",
  "WIL": "Wilmington",
  "NWB": "Newark (DE)",
  "ABD": "Aberdeen",
  "BAL": "Baltimore Penn Station",
  "BWI": "BWI Marshall Airport",
  "NCR": "New Carrollton",
  "WAS": "Washington DC Union"
};

const formatStationName = (stopId) => {
  const idString = String(stopId);
  for (const key in stationMap) {
    if (idString.startsWith(key)) {
      return stationMap[key];
    }
  }
  return `Station Code: ${idString}`;
};

function LandingPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [currentDestination, setCurrentDestination] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  // State variables for trip details
  const [tripDetails, setTripDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError(null);
    setTripDetails(null);
    setCurrentOrigin(searchParams.origin);
    setCurrentDestination(searchParams.destination);

    try {
      const response = await fetch('http://localhost:5000/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trip data');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError('Could not connect to the trip planning service.');
    } finally {
      setLoading(false);
    }
  };

  const handleTripSelection = async (trip) => {
    setDetailsLoading(true);
    
    const isAmtrakFirst = trip.leg_type === "amtrak_first";
    
    const primaryAgency = isAmtrakFirst ? "amtrak" : "lirr";
    const primaryTripId = isAmtrakFirst ? trip.amtrak_trip.trip_id : trip.lirr_trip.trip_id;
    const primaryOrigin = currentOrigin;
    const primaryDest = "NYP";
    
    const secondaryAgency = isAmtrakFirst ? "lirr" : "amtrak";
    const firstConnection = trip.connections[0];
    const secondaryTripId = firstConnection.trip_id || firstConnection.train_num;
    const secondaryOrigin = "NYP";
    const secondaryDest = currentDestination;

    try {
      const [primaryRes, secondaryRes] = await Promise.all([
        fetch('http://localhost:5000/api/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            trip_id: primaryTripId, 
            agency: primaryAgency, 
            origin: primaryOrigin, 
            destination: primaryDest 
          }),
        }),
        fetch('http://localhost:5000/api/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            trip_id: secondaryTripId, 
            agency: secondaryAgency, 
            origin: secondaryOrigin, 
            destination: secondaryDest 
          }),
        })
      ]);

      const primaryStops = primaryRes.ok ? await primaryRes.json() : [];
      const secondaryStops = secondaryRes.ok ? await secondaryRes.json() : [];

      setTripDetails({ 
        tripInfo: trip, 
        primaryStops: primaryStops, 
        secondaryStops: secondaryStops,
        primaryAgency: primaryAgency,
        secondaryAgency: secondaryAgency,
        connectionInfo: firstConnection
      });
        
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
      
    } catch (err) {
      console.error('Failed to fetch detailed stops', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className={darkMode ? "landingpage dark" : "landingpage light"}>
      <div>
        <div className="welcome-container">
          <h1 className="welcome">Welcome to RailroadRouter</h1>
            <div className="button">
              <button onClick={() => setDarkMode(!darkMode)}>
                {darkMode ? "Light" : "Dark"} Mode
              </button>
            </div>
        </div>
      </div>

      <div className="map-and-tripInfo">
        <div className="map-container">
          <MapBackground />
        </div>

        <div className="trip-container">
          <h1>Plan your Trip</h1>
          <UserInput onSearch={handleSearch} loading={loading} />
          <div className="schedule-list-container">
            <h1>Schedule Results</h1>
            {loading && <p>Loading connections...</p>}
            {error && <p className="error-text">{error}</p>}

            {results && results.length === 0 && (
              <p style={{ fontSize: '1.1rem', color: '#4b5563', backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                No connections found for your criteria. Please try a different time or buffer window.
              </p>
            )}

            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
              {results && results.map((trip, idx) => {
                const isAmtrakFirst = trip.leg_type === "amtrak_first";

                return (
                  <button 
                    key={idx} 
                    onClick={() => handleTripSelection(trip)}
                    className="schedule-button"
                  >
                    {isAmtrakFirst ? (
                      <>
                        <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '15px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Amtrak Train #{trip.amtrak_trip.train_num}</h3>
                          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Departs Origin: {trip.amtrak_trip.departure} | Arrives NYP: {trip.amtrak_trip.arrival}</p>
                        </div>

                        <div style={{ padding: '20px' }}>
                          <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LIRR Connection Choices</h4>
                          {trip.connections.map((conn, cIdx) => (
                            <div key={cIdx} style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid #3b82f6' }}>
                              <strong style={{ color: '#111827' }}>Train {conn.train_num}</strong>
                              <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#4b5563' }}>
                                <span>Departs NYP at {conn.departure}</span><br />
                                <span>Arrives Destination at {conn.arrival}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '15px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>LIRR Trip {trip.lirr_trip.trip_id}</h3>
                          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Departs Origin: {trip.lirr_trip.departure} | Arrives NYP: {trip.lirr_trip.arrival}</p>
                        </div>

                        <div style={{ padding: '20px' }}>
                          <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amtrak Connection Choices</h4>
                          {trip.connections.map((conn, cIdx) => (
                            <div key={cIdx} style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid #1e3a8a' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: '#111827' }}>Train #{conn.train_num}</strong>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', backgroundColor: conn.status === 'On Time' ? '#dcfce7' : '#fef08a', color: conn.status === 'On Time' ? '#166534' : '#854d0e' }}>
                                  {conn.status}
                                </span>
                              </div>
                              <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#4b5563' }}>
                                <span>Departs NYP at {conn.departure}</span><br />
                                <span>Arrives Destination at {conn.arrival}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {(detailsLoading || tripDetails) && (
        <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
          <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', marginBottom: '40px' }} />
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: darkMode ? 'white' : 'black' }}>
            Full Itinerary Stops
          </h2>
          
          {detailsLoading ? (
             <p style={{ color: '#4b5563' }}>Loading stop details...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               
               {/* Primary Leg */}
               <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                 <h3 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', margin: '0 0 20px 0', color: '#111827' }}>
                   Leg 1: {tripDetails.primaryAgency.toUpperCase()} 
                 </h3>
                 {tripDetails.primaryStops.length > 0 ? (
                   <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                     {tripDetails.primaryStops.map((stop, idx) => (
                       <li key={idx} style={{ padding: '10px 0', display: 'flex', borderBottom: idx !== tripDetails.primaryStops.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                         <span style={{ width: '80px', fontWeight: 'bold', color: '#374151' }}>
                           {stop.arrival_time ? stop.arrival_time.substring(0, 5) : "--:--"}
                         </span>
                         <span style={{ color: '#111827' }}>
                           {formatStationName(stop.stop_id)}
                         </span>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p>No detailed stop data is available for this leg.</p>
                 )}
               </div>

               {/* Transfer Indicator */}
               <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '8px', color: '#4b5563', fontWeight: 'bold' }}>
                 Transfer at Penn Station
               </div>

               {/* Secondary Leg */}
               <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                 <h3 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', margin: '0 0 20px 0', color: '#111827' }}>
                   Leg 2: {tripDetails.secondaryAgency.toUpperCase()} Train {tripDetails.connectionInfo.train_num}
                 </h3>
                 {tripDetails.secondaryStops.length > 0 ? (
                   <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                     {tripDetails.secondaryStops.map((stop, idx) => (
                       <li key={idx} style={{ padding: '10px 0', display: 'flex', borderBottom: idx !== tripDetails.secondaryStops.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                         <span style={{ width: '80px', fontWeight: 'bold', color: '#374151' }}>
                           {stop.arrival_time ? stop.arrival_time.substring(0, 5) : "--:--"}
                         </span>
                         <span style={{ color: '#111827' }}>
                           {formatStationName(stop.stop_id)}
                         </span>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p>No detailed stop data is available for this leg.</p>
                 )}
               </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}

/** function for trip input*/
function UserInput({ onSearch, loading }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bufferTime, setBufferTime] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [time, setTime] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (from === to) {
      setValidationError("Starting and ending stations cannot be the same.");
      return;
    }
    
    setValidationError("");

    onSearch({
      origin: from,
      destination: to,
      search_type: 'depart_by',
      time: time,
      date: selectedDate,
      transition_time: parseInt(bufferTime, 10)
    });
  };

  const handleSwap = () => {
    const tempFrom = from;
    setFrom(to);
    setTo(tempFrom);
    setValidationError(""); 
  };

  const inputStyle = { padding: '12px', width: '100%', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem' };
  const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' };
  const groupStyle = { marginBottom: '20px' };

  const lirrStations = [
    { value: "40", label: "Cold Spring Harbor" },
    { value: "92", label: "Hicksville" },
    { value: "91", label: "Huntington" },
    { value: "102", label: "Jamaica" },
    { value: "179", label: "Ronkonkoma" },
    { value: "14", label: "Stony Brook" },
    { value: "205", label: "Syosset" },
  ];

  const amtrakStations = [
    { value: "BAL", label: "Baltimore Penn Station" },
    { value: "BBY", label: "Boston Back Bay" },
    { value: "BOS", label: "Boston South Station" },
    { value: "BDP", label: "Bridgeport" },
    { value: "BWI", label: "BWI Marshall Airport" },
    { value: "MET", label: "Metropark" },
    { value: "NBK", label: "New Brunswick" },
    { value: "NCR", label: "New Carrollton" },
    { value: "NHV", label: "New Haven Union Station" },
    { value: "NWK", label: "Newark Penn Station" },
    { value: "PHL", label: "Philadelphia 30th Street" },
    { value: "PVD", label: "Providence" },
    { value: "TRE", label: "Trenton" },
    { value: "WAS", label: "Washington DC Union" },
    { value: "WIL", label: "Wilmington" }
  ];

  return (
    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <form onSubmit={handleSubmit}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>From:</label>
            <select 
              value={from} 
              onChange={(e) => {
                setFrom(e.target.value);
                setValidationError(""); 
              }} 
              required 
              style={inputStyle}
            >
              <option value="">Starting Station</option>
              <optgroup label="LIRR Stations">
                {lirrStations.map(station => (
                  <option key={`from-lirr-${station.value}`} value={station.value}>{station.label}</option>
                ))}
              </optgroup>
              <optgroup label="Amtrak Stations">
                {amtrakStations.map(station => (
                  <option key={`from-amtrak-${station.value}`} value={station.value}>{station.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <button 
            type="button" 
            onClick={handleSwap}
            style={{ 
              marginTop: '28px', 
              padding: '10px 15px', 
              backgroundColor: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#4b5563',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          >
            ↔ 
          </button>

          <div style={{ flex: 1 }}>
            <label style={labelStyle}>To:</label>
            <select 
              value={to} 
              onChange={(e) => {
                setTo(e.target.value);
                setValidationError("");
              }} 
              required 
              style={inputStyle}
            >
              <option value="">Destination Station</option>
              <optgroup label="LIRR Stations">
                {lirrStations.map(station => (
                  <option key={`to-lirr-${station.value}`} value={station.value}>{station.label}</option>
                ))}
              </optgroup>
              <optgroup label="Amtrak Stations">
                {amtrakStations.map(station => (
                  <option key={`to-amtrak-${station.value}`} value={station.value}>{station.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date:</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Time:</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required style={inputStyle} />
          </div>
        </div>

        <div style={groupStyle}>
          <label style={labelStyle}>Penn Station Transition Time:</label>
          <select value={bufferTime} onChange={(e) => setBufferTime(e.target.value)} required style={inputStyle}>
            <option value="">Select a Minimum Layover</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {validationError && (
          <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontWeight: '500', textAlign: 'center' }}>
            {validationError}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'background-color 0.2s' }}
        >
          {loading ? 'Searching...' : 'Find Schedule'}
        </button>
      </form>
    </div>
  );
}

export default LandingPage;