/* ═══════════════════════════════════════════════════════════════════════════
   fx.js — Talento 360 Effects Engine
   Anime.js animations + Web Audio API synthesized sounds
   ═══════════════════════════════════════════════════════════════════════════ */

const FX = (() => {

  // ─── Audio Engine (Web Audio API — zero external files) ───────────────────
  let _ctx = null;
  function _getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function _tone(opts) {
    if (typeof Settings !== 'undefined' && !Settings.get('soundEnabled')) return;
    try {
      const { freq = 440, freq2, type = 'sine', volume = 0.18, duration = 0.12, attack = 0.008, decay = 0.05 } = opts;
      const ctx = _getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
    } catch (e) { /* AudioContext blocked — silent fallback */ }
  }

  function _chord(notes, delay = 0) {
    if (typeof Settings !== 'undefined' && !Settings.get('soundEnabled')) return;
    notes.forEach((n, i) => setTimeout(() => _tone(n), delay + i * 30));
  }

  // ─── Sound Library ────────────────────────────────────────────────────────
  const Sound = {
    // Login success: uplifting ascending chord
    loginSuccess() {
      _chord([
        { freq: 261, freq2: 523, type: 'sine', volume: 0.12, duration: 0.22 },
        { freq: 329, freq2: 659, type: 'sine', volume: 0.10, duration: 0.28 },
        { freq: 392, freq2: 784, type: 'sine', volume: 0.08, duration: 0.35 },
      ], 60);
    },
    // Login error: dissonant descending
    loginError() {
      _tone({ freq: 320, freq2: 180, type: 'sawtooth', volume: 0.10, duration: 0.25 });
      setTimeout(() => _tone({ freq: 200, freq2: 140, type: 'square', volume: 0.06, duration: 0.20 }), 120);
    },
    // Navigation click: soft click
    navClick() {
      _tone({ freq: 600, freq2: 480, type: 'sine', volume: 0.06, duration: 0.08, attack: 0.002 });
    },
    click() {
      this.navClick();
    },
    // Toast success
    toastSuccess() {
      _tone({ freq: 523, freq2: 659, type: 'sine', volume: 0.09, duration: 0.18, attack: 0.005 });
      setTimeout(() => _tone({ freq: 784, type: 'sine', volume: 0.07, duration: 0.15 }), 90);
    },
    // Toast error
    toastError() {
      _tone({ freq: 280, freq2: 220, type: 'triangle', volume: 0.10, duration: 0.18 });
    },
    // Toast warning
    toastWarning() {
      _tone({ freq: 440, type: 'triangle', volume: 0.08, duration: 0.12 });
      setTimeout(() => _tone({ freq: 380, type: 'triangle', volume: 0.06, duration: 0.10 }), 80);
    },
    // Modal open: soft pop
    modalOpen() {
      _tone({ freq: 380, freq2: 480, type: 'sine', volume: 0.07, duration: 0.15, attack: 0.01 });
    },
    // Modal close: reverse pop
    modalClose() {
      _tone({ freq: 380, freq2: 280, type: 'sine', volume: 0.05, duration: 0.12 });
    },
    // Button action confirm
    confirm() {
      _tone({ freq: 523, type: 'sine', volume: 0.09, duration: 0.10 });
      setTimeout(() => _tone({ freq: 659, type: 'sine', volume: 0.07, duration: 0.14 }), 60);
    },
    // Logout: descending
    logout() {
      _chord([
        { freq: 523, freq2: 392, type: 'sine', volume: 0.09, duration: 0.20 },
        { freq: 392, freq2: 261, type: 'sine', volume: 0.07, duration: 0.28 },
      ], 0);
    },
    // Sidebar toggle
    sidebarToggle() {
      _tone({ freq: 500, freq2: 350, type: 'sine', volume: 0.04, duration: 0.09, attack: 0.003 });
    },
    // Data load complete
    dataLoaded() {
      _tone({ freq: 440, freq2: 550, type: 'sine', volume: 0.05, duration: 0.14 });
    },
    // Card hover
    hover() {
      _tone({ freq: 700, type: 'sine', volume: 0.02, duration: 0.05, attack: 0.002 });
    },
    // Delete / danger action
    danger() {
      _tone({ freq: 220, freq2: 160, type: 'sawtooth', volume: 0.08, duration: 0.20 });
    },
    // Number counter ping
    counterPing() {
      _tone({ freq: 880, type: 'sine', volume: 0.04, duration: 0.07, attack: 0.001 });
    },
  };

  // ─── Particle Burst (confetti-style) ─────────────────────────────────────
  function burst(x, y, opts = {}) {
    if (!window.anime) return;
    if (typeof Settings !== 'undefined' && Settings.get('reduceMotion')) return;
    const { count = 14, colors = ['#28871B', '#D1AD2A', '#007BC7', '#D14600', '#B84BA7', '#ffffff'], size = 8 } = opts;
    const container = document.body;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed; pointer-events:none; z-index:99999;
        width:${size}px; height:${size}px; border-radius:50%;
        background:${colors[i % colors.length]};
        left:${x}px; top:${y}px; transform:translate(-50%,-50%);
        will-change:transform,opacity;
      `;
      container.appendChild(el);

      const angle = (360 / count) * i + Math.random() * 25;
      const dist = 60 + Math.random() * 80;
      const rad = (angle * Math.PI) / 180;
      const tx = Math.cos(rad) * dist;
      const ty = Math.sin(rad) * dist;

      anime({
        targets: el,
        translateX: [0, tx],
        translateY: [0, ty],
        opacity: [1, 0],
        scale: [1, 0.2 + Math.random() * 0.5],
        duration: 700 + Math.random() * 400,
        easing: 'easeOutExpo',
        complete: () => el.remove(),
      });
    }
  }

  // ─── Ripple effect on click ────────────────────────────────────────────────
  function ripple(el, e) {
    if (!window.anime || !el) return;
    const rect = el.getBoundingClientRect();
    const x = (e?.clientX ?? rect.left + rect.width / 2) - rect.left;
    const y = (e?.clientY ?? rect.top + rect.height / 2) - rect.top;
    const rippleEl = document.createElement('span');
    rippleEl.style.cssText = `
      position:absolute; border-radius:50%; background:rgba(255,255,255,0.35);
      width:4px; height:4px; pointer-events:none; z-index:10;
      left:${x}px; top:${y}px; transform:translate(-50%,-50%);
      will-change:transform,opacity;
    `;
    const prevPos = el.style.position || getComputedStyle(el).position;
    if (prevPos === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(rippleEl);

    anime({
      targets: rippleEl,
      width: [4, Math.max(el.offsetWidth, el.offsetHeight) * 2.5],
      height: [4, Math.max(el.offsetWidth, el.offsetHeight) * 2.5],
      opacity: [0.55, 0],
      duration: 550,
      easing: 'easeOutExpo',
      complete: () => rippleEl.remove(),
    });
  }

  // ─── Login Screen Animations ──────────────────────────────────────────────
  function animateLoginIn() {
    if (!window.anime) return;

    // Orbs floating
    anime({
      targets: '.login-orb--1',
      translateY: [-20, 20],
      translateX: [0, 15],
      duration: 4000,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine',
    });
    anime({
      targets: '.login-orb--2',
      translateY: [20, -20],
      translateX: [10, -10],
      duration: 5200,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine',
    });

    // Logo bounce-in
    anime({
      targets: '.login-logo-icon',
      scale: [0, 1],
      rotate: [-15, 0],
      opacity: [0, 1],
      duration: 700,
      easing: 'spring(1, 90, 10, 0)',
      delay: 200,
    });

    // Stagger card elements
    anime({
      targets: '.login-card-new > *',
      translateY: [24, 0],
      opacity: [0, 1],
      duration: 520,
      easing: 'easeOutExpo',
      delay: anime.stagger(80, { start: 300 }),
    });
  }

  function animateLoginSuccess(onDone) {
    if (!window.anime) { onDone?.(); return; }
    const card = document.querySelector('.login-card-new');
    if (!card) { onDone?.(); return; }

    Sound.loginSuccess();

    // Green flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed; inset:0; background:rgba(34,197,94,0.15);
      z-index:9999; pointer-events:none;
    `;
    document.body.appendChild(flash);

    anime({
      targets: flash,
      opacity: [0, 1, 0],
      duration: 600,
      easing: 'easeInOutQuad',
      complete: () => flash.remove(),
    });

    anime({
      targets: card,
      scale: [1, 1.03, 0.96, 1],
      duration: 480,
      easing: 'easeInOutQuad',
      complete: () => onDone?.(),
    });
  }

  function animateLoginError() {
    if (!window.anime) return;
    const card = document.querySelector('.login-card-new');
    const errorEl = document.getElementById('login-error');
    Sound.loginError();

    if (card) {
      anime({
        targets: card,
        translateX: [0, -12, 12, -8, 8, -4, 4, 0],
        duration: 380,
        easing: 'easeInOutQuad',
      });
    }

    if (errorEl) {
      anime({
        targets: errorEl,
        scale: [0.95, 1.02, 1],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutBack',
      });
    }
  }

  // ─── App Entry Animation ──────────────────────────────────────────────────
  function animateAppEnter() {
    if (!window.anime) return;

    anime({
      targets: '#sidebar',
      translateX: [-260, 0],
      opacity: [0, 1],
      duration: 520,
      easing: 'easeOutExpo',
    });

    anime({
      targets: '.topbar',
      translateY: [-64, 0],
      opacity: [0, 1],
      duration: 480,
      easing: 'easeOutExpo',
      delay: 80,
    });

    anime({
      targets: '#module-container',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      easing: 'easeOutExpo',
      delay: 180,
    });
  }

  // ─── Module Page Transition ───────────────────────────────────────────────
  let _pageTimeline = null;
  function animatePageTransition(container, onReady) {
    if (!window.anime) { onReady?.(); return; }
    if (_pageTimeline) _pageTimeline.pause();

    anime({
      targets: container,
      opacity: [0, 0.01],
      translateY: [0, 8],
      duration: 80,
      easing: 'easeInExpo',
      complete: () => {
        onReady?.();
        anime({
          targets: container,
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 380,
          easing: 'easeOutExpo',
        });
      },
    });
  }

  // ─── Toast Animations ─────────────────────────────────────────────────────
  function animateToastIn(toast, type) {
    if (!window.anime) return;

    const soundMap = {
      success: () => Sound.toastSuccess(),
      error: () => Sound.toastError(),
      warning: () => Sound.toastWarning(),
      info: () => Sound.navClick(),
    };
    soundMap[type]?.();

    anime({
      targets: toast,
      translateX: [340, 0],
      opacity: [0, 1],
      duration: 480,
      easing: 'spring(1, 80, 12, 0)',
    });
  }

  function animateToastOut(toast, done) {
    if (!window.anime) { done?.(); return; }
    anime({
      targets: toast,
      translateX: [0, 340],
      opacity: [1, 0],
      duration: 300,
      easing: 'easeInExpo',
      complete: done,
    });
  }

  // ─── Modal Animations ─────────────────────────────────────────────────────
  function animateModalOpen(overlay, box) {
    if (!window.anime) return;
    Sound.modalOpen();

    anime({
      targets: overlay,
      opacity: [0, 1],
      duration: 250,
      easing: 'easeOutQuad',
    });
    anime({
      targets: box,
      scale: [0.85, 1],
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 420,
      easing: 'spring(1, 100, 14, 0)',
    });
  }

  function animateModalClose(overlay, box, done) {
    if (!window.anime) { done?.(); return; }
    Sound.modalClose();

    anime({
      targets: box,
      scale: [1, 0.92],
      opacity: [1, 0],
      duration: 220,
      easing: 'easeInExpo',
    });
    anime({
      targets: overlay,
      opacity: [1, 0],
      duration: 240,
      easing: 'easeInQuad',
      complete: done,
    });
  }

  // ─── Nav Item Animations ──────────────────────────────────────────────────
  function animateNavClick(navItem) {
    if (!window.anime || !navItem) return;
    Sound.navClick();

    anime({
      targets: navItem,
      scale: [1, 0.96, 1],
      duration: 200,
      easing: 'easeInOutQuad',
    });
  }

  // ─── Sidebar Toggle ────────────────────────────────────────────────────────
  function animateSidebarToggle(isCollapsing) {
    if (!window.anime) return;
    Sound.sidebarToggle();

    anime({
      targets: '.sidebar-toggle svg',
      rotate: isCollapsing ? [0, 180] : [180, 0],
      duration: 380,
      easing: 'easeInOutBack',
    });
  }

  // ─── Counter Number Animation ──────────────────────────────────────────────
  function animateCounters(rootEl) {
    if (!window.anime) return;
    const els = (rootEl || document).querySelectorAll('[data-count-target]');
    els.forEach((el) => {
      const target = parseInt(el.dataset.countTarget, 10);
      if (isNaN(target)) return;
      const obj = { val: 0 };
      const prefix = el.dataset.countPrefix || '';
      const suffix = el.dataset.countSuffix || '';
      anime({
        targets: obj,
        val: [0, target],
        duration: 1400,
        easing: 'easeOutExpo',
        round: 1,
        update: () => {
          el.textContent = prefix + obj.val.toLocaleString('es-CO') + suffix;
        },
        begin: () => Sound.counterPing(),
        complete: () => Sound.dataLoaded(),
      });
    });
  }

  // ─── Stat Cards Stagger ───────────────────────────────────────────────────
  function animateStatCards(rootEl) {
    if (!window.anime) return;
    const cards = (rootEl || document).querySelectorAll('.stat-card, .dashboard-card, .metric-card');
    if (!cards.length) return;

    anime({
      targets: cards,
      opacity: [0, 1],
      translateY: [28, 0],
      scale: [0.96, 1],
      duration: 540,
      easing: 'easeOutExpo',
      delay: anime.stagger(70),
    });
  }

  // ─── Table Row Stagger ────────────────────────────────────────────────────
  function animateTableRows(rootEl) {
    if (!window.anime) return;
    const rows = (rootEl || document).querySelectorAll('tbody tr');
    if (!rows.length) return;

    anime({
      targets: rows,
      opacity: [0, 1],
      translateX: [-12, 0],
      duration: 300,
      easing: 'easeOutExpo',
      delay: anime.stagger(28, { start: 60 }),
    });
  }

  // ─── Logo Breathing Glow ──────────────────────────────────────────────────
  function startLogoBreathing() {
    if (!window.anime) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const targets = document.querySelectorAll('.sidebar-logo img, .sidebar-logo svg');
    if (!targets.length) return;

    anime({
      targets,
      filter: isDark ? [
        'drop-shadow(0 0 4px rgba(255,255,255,0.3)) drop-shadow(0 0 8px rgba(209,173,42,0.3))',
        'drop-shadow(0 0 10px rgba(255,255,255,0.65)) drop-shadow(0 0 16px rgba(209,173,42,0.65))',
      ] : [
        'drop-shadow(0 0 4px rgba(209,173,42,0.35))',
        'drop-shadow(0 0 14px rgba(209,173,42,0.75))',
      ],
      duration: 2200,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine',
    });
  }

  // ─── User Avatar Entrance ──────────────────────────────────────────────────
  function animateAvatarUpdate() {
    if (!window.anime) return;
    const avatar = document.getElementById('user-avatar');
    if (!avatar) return;

    anime({
      targets: avatar,
      scale: [1.3, 1],
      rotate: [8, 0],
      duration: 400,
      easing: 'spring(1, 90, 12, 0)',
    });
  }

  // ─── Success Burst on confirmations ──────────────────────────────────────
  function successBurst(btn) {
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 18,
      colors: ['#28871B', '#287522', '#D1AD2A', '#ffffff', '#857352'],
    });
    Sound.confirm();
  }

  // ─── Error Shake ──────────────────────────────────────────────────────────
  function shakeElement(el) {
    if (!window.anime || !el) return;
    anime({
      targets: el,
      translateX: [0, -10, 10, -7, 7, -3, 3, 0],
      duration: 420,
      easing: 'easeInOutQuad',
    });
    Sound.toastError();
  }

  // ─── Delete danger pulse ──────────────────────────────────────────────────
  function dangerPulse(btn) {
    if (!window.anime || !btn) return;
    Sound.danger();
    anime({
      targets: btn,
      boxShadow: [
        '0 0 0 0 rgba(239,68,68,0)',
        '0 0 0 8px rgba(239,68,68,0.3)',
        '0 0 0 0 rgba(239,68,68,0)',
      ],
      duration: 500,
      easing: 'easeOutExpo',
    });
  }

  // ─── Ripple on all buttons ────────────────────────────────────────────────
  function attachRippleToButtons(root) {
    const btns = (root || document).querySelectorAll('.btn, .nav-item, .sidebar-user, .stat-card');
    btns.forEach(btn => {
      if (btn.dataset.rippleAttached) return;
      btn.dataset.rippleAttached = '1';
      btn.addEventListener('click', (e) => ripple(btn, e));
    });
  }

  // ─── Hover lift on stat cards ──────────────────────────────────────────────
  function attachCardHoverEffects(root) {
    if (!window.anime) return;
    const cards = (root || document).querySelectorAll('.stat-card, .dashboard-card');
    cards.forEach(card => {
      if (card.dataset.hoverAttached) return;
      card.dataset.hoverAttached = '1';
      card.addEventListener('mouseenter', () => {
        anime({ targets: card, translateY: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', duration: 240, easing: 'easeOutQuad' });
        Sound.hover();
      });
      card.addEventListener('mouseleave', () => {
        anime({ targets: card, translateY: 0, boxShadow: '', duration: 280, easing: 'easeOutQuad' });
      });
    });
  }

  // ─── Input focus glow ─────────────────────────────────────────────────────
  function attachInputEffects(root) {
    if (!window.anime) return;
    const inputs = (root || document).querySelectorAll('.form-input, .filter-input, .filter-select');
    inputs.forEach(inp => {
      if (inp.dataset.fxAttached) return;
      inp.dataset.fxAttached = '1';
      inp.addEventListener('focus', () => {
        anime({ targets: inp, scale: [1, 1.01], duration: 200, easing: 'easeOutQuad' });
      });
      inp.addEventListener('blur', () => {
        anime({ targets: inp, scale: [1.01, 1], duration: 200, easing: 'easeOutQuad' });
      });
    });
  }

  // ─── Page-level init after module renders ─────────────────────────────────
  function onModuleRendered(container) {
    animateStatCards(container);
    animateTableRows(container);
    animateCounters(container);
    attachRippleToButtons(container);
    attachCardHoverEffects(container);
    attachInputEffects(container);
  }

  // ─── Top-level app init ───────────────────────────────────────────────────
  function init() {
    // Start logo breathing when app is visible
    const observer = new MutationObserver(() => {
      if (document.getElementById('app')?.style.display !== 'none') {
        startLogoBreathing();
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('app') || document.body, { attributes: true, attributeFilter: ['style'] });

    // Attach ripples globally on dynamic content
    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) {
            attachRippleToButtons(n);
            attachCardHoverEffects(n);
            attachInputEffects(n);
          }
        });
      });
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    // Animate login on page load
    animateLoginIn();
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    Sound,
    burst,
    ripple,
    shakeElement,
    dangerPulse,
    successBurst,
    animateLoginIn,
    animateLoginSuccess,
    animateLoginError,
    animateAppEnter,
    animatePageTransition,
    animateToastIn,
    animateToastOut,
    animateModalOpen,
    animateModalClose,
    animateNavClick,
    animateSidebarToggle,
    animateCounters,
    animateStatCards,
    animateTableRows,
    animateAvatarUpdate,
    attachRippleToButtons,
    attachCardHoverEffects,
    attachInputEffects,
    onModuleRendered,
    init,
  };
})();
