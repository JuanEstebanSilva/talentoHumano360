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
    const name = (user.name || '').toLowerCase();
    if (uname === 'admin' || (user.role && user.role.toLowerCase().includes('admin'))) {
      return ['*'];
    }
    // Todas las funcionarias tienen acceso de consulta a los 3 módulos misionales
    if (uname.includes('angela') || name.includes('angela') ||
        uname.includes('bergenet') || name.includes('bergenet') ||
        uname.includes('doris') || name.includes('doris')) {
      return ['dashboard', 'employees', 'viaticos', 'horarios'];
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
   * Verifica permisos de ESCRITURA (crear, editar, eliminar) según la Matriz Oficial:
   * - Administrador / Coordinador: Escritura en todos los módulos
   * - Angela Ussa: Escritura en Servidores Públicos ('employees'); Sólo Lectura en Viáticos y Horarios
   * - Bergenet Gutiérrez: Escritura en Viáticos ('viaticos'); Sólo Lectura en Servidores Públicos y Horarios
   * - Doris Canon: Escritura en Horarios ('horarios'); Sólo Lectura en Servidores Públicos y Viáticos
   */
  function canEdit(moduleName) {
    const user = getUser();
    if (!user) return false;
    const uname = (user.username || '').toLowerCase();
    const name  = (user.name || '').toLowerCase();

    // 1. Superadministrador y Coordinadores del sistema
    if (uname === 'admin') return true;
    const r = (user.role || '').toLowerCase();
    if (r.includes('administrador') || r.includes('coordinador')) return true;

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

    // 3. Matriz Estricta de Permisos por Funcionario
    // 3.1 Angela Ussa -> Únicamente Servidores Públicos
    if (uname.includes('angela') || name.includes('angela')) {
      return targetMod === 'employees' || targetMod === 'servidores' || targetMod === 'servidores-publicos';
    }

    // 3.2 Bergenet Gutiérrez -> Únicamente Viáticos
    if (uname.includes('bergenet') || name.includes('bergenet')) {
      return targetMod === 'viaticos';
    }

    // 3.3 Doris Canon -> Únicamente Horarios
    if (uname.includes('doris') || name.includes('doris')) {
      return targetMod === 'horarios';
    }

    // 4. Permisos explícitos por lista de módulos si vinieran definidos
    if (Array.isArray(user.modules)) {
      if (user.modules.includes('*') || user.modules.includes('all')) return true;
      if (targetMod && user.modules.includes(`${targetMod}_write`)) return true;
    }

    return false;
  }

  return { save, getToken, getUser, clear, isLoggedIn, canEdit, hasModuleAccess, getUserModules };
})();
