import { describe, expect, it } from "vitest";

import {
  buildBatchRelationOptions,
  buildBatchPreviewShellHtml,
  buildBatchResultSummary,
  buildRecordingLinkChipLabel,
  buildRecordingLinkEditorHtml,
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
});

