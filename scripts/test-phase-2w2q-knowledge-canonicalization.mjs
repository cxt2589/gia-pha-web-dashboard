import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
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

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2w2q_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2q-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2q-admin',
    account: 'phase2w2q-admin',
    name: 'Phase 2W2Q Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2q-admin',
      fullName: 'Phase 2W2Q Admin',
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
  const results = [];
  try {
    const publicReport = await fetchJson('/api/knowledge/dataset-policy/report');
    results.push(result('canonical-policy-public-403', publicReport.response.status === 403, `HTTP ${publicReport.response.status}`));

    const report = await fetchJson('/api/knowledge/dataset-policy/report', { headers });
    results.push(result('canonical-policy-report-ok', report.response.ok && report.data.activeDatasetKey === 'cao_toc_txt_knowledge_base_v3', JSON.stringify(report.data.totals || {})));
    results.push(result('canonical-policy-has-actions', report.data.bySourceAction && typeof report.data.bySourceAction === 'object', JSON.stringify(report.data.bySourceAction || {})));

    const dryRun = await fetchJson('/api/knowledge/maintenance/canonicalize-datasets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dryRun: true, activeDatasetKey: 'cao_toc_txt_knowledge_base_v3' })
    });
    results.push(result('canonical-policy-dry-run-ok', dryRun.response.ok && dryRun.data.dryRun === true, JSON.stringify(dryRun.data.totals || {})));

    const status = await fetchJson('/api/knowledge/status');
    results.push(result('canonical-policy-status-has-active-dataset', status.response.ok && status.data.activeDatasetKey === 'cao_toc_txt_knowledge_base_v3', JSON.stringify(status.data)));
  } finally {
    admin.cleanup();
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2Q knowledge canonicalization checks failed: ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`Phase 2W2Q knowledge canonicalization checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
