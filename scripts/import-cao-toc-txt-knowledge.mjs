import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const defaultZipPath = resolve(
  repoRoot,
  '..',
  'gia-pha-ai-system-archive-20260530',
  'Tai lieu',
  'Cao_Toc_TXT_Knowledge_Base.zip'
);
const zipPath = resolve(process.env.CAO_TOC_TXT_ZIP || process.argv[2] || defaultZipPath);
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');

const IMPORT_SOURCES = [
  {
    entry: 'Cao_Toc_05_Diem_can_kiem_chung_loi_can_sua.txt',
    slug: 'cao-toc-txt-05-kiem-chung-han-nom',
    title: 'Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR',
    sourceType: 'han_nom',
    visibility: 'private',
    tags: ['cao_toc_txt', 'kiem_chung', 'han_nom', 'ocr', 'guardrail'],
    summary: 'Các điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR và nguyên tắc thận trọng khi AI trả lời.',
    order: 1
  },
  {
    entry: 'Cao_Toc_02_Lich_su_nguon_goc_moc_thoi_gian_dia_danh.txt',
    slug: 'cao-toc-txt-02-lich-su-nguon-goc-dia-danh',
    title: 'Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh',
    sourceType: 'genealogy',
    visibility: 'kyc',
    tags: ['cao_toc_txt', 'lich_su', 'nguon_goc', 'moc_thoi_gian', 'dia_danh'],
    summary: 'Các đoạn lịch sử, nguồn gốc, địa danh và mốc thời gian trong Cao Tộc Phả.',
    order: 2
  },
  {
    entry: 'Cao_Toc_03_Pha_he_danh_sach_nhan_vat_theo_doi.txt',
    slug: 'cao-toc-txt-03-pha-he-nhan-vat-theo-doi',
    title: 'Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời',
    sourceType: 'genealogy',
    visibility: 'kyc',
    tags: ['cao_toc_txt', 'pha_he', 'nhan_vat', 'doi', 'quan_he'],
    summary: 'Các mục nhân vật, đời, quan hệ và trích dẫn trang trong phần thế phả họ Cao.',
    order: 3
  }
];

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('base64url');
}

function buildSourceId(slug) {
  return `source_${sha256Base64Url(slug).slice(0, 24)}`;
}

function buildChunkId(sourceId, chunkIndex) {
  return `chunk_${sha256Base64Url(`${sourceId}:${chunkIndex}`).slice(0, 24)}`;
}

function normalizeKnowledgeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value, maxLength = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function createLocalSummary(content, maxLength = 320) {
  const lines = String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter((line) => line.length >= 20);
  return compactText(lines.slice(0, 3).join(' '), maxLength) || compactText(content, maxLength);
}

function estimateTextTokens(value) {
  return Math.ceil(String(value || '').length / 4);
}

function inferKnowledgeEntityRefs(title, content) {
  const raw = [title, content].join('\n');
  const refs = new Set();
  const nameMatches = raw.match(/\bCao\s+(?:Đình|Duy|Văn|Xuân|Hữu|Quang|Thế|Minh|Mạnh)\s+[A-ZÀ-Ỹ][\p{L}\p{M}'’-]+/gu) || [];
  nameMatches.slice(0, 30).forEach((name) => refs.add(name.replace(/\s+/g, ' ').trim()));
  [
    ['Cao Tổ', /cao\s*tổ/i],
    ['Thủy Tổ', /thủy\s*tổ/i],
    ['ngày giỗ', /ngày\s+giỗ|kỵ\s+nhật/i],
    ['ngày mất', /ngày\s+mất|năm\s+mất/i],
    ['năm sinh', /năm\s+sinh|sinh\s+năm/i],
    ['chi/ngành', /chi\s*\/?\s*ngành|chi\s+nhánh/i],
    ['đời', /\bđời\b|generation/i],
    ['Hán Nôm', /Hán\s*Nôm|[\u3400-\u9fff]/i]
  ].forEach(([label, pattern]) => {
    if (pattern.test(raw)) refs.add(label);
  });
  return [...refs].slice(0, 40);
}

function splitLongKnowledgeBlock(block, maxLength, overlap) {
  const text = String(block || '').trim();
  if (text.length <= maxLength) return [text].filter(Boolean);
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxLength);
    if (end < text.length) {
      const breakAt = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end), text.lastIndexOf('; ', end));
      if (breakAt > start + Math.floor(maxLength * 0.55)) end = breakAt + 1;
    }
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function buildKnowledgeChunks(content, { title = '', maxLength = 1100, overlap = 140 } = {}) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  const headingPath = [];
  let currentHeading = title;
  let current = [];

  function flushSection() {
    const body = current.join('\n').trim();
    if (body) sections.push({ headingPath: currentHeading || title, content: body });
    current = [];
  }

  for (const line of lines) {
    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
    const numberedHeading = line.match(/^(\d+(?:\.\d+)*\.?|[IVX]+\.)\s+(.{3,100})$/i);
    const plainHeading = !markdownHeading && !numberedHeading && line.trim().length <= 80 && current.length === 0 && /[:：]$/.test(line.trim());
    if (markdownHeading || numberedHeading || plainHeading) {
      flushSection();
      const level = markdownHeading ? markdownHeading[1].length : 2;
      const textHeading = (markdownHeading?.[2] || numberedHeading?.[2] || line).replace(/[:：]$/, '').trim();
      headingPath.splice(Math.max(0, level - 1));
      headingPath[level - 1] = textHeading;
      currentHeading = [title, ...headingPath.filter(Boolean)].filter(Boolean).join(' > ');
      continue;
    }
    current.push(line);
  }
  flushSection();

  const blocks = sections.length ? sections : [{ headingPath: title, content: text }];
  const chunks = [];
  for (const section of blocks) {
    let currentBlock = '';
    const paragraphs = section.content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    for (const paragraph of paragraphs.length ? paragraphs : [section.content]) {
      if ((currentBlock + '\n\n' + paragraph).trim().length > maxLength && currentBlock) {
        splitLongKnowledgeBlock(currentBlock, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
        currentBlock = paragraph;
      } else {
        currentBlock = [currentBlock, paragraph].filter(Boolean).join('\n\n');
      }
    }
    if (currentBlock.trim()) {
      splitLongKnowledgeBlock(currentBlock, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
    }
  }
  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

function readZipEntry(entryName) {
  const raw = execFileSync('tar', ['-xOf', zipPath, entryName], { maxBuffer: 20 * 1024 * 1024 });
  return raw.toString('utf8').replace(/^\uFEFF/, '').trim();
}

function ensureKnowledgeSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'manual',
      scope TEXT,
      clan_scope TEXT,
      system_scope TEXT,
      domain TEXT,
      content TEXT NOT NULL DEFAULT '',
      source_hash TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      summary TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      entity_refs_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'indexed'
    );
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_norm TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      summary TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      entity_refs_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'public',
      heading_path TEXT NOT NULL DEFAULT '',
      content_ascii TEXT NOT NULL DEFAULT '',
      char_count INTEGER NOT NULL DEFAULT 0,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_sources_visibility ON knowledge_sources(visibility);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_visibility ON knowledge_chunks(visibility);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ascii ON knowledge_chunks(content_ascii);
  `);
}

function importSource(database, sourceConfig) {
  const content = readZipEntry(sourceConfig.entry);
  const sourceId = buildSourceId(sourceConfig.slug);
  const entityRefs = inferKnowledgeEntityRefs(sourceConfig.title, content);
  const summary = sourceConfig.summary || createLocalSummary(content, 320);
  const metadata = {
    source: 'cao_toc_txt_knowledge_base',
    origin_zip: 'Cao_Toc_TXT_Knowledge_Base.zip',
    origin_entry: sourceConfig.entry,
    selected_import_phase: 'phase_2d',
    import_order: sourceConfig.order,
    rule_priority: 'database_tree_then_alias_then_txt_reference',
    note: 'Imported by whitelist only; not a full zip import.'
  };

  const sourceInsert = database.prepare(`
    INSERT INTO knowledge_sources (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexed', datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      source_type = excluded.source_type,
      scope = excluded.scope,
      clan_scope = excluded.clan_scope,
      system_scope = excluded.system_scope,
      domain = excluded.domain,
      content = excluded.content,
      source_hash = excluded.source_hash,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const chunkDelete = database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?');
  const chunkInsert = database.prepare(`
    INSERT INTO knowledge_chunks (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, content_ascii, char_count, token_estimate, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(source_id, chunk_index) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      content_norm = excluded.content_norm,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      heading_path = excluded.heading_path,
      content_ascii = excluded.content_ascii,
      char_count = excluded.char_count,
      token_estimate = excluded.token_estimate,
      updated_at = excluded.updated_at
  `);

  sourceInsert.run(
    sourceId,
    sourceConfig.slug,
    sourceConfig.title,
    sourceConfig.sourceType,
    'cao_toc_txt_knowledge_base',
    'cao_toc_phu_my',
    'ho_cao_giatochocao',
    'giatochocao.site',
    content,
    sha256Hex(content),
    JSON.stringify(metadata),
    summary,
    JSON.stringify(sourceConfig.tags),
    JSON.stringify(entityRefs),
    sourceConfig.visibility
  );

  chunkDelete.run(sourceId);
  const chunks = buildKnowledgeChunks(content, { title: sourceConfig.title });
  chunks.forEach((chunk, index) => {
    const chunkSummary = createLocalSummary(chunk.content, 240);
    const chunkNorm = normalizeKnowledgeText([
      sourceConfig.title,
      summary,
      sourceConfig.tags.join(' '),
      entityRefs.join(' '),
      chunk.headingPath,
      chunk.content
    ].join('\n'));
    chunkInsert.run(
      buildChunkId(sourceId, index),
      sourceId,
      index,
      sourceConfig.title,
      chunk.content,
      chunkNorm,
      JSON.stringify({ ...metadata, chunk_index: index, heading_path: chunk.headingPath }),
      chunkSummary,
      JSON.stringify(sourceConfig.tags),
      JSON.stringify(entityRefs),
      sourceConfig.visibility,
      chunk.headingPath || sourceConfig.title,
      chunkNorm,
      chunk.content.length,
      estimateTextTokens(chunk.content)
    );
  });

  return {
    slug: sourceConfig.slug,
    title: sourceConfig.title,
    visibility: sourceConfig.visibility,
    chars: content.length,
    chunks: chunks.length
  };
}

if (!existsSync(zipPath)) {
  console.error(`Missing Cao Toc TXT zip: ${zipPath}`);
  process.exit(1);
}

mkdirSync(dirname(databaseFile), { recursive: true });
if (existsSync(databaseFile) && process.env.SKIP_DB_BACKUP !== '1') {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupPath = `${databaseFile}.bak.before-cao-toc-txt-import-${stamp}`;
  copyFileSync(databaseFile, backupPath);
  console.log(`Created local database backup: ${backupPath}`);
}

const database = new DatabaseSync(databaseFile);
ensureKnowledgeSchema(database);

database.exec('BEGIN');
let results = [];
try {
  results = IMPORT_SOURCES.map((source) => importSource(database, source));
  database.exec('COMMIT');
} catch (err) {
  database.exec('ROLLBACK');
  throw err;
}

const status = {
  sources: database.prepare('SELECT COUNT(*) AS count FROM knowledge_sources').get().count,
  chunks: database.prepare('SELECT COUNT(*) AS count FROM knowledge_chunks').get().count,
  aliases: database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'entity_aliases'").get().count
    ? database.prepare('SELECT COUNT(*) AS count FROM entity_aliases').get().count
    : 0,
  indexedSources: database.prepare("SELECT COUNT(*) AS count FROM knowledge_sources WHERE status = 'indexed'").get().count
};

console.log(JSON.stringify({ ok: true, zipPath, databaseFile, imported: results, status }, null, 2));
