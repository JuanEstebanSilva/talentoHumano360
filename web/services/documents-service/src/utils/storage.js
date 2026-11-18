// Almacenamiento de archivos en disco. Las rutas usan solo esta interfaz (save, open, remove),
// de modo que más adelante se puede cambiar a S3 o MinIO sin tocar los endpoints.
//
// DOCUMENTS_STORAGE_DIR debe apuntar a un disco persistente: el disco de Render no lo es.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function rootDir() {
  return path.resolve(process.env.DOCUMENTS_STORAGE_DIR || path.join(process.cwd(), 'storage', 'documentos'));
}

function resolveKey(key) {
  const root = rootDir();
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep)) {
    throw new Error('Clave de almacenamiento no válida.');
  }
  return fullPath;
}

/** Guarda el archivo y devuelve su clave. El nombre lo genera el servidor, nunca quien sube. */
async function save(buffer, extension) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const key = path.posix.join(String(now.getUTCFullYear()), month, `${crypto.randomUUID()}.${extension}`);
  const fullPath = resolveKey(key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  // Escritura atómica: un corte a medias nunca deja un archivo incompleto con el nombre final.
  const tempPath = `${fullPath}.tmp`;
  await fs.promises.writeFile(tempPath, buffer, { flag: 'wx' });
  await fs.promises.rename(tempPath, fullPath);
  return key;
}

function open(key) {
  return fs.createReadStream(resolveKey(key));
}

async function remove(key) {
  await fs.promises.rm(resolveKey(key), { force: true });
}

module.exports = { save, open, remove, resolveKey };
