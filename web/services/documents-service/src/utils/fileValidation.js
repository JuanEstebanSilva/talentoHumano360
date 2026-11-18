// Valida el contenido real del archivo: la extensión o el Content-Type los controla quien sube.

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const TYPES = {
  pdf:  { mime: 'application/pdf', inline: true },
  png:  { mime: 'image/png', inline: true },
  jpg:  { mime: 'image/jpeg', inline: true },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', inline: false },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', inline: false },
};

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b);
}

function detectType(buffer) {
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) { // Office moderno es un ZIP
    if (buffer.includes('word/document')) return 'docx';
    if (buffer.includes('xl/workbook')) return 'xlsx';
  }
  return null;
}

function sanitizeFilename(rawName) {
  const base = String(rawName || '').split(/[\\/]/).pop() || '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
  return (clean || 'documento').slice(-255);
}

// Multer 1.x entrega el nombre como latin1 aunque el navegador lo envíe en UTF-8.
function decodeUploadName(rawName) {
  return Buffer.from(String(rawName || ''), 'latin1').toString('utf8');
}

function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  const ext = match ? match[1].toLowerCase() : '';
  return ext === 'jpeg' ? 'jpg' : ext;
}

/** Devuelve { ext, mime } o { error } si el archivo no es admitido. */
function validateFile(buffer, filename) {
  const detected = detectType(buffer);
  if (!detected) {
    return { error: 'Formato no admitido. Se aceptan PDF, JPG, PNG, DOCX y XLSX.' };
  }
  if (extensionOf(filename) !== detected) {
    return { error: 'La extensión del archivo no coincide con su contenido.' };
  }
  return { ext: detected, mime: TYPES[detected].mime };
}

function canDisplayInline(mime) {
  return Object.values(TYPES).some(t => t.mime === mime && t.inline);
}

module.exports = { MAX_FILE_SIZE, validateFile, sanitizeFilename, decodeUploadName, canDisplayInline };
