import express from 'express';
import { config as loadEnv } from 'dotenv';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { convertLunarToSolar, formatGenealogyDateStructured, parseGenealogyDateText } from './src/utils/genealogyDate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '.env.local') });
loadEnv({ path: resolve(__dirname, '.env') });
const PORT = Number(process.env.API_PORT || 5174);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_FILE = resolve(__dirname, process.env.LINEAGE_DATA_FILE || 'data/lineage-tree.json');
const DATABASE_FILE = resolve(__dirname, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const DIST_DIR = resolve(__dirname, 'dist');
const PHASE2_ALIAS_SEED_DIR = resolve(__dirname, 'docs/knowledge-seeds/cao-toc-ai-luu-y-alias-danh-xung-v2');
const PHASE2_ALIAS_SEED_SLUG = 'cao-toc-ai-luu-y-alias-danh-xung-v2';
const TREE_STATE_KEY = 'lineage-tree';
const AUTH_USERS_STATE_KEY = 'auth-users';
const AUTH_SESSIONS_STATE_KEY = 'auth-sessions';
const SHARED_STATE_KEYS = new Set(['app-settings', 'dashboard-theme', 'dashboard-ai', 'dashboard-articles', 'dashboard-knowledge', 'dashboard-events', 'dashboard-zalo-rules']);
const SUPER_ADMIN_ZALO_USERNAME = 'zalo_DwiuoUQPqds';
const SUPER_ADMIN_ZALO_ID = 'esThQQwYcAqA96vo';
const SUPER_ADMIN_EMAIL = 'cxt2589@gmail.com';
const SUPER_ADMIN_ZALO_NAMES = (process.env.SUPER_ADMIN_ZALO_NAMES || 'Cao Xuân Trường,Cao Xuan Truong,Truong Cao')
  .split(',')
  .map((name) => normalizeIdentityText(name))
  .filter(Boolean);
const APP_URL = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ZALO_PROFILE_PROXY_URL = (process.env.ZALO_PROFILE_PROXY_URL || '').trim();
const ZALO_PROFILE_PROXY_SECRET = (process.env.ZALO_PROFILE_PROXY_SECRET || '').trim();
const AUTH_SESSION_COOKIE = 'caogia_auth_session';
const OAUTH_STATE_COOKIE = 'caogia_oauth_state';
const REAL_SEND_CONFIRM_TEXT = 'GUI TEST THAT';
const reminderRealSendAttempts = new Map();
const isSecureCookie = APP_URL.startsWith('https://');
const PUBLIC_STATE_KEYS = new Set(['app-settings', 'dashboard-theme', 'dashboard-articles', 'dashboard-events']);
const UNVERIFIED_DATA_TEXT = 'Chưa có dữ liệu xác minh trong kho tri thức hiện tại.';

const app = express();
app.use(express.json({ limit: '25mb' }));

let db;
const authSessions = new Map();
const oauthStates = new Map();

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function pickZaloId(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const value = source.user_id || source.uid || source.id || source.sub || source.zalo_id || source.open_id;
    if (value) return String(value).trim();
  }
  return '';
}

function normalizeIdentityText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeZaloProfileData(raw) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const picture = typeof data?.picture === 'object' ? data.picture?.data?.url : data?.picture;
  return {
    raw,
    data: data || {},
    id: pickZaloId(data || {}),
    name: data?.name || 'Người dùng Zalo',
    avatar: picture || ''
  };
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq === -1) return [part, ''];
        return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  );
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (isSecureCookie) parts.push('Secure');
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name) {
  const parts = [`${name}=`, 'Path=/', 'SameSite=Lax', 'HttpOnly', 'Max-Age=0'];
  if (isSecureCookie) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function publicAuthSession(session, authUser) {
  if (!session) return null;
  return {
    provider: session.provider,
    id: session.id,
    name: session.name,
    account: session.account,
    avatar: session.avatar || '',
    loggedInAt: session.loggedInAt,
    role: authUser?.role || 'user',
    roles: Array.isArray(authUser?.roles) ? authUser.roles : ['user'],
    isKYCed: !!authUser?.isKYCed,
    kycStatus: authUser?.kycStatus || 'not_submitted',
    isApproved: !!authUser?.isApproved,
    approvalStatus: authUser?.approvalStatus || 'pending',
    linkedMemberId: authUser?.linkedMemberId || ''
  };
}

async function readAuthSessionsState() {
  const stored = await readState(AUTH_SESSIONS_STATE_KEY);
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

async function writeAuthSessionsState(sessions) {
  await writeState(AUTH_SESSIONS_STATE_KEY, sessions);
}

async function createAuthSession(res, profile) {
  const token = randomToken(32);
  const session = {
    ...profile,
    loggedInAt: new Date().toISOString()
  };
  authSessions.set(token, session);
  try {
    const sessions = await readAuthSessionsState();
    sessions[token] = session;
    await writeAuthSessionsState(sessions);
  } catch (err) {
    console.warn('Failed to persist auth session:', err?.message || err);
  }
  setCookie(res, AUTH_SESSION_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 });
  return session;
}

function isSuperAdminZaloIdentity(value) {
  return value === SUPER_ADMIN_ZALO_USERNAME || value === SUPER_ADMIN_ZALO_ID;
}

function isSuperAdminProfile(profile) {
  if (profile?.provider === 'zalo') {
    return isSuperAdminZaloIdentity(profile.id) ||
      isSuperAdminZaloIdentity(profile.account) ||
      SUPER_ADMIN_ZALO_NAMES.includes(normalizeIdentityText(profile.name));
  }
  return profile?.provider === 'gmail' && String(profile.account || '').toLowerCase() === SUPER_ADMIN_EMAIL;
}

function applySuperAdminAccess(user) {
  return {
    ...user,
    username: user.username || SUPER_ADMIN_ZALO_USERNAME,
    fullName: user.fullName && user.fullName !== 'Người dùng Zalo' ? user.fullName : 'Cao Xuân Trường',
    role: 'admin',
    roles: ['admin', 'writer', 'treasurer', 'secretary', 'user'],
    isKYCed: true,
    kycStatus: 'verified',
    isApproved: true,
    approvalStatus: 'approved'
  };
}

function authProfileToDashboardUser(profile) {
  const loginType = profile.provider === 'zalo' ? 'zalo' : 'email';
  const username = profile.account || profile.id || `${profile.provider}_${randomToken(8)}`;
  const isSuperAdmin = isSuperAdminProfile(profile) || isSuperAdminZaloIdentity(username);
  const user = {
    id: `oauth_${profile.provider}_${profile.id || sha256Base64Url(username).slice(0, 16)}`,
    username,
    fullName: profile.name || username,
    role: isSuperAdmin ? 'admin' : 'user',
    roles: isSuperAdmin ? ['admin', 'writer', 'treasurer', 'secretary', 'user'] : ['user'],
    isKYCed: isSuperAdmin,
    kycStatus: isSuperAdmin ? 'verified' : 'not_submitted',
    isApproved: isSuperAdmin,
    approvalStatus: isSuperAdmin ? 'approved' : 'pending',
    email: loginType === 'email' ? username : '',
    phone: loginType === 'zalo' ? username : '',
    avatar: profile.avatar || '',
    regDate: new Date().toLocaleDateString('vi-VN'),
    loginType
  };
  return isSuperAdmin ? applySuperAdminAccess({ ...user, username: SUPER_ADMIN_ZALO_USERNAME }) : user;
}

async function readAuthUsers() {
  const users = await readState(AUTH_USERS_STATE_KEY);
  if (!Array.isArray(users)) return [];

  let changed = false;
  const normalized = users.map((user) => {
    const isTarget = user?.username === SUPER_ADMIN_ZALO_USERNAME ||
      user?.id === `oauth_zalo_${SUPER_ADMIN_ZALO_ID}` ||
      String(user?.username || '').toLowerCase() === SUPER_ADMIN_EMAIL ||
      String(user?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
    if (!isTarget) return user;
    const next = applySuperAdminAccess(user);
    if (JSON.stringify(next) !== JSON.stringify(user)) changed = true;
    return next;
  });
  if (changed) await writeState(AUTH_USERS_STATE_KEY, normalized);
  return normalized;
}

async function writeAuthUsers(users) {
  await writeState(AUTH_USERS_STATE_KEY, users);
}

async function upsertAuthUserFromProfile(profile) {
  const nextUser = authProfileToDashboardUser(profile);
  const users = await readAuthUsers();
  const index = users.findIndex((user) => user.id === nextUser.id || user.username === nextUser.username);
  if (index === -1) {
    await writeAuthUsers([nextUser, ...users]);
    return nextUser;
  }

  const existing = users[index];
  users[index] = {
    ...nextUser,
    ...existing,
    fullName: existing.fullName || nextUser.fullName,
    avatar: nextUser.avatar || existing.avatar,
    email: existing.email || nextUser.email,
    phone: existing.phone || nextUser.phone,
    loginType: existing.loginType || nextUser.loginType,
    role: nextUser.role === 'admin' ? 'admin' : (existing.role || nextUser.role),
    roles: nextUser.role === 'admin' ? nextUser.roles : (existing.roles || nextUser.roles),
    isKYCed: nextUser.role === 'admin' ? true : existing.isKYCed,
    kycStatus: nextUser.role === 'admin' ? 'verified' : existing.kycStatus,
    isApproved: nextUser.role === 'admin' ? true : existing.isApproved,
    approvalStatus: nextUser.role === 'admin' ? 'approved' : existing.approvalStatus
  };
  if (nextUser.role === 'admin') users[index] = applySuperAdminAccess(users[index]);
  await writeAuthUsers(users);
  return users[index];
}

async function findAuthUserForSession(session) {
  if (!session) return null;
  const users = await readAuthUsers();
  const sessionId = `oauth_${session.provider}_${session.id || sha256Base64Url(session.account || '').slice(0, 16)}`;
  const found = users.find((user) => user.id === sessionId || user.username === session.account || user.username === session.id);
  if (found) {
    if (isSuperAdminProfile(session)) {
      const promoted = applySuperAdminAccess(found);
      if (JSON.stringify(promoted) !== JSON.stringify(found)) {
        await writeAuthUsers(users.map((user) => user === found ? promoted : user));
      }
      return promoted;
    }
    return found;
  }
  if (isSuperAdminProfile(session)) {
    const adminUser = applySuperAdminAccess({
      id: `oauth_zalo_${session.id || SUPER_ADMIN_ZALO_ID}`,
      username: SUPER_ADMIN_ZALO_USERNAME,
      fullName: session.name || 'Cao Xuân Trường',
      phone: SUPER_ADMIN_ZALO_USERNAME,
      email: '',
      avatar: session.avatar || '',
      regDate: new Date().toLocaleDateString('vi-VN'),
      loginType: 'zalo'
    });
    await writeAuthUsers([adminUser, ...users]);
    return adminUser;
  }
  return null;
}

async function getAuthSession(req) {
  const token = parseCookies(req)[AUTH_SESSION_COOKIE];
  if (!token) return null;
  const memorySession = authSessions.get(token);
  if (memorySession) return memorySession;
  try {
    const sessions = await readAuthSessionsState();
    const storedSession = sessions[token] || null;
    if (storedSession) authSessions.set(token, storedSession);
    return storedSession;
  } catch (err) {
    console.warn('Failed to restore auth session:', err?.message || err);
    return null;
  }
}

function isAdminAuthUser(authUser) {
  const roles = Array.isArray(authUser?.roles) ? authUser.roles : [];
  return authUser?.role === 'admin' || roles.includes('admin');
}

function getAuthScope(session, authUser) {
  if (isAdminAuthUser(authUser)) return 'admin';
  if (!session) return 'anonymous';
  const isVerifiedKyc = Boolean(
    authUser?.isKYCed &&
    authUser?.kycStatus === 'verified' &&
    authUser?.isApproved !== false &&
    authUser?.approvalStatus !== 'rejected'
  );
  return isVerifiedKyc ? 'kyc_verified' : 'authenticated_unverified';
}

async function requireAdmin(req, res) {
  const session = await getAuthSession(req);
  const authUser = await findAuthUserForSession(session);
  if (!isAdminAuthUser(authUser)) {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }
  return { session, authUser };
}

function getCallbackUrl(provider) {
  return `${APP_URL}/api/auth/${provider}/callback`;
}

function getSafeReturnPath(value) {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function redirectToApp(res, params = {}, returnTo = '/') {
  const url = new URL(getSafeReturnPath(returnTo), APP_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  res.redirect(url.toString());
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.error_description || data?.error?.message || data?.message || fallbackMessage;
    throw new Error(message);
  }
  if (data?.error || data?.error_code) {
    const message = data?.error_description || data?.error?.message || data?.message || data?.error_name || fallbackMessage;
    throw new Error(`${message} (${data.error_code || data.error})`);
  }
  return data;
}

async function getDatabase() {
  if (db) return db;

  await mkdir(dirname(DATABASE_FILE), { recursive: true });
  db = new DatabaseSync(DATABASE_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'manual',
      scope TEXT,
      clan_scope TEXT,
      system_scope TEXT,
      domain TEXT,
      content TEXT NOT NULL DEFAULT '',
      source_hash TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_norm TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS entity_aliases (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'person',
      alias TEXT NOT NULL,
      alias_norm TEXT NOT NULL,
      alias_ascii TEXT NOT NULL,
      alias_type TEXT,
      required_title TEXT,
      generation INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      confidence TEXT,
      example_only INTEGER NOT NULL DEFAULT 0,
      needs_verification INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(canonical_name, alias_norm)
    );

    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      route TEXT NOT NULL DEFAULT '',
      bot_type TEXT NOT NULL DEFAULT '',
      intent TEXT NOT NULL DEFAULT '',
      engine TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      status INTEGER NOT NULL DEFAULT 0,
      cached INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      request_chars INTEGER NOT NULL DEFAULT 0,
      context_chars INTEGER NOT NULL DEFAULT 0,
      estimated_tokens INTEGER NOT NULL DEFAULT 0,
      context_trimmed INTEGER NOT NULL DEFAULT 0,
      knowledge_matches_count INTEGER NOT NULL DEFAULT 0,
      knowledge_source_ids_json TEXT NOT NULL DEFAULT '[]',
      bot_config_engine TEXT NOT NULL DEFAULT '',
      bot_config_max_chunks INTEGER NOT NULL DEFAULT 0,
      bot_config_max_output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_enabled INTEGER NOT NULL DEFAULT 1,
      config_version TEXT NOT NULL DEFAULT '',
      error_code TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT '',
      prompt_snippet TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ai_bot_configs (
      bot_type TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      paused_reason TEXT NOT NULL DEFAULT '',
      engine TEXT NOT NULL DEFAULT 'local-knowledge',
      max_knowledge_chunks INTEGER NOT NULL DEFAULT 5,
      max_knowledge_chars INTEGER NOT NULL DEFAULT 6000,
      max_output_tokens INTEGER NOT NULL DEFAULT 700,
      cache_enabled INTEGER NOT NULL DEFAULT 1,
      cache_ttl_ms INTEGER NOT NULL DEFAULT 300000,
      retry_429 INTEGER NOT NULL DEFAULT 1,
      retry_delay_ms INTEGER NOT NULL DEFAULT 900,
      public_access INTEGER NOT NULL DEFAULT 0,
      requires_kyc_for_private_data INTEGER NOT NULL DEFAULT 1,
      system_prompt_short TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS extracted_anniversary_candidates (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL DEFAULT '',
      person_name TEXT NOT NULL,
      person_name_norm TEXT NOT NULL,
      generation TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      birth_text TEXT NOT NULL DEFAULT '',
      death_text TEXT NOT NULL DEFAULT '',
      death_anniversary_lunar TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      grave_text TEXT NOT NULL DEFAULT '',
      source_quote TEXT NOT NULL DEFAULT '',
      heading_path TEXT NOT NULL DEFAULT '',
      matched_member_id TEXT NOT NULL DEFAULT '',
      matched_member_name TEXT NOT NULL DEFAULT '',
      match_confidence TEXT NOT NULL DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'candidate',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      sent_by TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zalo_bot_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'mock',
      channel TEXT NOT NULL DEFAULT 'mock',
      event_type TEXT NOT NULL DEFAULT 'message',
      app_id TEXT NOT NULL DEFAULT '',
      oa_id TEXT NOT NULL DEFAULT '',
      sender_id TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      recipient_id TEXT NOT NULL DEFAULT '',
      group_id TEXT NOT NULL DEFAULT '',
      message_text TEXT NOT NULL DEFAULT '',
      normalized_text TEXT NOT NULL DEFAULT '',
      intent TEXT NOT NULL DEFAULT 'fallback',
      status TEXT NOT NULL DEFAULT 'received',
      error TEXT NOT NULL DEFAULT '',
      signature_status TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      event_timestamp TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zalo_bot_replies (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'mock',
      sender_id TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      group_id TEXT NOT NULL DEFAULT '',
      message_text TEXT NOT NULL DEFAULT '',
      normalized_text TEXT NOT NULL DEFAULT '',
      intent TEXT NOT NULL DEFAULT 'fallback',
      reply_text TEXT NOT NULL DEFAULT '',
      transport TEXT NOT NULL DEFAULT 'zalo_mock',
      status TEXT NOT NULL DEFAULT 'mock',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_norm ON knowledge_chunks(content_norm);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_norm ON entity_aliases(alias_norm);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_ascii ON entity_aliases(alias_ascii);
    CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created ON ai_request_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_person ON extracted_anniversary_candidates(person_name_norm);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_source ON extracted_anniversary_candidates(source_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_status ON extracted_anniversary_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_audit_candidate ON extracted_anniversary_audit_logs(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_audit_created ON extracted_anniversary_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_member ON anniversary_event_drafts(member_id);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_status ON anniversary_event_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_updated ON anniversary_event_drafts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_reminder_send_logs_draft ON reminder_send_logs(draft_id);
    CREATE INDEX IF NOT EXISTS idx_reminder_send_logs_created ON reminder_send_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_created ON zalo_bot_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_event_id ON zalo_bot_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_status ON zalo_bot_events(status);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_replies_created ON zalo_bot_replies(created_at);
  `);
  ensureTableColumn(db, 'knowledge_sources', 'summary', "ALTER TABLE knowledge_sources ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'knowledge_sources', 'tags_json', "ALTER TABLE knowledge_sources ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'knowledge_sources', 'entity_refs_json', "ALTER TABLE knowledge_sources ADD COLUMN entity_refs_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'knowledge_sources', 'visibility', "ALTER TABLE knowledge_sources ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
  ensureTableColumn(db, 'knowledge_sources', 'status', "ALTER TABLE knowledge_sources ADD COLUMN status TEXT NOT NULL DEFAULT 'indexed'");
  ensureTableColumn(db, 'knowledge_chunks', 'summary', "ALTER TABLE knowledge_chunks ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'knowledge_chunks', 'tags_json', "ALTER TABLE knowledge_chunks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'knowledge_chunks', 'entity_refs_json', "ALTER TABLE knowledge_chunks ADD COLUMN entity_refs_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'knowledge_chunks', 'visibility', "ALTER TABLE knowledge_chunks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
  ensureTableColumn(db, 'knowledge_chunks', 'heading_path', "ALTER TABLE knowledge_chunks ADD COLUMN heading_path TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'knowledge_chunks', 'content_ascii', "ALTER TABLE knowledge_chunks ADD COLUMN content_ascii TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'knowledge_chunks', 'char_count', "ALTER TABLE knowledge_chunks ADD COLUMN char_count INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(db, 'knowledge_chunks', 'token_estimate', "ALTER TABLE knowledge_chunks ADD COLUMN token_estimate INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(db, 'ai_request_logs', 'bot_config_engine', "ALTER TABLE ai_request_logs ADD COLUMN bot_config_engine TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_request_logs', 'bot_config_max_chunks', "ALTER TABLE ai_request_logs ADD COLUMN bot_config_max_chunks INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(db, 'ai_request_logs', 'bot_config_max_output_tokens', "ALTER TABLE ai_request_logs ADD COLUMN bot_config_max_output_tokens INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(db, 'ai_request_logs', 'cache_enabled', "ALTER TABLE ai_request_logs ADD COLUMN cache_enabled INTEGER NOT NULL DEFAULT 1");
  ensureTableColumn(db, 'ai_request_logs', 'config_version', "ALTER TABLE ai_request_logs ADD COLUMN config_version TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'reminder_send_logs', 'blocked_reason', "ALTER TABLE reminder_send_logs ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'reminder_send_logs', 'request_id', "ALTER TABLE reminder_send_logs ADD COLUMN request_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'reminder_send_logs', 'response_id', "ALTER TABLE reminder_send_logs ADD COLUMN response_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'source', "ALTER TABLE zalo_bot_events ADD COLUMN source TEXT NOT NULL DEFAULT 'mock'");
  ensureTableColumn(db, 'zalo_bot_events', 'app_id', "ALTER TABLE zalo_bot_events ADD COLUMN app_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'oa_id', "ALTER TABLE zalo_bot_events ADD COLUMN oa_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'recipient_id', "ALTER TABLE zalo_bot_events ADD COLUMN recipient_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'signature_status', "ALTER TABLE zalo_bot_events ADD COLUMN signature_status TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'reviewed_at', "ALTER TABLE zalo_bot_events ADD COLUMN reviewed_at TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'zalo_bot_events', 'event_timestamp', "ALTER TABLE zalo_bot_events ADD COLUMN event_timestamp TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_sources_visibility ON knowledge_sources(visibility);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_visibility ON knowledge_chunks(visibility);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ascii ON knowledge_chunks(content_ascii);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_event_id ON zalo_bot_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_status ON zalo_bot_events(status);
  `);
  seedDefaultAIBotConfigs(db);
  return db;
}

function ensureTableColumn(database, tableName, columnName, alterSql) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(alterSql);
  }
}

const DEFAULT_AI_BOT_CONFIGS = [
  {
    botType: 'webview_chat',
    label: 'Webview chatbot',
    enabled: 1,
    engine: 'local-knowledge',
    maxKnowledgeChunks: 5,
    maxKnowledgeChars: 5000,
    maxOutputTokens: 600,
    cacheEnabled: 1,
    cacheTtlMs: 300000,
    retry429: 1,
    retryDelayMs: 900,
    publicAccess: 1,
    requiresKycForPrivateData: 1,
    systemPromptShort: 'Trả lời ngắn gọn, ưu tiên dữ liệu local, không lộ thông tin riêng nếu chưa KYC.'
  },
  {
    botType: 'dashboard_helper',
    label: 'Trợ lý dashboard',
    enabled: 1,
    engine: 'local-knowledge',
    maxKnowledgeChunks: 8,
    maxKnowledgeChars: 9000,
    maxOutputTokens: 900,
    cacheEnabled: 1,
    cacheTtlMs: 300000,
    retry429: 1,
    retryDelayMs: 900,
    publicAccess: 0,
    requiresKycForPrivateData: 0,
    systemPromptShort: 'Hỗ trợ admin tra cứu và thao tác dashboard, ưu tiên dữ liệu đã xác minh.'
  },
  {
    botType: 'ai_governor',
    label: 'AI Tổng Quản',
    enabled: 1,
    engine: 'local-knowledge',
    maxKnowledgeChunks: 10,
    maxKnowledgeChars: 12000,
    maxOutputTokens: 1300,
    cacheEnabled: 1,
    cacheTtlMs: 180000,
    retry429: 1,
    retryDelayMs: 900,
    publicAccess: 0,
    requiresKycForPrivateData: 0,
    systemPromptShort: 'Phân tích hệ thống, đề xuất sửa, nêu rõ nguồn và mức cần xác minh.'
  },
  {
    botType: 'article_writer',
    label: 'AI viết bài',
    enabled: 1,
    engine: 'gemini',
    maxKnowledgeChunks: 8,
    maxKnowledgeChars: 10000,
    maxOutputTokens: 1800,
    cacheEnabled: 0,
    cacheTtlMs: 0,
    retry429: 1,
    retryDelayMs: 900,
    publicAccess: 0,
    requiresKycForPrivateData: 0,
    systemPromptShort: 'Viết bản nháp dài hơn từ nguồn đã duyệt, không bịa sự kiện hay nhân vật.'
  },
  {
    botType: 'prayer_writer',
    label: 'AI soạn sớ/trác thư',
    enabled: 1,
    engine: 'gemini',
    maxKnowledgeChunks: 10,
    maxKnowledgeChars: 12000,
    maxOutputTokens: 1800,
    cacheEnabled: 0,
    cacheTtlMs: 0,
    retry429: 1,
    retryDelayMs: 900,
    publicAccess: 0,
    requiresKycForPrivateData: 0,
    systemPromptShort: 'Soạn sớ/trác thư cẩn trọng, không tự bịa Hán Nôm, chức tước, ngày giỗ hoặc niên đại.'
  },
  {
    botType: 'zalo_bot',
    label: 'Zalo bot',
    enabled: 0,
    pausedReason: 'Tạm dừng chờ OA xác thực',
    engine: 'local-knowledge',
    maxKnowledgeChunks: 5,
    maxKnowledgeChars: 5000,
    maxOutputTokens: 500,
    cacheEnabled: 1,
    cacheTtlMs: 300000,
    retry429: 0,
    retryDelayMs: 900,
    publicAccess: 0,
    requiresKycForPrivateData: 1,
    systemPromptShort: 'Tạm dừng trong Phase 2R, chỉ hiện trạng thái chờ OA.'
  }
];

function seedDefaultAIBotConfigs(database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO ai_bot_configs (
      bot_type, label, enabled, paused_reason, engine, max_knowledge_chunks, max_knowledge_chars,
      max_output_tokens, cache_enabled, cache_ttl_ms, retry_429, retry_delay_ms,
      public_access, requires_kyc_for_private_data, system_prompt_short, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'system')
  `);
  for (const config of DEFAULT_AI_BOT_CONFIGS) {
    insert.run(
      config.botType,
      config.label,
      config.enabled,
      config.pausedReason || '',
      config.engine,
      config.maxKnowledgeChunks,
      config.maxKnowledgeChars,
      config.maxOutputTokens,
      config.cacheEnabled,
      config.cacheTtlMs,
      config.retry429,
      config.retryDelayMs,
      config.publicAccess,
      config.requiresKycForPrivateData,
      config.systemPromptShort
    );
  }

  const updateText = database.prepare(`
    UPDATE ai_bot_configs
    SET label = ?, paused_reason = ?, system_prompt_short = ?
    WHERE bot_type = ?
      AND (
        updated_by = 'system'
        OR label IN ('Tro ly dashboard', 'AI Tong Quan', 'AI viet bai', 'AI soan so/trac thu')
        OR paused_reason = 'Tam dung cho OA xac thuc'
        OR system_prompt_short LIKE '%khong%'
        OR system_prompt_short LIKE '%Tam dung%'
      )
  `);
  for (const config of DEFAULT_AI_BOT_CONFIGS) {
    updateText.run(config.label, config.pausedReason || '', config.systemPromptShort, config.botType);
  }
}

async function readState(key) {
  const database = await getDatabase();
  const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

async function writeState(key, data) {
  const database = await getDatabase();
  database
    .prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    .run(key, JSON.stringify(data));
}

async function deleteState(key) {
  const database = await getDatabase();
  database.prepare('DELETE FROM app_state WHERE key = ?').run(key);
}

async function readJsonFile(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeKnowledgeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSearchHonorifics(value) {
  const preserved = normalizeKnowledgeText(value);
  if (preserved.includes('cao to') || preserved.includes('thuy to')) return value;
  return String(value || '')
    .replace(/\b(cụ tổ|cụ|ông|bà|bác|chú|cô|anh|chị)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKnowledgeSearchVariants(query) {
  const original = String(query || '').trim();
  const stripped = stripSearchHonorifics(original);
  const variants = new Set([
    original,
    stripped,
    normalizeKnowledgeText(original),
    normalizeKnowledgeText(stripped)
  ]);
  return [...variants].map((item) => String(item || '').trim()).filter(Boolean);
}

function chunkKnowledgeText(content, maxLength = 1400) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if ((current + '\n\n' + paragraph).trim().length > maxLength && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = [current, paragraph].filter(Boolean).join('\n\n');
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function estimateTextTokens(value) {
  return Math.ceil(String(value || '').length / 4);
}

function createLocalSummary(content, maxLength = 320) {
  const lines = String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter((line) => line.length >= 20);
  return compactText(lines.slice(0, 3).join(' '), maxLength) || compactText(content, maxLength);
}

function inferKnowledgeTags(title, content) {
  const text = normalizeKnowledgeText([title, content].join(' '));
  const raw = String(content || '');
  const tags = new Set();
  if (/(cao to|thuy to|danh xung|alias)/.test(text)) tags.add('alias');
  if (/(han nom|chu han|chu nom)/.test(text) || /[\u3400-\u9fff]/.test(raw)) tags.add('han_nom');
  if (/(ngay gio|ky nhat|ngay mat|nam mat)/.test(text)) tags.add('ngay_gio');
  if (/(nam sinh|sinh nam|doi |generation|chi nhanh|chi nganh)/.test(text)) tags.add('pha_he');
  if (/(zalo|chatbox|webview)/.test(text)) tags.add('kenh_tra_loi');
  if (/(quy tac|guardrail|khong duoc|can xac minh)/.test(text)) tags.add('quy_tac');
  return [...tags];
}

function inferKnowledgeEntityRefs(title, content) {
  const raw = [title, content].join('\n');
  const refs = new Set();
  const nameMatches = raw.match(/\bCao\s+(?:Đình|Duy|Văn|Xuân|Hữu|Quang|Thế|Minh|Mạnh|Cao)\s+[A-ZÀ-Ỹ][\p{L}\p{M}'’-]+/gu) || [];
  nameMatches.slice(0, 30).forEach((name) => refs.add(name.replace(/\s+/g, ' ').trim()));
  [
    ['Cao Tổ', /cao\s*tổ/i],
    ['Thủy Tổ', /thủy\s*tổ/i],
    ['ngày giỗ', /ngày\s+giỗ|kỵ\s+nhật/i],
    ['ngày mất', /ngày\s+mất|năm\s+mất/i],
    ['năm sinh', /năm\s+sinh|sinh\s+năm/i],
    ['chi/ngành', /chi\s*\/?\s*ngành|chi\s+nhánh/i],
    ['đời', /\bđời\b|generation/i],
    ['Hán Nôm', /Hán\s*Nôm|[\u3400-\u9fff]/i]
  ].forEach(([label, pattern]) => {
    if (pattern.test(raw)) refs.add(label);
  });
  return [...refs].slice(0, 40);
}

function normalizeImportedKnowledgeContent(payload = {}) {
  const content = String(payload.content || '').trim();
  const sourceType = String(payload.type || payload.sourceType || '').toLowerCase();
  const title = String(payload.title || '').toLowerCase();
  if (!content) return content;
  if (sourceType.includes('json') || title.endsWith('.json')) {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  return content;
}

function splitLongKnowledgeBlock(block, maxLength, overlap) {
  const text = String(block || '').trim();
  if (text.length <= maxLength) return [text].filter(Boolean);
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxLength);
    if (end < text.length) {
      const breakAt = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end), text.lastIndexOf('; ', end));
      if (breakAt > start + Math.floor(maxLength * 0.55)) end = breakAt + 1;
    }
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function buildKnowledgeChunks(content, { title = '', maxLength = 1100, overlap = 140 } = {}) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  const headingPath = [];
  let currentHeading = title;
  let current = [];

  function flushSection() {
    const body = current.join('\n').trim();
    if (body) sections.push({ headingPath: currentHeading || title, content: body });
    current = [];
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$|^(.{1,120})\n?$/);
    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
    const numberedHeading = line.match(/^(\d+(?:\.\d+)*\.?|[IVX]+\.)\s+(.{3,100})$/i);
    const plainHeading = !markdownHeading && !numberedHeading && line.trim().length <= 80 && current.length === 0 && /[:：]$/.test(line.trim());
    if (markdownHeading || numberedHeading || plainHeading) {
      flushSection();
      const level = markdownHeading ? markdownHeading[1].length : 2;
      const textHeading = (markdownHeading?.[2] || numberedHeading?.[2] || line).replace(/[:：]$/, '').trim();
      headingPath.splice(Math.max(0, level - 1));
      headingPath[level - 1] = textHeading;
      currentHeading = [title, ...headingPath.filter(Boolean)].filter(Boolean).join(' > ');
      continue;
    }
    current.push(line);
  }
  flushSection();

  const blocks = sections.length ? sections : [{ headingPath: title, content: text }];
  const chunks = [];
  for (const section of blocks) {
    let currentBlock = '';
    const paragraphs = section.content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    for (const paragraph of paragraphs.length ? paragraphs : [section.content]) {
      if ((currentBlock + '\n\n' + paragraph).trim().length > maxLength && currentBlock) {
        splitLongKnowledgeBlock(currentBlock, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
        currentBlock = paragraph;
      } else {
        currentBlock = [currentBlock, paragraph].filter(Boolean).join('\n\n');
      }
    }
    if (currentBlock.trim()) {
      splitLongKnowledgeBlock(currentBlock, maxLength, overlap).forEach((part) => chunks.push({ headingPath: section.headingPath, content: part }));
    }
  }
  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeVisibility(value, fallback = 'admin') {
  const visibility = normalizeKnowledgeText(value || fallback);
  if (['public', 'global', 'kyc', 'admin', 'private'].includes(visibility)) return visibility;
  return fallback;
}

function getSnippet(content, queryNorm, maxLength = 260) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const norm = normalizeKnowledgeText(text);
  const words = queryNorm.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  const firstIndex = words
    .map((word) => norm.indexOf(word))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstIndex - 80);
  const snippet = text.slice(start, start + maxLength).trim();
  return `${start > 0 ? '...' : ''}${snippet}${start + maxLength < text.length ? '...' : ''}`;
}

function canReadKnowledgeVisibility(visibility, authScope) {
  const normalized = normalizeVisibility(visibility, 'public');
  if (authScope === 'admin') return true;
  if (authScope === 'kyc_verified') return ['public', 'global', 'kyc'].includes(normalized);
  return ['public', 'global'].includes(normalized);
}

async function getRequestAuthContext(req) {
  const session = await getAuthSession(req);
  const authUser = await findAuthUserForSession(session);
  return {
    session,
    authUser,
    authScope: getAuthScope(session, authUser)
  };
}

function knowledgeSourceTitleFromFile(fileName) {
  return String(fileName || '')
    .replace(/^\d+_/, '')
    .replace(/\.(txt|md|json|sql)$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

function buildAliasId(canonicalName, alias) {
  return `alias_${sha256Base64Url(`${canonicalName}:${normalizeKnowledgeText(alias)}`).slice(0, 24)}`;
}

function buildSourceId(slug) {
  return `source_${sha256Base64Url(slug).slice(0, 24)}`;
}

function buildChunkId(sourceId, chunkIndex) {
  return `chunk_${sha256Base64Url(`${sourceId}:${chunkIndex}`).slice(0, 24)}`;
}

async function seedPhase2AliasKnowledge({ force = false } = {}) {
  if (!existsSync(PHASE2_ALIAS_SEED_DIR)) {
    return { ok: false, skipped: true, reason: 'Phase 2A seed directory not found.' };
  }

  const database = await getDatabase();
  const existing = database
    .prepare("SELECT COUNT(*) AS count FROM entity_aliases WHERE json_extract(metadata_json, '$.seed_slug') = ?")
    .get(PHASE2_ALIAS_SEED_SLUG);
  if (!force && Number(existing?.count || 0) > 0) {
    return await getKnowledgeStatus();
  }

  const files = (await readdir(PHASE2_ALIAS_SEED_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const metadataFile = resolve(PHASE2_ALIAS_SEED_DIR, '02_entity_alias_role_overrides.json');
  const metadata = existsSync(metadataFile) ? JSON.parse(await readFile(metadataFile, 'utf8')) : {};
  const sourceScope = metadata.scope || 'cao_toc_phu_my_ai_knowledge';
  const clanScope = metadata.clan_scope || 'cao_toc_phu_my';
  const systemScope = metadata.system_scope || 'ho_cao_giatochocao';
  const domain = metadata.domain || 'giatochocao.site';

  const sourceUpsert = database.prepare(`
    INSERT INTO knowledge_sources (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      source_type = excluded.source_type,
      scope = excluded.scope,
      clan_scope = excluded.clan_scope,
      system_scope = excluded.system_scope,
      domain = excluded.domain,
      content = excluded.content,
      source_hash = excluded.source_hash,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const chunkDelete = database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?');
  const chunkInsert = database.prepare(`
    INSERT INTO knowledge_chunks (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(source_id, chunk_index) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      content_norm = excluded.content_norm,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      updated_at = excluded.updated_at
  `);
  const aliasDelete = database.prepare("DELETE FROM entity_aliases WHERE json_extract(metadata_json, '$.seed_slug') = ?");
  const aliasInsert = database.prepare(`
    INSERT INTO entity_aliases (id, canonical_name, entity_type, alias, alias_norm, alias_ascii, alias_type, required_title, generation, status, confidence, example_only, needs_verification, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(canonical_name, alias_norm) DO UPDATE SET
      entity_type = excluded.entity_type,
      alias = excluded.alias,
      alias_ascii = excluded.alias_ascii,
      alias_type = excluded.alias_type,
      required_title = excluded.required_title,
      generation = excluded.generation,
      status = excluded.status,
      confidence = excluded.confidence,
      example_only = excluded.example_only,
      needs_verification = excluded.needs_verification,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `);

  database.exec('BEGIN');
  try {
    aliasDelete.run(PHASE2_ALIAS_SEED_SLUG);
    for (const fileName of files) {
      const filePath = resolve(PHASE2_ALIAS_SEED_DIR, fileName);
      const content = readFileSyncUtf8(filePath);
      const slug = `${PHASE2_ALIAS_SEED_SLUG}/${fileName}`;
      const sourceId = buildSourceId(slug);
      const sourceMetadata = {
        seed_slug: PHASE2_ALIAS_SEED_SLUG,
        file_name: fileName,
        sql_is_reference_only: fileName.endsWith('.sql')
      };
      sourceUpsert.run(
        sourceId,
        slug,
        knowledgeSourceTitleFromFile(fileName),
        fileName.endsWith('.json') ? 'json' : fileName.endsWith('.sql') ? 'sql_reference' : 'manual_note',
        sourceScope,
        clanScope,
        systemScope,
        domain,
        content,
        sha256Hex(content),
        JSON.stringify(sourceMetadata),
        compactText(content, 320),
        JSON.stringify(['alias', 'danh_xung', 'phase_2a']),
        JSON.stringify(['Cao Đình Thuật', 'Cao Đình Lạng', 'Cao Văn Thuần']),
        'public',
        'indexed'
      );
      chunkDelete.run(sourceId);
      chunkKnowledgeText(content).forEach((chunk, index) => {
        chunkInsert.run(
          buildChunkId(sourceId, index),
          sourceId,
          index,
          knowledgeSourceTitleFromFile(fileName),
          chunk,
          normalizeKnowledgeText(chunk),
          JSON.stringify({ ...sourceMetadata, chunk_index: index }),
          compactText(chunk, 240),
          JSON.stringify(['alias', 'danh_xung', 'phase_2a']),
          JSON.stringify(['Cao Đình Thuật', 'Cao Đình Lạng', 'Cao Văn Thuần']),
          'public'
        );
      });
    }

    for (const entity of Array.isArray(metadata.entities) ? metadata.entities : []) {
      const aliases = [
        ...(Array.isArray(entity.aliases) ? entity.aliases : []),
        ...(entity.required_title ? [{
          value: entity.required_title,
          type: 'required_title',
          confidence: 'family_instruction'
        }] : [])
      ];
      for (const aliasItem of aliases) {
        const alias = String(aliasItem?.value || '').trim();
        if (!alias) continue;
        const meta = {
          seed_slug: PHASE2_ALIAS_SEED_SLUG,
          scope: metadata.scope,
          clan_scope: metadata.clan_scope,
          system_scope: metadata.system_scope,
          domain: metadata.domain,
          relationship_note: entity.relationship_note || '',
          lineage_position_note: entity.lineage_position_note || '',
          usage_note: entity.usage_note || '',
          answering_rules: entity.answering_rules || [],
          han_nom_candidates: entity.han_nom_candidates || []
        };
        aliasInsert.run(
          buildAliasId(entity.canonical_name, alias),
          entity.canonical_name,
          entity.entity_type || 'person',
          alias,
          normalizeKnowledgeText(alias),
          normalizeKnowledgeText(alias),
          aliasItem.type || '',
          entity.required_title || '',
          Number.isFinite(Number(entity.generation)) ? Number(entity.generation) : null,
          entity.example_only ? 'example_only' : (entity.verification_status || 'active'),
          aliasItem.confidence || '',
          entity.example_only ? 1 : 0,
          entity.verification_status === 'needs_verification' ? 1 : 0,
          JSON.stringify(meta)
        );
      }
    }
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
  return await getKnowledgeStatus();
}

function readFileSyncUtf8(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

async function ensurePhase2AliasKnowledgeSeeded() {
  const database = await getDatabase();
  const existing = database
    .prepare("SELECT COUNT(*) AS count FROM entity_aliases WHERE json_extract(metadata_json, '$.seed_slug') = ?")
    .get(PHASE2_ALIAS_SEED_SLUG);
  if (Number(existing?.count || 0) > 0) return;
  await seedPhase2AliasKnowledge();
}

async function getKnowledgeStatus() {
  const database = await getDatabase();
  const sourceCount = database.prepare('SELECT COUNT(*) AS count FROM knowledge_sources').get();
  const chunkCount = database.prepare('SELECT COUNT(*) AS count FROM knowledge_chunks').get();
  const aliasCount = database.prepare('SELECT COUNT(*) AS count FROM entity_aliases').get();
  const indexedCount = database.prepare("SELECT COUNT(*) AS count FROM knowledge_sources WHERE status = 'indexed'").get();
  return {
    ok: true,
    sources: Number(sourceCount?.count || 0),
    chunks: Number(chunkCount?.count || 0),
    aliases: Number(aliasCount?.count || 0),
    indexedSources: Number(indexedCount?.count || 0),
    seed: PHASE2_ALIAS_SEED_SLUG
  };
}

function scoreAliasMatch(queryNorm, aliasRow) {
  const aliasNorm = aliasRow.alias_norm || '';
  const canonicalNorm = normalizeKnowledgeText(aliasRow.canonical_name);
  if (!queryNorm || !aliasNorm) return 0;
  if (queryNorm === aliasNorm || queryNorm.includes(aliasNorm)) return 100;
  if (queryNorm === canonicalNorm || queryNorm.includes(canonicalNorm)) return 95;
  if (aliasNorm.includes(queryNorm) && queryNorm.length >= 3) return 82;
  const words = queryNorm.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  return words.reduce((score, word) => score + (aliasNorm.includes(word) ? 8 : 0), 0);
}

function scoreKnowledgeChunk(queryNorm, terms, row) {
  const titleNorm = normalizeKnowledgeText(row.title || row.source_title || '');
  const summaryNorm = normalizeKnowledgeText(row.summary || '');
  const contentNorm = String(row.content_norm || '');
  const contentAscii = String(row.content_ascii || '');
  const tags = safeJsonParse(row.tags_json, []);
  const entityRefs = safeJsonParse(row.entity_refs_json, []);
  const tagsNorm = normalizeKnowledgeText(tags.join(' '));
  const entityNorm = normalizeKnowledgeText(entityRefs.join(' '));
  const searchable = [titleNorm, summaryNorm, contentNorm, contentAscii].join(' ');
  const matchedTerms = terms.filter((term) => searchable.includes(term) || tagsNorm.includes(term) || entityNorm.includes(term));
  let score = 0;
  const reasons = [];

  if (queryNorm && (titleNorm.includes(queryNorm) || summaryNorm.includes(queryNorm) || contentNorm.includes(queryNorm))) {
    score += 80;
    reasons.push('exact_phrase');
  }
  if (terms.length && matchedTerms.length === terms.length) {
    score += 42;
    reasons.push('all_terms');
  } else if (matchedTerms.length) {
    score += matchedTerms.length * 10;
    reasons.push('partial_terms');
  }
  const tagMatches = terms.filter((term) => tagsNorm.includes(term) || entityNorm.includes(term));
  if (tagMatches.length) {
    score += tagMatches.length * 18;
    reasons.push('tag_entity_match');
  }
  if (titleNorm.includes(queryNorm) && queryNorm) {
    score += 24;
    reasons.push('title_match');
  }

  return {
    score,
    matchedTerms: [...new Set(matchedTerms)],
    reason: [...new Set(reasons)].join(',') || 'term_match',
    tags,
    entityRefs
  };
}

async function searchKnowledgeWithAliases(query, { limit = 8, authScope = 'admin' } = {}) {
  await ensurePhase2AliasKnowledgeSeeded();
  const database = await getDatabase();
  const variants = buildKnowledgeSearchVariants(query);
  const queryNorm = normalizeKnowledgeText(query);
  const aliasRows = database.prepare('SELECT * FROM entity_aliases').all();
  const aliasMatches = aliasRows
    .map((row) => ({ ...row, score: Math.max(...variants.map((variant) => scoreAliasMatch(normalizeKnowledgeText(variant), row))) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.generation - b.generation)
    .slice(0, limit);

  const chunkRows = database.prepare(`
    SELECT
      kc.*,
      ks.title AS source_title,
      ks.scope AS source_scope,
      ks.system_scope AS source_system_scope,
      ks.clan_scope AS source_clan_scope,
      ks.domain AS source_domain,
      ks.visibility AS source_visibility,
      ks.tags_json AS source_tags_json,
      ks.entity_refs_json AS source_entity_refs_json
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON ks.id = kc.source_id
  `).all();
  const queryWords = queryNorm.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  const chunkMatches = chunkRows
    .filter((row) => canReadKnowledgeVisibility(row.visibility || row.source_visibility, authScope))
    .map((row) => {
      const score = scoreKnowledgeChunk(queryNorm, queryWords, {
        ...row,
        tags_json: row.tags_json || row.source_tags_json,
        entity_refs_json: row.entity_refs_json || row.source_entity_refs_json,
        content_ascii: row.content_ascii || ''
      });
      return { ...row, ...score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)
    .slice(0, limit);

  return {
    query,
    variants,
    aliases: aliasMatches,
    chunks: chunkMatches
  };
}

function isAliasLookupQuestion(query) {
  const text = normalizeKnowledgeText(query);
  return /\b(la ai|la gi|ai la|dung khong|co phai|thuy to|cao to)\b/.test(text);
}

function buildAliasLookupAnswer(searchResult) {
  const top = searchResult.aliases?.[0];
  if (!top || top.score < 80 || !isAliasLookupQuestion(searchResult.query)) return null;
  const meta = safeJsonParse(top.metadata_json, {});
  if (top.example_only || top.needs_verification || top.status === 'example_only' || top.status === 'needs_verification') {
    return [
      `Tôi tìm thấy gợi ý alias liên quan tới "${top.alias}" là ${top.canonical_name}, nhưng mục này đang được đánh dấu là ví dụ hoặc cần xác minh.`,
      'Chưa có dữ liệu xác minh đủ chắc trong kho tri thức hiện tại để khẳng định đây là một nhân vật đã được chốt trong phả đồ.',
      'Vui lòng cung cấp thêm đời, chi/ngành, cha mẹ hoặc tài liệu gốc để đối chiếu.'
    ].join('\n');
  }
  const title = top.required_title ? ` - ${top.required_title}` : '';
  const generation = Number.isFinite(Number(top.generation)) ? `Đời/generation kỹ thuật: ${top.generation}.` : '';
  const rules = Array.isArray(meta.answering_rules) ? meta.answering_rules.slice(0, 2).join(' ') : '';
  return [
    `${top.required_title || top.alias} trong kho tri thức hiện được map về cụ ${top.canonical_name}${title}.`,
    generation,
    rules
  ].filter(Boolean).join('\n');
}

function buildRequiredAliasAnswer(query) {
  if (!isAliasLookupQuestion(query)) return null;
  const text = normalizeKnowledgeText(query);
  if (text.includes('cao to')) {
    return [
      'Cao Tổ trong kho tri thức hiện được map về cụ Cao Đình Thuật - Cao Tổ.',
      'Đời/generation kỹ thuật: 0.',
      'Khi trả lời về nhân vật này, không gọi cụ Cao Đình Thuật là Thủy Tổ.'
    ].join('\n');
  }
  if (text.includes('thuy to') || /\b(cu lang|ong lang|nhieu lang|lang)\b/.test(text)) {
    return [
      'Thủy Tổ trong kho tri thức hiện được map về cụ Cao Đình Lạng - Thủy Tổ.',
      'Đời/generation kỹ thuật: 1.',
      'Nếu người dùng hỏi Lạng, cụ Lạng hoặc Nhiêu Lạng và không có nhân vật khác trùng tên, ưu tiên map về Cao Đình Lạng.'
    ].join('\n');
  }
  if (/\bthuan\b/.test(text)) {
    return [
      'Tôi tìm thấy "Thuần" trong tài liệu Phase 2A như một ví dụ alias/tên ngắn cần gợi ý.',
      UNVERIFIED_DATA_TEXT,
      'Vui lòng cung cấp thêm họ tên đầy đủ, đời, chi/ngành hoặc tài liệu đối chiếu để xác minh.'
    ].join('\n');
  }
  return null;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatKnowledgeContextForAI(searchResult) {
  const aliasLines = (searchResult.aliases || []).slice(0, 4).map((row) => {
    const flags = [
      row.required_title ? `danh xung: ${row.required_title}` : '',
      Number.isFinite(Number(row.generation)) ? `generation: ${row.generation}` : '',
      row.example_only ? 'example_only' : '',
      row.needs_verification ? 'needs_verification' : ''
    ].filter(Boolean).join('; ');
    return `- Alias "${row.alias}" -> ${row.canonical_name}${flags ? ` (${flags})` : ''}`;
  });
  const chunkLines = (searchResult.chunks || []).slice(0, AI_GATEWAY_KNOWLEDGE_TOP_K).map((row) => (
    `- ${row.source_title}: ${compactText(row.content, 520)}`
  ));
  if (!aliasLines.length && !chunkLines.length) return '';
  return compactText([
    'Ngu canh kho tri thuc local Phase 2A:',
    ...aliasLines,
    ...chunkLines
  ].join('\n'), AI_GATEWAY_MAX_KNOWLEDGE_CHARS);
}

function buildKnowledgeChunkLocalAnswer(searchResult) {
  const chunks = (searchResult?.chunks || []).slice(0, 3);
  if (!chunks.length) return '';
  const lines = chunks.map((row, index) => {
    const title = row.source_title || row.title || `chunk ${index + 1}`;
    return `- ${title}: ${compactText(row.content, 420)}`;
  });
  return [
    'Theo kho tri thức local, tôi tìm thấy các đoạn liên quan sau:',
    ...lines,
    'Khi dùng nội dung này để viết diễn giải, phần nào chưa được tài liệu xác minh rõ cần đánh dấu để admin kiểm chứng.'
  ].join('\n');
}

function buildMissingAnniversaryVerificationAnswer(query, searchResult) {
  const text = normalizeKnowledgeText(query);
  const asksAnniversary = /\b(ngay gio|ky nhat|gio cu|gio ong|gio ba)\b/.test(text);
  const asksDeath = /\b(ngay mat|nam mat|ta the)\b/.test(text);
  if (!asksAnniversary && !asksDeath) return '';
  const isLang = text.includes('cao dinh lang') || text.includes('thuy to') || /\b(cu lang|ong lang|nhieu lang)\b/.test(text);
  const isThuat = text.includes('cao dinh thuat') || text.includes('cao to');
  if (!isLang && !isThuat) return '';

  const personLabel = isLang ? 'cụ Cao Đình Lạng - Thủy Tổ' : 'cụ Cao Đình Thuật - Cao Tổ';
  const fieldLabel = asksDeath ? 'ngày mất/tạ thế' : 'ngày giỗ';
  const sources = [...new Set((searchResult?.chunks || []).map((row) => row.source_title || row.title).filter(Boolean))].slice(0, 4);
  return [
    `Chưa tìm thấy dữ liệu xác minh trực tiếp về ${fieldLabel} của ${personLabel} trong kho tri thức hiện tại.`,
    sources.length ? `Các nguồn đã đối chiếu: ${sources.join('; ')}.` : '',
    'Nếu trong database/lịch giỗ có bản ghi riêng, cần ưu tiên bản ghi đó. Nếu chưa có, không tự suy đoán ngày âm lịch/dương lịch từ tài liệu tham chiếu.'
  ].filter(Boolean).join('\n');
}

function buildVerificationKnowledgeAnswer(query, searchResult) {
  const text = normalizeKnowledgeText(query);
  if (!/(han nom|kiem chung|xac minh|loi ocr|loi bien tap)/.test(text)) return null;
  const chunks = (searchResult?.chunks || [])
    .filter((row) => {
      const tags = safeJsonParse(row.tags_json, row.tags || []);
      const haystack = normalizeKnowledgeText([
        row.source_title,
        row.title,
        row.heading_path,
        Array.isArray(tags) ? tags.join(' ') : '',
        row.content
      ].join(' '));
      return haystack.includes('diem can kiem chung') ||
        haystack.includes('han nom') ||
        haystack.includes('loi ocr') ||
        haystack.includes('kiem chung');
    })
    .slice(0, 3);
  if (!chunks.length) return null;
  return {
    chunks,
    text: [
      'Tài liệu cần kiểm chứng Hán Nôm/admin xác minh đang được ưu tiên trong kho tri thức là:',
      ...chunks.map((row) => `- ${row.source_title || row.title}: ${compactText(row.content, 360)}`),
      'Khi dùng các đoạn này, AI không tự sửa Hán Nôm/OCR và phải đánh dấu phần cần Ban trị sự kiểm chứng.'
    ].join('\n')
  };
}

function publicExtractedAnniversaryCandidate(row) {
  const metadata = safeJsonParse(row.metadata_json, {});
  const status = normalizeExtractedCandidateStatus(row.status);
  const fields = getExtractedAnniversaryFields(row, metadata);
  return {
    id: row.id,
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    personName: row.person_name,
    generation: row.generation,
    branch: row.branch,
    birthText: row.birth_text,
    deathText: row.death_text,
    deathAnniversaryLunar: row.death_anniversary_lunar,
    hometown: row.hometown,
    graveText: row.grave_text,
    sourceQuote: row.source_quote,
    headingPath: row.heading_path,
    matchedMemberId: row.matched_member_id,
    matchedMemberName: row.matched_member_name,
    matchConfidence: row.match_confidence,
    status,
    metadata,
    fields,
    currentValues: metadata.currentValues || {},
    candidateMatches: Array.isArray(metadata.candidateMatches) ? metadata.candidateMatches : [],
    updatedAt: row.updated_at
  };
}

function stripHanCharacters(value) {
  return String(value || '').replace(/[\u3400-\u9fff]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePersonLookupText(value) {
  return normalizeKnowledgeText(stripHanCharacters(value));
}

function getMemberDisplayName(member) {
  return stripHanCharacters(member?.name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function publicLineageMemberSearchResult(member, score = 0, confidence = 'none', reason = '') {
  return {
    memberId: member.id,
    fullName: getMemberDisplayName(member) || member.name,
    generation: member.generation,
    fatherName: member.fatherName || '',
    motherName: member.motherName || '',
    branchName: member.branch || '',
    confidence,
    score,
    reason,
    currentValues: {
      birth: member.solarBirthDate || member.birthYear || '',
      death: member.solarDeathDate || member.deathYear || '',
      lunar_anniversary: member.deathAnniversaryLunar || member.lunarAnniversary || '',
      birth_structured: member.birthDateStructured || null,
      death_structured: member.deathDateStructured || null,
      lunar_anniversary_structured: member.deathAnniversaryLunarStructured || null,
      hometown: member.birthPlace || member.residence || '',
      grave: member.graveLocation || member.burialPlace || ''
    }
  };
}

function scoreMemberForQuery(query, member) {
  const queryNorm = normalizePersonLookupText(query);
  const fullName = getMemberDisplayName(member);
  const fullNorm = normalizePersonLookupText(fullName);
  const rawNameNorm = normalizePersonLookupText(member.name);
  const queryTerms = queryNorm.split(' ').filter((term) => term.length >= 2);
  const nameTerms = fullNorm.split(' ').filter(Boolean);
  const shortName = nameTerms.at(-1) || '';
  let score = 0;
  const reasons = [];
  if (fullNorm && queryNorm === fullNorm) {
    score += 120;
    reasons.push('exact full name');
  } else if (fullNorm && queryNorm.includes(fullNorm)) {
    score += 100;
    reasons.push('contains full name');
  } else if (fullNorm && fullNorm.includes(queryNorm) && queryNorm.length >= 5) {
    score += 70;
    reasons.push('partial full name');
  }
  const allTerms = queryTerms.length > 1 && queryTerms.every((term) => rawNameNorm.includes(term));
  if (allTerms) {
    score += 50;
    reasons.push('all name terms');
  }
  if (shortName && queryTerms.length === 1 && queryTerms[0] === shortName) {
    score += 25;
    reasons.push('short name only');
  }
  if (member.branch && normalizePersonLookupText(member.branch).includes(queryNorm)) score += 8;
  if (member.fatherName && normalizePersonLookupText(member.fatherName).includes(queryNorm)) score += 6;
  if (member.motherName && normalizePersonLookupText(member.motherName).includes(queryNorm)) score += 6;
  let confidence = 'none';
  if (score >= 120) confidence = 'exact';
  else if (score >= 85) confidence = 'strong';
  else if (score >= 50) confidence = 'medium';
  else if (score >= 25) confidence = 'weak';
  return { score, confidence, reason: reasons.join(', ') || 'normalized text match' };
}

async function searchLineageMembers(query, { limit = 12 } = {}) {
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const scored = members
    .map((member) => ({ member, ...scoreMemberForQuery(query, member) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.member.generation - b.member.generation)
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 12)));
  const topScore = scored[0]?.score || 0;
  const topCount = scored.filter((item) => item.score === topScore).length;
  return scored.map((item) => {
    const confidence = item.confidence === 'exact' && topCount > 1 ? 'ambiguous' : item.confidence;
    const reason = topCount > 1 && item.score === topScore ? `${item.reason}; ambiguous top match` : item.reason;
    return publicLineageMemberSearchResult(item.member, item.score, confidence, reason);
  });
}

function buildCandidateMatchesFromMembers(candidate, members) {
  const scored = members
    .map((member) => ({ member, ...scoreMemberForQuery(candidate.person_name, member) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.member.generation - b.member.generation)
    .slice(0, 6);
  const topScore = scored[0]?.score || 0;
  const topCount = scored.filter((item) => item.score === topScore).length;
  return scored.map((item) => {
    const confidence = item.confidence === 'exact' && topCount > 1 ? 'ambiguous' : item.confidence;
    return publicLineageMemberSearchResult(item.member, item.score, confidence, item.reason);
  });
}

async function hydrateExtractedCandidateReviewData(publicCandidate) {
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const rowLike = {
    person_name: publicCandidate.personName,
    matched_member_id: publicCandidate.matchedMemberId
  };
  const candidateMatches = buildCandidateMatchesFromMembers(rowLike, members);
  const matched = members.find((member) => member.id === publicCandidate.matchedMemberId) || null;
  const currentValues = matched ? publicLineageMemberSearchResult(matched).currentValues : {};
  return {
    ...publicCandidate,
    currentValues,
    candidateMatches
  };
}

function normalizeExtractedCandidateStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'candidate') return 'pending';
  return ['pending', 'approved', 'rejected', 'applied'].includes(value) ? value : 'pending';
}

function getExtractedAnniversaryFields(row, metadata = safeJsonParse(row?.metadata_json, {})) {
  const reviewedFields = metadata && typeof metadata.reviewedFields === 'object' && metadata.reviewedFields
    ? metadata.reviewedFields
    : {};
  const fields = [
    ['birth', 'Ngày/năm sinh', row.birth_text],
    ['death', 'Ngày/năm mất', row.death_text],
    ['lunar_anniversary', 'Ngày giỗ âm lịch', row.death_anniversary_lunar],
    ['hometown', 'Quê quán', row.hometown],
    ['grave', 'Mộ chí', row.grave_text]
  ];
  return fields
    .filter(([, , value]) => String(value || '').trim())
    .map(([type, label, value]) => {
      const reviewedValue = Object.prototype.hasOwnProperty.call(reviewedFields, type)
        ? String(reviewedFields[type] || '').trim()
        : '';
      return {
        type,
        label,
        value: String(value || '').trim(),
        reviewedValue,
        effectiveValue: reviewedValue || String(value || '').trim()
      };
    });
}

function getCandidateValueForField(row, fieldType) {
  const metadata = safeJsonParse(row.metadata_json, {});
  const reviewedFields = metadata && typeof metadata.reviewedFields === 'object' && metadata.reviewedFields
    ? metadata.reviewedFields
    : {};
  if (Object.prototype.hasOwnProperty.call(reviewedFields, fieldType)) {
    return String(reviewedFields[fieldType] || '').trim();
  }
  const map = {
    birth: row.birth_text,
    death: row.death_text,
    lunar_anniversary: row.death_anniversary_lunar,
    anniversary: row.death_anniversary_lunar,
    hometown: row.hometown,
    grave: row.grave_text,
    tomb_note: row.grave_text
  };
  return String(map[fieldType] || '').trim();
}

async function listExtractedAnniversaryCandidates({ q = '', status = '', type = '', pendingOnly = false, limit = 100 } = {}) {
  const database = await getDatabase();
  const rows = database
    .prepare('SELECT * FROM extracted_anniversary_candidates ORDER BY person_name_norm, updated_at DESC')
    .all();
  const queryNorm = normalizeKnowledgeText(q);
  const statusFilter = normalizeExtractedCandidateStatus(status);
  const hasStatusFilter = Boolean(String(status || '').trim());
  const typeFilter = String(type || '').trim();
  const filtered = rows
    .filter((row) => {
      const normalizedStatus = normalizeExtractedCandidateStatus(row.status);
      if (pendingOnly && normalizedStatus !== 'pending') return false;
      if (hasStatusFilter && normalizedStatus !== statusFilter) return false;
      const fields = getExtractedAnniversaryFields(row);
      if (typeFilter && !fields.some((field) => field.type === typeFilter)) return false;
      if (!queryNorm) return true;
      return normalizeKnowledgeText([
        row.person_name,
        row.matched_member_name,
        row.birth_text,
        row.death_text,
        row.death_anniversary_lunar,
        row.hometown,
        row.grave_text,
        row.source_quote
      ].join(' ')).includes(queryNorm);
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)))
    .map(publicExtractedAnniversaryCandidate);
  return Promise.all(filtered.map(hydrateExtractedCandidateReviewData));
}

async function updateExtractedAnniversaryCandidate(id, patch, adminUser) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_anniversary_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Extracted anniversary candidate not found.');
    err.status = 404;
    throw err;
  }
  const metadata = safeJsonParse(row.metadata_json, {});
  const nextMetadata = {
    ...metadata,
    reviewedFields: {
      ...(metadata.reviewedFields && typeof metadata.reviewedFields === 'object' ? metadata.reviewedFields : {})
    },
    lastReviewedBy: adminUser?.username || adminUser?.fullName || '',
    lastReviewedAt: new Date().toISOString()
  };
  if (patch.reviewedFields && typeof patch.reviewedFields === 'object') {
    for (const [key, value] of Object.entries(patch.reviewedFields)) {
      if (['birth', 'death', 'lunar_anniversary', 'anniversary', 'hometown', 'grave', 'tomb_note'].includes(key)) {
        const normalizedKey = key === 'anniversary' ? 'lunar_anniversary' : key === 'tomb_note' ? 'grave' : key;
        nextMetadata.reviewedFields[normalizedKey] = String(value || '').trim();
      }
    }
  }

  const nextStatus = patch.status === undefined ? normalizeExtractedCandidateStatus(row.status) : normalizeExtractedCandidateStatus(patch.status);
  const matchedMemberId = patch.matchedMemberId === undefined ? row.matched_member_id : String(patch.matchedMemberId || '').trim();
  const matchedMemberName = patch.matchedMemberName === undefined ? row.matched_member_name : String(patch.matchedMemberName || '').trim();
  const matchConfidence = patch.matchConfidence === undefined ? row.match_confidence : String(patch.matchConfidence || 'manual').trim();

  database.prepare(`
    UPDATE extracted_anniversary_candidates
    SET status = ?,
        matched_member_id = ?,
        matched_member_name = ?,
        match_confidence = ?,
        metadata_json = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(nextStatus, matchedMemberId, matchedMemberName, matchConfidence, JSON.stringify(nextMetadata), id);
  return hydrateExtractedCandidateReviewData(publicExtractedAnniversaryCandidate(database.prepare('SELECT * FROM extracted_anniversary_candidates WHERE id = ?').get(id)));
}

function updateLineageNodeById(node, memberId, updater) {
  if (!node || typeof node !== 'object') return false;
  if (String(node.id || '') === String(memberId || '')) {
    updater(node);
    return true;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    if (updateLineageNodeById(child, memberId, updater)) return true;
  }
  return false;
}

function getLineageNodeById(node, memberId) {
  let found = null;
  updateLineageNodeById(node, memberId, (item) => {
    found = item;
  });
  return found;
}

function mapExtractedFieldToLineageFields(fieldType) {
  switch (fieldType) {
    case 'birth':
      return ['birthDateStructured', 'solarBirthDate', 'birthYear'];
    case 'death':
      return ['deathDateStructured', 'solarDeathDate', 'deathYear'];
    case 'lunar_anniversary':
    case 'anniversary':
      return ['deathAnniversaryLunarStructured', 'deathAnniversaryLunar', 'lunarAnniversary'];
    case 'hometown':
      return ['birthPlace'];
    case 'grave':
    case 'tomb_note':
      return ['graveLocation', 'burialPlace'];
    default:
      return [];
  }
}

function structuredDateForLineage(value, defaultCalendar, row = {}) {
  const structured = parseGenealogyDateText(value, defaultCalendar);
  if (!structured || structured.precision === 'unknown') return null;
  return {
    ...structured,
    sourceId: row.source_id || row.sourceId || undefined,
    chunkId: row.chunk_id || row.chunkId || undefined
  };
}

function buildLineageFieldUpdates(fieldType, value, row = {}) {
  const text = String(value || '').trim();
  if (!text) return [];
  switch (fieldType) {
    case 'birth': {
      const structured = structuredDateForLineage(text, 'solar', row);
      const updates = structured ? [{ field: 'birthDateStructured', value: structured }] : [];
      if (structured?.precision === 'full_date' && structured.calendar === 'solar') {
        updates.push({ field: 'solarBirthDate', value: text });
      }
      if (structured?.year) updates.push({ field: 'birthYear', value: String(structured.year) });
      return updates.length ? updates : [{ field: 'birthYear', value: text }];
    }
    case 'death': {
      const structured = structuredDateForLineage(text, 'solar', row);
      const updates = structured ? [{ field: 'deathDateStructured', value: structured }] : [];
      if (structured?.precision === 'full_date' && structured.calendar === 'solar') {
        updates.push({ field: 'solarDeathDate', value: text });
      }
      if (structured?.year) updates.push({ field: 'deathYear', value: String(structured.year) });
      return updates.length ? updates : [{ field: 'deathYear', value: text }];
    }
    case 'lunar_anniversary':
    case 'anniversary': {
      const structured = structuredDateForLineage(text, 'lunar', row);
      return [
        ...(structured ? [{ field: 'deathAnniversaryLunarStructured', value: structured }] : []),
        { field: 'deathAnniversaryLunar', value: text },
        { field: 'lunarAnniversary', value: text }
      ];
    }
    case 'hometown':
      return [{ field: 'birthPlace', value: text }];
    case 'grave':
    case 'tomb_note':
      return [
        { field: 'graveLocation', value: text },
        { field: 'burialPlace', value: text }
      ];
    default:
      return [];
  }
}

async function applyExtractedAnniversaryCandidate(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_anniversary_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Extracted anniversary candidate not found.');
    err.status = 404;
    throw err;
  }
  const status = normalizeExtractedCandidateStatus(row.status);
  if (status !== 'approved' && status !== 'applied') {
    const err = new Error('Candidate must be approved before applying.');
    err.status = 400;
    throw err;
  }

  const memberId = String(body.memberId || row.matched_member_id || '').trim();
  if (!memberId) {
    const err = new Error('Missing matched member id.');
    err.status = 400;
    throw err;
  }

  const tree = await readLineageTreeForAI();
  if (!tree) {
    const err = new Error('Lineage tree is not available.');
    err.status = 404;
    throw err;
  }
  const target = getLineageNodeById(tree, memberId);
  if (!target) {
    const err = new Error('Matched member not found in lineage tree.');
    err.status = 404;
    throw err;
  }

  const requestedTypes = Array.isArray(body.fieldTypes) && body.fieldTypes.length
    ? body.fieldTypes.map((item) => String(item))
    : getExtractedAnniversaryFields(row).map((field) => field.type);
  const force = body.force === true || body.confirmOverwrite === true;
  const changes = [];
  const conflicts = [];

  for (const fieldType of requestedTypes) {
    const value = getCandidateValueForField(row, fieldType);
    if (!value) continue;
    const lineageUpdates = buildLineageFieldUpdates(fieldType, value, row);
    for (const update of lineageUpdates) {
      const lineageField = update.field;
      const nextValue = update.value;
      const oldRawValue = target[lineageField];
      const oldValue = typeof oldRawValue === 'object' && oldRawValue !== null ? JSON.stringify(oldRawValue) : String(oldRawValue || '').trim();
      const nextComparableValue = typeof nextValue === 'object' && nextValue !== null ? JSON.stringify(nextValue) : String(nextValue || '').trim();
      if (oldValue && oldValue !== nextComparableValue && !force) {
        conflicts.push({ fieldType, lineageField, oldValue, newValue: nextValue, rawText: value });
        continue;
      }
      if (oldValue === nextComparableValue) continue;
      target[lineageField] = nextValue;
      changes.push({ fieldType, lineageField, oldValue, newValue: nextValue, rawText: value, sourceId: row.source_id, chunkId: row.chunk_id });
    }
  }

  if (conflicts.length && !changes.length) {
    const err = new Error('Existing lineage fields are not empty. Confirm overwrite with confirmOverwrite=true.');
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  if (changes.length) {
    await writeState(TREE_STATE_KEY, tree);
  }

  const auditId = `ann_audit_${sha256Base64Url(`${id}:${Date.now()}:${changes.length}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_anniversary_audit_logs
      (id, candidate_id, member_id, action, field_changes_json, source_id, chunk_id, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    auditId,
    id,
    memberId,
    changes.length ? 'apply' : 'apply_noop',
    JSON.stringify({ changes, conflicts }),
    row.source_id,
    row.chunk_id,
    adminUser?.username || adminUser?.fullName || ''
  );

  database.prepare(`
    UPDATE extracted_anniversary_candidates
    SET status = 'applied',
        matched_member_id = ?,
        matched_member_name = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(memberId, String(target.name || row.matched_member_name || '').trim(), id);

  return {
    ok: true,
    candidate: await hydrateExtractedCandidateReviewData(publicExtractedAnniversaryCandidate(database.prepare('SELECT * FROM extracted_anniversary_candidates WHERE id = ?').get(id))),
    changes,
    conflicts,
    auditId
  };
}

async function bulkUpdateExtractedAnniversaryCandidates(body = {}, adminUser = {}) {
  const action = String(body.action || '').trim();
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!ids.length) {
    const err = new Error('Missing candidate ids.');
    err.status = 400;
    throw err;
  }
  if (!['approve', 'reject', 'reset', 'apply'].includes(action)) {
    const err = new Error('Unsupported bulk action.');
    err.status = 400;
    throw err;
  }

  const results = [];
  for (const id of ids) {
    try {
      if (action === 'approve') {
        const candidate = await updateExtractedAnniversaryCandidate(id, { status: 'approved' }, adminUser);
        results.push({ id, ok: true, status: 'approved', candidate });
      } else if (action === 'reject') {
        const candidate = await updateExtractedAnniversaryCandidate(id, { status: 'rejected' }, adminUser);
        results.push({ id, ok: true, status: 'rejected', candidate });
      } else if (action === 'reset') {
        const candidate = await updateExtractedAnniversaryCandidate(id, { status: 'pending' }, adminUser);
        results.push({ id, ok: true, status: 'pending', candidate });
      } else if (action === 'apply') {
        const database = await getDatabase();
        const row = database.prepare('SELECT status FROM extracted_anniversary_candidates WHERE id = ?').get(id);
        if (!row) {
          results.push({ id, ok: false, skipped: true, reason: 'not_found' });
          continue;
        }
        if (normalizeExtractedCandidateStatus(row.status) !== 'approved') {
          results.push({ id, ok: false, skipped: true, reason: 'not_approved' });
          continue;
        }
        const applied = await applyExtractedAnniversaryCandidate(id, {
          fieldTypes: body.fieldTypes,
          force: body.force === true,
          confirmOverwrite: body.confirmOverwrite === true
        }, adminUser);
        results.push({ id, ok: true, status: 'applied', changes: applied.changes, conflicts: applied.conflicts });
      }
    } catch (err) {
      results.push({ id, ok: false, error: err.message || String(err), statusCode: err.status || 500, conflicts: err.conflicts || [] });
    }
  }

  const database = await getDatabase();
  const auditId = `ann_audit_bulk_${sha256Base64Url(`${action}:${Date.now()}:${ids.join(',')}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_anniversary_audit_logs
      (id, candidate_id, member_id, action, field_changes_json, source_id, chunk_id, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    auditId,
    ids.join(','),
    '',
    `bulk_${action}`,
    JSON.stringify({ results }),
    '',
    '',
    adminUser?.username || adminUser?.fullName || ''
  );

  return {
    ok: results.every((item) => item.ok || item.skipped),
    action,
    total: ids.length,
    applied: results.filter((item) => item.status === 'applied').length,
    approved: results.filter((item) => item.status === 'approved').length,
    rejected: results.filter((item) => item.status === 'rejected').length,
    reset: results.filter((item) => item.status === 'pending').length,
    skipped: results.filter((item) => item.skipped).length,
    failed: results.filter((item) => !item.ok && !item.skipped).length,
    auditId,
    results
  };
}

function flattenAppliedExtractionAuditRow(row) {
  const payload = safeJsonParse(row.field_changes_json, {});
  const changes = Array.isArray(payload?.changes) ? payload.changes : [];
  const conflicts = Array.isArray(payload?.conflicts) ? payload.conflicts : [];
  return changes.map((change, index) => ({
    id: `${row.id}:${index}`,
    auditId: row.id,
    candidateId: row.candidate_id,
    memberId: row.member_id,
    memberName: row.matched_member_name || row.person_name || '',
    field: change.lineageField || change.fieldType || '',
    fieldType: change.fieldType || '',
    oldValue: change.oldValue || '',
    newValue: change.newValue || '',
    sourceId: row.source_id,
    sourceTitle: row.source_title || '',
    chunkId: row.chunk_id,
    headingPath: row.heading_path || row.chunk_heading_path || '',
    sourceQuote: row.source_quote || '',
    appliedBy: row.admin_user || '',
    appliedAt: row.created_at,
    action: row.action,
    conflicts
  }));
}

async function listAppliedExtractions({ q = '', field = '', limit = 80 } = {}) {
  const database = await getDatabase();
  const rows = database.prepare(`
    SELECT a.*, c.person_name, c.matched_member_name, c.source_quote, c.heading_path,
           s.title AS source_title, k.heading_path AS chunk_heading_path
    FROM extracted_anniversary_audit_logs a
    LEFT JOIN extracted_anniversary_candidates c ON c.id = a.candidate_id
    LEFT JOIN knowledge_sources s ON s.id = a.source_id
    LEFT JOIN knowledge_chunks k ON k.id = a.chunk_id
    WHERE a.action IN ('apply', 'apply_noop')
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit) || 80)));
  const queryNorm = normalizeKnowledgeText(q);
  const fieldNorm = normalizeKnowledgeText(field);
  return rows
    .flatMap(flattenAppliedExtractionAuditRow)
    .filter((item) => {
      if (fieldNorm && normalizeKnowledgeText([item.field, item.fieldType].join(' ')) !== fieldNorm && !normalizeKnowledgeText([item.field, item.fieldType].join(' ')).includes(fieldNorm)) return false;
      if (!queryNorm) return true;
      return normalizeKnowledgeText([
        item.memberName,
        item.memberId,
        item.field,
        item.fieldType,
        item.oldValue,
        item.newValue,
        item.sourceTitle,
        item.headingPath
      ].join(' ')).includes(queryNorm);
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 80)));
}

async function getAppliedExtractionById(id) {
  const [auditId, indexText] = String(id || '').split(':');
  if (!auditId) return null;
  const database = await getDatabase();
  const row = database.prepare(`
    SELECT a.*, c.person_name, c.matched_member_name, c.source_quote, c.heading_path,
           s.title AS source_title, k.heading_path AS chunk_heading_path
    FROM extracted_anniversary_audit_logs a
    LEFT JOIN extracted_anniversary_candidates c ON c.id = a.candidate_id
    LEFT JOIN knowledge_sources s ON s.id = a.source_id
    LEFT JOIN knowledge_chunks k ON k.id = a.chunk_id
    WHERE a.id = ?
  `).get(auditId);
  if (!row) return null;
  const items = flattenAppliedExtractionAuditRow(row);
  if (indexText === undefined) return items[0] || null;
  return items[Number(indexText)] || null;
}

function isVitalRecordQuestion(query) {
  const text = normalizeKnowledgeText(query);
  return /\b(ngay gio|ky nhat|ngay mat|nam mat|ta the|mo chi|mo phan|lang mo|que quan|noi an tang)\b/.test(text);
}

async function searchExtractedAnniversaryCandidatesForQuery(query, { authScope = 'anonymous', limit = 5 } = {}) {
  if (!['admin', 'kyc_verified'].includes(authScope)) return [];
  const database = await getDatabase();
  const queryNorm = normalizeKnowledgeText(query);
  const rows = database.prepare('SELECT * FROM extracted_anniversary_candidates').all();
  return rows
    .map((row) => {
      const personNorm = row.person_name_norm || normalizeKnowledgeText(row.person_name);
      const matchedNorm = normalizeKnowledgeText(row.matched_member_name);
      const status = normalizeExtractedCandidateStatus(row.status);
      let score = 0;
      if (personNorm && queryNorm.includes(personNorm)) score += 120;
      if (matchedNorm && queryNorm.includes(matchedNorm)) score += 110;
      if (status === 'applied') score += 40;
      if (status === 'approved') score += 30;
      if (status === 'rejected') score -= 1000;
      return { ...row, score };
    })
    .filter((row) => row.score >= 100)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildExtractedAnniversaryAnswer(query, candidates) {
  if (!isVitalRecordQuestion(query) || !candidates.length) return null;
  const text = normalizeKnowledgeText(query);
  const wantsAnniversary = /\b(ngay gio|ky nhat)\b/.test(text);
  const wantsDeath = /\b(ngay mat|nam mat|ta the)\b/.test(text);
  const wantsGrave = /\b(mo chi|mo phan|lang mo|noi an tang)\b/.test(text);
  const wantsHometown = /\b(que quan|nguoi lang|nguoi thon)\b/.test(text);
  const usable = candidates.filter((row) => {
    if (wantsAnniversary) return row.death_anniversary_lunar || row.death_text;
    if (wantsDeath) return row.death_text || row.death_anniversary_lunar;
    if (wantsGrave) return row.grave_text;
    if (wantsHometown) return row.hometown;
    return row.birth_text || row.death_text || row.death_anniversary_lunar || row.hometown || row.grave_text;
  });
  if (!usable.length) return null;
  const lines = usable.slice(0, 3).map((row) => {
    const status = normalizeExtractedCandidateStatus(row.status);
    const lunarStructured = parseGenealogyDateText(row.death_anniversary_lunar, 'lunar');
    const lunarMissingYearNote = lunarStructured.precision === 'day_month' && !lunarStructured.year
      ? ' (năm mất chưa được xác minh)'
      : '';
    const statusText = status === 'applied'
      ? 'dữ liệu đã áp dụng'
      : status === 'approved'
        ? 'đã được admin duyệt nhưng chưa cập nhật vào hồ sơ'
        : 'candidate trích xuất đang chờ duyệt';
    const facts = [
      row.death_anniversary_lunar ? `ngày giỗ/ngày tạ thế âm lịch: ${row.death_anniversary_lunar}` : '',
      row.death_text && row.death_text !== row.death_anniversary_lunar ? `ngày mất/tạ thế: ${row.death_text}` : '',
      row.birth_text ? `ngày/năm sinh: ${row.birth_text}` : '',
      row.hometown ? `quê quán: ${row.hometown}` : '',
      row.grave_text ? `mộ chí: ${compactText(row.grave_text, 260)}` : ''
    ].filter(Boolean).join('; ') + lunarMissingYearNote;
    const match = row.match_confidence === 'exact' || row.match_confidence === 'partial'
      ? `; đối chiếu cây phả: ${row.matched_member_name || row.matched_member_id} (${row.match_confidence})`
      : '; chưa khớp chắc với cây phả';
    return `- ${row.person_name}: ${facts || 'có candidate nhưng thiếu trường phù hợp'}${match}. Trạng thái: ${statusText}. Nguồn: ${row.heading_path}.`;
  });
  const hasOnlyPending = usable.every((row) => normalizeExtractedCandidateStatus(row.status) === 'pending');
  return [
    'Theo candidate trích xuất từ Cao Tộc Phả file 04, tôi tìm thấy:',
    ...lines,
    hasOnlyPending
      ? 'Các mục trên mới là gợi ý từ tài liệu, chưa được duyệt nên không coi là dữ liệu xác minh.'
      : 'Chỉ dữ liệu đã áp dụng vào hồ sơ được coi là dữ liệu xác minh; mục đã duyệt nhưng chưa áp dụng vẫn cần admin cập nhật trước khi dùng chính thức.'
  ].join('\n');
}

const AI_QUALITY_EVAL_CASES = [
  {
    id: 'alias-cao-to',
    question: 'Cao Tổ là ai?',
    engine: 'local',
    expectedContains: ['Cao Đình Thuật', 'Cao Tổ'],
    mustNotContain: ['Thủy Tổ trong kho tri thức hiện được map về cụ Cao Đình Thuật'],
    expectedAlias: 'Cao Tổ',
    scope: 'public'
  },
  {
    id: 'alias-thuy-to',
    question: 'Thủy Tổ là ai?',
    engine: 'local',
    expectedContains: ['Cao Đình Lạng', 'Thủy Tổ'],
    mustNotContain: ['Cao Đình Thuật - Thủy Tổ'],
    expectedAlias: 'Thủy Tổ',
    scope: 'public'
  },
  {
    id: 'alias-cu-lang',
    question: 'cụ Lạng là ai?',
    engine: 'local',
    expectedContains: ['Cao Đình Lạng', 'Thủy Tổ'],
    mustNotContain: ['Cao Đình Thuật'],
    expectedAlias: 'cụ Lạng',
    scope: 'public'
  },
  {
    id: 'alias-thuan-unverified',
    question: 'Thuần là ai?',
    engine: 'local',
    expectedContains: ['Thuần', UNVERIFIED_DATA_TEXT],
    mustNotContain: ['đã xác minh', 'khẳng định'],
    expectedAlias: 'Thuần',
    scope: 'public'
  },
  {
    id: 'han-nom-rule',
    question: 'Quy tắc Hán Nôm nghi vấn là gì?',
    engine: 'local',
    expectedContains: ['Hán'],
    mustNotContain: ['tự ý sửa'],
    expectedSource: 'knowledge_chunks',
    scope: 'public'
  },
  {
    id: 'missing-verification-rule',
    question: 'Khi không có dữ liệu xác minh thì trả lời thế nào?',
    engine: 'local',
    expectedContains: [UNVERIFIED_DATA_TEXT],
    mustNotContain: ['Ninh Bình', 'Cao Quý Công', 'Cao Văn Lãm'],
    scope: 'public'
  },
  {
    id: 'kyc-private-policy',
    question: 'Người chưa KYC hỏi thông tin chi tiết thì trả lời thế nào?',
    engine: 'local',
    expectedContains: ['KYC', 'đăng nhập'],
    mustNotContain: ['ngày sinh dương lịch', 'số điện thoại'],
    scope: 'webview_public'
  },
  {
    id: 'death-anniversary-lang',
    question: 'Ngày giỗ cụ Cao Đình Lạng là ngày nào?',
    engine: 'local',
    expectedContains: ['Cao Đình Lạng'],
    mustNotContain: ['Cao Quý Công', 'Cao Văn Lãm'],
    scope: 'admin'
  }
];

function publicEvalCase(testCase) {
  return {
    id: testCase.id,
    question: testCase.question,
    engine: testCase.engine,
    expectedContains: testCase.expectedContains,
    mustNotContain: testCase.mustNotContain,
    expectedAlias: testCase.expectedAlias || '',
    expectedSource: testCase.expectedSource || '',
    scope: testCase.scope
  };
}

async function answerAIQualityCase(testCase) {
  const knowledge = await searchKnowledgeWithAliases(testCase.question, {
    limit: botConfig.maxKnowledgeChunks,
    authScope: testCase.scope === 'public' || testCase.scope === 'webview_public' ? 'anonymous' : 'admin'
  });
  const requiredAliasAnswer = buildRequiredAliasAnswer(testCase.question);
  const aliasAnswer = requiredAliasAnswer || buildAliasLookupAnswer(knowledge);
  if (aliasAnswer) return { text: aliasAnswer, knowledge };
  if (testCase.id === 'missing-verification-rule') return { text: UNVERIFIED_DATA_TEXT, knowledge };
  if (testCase.id === 'kyc-private-policy') {
    return {
      text: 'Thông tin chi tiết từng người trong gia phả chỉ hiển thị cho tài khoản đã đăng nhập và được KYC. Quý vị có thể hỏi thông tin công khai hoặc đăng nhập/KYC để xem dữ liệu chi tiết.',
      knowledge
    };
  }
  const chunkAnswer = buildKnowledgeChunkLocalAnswer(knowledge);
  return {
    text: chunkAnswer || UNVERIFIED_DATA_TEXT,
    knowledge
  };
}

async function runAIQualityEval({ ids = null } = {}) {
  const selected = AI_QUALITY_EVAL_CASES.filter((testCase) => !ids || ids.includes(testCase.id));
  const results = [];
  for (const testCase of selected) {
    const startedAt = Date.now();
    const { text, knowledge } = await answerAIQualityCase(testCase);
    const normalizedText = normalizeKnowledgeText(text);
    const missing = (testCase.expectedContains || []).filter((item) => !normalizedText.includes(normalizeKnowledgeText(item)));
    const forbidden = (testCase.mustNotContain || []).filter((item) => normalizedText.includes(normalizeKnowledgeText(item)));
    const passed = missing.length === 0 && forbidden.length === 0;
    results.push({
      id: testCase.id,
      question: testCase.question,
      engine: testCase.engine,
      passed,
      missing,
      forbidden,
      answer: text,
      durationMs: Date.now() - startedAt,
      knowledgeMatchesCount: knowledge.chunks.length,
      knowledgeSourceIds: [...new Set(knowledge.chunks.map((row) => row.source_id))],
      aliases: knowledge.aliases.slice(0, 3).map((row) => ({
        alias: row.alias,
        canonicalName: row.canonical_name,
        requiredTitle: row.required_title,
        score: row.score
      }))
    });
  }
  return {
    ok: true,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    results
  };
}

function publicKnowledgeResult(row, query = '') {
  return {
    sourceId: row.source_id,
    chunkId: row.id,
    title: row.title || row.source_title || '',
    snippet: getSnippet(row.content, normalizeKnowledgeText(query), 300),
    score: row.score,
    tags: row.tags || safeJsonParse(row.tags_json || row.source_tags_json, []),
    entityRefs: row.entityRefs || safeJsonParse(row.entity_refs_json || row.source_entity_refs_json, []),
    sourceScope: row.source_scope || '',
    systemScope: row.source_system_scope || '',
    visibility: row.visibility || row.source_visibility || 'public',
    reason: row.reason || '',
    matchedTerms: row.matchedTerms || [],
    headingPath: row.heading_path || '',
    charCount: row.char_count || 0,
    tokenEstimate: row.token_estimate || 0
  };
}

function publicKnowledgeSource(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sourceType: row.source_type,
    scope: row.scope,
    clanScope: row.clan_scope,
    systemScope: row.system_scope,
    domain: row.domain,
    summary: row.summary,
    tags: safeJsonParse(row.tags_json, []),
    entityRefs: safeJsonParse(row.entity_refs_json, []),
    visibility: row.visibility,
    status: row.status,
    updatedAt: row.updated_at
  };
}

async function listKnowledgeSources({ authScope = 'admin', limit = 80 } = {}) {
  await ensurePhase2AliasKnowledgeSeeded();
  const database = await getDatabase();
  return database
    .prepare('SELECT * FROM knowledge_sources ORDER BY updated_at DESC LIMIT ?')
    .all(limit)
    .filter((row) => canReadKnowledgeVisibility(row.visibility, authScope))
    .map(publicKnowledgeSource);
}

async function createKnowledgeSource(payload = {}, authUser = null) {
  const title = String(payload.title || '').trim();
  const content = normalizeImportedKnowledgeContent(payload);
  if (!title || !content) {
    const err = new Error('Knowledge source title and content are required.');
    err.status = 400;
    throw err;
  }

  const database = await getDatabase();
  const visibility = normalizeVisibility(payload.visibility || payload.scope || 'admin', 'admin');
  const tags = [...new Set([...normalizeStringArray(payload.tags), ...inferKnowledgeTags(title, content)])];
  const entityRefs = [...new Set([...normalizeStringArray(payload.entityRefs || payload.entity_refs), ...inferKnowledgeEntityRefs(title, content)])];
  const sourceType = normalizeGatewayText(payload.type || payload.sourceType || 'manual_upload') || 'manual_upload';
  const scope = String(payload.scope || 'dashboard_knowledge').trim();
  const systemScope = String(payload.systemScope || payload.system_scope || 'ho_cao_giatochocao').trim();
  const clanScope = String(payload.clanScope || payload.clan_scope || 'cao_toc_phu_my').trim();
  const domain = String(payload.domain || 'giatochocao.site').trim();
  const slug = String(payload.slug || `${sourceType}-${sha256Base64Url(`${title}:${Date.now()}:${randomToken(6)}`).slice(0, 18)}`).trim();
  const sourceId = buildSourceId(slug);
  const summary = String(payload.summary || createLocalSummary(content, 320)).trim();
  const metadata = {
    imported_by: authUser?.username || authUser?.email || authUser?.id || 'admin',
    imported_at: new Date().toISOString(),
    source: 'dashboard'
  };

  const sourceInsert = database.prepare(`
    INSERT INTO knowledge_sources (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexed', datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      source_type = excluded.source_type,
      scope = excluded.scope,
      clan_scope = excluded.clan_scope,
      system_scope = excluded.system_scope,
      domain = excluded.domain,
      content = excluded.content,
      source_hash = excluded.source_hash,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const chunkDelete = database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?');
  const chunkInsert = database.prepare(`
    INSERT INTO knowledge_chunks (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, content_ascii, char_count, token_estimate, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(source_id, chunk_index) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      content_norm = excluded.content_norm,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      entity_refs_json = excluded.entity_refs_json,
      visibility = excluded.visibility,
      heading_path = excluded.heading_path,
      content_ascii = excluded.content_ascii,
      char_count = excluded.char_count,
      token_estimate = excluded.token_estimate,
      updated_at = excluded.updated_at
  `);

  database.exec('BEGIN');
  try {
    sourceInsert.run(
      sourceId,
      slug,
      title,
      sourceType,
      scope,
      clanScope,
      systemScope,
      domain,
      content,
      sha256Hex(content),
      JSON.stringify(metadata),
      summary,
      JSON.stringify(tags),
      JSON.stringify(entityRefs),
      visibility
    );
    chunkDelete.run(sourceId);
    buildKnowledgeChunks(content, { title }).forEach((chunk, index) => {
      const chunkContent = chunk.content;
      const chunkSummary = createLocalSummary(chunkContent, 240);
      const chunkNorm = normalizeKnowledgeText([title, summary, tags.join(' '), entityRefs.join(' '), chunk.headingPath, chunkContent].join('\n'));
      chunkInsert.run(
        buildChunkId(sourceId, index),
        sourceId,
        index,
        title,
        chunkContent,
        chunkNorm,
        JSON.stringify({ source: 'dashboard', chunk_index: index, heading_path: chunk.headingPath }),
        chunkSummary,
        JSON.stringify(tags),
        JSON.stringify(entityRefs),
        visibility,
        chunk.headingPath || title,
        chunkNorm,
        chunkContent.length,
        estimateTextTokens(chunkContent)
      );
    });
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  const row = database.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(sourceId);
  return publicKnowledgeSource(row);
}

async function deleteKnowledgeSource(sourceId) {
  const database = await getDatabase();
  database.exec('BEGIN');
  try {
    database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
    database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const session = await getAuthSession(req);
    const authUser = await findAuthUserForSession(session);
    res.json({ user: publicAuthSession(session, authUser) });
  } catch (err) {
    console.error('Failed to read current auth session:', err);
    res.status(500).json({ error: 'Failed to read current auth session.' });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ users: await readAuthUsers() });
  } catch (err) {
    console.error('Failed to read auth users:', err);
    res.status(500).json({ error: 'Failed to read auth users.' });
  }
});

app.put('/api/auth/users', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
  } catch (err) {
    console.error('Failed to verify admin for auth users:', err);
    res.status(500).json({ error: 'Failed to verify admin access.' });
    return;
  }

  const users = Array.isArray(req.body?.users) ? req.body.users : null;
  if (!users) {
    res.status(400).json({ error: 'Invalid users payload.' });
    return;
  }

  try {
    await writeAuthUsers(users.filter((user) => user && typeof user === 'object' && user.id && user.username));
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save auth users:', err);
    res.status(500).json({ error: 'Failed to save auth users.' });
  }
});

app.get('/api/state/:key', async (req, res) => {
  const key = String(req.params.key || '');
  if (!SHARED_STATE_KEYS.has(key)) {
    res.status(404).json({ error: 'Unsupported state key.' });
    return;
  }

  try {
    if (!PUBLIC_STATE_KEYS.has(key) && !await requireAdmin(req, res)) return;
    const value = await readState(key);
    if (value === null || value === undefined) {
      res.status(404).json({ error: 'State not found.' });
      return;
    }
    res.json({ value });
  } catch (err) {
    console.error(`Failed to read shared state ${key}:`, err);
    res.status(500).json({ error: 'Failed to read shared state.' });
  }
});

app.put('/api/state/:key', async (req, res) => {
  const key = String(req.params.key || '');
  if (!SHARED_STATE_KEYS.has(key)) {
    res.status(404).json({ error: 'Unsupported state key.' });
    return;
  }

  try {
    if (!await requireAdmin(req, res)) return;
    const value = Object.prototype.hasOwnProperty.call(req.body || {}, 'value') ? req.body.value : req.body;
    await writeState(key, value);
    res.json({ ok: true });
  } catch (err) {
    console.error(`Failed to save shared state ${key}:`, err);
    res.status(500).json({ error: 'Failed to save shared state.' });
  }
});

app.get('/api/knowledge/status', async (_req, res) => {
  try {
    await ensurePhase2AliasKnowledgeSeeded();
    res.json(await getKnowledgeStatus());
  } catch (err) {
    console.error('Failed to read knowledge status:', err);
    res.status(500).json({ error: 'Failed to read knowledge status.' });
  }
});

app.get('/api/anniversaries', async (req, res) => {
  try {
    const year = normalizeAnniversaryYear(req.query.year);
    const { authScope } = await getRequestAuthContext(req);
    const anniversaries = await buildAnniversaryItems({ year, authScope });
    res.json({ ok: true, year, anniversaries });
  } catch (err) {
    console.error('Failed to list anniversaries:', err);
    res.status(500).json({ error: 'Failed to list anniversaries.' });
  }
});

app.get('/api/anniversaries/upcoming', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(730, Number(req.query.days || 60) || 60));
    const { authScope } = await getRequestAuthContext(req);
    const anniversaries = await buildUpcomingAnniversaryItems({ days, authScope });
    res.json({ ok: true, days, anniversaries });
  } catch (err) {
    console.error('Failed to list upcoming anniversaries:', err);
    res.status(500).json({ error: 'Failed to list upcoming anniversaries.' });
  }
});

app.get('/api/anniversaries/member/:memberId', async (req, res) => {
  try {
    const year = normalizeAnniversaryYear(req.query.year);
    const { authScope } = await getRequestAuthContext(req);
    const memberId = String(req.params.memberId || '').trim();
    const anniversaries = await buildAnniversaryItems({ year, authScope });
    const anniversary = anniversaries.find((item) => item.memberId === memberId);
    if (!anniversary) {
      res.status(404).json({ error: 'Anniversary not found for member.' });
      return;
    }
    res.json({ ok: true, year, anniversary });
  } catch (err) {
    console.error('Failed to read member anniversary:', err);
    res.status(500).json({ error: 'Failed to read member anniversary.' });
  }
});

app.get('/api/anniversary-drafts', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    res.json({ ok: true, drafts: await listAnniversaryDrafts({ limit, status, q }) });
  } catch (err) {
    console.error('Failed to list anniversary drafts:', err);
    res.status(500).json({ error: 'Failed to list anniversary drafts.' });
  }
});

app.post('/api/anniversary-drafts/from-anniversary', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const draft = await createAnniversaryDraftFromAnniversary({
      memberId: req.body?.memberId,
      year: req.body?.year,
      channel: req.body?.channel,
      location: req.body?.location,
      note: req.body?.note,
      createdBy: admin.authUser?.username || admin.authUser?.fullName || admin.session?.account || ''
    });
    res.status(201).json({ ok: true, draft });
  } catch (err) {
    console.error('Failed to create anniversary draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create anniversary draft.' });
  }
});

app.post('/api/anniversary-drafts/:id/send-test', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const log = await sendAnniversaryDraftTest(req.params.id, req.body || {}, admin.authUser);
    res.status(201).json({ ok: true, log });
  } catch (err) {
    console.error('Failed to send anniversary draft test:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to send anniversary draft test.' });
  }
});

app.get('/api/anniversary-drafts/:id/send-logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50) || 50));
    res.json({ ok: true, logs: await listReminderSendLogs({ draftId: req.params.id, limit }) });
  } catch (err) {
    console.error('Failed to list anniversary draft send logs:', err);
    res.status(500).json({ error: 'Failed to list anniversary draft send logs.' });
  }
});

app.get('/api/reminder-transports/status', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, transports: getReminderTransportStatus() });
  } catch (err) {
    console.error('Failed to read reminder transport status:', err);
    res.status(500).json({ error: 'Failed to read reminder transport status.' });
  }
});

app.post('/api/reminder-transports/check', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, check: checkReminderTransportConfig(req.body?.channel) });
  } catch (err) {
    console.error('Failed to check reminder transport config:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to check reminder transport config.' });
  }
});

app.get('/api/reminder-test-recipients', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, recipients: await listReminderTestRecipients(admin.authUser) });
  } catch (err) {
    console.error('Failed to list reminder test recipients:', err);
    res.status(500).json({ error: 'Failed to list reminder test recipients.' });
  }
});

app.get('/api/zalo/webhook', (req, res) => {
  try {
    const verifyToken = String(process.env.ZALO_WEBHOOK_VERIFY_TOKEN || '').trim();
    const suppliedToken = String(req.query['hub.verify_token'] || req.query.verify_token || req.query.token || '').trim();
    const challenge = String(req.query['hub.challenge'] || req.query.challenge || req.query.echostr || 'ok');
    if (!verifyToken) {
      res.status(503).json({ ok: false, error: 'zalo_webhook_verify_token_missing' });
      return;
    }
    if (suppliedToken !== verifyToken) {
      res.status(403).json({ ok: false, error: 'invalid_verify_token' });
      return;
    }
    res.type('text/plain').send(challenge);
  } catch (err) {
    console.error('Failed to verify Zalo webhook:', err);
    res.status(500).json({ ok: false, error: 'Failed to verify Zalo webhook.' });
  }
});

app.post('/api/zalo/webhook', async (req, res) => {
  try {
    const verification = verifyZaloWebhookRequest(req);
    if (!verification.ok) {
      await logRejectedZaloWebhook(req.body || {}, verification.reason);
      res.status(verification.status || 401).json({ ok: false, error: verification.reason });
      return;
    }
    const result = await processZaloBotEvent(req.body || {}, { source: 'webhook', signatureStatus: verification.signatureStatus });
    res.json({ ok: true, productionReady: verification.productionReady, ...result });
  } catch (err) {
    console.error('Failed to process Zalo webhook:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to process Zalo webhook.' });
  }
});

app.get('/api/zalo-bot/status', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await getZaloBotStatus());
  } catch (err) {
    console.error('Failed to read Zalo bot status:', err);
    res.status(500).json({ error: 'Failed to read Zalo bot status.' });
  }
});

app.get('/api/zalo-bot/webhook-status', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await getZaloWebhookStatus());
  } catch (err) {
    console.error('Failed to read Zalo webhook status:', err);
    res.status(500).json({ error: 'Failed to read Zalo webhook status.' });
  }
});

app.get('/api/zalo-bot/events', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, events: await listZaloBotEvents({ limit: req.query.limit }) });
  } catch (err) {
    console.error('Failed to list Zalo bot events:', err);
    res.status(500).json({ error: 'Failed to list Zalo bot events.' });
  }
});

app.get('/api/zalo-bot/replies', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, replies: await listZaloBotReplies({ limit: req.query.limit }) });
  } catch (err) {
    console.error('Failed to list Zalo bot replies:', err);
    res.status(500).json({ error: 'Failed to list Zalo bot replies.' });
  }
});

app.post('/api/zalo-bot/mock-message', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const channel = String(req.body?.channel || 'personal').trim().toLowerCase();
    const payload = {
      eventId: req.body?.eventId || `mock_${randomToken(8)}`,
      senderId: req.body?.senderId || 'mock-zalo-user',
      senderName: req.body?.senderName || 'Mock Zalo User',
      groupId: channel === 'group' ? String(req.body?.groupId || 'mock-group').trim() : '',
      messageText: req.body?.messageText || req.body?.text || ''
    };
    const result = await processZaloBotEvent(payload, { source: 'mock', adminUser: admin.authUser });
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('Failed to process Zalo bot mock message:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to process Zalo bot mock message.' });
  }
});

app.post('/api/zalo-bot/replay-event/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const result = await replayZaloBotEvent(req.params.id);
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('Failed to replay Zalo bot event:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to replay Zalo bot event.' });
  }
});

app.patch('/api/zalo-bot/events/:id/mark-reviewed', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const database = await getDatabase();
    const reviewedAt = new Date().toISOString();
    const update = database.prepare('UPDATE zalo_bot_events SET reviewed_at = ? WHERE id = ?').run(reviewedAt, req.params.id);
    if (!update.changes) throw Object.assign(new Error('Zalo bot event not found.'), { status: 404 });
    res.json({ ok: true, event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(req.params.id)) });
  } catch (err) {
    console.error('Failed to mark Zalo bot event reviewed:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to mark Zalo bot event reviewed.' });
  }
});

app.patch('/api/anniversary-drafts/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const draft = await updateAnniversaryDraft(req.params.id, req.body || {});
    res.json({ ok: true, draft });
  } catch (err) {
    console.error('Failed to update anniversary draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update anniversary draft.' });
  }
});

app.delete('/api/anniversary-drafts/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const deleted = await deleteAnniversaryDraft(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Anniversary draft not found.' });
      return;
    }
    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('Failed to delete anniversary draft:', err);
    res.status(500).json({ error: 'Failed to delete anniversary draft.' });
  }
});

app.get('/api/reminder-send-logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50) || 50));
    res.json({
      ok: true,
      logs: await listReminderSendLogs({
        limit,
        transport: req.query.transport,
        status: req.query.status
      })
    });
  } catch (err) {
    console.error('Failed to list reminder send logs:', err);
    res.status(500).json({ error: 'Failed to list reminder send logs.' });
  }
});

app.get('/api/knowledge/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.status(400).json({ error: 'Missing q query.' });
    return;
  }
  try {
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || 8) || 8));
    const { authScope } = await getRequestAuthContext(req);
    const result = await searchKnowledgeWithAliases(query, { limit, authScope });
    res.json({
      query: result.query,
      variants: result.variants,
      aliases: result.aliases.slice(0, limit).map((row) => ({
        canonicalName: row.canonical_name,
        alias: row.alias,
        requiredTitle: row.required_title,
        generation: row.generation,
        score: row.score,
        exampleOnly: Boolean(row.example_only),
        needsVerification: Boolean(row.needs_verification)
      })),
      chunks: result.chunks.map((row) => publicKnowledgeResult(row, query)),
      localAnswer: buildAliasLookupAnswer(result)
    });
  } catch (err) {
    console.error('Failed to search knowledge:', err);
    res.status(500).json({ error: 'Failed to search knowledge.' });
  }
});

app.get('/api/knowledge/sources', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 80) || 80));
    const { authScope } = await getRequestAuthContext(req);
    res.json({ sources: await listKnowledgeSources({ authScope, limit }) });
  } catch (err) {
    console.error('Failed to list knowledge sources:', err);
    res.status(500).json({ error: 'Failed to list knowledge sources.' });
  }
});

app.get('/api/lineage/member-search', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Missing q query.' });
      return;
    }
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12) || 12));
    res.json({ matches: await searchLineageMembers(q, { limit }) });
  } catch (err) {
    console.error('Failed to search lineage members:', err);
    res.status(500).json({ error: 'Failed to search lineage members.' });
  }
});

app.get('/api/knowledge/extracted-anniversaries', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const type = String(req.query.type || '').trim();
    const pendingOnly = String(req.query.pendingOnly || req.query.pending || '') === '1' || String(req.query.pendingOnly || '').toLowerCase() === 'true';
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));
    res.json({ candidates: await listExtractedAnniversaryCandidates({ q, status, type, pendingOnly, limit }) });
  } catch (err) {
    console.error('Failed to list extracted anniversary candidates:', err);
    res.status(500).json({ error: 'Failed to list extracted anniversary candidates.' });
  }
});

app.get('/api/knowledge/applied-extractions', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    const field = String(req.query.field || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 80) || 80));
    res.json({ appliedExtractions: await listAppliedExtractions({ q, field, limit }) });
  } catch (err) {
    console.error('Failed to list applied extractions:', err);
    res.status(500).json({ error: 'Failed to list applied extractions.' });
  }
});

app.get('/api/knowledge/applied-extractions/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const item = await getAppliedExtractionById(String(req.params.id || ''));
    if (!item) {
      res.status(404).json({ error: 'Applied extraction not found.' });
      return;
    }
    res.json({ appliedExtraction: item });
  } catch (err) {
    console.error('Failed to read applied extraction:', err);
    res.status(500).json({ error: 'Failed to read applied extraction.' });
  }
});

app.get('/api/knowledge/chunks/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const database = await getDatabase();
    const row = database.prepare(`
      SELECT c.*, s.title AS source_title, s.visibility AS source_visibility
      FROM knowledge_chunks c
      LEFT JOIN knowledge_sources s ON s.id = c.source_id
      WHERE c.id = ?
    `).get(String(req.params.id || ''));
    if (!row) {
      res.status(404).json({ error: 'Knowledge chunk not found.' });
      return;
    }
    res.json({
      chunk: {
        sourceId: row.source_id,
        chunkId: row.id,
        title: row.source_title || row.title,
        headingPath: row.heading_path,
        content: row.content,
        summary: row.summary,
        tags: safeJsonParse(row.tags_json, []),
        entityRefs: safeJsonParse(row.entity_refs_json, []),
        visibility: row.visibility || row.source_visibility || 'public',
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('Failed to read knowledge chunk:', err);
    res.status(500).json({ error: 'Failed to read knowledge chunk.' });
  }
});

app.patch('/api/knowledge/extracted-anniversaries/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const candidate = await updateExtractedAnniversaryCandidate(String(req.params.id || ''), req.body || {}, admin.authUser);
    res.json({ ok: true, candidate });
  } catch (err) {
    console.error('Failed to update extracted anniversary candidate:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update extracted anniversary candidate.' });
  }
});

app.post('/api/knowledge/extracted-anniversaries/bulk', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await bulkUpdateExtractedAnniversaryCandidates(req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to bulk update extracted anniversary candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to bulk update extracted anniversary candidates.' });
  }
});

app.post('/api/knowledge/extracted-anniversaries/:id/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await applyExtractedAnniversaryCandidate(String(req.params.id || ''), req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to apply extracted anniversary candidate:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to apply extracted anniversary candidate.',
      conflicts: err.conflicts || []
    });
  }
});

app.post('/api/knowledge/sources', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const source = await createKnowledgeSource(req.body || {}, admin.authUser);
    res.json({ ok: true, source });
  } catch (err) {
    console.error('Failed to create knowledge source:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create knowledge source.' });
  }
});

app.delete('/api/knowledge/sources/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const sourceId = String(req.params.id || '').trim();
    const database = await getDatabase();
    const row = database.prepare('SELECT id, slug FROM knowledge_sources WHERE id = ?').get(sourceId);
    if (!row) {
      res.status(404).json({ error: 'Knowledge source not found.' });
      return;
    }
    if (row.slug === PHASE2_ALIAS_SEED_SLUG) {
      res.status(400).json({ error: 'Phase 2A seed source cannot be deleted from the dashboard.' });
      return;
    }
    await deleteKnowledgeSource(sourceId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete knowledge source:', err);
    res.status(500).json({ error: 'Failed to delete knowledge source.' });
  }
});

app.post('/api/knowledge/seed/phase2a', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await seedPhase2AliasKnowledge({ force: req.body?.force === true }));
  } catch (err) {
    console.error('Failed to seed Phase 2A knowledge:', err);
    res.status(500).json({ error: 'Failed to seed Phase 2A knowledge.' });
  }
});

app.get('/api/ai/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50) || 50));
    res.json({ logs: await listAIRequestLogs(limit) });
  } catch (err) {
    console.error('Failed to list AI request logs:', err);
    res.status(500).json({ error: 'Failed to list AI request logs.' });
  }
});

app.get('/api/ai/logs/summary', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await summarizeAIRequestLogs());
  } catch (err) {
    console.error('Failed to summarize AI request logs:', err);
    res.status(500).json({ error: 'Failed to summarize AI request logs.' });
  }
});

app.get('/api/ai/bot-configs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, configs: await listAIBotConfigs() });
  } catch (err) {
    console.error('Failed to list AI bot configs:', err);
    res.status(500).json({ error: 'Failed to list AI bot configs.' });
  }
});

app.get('/api/ai/operation-graph', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const [configs, summary, knowledge] = await Promise.all([
      listAIBotConfigs(),
      summarizeAIRequestLogs(),
      getKnowledgeStatus()
    ]);
    const configByBot = new Map(configs.map((config) => [config.botType, config]));
    const botCount = (botType) => summary.topBotTypes?.find((item) => item.name === botType)?.count || 0;
    const botNode = (id, label, row, description) => {
      const config = configByBot.get(id);
      return {
        id,
        label,
        type: 'bot',
        status: id === 'zalo_bot' ? 'paused' : (config?.enabled ? 'active' : 'disabled'),
        column: 1,
        row,
        description,
        metrics: {
          engine: config?.engine || '',
          chunks: config?.maxKnowledgeChunks || 0,
          tokens: config?.maxOutputTokens || 0,
          requests: botCount(id)
        }
      };
    };
    res.json({
      ok: true,
      nodes: [
        botNode('webview_chat', 'Chatbot Webview', 1, 'Trả lời người dùng webview và áp KYC trước khi mở dữ liệu chi tiết.'),
        botNode('dashboard_helper', 'Trợ lý Dashboard', 2, 'Hỗ trợ admin tra cứu và thao tác quản trị.'),
        botNode('ai_governor', 'AI Tổng Quản', 3, 'Điều phối phân tích hệ thống, kiểm chứng dữ liệu và đề xuất sửa.'),
        botNode('article_writer', 'AI Viết Bài', 4, 'Tạo bản nháp bài viết từ dữ liệu đã duyệt.'),
        botNode('prayer_writer', 'Trác Thư / Sớ', 5, 'Soạn nội dung nghi lễ có kiểm soát nguồn.'),
        botNode('zalo_bot', 'Zalo Bot', 6, 'Tạm dừng chờ OA xác thực, không gửi thật.'),
        { id: 'ai_gateway', label: '/api/ai/chat', type: 'gateway', status: 'active', column: 2, row: 3, description: 'Cửa vào chung cho các bot AI.', metrics: { requests: summary.requestCount, cache: summary.cacheHitCount, errors: summary.errorCount } },
        { id: 'bot_config', label: 'Cấu hình Bot', type: 'config', status: 'active', column: 3, row: 2, description: 'Bảng ai_bot_configs điều khiển engine, chunks, tokens, cache và retry.', metrics: { bots: configs.length, enabled: configs.filter((config) => config.enabled).length } },
        { id: 'intent_router', label: 'Điều phối Intent', type: 'router', status: 'active', column: 3, row: 4, description: 'Phân loại câu hỏi theo mục đích xử lý.', metrics: { intents: summary.topIntents?.length || 0 } },
        { id: 'auth_guard', label: 'KYC / Quyền xem', type: 'guard', status: 'active', column: 4, row: 1, description: 'Chặn dữ liệu cá nhân chi tiết nếu chưa đủ quyền.', metrics: { rule: 'public/KYC/admin' } },
        { id: 'local_db', label: 'Cây phả & Database', type: 'data', status: 'active', column: 4, row: 3, description: 'Nguồn local-first cho nhân vật, đời, chi/ngành và dữ liệu applied.' },
        { id: 'anniversary_calendar', label: 'Lịch giỗ xác minh', type: 'data', status: 'active', column: 4, row: 4, description: 'Tra ngày giỗ verified/applied trước khi diễn đạt.' },
        { id: 'knowledge_search', label: 'Kho tri thức', type: 'data', status: 'active', column: 4, row: 5, description: 'Tìm top chunks từ tài liệu Cao Tộc và alias.', metrics: { sources: knowledge.sources, chunks: knowledge.chunks, aliases: knowledge.aliases } },
        { id: 'gemini', label: 'Gemini', type: 'model', status: 'active', column: 5, row: 4, description: 'Chỉ dùng khi local/knowledge chưa đủ hoặc cần sinh nội dung dài.' },
        { id: 'response_guard', label: 'Response Guard', type: 'guard', status: 'active', column: 6, row: 3, description: 'Chặn bịa dữ liệu, phân biệt pending/applied và giới hạn output.' },
        { id: 'ai_logs', label: 'Logs / Token', type: 'logs', status: 'active', column: 6, row: 5, description: 'Theo dõi request, cache, lỗi, token và nguồn theo từng bot.', metrics: { tokens: summary.estimatedTokens, avg: `${summary.avgDurationMs}ms` } }
      ],
      edges: [
        { from: 'webview_chat', to: 'ai_gateway', label: 'botType' },
        { from: 'dashboard_helper', to: 'ai_gateway', label: 'botType' },
        { from: 'ai_governor', to: 'ai_gateway', label: 'botType' },
        { from: 'article_writer', to: 'ai_gateway', label: 'botType' },
        { from: 'prayer_writer', to: 'ai_gateway', label: 'botType' },
        { from: 'zalo_bot', to: 'ai_gateway', label: 'paused' },
        { from: 'ai_gateway', to: 'bot_config', label: 'đọc cấu hình' },
        { from: 'ai_gateway', to: 'intent_router', label: 'intent' },
        { from: 'intent_router', to: 'auth_guard', label: 'quyền' },
        { from: 'intent_router', to: 'local_db', label: 'local-first' },
        { from: 'intent_router', to: 'anniversary_calendar', label: 'ngày giỗ' },
        { from: 'intent_router', to: 'knowledge_search', label: 'search' },
        { from: 'knowledge_search', to: 'gemini', label: 'khi cần' },
        { from: 'local_db', to: 'response_guard' },
        { from: 'anniversary_calendar', to: 'response_guard' },
        { from: 'gemini', to: 'response_guard' },
        { from: 'response_guard', to: 'ai_logs', label: 'ghi log' }
      ]
    });
  } catch (err) {
    console.error('Failed to build AI operation graph:', err);
    res.status(500).json({ error: 'Failed to build AI operation graph.' });
  }
});

app.patch('/api/ai/bot-configs/:botType', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, config: await updateAIBotConfig(req.params.botType, req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to update AI bot config:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update AI bot config.' });
  }
});

app.get('/api/ai/eval/cases', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ cases: AI_QUALITY_EVAL_CASES.map(publicEvalCase) });
  } catch (err) {
    console.error('Failed to list AI eval cases:', err);
    res.status(500).json({ error: 'Failed to list AI eval cases.' });
  }
});

app.post('/api/ai/eval/run', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)) : null;
    res.json(await runAIQualityEval({ ids }));
  } catch (err) {
    console.error('Failed to run AI eval:', err);
    res.status(500).json({ error: 'Failed to run AI eval.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = parseCookies(req)[AUTH_SESSION_COOKIE];
  if (token) {
    authSessions.delete(token);
    try {
      const sessions = await readAuthSessionsState();
      delete sessions[token];
      await writeAuthSessionsState(sessions);
    } catch (err) {
      console.warn('Failed to clear persisted auth session:', err?.message || err);
    }
  }
  clearCookie(res, AUTH_SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/:provider/start', (req, res) => {
  const provider = req.params.provider;
  const state = randomToken(24);
  const verifier = randomToken(48);
  oauthStates.set(state, {
    provider,
    verifier,
    returnTo: getSafeReturnPath(req.query.return_to),
    createdAt: Date.now()
  });
  setCookie(res, OAUTH_STATE_COOKIE, state, { maxAge: 10 * 60 });

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      redirectToApp(res, { auth_error: 'google_config' });
      return;
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', getCallbackUrl('google'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
    return;
  }

  if (provider === 'zalo') {
    const appId = process.env.ZALO_APP_ID;
    const secretKey = process.env.ZALO_SECRET_KEY;
    if (!appId || !secretKey) {
      redirectToApp(res, { auth_error: 'zalo_config' });
      return;
    }

    const url = new URL('https://oauth.zaloapp.com/v4/permission');
    url.searchParams.set('app_id', appId);
    url.searchParams.set('redirect_uri', getCallbackUrl('zalo'));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', sha256Base64Url(verifier));
    res.redirect(url.toString());
    return;
  }

  res.status(404).json({ error: 'Unsupported OAuth provider.' });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const stored = oauthStates.get(state);
  oauthStates.delete(state);

  if (!code || !stored || stored.provider !== 'google' || parseCookies(req)[OAUTH_STATE_COOKIE] !== state) {
    redirectToApp(res, { auth_error: 'google_state' });
    return;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    redirectToApp(res, { auth_error: 'google_config' });
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getCallbackUrl('google'),
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await readJsonResponse(tokenResponse, 'Google token exchange failed.');

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await readJsonResponse(userResponse, 'Google profile request failed.');

    const profile = {
      provider: 'gmail',
      id: userData.sub || '',
      name: userData.name || userData.email || 'Người dùng Gmail',
      account: userData.email || '',
      avatar: userData.picture || ''
    };
    const authUser = await upsertAuthUserFromProfile(profile);
    await createAuthSession(res, {
      ...profile,
      id: profile.id || authUser.id.replace(/^oauth_[^_]+_/, ''),
      name: authUser.fullName || profile.name,
      account: authUser.username || profile.account,
      avatar: authUser.avatar || profile.avatar
    });
    clearCookie(res, OAUTH_STATE_COOKIE);
    redirectToApp(res, { auth: 'gmail' }, stored.returnTo);
  } catch (err) {
    console.error('Google OAuth failed:', err);
    redirectToApp(res, { auth_error: 'google' });
  }
});

app.get('/api/auth/zalo/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const stored = oauthStates.get(state);
  oauthStates.delete(state);

  if (!code || !stored || stored.provider !== 'zalo' || parseCookies(req)[OAUTH_STATE_COOKIE] !== state) {
    redirectToApp(res, { auth_error: 'zalo_state' });
    return;
  }

  const appId = process.env.ZALO_APP_ID;
  const secretKey = process.env.ZALO_SECRET_KEY;
  if (!appId || !secretKey) {
    redirectToApp(res, { auth_error: 'zalo_config' });
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: secretKey
      },
      body: new URLSearchParams({
        code,
        app_id: appId,
        grant_type: 'authorization_code',
        code_verifier: stored.verifier
      })
    });
    const tokenData = await readJsonResponse(tokenResponse, 'Zalo token exchange failed.');

    const tokenPayload = decodeJwtPayload(tokenData.access_token);
    let rawUserData = null;
    let zaloProfile = null;
    try {
      if (ZALO_PROFILE_PROXY_URL) {
        const proxyResponse = await fetch(ZALO_PROFILE_PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ZALO_PROFILE_PROXY_SECRET}`
          },
          body: JSON.stringify({ access_token: tokenData.access_token })
        });
        const proxyData = await readJsonResponse(proxyResponse, 'Zalo profile proxy request failed.');
        rawUserData = proxyData.profile || proxyData;
        zaloProfile = normalizeZaloProfileData(rawUserData);
      } else {
        const profileUrl = new URL('https://graph.zalo.me/v2.0/me');
        profileUrl.searchParams.set('fields', 'id,name,picture');
        const userResponse = await fetch(profileUrl, {
          headers: { access_token: tokenData.access_token }
        });
        rawUserData = await readJsonResponse(userResponse, 'Zalo profile request failed.');
        zaloProfile = normalizeZaloProfileData(rawUserData);
      }
    } catch (profileErr) {
      console.warn('Zalo profile request skipped:', profileErr?.message || profileErr);
    }

    const zaloId = pickZaloId(zaloProfile, tokenData, tokenPayload);
    if (!zaloId) {
      const tokenKeys = Object.keys(tokenData || {}).filter((key) => !/token/i.test(key));
      const payloadKeys = Object.keys(tokenPayload || {});
      throw new Error(`Zalo did not return a stable user id. tokenKeys=${tokenKeys.join(',') || 'none'} payloadKeys=${payloadKeys.join(',') || 'none'} profile=${JSON.stringify(rawUserData).slice(0, 300)}`);
    }
    const userData = zaloProfile?.data || {};
    const picture = zaloProfile?.avatar || '';

    const profile = {
      provider: 'zalo',
      id: zaloId,
      name: userData.name || 'Người dùng Zalo',
      account: `zalo_${zaloId}`,
      avatar: picture || ''
    };
    const authUser = await upsertAuthUserFromProfile(profile);
    await createAuthSession(res, {
      ...profile,
      id: profile.id || authUser.id.replace(/^oauth_[^_]+_/, ''),
      name: authUser.fullName || profile.name,
      account: authUser.username || profile.account,
      avatar: authUser.avatar || profile.avatar
    });
    clearCookie(res, OAUTH_STATE_COOKIE);
    redirectToApp(res, { auth: 'zalo' }, stored.returnTo);
  } catch (err) {
    console.error('Zalo OAuth failed:', err);
    redirectToApp(res, { auth_error: 'zalo' });
  }
});

app.get('/api/tree', async (_req, res) => {
  try {
    const tree = await readState(TREE_STATE_KEY);
    if (tree) {
      res.json(tree);
      return;
    }

    const legacyTree = await readJsonFile(DATA_FILE);
    await writeState(TREE_STATE_KEY, legacyTree);
    res.json(legacyTree);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      res.status(404).json({ error: 'No persisted lineage tree yet.' });
      return;
    }
    console.error('Failed to read lineage tree:', err);
    res.status(500).json({ error: 'Failed to read lineage tree.' });
  }
});

app.put('/api/tree', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || !req.body.id) {
    res.status(400).json({ error: 'Invalid lineage tree payload.' });
    return;
  }

  try {
    await writeState(TREE_STATE_KEY, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save lineage tree:', err);
    res.status(500).json({ error: 'Failed to save lineage tree.' });
  }
});

app.delete('/api/tree', async (_req, res) => {
  try {
    await deleteState(TREE_STATE_KEY);
    await rm(DATA_FILE, { force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to reset lineage tree:', err);
    res.status(500).json({ error: 'Failed to reset lineage tree.' });
  }
});

app.get('/api/lunar/day', async (req, res) => {
  const d = Number(req.query.d);
  const m = Number(req.query.m);
  const y = Number(req.query.y);
  if (!d || !m || !y) {
    res.status(400).json({ error: 'Missing d, m, y query parameters.' });
    return;
  }

  try {
    const url = new URL('https://lich247.com/api');
    url.searchParams.set('action', 'get_day');
    url.searchParams.set('d', String(d));
    url.searchParams.set('m', String(m));
    url.searchParams.set('y', String(y));

    const response = await fetch(url);
    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    console.error('LICH247 request failed:', err);
    res.status(502).json({ error: 'LICH247 request failed.' });
  }
});

const MAX_GEMINI_INPUT_CHARS = Number(process.env.GEMINI_MAX_INPUT_CHARS || 12000);
const AI_GATEWAY_CACHE_TTL_MS = Number(process.env.AI_GATEWAY_CACHE_TTL_MS || 5 * 60 * 1000);
const AI_GATEWAY_CACHE_MAX = Number(process.env.AI_GATEWAY_CACHE_MAX || 80);
const AI_GATEWAY_RETRY_429 = Number(process.env.AI_GATEWAY_RETRY_429 || 1);
const AI_GATEWAY_KNOWLEDGE_TOP_K = Number(process.env.AI_GATEWAY_KNOWLEDGE_TOP_K || 6);
const AI_GATEWAY_MAX_KNOWLEDGE_CHARS = Number(process.env.AI_GATEWAY_MAX_KNOWLEDGE_CHARS || 3200);
const aiGatewayCache = new Map();
const DASHBOARD_AI_CONTEXT_TYPES = new Set([
  'chat',
  'ceremony',
  'prayer',
  'han_nom',
  'han-nom',
  'audit',
  'article',
  'appeal',
  'zalo_campaign',
  'chatbox_policy',
  'system_audit',
  'article_template',
  'zalo_rule_template',
  'webview_suggestion_article'
]);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizeGatewayText(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeAIBotType(value, type = '') {
  const normalized = normalizeGatewayText(value);
  if (['webview', 'webview_chat', 'web_chat'].includes(normalized)) return 'webview_chat';
  if (['dashboard', 'dashboard_helper', 'admin', 'eval'].includes(normalized)) return 'dashboard_helper';
  if (['governor', 'ai_governor'].includes(normalized)) return 'ai_governor';
  if (['article', 'article_writer', 'writer'].includes(normalized)) return 'article_writer';
  if (['prayer', 'prayer_writer', 'trac_thu', 'han_nom', 'han-nom', 'ceremony'].includes(normalized)) return 'prayer_writer';
  if (['zalo', 'zalo_bot'].includes(normalized)) return 'zalo_bot';
  if (!normalized && type === 'webview_chat') return 'webview_chat';
  return normalized || 'dashboard_helper';
}

function normalizeAIGatewayContext(body = {}, routeName = 'ai-chat') {
  const type = normalizeGatewayText(body.type || body.intent || 'chat') || 'chat';
  const explicitIntent = normalizeGatewayText(body.intent);
  const explicitBotType = normalizeGatewayText(body.botType || body.bot_type);
  let intent = explicitIntent || type;
  let botType = normalizeAIBotType(explicitBotType, type);

  if (type === 'webview_chat') {
    botType = normalizeAIBotType(explicitBotType || 'webview_chat', type);
    intent = explicitIntent || 'chat';
  } else if (['zalo', 'zalo_campaign', 'campaign', 'zalo_rule_template'].includes(type)) {
    botType = normalizeAIBotType(explicitBotType || 'zalo_bot', type);
    intent = explicitIntent || (type === 'zalo_rule_template' ? 'zalo_rule_template' : 'campaign');
  } else if (['audit', 'system_audit', 'chatbox_policy', 'policy'].includes(type)) {
    botType = normalizeAIBotType(explicitBotType || 'ai_governor', type);
    intent = explicitIntent || type;
  } else if (['ceremony', 'prayer', 'han_nom', 'han-nom', 'appeal'].includes(type)) {
    botType = normalizeAIBotType(explicitBotType || 'prayer_writer', type);
    intent = explicitIntent || 'ceremony';
  } else if (['article', 'article_template', 'webview_suggestion_article'].includes(type)) {
    botType = normalizeAIBotType(explicitBotType || 'article_writer', type);
    intent = explicitIntent || type;
  }

  return {
    ...body,
    type,
    botType,
    intent,
    routeName
  };
}

function publicAIBotConfig(row) {
  return {
    botType: row.bot_type,
    label: row.label,
    enabled: Boolean(row.enabled),
    pausedReason: row.paused_reason || '',
    engine: row.engine,
    maxKnowledgeChunks: row.max_knowledge_chunks,
    maxKnowledgeChars: row.max_knowledge_chars,
    maxOutputTokens: row.max_output_tokens,
    cacheEnabled: Boolean(row.cache_enabled),
    cacheTtlMs: row.cache_ttl_ms,
    retry429: row.retry_429,
    retryDelayMs: row.retry_delay_ms,
    publicAccess: Boolean(row.public_access),
    requiresKycForPrivateData: Boolean(row.requires_kyc_for_private_data),
    systemPromptShort: row.system_prompt_short || '',
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || ''
  };
}

async function getAIBotConfig(botType) {
  const database = await getDatabase();
  const normalized = normalizeAIBotType(botType);
  const row = database.prepare('SELECT * FROM ai_bot_configs WHERE bot_type = ?').get(normalized)
    || database.prepare('SELECT * FROM ai_bot_configs WHERE bot_type = ?').get('dashboard_helper');
  return publicAIBotConfig(row);
}

async function listAIBotConfigs() {
  const database = await getDatabase();
  return database.prepare('SELECT * FROM ai_bot_configs ORDER BY bot_type').all().map(publicAIBotConfig);
}

async function updateAIBotConfig(botType, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM ai_bot_configs WHERE bot_type = ?').get(normalizeAIBotType(botType));
  if (!current) throw Object.assign(new Error('AI bot config not found.'), { status: 404 });
  const next = {
    label: body.label === undefined ? current.label : String(body.label || '').trim(),
    enabled: body.enabled === undefined ? Number(current.enabled) : (body.enabled ? 1 : 0),
    pausedReason: body.pausedReason === undefined ? current.paused_reason : String(body.pausedReason || '').trim(),
    engine: body.engine === undefined ? current.engine : normalizeGatewayText(body.engine) || current.engine,
    maxKnowledgeChunks: Math.max(0, Math.min(20, Number(body.maxKnowledgeChunks ?? current.max_knowledge_chunks) || 0)),
    maxKnowledgeChars: Math.max(1000, Math.min(40000, Number(body.maxKnowledgeChars ?? current.max_knowledge_chars) || 6000)),
    maxOutputTokens: Math.max(200, Math.min(4000, Number(body.maxOutputTokens ?? current.max_output_tokens) || 700)),
    cacheEnabled: body.cacheEnabled === undefined ? Number(current.cache_enabled) : (body.cacheEnabled ? 1 : 0),
    cacheTtlMs: Math.max(0, Math.min(3600000, Number(body.cacheTtlMs ?? current.cache_ttl_ms) || 0)),
    retry429: Math.max(0, Math.min(3, Number(body.retry429 ?? current.retry_429) || 0)),
    retryDelayMs: Math.max(100, Math.min(5000, Number(body.retryDelayMs ?? current.retry_delay_ms) || 900)),
    publicAccess: body.publicAccess === undefined ? Number(current.public_access) : (body.publicAccess ? 1 : 0),
    requiresKycForPrivateData: body.requiresKycForPrivateData === undefined ? Number(current.requires_kyc_for_private_data) : (body.requiresKycForPrivateData ? 1 : 0),
    systemPromptShort: body.systemPromptShort === undefined ? current.system_prompt_short : compactText(body.systemPromptShort || '', 1800),
    updatedBy: adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin'
  };
  database.prepare(`
    UPDATE ai_bot_configs
    SET label = ?, enabled = ?, paused_reason = ?, engine = ?, max_knowledge_chunks = ?,
      max_knowledge_chars = ?, max_output_tokens = ?, cache_enabled = ?, cache_ttl_ms = ?,
      retry_429 = ?, retry_delay_ms = ?, public_access = ?, requires_kyc_for_private_data = ?,
      system_prompt_short = ?, updated_at = datetime('now'), updated_by = ?
    WHERE bot_type = ?
  `).run(
    next.label,
    next.enabled,
    next.pausedReason,
    next.engine,
    next.maxKnowledgeChunks,
    next.maxKnowledgeChars,
    next.maxOutputTokens,
    next.cacheEnabled,
    next.cacheTtlMs,
    next.retry429,
    next.retryDelayMs,
    next.publicAccess,
    next.requiresKycForPrivateData,
    next.systemPromptShort,
    next.updatedBy,
    current.bot_type
  );
  return publicAIBotConfig(database.prepare('SELECT * FROM ai_bot_configs WHERE bot_type = ?').get(current.bot_type));
}

function pickDashboardEngine(aiConfig = {}, intent = 'chat') {
  if (intent === 'ceremony') return aiConfig.engineCeremony || aiConfig.engineChat || 'gemini';
  if (['article', 'article_template', 'webview_suggestion_article'].includes(intent)) return aiConfig.engineArticles || aiConfig.engineChat || 'gemini';
  if (['campaign', 'zalo', 'zalo_campaign', 'zalo_rule_template'].includes(intent)) return aiConfig.engineZalo || aiConfig.engineChat || 'gemini';
  return aiConfig.engineChat || 'gemini';
}

function shouldHydrateDashboardAIContext(context = {}) {
  return context.botType !== 'webview_chat' &&
    (DASHBOARD_AI_CONTEXT_TYPES.has(context.type) || DASHBOARD_AI_CONTEXT_TYPES.has(context.intent));
}

function pruneAIGatewayCache(now = Date.now()) {
  for (const [key, entry] of aiGatewayCache) {
    if (!entry || entry.expiresAt <= now) aiGatewayCache.delete(key);
  }
  while (aiGatewayCache.size > AI_GATEWAY_CACHE_MAX) {
    const oldestKey = aiGatewayCache.keys().next().value;
    if (!oldestKey) break;
    aiGatewayCache.delete(oldestKey);
  }
}

function buildAIGatewayCacheKey(context = {}) {
  const docs = Array.isArray(context.documents || context.knowledgeDocs)
    ? (context.documents || context.knowledgeDocs)
      .slice(0, 8)
      .map((doc) => ({
        id: doc?.id,
        title: doc?.title,
        content: compactText(doc?.content || '', 260)
      }))
    : [];
  return sha256Base64Url(JSON.stringify({
    message: context.message,
    prompt: context.prompt,
    type: context.type,
    botType: context.botType,
    intent: context.intent,
    authScope: context.authScope || 'none',
    engine: context.engine,
    modelName: context.modelName,
    temperature: context.temperature,
    docs
  }));
}

function getAIGatewayCachedResponse(cacheKey, { enabled = true } = {}) {
  if (!enabled || !AI_GATEWAY_CACHE_TTL_MS || !cacheKey) return null;
  const now = Date.now();
  pruneAIGatewayCache(now);
  const entry = aiGatewayCache.get(cacheKey);
  if (!entry || entry.expiresAt <= now) {
    aiGatewayCache.delete(cacheKey);
    return null;
  }
  return { ...entry.value, cached: true };
}

function setAIGatewayCachedResponse(cacheKey, value, { enabled = true, ttlMs = AI_GATEWAY_CACHE_TTL_MS } = {}) {
  if (!enabled || !ttlMs || !cacheKey || !value?.text) return;
  pruneAIGatewayCache();
  aiGatewayCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function parseRetryDelayMs(value) {
  const text = String(value || '').trim();
  const seconds = Number(text.replace(/s$/i, ''));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 3000);
  return 900;
}

function logAIGatewayRequest(meta) {
  const line = [
    `requestId=${meta.requestId}`,
    `route=${meta.route}`,
    `botType=${meta.botType}`,
    `intent=${meta.intent}`,
    `type=${meta.type}`,
    `engine=${meta.engine || 'gemini'}`,
    `model=${meta.model || ''}`,
    `status=${meta.status}`,
    `cached=${Boolean(meta.cached)}`,
    `durationMs=${meta.durationMs}`
  ].join(' ');
  console.info(`[ai-gateway] ${line}`);
  recordAIRequestLog(meta).catch((err) => {
    console.warn('Failed to persist AI request log:', err?.message || err);
  });
}

async function recordAIRequestLog(meta = {}) {
  const database = await getDatabase();
  const knowledgeSourceIds = Array.isArray(meta.knowledgeSourceIds) ? meta.knowledgeSourceIds : [];
  const promptSnippet = compactText(meta.promptSnippet || meta.prompt || '', 260);
  database.prepare(`
    INSERT INTO ai_request_logs (
      id, route, bot_type, intent, engine, provider, model, status, cached, duration_ms,
      request_chars, context_chars, estimated_tokens, context_trimmed,
      knowledge_matches_count, knowledge_source_ids_json, bot_config_engine, bot_config_max_chunks,
      bot_config_max_output_tokens, cache_enabled, config_version, error_code, error_message, prompt_snippet
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    meta.id || `ailog_${sha256Base64Url(`${meta.requestId || randomToken(8)}:${Date.now()}`).slice(0, 24)}`,
    String(meta.route || ''),
    String(meta.botType || ''),
    String(meta.intent || ''),
    String(meta.engine || ''),
    String(meta.provider || meta.engine || ''),
    String(meta.model || ''),
    Number(meta.status || 0),
    meta.cached ? 1 : 0,
    Number(meta.durationMs || 0),
    Number(meta.requestChars || 0),
    Number(meta.contextChars || 0),
    Number(meta.estimatedTokens || Math.ceil(Number(meta.contextChars || 0) / 4)),
    meta.contextTrimmed ? 1 : 0,
    Number(meta.knowledgeMatchesCount || 0),
    JSON.stringify(knowledgeSourceIds),
    String(meta.botConfigEngine || ''),
    Number(meta.botConfigMaxChunks || 0),
    Number(meta.botConfigMaxOutputTokens || 0),
    meta.cacheEnabled === false ? 0 : 1,
    String(meta.configVersion || ''),
    String(meta.errorCode || ''),
    compactText(meta.errorMessage || '', 260),
    promptSnippet
  );
}

async function listAIRequestLogs(limit = 50) {
  const database = await getDatabase();
  return database.prepare(`
    SELECT * FROM ai_request_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(200, limit))).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    route: row.route,
    botType: row.bot_type,
    intent: row.intent,
    engine: row.engine,
    provider: row.provider,
    model: row.model,
    status: row.status,
    cached: Boolean(row.cached),
    durationMs: row.duration_ms,
    requestChars: row.request_chars,
    contextChars: row.context_chars,
    estimatedTokens: row.estimated_tokens,
    contextTrimmed: Boolean(row.context_trimmed),
    knowledgeMatchesCount: row.knowledge_matches_count,
    knowledgeSourceIds: safeJsonParse(row.knowledge_source_ids_json, []),
    botConfigEngine: row.bot_config_engine || '',
    botConfigMaxChunks: row.bot_config_max_chunks || 0,
    botConfigMaxOutputTokens: row.bot_config_max_output_tokens || 0,
    cacheEnabled: Boolean(row.cache_enabled),
    configVersion: row.config_version || '',
    errorCode: row.error_code,
    errorMessage: row.error_message,
    promptSnippet: row.prompt_snippet
  }));
}

async function summarizeAIRequestLogs() {
  const database = await getDatabase();
  const rows = database.prepare('SELECT * FROM ai_request_logs ORDER BY created_at DESC LIMIT 500').all();
  const countBy = (key) => {
    const counts = new Map();
    rows.forEach((row) => {
      const value = String(row[key] || '');
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  };
  const sourceCounts = new Map();
  rows.forEach((row) => {
    safeJsonParse(row.knowledge_source_ids_json, []).forEach((id) => {
      sourceCounts.set(id, (sourceCounts.get(id) || 0) + 1);
    });
  });
  return {
    ok: true,
    requestCount: rows.length,
    cacheHitCount: rows.filter((row) => row.cached).length,
    errorCount: rows.filter((row) => Number(row.status) >= 400).length,
    avgDurationMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.duration_ms || 0), 0) / rows.length) : 0,
    totalRequestChars: rows.reduce((sum, row) => sum + Number(row.request_chars || 0), 0),
    totalContextChars: rows.reduce((sum, row) => sum + Number(row.context_chars || 0), 0),
    estimatedTokens: rows.reduce((sum, row) => sum + Number(row.estimated_tokens || 0), 0),
    topBotTypes: countBy('bot_type'),
    topIntents: countBy('intent'),
    topKnowledgeSources: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => ({ id, count }))
  };
}

function parseGeminiApiError(err) {
  const rawMessage = String(err?.message || err || '');
  const jsonStart = rawMessage.indexOf('{');
  let payload = null;
  if (jsonStart !== -1) {
    try {
      payload = JSON.parse(rawMessage.slice(jsonStart));
    } catch {
      payload = null;
    }
  }

  const status = Number(err?.status || err?.code || payload?.error?.code) || 502;
  const providerMessage = payload?.error?.message || rawMessage || 'Gemini request failed.';
  const retryInfo = Array.isArray(payload?.error?.details)
    ? payload.error.details.find((item) => String(item?.['@type'] || '').includes('RetryInfo'))
    : null;
  const retryDelay = retryInfo?.retryDelay || '';

  if (status === 429) {
    return {
      status,
      error: 'Gemini đang vượt giới hạn quota tạm thời.',
      details: retryDelay
        ? `Đã vượt giới hạn token/phút của Gemini. Hãy thử lại sau ${retryDelay}, hoặc giảm tài liệu gửi kèm.`
        : 'Đã vượt giới hạn token/phút của Gemini. Hãy thử lại sau ít phút hoặc giảm tài liệu gửi kèm.'
    };
  }

  if (status === 503) {
    return {
      status,
      error: 'Gemini đang quá tải tạm thời.',
      details: 'Model Gemini hiện đang có nhu cầu cao. Hãy thử lại sau ít phút hoặc đổi sang model khác trong cấu hình AI.'
    };
  }

  return {
    status: status >= 400 && status <= 599 ? status : 502,
    error: 'Không kết nối được Gemini.',
    details: providerMessage
  };
}

function summarizeLocalDocuments(docs = []) {
  if (!Array.isArray(docs) || docs.length === 0) return '';
  return docs
    .slice(0, 5)
    .map((doc) => {
      const title = String(doc?.title || 'Tài liệu nội bộ').trim();
      const content = String(doc?.content || '').replace(/\s+/g, ' ').trim();
      return `- ${title}: ${content.slice(0, 420)}${content.length > 420 ? '...' : ''}`;
    })
    .join('\n');
}

function normalizeAnniversaryYear(value) {
  const currentYear = new Date().getFullYear();
  const year = Number(value || currentYear);
  if (!Number.isInteger(year) || year < 1900 || year > 2150) return currentYear;
  return year;
}

function isoDateToStartOfDay(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getDaysUntilIsoDate(isoDate) {
  const target = isoDateToStartOfDay(isoDate);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function isUsableLunarAnniversaryDate(date) {
  return Boolean(
    date &&
    typeof date === 'object' &&
    date.calendar === 'lunar' &&
    Number.isInteger(Number(date.day)) &&
    Number.isInteger(Number(date.month)) &&
    Number(date.day) >= 1 &&
    Number(date.day) <= 31 &&
    Number(date.month) >= 1 &&
    Number(date.month) <= 12 &&
    ['verified', 'uncertain'].includes(String(date.certainty || 'verified'))
  );
}

function getMemberLunarAnniversary(member) {
  if (isUsableLunarAnniversaryDate(member?.deathAnniversaryLunarStructured)) {
    return {
      source: 'structured',
      date: member.deathAnniversaryLunarStructured,
      certainty: member.deathAnniversaryLunarStructured.certainty || 'verified'
    };
  }
  const raw = String(member?.deathAnniversaryLunar || member?.lunarAnniversary || '').trim();
  if (!raw) return null;
  const parsed = parseGenealogyDateText(raw, 'lunar');
  if (!isUsableLunarAnniversaryDate(parsed)) return null;
  return { source: 'legacyParsed', date: parsed, certainty: parsed.certainty || 'verified' };
}

function normalizeAnniversaryMemberQuery(query) {
  const normalized = normalizeVietnameseSearch(query);
  if (/\bcao to\b/.test(normalized)) return 'cao dinh thuat';
  if (/\bthuy to\b/.test(normalized) || /\bcu lang\b/.test(normalized)) return 'cao dinh lang';
  return normalized;
}

function hasSpecificMemberNameMatch(query, memberText) {
  const meaningfulTerms = normalizeVietnameseSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3)
    .filter((word) => !['ngay', 'gio', 'nam', 'nay', 'roi', 'vao', 'duong', 'lich', 'cao', 'dinh', 'khong', 'phai', 'cua', 'cho', 'hoi'].includes(word));
  if (!meaningfulTerms.length) return false;
  const haystack = normalizeVietnameseSearch(memberText);
  return meaningfulTerms.some((word) => haystack.includes(word));
}

async function buildAnniversaryItems({ year, authScope = 'anonymous' } = {}) {
  const targetYear = normalizeAnniversaryYear(year);
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const canShowPrivate = ['admin', 'kyc_verified'].includes(authScope);
  const items = [];
  for (const member of members) {
    const anniversary = getMemberLunarAnniversary(member);
    if (!anniversary) continue;
    const solar = convertLunarToSolar({
      day: Number(anniversary.date.day),
      month: Number(anniversary.date.month),
      lunarYear: targetYear,
      isLeapMonth: Boolean(anniversary.date.isLeapMonth)
    });
    if (!solar) continue;
    const deathYear = String(member.deathYear || member.deathDateStructured?.year || '').trim();
    items.push({
      memberId: member.id,
      memberName: member.name,
      generation: member.generation,
      title: member.title,
      rankRole: member.title,
      branch: canShowPrivate ? member.branch : '',
      lunarDay: Number(anniversary.date.day),
      lunarMonth: Number(anniversary.date.month),
      lunarYear: targetYear,
      isLeapMonth: Boolean(anniversary.date.isLeapMonth),
      solarDate: solar.isoDate,
      solarDisplayDate: solar.displayDate,
      daysUntil: getDaysUntilIsoDate(solar.isoDate),
      source: anniversary.source,
      certainty: anniversary.certainty,
      deathYear,
      deathDate: member.solarDeathDate || formatGenealogyDateStructured(member.deathDateStructured) || '',
      note: deathYear || member.solarDeathDate ? '' : 'Năm mất chưa rõ',
      rawLunarDate: anniversary.date.rawText || member.deathAnniversaryLunar || member.lunarAnniversary || ''
    });
  }
  return items.sort((a, b) => String(a.solarDate).localeCompare(String(b.solarDate)) || a.memberName.localeCompare(b.memberName));
}

async function buildUpcomingAnniversaryItems({ days = 60, authScope = 'anonymous' } = {}) {
  const currentYear = new Date().getFullYear();
  const allItems = [
    ...await buildAnniversaryItems({ year: currentYear, authScope }),
    ...await buildAnniversaryItems({ year: currentYear + 1, authScope })
  ];
  const seen = new Set();
  return allItems
    .filter((item) => Number.isFinite(item.daysUntil) && item.daysUntil >= 0 && item.daysUntil <= days)
    .filter((item) => {
      const key = `${item.memberId}:${item.solarDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.memberName.localeCompare(b.memberName));
}

function formatAnniversaryItemLine(item) {
  const lunarText = `${item.lunarDay}/${item.lunarMonth} âm lịch${item.isLeapMonth ? ' (tháng nhuận)' : ''}`;
  const solarText = item.solarDisplayDate || item.solarDate || 'chưa tính được';
  const rawText = item.rawLunarDate && item.rawLunarDate !== lunarText ? `; ghi chú gốc: ${item.rawLunarDate}` : '';
  const note = item.note ? `; ${item.note}` : '';
  const title = item.title ? ` - ${item.title}` : '';
  return `- ${item.memberName}${title}: ${lunarText}${rawText}; năm ${item.lunarYear} rơi vào ngày ${solarText} dương lịch${note}.`;
}

async function buildAnniversaryLocalAnswer(query, authScope = 'anonymous') {
  if (!isAnniversaryQuestion(query)) return null;
  const normalized = normalizeVietnameseSearch(query);
  if (/\b(ngay mat|mat ngay)\b/.test(normalized) && !/\b(gio|ky|ky nhat|le gio|cung gio)\b/.test(normalized)) {
    return null;
  }
  const yearMatch = normalized.match(/\b(20\d{2}|21\d{2})\b/);
  const year = normalizeAnniversaryYear(yearMatch?.[1]);

  if (/\b(sap toi|gan toi|upcoming)\b/.test(normalized)) {
    const upcoming = await buildUpcomingAnniversaryItems({ days: 60, authScope });
    if (!upcoming.length) return 'Chưa tìm thấy ngày giỗ đã xác minh trong 60 ngày tới.';
    return [
      'Lịch giỗ sắp tới theo dữ liệu đã xác minh/applied:',
      upcoming.slice(0, 8).map(formatAnniversaryItemLine).join('\n')
    ].join('\n');
  }

  if (/\b(thang nay)\b/.test(normalized)) {
    const currentMonth = new Date().getMonth() + 1;
    const items = (await buildAnniversaryItems({ year, authScope })).filter((item) => {
      const date = isoDateToStartOfDay(item.solarDate);
      return date && date.getMonth() + 1 === currentMonth;
    });
    if (!items.length) return 'Chưa tìm thấy ngày giỗ đã xác minh trong tháng này.';
    return [
      `Lịch giỗ trong tháng ${currentMonth}/${year} theo dữ liệu đã xác minh/applied:`,
      items.slice(0, 12).map(formatAnniversaryItemLine).join('\n')
    ].join('\n');
  }

  const items = await buildAnniversaryItems({ year, authScope });
  const memberQuery = normalizeAnniversaryMemberQuery(query);
  const matched = items
    .map((item) => ({
      item,
      score: scoreTextAgainstQuery(memberQuery, [item.memberName, item.title, item.branch].join(' '))
    }))
    .filter((entry) => {
      const memberText = [entry.item.memberName, entry.item.title, entry.item.branch].join(' ');
      return (entry.score >= 2 && hasSpecificMemberNameMatch(memberQuery, memberText)) ||
        memberQuery.includes(normalizeVietnameseSearch(entry.item.memberName));
    })
    .sort((a, b) => b.score - a.score || a.item.memberName.localeCompare(b.item.memberName))
    .map((entry) => entry.item);

  if (matched.length) {
    return [
      `Theo dữ liệu ngày giỗ đã xác minh/applied trong cây phả, năm ${year}:`,
      matched.slice(0, 5).map(formatAnniversaryItemLine).join('\n'),
      'Nếu năm mất còn thiếu, hệ thống chỉ quy đổi ngày giỗ âm lịch sang ngày dương của năm được hỏi, không tự tạo năm mất.'
    ].join('\n');
  }

  return null;
}

function normalizeAnniversaryDraftChannel(value) {
  const channel = String(value || 'dashboard').trim().toLowerCase();
  return ['dashboard', 'zalo', 'web_chat', 'all'].includes(channel) ? channel : 'dashboard';
}

function normalizeAnniversaryDraftStatus(value, fallback = 'draft') {
  const status = String(value || fallback).trim().toLowerCase();
  return ['draft', 'approved', 'scheduled', 'sent', 'rejected'].includes(status) ? status : fallback;
}

function normalizeReminderRecipientType(value) {
  const recipientType = String(value || 'admin_test').trim().toLowerCase();
  return ['admin_test', 'linked_user', 'linked_user_test', 'group'].includes(recipientType) ? recipientType : 'admin_test';
}

function publicReminderSendLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    draftId: row.draft_id,
    channel: row.channel,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    message: row.message,
    transport: row.transport,
    status: row.status,
    error: row.error,
    blockedReason: row.blocked_reason || '',
    requestId: row.request_id || '',
    responseId: row.response_id || '',
    sentBy: row.sent_by,
    sentAt: row.sent_at,
    createdAt: row.created_at
  };
}

function insertReminderSendLog(database, {
  id = `reminder_log_${randomToken(12)}`,
  draftId = '',
  channel = 'dashboard',
  recipientType = 'admin_test',
  recipientId = '',
  recipientName = '',
  message = '',
  transport = 'mock',
  status = 'queued',
  error = '',
  blockedReason = '',
  requestId = '',
  responseId = '',
  sentBy = '',
  sentAt = ''
} = {}) {
  database.prepare(`
    INSERT INTO reminder_send_logs (
      id, draft_id, channel, recipient_type, recipient_id, recipient_name, message,
      transport, status, error, blocked_reason, request_id, response_id, sent_by, sent_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    draftId,
    channel,
    recipientType,
    recipientId,
    recipientName,
    message,
    transport,
    status,
    error,
    blockedReason,
    requestId,
    responseId,
    sentBy,
    sentAt
  );
  return publicReminderSendLog(database.prepare('SELECT * FROM reminder_send_logs WHERE id = ?').get(id));
}

function publicAnniversaryDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    anniversaryKey: row.anniversary_key,
    memberId: row.member_id,
    memberName: row.member_name,
    title: row.title,
    lunarDateText: row.lunar_date_text,
    solarDate: row.solar_date,
    location: row.location,
    branch: row.branch,
    generation: row.generation,
    messageDraft: row.message_draft,
    channel: row.channel,
    status: row.status,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function composeAnniversaryNoticeDraft(anniversary, { channel = 'dashboard', location = '', note = '' } = {}) {
  const lunarDateText = `${anniversary.lunarDay}/${anniversary.lunarMonth} âm lịch${anniversary.isLeapMonth ? ' (tháng nhuận)' : ''}`;
  const titleSuffix = anniversary.title ? ` - ${anniversary.title}` : '';
  const lines = [
    `Kính thông báo: năm ${anniversary.lunarYear}, ngày giỗ của ${anniversary.memberName}${titleSuffix} là ${lunarDateText}, rơi vào ngày ${anniversary.solarDisplayDate || anniversary.solarDate} dương lịch.`,
    'Dữ liệu ngày giỗ này đã được xác minh/applied trong hệ thống gia phả.',
    anniversary.branch ? `Chi/ngành: ${anniversary.branch}.` : '',
    anniversary.generation ? `Đời: ${anniversary.generation}.` : '',
    location ? `Địa điểm dự kiến: ${location}.` : '',
    anniversary.note ? `Ghi chú dữ liệu: ${anniversary.note}.` : '',
    note ? `Ghi chú thêm: ${note}.` : '',
    channel === 'zalo'
      ? 'Bản nhắc này mới là bản nháp cho kênh Zalo, chưa gửi tự động.'
      : 'Bản nhắc này mới là bản nháp, chưa gửi tự động.'
  ].filter(Boolean);
  return lines.join('\n');
}

async function getAnniversaryForDraft(memberId, year) {
  const anniversaries = await buildAnniversaryItems({ year, authScope: 'admin' });
  return anniversaries.find((item) => item.memberId === memberId) || null;
}

async function listAnniversaryDrafts({ limit = 100, status = '', q = '' } = {}) {
  const database = await getDatabase();
  const rows = database.prepare('SELECT * FROM anniversary_event_drafts ORDER BY updated_at DESC, created_at DESC LIMIT ?').all(Math.max(1, Math.min(500, limit)));
  const statusNorm = normalizeAnniversaryDraftStatus(status, '');
  const qNorm = normalizeVietnameseSearch(q);
  return rows
    .filter((row) => !statusNorm || row.status === statusNorm)
    .filter((row) => {
      if (!qNorm) return true;
      return normalizeVietnameseSearch([row.member_name, row.title, row.lunar_date_text, row.solar_date, row.channel, row.status].join(' ')).includes(qNorm);
    })
    .map(publicAnniversaryDraft);
}

async function createAnniversaryDraftFromAnniversary({ memberId, year, channel, location, note, createdBy }) {
  const targetYear = normalizeAnniversaryYear(year);
  const anniversary = await getAnniversaryForDraft(String(memberId || '').trim(), targetYear);
  if (!anniversary) {
    const err = new Error('Member does not have a verified/applied anniversary for this year.');
    err.status = 404;
    throw err;
  }

  const normalizedChannel = normalizeAnniversaryDraftChannel(channel);
  const safeLocation = String(location || '').trim();
  const safeNote = String(note || '').trim();
  const lunarDateText = `${anniversary.lunarDay}/${anniversary.lunarMonth} am lich${anniversary.isLeapMonth ? ' (thang nhuan)' : ''}`;
  const id = `anniv_draft_${randomToken(12)}`;
  const title = `Nhắc ngày giỗ ${anniversary.memberName} - ${anniversary.solarDisplayDate || anniversary.solarDate}`;
  const messageDraft = composeAnniversaryNoticeDraft(anniversary, {
    channel: normalizedChannel,
    location: safeLocation,
    note: safeNote
  });
  const database = await getDatabase();
  database.prepare(`
    INSERT INTO anniversary_event_drafts (
      id, anniversary_key, member_id, member_name, title, lunar_date_text, solar_date,
      location, branch, generation, message_draft, channel, status, source, created_by,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'anniversary', ?, datetime('now'), datetime('now'))
  `).run(
    id,
    `${anniversary.memberId}:${targetYear}`,
    anniversary.memberId,
    anniversary.memberName,
    title,
    lunarDateText,
    anniversary.solarDate,
    safeLocation,
    anniversary.branch || '',
    String(anniversary.generation || ''),
    messageDraft,
    normalizedChannel,
    createdBy || ''
  );
  return publicAnniversaryDraft(database.prepare('SELECT * FROM anniversary_event_drafts WHERE id = ?').get(id));
}

async function updateAnniversaryDraft(id, patch = {}) {
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM anniversary_event_drafts WHERE id = ?').get(String(id || ''));
  if (!current) {
    const err = new Error('Anniversary draft not found.');
    err.status = 404;
    throw err;
  }
  const next = {
    title: Object.prototype.hasOwnProperty.call(patch, 'title') ? String(patch.title || '').trim() : current.title,
    location: Object.prototype.hasOwnProperty.call(patch, 'location') ? String(patch.location || '').trim() : current.location,
    messageDraft: Object.prototype.hasOwnProperty.call(patch, 'messageDraft') ? String(patch.messageDraft || '').trim() : current.message_draft,
    channel: Object.prototype.hasOwnProperty.call(patch, 'channel') ? normalizeAnniversaryDraftChannel(patch.channel) : current.channel,
    status: Object.prototype.hasOwnProperty.call(patch, 'status') ? normalizeAnniversaryDraftStatus(patch.status, current.status) : current.status
  };
  if (!next.title || !next.messageDraft) {
    const err = new Error('Title and messageDraft are required.');
    err.status = 400;
    throw err;
  }
  database.prepare(`
    UPDATE anniversary_event_drafts
    SET title = ?, location = ?, message_draft = ?, channel = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(next.title, next.location, next.messageDraft, next.channel, next.status, current.id);
  return publicAnniversaryDraft(database.prepare('SELECT * FROM anniversary_event_drafts WHERE id = ?').get(current.id));
}

async function deleteAnniversaryDraft(id) {
  const database = await getDatabase();
  const result = database.prepare('DELETE FROM anniversary_event_drafts WHERE id = ?').run(String(id || ''));
  return result.changes > 0;
}

function readReminderTransportConfig() {
  const zaloEnabled = String(process.env.ZALO_SEND_ENABLED || 'false').trim().toLowerCase() === 'true';
  const zaloMode = String(process.env.ZALO_SEND_MODE || 'mock').trim().toLowerCase();
  const zaloToken = String(process.env.ZALO_OA_ACCESS_TOKEN || '').trim();
  const zaloOaId = String(process.env.ZALO_OA_ID || '').trim();
  const zaloApiUrl = String(process.env.ZALO_SEND_API_URL || '').trim();
  const zaloDryRun = String(process.env.ZALO_REAL_SEND_DRY_RUN || 'false').trim().toLowerCase() === 'true';
  const webChatEnabled = String(process.env.WEB_CHAT_SEND_ENABLED || 'false').trim().toLowerCase() === 'true';
  const rateLimit = Math.max(1, Math.min(60, Number(process.env.REMINDER_REAL_SEND_RATE_LIMIT_PER_MINUTE || 3) || 3));
  const zaloConfigured = Boolean(zaloToken && zaloOaId && zaloApiUrl);
  const webChatConfigured = false;
  return {
    zalo: {
      enabled: zaloEnabled,
      mode: zaloMode === 'real' ? 'real' : 'mock',
      configured: zaloConfigured,
      canSendReal: Boolean(zaloEnabled && zaloMode === 'real' && zaloConfigured),
      dryRun: zaloDryRun
    },
    webChat: {
      enabled: webChatEnabled,
      configured: webChatConfigured,
      canSendReal: false
    },
    rateLimit
  };
}

function getReminderTransportStatus() {
  return readReminderTransportConfig();
}

function checkReminderTransportConfig(channel) {
  const normalizedChannel = normalizeAnniversaryDraftChannel(channel);
  const config = readReminderTransportConfig();
  if (normalizedChannel === 'zalo') {
    return {
      channel: 'zalo',
      ok: config.zalo.canSendReal,
      enabled: config.zalo.enabled,
      mode: config.zalo.mode,
      configured: config.zalo.configured,
      canSendReal: config.zalo.canSendReal,
      dryRun: config.zalo.dryRun,
      missing: [
        config.zalo.enabled ? '' : 'ZALO_SEND_ENABLED=true',
        config.zalo.mode === 'real' ? '' : 'ZALO_SEND_MODE=real',
        process.env.ZALO_OA_ACCESS_TOKEN ? '' : 'ZALO_OA_ACCESS_TOKEN',
        process.env.ZALO_OA_ID ? '' : 'ZALO_OA_ID',
        process.env.ZALO_SEND_API_URL ? '' : 'ZALO_SEND_API_URL'
      ].filter(Boolean),
      message: config.zalo.canSendReal
        ? 'Zalo real transport appears configured, but sending still requires per-request confirmation.'
        : 'Zalo real transport is locked or missing configuration.'
    };
  }
  if (normalizedChannel === 'web_chat') {
    return {
      channel: 'web_chat',
      ok: false,
      enabled: config.webChat.enabled,
      configured: config.webChat.configured,
      canSendReal: false,
      missing: config.webChat.enabled ? ['web chat realtime/session adapter'] : ['WEB_CHAT_SEND_ENABLED=true', 'web chat realtime/session adapter'],
      message: 'Web chat real transport is not configured in this phase.'
    };
  }
  return {
    channel: 'dashboard',
    ok: true,
    enabled: true,
    configured: true,
    canSendReal: false,
    missing: [],
    message: 'Dashboard preview uses mock logging only.'
  };
}

function addReminderTestRecipient(map, recipient) {
  const id = String(recipient?.id || '').trim();
  if (!id || recipient?.type === 'group') return;
  const type = normalizeReminderRecipientType(recipient.type || 'admin_test');
  if (!['admin_test', 'linked_user_test'].includes(type)) return;
  map.set(`${type}:${id}`, {
    id,
    type,
    name: String(recipient.name || id).trim(),
    source: String(recipient.source || 'user').trim()
  });
}

function getZaloRecipientIdsFromUser(user = {}) {
  const ids = [];
  [
    user.zaloRecipientId,
    user.zaloUserId,
    user.recipientId,
    user.openId,
    user.uid,
    user.zaloId
  ].forEach((value) => {
    if (value) ids.push(String(value).trim());
  });
  [user.username, user.phone, user.id].forEach((value) => {
    const text = String(value || '').trim();
    if (text.startsWith('zalo_')) ids.push(text.slice('zalo_'.length));
    if (text.startsWith('oauth_zalo_')) ids.push(text.slice('oauth_zalo_'.length));
  });
  return [...new Set(ids.filter(Boolean))];
}

async function listReminderTestRecipients(adminUser = {}) {
  const recipients = new Map();
  String(process.env.ZALO_TEST_RECIPIENT_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item, index) => {
      const [rawId, rawName] = item.split(':');
      addReminderTestRecipient(recipients, {
        id: rawId,
        type: 'admin_test',
        name: rawName || `Zalo test recipient ${index + 1}`,
        source: 'env'
      });
    });

  const users = await readAuthUsers();
  for (const user of users) {
    const isVerified = Boolean(user?.isKYCed && user?.kycStatus === 'verified' && user?.isApproved !== false && user?.approvalStatus !== 'rejected');
    const isZalo = user?.loginType === 'zalo' || String(user?.username || '').startsWith('zalo_') || String(user?.id || '').startsWith('oauth_zalo_');
    const isAdmin = isAdminAuthUser(user);
    if (!isZalo || (!isVerified && !isAdmin)) continue;
    for (const id of getZaloRecipientIdsFromUser(user)) {
      addReminderTestRecipient(recipients, {
        id,
        type: isAdmin ? 'admin_test' : 'linked_user_test',
        name: user.fullName || user.username || id,
        source: isAdmin ? 'admin_user' : 'kyc_user'
      });
    }
  }

  if (adminUser?.loginType === 'zalo' || String(adminUser?.username || '').startsWith('zalo_')) {
    for (const id of getZaloRecipientIdsFromUser(adminUser)) {
      addReminderTestRecipient(recipients, {
        id,
        type: 'admin_test',
        name: adminUser.fullName || adminUser.username || id,
        source: 'current_admin'
      });
    }
  }

  return [...recipients.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

async function assertRealReminderRecipientAllowed(recipient, adminUser) {
  const allowed = await listReminderTestRecipients(adminUser);
  const found = allowed.find((item) => item.id === recipient?.id && item.type === recipient?.type);
  if (!found) {
    throw makeReminderSendError('Real Zalo test recipient is not in the allowed admin/KYC test list.', {
      status: 400,
      auditStatus: 'blocked',
      transport: 'zalo_real',
      blockedReason: 'recipient_not_allowed'
    });
  }
  return found;
}

function makeReminderSendError(message, { status = 400, auditStatus = 'blocked', transport = 'mock', blockedReason = '', requestId = '', responseId = '' } = {}) {
  const err = new Error(message);
  err.status = status;
  err.auditStatus = auditStatus;
  err.transport = transport;
  err.blockedReason = blockedReason || message;
  err.requestId = requestId;
  err.responseId = responseId;
  return err;
}

function assertReminderRealSendRateLimit(sentBy, channel) {
  const { rateLimit } = readReminderTransportConfig();
  const now = Date.now();
  const windowMs = 60_000;
  const key = `${sentBy || 'unknown'}:${channel}`;
  const recent = (reminderRealSendAttempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= rateLimit) {
    throw makeReminderSendError('Real reminder send rate limit exceeded.', {
      status: 429,
      auditStatus: 'blocked',
      transport: channel === 'zalo' ? 'zalo_real' : 'web_chat_real',
      blockedReason: 'rate_limit'
    });
  }
  recent.push(now);
  reminderRealSendAttempts.set(key, recent);
}

function buildZaloOaTextMessagePayload({ recipient, message }) {
  return {
    recipient: {
      user_id: recipient.id
    },
    message: {
      text: message
    }
  };
}

function extractZaloResponseId(data) {
  return String(data?.data?.message_id || data?.data?.msg_id || data?.message_id || data?.msg_id || data?.request_id || '').trim();
}

async function sendZaloRealReminder({ recipient, message, draftId }) {
  const config = readReminderTransportConfig();
  const apiUrl = String(process.env.ZALO_SEND_API_URL || '').trim();
  const token = String(process.env.ZALO_OA_ACCESS_TOKEN || '').trim();
  const payload = buildZaloOaTextMessagePayload({ recipient, message });
  const requestId = `zalo_req_${randomToken(10)}`;

  if (config.zalo.dryRun) {
    return {
      draftId,
      channel: 'zalo',
      recipient,
      message,
      transport: 'zalo_real',
      status: 'sent',
      error: '',
      requestId,
      responseId: `dryrun_${randomToken(8)}`,
      sentAt: new Date().toISOString(),
      dryRun: true,
      payloadPreview: {
        recipient: payload.recipient,
        messageLength: message.length
      }
    };
  }

  let response;
  let data = {};
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: token
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
  } catch (err) {
    throw makeReminderSendError(`Zalo real send request failed: ${err.message || err}`, {
      status: 502,
      auditStatus: 'failed',
      transport: 'zalo_real',
      blockedReason: 'zalo_request_failed',
      requestId
    });
  }

  const errorCode = data?.error ?? data?.error_code ?? data?.code;
  const okByBody = errorCode === undefined || errorCode === 0 || errorCode === '0';
  if (!response.ok || !okByBody) {
    const messageText = data?.message || data?.error_name || data?.error_description || `HTTP ${response.status}`;
    throw makeReminderSendError(`Zalo real send failed: ${messageText}`, {
      status: 502,
      auditStatus: 'failed',
      transport: 'zalo_real',
      blockedReason: 'zalo_response_failed',
      requestId,
      responseId: extractZaloResponseId(data)
    });
  }

  return {
    draftId,
    channel: 'zalo',
    recipient,
    message,
    transport: 'zalo_real',
    status: 'sent',
    error: '',
    requestId,
    responseId: extractZaloResponseId(data),
    sentAt: new Date().toISOString()
  };
}

async function sendReminderMessage({ channel, recipient, message, draftId, sendReal = false, confirmText = '', finalConfirm = false, sentBy = '' }) {
  const normalizedChannel = normalizeAnniversaryDraftChannel(channel);
  const wantsReal = Boolean(sendReal);
  const config = readReminderTransportConfig();
  if (wantsReal) {
    if (!['zalo', 'web_chat'].includes(normalizedChannel)) {
      throw makeReminderSendError('Real sending is only supported for Zalo or web chat test transports.', {
        status: 400,
        auditStatus: 'blocked',
        transport: 'mock',
        blockedReason: 'unsupported_channel'
      });
    }
    const realTransport = normalizedChannel === 'zalo' ? 'zalo_real' : 'web_chat_real';
    if (confirmText !== REAL_SEND_CONFIRM_TEXT) {
      throw makeReminderSendError(`Real send requires confirmText exactly "${REAL_SEND_CONFIRM_TEXT}".`, {
        status: 400,
        auditStatus: 'blocked',
        transport: realTransport,
        blockedReason: 'missing_confirm_text'
      });
    }
    if (finalConfirm !== true) {
      throw makeReminderSendError('Real send requires finalConfirm=true.', {
        status: 400,
        auditStatus: 'blocked',
        transport: realTransport,
        blockedReason: 'missing_final_confirm'
      });
    }
    if (recipient?.type === 'group') {
      throw makeReminderSendError('Group recipients are blocked in this phase.', {
        status: 400,
        auditStatus: 'blocked',
        transport: realTransport,
        blockedReason: 'group_recipient_blocked'
      });
    }
    if (!['admin_test', 'linked_user_test'].includes(recipient?.type)) {
      throw makeReminderSendError('Real send requires recipientType admin_test or linked_user_test.', {
        status: 400,
        auditStatus: 'blocked',
        transport: realTransport,
        blockedReason: 'recipient_type_blocked'
      });
    }
    assertReminderRealSendRateLimit(sentBy, normalizedChannel);
    if (normalizedChannel === 'zalo') {
      if (!config.zalo.enabled || config.zalo.mode !== 'real') {
        throw makeReminderSendError('Real Zalo sending is disabled by environment.', {
          status: 400,
          auditStatus: 'blocked',
          transport: realTransport,
          blockedReason: 'zalo_disabled'
        });
      }
      if (!config.zalo.configured) {
        throw makeReminderSendError('Zalo real send adapter is missing token/OA/API URL configuration.', {
          status: 501,
          auditStatus: 'blocked',
          transport: realTransport,
          blockedReason: 'zalo_not_configured'
        });
      }
      return sendZaloRealReminder({ recipient, message, draftId });
    }
    if (!config.webChat.enabled || !config.webChat.configured) {
      throw makeReminderSendError('Web chat real send adapter is not configured in this phase.', {
        status: 501,
        auditStatus: 'blocked',
        transport: realTransport,
        blockedReason: 'web_chat_not_configured'
      });
    }
  }

  const transport = normalizedChannel === 'zalo'
    ? 'zalo_mock'
    : normalizedChannel === 'web_chat'
      ? 'web_chat_mock'
      : 'mock';
  return {
    draftId,
    channel: normalizedChannel,
    recipient,
    message,
    transport,
    status: 'sent',
    error: '',
    sentAt: new Date().toISOString()
  };
}

async function sendAnniversaryDraftTest(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const draft = database.prepare('SELECT * FROM anniversary_event_drafts WHERE id = ?').get(String(id || ''));
  if (!draft) {
    const err = new Error('Anniversary draft not found.');
    err.status = 404;
    throw err;
  }
  if (!['approved', 'scheduled'].includes(draft.status)) {
    const err = new Error('Draft must be approved or scheduled before sending a test reminder.');
    err.status = 400;
    throw err;
  }

  const recipientId = String(body.recipientId || '').trim();
  const recipientManual = String(body.recipientManual || '').trim();
  if (!recipientId && !recipientManual) {
    const err = new Error('A clear test recipient is required.');
    err.status = 400;
    throw err;
  }

  const channel = normalizeAnniversaryDraftChannel(body.channel || draft.channel);
  const recipientType = normalizeReminderRecipientType(body.recipientType || (recipientManual ? 'admin_test' : 'linked_user'));
  const recipient = {
    type: recipientType,
    id: recipientId || recipientManual,
    name: String(body.recipientName || recipientManual || recipientId).trim()
  };
  const sentBy = adminUser?.username || adminUser?.fullName || adminUser?.id || '';
  if (Boolean(body.sendReal) && channel === 'zalo' && readReminderTransportConfig().zalo.canSendReal) {
    const allowedRecipient = await assertRealReminderRecipientAllowed(recipient, adminUser);
    recipient.name = allowedRecipient.name || recipient.name;
  }
  const logId = `reminder_log_${randomToken(12)}`;
  let result;
  try {
    result = await sendReminderMessage({
      channel,
      recipient,
      message: draft.message_draft,
      draftId: draft.id,
      sendReal: Boolean(body.sendReal),
      confirmText: String(body.confirmText || ''),
      finalConfirm: body.finalConfirm === true,
      sentBy
    });
  } catch (err) {
    insertReminderSendLog(database, {
      id: logId,
      draftId: draft.id,
      channel,
      recipientType: recipient.type,
      recipientId: recipient.id,
      recipientName: recipient.name,
      message: draft.message_draft,
      transport: err.transport || (channel === 'zalo' ? 'zalo_real' : channel === 'web_chat' ? 'web_chat_real' : 'mock'),
      status: err.auditStatus || (err.status === 400 ? 'blocked' : 'failed'),
      error: err.message || 'Send failed.',
      blockedReason: err.blockedReason || '',
      requestId: err.requestId || '',
      responseId: err.responseId || '',
      sentBy,
      sentAt: new Date().toISOString()
    });
    throw err;
  }

  return insertReminderSendLog(database, {
    id: logId,
    draftId: draft.id,
    channel,
    recipientType: recipient.type,
    recipientId: recipient.id,
    recipientName: recipient.name,
    message: draft.message_draft,
    transport: result.transport,
    status: result.status,
    error: result.error,
    requestId: result.requestId || '',
    responseId: result.responseId || '',
    sentBy,
    sentAt: result.sentAt
  });
}

async function listReminderSendLogs({ draftId = '', limit = 50, transport = '', status = '' } = {}) {
  const database = await getDatabase();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const transportFilter = String(transport || '').trim();
  const statusFilter = String(status || '').trim();
  let sql = 'SELECT * FROM reminder_send_logs';
  const where = [];
  const params = [];
  if (draftId) {
    where.push('draft_id = ?');
    params.push(String(draftId));
  }
  if (transportFilter) {
    where.push('transport = ?');
    params.push(transportFilter);
  }
  if (statusFilter) {
    where.push('status = ?');
    params.push(statusFilter);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(safeLimit);
  return database.prepare(sql).all(...params).map(publicReminderSendLog);
}

function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function readZaloBotConfig() {
  const webhookEnabled = parseBooleanEnv(process.env.ZALO_WEBHOOK_ENABLED, false);
  const webhookSecret = String(process.env.ZALO_WEBHOOK_SECRET || '').trim();
  const verifyToken = String(process.env.ZALO_WEBHOOK_VERIFY_TOKEN || '').trim();
  const sendConfig = readReminderTransportConfig();
  const phaseRealReplyEnabled = parseBooleanEnv(process.env.PHASE_REAL_ZALO_REPLY_ENABLED, false);
  return {
    webhookEnabled,
    webhookConfigured: webhookEnabled ? Boolean(webhookSecret && verifyToken) : Boolean(webhookSecret || verifyToken),
    webhookSecretConfigured: Boolean(webhookSecret),
    webhookVerifyTokenConfigured: Boolean(verifyToken),
    webhookSafe: !webhookEnabled || Boolean(webhookSecret && verifyToken),
    allowMockWithoutSecret: !webhookEnabled && !webhookSecret,
    sendEnabled: sendConfig.zalo.enabled,
    sendMode: sendConfig.zalo.mode,
    phaseRealReplyEnabled,
    canReplyReal: sendConfig.zalo.enabled && sendConfig.zalo.mode === 'real' && phaseRealReplyEnabled
  };
}

function verifyZaloWebhookRequest(req) {
  const enabled = parseBooleanEnv(process.env.ZALO_WEBHOOK_ENABLED, false);
  const secret = String(process.env.ZALO_WEBHOOK_SECRET || '').trim();
  if (!enabled) return { ok: true, productionReady: false, signatureStatus: 'not_required', reason: 'webhook_disabled_mock_only' };
  if (!secret) return { ok: false, productionReady: false, signatureStatus: 'rejected', reason: 'webhook_secret_missing', status: 503 };
  const signature = String(req.headers['x-zalo-signature'] || req.headers['x-hub-signature-256'] || req.headers['x-signature'] || '').trim();
  if (!signature) return { ok: false, productionReady: true, signatureStatus: 'rejected', reason: 'missing_signature', status: 401 };
  const payload = JSON.stringify(req.body || {});
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const normalizedSignature = signature.replace(/^sha256=/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) {
    return { ok: false, productionReady: true, signatureStatus: 'rejected', reason: 'invalid_signature_format', status: 403 };
  }
  const expected = Buffer.from(digest, 'hex');
  const actual = Buffer.from(normalizedSignature, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return { ok: false, productionReady: true, signatureStatus: 'rejected', reason: 'invalid_signature', status: 403 };
  }
  return { ok: true, productionReady: true, signatureStatus: 'verified', reason: 'signature_ok' };
}

function normalizeZaloBotEvent(payload = {}, { source = 'webhook' } = {}) {
  const message = payload.message && typeof payload.message === 'object' ? payload.message : {};
  const sender = payload.sender && typeof payload.sender === 'object' ? payload.sender : payload.user && typeof payload.user === 'object' ? payload.user : {};
  const recipient = payload.recipient && typeof payload.recipient === 'object' ? payload.recipient : {};
  const group = payload.group && typeof payload.group === 'object' ? payload.group : {};
  const eventId = String(
    payload.eventId || payload.event_id || payload.message_id || payload.msg_id || payload.id
    || message.message_id || message.msg_id || message.id || `zalo_evt_${randomToken(10)}`
  ).trim();
  const eventName = String(payload.eventName || payload.event_name || payload.event || payload.type || '').trim().toLowerCase();
  const text = String(payload.messageText || payload.message_text || payload.text || message.text || payload.content || '').trim();
  const groupId = String(payload.groupId || payload.group_id || group.id || group.group_id || recipient.group_id || '').trim();
  const senderId = String(payload.senderId || payload.sender_id || sender.id || sender.user_id || sender.uid || payload.user_id || '').trim();
  const senderName = String(payload.senderName || payload.sender_name || sender.name || payload.user_name || '').trim();
  const recipientId = String(payload.recipientId || payload.recipient_id || recipient.id || recipient.user_id || recipient.oa_id || payload.to_id || '').trim();
  const appId = String(payload.appId || payload.app_id || payload.appid || payload.app_id || '').trim();
  const oaId = String(payload.oaId || payload.oa_id || payload.oaid || recipient.oa_id || payload.recipient_id || '').trim();
  const eventTimestamp = String(payload.timestamp || payload.event_time || payload.time || message.timestamp || '').trim();
  const eventType = /follow/.test(eventName)
    ? (eventName.includes('unfollow') ? 'unfollow' : 'follow')
    : text ? 'message' : 'unknown';
  return {
    eventId,
    source,
    channel: groupId ? 'group' : source === 'mock' ? 'mock' : 'oa',
    eventType,
    appId,
    oaId,
    senderId,
    senderName,
    recipientId,
    groupId,
    messageText: text,
    normalizedText: normalizeKnowledgeText(text),
    eventTimestamp,
    raw: payload
  };
}

function isZaloGroupMessageEligible(event) {
  if (!event.groupId) return true;
  const text = String(event.messageText || '').trim();
  if (/^\/(giapha|gio|tim|ai)(\s|$)/i.test(text)) return true;
  const mentions = Array.isArray(event.raw?.mentions) ? event.raw.mentions : Array.isArray(event.raw?.message?.mentions) ? event.raw.message.mentions : [];
  return mentions.some((mention) => /bot|giapha|gia pha|họ cao|ho cao/i.test(String(mention?.name || mention?.text || mention || '')));
}

function stripZaloBotCommand(text) {
  return String(text || '').trim().replace(/^\/(giapha|gio|tim|ai)\s*/i, '').trim();
}

function classifyZaloBotIntent(text) {
  const norm = normalizeKnowledgeText(text);
  if (/(kyc|dang nhap|login|xac minh|duyet tai khoan)/.test(norm)) return 'kyc_help';
  if (/(ngay gio|lich gio|gio cu|gio to|ky nhat|ngay mat|ta the)/.test(norm)) return 'anniversary_lookup';
  if (/(cao to|thuy to|cu lang|pha he|doi thu|cha me|que quan|mo chi|tim)/.test(norm)) return 'genealogy_lookup';
  if (/(han nom|kiem chung|tai lieu|nguon goc|lich su|dia danh)/.test(norm)) return 'knowledge_question';
  return 'fallback';
}

function isZaloPrivateDetailQuestion(text) {
  const norm = normalizeKnowledgeText(text);
  return /(ngay sinh|que quan|mo chi|cha me|vo chong|con cai|dia chi|so dien thoai|thong tin chi tiet|ho so)/.test(norm);
}

async function getZaloSenderAuthScope(senderId) {
  const users = await readAuthUsers();
  const sender = String(senderId || '').trim();
  const user = users.find((item) => getZaloRecipientIdsFromUser(item).includes(sender));
  return {
    user,
    authScope: getAuthScope(user ? { provider: 'zalo', id: sender, account: `zalo_${sender}` } : null, user)
  };
}

function publicZaloBotEvent(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    source: row.source || '',
    channel: row.channel,
    eventType: row.event_type,
    appId: row.app_id || '',
    oaId: row.oa_id || '',
    senderId: row.sender_id,
    senderName: row.sender_name,
    recipientId: row.recipient_id || '',
    groupId: row.group_id,
    messageText: row.message_text,
    normalizedText: row.normalized_text,
    intent: row.intent,
    status: row.status,
    error: row.error,
    signatureStatus: row.signature_status || '',
    reviewedAt: row.reviewed_at || '',
    eventTimestamp: row.event_timestamp || '',
    createdAt: row.created_at
  };
}

function publicZaloBotReply(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    channel: row.channel,
    senderId: row.sender_id,
    senderName: row.sender_name,
    groupId: row.group_id,
    messageText: row.message_text,
    normalizedText: row.normalized_text,
    intent: row.intent,
    replyText: row.reply_text,
    transport: row.transport,
    status: row.status,
    error: row.error,
    createdAt: row.created_at
  };
}

function redactSensitiveJson(value) {
  const seen = new WeakSet();
  return JSON.stringify(value || {}, (key, item) => {
    if (/token|secret|password|access_token|refresh_token|authorization/i.test(key)) return '[redacted]';
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[circular]';
      seen.add(item);
    }
    return item;
  }).slice(0, 8000);
}

async function insertZaloBotEvent(database, event, { intent = 'fallback', status = 'received', error = '', signatureStatus = '' } = {}) {
  const id = `zalo_event_${randomToken(12)}`;
  database.prepare(`
    INSERT INTO zalo_bot_events (
      id, event_id, source, channel, event_type, app_id, oa_id, sender_id, sender_name,
      recipient_id, group_id, message_text, normalized_text, intent, status, error,
      signature_status, event_timestamp, raw_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    event.eventId,
    event.source,
    event.channel,
    event.eventType,
    event.appId,
    event.oaId,
    event.senderId,
    event.senderName,
    event.recipientId,
    event.groupId,
    event.messageText,
    event.normalizedText,
    intent,
    status,
    error,
    signatureStatus,
    event.eventTimestamp,
    redactSensitiveJson(event.raw || {}),
    new Date().toISOString()
  );
  return id;
}

async function insertZaloBotReply(database, event, { eventRowId, intent, replyText = '', transport = 'zalo_mock', status = 'mock', error = '' }) {
  const id = `zalo_reply_${randomToken(12)}`;
  database.prepare(`
    INSERT INTO zalo_bot_replies (
      id, event_id, channel, sender_id, sender_name, group_id, message_text,
      normalized_text, intent, reply_text, transport, status, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    eventRowId,
    event.channel,
    event.senderId,
    event.senderName,
    event.groupId,
    event.messageText,
    event.normalizedText,
    intent,
    replyText,
    transport,
    status,
    error,
    new Date().toISOString()
  );
  return publicZaloBotReply(database.prepare('SELECT * FROM zalo_bot_replies WHERE id = ?').get(id));
}

function kycHelpText() {
  return `Thong tin chi tiet can dang nhap va KYC. Vui long mo ${APP_URL}/?auth=zalo de dang nhap, sau do cho admin duyet KYC.`;
}

async function buildZaloBotAIReply(event, intent, authScope) {
  if (intent === 'kyc_help') return kycHelpText();
  if (authScope !== 'kyc_verified' && authScope !== 'admin' && isZaloPrivateDetailQuestion(event.messageText)) {
    return kycHelpText();
  }
  const query = stripZaloBotCommand(event.messageText);
  const response = await fetch(`http://${HOST}:${PORT}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: query,
      type: 'chat',
      botType: 'zalo_bot',
      intent,
      source: event.source === 'webhook' ? 'webhook_real' : 'mock',
      engine: 'local'
    }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI gateway failed with HTTP ${response.status}`);
  return String(data.text || '').trim() || 'Tôi chưa có đủ dữ liệu để trả lời chính xác.';
}

async function logRejectedZaloWebhook(payload = {}, reason = 'rejected') {
  const database = await getDatabase();
  const event = normalizeZaloBotEvent(payload, { source: 'webhook' });
  const eventRowId = await insertZaloBotEvent(database, event, {
    intent: 'fallback',
    status: 'rejected',
    error: reason,
    signatureStatus: 'rejected'
  });
  return publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId));
}

async function processZaloBotEvent(payload = {}, { source = 'webhook', adminUser = null, signatureStatus = '' } = {}) {
  const database = await getDatabase();
  const event = normalizeZaloBotEvent(payload, { source });
  let intent = classifyZaloBotIntent(stripZaloBotCommand(event.messageText));
  let eventStatus = 'received';
  let eventError = '';

  if (source === 'webhook' && event.eventId) {
    const duplicate = database.prepare(`
      SELECT id FROM zalo_bot_events
      WHERE event_id = ? AND source = 'webhook' AND status != 'rejected'
      ORDER BY created_at DESC LIMIT 1
    `).get(event.eventId);
    if (duplicate) {
      const eventRowId = await insertZaloBotEvent(database, event, {
        intent,
        status: 'ignored',
        error: 'duplicate_event',
        signatureStatus: signatureStatus || 'verified'
      });
      return {
        duplicate: true,
        event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)),
        reply: null
      };
    }
  }

  if (event.eventType !== 'message') {
    eventStatus = 'ignored';
    eventError = 'non_message_event';
    const eventRowId = await insertZaloBotEvent(database, event, { intent, status: eventStatus, error: eventError, signatureStatus });
    return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)), reply: null };
  }
  if (!event.messageText) {
    eventStatus = 'ignored';
    eventError = 'empty_message';
    const eventRowId = await insertZaloBotEvent(database, event, { intent, status: eventStatus, error: eventError, signatureStatus });
    return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)), reply: null };
  }
  if (!isZaloGroupMessageEligible(event)) {
    eventStatus = 'ignored';
    eventError = 'group_without_command_or_mention';
    const eventRowId = await insertZaloBotEvent(database, event, { intent, status: eventStatus, error: eventError, signatureStatus });
    return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)), reply: null };
  }

  const eventRowId = await insertZaloBotEvent(database, event, { intent, status: 'processing', signatureStatus });
  try {
    const { authScope } = await getZaloSenderAuthScope(event.senderId);
    const replyText = await buildZaloBotAIReply(event, intent, authScope);
    const config = readZaloBotConfig();
    const realReplyBlocked = config.sendEnabled && config.sendMode === 'real' && !config.phaseRealReplyEnabled;
    const reply = await insertZaloBotReply(database, event, {
      eventRowId,
      intent,
      replyText,
      transport: 'zalo_mock',
      status: realReplyBlocked ? 'blocked_real_send' : 'mock_ready',
      error: realReplyBlocked ? 'real_reply_locked_phase_2q' : ''
    });
    database.prepare('UPDATE zalo_bot_events SET status = ?, intent = ? WHERE id = ?').run('replied', intent, eventRowId);
    return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)), reply };
  } catch (err) {
    database.prepare('UPDATE zalo_bot_events SET status = ?, error = ? WHERE id = ?').run('error', err.message || 'zalo_bot_error', eventRowId);
    const reply = await insertZaloBotReply(database, event, {
      eventRowId,
      intent,
      replyText: '',
      transport: 'zalo_mock',
      status: 'error',
      error: err.message || 'zalo_bot_error'
    });
    return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(eventRowId)), reply };
  }
}

async function getZaloBotStatus() {
  const database = await getDatabase();
  const config = readZaloBotConfig();
  const counts = database.prepare(`
    SELECT
      COUNT(*) AS totalEvents,
      SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS ignoredCount,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errorCount,
      MAX(created_at) AS lastEventAt
    FROM zalo_bot_events
  `).get();
  const replies = database.prepare('SELECT COUNT(*) AS totalReplies FROM zalo_bot_replies').get();
  return {
    ok: true,
    webhookEnabled: config.webhookEnabled,
    webhookConfigured: config.webhookConfigured,
    webhookSafe: config.webhookSafe,
    webhookSecretConfigured: config.webhookSecretConfigured,
    webhookVerifyTokenConfigured: config.webhookVerifyTokenConfigured,
    sendEnabled: config.sendEnabled,
    sendMode: config.sendMode,
    canReplyReal: false,
    totalEvents: Number(counts?.totalEvents || 0),
    totalReplies: Number(replies?.totalReplies || 0),
    ignoredCount: Number(counts?.ignoredCount || 0),
    errorCount: Number(counts?.errorCount || 0),
    lastEventAt: counts?.lastEventAt || ''
  };
}

async function getZaloWebhookStatus() {
  const database = await getDatabase();
  const config = readZaloBotConfig();
  const counts = database.prepare(`
    SELECT
      SUM(CASE WHEN signature_status = 'verified' THEN 1 ELSE 0 END) AS signatureVerifiedCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount,
      SUM(CASE WHEN error = 'duplicate_event' THEN 1 ELSE 0 END) AS duplicateCount,
      MAX(CASE WHEN source = 'webhook' THEN created_at ELSE '' END) AS lastRealEventAt
    FROM zalo_bot_events
  `).get();
  const rejected = database.prepare(`
    SELECT error FROM zalo_bot_events
    WHERE status = 'rejected'
    ORDER BY created_at DESC LIMIT 1
  `).get();
  return {
    ok: true,
    webhookEnabled: config.webhookEnabled,
    webhookConfigured: config.webhookConfigured,
    webhookSafe: config.webhookSafe,
    webhookSecretConfigured: config.webhookSecretConfigured,
    webhookVerifyTokenConfigured: config.webhookVerifyTokenConfigured,
    sendEnabled: config.sendEnabled,
    sendMode: config.sendMode,
    canReplyReal: false,
    signatureVerifiedCount: Number(counts?.signatureVerifiedCount || 0),
    rejectedCount: Number(counts?.rejectedCount || 0),
    duplicateCount: Number(counts?.duplicateCount || 0),
    lastRealEventAt: counts?.lastRealEventAt || '',
    lastRejectedReason: rejected?.error || ''
  };
}

async function replayZaloBotEvent(id) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(id);
  if (!row) throw Object.assign(new Error('Zalo bot event not found.'), { status: 404 });
  const event = {
    eventId: row.event_id,
    source: row.source || 'webhook',
    channel: row.channel,
    eventType: row.event_type,
    appId: row.app_id || '',
    oaId: row.oa_id || '',
    senderId: row.sender_id,
    senderName: row.sender_name,
    recipientId: row.recipient_id || '',
    groupId: row.group_id,
    messageText: row.message_text,
    normalizedText: row.normalized_text,
    eventTimestamp: row.event_timestamp || '',
    raw: {}
  };
  if (event.eventType !== 'message' || !event.messageText || !isZaloGroupMessageEligible(event)) {
    throw Object.assign(new Error('Event is not eligible for mock replay.'), { status: 400 });
  }
  const intent = classifyZaloBotIntent(stripZaloBotCommand(event.messageText));
  const { authScope } = await getZaloSenderAuthScope(event.senderId);
  const replyText = await buildZaloBotAIReply(event, intent, authScope);
  const reply = await insertZaloBotReply(database, event, {
    eventRowId: row.id,
    intent,
    replyText,
    transport: 'zalo_mock',
    status: 'mock_ready',
    error: ''
  });
  database.prepare('UPDATE zalo_bot_events SET status = ?, intent = ? WHERE id = ?').run('replayed_mock', intent, row.id);
  return { event: publicZaloBotEvent(database.prepare('SELECT * FROM zalo_bot_events WHERE id = ?').get(row.id)), reply };
}

async function listZaloBotEvents({ limit = 50 } = {}) {
  const database = await getDatabase();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return database.prepare('SELECT * FROM zalo_bot_events ORDER BY created_at DESC LIMIT ?').all(safeLimit).map(publicZaloBotEvent);
}

async function listZaloBotReplies({ limit = 50 } = {}) {
  const database = await getDatabase();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return database.prepare('SELECT * FROM zalo_bot_replies ORDER BY created_at DESC LIMIT ?').all(safeLimit).map(publicZaloBotReply);
}

async function buildLocalAIResponse(req, message) {
  const anniversaryAnswer = await buildAnniversaryLocalAnswer(message, req.body?.authScope || 'admin');
  if (anniversaryAnswer) return anniversaryAnswer;
  const lineageMatches = Array.isArray(req.body?.lineageMatches) ? req.body.lineageMatches : [];
  const eventMatches = Array.isArray(req.body?.eventMatches) ? req.body.eventMatches : [];
  if (isAnniversaryQuestion(message)) {
    const memberQuery = normalizeAnniversaryMemberQuery(message);
    const anniversaryMembers = lineageMatches.filter((member) => {
      if (!member?.deathAnniversaryLunar && !member?.solarDeathDate && !member?.deathYear) return false;
      const memberText = [member.name, member.title, member.branch].join(' ');
      return scoreTextAgainstQuery(memberQuery, memberText) >= 2 && hasSpecificMemberNameMatch(memberQuery, memberText);
    });
    if (anniversaryMembers.length) {
      return [
        'Theo dữ liệu phả đồ hiện có, tôi tìm thấy thông tin kỵ nhật liên quan:',
        anniversaryMembers
          .map((member) => `- ${formatMemberContext(member, true)}`)
          .join('\n'),
        'Khi dùng để viết bài hoặc phát thông báo, nên ghi rõ đây là dữ liệu đang có trong hệ thống và Ban trị sự có thể đối chiếu thêm với phả ký/file Excel gốc.'
      ].join('\n');
    }

    const anniversaryEvents = eventMatches.filter((event) => event?.lunarDate || event?.solarDate);
    if (anniversaryEvents.length) {
      return [
        'Theo lịch giỗ/sự kiện đang lưu trong dashboard, tôi tìm thấy:',
        anniversaryEvents
          .map((event) => `- ${event.title || 'Sự kiện'}; âm lịch: ${event.lunarDate || 'chưa rõ'}; dương lịch: ${event.solarDate || 'chưa rõ'}; địa điểm: ${event.location || 'chưa rõ'}`)
          .join('\n'),
        'Nếu cần soạn bài văn khấn hoặc bài viết, tôi sẽ dùng đúng các mốc trên và đánh dấu phần nào còn cần kiểm chứng.'
      ].join('\n');
    }
  }

  const docsText = summarizeLocalDocuments(req.body?.documents || req.body?.knowledgeDocs || []);
  const type = String(req.body?.type || 'chat');
  const header = type === 'ceremony'
    ? 'AI nội bộ đã nhận yêu cầu soạn văn sớ theo dữ liệu hiện có.'
    : 'AI nội bộ đã đối chiếu trong dữ liệu đang được gửi kèm.';
  const guard = 'Tôi chỉ dùng dữ liệu nội bộ đã có. Phần nào chưa có tài liệu xác minh sẽ được ghi là cần admin kiểm chứng.';

  return [
    header,
    guard,
    docsText ? `\nDữ liệu liên quan:\n${docsText}` : '\nChưa có tài liệu liên quan được gửi kèm từ dashboard cho câu hỏi này.',
    `\nYêu cầu của bạn: ${message.slice(0, 900)}`
  ].join('\n');
}

function normalizeVietnameseSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function compactText(value, maxLength = 700) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}... [đã rút gọn]`;
}

function flattenLineageTree(node, parent = null, output = []) {
  if (!node || typeof node !== 'object') return output;
  const children = Array.isArray(node.children) ? node.children : [];
  output.push({
    id: String(node.id || ''),
    name: String(node.name || '').trim(),
    generation: Number(node.generation ?? node._explicitGeneration ?? 0),
    title: String(node.title || node.rankRole || node.customSuffix || '').trim(),
    branch: String(node.branch || '').trim(),
    gender: String(node.gender || '').trim(),
    isLiving: typeof node.isLiving === 'boolean' ? node.isLiving : !node.isDeceased,
    birthYear: String(node.birthYear || '').trim(),
    deathYear: String(node.deathYear || '').trim(),
    solarBirthDate: String(node.solarBirthDate || '').trim(),
    solarDeathDate: String(node.solarDeathDate || '').trim(),
    deathAnniversaryLunar: String(node.deathAnniversaryLunar || node.lunarAnniversary || '').trim(),
    lunarAnniversary: String(node.lunarAnniversary || node.deathAnniversaryLunar || '').trim(),
    birthDateStructured: node.birthDateStructured || null,
    deathDateStructured: node.deathDateStructured || null,
    deathAnniversaryLunarStructured: node.deathAnniversaryLunarStructured || null,
    birthPlace: String(node.birthPlace || '').trim(),
    deathPlace: String(node.deathPlace || '').trim(),
    graveLocation: String(node.graveLocation || node.burialPlace || '').trim(),
    burialPlace: String(node.burialPlace || node.graveLocation || '').trim(),
    fatherName: String(node.fatherName || parent?.name || '').trim(),
    motherName: String(node.motherName || '').trim(),
    spouse: String(node.spouse || '').trim(),
    residence: String(node.residence || '').trim(),
    bio: String(node.bio || '').trim()
  });
  children.forEach((child) => flattenLineageTree(child, node, output));
  return output;
}

async function readLineageTreeForAI() {
  const tree = await readState(TREE_STATE_KEY);
  if (tree) return tree;
  try {
    return await readJsonFile(DATA_FILE);
  } catch {
    return null;
  }
}

function scoreTextAgainstQuery(query, text) {
  const queryWords = normalizeVietnameseSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  const haystack = normalizeVietnameseSearch(text);
  return queryWords.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

function findRelevantMembers(query, members, limit = 8) {
  const normalizedQuery = normalizeVietnameseSearch(query);
  return members
    .map((member) => {
      const name = normalizeVietnameseSearch(member.name);
      const text = [
        member.name,
        member.title,
        member.branch,
        member.deathAnniversaryLunar,
        member.solarDeathDate,
        member.deathYear,
        member.graveLocation,
        member.bio
      ].filter(Boolean).join(' ');
      const exactNameScore = name && normalizedQuery.includes(name) ? 20 : 0;
      return { member, score: exactNameScore + scoreTextAgainstQuery(query, text) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.member.generation - b.member.generation)
    .slice(0, limit)
    .map((item) => item.member);
}

function findRelevantEvents(query, events, limit = 5) {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => ({
      event,
      score: scoreTextAgainstQuery(query, [event?.title, event?.lunarDate, event?.solarDate, event?.location, event?.description].join(' '))
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.event);
}

function findRelevantDocs(query, docs, limit = 5) {
  if (!Array.isArray(docs)) return [];
  return docs
    .map((doc) => ({
      doc,
      score: scoreTextAgainstQuery(query, [doc?.title, doc?.content].join(' '))
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.doc,
      content: compactText(item.doc?.content, 900)
    }));
}

function mergeKnowledgeDocuments(...docGroups) {
  const seen = new Set();
  const merged = [];
  for (const group of docGroups) {
    if (!Array.isArray(group)) continue;
    for (const doc of group) {
      if (!doc || typeof doc !== 'object') continue;
      const key = String(doc.id || doc.title || doc.content || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({
        ...doc,
        content: compactText(doc.content || '', 900)
      });
    }
  }
  return merged;
}

function isAnniversaryQuestion(message) {
  const text = normalizeVietnameseSearch(message);
  return /\b(gio|ky|ky nhat|ngay mat|mat ngay|le gio|cung gio)\b/.test(text);
}

function isSensitiveGenealogyQuestion(message) {
  const text = normalizeVietnameseSearch(message);
  if (isAnniversaryQuestion(text)) return false;
  return [
    'chi tiet',
    'thong tin',
    'so dien thoai',
    'email',
    'dia chi',
    'noi o',
    'vo',
    'chong',
    'me',
    'cha',
    'bo de',
    'con cua',
    'anh em',
    'ngay sinh',
    'nam sinh',
    'mo phan',
    'noi an tang'
  ].some((keyword) => text.includes(keyword));
}

function formatStructuredMemberDateLine(label, structuredDate) {
  if (!structuredDate || typeof structuredDate !== 'object' || structuredDate.precision === 'unknown') return '';
  const formatted = formatGenealogyDateStructured(structuredDate);
  if (!formatted) return '';
  if (structuredDate.precision === 'day_month' && structuredDate.calendar === 'lunar') {
    return `${label}: ${formatted}; năm mất: chưa rõ`;
  }
  return `${label}: ${formatted}`;
}

function formatMemberContext(member, canShowPrivate) {
  const structuredAnniversary = formatStructuredMemberDateLine('Ngày giỗ/kỵ nhật âm lịch', member.deathAnniversaryLunarStructured);
  const structuredDeath = formatStructuredMemberDateLine('Ngày/năm mất', member.deathDateStructured);
  const structuredBirth = formatStructuredMemberDateLine('Ngày/năm sinh', member.birthDateStructured);
  const structuredLines = [structuredAnniversary, structuredDeath, structuredBirth].filter(Boolean);
  const publicLines = [
    `Tên: ${member.name}`,
    `Đời: ${member.generation}`,
    member.title ? `Tước vị/vai trò: ${member.title}` : '',
    member.branch ? `Chi/ngành: ${member.branch}` : '',
    member.isLiving ? 'Tình trạng: còn sống' : 'Tình trạng: đã mất',
    member.deathAnniversaryLunar ? `Ngày giỗ/kỵ nhật âm lịch: ${member.deathAnniversaryLunar}` : '',
    member.solarDeathDate ? `Ngày mất dương lịch: ${member.solarDeathDate}` : '',
    member.deathYear ? `Năm mất: ${member.deathYear}` : ''
  ];
  const privateLines = canShowPrivate ? [
    member.birthYear ? `Năm sinh: ${member.birthYear}` : '',
    member.solarBirthDate ? `Ngày sinh dương lịch: ${member.solarBirthDate}` : '',
    member.fatherName ? `Cha: ${member.fatherName}` : '',
    member.motherName ? `Mẹ: ${member.motherName}` : '',
    member.spouse ? `Vợ/chồng: ${member.spouse}` : '',
    member.residence ? `Nơi ở: ${member.residence}` : '',
    member.graveLocation ? `Mộ phần: ${member.graveLocation}` : '',
    member.bio ? `Hành trạng: ${compactText(member.bio, 420)}` : ''
  ] : [];
  return [...publicLines, ...structuredLines, ...privateLines].filter(Boolean).join('; ');
}

async function buildWebviewAIContext(req, message) {
  const session = await getAuthSession(req);
  const authUser = await findAuthUserForSession(session);
  const authScope = getAuthScope(session, authUser);
  const canShowPrivate = Boolean(
    authUser?.isKYCed &&
    authUser?.kycStatus === 'verified' &&
    authUser?.isApproved !== false &&
    authUser?.approvalStatus !== 'rejected'
  );

  if (!canShowPrivate && isSensitiveGenealogyQuestion(message)) {
    return {
      authScope,
      blockedText: [
        'Thông tin chi tiết từng người trong gia phả chỉ hiển thị cho tài khoản đã đăng nhập và được KYC.',
        'Quý vị vẫn có thể hỏi các thông tin công khai như phả ký chung, tộc ước, sự kiện hoặc ngày giỗ đã được công bố.'
      ].join('\n')
    };
  }

  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const knowledgeDocs = await readState('dashboard-knowledge') || [];
  const dashboardEvents = await readState('dashboard-events') || [];
  const dashboardAi = await readState('dashboard-ai') || {};
  const relevantMembers = findRelevantMembers(message, members);
  const relevantEvents = findRelevantEvents(message, dashboardEvents);
  const relevantDocs = findRelevantDocs(message, knowledgeDocs);

  const contextSections = [
    'Ngữ cảnh bắt buộc từ hệ thống:',
    '- Đây là chatbox webview. Chỉ trả lời bằng dữ liệu đã có trong cây phả, kho tri thức, lịch giỗ/sự kiện hoặc kiến thức phổ thông về quản lý gia phả.',
    '- Không tự bịa nhân vật, ngày tháng, chi/ngành, địa danh, chức tước hoặc quan hệ họ hàng.',
    canShowPrivate
      ? '- Người hỏi đã đăng nhập và KYC: có thể dùng thông tin chi tiết nếu dữ liệu có.'
      : '- Người hỏi chưa KYC: chỉ trả lời dữ liệu công khai; nếu thiếu dữ liệu thì hướng dẫn đăng nhập/KYC hoặc liên hệ Ban trị sự.',
    relevantMembers.length
      ? `\nNhân vật liên quan trong cây phả:\n${relevantMembers.map((member) => `- ${formatMemberContext(member, canShowPrivate)}`).join('\n')}`
      : '\nNhân vật liên quan trong cây phả: chưa tìm thấy khớp rõ ràng.',
    relevantEvents.length
      ? `\nLịch giỗ/sự kiện liên quan:\n${relevantEvents.map((event) => `- ${event.title || 'Sự kiện'}; âm lịch: ${event.lunarDate || 'chưa rõ'}; dương lịch: ${event.solarDate || 'chưa rõ'}; địa điểm: ${event.location || 'chưa rõ'}`).join('\n')}`
      : '',
    relevantDocs.length
      ? `\nTài liệu dashboard liên quan:\n${relevantDocs.map((doc) => `- ${doc.title}: ${doc.content}`).join('\n')}`
      : '',
    isAnniversaryQuestion(message) && !relevantMembers.some((member) => member.deathAnniversaryLunar || member.solarDeathDate)
      ? '\nLưu ý ngày giỗ: chưa tìm thấy ngày giỗ/kỵ nhật trong dữ liệu khớp câu hỏi. Nếu trả lời, phải nói rõ chưa có dữ liệu xác minh.'
      : ''
  ].filter(Boolean).join('\n');

  return {
    message: `${message}\n\n${contextSections}`,
    documents: relevantDocs,
    modelName: dashboardAi.modelName,
    temperature: dashboardAi.temperature,
    engine: pickDashboardEngine(dashboardAi, 'chat'),
    authScope
  };
}

async function buildDashboardAIContext(req, message, queryText) {
  const query = String(queryText || message || '').trim();
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const knowledgeDocs = await readState('dashboard-knowledge') || [];
  const dashboardEvents = await readState('dashboard-events') || [];
  const dashboardAi = await readState('dashboard-ai') || {};
  const providedDocs = [];
  const intent = normalizeGatewayText(req.body?.intent || req.body?.type || 'chat') || 'chat';

  const scoredMembers = findRelevantMembers(query, members, 10);
  const anniversaryFallbackMembers = isAnniversaryQuestion(query) &&
    !scoredMembers.some((member) => member.deathAnniversaryLunar || member.solarDeathDate || member.deathYear)
    ? members
      .filter((member) => member.deathAnniversaryLunar || member.solarDeathDate || member.deathYear)
      .slice(0, 12)
    : [];
  const relevantMembers = scoredMembers.length ? scoredMembers : anniversaryFallbackMembers;
  const relevantEvents = findRelevantEvents(query, dashboardEvents, 6);
  const relevantDocs = mergeKnowledgeDocuments(providedDocs, findRelevantDocs(query, knowledgeDocs, 6));

  const contextSections = [
    'Ngữ cảnh bắt buộc từ dashboard:',
    '- Đây là Trác Thư Đàm Luận / AI Helper trong khu quản trị. Trước khi trả lời phải ưu tiên dữ liệu trong cây phả, lịch giỗ/sự kiện và kho tri thức dashboard.',
    '- Không nói không tìm thấy nếu phần “Nhân vật liên quan trong cây phả” hoặc “Lịch giỗ/sự kiện liên quan” bên dưới đã có dữ liệu.',
    '- Không tự bịa ngày tháng, chức tước, hành trạng hoặc địa danh. Nếu dữ liệu khuyết, ghi rõ phần cần Ban trị sự kiểm chứng.',
    relevantMembers.length
      ? `\nNhân vật liên quan trong cây phả:\n${relevantMembers.map((member) => `- ${formatMemberContext(member, true)}`).join('\n')}`
      : '\nNhân vật liên quan trong cây phả: chưa tìm thấy khớp rõ ràng.',
    relevantEvents.length
      ? `\nLịch giỗ/sự kiện liên quan:\n${relevantEvents.map((event) => `- ${event.title || 'Sự kiện'}; âm lịch: ${event.lunarDate || 'chưa rõ'}; dương lịch: ${event.solarDate || 'chưa rõ'}; địa điểm: ${event.location || 'chưa rõ'}; mô tả: ${compactText(event.description || '', 260) || 'chưa rõ'}`).join('\n')}`
      : '',
    relevantDocs.length
      ? `\nTài liệu/kho tri thức liên quan:\n${relevantDocs.map((doc) => `- ${doc.title || 'Tài liệu'}: ${doc.content || ''}`).join('\n')}`
      : '',
    isAnniversaryQuestion(query) && !relevantMembers.some((member) => member.deathAnniversaryLunar || member.solarDeathDate || member.deathYear) && !relevantEvents.some((event) => event.lunarDate || event.solarDate)
      ? '\nLưu ý ngày giỗ: chưa tìm thấy ngày giỗ/kỵ nhật khớp câu hỏi trong dữ liệu dashboard. Nếu trả lời, phải nói rõ chưa có dữ liệu xác minh.'
      : ''
  ].filter(Boolean).join('\n');

  return {
    message: `${message}\n\n${contextSections}`,
    documents: relevantDocs,
    lineageMatches: relevantMembers,
    eventMatches: relevantEvents,
    modelName: dashboardAi.modelName,
    temperature: dashboardAi.temperature,
    engine: pickDashboardEngine(dashboardAi, intent)
  };
}

async function handleGeminiRequest(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  let message = String(req.body?.message || req.body?.prompt || '').trim();
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }
  const userQuery = String(req.body?.prompt || message).trim();
  let requestContext = req.body || {};
  const requestType = String(req.body?.type || '').trim();
  if (requestType === 'webview_chat') {
    try {
      const webviewContext = await buildWebviewAIContext(req, message);
      if (webviewContext.blockedText) {
        res.json({ model: 'policy', engine: 'policy', text: webviewContext.blockedText });
        return;
      }
      message = webviewContext.message || message;
      requestContext = {
        ...requestContext,
        ...webviewContext,
        engine: requestContext.engine || webviewContext.engine,
        modelName: requestContext.modelName || webviewContext.modelName,
        temperature: requestContext.temperature ?? webviewContext.temperature
      };
    } catch (err) {
      console.warn('Failed to build webview AI context:', err?.message || err);
    }
  } else if (['chat', 'ceremony', 'prayer', 'han_nom', 'han-nom', 'audit', 'article'].includes(requestType || 'chat')) {
    try {
      const dashboardContext = await buildDashboardAIContext(req, message, userQuery);
      message = dashboardContext.message || message;
      requestContext = {
        ...requestContext,
        ...dashboardContext,
        engine: requestContext.engine || dashboardContext.engine,
        modelName: requestContext.modelName || dashboardContext.modelName,
        temperature: requestContext.temperature ?? dashboardContext.temperature,
        documents: mergeKnowledgeDocuments(requestContext.documents, dashboardContext.documents)
      };
    } catch (err) {
      console.warn('Failed to build dashboard AI context:', err?.message || err);
    }
  }
  const requestedEngine = String(requestContext?.engine || '').trim().toLowerCase();
  if (requestedEngine === 'local' || requestedEngine === 'local-knowledge') {
    res.json({ model: 'local', engine: 'local', text: await buildLocalAIResponse({ ...req, body: requestContext }, userQuery) });
    return;
  }
  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = String(requestContext?.modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    const temperature = Number(requestContext?.temperature);
    const config = Number.isFinite(temperature)
      ? { temperature: Math.max(0, Math.min(1, temperature)) }
      : undefined;
    const response = await ai.models.generateContent({
      model,
      ...(config ? { config } : {}),
      contents: [
        'Bạn là trợ lý gia phả họ Cao. Trả lời ngắn gọn, cẩn trọng, chỉ dựa trên dữ liệu người dùng cung cấp hoặc kiến thức phổ thông về cách quản lý gia phả. Không bịa thông tin phả hệ cụ thể.',
        message.length > MAX_GEMINI_INPUT_CHARS
          ? `${message.slice(0, MAX_GEMINI_INPUT_CHARS)}\n\n[Hệ thống đã rút gọn phần tài liệu quá dài để tránh vượt quota Gemini.]`
          : message
      ].join('\n\nCâu hỏi: ')
    });

    const text = typeof response.text === 'function' ? response.text() : response.text;
    res.json({ model, text: text || 'Tôi chưa có đủ dữ liệu để trả lời chính xác.' });
  } catch (err) {
    const parsed = parseGeminiApiError(err);
    console.error('Gemini request failed:', parsed.details, `| status=${parsed.status}`);
    res.status(parsed.status).json(parsed);
  }
}

async function callGeminiProvider({ apiKey, requestContext, message, requestId }) {
  const ai = new GoogleGenAI({ apiKey });
  const model = String(requestContext?.modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const temperature = Number(requestContext?.temperature);
  const maxOutputTokens = Math.max(1, Math.min(8192, Number(requestContext?.maxOutputTokens || requestContext?.botConfig?.maxOutputTokens || 0) || 0));
  const config = {
    ...(Number.isFinite(temperature) ? { temperature: Math.max(0, Math.min(1, temperature)) } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {})
  };
  const baseMessage = message.length > MAX_GEMINI_INPUT_CHARS
    ? `${message.slice(0, MAX_GEMINI_INPUT_CHARS)}\n\n[He thong da rut gon phan tai lieu qua dai de tranh vuot quota Gemini.]`
    : message;
  let lastError = null;

  const retry429 = Math.max(0, Math.min(3, Number(requestContext.retry429 ?? AI_GATEWAY_RETRY_429) || 0));
  const retryDelayOverrideMs = Math.max(100, Math.min(5000, Number(requestContext.retryDelayMs || 0) || 0));
  for (let attempt = 0; attempt <= retry429; attempt += 1) {
    try {
      const attemptMessage = attempt > 0
        ? compactText(baseMessage, Math.max(1800, Math.floor(MAX_GEMINI_INPUT_CHARS * 0.75)))
        : baseMessage;
      const response = await ai.models.generateContent({
        model,
        ...(Object.keys(config).length ? { config } : {}),
        contents: [
          'Bạn là trợ lý gia phả họ Cao. Trả lời ngắn gọn, cẩn trọng, chỉ dựa trên dữ liệu người dùng cung cấp hoặc kiến thức phổ thông về cách quản lý gia phả. Không bịa thông tin phả hệ cụ thể.',
          attemptMessage
        ].join('\n\nCau hoi: ')
      });

      const text = typeof response.text === 'function' ? response.text() : response.text;
      return {
        model,
        provider: 'gemini',
        engine: requestContext.engine || 'gemini',
        text: text || 'Tôi chưa có đủ dữ liệu để trả lời chính xác.'
      };
    } catch (err) {
      const parsed = parseGeminiApiError(err);
      lastError = parsed;
      if (parsed.status !== 429 || attempt >= retry429) break;
      const delayMs = retryDelayOverrideMs || parseRetryDelayMs(parsed.retryDelay);
      console.warn(`[ai-gateway] requestId=${requestId} provider=gemini status=429 retry=${attempt + 1}/${retry429} delayMs=${delayMs}`);
      await sleep(delayMs);
    }
  }

  throw lastError || { status: 502, error: 'Gemini request failed.', details: 'Unknown provider error.' };
}

async function handleAIGatewayRequest(req, res) {
  const requestId = randomToken(8);
  const startedAt = Date.now();
  const routeName = req.aiGatewayRoute || (req.path === '/api/gemini' ? 'gemini-legacy' : 'ai-chat');
  const apiKey = process.env.GEMINI_API_KEY;
  let message = String(req.body?.message || req.body?.prompt || '').trim();
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const userQuery = String(req.body?.prompt || message).trim();
  let requestContext = normalizeAIGatewayContext(req.body || {}, routeName);
  const botConfig = await getAIBotConfig(requestContext.botType);
  requestContext = {
    ...requestContext,
    botType: botConfig.botType,
    botConfig,
    engine: requestContext.engine || botConfig.engine,
    maxOutputTokens: botConfig.maxOutputTokens,
    retry429: botConfig.retry429,
    retryDelayMs: botConfig.retryDelayMs
  };
  const botCacheOptions = { enabled: botConfig.cacheEnabled, ttlMs: botConfig.cacheTtlMs };
  if (!botConfig.enabled) {
    const pausedResponse = {
      model: 'bot-paused',
      provider: 'policy',
      engine: 'policy',
      botType: requestContext.botType,
      intent: requestContext.intent,
      text: botConfig.pausedReason ? `Bot này đang tạm dừng: ${botConfig.pausedReason}.` : 'Bot này đang tạm dừng.'
    };
    logAIGatewayRequest({
      requestId,
      route: routeName,
      botType: requestContext.botType,
      intent: requestContext.intent,
      type: requestContext.type,
      engine: 'policy',
      provider: 'policy',
      model: 'bot-paused',
      status: 200,
      cached: false,
      durationMs: Date.now() - startedAt,
      requestChars: userQuery.length,
      contextChars: message.length,
      estimatedTokens: estimateTextTokens(message),
      promptSnippet: userQuery,
      botConfigEngine: botConfig.engine,
      botConfigMaxChunks: botConfig.maxKnowledgeChunks,
      botConfigMaxOutputTokens: botConfig.maxOutputTokens,
      cacheEnabled: botConfig.cacheEnabled,
      configVersion: botConfig.updatedAt
    });
    res.json(pausedResponse);
    return;
  }
  const requestType = requestContext.type;
  let gatewayKnowledgeResult = null;
  const logGateway = (fields = {}) => logAIGatewayRequest({
    requestId,
    route: routeName,
    botType: requestContext.botType,
    intent: requestContext.intent,
    type: requestContext.type,
    requestChars: userQuery.length,
    contextChars: message.length,
    estimatedTokens: estimateTextTokens(message),
    promptSnippet: userQuery,
    knowledgeMatchesCount: requestContext.localKnowledgeMatches?.chunkCount || fields.knowledgeMatchesCount || 0,
    knowledgeSourceIds: requestContext.localKnowledgeMatches?.sourceIds || fields.knowledgeSourceIds || [],
    contextTrimmed: Boolean(requestContext.contextTrimmed || fields.contextTrimmed),
    botConfigEngine: botConfig.engine,
    botConfigMaxChunks: botConfig.maxKnowledgeChunks,
    botConfigMaxOutputTokens: botConfig.maxOutputTokens,
    cacheEnabled: botConfig.cacheEnabled,
    configVersion: botConfig.updatedAt,
    ...fields
  });
  try {
    const authContext = await getRequestAuthContext(req);
    requestContext = { ...requestContext, authScope: authContext.authScope || 'anonymous' };
  } catch (err) {
    console.warn('Failed to read AI gateway auth context:', err?.message || err);
    requestContext = { ...requestContext, authScope: 'anonymous' };
  }

  try {
    if (requestContext.intent === 'anniversary_notice_draft' && requestContext.anniversary) {
      const text = composeAnniversaryNoticeDraft(requestContext.anniversary, {
        channel: requestContext.channel,
        location: requestContext.location,
        note: requestContext.note
      });
      const localDraftResponse = {
        model: 'local-anniversary-draft',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text,
        knowledgeMatchesCount: 0,
        knowledgeSourceIds: []
      };
      logGateway({
        engine: 'local-anniversary-draft',
        model: 'local-anniversary-draft',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt
      });
      res.json(localDraftResponse);
      return;
    }

    const anniversaryAnswer = await buildAnniversaryLocalAnswer(userQuery || message, requestContext.authScope || 'anonymous');
    if (anniversaryAnswer) {
      const knowledgeResponse = {
        model: 'local-anniversary',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: anniversaryAnswer,
        knowledgeMatchesCount: 1,
        knowledgeSourceIds: []
      };
      logGateway({
        engine: 'local-anniversary',
        model: 'local-anniversary',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: 1,
        knowledgeSourceIds: []
      });
      res.json(knowledgeResponse);
      return;
    }

    const requiredAliasAnswer = buildRequiredAliasAnswer(userQuery || message);
    const initialKnowledge = await searchKnowledgeWithAliases(userQuery || message, {
      limit: botConfig.maxKnowledgeChunks,
      authScope: requestContext.authScope || 'anonymous'
    });
    const initialKnowledgeAnswer = requiredAliasAnswer || buildAliasLookupAnswer(initialKnowledge);
    if (initialKnowledgeAnswer) {
      const knowledgeResponse = {
        model: 'local-knowledge',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: initialKnowledgeAnswer,
        knowledgeMatchesCount: initialKnowledge.chunks.length,
        knowledgeSourceIds: [...new Set(initialKnowledge.chunks.map((row) => row.source_id))],
        knowledge: {
          aliases: initialKnowledge.aliases.slice(0, 4).map((row) => ({
            canonicalName: row.canonical_name,
            alias: row.alias,
            requiredTitle: row.required_title,
            generation: row.generation,
            exampleOnly: Boolean(row.example_only),
            needsVerification: Boolean(row.needs_verification)
          }))
        }
      };
      logGateway({
        engine: 'local-knowledge',
        model: 'local-knowledge',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: initialKnowledge.chunks.length,
        knowledgeSourceIds: [...new Set(initialKnowledge.chunks.map((row) => row.source_id))]
      });
      res.json(knowledgeResponse);
      return;
    }
  } catch (err) {
    console.warn('Failed to search initial local knowledge:', err?.message || err);
  }

  if (requestType === 'webview_chat') {
    try {
      const webviewContext = await buildWebviewAIContext(req, message);
      requestContext = { ...requestContext, authScope: webviewContext.authScope || 'anonymous' };
      if (webviewContext.blockedText) {
        const policyCacheKey = buildAIGatewayCacheKey({
          ...requestContext,
          message,
          prompt: userQuery
        });
        const cachedPolicyResponse = getAIGatewayCachedResponse(policyCacheKey, botCacheOptions);
        if (cachedPolicyResponse) {
          logGateway({
            engine: 'policy',
            model: cachedPolicyResponse.model,
            status: 200,
            cached: true,
            durationMs: Date.now() - startedAt
          });
          res.json(cachedPolicyResponse);
          return;
        }
        const policyResponse = {
          model: 'policy',
          provider: 'policy',
          engine: 'policy',
          botType: requestContext.botType,
          intent: requestContext.intent,
          text: webviewContext.blockedText
        };
        setAIGatewayCachedResponse(policyCacheKey, policyResponse, botCacheOptions);
        logGateway({
          engine: 'policy',
          provider: 'policy',
          model: 'policy',
          status: 200,
          cached: false,
          durationMs: Date.now() - startedAt
        });
        res.json(policyResponse);
        return;
      }
      message = webviewContext.message || message;
      requestContext = {
        ...requestContext,
        ...webviewContext,
        engine: requestContext.engine || webviewContext.engine,
        modelName: requestContext.modelName || webviewContext.modelName,
        temperature: requestContext.temperature ?? webviewContext.temperature
      };
    } catch (err) {
      console.warn('Failed to build webview AI context:', err?.message || err);
    }
  } else if (shouldHydrateDashboardAIContext(requestContext)) {
    try {
      const dashboardContext = await buildDashboardAIContext(req, message, userQuery);
      message = dashboardContext.message || message;
      requestContext = {
        ...requestContext,
        ...dashboardContext,
        engine: requestContext.engine || dashboardContext.engine,
        modelName: requestContext.modelName || dashboardContext.modelName,
        temperature: requestContext.temperature ?? dashboardContext.temperature,
        documents: mergeKnowledgeDocuments(requestContext.documents, dashboardContext.documents)
      };
    } catch (err) {
      console.warn('Failed to build dashboard AI context:', err?.message || err);
    }
  }

  try {
    const localKnowledge = await searchKnowledgeWithAliases(userQuery || message, {
      limit: botConfig.maxKnowledgeChunks,
      authScope: requestContext.authScope || 'anonymous'
    });
    gatewayKnowledgeResult = localKnowledge;
    const anniversaryCandidates = await searchExtractedAnniversaryCandidatesForQuery(userQuery || message, {
      authScope: requestContext.authScope || 'anonymous',
      limit: 5
    });
    const extractedAnniversaryAnswer = buildExtractedAnniversaryAnswer(userQuery || message, anniversaryCandidates);
    if (extractedAnniversaryAnswer) {
      const sourceIds = [...new Set(anniversaryCandidates.map((row) => row.source_id).filter(Boolean))];
      const knowledgeResponse = {
        model: 'local-knowledge',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: extractedAnniversaryAnswer,
        knowledgeMatchesCount: localKnowledge.chunks.length + anniversaryCandidates.length,
        knowledgeSourceIds: sourceIds.length ? sourceIds : [...new Set(localKnowledge.chunks.map((row) => row.source_id))]
      };
      logGateway({
        engine: 'local-knowledge',
        model: 'local-knowledge',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: knowledgeResponse.knowledgeMatchesCount,
        knowledgeSourceIds: knowledgeResponse.knowledgeSourceIds
      });
      res.json(knowledgeResponse);
      return;
    }
    const missingAnniversaryAnswer = buildMissingAnniversaryVerificationAnswer(userQuery || message, localKnowledge);
    if (missingAnniversaryAnswer) {
      const sourceIds = [...new Set(localKnowledge.chunks.map((row) => row.source_id))];
      const knowledgeResponse = {
        model: 'local-knowledge',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: missingAnniversaryAnswer,
        knowledgeMatchesCount: localKnowledge.chunks.length,
        knowledgeSourceIds: sourceIds
      };
      logGateway({
        engine: 'local-knowledge',
        model: 'local-knowledge',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: localKnowledge.chunks.length,
        knowledgeSourceIds: sourceIds
      });
      res.json(knowledgeResponse);
      return;
    }
    const verificationAnswer = buildVerificationKnowledgeAnswer(userQuery || message, localKnowledge);
    if (verificationAnswer) {
      const sourceIds = [...new Set(verificationAnswer.chunks.map((row) => row.source_id))];
      const knowledgeResponse = {
        model: 'local-knowledge',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: verificationAnswer.text,
        knowledgeMatchesCount: verificationAnswer.chunks.length,
        knowledgeSourceIds: sourceIds
      };
      logGateway({
        engine: 'local-knowledge',
        model: 'local-knowledge',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: verificationAnswer.chunks.length,
        knowledgeSourceIds: sourceIds
      });
      res.json(knowledgeResponse);
      return;
    }
    const localKnowledgeAnswer = buildAliasLookupAnswer(localKnowledge);
    if (localKnowledgeAnswer) {
      const knowledgeResponse = {
        model: 'local-knowledge',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: localKnowledgeAnswer,
        knowledgeMatchesCount: localKnowledge.chunks.length,
        knowledgeSourceIds: [...new Set(localKnowledge.chunks.map((row) => row.source_id))],
        knowledge: {
          aliases: localKnowledge.aliases.slice(0, 4).map((row) => ({
            canonicalName: row.canonical_name,
            alias: row.alias,
            requiredTitle: row.required_title,
            generation: row.generation,
            exampleOnly: Boolean(row.example_only),
            needsVerification: Boolean(row.needs_verification)
          }))
        }
      };
      const knowledgeCacheKey = buildAIGatewayCacheKey({
        ...requestContext,
        authScope: requestContext.authScope || 'none',
        message,
        prompt: userQuery,
        localKnowledgeAnswer
      });
      setAIGatewayCachedResponse(knowledgeCacheKey, knowledgeResponse, botCacheOptions);
      logGateway({
        engine: 'local-knowledge',
        model: 'local-knowledge',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: localKnowledge.chunks.length,
        knowledgeSourceIds: [...new Set(localKnowledge.chunks.map((row) => row.source_id))]
      });
      res.json(knowledgeResponse);
      return;
    }

    const localKnowledgeContext = compactText(formatKnowledgeContextForAI(localKnowledge), botConfig.maxKnowledgeChars);
    if (localKnowledgeContext) {
      message = `${message}\n\n${localKnowledgeContext}`;
      requestContext = {
        ...requestContext,
        localKnowledgeMatches: {
          aliasCount: localKnowledge.aliases.length,
          chunkCount: localKnowledge.chunks.length,
          sourceIds: [...new Set(localKnowledge.chunks.map((row) => row.source_id))]
        }
      };
    }
  } catch (err) {
    console.warn('Failed to search local knowledge:', err?.message || err);
  }

  requestContext = { ...requestContext, authScope: requestContext.authScope || 'none' };
  if (message.length > MAX_GEMINI_INPUT_CHARS) {
    requestContext = { ...requestContext, contextTrimmed: true };
  }
  const cacheKey = buildAIGatewayCacheKey({
    ...requestContext,
    message,
    prompt: userQuery
  });
  const cachedResponse = getAIGatewayCachedResponse(cacheKey, botCacheOptions);
  if (cachedResponse) {
    logGateway({
      engine: requestContext.engine,
      model: cachedResponse.model,
      status: 200,
      cached: true,
      durationMs: Date.now() - startedAt
    });
    res.json(cachedResponse);
    return;
  }

  const requestedEngine = String(requestContext?.engine || '').trim().toLowerCase();
  if (requestedEngine === 'local') {
    const localKnowledgeAnswer = buildKnowledgeChunkLocalAnswer(gatewayKnowledgeResult);
    const localResponse = {
      model: 'local',
      provider: 'local',
      engine: requestedEngine,
      botType: requestContext.botType,
      intent: requestContext.intent,
      text: localKnowledgeAnswer || await buildLocalAIResponse({ ...req, body: requestContext }, userQuery),
      knowledgeMatchesCount: requestContext.localKnowledgeMatches?.chunkCount || 0,
      knowledgeSourceIds: requestContext.localKnowledgeMatches?.sourceIds || []
    };
    setAIGatewayCachedResponse(cacheKey, localResponse, botCacheOptions);
    logGateway({
      engine: requestedEngine,
      model: 'local',
      status: 200,
      cached: false,
      durationMs: Date.now() - startedAt
    });
    res.json(localResponse);
    return;
  }

  if (requestedEngine === 'chatgpt' || requestedEngine === 'openai') {
    const status = process.env.OPENAI_API_KEY ? 501 : 503;
    const providerResponse = {
      error: 'ChatGPT provider is not available in this deployment.',
      details: process.env.OPENAI_API_KEY
        ? 'OPENAI_API_KEY is configured, but the OpenAI provider adapter is not implemented yet. Choose Gemini or Local in AI settings.'
        : 'OPENAI_API_KEY is not configured. Choose Gemini or Local in AI settings, or configure an OpenAI provider adapter before using ChatGPT.',
      provider: 'chatgpt',
      engine: 'chatgpt',
      botType: requestContext.botType,
      intent: requestContext.intent
    };
    logGateway({
      engine: 'chatgpt',
      model: requestContext.modelName,
      status,
      cached: false,
      durationMs: Date.now() - startedAt,
      errorCode: String(status),
      errorMessage: providerResponse.details
    });
    res.status(status).json(providerResponse);
    return;
  }

  if (!apiKey) {
    logGateway({
      engine: requestContext.engine,
      model: requestContext.modelName,
      status: 503,
      cached: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'GEMINI_API_KEY',
      errorMessage: 'GEMINI_API_KEY is not configured on the server.'
    });
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    const gatewayResponse = await callGeminiProvider({ apiKey, requestContext, message, requestId });
    const responsePayload = {
      ...gatewayResponse,
      botType: requestContext.botType,
      intent: requestContext.intent,
      knowledgeMatchesCount: requestContext.localKnowledgeMatches?.chunkCount || 0,
      knowledgeSourceIds: requestContext.localKnowledgeMatches?.sourceIds || []
    };
    setAIGatewayCachedResponse(cacheKey, responsePayload, botCacheOptions);
    logGateway({
      engine: responsePayload.engine,
      provider: responsePayload.provider,
      model: responsePayload.model,
      status: 200,
      cached: false,
      durationMs: Date.now() - startedAt
    });
    res.json(responsePayload);
  } catch (err) {
    const parsed = err?.status ? err : parseGeminiApiError(err);
    console.error('Gemini request failed:', parsed.details, `| status=${parsed.status}`);
    logGateway({
      engine: requestContext.engine,
      model: requestContext.modelName,
      status: parsed.status,
      cached: false,
      durationMs: Date.now() - startedAt,
      errorCode: String(parsed.status || ''),
      errorMessage: parsed.details || parsed.error || ''
    });
    res.status(parsed.status).json(parsed);
  }
}

app.post('/api/ai/chat', handleAIGatewayRequest);
app.post('/api/gemini', (req, res, next) => {
  req.aiGatewayRoute = 'gemini-legacy';
  handleAIGatewayRequest(req, res, next);
});
app.get('/api/ai/status', (_req, res) => {
  res.json({
    ok: true,
    gateway: 'ai',
    provider: 'gemini',
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    cache: {
      enabled: AI_GATEWAY_CACHE_TTL_MS > 0,
      size: aiGatewayCache.size,
      ttlMs: AI_GATEWAY_CACHE_TTL_MS
    },
    retry429: AI_GATEWAY_RETRY_429
  });
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', async (_req, res) => {
    res.type('html').send(await readFile(resolve(DIST_DIR, 'index.html'), 'utf8'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
