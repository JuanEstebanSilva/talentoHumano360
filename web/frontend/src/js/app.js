/* ═══════════════════════════════════════════════════════════════════════════
   app.js — SPA Router, Login handler, Global utilities
   ═══════════════════════════════════════════════════════════════════════════ */

const App = (() => {

  // ─── Toast System ──────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    if (typeof Settings !== 'undefined' && !Settings.isNotificationTypeEnabled(type)) {
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    // FX: animate toast in with sound
    if (typeof FX !== 'undefined') FX.animateToastIn(toast, type);

    setTimeout(() => {
      if (typeof FX !== 'undefined') {
        FX.animateToastOut(toast, () => toast.remove());
      } else {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

  // ─── Modal System ──────────────────────────────────────────────────────────
  function openModal(title, bodyHtml, footerButtons = [], customClass = '') {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');
    const box = document.querySelector('.modal-box');
    if (!overlay || !titleEl || !bodyEl || !footerEl) return;

    if (box) {
      box.className = 'modal-box' + (customClass ? ' ' + customClass : '');
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    footerEl.innerHTML = '';
    footerButtons.forEach(btn => {
      const el = document.createElement('button');
      el.className = `btn ${btn.cls || 'btn-secondary'}`;
      if (btn.id) el.id = btn.id;
      el.textContent = btn.text;
      el.onclick = btn.action;
      footerEl.appendChild(el);
    });

    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    document.body.style.overflow = 'hidden';

    // FX: animated modal open
    if (typeof FX !== 'undefined') {
      FX.animateModalOpen(overlay, box);
    } else {
      overlay.style.opacity = '1';
    }
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const box = document.querySelector('.modal-box');
    if (!overlay) return;

    if (box) {
      box.className = 'modal-box';
      box.style.maxWidth = '';
      box.style.width = '';
    }

    if (typeof FX !== 'undefined') {
      FX.animateModalClose(overlay, box, () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      });
    } else {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  const MODULE_TITLES = {
    dashboard: 'Dashboard',
    employees: 'Servidores Públicos',
    requests: 'Solicitudes de Vacaciones',
    'admin-requests': 'Solicitudes Administrativas',
    viaticos: 'Viáticos',
    horarios: 'Horarios y Modalidades',
    sst: 'Seguridad y Salud en el Trabajo (SST)',
    settings: 'Configuración',
  };

  const MODULE_ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    employees: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    requests: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'admin-requests': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    viaticos: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    horarios: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    sst: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };

  async function navigate(module, options = {}) {
    const container = document.getElementById('module-container');
    const pageTitle = document.getElementById('page-title');
    const breadcrumbIcon = document.querySelector('.breadcrumb-icon');
    if (!container) return;

    // Update active nav
    document.querySelectorAll('.nav-item, .sidebar-settings-btn').forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });

    if (module === 'admin-requests') {
      const adminGroupBtn = document.getElementById('nav-admin-group');
      const menu = document.getElementById('admin-submenu');
      if (adminGroupBtn) {
        adminGroupBtn.classList.add('active');
        adminGroupBtn.setAttribute('aria-current', 'true');
        adminGroupBtn.setAttribute('aria-expanded', 'true');
      }
      if (menu) {
        menu.setAttribute('aria-hidden', 'false');
      }
    } else if (module === 'sst') {
      const sstGroupBtn = document.getElementById('nav-sst-group');
      const sstMenu = document.getElementById('sst-submenu');
      if (sstGroupBtn) {
        sstGroupBtn.classList.add('active');
        sstGroupBtn.setAttribute('aria-current', 'true');
        sstGroupBtn.setAttribute('aria-expanded', 'true');
      }
      if (sstMenu) {
        sstMenu.setAttribute('aria-hidden', 'false');
      }
    } else {
      const navBtn = document.getElementById(`nav-${module}`);
      if (navBtn) {
        navBtn.classList.add('active');
        navBtn.setAttribute('aria-current', 'page');
      }
    }

    let title = MODULE_TITLES[module] || module;
    let iconSvg = MODULE_ICONS[module] || MODULE_ICONS.dashboard;

    if (module === 'admin-requests') {
      const tipoKey = options.tipo || 'permisos';
      if (tipoKey === 'permisos') {
        title = 'Permisos Laborales';
        iconSvg = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
      } else if (tipoKey === 'incapacidades') {
        title = 'Incapacidades Médicas';
        iconSvg = '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>';
      } else if (tipoKey === 'licencias') {
        title = 'Licencias Institucionales';
        iconSvg = '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>';
      }
    } else if (module === 'sst') {
      const tabKey = options.tab || 'epidemiologico';
      if (tabKey === 'epidemiologico') {
        title = 'SST · Perfil Epidemiológico y EMO';
      } else if (tabKey === 'epp') {
        title = 'SST · Entrega de EPP';
      } else if (tabKey === 'sociodemografico') {
        title = 'SST · Perfil Sociodemográfico';
      }
    }

    if (pageTitle) pageTitle.textContent = title;
    document.title = `${title} — Talento 360`;
    if (breadcrumbIcon) breadcrumbIcon.innerHTML = iconSvg;
    const badge = document.getElementById('topbar-breadcrumb-badge');
    if (badge) badge.setAttribute('title', title);
    document.getElementById('app')?.setAttribute('data-current-module', module);

    const renderSelectedModule = async () => {
      switch (module) {
        case 'dashboard':      await DashboardModule.render(container); break;
        case 'employees':     await EmployeesModule.render(container); break;
        case 'requests':      await RequestsModule.render(container); break;
        case 'admin-requests': {
          const tipoKey = options.tipo || 'permisos';
          await AdminRequestsModule.render(container, tipoKey);
          const subnavMap = { permisos: 'nav-permisos', incapacidades: 'nav-incapacidades', licencias: 'nav-licencias' };
          const activeSubBtn = document.getElementById(subnavMap[tipoKey] || 'nav-permisos');
          if (activeSubBtn) {
            activeSubBtn.classList.add('active');
            activeSubBtn.setAttribute('aria-current', 'page');
          }
          const adminGroupBtn = document.getElementById('nav-admin-group');
          if (adminGroupBtn) adminGroupBtn.classList.add('active');
          expandAdminGroup();
          break;
        }
        case 'viaticos':      await ViaticosModule.render(container); break;
        case 'horarios':      await HorariosModule.render(container); break;
        case 'sst': {
          const tabKey = options.tab || 'epidemiologico';
          if (typeof SstModule !== 'undefined') await SstModule.render(container, tabKey);
          const sstSubMap = {
            epidemiologico: 'nav-sst-epidemiologico',
            epp: 'nav-sst-epp',
            sociodemografico: 'nav-sst-sociodemografico'
          };
          const activeSstSub = document.getElementById(sstSubMap[tabKey] || 'nav-sst-epidemiologico');
          if (activeSstSub) {
            activeSstSub.classList.add('active');
            activeSstSub.setAttribute('aria-current', 'page');
          }
          const sstGroupBtn = document.getElementById('nav-sst-group');
          if (sstGroupBtn) sstGroupBtn.classList.add('active');
          break;
        }
        case 'settings':
          if (typeof SettingsModule !== 'undefined') await SettingsModule.render(container);
          break;
        default:
          container.innerHTML = `<div class="module-enter"><p style="color:var(--text-muted)">Módulo no encontrado.</p></div>`;
      }
    };

    // FX: page transition
    if (typeof FX !== 'undefined') {
      FX.animatePageTransition(container, async () => {
        await renderSelectedModule();
        FX.onModuleRendered(container);
        container.scrollTop = 0;
      });
    } else {
      await renderSelectedModule();
      container.scrollTop = 0;
    }
  }

  function expandAdminGroup() {
    const toggle = document.getElementById('nav-admin-group');
    const menu = document.getElementById('admin-submenu');
    if (toggle && menu) {
      toggle.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
    }
  }

  // ─── Login & App Views ──────────────────────────────────────────────────────
  function showLogin() {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    const err = document.getElementById('login-error');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    if (err) {
      err.textContent = '';
      err.classList.remove('visible');
    }

    // Clean neutral theme on the public login page
    if (typeof Settings !== 'undefined') {
      Settings.resetToDefaults();
    }

    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    // Re-trigger login animation when returning to login
    requestAnimationFrame(() => {
      if (typeof FX !== 'undefined') FX.animateLoginIn();
    });
  }

  // ─── Avatar Palettes (Solid Colors) ──────────────────────────────────────────
  const AVATAR_PALETTES = [
    { id: 'red', name: 'Rojo Institucional', bg: '#E32431' },
    { id: 'blue', name: 'Azul Gobernación', bg: '#005387' },
    { id: 'cyan', name: 'Azul Claro', bg: '#007BC7' },
    { id: 'teal', name: 'Verde Azulado (Teal)', bg: '#1D8096' },
    { id: 'amber', name: 'Ámbar Cálido', bg: '#D97706' },
    { id: 'mustard', name: 'Amarillo Mostaza', bg: '#D1AD2A' },
    { id: 'pink', name: 'Fucsia Institucional', bg: '#CF3A78' },
    { id: 'purple', name: 'Púrpura Andino', bg: '#B84BA7' },
    { id: 'plum', name: 'Ciruela', bg: '#914169' },
    { id: 'forest', name: 'Verde Bosque', bg: '#287522' },
  ];

  let currentAvatarColor = null;

  function getAvatarColor(username) {
    const key = `talento360_avatar_color_${username || 'default'}`;
    const legacyKey = `humano360_avatar_color_${username || 'default'}`;
    let saved = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    if (saved) {
      if (saved.includes('linear-gradient')) {
        const hexMatch = saved.match(/#[0-9a-fA-F]{3,8}/);
        if (hexMatch && hexMatch[0].toLowerCase() !== '#1b5e20' && hexMatch[0].toLowerCase() !== '#287522') {
          saved = hexMatch[0];
        } else {
          saved = AVATAR_PALETTES[0].bg;
        }
        localStorage.setItem(key, saved);
      }
      return saved;
    }
    return AVATAR_PALETTES[0].bg;
  }

  function setAvatarColor(username, color) {
    const key = `talento360_avatar_color_${username || 'default'}`;
    localStorage.setItem(key, color);
  }

  function sanitizeRole(role) {
    if (!role) return 'Administrador';
    const r = String(role).trim();
    if (r.toLowerCase() === 'administradora' || r.toLowerCase() === 'administrador') {
      return 'Administrador';
    }
    return r;
  }

  function resolveJobTitle(user = {}) {
    if (user.jobTitle && String(user.jobTitle).trim()) {
      return String(user.jobTitle).trim();
    }
    const username = String(user.username || '').toLowerCase();
    const name = String(user.name || '').toLowerCase();
    if (username.includes('angela') || name.includes('angela') || name.includes('ussa')) {
      return 'Directora de Talento Humano';
    }
    if (username.includes('carlos') || name.includes('carlos')) {
      return 'Coordinador de Solicitudes';
    }
    if (username.includes('maria') || name.includes('maria')) {
      return 'Analista de Talento Humano';
    }
    return '';
  }

  function showApp() {
    const user = Auth.getUser();
    // Load per-user personalized preferences (theme, font, sound, etc.)
    if (typeof Settings !== 'undefined' && user && user.username) {
      Settings.loadForUser(user.username);
    }
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'grid';
    updateUserDisplay(user);
    updateTopbarDateTime();
    updateTopbarQuickControls();
    // FX: animate app entry
    if (typeof FX !== 'undefined') {
      FX.animateAppEnter();
      setTimeout(() => FX.Sound.loginSuccess(), 100);
    }
  }

  function updateUserDisplay(user = {}) {
    const name = user.name || 'Angela Ussa';
    const role = sanitizeRole(user.role || 'Administrador');
    const jobTitle = resolveJobTitle(user);
    const initial = name.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(user.username);

    // Sidebar
    const nameEl = document.getElementById('user-name');
    const jobTitleEl = document.getElementById('user-job-title');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = name;
    if (jobTitleEl) {
      if (jobTitle) {
        jobTitleEl.textContent = jobTitle;
        jobTitleEl.style.display = 'block';
      } else {
        jobTitleEl.textContent = '';
        jobTitleEl.style.display = 'none';
      }
    }
    if (roleEl) roleEl.textContent = role;
    if (avatarEl) {
      avatarEl.textContent = initial;
      avatarEl.style.background = avatarColor;
      // FX: avatar pop
      if (typeof FX !== 'undefined') FX.animateAvatarUpdate();
    }

    // Topbar
    const topNameEl = document.getElementById('topbar-user-name');
    const topRoleEl = document.getElementById('topbar-role-badge');
    const topAvatarEl = document.getElementById('topbar-avatar');
    if (topNameEl) topNameEl.textContent = name;
    if (topRoleEl) topRoleEl.textContent = role === 'Administrador' ? 'Admin' : role;
    if (topAvatarEl) {
      topAvatarEl.textContent = initial;
      topAvatarEl.style.background = avatarColor;
    }
  }

  // ─── User Profile Modal ────────────────────────────────────────────────────
  function openProfileModal() {
    const user = Auth.getUser();
    const initial = (user.name || 'A').charAt(0).toUpperCase();
    currentAvatarColor = getAvatarColor(user.username);

    const swatchesHtml = AVATAR_PALETTES.map(p => {
      const isSelected = p.bg === currentAvatarColor;
      return `
        <button type="button" class="avatar-swatch ${isSelected ? 'active' : ''}" style="background:${p.bg};" data-bg="${p.bg}" title="${p.name}" aria-label="${p.name}">
          ${isSelected ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    }).join('');

    const bodyHtml = `
      <div class="profile-card-header">
        <div class="profile-avatar-large" id="prof-avatar-preview" style="background:${currentAvatarColor};">${initial}</div>
        <div class="profile-header-info">
          <div class="profile-name-display">${escHtml(user.name || 'Angela Ussa')}</div>
          <div class="profile-job-title">${escHtml(resolveJobTitle(user))}</div>
          <span class="profile-role-pill">${escHtml(sanitizeRole(user.role || 'Administrador'))}</span>
          <p class="profile-dept-subtitle">Gobernación de Boyacá · Talento Humano</p>
        </div>
      </div>

      <form id="profile-form" autocomplete="off" onsubmit="return false;" style="display:flex;flex-direction:column;gap:var(--space-4);">
        <!-- Avatar Color Customization -->
        <div class="avatar-color-section">
          <div class="profile-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>
            <span>Color del Avatar</span>
          </div>
          <p class="avatar-color-subtitle">Selecciona un color institucional sólido o elige un tono personalizado:</p>
          <div class="avatar-swatches-grid" id="avatar-swatches-container">
            ${swatchesHtml}
            <div class="avatar-color-custom-btn" title="Elegir color personalizado">
              <input type="color" id="prof-custom-color" value="${(currentAvatarColor && currentAvatarColor.startsWith('#')) ? currentAvatarColor : '#E32431'}" aria-label="Color personalizado" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Correo Institucional (No modificable)</label>
          <input type="text" class="form-input form-input--no-icon profile-readonly-input" value="${escHtml(user.username || '')}" readonly disabled tabindex="-1" autocomplete="off" />
          <div class="profile-readonly-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>El correo institucional es asignado por el sistema y no puede ser alterado.</span>
          </div>
        </div>

        <div class="form-group">
          <label for="prof-name" class="form-label">Nombre Completo *</label>
          <input type="text" id="prof-name" class="form-input form-input--no-icon" value="${escHtml(user.name || '')}" placeholder="Tu nombre y apellidos" autocomplete="name" required />
        </div>

        <div class="profile-password-section">
          <label class="profile-password-toggle-card" for="prof-change-pass-toggle">
            <div class="profile-password-toggle-left">
              <div class="profile-password-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <div class="profile-password-toggle-title">Cambiar Contraseña</div>
                <div class="profile-password-toggle-desc">Activa esta opción únicamente si deseas renovar tu clave de acceso</div>
              </div>
            </div>
            <input type="checkbox" id="prof-change-pass-toggle" class="profile-password-checkbox" />
          </label>

          <div id="prof-password-fields" class="profile-password-fields-container" style="display:none;">
            <p style="font-size:var(--text-xs);color:var(--text-muted);margin:0 0 4px 0;">Ingresa tu clave actual y define la nueva contraseña para tu cuenta.</p>
            <div class="form-group">
              <label for="prof-cur-pass" class="form-label">Contraseña Actual *</label>
              <input type="password" id="prof-cur-pass" class="form-input form-input--no-icon" placeholder="Ingresa tu contraseña actual" autocomplete="new-password" data-lpignore="true" disabled value="" />
            </div>
            <div class="form-group">
              <label for="prof-new-pass" class="form-label">Nueva Contraseña *</label>
              <input type="password" id="prof-new-pass" class="form-input form-input--no-icon" placeholder="Mínimo 4 caracteres" autocomplete="new-password" data-lpignore="true" disabled value="" />
            </div>
            <div class="form-group">
              <label for="prof-conf-pass" class="form-label">Confirmar Nueva Contraseña *</label>
              <input type="password" id="prof-conf-pass" class="form-input form-input--no-icon" placeholder="Repite la nueva contraseña" autocomplete="new-password" data-lpignore="true" disabled value="" />
            </div>
          </div>
        </div>
      </form>`;

    openModal('Mi Perfil', bodyHtml, [
      { text: 'Configuración', cls: 'btn-secondary', id: 'prof-settings-btn', action: () => { closeModal(); navigate('settings'); } },
      { text: 'Cancelar', cls: 'btn-secondary', action: () => closeModal() },
      { text: 'Guardar Cambios', cls: 'btn-primary', id: 'prof-save-btn', action: saveProfile },
    ]);

    // Password toggle handler
    const togglePass = document.getElementById('prof-change-pass-toggle');
    const passFields = document.getElementById('prof-password-fields');
    const passInputs = [
      document.getElementById('prof-cur-pass'),
      document.getElementById('prof-new-pass'),
      document.getElementById('prof-conf-pass')
    ];

    if (togglePass && passFields) {
      togglePass.addEventListener('change', () => {
        const active = togglePass.checked;
        passFields.style.display = active ? 'flex' : 'none';
        passInputs.forEach(input => {
          if (input) {
            input.disabled = !active;
            input.value = '';
          }
        });
        if (active && passInputs[0]) {
          passInputs[0].focus();
        }
        if (typeof FX !== 'undefined') FX.Sound.navClick();
      });
    }

    // Force clear any delayed browser autofill
    setTimeout(() => {
      passInputs.forEach(input => {
        if (input && !togglePass?.checked) {
          input.value = '';
        }
      });
    }, 60);

    // Swatch click handlers
    const swatchesContainer = document.getElementById('avatar-swatches-container');
    const previewAvatar = document.getElementById('prof-avatar-preview');

    if (swatchesContainer && previewAvatar) {
      swatchesContainer.querySelectorAll('.avatar-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          const bg = btn.dataset.bg;
          currentAvatarColor = bg;
          previewAvatar.style.background = bg;

          // Update active swatch state
          swatchesContainer.querySelectorAll('.avatar-swatch').forEach(s => {
            s.classList.remove('active');
            s.innerHTML = '';
          });
          btn.classList.add('active');
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
        });
      });

      // Custom color picker handler (pure solid color)
      const customColorInput = document.getElementById('prof-custom-color');
      if (customColorInput) {
        customColorInput.addEventListener('input', (e) => {
          const hex = e.target.value;
          currentAvatarColor = hex;
          previewAvatar.style.background = hex;

          swatchesContainer.querySelectorAll('.avatar-swatch').forEach(s => {
            s.classList.remove('active');
            s.innerHTML = '';
          });
        });
      }
    }
  }

  async function saveProfile() {
    const user = Auth.getUser();
    const nombre = document.getElementById('prof-name')?.value.trim();
    const wantsChangePass = document.getElementById('prof-change-pass-toggle')?.checked;
    const curPass = document.getElementById('prof-cur-pass')?.value.trim() || '';
    const newPass = document.getElementById('prof-new-pass')?.value.trim() || '';
    const confPass = document.getElementById('prof-conf-pass')?.value.trim() || '';

    if (!nombre) {
      showToast('El nombre es requerido.', 'warning');
      return;
    }

    const payload = { nombre };

    if (wantsChangePass) {
      if (!curPass) {
        showToast('Debes ingresar tu contraseña actual para cambiarla.', 'warning');
        document.getElementById('prof-cur-pass')?.focus();
        return;
      }
      if (newPass.length < 4) {
        showToast('La nueva contraseña debe tener al menos 4 caracteres.', 'warning');
        document.getElementById('prof-new-pass')?.focus();
        return;
      }
      if (newPass !== confPass) {
        showToast('La nueva contraseña y su confirmación no coinciden.', 'warning');
        document.getElementById('prof-conf-pass')?.focus();
        return;
      }
      payload.currentPassword = curPass;
      payload.newPassword = newPass;
    }

    const btn = document.getElementById('prof-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      const res = await API.updateProfile(payload);
      Auth.save(res.token, res.user);

      // Save custom avatar color
      if (currentAvatarColor) {
        setAvatarColor(res.user.username, currentAvatarColor);
      }

      updateUserDisplay(res.user);
      closeModal();
      showToast('Perfil actualizado exitosamente.', 'success');
      if (typeof FX !== 'undefined') FX.successBurst(btn);
    } catch (err) {
      showToast(err.message || 'Error al actualizar perfil.', 'error');
      if (typeof FX !== 'undefined') FX.shakeElement(document.querySelector('.modal-box'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
    }
  }

  // ─── Logout Confirmation Dialog ────────────────────────────────────────────
  function confirmLogout() {
    const user = Auth.getUser() || {};
    const userName = user.name || user.username || '';
    const nameFormatted = userName ? `<strong>${escHtml(userName)}</strong>` : 'su cuenta';

    const modalHtml = `
      <div class="logout-confirm-modal-content">
        <div class="logout-confirm-icon-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <h3 class="logout-confirm-title">
          ¿Deseas cerrar sesión?
        </h3>
        <p class="logout-confirm-desc">
          ¿Estás seguro de que deseas cerrar la sesión activa de ${nameFormatted}?
        </p>
        <div class="logout-confirm-info-box">
          <svg class="logout-confirm-info-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>Para volver a acceder a la plataforma institucional deberás ingresar nuevamente con tus credenciales de acceso.</span>
        </div>
      </div>
    `;

    openModal('Confirmar Cierre de Sesión', modalHtml, [
      {
        text: 'Cancelar',
        cls: 'btn-secondary',
        id: 'btn-logout-cancel',
        action: () => closeModal()
      },
      {
        text: 'Sí, cerrar sesión',
        cls: 'btn-danger',
        id: 'btn-logout-confirm',
        action: () => {
          closeModal();
          // FX: logout sound
          if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.logout();
          Auth.clear();
          if (typeof Settings !== 'undefined') {
            Settings.resetToDefaults();
          }
          showLogin();
          showToast('Sesión cerrada correctamente.', 'info');
        }
      }
    ], 'modal-sm modal-logout-confirm');

    // Focus cancel button for safe keyboard interaction
    setTimeout(() => {
      document.getElementById('btn-logout-cancel')?.focus();
    }, 50);
  }

  // ─── Live Topbar Date & Time ───────────────────────────────────────────────
  function updateTopbarDateTime() {
    const dateEl = document.getElementById('topbar-date-text');
    const timeEl = document.getElementById('topbar-time-text');
    if (!dateEl && !timeEl) return;

    const now = new Date();
    if (dateEl) {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const diaSemana = dias[now.getDay()];
      const mes = meses[now.getMonth()];
      dateEl.textContent = `${diaSemana}, ${now.getDate()} ${mes} ${now.getFullYear()}`;
    }
    if (timeEl) {
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
      hours = hours % 12 || 12;
      timeEl.textContent = `${hours}:${minutes} ${ampm}`;
    }
  }

  // ─── Quick Access Controls (Theme & Contrast) ──────────────────────────────
  function updateTopbarQuickControls() {
    const themeSwitch = document.getElementById('topbar-theme-toggle');
    const contrastBtn = document.getElementById('topbar-contrast-toggle');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (typeof Settings !== 'undefined' && Settings.get('theme') === 'dark');

    if (themeSwitch) {
      themeSwitch.setAttribute('aria-checked', String(isDark));
      themeSwitch.setAttribute('title', isDark ? 'Modo Oscuro activo (clic para cambiar a Modo Claro)' : 'Modo Claro activo (clic para cambiar a Modo Oscuro)');
    }

    const isHighContrast = document.documentElement.getAttribute('data-high-contrast') === 'true' ||
      (typeof Settings !== 'undefined' && Settings.get('highContrast') === true);

    if (contrastBtn) {
      if (isHighContrast) {
        contrastBtn.classList.add('is-active');
        contrastBtn.setAttribute('title', 'Líneas de tabla y alto contraste: Activados (clic para desactivar)');
      } else {
        contrastBtn.classList.remove('is-active');
        contrastBtn.setAttribute('title', 'Líneas de tabla y alto contraste: Desactivados (clic para activar)');
      }
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Initialize system settings & preferences
    if (typeof Settings !== 'undefined') {
      Settings.init();
    }

    // Restore sidebar preference
    const isCollapsed = (localStorage.getItem('talento360_sidebar_collapsed') ?? localStorage.getItem('humano360_sidebar_collapsed')) === 'true';
    if (isCollapsed) {
      document.getElementById('app')?.classList.add('sidebar-collapsed');
    }

    // Topbar live date/time & quick controls
    updateTopbarDateTime();
    setInterval(updateTopbarDateTime, 1000);
    updateTopbarQuickControls();

    // Password toggle
    const toggleBtn = document.getElementById('toggle-password');
    const passInput = document.getElementById('login-password');
    const eyeOpen = document.getElementById('eye-open');
    const eyeClosed = document.getElementById('eye-closed');
    if (toggleBtn && passInput) {
      toggleBtn.addEventListener('click', () => {
        const isText = passInput.type === 'text';
        passInput.type = isText ? 'password' : 'text';
        eyeOpen.style.display = isText ? 'block' : 'none';
        eyeClosed.style.display = isText ? 'none' : 'block';
      });
    }

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const errorEl = document.getElementById('login-error');
        const btnText = document.querySelector('#login-btn .btn-text');
        const btnLoader = document.querySelector('#login-btn .btn-loader');
        const btn = document.getElementById('login-btn');

        if (!username || !password) {
          errorEl.textContent = 'Por favor ingresa usuario y contraseña.';
          errorEl.classList.add('visible');
          return;
        }

        errorEl.classList.remove('visible');
        btn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'flex';

        try {
          const res = await API.login(username, password);
          if (res.user) {
            res.user.role = sanitizeRole(res.user.role);
            if (!res.user.jobTitle) {
              res.user.jobTitle = resolveJobTitle(res.user);
            }
          }
          Auth.save(res.token, res.user);
          // FX: success animation then transition
          if (typeof FX !== 'undefined') {
            FX.animateLoginSuccess(() => {
              showApp();
              navigate('dashboard');
            });
          } else {
            showApp();
            navigate('dashboard');
          }
        } catch (err) {
          errorEl.textContent = err.message || 'Error en la contraseña o en el usuario.';
          errorEl.classList.add('visible');
          // FX: error shake + sound
          if (typeof FX !== 'undefined') FX.animateLoginError();
        } finally {
          btn.disabled = false;
          if (btnText) btnText.style.display = 'inline';
          if (btnLoader) btnLoader.style.display = 'none';
        }
      });
    }

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmLogout();
    });

    // Profile modal openers
    document.getElementById('sidebar-user')?.addEventListener('click', (e) => {
      if (e.target.closest('#logout-btn')) return;
      openProfileModal();
    });
    document.getElementById('profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileModal();
    });
    document.getElementById('topbar-profile-btn')?.addEventListener('click', () => {
      openProfileModal();
    });
    document.getElementById('topbar-settings-btn')?.addEventListener('click', () => {
      navigate('settings');
    });

    document.getElementById('topbar-contrast-toggle')?.addEventListener('click', () => {
      const isHigh = document.documentElement.getAttribute('data-high-contrast') === 'true' ||
        (typeof Settings !== 'undefined' && Settings.get('highContrast') === true);
      const next = !isHigh;
      if (next) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }
      if (typeof Settings !== 'undefined') Settings.set('highContrast', next);
      updateTopbarQuickControls();
      showToast(next ? 'Líneas de tabla y alto contraste activados' : 'Alto contraste desactivado', 'info');
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
    });

    document.getElementById('topbar-theme-toggle')?.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (typeof Settings !== 'undefined' && Settings.get('theme') === 'dark');
      const nextTheme = isDark ? 'light' : 'dark';
      if (typeof Settings !== 'undefined') {
        Settings.set('theme', nextTheme);
      } else {
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('talento360_theme', nextTheme);
      }
      updateTopbarQuickControls();
      if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.click();
    });

    // Sidebar toggle (both sidebar and topbar buttons)
    const toggleSidebar = () => {
      const app = document.getElementById('app');
      if (!app) return;
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('mobile-open');
      } else {
        const collapsed = app.classList.toggle('sidebar-collapsed');
        localStorage.setItem('talento360_sidebar_collapsed', String(collapsed));
        // FX: sidebar toggle animation
        if (typeof FX !== 'undefined') FX.animateSidebarToggle(collapsed);
      }
    };

    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('topbar-sidebar-toggle')?.addEventListener('click', toggleSidebar);

    // Modal close - Únicamente mediante los botones del modal/formulario (sin parpadeos al hacer clic afuera)
    document.getElementById('modal-close')?.addEventListener('click', closeModal);

    // Nav items
    document.querySelectorAll('.nav-item[data-module]:not(.nav-group-toggle), .sidebar-settings-btn[data-module]').forEach(btn => {
      btn.addEventListener('click', () => {
        // FX: nav click animation
        if (typeof FX !== 'undefined') FX.animateNavClick(btn);
        const module = btn.dataset.module;
        const tipo = btn.dataset.tipo;
        const tab = btn.dataset.tab;
        if (module === 'admin-requests') {
          const tipoKey = { 'Permiso Laboral': 'permisos', 'Incapacidad': 'incapacidades', 'Licencia': 'licencias' }[tipo] || 'permisos';
          navigate('admin-requests', { tipo: tipoKey });
        } else if (module === 'sst') {
          navigate('sst', { tab: tab || 'epidemiologico' });
        } else {
          navigate(module);
        }
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('mobile-open');
      });
    });

    // Admin group toggle
    document.getElementById('nav-admin-group')?.addEventListener('click', () => {
      const toggle = document.getElementById('nav-admin-group');
      const menu = document.getElementById('admin-submenu');
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.setAttribute('aria-hidden', String(expanded));
      if (typeof FX !== 'undefined') FX.Sound.navClick();
    });

    // SST group toggle
    document.getElementById('nav-sst-group')?.addEventListener('click', () => {
      const toggle = document.getElementById('nav-sst-group');
      const menu = document.getElementById('sst-submenu');
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.setAttribute('aria-hidden', String(expanded));
      if (typeof FX !== 'undefined') FX.Sound.navClick();
    });

    // Check existing session and cleanse stored user data
    if (Auth.isLoggedIn()) {
      const storedUser = Auth.getUser();
      if (storedUser && typeof storedUser === 'object') {
        let changed = false;
        if (storedUser.role === 'Administradora') {
          storedUser.role = 'Administrador';
          changed = true;
        }
        if (!storedUser.jobTitle) {
          const title = resolveJobTitle(storedUser);
          if (title) {
            storedUser.jobTitle = title;
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem('h360_user', JSON.stringify(storedUser));
        }
      }
      if (typeof Settings !== 'undefined' && storedUser && storedUser.username) {
        Settings.loadForUser(storedUser.username);
      }
      showApp();
      navigate('dashboard');
    } else {
      if (typeof Settings !== 'undefined') {
        Settings.resetToDefaults();
      }
      showLogin();
    }

    // FX: init effects engine
    if (typeof FX !== 'undefined') FX.init();
  }

  return { init, navigate, showLogin, showApp, showToast, openModal, closeModal, openProfileModal, confirmLogout, updateTopbarQuickControls, updateTopbarDateTime };
})();

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
