import express from 'express';
import { config as loadEnv } from 'dotenv';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '.env.local') });
loadEnv({ path: resolve(__dirname, '.env') });
const PORT = Number(process.env.API_PORT || 5174);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_FILE = resolve(__dirname, process.env.LINEAGE_DATA_FILE || 'data/lineage-tree.json');
const DATABASE_FILE = resolve(__dirname, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const DIST_DIR = resolve(__dirname, 'dist');
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
const isSecureCookie = APP_URL.startsWith('https://');

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
  `);
  return db;
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

app.get('/api/auth/users', async (_req, res) => {
  try {
    res.json({ users: await readAuthUsers() });
  } catch (err) {
    console.error('Failed to read auth users:', err);
    res.status(500).json({ error: 'Failed to read auth users.' });
  }
});

app.put('/api/auth/users', async (req, res) => {
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
    const value = Object.prototype.hasOwnProperty.call(req.body || {}, 'value') ? req.body.value : req.body;
    await writeState(key, value);
    res.json({ ok: true });
  } catch (err) {
    console.error(`Failed to save shared state ${key}:`, err);
    res.status(500).json({ error: 'Failed to save shared state.' });
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
const aiGatewayCache = new Map();

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizeGatewayText(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeAIGatewayContext(body = {}, routeName = 'ai-chat') {
  const type = normalizeGatewayText(body.type || body.intent || 'chat') || 'chat';
  const explicitIntent = normalizeGatewayText(body.intent);
  const explicitBotType = normalizeGatewayText(body.botType || body.bot_type);
  let intent = explicitIntent || type;
  let botType = explicitBotType || 'dashboard';

  if (type === 'webview_chat') {
    botType = explicitBotType || 'webview';
    intent = explicitIntent || 'chat';
  } else if (['zalo', 'zalo_campaign', 'campaign'].includes(type)) {
    botType = explicitBotType || 'zalo';
    intent = explicitIntent || 'campaign';
  } else if (['audit', 'chatbox_policy', 'policy'].includes(type)) {
    botType = explicitBotType || 'governor';
    intent = explicitIntent || type;
  } else if (['ceremony', 'prayer', 'han_nom', 'han-nom', 'appeal'].includes(type)) {
    intent = explicitIntent || 'ceremony';
  } else if (type === 'article') {
    intent = explicitIntent || 'article';
  }

  return {
    ...body,
    type,
    botType,
    intent,
    routeName
  };
}

function pickDashboardEngine(aiConfig = {}, intent = 'chat') {
  if (intent === 'ceremony') return aiConfig.engineCeremony || aiConfig.engineChat || 'gemini';
  if (intent === 'article') return aiConfig.engineArticles || aiConfig.engineChat || 'gemini';
  if (intent === 'campaign' || intent === 'zalo') return aiConfig.engineZalo || aiConfig.engineChat || 'gemini';
  return aiConfig.engineChat || 'gemini';
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
    engine: context.engine,
    modelName: context.modelName,
    temperature: context.temperature,
    docs
  }));
}

function getAIGatewayCachedResponse(cacheKey) {
  if (!AI_GATEWAY_CACHE_TTL_MS || !cacheKey) return null;
  const now = Date.now();
  pruneAIGatewayCache(now);
  const entry = aiGatewayCache.get(cacheKey);
  if (!entry || entry.expiresAt <= now) {
    aiGatewayCache.delete(cacheKey);
    return null;
  }
  return { ...entry.value, cached: true };
}

function setAIGatewayCachedResponse(cacheKey, value) {
  if (!AI_GATEWAY_CACHE_TTL_MS || !cacheKey || !value?.text) return;
  pruneAIGatewayCache();
  aiGatewayCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + AI_GATEWAY_CACHE_TTL_MS
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

function buildLocalAIResponse(req, message) {
  const lineageMatches = Array.isArray(req.body?.lineageMatches) ? req.body.lineageMatches : [];
  const eventMatches = Array.isArray(req.body?.eventMatches) ? req.body.eventMatches : [];
  if (isAnniversaryQuestion(message)) {
    const anniversaryMembers = lineageMatches.filter((member) => member?.deathAnniversaryLunar || member?.solarDeathDate || member?.deathYear);
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
    graveLocation: String(node.graveLocation || '').trim(),
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

function formatMemberContext(member, canShowPrivate) {
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
  return [...publicLines, ...privateLines].filter(Boolean).join('; ');
}

async function buildWebviewAIContext(req, message) {
  const session = await getAuthSession(req);
  const authUser = await findAuthUserForSession(session);
  const canShowPrivate = Boolean(
    authUser?.isKYCed &&
    authUser?.kycStatus === 'verified' &&
    authUser?.isApproved !== false &&
    authUser?.approvalStatus !== 'rejected'
  );

  if (!canShowPrivate && isSensitiveGenealogyQuestion(message)) {
    return {
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
    engine: pickDashboardEngine(dashboardAi, 'chat')
  };
}

async function buildDashboardAIContext(req, message, queryText) {
  const query = String(queryText || message || '').trim();
  const tree = await readLineageTreeForAI();
  const members = tree ? flattenLineageTree(tree) : [];
  const knowledgeDocs = await readState('dashboard-knowledge') || [];
  const dashboardEvents = await readState('dashboard-events') || [];
  const dashboardAi = await readState('dashboard-ai') || {};
  const providedDocs = Array.isArray(req.body?.documents) ? req.body.documents : [];
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
      requestContext = { ...requestContext, ...webviewContext };
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
  if (requestedEngine === 'local') {
    res.json({ model: 'local', engine: 'local', text: buildLocalAIResponse({ ...req, body: requestContext }, message) });
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
  const config = Number.isFinite(temperature)
    ? { temperature: Math.max(0, Math.min(1, temperature)) }
    : undefined;
  const baseMessage = message.length > MAX_GEMINI_INPUT_CHARS
    ? `${message.slice(0, MAX_GEMINI_INPUT_CHARS)}\n\n[He thong da rut gon phan tai lieu qua dai de tranh vuot quota Gemini.]`
    : message;
  let lastError = null;

  for (let attempt = 0; attempt <= AI_GATEWAY_RETRY_429; attempt += 1) {
    try {
      const attemptMessage = attempt > 0
        ? compactText(baseMessage, Math.max(1800, Math.floor(MAX_GEMINI_INPUT_CHARS * 0.75)))
        : baseMessage;
      const response = await ai.models.generateContent({
        model,
        ...(config ? { config } : {}),
        contents: [
          'Ban la tro ly gia pha ho Cao. Tra loi ngan gon, can trong, chi dua tren du lieu nguoi dung cung cap hoac kien thuc pho thong ve cach quan ly gia pha. Khong bia thong tin pha he cu the.',
          attemptMessage
        ].join('\n\nCau hoi: ')
      });

      const text = typeof response.text === 'function' ? response.text() : response.text;
      return {
        model,
        provider: 'gemini',
        engine: requestContext.engine || 'gemini',
        text: text || 'Toi chua co du du lieu de tra loi chinh xac.'
      };
    } catch (err) {
      const parsed = parseGeminiApiError(err);
      lastError = parsed;
      if (parsed.status !== 429 || attempt >= AI_GATEWAY_RETRY_429) break;
      const delayMs = parseRetryDelayMs(parsed.retryDelay);
      console.warn(`[ai-gateway] requestId=${requestId} provider=gemini status=429 retry=${attempt + 1}/${AI_GATEWAY_RETRY_429} delayMs=${delayMs}`);
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
  const requestType = requestContext.type;
  const cacheKey = buildAIGatewayCacheKey(requestContext);
  const cachedResponse = getAIGatewayCachedResponse(cacheKey);
  if (cachedResponse) {
    logAIGatewayRequest({
      requestId,
      route: routeName,
      botType: requestContext.botType,
      intent: requestContext.intent,
      type: requestContext.type,
      engine: requestContext.engine,
      model: cachedResponse.model,
      status: 200,
      cached: true,
      durationMs: Date.now() - startedAt
    });
    res.json(cachedResponse);
    return;
  }

  if (requestType === 'webview_chat') {
    try {
      const webviewContext = await buildWebviewAIContext(req, message);
      if (webviewContext.blockedText) {
        const policyResponse = {
          model: 'policy',
          provider: 'policy',
          engine: 'policy',
          botType: requestContext.botType,
          intent: requestContext.intent,
          text: webviewContext.blockedText
        };
        setAIGatewayCachedResponse(cacheKey, policyResponse);
        res.json(policyResponse);
        return;
      }
      message = webviewContext.message || message;
      requestContext = { ...requestContext, ...webviewContext };
    } catch (err) {
      console.warn('Failed to build webview AI context:', err?.message || err);
    }
  } else if (['chat', 'ceremony', 'prayer', 'han_nom', 'han-nom', 'audit', 'article', 'appeal', 'zalo_campaign', 'chatbox_policy'].includes(requestType || 'chat')) {
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
  if (requestedEngine === 'local') {
    const localResponse = {
      model: 'local',
      provider: 'local',
      engine: 'local',
      botType: requestContext.botType,
      intent: requestContext.intent,
      text: buildLocalAIResponse({ ...req, body: requestContext }, message)
    };
    setAIGatewayCachedResponse(cacheKey, localResponse);
    logAIGatewayRequest({
      requestId,
      route: routeName,
      botType: requestContext.botType,
      intent: requestContext.intent,
      type: requestContext.type,
      engine: 'local',
      model: 'local',
      status: 200,
      cached: false,
      durationMs: Date.now() - startedAt
    });
    res.json(localResponse);
    return;
  }

  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    const gatewayResponse = await callGeminiProvider({ apiKey, requestContext, message, requestId });
    const responsePayload = {
      ...gatewayResponse,
      botType: requestContext.botType,
      intent: requestContext.intent
    };
    setAIGatewayCachedResponse(cacheKey, responsePayload);
    logAIGatewayRequest({
      requestId,
      route: routeName,
      botType: requestContext.botType,
      intent: requestContext.intent,
      type: requestContext.type,
      engine: responsePayload.engine,
      model: responsePayload.model,
      status: 200,
      cached: false,
      durationMs: Date.now() - startedAt
    });
    res.json(responsePayload);
  } catch (err) {
    const parsed = err?.status ? err : parseGeminiApiError(err);
    console.error('Gemini request failed:', parsed.details, `| status=${parsed.status}`);
    logAIGatewayRequest({
      requestId,
      route: routeName,
      botType: requestContext.botType,
      intent: requestContext.intent,
      type: requestContext.type,
      engine: requestContext.engine,
      model: requestContext.modelName,
      status: parsed.status,
      cached: false,
      durationMs: Date.now() - startedAt
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
