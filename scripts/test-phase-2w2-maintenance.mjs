import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const sourceId = 'source_phase2w2_technical_rule';
const chunkId = 'chunk_phase2w2_technical_rule';
const profilePendingId = 'profile_phase2w2_noisy_pending';
const profileAppliedId = 'profile_phase2w2_noisy_applied';
const relationshipPendingId = 'rel_phase2w2_noisy_pending';
const uniqueTerm = 'phase2w2_technical_secret_rule';

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
  const token = `phase2w2_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2-admin',
    account: 'phase2w2-admin',
    name: 'Phase 2W2 Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2-admin',
      fullName: 'Phase 2W2 Admin',
      role: 'admin',
      roles: ['admin'],
      isKYCed: true,
      kycStatus: 'verified',
      isApproved: true,
      approvalStatus: 'approved',
      loginType: 'local'
    },
    ...users.filter((user) => user.id !== userId)
  ]);
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

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const content = [
    `${uniqueTerm}: Cao Đình Lạng lowercase, bỏ kính xưng, Cao Phú Mỹ ghi là Thủy.`,
    'Cao Xuân Rục vẫn trực thuộc. Cao Văn Ninh mua Phó Lý.',
    'Cao Văn Ninh là cha của Cao Văn Nhiễu Test.'
  ].join('\n');
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, 'technical', 'test', '', '', '', ?, ?, ?, ?, '[]', '[]', 'public', 'indexed', datetime('now'))
  `).run(
    sourceId,
    'cao-toc-ai-luu-y-alias-danh-xung-v2/phase2w2_backend_implementation_notes.md',
    'backend implementation notes',
    content,
    'phase2w2_hash',
    JSON.stringify({ seed_slug: 'cao-toc-ai-luu-y-alias-danh-xung-v2', file_name: '07_backend_implementation_notes.md' }),
    content
  );
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, '{}', ?, '[]', '[]', 'public', ?, datetime('now'))
  `).run(
    chunkId,
    sourceId,
    'backend implementation notes',
    content,
    'phase2w2 technical secret rule cao van ninh la cha cua cao van nhieu test',
    content,
    'backend implementation notes'
  );
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'name_alias', 'Cao Đình Lạng lowercase', 'cao dinh lang lowercase', '', '', 'none', 'name', 'Cao Đình Lạng lowercase bỏ kính xưng', 'Cao Đình Lạng lowercase', ?, ?, 'backend implementation notes', 'public', 'pending', '{}', datetime('now'), datetime('now'))
  `).run(profilePendingId, sourceId, chunkId);
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'name_alias', 'Cao Văn Applied lowercase', 'cao van applied lowercase', '', '', 'none', 'name', 'Cao Văn Applied lowercase', 'Cao Văn Applied lowercase', ?, ?, 'backend implementation notes', 'public', 'applied', '{}', datetime('now'), datetime('now'))
  `).run(profileAppliedId, sourceId, chunkId);
  database.prepare(`
    INSERT INTO extracted_relationship_candidates
      (id, relationship_type, subject_name, subject_name_norm, object_name, object_name_norm, direction, extracted_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, flags_json, metadata_json, created_at, updated_at)
    VALUES (?, 'father', 'Cao Văn Ninh mua Phó Lý', 'cao van ninh mua pho ly', 'Cao Phú Mỹ ghi là Thủy', 'cao phu my ghi la thuy', 'object_to_subject', 'Cao Văn Ninh mua Phó Lý; Cao Phú Mỹ ghi là Thủy', 'mua Phó Lý', ?, ?, 'backend implementation notes', 'public', 'pending', '{}', '{}', datetime('now'), datetime('now'))
  `).run(relationshipPendingId, sourceId, chunkId);
  database.close();
}

function cleanupFixture(database = getDatabase()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_maintenance_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL DEFAULT '',
      summary_json TEXT NOT NULL DEFAULT '{}',
      admin_user TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  database.prepare('DELETE FROM extracted_relationship_candidates WHERE id = ?').run(relationshipPendingId);
  database.prepare('DELETE FROM extracted_profile_candidates WHERE id IN (?, ?)').run(profilePendingId, profileAppliedId);
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  database.prepare("DELETE FROM knowledge_maintenance_logs WHERE admin_user = 'phase2w2-admin'").run();
  if (arguments.length === 0) database.close();
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
    const publicLock = await fetchJson('/api/knowledge/maintenance/lock-technical-sources', { method: 'POST' });
    results.push(result('maintenance-public-403', publicLock.response.status === 403, `HTTP ${publicLock.response.status}`));

    const lock = await fetchJson('/api/knowledge/maintenance/lock-technical-sources', { method: 'POST', headers });
    results.push(result('lock-technical-source', lock.response.ok && lock.data.lockedSources >= 1, `locked=${lock.data.lockedSources}, chunks=${lock.data.updatedChunks}`));

    const database = getDatabase();
    const source = database.prepare('SELECT visibility, metadata_json FROM knowledge_sources WHERE id = ?').get(sourceId);
    const chunk = database.prepare('SELECT visibility, metadata_json FROM knowledge_chunks WHERE id = ?').get(chunkId);
    database.close();
    const sourceMeta = JSON.parse(source.metadata_json);
    const chunkMeta = JSON.parse(chunk.metadata_json);
    results.push(result('technical-source-private-admin', ['admin', 'private'].includes(source.visibility), source.visibility));
    results.push(result('technical-source-metadata-flags', sourceMeta.sourceKind === 'technical_rule' && sourceMeta.excludeFromExtraction === true && sourceMeta.excludeFromPublicChat === true, JSON.stringify(sourceMeta)));
    results.push(result('technical-chunk-locked', ['admin', 'private'].includes(chunk.visibility) && chunkMeta.excludeFromExtraction === true, JSON.stringify(chunkMeta)));

    const publicSearch = await fetchJson(`/api/knowledge/search?q=${encodeURIComponent(uniqueTerm)}&limit=8`);
    results.push(result('public-search-excludes-technical-source', publicSearch.response.ok && (publicSearch.data.chunks || []).length === 0, `${publicSearch.data.chunks?.length || 0} chunks`));

    const profileScan = await fetchJson('/api/knowledge/profile-candidates/scan-names', {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceId, limit: 20 })
    });
    results.push(result('profile-scanner-skips-technical-source', profileScan.response.ok && profileScan.data.created === 0, `created=${profileScan.data.created}, skipped=${profileScan.data.skipped}`));

    const relScan = await fetchJson('/api/knowledge/relationship-candidates/scan', {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceId, limit: 20 })
    });
    results.push(result('relationship-scanner-skips-technical-source', relScan.response.ok && relScan.data.created === 0, `created=${relScan.data.created}, skipped=${relScan.data.skipped}`));

    const reject = await fetchJson('/api/knowledge/maintenance/reject-noisy-candidates', { method: 'POST', headers });
    results.push(result('reject-noisy-candidates', reject.response.ok && reject.data.rejectedProfileCandidates >= 1 && reject.data.rejectedRelationshipCandidates >= 1, JSON.stringify(reject.data)));

    const checkDb = getDatabase();
    const pendingProfile = checkDb.prepare('SELECT status FROM extracted_profile_candidates WHERE id = ?').get(profilePendingId);
    const appliedProfile = checkDb.prepare('SELECT status FROM extracted_profile_candidates WHERE id = ?').get(profileAppliedId);
    const pendingRel = checkDb.prepare('SELECT status FROM extracted_relationship_candidates WHERE id = ?').get(relationshipPendingId);
    checkDb.close();
    results.push(result('pending-profile-rejected', pendingProfile?.status === 'rejected', pendingProfile?.status));
    results.push(result('applied-profile-untouched', appliedProfile?.status === 'applied', appliedProfile?.status));
    results.push(result('pending-relationship-rejected', pendingRel?.status === 'rejected', pendingRel?.status));

    const logs = await fetchJson('/api/knowledge/maintenance/logs?limit=10', { headers });
    results.push(result('maintenance-log-written', logs.response.ok && (logs.data.logs || []).some((log) => log.action === 'reject_noisy_candidates'), `${logs.data.logs?.length || 0} logs`));
  } finally {
    admin.cleanup();
    cleanupFixture();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2 maintenance failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2 maintenance checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
