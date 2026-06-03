import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2i_queue_fixture';
const chunkId = 'chunk_phase2w2i_queue_fixture';
const noteCandidateId = 'profile_phase2w2i_verification_note';

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
  const token = `phase2w2i_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2i-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2i-admin',
    account: 'phase2w2i-admin',
    name: 'Phase 2W2I Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2i-admin',
      fullName: 'Phase 2W2I Admin',
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

function cleanupFixture(database = getDatabase()) {
  database.prepare('DELETE FROM extracted_profile_audit_logs WHERE candidate_id = ?').run(noteCandidateId);
  database.prepare('DELETE FROM extracted_profile_candidates WHERE id = ?').run(noteCandidateId);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const sourceMeta = JSON.stringify({ dataset, datasetKey: dataset, datasetGroup: 'verification_notes', sourceKind: 'genealogy_fixture' });
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2I review queue fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'private', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2i-review-queue-fixture', sourceMeta);
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2I review queue fixture', 'Can kiem chung moc pha he truoc khi ghi vao ho so ca nhan.', 'can kiem chung moc pha he truoc khi ghi vao ho so ca nhan', ?, 'fixture', '[]', '[]', 'private', 'fixture/verification', datetime('now'))
  `).run(chunkId, sourceId, sourceMeta);
  const metadata = JSON.stringify({
    dataset,
    datasetKey: dataset,
    datasetGroup: 'verification_notes',
    sourceTitle: 'Phase 2W2I review queue fixture',
    headingPath: 'fixture/verification',
    evidenceType: 'verification_note',
    evidenceQuote: 'Can kiem chung moc pha he truoc khi ghi vao ho so ca nhan.',
    evidenceWindow: 'Doan nguon fixture yeu cau giu lai lam ghi chu kiem chung.',
    notApplyDirectly: true,
    needsAdminReview: true,
    candidateMatches: []
  });
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'verification_note', 'Ghi chu kiem chung phase 2W2I', 'ghi chu kiem chung phase 2w2i', '', '', 'none', 'description', ?, '', ?, ?, ?, 'Phase 2W2I review queue fixture', 'private', 'pending', ?, datetime('now'), datetime('now'))
  `).run(
    noteCandidateId,
    'Can kiem chung moc pha he truoc khi ghi vao ho so ca nhan.',
    'Can kiem chung moc pha he truoc khi ghi vao ho so ca nhan.',
    sourceId,
    chunkId,
    metadata
  );
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
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    installFixture();

    const publicQueue = await fetchJson('/api/knowledge/v3-review-queue?limit=5');
    results.push(result('review-queue-public-403', publicQueue.response.status === 403, `HTTP ${publicQueue.response.status}`));

    const queue = await fetchJson(`/api/knowledge/v3-review-queue?datasetKey=${dataset}&bucket=do_not_apply_directly&status=pending&kind=profile`, { headers });
    const item = (queue.data.items || []).find((candidate) => candidate.id === noteCandidateId);
    results.push(result(
      'review-queue-contains-note',
      queue.response.ok && item?.action?.code === 'keep_verification_note' && item.reviewGroup === 'note',
      JSON.stringify(item?.action || queue.data)
    ));

    const keepWithoutConfirm = await fetchJson(`/api/knowledge/profile-candidates/${noteCandidateId}/keep-verification-note`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('keep-note-requires-confirm', keepWithoutConfirm.response.status === 409, `HTTP ${keepWithoutConfirm.response.status}`));

    const keep = await fetchJson(`/api/knowledge/profile-candidates/${noteCandidateId}/keep-verification-note`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmKeepNote: true, reviewNote: 'Phase 2W2I test note' })
    });
    results.push(result('keep-note-ok', keep.response.ok && keep.data.candidate?.status === 'approved' && keep.data.candidate?.metadata?.keptAsVerificationNote === true, JSON.stringify(keep.data.candidate?.metadata || keep.data)));

    const auditRows = getDatabase().prepare('SELECT * FROM extracted_profile_audit_logs WHERE candidate_id = ? AND action = ?').all(noteCandidateId, 'kept_verification_note');
    results.push(result('keep-note-audit-written', auditRows.length >= 1, `${auditRows.length} audit rows`));

    const applyStillBlocked = await fetchJson(`/api/knowledge/profile-candidates/${noteCandidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmKeepNote: true })
    });
    results.push(result('kept-note-still-not-apply-directly', applyStillBlocked.response.status === 409, `HTTP ${applyStillBlocked.response.status}`));
  } finally {
    admin.cleanup();
    cleanupFixture();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2I review queue failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2I review queue checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
