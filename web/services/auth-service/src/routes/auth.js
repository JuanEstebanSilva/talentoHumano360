const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'talento360',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'admin123',
        ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

const JWT_SECRET     = process.env.JWT_SECRET     || 'talento360_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  try {
    const result = await pool.query(
      `SELECT username, nombre, rol, cargo_laboral
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
         AND password = $2
         AND estado = 'ACTIVO'
       LIMIT 1`,
      [normalizedUser, normalizedPass]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo.' });
    }

    const user = result.rows[0];
    const payload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor. Verifique la conexión a la base de datos.' });
  }
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requerido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch {
    return res.status(401).json({ valid: false, error: 'Token inválido o expirado.' });
  }
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token de autenticación requerido.' });
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
}

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  const { nombre, currentPassword, newPassword } = req.body;
  const username = req.user.username;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido.' });
  }

  const cleanNombre = nombre.trim();

  try {
    // Fetch current user from DB
    const userQ = await pool.query(
      'SELECT username, password, nombre, rol, cargo_laboral FROM usuarios WHERE LOWER(username) = LOWER($1) AND estado = \'ACTIVO\' LIMIT 1',
      [username]
    );

    if (userQ.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const currentUser = userQ.rows[0];

    // If changing password, verify current password
    let finalPassword = currentUser.password;
    if (newPassword && newPassword.trim()) {
      if (!currentPassword || !currentPassword.trim()) {
        return res.status(400).json({ error: 'Debe ingresar su contraseña actual para cambiarla.' });
      }
      if (currentPassword.trim() !== currentUser.password) {
        return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
      }
      if (newPassword.trim().length < 4) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      }
      finalPassword = newPassword.trim();
    }

    // Update in database
    const updateQ = await pool.query(
      'UPDATE usuarios SET nombre = $1, password = $2 WHERE LOWER(username) = LOWER($3) RETURNING username, nombre, rol, cargo_laboral',
      [cleanNombre, finalPassword, username]
    );

    const updatedUser = updateQ.rows[0];
    const payload = {
      username: updatedUser.username,
      name:     updatedUser.nombre,
      role:     updatedUser.rol,
      jobTitle: updatedUser.cargo_laboral || resolveJobTitle(updatedUser.rol),
      department: resolveDepartment(updatedUser.rol),
    };

    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({
      message: 'Perfil actualizado exitosamente.',
      user: payload,
      token: newToken
    });
  } catch (err) {
    console.error('[auth] Update profile error:', err.message);
    return res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

function resolveJobTitle(role) {
  if (!role) return 'Usuario del Sistema';
  const r = role.toLowerCase();
  if (r.includes('coordinador')) return 'Coordinador de Solicitudes';
  if (r.includes('consulta'))    return 'Usuario de Consulta';
  return 'Administrador del Sistema';
}

function resolveDepartment(role) {
  if (!role) return 'Dirección de Talento Humano';
  const r = role.toLowerCase();
  if (r.includes('consulta')) return 'Secretaría General';
  return 'Dirección de Talento Humano';
}

module.exports = router;
