const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ─── SEGURIDAD: Validación de teléfono ───────────────────────────────────────
function validarTelefono(tel) {
  if (!tel || tel === '') return { ok: true, valor: '' };
  // Limpiar espacios
  const limpio = tel.replace(/\s+/g, '');
  // Formato internacional: +34XXXXXXXXX (9-15 dígitos tras el +)
  if (/^\+\d{9,15}$/.test(limpio)) return { ok: true, valor: limpio };
  // Formato nacional español: 6XXXXXXXX o 7XXXXXXXX (9 dígitos)
  if (/^[67]\d{8}$/.test(limpio)) return { ok: true, valor: '+34' + limpio };
  return { ok: false, error: 'Formato de teléfono inválido. Usa +34XXXXXXXXX o 6XXXXXXXX' };
}

// Sanitizar texto para prevenir XSS
function sanitizar(str) {
  if (!str) return str;
  return String(str).replace(/[<>]/g, '').trim().substring(0, 200);
}

// ─── GET /casilleros ─────────────────────────────────────────────────────────
// Parámetros: ?estado=ACTIVO|INACTIVO&q=texto&page=1&limit=50
router.get('/', (req, res) => {
  const { estado, q, page = 1, limit = 200 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (estado && ['ACTIVO', 'INACTIVO'].includes(estado)) {
    where += ' AND estado = ?';
    params.push(estado);
  }

  if (q) {
    where += ' AND (nombre_titular LIKE ? OR telefono_activo LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM casilleros WHERE ${where}`).get(...params).n;

  const casilleros = db.prepare(`
    SELECT
      id_casillero, nombre_titular, telefono_activo, estado,
      codigo_acceso, fecha_alta, fecha_ultima_modificacion,
      sms_confirmado, fecha_sms_confirmado, notas
    FROM casilleros
    WHERE ${where}
    ORDER BY id_casillero
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), data: casilleros });
});

// ─── GET /casilleros/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1 || id > 200) {
    return res.status(400).json({ error: 'ID de casillero inválido (debe ser 1-200)' });
  }

  const casillero = db.prepare(`
    SELECT * FROM casilleros WHERE id_casillero = ?
  `).get(id);

  if (!casillero) {
    return res.status(404).json({ error: 'Casillero no encontrado' });
  }

  const historial = db.prepare(`
    SELECT * FROM historial_telefonos
    WHERE id_casillero = ?
    ORDER BY fecha_fin DESC
  `).all(id);

  const smsList = db.prepare(`
    SELECT * FROM sms_registro
    WHERE id_casillero = ? OR telefono = ?
    ORDER BY fecha DESC
    LIMIT 20
  `).all(id, casillero.telefono_activo);

  res.json({ ...casillero, historial, sms: smsList });
});

// ─── PUT /casilleros/:id ──────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1 || id > 200) {
    return res.status(400).json({ error: 'ID de casillero inválido' });
  }

  const casillero = db.prepare('SELECT * FROM casilleros WHERE id_casillero = ?').get(id);
  if (!casillero) {
    return res.status(404).json({ error: 'Casillero no encontrado' });
  }

  const { nombre_titular, telefono_activo, estado, codigo_acceso, notas, motivo_cambio } = req.body || {};

  // ─── SEGURIDAD: Validar teléfono ───────────────────────────────────────────
  if (telefono_activo !== undefined) {
    const telValidacion = validarTelefono(telefono_activo);
    if (!telValidacion.ok) {
      return res.status(400).json({ error: telValidacion.error });
    }
  }

  // ─── SEGURIDAD: Validar estado ─────────────────────────────────────────────
  if (estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(estado)) {
    return res.status(400).json({ error: 'Estado debe ser ACTIVO o INACTIVO' });
  }

  // Sanitizar inputs de texto
  const safeName = nombre_titular !== undefined ? sanitizar(nombre_titular) : undefined;
  const safeNotas = notas !== undefined ? sanitizar(notas) : undefined;
  const safeCodigo = codigo_acceso !== undefined ? sanitizar(codigo_acceso) : undefined;
  const safeMotivo = motivo_cambio ? sanitizar(motivo_cambio) : motivo_cambio;
  const safeTelefono = telefono_activo !== undefined ? validarTelefono(telefono_activo).valor : undefined;

  // Guardar historial si el teléfono cambió
  const telefonoAnterior = casillero.telefono_activo;
  const nombreAnterior = casillero.nombre_titular;
  const telefonoCambia = safeTelefono !== undefined && safeTelefono !== telefonoAnterior;

  if (telefonoCambia && telefonoAnterior) {
    db.prepare(`
      INSERT INTO historial_telefonos
        (id_casillero, telefono_anterior, nombre_anterior, fecha_inicio, fecha_fin, motivo_cambio)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
    `).run(
      id,
      telefonoAnterior,
      nombreAnterior,
      casillero.fecha_ultima_modificacion || casillero.fecha_alta,
      safeMotivo || 'Actualización manual'
    );
  }

  // Resetear confirmación de SMS si cambia el teléfono o el titular
  const resetSms = telefonoCambia || (safeName !== undefined && safeName !== nombreAnterior);

  const updates = {
    nombre_titular: safeName ?? casillero.nombre_titular,
    telefono_activo: safeTelefono ?? casillero.telefono_activo,
    estado: estado ?? casillero.estado,
    codigo_acceso: safeCodigo ?? casillero.codigo_acceso,
    notas: safeNotas ?? casillero.notas,
    sms_confirmado: resetSms ? 0 : casillero.sms_confirmado,
    fecha_sms_confirmado: resetSms ? null : casillero.fecha_sms_confirmado,
  };

  db.prepare(`
    UPDATE casilleros SET
      nombre_titular = ?,
      telefono_activo = ?,
      estado = ?,
      codigo_acceso = ?,
      notas = ?,
      sms_confirmado = ?,
      fecha_sms_confirmado = ?,
      fecha_ultima_modificacion = datetime('now')
    WHERE id_casillero = ?
  `).run(
    updates.nombre_titular,
    updates.telefono_activo,
    updates.estado,
    updates.codigo_acceso,
    updates.notas,
    updates.sms_confirmado,
    updates.fecha_sms_confirmado,
    id
  );

  // Log de actividad
  const cambios = [];
  if (telefono_activo !== undefined && telefono_activo !== telefonoAnterior) cambios.push(`teléfono: ${telefonoAnterior} → ${telefono_activo}`);
  if (nombre_titular !== undefined && nombre_titular !== nombreAnterior) cambios.push(`titular: ${nombreAnterior} → ${nombre_titular}`);
  if (estado !== undefined && estado !== casillero.estado) cambios.push(`estado: ${casillero.estado} → ${estado}`);

  if (cambios.length > 0) {
    db.prepare(`
      INSERT INTO log_actividad (tipo, descripcion, id_casillero, datos_extra)
      VALUES ('CASILLERO_ACTUALIZADO', ?, ?, ?)
    `).run(
      `Casillero ${id} actualizado: ${cambios.join(', ')}`,
      id,
      JSON.stringify({ cambios, usuario: req.user?.username })
    );
  }

  const actualizado = db.prepare('SELECT * FROM casilleros WHERE id_casillero = ?').get(id);
  const historial = db.prepare(`
    SELECT * FROM historial_telefonos WHERE id_casillero = ? ORDER BY fecha_fin DESC
  `).all(id);

  // Si el teléfono cambió, enviar comando automático al controlador de la puerta
  let comandoPuerta = null;
  if (telefonoCambia && updates.telefono_activo) {
    const { enviarComandoAsignacion } = require('../services/smsProcessor');
    const num = String(id).padStart(3,'0');
    comandoPuerta = `1234A${num}#${updates.telefono_activo}#`;
    console.log(`[PUERTA] Teléfono cambió → enviando comando: ${comandoPuerta}`);
    enviarComandoAsignacion(id, updates.telefono_activo)
      .then(r => {
        if (r.success) {
          console.log(`[PUERTA] Comando enviado OK. MessageId: ${r.messageId}`);
          db.prepare(`INSERT INTO log_actividad (tipo, descripcion, id_casillero) VALUES (?, ?, ?)`)
            .run('COMANDO_PUERTA_ENVIADO', `Comando enviado: ${comandoPuerta}`, id);
        } else {
          console.error(`[PUERTA] Error al enviar comando: ${r.error}`);
        }
      })
      .catch(e => console.error(`[PUERTA] Excepción al enviar comando:`, e.message));
  } else if (!telefonoCambia) {
    console.log(`[PUERTA] Teléfono no cambió (${casillero.telefono_activo}) — no se envía comando`);
  }

  res.json({ ...actualizado, historial, telefonoCambio: telefonoCambia, comandoPuerta });
});

// ─── POST /casilleros/:id/reenviar-puerta ────────────────────────────────────
// Reenvía el comando al controlador de puerta sin cambiar datos
router.post('/:id/reenviar-puerta', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1 || id > 200) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const casillero = db.prepare('SELECT * FROM casilleros WHERE id_casillero = ?').get(id);
  if (!casillero) return res.status(404).json({ error: 'Casillero no encontrado' });
  if (!casillero.telefono_activo) return res.status(400).json({ error: 'Sin teléfono activo' });

  const { enviarComandoAsignacion } = require('../services/smsProcessor');
  const resultado = await enviarComandoAsignacion(id, casillero.telefono_activo);

  if (!resultado.success) {
    return res.status(502).json({ error: resultado.error });
  }

  db.prepare(`
    UPDATE casilleros SET sms_confirmado = 0, fecha_sms_confirmado = NULL,
    fecha_ultima_modificacion = datetime('now') WHERE id_casillero = ?
  `).run(id);

  db.prepare(`INSERT INTO log_actividad (tipo, descripcion, id_casillero) VALUES (?, ?, ?)`)
    .run('COMANDO_PUERTA_REENVIADO', `Comando reenviado a puerta: casillero ${id} → ${casillero.telefono_activo}`, id);

  res.json({ success: true, messageId: resultado.messageId, comando: `1234A${String(id).padStart(3,'0')}#${casillero.telefono_activo}#` });
});

// ─── GET /casilleros/export/csv ───────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const { estado } = req.query;
  let where = '1=1';
  const params = [];

  if (estado && ['ACTIVO', 'INACTIVO'].includes(estado)) {
    where += ' AND estado = ?';
    params.push(estado);
  }

  const casilleros = db.prepare(`
    SELECT id_casillero, nombre_titular, telefono_activo, estado,
           codigo_acceso, fecha_alta, fecha_ultima_modificacion,
           sms_confirmado, notas
    FROM casilleros WHERE ${where}
    ORDER BY id_casillero
  `).all(...params);

  const header = 'ID,Titular,Teléfono,Estado,Código,Fecha Alta,Última Modificación,SMS Confirmado,Notas\n';
  const rows = casilleros.map(c =>
    [
      c.id_casillero,
      `"${(c.nombre_titular || '').replace(/"/g, '""')}"`,
      c.telefono_activo,
      c.estado,
      c.codigo_acceso || '',
      c.fecha_alta || '',
      c.fecha_ultima_modificacion || '',
      c.sms_confirmado ? 'Sí' : 'No',
      `"${(c.notas || '').replace(/"/g, '""')}"`,
    ].join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="casilleros_puerta_lobres.csv"');
  res.send('\uFEFF' + header + rows); // BOM para Excel
});

module.exports = router;
