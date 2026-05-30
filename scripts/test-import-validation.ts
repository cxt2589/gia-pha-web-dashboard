import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { analyzeImportRows } from '../src/utils/importValidation';
import { normalizeImportedPhone } from '../src/utils/importFieldFormat';
import { flattenTreeToList } from '../src/utils/configManager';
import { parseWorksheetToRows } from '../src/utils/spreadsheetImport';

const args = process.argv.slice(2);
const fileArg = args[0];

function normalizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findDefaultFixture(): string {
  const downloadsDir = join(process.env.USERPROFILE || 'C:\\Users\\truon', 'Downloads');
  const candidates = readdirSync(downloadsDir)
    .filter((name) => {
      const normalized = normalizeFileName(name);
      return !name.startsWith('~$')
        && normalized.endsWith('.xlsx')
        && normalized.includes('thong tin gia pha')
        && normalized.includes('cao');
    })
    .sort((a, b) => {
      const normalizedA = normalizeFileName(a);
      const normalizedB = normalizeFileName(b);
      const scoreA = (normalizedA.includes('290525') ? 0 : 10) + (normalizedA.includes('bo sung') ? 0 : 1);
      const scoreB = (normalizedB.includes('290525') ? 0 : 10) + (normalizedB.includes('bo sung') ? 0 : 1);
      return scoreA - scoreB
        || statSync(join(downloadsDir, b)).mtimeMs - statSync(join(downloadsDir, a)).mtimeMs;
    });

  return candidates[0] ? join(downloadsDir, candidates[0]) : '';
}

const filePath = resolve(fileArg || findDefaultFixture());

if (!filePath || !existsSync(filePath)) {
  console.error(`Import validation fixture not found: ${filePath || '(none)'}`);
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer', cellDates: false });
const firstSheetName = workbook.SheetNames[0];

if (!firstSheetName) {
  console.error(`Workbook has no sheets: ${filePath}`);
  process.exit(1);
}

const rows = parseWorksheetToRows(workbook.Sheets[firstSheetName]);
const { treeData, summary } = analyzeImportRows(rows, `${filePath} / ${firstSheetName}`, { syncMode: 'overwrite' });

const allMessages = [...summary.errors, ...summary.warnings].map((issue) => issue.message);
const hasTramAnhBirthWarning = allMessages.some((message) =>
  message.includes('Cao Ngọc Trâm Anh') && message.includes('thiếu ngày/năm sinh')
);
const hasUnlinkedWarning = allMessages.some((message) => message.includes('chưa xác định được cha/mẹ'));
const hasOldDuplicateAdvice = allMessages.some((message) => message.includes('Nên bổ sung cột id'));

if (summary.errors.length > 0) {
  console.error(`Expected no blocking import errors, got ${summary.errors.length}:`);
  summary.errors.forEach((issue) => console.error(`- ${issue.message}`));
  process.exit(1);
}

if (hasTramAnhBirthWarning) {
  console.error('Row 88 regression: Cao Ngọc Trâm Anh is still reported as missing birth date.');
  process.exit(1);
}

if (hasUnlinkedWarning) {
  console.error('Unexpected unlinked-node warning found in import validation.');
  allMessages.filter((message) => message.includes('chưa xác định được cha/mẹ')).forEach((message) => {
    console.error(`- ${message}`);
  });
  process.exit(1);
}

if (hasOldDuplicateAdvice) {
  console.error('Duplicate-name warning still uses old missing-id advice.');
  process.exit(1);
}

const flattened = flattenTreeToList(treeData);
const truong = flattened.find((node: any) => String(node.name || '').includes('Cao Xuân Trường')) as any;
if (!truong) {
  console.error('Expected Cao Xuân Trường to exist in validation fixture.');
  process.exit(1);
}

if (truong.solarBirthDate !== '19/4/1990' || truong.birthYear !== '1990') {
  console.error(`Date regression: expected Cao Xuân Trường solarBirthDate=19/4/1990 and birthYear=1990, got solarBirthDate=${truong.solarBirthDate} birthYear=${truong.birthYear}`);
  process.exit(1);
}

if (normalizeImportedPhone('12345678') !== '+8412345678') {
  console.error('Phone regression: 8-digit phone should receive +84 prefix.');
  process.exit(1);
}

if (normalizeImportedPhone('091234567') !== '+8491234567') {
  console.error('Phone regression: 9-digit phone starting with 0 should be converted to +84.');
  process.exit(1);
}

console.log('Import validation fixture OK');
console.log(`file=${filePath}`);
console.log(`sheet=${firstSheetName}`);
console.log(`rows=${summary.rowCount}`);
console.log(`members=${summary.validPersonCount}`);
console.log(`relations=${summary.relationCount}`);
console.log(`warnings=${summary.warnings.length}`);
console.log(`duplicates=${summary.duplicateNames.length}`);
console.log(`virtualChildren=${summary.virtualChildrenCount}`);
