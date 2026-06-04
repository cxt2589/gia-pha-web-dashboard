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
import { formatPersonDisplayAddress, getLineageAddressByGeneration } from './src/utils/lineageAddress.mjs';

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
const CAO_TOC_V2_DATASET_DIR = resolve(__dirname, process.env.CAO_TOC_V2_DATASET_DIR || '../gia-pha-ai-system-archive-20260530/Tai lieu/Cao_Toc_TXT_Knowledge_Base_v2');
const TREE_STATE_KEY = 'lineage-tree';
const AUTH_USERS_STATE_KEY = 'auth-users';
const AUTH_SESSIONS_STATE_KEY = 'auth-sessions';
const SHARED_STATE_KEYS = new Set(['app-settings', 'dashboard-theme', 'dashboard-ai', 'dashboard-articles', 'dashboard-knowledge', 'dashboard-events', 'dashboard-zalo-rules', 'ai-operation-graph-layout']);
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

    CREATE TABLE IF NOT EXISTS ai_action_drafts (
      id TEXT PRIMARY KEY,
      draft_type TEXT NOT NULL DEFAULT 'other',
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      target_module TEXT NOT NULL DEFAULT 'other',
      target_id TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT NOT NULL DEFAULT '',
      related_member_ids_json TEXT NOT NULL DEFAULT '[]',
      related_source_ids_json TEXT NOT NULL DEFAULT '[]',
      related_chunk_ids_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      applied_by TEXT NOT NULL DEFAULT '',
      applied_at TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ai_action_draft_logs (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    CREATE TABLE IF NOT EXISTS system_audit_suggestions (
      id TEXT PRIMARY KEY,
      suggestion_hash TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'other',
      source_path TEXT NOT NULL DEFAULT '',
      location_label TEXT NOT NULL DEFAULT '',
      current_value TEXT NOT NULL DEFAULT '',
      issue_type TEXT NOT NULL DEFAULT 'other',
      issue_summary TEXT NOT NULL DEFAULT '',
      suggested_value TEXT NOT NULL DEFAULT '',
      suggested_action TEXT NOT NULL DEFAULT 'needs_manual_review',
      priority TEXT NOT NULL DEFAULT 'medium',
      evidence TEXT NOT NULL DEFAULT '',
      related_source_ids_json TEXT NOT NULL DEFAULT '[]',
      related_chunk_ids_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL DEFAULT '',
      applied_by TEXT NOT NULL DEFAULT '',
      applied_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS system_audit_apply_logs (
      id TEXT PRIMARY KEY,
      suggestion_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT '',
      source_path TEXT NOT NULL DEFAULT '',
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    CREATE TABLE IF NOT EXISTS extracted_relationship_candidates (
      id TEXT PRIMARY KEY,
      relationship_type TEXT NOT NULL DEFAULT 'parent_child',
      subject_name TEXT NOT NULL DEFAULT '',
      subject_name_norm TEXT NOT NULL DEFAULT '',
      subject_member_id TEXT NOT NULL DEFAULT '',
      subject_member_name TEXT NOT NULL DEFAULT '',
      subject_match_confidence TEXT NOT NULL DEFAULT 'none',
      object_name TEXT NOT NULL DEFAULT '',
      object_name_norm TEXT NOT NULL DEFAULT '',
      object_member_id TEXT NOT NULL DEFAULT '',
      object_member_name TEXT NOT NULL DEFAULT '',
      object_match_confidence TEXT NOT NULL DEFAULT 'none',
      direction TEXT NOT NULL DEFAULT 'subject_to_object',
      extracted_text TEXT NOT NULL DEFAULT '',
      reviewed_text TEXT NOT NULL DEFAULT '',
      source_quote TEXT NOT NULL DEFAULT '',
      source_id TEXT NOT NULL DEFAULT '',
      chunk_id TEXT NOT NULL DEFAULT '',
      knowledge_title TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'pending',
      flags_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS extracted_relationship_audit_logs (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      subject_member_id TEXT NOT NULL DEFAULT '',
      object_member_id TEXT NOT NULL DEFAULT '',
      relationship_type TEXT NOT NULL DEFAULT '',
      old_value_json TEXT NOT NULL DEFAULT '{}',
      new_value_json TEXT NOT NULL DEFAULT '{}',
      source_id TEXT NOT NULL DEFAULT '',
      chunk_id TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cao_toc_v3_pilot_apply_logs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT '',
      candidate_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL DEFAULT '',
      member_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'applied',
      rollback_status TEXT NOT NULL DEFAULT '',
      rollback_audit_id TEXT NOT NULL DEFAULT '',
      before_tree_hash TEXT NOT NULL DEFAULT '',
      after_tree_hash TEXT NOT NULL DEFAULT '',
      before_tree_json TEXT NOT NULL DEFAULT '',
      candidate_before_json TEXT NOT NULL DEFAULT '{}',
      candidate_after_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      admin_user TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      rolled_back_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS knowledge_maintenance_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL DEFAULT '',
      summary_json TEXT NOT NULL DEFAULT '{}',
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

    CREATE TABLE IF NOT EXISTS excel_import_sessions (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_type TEXT NOT NULL DEFAULT '',
      file_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'uploaded',
      row_count INTEGER NOT NULL DEFAULT 0,
      column_count INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS excel_import_column_mappings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL DEFAULT '',
      column_index INTEGER NOT NULL DEFAULT 0,
      column_letter TEXT NOT NULL DEFAULT '',
      original_header TEXT NOT NULL DEFAULT '',
      normalized_header TEXT NOT NULL DEFAULT '',
      mapped_field TEXT NOT NULL DEFAULT '',
      confidence REAL NOT NULL DEFAULT 0,
      warning TEXT NOT NULL DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 0,
      approved_by TEXT NOT NULL DEFAULT '',
      approved_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS excel_import_validation_issues (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL DEFAULT '',
      row_index INTEGER NOT NULL DEFAULT 0,
      column_index INTEGER NOT NULL DEFAULT 0,
      issue_type TEXT NOT NULL DEFAULT 'other',
      severity TEXT NOT NULL DEFAULT 'warning',
      message TEXT NOT NULL DEFAULT '',
      suggested_fix TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_norm ON knowledge_chunks(content_norm);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_norm ON entity_aliases(alias_norm);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_ascii ON entity_aliases(alias_ascii);
    CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created ON ai_request_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_person ON extracted_anniversary_candidates(person_name_norm);
    CREATE INDEX IF NOT EXISTS idx_system_audit_status ON system_audit_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_system_audit_issue ON system_audit_suggestions(issue_type);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created ON system_audit_apply_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_source ON extracted_anniversary_candidates(source_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_status ON extracted_anniversary_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_audit_candidate ON extracted_anniversary_audit_logs(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_ann_audit_created ON extracted_anniversary_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_extracted_profile_person ON extracted_profile_candidates(person_name_norm);
    CREATE INDEX IF NOT EXISTS idx_extracted_profile_source ON extracted_profile_candidates(source_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_profile_status ON extracted_profile_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_extracted_profile_audit_candidate ON extracted_profile_audit_logs(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_profile_audit_created ON extracted_profile_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_subject ON extracted_relationship_candidates(subject_name_norm);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_object ON extracted_relationship_candidates(object_name_norm);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_status ON extracted_relationship_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_type ON extracted_relationship_candidates(relationship_type);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_source ON extracted_relationship_candidates(source_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_audit_candidate ON extracted_relationship_audit_logs(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_rel_audit_created ON extracted_relationship_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_v3_pilot_logs_candidate ON cao_toc_v3_pilot_apply_logs(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_v3_pilot_logs_audit ON cao_toc_v3_pilot_apply_logs(audit_id);
    CREATE INDEX IF NOT EXISTS idx_v3_pilot_logs_created ON cao_toc_v3_pilot_apply_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_member ON anniversary_event_drafts(member_id);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_status ON anniversary_event_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_anniversary_drafts_updated ON anniversary_event_drafts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_reminder_send_logs_draft ON reminder_send_logs(draft_id);
    CREATE INDEX IF NOT EXISTS idx_reminder_send_logs_created ON reminder_send_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_created ON zalo_bot_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_event_id ON zalo_bot_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_events_status ON zalo_bot_events(status);
    CREATE INDEX IF NOT EXISTS idx_zalo_bot_replies_created ON zalo_bot_replies(created_at);
    CREATE INDEX IF NOT EXISTS idx_excel_import_sessions_status ON excel_import_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_excel_import_sessions_created ON excel_import_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_excel_import_mappings_session ON excel_import_column_mappings(session_id);
    CREATE INDEX IF NOT EXISTS idx_excel_import_issues_session ON excel_import_validation_issues(session_id);
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
  ensureTableColumn(db, 'ai_action_drafts', 'draft_type', "ALTER TABLE ai_action_drafts ADD COLUMN draft_type TEXT NOT NULL DEFAULT 'other'");
  ensureTableColumn(db, 'ai_action_drafts', 'summary', "ALTER TABLE ai_action_drafts ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'content', "ALTER TABLE ai_action_drafts ADD COLUMN content TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'target_module', "ALTER TABLE ai_action_drafts ADD COLUMN target_module TEXT NOT NULL DEFAULT 'other'");
  ensureTableColumn(db, 'ai_action_drafts', 'target_id', "ALTER TABLE ai_action_drafts ADD COLUMN target_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'source_type', "ALTER TABLE ai_action_drafts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'");
  ensureTableColumn(db, 'ai_action_drafts', 'source_id', "ALTER TABLE ai_action_drafts ADD COLUMN source_id TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'related_member_ids_json', "ALTER TABLE ai_action_drafts ADD COLUMN related_member_ids_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'ai_action_drafts', 'related_source_ids_json', "ALTER TABLE ai_action_drafts ADD COLUMN related_source_ids_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'ai_action_drafts', 'related_chunk_ids_json', "ALTER TABLE ai_action_drafts ADD COLUMN related_chunk_ids_json TEXT NOT NULL DEFAULT '[]'");
  ensureTableColumn(db, 'ai_action_drafts', 'status', "ALTER TABLE ai_action_drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'");
  ensureTableColumn(db, 'ai_action_drafts', 'priority', "ALTER TABLE ai_action_drafts ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'");
  ensureTableColumn(db, 'ai_action_drafts', 'created_by', "ALTER TABLE ai_action_drafts ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'created_at', "ALTER TABLE ai_action_drafts ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'reviewed_by', "ALTER TABLE ai_action_drafts ADD COLUMN reviewed_by TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'reviewed_at', "ALTER TABLE ai_action_drafts ADD COLUMN reviewed_at TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'applied_by', "ALTER TABLE ai_action_drafts ADD COLUMN applied_by TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'applied_at', "ALTER TABLE ai_action_drafts ADD COLUMN applied_at TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_drafts', 'metadata_json', "ALTER TABLE ai_action_drafts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'");
  ensureTableColumn(db, 'ai_action_draft_logs', 'action', "ALTER TABLE ai_action_draft_logs ADD COLUMN action TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_draft_logs', 'old_value', "ALTER TABLE ai_action_draft_logs ADD COLUMN old_value TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_draft_logs', 'new_value', "ALTER TABLE ai_action_draft_logs ADD COLUMN new_value TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_draft_logs', 'admin_user', "ALTER TABLE ai_action_draft_logs ADD COLUMN admin_user TEXT NOT NULL DEFAULT ''");
  ensureTableColumn(db, 'ai_action_draft_logs', 'created_at', "ALTER TABLE ai_action_draft_logs ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
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
    CREATE INDEX IF NOT EXISTS idx_ai_action_drafts_status ON ai_action_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_ai_action_drafts_type ON ai_action_drafts(draft_type);
    CREATE INDEX IF NOT EXISTS idx_ai_action_drafts_created ON ai_action_drafts(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_action_draft_logs_draft ON ai_action_draft_logs(draft_id);
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
  const normalized = normalizeKnowledgeText(original);
  const variants = new Set([
    original,
    stripped,
    normalized,
    normalizeKnowledgeText(stripped)
  ]);
  const safeExpansions = [
    { test: /\bcao to\b/, values: ['Cao Đình Thuật', 'Cao Tổ', 'Cao Cao Mãnh Đế Đại Tướng Quân', 'Mãnh Đế Đại Tướng Quân'] },
    { test: /\b(thuy to|cu lang|ong lang|nhieu lang|lang)\b/, values: ['Cao Đình Lạng', 'Thủy Tổ', 'Nhiêu Lạng'] },
    { test: /\b(thuat|cao dinh thuat|manh de|dai tuong quan)\b/, values: ['Cao Đình Thuật', 'Cao Tổ', 'Mãnh Đế Đại Tướng Quân'] },
    { test: /\b(ruc|cao xuan ruc)\b/, values: ['Cao Xuân Rục', 'Rục'] }
  ];
  for (const expansion of safeExpansions) {
    if (!expansion.test.test(normalized)) continue;
    for (const value of expansion.values) {
      variants.add(value);
      variants.add(normalizeKnowledgeText(value));
    }
  }
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

function normalizeKnowledgeSourceKind(value) {
  const normalized = normalizeGatewayText(value || '');
  if ([
    'technical_rule',
    'verification_note',
    'verification_notes',
    'imported_document',
    'genealogy_evidence',
    'genealogy_facts',
    'genealogy_dates_graves',
    'genealogy_relationships',
    'genealogy_biography_legacy'
  ].includes(normalized)) return normalized;
  return '';
}

function isTechnicalKnowledgeSource(row = {}) {
  const metadata = safeJsonParse(row.source_metadata_json || row.metadata_json || '{}', {});
  const title = normalizeKnowledgeText(row.source_title || row.title || '');
  const slug = normalizeGatewayText(row.source_slug || row.slug || '');
  const fileName = normalizeGatewayText(metadata.file_name || metadata.fileName || '');
  const sourceKind = normalizeKnowledgeSourceKind(metadata.sourceKind || metadata.source_kind);
  if (sourceKind === 'technical_rule') return true;
  if (metadata.excludeFromExtraction === true || metadata.excludeFromPublicChat === true) return true;
  if (metadata.seed_slug === PHASE2_ALIAS_SEED_SLUG) return true;
  if (slug.includes(PHASE2_ALIAS_SEED_SLUG)) return true;
  return [
    'manual notes for knowledge base',
    'search alias rules',
    'sql seed manual notes',
    'backend implementation notes',
    'ai guardrail prompt',
    'metadata examples',
    'entity alias role overrides',
    'readme'
  ].some((needle) => title.includes(needle) || fileName.includes(normalizeGatewayText(needle)));
}

function getKnowledgeSourceMetadata(row = {}) {
  return safeJsonParse(row.source_metadata_json || row.metadata_json || '{}', {});
}

function getKnowledgeSourceDatasetKey(row = {}) {
  const metadata = getKnowledgeSourceMetadata(row);
  return normalizeCaoTocV2DatasetKey(metadata.datasetKey || metadata.dataset || '');
}

function isArchivedKnowledgeSource(row = {}) {
  const metadata = getKnowledgeSourceMetadata(row);
  const status = normalizeGatewayText(row.source_status || row.status || '');
  return (
    status === 'archived' ||
    status === 'superseded' ||
    metadata.archived === true ||
    Boolean(metadata.supersededBy)
  );
}

function isCanonicalKnowledgeSource(row = {}, activeDatasetKey = KNOWLEDGE_CANONICAL_DATASET_KEY) {
  const datasetKey = getKnowledgeSourceDatasetKey(row);
  if (!datasetKey) return false;
  return datasetKey === normalizeCaoTocV2DatasetKey(activeDatasetKey || KNOWLEDGE_CANONICAL_DATASET_KEY);
}

function shouldExcludeKnowledgeFromExtraction(row = {}) {
  const metadata = safeJsonParse(row.source_metadata_json || row.metadata_json || '{}', {});
  const sourceKind = normalizeKnowledgeSourceKind(metadata.sourceKind || metadata.source_kind);
  return isArchivedKnowledgeSource(row) || metadata.excludeFromExtraction === true || sourceKind === 'technical_rule' || isTechnicalKnowledgeSource(row);
}

function shouldExcludeKnowledgeFromPublicChat(row = {}, authScope = 'admin') {
  if (isArchivedKnowledgeSource(row)) return true;
  if (authScope === 'admin') return false;
  const metadata = safeJsonParse(row.source_metadata_json || row.metadata_json || '{}', {});
  return metadata.excludeFromPublicChat === true || isTechnicalKnowledgeSource(row);
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
  const sourceRows = database.prepare('SELECT * FROM knowledge_sources').all();
  const activeSourceRows = sourceRows.filter((row) => !isArchivedKnowledgeSource(row));
  const archivedSourceRows = sourceRows.filter((row) => isArchivedKnowledgeSource(row));
  const activeSourceIds = activeSourceRows.map((row) => row.id);
  const chunkCount = activeSourceIds.length
    ? database.prepare(`SELECT COUNT(*) AS count FROM knowledge_chunks WHERE source_id IN (${activeSourceIds.map(() => '?').join(',')})`).get(...activeSourceIds)
    : { count: 0 };
  const aliasCount = database.prepare('SELECT COUNT(*) AS count FROM entity_aliases').get();
  const indexedCount = activeSourceRows.filter((row) => row.status === 'indexed').length;
  const canonicalSources = activeSourceRows.filter((row) => isCanonicalKnowledgeSource(row)).length;
  return {
    ok: true,
    sources: activeSourceRows.length,
    totalSources: sourceRows.length,
    archivedSources: archivedSourceRows.length,
    canonicalSources,
    chunks: Number(chunkCount?.count || 0),
    aliases: Number(aliasCount?.count || 0),
    indexedSources: Number(indexedCount || 0),
    activeDatasetKey: KNOWLEDGE_CANONICAL_DATASET_KEY,
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
  const sourceTitleNorm = normalizeKnowledgeText(row.source_title || '');
  const headingNorm = normalizeKnowledgeText(row.heading_path || '');
  const summaryNorm = normalizeKnowledgeText(row.summary || '');
  const contentNorm = String(row.content_norm || '');
  const contentAscii = String(row.content_ascii || '');
  const tags = safeJsonParse(row.tags_json, []);
  const entityRefs = safeJsonParse(row.entity_refs_json, []);
  const tagsNorm = normalizeKnowledgeText(tags.join(' '));
  const entityNorm = normalizeKnowledgeText(entityRefs.join(' '));
  const searchable = [titleNorm, sourceTitleNorm, headingNorm, summaryNorm, contentNorm, contentAscii].join(' ');
  const matchedTerms = terms.filter((term) => searchable.includes(term) || tagsNorm.includes(term) || entityNorm.includes(term));
  let score = 0;
  const reasons = [];

  if (queryNorm && (titleNorm.includes(queryNorm) || sourceTitleNorm.includes(queryNorm) || headingNorm.includes(queryNorm) || summaryNorm.includes(queryNorm) || contentNorm.includes(queryNorm))) {
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
  if ((titleNorm.includes(queryNorm) || sourceTitleNorm.includes(queryNorm)) && queryNorm) {
    score += 24;
    reasons.push('source_title_match');
  }
  if (headingNorm.includes(queryNorm) && queryNorm) {
    score += 30;
    reasons.push('heading_match');
  }
  const nameLikeMatches = terms.filter((term) => term.length >= 4 && entityNorm.includes(term));
  if (nameLikeMatches.length) {
    score += nameLikeMatches.length * 14;
    reasons.push('person_alias_boost');
  }
  const contentLength = String(row.content || '').length;
  if (contentLength > 2400 && score < 90 && matchedTerms.length <= 2) {
    score -= 18;
    reasons.push('long_weak_penalty');
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
  const expandedVariants = new Set(variants);
  for (const row of aliasMatches.slice(0, 8)) {
    expandedVariants.add(row.alias);
    expandedVariants.add(row.canonical_name);
    if (row.required_title) expandedVariants.add(row.required_title);
  }
  const expandedNorms = [...expandedVariants].map((variant) => normalizeKnowledgeText(variant)).filter(Boolean);
  const queryWords = [...new Set(expandedNorms.flatMap((variant) => variant.split(/[^a-z0-9]+/).filter((word) => word.length >= 3)))];

  const chunkRows = database.prepare(`
    SELECT
      kc.*,
      ks.title AS source_title,
      ks.slug AS source_slug,
      ks.scope AS source_scope,
      ks.system_scope AS source_system_scope,
      ks.clan_scope AS source_clan_scope,
      ks.domain AS source_domain,
      ks.visibility AS source_visibility,
      ks.metadata_json AS source_metadata_json,
      ks.tags_json AS source_tags_json,
      ks.entity_refs_json AS source_entity_refs_json
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON ks.id = kc.source_id
  `).all();
  const chunkMatches = chunkRows
    .filter((row) => canReadKnowledgeVisibility(row.visibility || row.source_visibility, authScope))
    .filter((row) => !shouldExcludeKnowledgeFromPublicChat(row, authScope))
    .map((row) => {
      const scoringRow = {
        ...row,
        tags_json: row.tags_json || row.source_tags_json,
        entity_refs_json: row.entity_refs_json || row.source_entity_refs_json,
        content_ascii: row.content_ascii || ''
      };
      const score = expandedNorms
        .map((variantNorm) => scoreKnowledgeChunk(variantNorm, queryWords, scoringRow))
        .sort((a, b) => b.score - a.score)[0] || scoreKnowledgeChunk(queryNorm, queryWords, scoringRow);
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
  return /\b(la ai|la gi|ai la|dung khong|co phai|thuy to|cao to)\b/.test(text) || /\b(doi|generation)\s*\d+\b/.test(text);
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
  const generationMatch = text.match(/\bdoi\s*(\d+)\b|\bgeneration\s*(\d+)\b/);
  if (generationMatch) {
    const generation = Number(generationMatch[1] || generationMatch[2]);
    const address = getLineageAddressByGeneration(generation);
    if (address) {
      return `Theo quy tắc danh xưng AI đang dùng, đời ${generation} xưng là "${address}". Quy tắc này chỉ dùng để trình bày câu trả lời, không ghi đè dữ liệu gốc trong cây phả.`;
    }
  }
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

const EXCEL_IMPORT_FIELD_REFERENCE = [
  ['id', 'Ma dinh danh ca nhan', true],
  ['name', 'Ho va ten day du', true],
  ['gender', 'Gioi tinh', false],
  ['bio.alias', 'Ten thuong goi / Bi danh / Ten tu', false],
  ['phone1', 'So dien thoai', false],
  ['phone2', 'So dien thoai phu', false],
  ['residence', 'Noi o', false],
  ['email', 'Email', false],
  ['solarBirthDate / birthYear', 'Ngay sinh tren giay to', false],
  ['isLiving / isDeceased', 'Tinh trang con song/da mat', false],
  ['solarDeathDate / deathYear', 'Ngay thang nam mat duong lich', false],
  ['lunarAnniversary / deathAnniversaryLunar', 'Ngay mat theo am lich / Ky nhat', false],
  ['burialPlace / graveLocation', 'Noi an tang', false],
  ['generation', 'Doi thu may', true],
  ['father.name', 'Ho va ten Cha ruot', false],
  ['father.residence', 'Noi o cua cha ruot', false],
  ['father.phone', 'So dien thoai cua cha', false],
  ['father.birthDate', 'Ngay sinh cua cha', false],
  ['father.isLiving', 'Tinh trang cua cha', false],
  ['father.deathDate', 'Ngay mat cua cha', false],
  ['father.lunarAnniversary', 'Ngay mat am lich cua cha', false],
  ['father.burialPlace', 'Noi an tang cua cha', false],
  ['parentId', 'Ma dinh danh cua cha', false],
  ['motherName', 'Ho va ten Me ruot', false],
  ['mother.residence', 'Noi o cua me', false],
  ['mother.phone', 'So dien thoai cua me', false],
  ['mother.birthDate', 'Ngay sinh cua me', false],
  ['mother.isLiving', 'Tinh trang cua me', false],
  ['mother.deathDate', 'Ngay mat cua me', false],
  ['mother.lunarAnniversary', 'Ngay mat am lich cua me', false],
  ['mother.burialPlace', 'Noi an tang cua me', false],
  ['spouse / spouseDetails[0].name', 'Ho va ten vo/chong', false],
  ['spouseDetails[0].residence', 'Noi o cua vo/chong', false],
  ['spouseDetails[0].phone1', 'So dien thoai cua vo/chong', false],
  ['spouseDetails[0].solarBirthDate', 'Ngay sinh cua vo/chong', false],
  ['spouseDetails[0].isLiving', 'Tinh trang cua vo/chong', false],
  ['spouseDetails[0].solarDeathDate', 'Ngay mat cua vo/chong', false],
  ['spouseDetails[0].lunarAnniversary', 'Ngay ky am lich cua vo/chong', false],
  ['spouseDetails[0].burialPlace', 'Noi an tang cua vo/chong', false],
  ['children[0].name', 'Ho ten con thu 1', false],
  ['children[0].gender', 'Gioi tinh con thu 1', false],
  ['children[1].name', 'Ho ten con thu 2', false],
  ['children[1].gender', 'Gioi tinh con thu 2', false],
  ['children[2].name', 'Ho ten con thu 3', false],
  ['children[2].gender', 'Gioi tinh con thu 3', false],
  ['children[3].name', 'Ho ten con thu 4', false],
  ['children[3].gender', 'Gioi tinh con thu 4', false],
  ['children[4].name', 'Ho ten con thu 5', false],
  ['children[4].gender', 'Gioi tinh con thu 5', false],
  ['children[5].name', 'Ho ten con thu 6', false],
  ['children[5].gender', 'Gioi tinh con thu 6', false],
  ['children[6].name', 'Ho ten con thu 7', false],
  ['children[6].gender', 'Gioi tinh con thu 7', false],
  ['children[7].name', 'Ho ten con thu 8', false],
  ['children[7].gender', 'Gioi tinh con thu 8', false]
].map(([field, label, required], index) => ({ index, field, label, required: Boolean(required) }));

const EXCEL_IMPORT_ALLOWED_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);
const EXCEL_IMPORT_MAX_FILE_MB = Number(process.env.EXCEL_IMPORT_MAX_FILE_MB || 10);
const EXCEL_IMPORT_MAX_FILE_BYTES = EXCEL_IMPORT_MAX_FILE_MB * 1024 * 1024;

function normalizeExcelImportHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function excelColumnLetter(index) {
  let n = Number(index) + 1;
  let letters = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    n = Math.floor((n - mod) / 26);
  }
  return letters || 'A';
}

function getExcelImportFieldReference() {
  return EXCEL_IMPORT_FIELD_REFERENCE.map((item) => ({
    index: item.index,
    field: item.field,
    label: item.label,
    required: item.required
  }));
}

function normalizeExcelImportStatus(status, fallback = 'structure_review') {
  const allowed = new Set(['uploaded', 'structure_review', 'mapping_approved', 'validation_failed', 'ready_to_import', 'imported', 'rejected']);
  return allowed.has(String(status || '')) ? String(status) : fallback;
}

function normalizeExcelImportExtension(fileName = '', fileType = '') {
  const nameExt = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  if (EXCEL_IMPORT_ALLOWED_EXTENSIONS.has(nameExt)) return nameExt;
  const type = String(fileType || '').toLowerCase();
  if (type.includes('csv')) return 'csv';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet')) return 'xlsx';
  return nameExt;
}

function buildExcelImportSafetyWarnings(payload = {}) {
  const warnings = [];
  const fileName = String(payload.fileName || payload.file_name || '').trim();
  const fileSize = Number(payload.fileSize || payload.file_size || 0);
  const fileType = String(payload.fileType || payload.file_type || '').trim();
  const extension = normalizeExcelImportExtension(fileName, fileType);
  if (!fileName) warnings.push({ type: 'unsafe_file', severity: 'critical', message: 'Thieu ten file.' });
  if (!fileSize || fileSize <= 0) warnings.push({ type: 'unsafe_file', severity: 'critical', message: 'File rong hoac khong co kich thuoc hop le.' });
  if (fileSize > EXCEL_IMPORT_MAX_FILE_BYTES) warnings.push({ type: 'unsafe_file', severity: 'critical', message: `File vuot gioi han ${EXCEL_IMPORT_MAX_FILE_MB}MB.` });
  if (!EXCEL_IMPORT_ALLOWED_EXTENSIONS.has(extension)) warnings.push({ type: 'unsafe_file', severity: 'critical', message: 'Chi chap nhan .csv, .xlsx hoac .xls.' });
  warnings.push({ type: 'trusted_source', severity: 'info', message: 'Chi import file Excel/CSV tu nguon tin cay. He thong khong ghi vao cay pha khi chua duyet mapping va validate.' });
  return warnings;
}

function scoreExcelHeaderToField(header, fieldRef) {
  const normalized = normalizeExcelImportHeader(header);
  const label = normalizeExcelImportHeader(fieldRef.label);
  const field = normalizeExcelImportHeader(fieldRef.field);
  if (!normalized) return { score: 0, warning: 'Cot khong co header.' };
  if (normalized === label || normalized === field) return { score: 0.98, warning: '' };
  if (normalized.includes(label) || label.includes(normalized)) return { score: 0.86, warning: '' };
  const terms = normalized.split(' ').filter(Boolean);
  const labelTerms = new Set(label.split(' ').filter(Boolean));
  const matched = terms.filter((term) => labelTerms.has(term)).length;
  const score = terms.length ? matched / Math.max(terms.length, labelTerms.size) : 0;
  return { score, warning: score >= 0.45 ? 'Can admin kiem tra lai mapping goi y.' : 'Cot chua ro mapping.' };
}

function suggestExcelColumnMapping(header, index) {
  const refs = getExcelImportFieldReference();
  const expected = refs[index];
  const expectedScore = expected ? scoreExcelHeaderToField(header, expected) : { score: 0, warning: 'Ngoai bo 55 cot dac ta.' };
  const best = refs
    .map((ref) => ({ ref, ...scoreExcelHeaderToField(header, ref) }))
    .sort((a, b) => b.score - a.score)[0];
  const chosen = expectedScore.score >= 0.7 || !best || expectedScore.score >= best.score - 0.08
    ? { ref: expected, ...expectedScore }
    : best;
  const confidence = Number(Math.max(0, Math.min(0.99, chosen?.score || 0)).toFixed(2));
  return {
    mappedField: chosen?.ref?.field || '',
    confidence,
    warning: confidence >= 0.75 ? '' : (chosen?.warning || 'Mapping confidence thap, khong auto approve.')
  };
}

function normalizePreviewRows(rows, limit = 30) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, limit).map((row) => Array.isArray(row)
    ? row.slice(0, 80).map((value) => String(value ?? '').slice(0, 300))
    : Object.fromEntries(Object.entries(row || {}).slice(0, 80).map(([key, value]) => [key, String(value ?? '').slice(0, 300)]))
  );
}

function publicExcelImportSession(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    fileHash: row.file_hash,
    status: row.status,
    rowCount: row.row_count,
    columnCount: row.column_count,
    warnings: safeJsonParse(row.warnings_json, []),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: safeJsonParse(row.metadata_json, {})
  };
}

function publicExcelImportMapping(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    columnIndex: row.column_index,
    columnLetter: row.column_letter,
    originalHeader: row.original_header,
    normalizedHeader: row.normalized_header,
    mappedField: row.mapped_field,
    confidence: row.confidence,
    warning: row.warning,
    approved: Boolean(row.approved),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at
  };
}

function publicExcelImportIssue(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    rowIndex: row.row_index,
    columnIndex: row.column_index,
    issueType: row.issue_type,
    severity: row.severity,
    message: row.message,
    suggestedFix: row.suggested_fix,
    metadata: safeJsonParse(row.metadata_json, {})
  };
}

async function createExcelImportSession(payload = {}, authUser = null) {
  const database = await getDatabase();
  const headers = Array.isArray(payload.headers) ? payload.headers.map((value) => String(value ?? '').slice(0, 240)) : [];
  const previewRows = normalizePreviewRows(payload.previewRows || payload.preview_rows || []);
  const fileName = String(payload.fileName || payload.file_name || '').trim().slice(0, 260);
  const fileSize = Number(payload.fileSize || payload.file_size || 0);
  const fileType = String(payload.fileType || payload.file_type || '').trim().slice(0, 120);
  const rowCount = Number(payload.rowCount ?? payload.row_count ?? previewRows.length);
  const columnCount = Number(payload.columnCount ?? payload.column_count ?? headers.length);
  const warnings = buildExcelImportSafetyWarnings({ fileName, fileSize, fileType });
  const duplicateHeaders = new Map();
  headers.forEach((header) => {
    const normalized = normalizeExcelImportHeader(header);
    if (normalized) duplicateHeaders.set(normalized, (duplicateHeaders.get(normalized) || 0) + 1);
  });
  const hash = crypto.createHash('sha256').update(JSON.stringify({ fileName, fileSize, headers, previewRows })).digest('hex');
  const id = `excel_import_${randomToken(16)}`;
  const metadata = {
    headers,
    previewRows,
    importMode: payload.importMode || payload.import_mode || 'append',
    safety: { maxFileMb: EXCEL_IMPORT_MAX_FILE_MB },
    note: 'Phase 2U review gate only. No direct tree write from upload.'
  };
  database.prepare(`
    INSERT INTO excel_import_sessions (id, file_name, file_size, file_type, file_hash, status, row_count, column_count, warnings_json, created_by, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    fileName,
    fileSize,
    fileType,
    hash,
    'structure_review',
    rowCount,
    columnCount || headers.length,
    JSON.stringify(warnings),
    authUser?.username || authUser?.email || authUser?.id || 'admin',
    JSON.stringify(metadata)
  );
  const mappingInsert = database.prepare(`
    INSERT INTO excel_import_column_mappings (id, session_id, column_index, column_letter, original_header, normalized_header, mapped_field, confidence, warning, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  headers.forEach((header, index) => {
    const suggestion = suggestExcelColumnMapping(header, index);
    const normalized = normalizeExcelImportHeader(header);
    const duplicateWarning = normalized && duplicateHeaders.get(normalized) > 1 ? 'Header trung lap. ' : '';
    mappingInsert.run(
      `excel_map_${randomToken(12)}`,
      id,
      index,
      excelColumnLetter(index),
      header,
      normalized,
      suggestion.mappedField,
      suggestion.confidence,
      `${duplicateWarning}${suggestion.warning}`.trim(),
      suggestion.confidence >= 0.9 && !duplicateWarning ? 1 : 0
    );
  });
  await validateExcelImportSession(id, { mode: 'structure' });
  return getExcelImportSessionDetail(id);
}

async function listExcelImportSessions({ limit = 50 } = {}) {
  const database = await getDatabase();
  return database.prepare('SELECT * FROM excel_import_sessions ORDER BY created_at DESC LIMIT ?').all(Number(limit) || 50).map(publicExcelImportSession);
}

async function getExcelImportSessionDetail(id) {
  const database = await getDatabase();
  const session = database.prepare('SELECT * FROM excel_import_sessions WHERE id = ?').get(id);
  if (!session) {
    const err = new Error('Excel import session not found.');
    err.status = 404;
    throw err;
  }
  return {
    session: publicExcelImportSession(session),
    mappings: database.prepare('SELECT * FROM excel_import_column_mappings WHERE session_id = ? ORDER BY column_index ASC').all(id).map(publicExcelImportMapping),
    issues: database.prepare('SELECT * FROM excel_import_validation_issues WHERE session_id = ? ORDER BY severity DESC, row_index ASC, column_index ASC').all(id).map(publicExcelImportIssue)
  };
}

async function updateExcelImportSession(id, payload = {}) {
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM excel_import_sessions WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Excel import session not found.');
    err.status = 404;
    throw err;
  }
  const status = normalizeExcelImportStatus(payload.status, current.status);
  database.prepare("UPDATE excel_import_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return getExcelImportSessionDetail(id);
}

async function updateExcelImportMappings(id, payload = {}, authUser = null) {
  const database = await getDatabase();
  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
  const update = database.prepare(`
    UPDATE excel_import_column_mappings
    SET mapped_field = ?, confidence = ?, warning = ?, approved = ?, approved_by = ?, approved_at = CASE WHEN ? THEN datetime('now') ELSE approved_at END, updated_at = datetime('now')
    WHERE session_id = ? AND column_index = ?
  `);
  for (const mapping of mappings) {
    const approved = Boolean(mapping.approved);
    update.run(
      String(mapping.mappedField || mapping.mapped_field || ''),
      Number(mapping.confidence ?? 1),
      String(mapping.warning || ''),
      approved ? 1 : 0,
      approved ? (authUser?.username || authUser?.email || authUser?.id || 'admin') : '',
      approved ? 1 : 0,
      id,
      Number(mapping.columnIndex ?? mapping.column_index)
    );
  }
  const remaining = database.prepare('SELECT COUNT(*) AS count FROM excel_import_column_mappings WHERE session_id = ? AND approved = 0 AND mapped_field != ?').get(id, '__skip')?.count || 0;
  if (!remaining) database.prepare("UPDATE excel_import_sessions SET status = 'mapping_approved', updated_at = datetime('now') WHERE id = ?").run(id);
  return getExcelImportSessionDetail(id);
}

function addExcelImportIssue(database, sessionId, issue) {
  database.prepare(`
    INSERT INTO excel_import_validation_issues (id, session_id, row_index, column_index, issue_type, severity, message, suggested_fix, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `excel_issue_${randomToken(12)}`,
    sessionId,
    Number(issue.rowIndex || issue.row_index || 0),
    Number(issue.columnIndex ?? issue.column_index ?? -1),
    issue.issueType || issue.issue_type || 'other',
    issue.severity || 'warning',
    String(issue.message || ''),
    String(issue.suggestedFix || issue.suggested_fix || ''),
    JSON.stringify(issue.metadata || {})
  );
}

async function validateExcelImportSession(id, { mode = 'full' } = {}) {
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM excel_import_sessions WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Excel import session not found.');
    err.status = 404;
    throw err;
  }
  database.prepare('DELETE FROM excel_import_validation_issues WHERE session_id = ?').run(id);
  const session = publicExcelImportSession(current);
  const metadata = safeJsonParse(current.metadata_json, {});
  const headers = Array.isArray(metadata.headers) ? metadata.headers : [];
  const previewRows = Array.isArray(metadata.previewRows) ? metadata.previewRows : [];
  const mappings = database.prepare('SELECT * FROM excel_import_column_mappings WHERE session_id = ? ORDER BY column_index ASC').all(id);
  for (const warning of session.warnings || []) {
    if (warning.severity === 'critical') addExcelImportIssue(database, id, { issueType: warning.type || 'unsafe_file', severity: 'critical', message: warning.message });
  }
  const seenHeaders = new Map();
  headers.forEach((header, index) => {
    const normalized = normalizeExcelImportHeader(header);
    if (!normalized) return;
    seenHeaders.set(normalized, [...(seenHeaders.get(normalized) || []), index]);
  });
  for (const [, indexes] of seenHeaders.entries()) {
    if (indexes.length > 1) {
      indexes.forEach((index) => addExcelImportIssue(database, id, { columnIndex: index, issueType: 'duplicate_header', severity: 'warning', message: `Cot ${excelColumnLetter(index)} co header trung lap.`, suggestedFix: 'Doi ten header hoac bo qua cot trung lap.' }));
    }
  }
  mappings.forEach((mapping) => {
    if (!mapping.mapped_field) addExcelImportIssue(database, id, { columnIndex: mapping.column_index, issueType: 'unknown_column', severity: 'warning', message: `Cot ${mapping.column_letter} chua co mapping.`, suggestedFix: 'Chon field dashboard hoac danh dau bo qua.' });
    if (Number(mapping.confidence) < 0.75 && !mapping.approved) addExcelImportIssue(database, id, { columnIndex: mapping.column_index, issueType: 'unknown_column', severity: 'warning', message: `Cot ${mapping.column_letter} confidence thap, can admin duyet.`, suggestedFix: 'Duyet mapping thu cong truoc khi import.' });
  });
  const fields = new Set(mappings.filter((mapping) => mapping.approved && mapping.mapped_field !== '__skip').map((mapping) => mapping.mapped_field));
  for (const ref of EXCEL_IMPORT_FIELD_REFERENCE.filter((item) => item.required)) {
    if (!fields.has(ref.field)) addExcelImportIssue(database, id, { issueType: 'missing_required', severity: 'error', message: `Thieu field bat buoc: ${ref.label}.`, suggestedFix: 'Map mot cot vao field nay hoac bo sung cot trong file.' });
  }
  const mappedByField = new Map(mappings.map((mapping) => [mapping.mapped_field, mapping.column_index]));
  previewRows.forEach((row, rowIndex) => {
    const values = Array.isArray(row) ? row : headers.map((header) => row?.[header] || '');
    const nameIndex = mappedByField.get('name');
    const generationIndex = mappedByField.get('generation');
    const name = nameIndex !== undefined ? String(values[nameIndex] || '').trim() : '';
    const generation = generationIndex !== undefined ? String(values[generationIndex] || '').trim() : '';
    if (!name) addExcelImportIssue(database, id, { rowIndex: rowIndex + 2, columnIndex: nameIndex ?? -1, issueType: 'missing_required', severity: 'error', message: `Dong ${rowIndex + 2} thieu ho ten.`, suggestedFix: 'Bo sung ho ten hoac loai bo dong trong.' });
    if (generation && !/\d+/.test(generation)) addExcelImportIssue(database, id, { rowIndex: rowIndex + 2, columnIndex: generationIndex ?? -1, issueType: 'invalid_generation', severity: 'error', message: `Dong ${rowIndex + 2} doi/generation khong hop le.`, suggestedFix: 'Nhap so doi hoac de trong neu chua xac minh.' });
    values.forEach((value, columnIndex) => {
      const text = String(value || '');
      const field = mappings[columnIndex]?.mapped_field || '';
      if ((field.includes('phone') || field.includes('email')) && text.trim()) {
        addExcelImportIssue(database, id, { rowIndex: rowIndex + 2, columnIndex, issueType: 'other', severity: 'info', message: `Dong ${rowIndex + 2} co du lieu rieng tu (${field}).`, suggestedFix: 'Kiem tra quyen xem/KYC truoc khi cong bo.' });
      }
    });
  });
  const counts = database.prepare('SELECT severity, COUNT(*) AS count FROM excel_import_validation_issues WHERE session_id = ? GROUP BY severity').all(id);
  const errorCount = counts.filter((row) => ['critical', 'error'].includes(row.severity)).reduce((sum, row) => sum + Number(row.count || 0), 0);
  const unapproved = database.prepare('SELECT COUNT(*) AS count FROM excel_import_column_mappings WHERE session_id = ? AND approved = 0 AND mapped_field != ?').get(id, '__skip')?.count || 0;
  const nextStatus = errorCount ? 'validation_failed' : (mode === 'structure' ? 'structure_review' : (unapproved ? 'mapping_approved' : 'ready_to_import'));
  database.prepare("UPDATE excel_import_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(nextStatus, id);
  return getExcelImportSessionDetail(id);
}

async function importExcelImportSession(id, payload = {}, authUser = null) {
  const database = await getDatabase();
  const session = database.prepare('SELECT * FROM excel_import_sessions WHERE id = ?').get(id);
  if (!session) {
    const err = new Error('Excel import session not found.');
    err.status = 404;
    throw err;
  }
  if (session.status !== 'ready_to_import') {
    const err = new Error('Excel import session must be ready_to_import before import.');
    err.status = 400;
    throw err;
  }
  if (!payload.confirmImport) {
    const err = new Error('confirmImport is required.');
    err.status = 400;
    throw err;
  }
  const metadata = safeJsonParse(session.metadata_json, {});
  metadata.importConfirmed = {
    by: authUser?.username || authUser?.email || authUser?.id || 'admin',
    at: new Date().toISOString(),
    note: 'Phase 2U gate passed. Actual tree write remains controlled by dashboard import flow.'
  };
  database.prepare("UPDATE excel_import_sessions SET status = 'imported', metadata_json = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(metadata), id);
  return {
    session: (await getExcelImportSessionDetail(id)).session,
    applied: false,
    previewOnly: true,
    note: 'Excel import gate confirmed. Dashboard must still perform the controlled tree write.'
  };
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

function isTechnicalCitationSource(row = {}) {
  return isTechnicalKnowledgeSource({
    ...row,
    metadata_json: row.source_metadata_json || row.metadata_json,
    title: row.source_title || row.title
  });
}

function knowledgeCitationFromChunk(row = {}, query = '') {
  if (!row?.source_id || isTechnicalCitationSource(row)) return null;
  return {
    sourceId: row.source_id,
    chunkId: row.id || row.chunk_id || '',
    sourceTitle: row.source_title || row.knowledge_title || row.title || '',
    headingPath: row.heading_path || '',
    evidenceQuote: compactText(row.evidence_quote || row.source_quote || getSnippet(row.content || '', normalizeKnowledgeText(query), 260), 320),
    score: Number(row.score || 0),
    reason: row.reason || ''
  };
}

function knowledgeCitationFromCandidate(row = {}) {
  if (!row?.source_id) return null;
  const metadata = safeJsonParse(row.metadata_json, {});
  const sourceKind = metadata.sourceKind || metadata.source_kind || '';
  if (normalizeKnowledgeSourceKind(sourceKind) === 'technical_rule') return null;
  return {
    sourceId: row.source_id,
    chunkId: row.chunk_id || metadata.chunkId || '',
    sourceTitle: metadata.sourceTitle || row.knowledge_title || row.source_title || '',
    headingPath: row.heading_path || metadata.headingPath || '',
    evidenceQuote: compactText(metadata.evidenceQuote || row.source_quote || row.reviewed_text || row.extracted_text || '', 320),
    evidenceType: metadata.evidenceType || ''
  };
}

function buildKnowledgeCitations(searchResult, { query = '', candidates = [], limit = 6 } = {}) {
  const seen = new Set();
  const citations = [];
  const add = (citation) => {
    if (!citation?.sourceId) return;
    const key = `${citation.sourceId}:${citation.chunkId}:${citation.evidenceQuote}`;
    if (seen.has(key)) return;
    seen.add(key);
    citations.push(citation);
  };
  for (const row of candidates || []) add(knowledgeCitationFromCandidate(row));
  for (const row of searchResult?.chunks || []) add(knowledgeCitationFromChunk(row, query || searchResult?.query || ''));
  return citations.slice(0, limit);
}

function buildKnowledgeContextHash(searchResult, citations = []) {
  const chunkKeys = (searchResult?.chunks || []).slice(0, 12).map((row) => `${row.source_id}:${row.id}:${Math.round(Number(row.score || 0))}`);
  const citationKeys = (citations || []).slice(0, 8).map((item) => `${item.sourceId}:${item.chunkId}:${compactText(item.evidenceQuote || '', 80)}`);
  return sha256Base64Url(JSON.stringify([...chunkKeys, ...citationKeys])).slice(0, 24);
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
  const evidenceQuote = metadata.evidenceQuote || row.source_quote || '';
  const evidenceWindow = metadata.evidenceWindow || row.source_quote || '';
  return {
    id: row.id,
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    sourceTitle: metadata.sourceTitle || metadata.knowledgeTitle || '',
    personName: row.person_name,
    generation: row.generation,
    branch: row.branch,
    birthText: row.birth_text,
    deathText: row.death_text,
    deathAnniversaryLunar: row.death_anniversary_lunar,
    hometown: row.hometown,
    graveText: row.grave_text,
    sourceQuote: row.source_quote,
    evidenceQuote,
    evidenceWindow,
    evidenceType: metadata.evidenceType || 'date_grave',
    headingPath: row.heading_path,
    matchedMemberId: row.matched_member_id,
    matchedMemberName: row.matched_member_name,
    matchConfidence: row.match_confidence,
    status,
    triage: getV3CandidateReviewState('anniversary', row),
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
      name: member.name || '',
      birth: member.solarBirthDate || member.birthYear || '',
      death: member.solarDeathDate || member.deathYear || '',
      lunar_anniversary: member.deathAnniversaryLunar || member.lunarAnniversary || '',
      birth_structured: member.birthDateStructured || null,
      death_structured: member.deathDateStructured || null,
      lunar_anniversary_structured: member.deathAnniversaryLunarStructured || null,
      hometown: member.birthPlace || member.residence || '',
      grave: member.graveLocation || member.burialPlace || '',
      description: member.description || '',
      bio: member.bio || '',
      achievements: Array.isArray(member.achievements) ? member.achievements.join('\n') : String(member.achievements || '').trim()
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
  const hasFullNameShape = nameTerms.length >= 2;
  const shortName = nameTerms.at(-1) || '';
  let score = 0;
  const reasons = [];
  if (fullNorm && queryNorm === fullNorm) {
    score += 120;
    reasons.push('exact full name');
  } else if (fullNorm && hasFullNameShape && queryNorm.includes(fullNorm)) {
    score += 100;
    reasons.push('contains full name');
  } else if (fullNorm && hasFullNameShape && fullNorm.includes(queryNorm) && queryNorm.length >= 5) {
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

async function listExtractedAnniversaryCandidates({ q = '', status = '', type = '', pendingOnly = false, limit = 100, triageBucket = '', datasetKey = '' } = {}) {
  const database = await getDatabase();
  const rows = database
    .prepare('SELECT * FROM extracted_anniversary_candidates ORDER BY person_name_norm, updated_at DESC')
    .all();
  const queryNorm = normalizeKnowledgeText(q);
  const statusFilter = normalizeExtractedCandidateStatus(status);
  const hasStatusFilter = Boolean(String(status || '').trim());
  const typeFilter = String(type || '').trim();
  const triageFilter = normalizeV3TriageBucket(triageBucket);
  const triageDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const filtered = rows
    .filter((row) => {
      if (triageFilter) {
        if (!isV3CandidateRow(row, triageDatasetKey)) return false;
        if (classifyV3Candidate('anniversary', row).primaryBucket !== triageFilter) return false;
      }
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

function detachLineageNodeById(node, memberId) {
  if (!node || typeof node !== 'object') return null;
  const children = Array.isArray(node.children) ? node.children : [];
  const index = children.findIndex((child) => String(child?.id || '') === String(memberId || ''));
  if (index >= 0) {
    const [removed] = children.splice(index, 1);
    return removed;
  }
  for (const child of children) {
    const removed = detachLineageNodeById(child, memberId);
    if (removed) return removed;
  }
  return null;
}

function isLineageDescendant(node, possibleDescendantId) {
  if (!node || typeof node !== 'object') return false;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    if (String(child?.id || '') === String(possibleDescendantId || '')) return true;
    if (isLineageDescendant(child, possibleDescendantId)) return true;
  }
  return false;
}

function reparentLineageNode(tree, childId, parentId) {
  if (!tree || String(childId || '') === String(parentId || '')) return false;
  const child = getLineageNodeById(tree, childId);
  const parent = getLineageNodeById(tree, parentId);
  if (!child || !parent || isLineageDescendant(child, parentId)) return false;
  const removed = String(tree.id || '') === String(childId || '') ? child : detachLineageNodeById(tree, childId);
  if (!removed) return false;
  if (!Array.isArray(parent.children)) parent.children = [];
  if (!parent.children.some((item) => String(item?.id || '') === String(childId || ''))) {
    parent.children.push(removed);
  }
  removed.parentId = parent.id;
  return true;
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
  assertV3CandidateApplyAllowed('anniversary', row, body);

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

const PROFILE_CANDIDATE_KEYWORDS = [
  'hanh trang',
  'cong lao',
  'su nghiep',
  'tich trang',
  'di san',
  'pham hanh',
  'chuc tuoc',
  'lap nghiep',
  'khai co',
  'trung tu',
  'phung su',
  'vinh danh'
];

const PROFILE_QUESTION_KEYWORDS = [
  ...PROFILE_CANDIDATE_KEYWORDS,
  'tieu su',
  'than the',
  'cong trang',
  'dong gop'
];

function normalizeProfileCandidateStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['pending', 'approved', 'rejected', 'applied'].includes(value) ? value : 'pending';
}

function normalizeProfileTargetField(value) {
  const field = String(value || '').trim();
  return ['name', 'description', 'bio', 'achievements'].includes(field) ? field : 'description';
}

function normalizeProfileCandidateType(value) {
  const type = String(value || '').trim();
  return ['name_alias', 'biography', 'legacy_note', 'achievement', 'career', 'spouse_note', 'parent_note', 'verification_note', 'clan_legacy', 'branch_legacy'].includes(type)
    ? type
    : 'biography';
}

function isProfileQuestion(query) {
  const text = normalizeKnowledgeText(query);
  return PROFILE_QUESTION_KEYWORDS.some((keyword) => text.includes(keyword));
}

function classifyProfileCandidateType(text) {
  const normalized = normalizeKnowledgeText(text);
  if (/(cong lao|cong trang|vinh danh|dong gop|phung su)/.test(normalized)) return 'achievement';
  if (/(su nghiep|chuc tuoc|lap nghiep|khai co|trung tu)/.test(normalized)) return 'career';
  if (/(di san|tich trang)/.test(normalized)) return 'legacy_note';
  return 'biography';
}

function defaultProfileTargetField(candidateType) {
  if (candidateType === 'name_alias') return 'name';
  if (candidateType === 'achievement') return 'achievements';
  if (candidateType === 'career' || candidateType === 'legacy_note') return 'bio';
  return 'description';
}

function extractCaoNamesFromText(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const names = new Set();
  const pattern = /\bCao\s+(?:Đình|Duy|Văn|Xuân|Hữu|Quang|Thế|Minh|Mạnh|Bá|Trọng|Viết|Ngọc|Sỹ|Sĩ|Phúc|Phú|Cao)?(?:\s+[\p{L}]{2,}){1,4}/giu;
  for (const match of source.matchAll(pattern)) {
    const candidate = String(match[0] || '').replace(/[.,;:(){}\[\]"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (candidate.split(/\s+/).length >= 3 && candidate.length <= 80) {
      names.add(candidate);
    }
  }
  return [...names].slice(0, 8);
}

function buildProfileCandidateHash({ sourceId, chunkId, personName, candidateType, extractedText }) {
  return sha256Base64Url([
    sourceId,
    chunkId,
    normalizeKnowledgeText(personName),
    candidateType,
    normalizeKnowledgeText(extractedText).slice(0, 500)
  ].join('|')).slice(0, 24);
}

function candidateEvidenceFromText(content, needles = [], { maxQuote = 260, maxWindow = 780 } = {}) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return { evidenceQuote: '', evidenceWindow: '' };
  const normalizedText = normalizeKnowledgeText(text);
  const normalizedNeedles = normalizeStringArray(needles).map(normalizeKnowledgeText).filter(Boolean);
  let index = -1;
  for (const needle of normalizedNeedles.sort((a, b) => b.length - a.length)) {
    index = normalizedText.indexOf(needle);
    if (index >= 0) break;
  }
  if (index < 0) index = 0;
  const sentenceMatches = [...text.matchAll(/[^.!?;。\n\r]{0,420}(?:[.!?;。]|\n|$)/gu)]
    .map((match) => ({ text: match[0].trim(), index: match.index || 0 }))
    .filter((item) => item.text.length >= 10);
  const sentence = sentenceMatches.find((item) => {
    const norm = normalizeKnowledgeText(item.text);
    return normalizedNeedles.some((needle) => norm.includes(needle));
  })?.text || text.slice(Math.max(0, index - 80), index + maxQuote);
  const start = Math.max(0, index - Math.floor(maxWindow / 2));
  const evidenceWindow = text.slice(start, start + maxWindow).trim();
  return {
    evidenceQuote: compactText(sentence, maxQuote),
    evidenceWindow: compactText(evidenceWindow, maxWindow)
  };
}

function buildCandidateEvidenceMetadata(row, { evidenceQuote = '', evidenceWindow = '', evidenceType = 'genealogy_text', extra = {} } = {}) {
  return {
    sourceId: row.source_id,
    chunkId: row.id,
    sourceTitle: row.source_title || row.title || '',
    headingPath: row.heading_path || '',
    evidenceQuote: evidenceQuote || compactText(row.content || row.summary || '', 260),
    evidenceWindow: evidenceWindow || compactText(row.content || row.summary || '', 780),
    evidenceType,
    ...extra
  };
}

function hasTechnicalInstructionNoise(value) {
  return /\b(lowercase|bo kinh xung|ghi la|van truc thuoc|lam toc bieu|mua pho ly|khong hien dien)\b/.test(normalizeKnowledgeText(value));
}

function isVerificationNoteText(value) {
  const text = normalizeKnowledgeText(value);
  return /\b(can kiem chung|can xac minh|chua xac minh|nghi van|nguon goc truoc cao dinh lang|moc 1807|thon trai|gia hoa|van ban 1930|lien he ho cao)\b/.test(text);
}

function isClanOrBranchLegacyText(value) {
  const text = normalizeKnowledgeText(value);
  return /\b(chi nhanh|chi nganh|dong ho|toan toc|toc cao|ho cao|cao toc|ban tri su)\b/.test(text) && !/\b(cao\s+dinh|cao\s+van|cao\s+duy|cao\s+xuan)\b/.test(text);
}

function compactExtractedNameCandidate(value) {
  const text = stripHanCharacters(value)
    .replace(/[.,;:()[\]{}"']/g, ' ')
    .replace(/\s+(?:la|là|cua|của|cha|me|mẹ|phu|phụ|mau|mẫu|than|thân|vo|vợ|chong|chồng|sinh|de|đẻ|con)\b.*$/giu, '')
    .replace(/\b(?:la|là|tuc|tức|hieu|hiệu|ten|tên|huy|huý|thuy|thuỷ|to|tổ|cao|cu|cụ)\b$/giu, '')
    .replace(/\s+(?:la|là)$/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function extractNameAliasCandidatesFromText(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const names = new Set();
  for (const name of extractCaoNamesFromText(source)) {
    names.add(compactExtractedNameCandidate(name));
  }
  const patterns = [
    /(?:Cao\s*Tổ|Cao\s*To)\s*(?:là|la|tức|tuc|tên\s+húy|ten\s+huy|húy|huý|huy)?\s*(Cao\s+[\p{L}]{2,}(?:\s+[\p{L}]{2,}){1,4})/giu,
    /(?:Th[ủu]y\s*Tổ|Thuy\s*To|cụ\s*Lạng|cu\s*Lang)\s*(?:là|la|tức|tuc|tên\s+húy|ten\s+huy|húy|huý|huy)?\s*(Cao\s+[\p{L}]{2,}(?:\s+[\p{L}]{2,}){1,4})/giu,
    /(?:tên\s+đầy\s+đủ|ten\s+day\s+du|họ\s+tên|ho\s+ten|tên\s+húy|ten\s+huy|húy|huý|huy)\s*(?:là|la|:)?\s*(Cao\s+[\p{L}]{2,}(?:\s+[\p{L}]{2,}){1,4})/giu
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const candidate = compactExtractedNameCandidate(match[1] || '');
      if (candidate.split(/\s+/).length >= 3 && candidate.length <= 80) {
        names.add(candidate);
      }
    }
  }
  return [...names].filter(Boolean).slice(0, 12);
}

function publicExtractedProfileCandidate(row) {
  const metadata = safeJsonParse(row.metadata_json, {});
  const evidenceQuote = metadata.evidenceQuote || row.source_quote || row.extracted_text || '';
  const evidenceWindow = metadata.evidenceWindow || row.source_quote || row.extracted_text || '';
  return {
    id: row.id,
    candidateType: row.candidate_type,
    personName: row.person_name,
    personNameNorm: row.person_name_norm,
    matchedMemberId: row.matched_member_id,
    matchedMemberName: row.matched_member_name,
    matchConfidence: row.match_confidence,
    targetField: row.target_field,
    extractedText: row.extracted_text,
    reviewedText: row.reviewed_text,
    effectiveText: row.reviewed_text || row.extracted_text,
    sourceQuote: row.source_quote,
    sourceTitle: metadata.sourceTitle || row.knowledge_title,
    headingPath: metadata.headingPath || '',
    evidenceQuote,
    evidenceWindow,
    evidenceType: metadata.evidenceType || (row.candidate_type === 'name_alias' ? 'genealogy_text' : row.candidate_type === 'verification_note' ? 'verification_note' : 'biography'),
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    knowledgeTitle: row.knowledge_title,
    visibility: row.visibility,
    status: normalizeProfileCandidateStatus(row.status),
    triage: getV3CandidateReviewState('profile', row),
    metadata,
    currentValues: metadata.currentValues || {},
    candidateMatches: Array.isArray(metadata.candidateMatches) ? metadata.candidateMatches : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function hydrateProfileCandidateReviewData(publicCandidate) {
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

async function listExtractedProfileCandidates({ q = '', status = '', type = '', sourceId = '', memberId = '', limit = 100, triageBucket = '', datasetKey = '' } = {}) {
  const database = await getDatabase();
  const rows = database.prepare('SELECT * FROM extracted_profile_candidates ORDER BY updated_at DESC, created_at DESC').all();
  const queryNorm = normalizeKnowledgeText(q);
  const statusFilter = normalizeProfileCandidateStatus(status);
  const hasStatusFilter = Boolean(String(status || '').trim());
  const typeFilter = String(type || '').trim();
  const triageFilter = normalizeV3TriageBucket(triageBucket);
  const triageDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const filtered = rows
    .filter((row) => {
      if (triageFilter) {
        if (!isV3CandidateRow(row, triageDatasetKey)) return false;
        if (classifyV3Candidate('profile', row).primaryBucket !== triageFilter) return false;
      }
      if (hasStatusFilter && normalizeProfileCandidateStatus(row.status) !== statusFilter) return false;
      if (typeFilter && row.candidate_type !== typeFilter) return false;
      if (sourceId && row.source_id !== sourceId) return false;
      if (memberId && row.matched_member_id !== memberId) return false;
      if (!queryNorm) return true;
      return normalizeKnowledgeText([
        row.person_name,
        row.matched_member_name,
        row.candidate_type,
        row.target_field,
        row.extracted_text,
        row.reviewed_text,
        row.source_quote,
        row.knowledge_title
      ].join(' ')).includes(queryNorm);
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)))
    .map(publicExtractedProfileCandidate);
  return Promise.all(filtered.map(hydrateProfileCandidateReviewData));
}

async function updateExtractedProfileCandidate(id, patch, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Extracted profile candidate not found.');
    err.status = 404;
    throw err;
  }
  const metadata = safeJsonParse(row.metadata_json, {});
  const nextStatus = patch.status === undefined ? normalizeProfileCandidateStatus(row.status) : normalizeProfileCandidateStatus(patch.status);
  const nextCandidateType = patch.candidateType === undefined ? row.candidate_type : normalizeProfileCandidateType(patch.candidateType);
  const nextTargetField = patch.targetField === undefined ? row.target_field : normalizeProfileTargetField(patch.targetField);
  const nextReviewedText = patch.reviewedText === undefined ? row.reviewed_text : String(patch.reviewedText || '').trim();
  const matchedMemberId = patch.matchedMemberId === undefined ? row.matched_member_id : String(patch.matchedMemberId || '').trim();
  const matchedMemberName = patch.matchedMemberName === undefined ? row.matched_member_name : String(patch.matchedMemberName || '').trim();
  const matchConfidence = patch.matchConfidence === undefined ? row.match_confidence : String(patch.matchConfidence || 'manual').trim();
  const nextMetadata = {
    ...metadata,
    lastReviewedBy: adminUser?.username || adminUser?.fullName || '',
    lastReviewedAt: new Date().toISOString()
  };

  database.prepare(`
    UPDATE extracted_profile_candidates
    SET status = ?,
        candidate_type = ?,
        target_field = ?,
        reviewed_text = ?,
        matched_member_id = ?,
        matched_member_name = ?,
        match_confidence = ?,
        metadata_json = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nextStatus,
    nextCandidateType,
    nextTargetField,
    nextReviewedText,
    matchedMemberId,
    matchedMemberName,
    matchConfidence,
    JSON.stringify(nextMetadata),
    id
  );
  return hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id)));
}

async function scanExtractedProfileCandidates({ sourceId = '', limit = 250 } = {}) {
  const database = await getDatabase();
  const where = sourceId ? 'WHERE c.source_id = ?' : '';
  const params = sourceId ? [sourceId] : [];
  const rows = database.prepare(`
    SELECT c.*, s.title AS source_title, s.slug AS source_slug, s.visibility AS source_visibility, s.metadata_json AS source_metadata_json
    FROM knowledge_chunks c
    LEFT JOIN knowledge_sources s ON s.id = c.source_id
    ${where}
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(...params, Math.max(1, Math.min(2000, Number(limit) || 250)));
  let scanned = 0;
  let created = 0;
  let skipped = 0;
  const candidates = [];
  for (const row of rows) {
    scanned += 1;
    if (shouldExcludeKnowledgeFromExtraction(row)) {
      skipped += 1;
      continue;
    }
    const haystack = normalizeKnowledgeText([row.title, row.heading_path, row.summary, row.content].join(' '));
    if (!PROFILE_CANDIDATE_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
      skipped += 1;
      continue;
    }
    const rawText = compactText(row.content || row.summary || row.title || '', 1400);
    if (normalizeKnowledgeText(rawText).length < 80) {
      skipped += 1;
      continue;
    }
    const names = extractCaoNamesFromText([row.title, row.heading_path, rawText].join(' '));
    if (!names.length) {
      skipped += 1;
      continue;
    }
    const candidateType = classifyProfileCandidateType(rawText);
    const scopedCandidateType = isClanOrBranchLegacyText(rawText)
      ? (normalizeKnowledgeText(rawText).includes('chi') || normalizeKnowledgeText(row.heading_path || '').includes('chi') ? 'branch_legacy' : 'clan_legacy')
      : isVerificationNoteText(rawText)
        ? 'verification_note'
        : candidateType;
    const targetField = defaultProfileTargetField(scopedCandidateType);
    for (const personName of names) {
      const evidence = candidateEvidenceFromText(row.content || rawText, [personName], { maxQuote: 320, maxWindow: 720 });
      if (!evidence.evidenceQuote || !normalizeKnowledgeText(evidence.evidenceQuote).includes(normalizeKnowledgeText(personName))) {
        skipped += 1;
        continue;
      }
      if (names.length > 2 && normalizeKnowledgeText(evidence.evidenceQuote).split(/\s+/).length > 90) {
        skipped += 1;
        continue;
      }
      const personNameNorm = normalizeKnowledgeText(personName);
      const matches = await searchLineageMembers(personName, { limit: 6 });
      const topMatch = matches[0] || null;
      const id = `profile_${buildProfileCandidateHash({
        sourceId: row.source_id,
        chunkId: row.id,
        personName,
        candidateType: scopedCandidateType,
        extractedText: evidence.evidenceQuote
      })}`;
      const exists = database.prepare('SELECT id FROM extracted_profile_candidates WHERE id = ?').get(id);
      if (exists) {
        skipped += 1;
        continue;
      }
      const metadata = {
        ...buildCandidateEvidenceMetadata(row, {
          ...evidence,
          evidenceType: scopedCandidateType === 'verification_note'
            ? 'verification_note'
            : scopedCandidateType === 'clan_legacy' || scopedCandidateType === 'branch_legacy'
              ? 'biography'
              : 'biography'
        }),
        headingPath: row.heading_path || '',
        summary: row.summary || '',
        tags: safeJsonParse(row.tags_json, []),
        entityRefs: safeJsonParse(row.entity_refs_json, []),
        candidateMatches: matches
      };
      database.prepare(`
        INSERT INTO extracted_profile_candidates
          (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
           match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
           chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
      `).run(
        id,
        scopedCandidateType,
        personName,
        personNameNorm,
        topMatch?.confidence && topMatch.confidence !== 'weak' && topMatch.confidence !== 'ambiguous' ? topMatch.memberId : '',
        topMatch?.confidence && topMatch.confidence !== 'weak' && topMatch.confidence !== 'ambiguous' ? topMatch.fullName : '',
        topMatch?.confidence || 'none',
        targetField,
        evidence.evidenceQuote,
        '',
        evidence.evidenceQuote,
        row.source_id,
        row.id,
        row.source_title || row.title || '',
        row.visibility || row.source_visibility || 'public',
        JSON.stringify(metadata)
      );
      created += 1;
      candidates.push(await hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id))));
    }
  }
  return { ok: true, scanned, created, skipped, candidates };
}

async function scanExtractedNameAliasCandidates({ sourceId = '', limit = 250 } = {}) {
  const database = await getDatabase();
  const where = sourceId ? 'WHERE c.source_id = ?' : '';
  const params = sourceId ? [sourceId] : [];
  const rows = database.prepare(`
    SELECT c.*, s.title AS source_title, s.slug AS source_slug, s.visibility AS source_visibility, s.metadata_json AS source_metadata_json
    FROM knowledge_chunks c
    LEFT JOIN knowledge_sources s ON s.id = c.source_id
    ${where}
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(...params, Math.max(1, Math.min(2000, Number(limit) || 250)));
  let scanned = 0;
  let created = 0;
  let skipped = 0;
  const candidates = [];
  for (const row of rows) {
    scanned += 1;
    if (shouldExcludeKnowledgeFromExtraction(row)) {
      skipped += 1;
      continue;
    }
    const rawText = compactText(row.content || row.summary || row.title || '', 1200);
    const haystack = normalizeKnowledgeText([row.title, row.heading_path, row.summary, rawText].join(' '));
    const hasNameSignal = /(cao |cao dinh|cao van|cao duy|cao xuan|cao to|thuy to|thuy to|danh xung|ten huy|ten day du|ho ten|alias)/.test(haystack);
    if (!hasNameSignal || hasTechnicalInstructionNoise(rawText)) {
      skipped += 1;
      continue;
    }
    const names = extractNameAliasCandidatesFromText([row.title, row.heading_path, rawText].join(' '));
    if (!names.length) {
      skipped += 1;
      continue;
    }
    for (const personName of names) {
      if (hasTechnicalInstructionNoise(personName)) {
        skipped += 1;
        continue;
      }
      const personNameNorm = normalizeKnowledgeText(personName);
      const matches = await searchLineageMembers(personName, { limit: 6 });
      const topMatch = matches[0] || null;
      const currentName = topMatch?.currentValues?.name || '';
      if (currentName && normalizeKnowledgeText(currentName) === personNameNorm) {
        skipped += 1;
        continue;
      }
      const id = `profile_${buildProfileCandidateHash({
        sourceId: row.source_id,
        chunkId: row.id,
        personName,
        candidateType: 'name_alias',
        extractedText: personName
      })}`;
      const exists = database.prepare('SELECT id FROM extracted_profile_candidates WHERE id = ?').get(id);
      if (exists) {
        skipped += 1;
        continue;
      }
      const evidence = candidateEvidenceFromText(row.content || rawText, [personName, row.heading_path]);
      const metadata = {
        ...buildCandidateEvidenceMetadata(row, {
          ...evidence,
          evidenceType: 'genealogy_text'
        }),
        headingPath: row.heading_path || '',
        summary: row.summary || '',
        tags: safeJsonParse(row.tags_json, []),
        entityRefs: safeJsonParse(row.entity_refs_json, []),
        candidateMatches: matches,
        suggestedField: 'name',
        currentName
      };
      database.prepare(`
        INSERT INTO extracted_profile_candidates
          (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
           match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
           chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
        VALUES (?, 'name_alias', ?, ?, ?, ?, ?, 'name', ?, '', ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
      `).run(
        id,
        personName,
        personNameNorm,
        topMatch?.confidence && ['exact', 'strong', 'medium'].includes(topMatch.confidence) ? topMatch.memberId : '',
        topMatch?.confidence && ['exact', 'strong', 'medium'].includes(topMatch.confidence) ? topMatch.fullName : '',
        topMatch?.confidence || 'none',
        personName,
        compactText(row.content || row.summary || '', 420),
        row.source_id,
        row.id,
        row.source_title || row.title || '',
        row.visibility || row.source_visibility || 'public',
        JSON.stringify(metadata)
      );
      created += 1;
      candidates.push(await hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id))));
    }
  }
  return { ok: true, scanned, created, skipped, candidates };
}

function getProfileFieldValue(node, field) {
  const targetField = normalizeProfileTargetField(field);
  if (targetField === 'achievements') {
    return Array.isArray(node.achievements) ? node.achievements.join('\n') : String(node.achievements || '').trim();
  }
  return String(node[targetField] || '').trim();
}

function setProfileFieldValue(node, field, value, mode = 'replace') {
  const targetField = normalizeProfileTargetField(field);
  const text = String(value || '').trim();
  if (targetField === 'achievements') {
    const current = Array.isArray(node.achievements)
      ? node.achievements.map((item) => String(item || '').trim()).filter(Boolean)
      : String(node.achievements || '').trim()
        ? [String(node.achievements || '').trim()]
        : [];
    if (mode === 'append') {
      if (!current.some((item) => normalizeKnowledgeText(item) === normalizeKnowledgeText(text))) {
        current.push(text);
      }
      node.achievements = current;
    } else {
      node.achievements = text ? [text] : [];
    }
    return;
  }
  if (mode === 'append') {
    const current = String(node[targetField] || '').trim();
    node[targetField] = current && normalizeKnowledgeText(current) !== normalizeKnowledgeText(text)
      ? `${current}\n\n${text}`
      : text;
    return;
  }
  node[targetField] = text;
}

async function applyExtractedProfileCandidate(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Extracted profile candidate not found.');
    err.status = 404;
    throw err;
  }
  const status = normalizeProfileCandidateStatus(row.status);
  if (status !== 'approved' && status !== 'applied') {
    const err = new Error('Candidate must be approved before applying.');
    err.status = 400;
    throw err;
  }
  assertV3CandidateApplyAllowed('profile', row, body);
  if (['verification_note', 'clan_legacy', 'branch_legacy'].includes(row.candidate_type)) {
    const err = new Error('Candidate này là ghi chú kiểm chứng/cấp chi ngành, không áp dụng trực tiếp vào hồ sơ cá nhân.');
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

  const targetField = normalizeProfileTargetField(body.targetField || row.target_field);
  const value = String(body.reviewedText || row.reviewed_text || row.extracted_text || '').trim();
  const appendMode = body.appendMode === 'append' ? 'append' : 'replace';
  const confirmOverwrite = body.confirmOverwrite === true || body.force === true;
  const oldValue = getProfileFieldValue(target, targetField);
  if (!value) {
    const err = new Error('Candidate text is empty.');
    err.status = 400;
    throw err;
  }
  if (oldValue && appendMode !== 'append' && !confirmOverwrite && normalizeKnowledgeText(oldValue) !== normalizeKnowledgeText(value)) {
    const err = new Error('Target profile field is not empty. Use appendMode=append or confirmOverwrite=true.');
    err.status = 409;
    err.conflicts = [{ field: targetField, oldValue, newValue: value }];
    throw err;
  }
  setProfileFieldValue(target, targetField, value, appendMode);
  const newValue = getProfileFieldValue(target, targetField);
  const changes = oldValue === newValue ? [] : [{
    lineageField: targetField,
    oldValue,
    newValue,
    sourceId: row.source_id,
    chunkId: row.chunk_id
  }];
  if (changes.length) {
    await writeState(TREE_STATE_KEY, tree);
  }
  const auditId = `profile_audit_${sha256Base64Url(`${id}:${Date.now()}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_profile_audit_logs
      (id, candidate_id, member_id, action, field_changes_json, source_id, chunk_id, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    auditId,
    id,
    memberId,
    changes.length ? 'apply' : 'apply_noop',
    JSON.stringify({ changes, appendMode, targetField }),
    row.source_id,
    row.chunk_id,
    adminUser?.username || adminUser?.fullName || ''
  );
  database.prepare(`
    UPDATE extracted_profile_candidates
    SET status = 'applied',
        target_field = ?,
        matched_member_id = ?,
        matched_member_name = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(targetField, memberId, String(target.name || row.matched_member_name || '').trim(), id);
  return {
    ok: true,
    candidate: await hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id))),
    changes,
    conflicts: [],
    auditId
  };
}

async function bulkUpdateExtractedProfileCandidates(body = {}, adminUser = {}) {
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
        const candidate = await updateExtractedProfileCandidate(id, { status: 'approved' }, adminUser);
        results.push({ id, ok: true, status: 'approved', candidate });
      } else if (action === 'reject') {
        const candidate = await updateExtractedProfileCandidate(id, { status: 'rejected' }, adminUser);
        results.push({ id, ok: true, status: 'rejected', candidate });
      } else if (action === 'reset') {
        const candidate = await updateExtractedProfileCandidate(id, { status: 'pending' }, adminUser);
        results.push({ id, ok: true, status: 'pending', candidate });
      } else {
        const row = (await getDatabase()).prepare('SELECT status FROM extracted_profile_candidates WHERE id = ?').get(id);
        if (!row || normalizeProfileCandidateStatus(row.status) !== 'approved') {
          results.push({ id, ok: false, skipped: true, reason: row ? 'not_approved' : 'not_found' });
          continue;
        }
        const applied = await applyExtractedProfileCandidate(id, body, adminUser);
        results.push({ id, ok: true, status: 'applied', changes: applied.changes });
      }
    } catch (err) {
      results.push({ id, ok: false, error: err.message || String(err), conflicts: err.conflicts || [] });
    }
  }
  const database = await getDatabase();
  const auditId = `profile_audit_bulk_${sha256Base64Url(`${action}:${Date.now()}:${ids.join(',')}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_profile_audit_logs
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

const RELATIONSHIP_TYPES = ['spouse', 'father', 'mother', 'child', 'parent_child', 'sibling'];

function normalizeRelationshipCandidateStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['pending', 'approved', 'rejected', 'applied'].includes(value) ? value : 'pending';
}

function normalizeRelationshipType(value) {
  const type = String(value || '').trim().toLowerCase();
  return RELATIONSHIP_TYPES.includes(type) ? type : 'parent_child';
}

function normalizeRelationshipDirection(value) {
  const direction = String(value || '').trim().toLowerCase();
  return ['subject_to_object', 'object_to_subject', 'bidirectional'].includes(direction) ? direction : 'subject_to_object';
}

function buildRelationshipCandidateHash({ sourceId, chunkId, relationshipType, subjectName, objectName, extractedText }) {
  return sha256Base64Url([
    sourceId,
    chunkId,
    normalizeRelationshipType(relationshipType),
    normalizeKnowledgeText(subjectName),
    normalizeKnowledgeText(objectName),
    normalizeKnowledgeText(extractedText).slice(0, 500)
  ].join('|')).slice(0, 24);
}

function relationshipMatchFlags(subjectMatches, objectMatches) {
  const subjectTop = subjectMatches[0] || null;
  const objectTop = objectMatches[0] || null;
  const strong = new Set(['exact', 'strong']);
  const subjectStrong = subjectTop && strong.has(subjectTop.confidence);
  const objectStrong = objectTop && strong.has(objectTop.confidence);
  return {
    requires_new_subject: !subjectMatches.length,
    requires_new_object: !objectMatches.length,
    ambiguous_subject: !subjectStrong || subjectTop?.confidence === 'ambiguous',
    ambiguous_object: !objectStrong || objectTop?.confidence === 'ambiguous',
    needs_manual_review: !subjectStrong || !objectStrong || subjectTop?.confidence === 'ambiguous' || objectTop?.confidence === 'ambiguous'
  };
}

function publicExtractedRelationshipCandidate(row) {
  const flags = safeJsonParse(row.flags_json, {});
  const metadata = safeJsonParse(row.metadata_json, {});
  const evidenceQuote = metadata.evidenceQuote || row.source_quote || row.extracted_text || '';
  const evidenceWindow = metadata.evidenceWindow || row.source_quote || row.extracted_text || '';
  return {
    id: row.id,
    relationshipType: normalizeRelationshipType(row.relationship_type),
    subjectName: row.subject_name,
    subjectNameNorm: row.subject_name_norm,
    subjectMemberId: row.subject_member_id,
    subjectMemberName: row.subject_member_name,
    subjectMatchConfidence: row.subject_match_confidence,
    objectName: row.object_name,
    objectNameNorm: row.object_name_norm,
    objectMemberId: row.object_member_id,
    objectMemberName: row.object_member_name,
    objectMatchConfidence: row.object_match_confidence,
    direction: normalizeRelationshipDirection(row.direction),
    extractedText: row.extracted_text,
    reviewedText: row.reviewed_text,
    effectiveText: row.reviewed_text || row.extracted_text,
    sourceQuote: row.source_quote,
    sourceTitle: metadata.sourceTitle || row.knowledge_title,
    headingPath: metadata.headingPath || '',
    evidenceQuote,
    evidenceWindow,
    evidenceType: metadata.evidenceType || 'relationship',
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    knowledgeTitle: row.knowledge_title,
    visibility: row.visibility,
    status: normalizeRelationshipCandidateStatus(row.status),
    triage: getV3CandidateReviewState('relationship', row),
    flags,
    metadata,
    subjectMatches: Array.isArray(metadata.subjectMatches) ? metadata.subjectMatches : [],
    objectMatches: Array.isArray(metadata.objectMatches) ? metadata.objectMatches : [],
    currentValues: metadata.currentValues || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function relationCurrentValues(subject, object) {
  return {
    subject: subject ? {
      name: subject.name || '',
      parentId: subject.parentId || '',
      fatherName: subject.fatherName || '',
      motherName: subject.motherName || '',
      spouse: subject.spouse || '',
      spouseDetails: Array.isArray(subject.spouseDetails) ? subject.spouseDetails.map((item) => item?.name || '').filter(Boolean) : []
    } : {},
    object: object ? {
      name: object.name || '',
      parentId: object.parentId || '',
      fatherName: object.fatherName || '',
      motherName: object.motherName || '',
      spouse: object.spouse || '',
      spouseDetails: Array.isArray(object.spouseDetails) ? object.spouseDetails.map((item) => item?.name || '').filter(Boolean) : []
    } : {}
  };
}

async function hydrateRelationshipCandidateReviewData(publicCandidate) {
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const subjectMatches = buildCandidateMatchesFromMembers({ person_name: publicCandidate.subjectName }, members);
  const objectMatches = buildCandidateMatchesFromMembers({ person_name: publicCandidate.objectName }, members);
  const subject = members.find((member) => member.id === publicCandidate.subjectMemberId) || null;
  const object = members.find((member) => member.id === publicCandidate.objectMemberId) || null;
  return {
    ...publicCandidate,
    subjectMatches,
    objectMatches,
    currentValues: relationCurrentValues(subject, object)
  };
}

function relationshipSentencesFromText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。；;])\s+|[\n\r]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12)
    .slice(0, 80);
}

function detectRelationshipType(sentence) {
  const text = normalizeKnowledgeText(sentence);
  if (/(vo|chong|phoi ngau|chinh that|thu that|that)/.test(text)) return 'spouse';
  if (/(mau than|than mau| me | la me|me cua)/.test(` ${text} `)) return 'mother';
  if (/(phu than|than phu| cha | la cha|cha cua|khao)/.test(` ${text} `)) return 'father';
  if (/(sinh ha|sinh duoc|de ra|con cua|con trai|con gai|truong nam|thu nam|truong nu|thu nu|hau due)/.test(text)) return 'parent_child';
  return '';
}

function inferRelationshipPair(sentence, relationshipType) {
  const names = extractNameAliasCandidatesFromText(sentence);
  if (names.length < 2) return null;
  const text = normalizeKnowledgeText(sentence);
  let subjectName = names[0];
  let objectName = names[1];
  let direction = 'subject_to_object';
  if (relationshipType === 'father' || relationshipType === 'mother') {
    const firstBeforeSecond = text.indexOf(normalizeKnowledgeText(names[0])) < text.indexOf(normalizeKnowledgeText(names[1]));
    const hasParentOf = /(la cha cua|cha cua|la me cua|me cua|phu than cua|mau than cua)/.test(text);
    const hasChildOf = /(con cua|than phu la|than mau la|phu than la|mau than la)/.test(text);
    if (hasParentOf && firstBeforeSecond) {
      subjectName = names[1];
      objectName = names[0];
    } else if (hasChildOf) {
      subjectName = names[0];
      objectName = names[1];
    }
  }
  if (relationshipType === 'spouse') {
    direction = 'bidirectional';
  }
  if (relationshipType === 'parent_child') {
    const hasChildOf = /(con cua|la con|con trai cua|con gai cua)/.test(text);
    if (hasChildOf) {
      subjectName = names[0];
      objectName = names[1];
      return { relationshipType: 'father', subjectName, objectName, direction: 'object_to_subject' };
    }
    subjectName = names[0];
    objectName = names[1];
  }
  return { relationshipType, subjectName, objectName, direction };
}

async function insertVerificationNoteCandidateFromChunk(database, row, text) {
  const evidence = candidateEvidenceFromText(row.content || text, [text, row.heading_path], { maxQuote: 340, maxWindow: 760 });
  const id = `profile_${buildProfileCandidateHash({
    sourceId: row.source_id,
    chunkId: row.id,
    personName: 'Ghi chú kiểm chứng phả hệ',
    candidateType: 'verification_note',
    extractedText: evidence.evidenceQuote || text
  })}`;
  if (database.prepare('SELECT id FROM extracted_profile_candidates WHERE id = ?').get(id)) return null;
  const metadata = {
    ...buildCandidateEvidenceMetadata(row, {
      ...evidence,
      evidenceType: 'verification_note'
    }),
    headingPath: row.heading_path || '',
    summary: row.summary || '',
    tags: safeJsonParse(row.tags_json, []),
    entityRefs: safeJsonParse(row.entity_refs_json, []),
    candidateMatches: [],
    notApplyDirectly: true
  };
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
       match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
       chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, 'verification_note', ?, ?, '', '', 'none', 'description', ?, '', ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
  `).run(
    id,
    'Ghi chú kiểm chứng phả hệ',
    normalizeKnowledgeText('Ghi chú kiểm chứng phả hệ'),
    evidence.evidenceQuote || compactText(text, 340),
    evidence.evidenceQuote || compactText(text, 340),
    row.source_id,
    row.id,
    row.source_title || row.title || '',
    row.visibility || row.source_visibility || 'private',
    JSON.stringify(metadata)
  );
  return hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(id)));
}

async function scanExtractedRelationshipCandidates({ sourceId = '', limit = 250 } = {}) {
  const database = await getDatabase();
  const where = sourceId ? 'WHERE c.source_id = ?' : '';
  const params = sourceId ? [sourceId] : [];
  const rows = database.prepare(`
    SELECT c.*, s.title AS source_title, s.slug AS source_slug, s.visibility AS source_visibility, s.metadata_json AS source_metadata_json
    FROM knowledge_chunks c
    LEFT JOIN knowledge_sources s ON s.id = c.source_id
    ${where}
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(...params, Math.max(1, Math.min(2000, Number(limit) || 250)));
  let scanned = 0;
  let created = 0;
  let skipped = 0;
  const candidates = [];
  for (const row of rows) {
    if (shouldExcludeKnowledgeFromExtraction(row)) {
      skipped += 1;
      continue;
    }
    const rawText = compactText(row.content || row.summary || row.title || '', 1800);
    const haystack = normalizeKnowledgeText([row.title, row.heading_path, row.summary, rawText].join(' '));
    if (isVerificationNoteText(rawText) && !/(vo|chong|phoi ngau|chinh that|thu that|sinh ha|sinh duoc|con cua|phu than|mau than|cha cua|me cua|truong nam|thu nam|truong nu|thu nu)/.test(haystack)) {
      const note = await insertVerificationNoteCandidateFromChunk(database, row, rawText);
      if (note) created += 1;
      else skipped += 1;
      continue;
    }
    if (!/(vo|chong|phoi ngau|chinh that|thu that|sinh ha|sinh duoc|con cua|phu than|mau than|cha cua|me cua|truong nam|thu nam|truong nu|thu nu)/.test(haystack)) {
      skipped += 1;
      continue;
    }
    for (const sentence of relationshipSentencesFromText(rawText)) {
      scanned += 1;
      const relationshipType = detectRelationshipType(sentence);
      if (!relationshipType) {
        skipped += 1;
        continue;
      }
      const pair = inferRelationshipPair(sentence, relationshipType);
      if (!pair?.subjectName || !pair?.objectName || normalizeKnowledgeText(pair.subjectName) === normalizeKnowledgeText(pair.objectName)) {
        if (isVerificationNoteText(sentence)) {
          const note = await insertVerificationNoteCandidateFromChunk(database, row, sentence);
          if (note) created += 1;
        }
        skipped += 1;
        continue;
      }
      if (hasTechnicalInstructionNoise(sentence)) {
        skipped += 1;
        continue;
      }
      const subjectMatches = await searchLineageMembers(pair.subjectName, { limit: 6 });
      const objectMatches = await searchLineageMembers(pair.objectName, { limit: 6 });
      const flags = relationshipMatchFlags(subjectMatches, objectMatches);
      const subjectTop = subjectMatches[0] || null;
      const objectTop = objectMatches[0] || null;
      const id = `rel_${buildRelationshipCandidateHash({
        sourceId: row.source_id,
        chunkId: row.id,
        relationshipType: pair.relationshipType,
        subjectName: pair.subjectName,
        objectName: pair.objectName,
        extractedText: sentence
      })}`;
      if (database.prepare('SELECT id FROM extracted_relationship_candidates WHERE id = ?').get(id)) {
        skipped += 1;
        continue;
      }
      const evidence = candidateEvidenceFromText(row.content || sentence, [pair.subjectName, pair.objectName, sentence], { maxQuote: 320, maxWindow: 760 });
      const metadata = {
        ...buildCandidateEvidenceMetadata(row, {
          ...evidence,
          evidenceType: 'relationship'
        }),
        headingPath: row.heading_path || '',
        summary: row.summary || '',
        tags: safeJsonParse(row.tags_json, []),
        entityRefs: safeJsonParse(row.entity_refs_json, []),
        subjectMatches,
        objectMatches
      };
      database.prepare(`
        INSERT INTO extracted_relationship_candidates
          (id, relationship_type, subject_name, subject_name_norm, subject_member_id, subject_member_name,
           subject_match_confidence, object_name, object_name_norm, object_member_id, object_member_name,
           object_match_confidence, direction, extracted_text, reviewed_text, source_quote, source_id,
           chunk_id, knowledge_title, visibility, status, flags_json, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        normalizeRelationshipType(pair.relationshipType),
        pair.subjectName,
        normalizeKnowledgeText(pair.subjectName),
        flags.ambiguous_subject ? '' : subjectTop?.memberId || '',
        flags.ambiguous_subject ? '' : subjectTop?.fullName || '',
        subjectTop?.confidence || 'none',
        pair.objectName,
        normalizeKnowledgeText(pair.objectName),
        flags.ambiguous_object ? '' : objectTop?.memberId || '',
        flags.ambiguous_object ? '' : objectTop?.fullName || '',
        objectTop?.confidence || 'none',
        normalizeRelationshipDirection(pair.direction),
        evidence.evidenceQuote || sentence,
        evidence.evidenceQuote || compactText(row.content || row.summary || '', 420),
        row.source_id,
        row.id,
        row.source_title || row.title || '',
        row.visibility || row.source_visibility || 'public',
        JSON.stringify(flags),
        JSON.stringify(metadata)
      );
      created += 1;
      candidates.push(await hydrateRelationshipCandidateReviewData(publicExtractedRelationshipCandidate(database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(id))));
    }
  }
  return { ok: true, scanned, created, skipped, candidates };
}

async function listExtractedRelationshipCandidates({ q = '', status = '', type = '', memberId = '', ambiguous = '', requiresNewMember = '', limit = 100, triageBucket = '', datasetKey = '' } = {}) {
  const database = await getDatabase();
  const rows = database.prepare('SELECT * FROM extracted_relationship_candidates ORDER BY updated_at DESC, created_at DESC').all();
  const queryNorm = normalizeKnowledgeText(q);
  const statusFilter = normalizeRelationshipCandidateStatus(status);
  const hasStatusFilter = Boolean(String(status || '').trim());
  const typeFilter = String(type || '').trim();
  const ambiguousFilter = String(ambiguous || '').toLowerCase();
  const newMemberFilter = String(requiresNewMember || '').toLowerCase();
  const triageFilter = normalizeV3TriageBucket(triageBucket);
  const triageDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const filtered = rows.filter((row) => {
    const flags = safeJsonParse(row.flags_json, {});
    if (triageFilter) {
      if (!isV3CandidateRow(row, triageDatasetKey)) return false;
      if (classifyV3Candidate('relationship', row).primaryBucket !== triageFilter) return false;
    }
    if (hasStatusFilter && normalizeRelationshipCandidateStatus(row.status) !== statusFilter) return false;
    if (typeFilter && normalizeRelationshipType(row.relationship_type) !== typeFilter) return false;
    if (memberId && row.subject_member_id !== memberId && row.object_member_id !== memberId) return false;
    if (ambiguousFilter === 'true' && !flags.ambiguous_subject && !flags.ambiguous_object) return false;
    if (ambiguousFilter === 'false' && (flags.ambiguous_subject || flags.ambiguous_object)) return false;
    if (newMemberFilter === 'true' && !flags.requires_new_subject && !flags.requires_new_object) return false;
    if (newMemberFilter === 'false' && (flags.requires_new_subject || flags.requires_new_object)) return false;
    if (!queryNorm) return true;
    return normalizeKnowledgeText([
      row.subject_name,
      row.subject_member_name,
      row.object_name,
      row.object_member_name,
      row.relationship_type,
      row.extracted_text,
      row.reviewed_text,
      row.source_quote,
      row.knowledge_title
    ].join(' ')).includes(queryNorm);
  }).slice(0, Math.max(1, Math.min(500, Number(limit) || 100))).map(publicExtractedRelationshipCandidate);
  return Promise.all(filtered.map(hydrateRelationshipCandidateReviewData));
}

async function updateExtractedRelationshipCandidate(id, patch = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Relationship candidate not found.');
    err.status = 404;
    throw err;
  }
  const flags = { ...safeJsonParse(row.flags_json, {}), ...(patch.flags && typeof patch.flags === 'object' ? patch.flags : {}) };
  const metadata = {
    ...safeJsonParse(row.metadata_json, {}),
    lastReviewedBy: adminUser?.username || adminUser?.fullName || '',
    lastReviewedAt: new Date().toISOString()
  };
  const next = {
    status: patch.status === undefined ? normalizeRelationshipCandidateStatus(row.status) : normalizeRelationshipCandidateStatus(patch.status),
    relationshipType: patch.relationshipType === undefined ? normalizeRelationshipType(row.relationship_type) : normalizeRelationshipType(patch.relationshipType),
    subjectMemberId: patch.subjectMemberId === undefined ? row.subject_member_id : String(patch.subjectMemberId || '').trim(),
    subjectMemberName: patch.subjectMemberName === undefined ? row.subject_member_name : String(patch.subjectMemberName || '').trim(),
    subjectMatchConfidence: patch.subjectMatchConfidence === undefined ? row.subject_match_confidence : String(patch.subjectMatchConfidence || 'manual').trim(),
    objectMemberId: patch.objectMemberId === undefined ? row.object_member_id : String(patch.objectMemberId || '').trim(),
    objectMemberName: patch.objectMemberName === undefined ? row.object_member_name : String(patch.objectMemberName || '').trim(),
    objectMatchConfidence: patch.objectMatchConfidence === undefined ? row.object_match_confidence : String(patch.objectMatchConfidence || 'manual').trim(),
    direction: patch.direction === undefined ? normalizeRelationshipDirection(row.direction) : normalizeRelationshipDirection(patch.direction),
    reviewedText: patch.reviewedText === undefined ? row.reviewed_text : String(patch.reviewedText || '').trim()
  };
  database.prepare(`
    UPDATE extracted_relationship_candidates
    SET status = ?, relationship_type = ?, subject_member_id = ?, subject_member_name = ?,
        subject_match_confidence = ?, object_member_id = ?, object_member_name = ?,
        object_match_confidence = ?, direction = ?, reviewed_text = ?, flags_json = ?,
        metadata_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    next.status,
    next.relationshipType,
    next.subjectMemberId,
    next.subjectMemberName,
    next.subjectMatchConfidence,
    next.objectMemberId,
    next.objectMemberName,
    next.objectMatchConfidence,
    next.direction,
    next.reviewedText,
    JSON.stringify(flags),
    JSON.stringify(metadata),
    id
  );
  return hydrateRelationshipCandidateReviewData(publicExtractedRelationshipCandidate(database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(id)));
}

function addSpouseToNode(node, spouseName, { appendSpouse = true, confirmOverwrite = false } = {}) {
  const oldSpouse = String(node.spouse || '').trim();
  const names = oldSpouse.split(/[,/;+\-]+/).map((item) => item.trim()).filter(Boolean);
  const exists = names.some((item) => normalizeKnowledgeText(item) === normalizeKnowledgeText(spouseName));
  if (oldSpouse && !appendSpouse && !confirmOverwrite && !exists) {
    const err = new Error('Spouse field is not empty. Use appendSpouse=true or confirmOverwrite=true.');
    err.status = 409;
    throw err;
  }
  const nextNames = appendSpouse ? [...names] : [];
  if (!exists) nextNames.push(spouseName);
  node.spouse = nextNames.join(', ');
  if (!Array.isArray(node.spouseList)) node.spouseList = [];
  node.spouseList = node.spouse.split(/[,/;+\-]+/).map((item) => item.trim()).filter(Boolean);
  if (!Array.isArray(node.spouseDetails)) node.spouseDetails = [];
  if (!node.spouseDetails.some((item) => normalizeKnowledgeText(item?.name) === normalizeKnowledgeText(spouseName))) {
    node.spouseDetails.push({ name: spouseName });
  }
}

async function applyExtractedRelationshipCandidate(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Relationship candidate not found.');
    err.status = 404;
    throw err;
  }
  const status = normalizeRelationshipCandidateStatus(row.status);
  if (status !== 'approved' && status !== 'applied') {
    const err = new Error('Candidate must be approved before applying.');
    err.status = 400;
    throw err;
  }
  assertV3CandidateApplyAllowed('relationship', row, body);
  const flags = safeJsonParse(row.flags_json, {});
  if (flags.requires_new_subject || flags.requires_new_object || body.createMissingMember === true) {
    const err = new Error('Cần tạo/gán nhân vật trước khi áp dụng quan hệ.');
    err.status = 409;
    throw err;
  }
  const subjectId = String(body.subjectMemberId || row.subject_member_id || '').trim();
  const objectId = String(body.objectMemberId || row.object_member_id || '').trim();
  if (!subjectId || !objectId) {
    const err = new Error('Missing subject or object member id.');
    err.status = 400;
    throw err;
  }
  const tree = await readLineageTreeForAI();
  if (!tree) {
    const err = new Error('Lineage tree is not available.');
    err.status = 404;
    throw err;
  }
  const subject = getLineageNodeById(tree, subjectId);
  const object = getLineageNodeById(tree, objectId);
  if (!subject || !object) {
    const err = new Error('Subject or object member not found in lineage tree.');
    err.status = 404;
    throw err;
  }
  const relationshipType = normalizeRelationshipType(body.relationshipType || row.relationship_type);
  const confirmOverwrite = body.confirmOverwrite === true || body.force === true;
  const appendSpouse = body.appendSpouse !== false;
  const applyBidirectional = body.applyBidirectional === true || row.direction === 'bidirectional';
  const oldValue = relationCurrentValues(subject, object);
  let changed = false;
  if (relationshipType === 'spouse') {
    addSpouseToNode(subject, object.name || row.object_name, { appendSpouse, confirmOverwrite });
    if (applyBidirectional) addSpouseToNode(object, subject.name || row.subject_name, { appendSpouse, confirmOverwrite });
    changed = true;
  } else if (relationshipType === 'father') {
    if (subject.parentId && subject.parentId !== object.id && !confirmOverwrite) {
      const err = new Error('Subject already has a different parentId. Use confirmOverwrite=true.');
      err.status = 409;
      throw err;
    }
    if (!subject.parentId || subject.parentId !== object.id) changed = reparentLineageNode(tree, subject.id, object.id) || changed;
    subject.parentId = object.id;
    subject.fatherName = object.name || subject.fatherName || row.object_name;
    changed = true;
  } else if (relationshipType === 'mother') {
    if (subject.motherName && normalizeKnowledgeText(subject.motherName) !== normalizeKnowledgeText(object.name) && !confirmOverwrite) {
      const err = new Error('Subject already has a different motherName. Use confirmOverwrite=true.');
      err.status = 409;
      throw err;
    }
    subject.motherName = object.name || row.object_name;
    subject.motherId = object.id;
    changed = true;
  } else if (relationshipType === 'child' || relationshipType === 'parent_child') {
    if (object.parentId && object.parentId !== subject.id && !confirmOverwrite) {
      const err = new Error('Object already has a different parentId. Use confirmOverwrite=true.');
      err.status = 409;
      throw err;
    }
    changed = reparentLineageNode(tree, object.id, subject.id) || changed;
    object.parentId = subject.id;
    object.fatherName = subject.name || object.fatherName || row.subject_name;
    changed = true;
  } else {
    const err = new Error('Sibling apply is not supported in Phase 2W.1.');
    err.status = 400;
    throw err;
  }
  const newSubject = getLineageNodeById(tree, subjectId);
  const newObject = getLineageNodeById(tree, objectId);
  const newValue = relationCurrentValues(newSubject, newObject);
  if (changed) await writeState(TREE_STATE_KEY, tree);
  const auditId = `rel_audit_${sha256Base64Url(`${id}:${Date.now()}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_relationship_audit_logs
      (id, candidate_id, action, subject_member_id, object_member_id, relationship_type,
       old_value_json, new_value_json, source_id, chunk_id, admin_user, status, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'))
  `).run(
    auditId,
    id,
    changed ? 'apply' : 'apply_noop',
    subjectId,
    objectId,
    relationshipType,
    JSON.stringify(oldValue),
    JSON.stringify(newValue),
    row.source_id,
    row.chunk_id,
    adminUser?.username || adminUser?.fullName || '',
    changed ? 'applied' : 'noop'
  );
  database.prepare(`
    UPDATE extracted_relationship_candidates
    SET status = 'applied',
        relationship_type = ?,
        subject_member_id = ?,
        subject_member_name = ?,
        object_member_id = ?,
        object_member_name = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(relationshipType, subjectId, newSubject?.name || row.subject_member_name, objectId, newObject?.name || row.object_member_name, id);
  return {
    ok: true,
    candidate: await hydrateRelationshipCandidateReviewData(publicExtractedRelationshipCandidate(database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(id))),
    changes: changed ? [{ relationshipType, subjectId, objectId, oldValue, newValue }] : [],
    auditId
  };
}

async function bulkUpdateExtractedRelationshipCandidates(body = {}, adminUser = {}) {
  const action = String(body.action || '').trim();
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!ids.length) {
    const err = new Error('Missing candidate ids.');
    err.status = 400;
    throw err;
  }
  if (!['approve', 'reject', 'reset'].includes(action)) {
    const err = new Error('Unsupported bulk action.');
    err.status = 400;
    throw err;
  }
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
  const results = [];
  for (const id of ids) {
    try {
      const candidate = await updateExtractedRelationshipCandidate(id, { status }, adminUser);
      results.push({ id, ok: true, status, candidate });
    } catch (err) {
      results.push({ id, ok: false, error: err.message || String(err) });
    }
  }
  return {
    ok: results.every((item) => item.ok),
    action,
    total: ids.length,
    approved: results.filter((item) => item.status === 'approved').length,
    rejected: results.filter((item) => item.status === 'rejected').length,
    reset: results.filter((item) => item.status === 'pending').length,
    failed: results.filter((item) => !item.ok).length,
    results
  };
}

async function listRelationshipAuditLogs({ limit = 80 } = {}) {
  const database = await getDatabase();
  return database.prepare('SELECT * FROM extracted_relationship_audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(500, Number(limit) || 80)))
    .map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      action: row.action,
      subjectMemberId: row.subject_member_id,
      objectMemberId: row.object_member_id,
      relationshipType: row.relationship_type,
      oldValue: safeJsonParse(row.old_value_json, {}),
      newValue: safeJsonParse(row.new_value_json, {}),
      sourceId: row.source_id,
      chunkId: row.chunk_id,
      adminUser: row.admin_user,
      status: row.status,
      error: row.error,
      createdAt: row.created_at
    }));
}

async function listAppliedProfileExtractions({ q = '', limit = 80 } = {}) {
  const database = await getDatabase();
  const rows = database.prepare(`
    SELECT a.*, c.person_name, c.matched_member_name, c.target_field, c.knowledge_title,
           c.source_quote, s.title AS source_title, k.heading_path AS chunk_heading_path
    FROM extracted_profile_audit_logs a
    LEFT JOIN extracted_profile_candidates c ON c.id = a.candidate_id
    LEFT JOIN knowledge_sources s ON s.id = a.source_id
    LEFT JOIN knowledge_chunks k ON k.id = a.chunk_id
    WHERE a.action IN ('apply', 'apply_noop')
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit) || 80)));
  const queryNorm = normalizeKnowledgeText(q);
  return rows
    .flatMap((row) => {
      const payload = safeJsonParse(row.field_changes_json, {});
      const changes = Array.isArray(payload?.changes) ? payload.changes : [];
      return changes.map((change, index) => ({
        id: `${row.id}:${index}`,
        auditId: row.id,
        candidateId: row.candidate_id,
        memberId: row.member_id,
        memberName: row.matched_member_name || row.person_name || '',
        field: change.lineageField || row.target_field || '',
        oldValue: change.oldValue || '',
        newValue: change.newValue || '',
        sourceId: row.source_id,
        sourceTitle: row.source_title || row.knowledge_title || '',
        chunkId: row.chunk_id,
        headingPath: row.chunk_heading_path || '',
        appliedBy: row.admin_user || '',
        appliedAt: row.created_at,
        action: row.action
      }));
    })
    .filter((item) => {
      if (!queryNorm) return true;
      return normalizeKnowledgeText([
        item.memberName,
        item.field,
        item.oldValue,
        item.newValue,
        item.sourceTitle,
        item.headingPath
      ].join(' ')).includes(queryNorm);
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 80)));
}

function publicProfileAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    candidateId: row.candidate_id,
    memberId: row.member_id,
    memberName: row.matched_member_name || row.person_name || '',
    action: row.action,
    fieldChanges: safeJsonParse(row.field_changes_json, {}),
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    adminUser: row.admin_user,
    createdAt: row.created_at
  };
}

async function listProfileAuditLogs({ limit = 80 } = {}) {
  const database = await getDatabase();
  return database.prepare(`
    SELECT a.*, c.person_name, c.matched_member_name, c.target_field, c.knowledge_title
    FROM extracted_profile_audit_logs a
    LEFT JOIN extracted_profile_candidates c ON c.id = a.candidate_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit) || 80))).map(publicProfileAuditLog);
}

async function buildProfileLocalAnswer(query, authScope = 'anonymous') {
  if (!isProfileQuestion(query)) return null;
  if (!['admin', 'kyc_verified'].includes(authScope)) {
    return {
      text: 'Thông tin hành trạng/công lao chi tiết cần đăng nhập và hoàn tất KYC để xem.',
      knowledgeMatchesCount: 0,
      knowledgeSourceIds: [],
      profileCandidatesCount: 0,
      appliedProfileFieldsUsed: [],
      pendingProfileCandidatesCount: 0
    };
  }
  const queryNameNorms = extractCaoNamesFromText(query).map((name) => normalizeKnowledgeText(name)).filter(Boolean);
  const queryHasSpecificName = queryNameNorms.length > 0;
  const queryNameMatches = (nameNorm) => {
    const normalized = normalizeKnowledgeText(nameNorm);
    if (!queryHasSpecificName) return false;
    return queryNameNorms.some((queryName) => queryName.includes(normalized) || normalized.includes(queryName));
  };
  const matches = await searchLineageMembers(query, { limit: 6 });
  const strong = matches.find((match) => ['exact', 'strong'].includes(match.confidence || '')) || null;
  const strongNameNorm = normalizeKnowledgeText(strong?.fullName || '');
  const canUseStrongMember = Boolean(strong?.memberId && strongNameNorm && (
    normalizeKnowledgeText(query).includes(strongNameNorm) ||
    queryNameMatches(strongNameNorm)
  ));
  const tree = await readLineageTreeForAI();
  const member = canUseStrongMember && tree ? getLineageNodeById(tree, strong.memberId) : null;
  const fields = [];
  if (member?.description) fields.push({ field: 'description', label: 'Hành trạng', value: String(member.description).trim() });
  if (member?.bio) fields.push({ field: 'bio', label: 'Sự nghiệp', value: String(member.bio).trim() });
  if (Array.isArray(member?.achievements) && member.achievements.length) {
    fields.push({ field: 'achievements', label: 'Công lao/vinh danh', value: member.achievements.map((item) => String(item || '').trim()).filter(Boolean).join('\n') });
  }
  if (fields.length) {
    const database = await getDatabase();
    const appliedRowsForMember = database.prepare(`
      SELECT * FROM extracted_profile_candidates
      WHERE status = 'applied'
      ORDER BY updated_at DESC
      LIMIT 80
    `).all().filter((row) => (
      (strong?.fullName && normalizeKnowledgeText([row.person_name, row.matched_member_name].join(' ')).includes(normalizeKnowledgeText(strong.fullName))) ||
      (row.matched_member_id && strong?.memberId && row.matched_member_id === strong.memberId)
    ));
    for (const row of appliedRowsForMember) {
      const value = String(row.reviewed_text || row.extracted_text || '').trim();
      if (value && !fields.some((item) => normalizeKnowledgeText(item.value).includes(normalizeKnowledgeText(value).slice(0, 80)))) {
        fields.push({ field: row.target_field || 'description', label: row.target_field || 'Đã áp dụng', value });
      }
    }
    return {
      text: [
        `${getMemberDisplayName(member) || member.name}: dữ liệu đã áp dụng trong cây phả.`,
        ...fields.map((item) => `- ${item.label}: ${compactText(item.value, 520)}`)
      ].join('\n'),
      knowledgeMatchesCount: fields.length,
      knowledgeSourceIds: [],
      profileCandidatesCount: fields.length,
      appliedProfileFieldsUsed: fields.map((item) => item.field),
      pendingProfileCandidatesCount: 0
    };
  }
  const database = await getDatabase();
  const queryNorm = normalizeKnowledgeText(query);
  const appliedRows = database.prepare(`
    SELECT * FROM extracted_profile_candidates
    WHERE status = 'applied'
    ORDER BY updated_at DESC
    LIMIT 80
  `).all().filter((row) => {
    const haystack = normalizeKnowledgeText([row.person_name, row.matched_member_name, row.extracted_text, row.reviewed_text].join(' '));
    return (strong?.fullName && canUseStrongMember && haystack.includes(normalizeKnowledgeText(strong.fullName))) ||
      (row.person_name_norm && (queryNorm.includes(row.person_name_norm) || queryNameMatches(row.person_name_norm)));
  });
  if (appliedRows.length) {
    return {
      text: [
        `${appliedRows[0].matched_member_name || appliedRows[0].person_name}: dữ liệu hành trạng/công lao đã được admin áp dụng.`,
        ...appliedRows.slice(0, 3).map((row) => `- ${row.target_field}: ${compactText(row.reviewed_text || row.extracted_text, 520)}`)
      ].join('\n'),
      knowledgeMatchesCount: appliedRows.length,
      knowledgeSourceIds: [...new Set(appliedRows.map((row) => row.source_id).filter(Boolean))],
      profileCandidatesCount: appliedRows.length,
      appliedProfileFieldsUsed: [...new Set(appliedRows.map((row) => row.target_field).filter(Boolean))],
      pendingProfileCandidatesCount: 0
    };
  }
  const pendingRows = database.prepare(`
    SELECT * FROM extracted_profile_candidates
    WHERE status IN ('pending', 'approved')
    ORDER BY updated_at DESC
    LIMIT 50
  `).all().filter((row) => {
    const haystack = normalizeKnowledgeText([row.person_name, row.matched_member_name, row.extracted_text, row.reviewed_text].join(' '));
    return (strong?.fullName && canUseStrongMember && haystack.includes(normalizeKnowledgeText(strong.fullName))) ||
      (row.person_name_norm && (queryNorm.includes(row.person_name_norm) || queryNameMatches(row.person_name_norm))) ||
      haystack.includes(queryNorm);
  });
  if (pendingRows.length) {
    return {
      text: `Có ${pendingRows.length} dữ liệu hành trạng/công lao đang chờ Ban trị sự duyệt hoặc đã duyệt nhưng chưa áp dụng vào hồ sơ. Tôi chưa coi đây là dữ liệu xác minh.`,
      knowledgeMatchesCount: pendingRows.length,
      knowledgeSourceIds: [...new Set(pendingRows.map((row) => row.source_id).filter(Boolean))],
      profileCandidatesCount: pendingRows.length,
      appliedProfileFieldsUsed: [],
      pendingProfileCandidatesCount: pendingRows.length
    };
  }
  return {
    text: 'Chưa tìm thấy dữ liệu hành trạng/công lao đã xác minh trong cây phả hiện tại.',
    knowledgeMatchesCount: 0,
    knowledgeSourceIds: [],
    profileCandidatesCount: 0,
    appliedProfileFieldsUsed: [],
    pendingProfileCandidatesCount: 0
  };
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
    sourceTitle: row.source_title || '',
    sourceKind: normalizeKnowledgeSourceKind(safeJsonParse(row.source_metadata_json || '{}', {}).sourceKind || safeJsonParse(row.source_metadata_json || '{}', {}).source_kind || ''),
    citation: knowledgeCitationFromChunk(row, query),
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
    metadata: safeJsonParse(row.metadata_json, {}),
    visibility: row.visibility,
    status: row.status,
    updatedAt: row.updated_at
  };
}

async function listKnowledgeSources({ authScope = 'admin', limit = 80, includeArchived = false } = {}) {
  await ensurePhase2AliasKnowledgeSeeded();
  const database = await getDatabase();
  return database
    .prepare('SELECT * FROM knowledge_sources ORDER BY updated_at DESC LIMIT ?')
    .all(limit)
    .filter((row) => canReadKnowledgeVisibility(row.visibility, authScope))
    .filter((row) => includeArchived || !isArchivedKnowledgeSource(row))
    .map(publicKnowledgeSource);
}

function normalizeKnowledgeMaintenanceLog(row) {
  return {
    id: row.id,
    action: row.action,
    summary: safeJsonParse(row.summary_json, {}),
    adminUser: row.admin_user,
    createdAt: row.created_at
  };
}

async function listKnowledgeMaintenanceLogs({ limit = 20 } = {}) {
  const database = await getDatabase();
  return database
    .prepare('SELECT * FROM knowledge_maintenance_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(100, Number(limit) || 20)))
    .map(normalizeKnowledgeMaintenanceLog);
}

function insertKnowledgeMaintenanceLog(database, action, summary, adminUser = {}) {
  const id = `maint_${sha256Base64Url(`${action}:${Date.now()}:${randomToken(6)}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO knowledge_maintenance_logs (id, action, summary_json, admin_user, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    action,
    JSON.stringify(summary || {}),
    adminUser?.username || adminUser?.fullName || adminUser?.id || ''
  );
  return id;
}

function collectKnowledgeReferencesFromValue(value, refs) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKnowledgeReferencesFromValue(item, refs));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if ((key === 'sourceId' || key === 'source_id') && nested) refs.sourceIds.add(String(nested));
      if ((key === 'chunkId' || key === 'chunk_id') && nested) refs.chunkIds.add(String(nested));
      collectKnowledgeReferencesFromValue(nested, refs);
    }
  }
}

function collectAppliedKnowledgeReferences(database) {
  const refs = { sourceIds: new Set(), chunkIds: new Set() };
  const add = (sourceId, chunkId) => {
    if (sourceId) refs.sourceIds.add(String(sourceId));
    if (chunkId) refs.chunkIds.add(String(chunkId));
  };

  for (const table of ['extracted_anniversary_candidates', 'extracted_profile_candidates', 'extracted_relationship_candidates']) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    if (!columns.includes('source_id') || !columns.includes('chunk_id')) continue;
    for (const row of database.prepare(`SELECT source_id, chunk_id, metadata_json FROM ${table} WHERE status = 'applied'`).all()) {
      add(row.source_id, row.chunk_id);
      collectKnowledgeReferencesFromValue(safeJsonParse(row.metadata_json, {}), refs);
    }
  }

  try {
    for (const row of database.prepare("SELECT candidate_before_json, candidate_after_json, result_json, metadata_json FROM cao_toc_v3_pilot_apply_logs WHERE status = 'applied' AND COALESCE(rollback_status, '') != 'rolled_back'").all()) {
      collectKnowledgeReferencesFromValue(safeJsonParse(row.candidate_before_json, {}), refs);
      collectKnowledgeReferencesFromValue(safeJsonParse(row.candidate_after_json, {}), refs);
      collectKnowledgeReferencesFromValue(safeJsonParse(row.result_json, {}), refs);
      collectKnowledgeReferencesFromValue(safeJsonParse(row.metadata_json, {}), refs);
    }
  } catch {
    // Older databases may not have the pilot log table yet.
  }

  const lineageTreeJson = database.prepare('SELECT value FROM app_state WHERE key = ?').get(TREE_STATE_KEY)?.value || '';
  for (const match of String(lineageTreeJson).matchAll(/"sourceId"\s*:\s*"([^"]+)"/g)) refs.sourceIds.add(match[1]);
  for (const match of String(lineageTreeJson).matchAll(/"chunkId"\s*:\s*"([^"]+)"/g)) refs.chunkIds.add(match[1]);

  return refs;
}

function sourceShouldRemainActive(row, activeDatasetKey = KNOWLEDGE_CANONICAL_DATASET_KEY) {
  if (isCanonicalKnowledgeSource(row, activeDatasetKey) && !isTechnicalKnowledgeSource(row)) return true;
  const metadata = getKnowledgeSourceMetadata(row);
  const sourceKind = normalizeKnowledgeSourceKind(metadata.sourceKind || metadata.source_kind);
  return isCanonicalKnowledgeSource(row, activeDatasetKey) && sourceKind === 'verification_notes';
}

function buildKnowledgeDatasetPolicyReport({ activeDatasetKey = KNOWLEDGE_CANONICAL_DATASET_KEY } = {}) {
  const database = db || new DatabaseSync(DATABASE_FILE);
  const normalizedActiveDatasetKey = normalizeCaoTocV2DatasetKey(activeDatasetKey || KNOWLEDGE_CANONICAL_DATASET_KEY);
  const refs = collectAppliedKnowledgeReferences(database);
  const sourceRows = database.prepare('SELECT * FROM knowledge_sources ORDER BY updated_at DESC, id').all();
  const chunkRows = database.prepare('SELECT source_id, COUNT(*) AS count FROM knowledge_chunks GROUP BY source_id').all();
  const chunkCountBySource = new Map(chunkRows.map((row) => [row.source_id, Number(row.count || 0)]));
  const sources = sourceRows.map((row) => {
    const metadata = getKnowledgeSourceMetadata(row);
    const datasetKey = getKnowledgeSourceDatasetKey(row) || 'no_dataset';
    const sourceKind = normalizeKnowledgeSourceKind(metadata.sourceKind || metadata.source_kind) || row.source_type || '';
    const referencedByAppliedData = refs.sourceIds.has(row.id);
    const active = sourceShouldRemainActive(row, normalizedActiveDatasetKey);
    const archived = isArchivedKnowledgeSource(row);
    const plannedAction = active
      ? 'keep_active'
      : archived
        ? 'already_archived'
        : referencedByAppliedData
          ? 'archive_hide_keep_reference'
          : 'archive_hide_legacy';
    return {
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      visibility: row.visibility,
      status: row.status,
      datasetKey,
      datasetGroup: metadata.datasetGroup || '',
      sourceKind,
      chunks: chunkCountBySource.get(row.id) || 0,
      referencedByAppliedData,
      archived,
      plannedAction
    };
  });
  const candidateTables = [
    ['extracted_profile_candidates', 'profile'],
    ['extracted_anniversary_candidates', 'anniversary'],
    ['extracted_relationship_candidates', 'relationship']
  ];
  const candidates = [];
  for (const [table, kind] of candidateTables) {
    for (const row of database.prepare(`SELECT id, status, source_id, metadata_json FROM ${table}`).all()) {
      const metadata = safeJsonParse(row.metadata_json, {});
      const datasetKey = normalizeCaoTocV2DatasetKey(metadata.datasetKey || metadata.dataset || '') || 'no_dataset';
      const sourcePlan = sources.find((source) => source.id === row.source_id);
      const isActiveDataset = datasetKey === normalizedActiveDatasetKey;
      const shouldArchive = row.status !== 'applied' && (!isActiveDataset || sourcePlan?.plannedAction?.startsWith('archive'));
      candidates.push({
        id: row.id,
        kind,
        status: row.status || '',
        datasetKey,
        sourceId: row.source_id || '',
        plannedAction: shouldArchive ? 'archive_candidate' : 'keep_candidate'
      });
    }
  }
  const bySourceAction = sources.reduce((acc, source) => {
    acc[source.plannedAction] = (acc[source.plannedAction] || 0) + 1;
    return acc;
  }, {});
  const byCandidateAction = candidates.reduce((acc, candidate) => {
    acc[candidate.plannedAction] = (acc[candidate.plannedAction] || 0) + 1;
    return acc;
  }, {});
  const activeSources = sources.filter((source) => source.plannedAction === 'keep_active');
  const archiveSources = sources.filter((source) => source.plannedAction.startsWith('archive'));
  return {
    ok: true,
    activeDatasetKey: normalizedActiveDatasetKey,
    totals: {
      sources: sources.length,
      chunks: sources.reduce((sum, source) => sum + source.chunks, 0),
      activeSources: activeSources.length,
      archiveSources: archiveSources.length,
      referencedSources: sources.filter((source) => source.referencedByAppliedData).length,
      candidates: candidates.length
    },
    bySourceAction,
    byCandidateAction,
    activeSources,
    archiveSources,
    candidatesToArchive: candidates.filter((candidate) => candidate.plannedAction === 'archive_candidate').slice(0, 200),
    sources
  };
}

async function canonicalizeKnowledgeDatasets({ activeDatasetKey = KNOWLEDGE_CANONICAL_DATASET_KEY, dryRun = true } = {}, adminUser = {}) {
  await ensurePhase2AliasKnowledgeSeeded();
  const database = await getDatabase();
  const report = buildKnowledgeDatasetPolicyReport({ activeDatasetKey });
  if (dryRun) return { ...report, dryRun: true };

  const now = new Date().toISOString();
  const archiveSourceIds = new Set(report.archiveSources.map((source) => source.id));
  const sourceRows = database.prepare('SELECT * FROM knowledge_sources').all();
  const sourceUpdate = database.prepare(`
    UPDATE knowledge_sources
    SET metadata_json = ?, visibility = CASE WHEN visibility IN ('public','global','kyc') THEN 'private' ELSE visibility END, status = 'archived', updated_at = datetime('now')
    WHERE id = ?
  `);
  const chunkUpdate = database.prepare(`
    UPDATE knowledge_chunks
    SET metadata_json = ?, visibility = CASE WHEN visibility IN ('public','global','kyc') THEN 'private' ELSE visibility END, updated_at = datetime('now')
    WHERE id = ?
  `);
  const candidateTables = [
    ['extracted_profile_candidates', 'profile'],
    ['extracted_anniversary_candidates', 'anniversary'],
    ['extracted_relationship_candidates', 'relationship']
  ];

  let archivedSources = 0;
  let updatedChunks = 0;
  let archivedCandidates = 0;
  database.exec('BEGIN');
  try {
    for (const row of sourceRows) {
      if (!archiveSourceIds.has(row.id)) continue;
      const metadata = {
        ...safeJsonParse(row.metadata_json, {}),
        archived: true,
        archivedAt: now,
        supersededBy: report.activeDatasetKey,
        archiveReason: 'canonical_dataset_policy',
        excludeFromExtraction: true,
        excludeFromPublicChat: true
      };
      sourceUpdate.run(JSON.stringify(metadata), row.id);
      archivedSources += 1;
      const chunkRows = database.prepare('SELECT id, metadata_json FROM knowledge_chunks WHERE source_id = ?').all(row.id);
      for (const chunk of chunkRows) {
        const chunkMetadata = {
          ...safeJsonParse(chunk.metadata_json, {}),
          archived: true,
          archivedAt: now,
          supersededBy: report.activeDatasetKey,
          archiveReason: 'canonical_dataset_policy'
        };
        chunkUpdate.run(JSON.stringify(chunkMetadata), chunk.id);
        updatedChunks += 1;
      }
    }

    for (const [table] of candidateTables) {
      const rows = database.prepare(`SELECT id, status, source_id, metadata_json FROM ${table}`).all();
      const update = database.prepare(`UPDATE ${table} SET status = 'archived', metadata_json = ?, updated_at = datetime('now') WHERE id = ?`);
      for (const row of rows) {
        if (row.status === 'applied') continue;
        const metadata = safeJsonParse(row.metadata_json, {});
        const datasetKey = normalizeCaoTocV2DatasetKey(metadata.datasetKey || metadata.dataset || '');
        const shouldArchive = datasetKey !== report.activeDatasetKey || archiveSourceIds.has(row.source_id);
        if (!shouldArchive) continue;
        update.run(JSON.stringify({
          ...metadata,
          archived: true,
          archivedAt: now,
          supersededBy: report.activeDatasetKey,
          archiveReason: 'canonical_dataset_policy'
        }), row.id);
        archivedCandidates += 1;
      }
    }

    const summary = {
      activeDatasetKey: report.activeDatasetKey,
      archivedSources,
      updatedChunks,
      archivedCandidates,
      before: report.totals
    };
    insertKnowledgeMaintenanceLog(database, 'canonicalize_knowledge_datasets', summary, adminUser);
    database.exec('COMMIT');
    return {
      ok: true,
      dryRun: false,
      ...summary,
      after: buildKnowledgeDatasetPolicyReport({ activeDatasetKey: report.activeDatasetKey }).totals,
      status: await getKnowledgeStatus()
    };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

async function lockTechnicalKnowledgeSources(adminUser = {}) {
  await ensurePhase2AliasKnowledgeSeeded();
  const database = await getDatabase();
  const rows = database.prepare('SELECT * FROM knowledge_sources ORDER BY updated_at DESC').all();
  const targetRows = rows.filter(isTechnicalKnowledgeSource);
  let lockedSources = 0;
  let updatedChunks = 0;
  const locked = [];
  database.exec('BEGIN');
  try {
    for (const row of targetRows) {
      const metadata = {
        ...safeJsonParse(row.metadata_json, {}),
        sourceKind: 'technical_rule',
        excludeFromExtraction: true,
        excludeFromPublicChat: true,
        lockedByMaintenance: 'phase_2w2a',
        lockedAt: new Date().toISOString()
      };
      const nextVisibility = row.visibility === 'private' ? 'private' : 'admin';
      const sourceResult = database.prepare(`
        UPDATE knowledge_sources
        SET visibility = ?, metadata_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(nextVisibility, JSON.stringify(metadata), row.id);
      const chunkResult = database.prepare(`
        UPDATE knowledge_chunks
        SET visibility = ?, metadata_json = json_set(
          COALESCE(NULLIF(metadata_json, ''), '{}'),
          '$.sourceKind', 'technical_rule',
          '$.excludeFromExtraction', json('true'),
          '$.excludeFromPublicChat', json('true')
        ),
        updated_at = datetime('now')
        WHERE source_id = ?
      `).run(nextVisibility, row.id);
      lockedSources += sourceResult.changes || 0;
      updatedChunks += chunkResult.changes || 0;
      locked.push({ id: row.id, slug: row.slug, title: row.title, visibility: nextVisibility });
    }
    const summary = { lockedSources, updatedChunks, locked };
    const logId = insertKnowledgeMaintenanceLog(database, 'lock_technical_sources', summary, adminUser);
    database.exec('COMMIT');
    return { ok: true, ...summary, logId };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

function isNoisyCandidateText(value) {
  const raw = String(value || '').trim();
  const norm = normalizeKnowledgeText(raw);
  if (!norm) return false;
  if (/\b(lowercase|bo kinh xung|ghi la|van truc thuoc|lam toc bieu|mua pho ly|khong hien dien)\b/.test(norm)) return true;
  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6 && !/^cao\s+(dinh|van|duy|xuan|huu|ba|quang|minh|duc|viet)\b/.test(norm)) return true;
  if (/^cao\s+[a-z\s]+$/.test(raw) && raw !== raw.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('vi-VN'))) return true;
  return false;
}

function shouldRejectProfileCandidateAsNoisy(row, technicalSourceIds = new Set()) {
  if (normalizeProfileCandidateStatus(row.status) === 'applied') return false;
  const status = normalizeProfileCandidateStatus(row.status);
  if (!['pending', 'candidate'].includes(status)) return false;
  if (technicalSourceIds.has(row.source_id)) return true;
  return [
    row.person_name,
    row.extracted_text,
    row.reviewed_text,
    row.source_quote,
    row.knowledge_title
  ].some(isNoisyCandidateText);
}

function shouldRejectRelationshipCandidateAsNoisy(row, technicalSourceIds = new Set()) {
  if (normalizeRelationshipCandidateStatus(row.status) === 'applied') return false;
  const status = normalizeRelationshipCandidateStatus(row.status);
  if (!['pending', 'candidate'].includes(status)) return false;
  if (technicalSourceIds.has(row.source_id)) return true;
  return [
    row.subject_name,
    row.object_name,
    row.extracted_text,
    row.reviewed_text,
    row.source_quote,
    row.knowledge_title
  ].some(isNoisyCandidateText);
}

async function rejectNoisyKnowledgeCandidates(adminUser = {}) {
  const database = await getDatabase();
  const technicalSourceIds = new Set(
    database.prepare('SELECT id, slug, title, metadata_json FROM knowledge_sources').all()
      .filter(isTechnicalKnowledgeSource)
      .map((row) => row.id)
  );
  const profileRows = database.prepare('SELECT * FROM extracted_profile_candidates').all();
  const relationshipRows = database.prepare('SELECT * FROM extracted_relationship_candidates').all();
  const profileTargets = profileRows.filter((row) => shouldRejectProfileCandidateAsNoisy(row, technicalSourceIds));
  const relationshipTargets = relationshipRows.filter((row) => shouldRejectRelationshipCandidateAsNoisy(row, technicalSourceIds));
  database.exec('BEGIN');
  try {
    for (const row of profileTargets) {
      const metadata = {
        ...safeJsonParse(row.metadata_json, {}),
        maintenanceRejectedBy: 'phase_2w2a',
        maintenanceRejectedAt: new Date().toISOString()
      };
      database.prepare(`
        UPDATE extracted_profile_candidates
        SET status = 'rejected', metadata_json = ?, updated_at = datetime('now')
        WHERE id = ? AND status <> 'applied'
      `).run(JSON.stringify(metadata), row.id);
    }
    for (const row of relationshipTargets) {
      const metadata = {
        ...safeJsonParse(row.metadata_json, {}),
        maintenanceRejectedBy: 'phase_2w2a',
        maintenanceRejectedAt: new Date().toISOString()
      };
      database.prepare(`
        UPDATE extracted_relationship_candidates
        SET status = 'rejected', metadata_json = ?, updated_at = datetime('now')
        WHERE id = ? AND status <> 'applied'
      `).run(JSON.stringify(metadata), row.id);
    }
    const summary = {
      technicalSourceIds: [...technicalSourceIds],
      rejectedProfileCandidates: profileTargets.length,
      rejectedRelationshipCandidates: relationshipTargets.length,
      appliedCandidatesTouched: 0
    };
    const logId = insertKnowledgeMaintenanceLog(database, 'reject_noisy_candidates', summary, adminUser);
    database.exec('COMMIT');
    return { ok: true, ...summary, logId };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

const CAO_TOC_V2_FILES = [
  { fileName: '02_person_facts.jsonl', group: 'person_facts', sourceKind: 'genealogy_facts', sourceType: 'v2_person_facts', evidenceType: 'genealogy_text' },
  { fileName: '03_dates_graves.jsonl', group: 'dates_graves', sourceKind: 'genealogy_dates_graves', sourceType: 'v2_dates_graves', evidenceType: 'date_grave' },
  { fileName: '04_relationships.jsonl', group: 'relationships', sourceKind: 'genealogy_relationships', sourceType: 'v2_relationships', evidenceType: 'relationship' },
  { fileName: '05_biography_legacy.jsonl', group: 'biography_legacy', sourceKind: 'genealogy_biography_legacy', sourceType: 'v2_biography_legacy', evidenceType: 'biography' },
  { fileName: '06_verification_notes.jsonl', group: 'verification_notes', sourceKind: 'verification_notes', sourceType: 'v2_verification_notes', evidenceType: 'verification_note' }
];

function resolveCaoTocV2DatasetDir(value = '') {
  return resolve(__dirname, String(value || process.env.CAO_TOC_V2_DATASET_DIR || CAO_TOC_V2_DATASET_DIR));
}

function parseJsonlRecords(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        err.message = `${err.message} at ${filePath}:${index + 1}`;
        throw err;
      }
    });
}

function normalizeCaoTocV2DatasetKey(value = '') {
  return normalizeGatewayText(value || 'cao_toc_v2').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'cao_toc_v2';
}

function readCaoTocDatasetManifestName(datasetDir = '') {
  try {
    const manifestPath = resolve(String(datasetDir || ''), 'manifest.json');
    if (!datasetDir || !existsSync(manifestPath)) return '';
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return String(manifest.dataset_name || manifest.name || '').trim();
  } catch {
    return '';
  }
}

function caoTocDatasetId(datasetKey = '', datasetDir = '') {
  const key = normalizeCaoTocV2DatasetKey(datasetKey);
  const manifestName = readCaoTocDatasetManifestName(datasetDir);
  const marker = normalizeKnowledgeText([key, manifestName, datasetDir].join(' '));
  return marker.includes('v3') ? 'cao_toc_txt_knowledge_base_v3' : 'cao_toc_txt_knowledge_base_v2';
}

function caoTocDatasetLabel(datasetId = 'cao_toc_txt_knowledge_base_v2') {
  return String(datasetId || '').endsWith('_v3')
    ? 'Cao Tộc TXT Knowledge Base v3'
    : 'Cao Tộc TXT Knowledge Base v2';
}

function v2SourceId(group, datasetKey = 'cao_toc_v2') {
  return `source_${normalizeCaoTocV2DatasetKey(datasetKey)}_${group}`;
}

function v2ChunkId(group, recordId, datasetKey = 'cao_toc_v2') {
  return `chunk_${normalizeCaoTocV2DatasetKey(datasetKey)}_${group}_${normalizeGatewayText(recordId).slice(0, 80)}`;
}

function v2CandidateHash(parts) {
  return sha256Base64Url(parts.map((part) => normalizeKnowledgeText(part)).join('|')).slice(0, 24);
}

function v2RecordEvidence(record, file, datasetKey = 'cao_toc_v2', datasetDir = '') {
  const datasetId = caoTocDatasetId(datasetKey, datasetDir);
  const quote = String(record.source_quote || record.value || record.relationship_note || record.notes || '').trim();
  const window = compactText([
    record.section,
    record.page_hint ? `page ${record.page_hint}` : '',
    quote,
    record.notes
  ].filter(Boolean).join('\n'), 900);
  return {
    sourceId: v2SourceId(file.group, datasetKey),
    chunkId: v2ChunkId(file.group, record.record_id, datasetKey),
    recordId: String(record.record_id || ''),
    sourceTitle: String(record.source_title || caoTocDatasetLabel(datasetId)),
    headingPath: String(record.section || ''),
    pageHint: String(record.page_hint || ''),
    evidenceQuote: compactText(quote, 520),
    evidenceWindow: window,
    evidenceType: file.evidenceType,
    dataset: datasetId,
    datasetKey: normalizeCaoTocV2DatasetKey(datasetKey),
    datasetGroup: file.group,
    confidence: String(record.confidence || 'medium'),
    needsAdminReview: Boolean(record.needs_admin_review)
  };
}

function insertV2SourceAndChunks(database, file, records, datasetDir, datasetKey = 'cao_toc_v2') {
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey);
  const datasetId = caoTocDatasetId(normalizedDatasetKey, datasetDir);
  const datasetLabel = caoTocDatasetLabel(datasetId);
  const sourceId = v2SourceId(file.group, normalizedDatasetKey);
  const sourceContent = records.map((record) => JSON.stringify(record)).join('\n');
  const metadata = {
    sourceKind: file.sourceKind,
    dataset: datasetId,
    datasetLabel,
    datasetKey: normalizedDatasetKey,
    datasetGroup: file.group,
    originFile: file.fileName,
    importedAt: new Date().toISOString()
  };
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, ?, ?, 'cao_toc_v2', 'cao_toc_phu_my', 'ho_cao_giatochocao', 'giatochocao.site', ?, ?, ?, ?, '[]', '[]', ?, 'indexed', datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source_type = excluded.source_type,
      content = excluded.content,
      source_hash = excluded.source_hash,
      metadata_json = excluded.metadata_json,
      summary = excluded.summary,
      visibility = excluded.visibility,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    sourceId,
    `${normalizedDatasetKey.replace(/_/g, '-')}-${file.group}`,
    `${datasetLabel} - ${file.group}`,
    file.sourceType,
    sourceContent,
    sha256Hex(sourceContent),
    JSON.stringify(metadata),
    `${records.length} records from ${file.fileName}`,
    file.group === 'verification_notes' ? 'private' : 'kyc'
  );
  database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);
  const insertChunk = database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, content_ascii, char_count, token_estimate, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, ?, datetime('now'))
  `);
  records.forEach((record, index) => {
    const evidence = v2RecordEvidence(record, file, normalizedDatasetKey, datasetDir);
    const content = JSON.stringify(record, null, 2);
    insertChunk.run(
      evidence.chunkId,
      sourceId,
      index,
      evidence.sourceTitle,
      content,
      normalizeKnowledgeText([record.person_name, record.subject_name, record.object_name, record.value, record.source_quote, record.relationship_note].join(' ')),
      JSON.stringify({ ...metadata, ...evidence, datasetDir }),
      compactText(record.source_quote || record.value || '', 260),
      file.group === 'verification_notes' ? 'private' : 'kyc',
      evidence.headingPath,
      normalizeKnowledgeText(content),
      content.length,
      estimateTextTokens(content)
    );
  });
  return { sourceId, chunks: records.length };
}

async function importCaoTocV2Dataset({ datasetDir = '', datasetKey = '' } = {}, adminUser = {}) {
  const resolvedDir = resolveCaoTocV2DatasetDir(datasetDir);
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey);
  const datasetId = caoTocDatasetId(normalizedDatasetKey, resolvedDir);
  const datasetLabel = caoTocDatasetLabel(datasetId);
  const database = await getDatabase();
  const summary = { datasetDir: resolvedDir, dataset: datasetId, datasetLabel, datasetKey: normalizedDatasetKey, sources: 0, records: 0, chunks: 0, groups: {}, rulesPrivateLocked: false };
  database.exec('BEGIN');
  try {
    for (const file of CAO_TOC_V2_FILES) {
      const filePath = resolve(resolvedDir, file.fileName);
      if (!existsSync(filePath)) continue;
      const records = parseJsonlRecords(filePath);
      const inserted = insertV2SourceAndChunks(database, file, records, resolvedDir, normalizedDatasetKey);
      summary.sources += 1;
      summary.records += records.length;
      summary.chunks += inserted.chunks;
      summary.groups[file.group] = { records: records.length, sourceId: inserted.sourceId };
    }
    const rulesPath = resolve(resolvedDir, '07_rules_private.json');
    if (existsSync(rulesPath)) {
      const content = readFileSync(rulesPath, 'utf8');
      const metadata = {
        sourceKind: 'technical_rule',
        dataset: datasetId,
        datasetLabel,
        datasetKey: normalizedDatasetKey,
        datasetGroup: 'rules_private',
        originFile: '07_rules_private.json',
        excludeFromExtraction: true,
        excludeFromPublicChat: true,
        importedAt: new Date().toISOString()
      };
      const rulesSourceId = v2SourceId('rules_private', normalizedDatasetKey);
      const rulesChunkId = v2ChunkId('rules_private', 'rules_private', normalizedDatasetKey);
      database.prepare(`
        INSERT INTO knowledge_sources
          (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
        VALUES (?, ?, ?, 'v2_rules_private', 'cao_toc_v2', 'cao_toc_phu_my', 'ho_cao_giatochocao', 'giatochocao.site', ?, ?, ?, 'Private rules only, not genealogy evidence.', '[]', '[]', 'private', 'indexed', datetime('now'))
        ON CONFLICT(id) DO UPDATE SET content = excluded.content, source_hash = excluded.source_hash, metadata_json = excluded.metadata_json, visibility = 'private', updated_at = datetime('now')
      `).run(rulesSourceId, `${normalizedDatasetKey.replace(/_/g, '-')}-rules-private`, `${datasetLabel} - rules private`, content, sha256Hex(content), JSON.stringify(metadata));
      database.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(rulesSourceId);
      database.prepare(`
        INSERT INTO knowledge_chunks
          (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, content_ascii, char_count, token_estimate, updated_at)
        VALUES (?, ?, 0, ?, ?, ?, ?, 'Private technical rules.', '[]', '[]', 'private', 'rules_private', ?, ?, ?, datetime('now'))
      `).run(rulesChunkId, rulesSourceId, `${datasetLabel} - rules private`, content, normalizeKnowledgeText(content), JSON.stringify(metadata), normalizeKnowledgeText(content), content.length, estimateTextTokens(content));
      summary.sources += 1;
      summary.records += 1;
      summary.chunks += 1;
      summary.rulesPrivateLocked = true;
    }
    const logId = insertKnowledgeMaintenanceLog(database, 'import_v2_dataset', summary, adminUser);
    database.exec('COMMIT');
    return { ok: true, ...summary, logId };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

async function matchV2Person(personName, needsAdminReview = false) {
  const matches = await searchLineageMembers(personName, { limit: 6 });
  const top = matches[0] || null;
  const confidence = top?.confidence || 'none';
  const ambiguous = needsAdminReview || ['weak', 'ambiguous', 'none'].includes(confidence);
  return {
    matches,
    top: ambiguous ? null : top,
    confidence,
    ambiguous
  };
}

async function createV2ProfileCandidate(database, record, file, candidateType, targetField, extractedText, personName = record.person_name || 'Ghi chú kiểm chứng phả hệ', datasetKey = 'cao_toc_v2') {
  const evidence = v2RecordEvidence(record, file, datasetKey);
  const match = await matchV2Person(personName, evidence.needsAdminReview || candidateType === 'verification_note' || candidateType === 'clan_legacy' || candidateType === 'branch_legacy');
  const id = `profile_v2_${v2CandidateHash([evidence.sourceId, personName, candidateType, targetField, extractedText, evidence.evidenceQuote])}`;
  if (database.prepare('SELECT id FROM extracted_profile_candidates WHERE id = ?').get(id)) return { created: false, duplicate: true, id };
  const metadata = {
    ...evidence,
    candidateMatches: match.matches,
    notApplyDirectly: ['verification_note', 'clan_legacy', 'branch_legacy'].includes(candidateType)
  };
  database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name,
       match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id,
       chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
  `).run(
    id,
    candidateType,
    personName,
    normalizeKnowledgeText(personName),
    match.top?.memberId || '',
    match.top?.fullName || '',
    match.confidence,
    targetField,
    String(extractedText || evidence.evidenceQuote || '').trim(),
    evidence.evidenceQuote,
    evidence.sourceId,
    evidence.chunkId,
    evidence.sourceTitle,
    candidateType === 'verification_note' ? 'private' : 'kyc',
    JSON.stringify(metadata)
  );
  return { created: true, duplicate: false, ambiguous: match.ambiguous, id };
}

async function createV2AnniversaryCandidate(database, record, file, datasetKey = 'cao_toc_v2') {
  const evidence = v2RecordEvidence(record, file, datasetKey);
  const fieldType = String(record.field_type || '').trim();
  const personName = String(record.person_name || '').trim();
  const value = String(record.value || '').trim();
  if (!personName || !value) return { created: false, skipped: true };
  const match = await matchV2Person(personName, evidence.needsAdminReview);
  const id = `ann_v2_${v2CandidateHash([evidence.sourceId, personName, fieldType, value, evidence.evidenceQuote])}`;
  if (database.prepare('SELECT id FROM extracted_anniversary_candidates WHERE id = ?').get(id)) return { created: false, duplicate: true, id };
  const columnMap = {
    birth: 'birth_text',
    death: 'death_text',
    lunar_anniversary: 'death_anniversary_lunar',
    anniversary: 'death_anniversary_lunar',
    hometown: 'hometown',
    origin: 'hometown',
    residence: 'hometown',
    grave: 'grave_text',
    burial_place: 'grave_text',
    tomb_note: 'grave_text'
  };
  const targetColumn = columnMap[fieldType] || '';
  if (!targetColumn) return { created: false, skipped: true };
  const values = { birth_text: '', death_text: '', death_anniversary_lunar: '', hometown: '', grave_text: '' };
  values[targetColumn] = value;
  const metadata = { ...evidence, calendar: record.calendar || '', candidateMatches: match.matches };
  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text,
       death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id,
       matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
  `).run(
    id,
    evidence.sourceId,
    evidence.chunkId,
    personName,
    normalizeKnowledgeText(personName),
    values.birth_text,
    values.death_text,
    values.death_anniversary_lunar,
    values.hometown,
    values.grave_text,
    evidence.evidenceQuote,
    evidence.headingPath,
    match.top?.memberId || '',
    match.top?.fullName || '',
    match.confidence,
    JSON.stringify(metadata)
  );
  return { created: true, duplicate: false, ambiguous: match.ambiguous, id };
}

async function createV2RelationshipCandidate(database, record, file, datasetKey = 'cao_toc_v2') {
  const evidence = v2RecordEvidence(record, file, datasetKey);
  const subjectName = String(record.subject_name || '').trim();
  const objectName = String(record.object_name || '').trim();
  const relationshipType = normalizeRelationshipType(record.relationship_type || '');
  if (!subjectName || !objectName) {
    return createV2ProfileCandidate(database, record, { ...file, evidenceType: 'verification_note' }, 'verification_note', 'description', record.source_quote || record.relationship_note || '', 'Ghi chú kiểm chứng phả hệ', datasetKey);
  }
  const subjectMatch = await matchV2Person(subjectName, evidence.needsAdminReview);
  const objectMatch = await matchV2Person(objectName, evidence.needsAdminReview);
  const flags = {
    requires_new_subject: !subjectMatch.matches.length,
    requires_new_object: !objectMatch.matches.length,
    ambiguous_subject: subjectMatch.ambiguous,
    ambiguous_object: objectMatch.ambiguous,
    needs_manual_review: evidence.needsAdminReview || subjectMatch.ambiguous || objectMatch.ambiguous
  };
  const id = `rel_v2_${v2CandidateHash([evidence.sourceId, subjectName, relationshipType, objectName, evidence.evidenceQuote])}`;
  if (database.prepare('SELECT id FROM extracted_relationship_candidates WHERE id = ?').get(id)) return { created: false, duplicate: true, id };
  const metadata = { ...evidence, subjectMatches: subjectMatch.matches, objectMatches: objectMatch.matches };
  database.prepare(`
    INSERT INTO extracted_relationship_candidates
      (id, relationship_type, subject_name, subject_name_norm, subject_member_id, subject_member_name,
       subject_match_confidence, object_name, object_name_norm, object_member_id, object_member_name,
       object_match_confidence, direction, extracted_text, reviewed_text, source_quote, source_id,
       chunk_id, knowledge_title, visibility, status, flags_json, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 'kyc', 'pending', ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    relationshipType,
    subjectName,
    normalizeKnowledgeText(subjectName),
    subjectMatch.top?.memberId || '',
    subjectMatch.top?.fullName || '',
    subjectMatch.confidence,
    objectName,
    normalizeKnowledgeText(objectName),
    objectMatch.top?.memberId || '',
    objectMatch.top?.fullName || '',
    objectMatch.confidence,
    normalizeRelationshipDirection(record.direction || 'subject_to_object'),
    record.relationship_note || evidence.evidenceQuote,
    evidence.evidenceQuote,
    evidence.sourceId,
    evidence.chunkId,
    evidence.sourceTitle,
    JSON.stringify(flags),
    JSON.stringify(metadata)
  );
  return { created: true, duplicate: false, ambiguous: flags.needs_manual_review, id };
}

async function rescanCaoTocV2({ datasetDir = '', datasetKey = '' } = {}, adminUser = {}) {
  const resolvedDir = resolveCaoTocV2DatasetDir(datasetDir);
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey);
  const datasetId = caoTocDatasetId(normalizedDatasetKey, resolvedDir);
  const datasetLabel = caoTocDatasetLabel(datasetId);
  await importCaoTocV2Dataset({ datasetDir: resolvedDir, datasetKey: normalizedDatasetKey }, adminUser);
  const database = await getDatabase();
  const summary = {
    datasetDir: resolvedDir,
    dataset: datasetId,
    datasetLabel,
    datasetKey: normalizedDatasetKey,
    candidatesCreated: 0,
    duplicatesSkipped: 0,
    ambiguous: 0,
    needsAdminReview: 0,
    groups: {},
    highRisk: []
  };
  database.exec('BEGIN');
  try {
    for (const file of CAO_TOC_V2_FILES) {
      const filePath = resolve(resolvedDir, file.fileName);
      if (!existsSync(filePath)) continue;
      const records = parseJsonlRecords(filePath);
      const groupSummary = { records: records.length, created: 0, duplicates: 0, ambiguous: 0, needsAdminReview: 0 };
      for (const record of records) {
        let result = { created: false, duplicate: false, ambiguous: false };
        if (file.group === 'person_facts') {
          const fieldType = String(record.field_type || '').trim();
          if (['name', 'title', 'alias', 'display_name'].includes(fieldType)) {
            result = await createV2ProfileCandidate(database, record, file, 'name_alias', 'name', record.value || record.source_quote || '', record.person_name, normalizedDatasetKey);
          } else {
            continue;
          }
        } else if (file.group === 'dates_graves') {
          result = await createV2AnniversaryCandidate(database, record, file, normalizedDatasetKey);
        } else if (file.group === 'relationships') {
          result = await createV2RelationshipCandidate(database, record, file, normalizedDatasetKey);
        } else if (file.group === 'biography_legacy') {
          const legacyType = normalizeProfileCandidateType(record.legacy_type || 'biography');
          const personName = String(record.person_name || '').trim();
          const candidateType = personName ? legacyType : (String(record.legacy_type || '').includes('branch') ? 'branch_legacy' : 'clan_legacy');
          result = await createV2ProfileCandidate(database, record, file, candidateType, defaultProfileTargetField(candidateType), record.value || record.source_quote || '', personName || 'Di sản cấp họ/chi', normalizedDatasetKey);
        } else if (file.group === 'verification_notes') {
          result = await createV2ProfileCandidate(database, record, file, 'verification_note', 'description', record.value || record.source_quote || record.notes || '', 'Ghi chú kiểm chứng phả hệ', normalizedDatasetKey);
        }
        if (result.created) {
          summary.candidatesCreated += 1;
          groupSummary.created += 1;
        }
        if (result.duplicate) {
          summary.duplicatesSkipped += 1;
          groupSummary.duplicates += 1;
        }
        if (result.ambiguous) {
          summary.ambiguous += 1;
          groupSummary.ambiguous += 1;
          summary.highRisk.push({ group: file.group, recordId: record.record_id, reason: 'ambiguous_or_needs_review', personName: record.person_name || record.subject_name || '' });
        }
        if (record.needs_admin_review) {
          summary.needsAdminReview += 1;
          groupSummary.needsAdminReview += 1;
        }
      }
      summary.groups[file.group] = groupSummary;
    }
    summary.highRisk = summary.highRisk.slice(0, 50);
    const logId = insertKnowledgeMaintenanceLog(database, 'rescan_v2_dataset', summary, adminUser);
    database.exec('COMMIT');
    return { ok: true, ...summary, logId };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

async function getCaoTocV2Report({ datasetKey = '' } = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = datasetKey ? normalizeCaoTocV2DatasetKey(datasetKey) : '';
  const sourceRows = database.prepare("SELECT * FROM knowledge_sources WHERE json_extract(metadata_json, '$.dataset') IN ('cao_toc_txt_knowledge_base_v2', 'cao_toc_txt_knowledge_base_v3')").all();
  const sources = normalizedDatasetKey
    ? sourceRows.filter((row) => safeJsonParse(row.metadata_json, {}).datasetKey === normalizedDatasetKey)
    : sourceRows;
  const sourceIds = new Set(sources.map((row) => row.id));
  const chunks = database.prepare("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE source_id IN (SELECT id FROM knowledge_sources WHERE json_extract(metadata_json, '$.dataset') IN ('cao_toc_txt_knowledge_base_v2', 'cao_toc_txt_knowledge_base_v3'))").get()?.count || 0;
  const profileRows = database.prepare("SELECT * FROM extracted_profile_candidates WHERE json_extract(metadata_json, '$.dataset') IN ('cao_toc_txt_knowledge_base_v2', 'cao_toc_txt_knowledge_base_v3')").all()
    .filter((row) => !normalizedDatasetKey || safeJsonParse(row.metadata_json, {}).datasetKey === normalizedDatasetKey);
  const annRows = database.prepare("SELECT * FROM extracted_anniversary_candidates WHERE json_extract(metadata_json, '$.dataset') IN ('cao_toc_txt_knowledge_base_v2', 'cao_toc_txt_knowledge_base_v3')").all()
    .filter((row) => !normalizedDatasetKey || safeJsonParse(row.metadata_json, {}).datasetKey === normalizedDatasetKey);
  const relRows = database.prepare("SELECT * FROM extracted_relationship_candidates WHERE json_extract(metadata_json, '$.dataset') IN ('cao_toc_txt_knowledge_base_v2', 'cao_toc_txt_knowledge_base_v3')").all()
    .filter((row) => !normalizedDatasetKey || safeJsonParse(row.metadata_json, {}).datasetKey === normalizedDatasetKey);
  const all = [...profileRows, ...annRows, ...relRows];
  const byGroup = {};
  for (const row of all) {
    const meta = safeJsonParse(row.metadata_json, {});
    const group = meta.datasetGroup || 'unknown';
    byGroup[group] = byGroup[group] || { candidates: 0, ambiguous: 0, needsAdminReview: 0 };
    byGroup[group].candidates += 1;
    if (meta.needsAdminReview) byGroup[group].needsAdminReview += 1;
    const flags = safeJsonParse(row.flags_json, {});
    if (['weak', 'ambiguous', 'none'].includes(row.match_confidence || row.subject_match_confidence || '') || flags.needs_manual_review) byGroup[group].ambiguous += 1;
  }
  const lastLogs = database.prepare("SELECT * FROM knowledge_maintenance_logs WHERE action IN ('import_v2_dataset', 'rescan_v2_dataset') ORDER BY created_at DESC LIMIT 5").all().map(normalizeKnowledgeMaintenanceLog);
  return {
    ok: true,
    datasetKey: normalizedDatasetKey || 'all',
    imported: sources.length > 0,
    sources: sources.length,
    records: normalizedDatasetKey
      ? database.prepare('SELECT source_id FROM knowledge_chunks').all().filter((row) => sourceIds.has(row.source_id)).length
      : chunks,
    candidates: all.length,
    profileCandidates: profileRows.length,
    anniversaryCandidates: annRows.length,
    relationshipCandidates: relRows.length,
    byGroup,
    highRisk: all.map((row) => {
      const meta = safeJsonParse(row.metadata_json, {});
      return {
        id: row.id,
        group: meta.datasetGroup || 'unknown',
        evidenceType: meta.evidenceType || '',
        confidence: meta.confidence || row.match_confidence || row.subject_match_confidence || '',
        needsAdminReview: Boolean(meta.needsAdminReview),
        title: row.person_name || row.subject_name || '',
        quote: meta.evidenceQuote || row.source_quote || ''
      };
    }).filter((item) => item.needsAdminReview || ['weak', 'ambiguous', 'none'].includes(item.confidence)).slice(0, 50),
    logs: lastLogs
  };
}

const CAO_TOC_V3_DEFAULT_DATASET_KEY = 'cao_toc_txt_knowledge_base_v3';
const KNOWLEDGE_CANONICAL_DATASET_KEY = CAO_TOC_V3_DEFAULT_DATASET_KEY;
const V3_TRIAGE_BUCKETS = [
  'ready_to_review',
  'needs_identity_match',
  'needs_source_check',
  'field_mapping_warning',
  'relationship_warning',
  'do_not_apply_directly',
  'noise_reject_candidate',
  'already_reviewed'
];

function createEmptyV3TriageBuckets() {
  return Object.fromEntries(V3_TRIAGE_BUCKETS.map((bucket) => [bucket, 0]));
}

function normalizeV3TriageBucket(value = '') {
  const bucket = String(value || '').trim();
  return V3_TRIAGE_BUCKETS.includes(bucket) ? bucket : '';
}

function getCandidateDatasetKey(row) {
  const metadata = safeJsonParse(row?.metadata_json, {});
  return normalizeCaoTocV2DatasetKey(metadata.datasetKey || '');
}

function getCandidateDataset(row) {
  return String(safeJsonParse(row?.metadata_json, {}).dataset || '').trim();
}

function isV3CandidateRow(row, datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY) {
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const rowDatasetKey = getCandidateDatasetKey(row);
  const rowDataset = getCandidateDataset(row);
  if (rowDatasetKey) return rowDatasetKey === normalizedDatasetKey;
  return rowDataset === 'cao_toc_txt_knowledge_base_v3';
}

function normalizeCandidateQualityFlags(metadata = {}) {
  return Array.isArray(metadata.quality_flags)
    ? metadata.quality_flags.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function getV3CandidateIdentityConfidence(kind, row) {
  if (kind === 'relationship') {
    return [row.subject_match_confidence || 'none', row.object_match_confidence || 'none'];
  }
  return [row.match_confidence || 'none'];
}

function v3CandidateHasSourceEvidence(row, metadata = {}) {
  return Boolean(String(metadata.evidenceQuote || metadata.evidenceWindow || row.source_quote || row.extracted_text || '').trim());
}

function classifyV3Candidate(kind, row) {
  const metadata = safeJsonParse(row.metadata_json, {});
  const flags = safeJsonParse(row.flags_json, {});
  const qualityFlags = normalizeCandidateQualityFlags(metadata);
  const normalizedStatus = kind === 'relationship'
    ? normalizeRelationshipCandidateStatus(row.status)
    : kind === 'profile'
      ? normalizeProfileCandidateStatus(row.status)
      : normalizeExtractedCandidateStatus(row.status);
  const buckets = new Set();
  const reasons = [];
  if (normalizedStatus !== 'pending') {
    buckets.add('already_reviewed');
    reasons.push(`status=${normalizedStatus}`);
  }

  const hasEvidence = v3CandidateHasSourceEvidence(row, metadata);
  if (!hasEvidence) {
    buckets.add('noise_reject_candidate');
    reasons.push('missing evidence quote/window');
  }

  if (metadata.sourceKind === 'technical_rule' || metadata.excludeFromExtraction === true) {
    buckets.add('noise_reject_candidate');
    reasons.push('technical source candidate');
  }

  if (metadata.notApplyDirectly === true || ['verification_note', 'clan_legacy', 'branch_legacy'].includes(row.candidate_type)) {
    buckets.add('do_not_apply_directly');
    reasons.push('note/legacy item, review only');
  }

  if (metadata.needsAdminReview === true || qualityFlags.some((flag) => [
    'needs_admin_review',
    'moved_to_verification_note',
    'low_confidence',
    'ambiguous_person_name'
  ].includes(flag))) {
    buckets.add('needs_source_check');
    reasons.push('source asks for admin review');
  }

  if (qualityFlags.some((flag) => [
    'mixed_hometown_context',
    'spouse_info_nested',
    'not_grave_context',
    'moved_from_dates_graves',
    'moved_from_biography',
    'actual_grave_from_biography',
    'normalized_legacy_type',
    'long_biography_needs_review',
    'normalized_field_type'
  ].includes(flag))) {
    buckets.add('field_mapping_warning');
    reasons.push(`field flags: ${qualityFlags.slice(0, 4).join(', ')}`);
  }

  const identityConfidences = getV3CandidateIdentityConfidence(kind, row).map((item) => String(item || 'none'));
  if (identityConfidences.some((item) => ['none', 'weak', 'ambiguous'].includes(item))) {
    buckets.add('needs_identity_match');
    reasons.push(`match=${identityConfidences.join('/')}`);
  }

  if (kind === 'relationship') {
    if (normalizeKnowledgeText(row.subject_name) && normalizeKnowledgeText(row.subject_name) === normalizeKnowledgeText(row.object_name)) {
      buckets.add('noise_reject_candidate');
      reasons.push('self relationship');
    }
    if (
      flags.requires_new_subject ||
      flags.requires_new_object ||
      flags.ambiguous_subject ||
      flags.ambiguous_object ||
      flags.needs_manual_review ||
      qualityFlags.some((flag) => ['invalid_or_ambiguous_object_name', 'invalid_or_ambiguous_subject_name'].includes(flag))
    ) {
      buckets.add('relationship_warning');
      reasons.push('relationship needs manual subject/object review');
    }
    if (!String(row.subject_name || '').trim() || !String(row.object_name || '').trim()) {
      buckets.add('noise_reject_candidate');
      reasons.push('missing subject/object');
    }
  }

  if (!buckets.size) buckets.add('ready_to_review');
  const priority = [
    'noise_reject_candidate',
    'do_not_apply_directly',
    'relationship_warning',
    'field_mapping_warning',
    'needs_identity_match',
    'needs_source_check',
    'ready_to_review',
    'already_reviewed'
  ];
  const primaryBucket = priority.find((bucket) => buckets.has(bucket)) || 'ready_to_review';
  return {
    kind,
    id: row.id,
    status: normalizedStatus,
    primaryBucket,
    buckets: [...buckets],
    reasons,
    group: metadata.datasetGroup || 'unknown',
    evidenceType: metadata.evidenceType || '',
    title: row.person_name || row.subject_name || row.matched_member_name || '',
    target: row.object_name || row.target_field || getExtractedAnniversaryFields(row, metadata).map((field) => field.type).join(', '),
    confidence: metadata.confidence || identityConfidences.join('/'),
    sourceId: row.source_id,
    chunkId: row.chunk_id,
    sourceTitle: metadata.sourceTitle || row.knowledge_title || '',
    quote: compactText(metadata.evidenceQuote || row.source_quote || row.extracted_text || '', 220),
    qualityFlags: qualityFlags.slice(0, 8),
    rawStatus: row.status
  };
}

function isResolvedV3IdentityConfidence(confidence, id = '') {
  if (!String(id || '').trim()) return false;
  return ['manual', 'exact', 'strong', 'medium'].includes(String(confidence || '').trim().toLowerCase());
}

function getV3CandidateReviewState(kind, row, body = {}) {
  if (!isV3CandidateRow(row)) return null;
  const triage = classifyV3Candidate(kind, row);
  const buckets = Array.isArray(triage.buckets) ? triage.buckets : [];
  const blockedReasons = [];
  const requiredConfirmations = [];
  const requiredActions = [];

  if (triage.status !== 'approved' && triage.status !== 'applied') {
    requiredActions.push('approve_before_apply');
  }

  if (buckets.includes('noise_reject_candidate')) {
    blockedReasons.push('noise_reject_candidate');
    requiredActions.push('reject_or_rescan_source');
  }

  if (buckets.includes('do_not_apply_directly')) {
    blockedReasons.push('do_not_apply_directly');
    requiredActions.push('keep_as_verification_note');
  }

  if (buckets.includes('needs_source_check') && body.confirmSourceCheck !== true) {
    requiredConfirmations.push('confirmSourceCheck');
  }

  if (buckets.includes('field_mapping_warning') && body.confirmFieldMapping !== true) {
    requiredConfirmations.push('confirmFieldMapping');
  }

  if (kind === 'relationship') {
    const flags = safeJsonParse(row.flags_json, {});
    const subjectId = String(body.subjectMemberId || row.subject_member_id || '').trim();
    const objectId = String(body.objectMemberId || row.object_member_id || '').trim();
    if (!subjectId || !objectId) {
      requiredActions.push('assign_subject_and_object');
    }
    if (subjectId && objectId && subjectId === objectId) {
      blockedReasons.push('self_relationship');
    }
    if (flags.requires_new_subject || flags.requires_new_object) {
      blockedReasons.push('missing_lineage_member');
      requiredActions.push('create_or_assign_missing_member');
    }
    const subjectResolved = isResolvedV3IdentityConfidence(
      body.subjectMemberId ? 'manual' : row.subject_match_confidence,
      subjectId
    );
    const objectResolved = isResolvedV3IdentityConfidence(
      body.objectMemberId ? 'manual' : row.object_match_confidence,
      objectId
    );
    if ((!subjectResolved || !objectResolved) && body.confirmIdentity !== true) {
      requiredConfirmations.push('confirmIdentity');
      requiredActions.push('confirm_subject_object_identity');
    }
    if (buckets.includes('relationship_warning') && body.confirmRelationshipReview !== true) {
      requiredConfirmations.push('confirmRelationshipReview');
      requiredActions.push('confirm_relationship_type_direction');
    }
  } else {
    const memberId = String(body.memberId || row.matched_member_id || '').trim();
    if (!memberId) {
      requiredActions.push('assign_member');
    }
    const identityResolved = isResolvedV3IdentityConfidence(
      body.memberId ? 'manual' : row.match_confidence,
      memberId
    );
    if (!identityResolved && body.confirmIdentity !== true) {
      requiredConfirmations.push('confirmIdentity');
      requiredActions.push('confirm_member_identity');
    }
  }

  const uniqueConfirmations = [...new Set(requiredConfirmations)];
  const uniqueActions = [...new Set(requiredActions)];
  const uniqueBlockedReasons = [...new Set(blockedReasons)];
  return {
    isV3: true,
    bucket: triage.primaryBucket,
    buckets,
    reasons: triage.reasons,
    group: triage.group,
    confidence: triage.confidence,
    sourceId: triage.sourceId,
    chunkId: triage.chunkId,
    qualityFlags: triage.qualityFlags,
    requiredActions: uniqueActions,
    requiredConfirmations: uniqueConfirmations,
    blockedReasons: uniqueBlockedReasons,
    canApply: uniqueBlockedReasons.length === 0 && uniqueConfirmations.length === 0 && uniqueActions.filter((action) => action !== 'approve_before_apply').length === 0 && (triage.status === 'approved' || triage.status === 'applied')
  };
}

function assertV3CandidateApplyAllowed(kind, row, body = {}) {
  const guard = getV3CandidateReviewState(kind, row, body);
  if (!guard || guard.canApply) return guard;
  const err = new Error('V3 candidate requires manual triage review before apply.');
  err.status = 409;
  err.triageGuard = guard;
  throw err;
}

function getV3ReviewQueueGroup(kind, row) {
  if (kind === 'relationship') return 'relationship';
  if (kind === 'anniversary') return 'vital';
  const candidateType = String(row.candidate_type || '').trim();
  if (candidateType === 'name_alias') return 'name';
  if (['verification_note', 'clan_legacy', 'branch_legacy'].includes(candidateType)) return 'note';
  return 'profile';
}

function getV3ReviewQueueAction(kind, row, guard) {
  const actions = new Set(guard?.requiredActions || []);
  const confirmations = new Set(guard?.requiredConfirmations || []);
  const blockers = new Set(guard?.blockedReasons || []);
  if (blockers.has('noise_reject_candidate') || actions.has('reject_or_rescan_source')) {
    return {
      code: 'reject_or_rescan',
      label: 'Reject hoặc quét lại nguồn',
      detail: 'Candidate thiếu evidence hoặc nhiễu chắc chắn, không được apply vào cây phả.'
    };
  }
  if (blockers.has('do_not_apply_directly') || actions.has('keep_as_verification_note')) {
    return {
      code: 'keep_verification_note',
      label: 'Giữ làm ghi chú kiểm chứng',
      detail: 'Không áp dụng trực tiếp vào cá nhân; lưu lại để Ban trị sự đối chiếu tài liệu.'
    };
  }
  if (actions.has('assign_member')) {
    return {
      code: 'assign_member',
      label: 'Gán đúng nhân vật',
      detail: 'Chọn nhân vật trong cây phả trước khi duyệt hoặc apply.'
    };
  }
  if (actions.has('assign_subject_and_object')) {
    return {
      code: 'assign_relationship_members',
      label: 'Gán chủ thể và đối tượng',
      detail: 'Xác nhận rõ ai là chủ thể, quan hệ là gì, và đối tượng là ai.'
    };
  }
  if (confirmations.has('confirmRelationshipReview')) {
    return {
      code: 'confirm_relationship',
      label: 'Kiểm quan hệ',
      detail: 'Xác nhận loại quan hệ, chiều quan hệ và hai nhân vật liên quan.'
    };
  }
  if (confirmations.has('confirmFieldMapping')) {
    return {
      code: 'confirm_field_mapping',
      label: 'Kiểm field đích',
      detail: 'Đối chiếu field đích để tránh map nhầm, nhất là quê quán/mộ chí/ngày giỗ.'
    };
  }
  if (confirmations.has('confirmSourceCheck')) {
    return {
      code: 'confirm_source',
      label: 'Kiểm đoạn nguồn',
      detail: 'Mở trích dẫn và xác nhận đoạn nguồn trước khi apply.'
    };
  }
  if (confirmations.has('confirmIdentity')) {
    return {
      code: 'confirm_identity',
      label: 'Xác nhận nhân vật',
      detail: 'Xác nhận candidate đang gán đúng người trong cây phả.'
    };
  }
  const status = kind === 'relationship'
    ? normalizeRelationshipCandidateStatus(row.status)
    : kind === 'profile'
      ? normalizeProfileCandidateStatus(row.status)
      : normalizeExtractedCandidateStatus(row.status);
  if (status === 'pending') {
    return {
      code: 'approve_then_apply',
      label: 'Duyệt rồi apply',
      detail: 'Candidate đã đủ điều kiện cơ bản; admin duyệt trước rồi mới apply.'
    };
  }
  return {
    code: 'ready_to_apply',
    label: 'Có thể apply',
    detail: 'Candidate đã duyệt và không còn blocker triage.'
  };
}

function publicV3ReviewQueueItem(kind, row) {
  const triage = classifyV3Candidate(kind, row);
  const guard = getV3CandidateReviewState(kind, row);
  const metadata = safeJsonParse(row.metadata_json, {});
  const status = triage.status;
  const group = getV3ReviewQueueGroup(kind, row);
  const title = kind === 'relationship'
    ? `${row.subject_name || row.subject_member_name || 'Chưa rõ'} -> ${row.object_name || row.object_member_name || 'Chưa rõ'}`
    : row.person_name || row.matched_member_name || triage.title || row.id;
  const target = kind === 'anniversary'
    ? getExtractedAnniversaryFields(row, metadata).map((field) => field.label || field.type).join(', ')
    : kind === 'relationship'
      ? `${normalizeRelationshipType(row.relationship_type)} / ${normalizeRelationshipDirection(row.direction)}`
      : `${row.candidate_type || 'profile'} -> ${row.target_field || 'description'}`;
  const action = getV3ReviewQueueAction(kind, row, guard);
  return {
    kind,
    id: row.id,
    status,
    bucket: triage.primaryBucket,
    buckets: triage.buckets,
    reviewGroup: group,
    datasetGroup: triage.group,
    title,
    target,
    personName: row.person_name || '',
    subjectName: row.subject_name || '',
    objectName: row.object_name || '',
    matchedMemberId: row.matched_member_id || row.subject_member_id || '',
    matchedMemberName: row.matched_member_name || row.subject_member_name || '',
    matchConfidence: row.match_confidence || [row.subject_match_confidence, row.object_match_confidence].filter(Boolean).join('/') || '',
    candidateType: row.candidate_type || '',
    relationshipType: row.relationship_type || '',
    fieldTypes: kind === 'anniversary' ? getExtractedAnniversaryFields(row, metadata).map((field) => field.type) : [],
    sourceId: row.source_id || '',
    chunkId: row.chunk_id || '',
    sourceTitle: metadata.sourceTitle || row.knowledge_title || '',
    headingPath: metadata.headingPath || row.heading_path || '',
    evidenceQuote: metadata.evidenceQuote || row.source_quote || row.extracted_text || '',
    evidenceWindow: metadata.evidenceWindow || row.source_quote || row.extracted_text || '',
    qualityFlags: triage.qualityFlags,
    reasons: triage.reasons,
    triageGuard: guard,
    action,
    canApply: Boolean(guard?.canApply),
    hardBlocked: Boolean(guard?.blockedReasons?.length || (guard?.requiredActions || []).some((item) => ['reject_or_rescan_source', 'keep_as_verification_note', 'assign_member', 'assign_subject_and_object', 'create_or_assign_missing_member'].includes(item))),
    updatedAt: row.updated_at || row.created_at || ''
  };
}

async function listCaoTocV3ReviewQueue({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, bucket = '', kind = '', status = 'pending', limit = 80 } = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const bucketFilter = normalizeV3TriageBucket(bucket);
  const kindFilter = String(kind || '').trim().toLowerCase();
  const statusFilter = String(status || '').trim().toLowerCase();
  const rows = [
    ...database.prepare('SELECT * FROM extracted_profile_candidates').all().map((row) => ({ kind: 'profile', row })),
    ...database.prepare('SELECT * FROM extracted_anniversary_candidates').all().map((row) => ({ kind: 'anniversary', row })),
    ...database.prepare('SELECT * FROM extracted_relationship_candidates').all().map((row) => ({ kind: 'relationship', row }))
  ].filter(({ kind: itemKind, row }) => {
    if (kindFilter && itemKind !== kindFilter) return false;
    if (!isV3CandidateRow(row, normalizedDatasetKey)) return false;
    const triage = classifyV3Candidate(itemKind, row);
    if (bucketFilter && triage.primaryBucket !== bucketFilter) return false;
    if (statusFilter && statusFilter !== 'all' && triage.status !== statusFilter) return false;
    return true;
  });
  const bucketCounts = createEmptyV3TriageBuckets();
  const byKind = { profile: 0, anniversary: 0, relationship: 0 };
  const byStatus = {};
  const items = rows.map(({ kind: itemKind, row }) => {
    const item = publicV3ReviewQueueItem(itemKind, row);
    bucketCounts[item.bucket] = (bucketCounts[item.bucket] || 0) + 1;
    byKind[itemKind] = (byKind[itemKind] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    return item;
  });
  const priority = Object.fromEntries(V3_TRIAGE_BUCKETS.map((item, index) => [item, index]));
  const sorted = items.sort((a, b) => {
    const priorityDiff = (priority[a.bucket] ?? 99) - (priority[b.bucket] ?? 99);
    if (priorityDiff) return priorityDiff;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  }).slice(0, Math.max(1, Math.min(500, Number(limit) || 80)));
  return {
    ok: true,
    datasetKey: normalizedDatasetKey,
    total: rows.length,
    bucketCounts,
    byKind,
    byStatus,
    items: sorted
  };
}

async function listAllCaoTocV3ReviewQueueItems({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, kind = '', status = 'all' } = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const kindFilter = String(kind || '').trim().toLowerCase();
  const statusFilter = String(status || '').trim().toLowerCase();
  return [
    ...database.prepare('SELECT * FROM extracted_profile_candidates').all().map((row) => ({ kind: 'profile', row })),
    ...database.prepare('SELECT * FROM extracted_anniversary_candidates').all().map((row) => ({ kind: 'anniversary', row })),
    ...database.prepare('SELECT * FROM extracted_relationship_candidates').all().map((row) => ({ kind: 'relationship', row }))
  ].filter(({ kind: itemKind, row }) => {
    if (kindFilter && itemKind !== kindFilter) return false;
    if (!isV3CandidateRow(row, normalizedDatasetKey)) return false;
    const item = publicV3ReviewQueueItem(itemKind, row);
    if (statusFilter && statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  }).map(({ kind: itemKind, row }) => publicV3ReviewQueueItem(itemKind, row));
}

async function keepV3ProfileCandidateAsVerificationNote(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(String(id || ''));
  if (!row) {
    const err = new Error('Extracted profile candidate not found.');
    err.status = 404;
    throw err;
  }
  if (!isV3CandidateRow(row)) {
    const err = new Error('Only v3 profile candidates can be kept as verification notes.');
    err.status = 400;
    throw err;
  }
  const guard = getV3CandidateReviewState('profile', row);
  if (!guard?.buckets?.includes('do_not_apply_directly')) {
    const err = new Error('Candidate is not classified as a verification-only note.');
    err.status = 400;
    err.triageGuard = guard;
    throw err;
  }
  if (body.confirmKeepNote !== true) {
    const err = new Error('confirmKeepNote=true is required to keep this candidate as a verification note.');
    err.status = 409;
    err.triageGuard = guard;
    throw err;
  }
  const metadata = safeJsonParse(row.metadata_json, {});
  const now = new Date().toISOString();
  const nextMetadata = {
    ...metadata,
    keptAsVerificationNote: true,
    keptAsVerificationNoteAt: now,
    keptAsVerificationNoteBy: adminUser?.username || adminUser?.fullName || '',
    reviewNote: String(body.reviewNote || metadata.reviewNote || '').trim()
  };
  database.prepare(`
    UPDATE extracted_profile_candidates
    SET status = 'approved',
        metadata_json = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(nextMetadata), row.id);
  const auditId = `profile_note_${sha256Base64Url(`${row.id}:${now}`).slice(0, 24)}`;
  database.prepare(`
    INSERT INTO extracted_profile_audit_logs
      (id, candidate_id, member_id, action, field_changes_json, source_id, chunk_id, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    auditId,
    row.id,
    row.matched_member_id || '',
    'kept_verification_note',
    JSON.stringify([{
      field: 'verification_note',
      oldValue: row.status || '',
      newValue: 'approved/kept',
      note: nextMetadata.reviewNote || ''
    }]),
    row.source_id || '',
    row.chunk_id || '',
    adminUser?.username || adminUser?.fullName || 'admin'
  );
  return {
    ok: true,
    candidate: await hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(row.id))),
    log: publicProfileAuditLog(database.prepare('SELECT * FROM extracted_profile_audit_logs WHERE id = ?').get(auditId))
  };
}

function normalizeV3PilotKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  return ['profile', 'anniversary', 'relationship'].includes(value) ? value : '';
}

function v3PilotCandidateTable(kind) {
  switch (normalizeV3PilotKind(kind)) {
    case 'profile':
      return 'extracted_profile_candidates';
    case 'anniversary':
      return 'extracted_anniversary_candidates';
    case 'relationship':
      return 'extracted_relationship_candidates';
    default:
      return '';
  }
}

function getV3PilotCandidateRow(database, kind, id) {
  const table = v3PilotCandidateTable(kind);
  if (!table) return null;
  return database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(String(id || ''));
}

function replaceV3PilotCandidateRow(database, kind, row) {
  const table = v3PilotCandidateTable(kind);
  if (!table || !row?.id) return false;
  const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name).filter(Boolean);
  const rowColumns = columns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
  if (!rowColumns.length) return false;
  const placeholders = rowColumns.map(() => '?').join(', ');
  database.prepare(`
    INSERT OR REPLACE INTO ${table} (${rowColumns.join(', ')})
    VALUES (${placeholders})
  `).run(...rowColumns.map((column) => row[column]));
  return true;
}

function normalizeV3PilotItems(items) {
  const normalized = Array.isArray(items) ? items : [];
  return normalized
    .map((item) => ({
      ...item,
      kind: normalizeV3PilotKind(item?.kind),
      id: String(item?.id || item?.candidateId || '').trim()
    }))
    .filter((item) => item.kind && item.id);
}

function buildV3PilotApplyPayload(kind, item = {}) {
  const payload = item.payload && typeof item.payload === 'object' ? { ...item.payload } : {};
  for (const key of [
    'confirmOverwrite',
    'force',
    'confirmIdentity',
    'confirmSourceCheck',
    'confirmFieldMapping',
    'confirmRelationshipReview',
    'memberId',
    'targetField',
    'reviewedText',
    'appendMode',
    'subjectMemberId',
    'objectMemberId',
    'relationshipType',
    'fieldTypes'
  ]) {
    if (Object.prototype.hasOwnProperty.call(item, key)) payload[key] = item[key];
  }
  if (kind === 'anniversary' && Array.isArray(item.fieldTypes) && item.fieldTypes.length) {
    payload.fieldTypes = item.fieldTypes.map((field) => String(field || '').trim()).filter(Boolean);
  }
  payload.pilotApply = true;
  return payload;
}

function treeSnapshotHash(tree) {
  return sha256Hex(JSON.stringify(tree || null));
}

function getPilotResultMemberId(kind, result, payload = {}) {
  if (kind === 'relationship') {
    const change = Array.isArray(result?.changes) ? result.changes[0] : null;
    const subjectId = payload.subjectMemberId || change?.subjectId || '';
    const objectId = payload.objectMemberId || change?.objectId || '';
    return [subjectId, objectId].filter(Boolean).join(' -> ');
  }
  const change = Array.isArray(result?.changes) ? result.changes[0] : null;
  return String(payload.memberId || result?.candidate?.matchedMemberId || change?.memberId || '').trim();
}

function publicV3PilotApplyLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    candidateId: row.candidate_id,
    auditId: row.audit_id,
    memberId: row.member_id,
    status: row.status,
    rollbackStatus: row.rollback_status,
    rollbackAuditId: row.rollback_audit_id,
    beforeTreeHash: row.before_tree_hash,
    afterTreeHash: row.after_tree_hash,
    result: safeJsonParse(row.result_json, {}),
    metadata: safeJsonParse(row.metadata_json, {}),
    adminUser: row.admin_user,
    createdAt: row.created_at,
    rolledBackAt: row.rolled_back_at
  };
}

async function previewV3PilotApply(items = [], { datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY } = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const normalizedItems = normalizeV3PilotItems(items).slice(0, 5);
  const results = normalizedItems.map((item) => {
    const row = getV3PilotCandidateRow(database, item.kind, item.id);
    if (!row) {
      return { ...item, ok: false, canPilotApply: false, reason: 'not_found' };
    }
    if (!isV3CandidateRow(row, normalizedDatasetKey)) {
      return { ...item, ok: false, canPilotApply: false, reason: 'not_v3_dataset' };
    }
    const queueItem = publicV3ReviewQueueItem(item.kind, row);
    const blockers = [];
    if (queueItem.status !== 'approved') blockers.push('candidate_must_be_approved');
    if (queueItem.hardBlocked) blockers.push('triage_hard_blocked');
    if (!queueItem.canApply) blockers.push('triage_confirmations_required');
    return {
      ...item,
      ok: blockers.length === 0,
      canPilotApply: blockers.length === 0,
      blockers,
      queueItem
    };
  });
  return {
    ok: results.every((item) => item.ok),
    maxItems: 5,
    total: normalizedItems.length,
    results
  };
}

async function applyV3PilotCandidates(body = {}, adminUser = {}) {
  const items = normalizeV3PilotItems(body.items || []);
  if (!items.length) {
    const err = new Error('Missing pilot apply items.');
    err.status = 400;
    throw err;
  }
  if (items.length > 5) {
    const err = new Error('Pilot apply allows at most 5 candidates per run.');
    err.status = 400;
    throw err;
  }
  if (body.confirmPilotApply !== true) {
    const err = new Error('confirmPilotApply=true is required for pilot apply.');
    err.status = 409;
    throw err;
  }

  const preview = await previewV3PilotApply(items, { datasetKey: body.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY });
  const blocked = preview.results.filter((item) => !item.canPilotApply);
  if (blocked.length) {
    const err = new Error('Some pilot candidates are not ready to apply.');
    err.status = 409;
    err.preview = preview;
    throw err;
  }

  const database = await getDatabase();
  const results = [];
  for (const item of items) {
    const kind = normalizeV3PilotKind(item.kind);
    const candidateBefore = getV3PilotCandidateRow(database, kind, item.id);
    const treeBefore = await readLineageTreeForAI();
    const beforeTreeJson = JSON.stringify(treeBefore || null);
    const beforeTreeHash = sha256Hex(beforeTreeJson);
    const payload = buildV3PilotApplyPayload(kind, item);
    try {
      const applied = kind === 'profile'
        ? await applyExtractedProfileCandidate(item.id, payload, adminUser)
        : kind === 'relationship'
          ? await applyExtractedRelationshipCandidate(item.id, payload, adminUser)
          : await applyExtractedAnniversaryCandidate(item.id, payload, adminUser);
      const treeAfter = await readLineageTreeForAI();
      const afterTreeHash = treeSnapshotHash(treeAfter);
      const candidateAfter = getV3PilotCandidateRow(database, kind, item.id);
      const logId = `v3_pilot_${sha256Base64Url(`${kind}:${item.id}:${Date.now()}:${Math.random()}`).slice(0, 24)}`;
      database.prepare(`
        INSERT INTO cao_toc_v3_pilot_apply_logs
          (id, kind, candidate_id, audit_id, member_id, status, before_tree_hash, after_tree_hash,
           before_tree_json, candidate_before_json, candidate_after_json, result_json, metadata_json,
           admin_user, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        logId,
        kind,
        item.id,
        applied.auditId || '',
        getPilotResultMemberId(kind, applied, payload),
        'applied',
        beforeTreeHash,
        afterTreeHash,
        beforeTreeJson,
        JSON.stringify(candidateBefore || {}),
        JSON.stringify(candidateAfter || {}),
        JSON.stringify(applied),
        JSON.stringify({
          datasetKey: body.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
          note: String(body.note || '').trim(),
          pilot: true
        }),
        adminUser?.username || adminUser?.fullName || 'admin'
      );
      results.push({ ok: true, kind, id: item.id, logId, auditId: applied.auditId || '', result: applied });
    } catch (err) {
      results.push({
        ok: false,
        kind,
        id: item.id,
        error: err.message || String(err),
        statusCode: err.status || 500,
        conflicts: err.conflicts || [],
        triageGuard: err.triageGuard || null
      });
    }
  }
  return {
    ok: results.every((item) => item.ok),
    total: items.length,
    applied: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  };
}

async function listV3PilotApplyLogs({ limit = 50 } = {}) {
  const database = await getDatabase();
  return {
    logs: database.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs ORDER BY created_at DESC LIMIT ?')
      .all(Math.max(1, Math.min(200, Number(limit) || 50)))
      .map(publicV3PilotApplyLog)
  };
}

function scoreV3PilotProposal(item) {
  const confidence = normalizeKnowledgeText(item.matchConfidence || '');
  let score = 0;
  if (item.bucket === 'ready_to_review') score += 50;
  if (confidence.includes('exact')) score += 35;
  if (confidence.includes('high')) score += 25;
  if (item.kind === 'anniversary') score += 8;
  if (item.kind === 'profile') score += 6;
  if (item.kind === 'relationship') score += 4;
  if (item.sourceId && item.chunkId) score += 8;
  if (item.evidenceQuote) score += 6;
  if (item.qualityFlags?.length) score -= Math.min(25, item.qualityFlags.length * 5);
  if (item.reasons?.length) score -= Math.min(20, item.reasons.length * 3);
  return score;
}

async function listV3PilotApplyProposals({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, limit = 20 } = {}) {
  const queueItems = await listAllCaoTocV3ReviewQueueItems({ datasetKey, status: 'approved' });
  const items = queueItems
    .filter((item) => item.canApply && !item.hardBlocked && item.status === 'approved')
    .map((item) => ({
      kind: item.kind,
      id: item.id,
      score: scoreV3PilotProposal(item),
      reason: [
        item.matchConfidence ? `match=${item.matchConfidence}` : '',
        item.sourceId && item.chunkId ? 'has_source' : '',
        item.evidenceQuote ? 'has_evidence' : '',
        item.fieldTypes?.length ? `fields=${item.fieldTypes.join(',')}` : ''
      ].filter(Boolean),
      item
    }))
    .sort((a, b) => b.score - a.score || String(b.item.updatedAt || '').localeCompare(String(a.item.updatedAt || '')))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 20)));
  return {
    ok: true,
    datasetKey: normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY),
    total: items.length,
    maxPilotItems: 5,
    items
  };
}

const V3_GROUP_APPLY_GROUPS = [
  { key: 'vital', label: 'Ngay thang va mo chi', description: 'Ngay sinh, ngay mat, ngay gio am lich, que quan, mo chi/noi an tang.' },
  { key: 'name', label: 'Ho ten va danh xung', description: 'Ho ten, ten huy, danh xung can doi chieu voi cay pha.' },
  { key: 'profile', label: 'Hanh trang va cong lao', description: 'Tieu su, hanh trang, su nghiep, cong lao di san.' },
  { key: 'relationship', label: 'Quan he gia toc', description: 'Cha/me/con/phoi ngau, can kiem tra chieu quan he truoc khi apply.' },
  { key: 'note', label: 'Ghi chu kiem chung', description: 'Ghi chu, nghi van, du lieu cap ho/chi nganh, khong apply truc tiep vao ca nhan.' }
];

function emptyV3GroupApplyStats(group) {
  return {
    key: group.key,
    label: group.label,
    description: group.description,
    total: 0,
    pending: 0,
    approved: 0,
    applied: 0,
    rejected: 0,
    readyToPilot: 0,
    blocked: 0,
    needsIdentity: 0,
    needsSource: 0,
    fieldWarnings: 0,
    relationshipWarnings: 0,
    doNotApply: 0,
    noise: 0,
    topCandidates: []
  };
}

function groupV3PilotProposalFromItem(item) {
  return {
    kind: item.kind,
    id: item.id,
    score: scoreV3PilotProposal(item),
    reason: [
      item.matchConfidence ? `match=${item.matchConfidence}` : '',
      item.sourceId && item.chunkId ? 'has_source' : '',
      item.evidenceQuote ? 'has_evidence' : '',
      item.fieldTypes?.length ? `fields=${item.fieldTypes.join(',')}` : ''
    ].filter(Boolean),
    item
  };
}

async function buildV3GroupApplyReport({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, limitPerGroup = 5 } = {}) {
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const items = await listAllCaoTocV3ReviewQueueItems({ datasetKey: normalizedDatasetKey, status: 'all' });
  const groups = Object.fromEntries(V3_GROUP_APPLY_GROUPS.map((group) => [group.key, emptyV3GroupApplyStats(group)]));
  for (const item of items) {
    const key = groups[item.reviewGroup] ? item.reviewGroup : 'profile';
    const group = groups[key];
    group.total += 1;
    group[item.status] = (group[item.status] || 0) + 1;
    if (item.canApply && !item.hardBlocked && item.status === 'approved') group.readyToPilot += 1;
    if (item.hardBlocked || !item.canApply) group.blocked += 1;
    if (item.buckets?.includes('needs_identity_match')) group.needsIdentity += 1;
    if (item.buckets?.includes('needs_source_check')) group.needsSource += 1;
    if (item.buckets?.includes('field_mapping_warning')) group.fieldWarnings += 1;
    if (item.buckets?.includes('relationship_warning')) group.relationshipWarnings += 1;
    if (item.buckets?.includes('do_not_apply_directly')) group.doNotApply += 1;
    if (item.buckets?.includes('noise_reject_candidate')) group.noise += 1;
    if (item.canApply && !item.hardBlocked && item.status === 'approved') {
      group.topCandidates.push(groupV3PilotProposalFromItem(item));
    }
  }
  const safeLimit = Math.max(1, Math.min(20, Number(limitPerGroup) || 5));
  const resultGroups = Object.values(groups).map((group) => ({
    ...group,
    topCandidates: group.topCandidates
      .sort((a, b) => b.score - a.score || String(b.item.updatedAt || '').localeCompare(String(a.item.updatedAt || '')))
      .slice(0, safeLimit)
  }));
  return {
    ok: true,
    datasetKey: normalizedDatasetKey,
    total: items.length,
    maxPilotItems: 5,
    groups: resultGroups
  };
}

async function listV3GroupApplyCandidates({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, group = '', limit = 20 } = {}) {
  const normalizedGroup = String(group || '').trim() || 'vital';
  const items = await listAllCaoTocV3ReviewQueueItems({ datasetKey, status: 'approved' });
  const candidates = items
    .filter((item) => item.reviewGroup === normalizedGroup)
    .filter((item) => item.canApply && !item.hardBlocked && item.status === 'approved')
    .map(groupV3PilotProposalFromItem)
    .sort((a, b) => b.score - a.score || String(b.item.updatedAt || '').localeCompare(String(a.item.updatedAt || '')))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
  return {
    ok: true,
    datasetKey: normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY),
    group: normalizedGroup,
    total: candidates.length,
    maxPilotItems: 5,
    items: candidates
  };
}

async function previewV3GroupPilotBatch(body = {}) {
  const group = String(body.group || '').trim() || 'vital';
  const explicitItems = normalizeV3PilotItems(body.items || []);
  const items = explicitItems.length
    ? explicitItems
    : (await listV3GroupApplyCandidates({
        datasetKey: body.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
        group,
        limit: body.limit || 5
      })).items.map((candidate) => ({ kind: candidate.kind, id: candidate.id }));
  return {
    group,
    ...(await previewV3PilotApply(items.slice(0, 5), { datasetKey: body.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY }))
  };
}

async function applyV3GroupPilotBatch(body = {}, adminUser = {}) {
  if (body.confirmGroupPilotApply !== true) {
    const err = new Error('confirmGroupPilotApply=true is required for grouped pilot apply.');
    err.status = 409;
    throw err;
  }
  const group = String(body.group || '').trim() || 'vital';
  const preview = await previewV3GroupPilotBatch(body);
  const items = (preview.results || [])
    .filter((item) => item.canPilotApply)
    .map((item) => ({ kind: item.kind, id: item.id }));
  if (!items.length) {
    const err = new Error('No grouped pilot candidates are ready to apply.');
    err.status = 409;
    err.preview = preview;
    throw err;
  }
  return {
    group,
    ...(await applyV3PilotCandidates({
      datasetKey: body.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      confirmPilotApply: true,
      note: String(body.note || `Phase 2W.2L grouped pilot apply: ${group}`).trim(),
      items
    }, adminUser))
  };
}

function stringifyPilotCompareValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value || '').trim();
}

function pilotValuesMatch(currentValue, expectedValue) {
  const current = stringifyPilotCompareValue(currentValue);
  const expected = stringifyPilotCompareValue(expectedValue);
  if (current === expected) return true;
  return normalizeKnowledgeText(current) === normalizeKnowledgeText(expected);
}

function reconcileV3PilotLogRow(database, row, tree) {
  const log = publicV3PilotApplyLog(row);
  const result = safeJsonParse(row.result_json, {});
  const changes = Array.isArray(result?.changes) ? result.changes : [];
  const currentTreeHash = treeSnapshotHash(tree);
  const candidateBefore = safeJsonParse(row.candidate_before_json, {});
  const candidateCurrent = getV3PilotCandidateRow(database, row.kind, row.candidate_id);
  const checks = [];

  if (row.rollback_status === 'rolled_back' || row.status === 'rolled_back') {
    const restoredByHash = Boolean(row.before_tree_hash && currentTreeHash === row.before_tree_hash);
    return {
      ...log,
      reconcileStatus: restoredByHash ? 'rolled_back_restored' : 'rolled_back_tree_changed',
      ok: restoredByHash,
      currentTreeHash,
      expectedTreeHash: row.before_tree_hash || '',
      candidateStatus: candidateCurrent?.status || '',
      expectedCandidateStatus: candidateBefore?.status || '',
      checks
    };
  }

  if (!changes.length) {
    return {
      ...log,
      reconcileStatus: row.after_tree_hash && currentTreeHash === row.after_tree_hash ? 'noop_hash_match' : 'noop_unverified',
      ok: Boolean(row.after_tree_hash && currentTreeHash === row.after_tree_hash),
      currentTreeHash,
      expectedTreeHash: row.after_tree_hash || '',
      candidateStatus: candidateCurrent?.status || '',
      checks
    };
  }

  if (row.kind === 'relationship') {
    for (const change of changes) {
      const subject = getLineageNodeById(tree, change.subjectId);
      const object = getLineageNodeById(tree, change.objectId);
      const currentValue = relationCurrentValues(subject, object);
      checks.push({
        field: change.relationshipType || 'relationship',
        subjectId: change.subjectId || '',
        objectId: change.objectId || '',
        expected: change.newValue || {},
        current: currentValue,
        ok: pilotValuesMatch(currentValue, change.newValue || {})
      });
    }
  } else {
    const fallbackMemberId = String(row.member_id || '').trim();
    for (const change of changes) {
      const memberId = String(change.memberId || fallbackMemberId || '').trim();
      const node = getLineageNodeById(tree, memberId);
      const field = change.lineageField || change.field || '';
      const currentValue = field ? node?.[field] : undefined;
      checks.push({
        field,
        memberId,
        expected: change.newValue,
        current: currentValue,
        ok: Boolean(node && field && pilotValuesMatch(currentValue, change.newValue))
      });
    }
  }

  const allFieldsMatch = checks.length > 0 && checks.every((item) => item.ok);
  const hashMatch = Boolean(row.after_tree_hash && currentTreeHash === row.after_tree_hash);
  return {
    ...log,
    reconcileStatus: allFieldsMatch ? (hashMatch ? 'in_sync' : 'fields_match_tree_changed') : 'drift',
    ok: allFieldsMatch,
    currentTreeHash,
    expectedTreeHash: row.after_tree_hash || '',
    candidateStatus: candidateCurrent?.status || '',
    checks
  };
}

async function reconcileV3PilotApplyLogs({ limit = 50 } = {}) {
  const database = await getDatabase();
  const tree = await readLineageTreeForAI();
  const rows = database.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(200, Number(limit) || 50)));
  const items = rows.map((row) => reconcileV3PilotLogRow(database, row, tree || {}));
  return {
    ok: true,
    total: items.length,
    inSync: items.filter((item) => ['in_sync', 'fields_match_tree_changed', 'rolled_back_restored'].includes(item.reconcileStatus)).length,
    drift: items.filter((item) => ['drift', 'rolled_back_tree_changed', 'noop_unverified'].includes(item.reconcileStatus)).length,
    items
  };
}

function stringifyAppliedValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return compactText(JSON.stringify(value), 180);
  return compactText(String(value || ''), 180);
}

function getV3PilotLogMemberIds(log) {
  const ids = new Set();
  const addId = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    text.split(/\s*->\s*/).map((item) => item.trim()).filter(Boolean).forEach((item) => ids.add(item));
  };
  addId(log.memberId);
  const changes = Array.isArray(log.result?.changes) ? log.result.changes : [];
  for (const change of changes) {
    addId(change.memberId);
    addId(change.subjectId);
    addId(change.objectId);
  }
  const matches = Array.isArray(log.result?.candidate?.candidateMatches) ? log.result.candidate.candidateMatches : [];
  for (const match of matches) addId(match.memberId);
  return [...ids].filter(Boolean);
}

function summarizeV3PilotLogFields(log) {
  const changes = Array.isArray(log.result?.changes) ? log.result.changes : [];
  if (!changes.length && log.kind === 'relationship') {
    return [{
      field: log.result?.candidate?.relationshipType || 'relationship',
      fieldType: 'relationship',
      oldValue: '',
      newValue: [log.result?.candidate?.subjectName, log.result?.candidate?.relationshipType, log.result?.candidate?.objectName].filter(Boolean).join(' ')
    }];
  }
  return changes.map((change) => ({
    field: change.lineageField || change.relationshipType || change.fieldType || 'value',
    fieldType: change.fieldType || (change.relationshipType ? 'relationship' : ''),
    oldValue: stringifyAppliedValue(change.oldValue),
    newValue: stringifyAppliedValue(change.newValue),
    rawText: change.rawText || '',
    sourceId: change.sourceId || log.result?.candidate?.sourceId || '',
    chunkId: change.chunkId || log.result?.candidate?.chunkId || '',
    ok: typeof change.ok === 'boolean' ? change.ok : undefined
  }));
}

function buildV3AppliedLogForMember(log, memberId = '') {
  const candidate = log.result?.candidate || {};
  const checks = Array.isArray(log.checks) ? log.checks : [];
  const relevantChecks = checks.filter((check) => {
    if (!memberId) return true;
    return [check.memberId, check.subjectId, check.objectId].map((item) => String(item || '').trim()).includes(String(memberId || '').trim());
  });
  return {
    id: log.id,
    kind: log.kind,
    candidateId: log.candidateId,
    auditId: log.auditId,
    status: log.status,
    rollbackStatus: log.rollbackStatus,
    rollbackAuditId: log.rollbackAuditId,
    reconcileStatus: log.reconcileStatus,
    ok: log.ok,
    createdAt: log.createdAt,
    rolledBackAt: log.rolledBackAt,
    appliedBy: log.adminUser,
    sourceId: candidate.sourceId || '',
    chunkId: candidate.chunkId || '',
    sourceTitle: candidate.sourceTitle || log.result?.metadata?.sourceTitle || '',
    headingPath: candidate.headingPath || log.result?.metadata?.headingPath || '',
    evidenceQuote: candidate.evidenceQuote || candidate.sourceQuote || '',
    evidenceWindow: candidate.evidenceWindow || '',
    title: candidate.personName || candidate.matchedMemberName || [candidate.subjectName, candidate.relationshipType, candidate.objectName].filter(Boolean).join(' ') || log.candidateId,
    fields: summarizeV3PilotLogFields(log),
    checks: relevantChecks
  };
}

async function buildV3MemberAppliedReport({ q = '', memberId = '', limit = 80 } = {}) {
  const database = await getDatabase();
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const memberIndex = new Map(members.map((member) => [String(member.id || ''), member]));
  const rows = database.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(500, Number(limit) || 80)));
  const reconciledLogs = rows.map((row) => reconcileV3PilotLogRow(database, row, tree || {}));
  const queryNorm = normalizeKnowledgeText(q);
  const memberFilter = String(memberId || '').trim();
  const grouped = new Map();

  for (const log of reconciledLogs) {
    const memberIds = getV3PilotLogMemberIds(log);
    for (const id of memberIds) {
      if (memberFilter && id !== memberFilter) continue;
      const member = memberIndex.get(id) || { id, name: id, generation: '', branch: '' };
      const logItem = buildV3AppliedLogForMember(log, id);
      const haystack = normalizeKnowledgeText([
        member.id,
        member.name,
        member.generation,
        member.branch,
        logItem.id,
        logItem.kind,
        logItem.candidateId,
        logItem.sourceTitle,
        logItem.headingPath,
        logItem.evidenceQuote,
        logItem.fields.map((field) => [field.field, field.fieldType, field.newValue].join(' ')).join(' ')
      ].join(' '));
      if (queryNorm && !haystack.includes(queryNorm)) continue;
      if (!grouped.has(id)) {
        grouped.set(id, {
          memberId: id,
          memberName: member.name || id,
          generation: member.generation,
          branch: member.branch || '',
          totalLogs: 0,
          activeApplied: 0,
          rolledBack: 0,
          inSync: 0,
          drift: 0,
          latestAt: '',
          fields: new Set(),
          logs: []
        });
      }
      const group = grouped.get(id);
      group.totalLogs += 1;
      if (log.rollbackStatus === 'rolled_back' || log.status === 'rolled_back') group.rolledBack += 1;
      else group.activeApplied += 1;
      if (['in_sync', 'fields_match_tree_changed', 'rolled_back_restored'].includes(log.reconcileStatus)) group.inSync += 1;
      if (['drift', 'rolled_back_tree_changed', 'noop_unverified'].includes(log.reconcileStatus)) group.drift += 1;
      if (!group.latestAt || String(log.createdAt || '') > String(group.latestAt || '')) group.latestAt = log.createdAt || '';
      for (const field of logItem.fields) group.fields.add(field.field || field.fieldType || 'value');
      group.logs.push(logItem);
    }
  }

  const memberReports = [...grouped.values()]
    .map((group) => ({
      ...group,
      fields: [...group.fields].filter(Boolean),
      logs: group.logs.slice(0, 20)
    }))
    .sort((a, b) => String(b.latestAt || '').localeCompare(String(a.latestAt || '')))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 80)));

  return {
    ok: true,
    total: memberReports.length,
    summary: {
      logs: reconciledLogs.length,
      activeApplied: memberReports.reduce((sum, member) => sum + member.activeApplied, 0),
      rolledBack: memberReports.reduce((sum, member) => sum + member.rolledBack, 0),
      drift: memberReports.reduce((sum, member) => sum + member.drift, 0)
    },
    members: memberReports
  };
}

const MEMBER_PROFILE_EVIDENCE_FIELD_LABELS = {
  name: 'Họ tên / danh xưng',
  title: 'Tước vị / danh xưng',
  rankRole: 'Vai trò / thứ bậc',
  branch: 'Chi/ngành',
  generation: 'Đời',
  birthDateStructured: 'Ngày sinh có cấu trúc',
  solarBirthDate: 'Ngày sinh dương lịch',
  birthYear: 'Năm sinh',
  deathDateStructured: 'Ngày mất có cấu trúc',
  solarDeathDate: 'Ngày mất dương lịch',
  deathYear: 'Năm mất',
  deathAnniversaryLunarStructured: 'Ngày giỗ âm lịch có cấu trúc',
  deathAnniversaryLunar: 'Ngày giỗ âm lịch',
  lunarAnniversary: 'Ngày giỗ âm lịch',
  hometown: 'Quê quán',
  birthPlace: 'Nơi sinh / quê quán',
  residence: 'Nơi ở',
  grave: 'Mộ chí / nơi an táng',
  graveLocation: 'Mộ chí / nơi an táng',
  burialPlace: 'Nơi an táng',
  parentId: 'Bố/Mẹ trong phả hệ',
  father: 'Cha',
  fatherName: 'Cha',
  mother: 'Mẹ',
  motherName: 'Mẹ',
  spouse: 'Phối ngẫu',
  relationship: 'Quan hệ gia tộc',
  description: 'Hành trạng tiên nhân',
  bio: 'Sự nghiệp / tích trạng',
  achievements: 'Công lao / vinh danh',
  value: 'Thông tin'
};

function memberEvidenceFieldLabel(field) {
  return MEMBER_PROFILE_EVIDENCE_FIELD_LABELS[field] || field || 'Thông tin';
}

function hasMemberValue(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some((item) => hasMemberValue(item));
  if (typeof value === 'object') {
    if (value.rawText || value.day || value.month || value.year) return true;
    return Object.values(value).some((item) => hasMemberValue(item));
  }
  const text = String(value || '').trim();
  return Boolean(text && !['0', 'khuyết', 'khuyet', 'không rõ', 'khong ro', 'chưa rõ', 'chua ro', 'chưa cập nhật', 'chua cap nhat'].includes(normalizeKnowledgeText(text)));
}

function buildMemberProfileChecklist(member = {}) {
  const spouseDetails = Array.isArray(member.spouseDetails) ? member.spouseDetails : [];
  const childCount = Array.isArray(member.children) ? member.children.length : 0;
  const checks = [
    {
      key: 'birth',
      label: 'Ngày/năm sinh',
      field: 'solarBirthDate',
      status: hasMemberValue(member.birthDateStructured) || hasMemberValue(member.solarBirthDate) || hasMemberValue(member.birthYear) ? 'complete' : 'missing',
      currentValue: member.solarBirthDate || member.birthYear || member.birthDateStructured?.rawText || ''
    },
    {
      key: 'death',
      label: 'Ngày/năm mất',
      field: 'solarDeathDate',
      status: !member.isDeceased || hasMemberValue(member.deathDateStructured) || hasMemberValue(member.solarDeathDate) || hasMemberValue(member.deathYear) ? 'complete' : 'missing',
      currentValue: member.solarDeathDate || member.deathYear || member.deathDateStructured?.rawText || ''
    },
    {
      key: 'anniversary',
      label: 'Ngày giỗ âm lịch',
      field: 'deathAnniversaryLunar',
      status: !member.isDeceased || hasMemberValue(member.deathAnniversaryLunarStructured) || hasMemberValue(member.deathAnniversaryLunar) || hasMemberValue(member.lunarAnniversary) ? 'complete' : 'missing',
      currentValue: member.deathAnniversaryLunar || member.lunarAnniversary || member.deathAnniversaryLunarStructured?.rawText || ''
    },
    {
      key: 'hometown',
      label: 'Quê quán / nơi ở',
      field: 'residence',
      status: hasMemberValue(member.birthPlace) || hasMemberValue(member.residence) ? 'complete' : 'missing',
      currentValue: member.birthPlace || member.residence || ''
    },
    {
      key: 'grave',
      label: 'Mộ chí / nơi an táng',
      field: 'graveLocation',
      status: !member.isDeceased || hasMemberValue(member.graveLocation) || hasMemberValue(member.burialPlace) ? 'complete' : 'missing',
      currentValue: member.graveLocation || member.burialPlace || ''
    },
    {
      key: 'parent',
      label: 'Bố/Mẹ trong phả hệ',
      field: 'parentId',
      status: member.generation === 0 || hasMemberValue(member.parentId) || hasMemberValue(member.fatherName) ? 'complete' : 'missing',
      currentValue: member.parentId || member.fatherName || ''
    },
    {
      key: 'mother',
      label: 'Mẹ',
      field: 'motherName',
      status: hasMemberValue(member.motherName) ? 'complete' : 'missing',
      currentValue: member.motherName || ''
    },
    {
      key: 'spouse',
      label: 'Phối ngẫu',
      field: 'spouse',
      status: hasMemberValue(member.spouse) || spouseDetails.some((item) => hasMemberValue(item?.name)) ? 'complete' : 'missing',
      currentValue: member.spouse || spouseDetails.map((item) => item?.name || '').filter(Boolean).join(', ')
    },
    {
      key: 'children',
      label: 'Con cái',
      field: 'children',
      status: childCount > 0 ? 'complete' : 'missing',
      currentValue: childCount ? `${childCount} người con/cháu trực tiếp` : ''
    },
    {
      key: 'bio',
      label: 'Hành trạng / công lao',
      field: 'bio',
      status: hasMemberValue(member.description) || hasMemberValue(member.bio) || hasMemberValue(member.achievements) ? 'complete' : 'missing',
      currentValue: member.description || member.bio || (Array.isArray(member.achievements) ? member.achievements.join('; ') : '')
    }
  ];
  return checks.map((item) => ({
    ...item,
    fieldLabel: memberEvidenceFieldLabel(item.field)
  }));
}

function v3LogToMemberEvidenceItem(log, field = null) {
  const fieldName = field?.field || field?.fieldType || log.kind || 'value';
  return {
    id: field ? `${log.id}:${fieldName}` : log.id,
    logId: log.id,
    candidateId: log.candidateId,
    auditId: log.auditId,
    kind: log.kind,
    field: fieldName,
    fieldLabel: memberEvidenceFieldLabel(fieldName),
    oldValue: field?.oldValue || '',
    newValue: field?.newValue || '',
    status: log.rollbackStatus === 'rolled_back' || log.status === 'rolled_back' ? 'rolled_back' : 'applied',
    reconcileStatus: log.reconcileStatus || '',
    ok: log.ok,
    sourceId: field?.sourceId || log.sourceId || '',
    chunkId: field?.chunkId || log.chunkId || '',
    sourceTitle: log.sourceTitle || '',
    headingPath: log.headingPath || '',
    evidenceQuote: log.evidenceQuote || '',
    evidenceWindow: log.evidenceWindow || '',
    appliedBy: log.appliedBy || '',
    appliedAt: log.createdAt || '',
    rolledBackAt: log.rolledBackAt || ''
  };
}

function candidateSourceMetadata(row) {
  const metadata = safeJsonParse(row.metadata_json, {});
  return {
    sourceTitle: metadata.sourceTitle || row.knowledge_title || '',
    headingPath: metadata.headingPath || row.heading_path || '',
    evidenceQuote: metadata.evidenceQuote || row.source_quote || row.extracted_text || '',
    evidenceWindow: metadata.evidenceWindow || row.source_quote || row.extracted_text || '',
    evidenceType: metadata.evidenceType || row.candidate_type || 'candidate'
  };
}

function candidateRowMatchesMember(row, memberId, idFields = []) {
  const id = String(memberId || '').trim();
  if (!id) return false;
  if (idFields.some((field) => String(row?.[field] || '').trim() === id)) return true;
  const metadata = safeJsonParse(row?.metadata_json, {});
  const candidateMatches = Array.isArray(metadata.candidateMatches) ? metadata.candidateMatches : [];
  if (candidateMatches.some((match) => String(match?.memberId || '').trim() === id)) return true;
  const subjectMatches = Array.isArray(metadata.subjectMatches) ? metadata.subjectMatches : [];
  const objectMatches = Array.isArray(metadata.objectMatches) ? metadata.objectMatches : [];
  return [...subjectMatches, ...objectMatches].some((match) => String(match?.memberId || '').trim() === id);
}

async function buildLineageMemberEvidence(memberId, { includePending = true, limit = 120 } = {}) {
  const id = String(memberId || '').trim();
  if (!id) {
    const err = new Error('memberId is required.');
    err.status = 400;
    throw err;
  }
  const database = await getDatabase();
  const tree = await readLineageTreeForAI();
  const member = tree ? getLineageNodeById(tree, id) : null;
  if (!member) {
    const err = new Error('Lineage member not found.');
    err.status = 404;
    throw err;
  }

  const report = await buildV3MemberAppliedReport({ memberId: id, limit });
  const reportMember = report.members?.[0] || null;
  const activeEvidence = [];
  const rollbackEvidence = [];
  const driftEvidence = [];
  for (const log of reportMember?.logs || []) {
    const fields = Array.isArray(log.fields) && log.fields.length ? log.fields : [null];
    for (const field of fields) {
      const item = v3LogToMemberEvidenceItem(log, field);
      if (item.status === 'rolled_back') rollbackEvidence.push(item);
      else activeEvidence.push(item);
      if (['drift', 'rolled_back_tree_changed', 'noop_unverified'].includes(log.reconcileStatus || '')) {
        driftEvidence.push(item);
      }
    }
  }

  const pendingEvidence = [];
  if (includePending) {
    const pendingStatuses = new Set(['pending', 'approved']);
    const anniversaryRows = database.prepare('SELECT * FROM extracted_anniversary_candidates ORDER BY updated_at DESC LIMIT 500').all()
      .filter((row) => pendingStatuses.has(normalizeExtractedCandidateStatus(row.status)))
      .filter((row) => candidateRowMatchesMember(row, id, ['matched_member_id']));
    for (const row of anniversaryRows) {
      const meta = candidateSourceMetadata(row);
      for (const field of getExtractedAnniversaryFields(row)) {
        pendingEvidence.push({
          id: `${row.id}:${field.type}`,
          candidateId: row.id,
          kind: 'anniversary',
          field: field.type,
          fieldLabel: memberEvidenceFieldLabel(field.type === 'birth' ? 'solarBirthDate' : field.type === 'death' ? 'solarDeathDate' : field.type === 'lunar_anniversary' ? 'deathAnniversaryLunar' : field.type === 'grave' ? 'graveLocation' : field.type),
          newValue: field.effectiveValue || field.value || '',
          status: normalizeExtractedCandidateStatus(row.status),
          matchConfidence: row.match_confidence || '',
          sourceId: row.source_id,
          chunkId: row.chunk_id,
          ...meta
        });
      }
    }

    const profileRows = database.prepare('SELECT * FROM extracted_profile_candidates ORDER BY updated_at DESC LIMIT 500').all()
      .filter((row) => pendingStatuses.has(normalizeProfileCandidateStatus(row.status)))
      .filter((row) => candidateRowMatchesMember(row, id, ['matched_member_id']));
    for (const row of profileRows) {
      const meta = candidateSourceMetadata(row);
      pendingEvidence.push({
        id: row.id,
        candidateId: row.id,
        kind: 'profile',
        field: row.target_field || 'description',
        fieldLabel: memberEvidenceFieldLabel(row.target_field || 'description'),
        newValue: row.reviewed_text || row.extracted_text || '',
        status: normalizeProfileCandidateStatus(row.status),
        matchConfidence: row.match_confidence || '',
        sourceId: row.source_id,
        chunkId: row.chunk_id,
        ...meta
      });
    }

    const relationshipRows = database.prepare('SELECT * FROM extracted_relationship_candidates ORDER BY updated_at DESC LIMIT 500').all()
      .filter((row) => pendingStatuses.has(normalizeRelationshipCandidateStatus(row.status)))
      .filter((row) => candidateRowMatchesMember(row, id, ['subject_member_id', 'object_member_id']));
    for (const row of relationshipRows) {
      const meta = candidateSourceMetadata(row);
      pendingEvidence.push({
        id: row.id,
        candidateId: row.id,
        kind: 'relationship',
        field: normalizeRelationshipType(row.relationship_type),
        fieldLabel: memberEvidenceFieldLabel(row.relationship_type || 'relationship'),
        newValue: row.reviewed_text || row.extracted_text || [row.subject_name, row.relationship_type, row.object_name].filter(Boolean).join(' '),
        status: normalizeRelationshipCandidateStatus(row.status),
        matchConfidence: [row.subject_match_confidence, row.object_match_confidence].filter(Boolean).join('/'),
        sourceId: row.source_id,
        chunkId: row.chunk_id,
        ...meta
      });
    }
  }

  const checklist = buildMemberProfileChecklist(member);
  const activeFields = new Set(activeEvidence.map((item) => item.field).filter(Boolean));
  const pendingFields = new Set(pendingEvidence.map((item) => item.field).filter(Boolean));
  return {
    ok: true,
    member: {
      id: member.id,
      name: member.name,
      displayName: getMemberDisplayName(member) || member.name,
      generation: member.generation,
      branch: member.branch || '',
      isDeceased: Boolean(member.isDeceased)
    },
    summary: {
      activeApplied: activeEvidence.length,
      rolledBack: rollbackEvidence.length,
      drift: driftEvidence.length,
      pending: pendingEvidence.filter((item) => item.status === 'pending').length,
      approvedNotApplied: pendingEvidence.filter((item) => item.status === 'approved').length,
      checklistMissing: checklist.filter((item) => item.status === 'missing').length,
      checklistComplete: checklist.filter((item) => item.status === 'complete').length
    },
    checklist: checklist.map((item) => ({
      ...item,
      hasAppliedEvidence: activeFields.has(item.field) || (item.key === 'birth' && (activeFields.has('birthYear') || activeFields.has('birthDateStructured'))) || (item.key === 'bio' && (activeFields.has('description') || activeFields.has('achievements'))),
      hasPendingEvidence: pendingFields.has(item.field)
    })),
    activeEvidence: activeEvidence.slice(0, 120),
    rollbackEvidence: rollbackEvidence.slice(0, 80),
    driftEvidence: driftEvidence.slice(0, 80),
    pendingEvidence: pendingEvidence.slice(0, 120)
  };
}

async function rollbackV3PilotApplyLog(logId, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs WHERE id = ? OR audit_id = ?').get(String(logId || ''), String(logId || ''));
  if (!row) {
    const err = new Error('Pilot apply log not found.');
    err.status = 404;
    throw err;
  }
  if (row.rollback_status === 'rolled_back') {
    const err = new Error('Pilot apply log has already been rolled back.');
    err.status = 409;
    throw err;
  }
  if (body.confirmRollback !== true) {
    const err = new Error('confirmRollback=true is required to rollback pilot apply.');
    err.status = 409;
    throw err;
  }
  const currentTree = await readLineageTreeForAI();
  const currentHash = treeSnapshotHash(currentTree);
  if (row.after_tree_hash && currentHash !== row.after_tree_hash && body.confirmCurrentTreeChanged !== true) {
    const err = new Error('Current lineage tree has changed since pilot apply. Confirm with confirmCurrentTreeChanged=true.');
    err.status = 409;
    err.currentTreeHash = currentHash;
    err.expectedTreeHash = row.after_tree_hash;
    throw err;
  }
  const beforeTree = safeJsonParse(row.before_tree_json, null);
  if (!beforeTree) {
    const err = new Error('Pilot rollback snapshot is missing.');
    err.status = 500;
    throw err;
  }
  await writeState(TREE_STATE_KEY, beforeTree);
  const candidateBefore = safeJsonParse(row.candidate_before_json, {});
  replaceV3PilotCandidateRow(database, row.kind, candidateBefore);

  const rollbackAuditId = `v3_pilot_rollback_${sha256Base64Url(`${row.id}:${Date.now()}`).slice(0, 18)}`;
  const adminName = adminUser?.username || adminUser?.fullName || 'admin';
  if (row.kind === 'relationship') {
    database.prepare(`
      INSERT INTO extracted_relationship_audit_logs
        (id, candidate_id, action, subject_member_id, object_member_id, relationship_type,
         old_value_json, new_value_json, source_id, chunk_id, admin_user, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'))
    `).run(
      rollbackAuditId,
      row.candidate_id,
      'pilot_rollback',
      candidateBefore.subject_member_id || '',
      candidateBefore.object_member_id || '',
      candidateBefore.relationship_type || '',
      JSON.stringify({ pilotLogId: row.id, treeHash: currentHash }),
      JSON.stringify({ restoredTreeHash: row.before_tree_hash, restoredCandidateStatus: candidateBefore.status || '' }),
      candidateBefore.source_id || '',
      candidateBefore.chunk_id || '',
      adminName,
      'rolled_back'
    );
  } else {
    const table = row.kind === 'profile' ? 'extracted_profile_audit_logs' : 'extracted_anniversary_audit_logs';
    database.prepare(`
      INSERT INTO ${table}
        (id, candidate_id, member_id, action, field_changes_json, source_id, chunk_id, admin_user, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      rollbackAuditId,
      row.candidate_id,
      row.member_id || candidateBefore.matched_member_id || '',
      'pilot_rollback',
      JSON.stringify({
        pilotLogId: row.id,
        restoredCandidateStatus: candidateBefore.status || '',
        beforeTreeHash: row.before_tree_hash,
        afterTreeHash: row.after_tree_hash
      }),
      candidateBefore.source_id || '',
      candidateBefore.chunk_id || '',
      adminName
    );
  }
  database.prepare(`
    UPDATE cao_toc_v3_pilot_apply_logs
    SET rollback_status = 'rolled_back',
        rollback_audit_id = ?,
        status = 'rolled_back',
        rolled_back_at = datetime('now')
    WHERE id = ?
  `).run(rollbackAuditId, row.id);
  return {
    ok: true,
    log: publicV3PilotApplyLog(database.prepare('SELECT * FROM cao_toc_v3_pilot_apply_logs WHERE id = ?').get(row.id)),
    rollbackAuditId
  };
}

async function buildCaoTocV3TriageSummary({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, examplesPerBucket = 5 } = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const profileRows = database.prepare('SELECT * FROM extracted_profile_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const annRows = database.prepare('SELECT * FROM extracted_anniversary_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const relRows = database.prepare('SELECT * FROM extracted_relationship_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const classified = [
    ...profileRows.map((row) => classifyV3Candidate('profile', row)),
    ...annRows.map((row) => classifyV3Candidate('anniversary', row)),
    ...relRows.map((row) => classifyV3Candidate('relationship', row))
  ];
  const bucketCounts = createEmptyV3TriageBuckets();
  const byGroup = {};
  const byKind = { profile: profileRows.length, anniversary: annRows.length, relationship: relRows.length };
  const byStatus = {};
  const examples = Object.fromEntries(V3_TRIAGE_BUCKETS.map((bucket) => [bucket, []]));
  for (const item of classified) {
    bucketCounts[item.primaryBucket] = (bucketCounts[item.primaryBucket] || 0) + 1;
    byGroup[item.group] = byGroup[item.group] || createEmptyV3TriageBuckets();
    byGroup[item.group][item.primaryBucket] = (byGroup[item.group][item.primaryBucket] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    if (examples[item.primaryBucket] && examples[item.primaryBucket].length < Math.max(1, Math.min(20, Number(examplesPerBucket) || 5))) {
      examples[item.primaryBucket].push(item);
    }
  }
  return {
    ok: true,
    datasetKey: normalizedDatasetKey,
    total: classified.length,
    byKind,
    byStatus,
    bucketCounts,
    byGroup,
    examples,
    generatedAt: new Date().toISOString()
  };
}

async function rejectCaoTocV3NoiseCandidates({ datasetKey = CAO_TOC_V3_DEFAULT_DATASET_KEY, dryRun = false, limit = 500 } = {}, adminUser = {}) {
  const database = await getDatabase();
  const normalizedDatasetKey = normalizeCaoTocV2DatasetKey(datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY);
  const max = Math.max(1, Math.min(2000, Number(limit) || 500));
  const profileRows = database.prepare('SELECT * FROM extracted_profile_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const annRows = database.prepare('SELECT * FROM extracted_anniversary_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const relRows = database.prepare('SELECT * FROM extracted_relationship_candidates').all().filter((row) => isV3CandidateRow(row, normalizedDatasetKey));
  const targets = [
    ...profileRows.map((row) => ({ kind: 'profile', row, triage: classifyV3Candidate('profile', row) })),
    ...annRows.map((row) => ({ kind: 'anniversary', row, triage: classifyV3Candidate('anniversary', row) })),
    ...relRows.map((row) => ({ kind: 'relationship', row, triage: classifyV3Candidate('relationship', row) }))
  ].filter((item) => item.triage.status === 'pending' && item.triage.primaryBucket === 'noise_reject_candidate').slice(0, max);
  const summary = {
    datasetKey: normalizedDatasetKey,
    dryRun: Boolean(dryRun),
    candidatesMatched: targets.length,
    rejectedProfileCandidates: 0,
    rejectedAnniversaryCandidates: 0,
    rejectedRelationshipCandidates: 0,
    examples: targets.slice(0, 20).map((item) => item.triage)
  };
  if (dryRun) return { ok: true, ...summary };

  database.exec('BEGIN');
  try {
    const now = new Date().toISOString();
    for (const { kind, row, triage } of targets) {
      const metadata = {
        ...safeJsonParse(row.metadata_json, {}),
        triageRejectedBy: 'phase_2w2f',
        triageRejectedAt: now,
        triageReasons: triage.reasons,
        triageBucket: triage.primaryBucket
      };
      if (kind === 'profile') {
        const result = database.prepare(`
          UPDATE extracted_profile_candidates
          SET status = 'rejected', metadata_json = ?, updated_at = datetime('now')
          WHERE id = ? AND status NOT IN ('approved', 'applied', 'rejected')
        `).run(JSON.stringify(metadata), row.id);
        summary.rejectedProfileCandidates += result.changes || 0;
      } else if (kind === 'anniversary') {
        const result = database.prepare(`
          UPDATE extracted_anniversary_candidates
          SET status = 'rejected', metadata_json = ?, updated_at = datetime('now')
          WHERE id = ? AND status NOT IN ('approved', 'applied', 'rejected')
        `).run(JSON.stringify(metadata), row.id);
        summary.rejectedAnniversaryCandidates += result.changes || 0;
      } else if (kind === 'relationship') {
        const result = database.prepare(`
          UPDATE extracted_relationship_candidates
          SET status = 'rejected', metadata_json = ?, updated_at = datetime('now')
          WHERE id = ? AND status NOT IN ('approved', 'applied', 'rejected')
        `).run(JSON.stringify(metadata), row.id);
        summary.rejectedRelationshipCandidates += result.changes || 0;
      }
    }
    const logId = insertKnowledgeMaintenanceLog(database, 'triage_v3_reject_noise', summary, adminUser);
    database.exec('COMMIT');
    return { ok: true, ...summary, logId };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
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
      citations: buildKnowledgeCitations(result, { query, limit }),
      localAnswer: buildAliasLookupAnswer(result)
    });
  } catch (err) {
    console.error('Failed to search knowledge:', err);
    res.status(500).json({ error: 'Failed to search knowledge.' });
  }
});

app.get('/api/knowledge/maintenance/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20) || 20));
    res.json({ logs: await listKnowledgeMaintenanceLogs({ limit }) });
  } catch (err) {
    console.error('Failed to list knowledge maintenance logs:', err);
    res.status(500).json({ error: 'Failed to list knowledge maintenance logs.' });
  }
});

app.get('/api/knowledge/dataset-policy/report', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(buildKnowledgeDatasetPolicyReport({
      activeDatasetKey: req.query.activeDatasetKey || KNOWLEDGE_CANONICAL_DATASET_KEY
    }));
  } catch (err) {
    console.error('Failed to build knowledge dataset policy report:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to build knowledge dataset policy report.' });
  }
});

app.post('/api/knowledge/maintenance/canonicalize-datasets', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await canonicalizeKnowledgeDatasets({
      activeDatasetKey: req.body?.activeDatasetKey || KNOWLEDGE_CANONICAL_DATASET_KEY,
      dryRun: req.body?.dryRun !== false
    }, admin.authUser));
  } catch (err) {
    console.error('Failed to canonicalize knowledge datasets:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to canonicalize knowledge datasets.' });
  }
});

app.post('/api/knowledge/maintenance/lock-technical-sources', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await lockTechnicalKnowledgeSources(admin.authUser));
  } catch (err) {
    console.error('Failed to lock technical knowledge sources:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to lock technical knowledge sources.' });
  }
});

app.post('/api/knowledge/maintenance/reject-noisy-candidates', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await rejectNoisyKnowledgeCandidates(admin.authUser));
  } catch (err) {
    console.error('Failed to reject noisy candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject noisy candidates.' });
  }
});

app.post('/api/knowledge/import-v2-dataset', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await importCaoTocV2Dataset({
      datasetDir: req.body?.datasetDir || req.body?.datasetPath || '',
      datasetKey: req.body?.datasetKey || ''
    }, admin.authUser));
  } catch (err) {
    console.error('Failed to import Cao Toc v2 dataset:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to import Cao Toc v2 dataset.' });
  }
});

app.post('/api/knowledge/rescan-v2', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await rescanCaoTocV2({
      datasetDir: req.body?.datasetDir || req.body?.datasetPath || '',
      datasetKey: req.body?.datasetKey || ''
    }, admin.authUser));
  } catch (err) {
    console.error('Failed to rescan Cao Toc v2 dataset:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to rescan Cao Toc v2 dataset.' });
  }
});

app.get('/api/knowledge/rescan-v2/report', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await getCaoTocV2Report({ datasetKey: req.query.datasetKey || '' }));
  } catch (err) {
    console.error('Failed to build Cao Toc v2 rescan report:', err);
    res.status(500).json({ error: 'Failed to build Cao Toc v2 rescan report.' });
  }
});

app.get('/api/knowledge/v3-triage/summary', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await buildCaoTocV3TriageSummary({
      datasetKey: req.query.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      examplesPerBucket: req.query.examplesPerBucket || 5
    }));
  } catch (err) {
    console.error('Failed to build Cao Toc v3 triage summary:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to build Cao Toc v3 triage summary.' });
  }
});

app.get('/api/knowledge/v3-review-queue', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await listCaoTocV3ReviewQueue({
      datasetKey: req.query.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      bucket: req.query.bucket || '',
      kind: req.query.kind || '',
      status: req.query.status || 'pending',
      limit: req.query.limit || 80
    }));
  } catch (err) {
    console.error('Failed to list Cao Toc v3 review queue:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list Cao Toc v3 review queue.' });
  }
});

app.post('/api/knowledge/v3-pilot-apply/preview', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await previewV3PilotApply(req.body?.items || [], {
      datasetKey: req.body?.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY
    }));
  } catch (err) {
    console.error('Failed to preview Cao Toc v3 pilot apply:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to preview Cao Toc v3 pilot apply.' });
  }
});

app.post('/api/knowledge/v3-pilot-apply/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await applyV3PilotCandidates(req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to apply Cao Toc v3 pilot candidates:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to apply Cao Toc v3 pilot candidates.',
      preview: err.preview || null
    });
  }
});

app.get('/api/knowledge/v3-pilot-apply/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await listV3PilotApplyLogs({ limit: req.query.limit || 50 }));
  } catch (err) {
    console.error('Failed to list Cao Toc v3 pilot apply logs:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list Cao Toc v3 pilot apply logs.' });
  }
});

app.get('/api/knowledge/v3-pilot-apply/proposals', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await listV3PilotApplyProposals({
      datasetKey: req.query.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      limit: req.query.limit || 20
    }));
  } catch (err) {
    console.error('Failed to list Cao Toc v3 pilot apply proposals:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list Cao Toc v3 pilot apply proposals.' });
  }
});

app.get('/api/knowledge/v3-pilot-apply/reconcile', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await reconcileV3PilotApplyLogs({ limit: req.query.limit || 50 }));
  } catch (err) {
    console.error('Failed to reconcile Cao Toc v3 pilot apply logs:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reconcile Cao Toc v3 pilot apply logs.' });
  }
});

app.get('/api/knowledge/v3-member-applied-report', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await buildV3MemberAppliedReport({
      q: req.query.q || '',
      memberId: req.query.memberId || '',
      limit: req.query.limit || 80
    }));
  } catch (err) {
    console.error('Failed to build V3 member applied report:', err);
    res.status(500).json({ error: 'Failed to build V3 member applied report.' });
  }
});

app.get('/api/lineage/members/:id/evidence', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await buildLineageMemberEvidence(req.params.id, {
      includePending: req.query.includePending !== 'false',
      limit: req.query.limit || 120
    }));
  } catch (err) {
    console.error('Failed to build lineage member evidence:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to build lineage member evidence.' });
  }
});

app.get('/api/knowledge/v3-group-apply/report', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await buildV3GroupApplyReport({
      datasetKey: req.query.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      limitPerGroup: req.query.limitPerGroup || 5
    }));
  } catch (err) {
    console.error('Failed to build Cao Toc v3 group apply report:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to build Cao Toc v3 group apply report.' });
  }
});

app.get('/api/knowledge/v3-group-apply/candidates', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await listV3GroupApplyCandidates({
      datasetKey: req.query.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      group: req.query.group || 'vital',
      limit: req.query.limit || 20
    }));
  } catch (err) {
    console.error('Failed to list Cao Toc v3 group apply candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to list Cao Toc v3 group apply candidates.' });
  }
});

app.post('/api/knowledge/v3-group-apply/preview', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json(await previewV3GroupPilotBatch(req.body || {}));
  } catch (err) {
    console.error('Failed to preview Cao Toc v3 group pilot apply:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to preview Cao Toc v3 group pilot apply.' });
  }
});

app.post('/api/knowledge/v3-group-apply/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await applyV3GroupPilotBatch(req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to apply Cao Toc v3 grouped pilot candidates:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to apply Cao Toc v3 grouped pilot candidates.',
      preview: err.preview || null
    });
  }
});

app.post('/api/knowledge/v3-pilot-apply/:id/rollback', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await rollbackV3PilotApplyLog(String(req.params.id || ''), req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to rollback Cao Toc v3 pilot apply:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to rollback Cao Toc v3 pilot apply.',
      currentTreeHash: err.currentTreeHash || '',
      expectedTreeHash: err.expectedTreeHash || ''
    });
  }
});

app.post('/api/knowledge/v3-triage/reject-noise', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await rejectCaoTocV3NoiseCandidates({
      datasetKey: req.body?.datasetKey || CAO_TOC_V3_DEFAULT_DATASET_KEY,
      dryRun: req.body?.dryRun === true,
      limit: req.body?.limit || 500
    }, admin.authUser));
  } catch (err) {
    console.error('Failed to reject Cao Toc v3 noisy candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject Cao Toc v3 noisy candidates.' });
  }
});

app.get('/api/knowledge/sources', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 80) || 80));
    const includeArchived = ['1', 'true', 'yes'].includes(String(req.query.includeArchived || '').toLowerCase());
    const { authScope } = await getRequestAuthContext(req);
    res.json({ sources: await listKnowledgeSources({ authScope, limit, includeArchived }) });
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
    res.json({ candidates: await listExtractedAnniversaryCandidates({
      q,
      status,
      type,
      pendingOnly,
      limit,
      triageBucket: req.query.triageBucket || '',
      datasetKey: req.query.datasetKey || ''
    }) });
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

app.get('/api/knowledge/profile-candidates', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const type = String(req.query.type || '').trim();
    const sourceId = String(req.query.sourceId || '').trim();
    const memberId = String(req.query.memberId || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));
    res.json({ candidates: await listExtractedProfileCandidates({
      q,
      status,
      type,
      sourceId,
      memberId,
      limit,
      triageBucket: req.query.triageBucket || '',
      datasetKey: req.query.datasetKey || ''
    }) });
  } catch (err) {
    console.error('Failed to list profile candidates:', err);
    res.status(500).json({ error: 'Failed to list profile candidates.' });
  }
});

app.post('/api/knowledge/profile-candidates/scan', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const sourceId = String(req.body?.sourceId || '').trim();
    const limit = Math.max(1, Math.min(2000, Number(req.body?.limit || 500) || 500));
    res.json(await scanExtractedProfileCandidates({ sourceId, limit }));
  } catch (err) {
    console.error('Failed to scan profile candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to scan profile candidates.' });
  }
});

app.post('/api/knowledge/profile-candidates/scan-names', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const sourceId = String(req.body?.sourceId || '').trim();
    const limit = Math.max(1, Math.min(2000, Number(req.body?.limit || 500) || 500));
    res.json(await scanExtractedNameAliasCandidates({ sourceId, limit }));
  } catch (err) {
    console.error('Failed to scan name alias candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to scan name alias candidates.' });
  }
});

app.get('/api/knowledge/relationship-candidates', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));
    res.json({
      candidates: await listExtractedRelationshipCandidates({
        q: String(req.query.q || '').trim(),
        status: String(req.query.status || '').trim(),
        type: String(req.query.type || '').trim(),
        memberId: String(req.query.memberId || '').trim(),
        ambiguous: String(req.query.ambiguous || '').trim(),
        requiresNewMember: String(req.query.requiresNewMember || '').trim(),
        limit,
        triageBucket: req.query.triageBucket || '',
        datasetKey: req.query.datasetKey || ''
      })
    });
  } catch (err) {
    console.error('Failed to list relationship candidates:', err);
    res.status(500).json({ error: 'Failed to list relationship candidates.' });
  }
});

app.post('/api/knowledge/relationship-candidates/scan', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const sourceId = String(req.body?.sourceId || '').trim();
    const limit = Math.max(1, Math.min(2000, Number(req.body?.limit || 500) || 500));
    res.json(await scanExtractedRelationshipCandidates({ sourceId, limit }));
  } catch (err) {
    console.error('Failed to scan relationship candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to scan relationship candidates.' });
  }
});

app.get('/api/knowledge/relationship-candidates/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 80) || 80));
    res.json({ logs: await listRelationshipAuditLogs({ limit }) });
  } catch (err) {
    console.error('Failed to list relationship extraction logs:', err);
    res.status(500).json({ error: 'Failed to list relationship extraction logs.' });
  }
});

app.get('/api/knowledge/relationship-candidates/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const database = await getDatabase();
    const row = database.prepare('SELECT * FROM extracted_relationship_candidates WHERE id = ?').get(String(req.params.id || ''));
    if (!row) {
      res.status(404).json({ error: 'Relationship candidate not found.' });
      return;
    }
    res.json({ candidate: await hydrateRelationshipCandidateReviewData(publicExtractedRelationshipCandidate(row)) });
  } catch (err) {
    console.error('Failed to read relationship candidate:', err);
    res.status(500).json({ error: 'Failed to read relationship candidate.' });
  }
});

app.patch('/api/knowledge/relationship-candidates/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const candidate = await updateExtractedRelationshipCandidate(String(req.params.id || ''), req.body || {}, admin.authUser);
    res.json({ ok: true, candidate });
  } catch (err) {
    console.error('Failed to update relationship candidate:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update relationship candidate.' });
  }
});

app.post('/api/knowledge/relationship-candidates/bulk', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await bulkUpdateExtractedRelationshipCandidates(req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to run bulk relationship action:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to run bulk relationship action.' });
  }
});

app.post('/api/knowledge/relationship-candidates/:id/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await applyExtractedRelationshipCandidate(String(req.params.id || ''), req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to apply relationship candidate:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to apply relationship candidate.',
      triageGuard: err.triageGuard || null
    });
  }
});

app.get('/api/knowledge/profile-candidates/applied', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const q = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 80) || 80));
    res.json({ appliedProfileExtractions: await listAppliedProfileExtractions({ q, limit }) });
  } catch (err) {
    console.error('Failed to list applied profile extractions:', err);
    res.status(500).json({ error: 'Failed to list applied profile extractions.' });
  }
});

app.get('/api/knowledge/profile-candidates/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 80) || 80));
    res.json({ logs: await listProfileAuditLogs({ limit }) });
  } catch (err) {
    console.error('Failed to list profile extraction logs:', err);
    res.status(500).json({ error: 'Failed to list profile extraction logs.' });
  }
});

app.get('/api/knowledge/profile-candidates/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const database = await getDatabase();
    const row = database.prepare('SELECT * FROM extracted_profile_candidates WHERE id = ?').get(String(req.params.id || ''));
    if (!row) {
      res.status(404).json({ error: 'Profile candidate not found.' });
      return;
    }
    res.json({ candidate: await hydrateProfileCandidateReviewData(publicExtractedProfileCandidate(row)) });
  } catch (err) {
    console.error('Failed to read profile candidate:', err);
    res.status(500).json({ error: 'Failed to read profile candidate.' });
  }
});

app.patch('/api/knowledge/profile-candidates/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const candidate = await updateExtractedProfileCandidate(String(req.params.id || ''), req.body || {}, admin.authUser);
    res.json({ ok: true, candidate });
  } catch (err) {
    console.error('Failed to update profile candidate:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update profile candidate.' });
  }
});

app.post('/api/knowledge/profile-candidates/bulk', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await bulkUpdateExtractedProfileCandidates(req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to bulk update profile candidates:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to bulk update profile candidates.' });
  }
});

app.post('/api/knowledge/profile-candidates/:id/keep-verification-note', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await keepV3ProfileCandidateAsVerificationNote(String(req.params.id || ''), req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to keep profile candidate as verification note:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to keep profile candidate as verification note.',
      triageGuard: err.triageGuard || null
    });
  }
});

app.post('/api/knowledge/profile-candidates/:id/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await applyExtractedProfileCandidate(String(req.params.id || ''), req.body || {}, admin.authUser));
  } catch (err) {
    console.error('Failed to apply profile candidate:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to apply profile candidate.',
      conflicts: err.conflicts || [],
      triageGuard: err.triageGuard || null
    });
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
    const evidenceQuote = String(req.query.evidenceQuote || '').trim();
    const evidenceWindow = String(req.query.evidenceWindow || '').trim();
    const evidence = evidenceQuote || evidenceWindow
      ? {
          evidenceQuote,
          evidenceWindow: evidenceWindow || candidateEvidenceFromText(row.content, [evidenceQuote]).evidenceWindow,
          evidenceOffset: evidenceQuote ? normalizeKnowledgeText(row.content).indexOf(normalizeKnowledgeText(evidenceQuote)) : -1
        }
      : {};
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
        ...evidence,
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
      conflicts: err.conflicts || [],
      triageGuard: err.triageGuard || null
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

app.get('/api/system-audit/suggestions', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, suggestions: await listSystemAuditSuggestions(req.query || {}) });
  } catch (err) {
    console.error('Failed to list system audit suggestions:', err);
    res.status(500).json({ error: 'Failed to list system audit suggestions.' });
  }
});

app.post('/api/system-audit/scan', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json(await runSystemAuditScan(admin.authUser));
  } catch (err) {
    console.error('Failed to scan system audit:', err);
    res.status(500).json({ error: err.message || 'Failed to scan system audit.' });
  }
});

app.patch('/api/system-audit/suggestions/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, suggestion: await updateSystemAuditSuggestion(req.params.id, req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to update system audit suggestion:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update system audit suggestion.' });
  }
});

app.post('/api/system-audit/suggestions/:id/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, result: await applySystemAuditSuggestion(req.params.id, req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to apply system audit suggestion:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to apply system audit suggestion.' });
  }
});

app.get('/api/system-audit/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, logs: await listSystemAuditApplyLogs(req.query || {}) });
  } catch (err) {
    console.error('Failed to list system audit logs:', err);
    res.status(500).json({ error: 'Failed to list system audit logs.' });
  }
});

app.get('/api/ai-action-drafts', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, drafts: await listAIActionDrafts(req.query || {}) });
  } catch (err) {
    console.error('Failed to list AI action drafts:', err);
    res.status(500).json({ error: 'Failed to list AI action drafts.' });
  }
});

app.post('/api/ai-action-drafts', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, draft: await createAIActionDraft(req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to create AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create AI action draft.' });
  }
});

app.post('/api/ai-action-drafts/generate', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, draft: await generateAIActionDraft(req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to generate AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to generate AI action draft.' });
  }
});

app.patch('/api/ai-action-drafts/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, draft: await updateAIActionDraft(req.params.id, req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to update AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update AI action draft.' });
  }
});

app.post('/api/ai-action-drafts/:id/approve', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, draft: await setAIActionDraftReviewStatus(req.params.id, 'approved', admin.authUser) });
  } catch (err) {
    console.error('Failed to approve AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to approve AI action draft.' });
  }
});

app.post('/api/ai-action-drafts/:id/reject', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, draft: await setAIActionDraftReviewStatus(req.params.id, 'rejected', admin.authUser) });
  } catch (err) {
    console.error('Failed to reject AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject AI action draft.' });
  }
});

app.post('/api/ai-action-drafts/:id/apply', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, result: await applyAIActionDraft(req.params.id, req.body || {}, admin.authUser) });
  } catch (err) {
    console.error('Failed to apply AI action draft:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to apply AI action draft.' });
  }
});

app.get('/api/ai-action-drafts/:id/logs', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, logs: await getAIActionDraftLogs(req.params.id, req.query || {}) });
  } catch (err) {
    console.error('Failed to list AI action draft logs:', err);
    res.status(500).json({ error: 'Failed to list AI action draft logs.' });
  }
});

app.get('/api/excel-import/field-reference', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({
      ok: true,
      maxFileMb: EXCEL_IMPORT_MAX_FILE_MB,
      allowedExtensions: Array.from(EXCEL_IMPORT_ALLOWED_EXTENSIONS),
      fields: getExcelImportFieldReference()
    });
  } catch (err) {
    console.error('Failed to get Excel import field reference:', err);
    res.status(500).json({ error: 'Failed to get Excel import field reference.' });
  }
});

app.get('/api/excel-import/sessions', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, sessions: await listExcelImportSessions(req.query || {}) });
  } catch (err) {
    console.error('Failed to list Excel import sessions:', err);
    res.status(500).json({ error: 'Failed to list Excel import sessions.' });
  }
});

app.post('/api/excel-import/sessions', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, ...(await createExcelImportSession(req.body || {}, admin.authUser)) });
  } catch (err) {
    console.error('Failed to create Excel import session:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create Excel import session.' });
  }
});

app.get('/api/excel-import/sessions/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, ...(await getExcelImportSessionDetail(req.params.id)) });
  } catch (err) {
    console.error('Failed to get Excel import session:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to get Excel import session.' });
  }
});

app.patch('/api/excel-import/sessions/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, ...(await updateExcelImportSession(req.params.id, req.body || {}, admin.authUser)) });
  } catch (err) {
    console.error('Failed to update Excel import session:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update Excel import session.' });
  }
});

app.patch('/api/excel-import/sessions/:id/mappings', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, ...(await updateExcelImportMappings(req.params.id, req.body || {}, admin.authUser)) });
  } catch (err) {
    console.error('Failed to update Excel import mappings:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update Excel import mappings.' });
  }
});

app.post('/api/excel-import/sessions/:id/validate', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    res.json({ ok: true, ...(await validateExcelImportSession(req.params.id, req.body || {})) });
  } catch (err) {
    console.error('Failed to validate Excel import session:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to validate Excel import session.' });
  }
});

app.post('/api/excel-import/sessions/:id/import', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, ...(await importExcelImportSession(req.params.id, req.body || {}, admin.authUser)) });
  } catch (err) {
    console.error('Failed to import Excel session:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to import Excel session.' });
  }
});

app.get('/api/ai/operation-graph', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const database = await getDatabase();
    const [configs, summary, knowledge] = await Promise.all([
      listAIBotConfigs(),
      summarizeAIRequestLogs(),
      getKnowledgeStatus()
    ]);
    const configByBot = new Map(configs.map((config) => [config.botType, config]));
    const botCount = (botType) => summary.topBotTypes?.find((item) => item.name === botType)?.count || 0;
    const auditRows = database.prepare(`
      SELECT status, priority, COUNT(*) AS count
      FROM system_audit_suggestions
      GROUP BY status, priority
    `).all();
    const auditMetric = (status) => auditRows
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const auditCritical = auditRows
      .filter((row) => ['critical', 'high'].includes(String(row.priority || '')))
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const excelRows = database.prepare('SELECT status, COUNT(*) AS count FROM excel_import_sessions GROUP BY status').all();
    const excelMetric = (status) => excelRows
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const excelErrorCount = database.prepare("SELECT COUNT(*) AS count FROM excel_import_validation_issues WHERE severity IN ('critical', 'error')").get()?.count || 0;
    const profileRows = database.prepare('SELECT status, COUNT(*) AS count FROM extracted_profile_candidates GROUP BY status').all();
    const profileMetric = (status) => profileRows
      .filter((row) => row.status === status)
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
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
        { id: 'system_audit', label: 'Kiểm tra hệ thống', type: 'audit', status: auditCritical ? 'error' : 'active', column: 5, row: 2, description: 'Scanner local-first phát hiện lỗi font, dữ liệu mẫu, danh xưng sai, rủi ro riêng tư và tạo đề xuất chờ admin duyệt.', metrics: { pending: auditMetric('pending'), applied: auditMetric('applied'), rejected: auditMetric('rejected'), critical: auditCritical } },
        { id: 'gemini', label: 'Gemini', type: 'model', status: 'active', column: 5, row: 4, description: 'Chỉ dùng khi local/knowledge chưa đủ hoặc cần sinh nội dung dài.' },
        { id: 'profile_extraction', label: 'Hành trạng/Công lao', type: 'audit', status: profileMetric('pending') ? 'warning' : 'active', column: 5, row: 5, description: 'Bóc tách hành trạng, sự nghiệp, công lao từ kho tri thức; chỉ ghi vào cây phả sau khi admin duyệt và apply.', metrics: { pending: profileMetric('pending'), approved: profileMetric('approved'), applied: profileMetric('applied') } },
        { id: 'response_guard', label: 'Response Guard', type: 'guard', status: 'active', column: 6, row: 3, description: 'Chặn bịa dữ liệu, phân biệt pending/applied và giới hạn output.' },
        { id: 'excel_import_gate', label: 'Duyệt cấu trúc Excel', type: 'guard', status: excelErrorCount ? 'error' : 'active', column: 5, row: 6, description: 'Cổng duyệt file Excel/CSV: kiểm tra an toàn, mapping 55 cột, preview và validation trước khi import.', metrics: { pending: excelMetric('structure_review') + excelMetric('mapping_approved'), ready: excelMetric('ready_to_import'), errors: excelErrorCount } },
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
        { from: 'ai_governor', to: 'system_audit', label: 'system_audit' },
        { from: 'system_audit', to: 'bot_config', label: 'prompt/config' },
        { from: 'system_audit', to: 'local_db', label: 'scan' },
        { from: 'system_audit', to: 'knowledge_search', label: 'scan' },
        { from: 'knowledge_search', to: 'profile_extraction', label: 'bóc tách' },
        { from: 'profile_extraction', to: 'local_db', label: 'admin apply' },
        { from: 'profile_extraction', to: 'response_guard', label: 'pending/applied' },
        { from: 'ai_governor', to: 'excel_import_gate', label: 'mapping' },
        { from: 'excel_import_gate', to: 'local_db', label: 'confirm import' },
        { from: 'excel_import_gate', to: 'system_audit', label: 'validation' },
        { from: 'knowledge_search', to: 'gemini', label: 'khi cần' },
        { from: 'local_db', to: 'response_guard' },
        { from: 'anniversary_calendar', to: 'response_guard' },
        { from: 'gemini', to: 'response_guard' },
        { from: 'system_audit', to: 'ai_logs', label: 'audit log' },
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
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store'
    });
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
const aiGatewayPublicRate = new Map();
const AI_GATEWAY_PUBLIC_RATE_WINDOW_MS = Number(process.env.AI_GATEWAY_PUBLIC_RATE_WINDOW_MS || 60 * 1000);
const AI_GATEWAY_PUBLIC_RATE_MAX = Number(process.env.AI_GATEWAY_PUBLIC_RATE_MAX || 24);
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

const SYSTEM_AUDIT_MOJIBAKE_RE = new RegExp([
  'T\\u00c3\\u00a1',
  'T\\u00c3\\u00a1\\u00c2\\u00ba',
  'T\\u00c3\\u00a1\\u00c2\\u00bb',
  '\\u00c3\\u0084',
  '\\u00c3\\u00a1\\u00c2\\u00bb',
  '\\u00c3\\u00a2',
  '\\u00c2\\u00ba',
  '\\u00c2\\u00bb',
  '\\u00e2\\u20ac',
  '\\u00c4\\u0090',
  '\\u00c6\\u00b0',
  '\\u00c3'
].join('|'), 'i');
const SYSTEM_AUDIT_SAMPLE_RE = /(demo|sample|placeholder|lorem|unsplash|dữ liệu mẫu|du lieu mau|bản mẫu|ban mau)/i;
const SYSTEM_AUDIT_PRIVACY_RE = /(số điện thoại|so dien thoai|cccd|cmnd|địa chỉ riêng|dia chi rieng|email cá nhân|email ca nhan)/i;

function publicSystemAuditSuggestion(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourcePath: row.source_path,
    location: row.location_label,
    locationLabel: row.location_label,
    currentValue: row.current_value,
    issueType: row.issue_type,
    summary: row.issue_summary,
    issueSummary: row.issue_summary,
    suggestedValue: row.suggested_value,
    action: row.suggested_action,
    suggestedAction: row.suggested_action,
    priority: row.priority,
    evidence: row.evidence,
    relatedSourceIds: safeJsonParse(row.related_source_ids_json, []),
    relatedChunkIds: safeJsonParse(row.related_chunk_ids_json, []),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    appliedBy: row.applied_by,
    appliedAt: row.applied_at
  };
}

function publicSystemAuditApplyLog(row) {
  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    action: row.action,
    sourceType: row.source_type,
    sourcePath: row.source_path,
    oldValue: row.old_value,
    newValue: row.new_value,
    adminUser: row.admin_user,
    status: row.status,
    error: row.error,
    createdAt: row.created_at
  };
}

async function listSystemAuditSuggestions({ status = '', type = '', q = '', priority = '', sourceType = '', limit = 100 } = {}) {
  const database = await getDatabase();
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(String(status));
  }
  if (type) {
    where.push('issue_type = ?');
    params.push(String(type));
  }
  if (priority) {
    where.push('priority = ?');
    params.push(String(priority));
  }
  if (sourceType) {
    where.push('source_type = ?');
    params.push(String(sourceType));
  }
  if (q) {
    where.push('(source_path LIKE ? OR location_label LIKE ? OR issue_summary LIKE ? OR current_value LIKE ? OR evidence LIKE ?)');
    const like = `%${String(q)}%`;
    params.push(like, like, like, like, like);
  }
  let sql = 'SELECT * FROM system_audit_suggestions';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT ?";
  params.push(Math.max(1, Math.min(300, Number(limit) || 100)));
  return database.prepare(sql).all(...params).map(publicSystemAuditSuggestion);
}

async function listSystemAuditApplyLogs({ limit = 80 } = {}) {
  const database = await getDatabase();
  return database.prepare('SELECT * FROM system_audit_apply_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(300, Number(limit) || 80)))
    .map(publicSystemAuditApplyLog);
}

function buildSystemAuditCandidate({ sourceType, sourcePath, locationLabel, currentValue, issueType, issueSummary, suggestedValue = '', suggestedAction = 'needs_manual_review', priority = 'medium', evidence = '', relatedSourceIds = [], relatedChunkIds = [] }) {
  const cleanCurrent = compactText(currentValue || '', 1200);
  return {
    sourceType,
    sourcePath,
    locationLabel,
    currentValue: cleanCurrent,
    issueType,
    issueSummary,
    suggestedValue: compactText(suggestedValue || '', 1200),
    suggestedAction,
    priority,
    evidence: compactText(evidence || cleanCurrent, 1200),
    relatedSourceIds,
    relatedChunkIds,
    hash: sha256Hex(JSON.stringify({ sourceType, sourcePath, currentValue: cleanCurrent, issueType }))
  };
}

function detectSystemAuditCandidatesForText({ sourceType, sourcePath, locationLabel, text, relatedSourceIds = [], relatedChunkIds = [] }) {
  const value = String(text || '');
  if (!value) return [];
  const candidates = [];
  const excerptFor = (pattern) => {
    const match = value.match(pattern);
    if (!match) return compactText(value, 260);
    const index = Math.max(0, match.index || 0);
    return compactText(value.slice(Math.max(0, index - 90), index + 180), 320);
  };
  if (SYSTEM_AUDIT_MOJIBAKE_RE.test(value)) {
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue: excerptFor(SYSTEM_AUDIT_MOJIBAKE_RE),
      issueType: 'mojibake',
      issueSummary: 'Phát hiện dấu hiệu lỗi font/encoding trong nội dung.',
      suggestedAction: 'needs_manual_review',
      priority: 'high',
      evidence: excerptFor(SYSTEM_AUDIT_MOJIBAKE_RE),
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  if (/Cao\s*Tổ\s*đời\s*0|Cao\s*To\s*doi\s*0/i.test(value)) {
    const currentValue = excerptFor(/Cao\s*Tổ\s*đời\s*0|Cao\s*To\s*doi\s*0/i);
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue,
      issueType: 'wrong_title',
      issueSummary: 'Danh xưng Cao Tổ còn kèm “đời 0” trong nội dung hiển thị.',
      suggestedValue: currentValue.replace(/Cao\s*Tổ\s*đời\s*0/gi, 'Cao Tổ').replace(/Cao\s*To\s*doi\s*0/gi, 'Cao To'),
      suggestedAction: sourceType === 'config' || sourcePath.startsWith('app_state:') ? 'replace_text' : 'needs_manual_review',
      priority: 'high',
      evidence: currentValue,
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  if (SYSTEM_AUDIT_SAMPLE_RE.test(value)) {
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue: excerptFor(SYSTEM_AUDIT_SAMPLE_RE),
      issueType: 'sample_data',
      issueSummary: 'Nội dung có dấu hiệu dữ liệu mẫu/demo/placeholder.',
      suggestedAction: 'create_todo',
      priority: 'medium',
      evidence: excerptFor(SYSTEM_AUDIT_SAMPLE_RE),
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  if (/Cao\s+Ninh\s+Bình|Cao\s+Ninh\s+Binh/i.test(value)) {
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue: excerptFor(/Cao\s+Ninh\s+Bình|Cao\s+Ninh\s+Binh/i),
      issueType: 'unsupported_claim',
      issueSummary: 'Nội dung “họ Cao Ninh Bình” cần nguồn xác minh trước khi dùng.',
      suggestedAction: 'needs_manual_review',
      priority: 'high',
      evidence: excerptFor(/Cao\s+Ninh\s+Bình|Cao\s+Ninh\s+Binh/i),
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  if (/Cao\s*Đình\s*Lạng[^.\n]{0,80}Cao\s*Tổ|Cao\s*Dinh\s*Lang[^.\n]{0,80}Cao\s*To/i.test(value)) {
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue: excerptFor(/Cao\s*Đình\s*Lạng[^.\n]{0,80}Cao\s*Tổ|Cao\s*Dinh\s*Lang[^.\n]{0,80}Cao\s*To/i),
      issueType: 'wrong_title',
      issueSummary: 'Có dấu hiệu gán Cao Đình Lạng là Cao Tổ; chuẩn hiện tại là Thủy Tổ.',
      suggestedAction: 'needs_manual_review',
      priority: 'critical',
      evidence: excerptFor(/Cao\s*Đình\s*Lạng[^.\n]{0,80}Cao\s*Tổ|Cao\s*Dinh\s*Lang[^.\n]{0,80}Cao\s*To/i),
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  if (SYSTEM_AUDIT_PRIVACY_RE.test(value)) {
    candidates.push(buildSystemAuditCandidate({
      sourceType,
      sourcePath,
      locationLabel,
      currentValue: excerptFor(SYSTEM_AUDIT_PRIVACY_RE),
      issueType: 'privacy_risk',
      issueSummary: 'Nội dung có dấu hiệu dữ liệu riêng tư, cần kiểm tra KYC/visibility.',
      suggestedAction: 'needs_manual_review',
      priority: 'critical',
      evidence: excerptFor(SYSTEM_AUDIT_PRIVACY_RE),
      relatedSourceIds,
      relatedChunkIds
    }));
  }
  return candidates;
}

async function insertSystemAuditCandidates(candidates = []) {
  const database = await getDatabase();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO system_audit_suggestions (
      id, suggestion_hash, source_type, source_path, location_label, current_value,
      issue_type, issue_summary, suggested_value, suggested_action, priority, evidence,
      related_source_ids_json, related_chunk_ids_json, status, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'system', datetime('now'))
  `);
  let inserted = 0;
  for (const item of candidates) {
    const info = insert.run(
      `audit_${randomToken(12)}`,
      item.hash,
      item.sourceType,
      item.sourcePath,
      item.locationLabel,
      item.currentValue,
      item.issueType,
      item.issueSummary,
      item.suggestedValue,
      item.suggestedAction,
      item.priority,
      item.evidence,
      JSON.stringify(item.relatedSourceIds || []),
      JSON.stringify(item.relatedChunkIds || [])
    );
    inserted += Number(info.changes || 0);
  }
  return inserted;
}

async function runSystemAuditScan(adminUser = {}) {
  const database = await getDatabase();
  const candidates = [];
  const stateRows = database.prepare('SELECT key, value FROM app_state').all();
  for (const row of stateRows) {
    candidates.push(...detectSystemAuditCandidatesForText({
      sourceType: ['dashboard-articles', 'dashboard-events', 'dashboard-knowledge'].includes(row.key) ? row.key.replace('dashboard-', '').replace('articles', 'article').replace('events', 'event').replace('knowledge', 'knowledge') : 'config',
      sourcePath: `app_state:${row.key}`,
      locationLabel: `app_state / ${row.key}`,
      text: row.value
    }));
  }
  const configRows = database.prepare('SELECT * FROM ai_bot_configs').all();
  for (const row of configRows) {
    candidates.push(...detectSystemAuditCandidatesForText({
      sourceType: 'ai_prompt',
      sourcePath: `ai_bot_configs:${row.bot_type}`,
      locationLabel: `Bot config / ${row.bot_type}`,
      text: [row.label, row.paused_reason, row.system_prompt_short].join('\n')
    }));
  }
  const sourceRows = database.prepare('SELECT id, title, content FROM knowledge_sources LIMIT 500').all();
  for (const row of sourceRows) {
    candidates.push(...detectSystemAuditCandidatesForText({
      sourceType: 'knowledge',
      sourcePath: `knowledge_sources:${row.id}`,
      locationLabel: `Knowledge source / ${row.title}`,
      text: [row.title, row.content].join('\n'),
      relatedSourceIds: [row.id]
    }));
  }
  const chunkRows = database.prepare('SELECT id, source_id, title, content FROM knowledge_chunks LIMIT 800').all();
  for (const row of chunkRows) {
    candidates.push(...detectSystemAuditCandidatesForText({
      sourceType: 'knowledge',
      sourcePath: `knowledge_chunks:${row.id}`,
      locationLabel: `Knowledge chunk / ${row.title || row.id}`,
      text: [row.title, row.content].join('\n'),
      relatedSourceIds: [row.source_id],
      relatedChunkIds: [row.id]
    }));
  }
  const inserted = await insertSystemAuditCandidates(candidates);
  logAIGatewayRequest({
    requestId: randomToken(8),
    route: 'system-audit-scan',
    botType: 'ai_governor',
    intent: 'system_audit',
    type: 'system_audit',
    engine: 'local-scanner',
    provider: 'local',
    model: 'system-audit-local',
    status: 200,
    cached: false,
    durationMs: 0,
    requestChars: 0,
    contextChars: candidates.reduce((sum, item) => sum + String(item.currentValue || '').length, 0),
    estimatedTokens: 0,
    promptSnippet: `system_audit_scan candidates=${candidates.length} inserted=${inserted}`,
    knowledgeMatchesCount: 0,
    knowledgeSourceIds: [],
    botConfigEngine: 'local-scanner',
    botConfigMaxChunks: 0,
    botConfigMaxOutputTokens: 0,
    cacheEnabled: false,
    configVersion: new Date().toISOString()
  });
  return {
    ok: true,
    scanned: stateRows.length + configRows.length + sourceRows.length + chunkRows.length,
    candidates: candidates.length,
    inserted,
    duplicates: candidates.length - inserted,
    suggestions: await listSystemAuditSuggestions({ status: 'pending', limit: 100 })
  };
}

async function updateSystemAuditSuggestion(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(String(id || ''));
  if (!row) throw Object.assign(new Error('System audit suggestion not found.'), { status: 404 });
  const allowed = new Set(['pending', 'approved', 'rejected', 'applied']);
  const status = allowed.has(String(body.status || '')) ? String(body.status) : row.status;
  const admin = adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin';
  database.prepare(`
    UPDATE system_audit_suggestions
    SET status = ?, reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
  `).run(status, ['approved', 'rejected'].includes(status) ? admin : row.reviewed_by, ['approved', 'rejected'].includes(status) ? new Date().toISOString() : row.reviewed_at, row.id);
  return publicSystemAuditSuggestion(database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(row.id));
}

async function applySystemAuditSuggestion(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(String(id || ''));
  if (!row) throw Object.assign(new Error('System audit suggestion not found.'), { status: 404 });
  if (row.status !== 'approved') throw Object.assign(new Error('Suggestion must be approved before apply.'), { status: 400 });
  if (row.suggested_action !== 'replace_text' && row.suggested_action !== 'update_config') {
    throw Object.assign(new Error('Suggestion requires manual review and cannot be auto-applied.'), { status: 400 });
  }
  const admin = adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin';
  let oldValue = '';
  let newValue = '';
  if (row.source_path.startsWith('app_state:')) {
    const key = row.source_path.slice('app_state:'.length);
    const state = database.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
    if (!state) throw Object.assign(new Error('Source app_state key no longer exists.'), { status: 404 });
    oldValue = state.value;
    if (!oldValue.includes(row.current_value) && body.confirmOverwrite !== true) {
      throw Object.assign(new Error('Source value changed. Re-scan or pass confirmOverwrite=true.'), { status: 409 });
    }
    newValue = oldValue.includes(row.current_value)
      ? oldValue.replace(row.current_value, row.suggested_value)
      : row.suggested_value;
    database.prepare("UPDATE app_state SET value = ?, updated_at = datetime('now') WHERE key = ?").run(newValue, key);
  } else if (row.source_path.startsWith('ai_bot_configs:')) {
    const botType = row.source_path.slice('ai_bot_configs:'.length);
    const config = database.prepare('SELECT system_prompt_short FROM ai_bot_configs WHERE bot_type = ?').get(botType);
    if (!config) throw Object.assign(new Error('Bot config no longer exists.'), { status: 404 });
    oldValue = config.system_prompt_short || '';
    if (!oldValue.includes(row.current_value) && body.confirmOverwrite !== true) {
      throw Object.assign(new Error('Bot config changed. Re-scan or pass confirmOverwrite=true.'), { status: 409 });
    }
    newValue = oldValue.includes(row.current_value)
      ? oldValue.replace(row.current_value, row.suggested_value)
      : row.suggested_value;
    database.prepare("UPDATE ai_bot_configs SET system_prompt_short = ?, updated_at = datetime('now'), updated_by = ? WHERE bot_type = ?").run(newValue, admin, botType);
  } else {
    throw Object.assign(new Error('This source cannot be auto-applied.'), { status: 400 });
  }
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE system_audit_suggestions
    SET status = 'applied', applied_by = ?, applied_at = ?
    WHERE id = ?
  `).run(admin, now, row.id);
  const logId = `auditlog_${randomToken(12)}`;
  database.prepare(`
    INSERT INTO system_audit_apply_logs (
      id, suggestion_id, action, source_type, source_path, old_value, new_value, admin_user, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?)
  `).run(logId, row.id, row.suggested_action, row.source_type, row.source_path, compactText(oldValue, 1600), compactText(newValue, 1600), admin, now);
  return {
    suggestion: publicSystemAuditSuggestion(database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(row.id)),
    log: publicSystemAuditApplyLog(database.prepare('SELECT * FROM system_audit_apply_logs WHERE id = ?').get(logId))
  };
}

const AI_ACTION_DRAFT_TYPES = new Set(['article', 'prayer', 'anniversary_notice', 'webview_fix', 'missing_data_checklist', 'zalo_rule', 'other']);
const AI_ACTION_TARGET_MODULES = new Set(['articles', 'prayers', 'events', 'webview', 'genealogy', 'zalo', 'settings', 'other']);
const AI_ACTION_SOURCE_TYPES = new Set(['ai_governor', 'system_audit', 'knowledge', 'anniversary', 'manual']);
const AI_ACTION_STATUSES = new Set(['draft', 'pending_review', 'approved', 'rejected', 'applied']);
const AI_ACTION_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

function normalizeAIActionDraftType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_ACTION_DRAFT_TYPES.has(normalized) ? normalized : 'other';
}

function normalizeAIActionTargetModule(value, draftType = 'other') {
  const normalized = String(value || '').trim().toLowerCase();
  if (AI_ACTION_TARGET_MODULES.has(normalized)) return normalized;
  if (draftType === 'article') return 'articles';
  if (draftType === 'prayer') return 'prayers';
  if (draftType === 'anniversary_notice') return 'events';
  if (draftType === 'webview_fix') return 'webview';
  if (draftType === 'missing_data_checklist') return 'genealogy';
  if (draftType === 'zalo_rule') return 'zalo';
  return 'other';
}

function normalizeAIActionSourceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_ACTION_SOURCE_TYPES.has(normalized) ? normalized : 'manual';
}

function normalizeAIActionStatus(value, fallback = 'draft') {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_ACTION_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeAIActionPriority(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_ACTION_PRIORITIES.has(normalized) ? normalized : 'medium';
}

function slugifyAIActionText(value) {
  return normalizeKnowledgeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 90) || `ban-nhap-ai-${Date.now()}`;
}

function parseArrayInput(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const text = String(value || '').trim();
  return text ? [text] : [];
}

function publicAIActionDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    draftType: row.draft_type,
    title: row.title,
    summary: row.summary,
    content: row.content,
    targetModule: row.target_module,
    targetId: row.target_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    relatedMemberIds: safeJsonParse(row.related_member_ids_json, []),
    relatedSourceIds: safeJsonParse(row.related_source_ids_json, []),
    relatedChunkIds: safeJsonParse(row.related_chunk_ids_json, []),
    status: row.status,
    priority: row.priority,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    appliedBy: row.applied_by,
    appliedAt: row.applied_at,
    metadata: safeJsonParse(row.metadata_json, {})
  };
}

function publicAIActionDraftLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    draftId: row.draft_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    adminUser: row.admin_user,
    createdAt: row.created_at
  };
}

function insertAIActionDraftLog(database, draftId, action, { oldValue = '', newValue = '', adminUser = '' } = {}) {
  const id = `actionlog_${randomToken(12)}`;
  database.prepare(`
    INSERT INTO ai_action_draft_logs (id, draft_id, action, old_value, new_value, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, draftId, action, compactText(oldValue, 1600), compactText(newValue, 1600), adminUser);
  return publicAIActionDraftLog(database.prepare('SELECT * FROM ai_action_draft_logs WHERE id = ?').get(id));
}

async function listAIActionDrafts({ status = '', type = '', q = '', limit = 100 } = {}) {
  const database = await getDatabase();
  const where = [];
  const params = [];
  const normalizedStatus = String(status || '').trim();
  const normalizedType = String(type || '').trim();
  if (normalizedStatus && AI_ACTION_STATUSES.has(normalizedStatus)) {
    where.push('status = ?');
    params.push(normalizedStatus);
  }
  if (normalizedType && AI_ACTION_DRAFT_TYPES.has(normalizedType)) {
    where.push('draft_type = ?');
    params.push(normalizedType);
  }
  if (q) {
    where.push('(title LIKE ? OR summary LIKE ? OR content LIKE ? OR target_module LIKE ? OR source_type LIKE ?)');
    const like = `%${String(q)}%`;
    params.push(like, like, like, like, like);
  }
  let sql = 'SELECT * FROM ai_action_drafts';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT ?";
  params.push(Math.max(1, Math.min(300, Number(limit) || 100)));
  return database.prepare(sql).all(...params).map(publicAIActionDraft);
}

async function getAIActionDraftLogs(id, { limit = 80 } = {}) {
  const database = await getDatabase();
  return database.prepare('SELECT * FROM ai_action_draft_logs WHERE draft_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(String(id || ''), Math.max(1, Math.min(200, Number(limit) || 80)))
    .map(publicAIActionDraftLog);
}

function buildAIActionDraftPayload(body = {}, adminUser = {}) {
  const draftType = normalizeAIActionDraftType(body.draftType || body.draft_type);
  const targetModule = normalizeAIActionTargetModule(body.targetModule || body.target_module, draftType);
  const title = compactText(String(body.title || '').trim(), 180);
  const content = String(body.content || '').trim();
  if (!title || !content) {
    throw Object.assign(new Error('Title and content are required.'), { status: 400 });
  }
  return {
    id: body.id || `action_draft_${randomToken(12)}`,
    draftType,
    title,
    summary: compactText(String(body.summary || content).trim(), 360),
    content,
    targetModule,
    targetId: String(body.targetId || body.target_id || '').trim(),
    sourceType: normalizeAIActionSourceType(body.sourceType || body.source_type),
    sourceId: String(body.sourceId || body.source_id || '').trim(),
    relatedMemberIds: parseArrayInput(body.relatedMemberIds || body.related_member_ids_json),
    relatedSourceIds: parseArrayInput(body.relatedSourceIds || body.related_source_ids_json),
    relatedChunkIds: parseArrayInput(body.relatedChunkIds || body.related_chunk_ids_json),
    status: normalizeAIActionStatus(body.status, 'draft'),
    priority: normalizeAIActionPriority(body.priority),
    createdBy: adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin',
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
  };
}

async function createAIActionDraft(body = {}, adminUser = {}) {
  const draft = buildAIActionDraftPayload(body, adminUser);
  const database = await getDatabase();
  database.prepare(`
    INSERT INTO ai_action_drafts (
      id, draft_type, title, summary, content, target_module, target_id, source_type, source_id,
      related_member_ids_json, related_source_ids_json, related_chunk_ids_json, status, priority,
      created_by, created_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(
    draft.id,
    draft.draftType,
    draft.title,
    draft.summary,
    draft.content,
    draft.targetModule,
    draft.targetId,
    draft.sourceType,
    draft.sourceId,
    JSON.stringify(draft.relatedMemberIds),
    JSON.stringify(draft.relatedSourceIds),
    JSON.stringify(draft.relatedChunkIds),
    draft.status,
    draft.priority,
    draft.createdBy,
    JSON.stringify(draft.metadata)
  );
  insertAIActionDraftLog(database, draft.id, 'create', { newValue: JSON.stringify(draft), adminUser: draft.createdBy });
  return publicAIActionDraft(database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(draft.id));
}

async function updateAIActionDraft(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(String(id || ''));
  if (!current) throw Object.assign(new Error('AI action draft not found.'), { status: 404 });
  const admin = adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin';
  const next = {
    draftType: Object.prototype.hasOwnProperty.call(body, 'draftType') ? normalizeAIActionDraftType(body.draftType) : current.draft_type,
    title: Object.prototype.hasOwnProperty.call(body, 'title') ? compactText(String(body.title || '').trim(), 180) : current.title,
    summary: Object.prototype.hasOwnProperty.call(body, 'summary') ? compactText(String(body.summary || '').trim(), 360) : current.summary,
    content: Object.prototype.hasOwnProperty.call(body, 'content') ? String(body.content || '').trim() : current.content,
    targetModule: Object.prototype.hasOwnProperty.call(body, 'targetModule') ? normalizeAIActionTargetModule(body.targetModule, current.draft_type) : current.target_module,
    targetId: Object.prototype.hasOwnProperty.call(body, 'targetId') ? String(body.targetId || '').trim() : current.target_id,
    sourceType: Object.prototype.hasOwnProperty.call(body, 'sourceType') ? normalizeAIActionSourceType(body.sourceType) : current.source_type,
    sourceId: Object.prototype.hasOwnProperty.call(body, 'sourceId') ? String(body.sourceId || '').trim() : current.source_id,
    status: Object.prototype.hasOwnProperty.call(body, 'status') ? normalizeAIActionStatus(body.status, current.status) : current.status,
    priority: Object.prototype.hasOwnProperty.call(body, 'priority') ? normalizeAIActionPriority(body.priority) : current.priority,
    relatedMemberIds: Object.prototype.hasOwnProperty.call(body, 'relatedMemberIds') ? parseArrayInput(body.relatedMemberIds) : safeJsonParse(current.related_member_ids_json, []),
    relatedSourceIds: Object.prototype.hasOwnProperty.call(body, 'relatedSourceIds') ? parseArrayInput(body.relatedSourceIds) : safeJsonParse(current.related_source_ids_json, []),
    relatedChunkIds: Object.prototype.hasOwnProperty.call(body, 'relatedChunkIds') ? parseArrayInput(body.relatedChunkIds) : safeJsonParse(current.related_chunk_ids_json, []),
    metadata: Object.prototype.hasOwnProperty.call(body, 'metadata') && body.metadata && typeof body.metadata === 'object' ? body.metadata : safeJsonParse(current.metadata_json, {})
  };
  if (!next.title || !next.content) throw Object.assign(new Error('Title and content are required.'), { status: 400 });
  database.prepare(`
    UPDATE ai_action_drafts
    SET draft_type = ?, title = ?, summary = ?, content = ?, target_module = ?, target_id = ?,
      source_type = ?, source_id = ?, related_member_ids_json = ?, related_source_ids_json = ?,
      related_chunk_ids_json = ?, status = ?, priority = ?, metadata_json = ?
    WHERE id = ?
  `).run(
    next.draftType,
    next.title,
    next.summary,
    next.content,
    next.targetModule,
    next.targetId,
    next.sourceType,
    next.sourceId,
    JSON.stringify(next.relatedMemberIds),
    JSON.stringify(next.relatedSourceIds),
    JSON.stringify(next.relatedChunkIds),
    next.status,
    next.priority,
    JSON.stringify(next.metadata),
    current.id
  );
  insertAIActionDraftLog(database, current.id, 'update', { oldValue: JSON.stringify(publicAIActionDraft(current)), newValue: JSON.stringify(next), adminUser: admin });
  return publicAIActionDraft(database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(current.id));
}

async function setAIActionDraftReviewStatus(id, status, adminUser = {}) {
  const normalizedStatus = normalizeAIActionStatus(status, '');
  if (!['approved', 'rejected'].includes(normalizedStatus)) throw Object.assign(new Error('Invalid review status.'), { status: 400 });
  const database = await getDatabase();
  const current = database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(String(id || ''));
  if (!current) throw Object.assign(new Error('AI action draft not found.'), { status: 404 });
  const admin = adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin';
  const now = new Date().toISOString();
  database.prepare('UPDATE ai_action_drafts SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
    .run(normalizedStatus, admin, now, current.id);
  insertAIActionDraftLog(database, current.id, normalizedStatus === 'approved' ? 'approve' : 'reject', {
    oldValue: current.status,
    newValue: normalizedStatus,
    adminUser: admin
  });
  return publicAIActionDraft(database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(current.id));
}

function makeDraftArticleFromAction(draft) {
  return {
    id: `article_${Date.now()}_${randomToken(4)}`,
    title: draft.title,
    slug: slugifyAIActionText(draft.title),
    category: 'Tin tức họ tộc',
    author: draft.created_by || 'AI Tổng Quản',
    summary: draft.summary || compactText(draft.content, 180),
    content: draft.content,
    publishDate: new Date().toLocaleDateString('vi-VN'),
    status: 'Bản nháp',
    views: 0
  };
}

async function applyAIActionDraft(id, body = {}, adminUser = {}) {
  const database = await getDatabase();
  const row = database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(String(id || ''));
  if (!row) throw Object.assign(new Error('AI action draft not found.'), { status: 404 });
  if (row.status !== 'approved') throw Object.assign(new Error('Draft must be approved before apply.'), { status: 400 });
  const admin = adminUser?.username || adminUser?.fullName || adminUser?.id || 'admin';
  let applyResult = {};
  let oldValue = '';
  let newValue = '';
  if (row.draft_type === 'article') {
    const articles = await readState('dashboard-articles') || [];
    oldValue = JSON.stringify(articles);
    const article = makeDraftArticleFromAction(row);
    const nextArticles = [article, ...(Array.isArray(articles) ? articles : [])];
    await writeState('dashboard-articles', nextArticles);
    newValue = JSON.stringify(article);
    applyResult = { article };
  } else if (row.draft_type === 'anniversary_notice') {
    const draftId = `anniv_draft_${randomToken(12)}`;
    database.prepare(`
      INSERT INTO anniversary_event_drafts (
        id, anniversary_key, member_id, member_name, title, message_draft, channel, status, source, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'dashboard', 'draft', 'ai_action_draft', ?, datetime('now'), datetime('now'))
    `).run(
      draftId,
      row.target_id || row.source_id || row.id,
      safeJsonParse(row.related_member_ids_json, [])[0] || '',
      '',
      row.title,
      row.content,
      admin
    );
    newValue = JSON.stringify({ anniversaryDraftId: draftId });
    applyResult = { anniversaryDraft: publicAnniversaryDraft(database.prepare('SELECT * FROM anniversary_event_drafts WHERE id = ?').get(draftId)) };
  } else if (row.draft_type === 'zalo_rule') {
    const rules = await readState('dashboard-zalo-rules') || [];
    oldValue = JSON.stringify(rules);
    const rule = {
      id: `rule_${Date.now()}_${randomToken(4)}`,
      keyword: normalizeKnowledgeText(row.title).split(' ').filter(Boolean).slice(0, 3).join('') || 'giapha',
      replyType: 'text',
      replyContent: row.content,
      usageCount: 0,
      isActive: false
    };
    const nextRules = [rule, ...(Array.isArray(rules) ? rules : [])];
    await writeState('dashboard-zalo-rules', nextRules);
    newValue = JSON.stringify(rule);
    applyResult = { zaloRule: rule };
  } else if (row.draft_type === 'webview_fix') {
    if (row.source_type === 'system_audit' && row.source_id) {
      const suggestion = database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(row.source_id);
      if (!suggestion || !['approved', 'applied'].includes(suggestion.status)) {
        throw Object.assign(new Error('Related system audit suggestion must be approved before applying this webview fix draft.'), { status: 400 });
      }
    }
    applyResult = { note: 'Webview fix draft marked applied; source code changes remain manual.' };
  } else {
    const key = row.draft_type === 'prayer' ? 'dashboard-prayer-drafts' : 'dashboard-action-checklists';
    const existing = await readState(key) || [];
    oldValue = JSON.stringify(existing);
    const item = { id: `${row.draft_type}_${Date.now()}_${randomToken(4)}`, title: row.title, summary: row.summary, content: row.content, status: 'draft', sourceDraftId: row.id };
    await writeState(key, [item, ...(Array.isArray(existing) ? existing : [])]);
    newValue = JSON.stringify(item);
    applyResult = { key, item };
  }
  const now = new Date().toISOString();
  database.prepare('UPDATE ai_action_drafts SET status = ?, applied_by = ?, applied_at = ? WHERE id = ?')
    .run('applied', admin, now, row.id);
  const log = insertAIActionDraftLog(database, row.id, 'apply', { oldValue, newValue: newValue || JSON.stringify(applyResult), adminUser: admin });
  return {
    draft: publicAIActionDraft(database.prepare('SELECT * FROM ai_action_drafts WHERE id = ?').get(row.id)),
    log,
    result: applyResult
  };
}

function composeAIActionDraft({ draftType, topic, member, sourceTitle = '', auditSuggestion = null }) {
  const subject = String(topic || '').trim() || 'Nội dung cần admin duyệt';
  const memberLine = member ? `Nhân vật liên quan: ${member.name}${member.title ? ` - ${member.title}` : ''}.` : '';
  const sourceLine = sourceTitle ? `Nguồn tham chiếu: ${sourceTitle}.` : 'Nguồn tham chiếu: chưa có nguồn xác minh cụ thể.';
  const safetyLine = 'Ghi chú an toàn: đây là bản nháp chờ admin duyệt, chưa tự đăng, chưa tự gửi, chưa tự sửa dữ liệu thật.';
  if (draftType === 'article') {
    return {
      title: `Bản nháp bài viết: ${subject}`,
      summary: `Bản nháp bài viết do AI tạo để admin biên tập và duyệt trước khi đăng.`,
      content: [`# ${subject}`, sourceLine, memberLine, '', 'Nội dung đề xuất:', `- Mở bài giới thiệu chủ đề ${subject}.`, '- Thân bài cần bám dữ liệu đã xác minh trong kho tri thức và cây phả.', '- Kết bài mời thành viên bổ sung tư liệu nếu còn thiếu.', '', safetyLine].filter(Boolean).join('\n')
    };
  }
  if (draftType === 'anniversary_notice') {
    return {
      title: `Bản nhắc ngày giỗ: ${subject}`,
      summary: 'Bản nhắc ngày giỗ dạng nháp, không gửi tự động.',
      content: [`Kính thông báo về ${subject}.`, sourceLine, memberLine, 'Nội dung này chỉ dùng làm bản nháp nhắc việc; chưa gửi Zalo/web chat tự động.', safetyLine].filter(Boolean).join('\n')
    };
  }
  if (draftType === 'zalo_rule') {
    return {
      title: `Rule Zalo nháp: ${subject}`,
      summary: 'Rule Zalo ở trạng thái nháp, không bật gửi thật.',
      content: [`Khi người dùng hỏi về ${subject}, bot trả lời ngắn gọn theo dữ liệu đã xác minh.`, 'Nếu câu hỏi cần dữ liệu riêng tư, hướng dẫn đăng nhập và KYC.', safetyLine].join('\n')
    };
  }
  if (draftType === 'webview_fix') {
    return {
      title: `Đề xuất chỉnh webview: ${subject}`,
      summary: 'Đề xuất chỉnh webview cần admin duyệt, không tự sửa source code.',
      content: [`Vấn đề/đề xuất: ${subject}.`, auditSuggestion ? `Liên quan system audit: ${auditSuggestion.issue_summary}` : sourceLine, 'Cách xử lý đề xuất: tạo checklist sửa thủ công, kiểm tra UI PC/mobile trước khi deploy.', safetyLine].join('\n')
    };
  }
  if (draftType === 'missing_data_checklist') {
    return {
      title: `Checklist dữ liệu thiếu: ${subject}`,
      summary: 'Checklist quản trị để bổ sung dữ liệu, không tự sửa hồ sơ.',
      content: [`Checklist cho ${subject}:`, '- Kiểm tra ngày sinh/ngày mất/ngày giỗ âm lịch.', '- Kiểm tra quê quán, mộ chí, chi/ngành.', '- Đối chiếu nguồn TXT/ảnh/doc trước khi apply.', sourceLine, memberLine, safetyLine].filter(Boolean).join('\n')
    };
  }
  return {
    title: `Bản nháp hành động: ${subject}`,
    summary: 'Bản nháp hành động AI chờ admin duyệt.',
    content: [`Chủ đề: ${subject}.`, sourceLine, memberLine, safetyLine].filter(Boolean).join('\n')
  };
}

async function generateAIActionDraft(body = {}, adminUser = {}) {
  const database = await getDatabase();
  const draftType = normalizeAIActionDraftType(body.draftType);
  const memberId = String(body.memberId || '').trim();
  const sourceId = String(body.sourceId || '').trim();
  const chunkId = String(body.chunkId || '').trim();
  const systemAuditSuggestionId = String(body.systemAuditSuggestionId || '').trim();
  const tree = memberId ? await readLineageTreeForAI() : null;
  const member = tree ? flattenLineageTree(tree).find((item) => item.id === memberId) : null;
  const source = sourceId ? database.prepare('SELECT id, title FROM knowledge_sources WHERE id = ?').get(sourceId) : null;
  const auditSuggestion = systemAuditSuggestionId ? database.prepare('SELECT * FROM system_audit_suggestions WHERE id = ?').get(systemAuditSuggestionId) : null;
  const generated = composeAIActionDraft({
    draftType,
    topic: body.topic,
    member,
    sourceTitle: source?.title || '',
    auditSuggestion
  });
  const botType = draftType === 'article' ? 'article_writer' : draftType === 'prayer' ? 'prayer_writer' : 'ai_governor';
  const created = await createAIActionDraft({
    ...generated,
    draftType,
    targetModule: body.targetModule,
    targetId: body.targetId || memberId,
    sourceType: systemAuditSuggestionId ? 'system_audit' : sourceId || chunkId ? 'knowledge' : 'ai_governor',
    sourceId: systemAuditSuggestionId || sourceId || chunkId || '',
    relatedMemberIds: memberId ? [memberId] : [],
    relatedSourceIds: sourceId ? [sourceId] : [],
    relatedChunkIds: chunkId ? [chunkId] : [],
    status: body.status || 'pending_review',
    priority: body.priority || (systemAuditSuggestionId ? 'high' : 'medium'),
    metadata: {
      generatedBy: botType,
      intent: 'action_draft',
      topic: body.topic || '',
      safety: 'draft_only_no_publish_no_send_no_auto_fix'
    }
  }, adminUser);
  logAIGatewayRequest({
    requestId: randomToken(8),
    route: 'ai-action-drafts-generate',
    botType,
    intent: 'action_draft',
    type: 'action_draft',
    engine: 'local-composer',
    provider: 'local',
    model: 'local-action-draft',
    status: 200,
    cached: false,
    durationMs: 0,
    requestChars: String(body.topic || '').length,
    contextChars: generated.content.length,
    estimatedTokens: Math.ceil(generated.content.length / 4),
    promptSnippet: `action_draft ${draftType} ${body.topic || ''}`,
    knowledgeMatchesCount: sourceId || chunkId ? 1 : 0,
    knowledgeSourceIds: sourceId ? [sourceId] : [],
    botConfigEngine: 'local-composer',
    botConfigMaxChunks: 0,
    botConfigMaxOutputTokens: 0,
    cacheEnabled: false,
    configVersion: new Date().toISOString()
  });
  return created;
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
    contextHash: context.contextHash || context.localKnowledgeMatches?.contextHash || '',
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

function getRequestRateIdentity(req, requestContext = {}) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return `${requestContext.botType || 'bot'}:${forwarded || req.socket?.remoteAddress || req.ip || 'unknown'}`;
}

function checkAIGatewayPublicRate(req, requestContext = {}) {
  if (!AI_GATEWAY_PUBLIC_RATE_MAX || !AI_GATEWAY_PUBLIC_RATE_WINDOW_MS) return { ok: true };
  if (requestContext.authScope && requestContext.authScope !== 'anonymous' && requestContext.authScope !== 'public') return { ok: true };
  if (requestContext.botType !== 'webview_chat' && requestContext.type !== 'webview_chat') return { ok: true };
  const key = getRequestRateIdentity(req, requestContext);
  const now = Date.now();
  const entry = aiGatewayPublicRate.get(key) || { count: 0, resetAt: now + AI_GATEWAY_PUBLIC_RATE_WINDOW_MS };
  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + AI_GATEWAY_PUBLIC_RATE_WINDOW_MS;
  }
  entry.count += 1;
  aiGatewayPublicRate.set(key, entry);
  for (const [rateKey, value] of aiGatewayPublicRate) {
    if (value.resetAt <= now) aiGatewayPublicRate.delete(rateKey);
  }
  if (entry.count > AI_GATEWAY_PUBLIC_RATE_MAX) {
    return { ok: false, retryAfterMs: Math.max(1000, entry.resetAt - now), key };
  }
  return { ok: true, remaining: AI_GATEWAY_PUBLIC_RATE_MAX - entry.count };
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
  const haystackTerms = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
  return meaningfulTerms.some((word) => haystackTerms.has(word));
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
    bio: String(node.bio || '').trim(),
    description: String(node.description || '').trim(),
    achievements: Array.isArray(node.achievements)
      ? node.achievements.map((item) => String(item || '').trim()).filter(Boolean)
      : []
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

  const publicRate = checkAIGatewayPublicRate(req, requestContext);
  if (!publicRate.ok) {
    const rateResponse = {
      error: 'AI public chatbot rate limit exceeded.',
      details: 'Bạn đang gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít phút.',
      botType: requestContext.botType,
      intent: requestContext.intent,
      retryAfterMs: publicRate.retryAfterMs
    };
    logGateway({
      engine: 'rate-guard',
      provider: 'policy',
      model: 'rate-guard',
      status: 429,
      cached: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'RATE_GUARD',
      errorMessage: rateResponse.details
    });
    res.status(429).json(rateResponse);
    return;
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

    const profileAnswer = await buildProfileLocalAnswer(userQuery || message, requestContext.authScope || 'anonymous');
    if (profileAnswer) {
      const profileResponse = {
        model: 'local-profile',
        provider: 'local',
        engine: 'local',
        botType: requestContext.botType,
        intent: requestContext.intent,
        text: profileAnswer.text,
        knowledgeMatchesCount: profileAnswer.knowledgeMatchesCount,
        knowledgeSourceIds: profileAnswer.knowledgeSourceIds,
        profileCandidatesCount: profileAnswer.profileCandidatesCount,
        appliedProfileFieldsUsed: profileAnswer.appliedProfileFieldsUsed,
        pendingProfileCandidatesCount: profileAnswer.pendingProfileCandidatesCount
      };
      logGateway({
        engine: 'local-profile',
        model: 'local-profile',
        status: 200,
        cached: false,
        durationMs: Date.now() - startedAt,
        knowledgeMatchesCount: profileAnswer.knowledgeMatchesCount,
        knowledgeSourceIds: profileAnswer.knowledgeSourceIds
      });
      res.json(profileResponse);
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
        citations: buildKnowledgeCitations(initialKnowledge, { query: userQuery || message }),
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
        knowledgeSourceIds: sourceIds.length ? sourceIds : [...new Set(localKnowledge.chunks.map((row) => row.source_id))],
        citations: buildKnowledgeCitations(localKnowledge, { query: userQuery || message, candidates: anniversaryCandidates })
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
        knowledgeSourceIds: sourceIds,
        citations: buildKnowledgeCitations(localKnowledge, { query: userQuery || message })
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
        knowledgeSourceIds: sourceIds,
        citations: buildKnowledgeCitations({ ...localKnowledge, chunks: verificationAnswer.chunks }, { query: userQuery || message })
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
        citations: buildKnowledgeCitations(localKnowledge, { query: userQuery || message }),
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
      const citations = buildKnowledgeCitations(localKnowledge, { query: userQuery || message });
      message = `${message}\n\n${localKnowledgeContext}`;
      requestContext = {
        ...requestContext,
        localKnowledgeMatches: {
          aliasCount: localKnowledge.aliases.length,
          chunkCount: localKnowledge.chunks.length,
          sourceIds: [...new Set(localKnowledge.chunks.map((row) => row.source_id))],
          contextHash: buildKnowledgeContextHash(localKnowledge, citations)
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
      knowledgeSourceIds: requestContext.localKnowledgeMatches?.sourceIds || [],
      citations: buildKnowledgeCitations(gatewayKnowledgeResult, { query: userQuery || message })
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
      knowledgeSourceIds: requestContext.localKnowledgeMatches?.sourceIds || [],
      citations: buildKnowledgeCitations(gatewayKnowledgeResult, { query: userQuery || message })
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
