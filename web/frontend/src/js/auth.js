/* ═══════════════════════════════════════════════════════════════════════════
   auth.js — Session and JWT management
   ═══════════════════════════════════════════════════════════════════════════ */

const Auth = (() => {
  const TOKEN_KEY = 'h360_token';
  const USER_KEY  = 'h360_user';

  function save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); }
    catch { return {}; }
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    try { localStorage.removeItem('talento360_legal_consent'); } catch (_) {}
  }

  function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) {
        b64 += '=';
      }
      if (typeof TextDecoder !== 'undefined') {
        const raw = atob(b64);
        const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder('utf-8').decode(bytes));
      }
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch {
      try {
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
      } catch {
        return null;
      }
    }
  }

  function isLoggedIn() {
    const token = getToken();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false;
    return payload.exp > Date.now() / 1000;
  }

  function getUserModules(user) {
    if (!user) return ['dashboard'];
    if (Array.isArray(user.modules) && user.modules.length > 0) {
      return user.modules;
    }
    const role = (user.role || '').toLowerCase();
    if (role === 'administrador' || role === 'admin') {
      return ['*'];
    }
    return ['dashboard'];
  }

  function hasModuleAccess(moduleName) {
    if (!isLoggedIn()) return false;
    const user = getUser();
    const mod = String(moduleName || '').toLowerCase().trim();
    if (!mod || mod === 'dashboard' || mod === 'settings' || mod === 'privacidad' || mod === 'terminos' || mod === 'accesibilidad') {
      return true;
    }
    const mods = getUserModules(user);
    if (mods.includes('*') || mods.includes('all')) return true;
    return mods.includes(mod);
  }

  /**
   * canEdit(moduleName):
   * Sistema RBAC basado exclusivamente en Roles y Permisos explícitos (AUD-007).
   * Desacoplado 100% de nombres, usernames o identificadores textuales.
   */
  function canEdit(moduleName) {
    const user = getUser();
    if (!user) return false;

    // 1. Superadministrador del sistema
    const r = (user.role || '').toLowerCase();
    const mods = Array.isArray(user.modules) ? user.modules : [];
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (r === 'administrador' || r === 'admin' || mods.includes('*') || perms.includes('*')) {
      return true;
    }

    // 2. Determinar módulo objetivo (explícito o inferido de la vista activa)
    let targetMod = (moduleName || '').toLowerCase().trim();
    if (!targetMod) {
      if (typeof App !== 'undefined' && App.getCurrentModule && App.getCurrentModule()) {
        targetMod = App.getCurrentModule().toLowerCase().trim();
      } else {
        const hash = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0].toLowerCase().trim();
        targetMod = hash;
      }
    }
    if (targetMod === 'servidores' || targetMod === 'servidores-publicos') targetMod = 'employees';

    // 3. Verificación de permisos explícitos de mutación (write/delete/manage)
    if (perms.includes(`${targetMod}:write`) || perms.includes(`${targetMod}:*`)) return true;
    if (mods.includes(`${targetMod}_write`) || mods.includes(`${targetMod}:write`)) return true;
    // Si no tiene permisos explícitos definidos en el payload, fallback a módulo asignado solo si perms está vacío
    if (perms.length === 0 && mods.includes(targetMod)) return true;

    return false;
  }

  return { save, getToken, getUser, clear, isLoggedIn, canEdit, hasModuleAccess, getUserModules };
})();
