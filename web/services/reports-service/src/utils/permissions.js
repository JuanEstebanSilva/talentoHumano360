// Un informe nunca muestra datos de un módulo que el usuario no pueda consultar.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'talento360_secret_2026';

function modulesOf(user) {
  return Array.isArray(user?.modules) ? user.modules : [];
}

// El equipo firma además permissions ('modulo:accion', o '*') desde usuarios.permisos.
// Se aceptan ambos modelos: módulos en modules y permisos granulares en permissions.
function permissionsOf(user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function hasPermission(user, mod, action) {
  const perms = permissionsOf(user);
  return perms.includes('*') || perms.includes(`${mod}:${action}`);
}

function hasFullAccess(user) {
  const role = String(user?.role || '').toLowerCase();
  const mods = modulesOf(user);
  return role.includes('administrador') || role.includes('coordinador') || mods.includes('*') || mods.includes('all');
}

// La entidad decidió que todo usuario registrado use Informes y Automatización.
// Lo que limita es canAccessSource: cada informe solo trae módulos que el usuario ya puede consultar.
function canUseReports(user) {
  return Boolean(user?.username);
}

function canAutomate(user) {
  return Boolean(user?.username);
}

function canAccessSource(user, source) {
  if (!source) return false;
  return hasFullAccess(user) || source.modulos.every(mod => modulesOf(user).includes(mod) || hasPermission(user, mod, 'read'));
}

/** Usuario equivalente a una sesión, para ejecutar una tarea programada con sus permisos actuales. */
function userFromRow(row) {
  const modules = row.modulos
    ? row.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
    : [];
  const permissions = row.permisos
    ? row.permisos.split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
    : [];
  return { username: row.username, role: row.rol, modules, permissions };
}

function auth(req, res, next) {
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o sesión expirada.' });
  }
  if (!canUseReports(req.user)) {
    return res.status(403).json({ error: 'No tienes acceso al módulo de informes.' });
  }
  next();
}

module.exports = { auth, hasFullAccess, canAutomate, canAccessSource, userFromRow };
