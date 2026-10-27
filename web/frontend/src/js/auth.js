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
    const uname = (user.username || '').toLowerCase();
    if (uname === 'admin' || (user.role && user.role.toLowerCase().includes('admin'))) {
      return ['*'];
    }
    if (uname.includes('angela')) return ['dashboard', 'employees'];
    if (uname.includes('bergenet')) return ['dashboard', 'viaticos'];
    if (uname.includes('doris')) return ['dashboard', 'horarios'];
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

  function canEdit(moduleName) {
    const user = getUser();
    if (!user) return false;
    const uname = (user.username || '').toLowerCase();
    if (uname === 'admin') return true;
    const r = (user.role || '').toLowerCase();
    if (r.includes('administrador') || r.includes('coordinador')) return true;

    if (moduleName) {
      return hasModuleAccess(moduleName);
    }
    const mods = getUserModules(user);
    return mods.length > 0;
  }

  return { save, getToken, getUser, clear, isLoggedIn, canEdit, hasModuleAccess, getUserModules };
})();

