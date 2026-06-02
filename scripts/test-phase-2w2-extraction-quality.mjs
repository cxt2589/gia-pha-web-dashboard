import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const techSourceId = 'source_phase2w2b_technical';
const techChunkId = 'chunk_phase2w2b_technical';
const goodSourceId = 'source_phase2w2b_genealogy';
const goodChunkId = 'chunk_phase2w2b_genealogy';
const verifySourceId = 'source_phase2w2b_verify';
const verifyChunkId = 'chunk_phase2w2b_verify';
const appliedProfileId = 'profile_phase2w2b_applied_keep';
const annSourceId = 'source_phase2w2b_ann';
const annChunkId = 'chunk_phase2w2b_ann';
const annGraveId = 'ann_phase2w2b_grave';
const annHomeId = 'ann_phase2w2b_home';

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
  const token = `phase2w2b_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2b-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = { provider: 'local', id: 'phase2w2b-admin', account: 'phase2w2b-admin', name: 'Phase 2W2B Admin', loggedInAt: new Date().toISOString() };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [{
    id: userId,
    username: 'phase2w2b-admin',
    fullName: 'Phase 2W2B Admin',
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

function cleanupFixture(database = getDatabase()) {
  database.prepare("DELETE FROM extracted_profile_candidates WHERE id LIKE 'profile_phase2w2b_%' OR source_id IN (?, ?, ?)").run(techSourceId, goodSourceId, verifySourceId);
  database.prepare("DELETE FROM extracted_relationship_candidates WHERE id LIKE 'rel_phase2w2b_%' OR source_id IN (?, ?, ?)").run(techSourceId, goodSourceId, verifySourceId);
  database.prepare('DELETE FROM extracted_anniversary_candidates WHERE id IN (?, ?)').run(annGraveId, annHomeId);
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id IN (?, ?, ?, ?)').run(techSourceId, goodSourceId, verifySourceId, annSourceId);
  database.prepare('DELETE FROM knowledge_sources WHERE id IN (?, ?, ?, ?)').run(techSourceId, goodSourceId, verifySourceId, annSourceId);
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const technicalContent = 'Cao Đình Lạng lowercase. bỏ kính xưng. Cao Phú Mỹ ghi là Thủy. Cao Văn Ninh mua Phó Lý.';
  const goodContent = [
    'Hồ sơ gia phả Phase 2W2B.',
    'ho ten: Cao Văn Chất Lượng.',
    'Cao Văn Chất Lượng có cong lao lập nhà thờ họ và chăm lo việc khuyến học trong chi.',
    'Cao Văn Phụ Thân là cha của Cao Văn Hậu Tự.'
  ].join('\n');
  const verifyContent = 'Mục cần kiểm chứng: nguồn gốc trước Cao Đình Lạng, mốc 1807, liên hệ họ Cao thôn Trai/Gia Hòa và văn bản 1930 chưa đủ chứng cứ.';
  const annContent = 'Cao Văn Mộ Chí: phần mộ an táng tại Nghĩa trang Phú Mỹ. Cao Văn Quê Quán: quê quán tại Phú Mỹ, Ninh Bình.';

  for (const source of [
    [techSourceId, 'phase2w2b-technical-rule', 'backend implementation notes', technicalContent, { sourceKind: 'technical_rule', excludeFromExtraction: true, excludeFromPublicChat: true }, 'admin'],
    [goodSourceId, 'phase2w2b-genealogy', 'Phase 2W2B gia phả thật', goodContent, { sourceKind: 'genealogy_evidence' }, 'private'],
    [verifySourceId, 'phase2w2b-verification-note', 'Phase 2W2B điểm cần kiểm chứng', verifyContent, { sourceKind: 'verification_note' }, 'private'],
    [annSourceId, 'phase2w2b-anniversary', 'Phase 2W2B ngày tháng mộ chí', annContent, { sourceKind: 'genealogy_evidence' }, 'private']
  ]) {
    database.prepare(`
      INSERT INTO knowledge_sources
        (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
      VALUES (?, ?, ?, 'test', 'test', '', '', '', ?, ?, ?, ?, '[]', '[]', ?, 'indexed', datetime('now'))
    `).run(source[0], source[1], source[2], source[3], `${source[0]}_hash`, JSON.stringify(source[4]), source[3], source[5]);
  }
  for (const chunk of [
    [techChunkId, techSourceId, 'backend implementation notes', technicalContent, 'technical'],
    [goodChunkId, goodSourceId, 'Phase 2W2B gia phả thật', goodContent, 'gia phả thật'],
    [verifyChunkId, verifySourceId, 'Phase 2W2B điểm cần kiểm chứng', verifyContent, 'điểm cần kiểm chứng'],
    [annChunkId, annSourceId, 'Phase 2W2B ngày tháng mộ chí', annContent, 'ngày tháng mộ chí']
  ]) {
    database.prepare(`
      INSERT INTO knowledge_chunks
        (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
      VALUES (?, ?, 0, ?, ?, ?, '{}', ?, '[]', '[]', 'private', ?, datetime('now'))
    `).run(chunk[0], chunk[1], chunk[2], chunk[3], chunk[3].toLowerCase(), chunk[3], chunk[4]);
  }
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'biography', 'Cao Văn Applied 2W2B', 'cao van applied 2w2b', '', '', 'none', 'description', 'Applied candidate cũ không được sửa.', 'Applied candidate cũ không được sửa.', ?, ?, 'Phase 2W2B gia phả thật', 'private', 'applied', '{}', datetime('now'), datetime('now'))
  `).run(appliedProfileId, goodSourceId, goodChunkId);
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, hometown, grave_text, source_quote, heading_path, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Văn Mộ Chí', 'cao van mo chi', '', 'phần mộ an táng tại Nghĩa trang Phú Mỹ', 'phần mộ an táng tại Nghĩa trang Phú Mỹ', 'ngày tháng mộ chí', 'pending', ?, datetime('now'))
  `).run(annGraveId, annSourceId, annChunkId, JSON.stringify({ evidenceType: 'date_grave', evidenceQuote: 'phần mộ an táng tại Nghĩa trang Phú Mỹ', sourceTitle: 'Phase 2W2B ngày tháng mộ chí' }));
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, hometown, grave_text, source_quote, heading_path, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Văn Quê Quán', 'cao van que quan', 'quê quán tại Phú Mỹ, Ninh Bình', '', 'quê quán tại Phú Mỹ, Ninh Bình', 'ngày tháng mộ chí', 'pending', ?, datetime('now'))
  `).run(annHomeId, annSourceId, annChunkId, JSON.stringify({ evidenceType: 'date_grave', evidenceQuote: 'quê quán tại Phú Mỹ, Ninh Bình', sourceTitle: 'Phase 2W2B ngày tháng mộ chí' }));
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

async function main() {
  const admin = installTempAdminSession();
  installFixture();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const techScan = await fetchJson('/api/knowledge/profile-candidates/scan-names', { method: 'POST', headers, body: JSON.stringify({ sourceId: techSourceId, limit: 20 }) });
    results.push(result('no-candidate-from-technical-rule', techScan.response.ok && techScan.data.created === 0, `created=${techScan.data.created}`));
    const techList = await fetchJson('/api/knowledge/profile-candidates?q=lowercase&status=pending', { headers });
    results.push(result('no-lowercase-name-candidate', techList.response.ok && (techList.data.candidates || []).every((item) => !String(item.personName || '').includes('lowercase')), `${techList.data.candidates?.length || 0} candidates`));

    const nameScan = await fetchJson('/api/knowledge/profile-candidates/scan-names', { method: 'POST', headers, body: JSON.stringify({ sourceId: goodSourceId, limit: 20 }) });
    results.push(result('name-scan-has-evidence', nameScan.response.ok && (nameScan.data.candidates || []).some((item) => item.evidenceQuote && item.sourceTitle && item.chunkId === goodChunkId), `created=${nameScan.data.created}`));

    const profileScan = await fetchJson('/api/knowledge/profile-candidates/scan', { method: 'POST', headers, body: JSON.stringify({ sourceId: goodSourceId, limit: 20 }) });
    const profileCandidate = (profileScan.data.candidates || []).find((item) => String(item.evidenceQuote || '').includes('Cao Văn Chất Lượng'));
    results.push(result('biography-evidence-around-person', profileScan.response.ok && profileCandidate && !String(profileCandidate.evidenceQuote || '').includes('Cao Văn Phụ Thân là cha'), profileCandidate?.evidenceQuote || 'missing'));

    const relationshipScan = await fetchJson('/api/knowledge/relationship-candidates/scan', { method: 'POST', headers, body: JSON.stringify({ sourceId: goodSourceId, limit: 20 }) });
    const relationshipCandidate = (relationshipScan.data.candidates || []).find((item) => item.subjectName && item.objectName);
    results.push(result('relationship-has-subject-object-evidence', relationshipScan.response.ok && relationshipCandidate?.evidenceQuote && relationshipCandidate.subjectName && relationshipCandidate.objectName, relationshipCandidate?.evidenceQuote || 'missing'));

    const verifyScan = await fetchJson('/api/knowledge/relationship-candidates/scan', { method: 'POST', headers, body: JSON.stringify({ sourceId: verifySourceId, limit: 20 }) });
    const verifyList = await fetchJson('/api/knowledge/profile-candidates?type=verification_note&status=pending&q=1807', { headers });
    const relVerifyList = await fetchJson('/api/knowledge/relationship-candidates?status=pending&q=1807', { headers });
    results.push(result('verification-note-not-relationship', verifyScan.response.ok && (verifyList.data.candidates || []).length >= 1 && (relVerifyList.data.candidates || []).length === 0, `verification=${verifyList.data.candidates?.length || 0}, rel=${relVerifyList.data.candidates?.length || 0}`));

    const annGrave = await fetchJson(`/api/knowledge/extracted-anniversaries?q=${encodeURIComponent('Cao Văn Mộ Chí')}`, { headers });
    const graveCandidate = (annGrave.data.candidates || [])[0];
    results.push(result('grave-not-hometown', annGrave.response.ok && graveCandidate?.graveText && !graveCandidate?.hometown, JSON.stringify({ hometown: graveCandidate?.hometown, grave: graveCandidate?.graveText })));
    const annHome = await fetchJson(`/api/knowledge/extracted-anniversaries?q=${encodeURIComponent('Cao Văn Quê Quán')}`, { headers });
    const homeCandidate = (annHome.data.candidates || [])[0];
    results.push(result('hometown-not-grave', annHome.response.ok && homeCandidate?.hometown && !homeCandidate?.graveText, JSON.stringify({ hometown: homeCandidate?.hometown, grave: homeCandidate?.graveText })));

    const open = await fetchJson(`/api/knowledge/chunks/${encodeURIComponent(goodChunkId)}?evidenceQuote=${encodeURIComponent(profileCandidate?.evidenceQuote || 'Cao Văn Chất Lượng')}`, { headers });
    results.push(result('open-source-returns-evidence', open.response.ok && open.data.chunk?.evidenceQuote && open.data.chunk?.evidenceWindow, JSON.stringify({ quote: open.data.chunk?.evidenceQuote, window: String(open.data.chunk?.evidenceWindow || '').slice(0, 80) })));

    const database = getDatabase();
    const applied = database.prepare('SELECT status FROM extracted_profile_candidates WHERE id = ?').get(appliedProfileId);
    database.close();
    results.push(result('applied-candidate-untouched', applied?.status === 'applied', applied?.status));
  } finally {
    admin.cleanup();
    cleanupFixture();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2 extraction quality failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2 extraction quality checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
