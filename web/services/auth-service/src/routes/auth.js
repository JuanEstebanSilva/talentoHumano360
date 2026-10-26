const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
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

const JWT_SECRET     = process.env.JWT_SECRET || 'talento360_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_SALT_ROUNDS = 12;

// Hash precomputado para mitigar ataques de temporización (timing attacks) cuando el usuario no existe
const DUMMY_HASH = '$2a$12$V/AEZH3sAI.ZPJZdnCj3Ue8TU5P/6ekQdo9whQRwfR9H9RyLSjXDm';

// Advertencia de seguridad en arranque si la clave es la por defecto
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('talento360_secret_2026'))) {
  console.warn('[ALERTA DE CIBERSEGURIDAD] JWT_SECRET utiliza el valor por defecto o inseguro en producción. Configure un secreto de al menos 64 caracteres.');
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Máximo 10 intentos de login cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Por seguridad institucional, espere 15 minutos.' }
});

// Máximo 20 intentos de actualización de perfil cada 15 minutos
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de modificaciones de perfil alcanzado. Intente de nuevo más tarde.' }
});

// Extrae el token desde cabecera Authorization: Bearer o Cookie HttpOnly
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Configura la cookie HttpOnly en la respuesta de forma segura
function setAuthCookie(res, token) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE || 'Lax';
  res.cookie('talento360_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSite,
    maxAge: 8 * 60 * 60 * 1000, // 8 horas en milisegundos
    path: '/'
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Por favor ingresa usuario y contraseña.' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  try {
    // 1. Buscar si el usuario existe en la base de datos por email o prefijo
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [normalizedUser]
    );

    // Mitigación de enumeración de usuarios y análisis de tiempos
    if (userResult.rows.length === 0) {
      await bcrypt.compare(normalizedPass, DUMMY_HASH);
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = userResult.rows[0];

    // Verificar si la cuenta está activa
    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte a la Dirección de Talento Humano.' });
    }

    // 2. Verificación criptográfica segura con bcrypt
    let passwordMatches = false;
    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

    if (isBcrypt) {
      passwordMatches = await bcrypt.compare(normalizedPass, user.password);
    } else {
      // Migración transparente y segura de contraseñas heredadas en texto plano
      if (user.password === normalizedPass) {
        passwordMatches = true;
        try {
          const upgradedHash = await bcrypt.hash(normalizedPass, BCRYPT_SALT_ROUNDS);
          await pool.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2', [upgradedHash, user.id_usuario]);
          console.log(`[auth] Contraseña de usuario id=${user.id_usuario} migrada exitosamente a bcrypt.`);
        } catch (migErr) {
          console.error('[auth] Error en migración automática de hash:', migErr.message);
        }
      } else {
        // En caso de fallo con texto plano, simular hash para igualar tiempo
        await bcrypt.compare(normalizedPass, DUMMY_HASH);
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const payload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Enviar cookie HttpOnly para navegadores y token en JSON para APIs
    setAuthCookie(res, token);
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor. Verifique la conexión a la base de datos.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('talento360_token', { path: '/' });
  return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const token = req.body?.token || extractToken(req);
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
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Token de autenticación requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
}

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put('/profile', authMiddleware, profileLimiter, async (req, res) => {
  const { nombre, currentPassword, newPassword } = req.body;
  const username = req.user.username;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido.' });
  }

  const cleanNombre = nombre.trim();

  try {
    // Buscar usuario en base de datos
    const userQ = await pool.query(
      'SELECT id_usuario, username, password, nombre, rol, cargo_laboral FROM usuarios WHERE LOWER(username) = LOWER($1) AND estado = \'ACTIVO\' LIMIT 1',
      [username]
    );

    if (userQ.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const currentUser = userQ.rows[0];

    // Si se solicita cambio de contraseña
    let finalPassword = currentUser.password;
    if (newPassword && newPassword.trim()) {
      if (!currentPassword || !currentPassword.trim()) {
        return res.status(400).json({ error: 'Debe ingresar su contraseña actual para cambiarla.' });
      }

      // Verificación segura con bcrypt
      const isBcrypt = currentUser.password && (currentUser.password.startsWith('$2a$') || currentUser.password.startsWith('$2b$'));
      let currentMatches = false;

      if (isBcrypt) {
        currentMatches = await bcrypt.compare(currentPassword.trim(), currentUser.password);
      } else {
        currentMatches = (currentUser.password === currentPassword.trim());
      }

      if (!currentMatches) {
        return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
      }

      // Política de robustez: mínimo 8 caracteres
      if (newPassword.trim().length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      }

      // Hashear siempre con factor de coste 12
      finalPassword = await bcrypt.hash(newPassword.trim(), BCRYPT_SALT_ROUNDS);
    }

    // Actualizar en base de datos
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
    setAuthCookie(res, newToken);

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
