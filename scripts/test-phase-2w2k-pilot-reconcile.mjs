import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2k_reconcile_fixture';
const chunkId = 'chunk_phase2w2k_reconcile_fixture';
const candidateId = 'ann_phase2w2k_reconcile_birth';
const memberId = 'phase2w2k-member';

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
  const token = `phase2w2k_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2k-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2k-admin',
    account: 'phase2w2k-admin',
    name: 'Phase 2W2K Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2k-admin',
      fullName: 'Phase 2W2K Admin',
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
  database.prepare('DELETE FROM cao_toc_v3_pilot_apply_logs WHERE candidate_id = ?').run(candidateId);
  database.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(candidateId);
  database.prepare('DELETE FROM extracted_anniversary_candidates WHERE id = ?').run(candidateId);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const originalTree = getState(database, 'lineage-tree', null);
  const tree = originalTree ? JSON.parse(JSON.stringify(originalTree)) : {
    id: 'root-phase2w2k',
    name: 'Root Phase 2W2K',
    generation: 0,
    children: []
  };
  if (!findNode(tree, memberId)) {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push({
      id: memberId,
      name: 'Cao Van Pilot 2W2K',
      generation: 9,
      birthYear: '',
      solarBirthDate: '',
      children: []
    });
  }
  const member = findNode(tree, memberId);
  member.birthYear = '';
  member.solarBirthDate = '';
  delete member.birthDateStructured;
  putState(database, 'lineage-tree', tree);

  const metadata = {
    dataset,
    datasetKey: dataset,
    datasetGroup: 'dates_graves',
    sourceTitle: 'Phase 2W2K pilot reconcile fixture',
    headingPath: 'fixture/pilot-reconcile',
    evidenceType: 'dates_graves',
    evidenceQuote: 'Cao Van Pilot 2W2K sinh ngay 2/2/1998.',
    evidenceWindow: 'Nguon fixture: Cao Van Pilot 2W2K sinh ngay 2/2/1998.',
    candidateMatches: [{
      memberId,
      fullName: 'Cao Van Pilot 2W2K',
      confidence: 'exact'
    }]
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2K pilot reconcile fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2k-pilot-reconcile-fixture', JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2K pilot reconcile fixture', 'Cao Van Pilot 2W2K sinh ngay 2/2/1998.', 'cao van pilot 2w2k sinh ngay 2/2/1998', ?, 'fixture', '[]', '[]', 'kyc', 'fixture/pilot-reconcile', datetime('now'))
  `).run(chunkId, sourceId, JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
       death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
       matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Van Pilot 2W2K', 'cao van pilot 2w2k', '9', '', '2/2/1998', '',
      '', '', '', 'Cao Van Pilot 2W2K sinh ngay 2/2/1998.', 'fixture/pilot-reconcile', ?,
      'Cao Van Pilot 2W2K', 'exact', 'approved', ?, datetime('now'))
  `).run(candidateId, sourceId, chunkId, memberId, JSON.stringify({
    ...metadata,
    matchedMemberId: memberId,
    matchedMemberName: 'Cao Van Pilot 2W2K',
    matchConfidence: 'exact',
    fields: [{ type: 'birth', label: 'Ngay sinh', value: '2/2/1998' }]
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
    const publicProposals = await fetchJson('/api/knowledge/v3-pilot-apply/proposals');
    results.push(result('pilot-proposals-public-403', publicProposals.response.status === 403, `HTTP ${publicProposals.response.status}`));

    const proposals = await fetchJson(`/api/knowledge/v3-pilot-apply/proposals?datasetKey=${dataset}&limit=20`, { headers });
    const proposal = (proposals.data.items || []).find((item) => item.id === candidateId);
    results.push(result('pilot-proposal-includes-approved-fixture', proposals.response.ok && proposal?.item?.canApply === true, JSON.stringify(proposal || proposals.data)));

    const apply = await fetchJson('/api/knowledge/v3-pilot-apply/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        datasetKey: dataset,
        confirmPilotApply: true,
        items: [{ kind: 'anniversary', id: candidateId }]
      })
    });
    const logId = apply.data.results?.[0]?.logId || '';
    results.push(result('pilot-apply-for-reconcile-ok', apply.response.ok && logId, JSON.stringify(apply.data.results?.[0] || apply.data)));

    const reconcile = await fetchJson('/api/knowledge/v3-pilot-apply/reconcile?limit=50', { headers });
    const reconcileLog = (reconcile.data.items || []).find((item) => item.id === logId);
    results.push(result('pilot-reconcile-in-sync', reconcile.response.ok && reconcileLog?.ok === true && ['in_sync', 'fields_match_tree_changed'].includes(reconcileLog?.reconcileStatus), JSON.stringify(reconcileLog || reconcile.data)));

    const rollback = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmRollback: true })
    });
    results.push(result('pilot-rollback-before-reconcile-ok', rollback.response.ok && rollback.data.log?.rollbackStatus === 'rolled_back', JSON.stringify(rollback.data.log || rollback.data)));

    const reconciledRollback = await fetchJson('/api/knowledge/v3-pilot-apply/reconcile?limit=50', { headers });
    const rolledLog = (reconciledRollback.data.items || []).find((item) => item.id === logId);
    results.push(result('pilot-reconcile-rolled-back-restored', reconciledRollback.response.ok && rolledLog?.ok === true && rolledLog?.reconcileStatus === 'rolled_back_restored', JSON.stringify(rolledLog || reconciledRollback.data)));
  } finally {
    admin.cleanup();
    restoreOriginalTree(originalTree);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2K pilot reconcile failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2K pilot reconcile checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
