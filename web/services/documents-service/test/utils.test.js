const test = require('node:test');
const assert = require('node:assert');

const { validateFile, sanitizeFilename, decodeUploadName } = require('../src/utils/fileValidation');
const { extractCedulaCandidates, suggestTipo } = require('../src/utils/classifier');
const { canRead, canWrite, canViewSensitive } = require('../src/utils/permissions');
const storage = require('../src/utils/storage');

const PDF = Buffer.from('%PDF-1.7 contenido');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('validateFile acepta el archivo si contenido y extensión coinciden', () => {
  assert.strictEqual(validateFile(PDF, 'hoja de vida.PDF').ext, 'pdf');
  assert.strictEqual(validateFile(PNG, 'foto.png').mime, 'image/png');
  assert.strictEqual(validateFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'foto.jpeg').ext, 'jpg');
});

test('validateFile rechaza contenido disfrazado y formatos no admitidos', () => {
  assert.ok(validateFile(Buffer.from('<script>alert(1)</script>'), 'factura.pdf').error);
  assert.ok(validateFile(PDF, 'documento.png').error);
  assert.ok(validateFile(Buffer.from('MZ ejecutable'), 'programa.exe').error);
  assert.ok(validateFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), 'comprimido.docx').error);
});

test('sanitizeFilename elimina rutas y caracteres peligrosos', () => {
  assert.strictEqual(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.strictEqual(sanitizeFilename('C:\\temp\\mi"doc<1>.pdf'), 'midoc1.pdf');
  assert.strictEqual(sanitizeFilename(''), 'documento');
});

test('decodeUploadName recupera tildes que Multer entrega como latin1', () => {
  const asLatin1 = Buffer.from('Resolución.pdf', 'utf8').toString('latin1');
  assert.strictEqual(decodeUploadName(asLatin1), 'Resolución.pdf');
});

test('extractCedulaCandidates reconoce cédulas con y sin separadores', () => {
  assert.deepStrictEqual(extractCedulaCandidates('CC_1057123456_hoja_vida.pdf'), ['1057123456']);
  assert.deepStrictEqual(extractCedulaCandidates('diploma 1.057.123.456.pdf'), ['1057123456']);
  assert.deepStrictEqual(extractCedulaCandidates('acta 12345.pdf'), []);
  assert.deepStrictEqual(extractCedulaCandidates('informe.pdf'), []);
});

test('suggestTipo usa la palabra clave más específica y solo palabras completas', () => {
  const tipos = [
    { id_tipo: 1, palabras_clave: 'hoja de vida,hv' },
    { id_tipo: 2, palabras_clave: 'evaluacion,edl' },
    { id_tipo: 3, palabras_clave: 'evaluacion de desempeno' },
    { id_tipo: 4, palabras_clave: 'emo' },
  ];
  assert.strictEqual(suggestTipo('HOJA_DE_VIDA_123.pdf', tipos).id_tipo, 1);
  assert.strictEqual(suggestTipo('Evaluación de Desempeño 2025.pdf', tipos).id_tipo, 3);
  assert.strictEqual(suggestTipo('memorando.pdf', tipos), null);
});

test('permisos: dependen del rol y los módulos, nunca del nombre', () => {
  const angelaPorNombre = { name: 'Angela', username: 'angela.falsa', role: 'Usuario', modules: ['dashboard'] };
  assert.strictEqual(canRead(angelaPorNombre), false);
  assert.strictEqual(canWrite(angelaPorNombre), false);

  const lector = { role: 'Usuario', modules: ['documents'] };
  assert.strictEqual(canRead(lector), true);
  assert.strictEqual(canWrite(lector), false);
  assert.strictEqual(canViewSensitive(lector), false);

  const gestor = { role: 'Usuario', modules: ['documents_write'] };
  assert.strictEqual(canRead(gestor), true);
  assert.strictEqual(canWrite(gestor), true);
  assert.strictEqual(canViewSensitive(gestor), false);

  assert.strictEqual(canViewSensitive({ role: 'Usuario', modules: ['documents', 'documents_sensitive'] }), true);
  assert.strictEqual(canViewSensitive({ role: 'Coordinador', modules: [] }), true);
});

test('storage no permite salir del directorio de almacenamiento', () => {
  assert.throws(() => storage.resolveKey('../../secreto.txt'));
  assert.ok(storage.resolveKey('2026/11/archivo.pdf').endsWith('archivo.pdf'));
});
