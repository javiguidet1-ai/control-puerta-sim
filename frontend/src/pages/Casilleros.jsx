import React, { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { casilleros as api, sms as smsApi } from '../services/api'

function Badge({ estado }) {
  return estado === 'ACTIVO'
    ? <span className="badge-activo">Activo</span>
    : <span className="badge-inactivo">Inactivo</span>
}

function SmsBadge({ confirmado }) {
  if (!confirmado) return <span className="text-yellow-600 text-xs">Pendiente</span>
  return <span className="badge-confirmado">✓ Confirmado</span>
}

export default function Casilleros() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState({ total: 0, data: [] })
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sendingSms, setSendingSms] = useState(null)

  const estado = searchParams.get('estado') || ''
  const q = searchParams.get('q') || ''

  const load = useCallback(() => {
    setLoading(true)
    api.list({ estado, q })
      .then(setData)
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }, [estado, q])

  useEffect(() => { load() }, [load])

  function abrirEdicion(c) {
    setEditando(c.id_casillero)
    setEditForm({
      nombre_titular: c.nombre_titular,
      telefono_activo: c.telefono_activo,
      estado: c.estado,
      codigo_acceso: c.codigo_acceso || '',
      notas: c.notas || '',
      motivo_cambio: '',
    })
  }

  async function guardarEdicion(id) {
    setSaving(true)
    setMsg(null)
    try {
      await api.update(id, editForm)
      setEditando(null)
      setMsg({ type: 'ok', text: `Casillero ${id} actualizado` })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function toggleEstado(c) {
    try {
      await api.update(c.id_casillero, {
        estado: c.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
      })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function enviarSmsAlta(c) {
    setSendingSms(c.id_casillero)
    try {
      await smsApi.enviarAlta(c.id_casillero)
      setMsg({ type: 'ok', text: `SMS enviado a ${c.telefono_activo}` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSendingSms(null)
    }
  }

  async function reenviarPuerta(c) {
    setSendingSms(`puerta-${c.id_casillero}`)
    try {
      await api.reenviarPuerta(c.id_casillero)
      setMsg({ type: 'ok', text: `Comando reenviado a puerta para casillero ${c.id_casillero}` })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSendingSms(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Casilleros</h1>
          <p className="text-gray-500 text-sm">{data.total} posiciones</p>
        </div>
        <button
          onClick={() => api.exportCsv(estado)}
          className="btn-secondary btn-sm"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={q}
          onChange={e => setSearchParams(p => {
            const n = new URLSearchParams(p)
            e.target.value ? n.set('q', e.target.value) : n.delete('q')
            return n
          })}
          className="input max-w-xs"
          placeholder="Buscar nombre o teléfono..."
        />
        <select
          value={estado}
          onChange={e => setSearchParams(p => {
            const n = new URLSearchParams(p)
            e.target.value ? n.set('estado', e.target.value) : n.delete('estado')
            return n
          })}
          className="input w-auto"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Solo activos</option>
          <option value="INACTIVO">Solo inactivos</option>
        </select>
        {(q || estado) && (
          <button
            onClick={() => setSearchParams({})}
            className="btn-secondary btn-sm"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Mensaje feedback */}
      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center justify-between
          ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Cargando...</div>
        ) : data.data.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No se encontraron casilleros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Titular</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">SMS</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map(c => (
                  <React.Fragment key={c.id_casillero}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-700">{String(c.id_casillero).padStart(3, '0')}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editando === c.id_casillero ? (
                          <input
                            value={editForm.nombre_titular}
                            onChange={e => setEditForm(f => ({ ...f, nombre_titular: e.target.value }))}
                            className="input py-1"
                          />
                        ) : (
                          <span className={c.nombre_titular === 'SIN ASIGNAR' ? 'text-gray-400 italic' : 'font-medium'}>
                            {c.nombre_titular}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {editando === c.id_casillero ? (
                          <input
                            value={editForm.telefono_activo}
                            onChange={e => setEditForm(f => ({ ...f, telefono_activo: e.target.value }))}
                            className="input py-1"
                            placeholder="+34600000000"
                          />
                        ) : (
                          <span className="font-mono text-gray-600">{c.telefono_activo || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editando === c.id_casillero ? (
                          <select
                            value={editForm.estado}
                            onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))}
                            className="input py-1 w-auto"
                          >
                            <option>ACTIVO</option>
                            <option>INACTIVO</option>
                          </select>
                        ) : (
                          <Badge estado={c.estado} />
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <SmsBadge confirmado={c.sms_confirmado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {editando === c.id_casillero ? (
                            <>
                              <button
                                onClick={() => guardarEdicion(c.id_casillero)}
                                disabled={saving}
                                className="btn-success btn-sm"
                              >
                                {saving ? '...' : '✓ Guardar'}
                              </button>
                              <button
                                onClick={() => setEditando(null)}
                                className="btn-secondary btn-sm"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicion(c)}
                                className="btn-secondary btn-sm"
                              >
                                ✏️ Editar
                              </button>
                              <Link
                                to={`/casilleros/${c.id_casillero}`}
                                className="btn-secondary btn-sm"
                              >
                                👁 Ver
                              </Link>
                              {c.estado === 'ACTIVO' && c.telefono_activo && !c.sms_confirmado && (
                                <button
                                  onClick={() => reenviarPuerta(c)}
                                  disabled={sendingSms === `puerta-${c.id_casillero}`}
                                  className="btn-primary btn-sm"
                                  title="Reenviar comando al controlador de la puerta"
                                >
                                  {sendingSms === `puerta-${c.id_casillero}` ? '...' : '🚪 Puerta'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Fila de campos extra al editar */}
                    {editando === c.id_casillero && (
                      <tr className="bg-brand-50 border-b border-brand-100">
                        <td colSpan={6} className="px-4 pb-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Código de acceso</label>
                              <input
                                value={editForm.codigo_acceso}
                                onChange={e => setEditForm(f => ({ ...f, codigo_acceso: e.target.value }))}
                                className="input py-1"
                                placeholder="Ej: LOBR-042"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Motivo del cambio</label>
                              <input
                                value={editForm.motivo_cambio}
                                onChange={e => setEditForm(f => ({ ...f, motivo_cambio: e.target.value }))}
                                className="input py-1"
                                placeholder="Nuevo titular, cambio número..."
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Notas</label>
                              <input
                                value={editForm.notas}
                                onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                                className="input py-1"
                                placeholder="Observaciones internas"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
