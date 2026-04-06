const fetch = require('node-fetch');
const db = require('../db/database');

const HTTPSMS_BASE = 'https://api.httpsms.com/v1';

/**
 * Obtiene la configuración de httpSMS desde la BD o variables de entorno.
 */
function getConfig() {
  const getVal = db.prepare('SELECT valor FROM configuracion WHERE clave = ?');
  return {
    apiKey: getVal.get('httpsms_api_key')?.valor || process.env.HTTPSMS_API_KEY || '',
    deviceId: getVal.get('httpsms_device_id')?.valor || process.env.HTTPSMS_DEVICE_ID || '',
    adminPhone: getVal.get('admin_phone')?.valor || process.env.ADMIN_PHONE || '',
  };
}

/**
 * Envía un SMS mediante httpSMS API.
 * @param {string} to - Número destino en formato E.164 (+34XXXXXXXXX)
 * @param {string} message - Contenido del mensaje
 * @param {number|null} idCasillero - Referencia del casillero (opcional)
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function enviarSMS(to, message, idCasillero = null) {
  const { apiKey, deviceId, adminPhone } = getConfig();

  if (!apiKey || !deviceId || !adminPhone) {
    return { success: false, error: 'httpSMS no configurado. Revisa los ajustes del sistema.' };
  }

  const payload = {
    content: message,
    from: adminPhone,
    to,
    ...(deviceId && { device_id: deviceId }),
  };

  let respData = null;
  try {
    const resp = await fetch(`${HTTPSMS_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    respData = await resp.json();

    if (!resp.ok) {
      const errMsg = respData?.message || `HTTP ${resp.status}`;
      registrarSMS('ENVIADO', to, message, idCasillero, 'ERROR', null);
      return { success: false, error: errMsg };
    }

    const messageId = respData?.data?.id || null;
    registrarSMS('ENVIADO', to, message, idCasillero, 'ENVIADO', messageId);
    return { success: true, messageId };

  } catch (err) {
    registrarSMS('ENVIADO', to, message, idCasillero, 'ERROR', null);
    return { success: false, error: err.message };
  }
}

/**
 * Registra un SMS (enviado o recibido) en la tabla sms_registro.
 */
function registrarSMS(tipo, telefono, mensaje, idCasillero, estado, mensajeIdExterno) {
  try {
    db.prepare(`
      INSERT INTO sms_registro (tipo, telefono, mensaje, id_casillero, estado, mensaje_id_externo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tipo, telefono, mensaje, idCasillero, estado, mensajeIdExterno);
  } catch {
    // No bloquear el flujo por fallos de logging
  }
}

/**
 * Construye un mensaje SMS con una plantilla y variables.
 * Variables: [NOMBRE], [NUM], [CODIGO]
 */
function buildTemplate(template, vars = {}) {
  return template
    .replace(/\[NOMBRE\]/g, vars.nombre || '')
    .replace(/\[NUM\]/g, vars.num || '')
    .replace(/\[CODIGO\]/g, vars.codigo || '');
}

/**
 * Obtiene plantillas configuradas desde la BD.
 */
function getTemplates() {
  const getVal = db.prepare('SELECT valor FROM configuracion WHERE clave = ?');
  return {
    alta: getVal.get('sms_template_alta')?.valor || 'Hola [NOMBRE], casillero [NUM] activado. - Puerta de Lobres',
    cambio: getVal.get('sms_template_cambio')?.valor || 'Hola [NOMBRE], acceso casillero [NUM] actualizado. - Puerta de Lobres',
  };
}

module.exports = { enviarSMS, registrarSMS, buildTemplate, getTemplates, getConfig };
