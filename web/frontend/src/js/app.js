/* ═══════════════════════════════════════════════════════════════════════════
   app.js — SPA Router, Login handler, Global utilities
   ═══════════════════════════════════════════════════════════════════════════ */

const App = (() => {

  // ─── Active Module State ───────────────────────────────────────────────────
  let activeModule = 'dashboard';
  function getCurrentModule() {
    return activeModule;
  }

  // ─── Humanización de Errores Técnicos y PostgreSQL ─────────────────────────
  function humanizeErrorMessage(rawMsg) {
    if (!rawMsg || typeof rawMsg !== 'string') return 'Ocurrió un error inesperado al procesar la solicitud.';
    const str = rawMsg.trim();

    // 1. Violación de restricción NOT NULL en PostgreSQL
    if (/null value in column ["']?([^"'\s]+)["']?.*violates not-null constraint/i.test(str)) {
      const colMatch = str.match(/null value in column ["']?([^"'\s]+)["']?.*violates not-null constraint/i);
      const col = colMatch ? colMatch[1].toLowerCase() : '';
      const colDict = {
        fecha_inicio: 'La fecha de inicio de vigencia es obligatoria.',
        fecha_fin: 'La fecha de terminación o fin es obligatoria.',
        fecha: 'La fecha es obligatoria.',
        numero_documento: 'El número de documento de identidad es obligatorio.',
        documento: 'El número de documento de identidad es obligatorio.',
        cedula: 'La cédula de ciudadanía es obligatoria.',
        nombres: 'El nombre del servidor público es obligatorio.',
        apellidos: 'Los apellidos del servidor público son obligatorios.',
        apellidos_nombres: 'El nombre completo del servidor público es obligatorio.',
        cargo: 'El cargo del servidor público es obligatorio.',
        dependencia: 'La dependencia institucional es obligatoria.',
        tipo_solicitud: 'El tipo de solicitud es obligatorio.',
        modalidad: 'La modalidad laboral es obligatoria.',
        horario: 'El esquema de horario es obligatorio.',
        numero_consecutivo: 'El número consecutivo oficial es obligatorio.'
      };
      if (colDict[col]) return colDict[col];
      return `El campo obligatorio "${col.replace(/_/g, ' ')}" no puede estar vacío.`;
    }

    // 2. Violación de restricción UNIQUE en PostgreSQL
    if (/duplicate key value violates unique constraint/i.test(str) || /unique constraint/i.test(str)) {
      if (/cedula|documento/i.test(str)) return 'Ya existe un servidor público registrado con este documento de identidad.';
      if (/correo|email/i.test(str)) return 'Ya existe un usuario institucional registrado con este correo electrónico.';
      if (/consecutivo/i.test(str)) return 'Ya existe un registro con este número consecutivo oficial.';
      return 'Ya existe un registro con estos mismos datos en el sistema.';
    }

    // 3. Violación de llave foránea (Foreign Key)
    if (/violates foreign key constraint/i.test(str)) {
      return 'El servidor público o registro relacionado no existe o no se encuentra activo.';
    }

    // 4. Violación de CHECK constraint
    if (/violates check constraint/i.test(str)) {
      return 'Uno de los valores ingresados no cumple con el formato o los límites permitidos.';
    }

    // 5. Errores de red o conexión
    if (/failed to fetch/i.test(str) || /networkerror/i.test(str)) {
      return 'No fue posible conectarse con el servidor. Verifique su conexión de red.';
    }

    // 6. Limpieza de prefijos técnicos si la causa interna fue SQL
    if (str.includes('violates') || str.includes('constraint') || str.includes('relation "')) {
      return 'Por favor verifique los campos obligatorios del formulario.';
    }

    return str;
  }

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

    const finalMessage = type === 'error' ? humanizeErrorMessage(message) : message;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${finalMessage}</span>`;
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

  // ─── Validación Universal de Formularios & Resaltado en Rojo ─────────────────
  function markFieldInvalid(fieldOrId, message) {
    if (!fieldOrId) return;

    let el = null;
    if (typeof fieldOrId === 'string') {
      el = document.getElementById(fieldOrId);
      if (!el) {
        try { el = document.querySelector(fieldOrId); } catch (_) {}
      }
      if (!el) {
        el = document.querySelector(`[name="${fieldOrId}"], .${fieldOrId}`);
      }
    } else if (fieldOrId instanceof HTMLElement) {
      el = fieldOrId;
    }

    if (!el) {
      if (message) showToast(message, 'error');
      return;
    }

    // Si el campo pertenece a una pestaña oculta, cambiar automáticamente a esa pestaña
    const tabPane = el.closest('.form-tab-pane, .tab-pane, [data-tab-content]');
    if (tabPane && (!tabPane.classList.contains('active') || tabPane.style.display === 'none')) {
      const tabId = tabPane.id;
      if (typeof EmployeesModule !== 'undefined' && EmployeesModule.switchFormTab && tabId.startsWith('tab-form-')) {
        EmployeesModule.switchFormTab(tabId);
      } else if (typeof HorariosModule !== 'undefined' && HorariosModule.switchFormTab && tabId.startsWith('tab-hor-')) {
        HorariosModule.switchFormTab(tabId);
      } else {
        const tabBtn = document.querySelector(`button[data-tab="${tabId}"], .form-wizard-tab[data-tab="${tabId}"], button[onclick*="${tabId}"]`);
        if (tabBtn) {
          tabBtn.click();
        } else {
          tabPane.classList.add('active');
          tabPane.style.display = 'block';
        }
      }
    }

    // Elemento visible que recibirá foco y borde rojo (soporta flatpickr altInput)
    const targetInput = (el._flatpickr && el._flatpickr.altInput) ? el._flatpickr.altInput : el;

    el.classList.add('input-invalid');
    targetInput.classList.add('input-invalid');

    const group = el.closest('.form-group, .floating-group, .adv-filter-field');
    if (group) group.classList.add('has-error');

    // Desplazar suavemente hasta el campo y enfocar
    setTimeout(() => {
      try {
        targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {
        targetInput.scrollIntoView(true);
      }
      try {
        targetInput.focus();
      } catch (_) {}
    }, 90);

    if (message) {
      showToast(message, 'error');
    }

    // Quitar el rojo automáticamente cuando el usuario ingrese o modifique el valor
    const clearHandler = () => {
      el.classList.remove('input-invalid');
      targetInput.classList.remove('input-invalid');
      if (group) group.classList.remove('has-error');
      el.removeEventListener('input', clearHandler);
      el.removeEventListener('change', clearHandler);
      targetInput.removeEventListener('input', clearHandler);
      targetInput.removeEventListener('change', clearHandler);
    };

    el.addEventListener('input', clearHandler);
    el.addEventListener('change', clearHandler);
    targetInput.addEventListener('input', clearHandler);
    targetInput.addEventListener('change', clearHandler);
  }

  // ─── Modal System & Dirty Form Tracking ─────────────────────────────────────
  let modalCloseSeq = 0;
  let modalIsEditForm = false;
  let modalInitialSnapshot = null;

  function captureModalFormSnapshot() {
    const body = document.getElementById('modal-body');
    if (!body) return '';
    const controls = body.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="hidden"]), select, textarea');
    const values = [];
    controls.forEach(ctrl => {
      if (ctrl.id === 'modal-search') return;
      if (ctrl.type === 'checkbox' || ctrl.type === 'radio') {
        values.push(`${ctrl.name || ctrl.id}:${ctrl.checked}`);
      } else {
        values.push(`${ctrl.name || ctrl.id}:${ctrl.value}`);
      }
    });
    return values.join('|:::|');
  }

  function isModalDirty() {
    if (!modalIsEditForm || modalInitialSnapshot === null) return false;
    const current = captureModalFormSnapshot();
    return current !== modalInitialSnapshot;
  }

  function markFormClean() {
    modalIsEditForm = false;
    modalInitialSnapshot = null;
    removeUnsavedChangesPrompt();
  }

  function removeUnsavedChangesPrompt() {
    document.getElementById('modal-unsaved-confirm')?.remove();
  }

  function showUnsavedChangesPrompt() {
    const box = document.querySelector('.modal-box');
    if (!box) return;
    if (document.getElementById('modal-unsaved-confirm')) return;

    if (typeof FX !== 'undefined' && FX.Sound && FX.Sound.warning) {
      FX.Sound.warning();
    }

    const promptEl = document.createElement('div');
    promptEl.id = 'modal-unsaved-confirm';
    promptEl.className = 'modal-unsaved-backdrop';
    promptEl.innerHTML = `
      <div class="modal-unsaved-card">
        <div class="modal-unsaved-icon-wrap" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 class="modal-unsaved-title">¿Descartar cambios sin guardar?</h3>
        <p class="modal-unsaved-desc">
          Has realizado modificaciones en este formulario. Si decides salir ahora, <strong>se perderán todos los cambios no guardados</strong>.
        </p>
        <div class="modal-unsaved-actions">
          <button type="button" class="btn btn-secondary" id="btn-unsaved-stay">
            Continuar Editando
          </button>
          <button type="button" class="btn btn-danger" id="btn-unsaved-discard">
            Salir sin Guardar
          </button>
        </div>
      </div>
    `;

    box.appendChild(promptEl);

    document.getElementById('btn-unsaved-stay')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeUnsavedChangesPrompt();
    });

    document.getElementById('btn-unsaved-discard')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      markFormClean();
      closeModal(true);
    });
  }

  function openModal(title, bodyHtml, footerButtons = [], customClass = '') {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');
    const box = document.querySelector('.modal-box');
    if (!overlay || !titleEl || !bodyEl || !footerEl) return;

    removeUnsavedChangesPrompt();

    // Detectar si el modal corresponde a un formulario de edición
    const lowerTitle = String(title || '').toLowerCase();
    const hasEditAction = Array.isArray(footerButtons) && footerButtons.some(b =>
      (b.cls && b.cls.includes('btn-gold')) ||
      (b.text && (b.text.toLowerCase().includes('guardar cambios') || b.text.toLowerCase().includes('actualizar')))
    );
    modalIsEditForm = lowerTitle.includes('editar') || hasEditAction;
    modalInitialSnapshot = null;

    modalCloseSeq++; // Invalidate any running closeModal animation callbacks

    if (window.anime && window.anime.remove) {
      window.anime.remove(overlay);
      if (box) window.anime.remove(box);
    }

    const isAlreadyOpen = overlay.style.display === 'flex' && window.getComputedStyle(overlay).opacity > 0.1;

    if (box) {
      box.className = 'modal-box' + (customClass ? ' ' + customClass : '');
      box.style.maxWidth = '';
      box.style.width = '';
      box.style.transform = 'none';
      box.style.opacity = '1';
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    footerEl.innerHTML = '';
    footerButtons.forEach(btn => {
      const el = document.createElement('button');
      const cls = btn.cls || btn.type || 'btn-secondary';
      el.className = `btn ${cls}`;
      if (btn.id) el.id = btn.id;
      if (btn.html) {
        el.innerHTML = btn.html;
      } else {
        el.textContent = btn.text || btn.label || '';
      }
      el.onclick = btn.action || btn.onClick;
      footerEl.appendChild(el);
    });

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Inicializar selectores de fecha mejorados (Flatpickr institucional) y UX de formularios
    setTimeout(() => {
      initDatePickers(bodyEl);
      initFormUX(bodyEl);
      if (modalIsEditForm) {
        modalInitialSnapshot = captureModalFormSnapshot();
      }
    }, 140);

    // FX: animated modal open
    if (typeof FX !== 'undefined') {
      FX.animateModalOpen(overlay, box, isAlreadyOpen);
    } else {
      overlay.style.opacity = '1';
    }
  }

  const DATE_INPUT_SELECTOR = 'input[type="date"]:not(.flatpickr-input-custom), input[data-datepicker]:not(.flatpickr-input-custom), input.datepicker-input:not(.flatpickr-input-custom), input.filter-datepicker:not(.flatpickr-input-custom), input.input-date:not(.flatpickr-input-custom)';

  function ensureCalendarCustomUI(inst) {
    if (!inst || !inst.calendarContainer) return;

    // 1. Botón 'X' institucional estilizado para cerrar el calendario
    const monthsBar = inst.calendarContainer.querySelector('.flatpickr-months');
    if (monthsBar) {
      let closeBtn = inst.calendarContainer.querySelector('.flatpickr-custom-close');
      const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'flatpickr-custom-close';
        closeBtn.title = 'Cerrar calendario';
        closeBtn.setAttribute('aria-label', 'Cerrar calendario');
        closeBtn.innerHTML = closeSvg;
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          inst.close();
        });
        monthsBar.appendChild(closeBtn);
      } else {
        closeBtn.innerHTML = closeSvg;
      }
    }

    // 2. Selector Desplegable de Año institucional (rango 1920 a 2050, texto amarillo #FFF200)
    const currentMonthEl = inst.calendarContainer.querySelector('.flatpickr-current-month');
    const numInput = currentMonthEl ? currentMonthEl.querySelector('.numInputWrapper') : null;
    let yearSelect = null;
    if (currentMonthEl && numInput) {
      numInput.style.display = 'none';

      yearSelect = currentMonthEl.querySelector('.flatpickr-year-dropdown');
      const currentY = inst.currentYear || (inst.latestSelectedDateObj ? inst.latestSelectedDateObj.getFullYear() : new Date().getFullYear());

      if (!yearSelect) {
        yearSelect = document.createElement('select');
        yearSelect.className = 'flatpickr-year-dropdown';
        yearSelect.setAttribute('aria-label', 'Seleccionar año');
        yearSelect.title = 'Seleccionar año';

        const minYear = 1920;
        const maxYear = 2050;
        let optionsHtml = '';
        for (let y = minYear; y <= maxYear; y++) {
          optionsHtml += `<option value="${y}" ${y === currentY ? 'selected' : ''}>${y}</option>`;
        }
        yearSelect.innerHTML = optionsHtml;
        yearSelect.value = currentY.toString();

        yearSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          const newY = parseInt(e.target.value, 10);
          if (!isNaN(newY)) {
            inst.changeYear(newY);
          }
        });

        numInput.parentNode.insertBefore(yearSelect, numInput.nextSibling);
        inst._customYearSelect = yearSelect;
      } else {
        if (yearSelect.value !== currentY.toString()) {
          yearSelect.value = currentY.toString();
        }
        inst._customYearSelect = yearSelect;
      }
    }

    // 3. Eliminar flechas apiladas de navegación por solicitud del usuario
    if (currentMonthEl) {
      const oldNav = currentMonthEl.querySelector('.flatpickr-stacked-nav');
      if (oldNav) oldNav.remove();
    }
    const anyOldNav = inst.calendarContainer.querySelector('.flatpickr-stacked-nav');
    if (anyOldNav) anyOldNav.remove();

    // 4. Selector de Mes: Ajuste exacto de ancho con medición precisa canvas
    const monthSelect = inst.calendarContainer.querySelector('.flatpickr-monthDropdown-months');
    if (monthSelect) {
      monthSelect.title = 'Seleccionar mes';
      monthSelect.setAttribute('aria-label', 'Seleccionar mes');

      const adjustWidth = () => {
        const selectedOpt = monthSelect.options[monthSelect.selectedIndex];
        const monthText = selectedOpt ? selectedOpt.text.trim() : '';
        if (monthText) {
          if (!ensureCalendarCustomUI._canvas) {
            ensureCalendarCustomUI._canvas = document.createElement('canvas');
          }
          const ctx = ensureCalendarCustomUI._canvas.getContext('2d');
          ctx.font = '800 1.3rem Merriweather, Georgia, serif';
          const measured = Math.ceil(ctx.measureText(monthText).width);
          // Ancho cómodo y espacioso para que ningún mes quede apretado
          monthSelect.style.width = Math.max(measured + 12, 64) + 'px';
        }
      };

      adjustWidth();

      if (document.fonts && document.fonts.ready && !monthSelect._hasFontReadyListener) {
        monthSelect._hasFontReadyListener = true;
        document.fonts.ready.then(() => adjustWidth());
      }

      if (!monthSelect._hasAutoWidthListener) {
        monthSelect._hasAutoWidthListener = true;
        monthSelect.addEventListener('change', () => {
          setTimeout(() => {
            adjustWidth();
            ensureCalendarCustomUI(inst);
          }, 0);
        });
      }
    }

    // 4. Pie de acciones rápidas (Hoy / Limpiar)
    if (!inst.calendarContainer.querySelector('.flatpickr-custom-footer')) {
      const footer = document.createElement('div');
      footer.className = 'flatpickr-custom-footer';
      footer.innerHTML = `
        <button type="button" class="fp-btn-today" title="Seleccionar fecha de hoy">Hoy</button>
        <button type="button" class="fp-btn-clear" title="Borrar fecha seleccionada">Limpiar</button>
      `;
      footer.querySelector('.fp-btn-today').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inst.setDate(new Date(), true);
        inst.close();
      });
      footer.querySelector('.fp-btn-clear').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inst.clear();
        inst.close();
      });
      inst.calendarContainer.appendChild(footer);
    }
  }

  function positionCalendarSmartly(inst, customElement) {
    if (!inst || !inst.calendarContainer) return;

    // Elemento ancla: Siempre priorizar altInput visible generado por Flatpickr
    const target = customElement || inst.altInput || inst._positionElement || inst.input;
    if (!target) return;

    // Garantizar que toda la estructura (incluyendo footer con botones Hoy y Limpiar) esté inyectada
    ensureCalendarCustomUI(inst);

    const cal = inst.calendarContainer;
    const targetRect = target.getBoundingClientRect();
    if (targetRect.width === 0 && targetRect.height === 0) return;

    // Medición exacta y robusta para garantizar que toda la grilla y el pie queden dentro del viewport
    const calHeight = Math.max(cal.offsetHeight || 0, cal.scrollHeight || 0, 465);
    const calWidth = Math.max(cal.offsetWidth || 0, 364);
    const vpWidth = window.innerWidth || document.documentElement.clientWidth;
    const vpHeight = window.innerHeight || document.documentElement.clientHeight;

    const spaceBelow = vpHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    // Decisión de apertura vertical:
    // 1. Si cabe abajo con holgura (al menos calHeight + 10px), abrir abajo.
    // 2. Si no cabe abajo pero sí arriba (al menos calHeight + 10px), abrir arriba.
    // 3. Si no cabe completo en ninguno de los dos, abrir en el lado que tenga MAYOR espacio disponible.
    let openAbove = false;
    if (spaceBelow >= calHeight + 10) {
      openAbove = false;
    } else if (spaceAbove >= calHeight + 10) {
      openAbove = true;
    } else {
      openAbove = (spaceAbove >= spaceBelow);
    }

    let top = openAbove ? (targetRect.top - calHeight - 4) : (targetRect.bottom + 4);

    // Clamping estricto en el viewport:
    // NUNCA permitir que el pie del calendario (con los botones 'Hoy' y 'Limpiar')
    // quede cortado fuera de la pantalla.
    const maxTop = Math.max(8, vpHeight - calHeight - 10);
    const minTop = 8;

    if (top > maxTop) top = maxTop;
    if (top < minTop) top = minTop;

    // Si la altura del calendario supera la altura del viewport disponible
    if (calHeight > vpHeight - 16) {
      cal.style.maxHeight = (vpHeight - 16) + 'px';
      cal.style.overflowY = 'auto';
      top = 8;
    } else {
      cal.style.maxHeight = '';
      cal.style.overflowY = '';
    }

    // Posicionamiento horizontal inteligente
    let left = targetRect.left;
    const maxLeft = vpWidth - calWidth - 8;
    const minLeft = 8;
    if (left > maxLeft) left = maxLeft;
    if (left < minLeft) left = minLeft;

    // Al usar position: fixed !important en CSS, las coordenadas son directamente respecto al viewport
    cal.style.position = 'fixed';
    cal.style.top = Math.round(top) + 'px';
    cal.style.left = Math.round(left) + 'px';
    cal.style.right = 'auto';

    // Ajustar clases indicadoras de flecha (arriba / abajo)
    const isVisuallyAbove = (top + calHeight / 2) < targetRect.top;
    cal.classList.toggle('arrowTop', !isVisuallyAbove);
    cal.classList.toggle('arrowBottom', isVisuallyAbove);
  }

  // Listener global pasivo para reposicionar el calendario si el usuario hace scroll dentro de un modal
  if (typeof window !== 'undefined' && !window._flatpickrGlobalRepositionInit) {
    window._flatpickrGlobalRepositionInit = true;
    const repositionOpenPicker = () => {
      const openCal = document.querySelector('.flatpickr-calendar.open');
      if (openCal && openCal._flatpickrInstance) {
        positionCalendarSmartly(openCal._flatpickrInstance);
      }
    };
    window.addEventListener('scroll', repositionOpenPicker, { capture: true, passive: true });
    window.addEventListener('resize', repositionOpenPicker, { passive: true });
  }

  function initDatePickers(container = document) {
    if (typeof flatpickr === 'undefined') return;
    try {
      if (flatpickr.l10ns && flatpickr.l10ns.es) {
        flatpickr.localize(flatpickr.l10ns.es);
      }
      flatpickr.setDefaults({
        locale: (flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es',
        firstDayOfWeek: 1,
        weekNumbers: false
      });

      const inputs = [];
      if (container && container.matches && container.matches(DATE_INPUT_SELECTOR)) {
        inputs.push(container);
      } else if (container && container.querySelectorAll) {
        inputs.push(...container.querySelectorAll(DATE_INPUT_SELECTOR));
      }

      inputs.forEach(input => {
        if (input._flatpickr || input.classList.contains('flatpickr-input-custom') || (input.type === 'hidden' && input.classList.contains('flatpickr-input'))) return;
        const currentVal = input.value || '';
        const minVal = input.getAttribute('min') || undefined;
        const maxVal = input.getAttribute('max') || undefined;

        let baseClass = (input.className || 'form-input')
          .replace(/\bflatpickr-input\b/g, '')
          .replace(/\bflatpickr-input-custom\b/g, '')
          .replace(/\binput-date\b/g, '')
          .replace(/\bdatepicker-input\b/g, '')
          .replace(/\bfilter-datepicker\b/g, '')
          .trim();
        if (!baseClass.includes('form-input')) {
          baseClass += ' form-input';
        }
        const altClass = (baseClass + ' flatpickr-input-custom').trim();

        flatpickr(input, {
          locale: (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es',
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'd/m/Y',
          altInputClass: altClass,
          defaultDate: currentVal || null,
          minDate: minVal,
          maxDate: maxVal,
          allowInput: true,
          weekNumbers: false,
          disableMobile: true,
          monthSelectorType: 'dropdown',
          position: function(self, customElement) {
            positionCalendarSmartly(self, customElement);
          },
          onChange: function(selectedDates, dateStr) {
            input.value = dateStr;
            const group = input.closest('.form-group, .adv-filter-field, .filter-group, .floating-group');
            if (group) {
              if (dateStr) group.classList.add('is-floated');
              else group.classList.remove('is-floated');
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
          },
          onReady: function(selectedDates, dateStr, instance) {
            if (instance.calendarContainer) {
              instance.calendarContainer._flatpickrInstance = instance;
            }
            if (instance.altInput) {
              instance.altInput.placeholder = input.getAttribute('placeholder') || ' ';
              instance.altInput.setAttribute('autocomplete', 'off');
              instance.altInput.setAttribute('aria-label', input.getAttribute('aria-label') || 'Seleccionar fecha');
            }

            // Sincronización con etiquetas flotantes
            const group = input.closest('.form-group, .adv-filter-field, .filter-group, .floating-group');
            if (group) {
              if (currentVal || dateStr || input.value) {
                group.classList.add('is-floated');
              } else {
                group.classList.remove('is-floated');
              }
              if (instance.altInput && !instance.altInput._hasFloatListeners) {
                instance.altInput._hasFloatListeners = true;
                instance.altInput.addEventListener('focus', () => group.classList.add('is-focused', 'is-floated'));
                instance.altInput.addEventListener('blur', () => {
                  group.classList.remove('is-focused');
                  if (!input.value && (!instance.altInput || !instance.altInput.value)) {
                    group.classList.remove('is-floated');
                  }
                });
                instance.altInput.addEventListener('input', () => {
                  if (!input.value && (!instance.altInput || !instance.altInput.value)) {
                    group.classList.remove('is-floated');
                  } else {
                    group.classList.add('is-floated');
                  }
                });
              }
            }

            ensureCalendarCustomUI(instance);
          },
          onYearChange: function(selectedDates, dateStr, instance) {
            ensureCalendarCustomUI(instance);
            positionCalendarSmartly(instance);
          },
          onMonthChange: function(selectedDates, dateStr, instance) {
            ensureCalendarCustomUI(instance);
            positionCalendarSmartly(instance);
          },
          onOpen: function(selectedDates, dateStr, instance) {
            if (instance.calendarContainer) {
              instance.calendarContainer._flatpickrInstance = instance;
            }
            ensureCalendarCustomUI(instance);
            positionCalendarSmartly(instance);
            requestAnimationFrame(() => positionCalendarSmartly(instance));
            const group = input.closest('.form-group, .adv-filter-field, .filter-group, .floating-group');
            if (group) group.classList.add('is-focused', 'is-floated');
          },
          onClose: function(selectedDates, dateStr, instance) {
            const group = input.closest('.form-group, .adv-filter-field, .filter-group, .floating-group');
            if (group) {
              group.classList.remove('is-focused');
              if (!input.value) group.classList.remove('is-floated');
            }
          },
          onValueUpdate: function(selectedDates, dateStr, instance) {
            ensureCalendarCustomUI(instance);
            positionCalendarSmartly(instance);
          }
        });
      });
    } catch (e) {
      console.warn('[Flatpickr] Fallback to native datepicker:', e);
    }
  }


  /**
   * Inicializa la experiencia moderna de formularios institucional Talento360:
   * - Floating Labels automáticos y sincronización reactiva
   * - Teclado y navegación optimizada (enterkeyhint, navegación secuencial sin envíos accidentales)
   */
  /**
   * Mejora dinámica universal de botones de agregar (+)
   * Asegura que cualquier botón con clase .btn-action-icon-add o .btn-action-add-circle
   * tenga su etiqueta animada (.btn-action-add-label) para expandirse con animación al hacer hover.
   */
  function enhanceAddButtons(root = document) {
    if (!root || !root.querySelectorAll) return;
    const btns = root.querySelectorAll ? root.querySelectorAll('.btn-action-icon-add, .btn-action-add-circle') : [];
    btns.forEach(btn => {
      if (btn.querySelector('.btn-action-add-label')) return;
      let labelText = '';
      const id = (btn.id || '').toLowerCase();
      const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || '').toLowerCase();
      if (id.includes('servidor') || title.includes('servidor')) labelText = 'Nuevo Servidor';
      else if (id.includes('horario') || title.includes('horario')) labelText = 'Nuevo Horario';
      else if (id.includes('viatico') || title.includes('viático') || title.includes('viatico')) labelText = 'Nuevo Viático';
      else if (btn.classList.contains('btn-action-export-pdf') || id.includes('pdf') || title.includes('pdf')) labelText = 'Exportar PDF';
      else if (title.includes('vigencia')) labelText = 'Nueva Vigencia';
      else if (title.includes('carpeta')) labelText = 'Nueva Carpeta';
      else if (title.includes('agregar') || title.includes('nuevo') || title.includes('crear')) labelText = 'Nuevo';

      if (labelText) {
        const span = document.createElement('span');
        span.className = 'btn-action-add-label';
        span.textContent = labelText;
        btn.appendChild(span);
      }
    });
  }

  // ─── Interceptor Global de Asignaciones Programáticas a .value ──────────────────
  // Garantiza que cuando un script asigna input.value = '...' en CUALQUIER formulario,
  // la etiqueta flotante (.is-floated) se active instantáneamente sin pisar el texto.
  (function installGlobalFloatingLabelInterceptor() {
    function patchSetter(proto) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (!desc || !desc.set || desc.set._isPatched) return;
      const originalSet = desc.set;
      const patchedSet = function(val) {
        originalSet.call(this, val);
        try {
          const group = this.closest ? this.closest('.floating-group, .form-group, .adv-filter-field, .filter-group') : null;
          if (group) {
            const hasVal = (val !== undefined && val !== null && String(val).trim() !== '');
            if (hasVal) {
              group.classList.add('is-floated');
            } else if (typeof document !== 'undefined' && document.activeElement !== this && !this._flatpickr) {
              group.classList.remove('is-floated');
            }
          }
        } catch (_) {}
      };
      patchedSet._isPatched = true;
      Object.defineProperty(proto, 'value', {
        ...desc,
        set: patchedSet
      });
    }
    try {
      if (typeof HTMLInputElement !== 'undefined') patchSetter(HTMLInputElement.prototype);
      if (typeof HTMLTextAreaElement !== 'undefined') patchSetter(HTMLTextAreaElement.prototype);
      if (typeof HTMLSelectElement !== 'undefined') patchSetter(HTMLSelectElement.prototype);
    } catch (_) {}
  })();

  function initFormUX(container = document) {
    if (!container) return;
    try {
      const groups = container.querySelectorAll('.form-group, .adv-filter-field, .filter-group');
      groups.forEach(group => {
        // Exclusiones: tarjetas de modalidad, toggles de destino, upload zone, excel dropzones, headers
        if (
          group.querySelector('.modalidad-cards-selector') ||
          group.querySelector('.dest-toggle-group') ||
          group.querySelector('.file-upload-zone') ||
          group.querySelector('.excel-dropzone') ||
          group.querySelector('#vpkg-dropzone') ||
          group.querySelector('.form-section-header') ||
          group.querySelector('.badge-servidor-vinculado') ||
          group.querySelector('#ef-periodos-container') ||
          group.querySelector('#ef-celulares-container')
        ) {
          return;
        }

        const label = group.querySelector('.form-label, .filter-label, label');
        const control = group.querySelector('.flatpickr-input-custom, .form-input:not([type="hidden"]), .filter-input, .filter-select, .form-select, select, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
        if (!label || !control) return;

        // Activar grupo flotante
        group.classList.add('floating-group');
        if (control.matches('select')) {
          group.classList.add('is-select');
        } else if (!control.getAttribute('placeholder')) {
          control.setAttribute('placeholder', ' ');
        }

        const updateState = () => {
          let hasVal = false;
          if (control.matches('select')) {
            hasVal = Boolean(control.value && String(control.value).trim() !== '');
          } else {
            const fp = control._flatpickr || control.previousElementSibling?._flatpickr;
            if (fp) {
              hasVal = Boolean(control.value || (fp.selectedDates && fp.selectedDates.length > 0));
            } else {
              hasVal = Boolean(control.value && String(control.value).trim() !== '');
            }
          }

          if (hasVal) {
            group.classList.add('is-floated');
          } else if (document.activeElement !== control && (!control._flatpickr || document.activeElement !== control._flatpickr.altInput)) {
            group.classList.remove('is-floated');
          }
        };

        // Estado inicial
        updateState();

        // Listeners de foco e interacción
        if (!control._hasFloatListeners) {
          control._hasFloatListeners = true;
          control.addEventListener('focus', () => {
            group.classList.add('is-focused', 'is-floated');
          });
          control.addEventListener('blur', () => {
            group.classList.remove('is-focused');
            updateState();
          });
          control.addEventListener('input', updateState);
          control.addEventListener('change', updateState);
        }
      });

      // Configuración de navegación por teclado y enterkeyhint
      const activeInputs = Array.from(container.querySelectorAll(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )).filter(el => el.offsetParent !== null); // Solo visibles

      activeInputs.forEach((inp, idx) => {
        if (!inp.getAttribute('enterkeyhint')) {
          if (idx === activeInputs.length - 1) {
            inp.setAttribute('enterkeyhint', 'done');
          } else {
            inp.setAttribute('enterkeyhint', 'next');
          }
        }

        if (!inp._hasEnterNavListener) {
          inp._hasEnterNavListener = true;
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              if (inp.tagName === 'TEXTAREA') return; // Permitir salto de línea en áreas de texto
              // Evitar envíos accidentales o cierre de modal
              e.preventDefault();
              e.stopPropagation();

              // Buscar el contenedor activo (pestaña activa o modal)
              const scope = inp.closest('.form-tab-pane.active') || inp.closest('.form-grid') || container;
              const scopeInputs = Array.from(scope.querySelectorAll(
                'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
              )).filter(el => el.offsetParent !== null && !el.classList.contains('input-locked-servidor'));

              const currentIdx = scopeInputs.indexOf(inp);
              if (currentIdx !== -1 && currentIdx < scopeInputs.length - 1) {
                const nextField = scopeInputs[currentIdx + 1];
                if (nextField._flatpickr && nextField._flatpickr.altInput) {
                  nextField._flatpickr.altInput.focus();
                } else {
                  nextField.focus();
                }
              } else {
                // Si es el último campo visible, enfocar el botón de continuar o guardar
                const nextActionBtn = document.querySelector('#modal-footer #btn-wizard-next, #modal-footer .btn-primary, #modal-footer .btn-gold');
                if (nextActionBtn) nextActionBtn.focus();
              }
            }
          });
        }
      });
    } catch (err) {
      console.warn('[Talento360] initFormUX notice:', err);
    }
  }

  /**
   * Refresca las etiquetas flotantes tras cambios programáticos (autocompletados, catálogos)
   */
  function refreshFloatingLabels(container = document) {
    if (!container) return;
    try {
      const groups = container.querySelectorAll('.form-group, .floating-group, .adv-filter-field, .filter-group');
      groups.forEach(group => {
        if (
          group.querySelector('.modalidad-cards-selector') ||
          group.querySelector('.dest-toggle-group') ||
          group.querySelector('.file-upload-zone') ||
          group.querySelector('.excel-dropzone') ||
          group.querySelector('#vpkg-dropzone') ||
          group.querySelector('.form-section-header') ||
          group.querySelector('.badge-servidor-vinculado') ||
          group.querySelector('#ef-periodos-container') ||
          group.querySelector('#ef-celulares-container')
        ) {
          return;
        }
        const control = group.querySelector('.flatpickr-input-custom, .form-input:not([type="hidden"]), .filter-input, .filter-select, .form-select, select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
        if (!control) return;
        group.classList.add('floating-group');
        let hasVal = false;
        if (control.matches('select')) {
          hasVal = Boolean(control.value && String(control.value).trim() !== '');
          group.classList.add('is-select');
        } else {
          const fp = control._flatpickr || control.previousElementSibling?._flatpickr;
          if (fp) {
            hasVal = Boolean(control.value || (fp.selectedDates && fp.selectedDates.length > 0));
          } else {
            hasVal = Boolean(control.value && String(control.value).trim() !== '');
          }
        }
        if (hasVal) {
          group.classList.add('is-floated');
        } else if (typeof document !== 'undefined' && document.activeElement !== control && (!control._flatpickr || document.activeElement !== control._flatpickr.altInput)) {
          group.classList.remove('is-floated');
        }
      });
    } catch (_) {}
  }

  function closeModal(force = false) {
    if (force !== true && modalIsEditForm && isModalDirty()) {
      showUnsavedChangesPrompt();
      return;
    }

    markFormClean();

    const currentSeq = ++modalCloseSeq;
    const overlay = document.getElementById('modal-overlay');
    const box = document.querySelector('.modal-box');
    if (!overlay) return;

    document.querySelector('.modal-header-consecutivo')?.remove();

    if (box) {
      box.className = 'modal-box';
      box.style.maxWidth = '';
      box.style.width = '';
    }

    if (typeof FX !== 'undefined') {
      FX.animateModalClose(overlay, box, () => {
        if (modalCloseSeq !== currentSeq) return;
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
    'admin-errors': 'Centro de Errores e Incidentes',
    'admin-backups': 'Copias de Seguridad del Sistema',
    'admin-modules-unlock': 'Módulos del Sistema',
    dashboard: 'Dashboard',
    employees: 'Servidores Públicos',
    requests: 'Solicitudes de Vacaciones',
    'admin-requests': 'Solicitudes Administrativas',
    incapacidades: 'Incapacidades y Ausentismo Laboral',
    viaticos: 'Viáticos',
    horarios: 'Horarios y Modalidades',
    sst: 'Seguridad y Salud en el Trabajo (SST)',
    settings: 'Configuración',
    privacidad: 'Política de Tratamiento de Datos Personales',
    terminos: 'Términos y Condiciones de Uso',
    accesibilidad: 'Declaración de Accesibilidad Web',
  };

  const MODULE_ICONS = {
    'admin-errors': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'admin-backups': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    'admin-modules-unlock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    employees: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    requests: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'admin-requests': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    incapacidades: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    viaticos: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    horarios: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    sst: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    privacidad: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    terminos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    accesibilidad: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };

  const VALID_ROUTES = new Set([
    'admin-errors',
    'admin-backups',
    'admin-modules-unlock',
    'dashboard',
    'employees',
    'requests',
    'admin-requests',
    'incapacidades',
    'viaticos',
    'horarios',
    'sst',
    'settings',
    'privacidad',
    'terminos',
    'accesibilidad'
  ]);

  function getDefaultLandingRoute(user) {
    const scope = (typeof Auth !== 'undefined' && Auth.getRoleScope) ? Auth.getRoleScope(user) : 'all';
    if (scope === 'sst') return { module: 'sst', options: { tab: 'epidemiologico' } };
    if (scope === 'incapacidades') return { module: 'incapacidades', options: {} };
    if (scope === 'permisos') return { module: 'admin-requests', options: { tipo: 'permisos' } };
    if (scope === 'permisos_licencias') return { module: 'admin-requests', options: { tipo: 'permisos' } };

    if (typeof Auth !== 'undefined' && Auth.getUserModules) {
      const u = user || Auth.getUser();
      const mods = Auth.getUserModules(u);
      if (!mods.includes('*') && !mods.includes('all') && !mods.includes('dashboard')) {
        if (mods.includes('horarios')) return { module: 'horarios', options: {} };
        if (mods.includes('admin-backups') || mods.includes('backups')) return { module: 'admin-backups', options: {} };
        if (mods.length > 0) return { module: mods[0], options: {} };
      }
    }
    return { module: 'dashboard', options: {} };
  }

  function applyRoleSidebarAccess(user) {
    if (user && isUserAdmin(user)) {
      applyNavigationPermissions(user);
      return;
    }
    const scope = (typeof Auth !== 'undefined' && Auth.getRoleScope) ? Auth.getRoleScope(user) : 'all';
    const showLi = (id, visible) => {
      const el = document.getElementById(id);
      if (!el) return;
      const li = el.closest('li') || el;
      li.style.display = visible ? '' : 'none';
    };

    if (scope === 'all') {
      ['nav-dashboard', 'nav-employees', 'nav-requests', 'nav-admin-group', 'nav-permisos', 'nav-licencias', 'nav-incapacidades', 'nav-viaticos', 'nav-horarios', 'nav-sst-group', 'nav-sst-epidemiologico', 'nav-sst-epp', 'nav-sst-sociodemografico'].forEach(id => showLi(id, true));
      return;
    }

    // Ocultar módulos generales por defecto para roles específicos de submódulo
    ['nav-dashboard', 'nav-employees', 'nav-requests', 'nav-admin-group', 'nav-incapacidades', 'nav-viaticos', 'nav-horarios', 'nav-sst-group'].forEach(id => showLi(id, false));

    if (scope === 'sst') {
      showLi('nav-sst-group', true);
      showLi('nav-sst-epidemiologico', true);
      showLi('nav-sst-epp', true);
      showLi('nav-sst-sociodemografico', true);
      const sstGroupBtn = document.getElementById('nav-sst-group');
      const sstMenu = document.getElementById('sst-submenu');
      if (sstGroupBtn) sstGroupBtn.setAttribute('aria-expanded', 'true');
      if (sstMenu) sstMenu.setAttribute('aria-hidden', 'false');
    } else if (scope === 'incapacidades') {
      showLi('nav-incapacidades', true);
    } else if (scope === 'permisos') {
      showLi('nav-admin-group', true);
      showLi('nav-permisos', true);
      showLi('nav-licencias', false);
      expandAdminGroup();
    } else if (scope === 'permisos_licencias') {
      showLi('nav-admin-group', true);
      showLi('nav-permisos', true);
      showLi('nav-licencias', true);
      expandAdminGroup();
    }
  }

  async function navigate(module, options = {}) {
    let rawModule = String(module || '').replace(/^#\/?/, '').trim();

    // Detener auto-refresco del módulo de errores si se sale de él
    if (rawModule !== 'admin-errors' && typeof window !== 'undefined' && window.AdminErrorsModule && typeof window.AdminErrorsModule.stopAutoRefresh === 'function') {
      try { window.AdminErrorsModule.stopAutoRefresh(); } catch (_) {}
    }

    if (rawModule === 'admin-requests' && options.tipo === 'incapacidades') {
      return navigate('incapacidades');
    }

    // Restricción de navegación por rol específico (Sandra SST, Luis Incapacidades, Alejandro Permisos, Sebastian Permisos y Licencias)
    const alwaysAllowed = new Set(['settings', 'privacidad', 'terminos', 'accesibilidad']);
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      if (Auth.mustChangePassword && Auth.mustChangePassword()) {
        showMandatoryPasswordModal(Auth.getUser());
        return;
      }
      if (!alwaysAllowed.has(rawModule)) {
        const scope = Auth.getRoleScope ? Auth.getRoleScope() : 'all';
        if (scope === 'sst' && rawModule !== 'sst') {
          return navigate('sst', { tab: options.tab || 'epidemiologico' });
        }
        if (scope === 'incapacidades' && rawModule !== 'incapacidades') {
          return navigate('incapacidades');
        }
        if (scope === 'permisos') {
          if (rawModule !== 'admin-requests' || (options.tipo && options.tipo !== 'permisos')) {
            return navigate('admin-requests', { tipo: 'permisos' });
          }
        }
        if (scope === 'permisos_licencias' && rawModule !== 'admin-requests') {
          return navigate('admin-requests', { tipo: options.tipo || 'permisos' });
        }
      }
    }

    // 1. Si la ruta o módulo NO existe en las rutas válidas:
    // Mostrar inmediatamente la pantalla global 404 fuera del layout y sin tocar el módulo actual.
    if (!rawModule || !VALID_ROUTES.has(rawModule)) {
      if (typeof Error404Module !== 'undefined') {
        Error404Module.show(rawModule || '404', options.error);
      }
      return;
    }

    // 2. Ruta válida: ocultar overlay global 404 si estaba visible y asegurar visualización del app
    activeModule = rawModule;
    if (typeof Error404Module !== 'undefined') {
      Error404Module.hide();
    }

    // 2.1 Control de permisos por rol / módulo
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    const isAdmin = isUserAdmin(user);

    if (isAdmin) {
      if (rawModule === 'admin-modules-unlock') {
        const isElevated = (typeof Auth !== 'undefined' && Auth.isAdminElevated) ? Auth.isAdminElevated() : false;
        if (isElevated) {
          promptAdminUnlockedOptions();
        } else {
          promptAdminUnlock('dashboard');
        }
        return;
      }

      const isPermisos = (rawModule === 'admin-requests' && (!options || !options.tipo || options.tipo === 'permisos' || options.tipo === 'Permiso Laboral'));
      const technicalAdminRoutes = new Set(['dashboard', 'admin-errors', 'admin-backups', 'settings', 'privacidad', 'terminos', 'accesibilidad']);
      const isElevated = (typeof Auth !== 'undefined' && Auth.isAdminElevated) ? Auth.isAdminElevated() : false;

      if (!isPermisos && !technicalAdminRoutes.has(rawModule) && !isElevated) {
        // El administrador intenta acceder a módulos operativos sin haber confirmado su contraseña
        promptAdminUnlock(rawModule, options);
        return;
      }
    } else {
      // Para usuarios regulares: control granular de módulos
      if (rawModule === 'admin-errors' || rawModule === 'admin-modules-unlock') {
        showToast('Acceso restringido: módulo exclusivo para el administrador del sistema.', 'warning');
        const defaultRoute = getDefaultLandingRoute(user);
        navigate(defaultRoute.module, defaultRoute.options);
        return;
      }

      if (rawModule === 'admin-backups') {
        if (typeof Auth !== 'undefined' && Auth.hasModuleAccess && !Auth.hasModuleAccess('admin-backups')) {
          showToast('Acceso restringido: no tienes permisos asignados para copias de seguridad.', 'warning');
          const defaultRoute = getDefaultLandingRoute(user);
          navigate(defaultRoute.module, defaultRoute.options);
          return;
        }
      } else {
        const publicRoutes = ['settings', 'privacidad', 'terminos', 'accesibilidad'];
        if (!publicRoutes.includes(rawModule)) {
          if (typeof Auth !== 'undefined' && Auth.hasModuleAccess && !Auth.hasModuleAccess(rawModule)) {
            showToast('Acceso restringido: no tienes permisos asignados para acceder a este módulo.', 'warning');
            const defaultRoute = getDefaultLandingRoute(user);
            navigate(defaultRoute.module, defaultRoute.options);
            return;
          }
        }
      }
    }

    const appElement = document.getElementById('app');
    if (appElement && typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      appElement.style.setProperty('display', 'grid', 'important');
      const lsElement = document.getElementById('login-screen');
      if (lsElement) lsElement.style.setProperty('display', 'none', 'important');
    }

    const container = document.getElementById('module-container');
    const pageTitle = document.getElementById('page-title');
    const breadcrumbIcon = document.querySelector('.breadcrumb-icon');
    if (!container) return;

    // Update active nav
    document.querySelectorAll('.nav-item, .sidebar-settings-btn').forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });

    const activeNavBtn = document.getElementById(`nav-${rawModule}`);
    if (activeNavBtn) {
      activeNavBtn.classList.add('active');
      activeNavBtn.setAttribute('aria-current', 'page');
    }

    if (rawModule === 'admin-requests') {
      const tipoKey = (options && options.tipo) || 'permisos';
      const navAdminPermisos = document.getElementById('nav-admin-permisos');
      const isStandAloneVisible = navAdminPermisos && (navAdminPermisos.closest('li') ? window.getComputedStyle(navAdminPermisos.closest('li')).display !== 'none' : true);

      if (tipoKey === 'permisos' && isStandAloneVisible) {
        navAdminPermisos.classList.add('active');
        navAdminPermisos.setAttribute('aria-current', 'page');
      } else {
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
      }
    } else if (rawModule === 'sst') {
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
      const navBtn = document.getElementById(`nav-${rawModule}`);
      if (navBtn) {
        navBtn.classList.add('active');
        navBtn.setAttribute('aria-current', 'page');
      }
    }

    let title = MODULE_TITLES[rawModule] || rawModule;
    let iconSvg = MODULE_ICONS[rawModule] || MODULE_ICONS.dashboard;

    if (rawModule === 'admin-requests') {
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
    } else if (rawModule === 'sst') {
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
    document.getElementById('app')?.setAttribute('data-current-module', rawModule);

    const targetParams = [];
    if (options.tab) targetParams.push(`tab=${encodeURIComponent(options.tab)}`);
    if (options.tipo) targetParams.push(`tipo=${encodeURIComponent(options.tipo)}`);
    if (options.year) targetParams.push(`year=${encodeURIComponent(options.year)}`);
    if (options.pkg) targetParams.push(`pkg=${encodeURIComponent(options.pkg)}`);
    const targetHash = rawModule + (targetParams.length ? `?${targetParams.join('&')}` : '');
    const currentHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    if (currentHash !== targetHash) {
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', `#${targetHash}`);
      } else {
        window.location.hash = targetHash;
      }
    }

    const renderSelectedModule = async () => {
      try {
        switch (rawModule) {
          case 'admin-errors':
            if (typeof AdminErrorsModule !== 'undefined') await AdminErrorsModule.render(container);
            break;
          case 'admin-backups':
            if (typeof AdminBackupsModule !== 'undefined') await AdminBackupsModule.render(container);
            break;
          case 'dashboard':      await DashboardModule.render(container); break;
          case 'employees':     await EmployeesModule.render(container); break;
          case 'requests':      await RequestsModule.render(container); break;
          case 'admin-requests': {
            const tipoKey = options.tipo || 'permisos';
            await AdminRequestsModule.render(container, tipoKey);
            const navAdminPermisos = document.getElementById('nav-admin-permisos');
            const isStandAloneVisible = navAdminPermisos && (navAdminPermisos.closest('li') ? window.getComputedStyle(navAdminPermisos.closest('li')).display !== 'none' : true);

            if (tipoKey === 'permisos' && isStandAloneVisible) {
              navAdminPermisos.classList.add('active');
              navAdminPermisos.setAttribute('aria-current', 'page');
            } else {
              const subnavMap = { permisos: 'nav-permisos', incapacidades: 'nav-incapacidades', licencias: 'nav-licencias' };
              const activeSubBtn = document.getElementById(subnavMap[tipoKey] || 'nav-permisos');
              if (activeSubBtn) {
                activeSubBtn.classList.add('active');
                activeSubBtn.setAttribute('aria-current', 'page');
              }
              const adminGroupBtn = document.getElementById('nav-admin-group');
              if (adminGroupBtn) adminGroupBtn.classList.add('active');
              expandAdminGroup();
            }
            break;
          }
          case 'incapacidades': await IncapacidadesModule.render(container); break;
          case 'viaticos':      await ViaticosModule.render(container, options); break;
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
          case 'privacidad':
          case 'terminos':
          case 'accesibilidad':
            if (typeof LegalModule !== 'undefined') {
              await LegalModule.render(container, rawModule);
            }
            break;
          default:
            if (typeof Error404Module !== 'undefined') {
              Error404Module.show(rawModule, options.error);
            }
            return;
        }
      } catch (err) {
        console.error('[Talento 360] Error renderizando módulo:', err);
        container.innerHTML = `<div class="module-enter"><div class="card" style="padding: 24px; text-align: center;"><p style="color:var(--color-danger); font-weight:700;">Error al cargar el módulo</p><p style="color:var(--text-muted); font-size:0.9rem;">${err.message}</p></div></div>`;
      }
    };

    // FX: page transition
    if (typeof FX !== 'undefined') {
      FX.animatePageTransition(container, async () => {
        await renderSelectedModule();
        enhanceAddButtons(container);
        initFormUX(container);
        refreshFloatingLabels(container);
        FX.onModuleRendered(container);
        container.scrollTop = 0;
      });
    } else {
      await renderSelectedModule();
      enhanceAddButtons(container);
      initFormUX(container);
      refreshFloatingLabels(container);
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

  // ─── AUD-012: Form Draft Preservation & In-Place Re-authentication ──────────
  let inMemoryDraft = null;
  let isReauthenticating = false;

  function captureActiveFormDraft() {
    try {
      const modalBody = document.getElementById('modal-body');
      const modalOverlay = document.getElementById('modal-overlay');
      const modalTitle = document.getElementById('modal-title');
      const isModalOpen = modalOverlay && (modalOverlay.style.display === 'flex' || (typeof window !== 'undefined' && window.getComputedStyle && window.getComputedStyle(modalOverlay).display === 'flex'));

      const container = (isModalOpen && modalBody) ? modalBody : document.getElementById('main-content');
      if (!container) return null;

      const fields = container.querySelectorAll('input, textarea, select');
      if (!fields || fields.length === 0) return null;

      const draftValues = {};
      let hasData = false;

      fields.forEach((field, index) => {
        const type = (field.type || '').toLowerCase();
        const name = field.name || field.id || `field_${index}`;

        // Strictly exclude passwords, hidden tokens, file inputs
        if (type === 'password' || type === 'file') return;
        if (name.toLowerCase().includes('password') || name.toLowerCase().includes('token') || name.toLowerCase().includes('secret') || name.toLowerCase().includes('csrf')) return;

        let val = null;
        if (type === 'checkbox') {
          val = field.checked;
          hasData = true;
        } else if (type === 'radio') {
          if (field.checked) {
            val = field.value;
            hasData = true;
          }
        } else {
          val = field.value;
          if (val && typeof val === 'string' && val.trim().length > 0) hasData = true;
        }

        if (val !== null && val !== undefined) {
          draftValues[name] = {
            value: val,
            id: field.id || null,
            name: field.name || null,
            tagName: field.tagName.toLowerCase(),
            type: type
          };
        }
      });

      if (!hasData) return null;

      const draft = {
        timestamp: Date.now(),
        module: activeModule,
        isModal: !!isModalOpen,
        modalTitle: isModalOpen && modalTitle ? modalTitle.textContent : null,
        values: draftValues
      };

      inMemoryDraft = draft;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('t360_form_draft', JSON.stringify(draft));
        }
      } catch (_) {}

      return draft;
    } catch (err) {
      console.warn('[Draft] Error capturando borrador:', err);
      return null;
    }
  }

  function restoreFormDraft(targetDraft) {
    try {
      let draft = targetDraft || inMemoryDraft;
      if (!draft && typeof sessionStorage !== 'undefined') {
        try {
          const raw = sessionStorage.getItem('t360_form_draft');
          if (raw) draft = JSON.parse(raw);
        } catch (_) {}
      }

      if (!draft || !draft.values || Object.keys(draft.values).length === 0) return false;

      const modalBody = document.getElementById('modal-body');
      const modalOverlay = document.getElementById('modal-overlay');
      const isModalOpen = modalOverlay && (modalOverlay.style.display === 'flex' || (typeof window !== 'undefined' && window.getComputedStyle && window.getComputedStyle(modalOverlay).display === 'flex'));
      const container = (isModalOpen && modalBody) ? modalBody : document.getElementById('main-content');
      if (!container) return false;

      let restoredCount = 0;
      Object.keys(draft.values).forEach(key => {
        const item = draft.values[key];
        let field = null;
        if (item.id) {
          const safeId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(item.id) : item.id.replace(/["'\\]/g, '\\$&');
          field = container.querySelector(`#${safeId}`);
        }
        if (!field && item.name) {
          const safeName = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(item.name) : item.name.replace(/["'\\]/g, '\\$&');
          field = container.querySelector(`[name="${safeName}"]`);
        }

        if (field) {
          if (item.type === 'checkbox') {
            field.checked = !!item.value;
          } else if (item.type === 'radio') {
            if (field.value === item.value) field.checked = true;
          } else {
            field.value = item.value;
          }
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          restoredCount++;
        }
      });

      if (restoredCount > 0) {
        try { refreshFloatingLabels(container); } catch (_) {}
        showToast(`Se restauraron ${restoredCount} campo(s) del borrador previo.`, 'info');
        clearFormDraft();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Draft] Error restaurando borrador:', err);
      return false;
    }
  }

  function clearFormDraft() {
    inMemoryDraft = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('t360_form_draft');
        sessionStorage.removeItem('talento360_form_draft');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('t360_form_draft');
        localStorage.removeItem('talento360_form_draft');
      }
    } catch (_) {}
  }

  function checkAndRestoreDraft() {
    try {
      let draft = inMemoryDraft;
      if (!draft && typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('t360_form_draft');
        if (raw) draft = JSON.parse(raw);
      }
      if (draft && draft.values && Object.keys(draft.values).length > 0) {
        if (draft.module === activeModule) {
          restoreFormDraft(draft);
        }
      }
    } catch (_) {}
  }

  function promptReauthentication(options = {}) {
    if (isReauthenticating) {
      const existing = document.getElementById('reauth-dialog-overlay');
      if (existing) {
        const pwd = existing.querySelector('#reauth-password');
        if (pwd) pwd.focus();
        return;
      }
    }
    isReauthenticating = true;

    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const prefillUser = user.username || user.email || (function() {
      try {
        const u = JSON.parse(localStorage.getItem('h360_user') || '{}');
        return u.username || u.email || '';
      } catch (_) { return ''; }
    })() || '';

    const overlay = document.createElement('div');
    overlay.id = 'reauth-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Reautenticación requerida');
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 100000; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 16px;';

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); color: var(--text-primary, #1e293b); border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); max-width: 440px; width: 100%; overflow: hidden; border: 1px solid var(--border-color, #e2e8f0);">
        <div style="background: linear-gradient(135deg, #005387 0%, #003659 100%); padding: 22px 24px; color: #fff; text-align: center;">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #ffffff;">Sesión Expirada</h3>
          <p style="margin: 6px 0 0; font-size: 0.875rem; color: rgba(255,255,255,0.85);">
            Tus datos ingresados se encuentran protegidos. Ingresa tu contraseña para continuar sin perder tu trabajo.
          </p>
        </div>

        <form id="reauth-form" style="padding: 24px;" novalidate>
          <div id="reauth-error" style="display: none; padding: 10px 14px; margin-bottom: 16px; border-radius: 8px; background: #fee2e2; color: #991b1b; font-size: 0.85rem; font-weight: 500;"></div>

          <div style="margin-bottom: 16px;">
            <label for="reauth-username" style="display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #64748b); margin-bottom: 6px;">
              Usuario Institucional o Correo
            </label>
            <input type="text" id="reauth-username" autocomplete="username" placeholder="Ingresa tu correo o usuario institucional" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1.5px solid var(--border-color, #cbd5e1); background: var(--bg-surface, #ffffff); color: var(--text-primary, #0f172a); font-weight: 600; font-size: 0.95rem; box-sizing: border-box; outline: none; transition: border-color 0.2s;" />
          </div>

          <div style="margin-bottom: 22px;">
            <label for="reauth-password" style="display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #64748b); margin-bottom: 6px;">
              Contraseña
            </label>
            <input type="password" id="reauth-password" required autocomplete="current-password" placeholder="Ingresa tu contraseña institucional" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1.5px solid var(--border-color, #cbd5e1); background: var(--bg-surface, #ffffff); color: var(--text-primary, #0f172a); box-sizing: border-box; font-size: 0.95rem; outline: none; transition: border-color 0.2s;" />
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" id="reauth-btn-cancel" class="btn btn-secondary" style="padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cerrar Sesión
            </button>
            <button type="submit" id="reauth-btn-submit" class="btn btn-primary" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; background: #005387; color: #fff; border: none; display: flex; align-items: center; gap: 8px;">
              <span>Reanudar Sesión</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const userInput = overlay.querySelector('#reauth-username');
    if (userInput && prefillUser) {
      userInput.value = prefillUser;
    }

    const pwdInput = overlay.querySelector('#reauth-password');
    const errEl = overlay.querySelector('#reauth-error');
    const form = overlay.querySelector('#reauth-form');
    const cancelBtn = overlay.querySelector('#reauth-btn-cancel');
    const submitBtn = overlay.querySelector('#reauth-btn-submit');

    if (userInput) {
      userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (pwdInput) pwdInput.focus();
        }
      });
    }

    if (userInput && !userInput.value) {
      setTimeout(() => userInput.focus(), 80);
    } else if (pwdInput) {
      setTimeout(() => pwdInput.focus(), 80);
    }

    function cleanupOverlay() {
      isReauthenticating = false;
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    cancelBtn.addEventListener('click', () => {
      cleanupOverlay();
      const unlockOverlay = document.getElementById('admin-unlock-dialog-overlay');
      if (unlockOverlay && unlockOverlay.parentNode) {
        unlockOverlay.parentNode.removeChild(unlockOverlay);
      }
      isAdminUnlocking = false;

      if (typeof Auth !== 'undefined' && Auth.clear) Auth.clear();
      showLogin();
      showToast('Sesión finalizada. Inicie sesión nuevamente.', 'info');
      if (options && typeof options.onCancel === 'function') {
        options.onCancel();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredUser = (userInput?.value || '').trim() || prefillUser;
      const pwd = pwdInput ? pwdInput.value : '';

      if (!enteredUser) {
        if (errEl) {
          errEl.textContent = 'Por favor ingresa tu usuario institucional o correo electrónico.';
          errEl.style.display = 'block';
        }
        if (userInput) userInput.focus();
        return;
      }

      if (!pwd) {
        if (errEl) {
          errEl.textContent = 'Por favor ingresa tu contraseña institucional.';
          errEl.style.display = 'block';
        }
        if (pwdInput) pwdInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verificando...</span>';
      }
      if (errEl) errEl.style.display = 'none';

      try {
        const res = await API.login(enteredUser, pwd);
        if (res && res.token && res.user) {
          if (res.user) {
            res.user.role = sanitizeRole(res.user.role);
            if (!res.user.jobTitle) {
              res.user.jobTitle = resolveJobTitle(res.user);
            }
          }
          Auth.save(res.token, res.user);
          cleanupOverlay();
          showToast('Sesión reanudada con éxito.', 'success');

          // Restaurar borrador de formulario si está presente
          restoreFormDraft();

          if (options && typeof options.onSuccess === 'function') {
            options.onSuccess(res);
          }
        } else {
          throw new Error('Respuesta de autenticación inválida.');
        }
      } catch (authErr) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Reanudar Sesión</span>';
        }
        if (errEl) {
          errEl.textContent = authErr.message || 'Contraseña incorrecta. Por favor intenta de nuevo.';
          errEl.style.display = 'block';
        }
        if (pwdInput) {
          pwdInput.value = '';
          pwdInput.focus();
        }
      }
    });
  }

  // ─── Desbloqueo de Módulos para Administrador Técnico ───────────────────────
  let isAdminUnlocking = false;

  function promptAdminUnlock(targetModule = 'dashboard', targetOptions = {}) {
    if (isAdminUnlocking) {
      const pwd = document.getElementById('admin-unlock-password');
      if (pwd) pwd.focus();
      return;
    }
    isAdminUnlocking = true;

    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const adminEmail = user.username || user.email || 'alejoleo2022@gmail.com';
    const adminName = user.nombre || user.name || 'Alejandro León';
    const initials = (adminName || 'A').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AL';

    const overlay = document.createElement('div');
    overlay.id = 'admin-unlock-dialog-overlay';
    overlay.className = 'admin-unlock-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Desbloquear Módulos Institucionales');

    overlay.innerHTML = `
      <div class="admin-unlock-card">
        <div class="admin-unlock-top-accent"></div>
        <div class="admin-unlock-header">
          <div class="admin-unlock-top-row">
            <button type="button" class="admin-unlock-close-btn" id="admin-unlock-btn-close" title="Cerrar (Esc)" aria-label="Cerrar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="admin-unlock-icon-container">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 class="admin-unlock-title">Módulos del Sistema</h3>
          <p class="admin-unlock-subtitle">
            ¿Estás seguro de que deseas desbloquear los módulos operativos? Confirma tu contraseña institucional para continuar.
          </p>
        </div>

        <form id="admin-unlock-form" class="admin-unlock-body" novalidate>
          <div id="admin-unlock-error" class="admin-unlock-error-banner" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span class="admin-unlock-error-text"></span>
          </div>

          <div class="admin-unlock-user-card">
            <div class="admin-unlock-user-left">
              <div class="admin-unlock-avatar" title="${escHtml(adminName)}">
                <span>${escHtml(initials)}</span>
                <span class="admin-unlock-avatar-dot" title="Sesión activa"></span>
              </div>
              <div class="admin-unlock-user-details">
                <div class="admin-unlock-user-name">${escHtml(adminName)}</div>
                <div class="admin-unlock-user-email">${escHtml(adminEmail)}</div>
              </div>
            </div>
            <div class="admin-unlock-role-pill">
              <span>Admin</span>
            </div>
          </div>

          <div class="admin-unlock-field-group">
            <label for="admin-unlock-password" class="admin-unlock-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Contraseña de Login</span>
            </label>
            <div class="admin-unlock-input-wrap">
              <input
                type="password"
                id="admin-unlock-password"
                class="admin-unlock-input"
                required
                autocomplete="current-password"
                placeholder="Ingrese su contraseña institucional"
              />
              <button type="button" id="admin-unlock-pwd-toggle" class="admin-unlock-toggle-btn" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-open">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-closed" style="display: none;">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <div class="admin-unlock-advisory">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>Esta confirmación desbloqueará temporalmente los módulos operativos (Servidores, Horarios, Viáticos y SST).</span>
            </div>
          </div>

          <div class="admin-unlock-actions">
            <button type="button" id="admin-unlock-btn-cancel" class="btn-unlock-cancel">
              Cancelar
            </button>
            <button type="submit" id="admin-unlock-btn-submit" class="btn-unlock-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
              </svg>
              <span>Desbloquear Módulos</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const pwdInput = overlay.querySelector('#admin-unlock-password');
    const toggleBtn = overlay.querySelector('#admin-unlock-pwd-toggle');
    const eyeOpen = toggleBtn ? toggleBtn.querySelector('.eye-open') : null;
    const eyeClosed = toggleBtn ? toggleBtn.querySelector('.eye-closed') : null;
    const errEl = overlay.querySelector('#admin-unlock-error');
    const form = overlay.querySelector('#admin-unlock-form');
    const cancelBtn = overlay.querySelector('#admin-unlock-btn-cancel');
    const closeBtn = overlay.querySelector('#admin-unlock-btn-close');
    const submitBtn = overlay.querySelector('#admin-unlock-btn-submit');
    const cardEl = overlay.querySelector('.admin-unlock-card');

    if (pwdInput) {
      setTimeout(() => pwdInput.focus(), 120);
    }

    if (toggleBtn && pwdInput && eyeOpen && eyeClosed) {
      toggleBtn.addEventListener('click', () => {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          eyeOpen.style.display = 'none';
          eyeClosed.style.display = 'block';
        } else {
          pwdInput.type = 'password';
          eyeOpen.style.display = 'block';
          eyeClosed.style.display = 'none';
        }
      });
    }

    let keydownHandler = null;

    function cleanup() {
      isAdminUnlocking = false;
      if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
      }
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function handleCancel() {
      cleanup();
      const current = activeModule || 'admin-errors';
      const technicalAdminRoutes = new Set(['dashboard', 'admin-errors', 'admin-backups', 'settings', 'privacidad', 'terminos', 'accesibilidad']);
      if (!technicalAdminRoutes.has(current)) {
        navigate('admin-errors');
      }
    }

    cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });

    keydownHandler = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', keydownHandler);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = pwdInput ? pwdInput.value.trim() : '';
      if (!pwd) {
        if (errEl) {
          const errText = errEl.querySelector('.admin-unlock-error-text') || errEl;
          errText.textContent = 'Por favor ingrese su contraseña de login institucional.';
          errEl.style.display = 'flex';
        }
        if (cardEl) {
          cardEl.classList.remove('shake');
          void cardEl.offsetWidth;
          cardEl.classList.add('shake');
        }
        if (pwdInput) pwdInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Verificando...</span>
        `;
      }
      if (errEl) errEl.style.display = 'none';

      try {
        const res = await API.verifyPassword(adminEmail, pwd);
        if (res && res.valid) {
          cleanup();
          if (typeof Auth !== 'undefined' && Auth.setAdminElevated) {
            Auth.setAdminElevated(true);
          }
          applyNavigationPermissions(user);
          showToast('Módulos operativos desbloqueados exitosamente.', 'success');
          navigate(targetModule || 'dashboard', targetOptions || {});
        } else {
          throw new Error((res && res.error) || 'Contraseña incorrecta.');
        }
      } catch (err) {
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn && !Auth.isLoggedIn()) {
          cleanup();
          return;
        }
        if (errEl) {
          const errText = errEl.querySelector('.admin-unlock-error-text') || errEl;
          errText.textContent = err.message || 'Contraseña incorrecta. Por favor intente nuevamente.';
          errEl.style.display = 'flex';
        }
        if (cardEl) {
          cardEl.classList.remove('shake');
          void cardEl.offsetWidth;
          cardEl.classList.add('shake');
        }
        if (pwdInput) {
          pwdInput.value = '';
          pwdInput.focus();
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
            <span>Desbloquear Módulos</span>
          `;
        }
      }
    });
  }

  function promptAdminUnlockedOptions() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};
    const adminEmail = user.username || user.email || 'alejoleo2022@gmail.com';
    const adminName = user.nombre || user.name || 'Alejandro León';
    const initials = (adminName || 'A').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AL';

    // Limpiar overlays previos si existen
    const existing = document.getElementById('admin-unlock-dialog-overlay');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const overlay = document.createElement('div');
    overlay.id = 'admin-unlock-dialog-overlay';
    overlay.className = 'admin-unlock-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Gestión de Módulos del Sistema');

    overlay.innerHTML = `
      <div class="admin-unlock-card">
        <div class="admin-unlock-top-accent" style="background: linear-gradient(90deg, #0284c7 0%, #0369a1 50%, #0284c7 100%);"></div>
        <div class="admin-unlock-header" style="background: radial-gradient(circle at 50% -10%, rgba(2, 132, 199, 0.30) 0%, transparent 65%), linear-gradient(145deg, #075985 0%, #0284c7 52%, #0369a1 100%); border-bottom: 2px solid rgba(2, 132, 199, 0.45);">
          <div class="admin-unlock-top-row">
            <button type="button" class="admin-unlock-close-btn" id="admin-unlocked-btn-close" title="Cerrar (Esc)" aria-label="Cerrar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="admin-unlock-icon-container" style="background: rgba(255, 255, 255, 0.20); border-color: rgba(255, 255, 255, 0.45); box-shadow: 0 0 20px rgba(2, 132, 199, 0.35);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
          </div>
          <h3 class="admin-unlock-title">Módulos del Sistema</h3>
          <p class="admin-unlock-subtitle">
            Acceso completo habilitado a todos los módulos y submódulos institucionales.
          </p>
        </div>

        <div class="admin-unlock-body">
          <div class="admin-unlock-user-card">
            <div class="admin-unlock-user-left">
              <div class="admin-unlock-avatar" title="${escHtml(adminName)}" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                <span>${escHtml(initials)}</span>
                <span class="admin-unlock-avatar-dot" title="Sesión activa"></span>
              </div>
              <div class="admin-unlock-user-details">
                <div class="admin-unlock-user-name">${escHtml(adminName)}</div>
                <div class="admin-unlock-user-email">${escHtml(adminEmail)}</div>
              </div>
            </div>
            <div class="admin-unlock-role-pill" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; border-color: rgba(2, 132, 199, 0.35);">
              <span>Admin</span>
            </div>
          </div>

          <div class="admin-unlock-advisory" style="background: rgba(2, 132, 199, 0.08); border-color: rgba(2, 132, 199, 0.35); color: #0369a1; margin-top: 0; margin-bottom: 14px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #0284c7;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Actualmente cuentas con permisos activos en los módulos operativos del sistema:</span>
          </div>

          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 20px;">
            <span style="font-size: 0.78rem; font-weight: 700; background: rgba(2, 132, 199, 0.10); color: #0369a1; padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(2, 132, 199, 0.25);">✓ Servidores Públicos</span>
            <span style="font-size: 0.78rem; font-weight: 700; background: rgba(2, 132, 199, 0.10); color: #0369a1; padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(2, 132, 199, 0.25);">✓ Horarios</span>
            <span style="font-size: 0.78rem; font-weight: 700; background: rgba(2, 132, 199, 0.10); color: #0369a1; padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(2, 132, 199, 0.25);">✓ Viáticos</span>
            <span style="font-size: 0.78rem; font-weight: 700; background: rgba(2, 132, 199, 0.10); color: #0369a1; padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(2, 132, 199, 0.25);">✓ Seguridad y Salud (SST)</span>
          </div>

          <div class="admin-unlock-actions">
            <button type="button" id="admin-unlocked-btn-lock" class="btn-unlock-cancel" style="color: #b91c1c; border-color: rgba(239, 68, 68, 0.45);">
              Bloquear Módulos Ahora
            </button>
            <button type="button" id="admin-unlocked-btn-continue" class="btn-unlock-submit">
              <span>Continuar al Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeOverlay = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    document.getElementById('admin-unlocked-btn-close')?.addEventListener('click', closeOverlay);
    document.getElementById('admin-unlocked-btn-continue')?.addEventListener('click', () => {
      closeOverlay();
      navigate('dashboard');
    });
    document.getElementById('admin-unlocked-btn-lock')?.addEventListener('click', () => {
      closeOverlay();
      if (typeof Auth !== 'undefined' && Auth.setAdminElevated) {
        Auth.setAdminElevated(false);
      }
      applyNavigationPermissions(user);
      showToast('Módulos institucionales bloqueados. Se requerirá contraseña para reingresar.', 'info');
      navigate('admin-errors');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  // ─── Login & App Views ──────────────────────────────────────────────────────
  function showLogin() {
    if (typeof window !== 'undefined' && window.AdminErrorsModule && typeof window.AdminErrorsModule.stopAutoRefresh === 'function') {
      try { window.AdminErrorsModule.stopAutoRefresh(); } catch (_) {}
    }

    // Limpiar diálogos flotantes u overlays residuales en document.body
    const unlockOverlay = document.getElementById('admin-unlock-dialog-overlay');
    if (unlockOverlay && unlockOverlay.parentNode) {
      unlockOverlay.parentNode.removeChild(unlockOverlay);
    }
    isAdminUnlocking = false;

    const reauthOverlay = document.getElementById('reauth-dialog-overlay');
    if (reauthOverlay && reauthOverlay.parentNode) {
      reauthOverlay.parentNode.removeChild(reauthOverlay);
    }
    isReauthenticating = false;

    closeModal();

    document.querySelectorAll('.admin-unlock-overlay, #admin-unlock-dialog-overlay, #reauth-dialog-overlay').forEach(el => {
      try { el.remove(); } catch (_) {}
    });

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
      try { Settings.resetToDefaults(); } catch (_) {}
    }

    const ls = document.getElementById('login-screen');
    if (ls) ls.style.setProperty('display', 'flex', 'important');
    const app = document.getElementById('app');
    if (app) app.style.setProperty('display', 'none', 'important');
    // Re-trigger login animation when returning to login
    requestAnimationFrame(() => {
      if (typeof FX !== 'undefined' && FX.animateLoginIn) FX.animateLoginIn();
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
    { id: 'white', name: 'Blanco Puro', bg: '#FFFFFF' },
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

  function hexToRgba(hex, alpha = 0.18) {
    if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(255, 255, 255, ${alpha})`;
  }

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 227, g: 36, b: 49 };
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length === 6) {
      return {
        r: parseInt(c.substring(0, 2), 16) || 0,
        g: parseInt(c.substring(2, 4), 16) || 0,
        b: parseInt(c.substring(4, 6), 16) || 0,
      };
    }
    return { r: 227, g: 36, b: 49 };
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Calcula el color de texto más legible y de alto contraste según el avatar y el tema
  function getAccessibleTextColor(hexColor, isDark = false) {
    if (!hexColor) return isDark ? '#f87171' : '#E32431';
    const rgb = hexToRgb(hexColor);
    const lum = getLuminance(rgb.r, rgb.g, rgb.b);

    if (isDark) {
      // Fondo oscuro institucional (~#0b1329, luminancia ~0.015)
      const bgLum = 0.015;
      const ratio = getContrastRatio(lum, bgLum);

      // Si el avatar es negro puro (#000000) o excesivamente oscuro
      if (lum < 0.08 || ratio < 3.2) {
        return '#f8fafc'; // Se proyecta blanco nítido
      }
      // Si el contraste es bajo contra fondo oscuro, se aclara conservando el matiz
      if (ratio < 4.5) {
        const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * 0.45));
        const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * 0.45));
        const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * 0.45));
        return `rgb(${r}, ${g}, ${b})`;
      }
      return hexColor;
    } else {
      // Fondo claro institucional (~#ffffff, luminancia 1.0)
      const bgLum = 1.0;
      const ratio = getContrastRatio(lum, bgLum);

      // Si el avatar es blanco (#ffffff) o excesivamente claro (lum > 0.82 o ratio < 2.5:1)
      // Como solicitó explícitamente el usuario: si se llega a poner un avatar blanco, aparecerá en negro
      if (lum > 0.82 || ratio < 2.5) {
        return '#0f172a'; // Negro institucional / pizarra profundo
      }
      // Si es un color claro como amarillo puro o pastel con contraste < 4.5:1 en fondo blanco
      if (ratio < 4.5) {
        const factor = 0.58;
        const r = Math.round(rgb.r * factor);
        const g = Math.round(rgb.g * factor);
        const b = Math.round(rgb.b * factor);
        return `rgb(${r}, ${g}, ${b})`;
      }
      return hexColor;
    }
  }  function getAvatarTextColor(hexColor) {
    if (!hexColor) return '#ffffff';
    const rgb = hexToRgb(hexColor);
    const lum = getLuminance(rgb.r, rgb.g, rgb.b);
    // Si el fondo del avatar es muy claro (ej: blanco #ffffff o colores pálidos con luminancia > 0.65), la letra DEBE ser oscura
    if (lum > 0.65) {
      return '#0f172a';
    }
    return '#ffffff';
  }

  function getRoleTextColor(hexColor) {
    if (!hexColor) return '#ffffff';
    const rgb = hexToRgb(hexColor);
    const lum = getLuminance(rgb.r, rgb.g, rgb.b);
    // Si el avatar es blanco (#ffffff) o muy claro, blanco tiene un contraste perfecto contra el fondo oscuro del perfil
    if (lum > 0.8) {
      return '#ffffff';
    }
    // Si es un color muy oscuro (por ejemplo azul oscuro o verde bosque que se perdería en el fondo oscuro)
    if (lum < 0.15) {
      const factor = 0.55;
      const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor));
      const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor));
      const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor));
      return `rgb(${r}, ${g}, ${b})`;
    }
    return hexColor;
  }

  function applyAvatarTheming(color) {
    let avatarColor = color;
    if (!avatarColor) {
      const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
      avatarColor = user ? getAvatarColor(user.username) : AVATAR_PALETTES[0].bg;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (typeof Settings !== 'undefined' && Settings.get && Settings.get('theme') === 'dark');

    const nameColor = getAccessibleTextColor(avatarColor, isDark);
    const nameColorLight = getAccessibleTextColor(avatarColor, false);
    const nameColorDark = getAccessibleTextColor(avatarColor, true);
    const avatarTextColor = getAvatarTextColor(avatarColor);
    const roleColor = getRoleTextColor(avatarColor);

    // ─── Generación de Fondo Oscuro y Acentos con el mismo Matiz del Avatar ───
    const rgb = hexToRgb(avatarColor);
    const isWhite = (rgb.r > 240 && rgb.g > 240 && rgb.b > 240);
    const isVeryDark = (rgb.r < 30 && rgb.g < 30 && rgb.b < 30);

    let cardBg, cardBgHover, cardBorder, cardBorderHover, cardHighlight, cardGlow;

    if (isWhite) {
      cardBg = 'linear-gradient(135deg, #1e242c 0%, #0f141a 100%)';
      cardBgHover = 'linear-gradient(135deg, #2b333e 0%, #161c24 100%)';
      cardBorder = 'rgba(255, 255, 255, 0.28)';
      cardBorderHover = 'rgba(255, 255, 255, 0.55)';
      cardHighlight = 'rgba(255, 255, 255, 0.35)';
      cardGlow = 'rgba(255, 255, 255, 0.18)';
    } else if (isVeryDark) {
      cardBg = 'linear-gradient(135deg, #1a202c 0%, #0d1117 100%)';
      cardBgHover = 'linear-gradient(135deg, #252e3e 0%, #121822 100%)';
      cardBorder = 'rgba(255, 255, 255, 0.22)';
      cardBorderHover = 'rgba(255, 255, 255, 0.45)';
      cardHighlight = 'rgba(255, 255, 255, 0.25)';
      cardGlow = 'rgba(255, 255, 255, 0.14)';
    } else {
      // Mucho más oscuro pero manteniendo la saturación y tonalidad viva del avatar
      const rTop = Math.round(rgb.r * 0.22);
      const gTop = Math.round(rgb.g * 0.22);
      const bTop = Math.round(rgb.b * 0.22);

      const rBot = Math.round(rgb.r * 0.09);
      const gBot = Math.round(rgb.g * 0.09);
      const bBot = Math.round(rgb.b * 0.09);

      const rHoverTop = Math.round(rgb.r * 0.30);
      const gHoverTop = Math.round(rgb.g * 0.30);
      const bHoverTop = Math.round(rgb.b * 0.30);

      const rHoverBot = Math.round(rgb.r * 0.14);
      const gHoverBot = Math.round(rgb.g * 0.14);
      const bHoverBot = Math.round(rgb.b * 0.14);

      cardBg = `linear-gradient(135deg, rgb(${rTop}, ${gTop}, ${bTop}) 0%, rgb(${rBot}, ${gBot}, ${bBot}) 100%)`;
      cardBgHover = `linear-gradient(135deg, rgb(${rHoverTop}, ${gHoverTop}, ${bHoverTop}) 0%, rgb(${rHoverBot}, ${gHoverBot}, ${bHoverBot}) 100%)`;
      cardBorder = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`;
      cardBorderHover = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.68)`;
      cardHighlight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`;
      cardGlow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`;
    }

    // Variables globales en :root para que apliquen a TODO el software
    const rootEl = document.documentElement;
    rootEl.style.setProperty('--user-avatar-color', avatarColor);
    rootEl.style.setProperty('--user-avatar-text-color', avatarTextColor);
    rootEl.style.setProperty('--user-name-color', nameColor);
    rootEl.style.setProperty('--user-name-color-light', nameColorLight);
    rootEl.style.setProperty('--user-name-color-dark', nameColorDark);
    rootEl.style.setProperty('--user-role-color', roleColor);
    rootEl.style.setProperty('--user-card-bg', cardBg);
    rootEl.style.setProperty('--user-card-bg-hover', cardBgHover);
    rootEl.style.setProperty('--user-card-border', cardBorder);
    rootEl.style.setProperty('--user-card-border-hover', cardBorderHover);
    rootEl.style.setProperty('--user-card-highlight', cardHighlight);
    rootEl.style.setProperty('--user-card-glow', cardGlow);

    const sidebarUserEl = document.getElementById('sidebar-user');
    if (sidebarUserEl) {
      sidebarUserEl.style.setProperty('--avatar-accent-color', roleColor);
      sidebarUserEl.style.setProperty('--user-role-color', roleColor);
      sidebarUserEl.style.setProperty('--user-card-bg', cardBg);
      sidebarUserEl.style.setProperty('--user-card-bg-hover', cardBgHover);
      sidebarUserEl.style.setProperty('--user-card-border', cardBorder);
      sidebarUserEl.style.setProperty('--user-card-border-hover', cardBorderHover);
      sidebarUserEl.style.setProperty('--user-card-highlight', cardHighlight);
      sidebarUserEl.style.setProperty('--user-card-glow', cardGlow);
    }

    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
      avatarEl.style.background = avatarColor;
      avatarEl.style.color = avatarTextColor;
    }

    const topAvatarEl = document.getElementById('topbar-avatar');
    if (topAvatarEl) {
      topAvatarEl.style.background = avatarColor;
      topAvatarEl.style.color = avatarTextColor;
    }

    const roleEl = document.getElementById('user-role');
    if (roleEl) {
      roleEl.style.setProperty('color', roleColor, 'important');
    }

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      profileBtn.style.setProperty('color', roleColor);
    }
  }

  function sanitizeRole(role) {
    if (!role) return 'Administrador';
    const r = String(role).trim();
    if (r.toLowerCase() === 'administradora' || r.toLowerCase() === 'administrador') {
      return 'Administrador';
    }
    return r;
  }

  function isUserAdmin(user = {}) {
    const role = (user.role || '').toLowerCase();
    const uname = (user.username || '').toLowerCase();
    const mods = Array.isArray(user.modules) ? user.modules : ((typeof Auth !== 'undefined' && Auth.getUserModules) ? Auth.getUserModules(user) : []);
    return role === 'administrador' || role === 'admin' || uname === 'admin' || uname === 'admin@boyaca.gov.co' || uname === 'alejoleo2022@gmail.com' || mods.includes('*') || mods.includes('all');
  }

  function applyNavigationPermissions(user = {}) {
    const isAdmin = isUserAdmin(user);
    const scope = (typeof Auth !== 'undefined' && Auth.getRoleScope) ? Auth.getRoleScope(user) : 'all';
    const mods = (typeof Auth !== 'undefined' && Auth.getUserModules) ? Auth.getUserModules(user) : ['dashboard'];
    const hasAll = mods.includes('*') || mods.includes('all');

    const setVisibility = (id, isVisible) => {
      const el = document.getElementById(id);
      if (!el) return;
      const li = el.closest('li') || el;
      li.style.display = isVisible ? '' : 'none';
    };

    if (scope !== 'all') {
      setVisibility('li-admin-errors', false);
      setVisibility('li-admin-backups', false);
      setVisibility('li-admin-permisos', false);
      setVisibility('li-admin-modules-unlock', false);
      setVisibility('nav-admin-errors', false);
      setVisibility('nav-admin-backups', false);
      setVisibility('nav-admin-permisos', false);
      setVisibility('nav-settings', true);
      applyRoleSidebarAccess(user);
      return;
    }

    if (isAdmin) {
      // Para el Administrador técnico (alejoleo2022@gmail.com):
      setVisibility('li-nav-dashboard', true);
      setVisibility('nav-dashboard', true);
      setVisibility('li-admin-errors', true);
      setVisibility('li-admin-backups', true);
      setVisibility('li-admin-permisos', true);
      setVisibility('li-admin-modules-unlock', true);
      setVisibility('nav-admin-errors', true);
      setVisibility('nav-admin-backups', true);
      setVisibility('nav-admin-permisos', true);
      setVisibility('nav-settings', true);

      const isElevated = (typeof Auth !== 'undefined' && Auth.isAdminElevated) ? Auth.isAdminElevated() : false;
      const unlockBtn = document.getElementById('nav-admin-modules-unlock');
      const lockStatusEl = document.getElementById('admin-modules-lock-status');

      if (unlockBtn) {
        const iconEl = unlockBtn.querySelector('.nav-icon');
        if (isElevated) {
          unlockBtn.classList.add('is-unlocked');
          unlockBtn.setAttribute('title', 'Módulos del Sistema (Desbloqueados - Clic para opciones)');
          unlockBtn.setAttribute('data-tooltip', 'Módulos Desbloqueados');
          if (iconEl) {
            iconEl.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`;
          }
          if (lockStatusEl) {
            lockStatusEl.innerHTML = `<span class="lock-status-dot"></span><span class="lock-status-text">Desbloqueado</span>`;
          }
        } else {
          unlockBtn.classList.remove('is-unlocked');
          unlockBtn.setAttribute('title', 'Módulos del Sistema (Bloqueados - Ingrese contraseña para desbloquear)');
          unlockBtn.setAttribute('data-tooltip', 'Desbloquear Módulos');
          if (iconEl) {
            iconEl.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`;
          }
          if (lockStatusEl) {
            lockStatusEl.innerHTML = `<span class="lock-status-dot"></span><span class="lock-status-text">Bloqueado</span>`;
          }
        }
      }

      // Si el administrador está elevado con contraseña, se muestran los módulos operativos; de lo contrario, permanecen ocultos ("DE RESTO NO")
      const operationalNavs = [
        'nav-employees', 'nav-requests', 'nav-admin-group',
        'nav-permisos', 'nav-licencias', 'nav-incapacidades', 'nav-viaticos',
        'nav-horarios', 'nav-sst-group', 'nav-sst-epidemiologico', 'nav-sst-epp', 'nav-sst-sociodemografico'
      ];
      operationalNavs.forEach(id => setVisibility(id, isElevated));

    } else {
      // Para los demás usuarios (Angela, Doris, Bergenet, Blanca, etc.):
      // Ocultar las herramientas de administración técnica que no tengan asignadas
      const canAccessBackups = hasAll || mods.includes('admin-backups') || mods.includes('backups');
      setVisibility('li-admin-errors', false);
      setVisibility('li-admin-backups', canAccessBackups);
      setVisibility('li-admin-permisos', false);
      setVisibility('li-admin-modules-unlock', false);
      setVisibility('nav-admin-errors', false);
      setVisibility('nav-admin-backups', canAccessBackups);
      setVisibility('nav-admin-permisos', false);

      // Mostrar sus módulos funcionales según permisos
      const hasDashboard = hasAll || mods.includes('dashboard');
      setVisibility('li-nav-dashboard', hasDashboard);
      setVisibility('nav-dashboard', hasDashboard);
      setVisibility('nav-employees', hasAll || mods.includes('employees'));
      setVisibility('nav-requests', hasAll || mods.includes('requests'));
      setVisibility('nav-admin-group', hasAll || mods.includes('admin-requests'));
      setVisibility('nav-permisos', hasAll || mods.includes('admin-requests') || mods.includes('permisos'));
      setVisibility('nav-licencias', hasAll || mods.includes('admin-requests') || mods.includes('licencias'));
      setVisibility('nav-incapacidades', hasAll || mods.includes('incapacidades'));
      setVisibility('nav-viaticos', hasAll || mods.includes('viaticos'));
      setVisibility('nav-horarios', hasAll || mods.includes('horarios'));
      setVisibility('nav-sst-group', hasAll || mods.includes('sst'));
      setVisibility('nav-settings', true);
    }
  }

  function resolveJobTitle(user = {}) {
    if (user.jobTitle && String(user.jobTitle).trim()) {
      return String(user.jobTitle).trim();
    }
    const username = String(user.username || '').toLowerCase();
    const name = String(user.name || '').toLowerCase();
    const role = String(user.role || '').toLowerCase();
    const mods = Array.isArray(user.modules) ? user.modules : ((typeof Auth !== 'undefined' && Auth.getUserModules) ? Auth.getUserModules(user) : []);
    if (username.includes('sandra') || role === 'sst' || role.includes('sst')) {
      return 'Responsable de Seguridad y Salud en el Trabajo (SST)';
    }
    if (username.includes('luis') || role === 'incapacidades' || role.includes('incapacidad')) {
      return 'Responsable de Incapacidades y Ausentismo Laboral';
    }
    if (username.includes('sebastian') || (role.includes('permiso') && role.includes('licencia'))) {
      return 'Responsable de Permisos y Licencias Laborales';
    }
    if (username.includes('alejandro') || role === 'permisos') {
      return 'Responsable de Permisos Laborales';
    }
    if (role === 'administrador' || role === 'admin' || mods.includes('*') || mods.includes('all')) {
      return 'Administrador del Sistema';
    }
    if (mods.includes('employees')) return 'Gestión de Servidores Públicos';
    if (mods.includes('viaticos')) return 'Gestión de Viáticos';
    if (mods.includes('horarios') && (mods.includes('admin-backups') || mods.includes('backups'))) return 'Gestión de Respaldo y Horarios';
    if (mods.includes('horarios')) return 'Gestión de Horarios y Modalidades';
    if (mods.includes('admin-backups') || mods.includes('backups')) return 'Gestión de Copias de Seguridad';
    return 'Servidor Público';
  }

  function showApp() {
    const user = Auth.getUser();
    // Load per-user personalized preferences (theme, font, sound, etc.)
    if (typeof Settings !== 'undefined' && user && user.username) {
      try { Settings.loadForUser(user.username); } catch (e) { console.warn('[Settings] Error:', e); }
    }
    const ls = document.getElementById('login-screen');
    if (ls) ls.style.setProperty('display', 'none', 'important');
    const app = document.getElementById('app');
    if (app) app.style.setProperty('display', 'grid', 'important');

    try { applyRoleSidebarAccess(user); } catch (_) {}
    try { updateUserDisplay(user); } catch (e) { console.warn('[UserDisplay] Error:', e); }
    try { updateTopbarDateTime(); } catch (_) {}
    try { updateTopbarQuickControls(); } catch (_) {}
    // FX: animate app entry
    if (typeof FX !== 'undefined' && FX.animateAppEnter) {
      try { FX.animateAppEnter(); } catch (_) {}
      setTimeout(() => { if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.loginSuccess(); }, 100);
    }
  }

  function updateUserDisplay(user = {}) {
    const isAdmin = isUserAdmin(user);
    const name = user.name || (isAdmin ? 'Administrador' : 'Usuario');
    const initial = name.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(user.username);
    const avatarTextColor = getAvatarTextColor(avatarColor);
    const roleColor = getRoleTextColor(avatarColor);

    // Aplicar tema dinámico del recuadro de usuario según el color del avatar
    applyAvatarTheming(avatarColor);

    // Sidebar
    const nameEl = document.getElementById('user-name');
    const jobTitleEl = document.getElementById('user-job-title');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = name;
    if (jobTitleEl) {
      jobTitleEl.textContent = '';
      jobTitleEl.style.display = 'none';
    }
    if (roleEl) {
      const userArea = user.area || user.dependencia || (isAdmin ? 'Administración General' : 'Talento Humano');
      roleEl.textContent = userArea;
      roleEl.style.setProperty('color', roleColor, 'important');
    }
    if (avatarEl) {
      avatarEl.textContent = initial;
      avatarEl.style.background = avatarColor;
      avatarEl.style.color = avatarTextColor;
      if (typeof FX !== 'undefined') FX.animateAvatarUpdate();
    }

    // Topbar
    const topNameEl = document.getElementById('topbar-user-name');
    const topRoleEl = document.getElementById('topbar-role-badge');
    const topAvatarEl = document.getElementById('topbar-avatar');
    if (topNameEl) topNameEl.textContent = name;
    if (topRoleEl) {
      if (isAdmin) {
        topRoleEl.style.display = 'inline-flex';
        topRoleEl.textContent = 'Admin';
      } else {
        topRoleEl.style.display = 'none';
      }
    }
    if (topAvatarEl) {
      topAvatarEl.textContent = initial;
      topAvatarEl.style.background = avatarColor;
      topAvatarEl.style.color = avatarTextColor;
    }
// Aplicar filtrado dinámico de navegación según permisos de módulos
    applyNavigationPermissions(user);
  }

  // ─── User Profile Modal ────────────────────────────────────────────────────
  function openProfileModal() {
    const user = Auth.getUser();
    const isAdmin = isUserAdmin(user);
    const name = user.name || (isAdmin ? 'Administrador' : 'Usuario');
    const initial = (name || 'U').charAt(0).toUpperCase();
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
        <div class="profile-avatar-large" id="prof-avatar-preview" style="background:${currentAvatarColor}; color:${getAvatarTextColor(currentAvatarColor)};">${initial}</div>
        <div class="profile-header-info">
          <div class="profile-name-display">${escHtml(name)}</div>
          ${isAdmin ? '<span class="profile-role-pill">Administrador</span>' : ''}
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
      {
        text: 'Cancelar',
        cls: 'btn-secondary',
        action: () => {
          // Revertir vista previa en tiempo real al color guardado
          applyAvatarTheming(getAvatarColor(user.username));
          closeModal();
        }
      },
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
          previewAvatar.style.color = getAvatarTextColor(bg);
          // Actualizar en tiempo real el tono del recuadro del sidebar
          applyAvatarTheming(bg);

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
          previewAvatar.style.color = getAvatarTextColor(hex);
          // Actualizar en tiempo real el tono del recuadro del sidebar
          applyAvatarTheming(hex);

          swatchesContainer.querySelectorAll('.avatar-swatch').forEach(s => {
            s.classList.remove('active');
            s.innerHTML = '';
          });
        });
      }
    }

    document.getElementById('prof-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveProfile();
      }
    });

    passInputs.forEach(input => {
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveProfile();
        }
      });
    });
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
        applyAvatarTheming(currentAvatarColor);
      }

      updateUserDisplay(res.user);
      markFormClean();
      closeModal(true);
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
          clearFormDraft();
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

    // Actualizar contrastes accesibles del avatar y nombre del usuario según el nuevo tema
    try {
      applyAvatarTheming();
    } catch (_) {}
  }

  // ─── Recuperación de Contraseña y Cambio Obligatorio ────────────────────────
  function initPasswordRecoveryHandlers() {
    // 1. Enlace "¿Olvidaste tu contraseña?"
    const forgotLink = document.getElementById('link-forgot-password');
    const forgotModal = document.getElementById('modal-forgot-password');
    const forgotClose = document.getElementById('forgot-modal-close');
    const forgotCancel = document.getElementById('forgot-btn-cancel');
    const forgotForm = document.getElementById('form-forgot-password');
    const forgotEmail = document.getElementById('forgot-email');
    const forgotFeedback = document.getElementById('forgot-feedback');
    const forgotSubmitBtn = document.getElementById('forgot-btn-submit');

    const openForgotModal = (e) => {
      if (e) e.preventDefault();
      if (forgotFeedback) {
        forgotFeedback.style.display = 'none';
        forgotFeedback.className = 'recovery-feedback';
        forgotFeedback.textContent = '';
      }
      if (forgotEmail) {
        forgotEmail.value = '';
        forgotEmail.disabled = false;
      }
      if (forgotSubmitBtn) {
        forgotSubmitBtn.style.display = 'inline-flex';
        forgotSubmitBtn.disabled = false;
        const text = forgotSubmitBtn.querySelector('.btn-text');
        const loader = forgotSubmitBtn.querySelector('.btn-loader');
        if (text) text.style.display = 'inline-flex';
        if (loader) loader.style.display = 'none';
      }
      if (forgotModal) forgotModal.style.display = 'flex';
      setTimeout(() => { if (forgotEmail) forgotEmail.focus(); }, 150);
    };

    const closeForgotModal = () => {
      if (forgotModal) forgotModal.style.display = 'none';
    };

    if (forgotLink) forgotLink.addEventListener('click', openForgotModal);
    if (forgotClose) forgotClose.addEventListener('click', closeForgotModal);
    if (forgotCancel) forgotCancel.addEventListener('click', closeForgotModal);

    // Enviar solicitud de recuperación
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (forgotEmail?.value || '').trim();
        if (!email) {
          if (forgotFeedback) {
            forgotFeedback.className = 'recovery-feedback feedback-error';
            forgotFeedback.textContent = 'Por favor ingresa tu correo electrónico institucional.';
            forgotFeedback.style.display = 'flex';
          }
          return;
        }

        const btnText = forgotSubmitBtn?.querySelector('.btn-text');
        const btnLoader = forgotSubmitBtn?.querySelector('.btn-loader');
        if (forgotSubmitBtn) forgotSubmitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-flex';
        if (forgotFeedback) forgotFeedback.style.display = 'none';

        try {
          const res = await API.forgotPassword(email);
          if (forgotFeedback) {
            forgotFeedback.className = 'recovery-feedback feedback-success';
            forgotFeedback.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;flex-shrink:0;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>${res.message || 'Solicitud procesada con éxito.'}</span>
            `;
            forgotFeedback.style.display = 'flex';
          }
          if (forgotEmail) forgotEmail.disabled = true;
          if (forgotSubmitBtn) forgotSubmitBtn.style.display = 'none';
        } catch (err) {
          if (forgotFeedback) {
            forgotFeedback.className = 'recovery-feedback feedback-error';
            forgotFeedback.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;flex-shrink:0;">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>${err.message || 'Error al procesar la solicitud de recuperación.'}</span>
            `;
            forgotFeedback.style.display = 'flex';
          }
          if (forgotSubmitBtn) forgotSubmitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline-flex';
          if (btnLoader) btnLoader.style.display = 'none';
        }
      });
    }

    // Toggle para mostrar/ocultar contraseñas
    document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
      });
    });

    // Validación dinámica de política de contraseñas
    const mandatoryNewPass = document.getElementById('mandatory-new-pass');
    if (mandatoryNewPass) {
      mandatoryNewPass.addEventListener('input', () => {
        const val = mandatoryNewPass.value || '';
        const lenValid = val.length >= 8;
        const upperValid = /[A-Z]/.test(val);
        const lowerValid = /[a-z]/.test(val);
        const numValid = /[0-9]/.test(val);

        const toggleReq = (id, isValid) => {
          const el = document.getElementById(id);
          if (el) {
            if (isValid) el.classList.add('valid');
            else el.classList.remove('valid');
          }
        };

        toggleReq('req-len', lenValid);
        toggleReq('req-upper', upperValid);
        toggleReq('req-lower', lowerValid);
        toggleReq('req-num', numValid);
      });
    }

    // Manejador del formulario de cambio obligatorio
    const mandatoryForm = document.getElementById('form-mandatory-password');
    const mandatorySubmitBtn = document.getElementById('mandatory-btn-submit');
    const mandatoryFeedback = document.getElementById('mandatory-feedback');
    const mandatoryLogoutBtn = document.getElementById('mandatory-btn-logout');

    if (mandatoryLogoutBtn) {
      mandatoryLogoutBtn.addEventListener('click', () => {
        Auth.clear();
        const mandatoryModal = document.getElementById('modal-mandatory-password');
        if (mandatoryModal) mandatoryModal.style.display = 'none';
        showLogin();
      });
    }

    if (mandatoryForm) {
      mandatoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curPass = (document.getElementById('mandatory-current-pass')?.value || '').trim();
        const newPass = (document.getElementById('mandatory-new-pass')?.value || '').trim();
        const confPass = (document.getElementById('mandatory-confirm-pass')?.value || '').trim();

        if (!curPass || !newPass || !confPass) {
          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-error';
            mandatoryFeedback.textContent = 'Todos los campos son obligatorios.';
            mandatoryFeedback.style.display = 'flex';
          }
          return;
        }

        if (newPass !== confPass) {
          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-error';
            mandatoryFeedback.textContent = 'La nueva contraseña y su confirmación no coinciden.';
            mandatoryFeedback.style.display = 'flex';
          }
          return;
        }

        if (newPass === curPass) {
          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-error';
            mandatoryFeedback.textContent = 'La nueva contraseña debe ser diferente a la contraseña provisional actual.';
            mandatoryFeedback.style.display = 'flex';
          }
          return;
        }

        if (newPass.length < 8 || !/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-error';
            mandatoryFeedback.textContent = 'La nueva contraseña no cumple con los requisitos de seguridad institucional.';
            mandatoryFeedback.style.display = 'flex';
          }
          return;
        }

        const btnText = mandatorySubmitBtn?.querySelector('.btn-text');
        const btnLoader = mandatorySubmitBtn?.querySelector('.btn-loader');
        if (mandatorySubmitBtn) mandatorySubmitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-flex';
        if (mandatoryFeedback) mandatoryFeedback.style.display = 'none';

        try {
          const res = await API.changePassword({
            currentPassword: curPass,
            newPassword: newPass,
            confirmPassword: confPass
          });

          if (res.user) {
            res.user.mustChangePassword = false;
            Auth.save(res.token, res.user);
          } else {
            Auth.setMustChangePassword(false);
          }

          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-success';
            mandatoryFeedback.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;flex-shrink:0;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>${res.message || 'Contraseña actualizada exitosamente.'}</span>
            `;
            mandatoryFeedback.style.display = 'flex';
          }

          setTimeout(() => {
            const mandatoryModal = document.getElementById('modal-mandatory-password');
            if (mandatoryModal) mandatoryModal.style.display = 'none';
            // Ingresar limpiamente a la plataforma
            const user = Auth.getUser();
            const landing = getDefaultLandingRoute(user);
            showApp();
            navigate(landing.module, landing.options);
            showToast('Contraseña actualizada correctamente. ¡Bienvenido a Talento 360!', 'success');
          }, 900);
        } catch (err) {
          if (mandatoryFeedback) {
            mandatoryFeedback.className = 'recovery-feedback feedback-error';
            mandatoryFeedback.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;flex-shrink:0;">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>${err.message || 'Error al actualizar la contraseña.'}</span>
            `;
            mandatoryFeedback.style.display = 'flex';
          }
        } finally {
          if (mandatorySubmitBtn) mandatorySubmitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline';
          if (btnLoader) btnLoader.style.display = 'none';
        }
      });
    }
  }

  function showMandatoryPasswordModal(user) {
    const mandatoryModal = document.getElementById('modal-mandatory-password');
    if (!mandatoryModal) return;

    // Ocultar pantalla de login y asegurar que no se carguen módulos por detrás
    const ls = document.getElementById('login-screen');
    if (ls) ls.style.setProperty('display', 'none', 'important');
    const app = document.getElementById('app');
    if (app) app.style.setProperty('display', 'grid', 'important');

    // Limpiar inputs del modal
    const curInput = document.getElementById('mandatory-current-pass');
    const newInput = document.getElementById('mandatory-new-pass');
    const confInput = document.getElementById('mandatory-confirm-pass');
    const feedback = document.getElementById('mandatory-feedback');

    if (curInput) curInput.value = '';
    if (newInput) newInput.value = '';
    if (confInput) confInput.value = '';
    if (feedback) {
      feedback.style.display = 'none';
      feedback.textContent = '';
      feedback.className = 'recovery-feedback';
    }

    // Resetear checklist de políticas
    ['req-len', 'req-upper', 'req-lower', 'req-num'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('valid');
    });

    mandatoryModal.style.display = 'flex';
    setTimeout(() => { if (curInput) curInput.focus(); }, 150);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Configuración universal en Español para Flatpickr
    if (typeof flatpickr !== 'undefined') {
      if (flatpickr.l10ns && flatpickr.l10ns.es) {
        flatpickr.localize(flatpickr.l10ns.es);
      }
      flatpickr.setDefaults({
        locale: (flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es',
        firstDayOfWeek: 1,
        weekNumbers: false
      });
    }

    // Initialize system settings & preferences
    if (typeof Settings !== 'undefined') {
      Settings.init();
    }

    // Restore sidebar preference
    const isCollapsed = (localStorage.getItem('talento360_sidebar_collapsed') ?? localStorage.getItem('humano360_sidebar_collapsed')) === 'true';
    if (isCollapsed) {
      document.getElementById('app')?.classList.add('sidebar-collapsed');
    }
    const updateSidebarToggleAttributes = (collapsed) => {
      const toggleBtn = document.getElementById('sidebar-toggle');
      if (!toggleBtn) return;
      if (collapsed) {
        toggleBtn.setAttribute('title', 'Abrir barra lateral (Alt + B)');
        toggleBtn.setAttribute('aria-label', 'Abrir barra lateral');
        toggleBtn.setAttribute('data-tooltip', 'Abrir barra lateral');
      } else {
        toggleBtn.setAttribute('title', 'Cerrar barra lateral (Alt + B)');
        toggleBtn.setAttribute('aria-label', 'Cerrar barra lateral');
        toggleBtn.setAttribute('data-tooltip', 'Cerrar barra lateral');
      }
    };
    updateSidebarToggleAttributes(isCollapsed);

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

    // Login form & Progressive Lockout
    let loginLockoutInterval = null;

    function handleLoginLockout(seconds, message) {
      const errorEl = document.getElementById('login-error');
      const btn = document.getElementById('login-btn');
      const btnText = document.querySelector('#login-btn .btn-text');
      const forgotLink = document.getElementById('link-forgot-password');

      if (loginLockoutInterval) {
        clearInterval(loginLockoutInterval);
        loginLockoutInterval = null;
      }

      let remaining = Math.max(1, parseInt(seconds, 10) || 60);

      const renderLockoutUi = () => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (errorEl) {
          errorEl.className = 'form-error visible is-lockout';
          errorEl.innerHTML = `
            <div class="login-lockout-banner">
              <div class="login-lockout-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="login-lockout-content">
                <div class="login-lockout-title">Acceso bloqueado por seguridad</div>
                <div class="login-lockout-timer">Podrá intentar ingresar nuevamente en: <strong id="lockout-countdown-display">${formatted}</strong></div>
                <div class="login-lockout-advice">
                  ¿Olvidaste tu contraseña institucional? <a href="#" id="lockout-quick-recovery" class="lockout-link">Restablécela aquí de inmediato &rarr;</a>
                </div>
              </div>
            </div>
          `;

          const recovBtn = document.getElementById('lockout-quick-recovery');
          if (recovBtn) {
            recovBtn.addEventListener('click', (e) => {
              e.preventDefault();
              document.getElementById('link-forgot-password')?.click();
            });
          }
        }

        if (btn) {
          btn.disabled = true;
          if (btnText) btnText.textContent = `Bloqueado (${formatted})`;
        }

        if (forgotLink) {
          forgotLink.classList.add('forgot-link--highlight');
        }
      };

      renderLockoutUi();

      loginLockoutInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(loginLockoutInterval);
          loginLockoutInterval = null;
          if (btn) {
            btn.disabled = false;
            if (btnText) btnText.textContent = 'Iniciar sesión';
          }
          if (errorEl) {
            errorEl.className = 'form-error visible';
            errorEl.innerHTML = `El tiempo de espera ha finalizado. Ya puede intentar ingresar de nuevo o solicitar una clave provisional en '¿Olvidaste tu contraseña?'.`;
          }
          if (forgotLink) {
            forgotLink.classList.remove('forgot-link--highlight');
          }
        } else {
          renderLockoutUi();
        }
      }, 1000);
    }

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
          errorEl.className = 'form-error visible';
          return;
        }

        errorEl.classList.remove('visible');
        btn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'flex';

        try {
          const res = await API.login(username, password);
          if (loginLockoutInterval) {
            clearInterval(loginLockoutInterval);
            loginLockoutInterval = null;
          }
          if (res.user) {
            res.user.role = sanitizeRole(res.user.role);
            if (!res.user.jobTitle) {
              res.user.jobTitle = resolveJobTitle(res.user);
            }
          }
          Auth.save(res.token, res.user);
          if (typeof Auth !== 'undefined' && Auth.setAdminElevated) {
            Auth.setAdminElevated(false);
          }

          if (res.user && res.user.mustChangePassword) {
            showMandatoryPasswordModal(res.user);
            return;
          }
          const landing = getDefaultLandingRoute(res.user);

          const proceedToDashboard = () => {
            try {
              if (typeof Settings !== 'undefined' && res.user && res.user.username) {
                Settings.loadForUser(res.user.username);
              }
              showApp();
              navigate(landing.module, landing.options);
              try { checkAndRestoreDraft(); } catch (_) {}
              const userIdentifier = (res.user && res.user.username) || null;
              if (typeof LegalModule !== 'undefined' && !LegalModule.hasAcceptedLegal(userIdentifier)) {
                LegalModule.requireConsentModal(null, userIdentifier);
              }
            } catch (transitionErr) {
              console.error('[Login Transition Error]:', transitionErr);
              const ls = document.getElementById('login-screen');
              if (ls) ls.style.setProperty('display', 'none', 'important');
              const app = document.getElementById('app');
              if (app) app.style.setProperty('display', 'grid', 'important');
              try { navigate(landing.module, landing.options); } catch (_) {}
              try { checkAndRestoreDraft(); } catch (_) {}
              const userIdentifier = (res.user && res.user.username) || null;
              if (typeof LegalModule !== 'undefined' && !LegalModule.hasAcceptedLegal(userIdentifier)) {
                LegalModule.requireConsentModal(null, userIdentifier);
              }
            }
          };

          let hasProceeded = false;
          const safeProceed = () => {
            if (hasProceeded) return;
            hasProceeded = true;
            proceedToDashboard();
          };

          if (typeof FX !== 'undefined' && FX.animateLoginSuccess) {
            FX.animateLoginSuccess(safeProceed);
            setTimeout(safeProceed, 550);
          } else {
            safeProceed();
          }
        } catch (err) {
          const data = err.data || {};
          const isLocked = Boolean(data.isLocked || err.status === 429);
          const retrySeconds = Number(data.retryAfterSeconds || 0);

          if (isLocked && retrySeconds > 0) {
            handleLoginLockout(retrySeconds, data.error || err.message);
          } else {
            errorEl.className = 'form-error visible';
            errorEl.textContent = err.message || 'Error en la contraseña o en el usuario.';
            const forgotLink = document.getElementById('link-forgot-password');
            if (data.suggestRecovery && forgotLink) {
              forgotLink.classList.add('forgot-link--highlight');
            }
          }
          // FX: error shake + sound
          if (typeof FX !== 'undefined') FX.animateLoginError();
        } finally {
          if (!loginLockoutInterval) {
            btn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
          } else {
            if (btnLoader) btnLoader.style.display = 'none';
            if (btnText) btnText.style.display = 'inline';
          }
        }
      });
    }

    // Logout (botón en la barra superior y fallback)
    const handleLogoutTrigger = (e) => {
      e.stopPropagation();
      confirmLogout();
    };
    document.getElementById('topbar-logout-btn')?.addEventListener('click', handleLogoutTrigger);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogoutTrigger);

    // Profile modal openers
    document.getElementById('sidebar-user')?.addEventListener('click', (e) => {
      if (e.target.closest('#logout-btn') || e.target.closest('#topbar-logout-btn')) return;
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
        updateSidebarToggleAttributes(collapsed);
        // FX: sidebar toggle animation
        if (typeof FX !== 'undefined') FX.animateSidebarToggle(collapsed);
      }
    };

    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('topbar-sidebar-toggle')?.addEventListener('click', toggleSidebar);

    // Modal close - Únicamente mediante los botones del modal/formulario (con confirmación si hay cambios)
    document.getElementById('modal-close')?.addEventListener('click', () => closeModal(false));

    // Tecla Escape para modales y confirmación de descarte de cambios
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const unsavedPrompt = document.getElementById('modal-unsaved-confirm');
        if (unsavedPrompt) {
          e.preventDefault();
          removeUnsavedChangesPrompt();
          return;
        }
        const overlay = document.getElementById('modal-overlay');
        if (overlay && overlay.style.display !== 'none' && window.getComputedStyle(overlay).opacity > 0.1) {
          e.preventDefault();
          closeModal(false);
        }
      }
    });

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

    // Módulo general de desbloqueo de módulos institucionales para Administrador
    document.getElementById('nav-admin-modules-unlock')?.addEventListener('click', () => {
      const btn = document.getElementById('nav-admin-modules-unlock');
      if (typeof FX !== 'undefined') FX.animateNavClick(btn);
      const isElevated = (typeof Auth !== 'undefined' && Auth.isAdminElevated) ? Auth.isAdminElevated() : false;
      if (isElevated) {
        promptAdminUnlockedOptions();
      } else {
        promptAdminUnlock('dashboard');
      }
      document.getElementById('sidebar')?.classList.remove('mobile-open');
    });

    // Check existing session and cleanse stored user data
    if (Auth.isLoggedIn()) {
      const storedUser = Auth.getUser();
      if (storedUser && storedUser.mustChangePassword) {
        showMandatoryPasswordModal(storedUser);
        return;
      }
      if (storedUser && typeof storedUser === 'object') {
        let changed = false;
        if (!storedUser.modules || !Array.isArray(storedUser.modules)) {
          storedUser.modules = Auth.getUserModules(storedUser);
          changed = true;
        }
        if (changed) {
          localStorage.setItem('h360_user', JSON.stringify(storedUser));
        }
      }
      if (typeof Settings !== 'undefined' && storedUser && storedUser.username) {
        Settings.loadForUser(storedUser.username);
      }
      showApp();
      const landing = getDefaultLandingRoute(storedUser);
      const storedUsername = (storedUser && storedUser.username) || null;
      if (typeof LegalModule !== 'undefined' && !LegalModule.hasAcceptedLegal(storedUsername)) {
        LegalModule.requireConsentModal(null, storedUsername);
      }
      const initialHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
      const [initMod, initQuery] = initialHash.split('?');

      if (initMod) {
        const params = new URLSearchParams(initQuery || '');
        const options = {};
        if (params.get('tab')) options.tab = params.get('tab');
        if (params.get('tipo')) options.tipo = params.get('tipo');
        if (params.get('year')) options.year = params.get('year');
        if (params.get('pkg')) options.pkg = params.get('pkg');
        navigate(initMod, options);
      } else {
        navigate(landing.module, landing.options);
      }
    } else {
      if (typeof Settings !== 'undefined') {
        Settings.resetToDefaults();
      }
      const initialHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
      const [initMod] = initialHash.split('?');
      const publicLegalRoutes = ['privacidad', 'terminos', 'accesibilidad'];
      if (publicLegalRoutes.includes(initMod)) {
        showApp();
        navigate(initMod);
      } else if (initMod && !VALID_ROUTES.has(initMod)) {
        // Enlace o ruta inválida directa antes de autenticar: mostrar 404 global
        if (typeof Error404Module !== 'undefined') {
          Error404Module.show(initMod);
        } else {
          showLogin();
        }
      } else {
        showLogin();
      }
    }

    // Garantizar que Flatpickr sea el calendario universal y único en toda la plataforma
    if (typeof MutationObserver !== 'undefined' && document.body) {
      const dateObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            for (const node of m.addedNodes) {
              if (node.nodeType === 1) {
                if (node.classList && (node.classList.contains('flatpickr-calendar') || node.classList.contains('flatpickr-input-custom') || node.classList.contains('flatpickr-wrapper'))) {
                  continue;
                }
                if (node.matches && node.matches(DATE_INPUT_SELECTOR)) {
                  initDatePickers(node);
                } else if (node.querySelectorAll) {
                  const dates = node.querySelectorAll(DATE_INPUT_SELECTOR);
                  if (dates.length) initDatePickers(node);
                }
                if (node.matches && node.matches('.form-group, .filter-group, .adv-filter-field')) {
                  initFormUX(node);
                  refreshFloatingLabels(node);
                } else if (node.querySelectorAll) {
                  const groups = node.querySelectorAll('.form-group, .filter-group, .adv-filter-field');
                  if (groups.length) {
                    initFormUX(node);
                    refreshFloatingLabels(node);
                  }
                }
                enhanceAddButtons(node);
              }
            }
          }
        }
      });
      dateObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype.showPicker) {
      const origShowPicker = HTMLInputElement.prototype.showPicker;
      HTMLInputElement.prototype.showPicker = function() {
        if (this._flatpickr) {
          this._flatpickr.open();
          return;
        }
        if (this.matches && this.matches(DATE_INPUT_SELECTOR)) {
          initDatePickers(this);
          if (this._flatpickr) {
            this._flatpickr.open();
            return;
          }
        }
        return origShowPicker.apply(this, arguments);
      };
    }

    // Inicializar recuperación de contraseña y cambio obligatorio
    initPasswordRecoveryHandlers();

    // FX: init effects engine
    if (typeof FX !== 'undefined') FX.init();
  }

  return {
    init,
    navigate,
    getCurrentModule,
    showLogin,
    showApp,
    showToast,
    humanizeErrorMessage,
    markFieldInvalid,
    openModal,
    closeModal,
    markFormClean,
    isModalDirty,
    openProfileModal,
    confirmLogout,
    updateTopbarQuickControls,
    updateTopbarDateTime,
    initDatePickers,
    initFormUX,
    refreshFloatingLabels,
    applyAvatarTheming,
    getAccessibleTextColor,
    getAvatarColor,
    getAvatarTextColor,
    getRoleTextColor,
    enhanceAddButtons,
    isUserAdmin,
    captureActiveFormDraft,
    restoreFormDraft,
    clearFormDraft,
    promptReauthentication,
    promptAdminUnlock,
    promptAdminUnlockedOptions,
    applyNavigationPermissions,
    checkAndRestoreDraft
  };
})();

// Exposición global amigable (soporta tanto App como app con minúscula en consola)
window.App = App;
window.app = App;

// Enrutador reactivo por hash en URL (ej: http://localhost/#/settings o #/sst?tab=epp)
window.addEventListener('hashchange', () => {
  const fullHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (typeof App !== 'undefined' && App.navigate) {
    if (!fullHash) {
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
        const user = Auth.getUser ? Auth.getUser() : null;
        const defaultMod = 'dashboard';
        App.navigate(defaultMod);
      } else {
        App.showLogin();
      }
      return;
    }
    const [mod, query] = fullHash.split('?');
    const params = new URLSearchParams(query || '');
    const options = {};
    if (params.get('tab')) options.tab = params.get('tab');
    if (params.get('tipo')) options.tipo = params.get('tipo');
    if (params.get('year')) options.year = params.get('year');
    if (params.get('pkg')) options.pkg = params.get('pkg');
    App.navigate(mod, options);
  }
});

// ─── Monitor Global de Errores y Excepciones para Administración Técnica ────
(function setupGlobalErrorMonitor() {
  if (typeof window === 'undefined') return;

  function shouldIgnoreError(msg) {
    if (!msg) return true;
    const str = String(msg);
    return str.includes('[Admin Errors API]') ||
           str.includes('[AdminErrorsModule]') ||
           str.includes('[AdminBackupsModule]') ||
           str.includes('/api/admin/errors') ||
           str.includes('/api/admin/backups') ||
           str.includes('[API.reportError]') ||
           str.includes('Acceso denegado') ||
           str.includes('requieren permisos de Administrador') ||
           str.includes('Token expirado') ||
           str.includes('Token inválido') ||
           str.includes('ResizeObserver') ||
           str.includes('Script error.');
  }

  // 1. Excepciones no capturadas de JavaScript en ventana
  window.addEventListener('error', (event) => {
    try {
      if (!event) return;
      const message = event.message || (typeof event.error === 'object' && event.error ? event.error.message : String(event));
      if (shouldIgnoreError(message)) {
        return;
      }
      const stack = event.error && event.error.stack ? event.error.stack : '';
      const url = event.filename || window.location.href;
      let usuario = 'Anónimo';
      try {
        const u = localStorage.getItem('h360_user');
        if (u) usuario = JSON.parse(u).username || 'Usuario';
      } catch (_) {}

      if (typeof API !== 'undefined' && API.reportError) {
        API.reportError({
          tipo: 'JS_EXCEPTION',
          mensaje: message,
          url,
          stack,
          usuario
        });
      }
    } catch (_) {}
  });

  // 2. Promesas rechazadas no manejadas (unhandledrejection)
  window.addEventListener('unhandledrejection', (event) => {
    try {
      if (!event) return;
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack = '';
      if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        message = reason.message || reason.name || JSON.stringify(reason);
        stack = reason.stack || '';
      }
      if (shouldIgnoreError(message)) {
        return;
      }
      let usuario = 'Anónimo';
      try {
        const u = localStorage.getItem('h360_user');
        if (u) usuario = JSON.parse(u).username || 'Usuario';
      } catch (_) {}

      if (typeof API !== 'undefined' && API.reportError) {
        API.reportError({
          tipo: 'PROMISE_REJECTION',
          mensaje: message,
          url: window.location.href,
          stack,
          usuario
        });
      }
    } catch (_) {}
  });

  // 3. Captura automática y transparente de console.error
  if (typeof console !== 'undefined' && console.error) {
    const origConsoleError = console.error;
    let isReporting = false;

    console.error = function(...args) {
      try {
        origConsoleError.apply(console, args);
      } catch (_) {}

      if (isReporting) return;
      try {
        const firstArg = args[0];
        if (shouldIgnoreError(firstArg)) {
          return;
        }

        const msg = args.map(a => {
          if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch (_) { return String(a); }
          }
          return String(a);
        }).join(' ');

        if (!msg || msg.trim().length === 0 || shouldIgnoreError(msg)) return;

        let usuario = 'Anónimo';
        try {
          const u = localStorage.getItem('h360_user');
          if (u) usuario = JSON.parse(u).username || 'Usuario';
        } catch (_) {}

        isReporting = true;
        if (typeof API !== 'undefined' && API.reportError) {
          API.reportError({
            tipo: 'CONSOLE_ERROR',
            mensaje: msg.slice(0, 4000),
            url: window.location.href,
            stack: (new Error()).stack || null,
            usuario
          }).finally(() => {
            isReporting = false;
          });
        } else {
          isReporting = false;
        }
      } catch (_) {
        isReporting = false;
      }
    };
  }
})();

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
