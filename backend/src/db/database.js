const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/puerta_lobres.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Activar WAL mode y foreign keys
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ─── ESQUEMA ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    fecha_modificacion TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS casilleros (
    id_casillero INTEGER PRIMARY KEY CHECK (id_casillero BETWEEN 1 AND 200),
    nombre_titular TEXT NOT NULL DEFAULT 'SIN ASIGNAR',
    telefono_activo TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'INACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    codigo_acceso TEXT DEFAULT '',
    fecha_alta TEXT DEFAULT (datetime('now')),
    fecha_ultima_modificacion TEXT DEFAULT (datetime('now')),
    sms_confirmado INTEGER DEFAULT 0,
    fecha_sms_confirmado TEXT,
    notas TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS historial_telefonos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_casillero INTEGER NOT NULL REFERENCES casilleros(id_casillero),
    telefono_anterior TEXT NOT NULL,
    nombre_anterior TEXT NOT NULL,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT DEFAULT (datetime('now')),
    motivo_cambio TEXT DEFAULT 'Actualización manual'
  );

  CREATE TABLE IF NOT EXISTS log_actividad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    id_casillero INTEGER,
    datos_extra TEXT,
    fecha TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_registro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('ENVIADO', 'RECIBIDO')),
    telefono TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    id_casillero INTEGER,
    estado TEXT DEFAULT 'PENDIENTE',
    mensaje_id_externo TEXT,
    fecha TEXT DEFAULT (datetime('now'))
  );
`);

// ─── CONFIGURACIÓN INICIAL ────────────────────────────────────────────────────

const insertConfig = db.prepare(`
  INSERT OR IGNORE INTO configuracion (clave, valor, descripcion)
  VALUES (?, ?, ?)
`);

const configDefaults = [
  ['httpsms_api_key', '', 'API Key de httpSMS'],
  ['httpsms_device_id', '', 'Device ID del móvil Android administrador'],
  ['admin_phone', '', 'Número de teléfono del administrador (+34XXXXXXXXX)'],
  ['audit_code', 'LISTA200', 'Código para solicitar lista de casilleros activos por SMS'],
  ['sms_pin', '1234', 'PIN de seguridad para comandos SMS (AL y A)'],
  ['sms_template_alta', 'Hola [NOMBRE], tu acceso al casillero [NUM] ha sido activado. Código: [CODIGO]. - Puerta de Lobres', 'Plantilla SMS de alta'],
  ['sms_template_cambio', 'Hola [NOMBRE], el titular del casillero [NUM] ha sido actualizado. Bienvenido/a. - Puerta de Lobres', 'Plantilla SMS de cambio de titular'],
];

for (const [clave, valor, descripcion] of configDefaults) {
  insertConfig.run(clave, valor, descripcion);
}

module.exports = db;
