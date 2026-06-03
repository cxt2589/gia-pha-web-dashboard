import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2f_v3_fixture';
const chunkId = 'chunk_phase2w2f_v3_fixture';

const ids = {
  profileReady: 'profile_phase2w2f_ready',
  profileIdentity: 'profile_phase2w2f_identity',
  profileNoise: 'profile_phase2w2f_noise',
  profileApprovedNoise: 'profile_phase2w2f_approved_noise',
  profileNote: 'profile_phase2w2f_note',
  annFieldWarning: 'ann_phase2w2f_field_warning',
  relWarning: 'rel_phase2w2f_warning',
  relNoise: 'rel_phase2w2f_noise'
};

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
  const token = `phase2w2f_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2f-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2f-admin',
    account: 'phase2w2f-admin',
    name: 'Phase 2W2F Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2f-admin',
      fullName: 'Phase 2W2F Admin',
      role: 'admin',
      roles: ['admin'],
      isKYCed: true,
      kycStatus: 'verified',
      isApproved: true,
      approvalStatus: 'approved',
      loginType: 'local'
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
      putState(cleanupDb, 'auth-users', getState(cleanupDb, 'auth-users', []).filter((user) => user.id !== userId));
      cleanupDb.close();
    }
  };
}

function metadata(group, extra = {}) {
  return JSON.stringify({
    dataset,
    datasetKey: dataset,
    datasetGroup: group,
    sourceTitle: 'Phase 2W2F v3 fixture',
    headingPath: `fixture/${group}`,
    evidenceType: group,
    evidenceQuote: extra.evidenceQuote ?? 'Cao Văn Triage có thông tin cần duyệt từ nguồn v3.',
    evidenceWindow: extra.evidenceWindow ?? 'Đoạn nguồn v3 có trích dẫn rõ để admin kiểm tra.',
    quality_flags: extra.quality_flags || [],
    needsAdminReview: Boolean(extra.needsAdminReview),
    notApplyDirectly: Boolean(extra.notApplyDirectly),
    candidateMatches: extra.candidateMatches || []
  });
}

function cleanupFixture(database = getDatabase()) {
  database.prepare(`DELETE FROM extracted_relationship_candidates WHERE id IN (?, ?)`).run(ids.relWarning, ids.relNoise);
  database.prepare(`DELETE FROM extracted_anniversary_candidates WHERE id = ?`).run(ids.annFieldWarning);
  database.prepare(`DELETE FROM extracted_profile_candidates WHERE id IN (?, ?, ?, ?, ?)`).run(ids.profileReady, ids.profileIdentity, ids.profileNoise, ids.profileApprovedNoise, ids.profileNote);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  database.prepare("DELETE FROM knowledge_maintenance_logs WHERE admin_user = 'phase2w2f-admin'").run();
  if (arguments.length === 0) database.close();
}

function installFixture() {
  const database = getDatabase();
  cleanupFixture(database);
  const sourceMeta = JSON.stringify({ dataset, datasetKey: dataset, datasetGroup: 'fixture', sourceKind: 'genealogy_fixture' });
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2F v3 fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2f-v3-fixture', sourceMeta);
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2F v3 fixture', 'fixture', 'fixture', ?, 'fixture', '[]', '[]', 'kyc', 'fixture', datetime('now'))
  `).run(chunkId, sourceId, sourceMeta);

  const insertProfile = database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 'Phase 2W2F v3 fixture', 'kyc', ?, ?, datetime('now'), datetime('now'))
  `);
  insertProfile.run(ids.profileReady, 'biography', 'Cao Văn Triage', 'cao van triage', 'member-ready', 'Cao Văn Triage', 'exact', 'description', 'Hành trạng đã có trích dẫn.', 'Cao Văn Triage có hành trạng rõ.', sourceId, chunkId, 'pending', metadata('biography_legacy'));
  insertProfile.run(ids.profileIdentity, 'biography', 'Cao Văn Cần Gán', 'cao van can gan', '', '', 'weak', 'description', 'Cao Văn Cần Gán có hành trạng nhưng chưa khớp chắc nhân vật.', 'Cao Văn Cần Gán có hành trạng nhưng chưa khớp chắc nhân vật.', sourceId, chunkId, 'pending', metadata('biography_legacy'));
  insertProfile.run(ids.profileNoise, 'name_alias', 'Cao Văn Nhiễu', 'cao van nhieu', '', '', 'none', 'name', '', '', sourceId, chunkId, 'pending', metadata('person_facts', { evidenceQuote: '', evidenceWindow: '' }));
  insertProfile.run(ids.profileApprovedNoise, 'name_alias', 'Cao Văn Đã Duyệt', 'cao van da duyet', '', '', 'none', 'name', '', '', sourceId, chunkId, 'approved', metadata('person_facts', { evidenceQuote: '', evidenceWindow: '' }));
  insertProfile.run(ids.profileNote, 'verification_note', 'Ghi chú kiểm chứng phả hệ', 'ghi chu kiem chung pha he', '', '', 'none', 'description', 'Mốc cần kiểm chứng.', 'Mốc 1807 cần kiểm chứng.', sourceId, chunkId, 'pending', metadata('verification_notes', { notApplyDirectly: true, needsAdminReview: true }));

  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text, death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id, matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, 'Cao Văn Ngày', 'cao van ngay', '', '', '15/5 âm lịch', '', '', '', '', 'Cao Văn Ngày sinh 15/5 âm lịch.', 'fixture/dates', '', '', 'weak', 'pending', ?, datetime('now'))
  `).run(ids.annFieldWarning, sourceId, chunkId, metadata('dates_graves', { quality_flags: ['normalized_field_type'] }));

  const insertRel = database.prepare(`
    INSERT INTO extracted_relationship_candidates
      (id, relationship_type, subject_name, subject_name_norm, subject_member_id, subject_member_name, subject_match_confidence, object_name, object_name_norm, object_member_id, object_member_name, object_match_confidence, direction, extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, flags_json, metadata_json, created_at, updated_at)
    VALUES (?, 'father', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'subject_to_object', ?, '', ?, ?, ?, 'Phase 2W2F v3 fixture', 'kyc', 'pending', ?, ?, datetime('now'), datetime('now'))
  `);
  insertRel.run(ids.relWarning, 'Cao Văn Cha', 'cao van cha', '', '', 'weak', 'Cao Văn Con', 'cao van con', '', '', 'weak', 'Cao Văn Cha là cha Cao Văn Con.', 'Cao Văn Cha là cha Cao Văn Con.', sourceId, chunkId, JSON.stringify({ ambiguous_subject: true, ambiguous_object: true, needs_manual_review: true }), metadata('relationships'));
  insertRel.run(ids.relNoise, 'Cao Văn Tự Quan Hệ', 'cao van tu quan he', '', '', 'none', 'Cao Văn Tự Quan Hệ', 'cao van tu quan he', '', '', 'none', 'Cao Văn Tự Quan Hệ tự lặp.', '', sourceId, chunkId, JSON.stringify({ needs_manual_review: true }), metadata('relationships', { evidenceQuote: '', evidenceWindow: '' }));
  database.close();
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { response, data };
}

function getCandidateStatus(table, id) {
  const database = getDatabase();
  const row = database.prepare(`SELECT status FROM ${table} WHERE id = ?`).get(id);
  database.close();
  return row?.status || '';
}

function result(id, passed, detail = '') {
  const row = { id, passed: Boolean(passed), detail: String(detail || '') };
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${id}${detail ? ` - ${detail}` : ''}`);
  return row;
}

async function main() {
  const admin = installTempAdminSession();
  installFixture();
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const publicSummary = await fetchJson(`/api/knowledge/v3-triage/summary?datasetKey=${dataset}`);
    results.push(result('triage-public-403', publicSummary.response.status === 403, `HTTP ${publicSummary.response.status}`));

    const treeBefore = await fetchJson('/api/tree');
    const summary = await fetchJson(`/api/knowledge/v3-triage/summary?datasetKey=${dataset}`, { headers });
    results.push(result('triage-summary-ok', summary.response.ok && summary.data.total >= 8, `total=${summary.data.total}`));
    results.push(result('triage-ready-count', (summary.data.bucketCounts?.ready_to_review || 0) >= 1, JSON.stringify(summary.data.bucketCounts)));
    results.push(result('triage-identity-count', (summary.data.bucketCounts?.needs_identity_match || 0) >= 1, JSON.stringify(summary.data.bucketCounts)));
    results.push(result('triage-field-warning-count', (summary.data.bucketCounts?.field_mapping_warning || 0) >= 1, JSON.stringify(summary.data.bucketCounts)));
    results.push(result('triage-relationship-warning-count', (summary.data.bucketCounts?.relationship_warning || 0) >= 1, JSON.stringify(summary.data.bucketCounts)));
    results.push(result('triage-note-count', (summary.data.bucketCounts?.do_not_apply_directly || 0) >= 1, JSON.stringify(summary.data.bucketCounts)));
    results.push(result('triage-noise-count', (summary.data.bucketCounts?.noise_reject_candidate || 0) >= 2, JSON.stringify(summary.data.bucketCounts)));

    const dryRun = await fetchJson('/api/knowledge/v3-triage/reject-noise', {
      method: 'POST',
      headers,
      body: JSON.stringify({ datasetKey: dataset, dryRun: true })
    });
    results.push(result('triage-dry-run-ok', dryRun.response.ok && dryRun.data.dryRun === true && dryRun.data.candidatesMatched >= 2, JSON.stringify(dryRun.data)));
    results.push(result('dry-run-does-not-change-status', getCandidateStatus('extracted_profile_candidates', ids.profileNoise) === 'pending', getCandidateStatus('extracted_profile_candidates', ids.profileNoise)));

    const reject = await fetchJson('/api/knowledge/v3-triage/reject-noise', {
      method: 'POST',
      headers,
      body: JSON.stringify({ datasetKey: dataset, dryRun: false })
    });
    results.push(result('triage-reject-ok', reject.response.ok && (reject.data.rejectedProfileCandidates + reject.data.rejectedRelationshipCandidates + reject.data.rejectedAnniversaryCandidates) >= 2, JSON.stringify(reject.data)));
    results.push(result('noise-profile-rejected', getCandidateStatus('extracted_profile_candidates', ids.profileNoise) === 'rejected', getCandidateStatus('extracted_profile_candidates', ids.profileNoise)));
    results.push(result('noise-relationship-rejected', getCandidateStatus('extracted_relationship_candidates', ids.relNoise) === 'rejected', getCandidateStatus('extracted_relationship_candidates', ids.relNoise)));
    results.push(result('approved-profile-untouched', getCandidateStatus('extracted_profile_candidates', ids.profileApprovedNoise) === 'approved', getCandidateStatus('extracted_profile_candidates', ids.profileApprovedNoise)));
    results.push(result('ready-profile-untouched', getCandidateStatus('extracted_profile_candidates', ids.profileReady) === 'pending', getCandidateStatus('extracted_profile_candidates', ids.profileReady)));

    const treeAfter = await fetchJson('/api/tree');
    results.push(result('lineage-tree-unchanged', JSON.stringify(treeBefore.data) === JSON.stringify(treeAfter.data), 'tree compare'));

    const logs = await fetchJson('/api/knowledge/maintenance/logs?limit=20', { headers });
    results.push(result('triage-maintenance-log-written', logs.response.ok && (logs.data.logs || []).some((log) => log.action === 'triage_v3_reject_noise'), `${logs.data.logs?.length || 0} logs`));
  } finally {
    admin.cleanup();
    cleanupFixture();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2F v3 triage failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2F v3 triage checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
