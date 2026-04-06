import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { casilleros as api, sms as smsApi } from '../services/api'

function formatFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function CasilleroDetalle() {
  const { id } = useParams()
  const [casillero, setCasillero] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const [msg, setMsg] = useState(null)

  function load() {
    setLoading(true)
    api.get(id)
      .then(data => {
        setCasillero(data)
        setForm({
          nombre_titular: data.nombre_titular,
          telefono_activo: data.telefono_activo,
          estado: data.estado,
          codigo_acceso: data.codigo_acceso || '',
          notas: data.notas || '',
          motivo_cambio: '',
        })
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function guardar() {
    setSaving(true)
    setMsg(null)
    try {
      await api.update(id, form)
      setEditando(false)
      setMsg({ type: 'ok', text: 'Casillero actualizado correctamente' })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function enviarSmsAlta() {
    setSendingSms(true)
    setMsg(null)
    try {
      const r = await smsApi.enviarAlta(id)
      setMsg({ type: 'ok', text: `SMS enviado a ${casillero.telefono_activo}: "${r.mensaje}"` })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSendingSms(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando...</div>

  if (!casillero) return (
    <div className="text-center py-16">
      <p className="text-gray-400">Casillero no encontrado</p>
      <Link to="/casilleros" className="btn-primary mt-4">← Volver</Link>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      {/* Breadcrumb + header */}
      <div>
        <Link to="/casilleros" className="text-sm text-brand-600 hover:underline">← Casilleros</Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Casillero <span className="font-mono">#{String(casillero.id_casillero).padStart(3, '0')}</span>
          </h1>
          <span className={casillero.estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo'}>
            {casillero.estado}
          </span>
          {casillero.sms_confirmado ? (
            <span className="badge-confirmado">SMS confirmado</span>
          ) : casillero.telefono_activo ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              SMS pendiente
            </span>
          ) : null}
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center justify-between
          ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Datos principales */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Datos del titular</h2>
          <div className="flex gap-2">
            {!editando ? (
              <>
                <button onClick={() => setEditando(true)} className="btn-secondary btn-sm">✏️ Editar</button>
                {casillero.estado === 'ACTIVO' && casillero.telefono_activo && (
                  <button
                    onClick={enviarSmsAlta}
                    disabled={sendingSms}
                    className="btn-primary btn-sm"
                  >
                    {sendingSms ? 'Enviando...' : '💬 Enviar SMS alta'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={guardar} disabled={saving} className="btn-success btn-sm">
                  {saving ? 'Guardando...' : '✓ Guardar'}
                </button>
                <button onClick={() => setEditando(false)} className="btn-secondary btn-sm">Cancelar</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre titular</label>
            {editando ? (
              <input
                value={form.nombre_titular}
                onChange={e => setForm(f => ({ ...f, nombre_titular: e.target.value }))}
                className="input"
              />
            ) : (
              <p className="text-gray-900 font-medium">{casillero.nombre_titular || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono activo</label>
            {editando ? (
              <input
                value={form.telefono_activo}
                onChange={e => setForm(f => ({ ...f, telefono_activo: e.target.value }))}
                className="input font-mono"
                placeholder="+34600000000"
              />
            ) : (
              <p className="text-gray-900 font-mono">{casillero.telefono_activo || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            {editando ? (
              <select
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="input"
              >
                <option>ACTIVO</option>
                <option>INACTIVO</option>
              </select>
            ) : (
              <span className={casillero.estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo'}>
                {casillero.estado}
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Código de acceso</label>
            {editando ? (
              <input
                value={form.codigo_acceso}
                onChange={e => setForm(f => ({ ...f, codigo_acceso: e.target.value }))}
                className="input font-mono"
                placeholder="Ej: LOBR-042"
              />
            ) : (
              <p className="text-gray-900 font-mono">{casillero.codigo_acceso || '—'}</p>
            )}
          </div>
          {editando && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo del cambio</label>
              <input
                value={form.motivo_cambio}
                onChange={e => setForm(f => ({ ...f, motivo_cambio: e.target.value }))}
                className="input"
                placeholder="Nuevo titular, cambio de número, etc."
              />
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
            {editando ? (
              <textarea
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                className="input resize-none"
                rows={2}
              />
            ) : (
              <p className="text-gray-600 text-sm">{casillero.notas || '—'}</p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-500">
          <div>
            <span className="block font-medium">Alta</span>
            {formatFecha(casillero.fecha_alta)}
          </div>
          <div>
            <span className="block font-medium">Última modificación</span>
            {formatFecha(casillero.fecha_ultima_modificacion)}
          </div>
          <div>
            <span className="block font-medium">SMS confirmado</span>
            {casillero.sms_confirmado ? formatFecha(casillero.fecha_sms_confirmado) : 'No confirmado'}
          </div>
        </div>
      </div>

      {/* Historial de teléfonos */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Historial de teléfonos</h2>
        </div>
        {(casillero.historial || []).length === 0 ? (
          <p className="p-4 text-sm text-gray-400 text-center">Sin historial de cambios</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {casillero.historial.map(h => (
              <div key={h.id} className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-400 block">Titular anterior</span>
                  <span className="font-medium">{h.nombre_anterior}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Teléfono anterior</span>
                  <span className="font-mono">{h.telefono_anterior}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Válido desde</span>
                  {formatFecha(h.fecha_inicio)}
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Reemplazado</span>
                  {formatFecha(h.fecha_fin)}
                  {h.motivo_cambio && (
                    <span className="block text-xs text-gray-400 mt-0.5">{h.motivo_cambio}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registro SMS */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Registro de SMS</h2>
        </div>
        {(casillero.sms || []).length === 0 ? (
          <p className="p-4 text-sm text-gray-400 text-center">Sin SMS registrados</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {casillero.sms.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${s.tipo === 'ENVIADO' ? 'text-brand-600' : 'text-green-600'}`}>
                      {s.tipo === 'ENVIADO' ? '↑' : '↓'} {s.tipo}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{s.telefono}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      s.estado === 'CONFIRMADO' ? 'bg-green-100 text-green-700' :
                      s.estado === 'ERROR' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.estado}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{s.mensaje}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatFecha(s.fecha)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
