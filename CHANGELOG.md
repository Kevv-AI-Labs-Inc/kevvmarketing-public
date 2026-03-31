# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-30

### Added
- **Prospecting Dashboard** — Daily AI pitch engine for expired/FSBO leads (Phase 1 core engine)
  - `/prospecting` page with MLS ID/address input
  - `prospecting.generateBrief` tRPC mutation (non-streaming Phase 1, SSE in Phase 1.5)
  - `prospect_briefs` and `prospect_feedback` tables (serial PKs, `user_id` ownership)
  - Script tone selector (professional/friendly/direct/empathetic)
  - Postcard one-click via server mutation
  - Address disambiguation picker for multi-hit listings
  - Real comps data integration with BBO Listing Data Service
  - Test coverage audit and 27 new test cases

### Changed
- Simplified tool endpoint: tRPC API-key path replaces separate JSON adapter
- Deferred SSE streaming to Phase 1.5 for faster Phase 1 validation
- Switched PKs from UUID to serial (match codebase pattern)
- Agent ownership uses `users.id` (match existing router pattern)
- Comps engine replaced with BBO comparable sales endpoint (real data vs. heuristic estimates)

### Documentation
- Finalized Prospecting Dashboard plan after Codex review (25 findings, 7 resolved)
- Updated TODOS.md with pre-implementation checklist
- All 4 reviews cleared (CEO + ENG + DESIGN + CODEX)
