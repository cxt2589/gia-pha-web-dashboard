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
  const token = `phase2p_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2p-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2p-admin',
    account: 'phase2p-admin',
    name: 'Phase 2P Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2p-admin',
      fullName: 'Phase 2P Admin',
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
      cleanupDb.prepare("DELETE FROM zalo_bot_replies WHERE event_id IN (SELECT id FROM zalo_bot_events WHERE event_id LIKE 'phase2p_%')").run();
      cleanupDb.prepare("DELETE FROM zalo_bot_events WHERE event_id LIKE 'phase2p_%'").run();
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

async function sendMock(headers, body) {
  return fetchJson('/api/zalo-bot/mock-message', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function main() {
  const results = [];
  const admin = installTempAdminSession();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };

  try {
    const publicStatus = await fetchJson('/api/zalo-bot/status');
    results.push(result('zalo-bot-status-public-403', publicStatus.response.status === 403, `HTTP ${publicStatus.response.status}`));

    const status = await fetchJson('/api/zalo-bot/status', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'zalo-bot-status-admin',
      status.response.ok && status.data.sendMode && status.data.canReplyReal === false,
      JSON.stringify(status.data)
    ));

    const caoTo = await sendMock(headers, {
      eventId: 'phase2p_cao_to',
      channel: 'personal',
      senderId: 'phase2p-unknown',
      messageText: 'Cao To la ai?'
    });
    results.push(result(
      'zalo-bot-personal-cao-to',
      caoTo.response.status === 201 && /Cao Dinh Thuat|Cao Đình Thuật|Cao To|Cao Tổ/i.test(String(caoTo.data.reply?.replyText || '')),
      String(caoTo.data.reply?.replyText || '').slice(0, 180)
    ));

    const thuyTo = await sendMock(headers, {
      eventId: 'phase2p_thuy_to',
      channel: 'personal',
      senderId: 'phase2p-unknown',
      messageText: 'Thuy To la ai?'
    });
    results.push(result(
      'zalo-bot-personal-thuy-to',
      thuyTo.response.status === 201 && /Cao Dinh Lang|Cao Đình Lạng|Thuy To|Thủy Tổ/i.test(String(thuyTo.data.reply?.replyText || '')),
      String(thuyTo.data.reply?.replyText || '').slice(0, 180)
    ));

    const langAnn = await sendMock(headers, {
      eventId: 'phase2p_gio_lang',
      channel: 'personal',
      senderId: 'phase2p-unknown',
      messageText: 'ngay gio cu Lang'
    });
    results.push(result(
      'zalo-bot-personal-anniversary-lang',
      langAnn.response.status === 201 && /13\/4|chua tim thay|chưa tìm thấy|xac minh|xác minh/i.test(String(langAnn.data.reply?.replyText || '')),
      String(langAnn.data.reply?.replyText || '').slice(0, 180)
    ));

    const groupIgnored = await sendMock(headers, {
      eventId: 'phase2p_group_ignore',
      channel: 'group',
      groupId: 'phase2p-group',
      senderId: 'phase2p-unknown',
      messageText: 'Cao To la ai?'
    });
    results.push(result(
      'zalo-bot-group-no-command-ignored',
      groupIgnored.response.status === 201 && groupIgnored.data.event?.status === 'ignored' && !groupIgnored.data.reply,
      JSON.stringify({ event: groupIgnored.data.event, reply: groupIgnored.data.reply })
    ));

    const groupReply = await sendMock(headers, {
      eventId: 'phase2p_group_reply',
      channel: 'group',
      groupId: 'phase2p-group',
      senderId: 'phase2p-unknown',
      messageText: '/giapha Cao To la ai?'
    });
    results.push(result(
      'zalo-bot-group-command-replies',
      groupReply.response.status === 201 && groupReply.data.reply?.replyText && groupReply.data.event?.status === 'replied',
      String(groupReply.data.reply?.replyText || '').slice(0, 180)
    ));

    const kycBlocked = await sendMock(headers, {
      eventId: 'phase2p_kyc_block',
      channel: 'personal',
      senderId: 'phase2p-unknown',
      messageText: 'que quan Cao Van Moi o dau?'
    });
    results.push(result(
      'zalo-bot-non-kyc-private-detail-blocked',
      kycBlocked.response.status === 201 && /KYC|dang nhap|đăng nhập|chi tiet|chi tiết/i.test(String(kycBlocked.data.reply?.replyText || '')),
      String(kycBlocked.data.reply?.replyText || '').slice(0, 180)
    ));

    const logs = await fetchJson('/api/zalo-bot/events?limit=20', { headers: { Cookie: admin.cookie } });
    const replies = await fetchJson('/api/zalo-bot/replies?limit=20', { headers: { Cookie: admin.cookie } });
    results.push(result(
      'zalo-bot-event-reply-logs',
      logs.response.ok
        && replies.response.ok
        && Array.isArray(logs.data.events)
        && Array.isArray(replies.data.replies)
        && logs.data.events.some((item) => item.eventId === 'phase2p_cao_to')
        && replies.data.replies.some((item) => item.transport === 'zalo_mock'),
      `events ${logs.data.events?.length || 0}, replies ${replies.data.replies?.length || 0}`
    ));

    const text = JSON.stringify({ logs: logs.data, replies: replies.data, status: status.data });
    results.push(result('zalo-bot-no-secret-leak', !/ZALO_OA_ACCESS_TOKEN|ZALO_WEBHOOK_SECRET|phase2o-test-token|access_token|AIza|GOCSPX/i.test(text), `chars ${text.length}`));
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
