import React, { useEffect, useState } from 'react'
import { sms as smsApi, casilleros as casApi } from '../services/api'
import { Link } from 'react-router-dom'

function formatFecha(f) {
  if (!f) return ''
  return new Date(f).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function SMS() {
  const [tab, setTab] = useState('registro')
  const [registro, setRegistro] = useState({ total: 0, data: [] })
  const [pendientes, setPendientes] = useState({ total: 0, data: [] })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  // Envío manual
  const [sendForm, setSendForm] = useState({ to: '', message: '', id_casillero: '' })
  const [sending, setSending] = useState(false)

  // Envío masivo a pendientes
  const [enviandoMasivo, setEnviandoMasivo] = useState(false)

  useEffect(() => {
    if (tab === 'registro') {
      setLoading(true)
      smsApi.registro({ limit: 100 })
        .then(setRegistro)
        .catch(e => setMsg({ type: 'error', text: e.message }))
        .finally(() => setLoading(false))
    } else if (tab === 'pendientes') {
      setLoading(true)
      smsApi.pendientes()
        .then(setPendientes)
        .catch(e => setMsg({ type: 'error', text: e.message }))
        .finally(() => setLoading(false))
    }
  }, [tab])

  async function handleEnviar(e) {
    e.preventDefault()
    setSending(true)
    setMsg(null)
    try {
      await smsApi.enviar(sendForm.to, sendForm.message, sendForm.id_casillero || null)
      setMsg({ type: 'ok', text: `SMS enviado a ${sendForm.to}` })
      setSendForm({ to: '', message: '', id_casillero: '' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSending(false)
    }
  }

  async function enviarAltaMasivo() {
    if (!confirm(`¿Enviar SMS de alta a los ${pendientes.total} casilleros pendientes de confirmación?`)) return
    setEnviandoMasivo(true)
    setMsg(null)
    let ok = 0, fail = 0
    for (const c of pendientes.data) {
      try {
        await smsApi.enviarAlta(c.id_casillero)
        ok++
      } catch { fail++ }
      // Pequeña pausa para no saturar httpSMS
      await new Promise(r => setTimeout(r, 300))
    }
    setMsg({ type: 'ok', text: `Envío completado: ${ok} enviados, ${fail} errores` })
    setEnviandoMasivo(false)
    smsApi.pendientes().then(setPendientes)
  }

  const tabs = [
    { id: 'enviar', label: '✉️ Enviar SMS' },
    { id: 'registro', label: '📋 Registro' },
    { id: 'pendientes', label: '⏳ Pendientes' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SMS</h1>
        <p className="text-gray-500 text-sm">Gestión de mensajes via httpSMS</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center justify-between
          ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabs */}
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

      {/* ── ENVIAR ── */}
      {tab === 'enviar' && (
        <div className="card p-5 max-w-lg">
          <h2 className="font-semibold text-gray-800 mb-4">Enviar SMS manual</h2>
          <form onSubmit={handleEnviar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número destino</label>
              <input
                value={sendForm.to}
                onChange={e => setSendForm(f => ({ ...f, to: e.target.value }))}
                className="input font-mono"
                placeholder="+34600000000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Casillero asociado (opcional)</label>
              <input
                type="number"
                value={sendForm.id_casillero}
                onChange={e => setSendForm(f => ({ ...f, id_casillero: e.target.value }))}
                className="input"
                placeholder="1 – 200"
                min={1}
                max={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
              <textarea
                value={sendForm.message}
                onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                className="input resize-none"
                rows={4}
                placeholder="Texto del mensaje..."
                required
              />
              <p className="text-xs text-gray-400 mt-1">{sendForm.message.length} caracteres</p>
            </div>
            <button type="submit" disabled={sending} className="btn-primary">
              {sending ? 'Enviando...' : '📤 Enviar SMS'}
            </button>
          </form>
        </div>
      )}

      {/* ── REGISTRO ── */}
      {tab === 'registro' && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Cargando...</div>
          ) : registro.data.length === 0 ? (
            <div className="py-12 text-center text-gray-400">Sin SMS registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Teléfono</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Casillero</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Mensaje</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registro.data.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${s.tipo === 'ENVIADO' ? 'text-brand-600' : 'text-green-600'}`}>
                          {s.tipo === 'ENVIADO' ? '↑ Enviado' : '↓ Recibido'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.telefono}</td>
                      <td className="px-4 py-3">
                        {s.id_casillero ? (
                          <Link to={`/casilleros/${s.id_casillero}`} className="text-brand-600 hover:underline">
                            #{String(s.id_casillero).padStart(3, '0')}
                            {s.nombre_titular ? ` ${s.nombre_titular}` : ''}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-700">{s.mensaje}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          s.estado === 'CONFIRMADO' ? 'bg-green-100 text-green-700' :
                          s.estado === 'ERROR' ? 'bg-red-100 text-red-700' :
                          s.estado === 'ENVIADO' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{s.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatFecha(s.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PENDIENTES ── */}
      {tab === 'pendientes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-sm">
              {pendientes.total} casilleros activos sin confirmación de SMS
            </p>
            {pendientes.total > 0 && (
              <button
                onClick={enviarAltaMasivo}
                disabled={enviandoMasivo}
                className="btn-primary btn-sm"
              >
                {enviandoMasivo ? 'Enviando...' : `📤 Enviar SMS a todos (${pendientes.total})`}
              </button>
            )}
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-gray-400">Cargando...</div>
            ) : pendientes.data.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                ✅ Todos los casilleros activos han confirmado por SMS
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendientes.data.map(c => (
                  <div key={c.id_casillero} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <Link
                        to={`/casilleros/${c.id_casillero}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        #{String(c.id_casillero).padStart(3, '0')} — {c.nombre_titular}
                      </Link>
                      <p className="text-sm text-gray-500 font-mono">{c.telefono_activo}</p>
                    </div>
                    <button
                      onClick={() => smsApi.enviarAlta(c.id_casillero)
                        .then(() => {
                          setMsg({ type: 'ok', text: `SMS enviado a casillero ${c.id_casillero}` })
                          smsApi.pendientes().then(setPendientes)
                        })
                        .catch(e => setMsg({ type: 'error', text: e.message }))
                      }
                      className="btn-primary btn-sm"
                    >
                      💬 SMS
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
