/* ═══════════════════════════════════════════════════════════════════════════
   catalogs/licencias.js — Catálogo Oficial de Licencias y Soportes de Ley
   Régimen de Empleados Públicos de la Gobernación de Boyacá (Colombia)
   Normativa: Decreto 1083 de 2015, Ley 1280 de 2009, Ley 1822 de 2017,
              Ley 2114 de 2021, Ley 2174 de 2021, Ley 181 de 1995.
   ═══════════════════════════════════════════════════════════════════════════ */

const LICENCIAS = [
  {
    id: 'LUTO',
    nombre: 'Licencia por Luto',
    diasPorLey: 5,
    tipoDias: 'días hábiles remunerados',
    norma: 'Ley 1280 de 2009 / Decreto 1083 de 2015 (Art. 2.2.5.5.15)',
    descripcion: 'Se concede al servidor público por el fallecimiento de su cónyuge, compañero(a) permanente o de un familiar hasta el 2º grado de consanguinidad (padres, hijos, abuelos, nietos, hermanos), 1º de afinidad (suegros, nueras, yernos) o 1º civil (padres adoptantes o hijos adoptivos).',
    soportes: [
      'Acta o Registro Civil de Defunción expedido por Notaría o Registraduría.',
      'Registro Civil de Nacimiento, Matrimonio o Declaración de Unión Marital que demuestre el parentesco legal.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'MATERNIDAD',
    nombre: 'Licencia de Maternidad',
    diasPorLey: 126,
    tipoDias: '18 semanas remuneradas (126 días calendario)',
    norma: 'Ley 1822 de 2017 / Ley 2114 de 2021 / Decreto 1083 de 2015',
    descripcion: '18 semanas de descanso remunerado en la época del parto. En partos múltiples o prematuros la duración se amplía conforme a la certificación médica expedida por la EPS.',
    soportes: [
      'Certificado médico de nacido vivo o incapacidad médica por maternidad validada por la EPS.',
      'Registro Civil de Nacimiento del recién nacido.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'PATERNIDAD',
    nombre: 'Licencia de Paternidad',
    diasPorLey: 14,
    tipoDias: '2 semanas hábiles remuneradas',
    norma: 'Ley 2114 de 2021 (Modifica Ley 1822 de 2017 y Código Sustantivo del Trabajo)',
    descripcion: 'Descanso remunerado para el padre servidor público por nacimiento o adopción de un hijo.',
    soportes: [
      'Registro Civil de Nacimiento del menor (debe radicarse dentro de los 30 días posteriores al nacimiento).',
      'Certificado de nacido vivo o soporte de incapacidad de la EPS.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'PARENTAL_COMPARTIDA',
    nombre: 'Licencia Parental Compartida / Flexible',
    diasPorLey: null,
    tipoDias: 'Semanas concertadas con la madre',
    norma: 'Ley 2114 de 2021 (Art. 2)',
    descripcion: 'Distribución concertada y voluntaria de las últimas semanas de la licencia de maternidad entre ambos padres.',
    soportes: [
      'Documento de mutuo acuerdo firmado por ambos progenitores.',
      'Certificado médico de la EPS indicando semanas de gestación y fecha del parto.',
      'Registro Civil de Nacimiento del menor.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'CUIDADO_MENOR_GRAVE',
    nombre: 'Licencia por Enfermedad Terminal o Grave de Hijo Menor (Ley Camila)',
    diasPorLey: 10,
    tipoDias: 'Hasta 10 días hábiles/año (continuos o discontinuos)',
    norma: 'Ley 2174 de 2021 (Ley Camila)',
    descripcion: 'Acompañamiento y cuidado directo de hijos menores de edad diagnosticados con enfermedad terminal o cuadro clínico severo.',
    soportes: [
      'Certificación médica del especialista tratante donde conste la gravedad del diagnóstico y la necesidad de cuidado directo.',
      'Registro Civil de Nacimiento que acredite la filiación.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'ORDINARIA_NO_REMUNERADA',
    nombre: 'Licencia Ordinaria (No Remunerada)',
    diasPorLey: null,
    tipoDias: 'Hasta 60 días al año, prorrogables por 30 más',
    norma: 'Decreto 1083 de 2015 (Arts. 2.2.5.5.3 a 2.2.5.5.7)',
    descripcion: 'Separación transitoria del ejercicio del cargo por solicitud motivada y particular del servidor público, sujeta a autorización de la administración.',
    soportes: [
      'Carta formal de solicitud motivada dirigida a la Dirección General de Talento Humano / Nominador.',
      'Documentos anexos que justifiquen la solicitud (si aplica).'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'DOCENCIA_UNIVERSITARIA',
    nombre: 'Licencia para Ejercicio de la Docencia Universitaria',
    diasPorLey: null,
    tipoDias: 'Hasta 5 horas semanales remuneradas',
    norma: 'Decreto 1083 de 2015 (Art. 2.2.5.5.17)',
    descripcion: 'Autorización remunerada para impartir cátedra en instituciones de educación superior reconocidas oficialmente.',
    soportes: [
      'Certificación de vinculación laboral y académica expedida por la Universidad.',
      'Horario oficial de cátedra o clases asignadas para el periodo correspondiente.'
    ],
    soporteObligatorio: true,
  },
  {
    id: 'DEPORTIVA',
    nombre: 'Licencia para Actividades Deportivas',
    diasPorLey: null,
    tipoDias: 'Durante el certamen deportivo oficial',
    norma: 'Ley 181 de 1995 / Decreto 1083 de 2015 (Art. 2.2.5.5.16)',
    descripcion: 'Para servidores públicos seleccionados en representación del departamento o de la nación en eventos deportivos oficiales (deportistas, jueces o personal técnico).',
    soportes: [
      'Certificación oficial emitida por Coldeportes / Ministerio del Deporte o por la Federación Deportiva o Liga respectiva.'
    ],
    soporteObligatorio: true,
  },
];

const REGLAS_SOPORTES = {
  maxArchivos: 5,
  maxBytes: 10 * 1024 * 1024,
  tipos: ['application/pdf', 'image/jpeg', 'image/png'],
};

module.exports = {
  LICENCIAS,
  REGLAS_SOPORTES,
};

