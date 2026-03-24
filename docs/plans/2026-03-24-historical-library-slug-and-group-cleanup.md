# Historical Library Slug And Group Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit audit and cleanup coverage for polluted orchestra/group slugs and clearly mis-promoted duplicate group entities, then clean the first safe batch in the formal library.

**Architecture:** Extend the existing `library-audit` and `person-cleanup` boundary instead of adding a new one-off fixer. The new logic should flag polluted group identities, automatically redirect only low-risk duplicate group entities to a stronger canonical entry, and keep the formal library aligned with those rules.

**Tech Stack:** TypeScript, Node.js, Vitest, JSON library data, existing `packages/data-core` cleanup pipeline

---

### Task 1: Freeze the first cleanup target set

**Files:**
- Modify: `docs/plans/2026-03-24-historical-library-slug-and-group-cleanup.md`
- Read: `data/library/people.json`
- Read: `data/library/recordings.json`
- Read: `packages/data-core/src/person-cleanup.ts`
- Read: `packages/data-core/src/library-audit.ts`

**Step 1: Inspect current orchestra/group duplicates and polluted slugs**

Run:

```bash
node - <<'EOF'
const fs = require("fs");
const people = JSON.parse(fs.readFileSync("data/library/people.json", "utf8"));
const groups = people.filter((p) => Array.isArray(p.roles) && p.roles.some((r) => ["orchestra", "ensemble", "chorus"].includes(r)));
const suspects = groups.filter((p) => /时间|地点|currently|chn/i.test(String(p.slug || "")) || /berliner-philarmoniker|sa-chsische-staatskapelle-dresden/.test(String(p.slug || "")));
console.log(JSON.stringify(suspects.map((p) => ({ id: p.id, slug: p.slug, name: p.name, nameLatin: p.nameLatin })), null, 2));
EOF
```

Expected: a short candidate list with obviously polluted slug or alias-promoted duplicate group entries.

**Step 2: Record the first safe batch**

Scope this milestone to entities that satisfy all of:
- same or near-identical canonical name / `nameLatin`
- one entry is obviously higher quality
- the weaker entry has polluted slug or thin metadata
- redirecting references does not require semantic judgment about two genuinely different ensembles

**Step 3: Keep the batch small**

Limit the first milestone to a handful of clearly safe orchestra/group entities so validation remains reviewable.

### Task 2: Add failing audit coverage for polluted group identities

**Files:**
- Modify: `tests/unit/library-audit.test.ts`
- Modify: `packages/data-core/src/library-audit.ts`

**Step 1: Write the failing test**

Add tests covering:
- a polluted orchestra slug like `leningrad-philharmonic-orchestra时间-地点-1979-东京`
- a duplicate orchestra entity with an obviously degraded latin/slug form like `berliner-philarmoniker`

Expected audit behavior:
- emits a dedicated issue code for polluted group identity
- points at `people.slug` as the source
- suggests rebinding references to the canonical group entry

**Step 2: Run the targeted test to verify red**

Run:

```bash
npm test -- tests/unit/library-audit.test.ts --runInBand
```

Expected: FAIL because the new issue code/rule does not exist yet.

**Step 3: Implement the minimal audit rule**

In `packages/data-core/src/library-audit.ts`:
- add a new issue code for polluted group identity
- detect orchestra/ensemble/chorus entities whose slug or identity contains obvious contamination markers
- detect obviously degraded duplicate group entities when a stronger canonical entry exists

**Step 4: Re-run the targeted test**

Run:

```bash
npm test -- tests/unit/library-audit.test.ts --runInBand
```

Expected: PASS

### Task 3: Add failing cleanup coverage for canonical rebinding

**Files:**
- Modify: `tests/unit/person-cleanup.test.ts`
- Modify: `packages/data-core/src/person-cleanup.ts`

**Step 1: Write the failing test**

Add tests covering:
- a polluted orchestra entry with metadata-tainted slug rebinding to a stronger canonical orchestra entity
- a misspelled / degraded orchestra duplicate rebinding to the canonical orchestra entity even when the duplicate is not fully “thin”

**Step 2: Run the targeted test to verify red**

Run:

```bash
npm test -- tests/unit/person-cleanup.test.ts --runInBand
```

Expected: FAIL because the current redirect logic is too narrow.

**Step 3: Implement the minimal cleanup extension**

In `packages/data-core/src/person-cleanup.ts`:
- teach canonical replacement scoring about polluted slug markers and degraded duplicate group entries
- keep auto-rebinding limited to low-risk ensemble identities
- preserve the existing conservative behavior for ambiguous group aliases

**Step 4: Re-run the targeted test**

Run:

```bash
npm test -- tests/unit/person-cleanup.test.ts --runInBand
```

Expected: PASS

### Task 4: Apply the first safe batch to formal library data

**Files:**
- Modify: `data/library/people.json`
- Modify: `data/library/recordings.json`
- Modify: `data/library/review-queue.json` (only if references require normalization side effects)

**Step 1: Generate the repaired library in a controlled way**

Run:

```bash
npm run runtime:build
node output/runtime/scripts/repair-library-recordings.js --dry-run
```

Expected: no runtime errors, plus evidence the cleanup pipeline can apply the new rebinding logic.

**Step 2: Apply the formal library cleanup**

Run:

```bash
node output/runtime/scripts/repair-library-recordings.js
```

Expected: the selected polluted group entries are removed or rebound, and generated artifacts stay in sync.

**Step 3: Review the diff**

Confirm that:
- only the intended first-batch entities changed
- recording credits now reference the canonical group entries
- no unrelated large-scale churn slipped in

### Task 5: Full verification and milestone delivery

**Files:**
- Read: `data/library/*.json`
- Read: `output/runtime/**`

**Step 1: Run targeted tests first**

Run:

```bash
npm test -- tests/unit/library-audit.test.ts tests/unit/person-cleanup.test.ts --runInBand
```

Expected: PASS

**Step 2: Run full project verification**

Run:

```bash
npm test --runInBand
npm run runtime:build
npm run build
```

Expected: PASS

**Step 3: Audit the cleaned library again**

Run:

```bash
node output/runtime/scripts/audit-library-cleanup.js
```

Expected: the new polluted-group issue count decreases for the first cleaned batch, with no new regressions.

**Step 4: Commit**

```bash
git add packages/data-core/src/person-cleanup.ts packages/data-core/src/library-audit.ts tests/unit/person-cleanup.test.ts tests/unit/library-audit.test.ts data/library/people.json data/library/recordings.json docs/plans/2026-03-24-historical-library-slug-and-group-cleanup.md
git commit -m "fix: clean polluted orchestra group identities"
git push
```
