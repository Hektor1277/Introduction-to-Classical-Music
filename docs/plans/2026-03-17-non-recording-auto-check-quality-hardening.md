# Non-Recording Auto Check Quality Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run a full non-recording auto-check audit, add LLM-backed quality review, and harden type-specific logic so composers, conductors, orchestras, artists, and works all produce higher-quality proposals.

**Architecture:** Use the existing automation pipeline as the execution backbone, but split the problem into two layers: proposal generation and proposal quality review. First, audit the current output across all non-recording categories and capture concrete failure modes by entity type. Then extend the automation layer with explicit type-aware quality review and stricter proposal gating, backed by tests and an audit script so quality can be re-measured after each change.

**Tech Stack:** TypeScript, Node.js, Vitest, existing owner automation job manager, DeepSeek/OpenAI-compatible LLM integration.

---

### Task 1: Capture A Full Baseline Audit

**Files:**
- Create: `scripts/audit-non-recording-auto-check.mjs`
- Modify: `packages/automation/src/automation-checks.ts`
- Test: none

**Step 1: Add a standalone audit script**

Write a script that:
- loads the library from disk
- loads LLM config from automation settings
- runs a full automation job for `composer`, `conductor`, `orchestra`, `artist`, and `work`
- emits JSON/Markdown summaries grouped by category, item status, proposal counts, and warning patterns
- stores output under `output/audits/`

**Step 2: Run the audit once to get a baseline**

Run: `node scripts/audit-non-recording-auto-check.mjs`

Expected:
- a machine-readable artifact with per-category breakdown
- a human-readable summary of the worst offenders

**Step 3: Document recurring failure modes**

Extract concrete examples such as:
- named entities missing Chinese full names
- orchestra/ensemble entries lacking abbreviations
- works returning incomplete catalogue/titleLatin
- low-quality or suspicious image candidates
- proposals that should be review-only instead of direct update candidates

### Task 2: Add Failing Tests For The Observed Gaps

**Files:**
- Modify: `tests/unit/automation.test.ts`
- Modify: `tests/unit/automation-fallback.test.ts`
- Create if needed: `tests/unit/automation-quality-review.test.ts`

**Step 1: Add tests for named-entity type-specific expectations**

Cover at least:
- conductor: requires full Chinese name, Latin name, summary, and image handling
- orchestra/ensemble/chorus: requires abbreviation or short alias support
- artist/instrumentalist: should not be forced into orchestra abbreviation requirements

**Step 2: Add tests for work quality review**

Cover at least:
- missing catalogue should keep the proposal in attention state if still unresolved
- LLM-only work candidates should be marked with stricter risk or review notes
- clearly grounded work candidates should include composer-aware summary and evidence

**Step 3: Run the new tests and verify they fail**

Run targeted Vitest commands against the new tests.

Expected:
- failures that correspond to the baseline audit findings

### Task 3: Add Type-Aware Proposal Quality Review

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `packages/automation/src/automation-jobs.ts`
- Modify: `packages/automation/src/llm.ts`

**Step 1: Introduce reusable quality review result types**

Define a review result that includes:
- `status`
- `issues`
- `preview`
- `hasChanges`
- optional LLM review notes / confidence / rationale

**Step 2: Split review logic by entity family**

Implement separate review rules for:
- composer
- person by role cluster (`conductor`, `orchestra`, `artist`)
- work

**Step 3: Add optional LLM-assisted quality review**

Use LLM as a reviewer, not only as a generator:
- give it the entity snapshot plus proposed field patch
- ask it whether the proposal is grounded, complete enough, and role-appropriate
- keep outputs structured and bounded
- fall back cleanly when LLM is unavailable

**Step 4: Apply review results consistently**

Ensure job items and proposals reflect review state consistently:
- `needs-attention` for incomplete or weak proposals
- `completed-nochange` only when the entry is already sufficiently complete
- stronger notes when output is LLM-only or image quality is suspicious

### Task 4: Harden Proposal Generation By Type

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `packages/automation/src/llm.ts`
- Modify if needed: `tests/unit/automation.test.ts`

**Step 1: Improve named-entity candidate selection heuristics**

Adjust ranking/selection so that:
- conductors prefer person-oriented names and biographies
- orchestras/ensembles prefer organization-style aliases and abbreviations
- artists avoid false abbreviation requirements

**Step 2: Improve work generation heuristics**

Adjust work logic so that:
- composer identity is always carried into summary/evidence
- catalogue/titleLatin alias extraction is composer-aware
- weak summary candidates are rejected earlier

**Step 3: Tighten warning and evidence generation**

Make warnings more diagnostic and type-specific, so the owner UI clearly explains why a proposal still needs attention.

### Task 5: Re-Run The Full Audit And Verify Improvement

**Files:**
- Reuse: `scripts/audit-non-recording-auto-check.mjs`
- Modify if needed: `docs/plans/2026-03-17-non-recording-auto-check-quality-hardening.md`

**Step 1: Run targeted tests**

Run the automation-related unit tests, including new review tests.

**Step 2: Run the full non-recording audit again**

Run: `node scripts/audit-non-recording-auto-check.mjs`

Expected:
- lower `needs-attention` rate for solvable cases
- clearer grouping of unresolved cases by true data gaps
- no regression in proposal structure

**Step 3: Summarize results**

Record:
- what improved by category
- what remains unresolved because the source data is truly sparse
- which cases still require manual review
