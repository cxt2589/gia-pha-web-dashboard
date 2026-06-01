import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const testKeys = ['phase2s-system-audit-test', 'phase2s-conflict-test'];

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

function cleanupAuditFixtures() {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS system_audit_suggestions (
      id TEXT PRIMARY KEY,
      suggestion_hash TEXT UNIQUE NOT NULL,
      source_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      location_label TEXT,
      current_value TEXT,
      issue_type TEXT NOT NULL,
      issue_summary TEXT NOT NULL,
      suggested_value TEXT,
      suggested_action TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      evidence TEXT,
      related_source_ids_json TEXT,
      related_chunk_ids_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      applied_by TEXT,
      applied_at TEXT
    );
    CREATE TABLE IF NOT EXISTS system_audit_apply_logs (
      id TEXT PRIMARY KEY,
      suggestion_id TEXT NOT NULL,
      action TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      admin_user TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const suggestionRows = database.prepare(`
    SELECT id FROM system_audit_suggestions
    WHERE source_path IN ('app_state:phase2s-system-audit-test', 'app_state:phase2s-conflict-test')
  `).all();
  for (const row of suggestionRows) {
    database.prepare('DELETE FROM system_audit_apply_logs WHERE suggestion_id = ?').run(row.id);
  }
  database.prepare(`
    DELETE FROM system_audit_suggestions
    WHERE source_path IN ('app_state:phase2s-system-audit-test', 'app_state:phase2s-conflict-test')
  `).run();
  for (const key of testKeys) {
    database.prepare('DELETE FROM app_state WHERE key = ?').run(key);
  }
  database.close();
}

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2s_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2s-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2s-admin',
    account: 'phase2s-admin',
    name: 'Phase 2S Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2s-admin',
      fullName: 'Phase 2S Admin',
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
      const nextUsers = getState(cleanupDb, 'auth-users', []).filter((user) => user.id !== userId);
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
  return { response, data };
}

function result(id, passed, detail = '') {
  return { id, passed: Boolean(passed), detail };
}

function seedFixtureState() {
  cleanupAuditFixtures();
  const database = getDatabase();
  const mojibakeFixture = String.fromCharCode(0x54, 0x00c3, 0x00a1, 0x00c2, 0x00ba);
  putState(database, 'phase2s-system-audit-test', {
    text: `phase2s fixture ${mojibakeFixture} Cao To doi 0 demo`
  });
  putState(database, 'phase2s-conflict-test', {
    text: 'phase2s conflict Cao To doi 0'
  });
  database.close();
}

function mutateConflictFixture() {
  const database = getDatabase();
  putState(database, 'phase2s-conflict-test', {
    text: 'phase2s conflict already changed'
  });
  database.close();
}

async function main() {
  const results = [];
  seedFixtureState();
  const admin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };

  try {
    const publicList = await fetchJson('/api/system-audit/suggestions');
    results.push(result('system-audit-public-403', publicList.response.status === 403, `HTTP ${publicList.response.status}`));

    const scan = await fetchJson('/api/system-audit/scan', { method: 'POST', headers: { Cookie: admin.cookie } });
    results.push(result('system-audit-scan-ok', scan.response.ok && scan.data.inserted >= 3, JSON.stringify({
      scanned: scan.data.scanned,
      inserted: scan.data.inserted,
      duplicates: scan.data.duplicates
    })));

    const list = await fetchJson('/api/system-audit/suggestions?q=phase2s&limit=80', { headers: { Cookie: admin.cookie } });
    const suggestions = list.data.suggestions || [];
    const byType = new Set(suggestions.map((item) => item.issueType));
    results.push(result(
      'system-audit-detects-fixtures',
      list.response.ok && byType.has('mojibake') && byType.has('wrong_title') && byType.has('sample_data'),
      JSON.stringify(suggestions.map((item) => ({ id: item.id, type: item.issueType, source: item.sourcePath })))
    ));

    const secondScan = await fetchJson('/api/system-audit/scan', { method: 'POST', headers: { Cookie: admin.cookie } });
    const secondList = await fetchJson('/api/system-audit/suggestions?q=phase2s&limit=80', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'system-audit-dedupes',
      secondScan.response.ok && (secondList.data.suggestions || []).length === suggestions.length,
      `first ${suggestions.length}, second ${(secondList.data.suggestions || []).length}, inserted ${secondScan.data.inserted}`
    ));

    const wrongTitle = suggestions.find((item) => item.issueType === 'wrong_title' && item.sourcePath === 'app_state:phase2s-system-audit-test');
    const mojibake = suggestions.find((item) => item.issueType === 'mojibake');
    results.push(result('system-audit-has-wrong-title', Boolean(wrongTitle), JSON.stringify(wrongTitle || {})));

    const approve = await fetchJson(`/api/system-audit/suggestions/${wrongTitle?.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    results.push(result('system-audit-approve', approve.response.ok && approve.data.suggestion?.status === 'approved', JSON.stringify(approve.data)));

    const apply = await fetchJson(`/api/system-audit/suggestions/${wrongTitle?.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('system-audit-apply', apply.response.ok && apply.data.result?.suggestion?.status === 'applied', JSON.stringify(apply.data)));

    const logs = await fetchJson('/api/system-audit/logs?limit=20', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'system-audit-apply-log',
      logs.response.ok && (logs.data.logs || []).some((log) => log.suggestionId === wrongTitle?.id && log.status === 'applied'),
      JSON.stringify((logs.data.logs || []).slice(0, 3))
    ));

    if (mojibake) {
      const reject = await fetchJson(`/api/system-audit/suggestions/${mojibake.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'rejected' })
      });
      results.push(result('system-audit-reject', reject.response.ok && reject.data.suggestion?.status === 'rejected', JSON.stringify(reject.data)));
    } else {
      results.push(result('system-audit-reject', false, 'No mojibake suggestion found'));
    }

    const conflict = suggestions.find((item) => item.issueType === 'wrong_title' && item.sourcePath === 'app_state:phase2s-conflict-test');
    const approveConflict = await fetchJson(`/api/system-audit/suggestions/${conflict?.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' })
    });
    mutateConflictFixture();
    const conflictApply = await fetchJson(`/api/system-audit/suggestions/${conflict?.id}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result(
      'system-audit-conflict-no-overwrite',
      approveConflict.response.ok && conflictApply.response.status === 409,
      `approve ${approveConflict.response.status}, apply ${conflictApply.response.status}: ${JSON.stringify(conflictApply.data)}`
    ));
  } finally {
    admin.cleanup();
    cleanupAuditFixtures();
  }

  const failed = results.filter((item) => !item.passed);
  const payload = {
    ok: failed.length === 0,
    baseUrl,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results
  };
  console.log(JSON.stringify(payload, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  cleanupAuditFixtures();
  process.exit(1);
});
