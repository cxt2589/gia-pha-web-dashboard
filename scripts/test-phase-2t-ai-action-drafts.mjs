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

function cleanupPhase2T() {
  const database = getDatabase();
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ai_action_drafts', 'ai_action_draft_logs')").all().map((row) => row.name);
  if (tables.includes('ai_action_drafts')) {
    const ids = database.prepare("SELECT id FROM ai_action_drafts WHERE title LIKE 'phase2t_%'").all().map((row) => row.id);
    if (tables.includes('ai_action_draft_logs')) {
      for (const id of ids) database.prepare('DELETE FROM ai_action_draft_logs WHERE draft_id = ?').run(id);
    }
    database.prepare("DELETE FROM ai_action_drafts WHERE title LIKE 'phase2t_%'").run();
  }
  const articles = getState(database, 'dashboard-articles', []);
  if (Array.isArray(articles)) {
    putState(database, 'dashboard-articles', articles.filter((article) => !String(article.title || '').startsWith('phase2t_')));
  }
  const rules = getState(database, 'dashboard-zalo-rules', []);
  if (Array.isArray(rules)) {
    putState(database, 'dashboard-zalo-rules', rules.filter((rule) => !String(rule.replyContent || '').includes('phase2t_')));
  }
  database.close();
}

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2t_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2t-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2t-admin',
    account: 'phase2t-admin',
    name: 'Phase 2T Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2t-admin',
      fullName: 'Phase 2T Admin',
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

async function main() {
  cleanupPhase2T();
  const admin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const publicList = await fetchJson('/api/ai-action-drafts');
    results.push(result('public-api-403', publicList.response.status === 403, `HTTP ${publicList.response.status}`));

    const manual = await fetchJson('/api/ai-action-drafts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draftType: 'article',
        title: 'phase2t_manual_article',
        summary: 'phase2t manual summary',
        content: 'phase2t manual content. Chưa tự đăng, chờ admin duyệt.',
        targetModule: 'articles',
        sourceType: 'manual',
        status: 'draft'
      })
    });
    const manualId = manual.data.draft?.id;
    results.push(result('admin-create-manual-draft', manual.response.ok && manualId && manual.data.draft.status === 'draft', JSON.stringify(manual.data.draft || manual.data)));

    const generated = await fetchJson('/api/ai-action-drafts/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draftType: 'zalo_rule',
        topic: 'phase2t_zalo_rule_safe',
        status: 'pending_review'
      })
    });
    const generatedId = generated.data.draft?.id;
    results.push(result('admin-generate-ai-draft', generated.response.ok && generatedId && generated.data.draft.status === 'pending_review', JSON.stringify(generated.data.draft || generated.data).slice(0, 220)));

    const approveManual = await fetchJson(`/api/ai-action-drafts/${manualId}/approve`, { method: 'POST', headers });
    results.push(result('approve-draft', approveManual.response.ok && approveManual.data.draft?.status === 'approved', JSON.stringify(approveManual.data.draft || approveManual.data)));

    const rejectGenerated = await fetchJson(`/api/ai-action-drafts/${generatedId}/reject`, { method: 'POST', headers });
    results.push(result('reject-draft', rejectGenerated.response.ok && rejectGenerated.data.draft?.status === 'rejected', JSON.stringify(rejectGenerated.data.draft || rejectGenerated.data)));

    const unapproved = await fetchJson('/api/ai-action-drafts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draftType: 'anniversary_notice',
        title: 'phase2t_unapproved_anniversary',
        summary: 'phase2t unapproved',
        content: 'phase2t anniversary draft, not approved.',
        targetModule: 'events',
        status: 'draft'
      })
    });
    const blockedApply = await fetchJson(`/api/ai-action-drafts/${unapproved.data.draft?.id}/apply`, { method: 'POST', headers });
    results.push(result('block-apply-unapproved', blockedApply.response.status === 400, `${blockedApply.response.status}: ${JSON.stringify(blockedApply.data)}`));

    const applyManual = await fetchJson(`/api/ai-action-drafts/${manualId}/apply`, { method: 'POST', headers });
    results.push(result(
      'apply-article-creates-unpublished-draft',
      applyManual.response.ok
        && applyManual.data.result?.draft?.status === 'applied'
        && applyManual.data.result?.result?.article?.status === 'Bản nháp',
      JSON.stringify(applyManual.data.result?.result || applyManual.data)
    ));

    const anniv = await fetchJson('/api/ai-action-drafts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draftType: 'anniversary_notice',
        title: 'phase2t_anniversary_notice',
        summary: 'phase2t anniversary summary',
        content: 'phase2t anniversary notice. Chưa gửi thật.',
        targetModule: 'events',
        status: 'approved'
      })
    });
    const applyAnniv = await fetchJson(`/api/ai-action-drafts/${anniv.data.draft?.id}/apply`, { method: 'POST', headers });
    results.push(result(
      'apply-anniversary-notice-creates-draft-only',
      applyAnniv.response.ok
        && applyAnniv.data.result?.result?.anniversaryDraft?.status === 'draft',
      JSON.stringify(applyAnniv.data.result?.result || applyAnniv.data)
    ));

    const zalo = await fetchJson('/api/ai-action-drafts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        draftType: 'zalo_rule',
        title: 'phase2t_zalo_rule',
        summary: 'phase2t zalo summary',
        content: 'phase2t_zalo_rule content. Không gửi thật.',
        targetModule: 'zalo',
        status: 'approved'
      })
    });
    const applyZalo = await fetchJson(`/api/ai-action-drafts/${zalo.data.draft?.id}/apply`, { method: 'POST', headers });
    results.push(result(
      'apply-zalo-rule-inactive',
      applyZalo.response.ok && applyZalo.data.result?.result?.zaloRule?.isActive === false,
      JSON.stringify(applyZalo.data.result?.result || applyZalo.data)
    ));

    const logs = await fetchJson(`/api/ai-action-drafts/${manualId}/logs`, { headers: { Cookie: admin.cookie } });
    results.push(result('action-draft-logs-written', logs.response.ok && (logs.data.logs || []).some((log) => log.action === 'apply'), JSON.stringify(logs.data.logs || [])));

    const aiLogs = await fetchJson('/api/ai/logs?limit=40', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'ai-gateway-log-action-draft',
      aiLogs.response.ok && (aiLogs.data.logs || []).some((log) => log.intent === 'action_draft'),
      `logs ${(aiLogs.data.logs || []).length}`
    ));
  } finally {
    admin.cleanup();
    cleanupPhase2T();
  }

  const passed = results.filter((item) => item.passed).length;
  const output = {
    ok: passed === results.length,
    baseUrl,
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
