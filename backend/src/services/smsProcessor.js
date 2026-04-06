/**
 * Procesador de SMS entrantes (webhooks de httpSMS).
 *
 * El móvil administrador (+34687189397) tiene httpSMS instalado.
 * Los mensajes que LLEGAN a ese móvil son procesados aquí.
 *
 * Dos tipos de remitentes:
 *
 *  1. FROM 6036 (teléfono de la puerta) → respuesta del controlador
 *     Formatos posibles:
 *       "197:606703832"         → confirmación de asignación
 *       "001:TEL\n002:TEL\n..." → respuesta a lista
 *
 *  2. FROM cualquier otro número → confirmación "OK" de un titular
 */
const db = require('../db/database');
const { enviarSMS, registrarSMS } = require('./httpsms');

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

async function procesarSMSEntrante(from, message, messageId = null) {
  const cuerpo = limpiarMensaje(message);

  registrarSMS('RECIBIDO', from, cuerpo, null, 'RECIBIDO', messageId);
  logActividad('SMS_RECIBIDO', `SMS de ${from}: "${cuerpo}"`, null, { from, message: cuerpo });

  const telefonoPuerta = getTelefonoPuerta();
  const fromNorm   = normalizarTel(from);
  const puertaNorm = normalizarTel(telefonoPuerta);

  console.log(`[WEBHOOK] from="${from}" norm="${fromNorm}" | puerta="${telefonoPuerta}" norm="${puertaNorm}" | coincide=${fromNorm === puertaNorm}`);
  console.log(`[WEBHOOK] cuerpo="${cuerpo}"`);

  // ── Respuesta del controlador de puerta (6036) ────────────────────────────
  if (telefonoPuerta && (fromNorm === puertaNorm || fromNorm === '6036')) {
    await procesarRespuestaPuerta(cuerpo);
    return;
  }

  // ── Confirmación "OK" de un titular ──────────────────────────────────────
  const texto = cuerpo.toUpperCase().trim();
  if (texto === 'OK' || texto === 'OK.' || texto.startsWith('OK ')) {
    await manejarConfirmacionOK(from);
    return;
  }
}

// ─── RESPUESTAS DEL CONTROLADOR 6036 ────────────────────────────────────────

/**
 * Procesa mensajes del controlador de puerta.
 * Formatos:
 *   "197:606703832"              → asignación confirmada
 *   "001:606703832\n002:5017\n" → respuesta a lista AL
 */
async function procesarRespuestaPuerta(cuerpo) {
  const lineas = cuerpo.split('\n').map(l => l.trim()).filter(Boolean);

  console.log(`[PUERTA] procesarRespuestaPuerta lineas:`, lineas);
  for (const linea of lineas) {
    // Patrón: NUM:TELEFONO  (ej: 197:606703832 o 001:6080)
    const match = linea.match(/^(\d{1,3}):(\S+)$/);
    if (!match) { console.log(`[PUERTA] línea sin match: "${linea}"`); continue; }

    const numCasillero = parseInt(match[1]);
    const telefono     = match[2];

    if (numCasillero < 1 || numCasillero > 200) continue;

    const casillero = db.prepare('SELECT * FROM casilleros WHERE id_casillero = ?').get(numCasillero);
    if (!casillero) continue;

    // Si el teléfono coincide con el activo → marcar como confirmado por la puerta
    if (casillero.telefono_activo === telefono) {
      db.prepare(`
        UPDATE casilleros
        SET sms_confirmado = 1,
            fecha_sms_confirmado = datetime('now'),
            fecha_ultima_modificacion = datetime('now')
        WHERE id_casillero = ?
      `).run(numCasillero);

      logActividad(
        'PUERTA_CONFIRMADO',
        `Casillero ${numCasillero} confirmado por controlador de puerta: ${telefono}`,
        numCasillero, { telefono }
      );
    } else {
      // La puerta devolvió un teléfono diferente → registrar discrepancia
      logActividad(
        'PUERTA_DISCREPANCIA',
        `Casillero ${numCasillero}: BD tiene "${casillero.telefono_activo}" pero puerta devolvió "${telefono}"`,
        numCasillero, { telefonoBD: casillero.telefono_activo, telefonoPuerta: telefono }
      );
    }
  }
}

// ─── CONFIRMACIÓN OK DE TITULAR ──────────────────────────────────────────────

async function manejarConfirmacionOK(from) {
  const tel = normalizarTel(from);
  const casillero = db.prepare(`
    SELECT * FROM casilleros
    WHERE REPLACE(REPLACE(REPLACE(telefono_activo,' ',''),'-',''),'+34','') = REPLACE(REPLACE(REPLACE(?,' ',''),'-',''),'+34','')
      AND estado = 'ACTIVO'
    ORDER BY id_casillero LIMIT 1
  `).get(tel);

  if (casillero) {
    db.prepare(`
      UPDATE casilleros
      SET sms_confirmado = 1,
          fecha_sms_confirmado = datetime('now'),
          fecha_ultima_modificacion = datetime('now')
      WHERE id_casillero = ?
    `).run(casillero.id_casillero);

    logActividad(
      'SMS_OK_RECIBIDO',
      `Casillero ${casillero.id_casillero} (${casillero.nombre_titular}) confirmó por SMS`,
      casillero.id_casillero, { from }
    );
  }
}

// ─── ENVÍO DE COMANDO AL CONTROLADOR ────────────────────────────────────────

/**
 * Envía un comando de asignación al controlador de puerta.
 * Formato: [PIN]A[num]#[tel]#  → ej: 1234A197#606703832#
 */
async function enviarComandoAsignacion(numCasillero, telefono) {
  const pin            = getPin();
  const telefonoPuerta = formatearTelefono(getTelefonoPuerta());

  if (!telefonoPuerta) {
    return { success: false, error: 'Teléfono de la puerta no configurado' };
  }

  const num     = String(numCasillero).padStart(3, '0');
  const comando = `${pin}A${num}#${telefono}#`;

  console.log(`[SMS] Enviando comando a puerta ${telefonoPuerta}: ${comando}`);
  return await enviarSMS(telefonoPuerta, comando, numCasillero);
}

/**
 * Envía comando de lista al controlador de puerta.
 * Formato: [PIN]AL[inicio]#[fin]#  → ej: 1234AL001#200#
 */
async function enviarComandoLista(inicio = 1, fin = 200) {
  const pin            = getPin();
  const telefonoPuerta = formatearTelefono(getTelefonoPuerta());

  if (!telefonoPuerta) {
    return { success: false, error: 'Teléfono de la puerta no configurado' };
  }

  const comando = `${pin}AL${String(inicio).padStart(3,'0')}#${String(fin).padStart(3,'0')}#`;
  console.log(`[SMS] Enviando lista a puerta ${telefonoPuerta}: ${comando}`);
  return await enviarSMS(telefonoPuerta, comando, null);
}

/** Devuelve el teléfono limpio tal como está configurado (sin forzar +34) */
function formatearTelefono(tel) {
  if (!tel) return '';
  return tel.trim();
}

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

function limpiarMensaje(raw) {
  return (raw || '')
    .split('\n')
    .filter(l => !/^(From|To)\s*:/i.test(l.trim()))
    .join('\n')
    .trim();
}

function getPin() {
  const row = db.prepare("SELECT valor FROM configuracion WHERE clave='sms_pin'").get();
  return row?.valor || '1234';
}

function getTelefonoPuerta() {
  const row = db.prepare("SELECT valor FROM configuracion WHERE clave='telefono_puerta'").get();
  return row?.valor || '';
}

function normalizarTel(tel) {
  let t = (tel || '').replace(/[\s\-()+.]/g, '');
  // Quitar prefijo de país español (34) si el número tiene más de 9 dígitos
  if (t.startsWith('34') && t.length > 9) t = t.slice(2);
  return t;
}

function logActividad(tipo, descripcion, idCasillero, datosExtra) {
  try {
    db.prepare(`
      INSERT INTO log_actividad (tipo, descripcion, id_casillero, datos_extra)
      VALUES (?, ?, ?, ?)
    `).run(tipo, descripcion, idCasillero, datosExtra ? JSON.stringify(datosExtra) : null);
  } catch {}
}

module.exports = { procesarSMSEntrante, enviarComandoAsignacion, enviarComandoLista };
