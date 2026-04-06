import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth as authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pl_token')
    if (!token) { setLoading(false); return }

    authApi.verify()
      .then(data => { if (data.valid) setUser(data.user) })
      .catch(() => localStorage.removeItem('pl_token'))
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const data = await authApi.login(username, password)
    localStorage.setItem('pl_token', data.token)
    setUser({ username: data.username, role: data.role })
    return data
  }

  function logout() {
    localStorage.removeItem('pl_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
