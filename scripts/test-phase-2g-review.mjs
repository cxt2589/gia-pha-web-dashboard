import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { convertLunarToSolar, parseGenealogyDateText } from '../src/utils/genealogyDate.mjs';

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

function ensureColumn(database, tableName, columnName, alterSql) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) database.exec(alterSql);
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
    '01/02/1901',
    '03/04/1970',
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

function insertTempLunarOnlyCandidate(database, candidateId, memberId) {
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
    'source_phase2j_test',
    'chunk_phase2j_test',
    'Cao Dinh Lunar Only Phase 2J',
    'cao dinh lunar only phase 2j',
    'test',
    '',
    '',
    '',
    '15/5 am lich',
    '',
    '',
    'Doan nguon test Phase 2J',
    'Phase 2J Test Source',
    memberId,
    'Cao Dinh Lunar Only Phase 2J',
    'manual',
    'pending',
    JSON.stringify({ phase: '2j-test' })
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
    CREATE TABLE IF NOT EXISTS anniversary_event_drafts (
      id TEXT PRIMARY KEY,
      anniversary_key TEXT NOT NULL DEFAULT '',
      member_id TEXT NOT NULL DEFAULT '',
      member_name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      lunar_date_text TEXT NOT NULL DEFAULT '',
      solar_date TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      generation TEXT NOT NULL DEFAULT '',
      message_draft TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'dashboard',
      status TEXT NOT NULL DEFAULT 'draft',
      source TEXT NOT NULL DEFAULT 'anniversary',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reminder_send_logs (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'dashboard',
      recipient_type TEXT NOT NULL DEFAULT 'admin_test',
      recipient_id TEXT NOT NULL DEFAULT '',
      recipient_name TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      transport TEXT NOT NULL DEFAULT 'mock',
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT NOT NULL DEFAULT '',
      blocked_reason TEXT NOT NULL DEFAULT '',
      request_id TEXT NOT NULL DEFAULT '',
      response_id TEXT NOT NULL DEFAULT '',
      sent_by TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  ensureColumn(database, 'reminder_send_logs', 'blocked_reason', "ALTER TABLE reminder_send_logs ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'reminder_send_logs', 'request_id', "ALTER TABLE reminder_send_logs ADD COLUMN request_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'reminder_send_logs', 'response_id', "ALTER TABLE reminder_send_logs ADD COLUMN response_id TEXT NOT NULL DEFAULT ''");
}

async function main() {
  const database = new DatabaseSync(databaseFile);
  database.exec('PRAGMA busy_timeout = 5000');
  ensurePhase2GSchema(database);
  const originalTree = getState(database, 'lineage-tree', null);
  if (!originalTree) throw new Error('Missing lineage-tree state for Phase 2G review test.');

  const memberId = `phase2g-member-${Date.now()}`;
  const candidateId = `phase2g-candidate-${Date.now()}`;
  const phase2jMemberId = `phase2j-member-${Date.now()}`;
  const phase2jCandidateId = `phase2j-candidate-${Date.now()}`;
  const legacyAnniversaryMemberId = `phase2k-legacy-member-${Date.now()}`;
  const createdDraftIds = [];
  const createdReminderLogIds = [];
  const testTree = JSON.parse(JSON.stringify(originalTree));
  addTempMemberToTree(testTree, memberId);
  testTree.children.push({
    id: phase2jMemberId,
    name: 'Cao Dinh Lunar Only Phase 2J',
    generation: Number(testTree.generation || 0) + 1,
    parentId: testTree.id,
    title: 'Temporary lunar-only test member',
    branch: 'Chi test Phase 2J',
    isLiving: false,
    children: []
  });
  testTree.children.push({
    id: legacyAnniversaryMemberId,
    name: 'Cao Dinh Legacy Phase 2K',
    generation: Number(testTree.generation || 0) + 1,
    parentId: testTree.id,
    title: 'Temporary legacy anniversary test member',
    branch: 'Chi test Phase 2K',
    isLiving: false,
    deathAnniversaryLunar: '12/6 am lich',
    children: []
  });
  putState(database, 'lineage-tree', testTree);
  insertTempCandidate(database, candidateId, memberId);
  insertTempLunarOnlyCandidate(database, phase2jCandidateId, phase2jMemberId);
  database.close();

  const tempAdmin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Cookie: tempAdmin.cookie };
  const results = [];

  try {
    const parserCases = [
      ['parser-lunar-day-month', parseGenealogyDateText('15/5 am lich'), { calendar: 'lunar', precision: 'day_month', day: 15, month: 5, year: null }],
      ['parser-solar-full-date', parseGenealogyDateText('12/03/1985', 'solar'), { calendar: 'solar', precision: 'full_date', day: 12, month: 3, year: 1985 }],
      ['parser-year-only', parseGenealogyDateText('1985'), { precision: 'year', year: 1985 }],
      ['parser-unknown', parseGenealogyDateText('khuyet'), { precision: 'unknown', year: null }]
    ];
    for (const [id, actual, expected] of parserCases) {
      results.push({
        id,
        passed: Object.entries(expected).every(([key, value]) => actual[key] === value),
        detail: JSON.stringify(actual)
      });
    }
    const convertedLunar = convertLunarToSolar({ day: 15, month: 5, lunarYear: 2026 });
    results.push({
      id: 'phase2k-lunar-to-solar-unit',
      passed: Boolean(convertedLunar?.isoDate && convertedLunar.year === 2026),
      detail: JSON.stringify(convertedLunar)
    });

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

    await fetchJson(`/api/knowledge/extracted-anniversaries/${phase2jCandidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    await fetchJson(`/api/knowledge/extracted-anniversaries/${phase2jCandidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: phase2jMemberId, fieldTypes: ['lunar_anniversary'] })
    });

    const lunarOnlyQuestion = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'ngay gio Cao Dinh Lunar Only Phase 2J la ngay nao?',
        type: 'chat',
        botType: 'dashboard',
        intent: 'quality_check_phase_2j',
        engine: 'local'
      })
    });
    const lunarOnlyAnswer = String(lunarOnlyQuestion.data.text || '');
    results.push({
      id: 'ai-lunar-day-month-no-invented-year',
      passed: lunarOnlyQuestion.response.ok
        && /15\/5|15 thang 5/i.test(lunarOnlyAnswer)
        && /chua ro|chua duoc xac minh|chÆ°a rÃµ|chÆ°a Ä‘Æ°á»£c xÃ¡c minh/i.test(lunarOnlyAnswer)
        && !/1901|1970|1985/.test(lunarOnlyAnswer),
      detail: lunarOnlyAnswer.slice(0, 180)
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
      body: JSON.stringify({ memberId })
    });
    const checkDb = new DatabaseSync(databaseFile);
    const appliedTree = getState(checkDb, 'lineage-tree', null);
    const appliedText = JSON.stringify(appliedTree);
    checkDb.close();
    const appliedFields = Array.isArray(apply.data.changes) ? apply.data.changes.map((item) => item.lineageField) : [];
    results.push({
      id: 'apply-writes-member',
      passed: apply.response.ok
        && appliedText.includes('Ngay mung 9 thang Chin')
        && appliedFields.includes('deathAnniversaryLunar')
        && (appliedFields.includes('solarBirthDate') || appliedFields.includes('birthYear'))
        && (appliedFields.includes('graveLocation') || appliedFields.includes('burialPlace')),
      detail: `HTTP ${apply.response.status}`
    });

    const treeProfile = await fetchJson('/api/tree');
    const treeText = JSON.stringify(treeProfile.data || {});
    results.push({
      id: 'tree-profile-has-applied-fields',
      passed: treeProfile.response.ok
        && treeText.includes('solarBirthDate')
        && treeText.includes('solarDeathDate')
        && treeText.includes('burialPlace')
        && treeText.includes('Mo chi test'),
      detail: `HTTP ${treeProfile.response.status}`
    });

    const appliedPublic = await fetchJson('/api/knowledge/applied-extractions?limit=5');
    results.push({
      id: 'applied-extractions-public-403',
      passed: appliedPublic.response.status === 403,
      detail: `HTTP ${appliedPublic.response.status}`
    });

    const appliedList = await fetchJson('/api/knowledge/applied-extractions?q=Kiem%20Thu&limit=20', { headers: { Cookie: tempAdmin.cookie } });
    const appliedItems = Array.isArray(appliedList.data.appliedExtractions) ? appliedList.data.appliedExtractions : [];
    const anniversaryAudit = appliedItems.find((item) => item.candidateId === candidateId && item.field === 'deathAnniversaryLunar');
    results.push({
      id: 'applied-extractions-admin-list',
      passed: appliedList.response.ok && Boolean(anniversaryAudit) && anniversaryAudit.newValue === 'Ngay mung 9 thang Chin',
      detail: `items ${appliedItems.length}`
    });

    const appliedDetail = anniversaryAudit
      ? await fetchJson(`/api/knowledge/applied-extractions/${encodeURIComponent(anniversaryAudit.id)}`, { headers: { Cookie: tempAdmin.cookie } })
      : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'applied-extraction-detail-audit',
      passed: appliedDetail.response.ok
        && appliedDetail.data.appliedExtraction?.oldValue === ''
        && appliedDetail.data.appliedExtraction?.newValue === 'Ngay mung 9 thang Chin'
        && appliedDetail.data.appliedExtraction?.sourceId === 'source_phase2g_test'
        && appliedDetail.data.appliedExtraction?.chunkId === 'chunk_phase2g_test',
      detail: `HTTP ${appliedDetail.response.status}`
    });

    await fetchJson(`/api/knowledge/extracted-anniversaries/${phase2jCandidateId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    const lunarOnlyApply = await fetchJson(`/api/knowledge/extracted-anniversaries/${phase2jCandidateId}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: phase2jMemberId, fieldTypes: ['lunar_anniversary'] })
    });
    const lunarOnlyDb = new DatabaseSync(databaseFile);
    const lunarOnlyTree = getState(lunarOnlyDb, 'lineage-tree', null);
    lunarOnlyDb.close();
    const lunarOnlyMember = lunarOnlyTree.children.find((item) => item.id === phase2jMemberId);
    results.push({
      id: 'apply-lunar-day-month-no-fake-death-year',
      passed: lunarOnlyApply.response.ok
        && lunarOnlyMember?.deathAnniversaryLunar === '15/5 am lich'
        && lunarOnlyMember?.deathAnniversaryLunarStructured?.precision === 'day_month'
        && lunarOnlyMember?.deathAnniversaryLunarStructured?.year === null
        && !lunarOnlyMember?.deathYear
        && !lunarOnlyMember?.solarDeathDate,
      detail: JSON.stringify(lunarOnlyMember?.deathAnniversaryLunarStructured || {})
    });

    const anniversaries2026 = await fetchJson('/api/anniversaries?year=2026', { headers: { Cookie: tempAdmin.cookie } });
    const phase2jAnniversary = anniversaries2026.data.anniversaries?.find((item) => item.memberId === phase2jMemberId);
    const legacyAnniversary = anniversaries2026.data.anniversaries?.find((item) => item.memberId === legacyAnniversaryMemberId);
    results.push({
      id: 'phase2k-anniversaries-api-structured',
      passed: anniversaries2026.response.ok
        && phase2jAnniversary?.lunarDay === 15
        && phase2jAnniversary?.lunarMonth === 5
        && Boolean(phase2jAnniversary?.solarDate)
        && phase2jAnniversary?.note === 'Nam mat chua ro',
      detail: JSON.stringify(phase2jAnniversary || {})
    });
    results.push({
      id: 'phase2k-anniversaries-api-legacy-fallback',
      passed: anniversaries2026.response.ok
        && legacyAnniversary?.lunarDay === 12
        && legacyAnniversary?.lunarMonth === 6
        && legacyAnniversary?.source === 'legacyParsed',
      detail: JSON.stringify(legacyAnniversary || {})
    });

    const memberAnniversary = await fetchJson(`/api/anniversaries/member/${encodeURIComponent(phase2jMemberId)}?year=2026`, { headers: { Cookie: tempAdmin.cookie } });
    results.push({
      id: 'phase2k-member-anniversary-api',
      passed: memberAnniversary.response.ok
        && memberAnniversary.data.anniversary?.memberId === phase2jMemberId
        && memberAnniversary.data.anniversary?.lunarDay === 15,
      detail: `HTTP ${memberAnniversary.response.status}`
    });

    const publicDrafts = await fetchJson('/api/anniversary-drafts?limit=1');
    results.push({
      id: 'phase2l-drafts-public-403',
      passed: publicDrafts.response.status === 403,
      detail: `HTTP ${publicDrafts.response.status}`
    });

    const createDraft = await fetchJson('/api/anniversary-drafts/from-anniversary', {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: phase2jMemberId, year: 2026, channel: 'zalo' })
    });
    const draft = createDraft.data.draft || {};
    if (draft.id) createdDraftIds.push(draft.id);
    const draftMessage = String(draft.messageDraft || '');
    results.push({
      id: 'phase2l-create-draft-from-anniversary',
      passed: createDraft.response.status === 201
        && draft.memberId === phase2jMemberId
        && draft.channel === 'zalo'
        && draft.status === 'draft'
        && /15\/5/i.test(draftMessage)
        && /29\/06\/2026|2026-06-29/i.test(draftMessage)
        && /chua gui tu dong/i.test(draftMessage)
        && !/Tu Duong|Cao Ninh Binh|1901|1970/i.test(draftMessage),
      detail: draftMessage.slice(0, 180)
    });

    const missingDraft = await fetchJson('/api/anniversary-drafts/from-anniversary', {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: `${memberId}-dup-a`, year: 2026, channel: 'dashboard' })
    });
    results.push({
      id: 'phase2l-no-draft-without-anniversary',
      passed: missingDraft.response.status === 404,
      detail: `HTTP ${missingDraft.response.status}`
    });

    const patchDraft = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved', messageDraft: `${draftMessage}\nAdmin da sua noi dung.` })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2l-patch-draft',
      passed: patchDraft.response.ok
        && patchDraft.data.draft?.status === 'approved'
        && /Admin da sua noi dung/.test(String(patchDraft.data.draft?.messageDraft || '')),
      detail: `HTTP ${patchDraft.response.status}`
    });

    const scheduleDraft = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'scheduled' })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2l-scheduled-does-not-send',
      passed: scheduleDraft.response.ok && scheduleDraft.data.draft?.status === 'scheduled',
      detail: `HTTP ${scheduleDraft.response.status}; local status only`
    });

    const publicSendTest = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel: 'zalo', recipientManual: 'admin-test' })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2m-send-test-public-403',
      passed: publicSendTest.response.status === 403,
      detail: `HTTP ${publicSendTest.response.status}`
    });

    const publicTransportStatus = await fetchJson('/api/reminder-transports/status');
    results.push({
      id: 'phase2n-transport-status-public-403',
      passed: publicTransportStatus.response.status === 403,
      detail: `HTTP ${publicTransportStatus.response.status}`
    });

    const adminTransportStatus = await fetchJson('/api/reminder-transports/status', { headers: { Cookie: tempAdmin.cookie } });
    const transportText = JSON.stringify(adminTransportStatus.data);
    const zaloTransport = adminTransportStatus.data.transports?.zalo || {};
    const zaloCanSendReal = Boolean(zaloTransport.canSendReal);
    const zaloDryRun = Boolean(zaloTransport.dryRun);
    results.push({
      id: 'phase2n-transport-status-admin-no-secret',
      passed: adminTransportStatus.response.ok
        && typeof adminTransportStatus.data.transports?.zalo?.canSendReal === 'boolean'
        && Number(adminTransportStatus.data.transports?.rateLimit || 0) >= 1
        && !/token|secret|GOCSPX|AIza|access_token/i.test(transportText),
      detail: JSON.stringify(adminTransportStatus.data.transports || {})
    });

    const transportCheck = await fetchJson('/api/reminder-transports/check', {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo' })
    });
    results.push({
      id: 'phase2n-transport-check-zalo',
      passed: transportCheck.response.ok
        && transportCheck.data.check?.channel === 'zalo'
        && typeof transportCheck.data.check?.canSendReal === 'boolean',
      detail: JSON.stringify(transportCheck.data.check || {})
    });

    const publicReminderRecipients = await fetchJson('/api/reminder-test-recipients');
    results.push({
      id: 'phase2o-test-recipients-public-403',
      passed: publicReminderRecipients.response.status === 403,
      detail: `HTTP ${publicReminderRecipients.response.status}`
    });

    const adminReminderRecipients = await fetchJson('/api/reminder-test-recipients', { headers: { Cookie: tempAdmin.cookie } });
    const reminderRecipients = Array.isArray(adminReminderRecipients.data.recipients) ? adminReminderRecipients.data.recipients : [];
    results.push({
      id: 'phase2o-test-recipients-admin',
      passed: adminReminderRecipients.response.ok
        && reminderRecipients.every((item) => ['admin_test', 'linked_user_test'].includes(item.type)),
      detail: `recipients ${reminderRecipients.length}`
    });

    const missingRecipientSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo' })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2m-send-test-requires-recipient',
      passed: missingRecipientSend.response.status === 400,
      detail: `HTTP ${missingRecipientSend.response.status}`
    });

    const realMissingConfirmSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo', recipientManual: 'admin-test', sendReal: true })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2n-send-real-requires-confirm',
      passed: realMissingConfirmSend.response.status === 400,
      detail: `HTTP ${realMissingConfirmSend.response.status}`
    });

    const realGroupSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo', recipientType: 'group', recipientManual: 'group-test', sendReal: true, confirmText: 'GUI TEST THAT', finalConfirm: true })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2n-send-real-blocks-group',
      passed: realGroupSend.response.status === 400,
      detail: `HTTP ${realGroupSend.response.status}`
    });

    const realMissingFinalConfirmSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo', recipientManual: 'admin-test', sendReal: true, confirmText: 'GUI TEST THAT' })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2o-send-real-requires-final-confirm',
      passed: realMissingFinalConfirmSend.response.status === 400,
      detail: `HTTP ${realMissingFinalConfirmSend.response.status}`
    });

    const realDisabledSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo', recipientManual: 'admin-test', sendReal: true, confirmText: 'GUI TEST THAT', finalConfirm: true })
    }) : { response: { ok: false, status: 0 }, data: {} };
    if (realDisabledSend.data.log?.id) createdReminderLogIds.push(realDisabledSend.data.log.id);
    results.push({
      id: 'phase2o-send-real-disabled-or-configured-safe',
      passed: zaloCanSendReal ? [201, 400, 502].includes(realDisabledSend.response.status) : realDisabledSend.response.status === 400,
      detail: JSON.stringify({ http: realDisabledSend.response.status, canSendReal: zaloCanSendReal, dryRun: zaloDryRun, error: realDisabledSend.data.error, transport: realDisabledSend.data.log?.transport, status: realDisabledSend.data.log?.status })
    });

    const blockedLogs = await fetchJson('/api/reminder-send-logs?status=blocked&transport=zalo_real&limit=20', { headers: { Cookie: tempAdmin.cookie } });
    const hasBlockedRealLog = Array.isArray(blockedLogs.data.logs) && blockedLogs.data.logs.some((log) => log.draftId === draft.id && log.status === 'blocked' && log.transport === 'zalo_real');
    results.push({
      id: 'phase2n-blocked-real-send-logs',
      passed: blockedLogs.response.ok && hasBlockedRealLog,
      detail: `logs ${blockedLogs.data.logs?.length || 0}`
    });

    const realLogsNoSecretText = JSON.stringify(blockedLogs.data);
    results.push({
      id: 'phase2o-real-send-logs-no-token',
      passed: blockedLogs.response.ok && !/GOCSPX|AIza|access_token|ZALO_OA_ACCESS_TOKEN/i.test(realLogsNoSecretText),
      detail: `chars ${realLogsNoSecretText.length}`
    });

    const mockSend = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'zalo', recipientType: 'admin_test', recipientManual: 'admin-test', sendReal: false })
    }) : { response: { ok: false, status: 0 }, data: {} };
    const mockLog = mockSend.data.log || {};
    if (mockLog.id) createdReminderLogIds.push(mockLog.id);
    results.push({
      id: 'phase2m-send-test-approved-mock',
      passed: mockSend.response.status === 201
        && mockLog.draftId === draft.id
        && mockLog.status === 'sent'
        && mockLog.transport === 'zalo_mock'
        && /Admin da sua noi dung/.test(String(mockLog.message || '')),
      detail: JSON.stringify({ http: mockSend.response.status, error: mockSend.data.error, status: mockLog.status, transport: mockLog.transport })
    });

    const draftLogs = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}/send-logs`, { headers: { Cookie: tempAdmin.cookie } }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2m-get-draft-send-logs',
      passed: draftLogs.response.ok && Array.isArray(draftLogs.data.logs) && draftLogs.data.logs.some((log) => log.id === mockLog.id),
      detail: `logs ${draftLogs.data.logs?.length || 0}`
    });

    const allReminderLogsPublic = await fetchJson('/api/reminder-send-logs?limit=5');
    results.push({
      id: 'phase2m-reminder-logs-public-403',
      passed: allReminderLogsPublic.response.status === 403,
      detail: `HTTP ${allReminderLogsPublic.response.status}`
    });

    const allReminderLogsAdmin = await fetchJson('/api/reminder-send-logs?limit=20', { headers: { Cookie: tempAdmin.cookie } });
    results.push({
      id: 'phase2m-reminder-logs-admin',
      passed: allReminderLogsAdmin.response.ok && Array.isArray(allReminderLogsAdmin.data.logs) && allReminderLogsAdmin.data.logs.some((log) => log.id === mockLog.id),
      detail: `logs ${allReminderLogsAdmin.data.logs?.length || 0}`
    });

    const createRejectedDraft = await fetchJson('/api/anniversary-drafts/from-anniversary', {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: phase2jMemberId, year: 2026, channel: 'web_chat' })
    });
    const rejectedDraft = createRejectedDraft.data.draft || {};
    if (rejectedDraft.id) createdDraftIds.push(rejectedDraft.id);
    if (rejectedDraft.id) {
      await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(rejectedDraft.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'rejected' })
      });
    }
    const rejectedSend = rejectedDraft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(rejectedDraft.id)}/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'web_chat', recipientManual: 'admin-test' })
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2m-rejected-draft-not-sendable',
      passed: rejectedSend.response.status === 400,
      detail: `HTTP ${rejectedSend.response.status}`
    });

    const deleteDraft = draft.id ? await fetchJson(`/api/anniversary-drafts/${encodeURIComponent(draft.id)}`, {
      method: 'DELETE',
      headers
    }) : { response: { ok: false, status: 0 }, data: {} };
    results.push({
      id: 'phase2l-delete-draft',
      passed: deleteDraft.response.ok && deleteDraft.data.deleted === true,
      detail: `HTTP ${deleteDraft.response.status}`
    });

    const upcomingAnniversaries = await fetchJson('/api/anniversaries/upcoming?days=900', { headers: { Cookie: tempAdmin.cookie } });
    const upcomingItems = Array.isArray(upcomingAnniversaries.data.anniversaries) ? upcomingAnniversaries.data.anniversaries : [];
    const sortedUpcoming = upcomingItems.every((item, index) => index === 0 || Number(upcomingItems[index - 1].daysUntil) <= Number(item.daysUntil));
    results.push({
      id: 'phase2k-upcoming-anniversaries-sorted',
      passed: upcomingAnniversaries.response.ok && upcomingItems.length > 0 && sortedUpcoming,
      detail: `items ${upcomingItems.length}`
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
    cleanupDb.prepare('DELETE FROM extracted_anniversary_candidates WHERE id = ?').run(phase2jCandidateId);
    cleanupDb.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(candidateId);
    cleanupDb.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(phase2jCandidateId);
    for (const logId of createdReminderLogIds) {
      cleanupDb.prepare('DELETE FROM reminder_send_logs WHERE id = ?').run(logId);
    }
    for (const draftId of createdDraftIds) {
      cleanupDb.prepare('DELETE FROM reminder_send_logs WHERE draft_id = ?').run(draftId);
      cleanupDb.prepare('DELETE FROM anniversary_event_drafts WHERE id = ?').run(draftId);
    }
    cleanupDb.close();
    tempAdmin.cleanup();
  }
}

await main();
