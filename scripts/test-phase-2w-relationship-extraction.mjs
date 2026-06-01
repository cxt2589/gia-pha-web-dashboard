import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const sourceId = 'source_phase2w_relationship';
const chunkId = 'chunk_phase2w_relationship';
const fatherId = 'phase2w-father';
const childId = 'phase2w-child';

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
  const token = `phase2w_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w-admin',
    account: 'phase2w-admin',
    name: 'Phase 2W Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w-admin',
      fullName: 'Phase 2W Admin',
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
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function installFixture() {
  const database = getDatabase();
  const originalTree = getState(database, 'lineage-tree', null);
  const tree = structuredClone(originalTree);
  if (!Array.isArray(tree.children)) tree.children = [];
  tree.children = tree.children.filter((child) => ![fatherId, childId].includes(child.id));
  tree.children.push({
    id: fatherId,
    name: 'Cao Văn Kiểm Thử',
    gender: 'nam',
    generation: 3,
    parentId: tree.id,
    fatherName: tree.name,
    motherName: '',
    spouse: '',
    spouseDetails: [],
    children: []
  });
  tree.children.push({
    id: childId,
    name: 'Cao Văn Hậu Duệ',
    gender: 'nam',
    generation: 4,
    parentId: '',
    fatherName: '',
    motherName: '',
    spouse: '',
    spouseDetails: [],
    children: []
  });
  putState(database, 'lineage-tree', tree);
  database.prepare('DELETE FROM extracted_relationship_audit_logs WHERE candidate_id IN (SELECT id FROM extracted_relationship_candidates WHERE source_id = ?)').run(sourceId);
  database.prepare('DELETE FROM extracted_relationship_candidates WHERE source_id = ?').run(sourceId);
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, 'test', 'test', '', '', '', ?, ?, '{}', ?, '[]', '[]', 'private', 'indexed', datetime('now'))
  `).run(
    sourceId,
    'phase2w-relationship-fixture',
    'Phase 2W Relationship Fixture',
    'Cao Văn Kiểm Thử là cha của Cao Văn Hậu Duệ. Cao Văn Kiểm Thử là cha của Cao Văn Chưa Có.',
    'phase2w_hash',
    'Quan hệ phả hệ test'
  );
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, '{}', ?, '[]', '[]', 'private', ?, datetime('now'))
  `).run(
    chunkId,
    sourceId,
    'Phase 2W quan hệ',
    'Cao Văn Kiểm Thử là cha của Cao Văn Hậu Duệ. Cao Văn Kiểm Thử là cha của Cao Văn Chưa Có.',
    'cao van kiem thu la cha cua cao van hau due cao van kiem thu la cha cua cao van chua co',
    'Quan hệ cha con',
    'Phase 2W quan hệ'
  );
  database.close();
  return {
    cleanup() {
      const cleanupDb = getDatabase();
      putState(cleanupDb, 'lineage-tree', originalTree);
      cleanupDb.prepare('DELETE FROM extracted_relationship_audit_logs WHERE candidate_id IN (SELECT id FROM extracted_relationship_candidates WHERE source_id = ?)').run(sourceId);
      cleanupDb.prepare('DELETE FROM extracted_relationship_candidates WHERE source_id = ?').run(sourceId);
      cleanupDb.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
      cleanupDb.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
      cleanupDb.close();
    }
  };
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
  const fixture = installFixture();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const publicList = await fetchJson('/api/knowledge/relationship-candidates');
    results.push(result('public-api-403', publicList.response.status === 403, `HTTP ${publicList.response.status}`));

    const scan = await fetchJson('/api/knowledge/relationship-candidates/scan', {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceId, limit: 20 })
    });
    results.push(result('scanner-created-candidates', scan.response.ok && scan.data.created >= 2, `created=${scan.data.created}`));

    const list = await fetchJson('/api/knowledge/relationship-candidates?q=Cao%20Văn%20Hậu%20Duệ&status=pending', { headers });
    const candidate = (list.data.candidates || []).find((item) => item.subjectName.includes('Hậu Duệ'));
    results.push(result('admin-list-filter', list.response.ok && candidate, candidate?.id || 'missing'));
    results.push(result('candidate-not-auto-applied', candidate?.status === 'pending', candidate?.status));

    const approve = await fetchJson(`/api/knowledge/relationship-candidates/${candidate.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    results.push(result('approve-candidate', approve.response.ok && approve.data.candidate?.status === 'approved', approve.data.candidate?.status));

    const apply = await fetchJson(`/api/knowledge/relationship-candidates/${candidate.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('apply-father-relation', apply.response.ok && (apply.data.changes || []).length === 1, `${apply.response.status}`));

    const database = getDatabase();
    const tree = getState(database, 'lineage-tree', null);
    const child = findNode(tree, childId);
    database.close();
    results.push(result('tree-updated-parent', child?.parentId === fatherId && child?.fatherName === 'Cao Văn Kiểm Thử', `${child?.parentId}/${child?.fatherName}`));

    const missingList = await fetchJson('/api/knowledge/relationship-candidates?q=Cao%20Văn%20Chưa%20Có&status=pending', { headers });
    const missingCandidate = (missingList.data.candidates || [])[0];
    results.push(result('requires-new-member-flag', missingCandidate?.flags?.requires_new_subject === true, JSON.stringify(missingCandidate?.flags || {})));
    await fetchJson(`/api/knowledge/relationship-candidates/${missingCandidate.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    const blockedApply = await fetchJson(`/api/knowledge/relationship-candidates/${missingCandidate.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('apply-blocked-requires-new-member', blockedApply.response.status === 409, `HTTP ${blockedApply.response.status}`));

    const logs = await fetchJson('/api/knowledge/relationship-candidates/logs?limit=20', { headers });
    results.push(result('audit-log-written', logs.response.ok && (logs.data.logs || []).some((log) => log.candidateId === candidate.id), `${logs.data.logs?.length || 0} logs`));
  } finally {
    admin.cleanup();
    fixture.cleanup();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W relationship extraction failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W relationship extraction checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
