import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const datasetDir = resolve(repoRoot, '..', 'gia-pha-ai-system-archive-20260530', 'Tai lieu', 'Cao_Toc_TXT_Knowledge_Base_v3');

const files = [
  '02_person_facts.jsonl',
  '03_dates_graves.jsonl',
  '04_relationships.jsonl',
  '05_biography_legacy.jsonl',
  '06_verification_notes.jsonl'
];

function readJsonl(fileName) {
  const filePath = resolve(datasetDir, fileName);
  if (!existsSync(filePath)) throw new Error(`Missing ${fileName}`);
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${fileName}:${index + 1}: ${err.message}`);
      }
    });
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

function result(id, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` - ${detail}` : ''}`);
  return { id, ok, detail };
}

const checks = [];

const data = Object.fromEntries(files.map((file) => [file, readJsonl(file)]));
const manifest = JSON.parse(readFileSync(resolve(datasetDir, 'manifest.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(datasetDir, 'phase-2w2e-a-cleaning-report.json'), 'utf8'));

checks.push(result('manifest-is-v3', manifest.dataset_name === 'Cao_Toc_TXT_Knowledge_Base_v3', manifest.dataset_name));
checks.push(result('report-no-claude-evidence', report.claudeUsage?.usedAsGenealogyEvidence === false, JSON.stringify(report.claudeUsage)));

checks.push(result(
  'record-counts-match-report',
  data['02_person_facts.jsonl'].length === report.outputCounts.personFacts &&
    data['03_dates_graves.jsonl'].length === report.outputCounts.datesGraves &&
    data['04_relationships.jsonl'].length === report.outputCounts.relationships &&
    data['05_biography_legacy.jsonl'].length === report.outputCounts.biographyLegacy &&
    data['06_verification_notes.jsonl'].length === report.outputCounts.verificationNotes,
  JSON.stringify(report.outputCounts)
));

const legacyDateFields = data['03_dates_graves.jsonl'].filter((row) => ['birth_date', 'death_date'].includes(row.field_type));
checks.push(result('no-legacy-date-field-types', legacyDateFields.length === 0, legacyDateFields.slice(0, 3).map((row) => row.record_id).join(', ')));

const missingEvidenceWindow = files.flatMap((file) => data[file].filter((row) => !row.evidence_window).map((row) => `${file}:${row.record_id}`));
checks.push(result('all-records-have-evidence-window', missingEvidenceWindow.length === 0, missingEvidenceWindow.slice(0, 3).join(', ')));

const relationshipRows = data['04_relationships.jsonl'];
const hanObjectNames = relationshipRows.filter((row) => /[\u4e00-\u9fff]/u.test(row.object_name || ''));
checks.push(result('relationship-object-name-no-han-script', hanObjectNames.length === 0, hanObjectNames.slice(0, 3).map((row) => row.object_name).join(', ')));

const sentenceObjects = relationshipRows.filter((row) => /^(la|mot|một|hai|ba)\b/.test(normalizeText(row.object_name || '')));
checks.push(result('relationship-object-not-sentence-fragment', sentenceObjects.length === 0, sentenceObjects.slice(0, 3).map((row) => row.object_name).join(', ')));

const selfRelationships = relationshipRows.filter((row) => normalizeText(row.subject_name) && normalizeText(row.subject_name) === normalizeText(row.object_name));
checks.push(result('no-self-relationships', selfRelationships.length === 0, selfRelationships.slice(0, 3).map((row) => row.record_id).join(', ')));

const graveRows = data['03_dates_graves.jsonl'].filter((row) => row.field_type === 'grave');
const uncertainGraveRows = graveRows.filter((row) => {
  const text = normalizeText([row.value, row.source_quote].join(' '));
  return !/(mo cua|mo ong|mo ba|phan mo|lang mo|noi an tang|an tang|mai tang|mo phan|\bmo\b)/.test(text);
});
checks.push(result('grave-records-have-grave-evidence', uncertainGraveRows.length === 0, uncertainGraveRows.slice(0, 3).map((row) => row.record_id).join(', ')));

const verificationMoved = data['06_verification_notes.jsonl'].filter((row) => (row.quality_flags || []).includes('moved_to_verification_note'));
checks.push(result('uncertain-records-moved-to-verification', verificationMoved.length >= 80, `${verificationMoved.length}`));

const normalizedDateFields = data['03_dates_graves.jsonl'].filter((row) => (row.quality_flags || []).includes('normalized_field_type'));
checks.push(result('date-fields-normalized', normalizedDateFields.length >= 300, `${normalizedDateFields.length}`));

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`Phase 2W.2E v3 cleaned checks failed: ${failed.map((item) => item.id).join(', ')}`);
  process.exit(1);
}

console.log(`Phase 2W.2E v3 cleaned checks passed: ${checks.length}/${checks.length}`);
