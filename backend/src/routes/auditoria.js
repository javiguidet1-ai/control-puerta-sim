const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /auditoria/lista
 * Snapshot de todos los casilleros activos.
 */
router.get('/lista', (req, res) => {
  const activos = db.prepare(`
    SELECT id_casillero, nombre_titular, telefono_activo, codigo_acceso,
           fecha_alta, fecha_ultima_modificacion, sms_confirmado
    FROM casilleros
    WHERE estado = 'ACTIVO'
    ORDER BY id_casillero
  `).all();

  res.json({
    total: activos.length,
    generado_en: new Date().toISOString(),
    data: activos,
  });
});

/**
 * GET /auditoria/log
 * Log de actividad del sistema.
 * Parámetros: ?tipo=&page=1&limit=100
 */
router.get('/log', (req, res) => {
  const { tipo, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (tipo) {
    where += ' AND tipo = ?';
    params.push(tipo);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM log_actividad WHERE ${where}`).get(...params).n;
  const data = db.prepare(`
    SELECT l.*, c.nombre_titular
    FROM log_actividad l
    LEFT JOIN casilleros c ON l.id_casillero = c.id_casillero
    WHERE ${where}
    ORDER BY l.fecha DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), data });
});

/**
 * GET /auditoria/stats
 * Estadísticas generales para el dashboard.
 */
router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN estado = 'ACTIVO' THEN 1 ELSE 0 END) as activos,
      SUM(CASE WHEN estado = 'INACTIVO' THEN 1 ELSE 0 END) as inactivos,
      SUM(CASE WHEN estado = 'ACTIVO' AND sms_confirmado = 1 THEN 1 ELSE 0 END) as confirmados,
      SUM(CASE WHEN estado = 'ACTIVO' AND (sms_confirmado = 0 OR sms_confirmado IS NULL) AND telefono_activo != '' THEN 1 ELSE 0 END) as pendientes_confirmacion
    FROM casilleros
  `).get();

  const ultimosLogs = db.prepare(`
    SELECT l.*, c.nombre_titular
    FROM log_actividad l
    LEFT JOIN casilleros c ON l.id_casillero = c.id_casillero
    ORDER BY l.fecha DESC
    LIMIT 10
  `).all();

  const ultimosSMS = db.prepare(`
    SELECT s.*, c.nombre_titular
    FROM sms_registro s
    LEFT JOIN casilleros c ON s.id_casillero = c.id_casillero
    ORDER BY s.fecha DESC
    LIMIT 10
  `).all();

  res.json({
    stats,
    ultimos_logs: ultimosLogs,
    ultimos_sms: ultimosSMS,
  });
});

module.exports = router;
