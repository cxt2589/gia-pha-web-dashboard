import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { buildTreeFromFlatList, flattenTreeToList } from '../src/utils/configManager';
import { parseWorksheetToRows } from '../src/utils/spreadsheetImport';

const args = process.argv.slice(2);
const outArgIndex = args.indexOf('--out');
const sourceArg = args.find((arg, index) => arg !== '--out' && index !== outArgIndex + 1);
const outArg = outArgIndex >= 0 ? args[outArgIndex + 1] : '';

function findDefaultFixture(): string {
  const downloadsDir = join(process.env.USERPROFILE || 'C:\\Users\\truon', 'Downloads');
  const match = readdirSync(downloadsDir).find((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.xlsx') && lower.includes('web') && lower.includes('gia') && lower.includes('cao');
  });
  return match ? join(downloadsDir, match) : '';
}

const sourcePath = resolve(sourceArg || findDefaultFixture());
const outputPath = resolve(
  outArg || join(process.env.USERPROFILE || 'C:\\Users\\truon', 'Downloads', 'node-ao-gia-pha-ho-cao.xlsx')
);

const sourceWorkbook = XLSX.read(readFileSync(sourcePath), { type: 'buffer', cellDates: false });
const firstSheetName = sourceWorkbook.SheetNames[0];
if (!firstSheetName) throw new Error(`Workbook has no sheets: ${sourcePath}`);

const rows = parseWorksheetToRows(sourceWorkbook.Sheets[firstSheetName]);
if (rows.length === 0) throw new Error(`No rows parsed from: ${sourcePath}`);

const headers = rows[0]._headers;
const tree = buildTreeFromFlatList(rows);
const flat = flattenTreeToList(tree);
const byId = new Map(flat.map((node: any) => [node.id, node]));
const virtualNodes = flat.filter((node: any) => String(node.id || '').startsWith('virtual-'));

const matrix = [headers];
for (const [index, node] of virtualNodes.entries()) {
  const parent = byId.get(node.parentId) as any;
  const row = headers.map(() => '');

  row[0] = `VAO-${String(index + 1).padStart(3, '0')}`;
  row[1] = node.name || '';
  row[2] = node.gender === 'nữ' ? 'Nữ' : 'Nam';
  row[9] = node.isLiving === false ? 'Đã mất' : 'Còn sống';
  row[12] = node.generation ? String(node.generation) : '';
  row[13] = parent?.name || '';
  row[20] = parent?.id || node.parentId || '';

  matrix.push(row);
}

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(matrix);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Node ao can bo sung');
XLSX.writeFile(workbook, outputPath);

console.log(`created=${outputPath}`);
console.log(`rows=${virtualNodes.length}`);
