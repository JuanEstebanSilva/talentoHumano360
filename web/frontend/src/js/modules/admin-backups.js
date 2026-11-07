/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Copias de Seguridad (Backups) del Sistema
 * Gobernación de Boyacá · Panel de Control Exclusivo para Administrador
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AdminBackupsModule = (() => {
  let backupsList = [];
  let currentConfig = {
    backup_daily_enabled: 'true',
    backup_daily_hour: '23',
    backup_daily_minute: '00',
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

    const isEnabled = currentConfig.backup_daily_enabled === 'true';
    if (dailyStatusEl) {
      dailyStatusEl.textContent = isEnabled ? 'Activo Diario' : 'Desactivado';
      dailyStatusEl.className = `kpi-value ${isEnabled ? 'text-success' : 'text-muted'}`;
    }
    if (dailyHourEl) {
      const h = String(currentConfig.backup_daily_hour || '23').padStart(2, '0');
      const m = String(currentConfig.backup_daily_minute || '00').padStart(2, '0');
      dailyHourEl.textContent = isEnabled ? `Todos los días a las ${h}:${m}` : 'Respaldo automático apagado';
    }
  }

  function populateConfigForm() {
    const chk = document.getElementById('cfg-backup-daily-enabled');
    const selHour = document.getElementById('cfg-backup-daily-hour');
    const selMin = document.getElementById('cfg-backup-daily-minute');

    if (chk) chk.checked = currentConfig.backup_daily_enabled === 'true';
    if (selHour) selHour.value = String(currentConfig.backup_daily_hour || '23');
    if (selMin) selMin.value = String(currentConfig.backup_daily_minute || '00');
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
      countInfo.textContent = `${backupsList.length} copias de seguridad disponibles para descarga`;
    }

    tbody.innerHTML = backupsList.map(item => `
      <tr class="admin-backup-row" data-id="${item.id}">
        <td>
          <div class="backup-file-name" title="${escHtml(item.filename)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355833" stroke-width="2" style="margin-right:8px; flex-shrink:0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <strong>${escHtml(item.filename)}</strong>
          </div>
        </td>
        <td style="text-align: center;">
          ${item.tipo === 'AUTOMATICO' ? `
            <span class="admin-badge badge-info" title="Generado automáticamente por el programador diario">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Automático Diario
            </span>
          ` : `
            <span class="admin-badge badge-success" title="Generado a petición manual por el administrador">
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
          <span class="admin-user-pill">
            ${escHtml(item.creado_por || 'admin')}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="admin-badge badge-success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>
            ${escHtml(item.estado || 'Completado')}
          </span>
        </td>
        <td class="col-actions" style="text-align: center;">
          <div class="admin-table-actions">
            <button class="btn-action-icon btn-download-backup" title="Descargar archivo .SQL a tu computadora o USB" onclick="AdminBackupsModule.downloadBackup(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="btn-action-icon btn-detail-backup" title="Ver información del respaldo" onclick="AdminBackupsModule.showDetail(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            <button class="btn-action-icon btn-delete-backup" title="Eliminar del servidor" onclick="AdminBackupsModule.deleteBackup(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Genera una nueva copia de seguridad completa y permite descargarla inmediatamente
   */
  async function generateBackupNow() {
    if (isGenerating) return;
    isGenerating = true;

    const btn = document.getElementById('btn-admin-backup-now');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="admin-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Respaldando tablas...</span>
      `;
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Generando copia de seguridad completa de la plataforma...', 'info');
    }

    try {
      const res = await API.generateAdminBackup();
      if (res.success && res.backup) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`¡Copia de seguridad completada! (${res.filesizeFormatted || 'Listo'})`, 'success');
        }

        // Descarga inmediata del archivo para que el usuario elija su carpeta o memoria USB
        downloadBackup(res.backup.id);
        await loadData();
      } else {
        throw new Error(res.error || 'No se pudo generar el respaldo');
      }
    } catch (err) {
      console.error('[AdminBackupsModule] Error al generar backup:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Error al respaldar: ${err.message}`, 'error');
      }
    } finally {
      isGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="margin-right:8px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Hacer Copia de Seguridad Ahora</span>
        `;
      }
    }
  }

  /**
   * Descarga el archivo .SQL generado al navegador (permite elegir carpeta o USB)
   */
  function downloadBackup(backupId) {
    const downloadUrl = API.getAdminBackupDownloadUrl(backupId);
    
    // Crear enlace temporal de descarga para activar el diálogo del navegador
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Descargando archivo .SQL. Puedes guardarlo en tu computadora o en una memoria USB.', 'info');
    }
  }

  function showDetail(backupId) {
    const item = backupsList.find(b => b.id === backupId);
    if (!item) return;

    const modalBody = `
      <div class="admin-backup-modal-detail">
        <div class="admin-detail-group">
          <label class="admin-detail-label">Nombre del Archivo SQL:</label>
          <div class="admin-detail-box-message" style="font-family:monospace; font-size:0.92rem; font-weight:700;">
            ${escHtml(item.filename)}
          </div>
        </div>

        <div class="admin-detail-grid">
          <div>
            <label class="admin-detail-label">Tipo de Respaldo:</label>
            <div class="admin-detail-box-meta">${item.tipo === 'AUTOMATICO' ? 'Automático Diario Programado' : 'Manual (A petición de Administrador)'}</div>
          </div>
          <div>
            <label class="admin-detail-label">Tamaño en Disco:</label>
            <div class="admin-detail-box-meta">${escHtml(item.filesizeFormatted || '0 KB')}</div>
          </div>
          <div>
            <label class="admin-detail-label">Fecha de Generación:</label>
            <div class="admin-detail-box-meta">${formatDate(item.creado_en)}</div>
          </div>
          <div>
            <label class="admin-detail-label">Generado Por:</label>
            <div class="admin-detail-box-meta">${escHtml(item.creado_por || 'admin')}</div>
          </div>
        </div>

        <div class="admin-detail-group" style="margin-top:14px;">
          <label class="admin-detail-label">Detalles del Respaldo:</label>
          <div class="admin-detail-box-meta" style="line-height:1.5;">
            ${escHtml(item.detalles || 'Respaldo íntegro de todas las tablas de Talento 360 en formato SQL estándar.')}
          </div>
        </div>

        <div class="admin-usb-tip-box" style="margin-top:16px; padding:12px 14px; background:rgba(209,173,42,0.1); border:1px solid rgba(209,173,42,0.3); border-radius:8px; font-size:0.84rem; color:var(--text-secondary); line-height:1.45;">
          💡 <strong>Consejo de Custodia:</strong> Puedes descargar este archivo y transferirlo a una memoria USB o disco duro externo seguro para mantener una copia física fuera de línea.
        </div>
      </div>
    `;

    App.openModal(
      `Copia de Seguridad #${item.id}`,
      modalBody,
      [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Descargar Archivo .SQL',
          cls: 'btn-primary-cta',
          action: () => {
            App.closeModal();
            downloadBackup(item.id);
          }
        }
      ]
    );
  }

  async function deleteBackup(backupId) {
    App.openModal(
      'Confirmar Eliminación de Copia de Seguridad',
      '<p style="margin:0; font-size:0.95rem; color:var(--text-secondary);">¿Estás seguro de que deseas eliminar este archivo de respaldo del servidor? Se borrará tanto de la base de datos como del disco.</p>',
      [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Eliminar Copia',
          cls: 'btn-danger-confirm',
          action: async () => {
            App.closeModal();
            try {
              await API.deleteAdminBackup(backupId);
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Copia de seguridad eliminada del servidor.', 'success');
              }
              await loadData();
            } catch (_) {
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Error al eliminar el archivo.', 'error');
              }
            }
          }
        }
      ]
    );
  }

  async function saveConfig() {
    const chk = document.getElementById('cfg-backup-daily-enabled');
    const selHour = document.getElementById('cfg-backup-daily-hour');
    const selMin = document.getElementById('cfg-backup-daily-minute');

    const newConfig = {
      backup_daily_enabled: chk ? String(chk.checked) : 'true',
      backup_daily_hour: selHour ? selHour.value : '23',
      backup_daily_minute: selMin ? selMin.value : '00'
    };

    try {
      await API.updateAdminBackupConfig(newConfig);
      currentConfig = { ...currentConfig, ...newConfig };
      renderStats();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Programación de copias automáticas guardada correctamente.', 'success');
      }
    } catch (err) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudo guardar la configuración.', 'error');
      }
    }
  }

  async function render(container) {
    if (!container) return;

    // Horas para el select (00 a 23)
    const hoursOptions = Array.from({ length: 24 }, (_, i) => {
      const val = String(i).padStart(2, '0');
      const label = i === 0 ? '12:00 AM (Medianoche)' : (i < 12 ? `${i}:00 AM` : (i === 12 ? '12:00 PM (Mediodía)' : `${i - 12}:00 PM`));
      return `<option value="${i}">${val}:00 — ${label}</option>`;
    }).join('');

    container.innerHTML = `
      <div class="admin-panel-container">
        
        <!-- Cabecera del Módulo -->
        <div class="page-header">
          <div class="page-header-info">
            <h1 class="page-title">Centro de Copias de Seguridad y Respaldo</h1>
            <p class="page-subtitle">Genera copias completas de toda la plataforma en formato .SQL para descarga local o almacenamiento en memoria USB, y configura respaldos automáticos diarios.</p>
          </div>
          <div class="page-actions">
            <button id="btn-admin-backup-now" class="btn-primary-cta" title="Generar un respaldo completo de la base de datos ahora mismo">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="margin-right:8px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
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
              <div class="kpi-value text-success" id="stat-backup-daily-status">Activo Diario</div>
              <div class="kpi-label">Copia Automática Diaria</div>
              <div class="kpi-sub" id="stat-backup-daily-hour">Todos los días a las 23:00</div>
            </div>
          </div>
        </div>

        <!-- Tarjeta de Programación de Respaldo Diario Automático -->
        <div class="admin-card-section">
          <div class="admin-section-header">
            <div class="section-title-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#355833" stroke-width="2.2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h2 class="admin-section-title">Programación de Copia Automática Diaria</h2>
            </div>
            <span class="admin-section-pill">Garantía de Continuidad</span>
          </div>
          
          <div class="admin-schedule-form">
            <div class="schedule-toggle-row">
              <label class="admin-switch">
                <input type="checkbox" id="cfg-backup-daily-enabled" checked />
                <span class="admin-slider"></span>
              </label>
              <div class="schedule-toggle-label">
                <strong>Realizar copia de seguridad automática todos los días</strong>
                <p>El sistema genera y preserva un archivo .SQL con toda la información mientras la plataforma se encuentre en ejecución.</p>
              </div>
            </div>

            <div class="schedule-inputs-row">
              <div class="form-group-time">
                <label for="cfg-backup-daily-hour">Hora de Ejecución Diaria:</label>
                <select id="cfg-backup-daily-hour" class="admin-select">
                  ${hoursOptions}
                </select>
              </div>

              <div class="form-group-time" style="display:none;">
                <input type="hidden" id="cfg-backup-daily-minute" value="00" />
              </div>

              <div class="form-group-btn">
                <button id="btn-admin-save-schedule" class="btn-secondary" type="button" style="height:42px; align-self:flex-end;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:6px;"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Guardar Programación</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla de Copias de Seguridad Guardadas -->
        <div class="admin-card-table-wrap">
          <div class="admin-table-top-bar">
            <h3 class="table-bar-title">Historial de Copias de Seguridad en el Servidor</h3>
            <button id="btn-admin-refresh-backups" class="btn-icon-subtle" title="Recargar lista">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>

          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Archivo de Respaldo (.SQL)</th>
                  <th style="width: 150px; text-align: center;">Tipo</th>
                  <th style="width: 120px; text-align: center;">Tamaño</th>
                  <th style="width: 170px; text-align: center;">Fecha y Hora</th>
                  <th style="width: 130px; text-align: center;">Generado Por</th>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="#355833" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            </div>
            <h3 class="empty-title">Aún no hay copias de seguridad generadas</h3>
            <p class="empty-desc">Haz clic en <strong>"Hacer Copia de Seguridad Ahora"</strong> para crear el primer respaldo completo de la base de datos.</p>
          </div>

          <!-- Footer informativo -->
          <div class="admin-table-footer">
            <div id="admin-backups-count-info" class="count-info">Cargando copias...</div>
            <div class="backup-usb-notice">
              <span>💾 Puedes descargar los archivos .SQL directamente a tu dispositivo o memoria USB en cualquier momento.</span>
            </div>
          </div>
        </div>

      </div>
    `;

    bindDOMEvents();
    await loadData();
  }

  function bindDOMEvents() {
    const btnNow = document.getElementById('btn-admin-backup-now');
    if (btnNow) btnNow.onclick = generateBackupNow;

    const btnRefresh = document.getElementById('btn-admin-refresh-backups');
    if (btnRefresh) btnRefresh.onclick = loadData;

    const btnSaveCfg = document.getElementById('btn-admin-save-schedule');
    if (btnSaveCfg) btnSaveCfg.onclick = saveConfig;
  }

  return {
    render,
    generateBackupNow,
    downloadBackup,
    showDetail,
    deleteBackup,
    saveConfig,
    refresh: loadData
  };
})();

if (typeof window !== 'undefined') {
  window.AdminBackupsModule = AdminBackupsModule;
}

