/**
 * MOTOR AUTOMÁTICO DE LIQUIDACIÓN DE VIÁTICOS Y COMISIONES DE SERVICIO
 * Plataforma Talento 360 - Gobernación de Boyacá
 * Resuelve AUD-003 / TSK-004 (Responsable: Bergenet Gutiérrez)
 * 
 * Basado en las escalas salariales y decretos oficiales nacionales y departamentales:
 * - Vigencia 2024: Decreto Nacional 304 de 2024
 * - Vigencia 2025: Decreto Nacional 0269 de 2025
 * - Vigencia 2026: Decreto Salarial 2026 (Boyacá)
 * - Vigencias futuras (2027+): Documentación de ausencia de decreto expedido; aplicación provisional con trazabilidad.
 */

function parseDateInput(dStr) {
  if (!dStr) return null;
  const s = String(dStr).trim();
  // Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  // Formato DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

function formatDateISO(d) {
  if (!d) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

/**
 * Desglosa un rango de fechas en intervalos anuales para liquidar
 * proporcionalmente comisiones que atraviesan dos vigencias fiscales.
 */
function splitRangeByVigencia(dStart, dEnd) {
  const intervals = [];
  let cur = new Date(dStart.getTime());

  while (cur <= dEnd) {
    const curYear = cur.getUTCFullYear();
    const endOfYear = new Date(Date.UTC(curYear, 11, 31));
    const intervalEnd = endOfYear < dEnd ? endOfYear : new Date(dEnd.getTime());

    const diffDays = Math.round((intervalEnd.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    intervals.push({
      anio: curYear,
      inicio: formatDateISO(cur),
      fin: formatDateISO(intervalEnd),
      dias: Math.max(1, diffDays)
    });

    cur = new Date(Date.UTC(curYear + 1, 0, 1));
  }

  return intervals;
}

/**
 * Consulta la escala oficial aplicable para una vigencia y salario base.
 */
async function getEscalaForYearAndSalary(pool, anio, salarioBase) {
  // 1. Búsqueda exacta por año y rango salarial
  let res = await pool.query(`
    SELECT id_escala, anio, numero_decreto, salario_desde, salario_hasta,
           tarifa_pernocta, tarifa_sin_pernocta, descripcion
    FROM viaticos_escalas
    WHERE anio = $1 AND $2 >= salario_desde AND $2 <= salario_hasta
    ORDER BY id_escala LIMIT 1
  `, [anio, salarioBase]);

  if (res.rows.length) {
    return { escala: res.rows[0], esProvisional: false };
  }

  // 2. Si es una vigencia futura (>= 2027) o año sin decreto expedido, usar el decreto oficial más reciente
  res = await pool.query(`
    SELECT id_escala, anio, numero_decreto, salario_desde, salario_hasta,
           tarifa_pernocta, tarifa_sin_pernocta, descripcion
    FROM viaticos_escalas
    WHERE $1 >= salario_desde AND $1 <= salario_hasta
    ORDER BY anio DESC, id_escala ASC LIMIT 1
  `, [salarioBase]);

  if (res.rows.length) {
    const escala = res.rows[0];
    return {
      escala,
      esProvisional: true,
      mensajeProvisional: `Vigencia ${anio}: No existe aún decreto salarial expedido por el Gobierno Nacional. Se aplica provisionalmente el ${escala.numero_decreto} (${escala.anio}).`
    };
  }

  return { escala: null, esProvisional: false };
}

/**
 * Función Principal del Motor de Liquidación de Viáticos
 */
async function calculateViaticoLiquidation(pool, params = {}) {
  const {
    cedula,
    fecha_inicio,
    fecha_fin,
    pernocta,
    dias,
    salario_manual,
    destino,
    tipo_destino,
    tipoDestino
  } = params;

  // 1. Validación de fechas
  const dStart = parseDateInput(fecha_inicio);
  const dEnd = parseDateInput(fecha_fin);

  if (dStart && dEnd && dEnd < dStart) {
    throw new Error('Fechas inválidas: la fecha de finalización no puede ser anterior a la fecha de inicio.');
  }

  let diasTotales = parseInt(dias, 10);
  if (dStart && dEnd) {
    const diffDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (!diasTotales || diasTotales < 1) {
      diasTotales = Math.max(1, diffDays);
    }
  } else if (!diasTotales || diasTotales < 1) {
    diasTotales = 1;
  }

  // 2. Búsqueda y Validación del Servidor Público
  let cleanCedula = typeof cedula === 'string' ? cedula.trim().replace(/[.,\s]/g, '') : String(cedula || '').trim();
  let employee = null;

  if (cleanCedula) {
    const empRes = await pool.query(`
      SELECT p.cedula, p.nombre_completo, c.cargo, c.nivel, c.asignacion_sueldo,
             d.dependencia
      FROM personas p
      LEFT JOIN rel_principal r ON r.id_persona = p.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
      LEFT JOIN cargos c ON c.id_cargo = COALESCE(r.id_cargo_actual, r.id_cargo_base)
      WHERE REPLACE(REPLACE(REPLACE(p.cedula, '.', ''), ',', ''), ' ', '') = $1
      LIMIT 1
    `, [cleanCedula]);

    if (empRes.rows.length) {
      employee = empRes.rows[0];
    }
  }

  // 3. Determinación rigurosa del salario base
  let salarioBase = 0;
  let origenSalario = 'No identificado';

  if (salario_manual && !isNaN(parseFloat(salario_manual)) && parseFloat(salario_manual) > 0) {
    salarioBase = Math.round(parseFloat(salario_manual));
    origenSalario = 'Asignación manual justificada';
  } else if (employee && employee.asignacion_sueldo) {
    const rawDigits = String(employee.asignacion_sueldo).replace(/[^\d]/g, '');
    if (rawDigits) {
      salarioBase = parseInt(rawDigits, 10);
      origenSalario = 'Planta de personal (cargos.asignacion_sueldo)';
    }
  }

  // Asignación referencial según nivel si el cargo no especifica salario explícito
  if (salarioBase <= 0 && employee && employee.nivel) {
    const lvl = String(employee.nivel).toUpperCase();
    if (lvl.includes('DIRECTIV')) { salarioBase = 12000000; origenSalario = 'Escala referencial nivel Directivo'; }
    else if (lvl.includes('ASESOR')) { salarioBase = 8000000; origenSalario = 'Escala referencial nivel Asesor'; }
    else if (lvl.includes('PROFESIONAL')) { salarioBase = 3500000; origenSalario = 'Escala referencial nivel Profesional'; }
    else if (lvl.includes('TECNIC') || lvl.includes('TÉCNIC')) { salarioBase = 2500000; origenSalario = 'Escala referencial nivel Técnico'; }
    else if (lvl.includes('ASISTENCIAL')) { salarioBase = 1800000; origenSalario = 'Escala referencial nivel Asistencial'; }
  }

  if (salarioBase <= 0) {
    salarioBase = 3500000; // Contingencia profesional institucional
    origenSalario = 'Contingencia estándar promedio';
  }

  // 4. Determinación de pernoctas y noches de alojamiento
  const isPernocta = (pernocta === true || pernocta === 'true' || pernocta === 1 || pernocta === '1' || pernocta === 'si');
  const nochesAlojamiento = isPernocta ? Math.max(1, diasTotales - 1) : 0;

  // 5. Desglose y cálculo por vigencias anuales
  let intervals = [];
  if (dStart && dEnd) {
    intervals = splitRangeByVigencia(dStart, dEnd);
  } else if (dStart) {
    const y = dStart.getUTCFullYear();
    intervals = [{ anio: y, inicio: formatDateISO(dStart), fin: formatDateISO(dStart), dias: diasTotales }];
  } else {
    const curY = new Date().getFullYear();
    intervals = [{ anio: curY, inicio: formatDateISO(new Date()), fin: formatDateISO(new Date()), dias: diasTotales }];
  }

  const desgloseVigencias = [];
  let valorTotalCalculado = 0;
  let decretosAplicados = [];
  let avisosProvisionales = [];

  for (const item of intervals) {
    const { escala, esProvisional, mensajeProvisional } = await getEscalaForYearAndSalary(pool, item.anio, salarioBase);
    if (!escala) {
      throw new Error(`No se encontró escala salarial de viáticos aplicable para la vigencia ${item.anio}.`);
    }

    if (esProvisional && mensajeProvisional) {
      avisosProvisionales.push(mensajeProvisional);
    }

    const tarifaUnit = isPernocta ? parseFloat(escala.tarifa_pernocta) : parseFloat(escala.tarifa_sin_pernocta);
    const subtotal = Math.round(item.dias * tarifaUnit);
    valorTotalCalculado += subtotal;

    desgloseVigencias.push({
      anio: item.anio,
      inicio: item.inicio,
      fin: item.fin,
      dias: item.dias,
      numeroDecreto: escala.numero_decreto,
      rangoSalarial: escala.descripcion,
      tarifaPernocta: parseFloat(escala.tarifa_pernocta),
      tarifaSinPernocta: parseFloat(escala.tarifa_sin_pernocta),
      tarifaAplicada: tarifaUnit,
      subtotal: subtotal,
      subtotalFormato: formatCOP(subtotal),
      esProvisional
    });

    if (!decretosAplicados.includes(escala.numero_decreto)) {
      decretosAplicados.push(escala.numero_decreto);
    }
  }

  // Evitar errores de punto flotante en la tarifa diaria efectiva
  const valorDiarioEfectivo = Math.round(valorTotalCalculado / diasTotales);

  return {
    success: true,
    cedula: employee ? employee.cedula : cleanCedula,
    funcionario: employee ? employee.nombre_completo : 'Funcionario no indexado en planta',
    cargo: employee ? employee.cargo : 'Cargo no registrado',
    nivel: employee ? employee.nivel : 'No especificado',
    dependencia: employee ? employee.dependencia : 'SECRETARÍA GENERAL',
    salarioBase,
    salarioBaseFormato: formatCOP(salarioBase),
    origenSalario,
    dias: diasTotales,
    pernocta: isPernocta,
    nochesAlojamiento,
    atraviesaVigencias: intervals.length > 1,
    decretosAplicados: decretosAplicados.join(', '),
    avisosProvisionales,
    desglosePorVigencia: desgloseVigencias,
    valorDiario: valorDiarioEfectivo,
    valorDiarioFormato: formatCOP(valorDiarioEfectivo),
    valorTotal: valorTotalCalculado,
    valorTotalFormato: formatCOP(valorTotalCalculado),
    destino: destino || 'Sin especificar',
    tipoDestino: tipoDestino || tipo_destino || 'Nacional',
    normativa: `Liquidado conforme a escala oficial ${decretosAplicados.join(' / ')}.`
  };
}

module.exports = {
  calculateViaticoLiquidation,
  parseDateInput,
  splitRangeByVigencia,
  getEscalaForYearAndSalary,
  formatCOP
};
