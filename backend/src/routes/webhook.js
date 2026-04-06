const express = require('express');
const { procesarSMSEntrante } = require('../services/smsProcessor');

const router = express.Router();

/**
 * POST /webhook/sms
 * Endpoint que recibe los SMS entrantes desde httpSMS.
 * httpSMS enviará un POST a esta URL cuando llegue un SMS al móvil administrador.
 *
 * Payload esperado de httpSMS (formato v1):
 * {
 *   "id": "mensaje-id",
 *   "owner": "+34600000000",
 *   "contact": "+34611222333",
 *   "content": "OK",
 *   "created_at": "2024-01-01T10:00:00Z",
 *   "event_name": "message.phone.received"
 * }
 */
router.post('/sms', async (req, res) => {
  // ─── SEGURIDAD: Validaciones básicas del webhook ─────────────────────────
  // Verificar que el body no está vacío
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Body vacío' });
  }

  // Limitar tamaño del payload
  const bodyStr = JSON.stringify(req.body);
  if (bodyStr.length > 10000) {
    return res.status(413).json({ error: 'Payload demasiado grande' });
  }

  // Responder 200 inmediatamente a httpSMS para evitar reintentos
  res.status(200).json({ received: true });

  const payload = req.body || {};

  // httpSMS envía el evento en "type" y los datos en "data" (CloudEvents spec)
  const evento    = payload.type || payload.event_name || '';
  const data      = payload.data || payload;

  const from      = data.contact || data.from || data.sender || '';
  const message   = data.content || data.message || data.body || '';
  const messageId = data.message_id || payload.id || null;

  // SMS recibido → procesar respuesta de la puerta o confirmación OK
  if (evento.includes('received') || evento.includes('incoming') || evento === '') {
    if (!from || !message) return;
    procesarSMSEntrante(from, message, messageId).catch(err => {
      console.error('[Webhook] Error procesando SMS:', err.message);
    });
    return;
  }

  // Mensaje expirado → reintentar si era un comando a la puerta
  if (evento.includes('expired')) {
    const contenido = message || data.content || '';
    if (/^\d{4}A\d{1,3}#\d+#$/.test(contenido.trim())) {
      const intentos = (data.send_attempt_count || 1);
      if (intentos <= 3) {
        console.log(`[RETRY] Mensaje expirado (intento ${intentos}), reenviando: "${contenido}"`);
        const { enviarSMS } = require('../services/httpsms');
        const db = require('../db/database');
        const telPuerta = db.prepare("SELECT valor FROM configuracion WHERE clave='telefono_puerta'").get()?.valor;
        if (telPuerta) {
          setTimeout(() => {
            enviarSMS(telPuerta, contenido.trim(), null)
              .then(r => console.log(`[RETRY] Resultado reenvío: ${r.success ? 'OK' : r.error}`))
              .catch(e => console.error('[RETRY] Error:', e.message));
          }, 5000); // espera 5s antes de reintentar
        }
      } else {
        console.log(`[RETRY] Máximo de intentos alcanzado para: "${contenido}"`);
      }
    }
    return;
  }
});

/**
 * GET /webhook/sms/test
 * Endpoint de prueba para verificar que el webhook está activo.
 */
router.get('/sms/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Webhook de Puerta de Lobres activo',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
