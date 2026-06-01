import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';

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

function ensurePhase2VSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS extracted_profile_candidates (
      id TEXT PRIMARY KEY,
      candidate_type TEXT NOT NULL DEFAULT 'biography',
      person_name TEXT NOT NULL DEFAULT '',
      person_name_norm TEXT NOT NULL DEFAULT '',
      matched_member_id TEXT NOT NULL DEFAULT '',
      matched_member_name TEXT NOT NULL DEFAULT '',
      match_confidence TEXT NOT NULL DEFAULT 'none',
      target_field TEXT NOT NULL DEFAULT 'description',
      extracted_text TEXT NOT NULL DEFAULT '',
      reviewed_text TEXT NOT NULL DEFAULT '',
      source_quote TEXT NOT NULL DEFAULT '',
      source_id TEXT NOT NULL DEFAULT '',
      chunk_id TEXT NOT NULL DEFAULT '',
      knowledge_title TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'pending',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS extracted_profile_audit_logs (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL DEFAULT '',
      member_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      field_changes_json TEXT NOT NULL DEFAULT '[]',
      source_id TEXT NOT NULL DEFAULT '',
      chunk_id TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function installTempAdminSession() {
  const database = getDatabase();
  ensurePhase2VSchema(database);
  const token = `phase2v_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2v-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2v-admin',
    account: 'phase2v-admin',
    name: 'Phase 2V Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2v-admin',
      fullName: 'Phase 2V Admin',
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
    name: 'Cao Đình Hành Trạng Phase 2V',
    generation: Number(root.generation || 0) + 1,
    parentId: root.id,
    title: 'Temporary test member',
    branch: 'Chi test Phase 2V',
    isLiving: false,
    description: '',
    bio: '',
    achievements: ['Công trạng cũ Phase 2V'],
    children: []
  });
}

function installTempKnowledgeAndTree(memberId) {
  const database = getDatabase();
  ensurePhase2VSchema(database);
  const oldTree = getState(database, 'lineage-tree', null);
  const tree = oldTree ? structuredClone(oldTree) : {
    id: 'phase2v-root',
    name: 'Root Phase 2V',
    generation: 0,
    children: []
  };
  addTempMemberToTree(tree, memberId);
  putState(database, 'lineage-tree', tree);
  database.prepare('DELETE FROM extracted_profile_audit_logs WHERE candidate_id LIKE ?').run('profile_%phase2v%');
  database.prepare('DELETE FROM extracted_profile_candidates WHERE source_id = ?').run('source_phase2v_profile');
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run('source_phase2v_profile');
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run('source_phase2v_profile');
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, content, source_hash, visibility, status, created_at, updated_at)
    VALUES (?, ?, ?, 'test', ?, ?, 'kyc', 'indexed', datetime('now'), datetime('now'))
  `).run(
    'source_phase2v_profile',
    'phase2v-profile-source',
    'Phase 2V Profile Source',
    'Cao Đình Hành Trạng Phase 2V có hành trạng phụng sự dòng họ, công lao trùng tu từ đường và sự nghiệp gìn giữ gia phả.',
    crypto.createHash('sha256').update('phase2v-profile-source').digest('hex')
  );
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, summary, visibility, heading_path, content_ascii, char_count, token_estimate, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?, 'kyc', ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    'chunk_phase2v_profile',
    'source_phase2v_profile',
    'Hành trạng Cao Đình Hành Trạng Phase 2V',
    'Cao Đình Hành Trạng Phase 2V có hành trạng phụng sự dòng họ, công lao trùng tu từ đường, sự nghiệp gìn giữ gia phả và vinh danh các bậc tiền nhân.',
    'cao dinh hanh trang phase 2v co hanh trang phung su dong ho cong lao trung tu tu duong su nghiep gin giu gia pha',
    'Hành trạng, sự nghiệp và công lao Phase 2V',
    'Phase 2V > Hành trạng',
    'cao dinh hanh trang phase 2v',
    145,
    40
  );
  database.close();
  return {
    cleanup() {
      const cleanupDb = getDatabase();
      cleanupDb.prepare('DELETE FROM extracted_profile_audit_logs WHERE candidate_id IN (SELECT id FROM extracted_profile_candidates WHERE source_id = ?)').run('source_phase2v_profile');
      cleanupDb.prepare('DELETE FROM extracted_profile_candidates WHERE source_id = ?').run('source_phase2v_profile');
      cleanupDb.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run('source_phase2v_profile');
      cleanupDb.prepare('DELETE FROM knowledge_sources WHERE id = ?').run('source_phase2v_profile');
      if (oldTree) putState(cleanupDb, 'lineage-tree', oldTree);
      cleanupDb.close();
    }
  };
}

function result(id, passed, detail = '') {
  return { id, passed: Boolean(passed), detail };
}

async function main() {
  const memberId = `phase2v-member-${crypto.randomBytes(4).toString('hex')}`;
  const admin = installTempAdminSession();
  const fixture = installTempKnowledgeAndTree(memberId);
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const publicList = await fetchJson('/api/knowledge/profile-candidates');
    results.push(result('public-api-403', publicList.response.status === 403, `HTTP ${publicList.response.status}`));

    const scan = await fetchJson('/api/knowledge/profile-candidates/scan', {
      method: 'POST',
      headers,
      body: JSON.stringify({ sourceId: 'source_phase2v_profile', limit: 20 })
    });
    results.push(result('scanner-created-candidate', scan.response.ok && Number(scan.data.created || 0) >= 1, `created=${scan.data.created || 0}`));

    const list = await fetchJson('/api/knowledge/profile-candidates?q=Phase%202V&status=pending', { headers });
    const candidate = list.data.candidates?.find((item) => item.sourceId === 'source_phase2v_profile');
    results.push(result('admin-list-filter', list.response.ok && candidate, candidate?.id || 'missing'));
    results.push(result('candidate-not-auto-applied', candidate?.status === 'pending' && !candidate?.currentValues?.description, candidate?.status));

    const patch = await fetchJson(`/api/knowledge/profile-candidates/${candidate.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'approved',
        matchedMemberId: memberId,
        matchedMemberName: 'Cao Đình Hành Trạng Phase 2V',
        matchConfidence: 'manual',
        targetField: 'description',
        reviewedText: 'Hành trạng đã duyệt Phase 2V: phụng sự dòng họ và giữ gìn gia phả.'
      })
    });
    results.push(result('admin-edit-reviewed-text-target', patch.response.ok && patch.data.candidate?.status === 'approved' && patch.data.candidate?.targetField === 'description', patch.data.candidate?.status));

    const applyDescription = await fetchJson(`/api/knowledge/profile-candidates/${candidate.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, appendMode: 'replace' })
    });
    results.push(result('apply-description', applyDescription.response.ok && applyDescription.data.changes?.some((item) => item.lineageField === 'description'), `${applyDescription.data.changes?.length || 0} changes`));

    const treeAfterDescription = await fetchJson('/api/tree', { headers });
    const treeText = JSON.stringify(treeAfterDescription.data);
    results.push(result('description-visible-in-tree', treeText.includes('Hành trạng đã duyệt Phase 2V'), 'tree contains description'));

    const conflict = await fetchJson(`/api/knowledge/profile-candidates/${candidate.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, targetField: 'description', reviewedText: 'Nội dung thay thế bị chặn Phase 2V', appendMode: 'replace' })
    });
    results.push(result('replace-without-confirm-blocked', conflict.response.status === 409, `HTTP ${conflict.response.status}`));

    const append = await fetchJson(`/api/knowledge/profile-candidates/${candidate.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, targetField: 'description', reviewedText: 'Nội dung nối thêm Phase 2V.', appendMode: 'append' })
    });
    results.push(result('append-mode-keeps-old', append.response.ok, `HTTP ${append.response.status}`));

    const achievementCandidateId = `profile_phase2v_manual_${crypto.randomBytes(4).toString('hex')}`;
    const database = getDatabase();
    database.prepare(`
      INSERT INTO extracted_profile_candidates
        (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field,
         extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
      VALUES (?, 'achievement', 'Cao Đình Hành Trạng Phase 2V', 'cao dinh hanh trang phase 2v', ?, 'Cao Đình Hành Trạng Phase 2V', 'manual',
        'achievements', 'Công lao mới Phase 2V', 'Công lao mới Phase 2V', 'manual', 'source_phase2v_profile', 'chunk_phase2v_profile',
        'Phase 2V Profile Source', 'kyc', 'approved', '{}', datetime('now'), datetime('now'))
    `).run(achievementCandidateId, memberId);
    database.close();
    const applyAchievement = await fetchJson(`/api/knowledge/profile-candidates/${achievementCandidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId, appendMode: 'append' })
    });
    results.push(result('apply-achievements-appends', applyAchievement.response.ok && applyAchievement.data.changes?.some((item) => item.lineageField === 'achievements'), `${applyAchievement.data.changes?.length || 0} changes`));

    const logs = await fetchJson('/api/knowledge/profile-candidates/logs?limit=20', { headers });
    results.push(result('audit-log-written', logs.response.ok && logs.data.logs?.some((item) => item.candidateId === candidate.id || item.candidateId === achievementCandidateId), `${logs.data.logs?.length || 0} logs`));

    const aiApplied = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: `Hành trạng Cao Đình Hành Trạng Phase 2V là gì? ${memberId}`, type: 'chat', botType: 'dashboard_helper', intent: 'knowledge_question', engine: 'local' })
    });
    results.push(result('ai-uses-applied-profile-data', aiApplied.response.ok && String(aiApplied.data.text || '').includes('Hành trạng đã duyệt Phase 2V'), String(aiApplied.data.text || '').slice(0, 120)));

    const pendingCandidateId = `profile_phase2v_pending_${crypto.randomBytes(4).toString('hex')}`;
    const pendingName = `Cao Pending Phase 2V ${pendingCandidateId.slice(-8)}`;
    const pendingMemberId = `member_${pendingCandidateId}`;
    const pendingDb = getDatabase();
    const pendingTree = getState(pendingDb, 'lineage-tree', null);
    if (pendingTree) {
      if (!Array.isArray(pendingTree.children)) pendingTree.children = [];
      pendingTree.children.push({
        id: pendingMemberId,
        name: pendingName,
        generation: 1,
        parentId: pendingTree.id,
        title: 'Temporary pending profile member',
        isLiving: false,
        children: []
      });
      putState(pendingDb, 'lineage-tree', pendingTree);
    }
    pendingDb.prepare(`
      INSERT INTO extracted_profile_candidates
        (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field,
         extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
      VALUES (?, 'biography', ?, ?, ?, ?, 'manual',
        'description', ?, '', 'manual', 'source_phase2v_profile', 'chunk_phase2v_profile',
        'Phase 2V Profile Source', 'kyc', 'pending', '{}', datetime('now'), datetime('now'))
    `).run(pendingCandidateId, pendingName, pendingName.toLowerCase(), pendingMemberId, pendingName, `${pendingName}: Pending Phase 2V không được coi là xác minh`);
    pendingDb.close();
    const aiPending = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: `Hành trạng ${pendingName} là gì?`, type: 'chat', botType: 'dashboard_helper', intent: 'knowledge_question', engine: 'local' })
    });
    results.push(result(
      'ai-does-not-treat-pending-as-verified',
      aiPending.response.ok && /chờ|chua|chưa|pending/i.test(String(aiPending.data.text || '')) && !/đã áp dụng trong cây phả|đã được admin áp dụng/i.test(String(aiPending.data.text || '')),
      String(aiPending.data.text || '').slice(0, 120)
    ));
  } finally {
    admin.cleanup();
    fixture.cleanup();
  }

  const failed = results.filter((item) => !item.passed);
  for (const item of results) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id}${item.detail ? ` - ${item.detail}` : ''}`);
  }
  if (failed.length) {
    console.error(`Phase 2V profile extraction checks failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2V profile extraction checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
