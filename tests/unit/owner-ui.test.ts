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
  buildWorkOptionLabel,
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

  it("builds work option labels with composer, catalogue and bilingual titles", () => {
    const label = buildWorkOptionLabel(
      {
        id: "work-mahler-5",
        composerId: "composer-mahler",
        title: "Mahler No. 5 in C-sharp minor",
        titleLatin: "Symphony No. 5 in C-sharp minor",
        catalogue: "",
      },
      [{ id: "composer-mahler", name: "Mahler", nameLatin: "Gustav Mahler" }],
    );

    expect(label).toBe("Mahler / Gustav Mahler · Mahler No. 5 in C-sharp minor · Symphony No. 5 in C-sharp minor");
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
    expect(buildSearchResultBadges({ type: "composer" })).toEqual(["作曲家"]);
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

  it("limits inline-check height inside the detail card so form actions remain clickable", async () => {
    const css = await fs.readFile(path.resolve("apps/owner/web/styles.css"), "utf8");

    expect(css).toMatch(
      /\.owner-card--detail\s+\.owner-inline-check\s*\{[\s\S]*max-height:\s*min\(48vh,\s*26rem\)/i,
    );
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

