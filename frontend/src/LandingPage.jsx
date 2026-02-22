import { useState } from 'react'
import './LandingPage.css'
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import MapBackground from './MapBackground';

function LandingPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError(null);
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

  return (
    
  <div className = "landing-page">
    <h1 className = "welcome">Welcome</h1>
    <div className = "map-and-tripInfo">
     
      <div className= "map-container">
        <MapBackground />
      </div> 

      <div className= "trip-container"> 
        <h1>Plan your Trip</h1>
        <UserInput onSearch={handleSearch} loading={loading} />
          <div className = "schedule-list-container">
            <h1>Schedule Results</h1>
            {loading && <p>Loading connections...</p>}
              {error && <p className="error-text">{error}</p>}
              
              {results && results.length === 0 && (
                <p>No connections found for your criteria.</p>
              )}

              {results && results.map((trip, idx) => (
                <div key={idx} className="trip-result-item" style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                  <h3>LIRR Trip {trip.lirr_trip.trip_id}</h3>
                  <p>Departs Origin: {trip.lirr_trip.departure} | Arrives NYP: {trip.lirr_trip.arrival}</p>
                  
                  <h4 style={{ marginTop: '10px' }}>Amtrak Connection Choices:</h4>
                  {trip.connections.map((conn, cIdx) => (
                    <div key={cIdx} style={{ marginLeft: '15px' }}>
                      <strong>Train #{conn.train_num}</strong> 
                      <span style={{ marginLeft: '10px' }}>Departs NYP at {conn.departure}</span>
                      <span style={{ marginLeft: '10px' }}>Arrives {conn.destination} at {conn.arrival}</span>
                      <span style={{ marginLeft: '10px', color: conn.status === 'On Time' ? 'green' : 'inherit' }}>
                        ({conn.status})
                      </span>
                    </div>
                  ))}
                </div>
            ))}
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
    const formattedDate = selectedDate;

    onSearch({
      origin: from,
      destination: to,
      search_type: 'depart_by',
      time: time,
      date: formattedDate,
      transition_time: parseInt(bufferTime, 10)
    });
  };

  return (
    <div className="trip-input-container">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>From:</label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          >
            <option value="">Select a Starting Station</option>
            <option value="14">Stony Brook</option>
            <option value="102">Jamaica</option>
            <option value="179">Ronkonkoma</option>
            <option value="27">Babylon</option>
          </select>
        </div>

        <div className="input-group">
          <label>To:</label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          >
            <option value="">Select an Ending Station</option>
            <option value="WAS">Washington DC (WAS)</option>
            <option value="PHL">Philadelphia (PHL)</option>
            <option value="BOS">Boston (BOS)</option>
          </select>
        </div>

        <div className="input-group">
          <label>Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label>Departure Time:</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label>Buffer Time:</label>
          <select
            value={bufferTime}
            onChange={(e) => setBufferTime(e.target.value)}
            required
          >
            <option value="">Select a Buffer Time</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
          </select>
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Searching...' : 'Find Schedule'}
        </button>
      </form>
    </div>
  );
}

export default LandingPage;