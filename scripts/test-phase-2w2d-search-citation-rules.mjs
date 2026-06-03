import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { getLineageAddressByGeneration } from '../src/utils/lineageAddress.mjs';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const sourceId = 'source_phase2w2d_genealogy';
const chunkId = 'chunk_phase2w2d_genealogy';
const techSourceId = 'source_phase2w2d_technical';
const techChunkId = 'chunk_phase2w2d_technical';
const pendingAnnId = 'ann_phase2w2d_pending_lang';
const pendingPersonName = 'Cao Đình Thử Nghiệm';

function getDatabase() {
  const database = new DatabaseSync(databaseFile);
  database.exec('PRAGMA busy_timeout = 5000');
  return database;
}

function getState(database, key, fallback) {
  const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

function putState(database, key, value) {
  database.prepare(`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value));
}

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2w2d_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2d-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = { provider: 'local', id: 'phase2w2d-admin', account: 'phase2w2d-admin', name: 'Phase 2W2D Admin', loggedInAt: new Date().toISOString() };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [{
    id: userId,
    username: 'phase2w2d-admin',
    fullName: 'Phase 2W2D Admin',
    role: 'admin',
    roles: ['admin'],
    isKYCed: true,
    kycStatus: 'verified',
    isApproved: true,
    approvalStatus: 'approved',
    loginType: 'local'
  }, ...users.filter((user) => user.id !== userId)]);
  database.close();
  return {
    cookie: `${cookieName}=${encodeURIComponent(token)}`,
    cleanup() {
      const cleanupDb = getDatabase();
      const nextSessions = getState(cleanupDb, 'auth-sessions', {});
      delete nextSessions[token];
      putState(cleanupDb, 'auth-sessions', nextSessions);
      putState(cleanupDb, 'auth-users', getState(cleanupDb, 'auth-users', []).filter((user) => user.id !== userId));
      cleanupDb.close();
    }
  };
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function cleanupFixture(database = getDatabase()) {
  database.prepare('DELETE FROM extracted_anniversary_candidates WHERE id = ?').run(pendingAnnId);
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id IN (?, ?)').run(sourceId, techSourceId);
  database.prepare('DELETE FROM knowledge_sources WHERE id IN (?, ?)').run(sourceId, techSourceId);
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const genealogyContent = [
    'Hồ sơ danh xưng Phase 2W.2D.',
    'Cao Đình Thuật còn được tôn là Cao Tổ, tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân.',
    'Cao Đình Lạng còn được gọi là Nhiêu Lạng và được tôn là Thủy Tổ.'
  ].join('\n');
  const technicalContent = 'Technical rule: Cao Đình Lạng lowercase, bỏ kính xưng, không dùng làm evidence gia phả.';
  for (const source of [
    [sourceId, 'phase2w2d-genealogy', 'Phase 2W2D nguồn gia phả thật', genealogyContent, { sourceKind: 'genealogy_evidence' }, 'public'],
    [techSourceId, 'phase2w2d-technical-rule', 'Phase 2W2D backend implementation notes', technicalContent, { sourceKind: 'technical_rule', excludeFromExtraction: true, excludeFromPublicChat: true }, 'admin']
  ]) {
    database.prepare(`
      INSERT INTO knowledge_sources
        (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
      VALUES (?, ?, ?, 'test', 'phase2w2d', '', '', '', ?, ?, ?, ?, '[]', ?, ?, 'indexed', datetime('now'))
    `).run(source[0], source[1], source[2], source[3], `${source[0]}_hash`, JSON.stringify(source[4]), source[3], JSON.stringify(['Cao Đình Thuật', 'Cao Đình Lạng', 'Mãnh Đế Đại Tướng Quân', 'Nhiêu Lạng']), source[5]);
  }
  for (const chunk of [
    [chunkId, sourceId, 'Danh xưng Cao Tổ Thủy Tổ', genealogyContent, 'Danh xưng / tước hiệu'],
    [techChunkId, techSourceId, 'Technical rule', technicalContent, 'technical']
  ]) {
    database.prepare(`
      INSERT INTO knowledge_chunks
        (id, source_id, chunk_index, title, content, content_norm, content_ascii, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
      VALUES (?, ?, 0, ?, ?, ?, ?, '{}', ?, '[]', ?, ?, ?, datetime('now'))
    `).run(chunk[0], chunk[1], chunk[2], chunk[3], normalize(chunk[3]), normalize(chunk[3]), chunk[3], JSON.stringify(['Cao Đình Thuật', 'Cao Đình Lạng', 'Mãnh Đế Đại Tướng Quân', 'Nhiêu Lạng']), chunk[1] === sourceId ? 'public' : 'admin', chunk[4]);
  }
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, death_anniversary_lunar, source_quote, heading_path, status, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, 'cao dinh thu nghiem', 'ngày 12 tháng 3 âm lịch', 'Cao Đình Thử Nghiệm: ngày giỗ ngày 12 tháng 3 âm lịch.', 'Phase 2W2D pending anniversary', 'pending', ?, datetime('now'))
  `).run(pendingAnnId, sourceId, chunkId, pendingPersonName, JSON.stringify({
    sourceId,
    chunkId,
    sourceTitle: 'Phase 2W2D nguồn gia phả thật',
    headingPath: 'Phase 2W2D pending anniversary',
    evidenceQuote: 'Cao Đình Thử Nghiệm: ngày giỗ ngày 12 tháng 3 âm lịch.',
    evidenceType: 'date_grave'
  }));
  database.close();
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { response, data };
}

function result(id, passed, detail = '') {
  const row = { id, passed: Boolean(passed), detail: String(detail || '') };
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${id}${detail ? ` - ${detail}` : ''}`);
  return row;
}

async function aiChat(question, headers = {}) {
  return fetchJson('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ message: question, prompt: question, engine: 'local', botType: 'dashboard_helper', intent: 'knowledge_question' })
  });
}

async function main() {
  const admin = installTempAdminSession();
  installFixture();
  const database = getDatabase();
  const treeBefore = JSON.stringify(getState(database, 'lineage-tree', null));
  database.close();
  const results = [];
  try {
    const expected = [[0, 'Cao Tổ'], [1, 'Thủy Tổ'], [2, 'Cụ'], [7, 'Cụ'], [8, 'Ông'], [9, 'Anh'], [12, 'Anh']];
    results.push(result('lineage-address-generation-rules', expected.every(([gen, label]) => getLineageAddressByGeneration(gen) === label), expected.map(([gen]) => `${gen}:${getLineageAddressByGeneration(gen)}`).join(', ')));

    const caoTo = await aiChat('Cao Tổ là ai?');
    results.push(result('cao-to-is-cao-dinh-thuat', caoTo.response.ok && /Cao Đình Thuật/.test(caoTo.data.text || '') && !/Cao Đình Lạng\s*-\s*Cao Tổ/.test(caoTo.data.text || ''), caoTo.data.text));

    const thuyTo = await aiChat('Thủy Tổ là ai?');
    results.push(result('thuy-to-is-cao-dinh-lang', thuyTo.response.ok && /Cao Đình Lạng/.test(thuyTo.data.text || '') && !/Cao Đình Thuật\s*-\s*Thủy Tổ/.test(thuyTo.data.text || ''), thuyTo.data.text));

    const doi7 = await aiChat('cụ đời 7 xưng thế nào?');
    const doi8 = await aiChat('đời 8 xưng thế nào?');
    const doi9 = await aiChat('đời 9 xưng thế nào?');
    results.push(result('generation-7-address-cu', doi7.response.ok && /Cụ/.test(doi7.data.text || ''), doi7.data.text));
    results.push(result('generation-8-address-ong', doi8.response.ok && /Ông/.test(doi8.data.text || ''), doi8.data.text));
    results.push(result('generation-9-address-anh', doi9.response.ok && /Anh/.test(doi9.data.text || ''), doi9.data.text));

    const searchNhieuLang = await fetchJson('/api/knowledge/search?q=Nhi%C3%AAu%20L%E1%BA%A1ng&limit=5');
    results.push(result('search-nhieu-lang-expands-cao-dinh-lang', searchNhieuLang.response.ok && (searchNhieuLang.data.aliases || []).some((item) => item.canonicalName === 'Cao Đình Lạng'), JSON.stringify(searchNhieuLang.data.aliases || [])));

    const searchManhDe = await fetchJson('/api/knowledge/search?q=M%C3%A3nh%20%C4%90%E1%BA%BF%20%C4%90%E1%BA%A1i%20T%C6%B0%E1%BB%9Bng%20Qu%C3%A2n&limit=5');
    const manhDeText = JSON.stringify(searchManhDe.data);
    results.push(result('search-manh-de-links-cao-dinh-thuat', searchManhDe.response.ok && /Cao Đình Thuật/.test(manhDeText) && (searchManhDe.data.chunks || [])[0]?.sourceId === sourceId, JSON.stringify((searchManhDe.data.chunks || []).slice(0, 2))));
    results.push(result('citation-no-technical-rule', searchManhDe.response.ok && (searchManhDe.data.citations || []).length > 0 && (searchManhDe.data.citations || []).every((item) => item.sourceId !== techSourceId), JSON.stringify(searchManhDe.data.citations || [])));

    const knowledgeAI = await aiChat('Mãnh Đế Đại Tướng Quân liên hệ ai?');
    results.push(result('ai-response-has-citations', knowledgeAI.response.ok && (knowledgeAI.data.citations || []).some((item) => item.sourceId === sourceId && item.sourceTitle && item.chunkId && item.evidenceQuote), JSON.stringify(knowledgeAI.data.citations || [])));

    const pendingAnswer = await aiChat(`ngày giỗ cụ ${pendingPersonName} là ngày nào?`, { Cookie: admin.cookie });
    results.push(result('pending-not-verified', pendingAnswer.response.ok && /chờ duyệt|chưa được duyệt|không coi là dữ liệu xác minh/i.test(pendingAnswer.data.text || ''), pendingAnswer.data.text));

    const dbAfter = getDatabase();
    const treeAfter = JSON.stringify(getState(dbAfter, 'lineage-tree', null));
    dbAfter.close();
    results.push(result('test-does-not-change-lineage-tree', treeBefore === treeAfter, 'lineage-tree unchanged'));
  } finally {
    cleanupFixture();
    admin.cleanup();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2D search/citation/rules failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2D search/citation/rules checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
