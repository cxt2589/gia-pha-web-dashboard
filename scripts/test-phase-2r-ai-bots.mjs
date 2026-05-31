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
  const token = `phase2r_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2r-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2r-admin',
    account: 'phase2r-admin',
    name: 'Phase 2R Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2r-admin',
      fullName: 'Phase 2R Admin',
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
      const cleanupDb = new DatabaseSync(databaseFile);
      cleanupDb.exec('PRAGMA busy_timeout = 5000');
      const nextSessions = getState(cleanupDb, 'auth-sessions', {});
      delete nextSessions[token];
      putState(cleanupDb, 'auth-sessions', nextSessions);
      const nextUsers = getState(cleanupDb, 'auth-users', []).filter((user) => user.id !== userId);
      putState(cleanupDb, 'auth-users', nextUsers);
      cleanupDb.prepare("DELETE FROM ai_request_logs WHERE prompt_snippet LIKE 'phase2r_%'").run();
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
  const results = [];
  const admin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };

  try {
    const publicConfigs = await fetchJson('/api/ai/bot-configs');
    results.push(result('ai-bot-configs-public-403', publicConfigs.response.status === 403, `HTTP ${publicConfigs.response.status}`));

    const configs = await fetchJson('/api/ai/bot-configs', { headers: { Cookie: admin.cookie } });
    const botTypes = new Set((configs.data.configs || []).map((item) => item.botType));
    results.push(result(
      'ai-bot-configs-admin-list',
      configs.response.ok
        && ['webview_chat', 'dashboard_helper', 'ai_governor', 'article_writer', 'prayer_writer', 'zalo_bot'].every((bot) => botTypes.has(bot)),
      JSON.stringify((configs.data.configs || []).map((item) => ({ botType: item.botType, enabled: item.enabled, engine: item.engine })))
    ));

    const zaloConfig = (configs.data.configs || []).find((item) => item.botType === 'zalo_bot');
    results.push(result(
      'zalo-bot-paused-config',
      zaloConfig && zaloConfig.enabled === false && /OA|Tam dung|Tạm dừng/i.test(zaloConfig.pausedReason || ''),
      JSON.stringify(zaloConfig)
    ));

    const update = await fetchJson('/api/ai/bot-configs/webview_chat', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ maxKnowledgeChunks: 4, cacheEnabled: true })
    });
    results.push(result(
      'ai-bot-config-update',
      update.response.ok && update.data.config?.maxKnowledgeChunks === 4 && update.data.config?.cacheEnabled === true,
      JSON.stringify(update.data.config || update.data)
    ));

    const webviewChat = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'webview_chat',
        botType: 'webview_chat',
        intent: 'knowledge_question',
        message: 'phase2r_Cao To la ai?'
      })
    });
    results.push(result(
      'webview-chat-uses-configured-bot',
      webviewChat.response.ok
        && webviewChat.data.botType === 'webview_chat'
        && /Cao Dinh Thuat|Cao Đình Thuật|Cao To|Cao Tổ|Cao Tá»•/i.test(String(webviewChat.data.text || '')),
      String(webviewChat.data.text || webviewChat.data.error || '').slice(0, 180)
    ));

    const pausedZalo = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'chat',
        botType: 'zalo_bot',
        intent: 'knowledge_question',
        message: 'phase2r_Cao To la ai?'
      })
    });
    results.push(result(
      'zalo-bot-paused-response',
      pausedZalo.response.ok && pausedZalo.data.model === 'bot-paused' && /tam dung|tạm dừng|paused/i.test(String(pausedZalo.data.text || '')),
      JSON.stringify(pausedZalo.data)
    ));

    const logs = await fetchJson('/api/ai/logs?limit=20', { headers: { Cookie: admin.cookie } });
    const hasBotConfigLog = (logs.data.logs || []).some((log) => (
      ['webview_chat', 'zalo_bot'].includes(log.botType)
      && log.botConfigEngine
      && typeof log.botConfigMaxChunks === 'number'
      && typeof log.botConfigMaxOutputTokens === 'number'
    ));
    results.push(result('ai-logs-include-bot-config', logs.response.ok && hasBotConfigLog, `logs ${logs.data.logs?.length || 0}`));

    const summary = await fetchJson('/api/ai/logs/summary', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'ai-logs-summary-by-bot',
      summary.response.ok && Array.isArray(summary.data.topBotTypes),
      JSON.stringify(summary.data.topBotTypes || [])
    ));
  } finally {
    admin.cleanup();
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
  process.exit(1);
});
