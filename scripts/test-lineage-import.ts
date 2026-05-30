import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { buildTreeFromFlatList, cleanNameForMatching, flattenTreeToList } from '../src/utils/configManager';
import { parseWorksheetToRows } from '../src/utils/spreadsheetImport';

const args = process.argv.slice(2);
const showDetails = args.includes('--details');
const fileArg = args.find((arg) => arg !== '--details');

function findDefaultFixture(): string {
  const downloadsDir = join(process.env.USERPROFILE || 'C:\\Users\\truon', 'Downloads');
  const match = readdirSync(downloadsDir).find((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.xlsx') && lower.includes('web') && lower.includes('gia') && lower.includes('cao');
  });
  return match ? join(downloadsDir, match) : '';
}

const filePath = resolve(fileArg || findDefaultFixture());

if (!filePath || !existsSync(filePath)) {
  console.error(`Lineage import fixture not found: ${filePath || '(none)'}`);
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer', cellDates: false });
const firstSheetName = workbook.SheetNames[0];

if (!firstSheetName) {
  console.error(`Workbook has no sheets: ${filePath}`);
  process.exit(1);
}

const rows = parseWorksheetToRows(workbook.Sheets[firstSheetName]);
if (rows.length === 0) {
  console.error(`No lineage rows parsed from sheet "${firstSheetName}".`);
  process.exit(1);
}

const tree = buildTreeFromFlatList(rows);
if (!tree?.id) {
  console.error('Failed to build lineage tree from parsed rows.');
  process.exit(1);
}

const flattened = flattenTreeToList(tree);
const diagnostics = tree._diagnostics || {};
const unlinkedCount = Array.isArray(diagnostics.unlinkedNodes) ? diagnostics.unlinkedNodes.length : 0;
const duplicateCount = Array.isArray(diagnostics.duplicateNames) ? diagnostics.duplicateNames.length : 0;
const virtualNodes = flattened.filter((node: any) => String(node.id || '').startsWith('virtual-'));
const nodeById = new Map(flattened.map((node: any) => [node.id, node]));
const duplicateRows = new Map<string, Array<{ row: number; id: string; name: string }>>();

rows.forEach((row, index) => {
  const name = String(row._rawValues?.[1] || '').trim();
  const key = cleanNameForMatching(name);
  if (!key) return;
  if (!duplicateRows.has(key)) duplicateRows.set(key, []);
  duplicateRows.get(key)!.push({
    row: index + 2,
    id: String(row._rawValues?.[0] || ''),
    name
  });
});

console.log('Lineage import fixture OK');
console.log(`file=${filePath}`);
console.log(`sheet=${firstSheetName}`);
console.log(`rows=${rows.length}`);
console.log(`members=${flattened.length}`);
console.log(`root=${tree.name || tree.id}`);
console.log(`diagnosticVirtualChildren=${diagnostics.virtualChildrenCount || 0}`);
console.log(`actualVirtualMembers=${virtualNodes.length}`);
console.log(`duplicates=${duplicateCount}`);
console.log(`unlinked=${unlinkedCount}`);

if (showDetails) {
  console.log('\nActual virtual members:');
  virtualNodes.forEach((node: any) => {
    const parent = nodeById.get(node.parentId) as any;
    console.log(`- ${node.name} | generation ${node.generation || '?'} | parent: ${parent?.name || node.parentId}`);
  });

  console.log('\nDuplicate main-name rows:');
  for (const values of duplicateRows.values()) {
    if (values.length <= 1) continue;
    console.log(`- ${values.map((item) => `row ${item.row} id=${item.id} "${item.name}"`).join(' ; ')}`);
  }
}

if (flattened.length === 0) {
  console.error('Tree built but no members were flattened.');
  process.exit(1);
}
