import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2n_member_evidence_fixture';
const chunkId = 'chunk_phase2w2n_member_evidence_fixture';
const anniversaryCandidateId = 'ann_phase2w2n_member_evidence_birth';
const profileCandidateId = 'profile_phase2w2n_member_evidence_bio';
const memberId = 'phase2w2n-member';

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
  const token = `phase2w2n_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2n-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2n-admin',
    account: 'phase2w2n-admin',
    name: 'Phase 2W2N Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2n-admin',
      fullName: 'Phase 2W2N Admin',
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
  database.prepare('DELETE FROM cao_toc_v3_pilot_apply_logs WHERE candidate_id = ?').run(anniversaryCandidateId);
  database.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(anniversaryCandidateId);
  database.prepare('DELETE FROM extracted_anniversary_candidates WHERE id = ?').run(anniversaryCandidateId);
  database.prepare('DELETE FROM extracted_profile_candidates WHERE id = ?').run(profileCandidateId);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const originalTree = getState(database, 'lineage-tree', null);
  const tree = originalTree ? JSON.parse(JSON.stringify(originalTree)) : {
    id: 'root-phase2w2n',
    name: 'Root Phase 2W2N',
    generation: 0,
    children: []
  };
  if (!findNode(tree, memberId)) {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push({
      id: memberId,
      name: 'Cao Van Member Evidence 2W2N',
      generation: 9,
      isDeceased: true,
      birthYear: '',
      solarBirthDate: '',
      deathYear: '',
      deathAnniversaryLunar: '',
      graveLocation: '',
      children: []
    });
  }
  const member = findNode(tree, memberId);
  member.birthYear = '';
  member.solarBirthDate = '';
  member.isDeceased = true;
  member.deathYear = '';
  member.deathAnniversaryLunar = '';
  member.graveLocation = '';
  member.bio = '';
  delete member.birthDateStructured;
  putState(database, 'lineage-tree', tree);

  const metadata = {
    dataset,
    datasetKey: dataset,
    datasetGroup: 'member_evidence',
    sourceTitle: 'Phase 2W2N member evidence fixture',
    headingPath: 'fixture/member-evidence',
    evidenceType: 'member_profile',
    evidenceQuote: 'Cao Van Member Evidence 2W2N sinh ngay 5/5/1995 va co hanh trang can duyet.',
    evidenceWindow: 'Nguon fixture: Cao Van Member Evidence 2W2N sinh ngay 5/5/1995 va co hanh trang can duyet.',
    candidateMatches: [{
      memberId,
      fullName: 'Cao Van Member Evidence 2W2N',
      confidence: 'exact'
    }]
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2N member evidence fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2n-member-evidence-fixture', JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2N member evidence fixture', 'Cao Van Member Evidence 2W2N sinh ngay 5/5/1995 va co hanh trang can duyet.', 'cao van member evidence 2w2n sinh ngay 5/5/1995 va co hanh trang can duyet', ?, 'fixture', '[]', '[]', 'kyc', 'fixture/member-evidence', datetime('now'))
  `).run(chunkId, sourceId, JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
       death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
       matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Van Member Evidence 2W2N', 'cao van member evidence 2w2n', '9', '', '5/5/1995', '',
      '', '', '', 'Cao Van Member Evidence 2W2N sinh ngay 5/5/1995.', 'fixture/member-evidence', ?,
      'Cao Van Member Evidence 2W2N', 'exact', 'approved', ?, datetime('now'))
  `).run(anniversaryCandidateId, sourceId, chunkId, memberId, JSON.stringify({
    ...metadata,
    matchedMemberId: memberId,
    matchedMemberName: 'Cao Van Member Evidence 2W2N',
    matchConfidence: 'exact',
    fields: [{ type: 'birth', label: 'Ngay sinh', value: '5/5/1995' }]
  }));
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
       match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
       chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'biography', 'Cao Van Member Evidence 2W2N', 'cao van member evidence 2w2n', ?,
      'Cao Van Member Evidence 2W2N', 'exact', 'bio',
      'Hanh trang Phase 2W2N dang cho admin duyet.', '',
      'Cao Van Member Evidence 2W2N co hanh trang dang cho admin duyet.', ?, ?, ?,
      'kyc', 'pending', ?, datetime('now'), datetime('now'))
  `).run(profileCandidateId, memberId, sourceId, chunkId, 'Phase 2W2N member evidence fixture', JSON.stringify({
    ...metadata,
    candidateType: 'biography',
    targetField: 'bio'
  }));
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
    const publicEvidence = await fetchJson(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence`);
    results.push(result('member-evidence-public-403', publicEvidence.response.status === 403, `HTTP ${publicEvidence.response.status}`));

    const apply = await fetchJson('/api/knowledge/v3-pilot-apply/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        datasetKey: dataset,
        confirmPilotApply: true,
        items: [{ kind: 'anniversary', id: anniversaryCandidateId }]
      })
    });
    const logId = apply.data.results?.[0]?.logId || '';
    results.push(result('member-evidence-fixture-applied', apply.response.ok && logId, JSON.stringify(apply.data.results?.[0] || apply.data)));

    const evidence = await fetchJson(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence?limit=30`, { headers });
    const applied = evidence.data.activeEvidence || [];
    const pending = evidence.data.pendingEvidence || [];
    const checklist = evidence.data.checklist || [];
    results.push(result('member-evidence-has-member', evidence.response.ok && evidence.data.member?.id === memberId, JSON.stringify(evidence.data.member || evidence.data)));
    results.push(result('member-evidence-summary-counts', evidence.data.summary?.activeApplied >= 1 && evidence.data.summary?.pending >= 1, JSON.stringify(evidence.data.summary || {})));
    results.push(result('member-evidence-applied-source', applied.some((item) => item.sourceId === sourceId && item.chunkId === chunkId && item.evidenceQuote), JSON.stringify(applied[0] || {})));
    results.push(result('member-evidence-pending-profile', pending.some((item) => item.candidateId === profileCandidateId && item.kind === 'profile'), JSON.stringify(pending)));
    results.push(result('member-evidence-checklist-birth-complete', checklist.some((item) => item.key === 'birth' && item.status === 'complete'), JSON.stringify(checklist)));
    results.push(result('member-evidence-checklist-has-missing', checklist.some((item) => item.status === 'missing'), JSON.stringify(checklist)));

    const rollback = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmRollback: true })
    });
    results.push(result('member-evidence-rollback-ok', rollback.response.ok && rollback.data.log?.rollbackStatus === 'rolled_back', JSON.stringify(rollback.data.log || rollback.data)));

    const afterRollback = await fetchJson(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence?limit=30`, { headers });
    results.push(result('member-evidence-rolled-back-visible', afterRollback.response.ok && afterRollback.data.summary?.rolledBack >= 1 && (afterRollback.data.rollbackEvidence || []).some((item) => item.logId === logId), JSON.stringify(afterRollback.data.summary || {})));
  } finally {
    admin.cleanup();
    restoreOriginalTree(originalTree);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2N member evidence failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2N member evidence checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
