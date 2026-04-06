import React, { useEffect, useState } from 'react'
import { auditoria as audApi } from '../services/api'
import { Link } from 'react-router-dom'

function formatFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function Auditoria() {
  const [tab, setTab] = useState('lista')
  const [lista, setLista] = useState({ total: 0, data: [] })
  const [log, setLog] = useState({ total: 0, data: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (tab === 'lista') {
      audApi.lista()
        .then(setLista)
        .finally(() => setLoading(false))
    } else {
      audApi.log({ limit: 200 })
        .then(setLog)
        .finally(() => setLoading(false))
    }
  }, [tab])

  function exportarListaCSV() {
    const header = 'ID,Titular,Teléfono,Código,SMS Confirmado\n'
    const rows = lista.data.map(c =>
      `${c.id_casillero},"${c.nombre_titular}",${c.telefono_activo},${c.codigo_acceso || ''},${c.sms_confirmado ? 'Sí' : 'No'}`
    ).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_activos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const tabs = [
    { id: 'lista', label: '📋 Lista activos' },
    { id: 'log', label: '🕐 Log actividad' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-gray-500 text-sm">Snapshot y trazabilidad del sistema</p>
        </div>
        {tab === 'lista' && lista.total > 0 && (
          <button onClick={exportarListaCSV} className="btn-secondary btn-sm">
            ⬇ Exportar CSV activos
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LISTA ACTIVOS ── */}
      {tab === 'lista' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Casilleros activos ({lista.total})
            </h2>
            <span className="text-xs text-gray-400">
              Generado: {formatFecha(new Date().toISOString())}
            </span>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400">Cargando...</div>
          ) : lista.data.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No hay casilleros activos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Titular</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Teléfono</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">SMS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lista.data.map(c => (
                    <tr key={c.id_casillero} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link to={`/casilleros/${c.id_casillero}`} className="font-mono font-bold text-brand-600 hover:underline">
                          {String(c.id_casillero).padStart(3, '0')}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-medium">{c.nombre_titular}</td>
                      <td className="px-4 py-2 font-mono text-gray-600">{c.telefono_activo || '—'}</td>
                      <td className="px-4 py-2 font-mono text-gray-500">{c.codigo_acceso || '—'}</td>
                      <td className="px-4 py-2">
                        {c.sms_confirmado
                          ? <span className="badge-confirmado">✓</span>
                          : <span className="text-yellow-600 text-xs">Pendiente</span>
                        }
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{formatFecha(c.fecha_alta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LOG DE ACTIVIDAD ── */}
      {tab === 'log' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Log de actividad ({log.total})</h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400">Cargando...</div>
          ) : log.data.length === 0 ? (
            <div className="py-12 text-center text-gray-400">Sin actividad registrada</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {log.data.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {entry.tipo}
                      </span>
                      {entry.id_casillero && (
                        <Link
                          to={`/casilleros/${entry.id_casillero}`}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          #{String(entry.id_casillero).padStart(3, '0')}
                          {entry.nombre_titular ? ` ${entry.nombre_titular}` : ''}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{entry.descripcion}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatFecha(entry.fecha)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
