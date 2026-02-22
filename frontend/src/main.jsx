import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LandingPage from './LandingPage.jsx'
import 'leaflet/dist/leaflet.css';
import Page2 from './Page2.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LandingPage />
    {/* <Page2 /> */}
  </StrictMode>,
)
