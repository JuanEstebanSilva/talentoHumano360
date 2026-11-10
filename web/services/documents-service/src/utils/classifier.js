// Clasificación asistida: sugiere cédula y tipo a partir del nombre del archivo.
// Es solo una sugerencia: una persona la confirma antes de que el documento quede clasificado.

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Números que podrían ser una cédula, por ejemplo 1057123456 o 1.057.123.456. */
function extractCedulaCandidates(filename) {
  const name = String(filename || '').replace(/\.[a-z0-9]+$/i, '');
  const matches = name.match(/(?<![\d.])\d{1,3}(?:[. ]\d{3}){1,3}(?![\d])|(?<!\d)\d{6,12}(?!\d)/g) || [];
  return [...new Set(matches.map(m => m.replace(/[. ]/g, '')))]
    .filter(c => c.length >= 6 && c.length <= 12);
}

/** Tipo cuya palabra clave más larga aparece como palabra completa en el nombre. */
function suggestTipo(filename, tipos) {
  const haystack = ` ${normalizeText(filename)} `;
  let best = null;
  let bestLength = 0;
  for (const tipo of tipos) {
    for (const keyword of String(tipo.palabras_clave || '').split(',')) {
      const needle = normalizeText(keyword);
      if (needle && needle.length > bestLength && haystack.includes(` ${needle} `)) {
        best = tipo;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

module.exports = { normalizeText, extractCedulaCandidates, suggestTipo };
