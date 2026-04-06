import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { auditoria as audApi } from '../services/api'

function StatCard({ label, value, color, icon, to }) {
  const content = (
    <div className={`card p-5 flex items-center gap-4 ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

function tipoLabel(tipo) {
  const map = {
    CASILLERO_ACTUALIZADO: 'Casillero actualizado',
    SMS_ENVIADO: 'SMS enviado',
    SMS_RECIBIDO: 'SMS recibido',
    SMS_CONFIRMADO: 'Confirmación recibida',
    SMS_ALTA_ENVIADO: 'SMS de alta enviado',
    AUDITORIA_ENVIADA: 'Auditoría enviada',
    CONFIG_ACTUALIZADA: 'Configuración actualizada',
  }
  return map[tipo] || tipo
}

function tipoColor(tipo) {
  if (tipo.includes('SMS_CONFIRMADO')) return 'text-blue-600'
  if (tipo.includes('SMS')) return 'text-purple-600'
  if (tipo.includes('CASILLERO')) return 'text-brand-600'
  if (tipo.includes('CONFIG')) return 'text-orange-600'
  return 'text-gray-600'
}

function formatFecha(f) {
  if (!f) return ''
  return new Date(f).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    audApi.stats()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Cargando...
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
      Error: {error}
    </div>
  )

  const s = data?.stats || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Resumen del sistema Puerta de Lobres</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total casilleros"
          value={s.total}
          icon="🗃️"
          color="bg-gray-100"
          to="/casilleros"
        />
        <StatCard
          label="Activos"
          value={s.activos}
          icon="✅"
          color="bg-green-100"
          to="/casilleros?estado=ACTIVO"
        />
        <StatCard
          label="Inactivos"
          value={s.inactivos}
          icon="⭕"
          color="bg-gray-100"
          to="/casilleros?estado=INACTIVO"
        />
        <StatCard
          label="Pendientes SMS"
          value={s.pendientes_confirmacion}
          icon="💬"
          color="bg-yellow-100"
          to="/sms"
        />
      </div>

      {/* Confirmados */}
      {s.activos > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Confirmados por SMS ({s.confirmados} / {s.activos} activos)
            </span>
            <span className="text-sm text-gray-500">
              {Math.round((s.confirmados / s.activos) * 100)}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.round((s.confirmados / s.activos) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimos cambios */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Actividad reciente</h2>
            <Link to="/auditoria" className="text-xs text-brand-600 hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(data?.ultimos_logs || []).length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Sin actividad registrada</p>
            ) : (
              data.ultimos_logs.map(log => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-xs font-medium ${tipoColor(log.tipo)}`}>
                        {tipoLabel(log.tipo)}
                      </p>
                      <p className="text-sm text-gray-700 truncate">{log.descripcion}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatFecha(log.fecha)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Últimos SMS */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Últimos SMS</h2>
            <Link to="/sms" className="text-xs text-brand-600 hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(data?.ultimos_sms || []).length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Sin SMS registrados</p>
            ) : (
              data.ultimos_sms.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${s.tipo === 'ENVIADO' ? 'text-brand-600' : 'text-green-600'}`}>
                          {s.tipo === 'ENVIADO' ? '↑ Enviado' : '↓ Recibido'}
                        </span>
                        <span className="text-xs text-gray-400">{s.telefono}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{s.mensaje}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatFecha(s.fecha)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
