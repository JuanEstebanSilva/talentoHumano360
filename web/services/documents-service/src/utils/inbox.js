// Entrada automática: revisa una carpeta y pasa cada archivo a la bandeja de clasificación.
// Se activa solo si DOCUMENTS_INBOX_DIR está definida.
//
// Resultado de cada archivo:
//   procesados/  entró a la bandeja
//   rechazados/  no se admitió; junto a él queda un .motivo.txt con la causa
//   (se queda)   si falló la base de datos: se reintenta en la siguiente revisión

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { MAX_FILE_SIZE, sanitizeFilename } = require('./fileValidation');

const SCAN_INTERVAL_MS = 60 * 1000;
const MIN_FILE_AGE_MS = 30 * 1000; // Un archivo más reciente puede estar copiándose todavía.
const TEMP_FILE = /^(~\$|\.)|\.(tmp|part|crdownload)$/i;

/** Un archivo que no debe reintentarse (formato no admitido, duplicado, etc.). */
class InboxRejection extends Error {}

function createInbox({ validate, ingest }) {
  const dir = process.env.DOCUMENTS_INBOX_DIR ? path.resolve(process.env.DOCUMENTS_INBOX_DIR) : null;
  const processedDir = dir && path.join(dir, 'procesados');
  const rejectedDir = dir && path.join(dir, 'rechazados');
  let scanning = false;

  // Evita sobrescribir un archivo anterior con el mismo nombre.
  async function moveTo(targetDir, fullPath, name) {
    await fs.promises.mkdir(targetDir, { recursive: true });
    const target = path.join(targetDir, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${name}`);
    await fs.promises.rename(fullPath, target);
    return target;
  }

  async function reject(fullPath, name, reason) {
    const target = await moveTo(rejectedDir, fullPath, name);
    await fs.promises.writeFile(`${target}.motivo.txt`, `${reason}\n`);
    console.warn(`[documents] entrada automática rechazó "${name}": ${reason}`);
    return { name, resultado: 'rechazado', motivo: reason };
  }

  async function processFile(entryName, fullPath, stat) {
    const name = sanitizeFilename(entryName);
    if (stat.size > MAX_FILE_SIZE) return reject(fullPath, name, 'El archivo supera el tamaño máximo de 25 MB.');

    const buffer = await fs.promises.readFile(fullPath);
    const checked = validate(buffer, name);
    if (checked.error) return reject(fullPath, name, checked.error);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    try {
      await ingest({ buffer, name, type: checked.type, hash });
    } catch (err) {
      if (err instanceof InboxRejection) return reject(fullPath, name, err.message);
      throw err;
    }
    await moveTo(processedDir, fullPath, name);
    return { name, resultado: 'procesado' };
  }

  /** Revisa la carpeta una vez y devuelve qué pasó con cada archivo. */
  async function scan({ minAgeMs = MIN_FILE_AGE_MS } = {}) {
    if (!dir || scanning) return [];
    scanning = true;
    const results = [];
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || TEMP_FILE.test(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (Date.now() - stat.mtimeMs < minAgeMs) continue;
          results.push(await processFile(entry.name, fullPath, stat));
        } catch (err) {
          // Queda en la carpeta y se reintenta en la siguiente revisión.
          console.error(`[documents] entrada automática, "${entry.name}":`, err.message);
          results.push({ name: entry.name, resultado: 'pendiente', motivo: err.message });
        }
      }
    } catch (err) {
      console.error('[documents] entrada automática:', err.message);
    } finally {
      scanning = false;
    }
    return results;
  }

  function start() {
    setInterval(scan, SCAN_INTERVAL_MS).unref();
    setTimeout(scan, 5000).unref();
    console.log(`[documents] Entrada automática activa en ${dir}`);
  }

  return { enabled: Boolean(dir), scan, start };
}

module.exports = { createInbox, InboxRejection };
