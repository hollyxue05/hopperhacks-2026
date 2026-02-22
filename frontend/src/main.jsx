import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LandingPage from './LandingPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LandingPage />
import App from './App.jsx'
import Page2 from './Page2.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Page2 />
  </StrictMode>,
)
