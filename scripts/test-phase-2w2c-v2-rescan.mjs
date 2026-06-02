import crypto from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const datasetKey = 'phase2w2c_fixture';

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
  const token = `phase2w2c_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2c-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = { provider: 'local', id: 'phase2w2c-admin', account: 'phase2w2c-admin', name: 'Phase 2W2C Admin', loggedInAt: new Date().toISOString() };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [{
    id: userId,
    username: 'phase2w2c-admin',
    fullName: 'Phase 2W2C Admin',
    role: 'admin',
    roles: ['admin'],
    isKYCed: true,
    kycStatus: 'verified',
    isApproved: true,
    approvalStatus: 'approved',
    loginType: 'local'
  }, ...users.filter((user) => user.id !== userId)]);
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

function cleanupFixture(database = getDatabase()) {
  database.prepare("DELETE FROM extracted_profile_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").run(datasetKey);
  database.prepare("DELETE FROM extracted_anniversary_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").run(datasetKey);
  database.prepare("DELETE FROM extracted_relationship_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").run(datasetKey);
  database.prepare("DELETE FROM knowledge_chunks WHERE source_id IN (SELECT id FROM knowledge_sources WHERE json_extract(metadata_json, '$.datasetKey') = ?)").run(datasetKey);
  database.prepare("DELETE FROM knowledge_sources WHERE json_extract(metadata_json, '$.datasetKey') = ?").run(datasetKey);
  database.prepare("DELETE FROM knowledge_maintenance_logs WHERE admin_user = 'phase2w2c-admin'").run();
  if (arguments.length === 0) database.close();
}

function writeJsonl(file, rows) {
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n'), 'utf8');
}

function createFixtureDir() {
  const dir = mkdtempSync(resolve(tmpdir(), 'cao-toc-v2-fixture-'));
  writeJsonl(resolve(dir, '02_person_facts.jsonl'), [
    { record_id: 'pf_name', source_type: 'txt_v2', source_title: 'V2 person facts', section: 'Họ tên', page_hint: 'p2', person_name: 'Cao Văn Chất', field_type: 'name', value: 'Cao Văn Chất Lượng', source_quote: 'Cao Văn Chất có tên đầy đủ là Cao Văn Chất Lượng.', confidence: 'high', needs_admin_review: false, notes: '' },
    { record_id: 'pf_ambiguous', source_type: 'txt_v2', source_title: 'V2 person facts', section: 'Họ tên', page_hint: 'p2', person_name: 'Cao Văn Người Trùng', field_type: 'name', value: 'Cao Văn Người Trùng Đủ', source_quote: 'Cao Văn Người Trùng có tên đủ cần admin xác minh.', confidence: 'low', needs_admin_review: true, notes: 'ambiguous' }
  ]);
  writeJsonl(resolve(dir, '03_dates_graves.jsonl'), [
    { record_id: 'dg_grave', source_type: 'txt_v2', source_title: 'V2 dates graves', section: 'Mộ chí', page_hint: 'p3', person_name: 'Cao Văn Mộ Chí', field_type: 'grave', calendar: '', value: 'phần mộ an táng tại Nghĩa trang Phú Mỹ', source_quote: 'Cao Văn Mộ Chí: phần mộ an táng tại Nghĩa trang Phú Mỹ.', confidence: 'high', needs_admin_review: false, notes: '' },
    { record_id: 'dg_home', source_type: 'txt_v2', source_title: 'V2 dates graves', section: 'Quê quán', page_hint: 'p3', person_name: 'Cao Văn Quê Quán', field_type: 'hometown', calendar: '', value: 'quê quán tại Phú Mỹ, Ninh Bình', source_quote: 'Cao Văn Quê Quán: quê quán tại Phú Mỹ, Ninh Bình.', confidence: 'high', needs_admin_review: false, notes: '' },
    { record_id: 'dg_lunar', source_type: 'txt_v2', source_title: 'V2 dates graves', section: 'Ngày giỗ', page_hint: 'p4', person_name: 'Cao Đình Lạng', field_type: 'lunar_anniversary', calendar: 'lunar', value: 'ngày 12 tháng 3 âm lịch', source_quote: 'Cao Đình Lạng: ngày giỗ ngày 12 tháng 3 âm lịch.', confidence: 'medium', needs_admin_review: true, notes: 'không có năm dương lịch' }
  ]);
  writeJsonl(resolve(dir, '04_relationships.jsonl'), [
    { record_id: 'rel_good', source_type: 'txt_v2', source_title: 'V2 relationships', section: 'Quan hệ', page_hint: 'p5', relationship_type: 'father', subject_name: 'Cao Văn Phụ Thân', object_name: 'Cao Văn Hậu Tự', direction: 'subject_to_object', relationship_note: 'Cao Văn Phụ Thân là cha của Cao Văn Hậu Tự.', source_quote: 'Cao Văn Phụ Thân là cha của Cao Văn Hậu Tự.', confidence: 'medium', needs_admin_review: true, notes: '' },
    { record_id: 'rel_missing_object', source_type: 'txt_v2', source_title: 'V2 relationships', section: 'Quan hệ cần kiểm chứng', page_hint: 'p5', relationship_type: 'origin', subject_name: 'Nguồn gốc trước Cao Đình Lạng', object_name: '', direction: '', relationship_note: 'Nguồn gốc trước Cao Đình Lạng cần kiểm chứng, chưa đủ subject/object.', source_quote: 'Nguồn gốc trước Cao Đình Lạng cần kiểm chứng.', confidence: 'low', needs_admin_review: true, notes: 'không tạo relationship trực tiếp' }
  ]);
  writeJsonl(resolve(dir, '05_biography_legacy.jsonl'), [
    { record_id: 'bio_person', source_type: 'txt_v2', source_title: 'V2 biography', section: 'Hành trạng', page_hint: 'p6', person_name: 'Cao Văn Công Lao', legacy_type: 'achievement', value: 'có công tu sửa nhà thờ họ', source_quote: 'Cao Văn Công Lao có công tu sửa nhà thờ họ.', confidence: 'medium', needs_admin_review: false, notes: '' },
    { record_id: 'bio_clan', source_type: 'txt_v2', source_title: 'V2 biography', section: 'Di sản dòng họ', page_hint: 'p6', person_name: '', legacy_type: 'clan_legacy', value: 'Dòng họ Cao giữ lệ khuyến học trong toàn tộc.', source_quote: 'Dòng họ Cao giữ lệ khuyến học trong toàn tộc.', confidence: 'medium', needs_admin_review: true, notes: 'không gán cá nhân' }
  ]);
  writeJsonl(resolve(dir, '06_verification_notes.jsonl'), [
    { record_id: 'ver_note', source_type: 'txt_v2', source_title: 'V2 verification', section: 'Cần kiểm chứng', page_hint: 'p7', value: 'Mốc 1807 và liên hệ họ Cao thôn Trai/Gia Hòa cần xác minh.', source_quote: 'Mốc 1807 và liên hệ họ Cao thôn Trai/Gia Hòa cần xác minh.', confidence: 'low', needs_admin_review: true, notes: 'verification only' }
  ]);
  writeFileSync(resolve(dir, '07_rules_private.json'), JSON.stringify({ rules: ['không dùng làm bằng chứng gia phả'], lowerCaseExamples: ['Cao Đình Lạng lowercase'] }, null, 2), 'utf8');
  return dir;
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
  const fixtureDir = createFixtureDir();
  cleanupFixture();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const body = JSON.stringify({ datasetDir: fixtureDir, datasetKey });
  const database = getDatabase();
  const treeBefore = JSON.stringify(getState(database, 'lineage-tree', null));
  database.close();
  const results = [];
  try {
    const publicImport = await fetchJson('/api/knowledge/import-v2-dataset', { method: 'POST', body });
    results.push(result('public-import-v2-403', publicImport.response.status === 403, `HTTP ${publicImport.response.status}`));

    const imported = await fetchJson('/api/knowledge/import-v2-dataset', { method: 'POST', headers, body });
    results.push(result('jsonl-import-sources-records', imported.response.ok && imported.data.sources === 6 && imported.data.records === 11 && imported.data.rulesPrivateLocked, JSON.stringify({ sources: imported.data.sources, records: imported.data.records, rules: imported.data.rulesPrivateLocked })));

    const dbAfterImport = getDatabase();
    const rulesSource = dbAfterImport.prepare("SELECT visibility, metadata_json FROM knowledge_sources WHERE id = ?").get(`source_${datasetKey}_rules_private`);
    const rulesMeta = JSON.parse(rulesSource.metadata_json);
    dbAfterImport.close();
    results.push(result('rules-private-locked', rulesSource.visibility === 'private' && rulesMeta.sourceKind === 'technical_rule' && rulesMeta.excludeFromExtraction && rulesMeta.excludeFromPublicChat, JSON.stringify({ visibility: rulesSource.visibility, sourceKind: rulesMeta.sourceKind })));

    const rescan = await fetchJson('/api/knowledge/rescan-v2', { method: 'POST', headers, body });
    results.push(result('rescan-created-candidates', rescan.response.ok && rescan.data.candidatesCreated >= 9 && rescan.data.ambiguous >= 4, JSON.stringify({ created: rescan.data.candidatesCreated, ambiguous: rescan.data.ambiguous })));

    const report = await fetchJson(`/api/knowledge/rescan-v2/report?datasetKey=${encodeURIComponent(datasetKey)}`, { headers });
    results.push(result('report-counts-by-group', report.response.ok && report.data.sources === 6 && report.data.candidates >= 9 && report.data.byGroup?.dates_graves?.candidates >= 3, JSON.stringify({ sources: report.data.sources, candidates: report.data.candidates })));

    const db = getDatabase();
    const technicalCandidates = [
      db.prepare("SELECT COUNT(*) AS count FROM extracted_profile_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ? AND source_id = ?").get(datasetKey, `source_${datasetKey}_rules_private`).count,
      db.prepare("SELECT COUNT(*) AS count FROM extracted_anniversary_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ? AND source_id = ?").get(datasetKey, `source_${datasetKey}_rules_private`).count,
      db.prepare("SELECT COUNT(*) AS count FROM extracted_relationship_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ? AND source_id = ?").get(datasetKey, `source_${datasetKey}_rules_private`).count
    ].reduce((sum, count) => sum + count, 0);
    const profileRows = db.prepare("SELECT * FROM extracted_profile_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").all(datasetKey);
    const annRows = db.prepare("SELECT * FROM extracted_anniversary_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").all(datasetKey);
    const relRows = db.prepare("SELECT * FROM extracted_relationship_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").all(datasetKey);
    results.push(result('no-candidate-from-technical-rule', technicalCandidates === 0, `technicalCandidates=${technicalCandidates}`));
    results.push(result('candidates-have-evidence', [...profileRows, ...annRows, ...relRows].every((row) => {
      const meta = JSON.parse(row.metadata_json);
      return meta.sourceId && meta.chunkId && meta.recordId && meta.sourceTitle && meta.evidenceQuote && meta.evidenceWindow && meta.evidenceType;
    }), `profile=${profileRows.length}, ann=${annRows.length}, rel=${relRows.length}`));
    const grave = annRows.find((row) => row.id.includes('ann_v2') && row.person_name === 'Cao Văn Mộ Chí');
    const home = annRows.find((row) => row.id.includes('ann_v2') && row.person_name === 'Cao Văn Quê Quán');
    const lunar = annRows.find((row) => row.person_name === 'Cao Đình Lạng');
    results.push(result('grave-not-hometown-v2', grave?.grave_text && !grave?.hometown, JSON.stringify({ hometown: grave?.hometown, grave: grave?.grave_text })));
    results.push(result('hometown-not-grave-v2', home?.hometown && !home?.grave_text, JSON.stringify({ hometown: home?.hometown, grave: home?.grave_text })));
    results.push(result('lunar-anniversary-no-fake-year', lunar?.death_anniversary_lunar === 'ngày 12 tháng 3 âm lịch' && !/\b20\d{2}\b/.test(lunar.death_anniversary_lunar), lunar?.death_anniversary_lunar || 'missing'));
    const verificationFromMissingRel = profileRows.find((row) => JSON.parse(row.metadata_json).recordId === 'rel_missing_object');
    results.push(result('missing-relationship-becomes-verification-note', verificationFromMissingRel?.candidate_type === 'verification_note' && !relRows.some((row) => JSON.parse(row.metadata_json).recordId === 'rel_missing_object'), verificationFromMissingRel?.candidate_type || 'missing'));
    const clan = profileRows.find((row) => JSON.parse(row.metadata_json).recordId === 'bio_clan');
    results.push(result('clan-legacy-not-person-apply', clan?.candidate_type === 'clan_legacy' && !clan?.matched_member_id && JSON.parse(clan.metadata_json).notApplyDirectly, JSON.stringify({ type: clan?.candidate_type, member: clan?.matched_member_id })));
    const ambiguous = profileRows.find((row) => JSON.parse(row.metadata_json).recordId === 'pf_ambiguous');
    results.push(result('ambiguous-not-auto-matched', ambiguous && !ambiguous.matched_member_id && ambiguous.match_confidence !== 'high', JSON.stringify({ match: ambiguous?.matched_member_id, confidence: ambiguous?.match_confidence })));
    const beforeSecondCount = profileRows.length + annRows.length + relRows.length;
    db.close();

    const duplicateRun = await fetchJson('/api/knowledge/rescan-v2', { method: 'POST', headers, body });
    const dbAfterDup = getDatabase();
    const afterSecondCount =
      dbAfterDup.prepare("SELECT COUNT(*) AS count FROM extracted_profile_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").get(datasetKey).count +
      dbAfterDup.prepare("SELECT COUNT(*) AS count FROM extracted_anniversary_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").get(datasetKey).count +
      dbAfterDup.prepare("SELECT COUNT(*) AS count FROM extracted_relationship_candidates WHERE json_extract(metadata_json, '$.datasetKey') = ?").get(datasetKey).count;
    const treeAfter = JSON.stringify(getState(dbAfterDup, 'lineage-tree', null));
    dbAfterDup.close();
    results.push(result('duplicate-rescan-skips-existing', duplicateRun.response.ok && duplicateRun.data.duplicatesSkipped >= beforeSecondCount && afterSecondCount === beforeSecondCount, JSON.stringify({ duplicates: duplicateRun.data.duplicatesSkipped, beforeSecondCount, afterSecondCount })));
    results.push(result('rescan-does-not-change-tree', treeBefore === treeAfter, 'lineage-tree unchanged'));
  } finally {
    cleanupFixture();
    admin.cleanup();
    rmSync(fixtureDir, { recursive: true, force: true });
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2C v2 rescan failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2C v2 rescan checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
