import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const baseUrl = (process.env.AI_QUALITY_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const databaseFile = resolve(repoRoot, process.env.LINEAGE_DATABASE_FILE || 'data/lineage.sqlite');
const cookieName = 'caogia_auth_session';
const dataset = 'cao_toc_txt_knowledge_base_v3';
const sourceId = 'source_phase2w2h_guard_fixture';
const chunkId = 'chunk_phase2w2h_guard_fixture';

const ids = {
  annFieldWarning: 'ann_phase2w2h_field_warning',
  profileIdentity: 'profile_phase2w2h_identity',
  profileNote: 'profile_phase2w2h_note',
  profileNoise: 'profile_phase2w2h_noise',
  relWarning: 'rel_phase2w2h_warning'
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

function flattenTree(node, list = []) {
  if (!node || typeof node !== 'object') return list;
  list.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) flattenTree(child, list);
  return list;
}

function installTempAdminSession() {
  const database = getDatabase();
  const token = `phase2w2h_${crypto.randomBytes(16).toString('hex')}`;
  const userId = 'oauth_local_phase2w2h-admin';
  const sessions = getState(database, 'auth-sessions', {});
  sessions[token] = {
    provider: 'local',
    id: 'phase2w2h-admin',
    account: 'phase2w2h-admin',
    name: 'Phase 2W2H Admin',
    loggedInAt: new Date().toISOString()
  };
  putState(database, 'auth-sessions', sessions);
  const users = getState(database, 'auth-users', []);
  putState(database, 'auth-users', [
    {
      id: userId,
      username: 'phase2w2h-admin',
      fullName: 'Phase 2W2H Admin',
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
    sourceTitle: 'Phase 2W2H guard fixture',
    headingPath: `fixture/${group}`,
    evidenceType: group,
    evidenceQuote: extra.evidenceQuote ?? 'Cao Van Guard co thong tin trich dan can duyet tu nguon v3.',
    evidenceWindow: extra.evidenceWindow ?? 'Doan nguon v3 co trich dan ro de admin kiem tra.',
    quality_flags: extra.quality_flags || [],
    needsAdminReview: Boolean(extra.needsAdminReview),
    notApplyDirectly: Boolean(extra.notApplyDirectly),
    candidateMatches: extra.candidateMatches || []
  });
}

function cleanupFixture(database = getDatabase()) {
  database.prepare(`DELETE FROM extracted_relationship_candidates WHERE id = ?`).run(ids.relWarning);
  database.prepare(`DELETE FROM extracted_anniversary_candidates WHERE id = ?`).run(ids.annFieldWarning);
  database.prepare(`DELETE FROM extracted_profile_candidates WHERE id IN (?, ?, ?)`).run(ids.profileIdentity, ids.profileNote, ids.profileNoise);
  database.prepare('DELETE FROM extracted_relationship_audit_logs WHERE candidate_id = ?').run(ids.relWarning);
  database.prepare('DELETE FROM extracted_anniversary_audit_logs WHERE candidate_id = ?').run(ids.annFieldWarning);
  database.prepare(`DELETE FROM extracted_profile_audit_logs WHERE candidate_id IN (?, ?, ?)`).run(ids.profileIdentity, ids.profileNote, ids.profileNoise);
  database.prepare('DELETE FROM knowledge_chunks WHERE id = ?').run(chunkId);
  database.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(sourceId);
  if (arguments.length === 0) database.close();
}

function installFixture(memberA, memberB) {
  const database = getDatabase();
  cleanupFixture(database);
  const sourceMeta = JSON.stringify({ dataset, datasetKey: dataset, datasetGroup: 'fixture', sourceKind: 'genealogy_fixture' });
  database.prepare(`
    INSERT INTO knowledge_sources
      (id, slug, title, source_type, scope, clan_scope, system_scope, domain, content, source_hash, metadata_json, summary, tags_json, entity_refs_json, visibility, status, updated_at)
    VALUES (?, ?, 'Phase 2W2H guard fixture', 'test', 'test', '', '', '', 'fixture', 'hash', ?, 'fixture', '[]', '[]', 'kyc', 'indexed', datetime('now'))
  `).run(sourceId, 'phase2w2h-guard-fixture', sourceMeta);
  database.prepare(`
    INSERT INTO knowledge_chunks
      (id, source_id, chunk_index, title, content, content_norm, metadata_json, summary, tags_json, entity_refs_json, visibility, heading_path, updated_at)
    VALUES (?, ?, 0, 'Phase 2W2H guard fixture', 'fixture', 'fixture', ?, 'fixture', '[]', '[]', 'kyc', 'fixture', datetime('now'))
  `).run(chunkId, sourceId, sourceMeta);

  database.prepare(`
    INSERT INTO extracted_anniversary_candidates
      (id, source_id, chunk_id, person_name, person_name_norm, generation, branch, birth_text, death_text, death_anniversary_lunar, hometown, grave_text, source_quote, heading_path, matched_member_id, matched_member_name, match_confidence, status, metadata_json, updated_at)
    VALUES (?, ?, ?, ?, ?, '', '', '15/5 am lich', '', '', '', '', 'Ngay sinh co field can kiem mapping.', 'fixture/dates', ?, ?, 'exact', 'approved', ?, datetime('now'))
  `).run(ids.annFieldWarning, sourceId, chunkId, memberA.name || 'Cao Van Guard', 'cao van guard', memberA.id, memberA.name || 'Cao Van Guard', metadata('dates_graves', { quality_flags: ['normalized_field_type'] }));

  const insertProfile = database.prepare(`
    INSERT INTO extracted_profile_candidates
      (id, candidate_type, person_name, person_name_norm, matched_member_id, matched_member_name, match_confidence, target_field, extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 'Phase 2W2H guard fixture', 'kyc', 'approved', ?, datetime('now'), datetime('now'))
  `);
  insertProfile.run(ids.profileIdentity, 'biography', memberA.name || 'Cao Van Guard', 'cao van guard', memberA.id, memberA.name || 'Cao Van Guard', 'weak', 'description', 'Hanh trang can xac nhan dung nhan vat.', 'Hanh trang can xac nhan dung nhan vat.', sourceId, chunkId, metadata('biography_legacy'));
  insertProfile.run(ids.profileNote, 'verification_note', 'Ghi chu kiem chung pha he', 'ghi chu kiem chung pha he', '', '', 'none', 'description', 'Moc can kiem chung, khong apply truc tiep.', 'Moc can kiem chung, khong apply truc tiep.', sourceId, chunkId, metadata('verification_notes', { notApplyDirectly: true, needsAdminReview: true }));
  insertProfile.run(ids.profileNoise, 'name_alias', 'Cao Van Nhieu', 'cao van nhieu', memberA.id, memberA.name || 'Cao Van Guard', 'exact', 'name', '', '', sourceId, chunkId, metadata('person_facts', { evidenceQuote: '', evidenceWindow: '' }));

  database.prepare(`
    INSERT INTO extracted_relationship_candidates
      (id, relationship_type, subject_name, subject_name_norm, subject_member_id, subject_member_name, subject_match_confidence, object_name, object_name_norm, object_member_id, object_member_name, object_match_confidence, direction, extracted_text, reviewed_text, source_quote, source_id, chunk_id, knowledge_title, visibility, status, flags_json, metadata_json, created_at, updated_at)
    VALUES (?, 'father', ?, ?, ?, ?, 'exact', ?, ?, ?, ?, 'exact', 'subject_to_object', 'Quan he can xac nhan loai va chieu.', '', 'Quan he can xac nhan loai va chieu.', ?, ?, 'Phase 2W2H guard fixture', 'kyc', 'approved', ?, ?, datetime('now'), datetime('now'))
  `).run(
    ids.relWarning,
    memberA.name || 'Cao Van Cha',
    'cao van cha',
    memberA.id,
    memberA.name || 'Cao Van Cha',
    memberB.name || 'Cao Van Con',
    'cao van con',
    memberB.id,
    memberB.name || 'Cao Van Con',
    sourceId,
    chunkId,
    JSON.stringify({ needs_manual_review: true }),
    metadata('relationships')
  );
  database.close();
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
  const headers = { 'Content-Type': 'application/json', Cookie: admin.cookie };
  const results = [];
  try {
    const tree = await fetchJson('/api/tree');
    const members = flattenTree(tree.data).filter((item) => item?.id);
    const memberA = members[0] || { id: 'phase2w2h-member-a', name: 'Cao Van Guard A' };
    const memberB = members.find((item) => item.id !== memberA?.id) || { id: 'phase2w2h-member-b', name: 'Cao Van Guard B' };
    const treeBefore = JSON.stringify(tree.data);
    installFixture(memberA, memberB);

    const annList = await fetchJson(`/api/knowledge/extracted-anniversaries?datasetKey=${dataset}&triageBucket=field_mapping_warning&status=approved`, { headers });
    results.push(result('anniversary-list-has-triage-guard', annList.response.ok && annList.data.candidates?.some((item) => item.id === ids.annFieldWarning && item.triage?.bucket === 'field_mapping_warning'), JSON.stringify(annList.data.candidates?.[0]?.triage || {})));

    const annBlocked = await fetchJson(`/api/knowledge/extracted-anniversaries/${ids.annFieldWarning}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: memberA.id })
    });
    results.push(result('anniversary-field-warning-requires-confirm', annBlocked.response.status === 409 && annBlocked.data.triageGuard?.requiredConfirmations?.includes('confirmFieldMapping'), JSON.stringify(annBlocked.data.triageGuard || annBlocked.data)));

    const profileBlocked = await fetchJson(`/api/knowledge/profile-candidates/${ids.profileIdentity}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ appendMode: 'append' })
    });
    results.push(result('profile-identity-requires-confirm', profileBlocked.response.status === 409 && profileBlocked.data.triageGuard?.requiredConfirmations?.includes('confirmIdentity'), JSON.stringify(profileBlocked.data.triageGuard || profileBlocked.data)));

    const noteBlocked = await fetchJson(`/api/knowledge/profile-candidates/${ids.profileNote}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    results.push(result('profile-note-cannot-apply-directly', noteBlocked.response.status === 409 && noteBlocked.data.triageGuard?.blockedReasons?.includes('do_not_apply_directly'), JSON.stringify(noteBlocked.data.triageGuard || noteBlocked.data)));

    const noiseBlocked = await fetchJson(`/api/knowledge/profile-candidates/${ids.profileNoise}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ memberId: memberA.id, confirmOverwrite: true })
    });
    results.push(result('profile-noise-cannot-apply', noiseBlocked.response.status === 409 && noiseBlocked.data.triageGuard?.blockedReasons?.includes('noise_reject_candidate'), JSON.stringify(noiseBlocked.data.triageGuard || noiseBlocked.data)));

    const relBlocked = await fetchJson(`/api/knowledge/relationship-candidates/${ids.relWarning}/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ subjectMemberId: memberA.id, objectMemberId: memberB.id })
    });
    results.push(result('relationship-warning-requires-confirm', relBlocked.response.status === 409 && relBlocked.data.triageGuard?.requiredConfirmations?.includes('confirmRelationshipReview'), JSON.stringify(relBlocked.data.triageGuard || relBlocked.data)));

    const treeAfter = await fetchJson('/api/tree');
    results.push(result('blocked-apply-does-not-change-tree', treeBefore === JSON.stringify(treeAfter.data), 'tree compare'));
  } finally {
    admin.cleanup();
    cleanupFixture();
  }
  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    console.error(`Phase 2W2H apply guardrails failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Phase 2W2H apply guardrails checks passed: ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
