import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const defaultZipPath = resolve(repoRoot, '..', 'gia-pha-ai-system-archive-20260530', 'Tai lieu', 'Cao_Toc_TXT_Knowledge_Base.zip');
const zipPath = resolve(process.env.CAO_TOC_TXT_ZIP || process.argv[2] || defaultZipPath);
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const reportPath = resolve(repoRoot, 'docs/phase-2f-anniversary-extraction-report.md');

const SOURCE = {
  entry: 'Cao_Toc_04_Ngay_sinh_mat_que_quan_mo_chi.txt',
  slug: 'cao-toc-txt-04-ngay-sinh-mat-que-quan-mo-chi',
  title: 'Cao Tộc Phả - Ngày sinh, ngày mất, quê quán, mộ chí',
  sourceType: 'genealogy_anniversary',
  visibility: 'kyc',
  tags: ['cao_toc_txt', 'ngay_sinh', 'ngay_mat', 'ngay_gio', 'que_quan', 'mo_chi', 'phase_2f'],
  summary: 'Trích riêng các dòng ngày sinh, ngày mất, quê quán, quan hệ và mộ chí từ Cao Tộc Phả để đối chiếu thủ công.',
};

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

function buildCandidateId(sourceId, personName, index) {
  return `ann_${sha256Base64Url(`${sourceId}:${personName}:${index}`).slice(0, 24)}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHan(value) {
  return String(value || '').replace(/[\u3400-\u9fff𠀀-𫠝]+/gu, '').replace(/\s+/g, ' ').trim();
}

function compactText(value, maxLength = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function estimateTextTokens(value) {
  return Math.ceil(String(value || '').length / 4);
}

function createSummary(content, maxLength = 320) {
  const lines = String(content || '').split(/\n+/).map((line) => line.replace(/^#+\s*/, '').trim()).filter((line) => line.length >= 20);
  return compactText(lines.slice(0, 3).join(' '), maxLength) || compactText(content, maxLength);
}

function splitLongBlock(block, maxLength, overlap) {
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

function buildChunks(content, { title = '', maxLength = 1100, overlap = 140 } = {}) {
  const sections = [];
  let currentHeading = title;
  let current = [];
  const headingPath = [];
  function flush() {
    const body = current.join('\n').trim();
    if (body) sections.push({ headingPath: currentHeading || title, content: body });
    current = [];
  }
  for (const line of String(content || '').replace(/\r\n/g, '\n').split('\n')) {
    const md = line.match(/^(#{1,6})\s+(.+)$/);
    if (md) {
      flush();
      const level = md[1].length;
      headingPath.splice(Math.max(0, level - 1));
      headingPath[level - 1] = md[2].trim();
      currentHeading = [title, ...headingPath.filter(Boolean)].join(' > ');
    } else {
      current.push(line);
    }
  }
  flush();
  const chunks = [];
  for (const section of sections.length ? sections : [{ headingPath: title, content }]) {
    let block = '';
    const paragraphs = section.content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    for (const paragraph of paragraphs.length ? paragraphs : [section.content]) {
      if ((block + '\n\n' + paragraph).trim().length > maxLength && block) {
        splitLongBlock(block, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
        block = paragraph;
      } else {
        block = [block, paragraph].filter(Boolean).join('\n\n');
      }
    }
    if (block.trim()) splitLongBlock(block, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
  }
  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

function readZipEntry(entryName) {
  let raw;
  try {
    raw = execFileSync('unzip', ['-p', zipPath, entryName], { maxBuffer: 20 * 1024 * 1024 });
  } catch (unzipErr) {
    try {
      raw = execFileSync('tar', ['-xOf', zipPath, entryName], { maxBuffer: 20 * 1024 * 1024 });
    } catch {
      const err = new Error(`Cannot read ${entryName} from ${zipPath}. Install unzip on Linux or verify the zip file.`);
      err.cause = unzipErr;
      throw err;
    }
  }
  return raw.toString('utf8').replace(/^\uFEFF/, '').trim();
}

function ensureSchema(db) {
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS extracted_anniversary_candidates (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL DEFAULT '',
      person_name TEXT NOT NULL,
      person_name_norm TEXT NOT NULL,
      generation TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      birth_text TEXT NOT NULL DEFAULT '',
      death_text TEXT NOT NULL DEFAULT '',
      death_anniversary_lunar TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      grave_text TEXT NOT NULL DEFAULT '',
      source_quote TEXT NOT NULL DEFAULT '',
      heading_path TEXT NOT NULL DEFAULT '',
      matched_member_id TEXT NOT NULL DEFAULT '',
      matched_member_name TEXT NOT NULL DEFAULT '',
      match_confidence TEXT NOT NULL DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'candidate',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_person ON extracted_anniversary_candidates(person_name_norm);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_source ON extracted_anniversary_candidates(source_id);
  `);
}

function flattenTree(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.name || node.id) out.push(node);
  for (const key of ['children', 'spouseDetails']) {
    if (Array.isArray(node[key])) node[key].forEach((child) => flattenTree(child, out));
  }
  return out;
}

function readTreeMembers(db) {
  const row = db.prepare("SELECT value FROM app_state WHERE key = 'lineage-tree'").get();
  if (!row) return [];
  try {
    const tree = JSON.parse(row.value);
    return flattenTree(tree).filter((item) => item?.name).map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      norm: normalizeText(stripHan(item.name)),
      generation: item.generation ?? item._explicitGeneration ?? '',
      birthYear: item.birthYear || '',
      deathYear: item.deathYear || '',
      deathAnniversaryLunar: item.deathAnniversaryLunar || '',
      burialPlace: item.burialPlace || item.graveLocation || item.deathPlace || ''
    }));
  } catch {
    return [];
  }
}

function matchMember(personName, members) {
  const norm = normalizeText(stripHan(personName));
  const exact = members.find((member) => member.norm === norm);
  if (exact) return { member: exact, confidence: 'exact' };
  const contained = members.find((member) => {
    if (!member.norm || member.norm.length < 8 || norm.length < 8) return false;
    return member.norm.includes(norm) || norm.includes(member.norm);
  });
  if (contained) return { member: contained, confidence: 'partial' };
  return { member: null, confidence: 'none' };
}

function parsePersonHeading(line) {
  const match = line.match(/^##\s+(.+?)(?:\s*[:.]\s*|\s+\[|$)/);
  if (!match) return '';
  return stripHan(match[1].replace(/^\d+\s*[-–]\s*/, '').trim());
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).replace(/\s+/g, ' ').trim();
  }
  return '';
}

function extractSections(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let generation = '';
  let current = null;
  for (const line of lines) {
    const gen = line.match(/^#\s+Đời\s+(.+)$/i);
    if (gen) generation = gen[1].trim();
    const person = parsePersonHeading(line);
    if (person) {
      if (current) sections.push(current);
      current = { personName: person, generation, heading: line.replace(/^##\s*/, '').trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

function extractCandidate(section, sourceId, chunks, members, index) {
  const content = section.lines.join('\n').trim();
  const flat = content.replace(/\s+/g, ' ').trim();
  const birthText = firstMatch(flat, [
    /(?:Sinh năm|sinh năm|Ông sinh|Bà sinh)\s+([^.;\n]+(?:\d{3,4})?)/u,
    /(Không biết rõ năm sinh|Năm sinh[^.;\n]+)/u
  ]);
  const deathText = firstMatch(flat, [
    /(?:tạ thế|mất|chết)\s+(Ngày\s+[^.;\n]+)/iu,
    /(Không biết rõ năm mất|Năm tạ thế[^.;\n]+|sống chết[^.;\n]+)/iu
  ]);
  const anniversary = firstMatch(flat, [
    /(?:tạ thế|mất)\s+(Ngày\s+(?:mùng\s+)?[^,.;\n]+tháng\s+[^,.;\n]+(?:Âm lịch|âm lịch)?)/iu,
    /(Ngày\s+(?:mùng\s+)?\d{1,2}\s+tháng\s+[^,.;\n]+(?:Âm lịch|âm lịch)?)/u
  ]);
  const hometown = firstMatch(flat, [
    /người\s+([^.;\n]+?(?:tỉnh|thành phố)\s+[^.;\n]+)/iu,
    /quê\s+(?:ở|quán)?\s*([^.;\n]+)/iu
  ]);
  const graveLines = section.lines.filter((line) => /mộ|Mộ|Lăng|lăng|an táng|quy tụ|quy tập/u.test(line));
  const graveText = compactText(graveLines.join(' '), 600);
  if (!birthText && !deathText && !anniversary && !hometown && !graveText) return null;
  const matched = matchMember(section.personName, members);
  const chunk = chunks.find((item) => item.content.includes(section.personName)) || chunks[0] || {};
  return {
    id: buildCandidateId(sourceId, section.personName, index),
    sourceId,
    chunkId: buildChunkId(sourceId, chunk.index || 0),
    personName: section.personName,
    generation: section.generation,
    branch: '',
    birthText,
    deathText,
    deathAnniversaryLunar: anniversary,
    hometown,
    graveText,
    sourceQuote: compactText(flat, 900),
    headingPath: `${SOURCE.title} > ${section.generation} > ${section.heading}`,
    matchedMemberId: matched.member?.id || '',
    matchedMemberName: matched.member?.name || '',
    matchConfidence: matched.confidence,
    metadata: {
      extracted_phase: 'phase_2f',
      matched_member_generation: matched.member?.generation ?? '',
      db_birth_year: matched.member?.birthYear || '',
      db_death_year: matched.member?.deathYear || '',
      db_death_anniversary_lunar: matched.member?.deathAnniversaryLunar || '',
      db_burial_place: matched.member?.burialPlace || ''
    }
  };
}

function importKnowledgeSource(db, content, sourceId, chunks) {
  const metadata = {
    source: 'cao_toc_txt_knowledge_base',
    origin_zip: 'Cao_Toc_TXT_Knowledge_Base.zip',
    origin_entry: SOURCE.entry,
    selected_import_phase: 'phase_2f',
    note: 'Imported by whitelist only; no database overwrite.'
  };
  db.prepare(`
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
  `).run(
    sourceId,
    SOURCE.slug,
    SOURCE.title,
    SOURCE.sourceType,
    'cao_toc_txt_knowledge_base',
    'cao_toc_phu_my',
    'ho_cao_giatochocao',
    'giatochocao.site',
    content,
    sha256Hex(content),
    JSON.stringify(metadata),
    SOURCE.summary,
    JSON.stringify(SOURCE.tags),
    JSON.stringify(['ngày sinh', 'ngày mất', 'ngày giỗ', 'quê quán', 'mộ chí']),
    SOURCE.visibility
  );
  db.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
  const insert = db.prepare(`
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
  chunks.forEach((chunk) => {
    const norm = normalizeText([SOURCE.title, SOURCE.tags.join(' '), chunk.headingPath, chunk.content].join('\n'));
    insert.run(
      buildChunkId(sourceId, chunk.index),
      sourceId,
      chunk.index,
      SOURCE.title,
      chunk.content,
      norm,
      JSON.stringify({ ...metadata, chunk_index: chunk.index, heading_path: chunk.headingPath }),
      createSummary(chunk.content, 240),
      JSON.stringify(SOURCE.tags),
      JSON.stringify(['ngày sinh', 'ngày mất', 'ngày giỗ', 'quê quán', 'mộ chí']),
      SOURCE.visibility,
      chunk.headingPath || SOURCE.title,
      norm,
      chunk.content.length,
      estimateTextTokens(chunk.content)
    );
  });
}

function saveCandidates(db, sourceId, candidates) {
  db.prepare('DELETE FROM extracted_anniversary_candidates WHERE source_id = ?').run(sourceId);
  const insert = db.prepare(`
    INSERT INTO extracted_anniversary_candidates (
      id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
      death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
      matched_member_name, match_confidence, status, metadata_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, datetime('now'))
  `);
  candidates.forEach((item) => {
    insert.run(
      item.id,
      item.sourceId,
      item.chunkId,
      item.personName,
      normalizeText(stripHan(item.personName)),
      item.generation,
      item.branch,
      item.birthText,
      item.deathText,
      item.deathAnniversaryLunar,
      item.hometown,
      item.graveText,
      item.sourceQuote,
      item.headingPath,
      item.matchedMemberId,
      item.matchedMemberName,
      item.matchConfidence,
      JSON.stringify(item.metadata)
    );
  });
}

function renderReport(candidates, status) {
  const exact = candidates.filter((item) => item.matchConfidence === 'exact').length;
  const partial = candidates.filter((item) => item.matchConfidence === 'partial').length;
  const none = candidates.filter((item) => item.matchConfidence === 'none').length;
  const lines = [
    '# Phase 2F Anniversary Extraction Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Source: ${SOURCE.entry}`,
    `- Imported visibility: ${SOURCE.visibility}`,
    `- Knowledge sources after import: ${status.sources}`,
    `- Knowledge chunks after import: ${status.chunks}`,
    `- Candidates extracted: ${candidates.length}`,
    `- Exact DB/tree matches: ${exact}`,
    `- Partial DB/tree matches: ${partial}`,
    `- Unmatched candidates: ${none}`,
    '',
    'No production lineage fields were overwritten. Candidates are stored for review only.',
    '',
    '## Candidate Preview',
    '',
    '| Person | Generation | Birth | Death/Giỗ | Hometown | Grave | Match |',
    '|---|---|---|---|---|---|---|'
  ];
  candidates.slice(0, 80).forEach((item) => {
    lines.push(`| ${item.personName} | ${item.generation} | ${compactText(item.birthText, 80)} | ${compactText(item.deathAnniversaryLunar || item.deathText, 100)} | ${compactText(item.hometown, 100)} | ${compactText(item.graveText, 100)} | ${item.matchConfidence}${item.matchedMemberName ? `: ${item.matchedMemberName}` : ''} |`);
  });
  return `${lines.join('\n')}\n`;
}

if (!existsSync(zipPath)) {
  console.error(`Missing Cao Toc TXT zip: ${zipPath}`);
  process.exit(1);
}

mkdirSync(dirname(databaseFile), { recursive: true });
if (existsSync(databaseFile) && process.env.SKIP_DB_BACKUP !== '1') {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupPath = `${databaseFile}.bak.before-cao-toc-04-import-${stamp}`;
  copyFileSync(databaseFile, backupPath);
  console.log(`Created local database backup: ${backupPath}`);
}

const db = new DatabaseSync(databaseFile);
db.exec('PRAGMA busy_timeout = 5000');
ensureSchema(db);
const content = readZipEntry(SOURCE.entry);
const sourceId = buildSourceId(SOURCE.slug);
const chunks = buildChunks(content, { title: SOURCE.title });
const members = readTreeMembers(db);
const sections = extractSections(content);
const candidates = sections
  .map((section, index) => extractCandidate(section, sourceId, chunks, members, index))
  .filter(Boolean);

db.exec('BEGIN');
try {
  importKnowledgeSource(db, content, sourceId, chunks);
  saveCandidates(db, sourceId, candidates);
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

const status = {
  sources: db.prepare('SELECT COUNT(*) AS count FROM knowledge_sources').get().count,
  chunks: db.prepare('SELECT COUNT(*) AS count FROM knowledge_chunks').get().count,
  candidates: db.prepare('SELECT COUNT(*) AS count FROM extracted_anniversary_candidates').get().count
};

writeFileSync(reportPath, renderReport(candidates, status), 'utf8');
console.log(JSON.stringify({
  ok: true,
  zipPath,
  databaseFile,
  reportPath,
  imported: {
    slug: SOURCE.slug,
    title: SOURCE.title,
    visibility: SOURCE.visibility,
    chars: content.length,
    chunks: chunks.length
  },
  extracted: {
    candidates: candidates.length,
    exactMatches: candidates.filter((item) => item.matchConfidence === 'exact').length,
    partialMatches: candidates.filter((item) => item.matchConfidence === 'partial').length,
    unmatched: candidates.filter((item) => item.matchConfidence === 'none').length
  },
  status
}, null, 2));
