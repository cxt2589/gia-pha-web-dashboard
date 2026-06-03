# Phase 2W.2D - Claude Ideas, Technical Only

This note records technical ideas reviewed for Phase 2W.2D. It is not a genealogy source, not public knowledge, and not evidence for any family-tree fact.

Ideas adopted selectively:

- Clear citations: AI responses that use local knowledge should expose source title, heading path, chunk id, and a short evidence quote when available.
- Local-first behavior: answer locally when alias, applied data, or trusted knowledge is sufficient.
- Alias expansion: expand important Cao Toc aliases such as Cao To, Thuy To, Lang, Nhieu Lang, Thuat, and related titles before scoring chunks.
- Ranking/scoring: boost exact phrase, person names, aliases, source titles, and heading paths; penalize long weak chunks.
- Bot config limits: keep top chunks and context characters bounded by bot configuration.
- Cache key safety: include bot type, query/auth scope, and a compact local-context hash.
- Lightweight public guard: protect public webview chat from short burst abuse without affecting admin/KYC flows.
- Operations checklist: expose AI rules and address labels in the dashboard so admin can inspect behavior.
- Scope boundaries: keep public/KYC/admin filtering in search and citations.
- Guardrails: do not invent dates, Han/Nom readings, titles, relationships, or corrections without verified/applied evidence.

Explicitly not adopted:

- No Claude output is imported into the knowledge base.
- No Claude text is treated as genealogy evidence.
- No Claude schema/code is copied over the current system.
- No original lineage data is changed by this phase.
