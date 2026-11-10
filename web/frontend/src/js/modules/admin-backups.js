/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Talento 360 — Módulo de Copias de Seguridad y Respaldo Técnico
 * Gobernación de Boyacá · Panel de Control Exclusivo para Administrador
 * Diseño Institucional Estandarizado acorde al Sistema de Gestión
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AdminBackupsModule = (() => {
  let backupsList = [];
  let currentConfig = {};
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

  function formatDateTwoLines(dStr) {
    if (!dStr) return '<span class="text-muted">N/A</span>';
    try {
      const d = new Date(dStr);
      const day = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return `
        <div class="admin-date-wrap">
          <span class="admin-date-day">${escHtml(day)}</span>
          <span class="admin-date-time">${escHtml(time)}</span>
        </div>
      `;
    } catch (_) {
      return escHtml(dStr);
    }
  }

  function renderUserCell(usuario) {
    const raw = (usuario || 'admin').trim();
    const cleanUser = raw.split('@')[0];
    let initials = 'AD';
    if (cleanUser.length >= 2) {
      initials = cleanUser.slice(0, 2).toUpperCase();
    }
    return `
      <div class="admin-user-cell" title="Generado por: ${escHtml(raw)}">
        <span class="admin-user-avatar" style="background:rgba(37,77,50,0.14); color:#254d32;" aria-hidden="true">${escHtml(initials)}</span>
        <span class="admin-user-name">${escHtml(cleanUser)}</span>
      </div>
    `;
  }

  function isUserAdmin() {
    if (typeof Auth === 'undefined' || !Auth.getUser) return false;
    const user = Auth.getUser();
    if (!user) return false;
    if (typeof Auth.isAdmin === 'function') {
      return Auth.isAdmin(user);
    }
    const r = String(user.role || '').toLowerCase();
    const uname = String(user.username || '').toLowerCase();
    return r === 'administrador' || r === 'admin' || uname === 'admin' || uname === 'admin@boyaca.gov.co' || uname === 'alejoleo2022@gmail.com';
  }

  function isCurrentViewAdminBackups() {
    if (typeof window === 'undefined' || !window.location) return false;
    const hash = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return hash === 'admin-backups';
  }

  async function loadData() {
    if (!isUserAdmin() || !isCurrentViewAdminBackups()) {
      return;
    }

    try {
      const [listRes, cfgRes] = await Promise.all([
        API.getAdminBackups(),
        API.getAdminBackupConfig()
      ]);

      backupsList = listRes.backups || [];
      currentConfig = cfgRes.config || {};
      renderStats();
      renderTable();
      populateConfigInputs();
    } catch (err) {
      const errMsg = String((err && err.message) || err || '');
      const isAuthProblem = (err && (err.status === 401 || err.status === 403)) ||
        errMsg.includes('Acceso denegado') ||
        errMsg.includes('requieren permisos') ||
        errMsg.includes('Forbidden') ||
        errMsg.includes('Unauthorized');

      if (isAuthProblem) {
        return;
      }

      console.error('[AdminBackupsModule] Error al cargar backups:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No se pudieron consultar los respaldos del sistema.', 'error');
      }
    }
  }

  function renderStats() {
    const lastBackupEl = document.getElementById('stat-backup-last');
    const lastDateEl = document.getElementById('stat-backup-last-date');
    const totalCountEl = document.getElementById('stat-backup-total-count');
    const dailyStatusEl = document.getElementById('stat-backup-daily-status');
    const dailyHourEl = document.getElementById('stat-backup-daily-hour');
    const diskSpaceEl = document.getElementById('stat-backup-disk-space');
    const policyCopiesEl = document.getElementById('stat-backup-policy-copies');
    const tableCountBadge = document.getElementById('admin-backups-count-badge');

    if (backupsList.length > 0) {
      const latest = backupsList[0];
      if (lastBackupEl) lastBackupEl.textContent = latest.filesizeFormatted || '0 KB';
      if (lastDateEl) lastDateEl.textContent = `Generado: ${formatDate(latest.creado_en)}`;
    } else {
      if (lastBackupEl) lastBackupEl.textContent = 'Sin respaldos';
      if (lastDateEl) lastDateEl.textContent = 'No hay copias previas';
    }

    if (totalCountEl) {
      totalCountEl.textContent = backupsList.length.toLocaleString('es-CO');
    }

    if (diskSpaceEl) {
      const totalBytes = backupsList.reduce((acc, b) => acc + (parseInt(b.filesize) || 0), 0);
      if (totalBytes > 1024 * 1024) {
        diskSpaceEl.textContent = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
      } else if (totalBytes > 0) {
        diskSpaceEl.textContent = `${(totalBytes / 1024).toFixed(1)} KB`;
      } else {
        diskSpaceEl.textContent = '0 MB';
      }
    }

    if (policyCopiesEl) {
      const maxC = currentConfig.backup_max_copies || '15';
      policyCopiesEl.textContent = `Máx ${maxC} Copias`;
    }

    if (tableCountBadge) {
      tableCountBadge.textContent = `${backupsList.length} archivo${backupsList.length === 1 ? '' : 's'}`;
    }

    const intervalEnabled = currentConfig.backup_interval_enabled === 'true';
    const intervalMins = currentConfig.backup_interval_minutes || '30';
    const dailyEnabled = currentConfig.backup_daily_enabled === 'true';
    const hour = String(currentConfig.backup_daily_hour || '17').padStart(2, '0');
    const minute = String(currentConfig.backup_daily_minute || '00').padStart(2, '0');

    if (dailyStatusEl) {
      if (intervalEnabled && dailyEnabled) {
        dailyStatusEl.textContent = 'Activo (Doble)';
        dailyStatusEl.className = 'stat-value text-success';
      } else if (intervalEnabled || dailyEnabled) {
        dailyStatusEl.textContent = 'Activo';
        dailyStatusEl.className = 'stat-value text-success';
      } else {
        dailyStatusEl.textContent = 'Inactivo';
        dailyStatusEl.className = 'stat-value text-muted';
      }
    }

    if (dailyHourEl) {
      const parts = [];
      if (intervalEnabled) parts.push(`Cada ${intervalMins} min`);
      if (dailyEnabled) parts.push(`Diario ${hour}:${minute}`);
      dailyHourEl.textContent = parts.length > 0 ? parts.join(' | ') : 'Programación pausada';
    }
  }

  function populateConfigInputs() {
    const chkInterval = document.getElementById('cfg-backup-interval-enabled');
    const selInterval = document.getElementById('cfg-backup-interval-minutes');
    const chkDaily = document.getElementById('cfg-backup-daily-enabled');
    const selDaily = document.getElementById('cfg-backup-daily-hour');
    const selMaxCopies = document.getElementById('cfg-backup-max-copies');

    if (chkInterval) {
      chkInterval.checked = currentConfig.backup_interval_enabled === 'true';
      toggleCardDisabled('card-cfg-interval', chkInterval.checked);
    }
    if (selInterval && currentConfig.backup_interval_minutes) {
      selInterval.value = currentConfig.backup_interval_minutes;
    }
    if (chkDaily) {
      chkDaily.checked = currentConfig.backup_daily_enabled === 'true';
      toggleCardDisabled('card-cfg-daily', chkDaily.checked);
    }
    if (selDaily && currentConfig.backup_daily_hour !== undefined) {
      selDaily.value = parseInt(currentConfig.backup_daily_hour);
    }
    if (selMaxCopies && currentConfig.backup_max_copies) {
      selMaxCopies.value = currentConfig.backup_max_copies;
    }
  }

  function toggleCardDisabled(cardId, isEnabled) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const select = card.querySelector('select');
    if (select) {
      select.disabled = !isEnabled;
    }
    if (isEnabled) {
      card.classList.remove('is-disabled');
    } else {
      card.classList.add('is-disabled');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('admin-backups-tbody');
    const emptyBox = document.getElementById('admin-backups-empty');
    const countInfo = document.getElementById('admin-backups-count-info');

    if (!tbody) return;

    if (backupsList.length === 0) {
      tbody.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      if (countInfo) countInfo.textContent = '0 copias de seguridad disponibles';
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
            <strong style="color:var(--text-primary); font-size:0.86rem; font-family:monospace;">${escHtml(item.filename)}</strong>
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
        <td style="text-align: center; font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">
          ${escHtml(item.filesizeFormatted || '0 KB')}
        </td>
        <td style="text-align: center;">
          ${formatDateTwoLines(item.creado_en)}
        </td>
        <td class="td-user-col">
          ${renderUserCell(item.creado_por)}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
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
        <span class="btn-slide-label" style="max-width:260px; opacity:1; margin-left:8px;">Generando copia de seguridad...</span>
      `;
    }

    try {
      const res = await API.generateAdminBackup();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Copia de seguridad generada con éxito (${res.totalRows || 'todos los'} registros).`, 'success');
      }
      await loadData();

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
          <span class="btn-slide-label">Hacer Copia de Seguridad Ahora</span>
        `;
      }
    }
  }

  async function downloadBackup(id, customFilename) {
    const token = typeof Auth !== 'undefined' ? Auth.getToken() : '';
    const base = ((window.TALENTO360_API_URL || '').replace(/\/+$/, '')) + '/api';
    const endpoint = `${base}/admin/backups/download/${id}`;

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Iniciando descarga del archivo SQL...', 'info');
    }

    try {
      // 1. Descarga directa con Authorization Header via fetch y Blob para evitar abrir pestañas en blanco
      const response = await fetch(endpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        let errMsg = 'No se pudo descargar la copia de seguridad.';
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await response.blob();

      // Determinamos el nombre del archivo
      let filename = customFilename || '';
      if (!filename) {
        const item = backupsList.find(b => b.id === id);
        if (item && item.filename) filename = item.filename;
      }
      if (!filename) {
        const disposition = response.headers.get('content-disposition');
        if (disposition && disposition.includes('filename=')) {
          const m = disposition.match(/filename="?([^";]+)"?/);
          if (m && m[1]) filename = m[1].trim();
        }
      }
      if (!filename) {
        filename = `talento360_backup_${id}.sql`;
      }

      // Disparador invisible de guardado local de archivo en el equipo del usuario
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Copia de seguridad "${filename}" guardada en tu equipo.`, 'success');
      }
    } catch (err) {
      console.warn('[AdminBackupsModule] Fallo descarga Blob, ejecutando enlace directo:', err);
      // Fallback a URL directa limpia sin concatenación de tokens duplicados
      const directUrl = API.getAdminBackupDownloadUrl(id);
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = customFilename || '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(err.message || 'Error al procesar la descarga.', 'error');
      }
    }
  }

  function showDetail(id) {
    const item = backupsList.find(b => b.id === id);
    if (!item) return;

    const modalBody = `
      <div class="admin-backup-detail-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <span class="badge ${item.tipo === 'AUTO' ? 'badge-info' : 'badge-success'}">
            ${item.tipo === 'AUTO' ? '🤖 Respaldo Automático Programado' : '👤 Respaldo Manual a Solicitud'}
          </span>
          <span class="badge badge-success">✓ Estado: Completado</span>
        </div>

        <div class="admin-detail-section">
          <label class="admin-detail-label">Nombre del Archivo:</label>
          <div class="font-mono" style="font-size:0.95rem; font-weight:700; color:var(--text-primary); word-break:break-all;">
            ${escHtml(item.filename)}
          </div>
        </div>

        <div class="admin-detail-grid">
          <div class="admin-detail-field">
            <span class="admin-detail-label">Tamaño en Disco:</span>
            <span class="admin-detail-val font-mono" style="font-weight:700;">${escHtml(item.filesizeFormatted || '0 KB')}</span>
          </div>
          <div class="admin-detail-field">
            <span class="admin-detail-label">Generado Por:</span>
            <span class="admin-detail-val">${escHtml(item.creado_por || 'admin')}</span>
          </div>
          <div class="admin-detail-field">
            <span class="admin-detail-label">Fecha y Hora de Creación:</span>
            <span class="admin-detail-val">${formatDate(item.creado_en)}</span>
          </div>
          <div class="admin-detail-field">
            <span class="admin-detail-label">Ruta en Servidor:</span>
            <span class="admin-detail-val font-mono" style="font-size:0.75rem; word-break:break-all;">${escHtml(item.filepath || 'N/A')}</span>
          </div>
        </div>

        ${item.detalles ? `
          <div class="admin-detail-section" style="margin-top:14px;">
            <label class="admin-detail-label">Resumen Técnico de la Exportación:</label>
            <div style="background:var(--bg-tertiary); padding:12px 14px; border-radius:8px; font-size:0.86rem; color:var(--text-primary); line-height:1.45;">
              ${escHtml(item.detalles)}
            </div>
          </div>
        ` : ''}

        <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-primary" onclick="AdminBackupsModule.downloadBackup(${item.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar Archivo .SQL
          </button>
          <span style="font-size:0.78rem; color:var(--text-secondary);">Contiene todas las tablas, vistas y secuencias.</span>
        </div>
      </div>
    `;

    App.openModal(
      `Ficha Técnica del Respaldo #${item.id}`,
      modalBody,
      [
        { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() }
      ],
      'modal-md'
    );
  }

  function confirmDeleteBackup(id, filename) {
    const requiredConfirmation = 'ELIMINAR';
    const html = `
      <div style="padding:10px 4px 6px; text-align:center;">
        <div style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;color:#dc2626;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:28px;height:28px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">¿Eliminar Copia de Seguridad?</h3>
        <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;max-width:440px;margin:0 auto 16px;">
          Se borrará permanentemente el archivo <strong style="color:var(--text-primary);word-break:break-all;">${escHtml(filename)}</strong> tanto del disco duro del servidor como del historial.
        </p>

        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;padding:14px 16px;margin-bottom:18px;text-align:left;">
          <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.45;">
            Para confirmar la eliminación, escribe exactamente <strong style="color:#dc2626;user-select:all;">${requiredConfirmation}</strong> a continuación:
          </p>
        </div>

        <div style="margin-bottom:10px;">
          <input
            type="text"
            id="admin-confirm-backup-delete-input"
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

    App.openModal('Confirmar Eliminación de Copia de Seguridad', html, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Sí, Eliminar Archivo',
        cls: 'btn-danger',
        id: 'btn-confirm-delete-backup-action',
        action: async () => {
          const inputEl = document.getElementById('admin-confirm-backup-delete-input');
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
            App.showToast('Archivo de respaldo eliminado.', 'success');
            await loadData();
          } catch (err) {
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Sí, Eliminar Archivo';
            }
            App.showToast('Error al eliminar la copia de seguridad.', 'error');
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
      const inp = document.getElementById('admin-confirm-backup-delete-input');
      if (inp) inp.focus();
    }, 50);
  }

  async function saveConfig() {
    const chkInterval = document.getElementById('cfg-backup-interval-enabled');
    const selInterval = document.getElementById('cfg-backup-interval-minutes');
    const chkDaily = document.getElementById('cfg-backup-daily-enabled');
    const selDaily = document.getElementById('cfg-backup-daily-hour');
    const selMaxCopies = document.getElementById('cfg-backup-max-copies');
    const btn = document.getElementById('btn-save-backup-cfg');

    const newCfg = {
      backup_interval_enabled: chkInterval && chkInterval.checked ? 'true' : 'false',
      backup_interval_minutes: selInterval ? selInterval.value : '30',
      backup_daily_enabled: chkDaily && chkDaily.checked ? 'true' : 'false',
      backup_daily_hour: selDaily ? selDaily.value : '17',
      backup_daily_minute: '00',
      backup_max_copies: selMaxCopies ? selMaxCopies.value : '15'
    };

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="btn-progress-pulse" aria-hidden="true"></span>
        <span>Guardando...</span>
      `;
    }

    try {
      const res = await API.updateAdminBackupConfig(newCfg);
      currentConfig = res.config || newCfg;
      renderStats();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Configuración de automatización y rotación guardada correctamente.', 'success');
      }
    } catch (err) {
      console.error('[AdminBackupsModule] Error al guardar config:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Error al guardar la configuración.', 'error');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Guardar Programación</span>
        `;
      }
    }
  }

  async function render(container) {
    if (!container) return;

    const hoursOptions = Array.from({ length: 24 }, (_, i) => {
      const val = String(i).padStart(2, '0');
      const label = i === 0 ? '12:00 AM (Medianoche)' : (i < 12 ? `${i}:00 AM` : (i === 12 ? '12:00 PM (Mediodía)' : `${i - 12}:00 PM`));
      const tag = i === 17 ? ' — Fin de jornada' : (i === 12 ? ' — Mediodía' : '');
      const selected = i === 17 ? 'selected' : '';
      return `<option value="${i}" ${selected}>⏰ ${val}:00 (${label}${tag})</option>`;
    }).join('');

    container.innerHTML = `
      <div class="module-enter">
        
        <!-- Encabezado Institucional Estandarizado Gobernación de Boyacá -->
        <div class="module-header-card">
          <div class="module-header-info">
            <div class="module-header-brand">
              <img src="imgs/logoCondor.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-light-theme" />
              <img src="imgs/logoCondorBlanco.png" alt="Escudo Gobernación de Boyacá" class="module-header-logo logo-dark-theme" />
              <span class="module-header-brand-text">Gobernación de Boyacá · Administración del Sistema</span>
            </div>
            <h1 class="module-hero-title">Copias de Seguridad y Respaldo</h1>
            <p class="module-hero-desc">Genera volcados SQL integrales de toda la plataforma para guardar en tu PC o USB, y programa copias automáticas con rotación preventiva.</p>
          </div>
          <div class="module-header-actions" style="display:flex; align-items:center; gap:12px;">
            <!-- Botón de acción deslizante estilo oficial -->
            <button id="btn-admin-backup-now" class="btn-action-slide-admin btn-slide--green" title="Generar un respaldo completo de la base de datos ahora mismo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span class="btn-slide-label">Hacer Copia de Seguridad Ahora</span>
            </button>
          </div>
        </div>

        <!-- 5 Tarjetas Métricas KPI Oficiales (stats-grid de 5 Columnas Completas) -->
        <div class="stats-grid" style="margin-bottom: 20px;">
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-backup-last">Cargando...</div>
              <div class="stat-label">Último Respaldo Generado</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;" id="stat-backup-last-date">Verificando fecha...</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-backup-total-count">0</div>
              <div class="stat-label">Archivos de Respaldo</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Disponibles para descarga</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value text-success" id="stat-backup-daily-status">Activo</div>
              <div class="stat-label">Automatización Dual</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;" id="stat-backup-daily-hour">Cada 30 min | Diario 17:00</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-backup-disk-space">0 MB</div>
              <div class="stat-label">Espacio Total en Disco</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Volumen de almacenamiento</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" id="stat-backup-policy-copies">15 Copias</div>
              <div class="stat-label">Política de Retención</div>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; display:block;">Rotación automática activa</span>
            </div>
          </div>
        </div>

        <!-- ─── Panel Modernizado de Programación y Automatización ─────────── -->
        <div class="backup-automation-card">
          <div class="backup-automation-header">
            <div class="header-left" style="display:flex; align-items:center; gap:14px;">
              <div class="backup-header-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:22px; height:22px;">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <h2 class="backup-automation-title">Programación de Copias Automáticas y Rotación</h2>
                <p class="backup-automation-subtitle">Garantiza la continuidad operativa y preservación del histórico sin saturar el almacenamiento del servidor.</p>
              </div>
            </div>
            <div class="header-right">
              <span class="badge-status-pill badge-status-pill--active">
                <span class="pulse-dot"></span>
                <span>Continuidad Activa</span>
              </span>
            </div>
          </div>

          <!-- Grid de 3 Tarjetas de Configuración -->
          <div class="backup-cards-grid">

            <!-- Tarjeta 1: Intervalo Periódico -->
            <div class="backup-config-card" id="card-cfg-interval">
              <div class="config-card-top">
                <div class="config-icon-box config-icon--interval">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 10"/></svg>
                </div>
                <div class="config-card-heading">
                  <div class="config-card-title">Respaldo por Intervalo</div>
                  <div class="config-card-sub">Ejecución continua periódica</div>
                </div>
                <div class="config-card-switch">
                  <label class="admin-switch" title="Activar o desactivar copia por intervalo">
                    <input type="checkbox" id="cfg-backup-interval-enabled" checked />
                    <span class="admin-slider"></span>
                  </label>
                </div>
              </div>
              <p class="config-card-desc">Genera copias recurrentes mientras el servidor permanezca activo.</p>
              <div class="config-field-wrap">
                <label class="config-control-label" for="cfg-backup-interval-minutes">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Frecuencia de captura</span>
                </label>
                <div class="config-select-wrapper">
                  <select id="cfg-backup-interval-minutes" class="config-custom-select">
                    <option value="10">⚡ Cada 10 minutos</option>
                    <option value="15">⚡ Cada 15 minutos</option>
                    <option value="20">⚡ Cada 20 minutos</option>
                    <option value="30" selected>⭐ Cada 30 minutos (Recomendado)</option>
                    <option value="45">⏱️ Cada 45 minutos</option>
                    <option value="60">⏱️ Cada 1 hora (60 min)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Tarjeta 2: Respaldo Diario Fijo -->
            <div class="backup-config-card" id="card-cfg-daily">
              <div class="config-card-top">
                <div class="config-icon-box config-icon--daily">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div class="config-card-heading">
                  <div class="config-card-title">Cierre de Jornada</div>
                  <div class="config-card-sub">Copia fija al final del día</div>
                </div>
                <div class="config-card-switch">
                  <label class="admin-switch" title="Activar o desactivar copia diaria fija">
                    <input type="checkbox" id="cfg-backup-daily-enabled" checked />
                    <span class="admin-slider"></span>
                  </label>
                </div>
              </div>
              <p class="config-card-desc">Consolida el día a la hora fijada (ideal 5:00 PM al finalizar labores).</p>
              <div class="config-field-wrap">
                <label class="config-control-label" for="cfg-backup-daily-hour">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Hora diaria de ejecución</span>
                </label>
                <div class="config-select-wrapper">
                  <select id="cfg-backup-daily-hour" class="config-custom-select">
                    ${hoursOptions}
                  </select>
                </div>
              </div>
            </div>

            <!-- Tarjeta 3: Rotación Inteligente (Máximo 15 copias) -->
            <div class="backup-config-card" id="card-cfg-retention">
              <div class="config-card-top">
                <div class="config-icon-box config-icon--retention">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                </div>
                <div class="config-card-heading">
                  <div class="config-card-title">Rotación de Archivos</div>
                  <div class="config-card-sub">Control de espacio en disco</div>
                </div>
                <div class="config-card-switch">
                  <span class="badge-smart-retention">Inteligente</span>
                </div>
              </div>
              <p class="config-card-desc">Al alcanzar el tope máximo, se depura automáticamente el archivo más antiguo.</p>
              <div class="config-field-wrap">
                <label class="config-control-label" for="cfg-backup-max-copies">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Límite máximo almacenado</span>
                </label>
                <div class="config-select-wrapper">
                  <select id="cfg-backup-max-copies" class="config-custom-select">
                    <option value="10">📦 Máximo 10 archivos</option>
                    <option value="15" selected>⭐ Máximo 15 archivos (Recomendado)</option>
                    <option value="20">📦 Máximo 20 archivos</option>
                    <option value="30">📦 Máximo 30 archivos</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          <!-- Barra Inferior de Acción y Consejos -->
          <div class="backup-automation-footer">
            <div class="footer-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.3" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <span>Los cambios de programación se aplican de inmediato en segundo plano sin reiniciar el servidor.</span>
            </div>
            <button id="btn-save-backup-cfg" class="btn-save-schedule" title="Guardar ajustes de automatización">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Guardar Programación</span>
            </button>
          </div>
        </div>

        <!-- Tabla de Copias de Seguridad Disponibles en Table Card Oficial -->
        <div class="table-card">
          <div class="table-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="table-title">Historial de Copias de Seguridad Almacenadas</span>
              <span class="table-count" id="admin-backups-count-badge">
                <span class="skeleton" style="width:70px;height:14px;border-radius:4px;" aria-hidden="true"></span>
              </span>
            </div>
            <button id="btn-refresh-backups" class="btn btn-outline btn-sm" title="Actualizar lista">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:4px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Refrescar</span>
            </button>
          </div>

          <div class="table-wrap">
            <table class="admin-table-styled" aria-label="Listado de copias de seguridad">
              <thead>
                <tr>
                  <th scope="col">Nombre del Archivo .SQL</th>
                  <th scope="col" style="width: 140px; text-align: center;">Tipo</th>
                  <th scope="col" style="width: 120px; text-align: center;">Tamaño</th>
                  <th scope="col" style="width: 140px; text-align: center;">Fecha y Hora</th>
                  <th scope="col" style="width: 150px; text-align: left; padding-left: 16px;">Generado Por</th>
                  <th scope="col" style="width: 120px; text-align: center;">Estado</th>
                  <th scope="col" style="width: 110px; text-align: center;">Acciones</th>
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

          <div class="pagination" style="padding:12px 20px; border-top:1px solid var(--color-border, #e2e8f0);">
            <span class="pagination-info" id="admin-backups-count-info" style="font-size:0.83rem; color:var(--text-secondary);">Cargando copias de seguridad...</span>
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

    const chkInterval = document.getElementById('cfg-backup-interval-enabled');
    if (chkInterval) {
      chkInterval.onchange = (e) => toggleCardDisabled('card-cfg-interval', e.target.checked);
    }

    const chkDaily = document.getElementById('cfg-backup-daily-enabled');
    if (chkDaily) {
      chkDaily.onchange = (e) => toggleCardDisabled('card-cfg-daily', e.target.checked);
    }
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
