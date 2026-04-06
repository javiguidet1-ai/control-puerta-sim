const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Claves sensibles que no se deben devolver en texto plano
const SENSITIVE_KEYS = ['httpsms_api_key'];

/**
 * GET /config
 * Devuelve toda la configuración (las claves sensibles se enmascaran).
 */
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT clave, valor, descripcion, fecha_modificacion FROM configuracion').all();

  const config = {};
  for (const row of rows) {
    config[row.clave] = {
      valor: SENSITIVE_KEYS.includes(row.clave) && row.valor ? '***CONFIGURADO***' : row.valor,
      descripcion: row.descripcion,
      fecha_modificacion: row.fecha_modificacion,
      tiene_valor: !!row.valor,
    };
  }

  res.json(config);
});

/**
 * PUT /config
 * Actualiza uno o varios valores de configuración.
 * Body: { clave: valor, ... }
 */
router.put('/', (req, res) => {
  const updates = req.body || {};
  const allowed = [
    'httpsms_api_key',
    'httpsms_device_id',
    'admin_phone',
    'telefono_puerta',
    'audit_code',
    'sms_pin',
    'sms_template_alta',
    'sms_template_cambio',
  ];

  const upsert = db.prepare(`
    INSERT INTO configuracion (clave, valor, fecha_modificacion)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(clave) DO UPDATE SET
      valor = excluded.valor,
      fecha_modificacion = datetime('now')
  `);

  const cambios = [];
  for (const [clave, valor] of Object.entries(updates)) {
    if (!allowed.includes(clave)) continue;
    upsert.run(clave, String(valor));
    cambios.push(clave);
  }

  if (cambios.length > 0) {
    db.prepare(`
      INSERT INTO log_actividad (tipo, descripcion, datos_extra)
      VALUES ('CONFIG_ACTUALIZADA', ?, ?)
    `).run(
      `Configuración actualizada: ${cambios.join(', ')}`,
      JSON.stringify({ claves: cambios, usuario: req.user?.username })
    );
  }

  res.json({ success: true, actualizadas: cambios });
});

/**
 * POST /config/test-sms
 * Envía un SMS de prueba para verificar la configuración de httpSMS.
 */
router.post('/test-sms', async (req, res) => {
  const { enviarSMS, getConfig } = require('../services/httpsms');
  const { to } = req.body || {};

  const { adminPhone } = getConfig();
  const destino = to || adminPhone;

  if (!destino) {
    return res.status(400).json({ error: 'Especifica un número destino o configura el teléfono admin' });
  }

  const resultado = await enviarSMS(
    destino,
    'Puerta de Lobres: SMS de prueba. El sistema está funcionando correctamente.',
    null
  );

  if (!resultado.success) {
    return res.status(502).json({ error: resultado.error });
  }

  res.json({ success: true, messageId: resultado.messageId, destino });
});

module.exports = router;
