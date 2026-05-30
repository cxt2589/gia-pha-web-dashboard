import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['src', 'server.mjs'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html']);
const ignoredDirs = new Set(['node_modules', 'dist', '.git']);

const suspiciousPatterns = [
  /\u00c3[\u0080-\uffff]/, // UTF-8 bytes decoded as Windows-1252, e.g. HÃ¡n.
  /\u00c4[\u0080-\uffff]/, // e.g. Ä, Äƒ.
  /\u00c6[\u0080-\uffff]/, // e.g. Æ°, Æ¡.
  /\u00e1[\u00ba\u00bb][\u0080-\uffff]?/, // e.g. áº, á».
  /\u00f0\u0178/, // emoji mojibake prefix.
  /\u00e2[\u0080-\u00ff\u0152-\u017e]/, // e.g. âœ, â–, â.
  /\u00ef\u00b8/, // variation-selector mojibake.
  /\ufffd/
];

function isTextFile(path) {
  return [...extensions].some((ext) => path.endsWith(ext));
}

function collectFiles(path, out = []) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (isTextFile(path)) out.push(path);
    return out;
  }

  if (!stat.isDirectory()) return out;
  for (const entry of readdirSync(path)) {
    if (ignoredDirs.has(entry)) continue;
    collectFiles(join(path, entry), out);
  }
  return out;
}

function findMojibake(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const matches = [];
  lines.forEach((line, index) => {
    if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
      matches.push({ file, line: index + 1, text: line.trim().slice(0, 180) });
    }
  });
  return matches;
}

const files = roots.flatMap((root) => collectFiles(root));
const findings = files.flatMap(findMojibake);

if (findings.length > 0) {
  console.error('Phát hiện chuỗi có dấu hiệu lỗi encoding/mojibake. Hãy sửa trước khi build/deploy:\n');
  findings.slice(0, 80).forEach((item) => {
    console.error(`${relative(process.cwd(), item.file)}:${item.line}  ${item.text}`);
  });
  if (findings.length > 80) {
    console.error(`\n... và ${findings.length - 80} dòng khác.`);
  }
  process.exit(1);
}

console.log('Mojibake check passed.');
