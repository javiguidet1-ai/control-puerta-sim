import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Casilleros from './pages/Casilleros'
import CasilleroDetalle from './pages/CasilleroDetalle'
import SMS from './pages/SMS'
import Auditoria from './pages/Auditoria'
import Configuracion from './pages/Configuracion'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Cargando...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/casilleros" element={<PrivateRoute><Casilleros /></PrivateRoute>} />
      <Route path="/casilleros/:id" element={<PrivateRoute><CasilleroDetalle /></PrivateRoute>} />
      <Route path="/sms" element={<PrivateRoute><SMS /></PrivateRoute>} />
      <Route path="/auditoria" element={<PrivateRoute><Auditoria /></PrivateRoute>} />
      <Route path="/configuracion" element={<PrivateRoute><Configuracion /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
