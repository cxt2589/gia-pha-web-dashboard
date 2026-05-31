import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const reportPath = resolve(repoRoot, process.env.AI_QUALITY_REPORT || 'docs/ai-quality-phase-2e-report.md');
const shouldWriteReport = process.env.AI_QUALITY_WRITE_REPORT !== '0';
const useTempAdmin = process.env.AI_QUALITY_TEMP_ADMIN !== '0' && !process.env.AI_QUALITY_COOKIE;

const T = {
  caoToWho: 'Cao T\u1ed5 l\u00e0 ai?',
  thuyToWho: 'Th\u1ee7y T\u1ed5 l\u00e0 ai?',
  cuLangWho: 'c\u1ee5 L\u1ea1ng l\u00e0 ai?',
  langAnniversary: 'ng\u00e0y gi\u1ed7 c\u1ee5 Cao \u0110\u00ecnh L\u1ea1ng l\u00e0 ng\u00e0y n\u00e0o?',
  langDeath: 'ng\u00e0y m\u1ea5t c\u1ee5 Cao \u0110\u00ecnh L\u1ea1ng l\u00e0 ng\u00e0y n\u00e0o?',
  thuatAnniversary: 'ng\u00e0y gi\u1ed7 c\u1ee5 Cao \u0110\u00ecnh Thu\u1eadt l\u00e0 ng\u00e0y n\u00e0o?',
  moiAnniversary: 'ng\u00e0y gi\u1ed7 Cao V\u0103n M\u1edbi l\u00e0 ng\u00e0y n\u00e0o?',
  moiGrave: 'm\u1ed9 ch\u00ed Cao V\u0103n M\u1edbi \u1edf \u0111\u00e2u?',
  moiHometown: 'qu\u00ea qu\u00e1n Cao V\u0103n M\u1edbi \u1edf \u0111\u00e2u?',
  origin: 'h\u1ecd Cao c\u00f3 ngu\u1ed3n g\u1ed1c t\u1eeb \u0111\u00e2u?',
  hanNomDocs: 't\u00e0i li\u1ec7u n\u00e0o \u0111ang c\u1ea7n ki\u1ec3m ch\u1ee9ng H\u00e1n N\u00f4m?',
  adminVerify: 'c\u00f3 nh\u1eefng \u0111i\u1ec3m n\u00e0o trong t\u00e0i li\u1ec7u c\u1ea7n admin x\u00e1c minh?',
  thuanWho: 'Thu\u1ea7n l\u00e0 ai?',
  langCaoTo: 'Cao \u0110\u00ecnh L\u1ea1ng c\u00f3 ph\u1ea3i Cao T\u1ed5 kh\u00f4ng?',
  caoTo: 'Cao T\u1ed5',
  thuyTo: 'Th\u1ee7y T\u1ed5',
  caoDinhThuat: 'Cao \u0110\u00ecnh Thu\u1eadt',
  caoDinhLang: 'Cao \u0110\u00ecnh L\u1ea1ng',
  thuan: 'Thu\u1ea7n',
  unverified: 'Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u x\u00e1c minh trong kho tri th\u1ee9c hi\u1ec7n t\u1ea1i',
  missingAnniversary: 'Ch\u01b0a t\u00ecm th\u1ea5y d\u1eef li\u1ec7u x\u00e1c minh tr\u1ef1c ti\u1ebfp v\u1ec1 ng\u00e0y gi\u1ed7',
  missingDeath: 'Ch\u01b0a t\u00ecm th\u1ea5y d\u1eef li\u1ec7u x\u00e1c minh tr\u1ef1c ti\u1ebfp v\u1ec1 ng\u00e0y m\u1ea5t',
  hanNom: 'H\u00e1n N\u00f4m',
  verify: 'ki\u1ec3m ch\u1ee9ng',
  caoNinhBinh: 'Cao Ninh B\u00ecnh',
  caoQuyCong: 'Cao Qu\u00fd C\u00f4ng',
  caoVanLam: 'Cao V\u0103n L\u00e3m'
};

const cases = [
  {
    id: 'alias-cao-to',
    question: T.caoToWho,
    search: 'Cao T\u1ed5',
    expectedContains: [T.caoDinhThuat, T.caoTo],
    mustNotContain: [`${T.caoDinhThuat} - ${T.thuyTo}`, T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true,
    note: 'Cao Dinh Thuat must be Cao To.'
  },
  {
    id: 'alias-thuy-to',
    question: T.thuyToWho,
    search: 'Th\u1ee7y T\u1ed5',
    expectedContains: [T.caoDinhLang, T.thuyTo],
    mustNotContain: [`${T.caoDinhLang} - ${T.caoTo}`, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true,
    note: 'Cao Dinh Lang must be Thuy To.'
  },
  {
    id: 'alias-cu-lang',
    question: T.cuLangWho,
    search: 'c\u1ee5 L\u1ea1ng',
    expectedContains: [T.caoDinhLang, T.thuyTo],
    mustNotContain: [T.caoDinhThuat, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'anniversary-lang-unverified',
    question: T.langAnniversary,
    search: 'ng\u00e0y gi\u1ed7 Cao \u0110\u00ecnh L\u1ea1ng',
    expectedContains: [T.caoDinhLang, '13/4', '29/05/2026', 'Nam mat chua ro'],
    mustNotContain: ['20/02/2026', T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: false,
    note: 'Phase 2K can answer verified/applied lunar anniversary from the lineage tree.'
  },
  {
    id: 'anniversary-thuat-unverified',
    question: T.thuatAnniversary,
    search: 'ng\u00e0y gi\u1ed7 Cao \u0110\u00ecnh Thu\u1eadt',
    expectedContains: [T.caoDinhThuat, T.missingAnniversary],
    mustNotContain: ['20/02/2026', T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'death-lang-unverified',
    question: T.langDeath,
    search: 'ng\u00e0y m\u1ea5t Cao \u0110\u00ecnh L\u1ea1ng',
    expectedContains: [T.caoDinhLang, T.missingDeath],
    mustNotContain: ['20/02/2026', T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'anniversary-moi-candidate',
    question: T.moiAnniversary,
    search: 'ng\u00e0y gi\u1ed7 Cao V\u0103n M\u1edbi',
    expectedContains: ['Cao V\u0103n M\u1edbi', 'Ng\u00e0y m\u00f9ng 10 th\u00e1ng B\u1ea3y', 'candidate tr\u00edch xu\u1ea5t'],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'grave-moi-candidate',
    question: T.moiGrave,
    search: 'm\u1ed9 ch\u00ed Cao V\u0103n M\u1edbi',
    expectedContains: ['Cao V\u0103n M\u1edbi', 'L\u0103ng Cao T\u1ed5', 'H\u1ea1 Quan'],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'hometown-moi-candidate',
    question: T.moiHometown,
    search: 'qu\u00ea qu\u00e1n Cao V\u0103n M\u1edbi',
    expectedContains: ['Cao V\u0103n M\u1edbi', 'Gi\u00e1p Ba', 'Nam \u0110\u1ecbnh'],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'origin-cao-toc',
    question: T.origin,
    search: 'ngu\u1ed3n g\u1ed1c Tr\u1ea1i Th\u1ee7y C\u01a1 Qu\u1ef9 \u0110\u00ea Ph\u00fa M\u1ef9',
    expectedContains: ['kho tri th\u1ee9c local'],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true
  },
  {
    id: 'han-nom-docs',
    question: T.hanNomDocs,
    search: 'ki\u1ec3m ch\u1ee9ng H\u00e1n N\u00f4m',
    expectedContains: ['H\u00e1n', 'N\u00f4m', T.verify],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true,
    expectedSourceSlugPart: 'kiem ch\u1ee9ng'
  },
  {
    id: 'admin-verification-points',
    question: T.adminVerify,
    search: '\u0111i\u1ec3m c\u1ea7n ki\u1ec3m ch\u1ee9ng admin x\u00e1c minh',
    expectedContains: [T.verify],
    mustNotContain: [T.caoNinhBinh, T.caoQuyCong, T.caoVanLam],
    requiresKnowledge: true,
    expectedSourceSlugPart: 'kiem ch\u1ee9ng'
  },
  {
    id: 'alias-thuan-unverified',
    question: T.thuanWho,
    search: 'Thu\u1ea7n',
    expectedContains: [T.thuan, T.unverified],
    mustNotContain: ['\u0111\u00e3 x\u00e1c minh', 'kh\u1eb3ng \u0111\u1ecbnh Thu\u1ea7n l\u00e0'],
    requiresKnowledge: false,
    note: 'Thuan is only an example/needs verification alias.'
  },
  {
    id: 'lang-is-not-cao-to',
    question: T.langCaoTo,
    search: 'Cao \u0110\u00ecnh L\u1ea1ng Cao T\u1ed5 Th\u1ee7y T\u1ed5',
    expectedContains: [T.caoDinhThuat, T.caoTo],
    mustNotContain: [`${T.caoDinhLang} - ${T.caoTo}`, 'Cao \u0110\u00ecnh L\u1ea1ng l\u00e0 Cao T\u1ed5'],
    requiresKnowledge: true
  }
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}

function includesNormalized(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
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
  const database = new DatabaseSync(databaseFile);
  database.exec('PRAGMA busy_timeout = 5000');
  const token = `phase2e_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2e-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2e-admin',
    account: 'phase2e-admin',
    name: 'Phase 2E Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);

  const users = getState(database, 'auth-users', []);
  if (!users.some((user) => user.id === userId || user.username === 'phase2e-admin')) {
    users.unshift({
      id: userId,
      username: 'phase2e-admin',
      fullName: 'Phase 2E Admin',
      role: 'admin',
      roles: ['admin'],
      isKYCed: true,
      kycStatus: 'verified',
      isApproved: true,
      approvalStatus: 'approved',
      regDate: '31/05/2026',
      loginType: 'local'
    });
    putState(database, 'auth-users', users);
  }
  database.close();

  return {
    cookie: `caogia_auth_session=${token}`,
    cleanup: async function cleanup() {
      let lastError = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const cleanupDb = new DatabaseSync(databaseFile);
          cleanupDb.exec('PRAGMA busy_timeout = 5000');
          const nextSessions = getState(cleanupDb, 'auth-sessions', {});
          delete nextSessions[token];
          putState(cleanupDb, 'auth-sessions', nextSessions);
          const nextUsers = getState(cleanupDb, 'auth-users', [])
            .filter((user) => user.id !== userId && user.username !== 'phase2e-admin');
          putState(cleanupDb, 'auth-users', nextUsers);
          cleanupDb.close();
          return true;
        } catch (err) {
          lastError = err;
          await new Promise((resolveSleep) => setTimeout(resolveSleep, 300 * (attempt + 1)));
        }
      }
      console.warn(`Phase 2E temp admin cleanup skipped after retries: ${lastError?.message || lastError}`);
      console.warn('Run cleanup manually if needed: remove auth-sessions token prefix "phase2e_" and user "phase2e-admin".');
      return false;
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
  return { response, data, text };
}

async function runCase(testCase, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookie) headers.Cookie = cookie;

  const searchUrl = `/api/knowledge/search?q=${encodeURIComponent(testCase.search || testCase.question)}&limit=8`;
  const searchResult = await fetchJson(searchUrl, { headers: cookie ? { Cookie: cookie } : {} });
  const chatResult = await fetchJson('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: testCase.question,
      type: 'chat',
      botType: 'dashboard',
      intent: 'quality_check_phase_2e',
      engine: 'local'
    })
  });

  const chat = chatResult.data;
  const text = String(chat.text || '');
  const missing = testCase.expectedContains.filter((item) => !includesNormalized(text, item));
  const forbidden = testCase.mustNotContain.filter((item) => includesNormalized(text, item));
  const hasText = text.trim().length > 0;
  const hasKnowledgeMeta = Object.prototype.hasOwnProperty.call(chat, 'knowledgeMatchesCount');
  const sourceIds = Array.isArray(chat.knowledgeSourceIds) ? chat.knowledgeSourceIds : [];
  const hasSourceIds = !testCase.requiresKnowledge || sourceIds.length > 0;
  const searchChunks = Array.isArray(searchResult.data.chunks) ? searchResult.data.chunks : [];
  const searchAliases = Array.isArray(searchResult.data.aliases) ? searchResult.data.aliases : [];
  const sourceSlugMatch = !testCase.expectedSourceSlugPart ||
    searchChunks.some((chunk) => (
      includesNormalized(chunk.sourceId, testCase.expectedSourceSlugPart) ||
      includesNormalized(chunk.title, testCase.expectedSourceSlugPart) ||
      (Array.isArray(chunk.tags) && chunk.tags.some((tag) => includesNormalized(tag, testCase.expectedSourceSlugPart)))
    ));

  return {
    id: testCase.id,
    question: testCase.question,
    passed: chatResult.response.ok &&
      searchResult.response.ok &&
      hasText &&
      hasKnowledgeMeta &&
      hasSourceIds &&
      sourceSlugMatch &&
      missing.length === 0 &&
      forbidden.length === 0,
    status: chatResult.response.status,
    searchStatus: searchResult.response.status,
    model: chat.model || '',
    provider: chat.provider || '',
    knowledgeMatchesCount: Number(chat.knowledgeMatchesCount || 0),
    knowledgeSourceIds: sourceIds,
    searchChunksCount: searchChunks.length,
    searchAliasesCount: searchAliases.length,
    missing,
    forbidden,
    hasText,
    hasKnowledgeMeta,
    hasSourceIds,
    sourceSlugMatch,
    note: testCase.note || '',
    answerPreview: text.replace(/\s+/g, ' ').slice(0, 520),
    topSearchSources: searchChunks.slice(0, 4).map((chunk) => ({
      sourceId: chunk.sourceId,
      title: chunk.title,
      score: chunk.score
    }))
  };
}

function renderReport(summary) {
  const lines = [
    '# Phase 2E AI Quality Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Base URL: ${summary.baseUrl}`,
    `- Commit target: a945e95 or newer`,
    `- Total cases: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Knowledge status: sources=${summary.knowledgeStatus?.sources ?? 'n/a'}, chunks=${summary.knowledgeStatus?.chunks ?? 'n/a'}, aliases=${summary.knowledgeStatus?.aliases ?? 'n/a'}, indexedSources=${summary.knowledgeStatus?.indexedSources ?? 'n/a'}`,
    '',
    '## Rules Checked',
    '',
    '- Database/tree should stay higher priority than alias rules and TXT knowledge.',
    '- Phase 2A alias rules must map Cao Dinh Thuat to Cao To and Cao Dinh Lang to Thuy To.',
    '- Phase 2D TXT chunks must be retrieved for history, verification, and Han Nom questions.',
    '- Missing anniversary dates must not be invented.',
    '- Old sample Cao Ninh Binh/Cao Quy Cong/Cao Van Lam answers must not appear.',
    '',
    '## Results',
    '',
    '| Case | Pass | Knowledge | Sources | Reason |',
    '|---|---:|---:|---:|---|'
  ];
  for (const result of summary.results) {
    const reason = [
      result.missing.length ? `missing: ${result.missing.join(', ')}` : '',
      result.forbidden.length ? `forbidden: ${result.forbidden.join(', ')}` : '',
      !result.hasSourceIds ? 'missing source ids' : '',
      !result.hasKnowledgeMeta ? 'missing metadata' : '',
      !result.sourceSlugMatch ? 'expected source not found in search' : '',
      result.note
    ].filter(Boolean).join('; ') || 'ok';
    lines.push(`| ${result.id} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.knowledgeMatchesCount} | ${result.knowledgeSourceIds.length} | ${reason.replace(/\|/g, '/')} |`);
  }
  lines.push('', '## Answer Previews', '');
  for (const result of summary.results) {
    lines.push(`### ${result.id}`, '', `Question: ${result.question}`, '', `Answer: ${result.answerPreview}`, '');
    if (result.topSearchSources.length) {
      lines.push('Top search sources:');
      result.topSearchSources.forEach((source) => {
        lines.push(`- ${source.title} (${source.sourceId}, score ${source.score})`);
      });
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

let tempAdmin = null;
try {
  tempAdmin = useTempAdmin ? installTempAdminSession() : null;
  const cookie = process.env.AI_QUALITY_COOKIE || tempAdmin?.cookie || '';
  const health = await fetchJson('/api/health');
  if (!health.response.ok) throw new Error(`Backend health failed: HTTP ${health.response.status}`);
  const knowledgeStatus = await fetchJson('/api/knowledge/status', { headers: cookie ? { Cookie: cookie } : {} });
  const results = [];
  for (const testCase of cases) {
    results.push(await runCase(testCase, cookie));
  }

  const failed = results.filter((item) => !item.passed);
  const summary = {
    ok: failed.length === 0,
    baseUrl,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    knowledgeStatus: knowledgeStatus.data,
    results
  };

  if (shouldWriteReport) {
    await writeFile(reportPath, renderReport(summary), 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exit(1);
} finally {
  await tempAdmin?.cleanup();
}
