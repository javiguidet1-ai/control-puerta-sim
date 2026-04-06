require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── SEGURIDAD: Headers HTTP ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"]
    }
  }
}));

// ─── SEGURIDAD: Rate Limiting global ─────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,                  // máx 200 requests por IP
  message: { error: 'Demasiadas peticiones, intenta de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ─── SEGURIDAD: Rate Limiting login (anti fuerza bruta) ──────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                    // máx 5 intentos de login por IP
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/login', loginLimiter);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, etc.) o de orígenes permitidos
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger básico
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── RUTAS ───────────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/casilleros', require('./routes/casilleros'));
app.use('/sms', require('./routes/sms'));
app.use('/webhook', require('./routes/webhook'));
app.use('/auditoria', require('./routes/auditoria'));
app.use('/config', require('./routes/config'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', version: '1.0.0', sistema: 'Puerta de Lobres' });
});

// ─── SERVIR FRONTEND (producción) ────────────────────────────────────────────
const path = require('path');
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));
// Catch-all: cualquier ruta no-API devuelve index.html (para React Router)
app.get('*', (req, res, next) => {
  // No interceptar rutas de API
  if (req.path.startsWith('/auth') || req.path.startsWith('/casilleros') ||
      req.path.startsWith('/sms') || req.path.startsWith('/webhook') ||
      req.path.startsWith('/auditoria') || req.path.startsWith('/config') ||
      req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── INICIAR SERVIDOR ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 Puerta de Lobres — Backend`);
  console.log(`   Puerto: ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Webhook SMS: POST /webhook/sms\n`);

  // Inicializar los 200 casilleros si no existen
  const db = require('./db/database');
  const count = db.prepare('SELECT COUNT(*) as n FROM casilleros').get().n;
  if (count === 0) {
    console.log('Inicializando 200 casilleros...');
    const insert = db.prepare(`
      INSERT OR IGNORE INTO casilleros (id_casillero, nombre_titular, telefono_activo, estado)
      VALUES (?, 'SIN ASIGNAR', '', 'INACTIVO')
    `);
    db.exec('BEGIN');
    try {
      for (let i = 1; i <= 200; i++) insert.run(i);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    console.log('✓ 200 casilleros inicializados');
  } else {
    console.log(`✓ ${count} casilleros cargados desde la BD`);
  }
});
