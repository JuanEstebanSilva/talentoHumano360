/* ═══════════════════════════════════════════════════════════════════════════
   auth.js — Session and JWT management
   ═══════════════════════════════════════════════════════════════════════════ */

const Auth = (() => {
  const TOKEN_KEY = 'h360_token';
  const USER_KEY  = 'h360_user';
  const ADMIN_ELEVATED_KEY = 'talento360_admin_elevated';

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
    sessionStorage.removeItem(ADMIN_ELEVATED_KEY);
    if (typeof window !== 'undefined' && window.AdminErrorsModule && typeof window.AdminErrorsModule.stopAutoRefresh === 'function') {
      try { window.AdminErrorsModule.stopAutoRefresh(); } catch (_) {}
    }
  }

  function isAdminElevated() {
    if (!isAdmin()) return false;
    return sessionStorage.getItem(ADMIN_ELEVATED_KEY) === 'true';
  }

  function setAdminElevated(val) {
    if (val) {
      sessionStorage.setItem(ADMIN_ELEVATED_KEY, 'true');
    } else {
      sessionStorage.removeItem(ADMIN_ELEVATED_KEY);
    }
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

  function isAdmin(u) {
    const user = u || getUser();
    if (!user) return false;
    const r = String(user.role || '').toLowerCase();
    const uname = String(user.username || '').toLowerCase();
    const mods = Array.isArray(user.modules) ? user.modules : [];
    return r === 'administrador' || r === 'admin' || r.includes('administrador') || uname === 'admin' || uname === 'admin@boyaca.gov.co' || uname === 'alejoleo2022@gmail.com' || mods.includes('*') || mods.includes('all');
  }

  function getRoleScope(u) {
    const user = u || getUser();
    if (!user) return 'all';
    if (isAdmin(user)) return 'all';
    const r = String(user.role || '').trim().toLowerCase();
    const uname = String(user.username || '').trim().toLowerCase();

    if (r === 'sst' || r.includes('sst') || uname.startsWith('sandra.roa')) {
      return 'sst';
    }
    if (r === 'incapacidades' || r.includes('incapacidad') || uname.startsWith('luis.sanch')) {
      return 'incapacidades';
    }
    if (r === 'permisos y licencias' || (r.includes('permiso') && r.includes('licencia')) || uname.startsWith('sebastian.rincon')) {
      return 'permisos_licencias';
    }
    if (r === 'permisos' || r.includes('permiso') || uname.startsWith('alejandro.leon')) {
      return 'permisos';
    }
    return 'all';
  }

  function getUserModules(user) {
    if (!user) return ['dashboard'];
    const scope = getRoleScope(user);
    if (scope === 'sst') return ['sst', 'epidemiologico', 'sociodemografico', 'epp'];
    if (scope === 'incapacidades') return ['admin-requests', 'incapacidades'];
    if (scope === 'permisos_licencias') return ['admin-requests', 'permisos', 'licencias'];
    if (scope === 'permisos') return ['admin-requests', 'permisos'];
    if (Array.isArray(user.modules) && user.modules.length > 0) {
      return user.modules;
    }
    const role = (user.role || '').toLowerCase();
    if (role === 'administrador' || role === 'admin') {
      return ['*'];
    }
    return ['dashboard'];
  }

  function mustChangePassword() {
    const user = getUser();
    return Boolean(user && user.mustChangePassword);
  }

  function setMustChangePassword(val) {
    const user = getUser();
    if (user && typeof user === 'object') {
      user.mustChangePassword = Boolean(val);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  function hasModuleAccess(moduleName) {
    if (!isLoggedIn()) return false;
    if (mustChangePassword()) return false;
    const user = getUser();
    const mod = String(moduleName || '').toLowerCase().trim();
    if (!mod || mod === 'settings' || mod === 'privacidad' || mod === 'terminos' || mod === 'accesibilidad') {
      return true;
    }
    const scope = getRoleScope(user);
    if (scope === 'sst') {
      return ['sst', 'epidemiologico', 'sociodemografico', 'epp'].includes(mod);
    }
    if (scope === 'incapacidades') {
      return ['admin-requests', 'incapacidades'].includes(mod);
    }
    if (scope === 'permisos_licencias') {
      return ['admin-requests', 'permisos', 'licencias'].includes(mod);
    }
    if (scope === 'permisos') {
      return ['admin-requests', 'permisos'].includes(mod);
    }
    if (mod === 'dashboard') {
      return true;
    }
    const mods = getUserModules(user);
    if (mods.includes('*') || mods.includes('all')) return true;
    return mods.includes(mod);
  }

  function canEditModule(modulo, u) {
    const user = u || getUser();
    if (!user) return false;
    if (isAdmin(user)) return true;
    const scope = getRoleScope(user);
    const r = String(user.role || '').toLowerCase();
    if (r.includes('coordinador')) return true;

    const mod = String(modulo || '').toLowerCase();
    if (['sst', 'epidemiologico', 'sociodemografico', 'epp'].includes(mod)) {
      return scope === 'sst';
    }
    if (mod === 'incapacidades') {
      return scope === 'incapacidades';
    }
    if (mod === 'permisos') {
      return scope === 'permisos' || scope === 'permisos_licencias';
    }
    if (mod === 'licencias') {
      return scope === 'permisos_licencias';
    }
    return canEdit(mod);
  }

  /**
   * canEdit(moduleName):
   * Sistema RBAC unificado (soporta permisos explícitos de main y alcances de submódulos SST/Novedades).
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

    // 3. Verificación por alcance de los 6 submódulos (SST, Incapacidades, Permisos, Licencias)
    const scope = getRoleScope(user);
    if (scope !== 'all') {
      if (scope === 'sst' && ['sst', 'epidemiologico', 'sociodemografico', 'epp'].includes(targetMod)) return true;
      if (scope === 'incapacidades' && ['admin-requests', 'incapacidades', 'requests'].includes(targetMod)) return true;
      if (scope === 'permisos_licencias' && ['admin-requests', 'permisos', 'licencias', 'requests'].includes(targetMod)) return true;
      if (scope === 'permisos' && ['admin-requests', 'permisos', 'requests'].includes(targetMod)) return true;
      if (!targetMod) return true;
    }

    // 4. Verificación de permisos explícitos de mutación (write/delete/manage)
    if (perms.includes(`${targetMod}:write`) || perms.includes(`${targetMod}:*`)) return true;
    if (mods.includes(`${targetMod}_write`) || mods.includes(`${targetMod}:write`)) return true;
    if (perms.length === 0 && mods.includes(targetMod)) return true;

    return false;
  }

  return { save, getToken, getUser, clear, isLoggedIn, isAdmin, isAdminElevated, setAdminElevated, getRoleScope, canEditModule, canEdit, hasModuleAccess, getUserModules, mustChangePassword, setMustChangePassword };
})();
