import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { BuildersPage } from './pages/BuildersPage'
import { DeploymentsPage } from './pages/DeploymentsPage'
import { LandingPage } from './pages/LandingPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/builders" element={<BuildersPage />} />
        <Route path="/deployments" element={<DeploymentsPage />} />
        <Route
          path="/dashboard"
          element={
            <PlaceholderPage
              title="Dashboard"
              hint="Ship telemetry and workspace overview will appear here."
            />
          }
        />
        <Route
          path="/resources"
          element={
            <PlaceholderPage
              title="Resources"
              hint="Connect repos, secrets, and infrastructure targets."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <PlaceholderPage
              title="Settings"
              hint="Workspace preferences and agent defaults."
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
