import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CrewRunProvider } from './context/CrewRunContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CrewRunProvider>
        <App />
      </CrewRunProvider>
    </BrowserRouter>
  </StrictMode>,
)
