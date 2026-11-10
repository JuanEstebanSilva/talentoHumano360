// Permisos del módulo. Salen solo del rol y de los módulos firmados en el token.
//   documents           → consultar documentos clasificados
//   documents_write     → cargar, clasificar, versionar y eliminar
//   documents_sensitive → ver y gestionar tipos marcados como sensibles (salud)

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

function canWrite(user) {
  return hasFullAccess(user) || modulesOf(user).includes('documents_write') || hasPermission(user, 'documents', 'write');
}

function canRead(user) {
  return canWrite(user) || modulesOf(user).includes('documents') || hasPermission(user, 'documents', 'read');
}

function canViewSensitive(user) {
  return hasFullAccess(user) || modulesOf(user).includes('documents_sensitive') || hasPermission(user, 'documents', 'sensitive');
}

// Los soportes de una solicitud exigen también acceso al módulo de solicitudes.
function canAccessRequests(user) {
  return hasFullAccess(user) || modulesOf(user).includes('admin-requests') || hasPermission(user, 'admin-requests', 'read');
}

module.exports = { canRead, canWrite, canViewSensitive, canAccessRequests };
