import { useState } from 'react'
import './LandingPage.css'
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


function LandingPage() {
  // const [count, setCount] = useState(0)


  return (
    <>
    <div>
      <h1>Welcome</h1>
      <UserInput />
    </div>
      

      
    </>
  );
}

function UserInput() {
//inputs
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bufferTime, setBufferTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);

  <h>test</h>
  return (
    <div className= "container">
      <h1>Plan your Trip</h1>
      <form>
        <div className= "input-group">
          <label>From:</label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">Select a Starting Station</option>
            <option value="Stony Brook">Stony Brook</option>
            <option value="Jamaica">Jamaica</option>
          </select>
        </div>

        <div className= "input-group">
          <label>To:</label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">Select an Ending Station</option>
            <option value="Stony Brook">Stony Brook</option>
            <option value="Jamaica">Jamaica</option>
          </select>
        </div>

        <div className= "input-group">
          <label>Date:</label>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            placeholderText="Select a date"
          />
        </div>

        <div className= "input-group">
          <label>Departure Time:</label>
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className= "input-group">
          <label>Buffer Time:</label>
          <select
            value={bufferTime}
            onChange={(e) => setBufferTime(e.target.value)}
          >
            <option value="">Select a Buffer Time</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        </div>

        <button type="submit" className="btn-submit">Find Schedule</button>
      </form>
    </div>
    
  );
}

export default LandingPage
