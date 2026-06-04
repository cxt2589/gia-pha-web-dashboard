import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2j_pilot_fixture';
const chunkId = 'chunk_phase2w2j_pilot_fixture';
const candidateId = 'ann_phase2w2j_pilot_birth';
const memberId = 'phase2w2j-member';

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
  const token = `phase2w2j_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2j-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2j-admin',
    account: 'phase2w2j-admin',
    name: 'Phase 2W2J Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2j-admin',
      fullName: 'Phase 2W2J Admin',
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
    id: 'root-phase2w2j',
    name: 'Root Phase 2W2J',
    generation: 0,
    children: []
  };
  if (!findNode(tree, memberId)) {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push({
      id: memberId,
      name: 'Cao Văn Pilot 2W2J',
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
    sourceTitle: 'Phase 2W2J pilot apply fixture',
    headingPath: 'fixture/pilot',
    evidenceType: 'dates_graves',
    evidenceQuote: 'Cao Văn Pilot 2W2J sinh ngày 1/1/1999.',
    evidenceWindow: 'Nguồn fixture: Cao Văn Pilot 2W2J sinh ngày 1/1/1999.',
    candidateMatches: [{
      memberId,
      fullName: 'Cao Văn Pilot 2W2J',
      confidence: 'exact'
    }]
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2J pilot apply fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2j-pilot-apply-fixture', JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2J pilot apply fixture', 'Cao Văn Pilot 2W2J sinh ngày 1/1/1999.', 'cao van pilot 2w2j sinh ngay 1/1/1999', ?, 'fixture', '[]', '[]', 'kyc', 'fixture/pilot', datetime('now'))
  `).run(chunkId, sourceId, JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
       death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
       matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Văn Pilot 2W2J', 'cao van pilot 2w2j', '9', '', '1/1/1999', '',
      '', '', '', 'Cao Văn Pilot 2W2J sinh ngày 1/1/1999.', 'fixture/pilot', ?,
      'Cao Văn Pilot 2W2J', 'exact', 'approved', ?, datetime('now'))
  `).run(candidateId, sourceId, chunkId, memberId, JSON.stringify({
    ...metadata,
    matchedMemberId: memberId,
    matchedMemberName: 'Cao Văn Pilot 2W2J',
    matchConfidence: 'exact',
    fields: [{ type: 'birth', label: 'Ngày sinh', value: '1/1/1999' }]
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
    const publicLogs = await fetchJson('/api/knowledge/v3-pilot-apply/logs');
    results.push(result('pilot-logs-public-403', publicLogs.response.status === 403, `HTTP ${publicLogs.response.status}`));

    const preview = await fetchJson('/api/knowledge/v3-pilot-apply/preview', {
      method: 'POST',
      headers,
      body: JSON.stringify({ datasetKey: dataset, items: [{ kind: 'anniversary', id: candidateId }] })
    });
    results.push(result('pilot-preview-ready', preview.response.ok && preview.data.ok === true && preview.data.results?.[0]?.canPilotApply === true, JSON.stringify(preview.data.results?.[0]?.blockers || [])));

    const noConfirm = await fetchJson('/api/knowledge/v3-pilot-apply/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({ datasetKey: dataset, items: [{ kind: 'anniversary', id: candidateId }] })
    });
    results.push(result('pilot-apply-requires-confirm', noConfirm.response.status === 409, `HTTP ${noConfirm.response.status}`));

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
    results.push(result('pilot-apply-ok', apply.response.ok && apply.data.applied === 1 && logId, JSON.stringify(apply.data.results?.[0] || apply.data)));

    const appliedDb = getDatabase();
    const appliedTree = getState(appliedDb, 'lineage-tree', {});
    const appliedMember = findNode(appliedTree, memberId);
    const pilotLog = appliedDb.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs WHERE id = ?').get(logId);
    appliedDb.close();
    results.push(result('pilot-writes-tree', appliedMember?.solarBirthDate === '1/1/1999' || appliedMember?.birthYear === '1999', JSON.stringify({ solarBirthDate: appliedMember?.solarBirthDate, birthYear: appliedMember?.birthYear })));
    results.push(result('pilot-log-written', Boolean(pilotLog?.before_tree_json && pilotLog.after_tree_hash), logId));

    const rollbackNeedsConfirm = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('pilot-rollback-requires-confirm', rollbackNeedsConfirm.response.status === 409, `HTTP ${rollbackNeedsConfirm.response.status}`));

    const rollback = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmRollback: true })
    });
    results.push(result('pilot-rollback-ok', rollback.response.ok && rollback.data.log?.rollbackStatus === 'rolled_back', JSON.stringify(rollback.data.log || rollback.data)));

    const rolledDb = getDatabase();
    const rolledTree = getState(rolledDb, 'lineage-tree', {});
    const rolledMember = findNode(rolledTree, memberId);
    const restoredCandidate = rolledDb.prepare('SELECT status FROM extracted_anniversary_candidates WHERE id = ?').get(candidateId);
    rolledDb.close();
    results.push(result('pilot-rollback-restores-tree', !rolledMember?.solarBirthDate && !rolledMember?.birthYear, JSON.stringify({ solarBirthDate: rolledMember?.solarBirthDate, birthYear: rolledMember?.birthYear })));
    results.push(result('pilot-rollback-restores-candidate', restoredCandidate?.status === 'approved', restoredCandidate?.status || 'missing'));
  } finally {
    admin.cleanup();
    restoreOriginalTree(originalTree);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2J pilot apply failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2J pilot apply checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
