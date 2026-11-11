const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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

// Asegurar que las columnas para permisos, recuperación de contraseña y cambio obligatorio existan
async function initDb() {
  try {
    await pool.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
  } catch (err) {
    console.warn('[auth] Verificación de columnas de esquema:', err.message);
  }
}
initDb();

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

// Máximo 10 intentos de recuperación de contraseña cada 15 minutos por IP
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación. Por seguridad, intente nuevamente en 15 minutos.' }
});

// ─── Utilidades de Correo y Generación Segura de Contraseña ───────────────────
function generateSecureTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;

  const pick = (charset) => {
    const bytes = crypto.randomBytes(4);
    const rand = bytes.readUInt32BE(0);
    return charset[rand % charset.length];
  };

  const chars = [
    pick(upper), pick(upper),
    pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(symbols), pick(symbols),
    pick(all), pick(all), pick(all), pick(all)
  ];

  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = crypto.randomBytes(4);
    const j = bytes.readUInt32BE(0) % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: {
      user: user,
      pass: pass
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
  });
}

function buildRecoveryPlainText(nombre, tempPassword) {
  const nombreDisplay = nombre && nombre.trim() ? nombre.trim() : 'Funcionario';
  return `Hola, ${nombreDisplay}:

Recibe un cordial saludo de parte del equipo de soporte de Talento 360, plataforma de gestión de talento humano de la Gobernación de Boyacá.

Hemos recibido una solicitud para recuperar el acceso a tu cuenta.

Tu contraseña provisional es:
${tempPassword}

Por motivos de seguridad, esta contraseña tiene una vigencia limitada (24 horas) y deberás cambiarla inmediatamente después de iniciar sesión.

Si no solicitaste esta recuperación, comunícate inmediatamente con el administrador de la plataforma.

Atentamente,

Equipo de Soporte
Talento 360
Gobernación de Boyacá`;
}

function buildRecoveryHtml(nombre, tempPassword) {
  const nombreDisplay = nombre && nombre.trim() ? nombre.trim() : 'Funcionario';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña — Talento 360</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#0d5233 0%,#1e7e46 100%);padding:36px 30px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:50px;padding:6px 18px;margin-bottom:12px;">
                <span style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#fef08a;text-transform:uppercase;">Gobernación de Boyacá</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Talento 360</h1>
              <p style="margin:6px 0 0;color:#e2e8f0;font-size:14px;font-weight:500;">Sistema Integral de Gestión de Talento Humano</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:700;">Recuperación de Contraseña</h2>
              <p style="margin:0 0 14px;font-size:15px;color:#334155;">Hola, <strong style="color:#0f172a;">${nombreDisplay}</strong>:</p>
              <p style="margin:0 0 18px;font-size:15px;color:#334155;">
                Recibe un cordial saludo de parte del equipo de soporte de <strong>Talento 360</strong>, plataforma de gestión de talento humano de la Gobernación de Boyacá.
              </p>
              <p style="margin:0 0 22px;font-size:15px;color:#334155;">
                Hemos recibido una solicitud para recuperar el acceso a tu cuenta en la plataforma.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;">
                <tr>
                  <td style="padding:22px;text-align:center;">
                    <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">Tu Contraseña Provisional</div>
                    <div style="display:inline-block;background:#0d5233;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:800;letter-spacing:4px;padding:12px 26px;border-radius:8px;box-shadow:0 4px 12px rgba(13,82,51,0.25);">
                      ${tempPassword}
                    </div>
                    <div style="margin-top:12px;font-size:13px;color:#d97706;font-weight:600;">
                      ⏱️ Vigencia: 24 horas a partir de este momento
                    </div>
                  </td>
                </tr>
              </table>
              <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 16px;border-radius:0 8px 8px 0;margin:22px 0;">
                <p style="margin:0;font-size:13.5px;color:#1e40af;line-height:1.5;">
                  <strong>Importante:</strong> Por motivos estrictos de seguridad institucional, deberás cambiar esta contraseña provisional <strong>inmediatamente después de iniciar sesión</strong>. El sistema no te permitirá acceder a los módulos hasta que definas tu nueva clave personal.
                </p>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
                Si tú no solicitaste esta recuperación de contraseña, por favor ignora este mensaje o repórtalo inmediatamente al administrador de la plataforma.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">Equipo de Soporte de Talento 360</p>
              <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Dirección de Talento Humano — Gobernación de Boyacá</p>
              <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">Este es un mensaje institucional generado automáticamente. Por favor no responder a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
        `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password, password_reset_expires
         FROM usuarios
         WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
         LIMIT 1`,
        [normalizedUser]
      );
    } catch (colErr) {
      if (colErr.message && (colErr.message.includes('modulos') || colErr.message.includes('permisos') || colErr.message.includes('debe_cambiar_password') || colErr.message.includes('password_reset_expires'))) {
        console.warn('[auth] Columnas de autenticación o recuperación pendientes, ejecutando migración segura...');
        try {
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*'`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL`);
          userResult = await pool.query(
            `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password, password_reset_expires
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

    // Verificar si la contraseña provisional ha vencido
    if (user.debe_cambiar_password) {
      if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
        return res.status(401).json({
          error: 'Su contraseña provisional ha expirado. Por favor solicite una nueva recuperación de contraseña.',
          expiredProvisional: true
        });
      }
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
      mustChangePassword: !!user.debe_cambiar_password
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
      return res.status(400).json({ valid: false, error: 'Credenciales inválidas.' });
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
      return res.status(400).json({ valid: false, error: 'Contraseña incorrecta.' });
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

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Por favor ingresa tu correo electrónico institucional.' });
  }

  const normalizedInput = email.trim().toLowerCase();
  const GENERIC_SUCCESS = {
    success: true,
    message: 'Si la dirección ingresada corresponde a una cuenta registrada y activa en Talento 360, hemos enviado un correo con tu contraseña provisional e instrucciones. Por favor revisa tu bandeja de entrada o carpeta de spam.'
  };

  try {
    // 1. Primera comprobación: existencia del usuario en la tabla de autenticación
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, nombre, rol, estado, debe_cambiar_password, password_reset_expires
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [normalizedInput]
    );

    if (userResult.rows.length === 0) {
      // Mitigación de timing attack si el usuario no existe
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    const user = userResult.rows[0];

    // 2. Segunda comprobación: vinculación efectiva con la plataforma y rol válido
    if (!user.rol || typeof user.rol !== 'string' || !user.rol.trim()) {
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    // 3. Tercera comprobación: estado activo de la cuenta
    if (!user.estado || user.estado.toUpperCase() !== 'ACTIVO') {
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    // Determinar la dirección de destino
    let destinationEmail = user.username.includes('@') ? user.username.trim().toLowerCase() : null;
    if (!destinationEmail && normalizedInput.includes('@')) {
      destinationEmail = normalizedInput;
    }
    if (!destinationEmail) {
      return res.json(GENERIC_SUCCESS);
    }

    // 4. Generación criptográficamente segura de contraseña provisional aleatoria
    const tempPassword = generateSecureTemporaryPassword();
    const tempHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);

    // Estado anterior para compensación transaccional
    const prevPassword = user.password;
    const prevDebeCambiar = user.debe_cambiar_password || false;
    const prevExpires = user.password_reset_expires || null;

    // 5. Actualizar en base de datos con vigencia de 24 horas y cambio obligatorio
    await pool.query(
      `UPDATE usuarios
       SET password = $1,
           debe_cambiar_password = true,
           password_reset_expires = NOW() + INTERVAL '24 hours'
       WHERE id_usuario = $2`,
      [tempHash, user.id_usuario]
    );

    // 6. Enviar correo auténtico por SMTP Gmail
    try {
      const transporter = getMailTransporter();
      const mailFrom = process.env.MAIL_FROM || `Talento 360 — Gobernación de Boyacá <${process.env.SMTP_USER}>`;

      await transporter.sendMail({
        from: mailFrom,
        to: destinationEmail,
        subject: 'Recuperación de contraseña — Talento 360',
        text: buildRecoveryPlainText(user.nombre, tempPassword),
        html: buildRecoveryHtml(user.nombre, tempPassword)
      });

      console.log(`[auth-recovery] Correo de recuperación enviado exitosamente a: ${destinationEmail} (id_usuario=${user.id_usuario})`);
      return res.json(GENERIC_SUCCESS);
    } catch (mailError) {
      console.error(`[auth-recovery] Error al enviar correo SMTP a ${destinationEmail}:`, mailError.message);

      // Mecanismo de compensación: restaurar estado previo intacto
      try {
        await pool.query(
          `UPDATE usuarios
           SET password = $1,
               debe_cambiar_password = $2,
               password_reset_expires = $3
           WHERE id_usuario = $4`,
          [prevPassword, prevDebeCambiar, prevExpires, user.id_usuario]
        );
        console.log(`[auth-recovery] Compensación exitosa: Contraseña y estado revertidos para id_usuario=${user.id_usuario}`);
      } catch (revErr) {
        console.error(`[auth-recovery] Fallo catastrófico al compensar id_usuario=${user.id_usuario}:`, revErr.message);
      }

      return res.status(500).json({
        error: 'No fue posible enviar el correo de recuperación en este momento. Por favor verifique la conexión o intente más tarde.'
      });
    }
  } catch (err) {
    console.error('[auth-recovery] Error general en recuperación:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor durante la recuperación de contraseña.' });
  }
});

// ─── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  const token = extractToken(req) || req.body?.token;
  let username = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      username = decoded.username;
    } catch {
      // Token inválido o expirado
    }
  }

  if (!username && req.body?.username) {
    username = req.body.username.trim().toLowerCase();
  }

  if (!username) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.' });
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios: contraseña provisional, nueva contraseña y confirmación.' });
  }

  const curPass = currentPassword.trim();
  const newPass = newPassword.trim();
  const confPass = confirmPassword.trim();

  if (newPass !== confPass) {
    return res.status(400).json({ error: 'La nueva contraseña y su confirmación no coinciden.' });
  }

  if (newPass === curPass) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la contraseña provisional actual.' });
  }

  // Política de seguridad: mínimo 8 caracteres, mayúscula, minúscula, número
  if (newPass.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  if (!/[A-Z]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una letra mayúscula.' });
  }
  if (!/[a-z]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una letra minúscula.' });
  }
  if (!/[0-9]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos un número.' });
  }

  try {
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = userResult.rows[0];

    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ error: 'Cuenta de usuario inactiva.' });
    }

    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    let matches = false;

    if (isBcrypt) {
      matches = await bcrypt.compare(curPass, user.password);
    } else {
      matches = (user.password === curPass);
    }

    if (!matches) {
      return res.status(400).json({ error: 'La contraseña provisional actual ingresada es incorrecta.' });
    }

    const newHash = await bcrypt.hash(newPass, BCRYPT_SALT_ROUNDS);

    await pool.query(
      `UPDATE usuarios
       SET password = $1,
           debe_cambiar_password = false,
           password_reset_expires = NULL
       WHERE id_usuario = $2`,
      [newHash, user.id_usuario]
    );

    console.log(`[auth] Contraseña actualizada exitosamente para usuario id=${user.id_usuario} (${user.username}). Bandera de cambio obligatorio desactivada.`);

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

    const freshPayload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
      modules:  allowedModules,
      permissions: permissions,
      mustChangePassword: false
    };

    const newToken = jwt.sign(freshPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, newToken);

    return res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes utilizar tu nueva contraseña.',
      token: newToken,
      user: freshPayload
    });
  } catch (err) {
    console.error('[auth] Error al cambiar contraseña:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al actualizar la contraseña.' });
  }
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Token de autenticación requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.mustChangePassword && req.path !== '/change-password' && req.path !== '/logout' && req.path !== '/verify') {
      return res.status(403).json({
        error: 'Debe cambiar su contraseña provisional antes de continuar.',
        mustChangePassword: true
      });
    }
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
  if (mods.includes('admin-backups') || mods.includes('backups')) {
    perms.push('admin-backups:read', 'admin-backups:write', 'admin-backups:download', 'admin-backups:delete');
  }
  return perms;
}

function resolveJobTitle(role) {
  if (!role) return 'Usuario del Sistema';
  const r = role.toLowerCase();
  if (r.includes('respaldo') || r.includes('backup')) return 'Gestor de Copias de Seguridad y Respaldo';
  if (r === 'sst' || r.includes('sst')) return 'Responsable de Seguridad y Salud en el Trabajo (SST)';
  if (r === 'incapacidades' || r.includes('incapacidad')) return 'Responsable de Incapacidades y Ausentismo Laboral';
  if (r.includes('permiso') && r.includes('licencia')) return 'Responsable de Permisos y Licencias Laborales';
  if (r === 'permisos' || r.includes('permiso')) return 'Responsable de Permisos Laborales';
  if (r.includes('coordinador')) return 'Coordinador de Solicitudes';
  if (r.includes('consulta') || r.includes('funcionario')) return 'Servidor Público';
  return 'Usuario del Sistema';
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
