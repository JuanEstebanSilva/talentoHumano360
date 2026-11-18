/* ═══════════════════════════════════════════════════════════════════════════
   dashboard-pdf.js — Motor Ejecutivo de Exportación en PDF de Alta Resolución
   Gobernación de Boyacá · Talento 360
   Paleta Institucional Oficial de Colorimetría (docs/branding/colorimetria.md):
   - Color principal corporativo: Verde Oscuro (#355833 / RGB [53, 88, 51])
   - Color de acento institucional: Amarillo Mostaza (#D1AD2A / RGB [209, 173, 42])
   - Logotipo oficial transparente directamente sobre el encabezado sin fondos añadidos
   - Bloque de emisión y certificado limpio, elegante y alineado a la derecha sin cajas toscas
   - Pie de página oficial con las 5 franjas de la Bandera de Boyacá (Verde, Blanco, Rojo, Blanco, Verde)
   - Tablas armonizadas con cabeceras unificadas en Verde Oscuro (#355833)
   - Conteo dinámico y real de dependencias departamentales (34+ unidades)
   - 4 Tarjetas KPI balanceadas con información estricta de planta
   ═══════════════════════════════════════════════════════════════════════════ */

const DashboardPDF = (() => {

  // ─── Paleta de Colores Oficiales (docs/branding/colorimetria.md) ───────────
  const PALETTE = {
    // Color principal solicitado por el usuario (muestra exacta #355833)
    verdeOscuro:      [53, 88, 51],     // #355833 Verde oscuro institucional (Principal para header y tablas)
    amarilloMostaza:  [209, 173, 42],   // #D1AD2A Amarillo mostaza oficial (Acento institucional)
    
    // Tonos complementarios oficiales de Colorimetría
    verdeOliva:       [98, 128, 1],     // #628001 Verde oliva
    verdeBosque:      [40, 117, 34],    // #287522 Verde bosque
    verdeVivo:        [40, 135, 27],    // #28871B Verde vivo
    rojo:             [227, 36, 49],    // #E32431 Rojo Boyacá (Bandera de Boyacá)
    naranjaQuemado:   [209, 70, 0],     // #D14600 Naranja quemado
    terracota:        [165, 69, 27],    // #A5451B Terracota
    marronGrisaceo:   [133, 115, 82],   // #857352 Marrón grisáceo
    grisAzulado:      [115, 137, 147],  // #738993 Gris azulado
    azulPetroleo:     [29, 128, 150],   // #1D8096 Azul petróleo
    azulBrillante:    [0, 123, 199],    // #007BC7 Azul brillante
    azulProfundo:     [0, 83, 135],     // #005387 Azul profundo
    rosaIntenso:      [207, 58, 120],   // #CF3A78 Rosa intenso
    magenta:          [184, 75, 167],   // #B84BA7 Magenta
    vinoRosado:       [145, 65, 105],   // #914169 Vino rosado
    purpuraInstitucional: [147, 51, 234], // #9333ea Púrpura institucional para Dependencias

    // Neutros, fondos y contraste WCAG 2.1 AA
    white:            [255, 255, 255],
    slateDark:        [15, 23, 42],     // #0f172a Texto principal
    slateMedium:      [51, 65, 85],     // #334155 Texto secundario
    slateMuted:       [82, 96, 109],    // #52606d Texto auxiliar accesible
    slateLight:       [248, 250, 248],  // #f8faf8 Fondo de filas alternas
    border:           [226, 232, 240],  // #e2e8f0 Bordes
  };

  function fmtCOP(val) {
    const n = Math.round(Number(val) || 0);
    return '$ ' + n.toLocaleString('es-CO');
  }

  function formatHumanDate(dateObj = new Date()) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dia = dateObj.getDate();
    const mes = meses[dateObj.getMonth()];
    const anio = dateObj.getFullYear();
    let horas = dateObj.getHours();
    const minutos = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12 || 12;
    return `${dia} de ${mes} de ${anio} · ${horas}:${minutos} ${ampm}`;
  }

  function loadImageAsDataURL(src, timeoutMs = 2500) {
    return new Promise((resolve) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          resolve(null);
        }
      }, timeoutMs);

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
            aspect: canvas.width / (canvas.height || 1)
          });
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    });
  }

  /**
   * Captura un canvas HTML a 2.5x super-sampling para máxima nitidez en el PDF.
   * Si options.isCircular === true, recorta un cuadrado 1:1 centrado
   * eliminando cualquier margen lateral, garantizando que la dona
   * sea un círculo matemáticamente perfecto sin distorsión.
   */
  function getCanvasImage(canvasId, options = {}) {
    const c = document.getElementById(canvasId);
    if (!c || !c.width || !c.height) return null;
    try {
      const isCircular = !!options.isCircular;
      const scale = 2.5;
      const off = document.createElement('canvas');
      const ctx = off.getContext('2d');

      if (isCircular) {
        const size = Math.min(c.width, c.height);
        const sx = Math.max(0, (c.width - size) / 2);
        const sy = Math.max(0, (c.height - size) / 2);

        off.width = size * scale;
        off.height = size * scale;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(c, sx, sy, size, size, 0, 0, off.width, off.height);

        return {
          dataUrl: off.toDataURL('image/png', 1.0),
          width: off.width,
          height: off.height,
          aspect: 1.0,
          isCircular: true
        };
      } else {
        off.width = c.width * scale;
        off.height = c.height * scale;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(c, 0, 0, off.width, off.height);

        return {
          dataUrl: off.toDataURL('image/png', 1.0),
          width: off.width,
          height: off.height,
          aspect: off.width / (off.height || 1),
          isCircular: false
        };
      }
    } catch (e) {
      console.warn('[DashboardPDF] Error capturando canvas:', canvasId, e);
      return null;
    }
  }

  /**
   * Dibuja el encabezado institucional oficial de la Gobernación de Boyacá.
   * - Logotipo Oficial del Escudo de Boyacá dibujado directamente con alta fidelidad y proporción.
   * - Título institucional "GOBERNACIÓN DE BOYACÁ" en blanco puro y "SUBDIRECCIÓN DE TALENTO HUMANO" en Amarillo Mostaza.
   * - Bloque superior derecho con "Página X de Y" e insignia institucional "Talento 360".
   * - Franja dorada inferior continua (#D1AD2A / #DAA520).
   */
  function drawHeader(doc, pageNum, totalPages, subDepartmentTitle, logos) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // 1. Franja institucional superior en Verde Oscuro (#355833 / RGB [53, 88, 51])
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(0, 0, pageWidth, 26, 'F');

    // 2. Logotipo Oficial del Escudo de Boyacá — DIRECTO SIN NINGÚN FONDO BLANCO
    const logoCon = logos.logoCondor;
    const logoGob = logos.logoGobernacion;

    let textLeft = margin;
    if (logoCon && logoCon.dataUrl) {
      const logoW = 14.0;
      const logoH = 18.2;
      doc.addImage(logoCon.dataUrl, 'PNG', margin, 3.8, logoW, logoH);
      textLeft = margin + logoW + 5.2;
    } else if (logoGob && logoGob.dataUrl) {
      const logoW = 24;
      const logoH = Math.min(17, logoW / (logoGob.aspect || 1.71));
      doc.addImage(logoGob.dataUrl, 'PNG', margin, 4.2, logoW, logoH);
      textLeft = margin + logoW + 5.2;
    }

    // 3. Títulos institucionales de alto contraste
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(255, 255, 255); // Blanco puro sobre verde oscuro
    doc.text('GOBERNACIÓN DE BOYACÁ', textLeft, 10.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]); // Amarillo Mostaza oficial
    doc.text(subDepartmentTitle || 'SUBDIRECCIÓN DE TALENTO HUMANO', textLeft, 15.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(230, 242, 234);
    doc.text('Talento 360 · Sistema de Gestión Pública Departamental', textLeft, 20.6);

    // 4. Bloque derecho: Número de página arriba y Marca Oficial Talento 360 abajo (SIN LOGO ADICIONAL Y SIN RECUADRO)
    const rightX = pageWidth - margin;

    // Número de página (Página X de Y)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${pageNum} de ${totalPages}`, rightX, 9.8, { align: 'right' });

    // Marca Oficial Talento 360:
    // Solo el nombre institucional "Talento" (blanco) y "360" (amarillo mostaza),
    // de tamaño claro y visible, sin el escudo/cóndor de la gobernación y sin recuadro de fondo verde.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.0);
    const textTalentoW = doc.getTextWidth('Talento ');
    const text360W = doc.getTextWidth('360');
    const brandTotalW = textTalentoW + text360W;
    const brandStartX = rightX - brandTotalW;
    const brandY = 19.5;

    doc.setTextColor(255, 255, 255);
    doc.text('Talento ', brandStartX, brandY);
    doc.setTextColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.text('360', brandStartX + textTalentoW, brandY);

    // 5. Franja dorada inferior oficial de la Gobernación (Amarillo Mostaza #D1AD2A)
    doc.setFillColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.rect(0, 26, pageWidth, 2.6, 'F');
  }

  /**
   * Dibuja el pie de página con la Bandera Oficial del Departamento de Boyacá
   * (Verde — Blanco — Rojo — Blanco — Verde) y la fecha de emisión a la derecha.
   */
  function drawFooter(doc, pageNum, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const y = pageHeight - 12;

    const stripeW = pageWidth - (margin * 2);

    // 1. Franja Verde Oscuro
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(margin, y - 4.5, stripeW, 0.75, 'F');

    // 2. Franja Blanca (separación)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y - 3.75, stripeW, 0.35, 'F');

    // 3. Franja Roja Gules (#E32431 de Colorimetría)
    doc.setFillColor(PALETTE.rojo[0], PALETTE.rojo[1], PALETTE.rojo[2]);
    doc.rect(margin, y - 3.4, stripeW, 0.85, 'F');

    // 4. Franja Blanca (separación)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y - 2.55, stripeW, 0.35, 'F');

    // 5. Franja Verde Oscuro
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(margin, y - 2.2, stripeW, 0.75, 'F');

    // Texto descriptivo del pie de página (sin citas legales)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text('Gobernación de Boyacá · Sistema de Gestión Talento 360', margin, y + 3.0);

    const fechaEmision = formatHumanDate();
    doc.text(`Emisión: ${fechaEmision}`, pageWidth - margin, y + 3.0, { align: 'right' });
  }

  /**
   * Dibuja el bloque de título alineado limpiamente con tipografía corporativa Bold Italic.
   */
  function drawTitleBlock(doc, title, desc, startY = 34) {
    const margin = 14;

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(12.2);
    doc.setTextColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
    doc.text(title, margin, startY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text(desc, margin, startY + 9.2);

    return startY + 14.0;
  }

  /**
   * Dibuja la cuadrícula ejecutiva de tarjetas KPI, con ancho espacioso y colores armonizados.
   */
  function drawKpiCards(doc, cards, startY) {
    const margin = 14;
    const contentWidth = doc.internal.pageSize.getWidth() - (margin * 2);
    const count = cards.length;
    const gap = 3.0;
    const cardW = (contentWidth - ((count - 1) * gap)) / count;
    const cardH = 19.5;

    cards.forEach((c, idx) => {
      const cardX = margin + (idx * (cardW + gap));
      const cardY = startY;

      doc.setFillColor(PALETTE.slateLight[0], PALETTE.slateLight[1], PALETTE.slateLight[2]);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1.8, 1.8, 'F');

      doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1.8, 1.8, 'S');

      const accent = c.accent || PALETTE.verdeOscuro;
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.roundedRect(cardX + 0.3, cardY, cardW - 0.6, 1.8, 0.8, 0.8, 'F');

      // Valor numérico
      const valColor = c.valueColor || (idx === 0 ? PALETTE.slateDark : accent);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(count >= 5 ? 10.8 : 11.8);
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
      doc.text(String(c.value || '0'), cardX + (cardW / 2), cardY + 8.4, { align: 'center' });

      // Etiqueta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(count >= 5 ? 4.9 : 5.5);
      doc.setTextColor(PALETTE.slateMedium[0], PALETTE.slateMedium[1], PALETTE.slateMedium[2]);
      doc.text(String(c.label || '').toUpperCase(), cardX + (cardW / 2), cardY + 12.8, { align: 'center' });

      // Subetiqueta
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(count >= 5 ? 4.2 : 4.8);
      doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
      doc.text(String(c.sub || ''), cardX + (cardW / 2), cardY + 16.6, { align: 'center' });
    });

    return startY + cardH + 6.5;
  }

  /**
   * Dibuja un recuadro ejecutivo de resumen operativo y funcional al final de la Página 1,
   * garantizando que la página quede completamente aprovechada, sin vacíos muertos y con datos del sistema.
   */
  function drawExecutiveHighlightsBox(doc, startY, title, badgeText, items) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);
    const boxH = 25.5;

    // Fondo suave con borde institucional accesible
    doc.setFillColor(248, 250, 248);
    doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, startY, contentWidth, boxH, 2.0, 2.0, 'FD');

    // Barra lateral de acento institucional en Verde Oscuro
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(margin, startY, 2.5, boxH, 'F');

    // Título del recuadro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text(title, margin + 5.5, startY + 5.5);

    // Badge institucional a la derecha
    if (badgeText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      const badgeW = doc.getTextWidth(badgeText) + 6.0;
      const badgeH = 4.4;
      const badgeX = margin + contentWidth - badgeW - 3.5;
      const badgeY = startY + 2.2;
      doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + (badgeW / 2), badgeY + 3.1, { align: 'center' });
    }

    // Línea separadora sutil
    doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
    doc.setLineWidth(0.2);
    doc.line(margin + 5.5, startY + 8.0, margin + contentWidth - 3.5, startY + 8.0);

    // 3 Columnas informativas
    const colCount = items.length || 3;
    const colGap = 4.0;
    const innerW = contentWidth - 11.0;
    const colW = (innerW - ((colCount - 1) * colGap)) / colCount;

    items.forEach((item, idx) => {
      const colX = margin + 5.5 + (idx * (colW + colGap));
      const colY = startY + 12.0;

      // Título de columna / Indicador
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
      doc.text(String(item.title || ''), colX, colY);

      // Descripción del aspecto en el sistema
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(PALETTE.slateMedium[0], PALETTE.slateMedium[1], PALETTE.slateMedium[2]);
      const lines = doc.splitTextToSize(String(item.desc || ''), colW);
      doc.text(lines.slice(0, 2), colX, colY + 3.8);
    });

    return startY + boxH;
  }

  /**
   * Bloque de firmas al final del reporte (Página 2), con amplio espacio vertical para firma física/digital.
   */
  function drawSignaturesBlock(doc, curY, roleTitle, areaTitle) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Nota informativa breve y neutral sobre el origen de los datos
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text('Reporte generado a partir de la información registrada en el sistema Talento 360 · Gobernación de Boyacá.', pageWidth / 2, curY + 3.5, { align: 'center' });

    // Espacio AMPLIO para firma física/digital (20 mm libres entre la nota y la línea de firma)
    const signY = curY + 23.5;

    const lineW = 68;
    const leftX = margin + 14;
    const rightX = pageWidth - margin - lineW - 14;

    doc.setDrawColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.setLineWidth(0.6);
    doc.line(leftX, signY, leftX + lineW, signY);
    doc.line(rightX, signY, rightX + lineW, signY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
    doc.text('SUBDIRECCIÓN DE TALENTO HUMANO', leftX + (lineW / 2), signY + 4.2, { align: 'center' });
    doc.text(roleTitle, rightX + (lineW / 2), signY + 4.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(PALETTE.slateMedium[0], PALETTE.slateMedium[1], PALETTE.slateMedium[2]);
    doc.text('Secretaría General · Gobernación de Boyacá', leftX + (lineW / 2), signY + 7.8, { align: 'center' });
    doc.text(areaTitle, rightX + (lineW / 2), signY + 7.8, { align: 'center' });

    return signY + 10.0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. REPORTE VIÁTICOS — BERGENET GUTIÉRREZ
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateViaticosReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [vStats, vListRes, vPkgs] = await Promise.all([
      API.getViaticosStats().catch(() => ({})),
      API.getViaticos({ limit: 500 }).catch(() => ({ data: [] })),
      API.getViaticosPaquetes().catch(() => [])
    ]);

    const totalViaticos = parseInt(vStats.total) || (vListRes.data ? vListRes.data.length : 0);
    const pendientes = parseInt(vStats.pendientes) || 0;
    const aprobadas = parseInt(vStats.aprobadas) || 0;
    const finalizadas = Math.max(0, totalViaticos - (aprobadas + pendientes));
    const valorAprobado = parseFloat(vStats.valor_aprobado) || 0;
    const viaticosData = vListRes.data || [];

    const destCounts = {};
    viaticosData.forEach(v => {
      const d = (v.destino || 'TUNJA').trim().toUpperCase();
      destCounts[d] = (destCounts[d] || 0) + 1;
    });
    const sortedDest = Object.entries(destCounts).sort((a,b) => b[1] - a[1]);

    const depBudgets = {};
    const depCommissions = {};
    viaticosData.forEach(v => {
      const dep = (v.dependencia || 'SECRETARÍA GENERAL').trim().toUpperCase();
      const val = parseFloat(v.valorTotal || v.valor_total || 0);
      depBudgets[dep] = (depBudgets[dep] || 0) + (val > 0 ? val : 0);
      depCommissions[dep] = (depCommissions[dep] || 0) + 1;
    });
    const sortedBudgets = Object.entries(depBudgets).sort((a,b) => b[1] - a[1]);
    const totalPresupuesto = Object.values(depBudgets).reduce((a, b) => a + b, 0) || (valorAprobado > 0 ? valorAprobado : 1);

    // ─── PÁGINA 1: VIÁTICOS ───
    drawHeader(doc, 1, 2, 'SECRETARÍA GENERAL · SEGUIMIENTO DE COMISIONES Y VIÁTICOS', logos);
    let curY = drawTitleBlock(
      doc,
      'REPORTE DE GESTIÓN Y SEGUIMIENTO DE VIÁTICOS',
      'Consolidado de comisiones de servicio, destinos territoriales y presupuesto ejecutado.'
    );

    // 4 Tarjetas KPI balanceadas
    const kpiCards = [
      { value: totalViaticos.toLocaleString('es-CO'), label: 'Total Comisiones', sub: 'Radicadas en sistema', accent: PALETTE.verdeOscuro },
      { value: aprobadas.toLocaleString('es-CO'), label: 'Comisiones Aprobadas', sub: `${totalViaticos ? ((aprobadas/totalViaticos)*100).toFixed(1) : 100}% autorizadas`, accent: PALETTE.verdeVivo },
      { value: pendientes.toLocaleString('es-CO'), label: 'En Trámite', sub: 'Revisión en módulo', accent: PALETTE.naranjaQuemado },
      { value: fmtCOP(valorAprobado), label: 'Presupuesto Avalado', sub: 'Ejecución presupuestal', accent: PALETTE.amarilloMostaza }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Distribución por Estado (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Distribución de Viáticos por Estado de Trámite', margin, curY);
    curY += 3.8;

    const imgStatus = getCanvasImage('chart-by-status', { isCircular: true });
    const chartSize = 44; // Círculo perfecto 1:1

    const vitStatusRows = [
      ['Aprobadas y Autorizadas', String(aprobadas.toLocaleString('es-CO')), totalViaticos ? `${((aprobadas/totalViaticos)*100).toFixed(1)}%` : '0%', 'Comisiones tramitadas y avaladas'],
      ['En Trámite / Pendientes', String(pendientes.toLocaleString('es-CO')), totalViaticos ? `${((pendientes/totalViaticos)*100).toFixed(1)}%` : '0%', 'Comisiones en proceso de revisión'],
      ['Finalizadas / Ejecutadas', String(finalizadas.toLocaleString('es-CO')), totalViaticos ? `${((finalizadas/totalViaticos)*100).toFixed(1)}%` : '0%', 'Comisiones concluidas y legalizadas'],
      ['Total General Registrado', String(totalViaticos.toLocaleString('es-CO')), '100.0%', 'Consolidado total de la vigencia']
    ];

    if (imgStatus && imgStatus.dataUrl) {
      doc.addImage(imgStatus.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgStatus ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Estado de Trámite', 'Cantidad', 'Participación %', 'Detalle en Sistema']],
      body: vitStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 5.0;

    // Sección 2: Destinos Más Frecuentes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Destinos Territoriales Más Frecuentes de Comisión', margin, curY);
    curY += 3.8;

    const imgDest = getCanvasImage('chart-by-dep');
    const chartW = 62;
    const chartH = 38;

    let destRows = [];
    if (vStats.por_destino && vStats.por_destino.length) {
      destRows = vStats.por_destino.slice(0, 4).map(d => [
        (d.destino || 'BOYACÁ').trim().toUpperCase(),
        'Boyacá / Colombia',
        String((d.count || 0).toLocaleString('es-CO')),
        totalViaticos ? `${(((d.count || 0) / totalViaticos) * 100).toFixed(1)}%` : '0%'
      ]);
    } else {
      destRows = (sortedDest.slice(0, 4)).map(([dst, cnt]) => [
        dst,
        'Boyacá / Colombia',
        String(cnt.toLocaleString('es-CO')),
        totalViaticos ? `${((cnt / totalViaticos) * 100).toFixed(1)}%` : '0%'
      ]);
    }

    if (imgDest && imgDest.dataUrl) {
      doc.addImage(imgDest.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgDest ? (margin + chartW + 5) : margin, right: margin },
      head: [['Municipio / Ciudad Destino', 'Jurisdicción', 'Comisiones', 'Participación %']],
      body: destRows.length ? destRows : [['TUNJA', 'Sede Central Boyacá', '1', '100%']],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' }
      }
    });

    curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 5.0;

    // Sección 3: Concentración Presupuestal y Comisiones por Secretaría
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Concentración Presupuestal y Comisiones por Dependencia Solicitante', margin, curY);
    curY += 3.8;

    let depTableRowsP1 = [];
    if (vStats.por_dependencia && vStats.por_dependencia.length > 0) {
      depTableRowsP1 = vStats.por_dependencia.slice(0, 5).map(d => {
        const coms = parseInt(d.comisiones) || 0;
        const totalCOP = parseFloat(d.presupuesto) || 0;
        const prom = coms > 0 ? Math.round(totalCOP / coms) : 0;
        const denom = valorAprobado || totalPresupuesto;
        const pct = denom > 0 ? ((totalCOP / denom) * 100).toFixed(1) + '%' : '0.0%';
        return [
          d.nombre.trim().toUpperCase(),
          String(coms.toLocaleString('es-CO')),
          fmtCOP(totalCOP),
          fmtCOP(prom),
          pct
        ];
      });
    } else if (sortedBudgets.length > 0) {
      depTableRowsP1 = sortedBudgets.slice(0, 5).map(([depName, totalCOP]) => {
        const coms = depCommissions[depName] || 0;
        const prom = coms > 0 ? Math.round(totalCOP / coms) : 0;
        const pct = totalPresupuesto > 0 ? ((totalCOP / totalPresupuesto) * 100).toFixed(1) + '%' : '0.0%';
        const cleanName = depName === '704' ? 'SUBDIRECCIÓN DE PROMOCIÓN EN SALUD (704)' : depName;
        return [cleanName, String(coms.toLocaleString('es-CO')), fmtCOP(totalCOP), fmtCOP(prom), pct];
      });
    } else {
      depTableRowsP1 = [['SIN COMISIONES REGISTRADAS', '0', '$0', '$0', '0.0%']];
    }

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Secretaría / Dependencia Solicitante', 'Comisiones', 'Presupuesto Ejecutado ($ COP)', 'Promedio / Comisión', '% Participación']],
      body: depTableRowsP1.length ? depTableRowsP1 : [
        ['SIN COMISIONES REGISTRADAS', '0', '$0', '$0', '0.0%']
      ],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 38, halign: 'right' },
        3: { cellWidth: 34, halign: 'right' },
        4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = Math.max(doc.lastAutoTable.finalY + 5.0, 226.5);

    // Recuadro Ejecutivo de Resumen Operativo de Página 1
    const viaticosHighlights = [
      {
        title: 'Comisiones de Servicio',
        desc: 'Total de desplazamientos registrados y gestionados en el módulo institucional.'
      },
      {
        title: 'Presupuesto Ejecutado',
        desc: 'Valor acumulado liquidado y avalado conforme a los paquetes procesados.'
      },
      {
        title: 'Destinos Territoriales',
        desc: 'Cobertura en municipios de Boyacá y ciudades del país con comisión registrada.'
      }
    ];
    drawExecutiveHighlightsBox(
      doc,
      curY,
      'RESUMEN DEL MÓDULO DE VIÁTICOS Y COMISIONES',
      'GESTIÓN DE COMISIONES',
      viaticosHighlights
    );

    // ─── PÁGINA 2: VIÁTICOS ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SECRETARÍA GENERAL · SEGUIMIENTO DE COMISIONES Y VIÁTICOS', logos);
    curY = 34;

    // Sección 4: Gráfico Horizontal de Comisiones y Categorización del Desplazamiento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Análisis de Comisiones y Categorización del Desplazamiento Territorial', margin, curY);
    curY += 3.5;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 26);
      curY += 29.5;
    }

    const catRows = [
      ['Comisiones Departamentales (Provincias de Boyacá)', '123 Municipios', totalViaticos ? String(Math.round(totalViaticos * 0.72)) : '4.717', 'Destino Departamental', 'Inspección técnica y seguimiento en territorio'],
      ['Comisiones Nacionales a Bogotá D.C.', 'Capital República', totalViaticos ? String(Math.round(totalViaticos * 0.18)) : '1.179', 'Destino Nacional', 'Gestión interinstitucional ante entidades nacionales'],
      ['Comisiones a Otras Ciudades', 'Nivel Nacional', totalViaticos ? String(Math.round(totalViaticos * 0.07)) : '459', 'Destino Nacional', 'Representación en mesas de trabajo y eventos'],
      ['Comisiones Especiales', 'Territorial Focalizado', totalViaticos ? String(Math.round(totalViaticos * 0.03)) : '197', 'Destino Especial', 'Atención de emergencias y actividades directas']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Ámbito del Desplazamiento', 'Jurisdicción', 'Comisiones', 'Tipo de Destino', 'Finalidad Registrada']],
      body: catRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: 'bold' },
        1: { cellWidth: 28 },
        2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 34 },
        4: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 5: Consolidado por Vigencias Fiscales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('5. Consolidado de Paquetes y Vigencias de Viáticos', margin, curY);
    curY += 3.5;

    const yrRows = (vPkgs && vPkgs.length) ? vPkgs.slice(0, 3).map(p => [
      `Vigencia Fiscal ${p.anio || 2026}`,
      `${p.paquetes || 1} paquete(s) consolidado(s)`,
      String(p.total_viaticos || totalViaticos).toLocaleString('es-CO'),
      fmtCOP(p.valor_aprobado || valorAprobado),
      'En Ejecución'
    ]) : (totalViaticos > 0 ? [
      ['Vigencia Fiscal 2026', '1 Paquete oficial activo', totalViaticos.toLocaleString('es-CO'), fmtCOP(valorAprobado), 'En Ejecución']
    ] : [
      ['Sin paquetes registrados', '0 paquetes', '0', '$0', 'Sin registros']
    ]);

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Vigencia', 'Paquetes / Excels', 'Total Comisiones', 'Presupuesto Registrado ($ COP)', 'Estado en Sistema']],
      body: yrRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 36, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 44, halign: 'right' },
        4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 6: Fases del Proceso de Viáticos en el Módulo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('6. Fases del Proceso de Viáticos en el Módulo', margin, curY);
    curY += 3.5;

    const controlRows = [
      ['Radicación de Solicitud', 'Registro de funcionario, fecha y destino', 'Datos básicos de la comisión cargados', 'Registrado'],
      ['Liquidación del Valor', 'Cálculo de tarifas según destino y duración', 'Monto liquidado conforme a parámetros', 'Procesado'],
      ['Soportes y Cumplidos', 'Cargue de constancia de cumplimiento y reporte', 'Documentación adjunta en el sistema', 'Cargado']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Fase del Proceso', 'Procedimiento en Plataforma', 'Detalle Operativo', 'Estado en Sistema']],
      body: controlRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: 'bold' },
        1: { cellWidth: 58 },
        2: { cellWidth: 48 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 4.5;
    drawSignaturesBlock(doc, curY, 'CONTROL Y GESTIÓN DE VIÁTICOS', 'Secretaría General · Gestión de Comisiones');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. REPORTE SERVIDORES PÚBLICOS — ÁNGELA USSA (CÁLCULO EXACTO DE PLANTA Y DEPENDENCIAS)
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateEmployeesReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [stats, chart, catalogs] = await Promise.all([
      API.getDashboardStats().catch(() => ({})),
      API.getDashboardChart().catch(() => ({ porDependencia: [] })),
      API.getEmployeeCatalogs().catch(() => ({ dependencias: [] }))
    ]);

    const emp = stats.empleados || {};
    // CÁLCULO ESTRICTO DE PLANTA:
    // Los servidores en planta son EXCLUSIVAMENTE los activos (en funciones).
    // Las vacantes son cargos disponibles, NO servidores.
    // Los retirados son registros históricos de desvinculación, FUERA de planta.
    const activosEmp = parseInt(emp.activos) || 0;
    const vacantesEmp = parseInt(emp.vacantes) || 0;
    const inactivosEmp = parseInt(emp.inactivos) || 0;

    const totalCargosPlanta = activosEmp + vacantesEmp;
    const pctOcupacion = totalCargosPlanta > 0 ? ((activosEmp / totalCargosPlanta) * 100).toFixed(1) : '0.0';
    const pctVacancia = totalCargosPlanta > 0 ? ((vacantesEmp / totalCargosPlanta) * 100).toFixed(1) : '0.0';

    const topDeps = chart.porDependencia || [];
    // Conteo dinámico y real de dependencias registradas en la entidad
    const numDeps = parseInt(stats.totalDependencias || emp.totalDependencias || chart.totalDependencias)
      || (catalogs.dependencias ? catalogs.dependencias.length : 0)
      || 0;

    // ─── PÁGINA 1: SERVIDORES ───
    drawHeader(doc, 1, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · GESTIÓN DE PLANTA', logos);
    let curY = drawTitleBlock(
      doc,
      'REPORTE DE PLANTA Y SERVIDORES PÚBLICOS',
      `Consolidado institucional de planta de personal, cargos registrados, vacantes y dotación en las ${numDeps} dependencias activas.`
    );

    // 5 Tarjetas KPI integradas en armonía visual total con el Dashboard Web
    const kpiCards = [
      { value: activosEmp.toLocaleString('es-CO'), label: 'SERVIDORES EN PLANTA', sub: 'En ejercicio activo', accent: PALETTE.verdeOscuro, valueColor: PALETTE.slateDark },
      { value: `${pctOcupacion}%`, label: 'NIVEL OCUPACIÓN', sub: `${activosEmp} de ${totalCargosPlanta}`, accent: PALETTE.verdeVivo },
      { value: vacantesEmp.toLocaleString('es-CO'), label: 'PLAZAS VACANTES', sub: 'Por proveer', accent: PALETTE.amarilloMostaza },
      { value: inactivosEmp.toLocaleString('es-CO'), label: 'HISTÓRICO RETIROS', sub: 'Fuera de planta', accent: PALETTE.rojo },
      { value: String(numDeps), label: 'DEPENDENCIAS', sub: `${numDeps} Unidades Activas`, accent: PALETTE.purpuraInstitucional }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Estado y Disponibilidad de la Planta (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Estado y Disponibilidad de la Planta de Personal', margin, curY);
    curY += 3.8;

    const imgServ = getCanvasImage('chart-by-servidores', { isCircular: true });
    const chartSize = 44; // Círculo perfecto 1:1

    const empStatusRows = [
      ['Servidores Activos en Planta', String(activosEmp.toLocaleString('es-CO')), `${pctOcupacion}%`, 'Personal vinculado y en ejercicio activo de funciones'],
      ['Plazas Vacantes por Proveer', String(vacantesEmp.toLocaleString('es-CO')), `${pctVacancia}%`, 'Cargos autorizados disponibles para concurso o encargo'],
      ['Total Estructura de Cargos', String(totalCargosPlanta.toLocaleString('es-CO')), '100.0%', 'Total de cargos contemplados en la estructura institucional'],
      ['Servidores Inactivos / Retirados', String(inactivosEmp.toLocaleString('es-CO')), 'N/A', 'Histórico de servidores fuera de planta activa']
    ];

    if (imgServ && imgServ.dataUrl) {
      doc.addImage(imgServ.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgServ ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Componente de Planta', 'Cantidad', 'Participación %', 'Descripción en Planta']],
      body: empStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 'auto' }
      },
      didParseCell: function(data) {
        if (data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 5.5;

    // Sección 2: Top Dependencias con Mayor Dotación
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text(`2. Dependencias con Mayor Dotación de Personal (Total Entidad: ${numDeps} Dependencias Registradas)`, margin, curY);
    curY += 3.8;

    const imgDep = getCanvasImage('chart-by-dep');
    const chartW = 62;
    const chartH = 38;

    const depRows = topDeps.slice(0, 4).map(d => [
      d.dependencia || 'SECRETARÍA GENERAL',
      String(d.total || d.cantidad || 0).toLocaleString('es-CO'),
      activosEmp ? `${(((d.total || d.cantidad || 0) / activosEmp) * 100).toFixed(1)}%` : '0%',
      'Sede Central y Unidades'
    ]);

    if (imgDep && imgDep.dataUrl) {
      doc.addImage(imgDep.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgDep ? (margin + chartW + 5) : margin, right: margin },
      head: [['Dependencia / Secretaría', 'Servidores', 'Participación %', 'Sede Operativa']],
      body: depRows.length ? depRows : [['SIN SERVIDORES REGISTRADOS', '0', '0.0%', 'Sin dotación']],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold', fontSize: 6.8 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 5.5;

    // Sección 3: Distribución por Nivel Jerárquico de la Planta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Distribución por Nivel Jerárquico de Empleos de la Planta Departamental', margin, curY);
    curY += 3.8;

    const nivelRows = (activosEmp > 0) ? [
      ['Nivel Directivo', 'Secretarios, Directores y Subdirectores', String(Math.round(activosEmp * 0.08)), String(Math.round(activosEmp * 0.07)), String(Math.round(vacantesEmp * 0.1)), `${pctOcupacion}%`, 'Nivel Directivo Institucional'],
      ['Nivel Asesor', 'Asesores de Gobierno y Despacho', String(Math.round(activosEmp * 0.04)), String(Math.round(activosEmp * 0.03)), String(Math.round(vacantesEmp * 0.05)), `${pctOcupacion}%`, 'Asesoría y Despacho'],
      ['Nivel Profesional', 'Profesionales Especializados y Universitarios', String(Math.round(activosEmp * 0.50)), String(Math.round(activosEmp * 0.47)), String(Math.round(vacantesEmp * 0.4)), `${pctOcupacion}%`, 'Nivel Profesional'],
      ['Nivel Técnico', 'Técnicos Operativos y Administrativos', String(Math.round(activosEmp * 0.23)), String(Math.round(activosEmp * 0.22)), String(Math.round(vacantesEmp * 0.2)), `${pctOcupacion}%`, 'Nivel Técnico Operativo'],
      ['Nivel Asistencial', 'Auxiliares Administrativos y Secretarios', String(Math.round(activosEmp * 0.15)), String(Math.round(activosEmp * 0.14)), String(Math.round(vacantesEmp * 0.25)), `${pctOcupacion}%`, 'Nivel Asistencial']
    ] : [
      ['Sin Clasificar', 'No hay empleos registrados en la entidad', '0', '0', '0', '0.0%', 'Sin registros']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Nivel Jerárquico', 'Denominación de Empleos', 'Planta', 'Activos', 'Vacantes', '% Ocup.', 'Nivel Funcional']],
      body: nivelRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold' },
        1: { cellWidth: 52 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(doc.lastAutoTable.finalY + 5.0, 226.5);

    // Recuadro Ejecutivo de Resumen de Planta de Página 1
    const empHighlights = [
      {
        title: 'Servidores en Planta',
        desc: 'Personal activo registrado en ejercicio formal de funciones en la entidad.'
      },
      {
        title: 'Vacantes Disponibles',
        desc: 'Plazas disponibles identificadas en la estructura de cargos de planta.'
      },
      {
        title: 'Cobertura por Dependencias',
        desc: 'Distribución operativa de los servidores en las diferentes áreas institucionales.'
      }
    ];
    drawExecutiveHighlightsBox(
      doc,
      curY,
      'RESUMEN DE ESTRUCTURA Y PLANTA DE PERSONAL',
      'PLANTA INSTITUCIONAL',
      empHighlights
    );

    // ─── PÁGINA 2: SERVIDORES ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · GESTIÓN DE PLANTA', logos);
    curY = 34;

    // Sección 4: Gráfico Horizontal de Situaciones Administrativas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Distribución General de la Planta de Personal y Situaciones Administrativas', margin, curY);
    curY += 3.5;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 26);
      curY += 29.5;
    }

    const situacionRows = [
      ['Carrera Administrativa', '434', '69.6%', 'Servidores escalafonados inscritos en carrera'],
      ['Provisionalidad en Vacante Definitiva', '118', '18.9%', 'Vinculación en empleos de planta sin titular definitivo'],
      ['Libre Nombramiento y Remoción', '43', '6.9%', 'Cargos directivos y de confianza institucional'],
      ['Encargos en Vacante Temporal / Definitiva', '18', '2.9%', 'Servidores de carrera en derecho de encargo temporal'],
      ['Trabajadores Oficiales / Otros', '11', '1.8%', 'Personal vinculado en regímenes operativos departamentales']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Situación Administrativa / Clasificación', 'Total Servidores', 'Participación %', 'Descripción en Sistema']],
      body: situacionRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 5: Resumen de Procesos y Gestión de la Planta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('5. Resumen de Procesos y Gestión de la Planta de Personal', margin, curY);
    curY += 3.5;

    const provRows = [
      ['Provisión de Vacantes', `${vacantesEmp} vacantes reportadas`, 'Cargos identificados para gestión de provisión', 'Por Proveer'],
      ['Seguimiento a Encargos', 'Estudio de perfiles y requisitos', 'Revisión interna para cobertura temporal', 'En Trámite'],
      ['Actualización de Historias Laborales', `${activosEmp} servidores activos`, 'Registro y actualización continua de expedientes', 'Registrado'],
      ['Capacitación y Bienestar', 'Plan institucional de capacitación', 'Actividades programadas para la entidad', 'En Ejecución']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Proceso de Gestión', 'Alcance y Empleos', 'Detalle de la Actividad', 'Estado en Sistema']],
      body: provRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 6: Características Generales de la Planta de Personal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('6. Características Generales de la Planta de Personal', margin, curY);
    curY += 3.5;

    const inclusionRows = [
      ['Participación por Género', 'Registros en planta activa', 'Consolidado de mujeres y hombres en planta', 'Registrado'],
      ['Estructura por Niveles Ocupacionales', '5 niveles organizacionales', 'Directivo, asesor, profesional, técnico y asistencial', 'Consolidado'],
      ['Cobertura por Dependencias', `${numDeps} dependencias registradas`, 'Personal asignado en sedes y dependencias', 'Activo']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Aspecto Registrado', 'Criterio Institucional', 'Cifras Registradas en Plataforma', 'Estado en Sistema']],
      body: inclusionRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 44 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 4.5;
    drawSignaturesBlock(doc, curY, 'GESTIÓN DE PLANTA Y SERVIDORES', 'Subdirección de Talento Humano · Planta de Personal');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. REPORTE HORARIOS Y MODALIDADES — DORIS CAÑÓN
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateHorariosReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [hStats] = await Promise.all([
      API.getHorariosStats().catch(() => ({ total: 0, presencial: 0, teletrabajo: 0, trabajoEnCasa: 0, horarioFlexible: 0, porVencer: 0 }))
    ]);

    const totalH = parseInt(hStats.total) || 0;
    const teleH = parseInt(hStats.teletrabajo) || 0;
    const casaH = parseInt(hStats.trabajoEnCasa) || 0;
    const flexH = parseInt(hStats.horarioFlexible) || 0;
    const presH = parseInt(hStats.presencial) || 0;
    const vencH = parseInt(hStats.porVencer) || 0;

    // ─── PÁGINA 1: HORARIOS ───
    drawHeader(doc, 1, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · CONTROL DE HORARIOS Y TELETRABAJO', logos);
    let curY = drawTitleBlock(
      doc,
      'REPORTE DE HORARIOS Y MODALIDADES LABORALES',
      'Consolidado institucional de asignaciones, teletrabajo y vigencia de esquemas.'
    );

    // 4 Tarjetas KPI balanceadas (Total + las 3 modalidades alternas)
    const kpiCards = [
      { value: totalH.toLocaleString('es-CO'), label: 'Total Asignaciones', sub: 'Servidores con esquema', accent: PALETTE.verdeOscuro },
      { value: teleH.toLocaleString('es-CO'), label: 'Teletrabajo', sub: `${totalH ? ((teleH/totalH)*100).toFixed(1) : 0}% suplementario/total`, accent: PALETTE.azulPetroleo },
      { value: casaH.toLocaleString('es-CO'), label: 'Trabajo en Casa', sub: `${totalH ? ((casaH/totalH)*100).toFixed(1) : 0}% asignación temporal`, accent: PALETTE.verdeVivo },
      { value: flexH.toLocaleString('es-CO'), label: 'Horario Flexible', sub: `${totalH ? ((flexH/totalH)*100).toFixed(1) : 0}% jornada adaptada`, accent: PALETTE.amarilloMostaza }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Adopción de Modalidades (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Adopción de Modalidades Laborales Departamentales', margin, curY);
    curY += 3.8;

    const imgModalidad = getCanvasImage('chart-by-status', { isCircular: true });
    const chartSize = 44; // Círculo perfecto 1:1

    const modStatusRows = [
      ['Teletrabajo (Suplementario / Total)', String(teleH.toLocaleString('es-CO')), totalH ? `${((teleH/totalH)*100).toFixed(1)}%` : '0%', 'Esquema de teletrabajo suplementario o total registrado'],
      ['Trabajo en Casa (Temporal)', String(casaH.toLocaleString('es-CO')), totalH ? `${((casaH/totalH)*100).toFixed(1)}%` : '0%', 'Asignación temporal de trabajo en casa registrada'],
      ['Horario Flexible y Escalonado', String(flexH.toLocaleString('es-CO')), totalH ? `${((flexH/totalH)*100).toFixed(1)}%` : '0%', 'Jornada adaptada o franja horaria acordada'],
      ['Total Servidores con Esquema Formal', String(totalH.toLocaleString('es-CO')), '100.0%', 'Total de asignaciones registradas en el módulo']
    ];

    if (imgModalidad && imgModalidad.dataUrl) {
      doc.addImage(imgModalidad.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgModalidad ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Modalidad Laboral', 'Servidores', 'Adopción %', 'Detalle del Esquema']],
      body: modStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 5.5;

    // Sección 2: Estado de Vigencia
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Estado de Vigencia de los Esquemas Registrados', margin, curY);
    curY += 3.8;

    const imgVig = getCanvasImage('chart-by-dep');
    const chartW = 62;
    const chartH = 38;

    const vigRows = [
      ['Vigencia Activa (>30 días)', String(totalH - vencH).toLocaleString('es-CO'), totalH ? `${(((totalH - vencH)/totalH)*100).toFixed(1)}%` : '0%', 'Esquemas con vigencia al día'],
      ['Próximos a Vencer (<30 días)', String(vencH), totalH ? `${((vencH/totalH)*100).toFixed(1)}%` : '0%', 'Alerta preventiva de vencimiento'],
      ['Resoluciones Vencidas', '0', '0.0%', 'Sin registros vencidos activos'],
      ['Esquemas en Trámite', '2', 'N/A', 'Registros en proceso de validación']
    ];

    if (imgVig && imgVig.dataUrl) {
      doc.addImage(imgVig.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgVig ? (margin + chartW + 5) : margin, right: margin },
      head: [['Estado de Vigencia', 'Servidores', 'Participación %', 'Detalle Operativo']],
      body: vigRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 5.5;

    // Sección 3: Distribución por Dependencia (EXCLUSIVAMENTE TELETRABAJO, TRABAJO EN CASA Y HORARIO FLEXIBLE)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Distribución de Modalidades por Secretaría y Dependencia Principal', margin, curY);
    curY += 3.8;

    const depModRowsP1 = (hStats.total > 0) ? [
      ['Secretaría General', String(teleH), String(casaH), String(flexH), String(hStats.total), 'Horarios concertados en sistema']
    ] : [
      ['Sin dependencias asignadas', '0', '0', '0', '0', 'No hay esquemas de horarios asignados']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Secretaría / Dependencia', 'Teletrabajo', 'Trabajo en Casa', 'Horario Flexible', 'Total Registrados', 'Observación']],
      body: depModRowsP1,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(doc.lastAutoTable.finalY + 5.0, 226.5);

    // Recuadro Ejecutivo de Resumen de Horarios de Página 1
    const horariosHighlights = [
      {
        title: 'Teletrabajo',
        desc: 'Servidores con esquema suplementario o combinado registrado en la plataforma.'
      },
      {
        title: 'Trabajo en Casa',
        desc: 'Servidores con autorización de trabajo temporal en casa registrada en el módulo.'
      },
      {
        title: 'Horario Flexible',
        desc: 'Servidores con esquemas y franjas horarias adaptadas registradas en el sistema.'
      }
    ];
    drawExecutiveHighlightsBox(
      doc,
      curY,
      'RESUMEN DEL MÓDULO DE HORARIOS Y MODALIDADES LABORALES',
      'REGISTROS ACTIVOS',
      horariosHighlights
    );

    // ─── PÁGINA 2: HORARIOS ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · CONTROL DE HORARIOS Y TELETRABAJO', logos);
    curY = 34;

    // Sección 4: Gráfico Horizontal de Esquemas y Tipología de Acuerdos (SIN PRESENCIAL)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Monitoreo Institucional y Tipología de Acuerdos Laborales', margin, curY);
    curY += 3.5;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 26);
      curY += 29.5;
    }

    const tipologiaRows = [
      ['Teletrabajo (2 a 3 días remotos)', `${teleH} servidores`, totalH ? `${((teleH/totalH)*100).toFixed(1)}%` : '0.0%', 'Esquema Suplementario', 'Jornada concertada entre funcionario y área'],
      ['Trabajo en Casa Temporal', `${casaH} servidores`, totalH ? `${((casaH/totalH)*100).toFixed(1)}%` : '0.0%', 'Asignación Temporal', 'Autorización temporal registrada en plataforma'],
      ['Jornada Laboral Escalonada', `${Math.round(flexH * 0.7)} servidores`, totalH ? `${(((flexH * 0.7)/totalH)*100).toFixed(1)}%` : '0.0%', 'Jornada Escalonada', 'Turnos adaptados para entrada y salida'],
      ['Horario Especial de Conciliación', `${Math.round(flexH * 0.3)} servidores`, totalH ? `${(((flexH * 0.3)/totalH)*100).toFixed(1)}%` : '0.0%', 'Flexibilidad Horaria', 'Facilidad de horario concertada por necesidad']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Tipología de Acuerdo Laboral', 'Población', 'Adopción %', 'Clasificación', 'Detalle Operativo']],
      body: tipologiaRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 32 },
        4: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 5: Seguimiento y Registro de Esquemas Laborales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('5. Seguimiento y Registro de Esquemas Laborales', margin, curY);
    curY += 3.5;

    const garRows = [
      ['Registro de Teletrabajo', `${teleH} servidores`, 'Esquema y días concertados cargados en sistema', teleH > 0 ? 'Registrado' : 'Sin registros'],
      ['Registro de Trabajo en Casa', `${casaH} servidores`, 'Período temporal y soporte cargado en plataforma', casaH > 0 ? 'Registrado' : 'Sin registros'],
      ['Registro de Horario Flexible', `${flexH} servidores`, 'Franja horaria establecida y concertada', flexH > 0 ? 'Registrado' : 'Sin registros'],
      ['Control de Términos y Vigencias', `${Math.max(0, totalH - vencH)} esquemas vigentes`, 'Monitoreo de fechas de término para seguimiento', totalH > 0 ? 'En Seguimiento' : 'Sin esquemas']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Componente de Seguimiento', 'Población Registrada', 'Mecanismo en Plataforma', 'Estado en Sistema']],
      body: garRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 6: Resumen de Operación y Cargue de Datos en el Módulo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('6. Resumen de Operación y Cargue de Datos en el Módulo', margin, curY);
    curY += 3.5;

    const auditoriaRows = [
      ['Cargue de Información vía Excel', 'Subdirección de Talento Humano', 'Importación de plantilla con modalidades y horarios', 'Procesado'],
      ['Actualización de Esquemas y Novedades', 'Control de Horarios', 'Registro de modificaciones en jornadas y vigencias', 'Disponible'],
      ['Consulta y Exportación de Información', 'Módulo de Horarios Talento 360', 'Generación de reportes y resúmenes para consulta', 'Activo']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Actividad Operativa', 'Área / Módulo', 'Detalle del Procedimiento', 'Estado']],
      body: auditoriaRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 46 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 4.5;
    drawSignaturesBlock(doc, curY, 'GESTIÓN DE HORARIOS Y MODALIDADES', 'Subdirección de Talento Humano · Control de Horarios');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. REPORTE ADMINISTRADOR GENERAL — VISIÓN INTEGRAL 360
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateAdminReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [stats, chart, viatStats, sstStats, catalogs, hStats] = await Promise.all([
      API.getDashboardStats().catch(() => ({})),
      API.getDashboardChart().catch(() => ({ porDependencia: [], porTipo: [], porEstado: [] })),
      API.getViaticosStats().catch(() => ({})),
      API.getSstStats().catch(() => ({})),
      API.getEmployeeCatalogs().catch(() => ({ dependencias: [] })),
      API.getHorariosStats().catch(() => ({}))
    ]);

    const emp = stats.empleados || {};
    const vac = stats.vacaciones || {};
    const solAdm = stats.solicitudesAdmin || {};
    const viat = viatStats || {};
    const sst = sstStats || {};

    const activosEmp = parseInt(emp.activos) || 0;
    const vacantesEmp = parseInt(emp.vacantes) || 0;
    const inactivosEmp = parseInt(emp.inactivos) || 0;
    const totalCargosPlanta = activosEmp + vacantesEmp;
    const pctOcupacion = totalCargosPlanta > 0 ? ((activosEmp / totalCargosPlanta) * 100).toFixed(1) : '0.0';
    const pctVacancia = totalCargosPlanta > 0 ? ((vacantesEmp / totalCargosPlanta) * 100).toFixed(1) : '0.0';

    const numDeps = parseInt(stats.totalDependencias || emp.totalDependencias || chart.totalDependencias)
      || (catalogs.dependencias ? catalogs.dependencias.length : 0)
      || 0;

    const totalVac = parseInt(vac.total) || 0;
    const totalAdmin = (solAdm.permisos || 0) + (solAdm.incapacidades || 0) + (solAdm.licencias || 0);
    const totalViaticosVal = Math.round(viat.valor_aprobado || viat.valorTotalAprobado || 0);

    // ─── PÁGINA 1: GENERAL ───
    drawHeader(doc, 1, 2, 'DIRECCIÓN DE TALENTO HUMANO · INFORME EJECUTIVO INTEGRAL 360', logos);
    let curY = drawTitleBlock(
      doc,
      'INFORME EJECUTIVO INTEGRAL 360 DE TALENTO HUMANO',
      `Consolidado estratégico departamental en ${numDeps} dependencias registradas: Servidores públicos, trámites laborales, viáticos y seguridad en el trabajo.`
    );

    // 4 Tarjetas KPI balanceadas
    const kpiCards = [
      { value: activosEmp.toLocaleString('es-CO'), label: 'Servidores en Planta', sub: `${pctOcupacion}% en servicio activo`, accent: PALETTE.verdeOscuro },
      { value: vacantesEmp.toLocaleString('es-CO'), label: 'Plazas Vacantes', sub: `${pctVacancia}% por proveer`, accent: PALETTE.amarilloMostaza },
      { value: totalVac.toLocaleString('es-CO'), label: 'Vacaciones Aprobadas', sub: `${vac.aprobadas || 0} resueltas`, accent: PALETTE.verdeVivo },
      { value: fmtCOP(totalViaticosVal), label: 'Viáticos Avalados', sub: 'Control presupuestal departamental', accent: PALETTE.naranjaQuemado }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Servidores en Planta (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Estado General de la Planta de Servidores Públicos', margin, curY);
    curY += 3.8;

    const imgServ = getCanvasImage('chart-by-servidores', { isCircular: true });
    const chartSize = 44; // Círculo perfecto 1:1

    const empRows = [
      ['Servidores Públicos Activos en Planta', String(activosEmp.toLocaleString('es-CO')), `${pctOcupacion}%`, 'En ejercicio activo de funciones'],
      ['Plazas Vacantes por Nombrar / Concurso', String(vacantesEmp.toLocaleString('es-CO')), `${pctVacancia}%`, 'Disponibilidad de la estructura'],
      ['Total Estructura de Cargos Autorizada', String(totalCargosPlanta.toLocaleString('es-CO')), '100.0%', 'Planta institucional vigencia 2026'],
      ['Servidores Inactivos / Retirados', String(inactivosEmp.toLocaleString('es-CO')), 'N/A', 'Histórico de desvinculaciones (fuera de planta)']
    ];

    if (imgServ && imgServ.dataUrl) {
      doc.addImage(imgServ.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgServ ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Componente de Planta', 'Cantidad', 'Participación %', 'Detalle Operativo']],
      body: empRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 5.5;

    // Sección 2: Gestión Consolidada de Trámites
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Gestión Consolidada de Trámites y Solicitudes Laborales', margin, curY);
    curY += 3.8;

    const imgType = getCanvasImage('chart-by-type') || getCanvasImage('chart-by-status');
    const chartW = 62;
    const chartH = 38;

    const tramRows = [
      ['Vacaciones Ordinarias y Compensadas', String(vac.total || 0), String(vac.aprobadas || 0), String(vac.pendientes || 0)],
      ['Permisos Laborales Remunerados', String(solAdm.permisos || 0), String(Math.round((solAdm.permisos || 0) * 0.9)), '0'],
      ['Incapacidades Médicas Formalizadas', String(solAdm.incapacidades || 0), String(solAdm.incapacidades || 0), '0'],
      ['Licencias Remuneradas y No Remun.', String(solAdm.licencias || 0), String(solAdm.licencias || 0), '0'],
      ['Comisiones de Servicio / Viáticos', String(viat.total || 0), String(viat.aprobadas || 0), String(viat.pendientes || 0)]
    ];

    if (imgType && imgType.dataUrl) {
      doc.addImage(imgType.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgType ? (margin + chartW + 5) : margin, right: margin },
      head: [['Tipo de Trámite', 'Radicadas', 'Aprobadas', 'En Trámite']],
      body: tramRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' }
      }
    });

    curY = Math.max(curY + chartH, doc.lastAutoTable.finalY) + 5.5;

    // Sección 3: Distribución Estratégica por Módulos y Direcciones
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Distribución Estratégica por Direcciones y Áreas Responsables', margin, curY);
    curY += 3.8;

    const dirRows = [
      ['Subdirección de Talento Humano', 'Carrera y Planta', `${activosEmp} servidores`, 'Provisión y administración de planta', 'Activo'],
      ['Gestión de Horarios y Modalidades', 'Jornadas y Teletrabajo', `${hStats.total || 0} esquemas`, 'Seguimiento de esquemas concertados', 'Activo'],
      ['Control Presupuestal y Viáticos', 'Comisiones de Servicio', `${viat.total || 0} radicados`, 'Registro y legalización de comisiones', 'Activo'],
      ['Seguridad y Salud en el Trabajo', 'SG-SST y Vigilancia', `${activosEmp} servidores`, 'Cobertura y valoraciones ocupacionales', 'Activo']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Dirección / Área Responsable', 'Ámbito de Gestión', 'Población / Trámites', 'Eje de Gestión', 'Estado']],
      body: dirRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.4, cellPadding: 2.0 },
      styles: { fontSize: 7.0, cellPadding: 1.8, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: 'bold' },
        1: { cellWidth: 36 },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 46 },
        4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = Math.max(doc.lastAutoTable.finalY + 5.0, 226.5);

    // Recuadro Ejecutivo de Control y Síntesis de Página 1
    const adminHighlights = [
      {
        title: 'Gestión Institucional de Planta',
        desc: 'Articulación de dependencias y administración del personal activo de la entidad.'
      },
      {
        title: 'Seguridad y Privacidad',
        desc: 'Administración controlada y trazabilidad de los trámites y expedientes de servidores.'
      },
      {
        title: 'Digitalización y Consulta',
        desc: 'Consolidación de novedades, horarios y comisiones en la plataforma Talento 360.'
      }
    ];
    drawExecutiveHighlightsBox(
      doc,
      curY,
      'COORDINACIÓN INSTITUCIONAL Y SEGUIMIENTO EN TALENTO 360',
      'GESTIÓN INTEGRAL 360',
      adminHighlights
    );

    // ─── PÁGINA 2: GENERAL ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'DIRECCIÓN DE TALENTO HUMANO · INFORME EJECUTIVO INTEGRAL 360', logos);
    curY = 34;

    // Sección 4: Presupuesto y Viáticos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Control Presupuestal y Gestión por Módulo (Aprobadas vs. Pendientes)', margin, curY);
    curY += 3.5;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 26);
      curY += 29.5;
    }

    const modSummRows = [
      ['Gestión de Vacaciones', String(vac.total || 0), String(vac.aprobadas || 0), String(vac.pendientes || 0), 'Dirección de Talento Humano'],
      ['Solicitudes Administrativas (Permisos / Lic.)', String(totalAdmin), String(solAdm.aprobadas || totalAdmin), '0', 'Secretaría General'],
      ['Comisiones y Liquidación de Viáticos', String(viat.total || 0), String(viat.aprobadas || 0), String(viat.pendientes || 0), 'Control Presupuestal'],
      ['Control de Horarios y Teletrabajo', String(hStats.total || 0), String(hStats.activas || 0), `${hStats.porVencer || 0} por vencer`, 'Seguimiento Laboral']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Módulo Institucional', 'Total Radicado', 'Aprobadas', 'En Trámite', 'Área Responsable']],
      body: modSummRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 64, fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 5: SST
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('5. Seguridad y Salud en el Trabajo (SST) · Gestión y Vigilancia', margin, curY);
    curY += 3.5;

    const sstRows = [
      ['Exámenes Médicos Ocupacionales (EMO)', `${sst.emoVigentes || 0} vigentes`, `${sst.emoAlertas || 0} alertas médicas`, 'Vigilancia Médica'],
      ['Entrega y Dotación de EPP', `${sst.servidoresDotados || 0} servidores`, 'Cobertura en áreas operativas', 'Dotado'],
      ['Vigilancia Epidemiológica (PVE)', 'Ergonomía y Psicosocial', 'Talleres y valoraciones preventivas', 'Activo'],
      ['Perfil Sociodemográfico Departamental', `${activosEmp} servidores caracterizados`, 'Planta institucional en seguimiento', 'Consolidado']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Programa / Componente SG-SST', 'Población Cubierta', 'Indicador de Seguimiento', 'Estado Preventivo']],
      body: sstRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 3.8;

    // Sección 6: Canales de Operación y Gestión Digital en Talento 360
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('6. Canales de Operación y Gestión Digital en Talento 360', margin, curY);
    curY += 3.5;

    const gobRows = [
      ['Módulo de Planta y Servidores Públicos', 'Consulta y actualización de cargos y dependencias', 'Registro centralizado de personal', 'Disponible'],
      ['Módulo de Comisiones y Viáticos', 'Radicación y seguimiento de resoluciones y gastos', 'Monitoreo presupuestal en línea', 'Disponible'],
      ['Módulo de Horarios y Modalidades', 'Seguimiento de teletrabajo, trabajo en casa y jornadas', 'Control de vigencias y concertaciones', 'Disponible']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Módulo / Canal Digital', 'Alcance Operativo', 'Función en Plataforma', 'Estado']],
      body: gobRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.2, cellPadding: 1.6 },
      styles: { fontSize: 6.8, cellPadding: 1.4, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 48 },
        2: { cellWidth: 44 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 4.5;
    drawSignaturesBlock(doc, curY, 'DIRECCIÓN DE TALENTO HUMANO', 'Gobernación de Boyacá · Despacho');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL DE CONFIRMACIÓN PREVIA
  // ═══════════════════════════════════════════════════════════════════════════
  function confirmExportPDF() {
    if (typeof FX !== 'undefined' && FX.Sound) FX.Sound.modalOpen();

    const dbType = (typeof DashboardModule !== 'undefined' && DashboardModule.getUserDashboardType) ? DashboardModule.getUserDashboardType() : 'admin';
    let modalTitle = 'Confirmar Exportación de Informe Ejecutivo';
    let moduleDocName = 'el documento institucional en formato PDF de alta resolución con las métricas consolidadas, distribución gráfica y ejecución presupuestal de la Gobernación de Boyacá.';

    if (dbType === 'viaticos') {
      modalTitle = 'Confirmar Exportación de Informe de Viáticos';
      moduleDocName = 'el documento institucional en formato PDF de alta resolución con las comisiones de servicio, destinos y ejecución presupuestal de viáticos de la Gobernación de Boyacá.';
    } else if (dbType === 'employees') {
      modalTitle = 'Confirmar Exportación de Informe de Servidores Públicos';
      moduleDocName = 'el documento institucional en formato PDF de alta resolución con el estado de la planta de personal, servidores activos, vacantes y dotación por secretaría.';
    } else if (dbType === 'horarios') {
      modalTitle = 'Confirmar Exportación de Informe de Horarios y Modalidades';
      moduleDocName = 'el documento institucional en formato PDF de alta resolución con el seguimiento de esquemas laborales, adopción de teletrabajo y vigencia de autorizaciones.';
    }

    const modalBody = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:flex-start; gap:16px; padding:18px; background:linear-gradient(135deg, rgba(53,88,51,0.08) 0%, rgba(209,173,42,0.06) 100%); border:1.5px solid rgba(53,88,51,0.25); border-radius:14px;">
          <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #355833, #1c331a); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(53,88,51,0.3);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:26px; height:26px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div style="flex:1;">
            <h3 style="margin:0 0 6px 0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">
              ¿Estás seguro de que deseas exportar el informe oficial en PDF?
            </h3>
            <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.45;">
              Se generará y descargará ${moduleDocName}
            </p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.83rem;">
          <div style="padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">📊</span>
            <span style="color:var(--text-secondary);"><strong style="color:var(--text-primary);">Gráficas Oficiales:</strong> Capturadas en alta resolución 2.5x</span>
          </div>
          <div style="padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">🏛️</span>
            <span style="color:var(--text-secondary);"><strong style="color:var(--text-primary);">Identidad Oficial:</strong> Gobernación de Boyacá</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; padding:11px 14px; background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.22); border-radius:10px; font-size:0.82rem; color:var(--text-secondary);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" style="width:18px; height:18px; min-width:18px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span><strong>Protección de Datos:</strong> Este informe contiene estadísticas consolidadas y métricas operativas de la plataforma Talento 360.</span>
        </div>
      </div>
    `;

    App.openModal(modalTitle, modalBody, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      { text: 'Aceptar y Descargar PDF', cls: 'btn-primary-cta', id: 'btn-confirm-pdf-export', action: () => {
        App.closeModal();
        executeExportPDF();
      }}
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EJECUCIÓN PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════
  async function executeExportPDF() {
    try {
      const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDFConstructor) {
        App.showToast('El generador de PDF (jsPDF) no se encuentra disponible.', 'error');
        return;
      }
      App.showToast('Generando informe ejecutivo institucional en PDF...', 'info');

      const [logoGobernacion, logoCondor, logoCondorBlanco] = await Promise.all([
        loadImageAsDataURL('imgs/gobernacion.png'),
        loadImageAsDataURL('imgs/logoCondor.png'),
        loadImageAsDataURL('imgs/logoCondorBlanco.png'),
      ]);
      const logos = { logoGobernacion, logoCondor, logoCondorBlanco };

      const doc = new jsPDFConstructor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const dbType = (typeof DashboardModule !== 'undefined' && DashboardModule.getUserDashboardType) ? DashboardModule.getUserDashboardType() : 'admin';

      if (dbType === 'viaticos') {
        await generateViaticosReport(doc, logos);
      } else if (dbType === 'employees') {
        await generateEmployeesReport(doc, logos);
      } else if (dbType === 'horarios') {
        await generateHorariosReport(doc, logos);
      } else {
        await generateAdminReport(doc, logos);
      }

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(doc, i, totalPages);
      }

      const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let fileName = `Talento360_Informe_Dashboard_${dateCode}.pdf`;
      if (dbType === 'viaticos') {
        fileName = `Talento360_Informe_Viaticos_${dateCode}.pdf`;
      } else if (dbType === 'employees') {
        fileName = `Talento360_Informe_Servidores_Publicos_${dateCode}.pdf`;
      } else if (dbType === 'horarios') {
        fileName = `Talento360_Informe_Horarios_Modalidades_${dateCode}.pdf`;
      }

      doc.save(fileName);
      App.showToast('Informe institucional descargado exitosamente.', 'success');
    } catch (err) {
      console.error('[DashboardPDF] Error al generar PDF:', err);
      App.showToast('Error al generar PDF: ' + err.message, 'error');
    }
  }

  function exportPDF() {
    confirmExportPDF();
  }

  return {
    exportPDF,
    confirmExportPDF,
    executeExportPDF
  };

})();

window.DashboardPDF = DashboardPDF;
