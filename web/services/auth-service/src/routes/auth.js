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

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const isDefaultOrInsecure = !secret || secret.trim() === '' || secret.includes('talento360_secret_2026');

  if (isProd) {
    if (isDefaultOrInsecure) {
      console.error('[FATAL CIBERSEGURIDAD] En entorno de producción (NODE_ENV=production), la variable JWT_SECRET es obligatoria y no puede usar el secreto predeterminado o predecible (AUD-011).');
      process.exit(1);
    }
    return secret;
  }

  if (isDefaultOrInsecure) {
    console.warn('[AVISO DE SEGURIDAD] JWT_SECRET no configurado o usando valor por defecto en desarrollo. En producción el servicio fallará explícitamente.');
    return secret || 'talento360_secret_2026';
  }

  return secret;
}

const JWT_SECRET     = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_SALT_ROUNDS = 12;

// Hash precomputado para mitigar ataques de temporización (timing attacks) cuando el usuario no existe
const DUMMY_HASH = '$2a$12$V/AEZH3sAI.ZPJZdnCj3Ue8TU5P/6ekQdo9whQRwfR9H9RyLSjXDm';

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Máximo 1000 intentos de login cada 15 minutos por IP (con omisión de peticiones exitosas)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skipSuccessfulRequests: true,
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
    let userResult;
    try {
      userResult = await pool.query(
        `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos
         FROM usuarios
         WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
         LIMIT 1`,
        [normalizedUser]
      );
    } catch (colErr) {
      if (colErr.message && (colErr.message.includes('modulos') || colErr.message.includes('permisos'))) {
        console.warn('[auth] Columna modulos o permisos no presente en tabla usuarios, migrando al vuelo...');
        try {
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*'`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT`);
          userResult = await pool.query(
            `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos
             FROM usuarios
             WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
             LIMIT 1`,
            [normalizedUser]
          );
        } catch (migErr) {
          userResult = await pool.query(
            `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado
             FROM usuarios
             WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
             LIMIT 1`,
            [normalizedUser]
          );
        }
      } else {
        throw colErr;
      }
    }

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

    let allowedModules = ['dashboard'];
    const rLower = (user.rol || '').toLowerCase();
    if (rLower === 'administrador' || rLower === 'admin') {
      allowedModules = ['*'];
    } else if (rLower === 'sst' || rLower.includes('sst')) {
      allowedModules = ['sst', 'epidemiologico', 'sociodemografico', 'epp'];
    } else if (rLower === 'incapacidades' || rLower.includes('incapacidad')) {
      allowedModules = ['admin-requests', 'incapacidades'];
    } else if (rLower.includes('permiso') && rLower.includes('licencia')) {
      allowedModules = ['admin-requests', 'permisos', 'licencias'];
    } else if (rLower === 'permisos' || rLower.includes('permiso')) {
      allowedModules = ['admin-requests', 'permisos'];
    } else if (user.modulos) {
      allowedModules = user.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    }

    const permissions = resolvePermissions(user.rol, allowedModules, user.permisos);

    const payload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
      modules:  allowedModules,
      permissions: permissions,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Enviar cookie HttpOnly para navegadores y token en JSON para APIs
    setAuthCookie(res, token);
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    return res.status(500).json({ 
      error: 'Error interno del servidor. Verifique la conexión a la base de datos.',
      details: err.message
    });
  }
});

// ─── POST /api/auth/verify-password ───────────────────────────────────────────
router.post('/verify-password', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ valid: false, error: 'Por favor ingrese usuario y contraseña.' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  try {
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, rol, estado
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [normalizedUser]
    );

    if (userResult.rows.length === 0) {
      await bcrypt.compare(normalizedPass, DUMMY_HASH);
      return res.status(401).json({ valid: false, error: 'Credenciales inválidas.' });
    }

    const user = userResult.rows[0];

    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ valid: false, error: 'Usuario inactivo. Contacte a la Dirección de Talento Humano.' });
    }

    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    let matches = false;

    if (isBcrypt) {
      matches = await bcrypt.compare(normalizedPass, user.password);
    } else {
      if (user.password === normalizedPass) {
        matches = true;
      } else {
        await bcrypt.compare(normalizedPass, DUMMY_HASH);
      }
    }

    if (!matches) {
      return res.status(401).json({ valid: false, error: 'Contraseña incorrecta.' });
    }

    return res.json({ valid: true, message: 'Contraseña verificada correctamente.' });
  } catch (err) {
    console.error('[auth] Verify password error:', err.message);
    return res.status(500).json({ valid: false, error: 'Error interno del servidor al verificar la contraseña.' });
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

    // Actualizar en base de datos únicamente campos autorizados (nombre, password)
    const updateQ = await pool.query(
      'UPDATE usuarios SET nombre = $1, password = $2 WHERE LOWER(username) = LOWER($3) RETURNING username, nombre, rol, cargo_laboral, modulos, permisos',
      [cleanNombre, finalPassword, username]
    );

    const updatedUser = updateQ.rows[0];
    let userMods = ['dashboard'];
    if ((updatedUser.rol || '').toLowerCase() === 'administrador') {
      userMods = ['*'];
    } else if (updatedUser.modulos) {
      userMods = updatedUser.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    }
    const userPerms = resolvePermissions(updatedUser.rol, userMods, updatedUser.permisos);

    const payload = {
      username: updatedUser.username,
      name:     updatedUser.nombre,
      role:     updatedUser.rol,
      jobTitle: updatedUser.cargo_laboral || resolveJobTitle(updatedUser.rol),
      department: resolveDepartment(updatedUser.rol),
      modules:  userMods,
      permissions: userPerms,
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

function resolvePermissions(role, modules, explicitPerms = null) {
  const r = (role || '').toLowerCase();
  const mods = Array.isArray(modules) ? modules : [];
  if (r === 'administrador' || r === 'admin' || mods.includes('*')) {
    return ['*'];
  }

  // Si el usuario tiene permisos granulares explícitos configurados en la base de datos
  if (explicitPerms && typeof explicitPerms === 'string' && explicitPerms.trim() !== '') {
    const list = explicitPerms.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (list.length > 0) return list;
  }

  const perms = [];
  if (mods.includes('dashboard')) perms.push('dashboard:read');
  if (mods.includes('employees')) {
    perms.push('employees:read', 'employees:write', 'employees:delete', 'employees:import', 'employees:export');
  }
  if (mods.includes('horarios')) {
    perms.push('horarios:read', 'horarios:write', 'horarios:delete');
  }
  if (mods.includes('viaticos')) {
    perms.push('viaticos:read', 'viaticos:write', 'viaticos:status', 'viaticos:import', 'viaticos:delete');
  }
  if (mods.includes('requests') || mods.includes('admin-requests') || mods.includes('permisos') || mods.includes('licencias') || mods.includes('incapacidades')) {
    perms.push('requests:read', 'requests:write', 'admin-requests:read', 'admin-requests:write');
    if (mods.includes('permisos')) perms.push('permisos:read', 'permisos:write');
    if (mods.includes('licencias')) perms.push('licencias:read', 'licencias:write');
    if (mods.includes('incapacidades')) perms.push('incapacidades:read', 'incapacidades:write');
  }
  if (mods.includes('sst')) {
    perms.push('sst:read', 'sst:write', 'epidemiologico:read', 'epidemiologico:write', 'sociodemografico:read', 'sociodemografico:write', 'epp:read', 'epp:write');
  }
  return perms;
}

function resolveJobTitle(role) {
  if (!role) return 'Usuario del Sistema';
  const r = role.toLowerCase();
  if (r === 'sst' || r.includes('sst')) return 'Responsable de Seguridad y Salud en el Trabajo (SST)';
  if (r === 'incapacidades' || r.includes('incapacidad')) return 'Responsable de Incapacidades y Ausentismo Laboral';
  if (r.includes('permiso') && r.includes('licencia')) return 'Responsable de Permisos y Licencias Laborales';
  if (r === 'permisos' || r.includes('permiso')) return 'Responsable de Permisos Laborales';
  if (r.includes('coordinador')) return 'Coordinador de Solicitudes';
  if (r.includes('consulta') || r.includes('funcionario')) return 'Servidor Público';
  return 'Administrador del Sistema';
}

function resolveDepartment(role) {
  if (!role) return 'Dirección de Talento Humano';
  const r = role.toLowerCase();
  if (r === 'sst' || r.includes('sst') || r === 'incapacidades' || r.includes('incapacidad')) {
    return 'Subdirección de Seguridad y Salud en el Trabajo';
  }
  if (r.includes('consulta')) return 'Secretaría General';
  return 'Dirección de Talento Humano';
}

module.exports = router;
