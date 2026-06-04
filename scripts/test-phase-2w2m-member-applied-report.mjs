import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2m_member_report_fixture';
const chunkId = 'chunk_phase2w2m_member_report_fixture';
const candidateId = 'ann_phase2w2m_member_report_birth';
const memberId = 'phase2w2m-member';

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
  const token = `phase2w2m_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2m-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2m-admin',
    account: 'phase2w2m-admin',
    name: 'Phase 2W2M Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2m-admin',
      fullName: 'Phase 2W2M Admin',
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
    id: 'root-phase2w2m',
    name: 'Root Phase 2W2M',
    generation: 0,
    children: []
  };
  if (!findNode(tree, memberId)) {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push({
      id: memberId,
      name: 'Cao Van Member Report 2W2M',
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
    sourceTitle: 'Phase 2W2M member applied report fixture',
    headingPath: 'fixture/member-applied-report',
    evidenceType: 'dates_graves',
    evidenceQuote: 'Cao Van Member Report 2W2M sinh ngay 4/4/1996.',
    evidenceWindow: 'Nguon fixture: Cao Van Member Report 2W2M sinh ngay 4/4/1996.',
    candidateMatches: [{
      memberId,
      fullName: 'Cao Van Member Report 2W2M',
      confidence: 'exact'
    }]
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2M member applied report fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2m-member-applied-report-fixture', JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2M member applied report fixture', 'Cao Van Member Report 2W2M sinh ngay 4/4/1996.', 'cao van member report 2w2m sinh ngay 4/4/1996', ?, 'fixture', '[]', '[]', 'kyc', 'fixture/member-applied-report', datetime('now'))
  `).run(chunkId, sourceId, JSON.stringify(metadata));
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
       death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
       matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Van Member Report 2W2M', 'cao van member report 2w2m', '9', '', '4/4/1996', '',
      '', '', '', 'Cao Van Member Report 2W2M sinh ngay 4/4/1996.', 'fixture/member-applied-report', ?,
      'Cao Van Member Report 2W2M', 'exact', 'approved', ?, datetime('now'))
  `).run(candidateId, sourceId, chunkId, memberId, JSON.stringify({
    ...metadata,
    matchedMemberId: memberId,
    matchedMemberName: 'Cao Van Member Report 2W2M',
    matchConfidence: 'exact',
    fields: [{ type: 'birth', label: 'Ngay sinh', value: '4/4/1996' }]
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
    const publicReport = await fetchJson('/api/knowledge/v3-member-applied-report');
    results.push(result('member-applied-report-public-403', publicReport.response.status === 403, `HTTP ${publicReport.response.status}`));

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
    results.push(result('member-applied-fixture-applied', apply.response.ok && logId, JSON.stringify(apply.data.results?.[0] || apply.data)));

    const report = await fetchJson(`/api/knowledge/v3-member-applied-report?memberId=${encodeURIComponent(memberId)}&limit=20`, { headers });
    const member = (report.data.members || []).find((item) => item.memberId === memberId);
    const log = (member?.logs || []).find((item) => item.id === logId);
    const fields = log?.fields || [];
    results.push(result('member-applied-report-has-member', report.response.ok && member?.activeApplied === 1, JSON.stringify(member || report.data)));
    results.push(result('member-applied-report-has-fields', fields.some((field) => field.field === 'solarBirthDate') && fields.some((field) => field.newValue === '1996' || field.newValue === '4/4/1996'), JSON.stringify(fields)));
    results.push(result('member-applied-report-has-source', Boolean(log?.sourceId === sourceId && log?.chunkId === chunkId && log?.evidenceQuote), JSON.stringify(log || {})));
    results.push(result('member-applied-report-in-sync', log?.ok === true && ['in_sync', 'fields_match_tree_changed'].includes(log?.reconcileStatus), JSON.stringify(log || {})));

    const searchReport = await fetchJson('/api/knowledge/v3-member-applied-report?q=Member%20Report%202W2M&limit=20', { headers });
    results.push(result('member-applied-report-search-finds-member', searchReport.response.ok && (searchReport.data.members || []).some((item) => item.memberId === memberId), JSON.stringify(searchReport.data.summary || {})));

    const rollback = await fetchJson(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(logId)}/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmRollback: true })
    });
    results.push(result('member-applied-report-rollback-ok', rollback.response.ok && rollback.data.log?.rollbackStatus === 'rolled_back', JSON.stringify(rollback.data.log || rollback.data)));

    const afterRollback = await fetchJson(`/api/knowledge/v3-member-applied-report?memberId=${encodeURIComponent(memberId)}&limit=20`, { headers });
    const rolledMember = (afterRollback.data.members || []).find((item) => item.memberId === memberId);
    const rolledLog = (rolledMember?.logs || []).find((item) => item.id === logId);
    results.push(result('member-applied-report-rolled-back', afterRollback.response.ok && rolledMember?.rolledBack === 1 && rolledLog?.reconcileStatus === 'rolled_back_restored', JSON.stringify(rolledLog || rolledMember || afterRollback.data)));
  } finally {
    admin.cleanup();
    restoreOriginalTree(originalTree);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2M member applied report failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2M member applied report checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
