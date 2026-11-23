const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const XLSX = require('xlsx');

const { mapRowToFuncionarioDTO } = require('../src/dto/funcionarioExcelDTO');
const { detectarMapeoCargos } = require('../src/controllers/employeeImportController');

test('Excel mapping: servidor sin encargo asigna Col F como cargo titular y encargo null', () => {
  const rawRow = {
    'PRIMER APELLIDO': 'PEREZ',
    'SEGUNDO APELLIDO': 'GOMEZ',
    'NOMBRES': 'JUAN',
    'NUMERO DE CEDULA': '12345678',
    'DENOMINACIÓN CARGO': 'PROFESIONAL UNIVERSITARIO',
    'COD._1': '219',
    'GRA._1': '05',
    'DEPENDENCIA': 'SECRETARIA GENERAL',
    'CARGO TITULAR': ''
  };

  const dto = mapRowToFuncionarioDTO(rawRow, 2, 'AGOSTO', '12345678', false, false);

  assert.equal(dto.cargoTitular.denominacion, 'PROFESIONAL UNIVERSITARIO');
  assert.equal(dto.cargoTitular.codigo, '219');
  assert.equal(dto.cargoTitular.grado, '05');
  assert.equal(dto.encargo.denominacion, null);
  assert.equal(dto.cargoActual.denominacion, 'PROFESIONAL UNIVERSITARIO');
});

test('Excel mapping: servidor CON encargo asigna Col F como cargo de la planta y Col A como datos de encargo', () => {
  const rawRow = {
    'PRIMER APELLIDO': 'ACERO',
    'SEGUNDO APELLIDO': 'RONCANCIO',
    'NOMBRES': 'OSCAR FERNANDO',
    'NUMERO DE CEDULA': '79426900',
    'CARGO TITULAR': 'PROFESIONAL UNIVERSITARIO',
    'COD.': '219',
    'GRA.': '05',
    'ASIGNACION': '6626000',
    'DEPENDENCIA': '3.1.1 SUBDIRECCION DE PRESUPUESTO',
    'DENOMINACIÓN CARGO': 'PROFESIONAL ESPECIALIZADO',
    'COD._1': '222',
    'GRA._1': '06'
  };

  const dto = mapRowToFuncionarioDTO(rawRow, 155, 'AGOSTO', '79426900', false, false);

  assert.equal(dto.cargoTitular.denominacion, 'PROFESIONAL ESPECIALIZADO');
  assert.equal(dto.cargoTitular.codigo, '222');
  assert.equal(dto.cargoTitular.grado, '06');
  assert.equal(dto.encargo.denominacion, 'PROFESIONAL UNIVERSITARIO');
  assert.equal(dto.encargo.codigo, '219');
  assert.equal(dto.encargo.grado, '05');
  assert.equal(dto.cargoActual.denominacion, 'PROFESIONAL ESPECIALIZADO');
  assert.equal(dto.encargo.asignacion, '$ 6.626.000');
});

test('Excel mapping: detección de columnas con TIEMPO DE SERVICIO 2026.xlsx real', () => {
  const filePath = path.resolve(__dirname, '../../../../documentos/Servidores Publicos/TIEMPO DE SERVICIO 2026.xlsx');
  let sheet;
  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    sheet = workbook.Sheets['AGOSTO'];
  } else {
    sheet = XLSX.utils.aoa_to_sheet([
      ['CARGO TITULAR', 'COD.', 'GRA.', 'ASIGNACION', 'DEPENDENCIA', 'DENOMINACIÓN CARGO', 'COD.', 'GRA.']
    ]);
  }
  const colMap = detectarMapeoCargos(sheet);

  assert.equal(colMap.colCargoTitular, 0); // Col A: CARGO TITULAR
  assert.equal(colMap.colCodTitular, 1);   // Col B: COD.
  assert.equal(colMap.colGraTitular, 2);   // Col C: GRA.
  assert.equal(colMap.colAsigEncargo, 3);  // Col D: ASIGNACION
  assert.equal(colMap.colDep, 4);          // Col E: DEPENDENCIA
  assert.equal(colMap.colCargoDenom, 5);   // Col F: DENOMINACIÓN CARGO
  assert.equal(colMap.colCodDenom, 6);     // Col G: COD.
  assert.equal(colMap.colGraDenom, 7);     // Col H: GRA.
});

test('Excel mapping: detección de columnas con PLANTA ANGELA USSA.xlsx (A1 vacía y columna SALARIO)', () => {
  const filePath = path.resolve(__dirname, '../../../../documentos/Servidores Publicos/PLANTA ANGELA USSA.xlsx');
  let sheet;
  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    sheet = workbook.Sheets['Hoja1'];
  } else {
    sheet = XLSX.utils.aoa_to_sheet([
      ['', 'COD.', 'GRA.', 'SALARIO', 'DEPENDENCIA', 'DENOMINACIÓN CARGO', 'COD.', 'GRA.']
    ]);
  }
  const colMap = detectarMapeoCargos(sheet);

  assert.equal(colMap.colCargoTitular, 0); // Col A: fallback a 0 por A1 vacía
  assert.equal(colMap.colCodTitular, 1);   // Col B: COD.
  assert.equal(colMap.colGraTitular, 2);   // Col C: GRA.
  assert.equal(colMap.colAsigEncargo, 3);  // Col D: ASIGNACION
  assert.equal(colMap.colDep, 4);          // Col E: DEPENDENCIA
  assert.equal(colMap.colCargoDenom, 5);   // Col F: DENOMINACIÓN CARGO
  assert.equal(colMap.colCodDenom, 6);     // Col G: COD.
  assert.equal(colMap.colGraDenom, 7);     // Col H: GRA.
});
