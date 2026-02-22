import './Page2.css'

function Page2() {

  return (

 <div className = "schedule">

    <div className="start-station">
        <div className = "station-header-w-time">
        <h2>Station 1</h2> {/* <h2>{station.name}</h2> */}
        <span className="station-time">10:30 AM</span>
           {/*<span className="station-time">{station.time}</span> */} 
        </div>

        <div className="station-stops">
            <ul className="each-stop" style={{ listStyleType: 'none', paddingLeft: '25px', margin: 0, textAlign: 'left' }}>             
            <li>Stop 1</li>
            <li>Stop 2</li>
            <li>Stop 3</li>
            </ul>
        </div>
    </div>

     <div className="dest-station">
        <div className = "station-header-w-time">
        <h2>Dest station</h2> {/* <h2>{station.name}</h2> */}
        <span className="station-time">12:15 PM</span>
           {/*<span className="station-time">{station.time}</span> */} 
        </div>

        <div className="station-stops">
            <ul className="each-stop" style={{ listStyleType: 'none', paddingLeft: '25px', margin: 0, textAlign: 'left' }}>             
            <li>Stop 1</li>
            <li>Stop 2</li>
            </ul>
        </div>
    </div>



</div>
  )
}

export default Page2
