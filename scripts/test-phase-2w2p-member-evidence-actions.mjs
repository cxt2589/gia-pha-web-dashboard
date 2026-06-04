import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2p_member_actions_fixture';
const chunkId = 'chunk_phase2w2p_member_actions_fixture';
const memberId = 'phase2w2p-member';
const profileCandidateId = 'profile_phase2w2p_member_actions_bio';
const rejectCandidateId = 'profile_phase2w2p_member_actions_reject';

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
  const token = `phase2w2p_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2p-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2p-admin',
    account: 'phase2w2p-admin',
    name: 'Phase 2W2P Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2p-admin',
      fullName: 'Phase 2W2P Admin',
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

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (String(node.id || '') === String(id || '')) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function cleanupFixture(database = getDatabase()) {
  database.prepare('DELETE FROM cao_toc_v3_pilot_apply_logs WHERE candidate_id IN (?, ?)').run(profileCandidateId, rejectCandidateId);
  database.prepare('DELETE FROM extracted_profile_audit_logs WHERE candidate_id IN (?, ?)').run(profileCandidateId, rejectCandidateId);
  database.prepare('DELETE FROM extracted_profile_candidates WHERE id IN (?, ?)').run(profileCandidateId, rejectCandidateId);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  if (arguments.length === 0) database.close();
}

function insertProfileCandidate(database, { id, text, status = 'pending' }) {
  const metadata = {
    dataset,
    datasetKey: dataset,
    datasetGroup: 'member_evidence',
    sourceTitle: 'Phase 2W2P member actions fixture',
    headingPath: 'fixture/member-actions',
    evidenceType: 'member_profile',
    evidenceQuote: `Cao Van Member Actions 2W2P ${text}`,
    evidenceWindow: `Nguon fixture: Cao Van Member Actions 2W2P ${text}`,
    candidateMatches: [{ memberId, fullName: 'Cao Van Member Actions 2W2P', confidence: 'exact' }],
    matchedMemberId: memberId,
    matchedMemberName: 'Cao Van Member Actions 2W2P',
    matchConfidence: 'exact'
  };
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
       match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
       chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'biography', 'Cao Van Member Actions 2W2P', 'cao van member actions 2w2p', ?,
      'Cao Van Member Actions 2W2P', 'exact', 'bio',
      ?, '', ?, ?, ?, 'Phase 2W2P member actions fixture',
      'kyc', ?, ?, datetime('now'), datetime('now'))
  `).run(id, memberId, text, `Cao Van Member Actions 2W2P ${text}`, sourceId, chunkId, status, JSON.stringify(metadata));
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const originalTree = getState(database, 'lineage-tree', null);
  const tree = originalTree ? JSON.parse(JSON.stringify(originalTree)) : {
    id: 'root-phase2w2p',
    name: 'Root Phase 2W2P',
    generation: 0,
    children: []
  };
  if (!findNode(tree, memberId)) {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push({
      id: memberId,
      name: 'Cao Van Member Actions 2W2P',
      generation: 9,
      isDeceased: true,
      bio: '',
      children: []
    });
  }
  const member = findNode(tree, memberId);
  member.bio = '';
  putState(database, 'lineage-tree', tree);

  const metadata = {
    dataset,
    datasetKey: dataset,
    datasetGroup: 'member_evidence',
    sourceTitle: 'Phase 2W2P member actions fixture',
    headingPath: 'fixture/member-actions'
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2P member actions fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2p-member-actions-fixture', JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2P member actions fixture', 'Cao Van Member Actions 2W2P co hanh trang can duyet va ap dung.', 'cao van member actions 2w2p co hanh trang can duyet va ap dung', ?, 'fixture', '[]', '[]', 'kyc', 'fixture/member-actions', datetime('now'))
  `).run(chunkId, sourceId, JSON.stringify(metadata));
  insertProfileCandidate(database, { id: profileCandidateId, text: 'co hanh trang Phase 2W2P can ap dung.' });
  insertProfileCandidate(database, { id: rejectCandidateId, text: 'la candidate se bi tu choi.' });
  database.close();
  return originalTree;
}

function restoreOriginalTree(originalTree) {
  const database = getDatabase();
  if (originalTree) putState(database, 'lineage-tree', originalTree);
  cleanupFixture(database);
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
  const originalTree = installFixture();
  const results = [];
  try {
    const publicPatch = await fetchJson(`/api/knowledge/profile-candidates/${profileCandidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    results.push(result('member-actions-public-review-403', publicPatch.response.status === 403, `HTTP ${publicPatch.response.status}`));

    const reject = await fetchJson(`/api/knowledge/profile-candidates/${rejectCandidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'rejected' })
    });
    results.push(result('member-actions-reject-ok', reject.response.ok && reject.data.candidate?.status === 'rejected', JSON.stringify(reject.data.candidate || reject.data)));

    const approve = await fetchJson(`/api/knowledge/profile-candidates/${profileCandidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    results.push(result('member-actions-approve-ok', approve.response.ok && approve.data.candidate?.status === 'approved', JSON.stringify(approve.data.candidate || approve.data)));

    const beforeApply = await fetchJson(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence?limit=30`, { headers });
    results.push(result('member-actions-approved-visible', beforeApply.response.ok && (beforeApply.data.pendingEvidence || []).some((item) => item.candidateId === profileCandidateId && item.status === 'approved'), JSON.stringify(beforeApply.data.summary || {})));

    const apply = await fetchJson('/api/knowledge/v3-pilot-apply/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        datasetKey: dataset,
        confirmPilotApply: true,
        items: [{
          kind: 'profile',
          id: profileCandidateId,
          memberId,
          targetField: 'bio',
          confirmIdentity: true,
          confirmSourceCheck: true,
          confirmFieldMapping: true
        }]
      })
    });
    const logId = apply.data.results?.[0]?.logId || '';
    results.push(result('member-actions-apply-ok', apply.response.ok && logId, JSON.stringify(apply.data.results?.[0] || apply.data)));

    const afterApply = await fetchJson(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence?limit=30`, { headers });
    const active = afterApply.data.activeEvidence || [];
    const checklist = afterApply.data.checklist || [];
    results.push(result('member-actions-active-evidence-visible', active.some((item) => item.candidateId === profileCandidateId && item.logId === logId), JSON.stringify(active[0] || {})));
    results.push(result('member-actions-checklist-bio-complete', checklist.some((item) => item.key === 'bio' && item.status === 'complete'), JSON.stringify(checklist)));

    const rollback = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmRollback: true })
    });
    results.push(result('member-actions-rollback-ok', rollback.response.ok && rollback.data.log?.rollbackStatus === 'rolled_back', JSON.stringify(rollback.data.log || rollback.data)));
  } finally {
    admin.cleanup();
    restoreOriginalTree(originalTree);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2P member evidence actions failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2P member evidence actions checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
