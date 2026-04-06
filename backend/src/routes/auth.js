const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Hash de la contraseña del admin (se genera una sola vez al arrancar)
let adminHashedPass = null;

function getAdminCreds() {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'admin123';
  return { user, pass };
}

// Pre-hashear la contraseña al cargar el módulo
(async () => {
  const { pass } = getAdminCreds();
  adminHashedPass = await bcrypt.hash(pass, 12);
})();

/**
 * POST /auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  // Validar longitud para prevenir ataques de denegación de servicio con bcrypt
  if (password.length > 72) {
    return res.status(400).json({ error: 'Contraseña demasiado larga' });
  }

  const { user } = getAdminCreds();

  if (username !== user) {
    // Siempre ejecutamos bcrypt.compare aunque el usuario sea incorrecto
    // para evitar timing attacks que revelen si el usuario existe
    await bcrypt.compare(password, '$2a$12$000000000000000000000uGGBCH0kUfMLh2tYMGYmG5He5Xxj5K');
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Comparar contraseña con hash
  const match = await bcrypt.compare(password, adminHashedPass);
  if (!match) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, username, role: 'admin' });
});

/**
 * POST /auth/verify
 * Verifica si el token es válido (útil para el frontend al recargar)
 */
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({ valid: true, user: payload });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
