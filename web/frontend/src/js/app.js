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
  let modalCloseSeq = 0;

  function openModal(title, bodyHtml, footerButtons = [], customClass = '') {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');
    const box = document.querySelector('.modal-box');
    if (!overlay || !titleEl || !bodyEl || !footerEl) return;

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
    }, 30);

    // FX: animated modal open
    if (typeof FX !== 'undefined') {
      FX.animateModalOpen(overlay, box, isAlreadyOpen);
    } else {
      overlay.style.opacity = '1';
    }
  }

  function initDatePickers(container = document) {
    if (typeof flatpickr === 'undefined') return;
    try {
      const inputs = [];
      if (container && container.matches && (container.matches('input[type="date"], input[data-datepicker], input.datepicker-input'))) {
        inputs.push(container);
      } else if (container && container.querySelectorAll) {
        inputs.push(...container.querySelectorAll('input[type="date"], input[data-datepicker], input.datepicker-input'));
      }
      inputs.forEach(input => {
        if (input._flatpickr) return;
        const currentVal = input.value || '';
        const minVal = input.getAttribute('min') || undefined;
        const maxVal = input.getAttribute('max') || undefined;
        flatpickr(input, {
          locale: (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es',
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'd/m/Y',
          altInputClass: ((input.className || 'form-input').replace(/\bflatpickr-input\b/g, '') + ' flatpickr-input-custom').trim(),
          defaultDate: currentVal || null,
          minDate: minVal,
          maxDate: maxVal,
          allowInput: true,
          onChange: function(selectedDates, dateStr) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
          },
          disableMobile: true,
          monthSelectorType: 'dropdown',
          onReady: function(selectedDates, dateStr, instance) {
            // Sincronización con etiquetas flotantes
            const group = input.closest('.form-group');
            if (group) {
              if (currentVal || dateStr) group.classList.add('is-floated');
              if (instance.altInput) {
                instance.altInput.addEventListener('focus', () => group.classList.add('is-focused', 'is-floated'));
                instance.altInput.addEventListener('blur', () => {
                  group.classList.remove('is-focused');
                  if (!input.value) group.classList.remove('is-floated');
                });
              }
            }

            if (!instance.calendarContainer) return;

            function ensureCloseBtn(inst) {
              if (!inst || !inst.calendarContainer) return;
              const monthsBar = inst.calendarContainer.querySelector('.flatpickr-months');
              if (monthsBar && !inst.calendarContainer.querySelector('.flatpickr-custom-close')) {
                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'flatpickr-custom-close';
                closeBtn.title = 'Cerrar calendario';
                closeBtn.setAttribute('aria-label', 'Cerrar calendario');
                closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                closeBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  inst.close();
                });
                monthsBar.appendChild(closeBtn);
              }
            }
            instance._ensureCloseBtn = ensureCloseBtn;

            // 1. Botón 'X' institucional para cerrar el calendario sin cambios
            ensureCloseBtn(instance);

            // 2. Selector Desplegable de Año (fácil de usar, rango 1920 a 2050)
            const currentMonthEl = instance.calendarContainer.querySelector('.flatpickr-current-month');
            const numInput = currentMonthEl ? currentMonthEl.querySelector('.numInputWrapper') : null;
            if (currentMonthEl && numInput && !currentMonthEl.querySelector('.flatpickr-year-dropdown')) {
              numInput.style.display = 'none';

              const yearSelect = document.createElement('select');
              yearSelect.className = 'flatpickr-year-dropdown';
              yearSelect.setAttribute('aria-label', 'Seleccionar año');
              yearSelect.title = 'Seleccionar año';

              const minYear = 1920;
              const maxYear = 2050;
              const currentY = instance.currentYear || (instance.latestSelectedDateObj ? instance.latestSelectedDateObj.getFullYear() : new Date().getFullYear());

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
                  instance.changeYear(newY);
                }
              });

              numInput.parentNode.insertBefore(yearSelect, numInput.nextSibling);
              instance._customYearSelect = yearSelect;
            }

            // 3. Tooltip accesible en desplegable de mes
            const monthSelect = instance.calendarContainer.querySelector('.flatpickr-monthDropdown-months');
            if (monthSelect) {
              monthSelect.title = 'Seleccionar mes';
            }

            // 4. Footer institucional rápido (Hoy / Limpiar)
            if (!instance.calendarContainer.querySelector('.flatpickr-custom-footer')) {
              const footer = document.createElement('div');
              footer.className = 'flatpickr-custom-footer';
              footer.innerHTML = `
                <button type="button" class="fp-btn-today" title="Seleccionar fecha de hoy">Hoy</button>
                <button type="button" class="fp-btn-clear" title="Borrar fecha seleccionada">Limpiar</button>
              `;
              footer.querySelector('.fp-btn-today').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                instance.setDate(new Date(), true);
                instance.close();
              });
              footer.querySelector('.fp-btn-clear').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                instance.clear();
                instance.close();
              });
              instance.calendarContainer.appendChild(footer);
            }
          },
          onYearChange: function(selectedDates, dateStr, instance) {
            if (instance._customYearSelect && instance.currentYear && instance._customYearSelect.value !== instance.currentYear.toString()) {
              instance._customYearSelect.value = instance.currentYear.toString();
            }
            if (instance._ensureCloseBtn) instance._ensureCloseBtn(instance);
          },
          onMonthChange: function(selectedDates, dateStr, instance) {
            if (instance._customYearSelect && instance.currentYear && instance._customYearSelect.value !== instance.currentYear.toString()) {
              instance._customYearSelect.value = instance.currentYear.toString();
            }
            if (instance._ensureCloseBtn) instance._ensureCloseBtn(instance);
          },
          onOpen: function(selectedDates, dateStr, instance) {
            if (instance._customYearSelect && instance.currentYear && instance._customYearSelect.value !== instance.currentYear.toString()) {
              instance._customYearSelect.value = instance.currentYear.toString();
            }
            if (instance._ensureCloseBtn) instance._ensureCloseBtn(instance);
            const group = input.closest('.form-group');
            if (group) group.classList.add('is-focused', 'is-floated');
          },
          onClose: function(selectedDates, dateStr, instance) {
            const group = input.closest('.form-group');
            if (group) {
              group.classList.remove('is-focused');
              if (!input.value) group.classList.remove('is-floated');
            }
          },
          onValueUpdate: function(selectedDates, dateStr, instance) {
            if (instance._customYearSelect && instance.currentYear && instance._customYearSelect.value !== instance.currentYear.toString()) {
              instance._customYearSelect.value = instance.currentYear.toString();
            }
          },
          onChange: function(selectedDates, dateStr) {
            input.value = dateStr;
            const group = input.closest('.form-group');
            if (group) {
              if (dateStr) group.classList.add('is-floated');
              else group.classList.remove('is-floated');
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
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

  function initFormUX(container = document) {
    if (!container) return;
    try {
      const groups = container.querySelectorAll('.form-group, .adv-filter-field');
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

        const label = group.querySelector('.form-label, label');
        const control = group.querySelector('.form-input, .filter-select, select, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
        if (!label || !control) return;

        // Activar grupo flotante
        group.classList.add('floating-group');
        if (control.matches('select')) {
          group.classList.add('is-select', 'is-floated');
        }

        const updateState = () => {
          let hasVal = false;
          if (control.matches('select')) {
            hasVal = true; // Selects siempre flotan el label al tope
          } else if (control.type === 'date' || control._flatpickr) {
            hasVal = Boolean(control.value || (control._flatpickr && control._flatpickr.selectedDates.length > 0));
          } else {
            hasVal = Boolean(control.value && String(control.value).trim() !== '');
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
      const groups = container.querySelectorAll('.form-group.floating-group, .adv-filter-field.floating-group, .adv-filter-field');
      groups.forEach(group => {
        const control = group.querySelector('.form-input, .filter-select, select, textarea, input:not([type="hidden"])');
        if (!control) return;
        let hasVal = false;
        if (control.matches('select')) {
          hasVal = true;
        } else if (control.type === 'date' || control._flatpickr) {
          hasVal = Boolean(control.value || (control._flatpickr && control._flatpickr.selectedDates.length > 0));
        } else {
          hasVal = Boolean(control.value && String(control.value).trim() !== '');
        }
        if (hasVal) {
          group.classList.add('is-floated');
        } else if (document.activeElement !== control && (!control._flatpickr || document.activeElement !== control._flatpickr.altInput)) {
          group.classList.remove('is-floated');
        }
      });
    } catch (_) {}
  }

  function closeModal() {
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
    dashboard: 'Dashboard',
    employees: 'Servidores Públicos',
    requests: 'Solicitudes de Vacaciones',
    'admin-requests': 'Solicitudes Administrativas',
    viaticos: 'Viáticos',
    horarios: 'Horarios y Modalidades',
    sst: 'Seguridad y Salud en el Trabajo (SST)',
    settings: 'Configuración',
    privacidad: 'Política de Tratamiento de Datos Personales',
    terminos: 'Términos y Condiciones de Uso',
    accesibilidad: 'Declaración de Accesibilidad Web',
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
    privacidad: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    terminos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    accesibilidad: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };

  const VALID_ROUTES = new Set([
    'dashboard',
    'employees',
    'requests',
    'admin-requests',
    'viaticos',
    'horarios',
    'sst',
    'settings',
    'privacidad',
    'terminos',
    'accesibilidad'
  ]);

  async function navigate(module, options = {}) {
    const rawModule = String(module || '').replace(/^#\/?/, '').trim();

    // 1. Si la ruta o módulo NO existe en las rutas válidas:
    // Mostrar inmediatamente la pantalla global 404 fuera del layout y sin tocar el módulo actual.
    if (!rawModule || !VALID_ROUTES.has(rawModule)) {
      if (typeof Error404Module !== 'undefined') {
        Error404Module.show(rawModule || '404', options.error);
      }
      return;
    }

    // 2. Ruta válida: ocultar overlay global 404 si estaba visible y asegurar visualización del app
    if (typeof Error404Module !== 'undefined') {
      Error404Module.hide();
    }

    // 2.1 Control de permisos por rol / módulo
    const publicRoutes = ['dashboard', 'settings', 'privacidad', 'terminos', 'accesibilidad'];
    if (!publicRoutes.includes(rawModule)) {
      if (typeof Auth !== 'undefined' && Auth.hasModuleAccess && !Auth.hasModuleAccess(rawModule)) {
        showToast('Acceso restringido: no tienes permisos asignados para acceder a este módulo.', 'warning');
        navigate('dashboard');
        return;
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

    if (rawModule === 'admin-requests') {
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
        FX.onModuleRendered(container);
        container.scrollTop = 0;
      });
    } else {
      await renderSelectedModule();
      enhanceAddButtons(container);
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
    const username = (user.username || '').toLowerCase();
    return username === 'admin' || (user.role && user.role.toLowerCase() === 'administrador' && !username.includes('angela') && !username.includes('bergenet') && !username.includes('doris'));
  }

  function applyNavigationPermissions(user = {}) {
    const mods = (typeof Auth !== 'undefined' && Auth.getUserModules) ? Auth.getUserModules(user) : ['dashboard'];
    const hasAll = mods.includes('*') || mods.includes('all');

    const setVisibility = (id, isVisible) => {
      const el = document.getElementById(id);
      if (!el) return;
      const li = el.closest('li') || el;
      li.style.display = isVisible ? '' : 'none';
    };

    setVisibility('nav-dashboard', true);
    setVisibility('nav-employees', hasAll || mods.includes('employees'));
    setVisibility('nav-requests', hasAll || mods.includes('requests'));
    setVisibility('nav-admin-group', hasAll || mods.includes('admin-requests'));
    setVisibility('nav-viaticos', hasAll || mods.includes('viaticos'));
    setVisibility('nav-horarios', hasAll || mods.includes('horarios'));
    setVisibility('nav-sst-group', hasAll || mods.includes('sst'));
    setVisibility('nav-settings', true);
  }

  function resolveJobTitle(user = {}) {
    if (user.jobTitle && String(user.jobTitle).trim()) {
      return String(user.jobTitle).trim();
    }
    const username = String(user.username || '').toLowerCase();
    if (username.includes('angela')) return 'Gestión de Servidores Públicos';
    if (username.includes('bergenet')) return 'Gestión de Viáticos';
    if (username.includes('doris')) return 'Gestión de Horarios y Modalidades';
    if (username === 'admin') return 'Administrador del Sistema';
    return '';
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

    // Actualizar contrastes accesibles del avatar y nombre del usuario según el nuevo tema
    try {
      applyAvatarTheming();
    } catch (_) {}
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
          
          // Registrar consentimiento para que no bloquee el acceso fluido al dashboard
          if (typeof LegalModule !== 'undefined' && LegalModule.recordConsent) {
            LegalModule.recordConsent();
          }

          const proceedToDashboard = () => {
            try {
              showApp();
              navigate('dashboard');
            } catch (transitionErr) {
              console.error('[Login Transition Error]:', transitionErr);
              const ls = document.getElementById('login-screen');
              if (ls) ls.style.setProperty('display', 'none', 'important');
              const app = document.getElementById('app');
              if (app) app.style.setProperty('display', 'grid', 'important');
              try { navigate('dashboard'); } catch (_) {}
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
        const u = (storedUser.username || '').toLowerCase();
        let changed = false;
        if (u.includes('angela') || u.includes('bergenet') || u.includes('doris')) {
          if (storedUser.role === 'Administrador' || storedUser.role === 'Administradora') {
            storedUser.role = 'Usuario';
            changed = true;
          }
        }
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
        navigate('dashboard');
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
                if (node.matches && node.matches('input[type="date"], input[data-datepicker], input.datepicker-input')) {
                  initDatePickers(node);
                } else if (node.querySelectorAll) {
                  const dates = node.querySelectorAll('input[type="date"], input[data-datepicker], input.datepicker-input');
                  if (dates.length) initDatePickers(node);
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
        if (this.type === 'date' || this.hasAttribute('data-datepicker')) {
          initDatePickers(this);
          if (this._flatpickr) {
            this._flatpickr.open();
            return;
          }
        }
        return origShowPicker.apply(this, arguments);
      };
    }

    // FX: init effects engine
    if (typeof FX !== 'undefined') FX.init();
  }

  return { init, navigate, showLogin, showApp, showToast, openModal, closeModal, openProfileModal, confirmLogout, updateTopbarQuickControls, updateTopbarDateTime, initDatePickers, initFormUX, refreshFloatingLabels, applyAvatarTheming, getAccessibleTextColor, getAvatarColor, getAvatarTextColor, getRoleTextColor, enhanceAddButtons };
})();

// Exposición global amigable (soporta tanto App como app con minúscula en consola)
window.App = App;
window.app = App;

// Enrutador reactivo por hash en URL (ej: http://localhost/#/settingsggg o #/sst?tab=epp)
window.addEventListener('hashchange', () => {
  const fullHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (typeof App !== 'undefined' && App.navigate) {
    if (!fullHash) {
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
        App.navigate('dashboard');
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

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
