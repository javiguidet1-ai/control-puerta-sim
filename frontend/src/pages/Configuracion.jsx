import React, { useEffect, useState } from 'react'
import { config as configApi } from '../services/api'

export default function Configuracion() {
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    configApi.get()
      .then(data => {
        setCfg(data)
        // Inicializar form con valores actuales (las claves sensibles aparecen como '***CONFIGURADO***')
        const f = {}
        for (const [k, v] of Object.entries(data)) {
          f[k] = v.tiene_valor && v.valor === '***CONFIGURADO***' ? '' : v.valor
        }
        setForm(f)
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }, [])

  async function handleGuardar(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      // Solo enviar campos que tienen valor o fueron modificados
      const updates = {}
      for (const [k, v] of Object.entries(form)) {
        if (v !== '') updates[k] = v
      }
      await configApi.update(updates)
      setMsg({ type: 'ok', text: 'Configuración guardada correctamente' })
      configApi.get().then(data => {
        setCfg(data)
      })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSms() {
    setTesting(true)
    setMsg(null)
    try {
      const r = await configApi.testSms(form.admin_phone || '')
      setMsg({ type: 'ok', text: `SMS de prueba enviado a ${r.destino}. ID: ${r.messageId}` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando...</div>

  function field(key) {
    return form[key] ?? ''
  }

  const tieneValor = (key) => cfg?.[key]?.tiene_valor

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm">Ajustes del sistema y gateway SMS</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center justify-between
          ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <form onSubmit={handleGuardar} className="space-y-6">

        {/* httpSMS */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">Gateway httpSMS</h2>
            <a
              href="https://httpsms.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:underline"
            >
              httpsms.com ↗
            </a>
          </div>
          <p className="text-xs text-gray-500">
            httpSMS usa tu móvil Android como gateway real de SMS. Los mensajes se envían desde tu número personal.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key {tieneValor('httpsms_api_key') && <span className="text-green-600 text-xs ml-1">✓ Configurada</span>}
            </label>
            <input
              type="password"
              value={field('httpsms_api_key')}
              onChange={e => setForm(f => ({ ...f, httpsms_api_key: e.target.value }))}
              className="input font-mono"
              placeholder={tieneValor('httpsms_api_key') ? '(dejar vacío para no cambiar)' : 'sk_xxxxxxxxxxxxx'}
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-0.5">Encuéntrala en httpsms.com → Settings → API Keys</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device ID {tieneValor('httpsms_device_id') && <span className="text-green-600 text-xs ml-1">✓ Configurado</span>}
            </label>
            <input
              value={field('httpsms_device_id')}
              onChange={e => setForm(f => ({ ...f, httpsms_device_id: e.target.value }))}
              className="input font-mono"
              placeholder={tieneValor('httpsms_device_id') ? '(dejar vacío para no cambiar)' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
            />
            <p className="text-xs text-gray-400 mt-0.5">ID del dispositivo Android en la app httpSMS</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono administrador</label>
            <input
              value={field('admin_phone')}
              onChange={e => setForm(f => ({ ...f, admin_phone: e.target.value }))}
              className="input font-mono"
              placeholder="+34600000000"
            />
            <p className="text-xs text-gray-400 mt-0.5">Número del móvil Android con httpSMS instalado</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de la puerta (6036)</label>
            <input
              value={field('telefono_puerta')}
              onChange={e => setForm(f => ({ ...f, telefono_puerta: e.target.value }))}
              className="input font-mono"
              placeholder="672230144"
            />
            <p className="text-xs text-gray-400 mt-0.5">Número de la SIM instalada en el controlador de la puerta. Los comandos se envían a este número.</p>
          </div>

          <button
            type="button"
            onClick={handleTestSms}
            disabled={testing}
            className="btn-secondary btn-sm"
          >
            {testing ? 'Enviando...' : '🧪 Probar SMS de prueba'}
          </button>
        </div>

        {/* Comandos */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Comandos SMS</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN de comandos SMS</label>
            <input
              value={field('sms_pin')}
              onChange={e => setForm(f => ({ ...f, sms_pin: e.target.value }))}
              className="input font-mono"
              placeholder="1234"
              maxLength={10}
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Prefijo de seguridad para los comandos SMS.<br/>
              <span className="font-medium">[PIN]AL001#200#</span> → lista casilleros 1-200 &nbsp;|&nbsp;
              <span className="font-medium">[PIN]A197#606703832#</span> → asigna teléfono al casillero 197
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de auditoría (legado)</label>
            <input
              value={field('audit_code')}
              onChange={e => setForm(f => ({ ...f, audit_code: e.target.value.toUpperCase() }))}
              className="input font-mono uppercase"
              placeholder="LISTA200"
              maxLength={20}
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Envía este código desde el número admin para recibir la lista completa
            </p>
          </div>
        </div>

        {/* Plantillas */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Plantillas de SMS</h2>
          <p className="text-xs text-gray-500">
            Variables disponibles: <code className="bg-gray-100 px-1 rounded">[NOMBRE]</code>{' '}
            <code className="bg-gray-100 px-1 rounded">[NUM]</code>{' '}
            <code className="bg-gray-100 px-1 rounded">[CODIGO]</code>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMS de alta / bienvenida</label>
            <textarea
              value={field('sms_template_alta')}
              onChange={e => setForm(f => ({ ...f, sms_template_alta: e.target.value }))}
              className="input resize-none"
              rows={3}
            />
            {field('sms_template_alta') && (
              <p className="text-xs text-gray-400 mt-1">{field('sms_template_alta').length} caracteres</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMS de cambio de titular</label>
            <textarea
              value={field('sms_template_cambio')}
              onChange={e => setForm(f => ({ ...f, sms_template_cambio: e.target.value }))}
              className="input resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Webhook info */}
        <div className="card p-5 bg-blue-50 border-blue-200">
          <h2 className="font-semibold text-blue-800 mb-2">🔗 URL del Webhook</h2>
          <p className="text-sm text-blue-700 mb-2">
            Configura esta URL en httpSMS para recibir SMS entrantes automáticamente:
          </p>
          <div className="bg-white rounded-lg border border-blue-200 px-3 py-2 font-mono text-sm text-blue-900 break-all">
            {window.location.origin.replace(':5173', ':3001')}/webhook/sms
          </div>
          <p className="text-xs text-blue-600 mt-2">
            En httpSms: Settings → Webhooks → Add webhook → URL arriba → Event: <code>message.phone.received</code>
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : '💾 Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  )
}
