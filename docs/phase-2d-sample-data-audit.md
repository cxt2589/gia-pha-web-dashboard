# Phase 2D Sample Data Audit

Date: 2026-05-31

This audit records sample/demo data found during Phase 2D. It is a report only; no production data or backup database files were deleted.

## Summary

- The strongest sample-data signals are in archived/reference material under `docs/dashboard-reference/**` and local analysis folders outside the app repo.
- The active app still contains a few default labels/placeholders mentioning Ninh Binh, Truong Yen, Yen Khanh, Gia Sinh, and old sample import examples.
- Phase 2A seed files are intentionally preserved.
- Items below should be reviewed by an admin before deletion or rewrite because some place names may be real clan data.

## Source Code Sample Signals

Likely demo/reference content:

- `docs/dashboard-reference/dashboard.md`
- `docs/dashboard-reference/dashboard.json`
- `docs/dashboard-reference/source/**`

These files contain old "Ho Cao Ninh Binh" reference material, mock data, Unsplash URLs, and historical names that were already marked as old sample data in prior phases. They are documentation/reference files, not live production state.

Active app locations to review:

- `src/admin-dashboard-total/components/Sidebar.tsx`
  - Contains visible "Ho Cao Ninh Binh" branding text.
- `src/admin-dashboard-total/components/SettingsManager.tsx`
  - Contains "Sac mau Hoang gia Ninh Binh" wording in theme preview.
- `src/admin-dashboard-total/components/Treasury.tsx`
  - Contains default branch names such as `Chi Truong (Truong Yen)`, `Chi Thu Hai (Yen Khanh)`, `Chi Thu Ba (Gia Sinh)`.
- `src/admin-dashboard-total/components/Genealogy.tsx`
  - Contains default branch/location examples and paste-sample rows using `EX_NB*`.
  - Contains old sample Google Apps Script endpoint `hocaoninhbinh.vn`.
- `src/admin-dashboard-total/components/AIHelper.tsx`
  - Already includes cleanup rules replacing old sample identities such as Cao Quy Cong/Cao Van Lam.

## State/Data Signals

Potential server/dashboard state keys that may contain old sample content:

- `dashboard-articles`
- `dashboard-events`
- `dashboard-knowledge`
- `dashboard-zalo-rules`
- `dashboard-lineage`

Do not purge these automatically. Review through admin UI or export first, because production may have real edits mixed with older sample content.

## Real Data Candidates For Knowledge Import

Local folders reviewed:

- `C:\Users\truon\Documents\Game\tai lieu lam dashboard`
- `C:\Users\truon\Documents\Game\gia-pha-ai-system-archive-20260530`

Safer candidates to import after admin confirmation:

- `gia-pha-ai-system-archive-20260530/docs/ai-system-model.md`
- `gia-pha-ai-system-archive-20260530/docs/implementation-roadmap.md`
- `gia-pha-ai-system-archive-20260530/docs/conversation-summary.md`

Do not import automatically:

- `*.tar.gz` snapshots
- `_analysis_*` source folders
- old mock data files
- generated dashboard reference docs that still mention old Ninh Binh sample data

## Recommendation

1. Keep Phase 2A alias seed unchanged.
2. Use AI eval cases to verify alias/guardrail behavior after any cleanup.
3. Replace visible old branding/default examples only after the clan admin confirms the correct public wording and branch/place names.
4. Import only curated `.md/.txt/.json/.csv` documents into backend knowledge; avoid bulk imports from snapshots.
