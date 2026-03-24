# Reference Registry Online Verification And Cleanup Plan

**Goal:** Turn the two reference tables into a stable, query-first source of truth, verify high-risk abbreviations/translations against online sources, and remove the low-risk polluted aliases in the formal library that currently re-contaminate the tables.

**Scope for this milestone:**
- strengthen the registry with audit/query helpers
- stop `reference:sync` from merging one dirty legacy line into multiple canonical entities
- make the person `#ensemble` section follow the orchestra table deterministically
- clean the first safe batch of polluted `nameLatin` / alias values in `data/library/people.json`
- verify and correct the current high-risk orchestra abbreviations and translations

**Out of scope for this milestone:**
- broad semantic merges that require musicological judgment
- resolving every historical duplicate orchestra institution in `people.json`
- expanding the owner UI around the registry

## Task 1: Lock the new registry behaviors with tests

**Files:**
- Modify: `tests/unit/reference-registry.test.ts`

Add coverage for:
- safe consolidation of duplicate reference entries with the same strong identity
- refusing to auto-merge a dirty legacy entry when it overlaps multiple canonical entities
- auditing ambiguous orchestra abbreviations such as `BPO`

Run first:

```bash
npm test -- tests/unit/reference-registry.test.ts --runInBand
```

Expected: FAIL before implementation.

## Task 2: Implement registry audit/query-safe helpers

**Files:**
- Modify: `packages/data-core/src/reference-registry.ts`
- Add: `scripts/audit-reference-registry.ts`
- Add: `scripts/query-reference-registry.ts`
- Modify: `package.json`

Requirements:
- expose deterministic merge helpers for orchestra/person entries
- expose unique-target matching so sync can reject multi-entity polluted lines
- expose an audit report for ambiguous abbreviations / overlapping identities
- provide a CLI query path for “查一下这个值是否已经建档”

## Task 3: Fix sync so dirty legacy lines stop flowing back

**Files:**
- Modify: `scripts/sync-reference-registry.ts`

Requirements:
- merge only when an existing line maps to one canonical target
- keep unmatched clean manual entries
- drop or report ambiguous legacy entries instead of auto-merging them
- rebuild person `#ensemble` entries from the final orchestra registry output

## Task 4: Online verification and safe cleanup

**Files:**
- Modify: `materials/references/Orchestra Abbreviation Comparison.txt`
- Modify: `materials/references/person-name-aliases.txt`
- Add: `materials/references/reference-verification-notes.md`
- Modify: `data/library/people.json`

Initial verified target set:
- `Residentie Orkest` / `The Hague Philharmonic`
- `Helsinki Philharmonic Orchestra`
- `musicAeterna`
- `Berliner Philharmoniker`
- `Budapest Philharmonic Orchestra`
- `Chicago Symphony Orchestra`
- `Frankfurt Radio Symphony`
- `Wiener Philharmoniker` / `Vienna Philharmonic`
- `Wiener Symphoniker`
- polluted soloist `nameLatin` entries currently pointing to other artists

## Task 5: Full verification, commit, push

Run:

```bash
npm test --runInBand
npm run runtime:build
npm run reference:sync
npm run reference:audit
npm run build
node output/runtime/scripts/audit-library-cleanup.js
```

Expected:
- tests pass
- registry sync is deterministic
- audit output shrinks to intentional ambiguity only
- no new build regressions
