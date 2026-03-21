import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildBatchWorkOptionLabel,
  buildBatchRelationOptions,
  buildBatchPreviewShellHtml,
  buildBatchResultSummary,
  buildSearchResultBadges,
  buildRecordingLinkChipLabel,
  buildRecordingLinkEditorHtml,
  filterMergeTargetOptions,
  getProposalModeAttributes,
  resolveProposalActionContext,
  buildPreferredWorkLabel,
  createEmptyActiveEntity,
  selectBatchSessionAfterRefresh,
} from "../../apps/owner/web/ui-helpers.js";

describe("owner ui helpers", () => {
  it("builds batch preview shell with the preview list above the detail panel", () => {
    const html = buildBatchPreviewShellHtml("<div>preview</div>", "<div>detail</div>");

    expect(html.indexOf("owner-batch-preview-shell__list")).toBeLessThan(html.indexOf("owner-batch-preview-shell__detail"));
  });

  it("returns a blank active entity context for create mode", () => {
    expect(createEmptyActiveEntity()).toEqual({ type: "", id: "" });
  });

  it("summarizes batch analyze results without leaking the full session payload", () => {
    const summary = buildBatchResultSummary("analyze", {
      session: {
        id: "batch-1",
        status: "analyzed",
        draftEntities: {
          composers: [{ entity: { id: "composer-1" } }],
          people: [{ entity: { id: "person-1" } }, { entity: { id: "person-2" } }],
          works: [{ entity: { id: "work-1" } }],
          recordings: [{ entity: { id: "recording-1" } }],
        },
        warnings: ["warning-a"],
      },
      run: { id: "run-1" },
    });

    expect(summary).toEqual({
      action: "analyze",
      sessionId: "batch-1",
      status: "analyzed",
      counts: {
        composers: 1,
        people: 2,
        works: 1,
        recordings: 1,
      },
      warnings: ["warning-a"],
      runId: "run-1",
    });
    expect("session" in summary).toBe(false);
  });

  it("keeps the batch panel empty after abandoning the current session", () => {
    const nextSession = selectBatchSessionAfterRefresh(
      [
        { id: "batch-old", status: "analyzed" },
        { id: "batch-new", status: "checked" },
      ],
      "batch-new",
      true,
    );

    expect(nextSession).toBeNull();
  });

  it("prefers the current batch session when auto-restoring is allowed", () => {
    const nextSession = selectBatchSessionAfterRefresh(
      [
        { id: "batch-old", status: "analyzed" },
        { id: "batch-new", status: "checked" },
      ],
      "batch-new",
      false,
    );

    expect(nextSession).toEqual({ id: "batch-new", status: "checked" });
  });

  it("numbers duplicate recording link chips by platform while preserving unique labels", () => {
    const links = [
      { platform: "YouTube", url: "https://example.com/1" },
      { platform: "bilibili", url: "https://example.com/2" },
      { platform: "YouTube", url: "https://example.com/3" },
    ];

    expect(buildRecordingLinkChipLabel(links[0], 0, links)).toBe("YouTube1");
    expect(buildRecordingLinkChipLabel(links[1], 1, links)).toBe("bilibili");
    expect(buildRecordingLinkChipLabel(links[2], 2, links)).toBe("YouTube2");

    const html = buildRecordingLinkEditorHtml(links);
    expect(html).toContain('data-recording-link-index="0"');
    expect(html).toContain(">YouTube1<");
    expect(html).toContain(">bilibili<");
    expect(html).toContain(">YouTube2<");
  });

  it("builds batch relation options from draft entities first and preserves missing current relations", () => {
    const options = buildBatchRelationOptions(
      "work",
      "composerId",
      {
        composers: [{ id: "composer-library", name: "Library Composer CN", nameLatin: "Library Composer" }],
      },
      {
        composers: [{ entity: { id: "composer-draft", name: "Draft Composer CN", nameLatin: "Draft Composer" } }],
      },
      "composer-legacy",
    );

    expect(options).toEqual([
      { value: "", label: "请选择" },
      { value: "composer-draft", label: "Draft Composer CN / Draft Composer" },
      { value: "composer-library", label: "Library Composer CN / Library Composer" },
      { value: "composer-legacy", label: "当前关联（composer-legacy）" },
    ]);
  });

  it("builds preferred work labels with bilingual titles, catalogue and composer context", () => {
    const label = buildPreferredWorkLabel(
      {
        id: "work-mahler-5",
        composerId: "composer-mahler",
        title: "Mahler No. 5 in C-sharp minor",
        titleLatin: "Symphony No. 5 in C-sharp minor",
        catalogue: "",
      },
      [{ id: "composer-mahler", name: "Mahler", nameLatin: "Gustav Mahler" }],
    );

    expect(label).toBe("Mahler No. 5 in C-sharp minor / Symphony No. 5 in C-sharp minor / Mahler / Gustav Mahler");
  });
  it("builds batch work labels without composer names", () => {
    const label = buildBatchWorkOptionLabel({
      id: "work-beethoven-5",
      composerId: "composer-beethoven",
      title: "第五交响曲",
      titleLatin: "Symphony No. 5 in C minor",
      catalogue: "Op. 67",
    });

    expect(label).toBe("第五交响曲 / Symphony No. 5 in C minor / Op. 67");
  });

  it("deduplicates catalogue text when the original title already contains the catalogue", () => {
    const preferredLabel = buildPreferredWorkLabel(
      {
        id: "bruckner-7",
        composerId: "composer-bruckner",
        title: "第七交响曲",
        titleLatin: "Symphony No.7 in E major, WAB 107",
        catalogue: "WAB 107",
      },
      [{ id: "composer-bruckner", name: "安东·布鲁克纳", nameLatin: "Anton Bruckner" }],
    );
    const batchLabel = buildBatchWorkOptionLabel({
      id: "bruckner-7",
      composerId: "composer-bruckner",
      title: "第七交响曲",
      titleLatin: "Symphony No.7 in E major, WAB 107",
      catalogue: "WAB 107",
    });

    expect(preferredLabel).toBe("第七交响曲 / Symphony No.7 in E major / WAB 107 / 安东·布鲁克纳 / Anton Bruckner");
    expect(batchLabel).toBe("第七交响曲 / Symphony No.7 in E major / WAB 107");
  });

  it("keeps proposal ids on cards and uses a separate target attribute on action buttons", () => {
    const attributes = getProposalModeAttributes();

    expect(attributes.proposalIdAttr).toBe("data-owner-proposal-id");
    expect(attributes.proposalTargetIdAttr).toBe("data-owner-proposal-target-id");
  });

  it("resolves unified proposal action context from the card instead of the button wrapper", () => {
    const context = resolveProposalActionContext(
      {
        dataset: {
          ownerProposalAction: "confirm",
          ownerProposalTargetId: "proposal-1",
          ownerProposalId: "stale-button-id",
        },
      },
      {
        dataset: {
          ownerProposalId: "proposal-1",
          ownerProposalMode: "batch",
          ownerRunId: "run-1",
        },
      },
    );

    expect(context).toEqual({
      proposalId: "proposal-1",
      action: "confirm",
      mode: "batch",
      runId: "run-1",
    });
  });

  it("derives owner search badges from entity roles instead of collapsing groups into generic people", () => {
    expect(buildSearchResultBadges({ type: "composer" })).toEqual(["人物", "作曲家"]);
    expect(buildSearchResultBadges({ type: "composer", roles: ["composer", "conductor"] })).toEqual(["人物", "作曲家", "指挥"]);
    expect(buildSearchResultBadges({ type: "person", roles: ["orchestra"] })).toEqual(["团体", "乐团"]);
    expect(buildSearchResultBadges({ type: "person", roles: ["conductor", "soloist"] })).toEqual(["人物", "指挥", "独奏"]);
  });

  it("filters merge target options with a search query", () => {
    const options = filterMergeTargetOptions(
      [
        { value: "bpo", label: "Berlin Philharmonic Orchestra" },
        { value: "cso", label: "Chicago Symphony Orchestra" },
        { value: "rso", label: "Rundfunk-Sinfonieorchester Berlin" },
      ],
      "berlin",
    );

    expect(options).toEqual([
      { value: "bpo", label: "Berlin Philharmonic Orchestra" },
      { value: "rso", label: "Rundfunk-Sinfonieorchester Berlin" },
    ]);
  });

  it("keeps dialog centering rules in the owner stylesheet", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-dialog\s*\{[\s\S]*margin:\s*auto/i);
    expect(css).toMatch(/\.owner-dialog\[open\][\s\S]*display:\s*grid/i);
  });

  it("stretches inline-check content to fill the detail workspace without restoring the old stacked layout", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-card--detail\s+\.owner-inline-check\s*\{[\s\S]*height:\s*100%/i);
    expect(css).toMatch(/\.owner-card--detail\s+#owner-inline-check-panel\s*\{[\s\S]*height:\s*100%/i);
    expect(css).toMatch(/\.owner-card--detail\s+\.owner-inline-check__summary\s*\{[\s\S]*display:\s*flex/i);
  });

  it("treats inline auto-check as a replacement workspace instead of stacking the entity form underneath", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(script).toContain('detailCard?.classList.add("is-inline-check-active")');
    expect(script).toContain('detailCard?.classList.remove("is-inline-check-active")');
    expect(css).toMatch(
      /\.owner-card--detail\.is-inline-check-active\s+\.owner-tab-panels\s*\{[\s\S]*display:\s*none/i,
    );
  });

  it("uses generic entity action labels and removes the preview action from owner forms at runtime", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(script).toContain('resetButton.textContent = "新建条目"');
    expect(script).toContain('saveButton.textContent = "保存条目"');
    expect(script).toContain('deleteButton.textContent = "删除条目"');
    expect(script).toContain("previewButton.remove()");
  });

  it("keeps merge search results inside a bounded dropdown panel", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-merge-combobox__results\s*\{[\s\S]*max-height:\s*18rem/i);
    expect(css).toMatch(/\.owner-merge-combobox__results\s*\{[\s\S]*overflow:\s*auto/i);
    expect(css).toMatch(/\.owner-merge-combobox__panel\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/i);
  });

  it("normalizes the detail tabs into person and group views while keeping composers reachable through the person tab", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(script).toContain('composerButton.hidden = true');
    expect(script).toContain('groupButton.dataset.detailTab = "group"');
    expect(script).toContain('personButton.textContent = "人物"');
    expect(script).toContain('? "group" : "person"');
    expect(script).toContain('panel: entityType === "composer" ? "composer" : undefined');
  });

  it("shows composer as a manageable role in owner forms", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");
    const html = await fs.readFile(path.resolve("apps/owner/web/index.html"), "utf8");

    expect(script).toContain('const PERSON_ROLE_VALUES = new Set(["composer", "conductor", "soloist", "singer", "instrumentalist"])');
    expect(html).toContain('value="composer"');
    expect(html).toContain("作曲家");
  });

  it("shows structured recording fields and explains that slug and sortKey are auto-managed", async () => {
    const html = await fs.readFile(path.resolve("apps/owner/web/index.html"), "utf8");

    expect(html).toContain('name="workTypeHint"');
    expect(html).toContain('name="conductorPersonId"');
    expect(html).toContain('name="orchestraPersonId"');
    expect(html).toContain("保存时自动生成");
  });

  it("adds a structured multi-credit editor to the recording form instead of relying only on the legacy textarea", async () => {
    const html = await fs.readFile(path.resolve("apps/owner/web/index.html"), "utf8");
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(html).toContain("data-recording-credit-editor");
    expect(html).toContain("data-recording-credit-add");
    expect(script).toContain("renderRecordingCreditEditor");
    expect(script).toContain("syncRecordingCreditsField");
  });

  it("keeps empty review content aligned to the top instead of pushing controls downward", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-card--detail\s+\.owner-inline-check__summary\s*\{[\s\S]*justify-content:\s*flex-start/i);
    expect(css).not.toMatch(/\.owner-card--detail\s+\.owner-inline-check__summary\s*>\s*\.owner-job-detail__section:last-child[\s\S]*margin-top:\s*auto/i);
  });

  it("keeps the top-level owner cards pinned to the top edge instead of vertically centering sparse review content", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-panel--main\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/i);
    expect(css).toMatch(/\.owner-view\.is-active,\s*\.owner-panel__inner\.is-active\s*\{[\s\S]*align-content:\s*start/i);
    expect(css).toMatch(/\.owner-panel--main\s*>\s*\.owner-tabs\s*\{[\s\S]*position:\s*sticky/i);
    expect(css).toMatch(/\.owner-panel--main\s*>\s*\.owner-tabs\s*\{[\s\S]*top:\s*0/i);
    expect(css).toMatch(/\.owner-view\s+\.owner-card\s*\{[\s\S]*align-content:\s*start/i);
  });

  it("renders owner search result cards with content-driven height instead of a fixed tall shell", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(/\.owner-result-list\s*\{[\s\S]*display:\s*flex/i);
    expect(css).toMatch(/\.owner-result-list\s*\{[\s\S]*flex-direction:\s*column/i);
    expect(css).toMatch(/\.owner-card--search\s+\.owner-result-item\s*\{[\s\S]*display:\s*block/i);
    expect(css).toMatch(/\.owner-card--search\s+\.owner-result-item\s*\{[\s\S]*(flex:\s*0\s+0\s+auto|flex-shrink:\s*0)/i);
    expect(css).toMatch(/\.owner-result-item\s*\{[\s\S]*height:\s*auto/i);
    expect(css).toMatch(/\.owner-result-item\s*\{[\s\S]*min-height:\s*0/i);
    expect(css).not.toMatch(/\.owner-result-item\s*\{[\s\S]*min-height:\s*12\.5rem/i);
  });

  it("shows role checkboxes in a single wrapped row and adds related-entity jump controls to entity forms", async () => {
    const html = await fs.readFile(path.resolve("apps/owner/web/index.html"), "utf8");
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(css).toMatch(/\.owner-role-grid\s*\{[\s\S]*display:\s*grid/i);
    expect(css).toMatch(/\.owner-role-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/i);
    expect(html).toContain("owner-role-grid");
    expect(script).toContain("data-related-entity-select");
    expect(script).toContain("data-related-entity-jump");
  });

  it("renders related-entity controls ahead of merge controls and groups selectable relations", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");
    const ownerServer = await fs.readFile(path.resolve("apps/owner/server/owner-app.ts"), "utf8");

    expect(script).toContain("mergeHost.before(host)");
    expect(script).toContain("<optgroup");
    expect(script).toContain("groupLabel");
    expect(ownerServer).toContain('groupLabel: "作曲家"');
    expect(ownerServer).toContain('return "作品 / 协奏曲"');
    expect(ownerServer).toContain("getRelatedRecordingGroupLabel");
    expect(ownerServer).toContain('return `版本 / ${composerLabel} / ${workLabel}`');
  });

  it("refreshes review and log panels when switching views instead of leaving stale proposal cards on screen", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(script).toContain('if (viewName === "review")');
    expect(script).toContain("void renderReviewRun().catch");
    expect(script).toContain('if (viewName === "logs")');
    expect(script).toContain("void renderLogRun().catch");
  });

  it("shows pending review counts in the run selector so applied runs are not mislabeled as active candidates", async () => {
    const script = await fs.readFile(path.resolve("apps/owner/web/app.js"), "utf8");

    expect(script).toContain("run.summary.pending");
  });
});

