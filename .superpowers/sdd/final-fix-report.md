# Plan 1 Review — Final Fix Report

**Branch:** `feat/core-stage-portal`  
**Date:** 2026-09-04

## Status: Complete

All Critical and Important findings from the whole-branch review are addressed. Marketing CTA minor fix included.

## Fixes by finding

### Critical #1 — Block deadlock
- Added `resumeStage(case, { actorRole, now? })` restoring sole `BLOCKED` → `ACTIVE` (ADVISOR only).
- Wired **Resume stage** in `AdvisorStageControls` when focus is blocked; block remains available when active.
- `blockStage` now rejects non-ADVISOR actors.
- Tests: `tests/domain/stage-engine.test.ts` — block/resume cycle, role guards.

### Important #2 — Case ACL
- Added `assertCaseAccess(userId, role, caseId)` and `loadCaseForUser` in `src/server/case-access.ts` / `cases.ts`.
- Portal, cockpit, and partner case loads and server actions use participant-scoped access.
- `listCasesForPartnerRole(userId, partnerRole)` filters by participant, not full-table scan.
- Warm intro calls `attachPartnerParticipant` to add the partner user as `CaseParticipant`.
- Tests: `tests/server/cases.roundtrip.test.ts` — access allow/deny.

### Important #3 — Cockpit/partner views on FREE cases
- Added `advisorStageView()` — full stage ledger, no free-tier stripping.
- Cockpit and partner case pages use `advisorStageView` instead of `clientStageView`.
- Test: `advisorStageView shows full ledger on FREE_DIY`.

### Important #4 — Submitted-but-unaccepted evidence
- Extended `StageState` with `submittedEvidenceKinds`.
- `submitEvidence`, `submitPartnerEvidence`, and `attestEvidence` (free) go through stage-engine paths.
- Portal/partner side mutators removed from actions.
- Mappers/saveCase persist `Evidence` rows with `accepted: false` for submitted kinds.
- Cockpit shows **awaiting acceptance** kinds; portal/partner show submitted-awaiting banners.

### Important #5 — ADVISOR-only advance
- `canAdvanceStage` restricted to `ADVISOR` only (partner advance removed).
- Tests: partner advance throws; advisor advance succeeds.

### Important #6 — Sign out
- `SignOutButton` server component added to portal, cockpit, and partner layouts.

### Important #7 — Action error surfacing
- `ActionErrorBanner` + client state in `AdvisorStageControls`, `WarmIntroButton`, `EvidenceSubmitForm`.

### Important #8 — saveCase events
- Replaced `deleteMany` + full rewrite with append-only: new events sliced from existing DB count.
- Test: advance after submit/accept persists `STAGE_ADVANCED` and stage state.

### Minor — Marketing CTA
- Home page `/signup` → `/login`.

## Verification

```
npm test   — 36/36 passed
npm run build — success
```

## Remaining known issues (not in scope)

- Warm intro attaches first user found for partner role (no per-partner picker).
- Concurrent multi-writer event append could still race without row-level locking (append-only is safe for single-writer flows).
- Partner cases only appear after warm intro attaches participant (seed partners are not pre-attached).
- Free client self-advance via `attestEvidence` does not use `advanceStage` (by design — attestation only).

## Files touched (summary)

- Domain: `stage-engine.ts`, `freemium.ts`
- Server: `cases.ts`, `case-access.ts`, `mappers.ts`, actions
- UI: layouts, case pages, `AdvisorStageControls`, `EvidenceSubmitForm`, `WarmIntroButton`, `SignOutButton`
- Tests: `stage-engine.test.ts`, `freemium.test.ts`, `cases.roundtrip.test.ts`
