import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const webhookSecret = process.env.ZALO_WEBHOOK_SECRET || 'phase2q-secret';
const verifyToken = process.env.ZALO_WEBHOOK_VERIFY_TOKEN || 'phase2q-verify';

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
  const token = `phase2q_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2q-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2q-admin',
    account: 'phase2q-admin',
    name: 'Phase 2Q Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2q-admin',
      fullName: 'Phase 2Q Admin',
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
      cleanupDb.prepare("DELETE FROM zalo_bot_replies WHERE event_id IN (SELECT id FROM zalo_bot_events WHERE event_id LIKE 'phase2q_%')").run();
      cleanupDb.prepare("DELETE FROM zalo_bot_events WHERE event_id LIKE 'phase2q_%'").run();
      cleanupDb.close();
    }
  };
}

async function fetchText(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, text: await response.text() };
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

function signatureFor(body) {
  return `sha256=${crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body)).digest('hex')}`;
}

async function postWebhook(body, { signed = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (signed) headers['x-zalo-signature'] = signatureFor(body);
  return fetchJson('/api/zalo/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function main() {
  const results = [];
  const admin = installTempAdminSession();
  const adminHeaders = { Cookie: admin.cookie };

  try {
    const verify = await fetchText(`/api/zalo/webhook?hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=phase2q-ok`);
    results.push(result('zalo-webhook-verify-challenge', verify.response.ok && verify.text === 'phase2q-ok', `HTTP ${verify.response.status}: ${verify.text}`));

    const publicStatus = await fetchJson('/api/zalo-bot/webhook-status');
    results.push(result('zalo-webhook-status-public-403', publicStatus.response.status === 403, `HTTP ${publicStatus.response.status}`));

    const missingSignature = await postWebhook({
      eventId: 'phase2q_missing_signature',
      eventName: 'user_send_text',
      senderId: 'phase2q-user',
      messageText: 'Cao To la ai?'
    }, { signed: false });
    results.push(result('zalo-webhook-missing-signature-rejected', missingSignature.response.status === 401, `HTTP ${missingSignature.response.status}`));

    const personal = await postWebhook({
      eventId: 'phase2q_personal_cao_to',
      eventName: 'user_send_text',
      senderId: 'phase2q-user',
      senderName: 'Phase 2Q User',
      recipientId: 'phase2q-oa',
      appId: 'phase2q-app',
      oaId: 'phase2q-oa',
      timestamp: '2026-05-31T00:00:00.000Z',
      messageText: 'Cao To la ai?'
    });
    results.push(result(
      'zalo-webhook-personal-mock-reply',
      personal.response.ok
        && personal.data.event?.signatureStatus === 'verified'
        && personal.data.event?.status === 'replied'
        && personal.data.reply?.status === 'mock_ready'
        && /Cao Dinh Thuat|Cao Đình Thuật|Cao To|Cao Tổ|Cao Tá»•/i.test(String(personal.data.reply?.replyText || '')),
      String(personal.data.reply?.replyText || personal.data.error || '').slice(0, 180)
    ));

    const duplicate = await postWebhook({
      eventId: 'phase2q_personal_cao_to',
      eventName: 'user_send_text',
      senderId: 'phase2q-user',
      messageText: 'Cao To la ai?'
    });
    results.push(result(
      'zalo-webhook-duplicate-ignored',
      duplicate.response.ok && duplicate.data.duplicate === true && duplicate.data.event?.status === 'ignored' && duplicate.data.event?.error === 'duplicate_event' && !duplicate.data.reply,
      JSON.stringify(duplicate.data.event || {})
    ));

    const groupIgnored = await postWebhook({
      eventId: 'phase2q_group_ignore',
      eventName: 'user_send_text',
      senderId: 'phase2q-user',
      groupId: 'phase2q-group',
      messageText: 'Cao To la ai?'
    });
    results.push(result(
      'zalo-webhook-group-no-command-ignored',
      groupIgnored.response.ok && groupIgnored.data.event?.status === 'ignored' && groupIgnored.data.event?.error === 'group_without_command_or_mention' && !groupIgnored.data.reply,
      JSON.stringify(groupIgnored.data.event || {})
    ));

    const groupReply = await postWebhook({
      eventId: 'phase2q_group_reply',
      eventName: 'user_send_text',
      senderId: 'phase2q-user',
      groupId: 'phase2q-group',
      messageText: '/giapha Cao To la ai?'
    });
    results.push(result(
      'zalo-webhook-group-command-replies',
      groupReply.response.ok && groupReply.data.event?.status === 'replied' && groupReply.data.reply?.status === 'mock_ready',
      String(groupReply.data.reply?.replyText || '').slice(0, 180)
    ));

    const follow = await postWebhook({
      eventId: 'phase2q_follow',
      eventName: 'follow',
      senderId: 'phase2q-user'
    });
    results.push(result(
      'zalo-webhook-follow-log-no-reply',
      follow.response.ok && follow.data.event?.status === 'ignored' && follow.data.event?.eventType === 'follow' && !follow.data.reply,
      JSON.stringify(follow.data.event || {})
    ));

    const status = await fetchJson('/api/zalo-bot/webhook-status', { headers: adminHeaders });
    results.push(result(
      'zalo-webhook-status-admin-counts',
      status.response.ok
        && status.data.webhookEnabled === true
        && status.data.signatureVerifiedCount >= 4
        && status.data.rejectedCount >= 1
        && status.data.duplicateCount >= 1
        && status.data.canReplyReal === false,
      JSON.stringify(status.data)
    ));

    const events = await fetchJson('/api/zalo-bot/events?limit=20', { headers: adminHeaders });
    const personalEvent = events.data.events?.find((event) => event.eventId === 'phase2q_personal_cao_to' && event.status === 'replied')
      || events.data.events?.find((event) => event.eventId === 'phase2q_personal_cao_to');
    const replay = personalEvent
      ? await fetchJson(`/api/zalo-bot/replay-event/${encodeURIComponent(personalEvent.id)}`, { method: 'POST', headers: adminHeaders })
      : { response: { status: 0, ok: false }, data: {} };
    results.push(result(
      'zalo-webhook-replay-mock-only',
      replay.response.status === 201 && replay.data.reply?.transport === 'zalo_mock' && replay.data.reply?.status === 'mock_ready',
      JSON.stringify(replay.data.reply || replay.data)
    ));

    const reviewed = personalEvent
      ? await fetchJson(`/api/zalo-bot/events/${encodeURIComponent(personalEvent.id)}/mark-reviewed`, { method: 'PATCH', headers: adminHeaders })
      : { response: { status: 0, ok: false }, data: {} };
    results.push(result(
      'zalo-webhook-mark-reviewed',
      reviewed.response.ok && Boolean(reviewed.data.event?.reviewedAt),
      JSON.stringify(reviewed.data.event || reviewed.data)
    ));

    const logs = await fetchJson('/api/zalo-bot/replies?limit=20', { headers: adminHeaders });
    const text = JSON.stringify({ status: status.data, events: events.data, replies: logs.data });
    results.push(result('zalo-webhook-no-secret-leak', !/phase2q-secret|ZALO_WEBHOOK_SECRET|ZALO_OA_ACCESS_TOKEN|access_token|refresh_token/i.test(text), `chars ${text.length}`));
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
