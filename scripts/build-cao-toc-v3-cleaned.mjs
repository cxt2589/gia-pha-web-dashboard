import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const defaultInputDir = resolve(repoRoot, '..', 'gia-pha-ai-system-archive-20260530', 'Tai lieu', 'Cao_Toc_TXT_Knowledge_Base_v2');
const defaultOutputDir = resolve(repoRoot, '..', 'gia-pha-ai-system-archive-20260530', 'Tai lieu', 'Cao_Toc_TXT_Knowledge_Base_v3');

const inputDir = resolve(process.argv[2] || defaultInputDir);
const outputDir = resolve(process.argv[3] || defaultOutputDir);

const JSONL_FILES = {
  personFacts: '02_person_facts.jsonl',
  datesGraves: '03_dates_graves.jsonl',
  relationships: '04_relationships.jsonl',
  biographyLegacy: '05_biography_legacy.jsonl',
  verificationNotes: '06_verification_notes.jsonl'
};

const passthroughFiles = ['01_full_text_clean.txt', '07_rules_private.json'];

const report = {
  phase: '2W.2E-A',
  inputDir,
  outputDir,
  createdAt: new Date().toISOString(),
  sourceDataset: 'Cao_Toc_TXT_Knowledge_Base_v2',
  outputDataset: 'Cao_Toc_TXT_Knowledge_Base_v3',
  claudeUsage: {
    usedAsGenealogyEvidence: false,
    usedForTechnicalIdeasOnly: [
      'citation/evidence fields',
      'quality flags',
      'source classification',
      'local-first safety notes'
    ]
  },
  inputCounts: {},
  outputCounts: {},
  transformations: {},
  flags: {},
  examples: {},
  validation: {
    jsonlParseOk: true,
    errors: [],
    warnings: []
  }
};

function readJsonl(fileName) {
  const filePath = resolve(inputDir, fileName);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        report.validation.jsonlParseOk = false;
        report.validation.errors.push(`${fileName}:${index + 1}: ${err.message}`);
        throw err;
      }
    });
}

function writeJsonl(fileName, rows) {
  writeFileSync(resolve(outputDir, fileName), rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

function writeJson(fileName, value) {
  writeFileSync(resolve(outputDir, fileName), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value = '', max = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function addFlag(flag) {
  report.flags[flag] = (report.flags[flag] || 0) + 1;
}

function addTransformation(type, record, detail = '') {
  report.transformations[type] = (report.transformations[type] || 0) + 1;
  if (!report.examples[type]) report.examples[type] = [];
  if (report.examples[type].length < 8) {
    report.examples[type].push({
      recordId: record.record_id,
      personName: record.person_name || record.subject_name || '',
      detail: compactText(detail || record.value || record.relationship_note || record.source_quote || '', 180)
    });
  }
}

function evidenceWindow(record) {
  return compactText([
    record.section,
    record.page_hint ? `page ${record.page_hint}` : '',
    record.source_quote || record.value || record.relationship_note || record.issue_summary || '',
    record.notes
  ].filter(Boolean).join('\n'), 1000);
}

function withCleaning(record, flags = [], note = '', extra = {}) {
  const uniqueFlags = uniq(flags);
  uniqueFlags.forEach(addFlag);
  const forceReview = uniqueFlags.some((flag) => /ambiguous|moved|mixed|nested|long|not_|needs_review|invalid|relationship_from_wrong_group/.test(flag));
  const nextConfidence = forceReview && record.confidence === 'high' ? 'medium' : (forceReview ? (record.confidence || 'medium') : (record.confidence || 'medium'));
  return {
    ...record,
    ...extra,
    confidence: nextConfidence,
    needs_admin_review: Boolean(record.needs_admin_review || forceReview),
    evidence_window: evidenceWindow(record),
    quality_flags: uniqueFlags,
    cleaning_version: 'Cao_Toc_TXT_Knowledge_Base_v3',
    source_dataset: 'Cao_Toc_TXT_Knowledge_Base_v2',
    cleaning_note: note || record.cleaning_note || ''
  };
}

function makeVerificationFrom(record, issueType, issueSummary, recommendedAction, relatedPersonNames = [], flags = []) {
  return withCleaning({
    record_id: nextId('verification_from_cleaning'),
    source_type: 'verification_note',
    source_title: record.source_title || 'Cao Tộc Phả',
    section: record.section || 'Dữ liệu cần kiểm chứng sau chuẩn hóa v3',
    page_hint: record.page_hint || '',
    related_person_names: relatedPersonNames.filter(Boolean),
    issue_type: issueType,
    issue_summary: issueSummary,
    source_quote: record.source_quote || record.value || record.relationship_note || '',
    recommended_action: recommendedAction,
    confidence: 'low',
    needs_admin_review: true,
    notes: `Nguồn record v2: ${record.record_id || ''}`
  }, ['moved_to_verification_note', ...flags], recommendedAction);
}

const idCounters = new Map();
function nextId(prefix) {
  const next = (idCounters.get(prefix) || 0) + 1;
  idCounters.set(prefix, next);
  return `${prefix}_${String(next).padStart(6, '0')}`;
}

function cleanName(value = '') {
  return String(value || '')
    .replace(/[\p{Script=Han}]+/gu, ' ')
    .replace(/[，。;:,.()[\]{}"“”'‘’+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLikelyCaoNames(value = '') {
  const text = String(value || '').replace(/\s+/g, ' ');
  const matches = [];
  const re = /\bCao\s+(?:Đình|Duy|Văn|Xuân|Hữu|Quang|Thế|Minh|Mạnh|Bá|Trọng|Viết|Ngọc|Sỹ|Sĩ|Phúc|Phú|Thị)\s+[\p{L}]{2,}(?:\s+[\p{L}]{2,})?/gu;
  for (const match of text.matchAll(re)) {
    const name = cleanName(match[0]);
    const normalized = normalizeText(name);
    if (
      name.length >= 8 &&
      name.length <= 70 &&
      !/( tham | phai | sinh | ngay | cung | tong | xa | thuy co | lam | trong )/.test(` ${normalized} `)
    ) {
      matches.push(name);
    }
  }
  return uniq(matches);
}

function extractSpouseNames(value = '') {
  const text = String(value || '').replace(/\s+/g, ' ');
  const matches = [];
  const re = /\b(?:Nguyễn|Trần|Phạm|Lê|Vũ|Đỗ|Bùi|Hoàng|Dương|Đặng|Đinh)\s+Thị\s+[\p{L}]{2,}(?:\s+[\p{L}]{2,})?/gu;
  for (const match of text.matchAll(re)) {
    const name = cleanName(match[0]);
    if (name.length <= 70) matches.push(name);
  }
  return uniq(matches);
}

function containsRelationshipText(value = '') {
  const text = normalizeText(value);
  return /(con trai|con gai|sinh duoc|nguoi con|vo ca|vo hai|vo ong|vo cua|chong|than phu|than mau|cha cua|me cua|la cha|la me)/.test(text);
}

function containsSpouseNestedContext(value = '') {
  const text = normalizeText(value);
  return /(vo ong|vo cua ong|vo ca|vo hai|ba .* que|ten la .* que|nguyen thi)/.test(text);
}

function isActualGraveText(value = '') {
  const text = normalizeText(value);
  if (!text) return false;
  if (/(mo phu|mo dan|mo nguoi|khong co mo)/.test(text)) return false;
  return /(mo cua|mo ong|mo ba|phan mo|lang mo|noi an tang|an tang|mai tang|mo phan|\bmo\b)/.test(text)
    && /( o | tai | xu | dong | ruong | lang | xa | thon | nghia trang | nam | bac | dong | tay )/.test(` ${text} `);
}

function isHistoricalNarrative(value = '') {
  const text = normalizeText(value);
  return String(value || '').length > 260
    || /(lap nghiep|khai co|lam nghe|thuy co|ly truong|pho ly|tham gia|dang cong san|dang dan chu|nguoi phap|don dien|quan huyen|tong doc|trai do|quy de|nam dinh|nghe song nuoc|dan chai|hoat dong)/.test(text);
}

function suspiciousPersonName(value = '') {
  const text = normalizeText(value);
  return String(value || '').length > 80 || /( tham gia | phai | o thuy co | tong | xa | lam ly truong | mua chuc )/.test(` ${text} `);
}

function likelyInvalidRelationshipObject(value = '') {
  const text = normalizeText(value);
  return !value
    || String(value).length > 80
    || /^(la|mot|hai|ba|bon|nguoi)\b/.test(text)
    || /(ngay|gio|thang|nam|muon giu|gai ep|phai di|va cung la|tham gia|tong|xa|nguoi phap|don dien)/.test(text);
}

function makeRelationshipFromDate(record, objectName, relationshipType = 'child') {
  return withCleaning({
    record_id: nextId('relationship_from_date_grave'),
    source_type: record.source_type || 'genealogy_evidence',
    source_title: record.source_title || 'Cao Tộc Phả',
    section: record.section || '',
    page_hint: record.page_hint || '',
    relationship_type: relationshipType,
    subject_name: cleanName(record.person_name || ''),
    object_name: cleanName(objectName),
    direction: 'subject_to_object',
    relationship_note: record.source_quote || record.value || '',
    source_quote: record.source_quote || record.value || '',
    confidence: 'medium',
    needs_admin_review: true,
    notes: `Tách từ ${record.record_id}; v2 gán nhầm nhóm dates_graves.`
  }, ['relationship_from_wrong_group', 'needs_manual_review'], 'Tách quan hệ từ record ngày/mộ chí bị gán nhầm.');
}

function makeBiographyFromDate(record, legacyType, flags = []) {
  return withCleaning({
    record_id: nextId('bio_from_date_grave'),
    source_type: record.source_type || 'genealogy_evidence',
    source_title: record.source_title || 'Cao Tộc Phả',
    section: record.section || '',
    page_hint: record.page_hint || '',
    person_name: record.person_name || '',
    legacy_type: legacyType,
    value: record.value || record.source_quote || '',
    source_quote: record.source_quote || record.value || '',
    confidence: 'medium',
    needs_admin_review: true,
    notes: `Tách từ ${record.record_id}; v2 gán nhầm nhóm dates_graves.`
  }, ['moved_from_dates_graves', ...flags], 'Chuyển sang hành trạng/công lao vì không phải mộ chí/ngày tháng trực tiếp.');
}

function makeDateFromBiography(record, fieldType = 'grave') {
  return withCleaning({
    record_id: nextId('date_from_bio_legacy'),
    source_type: record.source_type || 'genealogy_evidence',
    source_title: record.source_title || 'Cao Tộc Phả',
    section: record.section || '',
    page_hint: record.page_hint || '',
    person_name: record.person_name || '',
    field_type: fieldType,
    calendar: 'not_applicable',
    value: record.value || record.source_quote || '',
    source_quote: record.source_quote || record.value || '',
    confidence: 'medium',
    needs_admin_review: true,
    notes: `Tách từ ${record.record_id}; v2 gán nhầm nhóm biography_legacy.`
  }, ['moved_from_biography', 'actual_grave_from_biography'], 'Chuyển sang ngày tháng/mộ chí vì nội dung là vị trí mộ/an táng.');
}

function normalizeDateFieldType(record) {
  const map = {
    birth_date: 'birth',
    death_date: 'death',
    lunar_anniversary: 'lunar_anniversary',
    anniversary: 'lunar_anniversary',
    hometown: 'hometown',
    origin: 'origin',
    residence: 'residence',
    grave: 'grave',
    burial_place: 'burial_place',
    tomb_note: 'tomb_note'
  };
  const fieldType = map[String(record.field_type || '').trim()] || String(record.field_type || '').trim();
  const flags = [];
  if (fieldType !== record.field_type) flags.push('normalized_field_type');
  const extra = { field_type: fieldType };
  if (fieldType === 'birth' || fieldType === 'death') {
    extra.target_field = fieldType === 'birth' ? 'birth_text' : 'death_text';
  } else if (fieldType === 'lunar_anniversary') {
    extra.target_field = 'death_anniversary_lunar';
  } else if (['hometown', 'origin', 'residence'].includes(fieldType)) {
    extra.target_field = 'hometown';
  } else if (['grave', 'burial_place', 'tomb_note'].includes(fieldType)) {
    extra.target_field = 'grave_text';
  }
  return { fieldType, flags, extra };
}

function classifyBiographyType(record) {
  const text = normalizeText(`${record.value || ''} ${record.source_quote || ''}`);
  if (/(cong lao|cong trang|vinh danh|dong gop|phung su)/.test(text)) return 'achievement';
  if (/(ly truong|pho ly|chuc|su nghiep|hoc luc|han hoc|dang cong san|dang dan chu|du kich|khai co|lap nghiep)/.test(text)) return 'career';
  if (/(vo ong|vo cua|vo ca|vo hai|nguyen thi)/.test(text)) return 'spouse_note';
  if (/(than phu|than mau|cha cua|me cua)/.test(text)) return 'parent_note';
  if (/(di san|tich trang|mo chi)/.test(text)) return 'legacy_note';
  return record.legacy_type || 'biography';
}

function processPersonFacts(rows) {
  return rows.map((record) => {
    const flags = [];
    const extra = {};
    const fieldType = String(record.field_type || '').trim();
    if (fieldType === 'name') extra.target_field = 'name';
    if (fieldType === 'title' || fieldType === 'alias' || fieldType === 'display_name') extra.target_field = 'name';
    if (fieldType === 'generation') extra.target_field = 'generation';
    if (suspiciousPersonName(record.person_name)) flags.push('ambiguous_person_name');
    return withCleaning(record, flags, 'Giữ nguyên dữ liệu họ tên/danh xưng, bổ sung metadata evidence.', extra);
  });
}

function processDatesGraves(rows, output) {
  for (const record of rows) {
    const value = String(record.value || '');
    const quote = String(record.source_quote || value);
    const fullText = `${value} ${quote}`;
    const { fieldType, flags, extra } = normalizeDateFieldType(record);
    const baseFlags = [...flags];
    if (suspiciousPersonName(record.person_name)) {
      const note = makeVerificationFrom(
        record,
        'ambiguous_person_name',
        `Tên chủ thể trong record ${record.record_id} có vẻ bị kéo dài thành một câu, không nên import trực tiếp.`,
        'Admin cần mở nguồn gốc, xác định lại người liên quan trước khi tạo candidate.',
        extractLikelyCaoNames(fullText),
        ['ambiguous_person_name']
      );
      output.verificationNotes.push(note);
      addTransformation('dates_graves_to_verification_ambiguous_person', record, record.person_name);
      continue;
    }

    if (fieldType === 'grave') {
      const names = extractLikelyCaoNames(fullText).filter((name) => normalizeText(name) !== normalizeText(cleanName(record.person_name)));
      if (containsRelationshipText(fullText) && names.length && !isActualGraveText(fullText)) {
        for (const name of names) output.relationships.push(makeRelationshipFromDate(record, name, 'child'));
        addTransformation('dates_graves_to_relationship', record, names.join(', '));
        continue;
      }
      if (containsSpouseNestedContext(fullText)) {
        const spouseNames = extractSpouseNames(fullText);
        output.biographyLegacy.push(makeBiographyFromDate(record, 'spouse_note', ['spouse_info_nested']));
        output.verificationNotes.push(makeVerificationFrom(
          record,
          'spouse_nested_data',
          `Record ${record.record_id} chứa thông tin phối ngẫu/quê quán/ngày mất của phối ngẫu, không phải mộ chí trực tiếp của ${record.person_name}.`,
          'Admin cần duyệt riêng vào cấu trúc phối ngẫu trước khi áp dụng.',
          [record.person_name, ...spouseNames],
          ['spouse_info_nested']
        ));
        addTransformation('dates_graves_spouse_context_to_bio_and_verification', record, spouseNames.join(', '));
        continue;
      }
      if (!isActualGraveText(fullText) && isHistoricalNarrative(fullText)) {
        output.biographyLegacy.push(makeBiographyFromDate(record, classifyBiographyType(record), ['not_grave_context']));
        addTransformation('dates_graves_to_biography', record, value);
        continue;
      }
      if (!isActualGraveText(fullText)) {
        output.verificationNotes.push(makeVerificationFrom(
          record,
          'grave_mapping_uncertain',
          `Record ${record.record_id} được gán là mộ chí nhưng evidence không thể hiện rõ vị trí mộ/an táng.`,
          'Không apply vào mộ chí cho tới khi admin xác định đây đúng là thông tin mộ phần.',
          [record.person_name, ...names],
          ['not_grave_context']
        ));
        addTransformation('dates_graves_grave_to_verification_uncertain', record, value);
        continue;
      }
      output.datesGraves.push(withCleaning({ ...record, ...extra }, baseFlags, 'Giữ làm mộ chí vì evidence có dấu hiệu vị trí mộ/an táng.'));
      continue;
    }

    if (['hometown', 'origin', 'residence'].includes(fieldType) && containsSpouseNestedContext(fullText)) {
      const spouseNames = extractSpouseNames(fullText);
      output.biographyLegacy.push(makeBiographyFromDate(record, 'spouse_note', ['spouse_info_nested', 'mixed_hometown_context']));
      output.verificationNotes.push(makeVerificationFrom(
        record,
        'hometown_nested_spouse_context',
        `Record ${record.record_id} có quê quán trong ngữ cảnh phối ngẫu, không nên gán thẳng cho ${record.person_name}.`,
        'Cần duyệt vào phần phối ngẫu hoặc ghi chú kiểm chứng thay vì hometown cá nhân.',
        [record.person_name, ...spouseNames],
        ['mixed_hometown_context']
      ));
      addTransformation('hometown_spouse_context_to_bio_and_verification', record, spouseNames.join(', '));
      continue;
    }

    output.datesGraves.push(withCleaning({ ...record, ...extra }, baseFlags, 'Chuẩn hóa field_type/target_field cho workflow ngày tháng và mộ chí.'));
  }
}

function processRelationships(rows, output) {
  for (const record of rows) {
    const fullText = `${record.relationship_note || ''} ${record.source_quote || ''}`;
    const flags = [];
    if (suspiciousPersonName(record.subject_name)) flags.push('ambiguous_subject_name');
    if (likelyInvalidRelationshipObject(record.object_name)) flags.push('invalid_or_ambiguous_object_name');
    if (flags.length) {
      output.verificationNotes.push(makeVerificationFrom(
        record,
        'relationship_mapping_uncertain',
        `Record quan hệ ${record.record_id} chưa có subject/object đủ sạch để tạo quan hệ phả hệ trực tiếp.`,
        'Admin cần đọc trích dẫn nguồn, xác định chủ thể - quan hệ - đối tượng trước khi tạo candidate quan hệ.',
        uniq([record.subject_name, record.object_name, ...extractLikelyCaoNames(fullText)]),
        flags
      ));
      addTransformation('relationship_to_verification_uncertain', record, `${record.subject_name} -> ${record.object_name}`);
      continue;
    }
    output.relationships.push(withCleaning(record, flags, 'Giữ làm quan hệ vì có đủ chủ thể, quan hệ và đối tượng.'));
  }
}

function processBiography(rows, output) {
  for (const record of rows) {
    const fullText = `${record.value || ''} ${record.source_quote || ''}`;
    const names = extractLikelyCaoNames(fullText).filter((name) => normalizeText(name) !== normalizeText(cleanName(record.person_name)));
    if (isActualGraveText(fullText)) {
      output.datesGraves.push(makeDateFromBiography(record, 'grave'));
      addTransformation('biography_to_dates_graves', record, record.value);
      continue;
    }
    if (containsRelationshipText(fullText) && names.length && String(record.value || '').length < 180) {
      for (const name of names) output.relationships.push(makeRelationshipFromDate(record, name, 'child'));
      addTransformation('biography_to_relationship', record, names.join(', '));
      continue;
    }
    const legacyType = classifyBiographyType(record);
    const flags = [];
    if (legacyType !== record.legacy_type) flags.push('normalized_legacy_type');
    if (String(record.value || '').length > 900) flags.push('long_biography_needs_review');
    output.biographyLegacy.push(withCleaning({ ...record, legacy_type: legacyType }, flags, 'Chuẩn hóa legacy_type và bổ sung evidence metadata.'));
  }
}

function processVerificationNotes(rows) {
  return rows.map((record) => withCleaning(record, ['verification_note'], 'Giữ làm ghi chú kiểm chứng, không apply trực tiếp.'));
}

function validateOutputs(output) {
  for (const row of output.datesGraves) {
    if (row.field_type === 'grave' && !isActualGraveText(`${row.value || ''} ${row.source_quote || ''}`)) {
      report.validation.warnings.push(`grave_uncertain_remaining:${row.record_id}`);
    }
    if (row.field_type === 'birth_date' || row.field_type === 'death_date') {
      report.validation.errors.push(`legacy_date_field_remaining:${row.record_id}:${row.field_type}`);
    }
  }
  for (const row of output.relationships) {
    if (!row.subject_name || !row.object_name || likelyInvalidRelationshipObject(row.object_name)) {
      report.validation.warnings.push(`relationship_uncertain_remaining:${row.record_id}`);
    }
  }
  if (report.validation.errors.length) report.validation.jsonlParseOk = false;
}

if (!existsSync(inputDir)) {
  throw new Error(`Input dataset not found: ${inputDir}`);
}

if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of passthroughFiles) {
  const src = resolve(inputDir, file);
  if (existsSync(src)) copyFileSync(src, resolve(outputDir, file));
}

const personFacts = readJsonl(JSONL_FILES.personFacts);
const datesGraves = readJsonl(JSONL_FILES.datesGraves);
const relationships = readJsonl(JSONL_FILES.relationships);
const biographyLegacy = readJsonl(JSONL_FILES.biographyLegacy);
const verificationNotes = readJsonl(JSONL_FILES.verificationNotes);

report.inputCounts = {
  personFacts: personFacts.length,
  datesGraves: datesGraves.length,
  relationships: relationships.length,
  biographyLegacy: biographyLegacy.length,
  verificationNotes: verificationNotes.length
};

const output = {
  personFacts: processPersonFacts(personFacts),
  datesGraves: [],
  relationships: [],
  biographyLegacy: [],
  verificationNotes: processVerificationNotes(verificationNotes)
};

processDatesGraves(datesGraves, output);
processRelationships(relationships, output);
processBiography(biographyLegacy, output);
validateOutputs(output);

report.outputCounts = {
  personFacts: output.personFacts.length,
  datesGraves: output.datesGraves.length,
  relationships: output.relationships.length,
  biographyLegacy: output.biographyLegacy.length,
  verificationNotes: output.verificationNotes.length
};

writeJsonl(JSONL_FILES.personFacts, output.personFacts);
writeJsonl(JSONL_FILES.datesGraves, output.datesGraves);
writeJsonl(JSONL_FILES.relationships, output.relationships);
writeJsonl(JSONL_FILES.biographyLegacy, output.biographyLegacy);
writeJsonl(JSONL_FILES.verificationNotes, output.verificationNotes);

const manifest = {
  dataset_name: 'Cao_Toc_TXT_Knowledge_Base_v3',
  created_at: report.createdAt,
  based_on: basename(inputDir),
  purpose: 'Bản làm sạch để import/rescan an toàn: chuẩn hóa field_type, tách nhầm mộ chí/quê quán/hành trạng/quan hệ, bổ sung citation metadata.',
  input_files: Object.values(JSONL_FILES),
  output_files: [
    '01_full_text_clean.txt',
    ...Object.values(JSONL_FILES),
    '07_rules_private.json',
    'manifest.json',
    'README.md',
    'phase-2w2e-a-cleaning-report.json',
    'phase-2w2e-a-cleaning-report.md'
  ],
  record_counts: report.outputCounts,
  quality_check: {
    jsonl_parse_ok: report.validation.jsonlParseOk,
    errors: report.validation.errors,
    warnings_count: report.validation.warnings.length,
    notes: 'Không tự sửa Hán/Nôm, không lấy Claude làm evidence; mọi record có quality_flags cần admin duyệt kỹ trước khi apply.'
  },
  import_policy: {
    auto_apply: false,
    allow_production_import_after_review: true,
    dataset_key_recommended: 'cao_toc_txt_knowledge_base_v3'
  }
};

writeJson('manifest.json', manifest);
writeJson('phase-2w2e-a-cleaning-report.json', report);

const reportMd = `# Phase 2W.2E-A - Làm sạch Cao_Toc_TXT_Knowledge_Base_v2 thành v3

## Kết quả

- Input: \`${inputDir}\`
- Output: \`${outputDir}\`
- Không import production.
- Không tự apply dữ liệu vào cây phả.
- Không dùng bản Claude làm evidence gia phả.

## Số lượng record

| Nhóm | v2 input | v3 output |
| --- | ---: | ---: |
| Họ tên/danh xưng | ${report.inputCounts.personFacts} | ${report.outputCounts.personFacts} |
| Ngày tháng/mộ chí | ${report.inputCounts.datesGraves} | ${report.outputCounts.datesGraves} |
| Quan hệ | ${report.inputCounts.relationships} | ${report.outputCounts.relationships} |
| Hành trạng/công lao | ${report.inputCounts.biographyLegacy} | ${report.outputCounts.biographyLegacy} |
| Ghi chú kiểm chứng | ${report.inputCounts.verificationNotes} | ${report.outputCounts.verificationNotes} |

## Chuyển nhóm chính

${Object.entries(report.transformations).map(([key, count]) => `- ${key}: ${count}`).join('\n') || '- Không có'}

## Quality flags

${Object.entries(report.flags).map(([key, count]) => `- ${key}: ${count}`).join('\n') || '- Không có'}

## Lưu ý import

- Dùng datasetKey đề xuất: \`cao_toc_txt_knowledge_base_v3\`.
- Không auto-apply candidate.
- Record có \`quality_flags\` hoặc \`needs_admin_review=true\` phải được admin duyệt kỹ.
- Các record phối ngẫu/mẹ/con/hành trạng phức tạp đã được chuyển sang nhóm phù hợp hoặc ghi chú kiểm chứng thay vì để thành mộ chí/quê quán trực tiếp.
`;

writeFileSync(resolve(outputDir, 'phase-2w2e-a-cleaning-report.md'), reportMd, 'utf8');

const readme = `# Cao_Toc_TXT_Knowledge_Base_v3

Bản v3 được tạo từ \`Cao_Toc_TXT_Knowledge_Base_v2\` trong Phase 2W.2E-A.

Mục tiêu:

- Giữ dữ liệu gia phả gốc từ Cao Tộc Phả.
- Chuẩn hóa field để importer hiện tại đọc đúng.
- Tách các record bị lẫn nhóm: ngày/mộ chí, quê quán, quan hệ, hành trạng, phối ngẫu.
- Bổ sung \`quality_flags\`, \`evidence_window\`, \`target_field\`, \`cleaning_note\`.

Không làm:

- Không dùng bản Claude làm bằng chứng gia phả.
- Không tự sửa Hán/Nôm.
- Không tự xác minh ngày tháng/quan hệ.
- Không tự apply vào cây phả.

Xem báo cáo:

- \`phase-2w2e-a-cleaning-report.md\`
- \`phase-2w2e-a-cleaning-report.json\`
`;

writeFileSync(resolve(outputDir, 'README.md'), readme, 'utf8');

console.log(JSON.stringify({
  ok: true,
  inputDir,
  outputDir,
  inputCounts: report.inputCounts,
  outputCounts: report.outputCounts,
  transformations: report.transformations,
  flags: report.flags,
  errors: report.validation.errors.length,
  warnings: report.validation.warnings.length
}, null, 2));
