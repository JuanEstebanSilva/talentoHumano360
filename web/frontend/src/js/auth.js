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

  function isLoggedIn() {
    const token = getToken();
    if (!token) return false;
    try {
      // Decode JWT payload (no verification — that's the server's job)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    } catch { return false; }
  }

  function isAdmin(u) {
    const user = u || getUser();
    if (!user) return false;
    const r = String(user.role || '').toLowerCase();
    const uname = String(user.username || '').toLowerCase();
    return r.includes('administrador') || uname === 'admin@boyaca.gov.co' || uname === 'angela.ussa@boyaca.gov.co';
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
    return false;
  }

  function canEdit() {
    const user = getUser();
    if (!user || !user.role) return false;
    if (isAdmin(user)) return true;
    const r = String(user.role || '').toLowerCase();
    const scope = getRoleScope(user);
    return (
      r.includes('administrador') ||
      r.includes('coordinador') ||
      r.includes('responsable') ||
      scope !== 'all'
    );
  }

  return { save, getToken, getUser, clear, isLoggedIn, isAdmin, getRoleScope, canEditModule, canEdit };
})();
