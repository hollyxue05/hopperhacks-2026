import { useState } from 'react'
import './LandingPage.css'
import "react-datepicker/dist/react-datepicker.css";
import MapBackground from './MapBackground';
import lightImg from './images/light-image.png';
import darkImg from './images/dark-image.png'; 

function LandingPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [currentDestination, setCurrentDestination] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError(null);
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

  const handleTripSelection = (trip) => {
    // Placeholder for what happens when a user selects a specific trip schedule
    console.log("Trip selected:", trip);
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
                  /* Inline styles removed here and replaced with className */
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      origin: from,
      destination: to,
      search_type: 'depart_by',
      time: time,
      date: selectedDate,
      transition_time: parseInt(bufferTime, 10)
    });
  };

  const inputStyle = { padding: '12px', width: '100%', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem' };
  const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' };
  const groupStyle = { marginBottom: '20px' };

  return (
    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <form onSubmit={handleSubmit}>
        <div style={groupStyle}>
          <label style={labelStyle}>From:</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} required style={inputStyle}>
            <option value="">Select a Starting Station</option>
            <optgroup label="LIRR Stations">
                <option value="14">Stony Brook</option>
                <option value="102">Jamaica</option>
                <option value="179">Ronkonkoma</option>
                <option value="27">Babylon</option>
            </optgroup>
            <optgroup label="Amtrak Stations">
                <option value="WAS">Washington DC (WAS)</option>
                <option value="PHL">Philadelphia (PHL)</option>
                <option value="BOS">Boston (BOS)</option>
            </optgroup>
          </select>
        </div>

        <div style={groupStyle}>
          <label style={labelStyle}>To:</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} required style={inputStyle}>
            <option value="">Select an Ending Station</option>
            <optgroup label="LIRR Stations">
                <option value="14">Stony Brook</option>
                <option value="102">Jamaica</option>
                <option value="179">Ronkonkoma</option>
                <option value="27">Babylon</option>
            </optgroup>
            <optgroup label="Amtrak Stations">
                <option value="WAS">Washington DC (WAS)</option>
                <option value="PHL">Philadelphia (PHL)</option>
                <option value="BOS">Boston (BOS)</option>
            </optgroup>
          </select>
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