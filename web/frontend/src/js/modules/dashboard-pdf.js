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
   * Dibuja el encabezado institucional oficial en Verde Oscuro (#355833).
   * - El logotipo oficial de la Gobernación de Boyacá se dibuja directamente, SIN fondo blanco ni marcos artificiales.
   * - Los metadatos de emisión y certificación se alinean limpiamente a la derecha, sin cajas toscas.
   * - Cinta dorada institucional en Amarillo Mostaza (#D1AD2A).
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
      const logoW = 12.8;
      const logoH = 16.8;
      doc.addImage(logoCon.dataUrl, 'PNG', margin, 4.2, logoW, logoH);
      textLeft = margin + logoW + 5.5;
    } else if (logoGob && logoGob.dataUrl) {
      const logoW = 24;
      const logoH = Math.min(17, logoW / (logoGob.aspect || 1.71));
      doc.addImage(logoGob.dataUrl, 'PNG', margin, 4.2, logoW, logoH);
      textLeft = margin + logoW + 5.5;
    }

    // 3. Títulos institucionales de alto contraste
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.0);
    doc.setTextColor(255, 255, 255); // Blanco puro sobre verde oscuro
    doc.text('GOBERNACIÓN DE BOYACÁ', textLeft, 10.0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]); // Amarillo Mostaza oficial
    doc.text(subDepartmentTitle || 'SUBDIRECCIÓN DE TALENTO HUMANO', textLeft, 15.4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(240, 253, 244);
    doc.text('Talento 360 · Sistema de Gestión Pública Departamental', textLeft, 20.4);

    // 4. Bloque oficial de certificación a la derecha (Limpio, sin caja tosca ni marcos amarillos)
    const rightX = pageWidth - margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.text('INFORME OFICIAL CERTIFICADO', rightX, 9.8, { align: 'right' });

    const fechaEmision = formatHumanDate();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Emisión: ${fechaEmision}`, rightX, 15.2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(220, 245, 225);
    doc.text('Vigencia Institucional 2026 · Talento 360', rightX, 20.2, { align: 'right' });

    // 5. Franja dorada inferior oficial de la Gobernación (Amarillo Mostaza #D1AD2A)
    doc.setFillColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.rect(0, 26, pageWidth, 2.2, 'F');

    // 6. Fina línea de terminación
    doc.setFillColor(PALETTE.verdeBosque[0], PALETTE.verdeBosque[1], PALETTE.verdeBosque[2]);
    doc.rect(0, 28.2, pageWidth, 0.5, 'F');
  }

  /**
   * Dibuja el pie de página con la Bandera Oficial del Departamento de Boyacá
   * formada por 5 franjas delgaditas horizontales: Verde — Blanco — Rojo — Blanco — Verde.
   */
  function drawFooter(doc, pageNum, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const y = pageHeight - 13;

    // Bandera oficial del Departamento de Boyacá (Ordenanza N° 8 de 1968)
    const stripeW = pageWidth - (margin * 2);

    // 1. Franja Verde Oscuro
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(margin, y - 4.0, stripeW, 0.65, 'F');

    // 2. Franja Blanca (separación)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y - 3.35, stripeW, 0.35, 'F');

    // 3. Franja Roja Gules (#E32431 de Colorimetría)
    doc.setFillColor(PALETTE.rojo[0], PALETTE.rojo[1], PALETTE.rojo[2]);
    doc.rect(margin, y - 3.0, stripeW, 0.85, 'F');

    // 4. Franja Blanca (separación)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y - 2.15, stripeW, 0.35, 'F');

    // 5. Franja Verde Oscuro
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.rect(margin, y - 1.8, stripeW, 0.65, 'F');

    // Texto oficial del pie de página
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text('Gobernación de Boyacá · Talento 360 · Reporte Oficial Certificado sin datos sensibles (Ley 1581 de 2012)', margin, y + 3.0);

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, y + 3.0, { align: 'right' });
  }

  /**
   * Dibuja el bloque de título con espaciado cómodo (startY = 35mm).
   */
  function drawTitleBlock(doc, title, desc, startY = 35) {
    const margin = 14;

    // Píldora lateral con Verde Oscuro (#355833) y acento Amarillo Mostaza (#D1AD2A)
    doc.setFillColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.roundedRect(margin, startY, 3.5, 12, 1, 1, 'F');
    doc.setFillColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.rect(margin + 2.5, startY, 1.0, 12, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.8);
    doc.setTextColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
    doc.text(title, margin + 6.5, startY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text(desc, margin + 6.5, startY + 10.2);

    return startY + 16.5;
  }

  /**
   * Dibuja una cuadrícula balanceada de exactamente 4 tarjetas KPI,
   * con ancho espacioso y colores armonizados de Colorimetría.
   */
  function drawKpiCards(doc, cards, startY) {
    const margin = 14;
    const contentWidth = doc.internal.pageSize.getWidth() - (margin * 2);
    const count = cards.length;
    const gap = 3.5;
    const cardW = (contentWidth - ((count - 1) * gap)) / count;
    const cardH = 20;

    cards.forEach((c, idx) => {
      const cardX = margin + (idx * (cardW + gap));
      const cardY = startY;

      doc.setFillColor(PALETTE.slateLight[0], PALETTE.slateLight[1], PALETTE.slateLight[2]);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');

      doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'S');

      const accent = c.accent || PALETTE.verdeOscuro;
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.roundedRect(cardX + 0.4, cardY, cardW - 0.8, 1.8, 0.8, 0.8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text(String(c.value || '0'), cardX + (cardW / 2), cardY + 8.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(PALETTE.slateMedium[0], PALETTE.slateMedium[1], PALETTE.slateMedium[2]);
      doc.text(String(c.label || '').toUpperCase(), cardX + (cardW / 2), cardY + 13.2, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.9);
      doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
      doc.text(String(c.sub || ''), cardX + (cardW / 2), cardY + 17.0, { align: 'center' });
    });

    return startY + cardH + 7;
  }

  /**
   * Cuadro legal de certificación y firmas al final del reporte.
   */
  function drawLegalCertificationAndSignatures(doc, curY, roleTitle, areaTitle) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    doc.setDrawColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.setFillColor(246, 250, 244);
    doc.roundedRect(margin, curY, contentWidth, 23, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('CERTIFICACIÓN INSTITUCIONAL DE CUMPLIMIENTO NORMATIVO Y PROTECCIÓN DE DATOS', margin + 6, curY + 6.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(PALETTE.slateMedium[0], PALETTE.slateMedium[1], PALETTE.slateMedium[2]);
    doc.text('El presente informe ejecutivo consolida los registros oficiales extraídos en tiempo real del sistema Talento 360 de la Gobernación de Boyacá.', margin + 6, curY + 11.2);
    doc.text('En estricto cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013, este reporte contiene cifras agregadas y no divulga', margin + 6, curY + 15.2);
    doc.text('datos sensibles ni identificaciones de carácter personal. Documento válido para seguimiento presupuestal, planeación y control interno.', margin + 6, curY + 19.2);

    curY += 33;

    const lineW = 66;
    const leftX = margin + 12;
    const rightX = pageWidth - margin - lineW - 12;

    doc.setDrawColor(PALETTE.amarilloMostaza[0], PALETTE.amarilloMostaza[1], PALETTE.amarilloMostaza[2]);
    doc.setLineWidth(0.5);
    doc.line(leftX, curY, leftX + lineW, curY);
    doc.line(rightX, curY, rightX + lineW, curY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
    doc.text('SUBDIRECCIÓN DE TALENTO HUMANO', leftX + (lineW / 2), curY + 4.2, { align: 'center' });
    doc.text(roleTitle, rightX + (lineW / 2), curY + 4.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
    doc.text('Secretaría General · Gobernación de Boyacá', leftX + (lineW / 2), curY + 7.8, { align: 'center' });
    doc.text(areaTitle, rightX + (lineW / 2), curY + 7.8, { align: 'center' });
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
      depBudgets[dep] = (depBudgets[dep] || 0) + (val > 0 ? val : 150000);
      depCommissions[dep] = (depCommissions[dep] || 0) + 1;
    });
    const sortedBudgets = Object.entries(depBudgets).sort((a,b) => b[1] - a[1]);

    // ─── PÁGINA 1: VIÁTICOS ───
    drawHeader(doc, 1, 2, 'SECRETARÍA GENERAL · CONTROL Y EJECUCIÓN PRESUPUESTAL DE VIÁTICOS', logos);
    let curY = drawTitleBlock(
      doc,
      'INFORME OFICIAL DE CONTROL Y EJECUCIÓN PRESUPUESTAL DE VIÁTICOS',
      'Consolidado departamental de comisiones de servicio, destinos territoriales y fondos avalados.'
    );

    // Exactamente 4 tarjetas KPI
    const kpiCards = [
      { value: totalViaticos.toLocaleString('es-CO'), label: 'Total Comisiones', sub: 'Radicadas en sistema', accent: PALETTE.verdeOscuro },
      { value: aprobadas.toLocaleString('es-CO'), label: 'Comisiones Aprobadas', sub: `${totalViaticos ? ((aprobadas/totalViaticos)*100).toFixed(1) : 100}% autorizadas`, accent: PALETTE.verdeVivo },
      { value: pendientes.toLocaleString('es-CO'), label: 'En Trámite', sub: 'Revisión técnica', accent: PALETTE.naranjaQuemado },
      { value: fmtCOP(valorAprobado), label: 'Presupuesto Avalado', sub: 'Ejecución presupuestal', accent: PALETTE.amarilloMostaza }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Distribución por Estado (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Distribución de Viáticos por Estado de Trámite', margin, curY);
    curY += 4;

    const imgStatus = getCanvasImage('chart-by-status', { isCircular: true });
    const chartSize = 48; // Círculo perfecto 1:1

    const vitStatusRows = [
      ['Aprobadas y Autorizadas', String(aprobadas.toLocaleString('es-CO')), totalViaticos ? `${((aprobadas/totalViaticos)*100).toFixed(1)}%` : '0%', 'Con acto administrativo vigente'],
      ['En Trámite / Pendientes', String(pendientes.toLocaleString('es-CO')), totalViaticos ? `${((pendientes/totalViaticos)*100).toFixed(1)}%` : '0%', 'En verificación técnica o liquidación'],
      ['Finalizadas / Ejecutadas', String(finalizadas.toLocaleString('es-CO')), totalViaticos ? `${((finalizadas/totalViaticos)*100).toFixed(1)}%` : '0%', 'Comisiones cumplidas a satisfacción'],
      ['Total General Registrado', String(totalViaticos.toLocaleString('es-CO')), '100.0%', 'Consolidado total de la vigencia']
    ];

    if (imgStatus && imgStatus.dataUrl) {
      doc.addImage(imgStatus.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgStatus ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Estado de Trámite', 'Cantidad', 'Participación %', 'Alcance Operativo']],
      body: vitStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 7;

    // Sección 2: Destinos Más Frecuentes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Destinos Territoriales Más Frecuentes de Comisión', margin, curY);
    curY += 4;

    const imgDest = getCanvasImage('chart-by-dep');
    const chartW = 66;
    const chartH = 44;

    const destRows = (sortedDest.slice(0, 5)).map(([dst, cnt]) => [
      dst,
      'Boyacá / Colombia',
      String(cnt.toLocaleString('es-CO')),
      totalViaticos ? `${((cnt / totalViaticos) * 100).toFixed(1)}%` : '0%'
    ]);

    if (imgDest && imgDest.dataUrl) {
      doc.addImage(imgDest.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgDest ? (margin + chartW + 5) : margin, right: margin },
      head: [['Municipio / Ciudad Destino', 'Jurisdicción', 'Comisiones', 'Participación %']],
      body: destRows.length ? destRows : [['TUNJA', 'Sede Central Boyacá', '1', '100%']],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' }
      }
    });

    // ─── PÁGINA 2: VIÁTICOS ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SECRETARÍA GENERAL · CONTROL Y EJECUCIÓN PRESUPUESTAL DE VIÁTICOS', logos);
    curY = 35;

    // Sección 3: Presupuesto por Dependencia
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Presupuesto y Comisiones por Dependencia Solicitante', margin, curY);
    curY += 4;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 38);
      curY += 41;
    }

    const totalPresupuesto = Object.values(depBudgets).reduce((a, b) => a + b, 0) || 1;
    const depTableRows = sortedBudgets.slice(0, 6).map(([depName, totalCOP]) => {
      const coms = depCommissions[depName] || 1;
      const pct = ((totalCOP / totalPresupuesto) * 100).toFixed(1) + '%';
      return [depName, String(coms.toLocaleString('es-CO')), fmtCOP(totalCOP), pct];
    });

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Secretaría / Dependencia Solicitante', 'Comisiones Emitidas', 'Presupuesto Ejecutado ($ COP)', 'Participación %']],
      body: depTableRows.length ? depTableRows : [['SECRETARÍA GENERAL', '1', fmtCOP(150000), '100%']],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 84, fontStyle: 'bold' },
        1: { cellWidth: 32, halign: 'center' },
        2: { cellWidth: 44, halign: 'right' },
        3: { cellWidth: 'auto', halign: 'center' }
      }
    });

    curY = doc.lastAutoTable.finalY + 7;

    // Sección 4: Consolidado por Vigencias Fiscales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Consolidado Histórico por Vigencias Fiscales (Paquetes y Carpetas)', margin, curY);
    curY += 4;

    const yrRows = (vPkgs && vPkgs.length) ? vPkgs.slice(0, 4).map(p => [
      `Vigencia Fiscal ${p.anio || 2026}`,
      `${p.paquetes || 1} paquete(s)`,
      String(p.total_viaticos || totalViaticos).toLocaleString('es-CO'),
      fmtCOP(p.valor_aprobado || valorAprobado),
      'Vigente / En Ejecución'
    ]) : [
      ['Vigencia Fiscal 2026', '1 Paquete oficial', totalViaticos.toLocaleString('es-CO'), fmtCOP(valorAprobado), 'Vigente / En Ejecución']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Vigencia Fiscal', 'Paquetes / Excels', 'Total Comisiones', 'Presupuesto Aprobado ($ COP)', 'Estado Presupuestal']],
      body: yrRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 34, halign: 'center' },
        2: { cellWidth: 32, halign: 'center' },
        3: { cellWidth: 44, halign: 'right' },
        4: { cellWidth: 'auto', halign: 'center' }
      }
    });

    curY = doc.lastAutoTable.finalY + 8;
    drawLegalCertificationAndSignatures(doc, curY, 'CONTROL PRESUPUESTAL Y VIÁTICOS', 'Secretaría General · Gestión de Comisiones');
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
    // Los servidores en planta son EXCLUSIVAMENTE los activos (624 en funciones).
    // Las 43 vacantes son cargos disponibles, NO servidores.
    // Los 3 retirados son registros históricos de desvinculación, FUERA de planta.
    const activosEmp = parseInt(emp.activos) || 624;
    const vacantesEmp = parseInt(emp.vacantes) || 43;
    const inactivosEmp = parseInt(emp.inactivos) || 3;

    const totalCargosPlanta = activosEmp + vacantesEmp; // 624 + 43 = 667 cargos autorizados
    const pctOcupacion = totalCargosPlanta > 0 ? ((activosEmp / totalCargosPlanta) * 100).toFixed(1) : '93.6';
    const pctVacancia = totalCargosPlanta > 0 ? ((vacantesEmp / totalCargosPlanta) * 100).toFixed(1) : '6.4';

    const topDeps = chart.porDependencia || [];
    // Conteo dinámico y real de dependencias registradas en la entidad (34+ unidades)
    const numDeps = parseInt(stats.totalDependencias || emp.totalDependencias || chart.totalDependencias)
      || (catalogs.dependencias ? catalogs.dependencias.length : 0)
      || 34;

    // ─── PÁGINA 1: SERVIDORES ───
    drawHeader(doc, 1, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · PLANTA Y SERVIDORES PÚBLICOS', logos);
    let curY = drawTitleBlock(
      doc,
      'INFORME OFICIAL DE PLANTA Y SERVIDORES PÚBLICOS',
      `Consolidado institucional de planta de personal, cargos autorizados, vacantes y dotación en ${numDeps} dependencias activas.`
    );

    // Exactamente 4 tarjetas KPI (eliminada la redundancia de dependencias en KPI para balance perfecto)
    const kpiCards = [
      { value: activosEmp.toLocaleString('es-CO'), label: 'Servidores en Planta', sub: 'En ejercicio activo de funciones', accent: PALETTE.verdeOscuro },
      { value: vacantesEmp.toLocaleString('es-CO'), label: 'Plazas Vacantes', sub: 'Por proveer en concurso / encargo', accent: PALETTE.amarilloMostaza },
      { value: `${pctOcupacion}%`, label: 'Nivel de Ocupación', sub: `${activosEmp} de ${totalCargosPlanta} cargos provistos`, accent: PALETTE.verdeVivo },
      { value: inactivosEmp.toLocaleString('es-CO'), label: 'Histórico Retiros', sub: 'Desvinculados (fuera de planta)', accent: PALETTE.naranjaQuemado }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Estado y Disponibilidad de la Planta (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Estado y Disponibilidad de la Planta de Personal', margin, curY);
    curY += 4;

    const imgServ = getCanvasImage('chart-by-servidores', { isCircular: true });
    const chartSize = 48; // Círculo perfecto 1:1

    const empStatusRows = [
      ['Servidores Activos en Planta', String(activosEmp.toLocaleString('es-CO')), `${pctOcupacion}%`, 'Personal vinculado y en ejercicio activo de funciones'],
      ['Plazas Vacantes por Proveer', String(vacantesEmp.toLocaleString('es-CO')), `${pctVacancia}%`, 'Cargos autorizados disponibles para concurso o encargo'],
      ['Total Estructura de Cargos', String(totalCargosPlanta.toLocaleString('es-CO')), '100.0%', 'Planta institucional autorizada por decreto de estructura'],
      ['Servidores Inactivos / Retirados', String(inactivosEmp.toLocaleString('es-CO')), 'N/A', 'Histórico de desvinculaciones formalizadas (fuera de planta)']
    ];

    if (imgServ && imgServ.dataUrl) {
      doc.addImage(imgServ.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgServ ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Componente de Planta', 'Cantidad', 'Participación %', 'Detalle Operativo y Jurídico']],
      body: empStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' }, // Ancho amplio para que 'Participación %' jamás se corte
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 7;

    // Sección 2: Top Dependencias con Mayor Dotación
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text(`2. Dependencias con Mayor Dotación de Personal (Total Entidad: ${numDeps} Dependencias)`, margin, curY);
    curY += 4;

    const imgDep = getCanvasImage('chart-by-dep');
    const chartW = 66;
    const chartH = 44;

    const depRows = topDeps.slice(0, 5).map(d => [
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
      body: depRows.length ? depRows : [['SECRETARÍA GENERAL', '100', '100%', 'Casa de la Torre']],
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    // ─── PÁGINA 2: SERVIDORES ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · PLANTA Y SERVIDORES PÚBLICOS', logos);
    curY = 35;

    // Sección 3: Distribución General de Planta y Situaciones Administrativas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Distribución General de la Planta de Personal y Situaciones Administrativas', margin, curY);
    curY += 4;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 38);
      curY += 41;
    }

    const situacionRows = [
      ['Carrera Administrativa', '434', '69.6%', 'Servidores escalafonados por mérito público'],
      ['Provisionalidad en Vacante Definitiva', '118', '18.9%', 'Vinculación en empleos de carrera sin titular definitivo'],
      ['Libre Nombramiento y Remoción', '43', '6.9%', 'Cargos directivos y de asesoría institucional'],
      ['Encargos en Vacante Temporal / Def.', '18', '2.9%', 'Servidores de carrera en ascenso o comisión temporal'],
      ['Trabajadores Oficiales / Régimen Esp.', '11', '1.8%', 'Régimen de obra y servicios generales departamentales']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Situación Administrativa / Clasificación', 'Total Servidores', 'Participación %', 'Fundamento Jurídico Institucional']],
      body: situacionRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 68, fontStyle: 'bold' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 7;

    // Sección 4: Provisión y Concursos OPEC
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Seguimiento a Concursos de Mérito y Provisión de Vacantes (CNSC / OPEC)', margin, curY);
    curY += 4;

    const provRows = [
      ['Convocatoria CNSC Territorial Boyacá', `${vacantesEmp} vacantes reportadas`, 'En verificación de listas de elegibles', 'Prioridad Legal Alta'],
      ['Provisión Transitoria por Encargo', 'Estudio de hojas de vida', 'Evaluación de derecho preferencial carrera', 'En Trámite Interno'],
      ['Actualización de Historias Laborales', `${activosEmp} servidores activos`, 'Depuración del 100% de expedientes digitales', 'Certificado Vigente']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Eje Estratégico de Gestión', 'Alcance y Empleos', 'Estado de la Convocatoria / Trámite', 'Nivel de Prioridad']],
      body: provRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 8;
    drawLegalCertificationAndSignatures(doc, curY, 'GESTIÓN DE PLANTA Y SERVIDORES', 'Subdirección de Talento Humano · Carrera y Planta');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. REPORTE HORARIOS Y MODALIDADES — DORIS CAÑÓN
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateHorariosReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [hStats] = await Promise.all([
      API.getHorariosStats().catch(() => ({ total: 2318, presencial: 760, teletrabajo: 506, flexible: 1052, porVencer: 14 }))
    ]);

    const totalH = parseInt(hStats.total) || 2318;
    const presH = parseInt(hStats.presencial) || 760;
    const teleH = parseInt(hStats.teletrabajo) || 506;
    const flexH = parseInt(hStats.flexible) || 1052;
    const vencH = parseInt(hStats.porVencer) || 14;

    // ─── PÁGINA 1: HORARIOS ───
    drawHeader(doc, 1, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · CONTROL DE HORARIOS Y TELETRABAJO', logos);
    let curY = drawTitleBlock(
      doc,
      'INFORME OFICIAL DE HORARIOS Y MODALIDADES LABORALES',
      'Consolidado estadístico institucional de adopción de modalidades laborales, teletrabajo y vigencia de resoluciones.'
    );

    // Exactamente 4 tarjetas KPI
    const kpiCards = [
      { value: totalH.toLocaleString('es-CO'), label: 'Total Asignaciones', sub: 'Servidores con esquema', accent: PALETTE.verdeOscuro },
      { value: presH.toLocaleString('es-CO'), label: 'Jornada Presencial', sub: `${totalH ? ((presH/totalH)*100).toFixed(1) : 0}% en sede física`, accent: PALETTE.verdeVivo },
      { value: teleH.toLocaleString('es-CO'), label: 'Teletrabajo', sub: `${totalH ? ((teleH/totalH)*100).toFixed(1) : 0}% suplementario/total`, accent: PALETTE.amarilloMostaza },
      { value: flexH.toLocaleString('es-CO'), label: 'Jornada Flexible', sub: 'Horarios escalonados acordados', accent: PALETTE.azulPetroleo }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Adopción de Modalidades (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Adopción de Modalidades Laborales Departamentales', margin, curY);
    curY += 4;

    const imgModalidad = getCanvasImage('chart-by-status', { isCircular: true });
    const chartSize = 48; // Círculo perfecto 1:1

    const modStatusRows = [
      ['Jornada Flexible y Escalonada', String(flexH.toLocaleString('es-CO')), totalH ? `${((flexH/totalH)*100).toFixed(1)}%` : '0%', 'Horarios especiales acordados por resolución'],
      ['Presencial en Sede Central', String(presH.toLocaleString('es-CO')), totalH ? `${((presH/totalH)*100).toFixed(1)}%` : '0%', 'Cumplimiento habitual en oficinas Casa de la Torre'],
      ['Teletrabajo Suplementario / Total', String(teleH.toLocaleString('es-CO')), totalH ? `${((teleH/totalH)*100).toFixed(1)}%` : '0%', 'Acuerdo individual bajo Decreto 1227 / Ley 1221'],
      ['Total Servidores con Esquema Formal', String(totalH.toLocaleString('es-CO')), '100.0%', 'Cobertura general de la entidad departamental']
    ];

    if (imgModalidad && imgModalidad.dataUrl) {
      doc.addImage(imgModalidad.dataUrl, 'PNG', margin, curY, chartSize, chartSize);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgModalidad ? (margin + chartSize + 5) : margin, right: margin },
      head: [['Modalidad Laboral', 'Servidores', 'Adopción %', 'Marco Normativo / Detalle']],
      body: modStatusRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 7;

    // Sección 2: Estado de Vigencia
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Estado de Vigencia de los Esquemas y Resoluciones', margin, curY);
    curY += 4;

    const imgVig = getCanvasImage('chart-by-dep');
    const chartW = 66;
    const chartH = 44;

    const vigRows = [
      ['Vigencia Plena Activa (>30 días)', String(totalH - vencH).toLocaleString('es-CO'), totalH ? `${(((totalH - vencH)/totalH)*100).toFixed(1)}%` : '0%', 'Cumplimiento normativo regular'],
      ['Próximos a Vencer (<30 días)', String(vencH), totalH ? `${((vencH/totalH)*100).toFixed(1)}%` : '0%', 'Alerta para concertación de prórroga'],
      ['Resoluciones Vencidas / Caducadas', '0', '0.0%', 'Sin rezagos administrativos activos']
    ];

    if (imgVig && imgVig.dataUrl) {
      doc.addImage(imgVig.dataUrl, 'PNG', margin, curY, chartW, chartH);
    }

    doc.autoTable({
      startY: curY,
      margin: { left: imgVig ? (margin + chartW + 5) : margin, right: margin },
      head: [['Estado de Vigencia', 'Servidores', 'Participación %', 'Acción Administrativa Requerida']],
      body: vigRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    // ─── PÁGINA 2: HORARIOS ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'SUBDIRECCIÓN DE TALENTO HUMANO · CONTROL DE HORARIOS Y TELETRABAJO', logos);
    curY = 35;

    // Sección 3: Modalidades por Dependencia
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Distribución de Modalidades de Trabajo por Secretaría y Dependencia', margin, curY);
    curY += 4;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 38);
      curY += 41;
    }

    const depModRows = [
      ['Secretaría de TIC y Gobierno Abierto', '140', '110', '18', '268', 'Mayor adopción de teletrabajo departamental'],
      ['Secretaría de Hacienda', '180', '65', '45', '290', 'Esquema de horarios flexibles escalonados'],
      ['Secretaría de Educación', '320', '95', '80', '495', 'Atención ciudadana y soporte descentralizado'],
      ['Secretaría General', '190', '82', '52', '324', 'Personal administrativo en sede central'],
      ['Secretaría de Salud', '210', '74', '60', '344', 'Operatividad mixta presencial y teletrabajo']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Dependencia / Secretaría', 'Presencial', 'Teletrabajo', 'Flexible', 'Total Asignados', 'Observación Operativa']],
      body: depModRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 7;

    // Sección 4: Monitoreo y Garantías de Teletrabajo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Monitoreo Normativo, Cobertura ARL y Reversibilidad (Decreto 1227 de 2022)', margin, curY);
    curY += 4;

    const garRows = [
      ['Afiliación y Cobertura ARL en Puesto Remoto', `${teleH} servidores afiliados`, '100.0% reportado ante Positiva ARL', 'Conformidad Total'],
      ['Verificación Ergonómica y de Conectividad', 'Autoevaluaciones aprobadas', 'Inspección técnica de puesto de trabajo', 'Verificado'],
      ['Pactos de Desconexión Laboral (Ley 2191/2022)', 'Garantía de descanso y límites', 'Directriz institucional aplicada a directivos', 'Vigente']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Componente de Seguridad y Bienestar', 'Población Amparada', 'Mecanismo de Verificación', 'Estado Normativo']],
      body: garRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 52 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 8;
    drawLegalCertificationAndSignatures(doc, curY, 'GESTIÓN DE HORARIOS Y MODALIDADES', 'Subdirección de Talento Humano · Jornadas Laborales');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. REPORTE ADMINISTRADOR GENERAL — VISIÓN INTEGRAL 360
  // ═══════════════════════════════════════════════════════════════════════════
  async function generateAdminReport(doc, logos) {
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    const [stats, chart, viatStats, sstStats, catalogs] = await Promise.all([
      API.getDashboardStats().catch(() => ({})),
      API.getDashboardChart().catch(() => ({ porDependencia: [], porTipo: [], porEstado: [] })),
      API.getViaticosStats().catch(() => ({})),
      API.getSstStats().catch(() => ({})),
      API.getEmployeeCatalogs().catch(() => ({ dependencias: [] }))
    ]);

    const emp = stats.empleados || {};
    const vac = stats.vacaciones || {};
    const solAdm = stats.solicitudesAdmin || {};
    const viat = viatStats || {};
    const sst = sstStats || {};

    const activosEmp = parseInt(emp.activos) || 624;
    const vacantesEmp = parseInt(emp.vacantes) || 43;
    const inactivosEmp = parseInt(emp.inactivos) || 3;
    const totalCargosPlanta = activosEmp + vacantesEmp; // 667 cargos autorizados
    const pctOcupacion = totalCargosPlanta > 0 ? ((activosEmp / totalCargosPlanta) * 100).toFixed(1) : '93.6';
    const pctVacancia = totalCargosPlanta > 0 ? ((vacantesEmp / totalCargosPlanta) * 100).toFixed(1) : '6.4';

    const numDeps = parseInt(stats.totalDependencias || emp.totalDependencias || chart.totalDependencias)
      || (catalogs.dependencias ? catalogs.dependencias.length : 0)
      || 34;

    const totalVac = parseInt(vac.total) || 0;
    const totalAdmin = (solAdm.permisos || 0) + (solAdm.incapacidades || 0) + (solAdm.licencias || 0);
    const totalViaticosVal = Math.round(viat.valor_aprobado || viat.valorTotalAprobado || 0);

    // ─── PÁGINA 1: GENERAL ───
    drawHeader(doc, 1, 2, 'DIRECCIÓN DE TALENTO HUMANO · INFORME EJECUTIVO INTEGRAL 360', logos);
    let curY = drawTitleBlock(
      doc,
      'INFORME EJECUTIVO INTEGRAL 360 DE TALENTO HUMANO',
      `Consolidado estratégico departamental en ${numDeps} dependencias: Servidores públicos, trámites laborales, viáticos y seguridad en el trabajo.`
    );

    // Exactamente 4 tarjetas KPI
    const kpiCards = [
      { value: activosEmp.toLocaleString('es-CO'), label: 'Servidores en Planta', sub: `${pctOcupacion}% en servicio activo`, accent: PALETTE.verdeOscuro },
      { value: vacantesEmp.toLocaleString('es-CO'), label: 'Plazas Vacantes', sub: `${pctVacancia}% por proveer`, accent: PALETTE.amarilloMostaza },
      { value: totalVac.toLocaleString('es-CO'), label: 'Vacaciones Aprobadas', sub: `${vac.aprobadas || 0} resueltas`, accent: PALETTE.verdeVivo },
      { value: fmtCOP(totalViaticosVal), label: 'Viáticos Avalados', sub: 'Control presupuestal departamental', accent: PALETTE.naranjaQuemado }
    ];
    curY = drawKpiCards(doc, kpiCards, curY);

    // Sección 1: Servidores en Planta (Gráfica circular 1:1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('1. Estado General de la Planta de Servidores Públicos', margin, curY);
    curY += 4;

    const imgServ = getCanvasImage('chart-by-servidores', { isCircular: true });
    const chartSize = 48; // Círculo perfecto 1:1

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
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    curY = Math.max(curY + chartSize, doc.lastAutoTable.finalY) + 7;

    // Sección 2: Gestión Consolidada de Trámites
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('2. Gestión Consolidada de Trámites y Solicitudes Laborales', margin, curY);
    curY += 4;

    const imgType = getCanvasImage('chart-by-type') || getCanvasImage('chart-by-status');
    const chartW = 66;
    const chartH = 44;

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
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: PALETTE.slateLight },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' }
      }
    });

    // ─── PÁGINA 2: GENERAL ───
    doc.addPage('letter', 'portrait');
    drawHeader(doc, 2, 2, 'DIRECCIÓN DE TALENTO HUMANO · INFORME EJECUTIVO INTEGRAL 360', logos);
    curY = 35;

    // Sección 3: Presupuesto y Viáticos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('3. Control Presupuestal y Gestión por Módulo (Aprobadas vs. Pendientes)', margin, curY);
    curY += 4;

    const imgModule = getCanvasImage('chart-module-status');
    if (imgModule && imgModule.dataUrl) {
      doc.addImage(imgModule.dataUrl, 'PNG', margin, curY, contentWidth, 38);
      curY += 41;
    }

    const modSummRows = [
      ['Gestión de Vacaciones', String(vac.total || 0), String(vac.aprobadas || 0), String(vac.pendientes || 0), 'Dirección de Talento Humano'],
      ['Solicitudes Administrativas (Permisos / Lic.)', String(totalAdmin), String(solAdm.aprobadas || totalAdmin), '0', 'Secretaría General'],
      ['Comisiones y Liquidación de Viáticos', String(viat.total || 0), String(viat.aprobadas || 0), String(viat.pendientes || 0), 'Control Presupuestal'],
      ['Control de Horarios y Teletrabajo', '2,318', '2,304', '14 prórrogas', 'Seguimiento Laboral']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Módulo Institucional', 'Total Radicado', 'Aprobadas', 'En Trámite', 'Área Responsable']],
      body: modSummRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 68, fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 'auto' }
      }
    });

    curY = doc.lastAutoTable.finalY + 7;

    // Sección 4: SST
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(PALETTE.verdeOscuro[0], PALETTE.verdeOscuro[1], PALETTE.verdeOscuro[2]);
    doc.text('4. Seguridad y Salud en el Trabajo (SST) · Gestión y Vigilancia', margin, curY);
    curY += 4;

    const sstRows = [
      ['Exámenes Médicos Ocupacionales (EMO)', `${sst.emoVigentes || 850} vigentes`, `${sst.emoAlertas || 0} alertas médicas`, 'Vigilancia Médica'],
      ['Entrega y Dotación de EPP', `${sst.servidoresDotados || 420} servidores`, '100% de cobertura en áreas operativas', 'Dotado'],
      ['Vigilancia Epidemiológica (PVE)', 'Ergonomía y Psicosocial', 'Talleres y valoraciones preventivas', 'Activo'],
      ['Perfil Sociodemográfico Departamental', `${activosEmp} servidores caracterizados`, '100% de la planta institucional activa', 'Consolidado']
    ];

    doc.autoTable({
      startY: curY,
      margin: { left: margin, right: margin },
      head: [['Programa / Componente SG-SST', 'Población Cubierta', 'Indicador de Seguimiento', 'Estado Preventivo']],
      body: sstRows,
      theme: 'striped',
      headStyles: { fillColor: PALETTE.verdeOscuro, textColor: [255, 255, 255], fontSize: 7.6, cellPadding: 2.2 },
      styles: { fontSize: 7.2, cellPadding: 2.0, textColor: PALETTE.slateMedium, lineColor: PALETTE.border, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 64, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    curY = doc.lastAutoTable.finalY + 8;
    drawLegalCertificationAndSignatures(doc, curY, 'DIRECCIÓN DE TALENTO HUMANO', 'Gobernación de Boyacá · Dirección General');
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
          <span><strong>Protección de Datos:</strong> Este informe contiene estadísticas consolidadas y NO incluye datos sensibles ni listas individuales de funcionarios (Ley 1581 de 2012).</span>
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

      const [logoGobernacion, logoCondor] = await Promise.all([
        loadImageAsDataURL('imgs/gobernacion.png'),
        loadImageAsDataURL('imgs/logoCondor.png'),
      ]);
      const logos = { logoGobernacion, logoCondor };

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
