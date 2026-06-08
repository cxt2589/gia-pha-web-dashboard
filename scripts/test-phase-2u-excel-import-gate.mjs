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

function cleanupPhase2U() {
  const database = getDatabase();
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'excel_import_%'").all().map((row) => row.name);
  if (tables.includes('excel_import_sessions')) {
    const ids = database.prepare("SELECT id FROM excel_import_sessions WHERE file_name LIKE 'phase2u_%'").all().map((row) => row.id);
    if (ids.length) {
      const deleteIssues = tables.includes('excel_import_validation_issues')
        ? database.prepare('DELETE FROM excel_import_validation_issues WHERE session_id = ?')
        : null;
      const deleteMappings = tables.includes('excel_import_column_mappings')
        ? database.prepare('DELETE FROM excel_import_column_mappings WHERE session_id = ?')
        : null;
      const deleteSession = database.prepare('DELETE FROM excel_import_sessions WHERE id = ?');
      for (const id of ids) {
        deleteIssues?.run(id);
        deleteMappings?.run(id);
        deleteSession.run(id);
      }
    }
  }
  database.close();
}

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2u_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2u-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2u-admin',
    account: 'phase2u-admin',
    name: 'Phase 2U Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2u-admin',
      fullName: 'Phase 2U Admin',
      role: 'admin',
      roles: ['admin', 'user'],
      isKYCed: true,
      kycStatus: 'verified',
      isApproved: true,
      approvalStatus: 'approved',
      loginType: 'username'
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
  return { response, data };
}

function result(id, passed, detail = '') {
  return { id, passed: Boolean(passed), detail };
}

async function main() {
  cleanupPhase2U();
  const admin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const publicList = await fetchJson('/api/excel-import/sessions');
    results.push(result('public-api-403', publicList.response.status === 403, `HTTP ${publicList.response.status}`));

    const fieldRef = await fetchJson('/api/excel-import/field-reference', { headers });
    const fields = Array.isArray(fieldRef.data.fields) ? fieldRef.data.fields : [];
    const fieldNames = new Set(fields.map((field) => field.field));
    const requiredExpandedFields = [
      'person.id',
      'person.name',
      'person.rankRole',
      'person.title',
      'contact.phone3',
      'birth.lunarDate',
      'person.photo',
      'spouse.3.name',
      'archive.child.12.id',
      'bio.achievements'
    ];
    results.push(result(
      'field-reference-expanded',
      fieldRef.response.ok && fields.length >= 109 && requiredExpandedFields.every((field) => fieldNames.has(field)),
      `${fields.length || 0} fields`
    ));

    const unsafe = await fetchJson('/api/excel-import/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: 'phase2u_unsafe.exe',
        fileSize: 12 * 1024 * 1024,
        fileType: 'application/octet-stream',
        headers: ['Name'],
        previewRows: [['Cao Test']],
        rowCount: 1,
        columnCount: 1
      })
    });
    results.push(result('unsafe-file-blocked', unsafe.response.ok && unsafe.data.session?.status === 'validation_failed', unsafe.data.session?.status));

    const duplicate = await fetchJson('/api/excel-import/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: 'phase2u_duplicate.csv',
        fileSize: 1200,
        fileType: 'text/csv',
        headers: ['Mã định danh cá nhân', 'Họ và tên đầy đủ', 'Họ và tên đầy đủ', 'Đời thứ mấy'],
        previewRows: [['P2U01', 'Cao Test', 'Cao Test', '8']],
        rowCount: 1,
        columnCount: 4
      })
    });
    results.push(result('duplicate-header-warning', duplicate.response.ok && duplicate.data.issues?.some((issue) => issue.issueType === 'duplicate_header'), `${duplicate.data.issues?.length || 0} issues`));

    const good = await fetchJson('/api/excel-import/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: 'phase2u_good.csv',
        fileSize: 2048,
        fileType: 'text/csv',
        headers: ['Mã định danh cá nhân', 'Họ và tên đầy đủ', 'Đời thứ mấy', 'Số điện thoại'],
        previewRows: [['P2U02', 'Cao Test Hai', '8', '0900000000']],
        rowCount: 1,
        columnCount: 4
      })
    });
    const goodId = good.data.session?.id;
    results.push(result('create-safe-session', good.response.ok && goodId && good.data.session.status !== 'imported', good.data.session?.status));

    const prematureImport = await fetchJson(`/api/excel-import/sessions/${goodId}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmImport: true })
    });
    results.push(result('import-before-validate-blocked', prematureImport.response.status === 400, `HTTP ${prematureImport.response.status}`));

    const approvedMappings = (good.data.mappings || []).map((mapping) => ({
      columnIndex: mapping.columnIndex,
      mappedField: mapping.mappedField,
      confidence: 1,
      approved: true
    }));
    const patch = await fetchJson(`/api/excel-import/sessions/${goodId}/mappings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ mappings: approvedMappings })
    });
    results.push(result('approve-mappings', patch.response.ok && patch.data.session?.status === 'mapping_approved', patch.data.session?.status));

    const validate = await fetchJson(`/api/excel-import/sessions/${goodId}/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'full' })
    });
    results.push(result('validate-ready', validate.response.ok && validate.data.session?.status === 'ready_to_import', validate.data.session?.status));
    results.push(result('privacy-info-detected', validate.data.issues?.some((issue) => issue.severity === 'info' && String(issue.message || '').includes('rieng tu')), `${validate.data.issues?.length || 0} issues`));

    const missingConfirm = await fetchJson(`/api/excel-import/sessions/${goodId}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('import-confirm-required', missingConfirm.response.status === 400, `HTTP ${missingConfirm.response.status}`));

    const confirmed = await fetchJson(`/api/excel-import/sessions/${goodId}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmImport: true })
    });
    results.push(result('confirmed-preview-only', confirmed.response.ok && confirmed.data.previewOnly === true && confirmed.data.session?.status === 'imported', confirmed.data.session?.status));
  } finally {
    admin.cleanup();
    cleanupPhase2U();
  }

  const failed = results.filter((item) => !item.passed);
  for (const item of results) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id}${item.detail ? ` - ${item.detail}` : ''}`);
  }
  if (failed.length) {
    console.error(`Phase 2U Excel import gate failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2U Excel import gate passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
