const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { enviarSMS, buildTemplate, getTemplates } = require('../services/httpsms');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /sms/enviar
 * Envía un SMS a un número de teléfono.
 * Body: { to, message, id_casillero? }
 */
router.post('/enviar', async (req, res) => {
  const { to, message, id_casillero } = req.body || {};

  if (!to || !message) {
    return res.status(400).json({ error: 'Campos requeridos: to, message' });
  }

  const resultado = await enviarSMS(to, message, id_casillero || null);

  if (!resultado.success) {
    return res.status(502).json({ error: resultado.error });
  }

  // Log de actividad
  db.prepare(`
    INSERT INTO log_actividad (tipo, descripcion, id_casillero, datos_extra)
    VALUES ('SMS_ENVIADO', ?, ?, ?)
  `).run(
    `SMS enviado a ${to}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
    id_casillero || null,
    JSON.stringify({ to, messageId: resultado.messageId })
  );

  res.json({ success: true, messageId: resultado.messageId });
});

/**
 * POST /sms/enviar-alta/:id
 * Envía el SMS de alta/bienvenida al titular del casillero especificado.
 */
router.post('/enviar-alta/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1 || id > 200) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const casillero = db.prepare('SELECT * FROM casilleros WHERE id_casillero = ?').get(id);
  if (!casillero) return res.status(404).json({ error: 'Casillero no encontrado' });
  if (!casillero.telefono_activo) return res.status(400).json({ error: 'El casillero no tiene teléfono asignado' });

  const templates = getTemplates();
  const mensaje = buildTemplate(templates.alta, {
    nombre: casillero.nombre_titular,
    num: String(id),
    codigo: casillero.codigo_acceso || '',
  });

  const resultado = await enviarSMS(casillero.telefono_activo, mensaje, id);

  if (!resultado.success) {
    return res.status(502).json({ error: resultado.error });
  }

  db.prepare(`
    INSERT INTO log_actividad (tipo, descripcion, id_casillero, datos_extra)
    VALUES ('SMS_ALTA_ENVIADO', ?, ?, ?)
  `).run(`SMS de alta enviado al casillero ${id} (${casillero.nombre_titular})`, id, JSON.stringify({ messageId: resultado.messageId }));

  res.json({ success: true, messageId: resultado.messageId, mensaje });
});

/**
 * GET /sms/registro
 * Historial de SMS enviados y recibidos.
 * Parámetros: ?tipo=ENVIADO|RECIBIDO&page=1&limit=50
 */
router.get('/registro', (req, res) => {
  const { tipo, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (tipo && ['ENVIADO', 'RECIBIDO'].includes(tipo)) {
    where += ' AND tipo = ?';
    params.push(tipo);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM sms_registro WHERE ${where}`).get(...params).n;
  const data = db.prepare(`
    SELECT s.*, c.nombre_titular
    FROM sms_registro s
    LEFT JOIN casilleros c ON s.id_casillero = c.id_casillero
    WHERE ${where}
    ORDER BY s.fecha DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), data });
});

/**
 * GET /sms/pendientes
 * Casilleros activos sin confirmación de SMS.
 */
router.get('/pendientes', (req, res) => {
  const pendientes = db.prepare(`
    SELECT id_casillero, nombre_titular, telefono_activo, estado,
           fecha_ultima_modificacion
    FROM casilleros
    WHERE estado = 'ACTIVO'
      AND (sms_confirmado = 0 OR sms_confirmado IS NULL)
      AND telefono_activo != ''
    ORDER BY id_casillero
  `).all();

  res.json({ total: pendientes.length, data: pendientes });
});

module.exports = router;
