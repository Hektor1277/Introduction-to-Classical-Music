# Reference Registry And Historical Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the orchestra/person comparison tables into a reusable reference registry, sync all current library names and aliases into those tables, and continue the next safe historical cleanup batch on top of that registry.

**Architecture:** Add a shared reference-registry module that parses both text tables, exposes deterministic lookup helpers, and powers a sync script that regenerates the tables from the current library plus preserved manual entries. Wire batch-import normalization to consult the registry before creating draft credits.

**Tech Stack:** TypeScript, Node.js, Vitest, JSON library data, existing `packages/automation`, `packages/data-core`, and `scripts` pipeline

---

### Task 1: Lock down registry behavior with tests

**Files:**
- Modify: `tests/unit/batch-import.test.ts`
- Add: `tests/unit/reference-registry.test.ts`

**Step 1: Add parsing and lookup coverage**

Cover:
- orchestra registry lines with abbreviations, latin aliases, and Chinese translations
- person alias sections with `#global` fallback and role-scoped priority
- lookup normalization across case, punctuation, and whitespace variants

**Step 2: Add batch-import normalization coverage**

Cover:
- conductor/person aliases normalize through the person registry before draft creation
- orchestra abbreviations and Chinese aliases normalize through the orchestra registry before draft creation

**Step 3: Run targeted tests first**

Run:

```bash
npm test -- tests/unit/reference-registry.test.ts tests/unit/batch-import.test.ts --runInBand
```

Expected: FAIL before implementation.

### Task 2: Implement the registry and wire query entry points

**Files:**
- Add: `packages/data-core/src/reference-registry.ts`
- Add: `apps/site/src/lib/reference-registry.ts`
- Modify: `packages/automation/src/batch-import.ts`

**Step 1: Implement rich parsers**

Requirements:
- preserve compatibility with the existing orchestra abbreviation text format
- allow multiple values per line for aliases/translations
- expose deterministic `preferredValue`, `canonicalLatin`, abbreviations, and aliases

**Step 2: Implement lookups**

Requirements:
- orchestra lookup should match abbreviations, Chinese translations, and latin aliases
- person lookup should prefer the requested role section, then `#global`, then any matching section
- lookup normalization should ignore harmless punctuation/spacing differences

**Step 3: Wire batch-import normalization**

Requirements:
- normalize parsed batch template slots through the registry before titles and credits are generated
- keep behavior backward-compatible when no registry is provided

### Task 3: Add deterministic table sync from the formal library

**Files:**
- Add: `scripts/sync-reference-registry.ts`
- Modify: `package.json`
- Modify: `materials/references/Orchestra Abbreviation Comparison.txt`
- Modify: `materials/references/person-name-aliases.txt`

**Step 1: Build the sync script**

Requirements:
- load the current library and both existing reference files
- merge existing manual values with library-derived names/aliases/abbreviations
- output stable ordering so diffs stay reviewable

**Step 2: Expand the orchestra table**

Requirements:
- include Chinese translations alongside abbreviations and latin aliases
- keep entries queryable even when an ensemble has no well-established abbreviation

**Step 3: Re-generate both files**

Run:

```bash
npm run runtime:build
node output/runtime/scripts/sync-reference-registry.js
```

Expected: the two reference files are rewritten deterministically from the merged registry.

### Task 4: Continue the next safe historical cleanup batch

**Files:**
- Modify: `data/library/people.json`
- Modify: `data/library/recordings.json`
- Modify: `data/library/review-queue.json` (only if cleanup side effects require it)

**Step 1: Audit current duplicate and polluted candidates again**

Use the updated registry and existing cleanup audit output to identify the next safe batch.

**Step 2: Apply only low-risk rebinding / merge fixes**

Requirements:
- prefer entries whose names now align cleanly with the registry
- keep ambiguous historical institutions out of scope for this milestone

**Step 3: Review the data diff**

Confirm:
- changed entities are expected
- recording credits now point to cleaner canonical people/group entries
- no large unrelated churn was introduced

### Task 5: Full verification, commit, and push

**Files:**
- Read: `output/runtime/**`

**Step 1: Run targeted tests**

```bash
npm test -- tests/unit/reference-registry.test.ts tests/unit/batch-import.test.ts tests/unit/library-audit.test.ts tests/unit/person-cleanup.test.ts --runInBand
```

Expected: PASS

**Step 2: Run full verification**

```bash
npm test --runInBand
npm run runtime:build
npm run build
node output/runtime/scripts/audit-library-cleanup.js
```

Expected: PASS, with cleanup audit reduced or unchanged except for known manual items.

**Step 3: Commit and push**

```bash
git add docs/plans/2026-03-24-reference-registry-and-library-cleanup.md packages/data-core/src/reference-registry.ts apps/site/src/lib/reference-registry.ts packages/automation/src/batch-import.ts scripts/sync-reference-registry.ts package.json materials/references/Orchestra\ Abbreviation\ Comparison.txt materials/references/person-name-aliases.txt data/library/people.json data/library/recordings.json data/library/review-queue.json tests/unit/reference-registry.test.ts tests/unit/batch-import.test.ts
git commit -m "fix: sync reference registry and continue library cleanup"
git push
```
