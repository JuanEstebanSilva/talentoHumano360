/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Copias de Seguridad (Backups) del Sistema
 * Gobernación de Boyacá · Panel de Control Exclusivo para Administrador
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AdminBackupsModule = (() => {
  let backupsList = [];
  let currentConfig = {
    backup_interval_enabled: 'true',
    backup_interval_minutes: '30',
    backup_daily_enabled: 'true',
    backup_daily_hour: '17',
    backup_daily_minute: '00',
    backup_max_copies: '15',
    backup_retention_days: '30'
  };
  let isGenerating = false;

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dStr) {
    if (!dStr) return 'N/A';
    try {
      const d = new Date(dStr);
      return d.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (_) {
      return dStr;
    }
  }

  async function loadData() {
    try {
      const res = await API.getAdminBackups();
      backupsList = res.backups || [];
      if (res.config) {
        currentConfig = { ...currentConfig, ...res.config };
      }
    } catch (err) {
      console.error('[AdminBackupsModule] Error al cargar backups:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudieron consultar las copias de seguridad.', 'error');
      }
    } finally {
      renderTable();
      renderStats();
      populateConfigForm();
    }
  }

  function renderStats() {
    const lastBackup = backupsList.length > 0 ? backupsList[0] : null;
    const lastEl = document.getElementById('stat-backup-last');
    const lastDateEl = document.getElementById('stat-backup-last-date');
    const totalEl = document.getElementById('stat-backup-total-count');
    const dailyStatusEl = document.getElementById('stat-backup-daily-status');
    const dailyHourEl = document.getElementById('stat-backup-daily-hour');

    if (lastEl) {
      lastEl.textContent = lastBackup ? (lastBackup.filesizeFormatted || 'Listo') : 'Ninguno';
    }
    if (lastDateEl) {
      lastDateEl.textContent = lastBackup ? formatDate(lastBackup.creado_en) : 'Sin copias registradas';
    }
    if (totalEl) {
      totalEl.textContent = backupsList.length.toLocaleString('es-CO');
    }

    const intervalEnabled = currentConfig.backup_interval_enabled === 'true';
    const dailyEnabled = currentConfig.backup_daily_enabled === 'true';

    if (dailyStatusEl) {
      if (intervalEnabled && dailyEnabled) {
        dailyStatusEl.textContent = 'Intervalo + Diario';
        dailyStatusEl.className = 'kpi-value text-success';
      } else if (intervalEnabled) {
        dailyStatusEl.textContent = `Cada ${currentConfig.backup_interval_minutes || 30} min`;
        dailyStatusEl.className = 'kpi-value text-success';
      } else if (dailyEnabled) {
        dailyStatusEl.textContent = 'Activo Diario';
        dailyStatusEl.className = 'kpi-value text-success';
      } else {
        dailyStatusEl.textContent = 'Desactivado';
        dailyStatusEl.className = 'kpi-value text-muted';
      }
    }

    if (dailyHourEl) {
      const parts = [];
      if (intervalEnabled) parts.push(`Periódico: cada ${currentConfig.backup_interval_minutes || 30} min`);
      if (dailyEnabled) parts.push(`Diario: a las ${String(currentConfig.backup_daily_hour || 17).padStart(2, '0')}:00`);
      if (parts.length === 0) parts.push('Respaldos automáticos apagados');
      dailyHourEl.textContent = parts.join(' | ');
    }
  }

  function populateConfigForm() {
    const chkInterval = document.getElementById('cfg-backup-interval-enabled');
    const selInterval = document.getElementById('cfg-backup-interval-minutes');
    const chkDaily = document.getElementById('cfg-backup-daily-enabled');
    const selHour = document.getElementById('cfg-backup-daily-hour');
    const selMax = document.getElementById('cfg-backup-max-copies');

    if (chkInterval) chkInterval.checked = currentConfig.backup_interval_enabled === 'true';
    if (selInterval) selInterval.value = String(currentConfig.backup_interval_minutes || '30');
    if (chkDaily) chkDaily.checked = currentConfig.backup_daily_enabled === 'true';
    if (selHour) selHour.value = String(currentConfig.backup_daily_hour || '17');
    if (selMax) selMax.value = String(currentConfig.backup_max_copies || '15');
  }

  function renderTable() {
    const tbody = document.getElementById('admin-backups-tbody');
    const emptyBox = document.getElementById('admin-backups-empty');
    const countInfo = document.getElementById('admin-backups-count-info');

    if (!tbody) return;

    if (backupsList.length === 0) {
      tbody.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      if (countInfo) countInfo.textContent = '0 copias de seguridad en el servidor';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    if (countInfo) {
      const maxCopies = currentConfig.backup_max_copies || 15;
      countInfo.textContent = `${backupsList.length} de ${maxCopies} copias almacenadas (rotación automática activa)`;
    }

    tbody.innerHTML = backupsList.map(item => `
      <tr class="admin-backup-row" data-id="${item.id}">
        <td>
          <div class="backup-file-name" style="display:flex; align-items:center; gap:8px;" title="${escHtml(item.filename)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#254d32" stroke-width="2" style="flex-shrink:0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <strong style="color:var(--text-primary); font-size:0.86rem;">${escHtml(item.filename)}</strong>
          </div>
        </td>
        <td style="text-align: center;">
          ${(item.tipo || '').toUpperCase().includes('AUTO') ? `
            <span class="badge badge-info" title="Generado automáticamente por el programador del sistema">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Automático
            </span>
          ` : `
            <span class="badge badge-success" title="Generado a petición manual por el administrador">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
              Manual
            </span>
          `}
        </td>
        <td style="text-align: center; font-weight: 700; color: var(--text-primary);">
          ${escHtml(item.filesizeFormatted || '0 KB')}
        </td>
        <td style="text-align: center; font-size: 0.84rem; color: var(--text-secondary); white-space: nowrap;">
          ${formatDate(item.creado_en)}
        </td>
        <td style="text-align: center;">
          <span class="admin-user-text">
            ${escHtml(item.creado_por || 'admin')}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>
            ${escHtml(item.estado || 'Completado')}
          </span>
        </td>
        <td class="td-actions" style="text-align: center;">
          <div class="td-actions-wrap" style="justify-content: center; gap: 8px;">
            <button class="btn-action-download" title="Descargar archivo .SQL a tu computadora o USB" aria-label="Descargar copia ${item.id}" onclick="AdminBackupsModule.downloadBackup(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="btn-action-view" title="Ver detalles técnicos del respaldo" aria-label="Ver detalles de copia ${item.id}" onclick="AdminBackupsModule.showDetail(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            <button class="btn-action-delete" title="Eliminar copia del servidor" aria-label="Eliminar copia de seguridad ${item.id}" onclick="AdminBackupsModule.confirmDeleteBackup(${item.id}, '${escHtml(item.filename)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function generateBackupNow() {
    if (isGenerating) return;

    const btn = document.getElementById('btn-admin-backup-now');
    isGenerating = true;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="btn-progress-pulse" aria-hidden="true"></span>
        <span>Generando copia de seguridad...</span>
      `;
    }

    try {
      const res = await API.generateAdminBackup();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Copia de seguridad generada con éxito (${res.totalRows || 'todos los'} registros).`, 'success');
      }
      await loadData();

      // Ofrecer descarga inmediata
      if (res.backup && res.backup.id) {
        downloadBackup(res.backup.id);
      }
    } catch (err) {
      console.error('[AdminBackupsModule] Error al generar backup:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(err.message || 'Error al generar la copia de seguridad.', 'error');
      }
    } finally {
      isGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Hacer Copia de Seguridad Ahora</span>
        `;
      }
    }
  }

  function downloadBackup(id) {
    const downloadUrl = API.getAdminBackupDownloadUrl(id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Descarga iniciada. Puedes guardar el archivo en tu equipo o USB.', 'info');
    }
  }

  function showDetail(id) {
    const b = backupsList.find(x => x.id === id);
    if (!b) return;

    const html = `
      <div style="padding: 10px 4px 6px;">
        <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: var(--text-primary); margin: 0 0 4px;">${escHtml(b.filename)}</h3>
            <span style="font-size: 12px; color: var(--text-muted);">${formatDate(b.creado_en)}</span>
          </div>
          <span class="badge ${b.tipo === 'AUTOMATICO' ? 'badge-info' : 'badge-success'}">${escHtml(b.tipo || 'MANUAL')}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
          <div style="background: var(--bg-primary); padding: 10px 12px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Tamaño del Archivo</div>
            <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 3px;">${escHtml(b.filesizeFormatted || '0 KB')}</div>
          </div>
          <div style="background: var(--bg-primary); padding: 10px 12px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Generado Por</div>
            <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 3px;">${escHtml(b.creado_por || 'admin')}</div>
          </div>
        </div>

        <div style="background: rgba(35, 74, 52, 0.06); border: 1px solid rgba(35, 74, 52, 0.2); border-radius: 10px; padding: 12px 14px; margin-bottom: 18px;">
          <strong style="color: #234a34; font-size: 12.5px; display: block; margin-bottom: 4px;">Detalles del Volcado:</strong>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.45;">
            ${escHtml(b.detalles || 'Copia de seguridad completa generada con integridad transaccional.')}
          </p>
        </div>

        <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4;">
          Ubicación en servidor: <code style="font-size: 11px;">${escHtml(b.filepath)}</code>
        </p>
      </div>
    `;

    App.openModal('Detalles de Copia de Seguridad', html, [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Descargar Archivo',
        cls: 'btn-primary',
        action: () => {
          App.closeModal();
          downloadBackup(b.id);
        }
      }
    ]);
  }

  /**
   * Eliminación con doble confirmación tipada (como en Viáticos)
   */
  function confirmDeleteBackup(id, filename) {
    const requiredConfirmation = 'ELIMINAR';
    const html = `
      <div style="padding:10px 4px 6px; text-align:center;">
        <div style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;color:#dc2626;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:28px;height:28px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">¿Eliminar Copia de Seguridad?</h3>
        <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;max-width:440px;margin:0 auto 16px;">
          ¿Estás seguro de que deseas eliminar permanentemente el archivo <strong style="color:var(--text-primary); word-break:break-all;">${escHtml(filename)}</strong> del servidor? Se borrará tanto del disco como de la base de datos.
        </p>

        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;padding:14px 16px;margin-bottom:18px;text-align:left;">
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#dc2626;margin-bottom:6px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Acción Irreversible
          </div>
          <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.45;">
            Para confirmar la eliminación, escribe exactamente <strong style="color:#dc2626;user-select:all;">${requiredConfirmation}</strong> a continuación:
          </p>
        </div>

        <div style="margin-bottom:10px;">
          <input
            type="text"
            id="backup-confirm-delete-input"
            class="form-input"
            placeholder="Escribe ${requiredConfirmation}"
            autocomplete="off"
            style="text-align:center; font-weight:800; font-size:14.5px; letter-spacing:0.8px; text-transform:uppercase; border:1.5px solid var(--color-border); padding:10px 14px; width:100%; border-radius:8px;"
            oninput="
              const val = this.value.trim().toUpperCase();
              const btn = document.getElementById('btn-confirm-delete-backup-action');
              if (btn) {
                if (val === '${requiredConfirmation}') {
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  btn.style.cursor = 'pointer';
                  btn.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.4)';
                } else {
                  btn.disabled = true;
                  btn.style.opacity = '0.45';
                  btn.style.cursor = 'not-allowed';
                  btn.style.boxShadow = 'none';
                }
              }
            "
          />
        </div>
      </div>
    `;

    App.openModal('Confirmar Eliminación de Copia', html, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Sí, Eliminar Copia',
        cls: 'btn-danger',
        id: 'btn-confirm-delete-backup-action',
        action: async () => {
          const inputEl = document.getElementById('backup-confirm-delete-input');
          const typedVal = inputEl ? inputEl.value.trim().toUpperCase() : '';
          if (typedVal !== requiredConfirmation) {
            App.showToast(`Debes escribir "${requiredConfirmation}" para proceder.`, 'warning');
            if (inputEl) inputEl.focus();
            return;
          }
          const btn = document.getElementById('btn-confirm-delete-backup-action');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Eliminando...';
          }
          try {
            await API.deleteAdminBackup(id);
            App.closeModal();
            App.showToast('Copia de seguridad eliminada exitosamente.', 'success');
            await loadData();
          } catch (err) {
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Sí, Eliminar Copia';
            }
            App.showToast('Error al eliminar el archivo.', 'error');
          }
        }
      }
    ]);

    setTimeout(() => {
      const btn = document.getElementById('btn-confirm-delete-backup-action');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
      }
      const inp = document.getElementById('backup-confirm-delete-input');
      if (inp) inp.focus();
    }, 50);
  }

  async function saveConfig() {
    const btn = document.getElementById('btn-save-backup-cfg');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
    }

    try {
      const chkInterval = document.getElementById('cfg-backup-interval-enabled');
      const selInterval = document.getElementById('cfg-backup-interval-minutes');
      const chkDaily = document.getElementById('cfg-backup-daily-enabled');
      const selHour = document.getElementById('cfg-backup-daily-hour');
      const selMax = document.getElementById('cfg-backup-max-copies');

      const payload = {
        backup_interval_enabled: chkInterval ? (chkInterval.checked ? 'true' : 'false') : 'true',
        backup_interval_minutes: selInterval ? selInterval.value : '30',
        backup_daily_enabled: chkDaily ? (chkDaily.checked ? 'true' : 'false') : 'true',
        backup_daily_hour: selHour ? selHour.value : '17',
        backup_daily_minute: '00',
        backup_max_copies: selMax ? selMax.value : '15',
        backup_retention_days: '30'
      };

      const res = await API.updateAdminBackupConfig(payload);
      if (res.config) currentConfig = { ...currentConfig, ...res.config };

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Configuración de automatización guardada correctamente.', 'success');
      }
      renderStats();
    } catch (err) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Error al guardar la configuración.', 'error');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar Configuración';
      }
    }
  }

  async function render(container) {
    if (!container) return;

    // Horas para el select (00 a 23)
    const hoursOptions = Array.from({ length: 24 }, (_, i) => {
      const val = String(i).padStart(2, '0');
      const label = i === 0 ? '12:00 AM (Medianoche)' : (i < 12 ? `${i}:00 AM` : (i === 12 ? '12:00 PM (Mediodía)' : `${i - 12}:00 PM`));
      const selected = i === 17 ? 'selected' : '';
      return `<option value="${i}" ${selected}>${val}:00 — ${label}</option>`;
    }).join('');

    container.innerHTML = `
      <div class="admin-panel-container">
        
        <!-- Cabecera del Módulo -->
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div class="page-header-info">
            <h1 class="page-title" style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin:0 0 6px;">Centro de Copias de Seguridad y Respaldo</h1>
            <p class="page-subtitle" style="font-size:0.88rem; color:var(--text-secondary); margin:0;">Genera volcados SQL integrales de toda la plataforma para guardar en tu PC o USB, y programa copias automáticas.</p>
          </div>
          <div class="page-actions">
            <!-- Botón estilo pill verde exacto a la plataforma -->
            <button id="btn-admin-backup-now" class="btn-backup-pill-now" title="Generar un respaldo completo de la base de datos ahora mismo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:18px; height:18px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Hacer Copia de Seguridad Ahora</span>
            </button>
          </div>
        </div>

        <!-- Tarjetas Métricas KPI -->
        <div class="admin-kpi-grid">
          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-backup">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-backup-last">Cargando...</div>
              <div class="kpi-label">Último Respaldo Generado</div>
              <div class="kpi-sub" id="stat-backup-last-date">Verificando fecha...</div>
            </div>
          </div>

          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-total">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value" id="stat-backup-total-count">0</div>
              <div class="kpi-label">Archivos de Respaldo Guardados</div>
              <div class="kpi-sub">Disponibles para descarga inmediata</div>
            </div>
          </div>

          <div class="admin-kpi-card">
            <div class="kpi-icon-wrap icon-daily">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value text-success" id="stat-backup-daily-status">Activo</div>
              <div class="kpi-label">Automatización de Respaldo</div>
              <div class="kpi-sub" id="stat-backup-daily-hour">Cada 30 min | Diario a las 17:00</div>
            </div>
          </div>
        </div>

        <!-- Tarjeta de Programación y Automatización -->
        <div class="admin-card-section">
          <div class="admin-section-header">
            <div class="section-title-wrap" style="display:flex; align-items:center; gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#254d32" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h2 class="admin-section-title" style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-primary);">Programación de Copias Automáticas y Rotación</h2>
            </div>
            <span class="badge badge-success">Continuidad Operativa</span>
          </div>
          
          <div class="admin-schedule-form" style="display:flex; flex-direction:column; gap:20px; padding:20px 22px;">
            
            <!-- Opción 1: Respaldo Periódico por Intervalo -->
            <div class="schedule-toggle-row" style="display:flex; align-items:center; justify-content:space-between; gap:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
              <div style="display:flex; align-items:flex-start; gap:14px; flex:1;">
                <label class="admin-switch">
                  <input type="checkbox" id="cfg-backup-interval-enabled" checked />
                  <span class="admin-slider"></span>
                </label>
                <div class="schedule-toggle-label">
                  <strong style="font-size:0.95rem; color:var(--text-primary); display:block; margin-bottom:2px;">Copia periódica automática por intervalo de tiempo</strong>
                  <p style="font-size:0.83rem; color:var(--text-secondary); margin:0;">Genera un respaldo automático periódicamente mientras el servidor se encuentre activo.</p>
                </div>
              </div>

              <div class="schedule-time-selectors" style="display:flex; align-items:center; gap:8px;">
                <label for="cfg-backup-interval-minutes" style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">Frecuencia:</label>
                <select id="cfg-backup-interval-minutes" class="admin-select" style="min-width:180px;">
                  <option value="10">Cada 10 minutos</option>
                  <option value="15">Cada 15 minutos</option>
                  <option value="20">Cada 20 minutos</option>
                  <option value="30" selected>Cada 30 minutos (Recomendado)</option>
                  <option value="45">Cada 45 minutos</option>
                  <option value="60">Cada 1 hora</option>
                </select>
              </div>
            </div>

            <!-- Opción 2: Respaldo Diario a Hora Específica -->
            <div class="schedule-toggle-row" style="display:flex; align-items:center; justify-content:space-between; gap:20px; padding-bottom:16px; border-bottom:1px solid var(--border);">
              <div style="display:flex; align-items:flex-start; gap:14px; flex:1;">
                <label class="admin-switch">
                  <input type="checkbox" id="cfg-backup-daily-enabled" checked />
                  <span class="admin-slider"></span>
                </label>
                <div class="schedule-toggle-label">
                  <strong style="font-size:0.95rem; color:var(--text-primary); display:block; margin-bottom:2px;">Copia diaria fija al cierre de jornada</strong>
                  <p style="font-size:0.83rem; color:var(--text-secondary); margin:0;">Genera un respaldo formal del día a la hora seleccionada (ideal 5:00 PM al finalizar actividades).</p>
                </div>
              </div>

              <div class="schedule-time-selectors" style="display:flex; align-items:center; gap:8px;">
                <label for="cfg-backup-daily-hour" style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">Hora Diaria:</label>
                <select id="cfg-backup-daily-hour" class="admin-select" style="min-width:180px;">
                  ${hoursOptions}
                </select>
              </div>
            </div>

            <!-- Opción 3: Rotación Inteligente de Almacenamiento (Máximo 15 copias) -->
            <div class="schedule-toggle-row" style="display:flex; align-items:center; justify-content:space-between; gap:20px;">
              <div style="flex:1;">
                <strong style="font-size:0.95rem; color:var(--text-primary); display:block; margin-bottom:2px;">Política de rotación y almacenamiento inteligente</strong>
                <p style="font-size:0.83rem; color:var(--text-secondary); margin:0;">Al alcanzarse el límite de copias guardadas, el sistema depura automáticamente el archivo más antiguo para optimizar el disco.</p>
              </div>

              <div class="schedule-time-selectors" style="display:flex; align-items:center; gap:8px;">
                <label for="cfg-backup-max-copies" style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">Máximo Almacenadas:</label>
                <select id="cfg-backup-max-copies" class="admin-select" style="min-width:180px;">
                  <option value="10">10 copias</option>
                  <option value="15" selected>15 copias (Recomendado)</option>
                  <option value="20">20 copias</option>
                  <option value="30">30 copias</option>
                </select>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:6px;">
              <button id="btn-save-backup-cfg" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; font-weight:700;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>Guardar Configuración de Automatización</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Tabla de Copias de Seguridad Disponibles -->
        <div class="admin-card-table-wrap">
          <div class="admin-table-header-box" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin:0 0 3px;">Historial de Copias de Seguridad</h2>
              <p style="font-size:0.82rem; color:var(--text-secondary); margin:0;">Archivos .SQL completos generados con estructura de tablas, secuencias y datos institucionales.</p>
            </div>
            <button id="btn-refresh-backups" class="btn btn-outline btn-sm" title="Actualizar lista">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:4px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Refrescar</span>
            </button>
          </div>

          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Nombre del Archivo .SQL</th>
                  <th style="width: 130px; text-align: center;">Tipo</th>
                  <th style="width: 120px; text-align: center;">Tamaño</th>
                  <th style="width: 160px; text-align: center;">Fecha y Hora</th>
                  <th style="width: 140px; text-align: center;">Generado Por</th>
                  <th style="width: 120px; text-align: center;">Estado</th>
                  <th style="width: 130px; text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody id="admin-backups-tbody">
                <!-- Se llena dinámicamente -->
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          <div id="admin-backups-empty" class="admin-empty-state" style="display:none;">
            <div class="empty-icon-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="#254d32" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="empty-title">Aún no se registran copias de seguridad</h3>
            <p class="empty-desc">Haz clic en <strong>"Hacer Copia de Seguridad Ahora"</strong> para crear el primer respaldo integral de la plataforma.</p>
          </div>

          <div class="admin-table-footer">
            <div id="admin-backups-count-info" class="count-info">Cargando copias de seguridad...</div>
          </div>
        </div>

      </div>
    `;

    setupEvents();
    await loadData();
  }

  function setupEvents() {
    const btnNow = document.getElementById('btn-admin-backup-now');
    if (btnNow) btnNow.onclick = generateBackupNow;

    const btnRefresh = document.getElementById('btn-refresh-backups');
    if (btnRefresh) {
      btnRefresh.onclick = () => {
        loadData();
        if (typeof App !== 'undefined' && App.showToast) App.showToast('Lista de respaldos actualizada', 'info');
      };
    }

    const btnSaveCfg = document.getElementById('btn-save-backup-cfg');
    if (btnSaveCfg) btnSaveCfg.onclick = saveConfig;
  }

  return {
    render,
    loadData,
    generateBackupNow,
    downloadBackup,
    showDetail,
    confirmDeleteBackup
  };
})();

if (typeof window !== 'undefined') {
  window.AdminBackupsModule = AdminBackupsModule;
}
