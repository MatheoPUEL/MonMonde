import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ReadingPage } from './pages/reading/ReadingPage'
import { JournalPage } from './pages/journal/JournalPage'
import { RoutinesPage } from './pages/routines/RoutinesPage'
import { CitationsPage } from './pages/citations/CitationsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reading/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReadingPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/journal/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <JournalPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/routines/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RoutinesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/citations/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CitationsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
