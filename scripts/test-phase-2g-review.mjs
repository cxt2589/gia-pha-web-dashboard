import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';

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
  const database = new DatabaseSync(databaseFile);
  database.exec('PRAGMA busy_timeout = 5000');
  const token = `phase2g_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2g-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2g-admin',
    account: 'phase2g-admin',
    name: 'Phase 2G Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);

  const users = getState(database, 'auth-users', []);
  if (!users.some((user) => user.id === userId || user.username === 'phase2g-admin')) {
    users.unshift({
      id: userId,
      username: 'phase2g-admin',
      fullName: 'Phase 2G Admin',
      role: 'admin',
      roles: ['admin'],
      isKYCed: true,
      kycStatus: 'verified',
      isApproved: true,
      approvalStatus: 'approved',
      regDate: '31/05/2026',
      loginType: 'local'
    });
    putState(database, 'auth-users', users);
  }
  database.close();
  return {
    token,
    cookie: `${cookieName}=${token}`,
    cleanup() {
      const cleanupDb = new DatabaseSync(databaseFile);
      cleanupDb.exec('PRAGMA busy_timeout = 5000');
      const nextSessions = getState(cleanupDb, 'auth-sessions', {});
      delete nextSessions[token];
      putState(cleanupDb, 'auth-sessions', nextSessions);
      const nextUsers = getState(cleanupDb, 'auth-users', [])
        .filter((user) => user.id !== userId && user.username !== 'phase2g-admin');
      putState(cleanupDb, 'auth-users', nextUsers);
      cleanupDb.close();
    }
  };
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { response, data, text };
}

function addTempMemberToTree(tree, memberId) {
  const root = tree && typeof tree === 'object' ? tree : null;
  if (!root) return false;
  if (!Array.isArray(root.children)) root.children = [];
  root.children.push({
    id: memberId,
    name: 'Cao Đình Kiểm Thử Phase 2G',
    generation: Number(root.generation || 0) + 1,
    parentId: root.id,
    title: 'Temporary test member',
    branch: 'Chi test Phase 2G',
    motherName: 'Mẹ Test',
    isLiving: false,
    children: []
  });
  root.children.push({
    id: `${memberId}-dup-a`,
    name: 'Cao Văn Trùng',
    generation: Number(root.generation || 0) + 1,
    parentId: root.id,
    title: 'Temporary duplicate A',
    isLiving: false,
    children: []
  });
  root.children.push({
    id: `${memberId}-dup-b`,
    name: 'Cao Duy Trùng',
    generation: Number(root.generation || 0) + 1,
    parentId: root.id,
    title: 'Temporary duplicate B',
    isLiving: false,
    children: []
  });
  return true;
}

function insertTempCandidate(database, candidateId, memberId) {
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates (
      id, source_id, chunk_id, person_name, person_name_norm, generation, branch,
      birth_text, death_text, death_anniversary_lunar, hometown, grave_text,
      source_quote, heading_path, matched_member_id, matched_member_name,
      match_confidence, status, metadata_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    candidateId,
    'source_phase2g_test',
    'chunk_phase2g_test',
    'Cao Đình Kiểm Thử Phase 2G',
    'cao dinh kiem thu phase 2g',
    'test',
    '',
    '',
    '',
    'Ngay mung 9 thang Chin',
    'Que quan test',
    'Mo chi test',
    'Doan nguon test Phase 2G',
    'Phase 2G Test Source',
    memberId,
    'Cao Đình Kiểm Thử Phase 2G',
    'manual',
    'pending',
    JSON.stringify({ phase: '2g-test' })
  );
}

function ensurePhase2GSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS extracted_anniversary_audit_logs (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      member_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      field_changes_json TEXT NOT NULL DEFAULT '[]',
      source_id TEXT NOT NULL DEFAULT '',
      chunk_id TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function main() {
  const database = new DatabaseSync(databaseFile);
  database.exec('PRAGMA busy_timeout = 5000');
  ensurePhase2GSchema(database);
  const originalTree = getState(database, 'lineage-tree', null);
  if (!originalTree) throw new Error('Missing lineage-tree state for Phase 2G review test.');

  const memberId = `phase2g-member-${Date.now()}`;
  const candidateId = `phase2g-candidate-${Date.now()}`;
  const testTree = JSON.parse(JSON.stringify(originalTree));
  addTempMemberToTree(testTree, memberId);
  putState(database, 'lineage-tree', testTree);
  insertTempCandidate(database, candidateId, memberId);
  database.close();

  const tempAdmin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Cookie: tempAdmin.cookie };
  const results = [];

  try {
    const publicList = await fetchJson('/api/knowledge/extracted-anniversaries?limit=1');
    results.push({
      id: 'public-403',
      passed: publicList.response.status === 403,
      detail: `HTTP ${publicList.response.status}`
    });

    const adminList = await fetchJson('/api/knowledge/extracted-anniversaries?q=Cao%20Dinh%20Kiem%20Thu&limit=5', { headers: { Cookie: tempAdmin.cookie } });
    results.push({
      id: 'admin-can-list',
      passed: adminList.response.ok && Array.isArray(adminList.data.candidates) && adminList.data.candidates.some((item) => item.id === candidateId),
      detail: `HTTP ${adminList.response.status}`
    });

    const memberSearch = await fetchJson('/api/lineage/member-search?q=cao%20dinh%20kiem%20thu&limit=8', { headers: { Cookie: tempAdmin.cookie } });
    results.push({
      id: 'member-search-no-diacritics',
      passed: memberSearch.response.ok && memberSearch.data.matches?.some((item) => item.memberId === memberId && ['exact', 'strong'].includes(item.confidence)),
      detail: `HTTP ${memberSearch.response.status}`
    });

    const shortNameSearch = await fetchJson('/api/lineage/member-search?q=trung&limit=8', { headers: { Cookie: tempAdmin.cookie } });
    const shortMatches = Array.isArray(shortNameSearch.data.matches) ? shortNameSearch.data.matches.filter((item) => item.fullName.includes('Trùng')) : [];
    results.push({
      id: 'short-name-not-certain',
      passed: shortNameSearch.response.ok && shortMatches.length >= 2 && shortMatches.every((item) => item.confidence !== 'exact'),
      detail: `matches ${shortMatches.length}`
    });

    const reject = await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'rejected' })
    });
    const rejectedApply = await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId })
    });
    results.push({
      id: 'reject-does-not-apply',
      passed: reject.response.ok && rejectedApply.response.status === 400,
      detail: `reject ${reject.response.status}, apply ${rejectedApply.response.status}`
    });

    await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'pending' })
    });
    const bulkApprove = await fetchJson('/api/knowledge/extracted-anniversaries/bulk', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'approve', ids: [candidateId] })
    });
    results.push({
      id: 'bulk-approve',
      passed: bulkApprove.response.ok && bulkApprove.data.approved === 1,
      detail: `HTTP ${bulkApprove.response.status}`
    });

    const bulkReject = await fetchJson('/api/knowledge/extracted-anniversaries/bulk', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'reject', ids: [candidateId] })
    });
    results.push({
      id: 'bulk-reject',
      passed: bulkReject.response.ok && bulkReject.data.rejected === 1,
      detail: `HTTP ${bulkReject.response.status}`
    });

    await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    const apply = await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, fieldTypes: ['lunar_anniversary'] })
    });
    const checkDb = new DatabaseSync(databaseFile);
    const appliedTree = getState(checkDb, 'lineage-tree', null);
    const appliedText = JSON.stringify(appliedTree);
    checkDb.close();
    results.push({
      id: 'apply-writes-member',
      passed: apply.response.ok && appliedText.includes('Ngay mung 9 thang Chin'),
      detail: `HTTP ${apply.response.status}`
    });

    const appliedQuestion = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'ngay gio Cao Dinh Kiem Thu Phase 2G la ngay nao?',
        type: 'chat',
        botType: 'dashboard',
        intent: 'quality_check_phase_2h',
        engine: 'local'
      })
    });
    const appliedAnswer = String(appliedQuestion.data.text || '');
    results.push({
      id: 'ai-uses-applied',
      passed: appliedQuestion.response.ok && /Ngay mung 9 thang Chin/i.test(appliedAnswer) && /applied|áp dụng|ap dung|đã áp dụng/i.test(appliedAnswer),
      detail: appliedAnswer.slice(0, 180)
    });

    await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved', reviewedFields: { lunar_anniversary: 'Ngay khac' } })
    });
    const conflictApply = await fetchJson(`/api/knowledge/extracted-anniversaries/${candidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, fieldTypes: ['lunar_anniversary'] })
    });
    results.push({
      id: 'bulk-apply-no-overwrite',
      passed: conflictApply.response.status === 409,
      detail: `HTTP ${conflictApply.response.status}`
    });

    const realCandidates = await fetchJson('/api/knowledge/extracted-anniversaries?q=Cao%20Van%20Moi&limit=10', { headers: { Cookie: tempAdmin.cookie } });
    const chunkId = realCandidates.data.candidates?.find((item) => item.chunkId)?.chunkId;
    const chunkResult = chunkId ? await fetchJson(`/api/knowledge/chunks/${encodeURIComponent(chunkId)}`, { headers: { Cookie: tempAdmin.cookie } }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'source-popup-chunk',
      passed: Boolean(chunkId) && chunkResult.response.ok && String(chunkResult.data.chunk?.content || '').length > 20,
      detail: `chunk ${chunkId || 'missing'} HTTP ${chunkResult.response.status}`
    });

    const pendingQuestion = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'ngay gio Cao Van Moi la ngay nao?',
        type: 'chat',
        botType: 'dashboard',
        intent: 'quality_check_phase_2g',
        engine: 'local'
      })
    });
    const answer = String(pendingQuestion.data.text || '');
    results.push({
      id: 'pending-not-verified',
      passed: pendingQuestion.response.ok && /chua duoc duyet|chờ duyệt|cho duyet|candidate/i.test(answer),
      detail: answer.slice(0, 180)
    });

    const failed = results.filter((item) => !item.passed);
    const summary = { ok: failed.length === 0, baseUrl, total: results.length, passed: results.length - failed.length, failed: failed.length, results };
    console.log(JSON.stringify(summary, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally {
    const cleanupDb = new DatabaseSync(databaseFile);
    cleanupDb.exec('PRAGMA busy_timeout = 5000');
    putState(cleanupDb, 'lineage-tree', originalTree);
    cleanupDb.prepare('DELETE FROM extracted_anniversary_candidates WHERE id = ?').run(candidateId);
    cleanupDb.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(candidateId);
    cleanupDb.close();
    tempAdmin.cleanup();
  }
}

await main();
