import { describe, expect, it } from "vitest";

import {
  REVIEW_PAGE_SIZE,
  applyProposalDraft,
  buildDataAttributeSelector,
  buildExcerpt,
  getProposalsForReviewAction,
  hasProposalDraftChanges,
  paginateItems,
  resolveProposalDraft,
} from "../../apps/owner/web/review-utils.js";

describe("owner review utils", () => {
  it("builds a valid data attribute selector", () => {
    expect(buildDataAttributeSelector("data-image-select", 'proposal-"123"')).toBe(
      '[data-image-select="proposal-\\"123\\""]',
    );
  });

  it("paginates items with a stable page size", () => {
    const items = Array.from({ length: 12 }, (_, index) => `item-${index + 1}`);
    const page = paginateItems(items, 2, REVIEW_PAGE_SIZE);

    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(REVIEW_PAGE_SIZE);
    expect(page.totalItems).toBe(12);
    expect(page.totalPages).toBe(3);
    expect(page.items).toEqual(["item-6", "item-7", "item-8", "item-9", "item-10"]);
  });

  it("clips long text into an excerpt", () => {
    const excerpt = buildExcerpt("a".repeat(220), 50);
    expect(excerpt.truncated).toBe(true);
    expect(excerpt.text).toHaveLength(50);
    expect(excerpt.text.endsWith("…")).toBe(true);
  });

  it("detects unsaved proposal drafts before action buttons run", () => {
    const proposal = {
      id: "proposal-1",
      selectedImageCandidateId: "candidate-a",
      fields: [
        { path: "summary", before: "old", after: "current" },
        { path: "aliases", before: ["A"], after: ["A"] },
      ],
    };

    expect(
      hasProposalDraftChanges(proposal, {
        selectedImageCandidateId: "candidate-b",
      }),
    ).toBe(true);

    expect(
      hasProposalDraftChanges(proposal, {
        fieldsPatchMap: {
          summary: "changed in form",
        },
      }),
    ).toBe(true);

    expect(
      hasProposalDraftChanges(proposal, {
        fieldsPatchMap: {
          summary: "current",
          aliases: ["A"],
        },
        selectedImageCandidateId: "candidate-a",
      }),
    ).toBe(false);
  });

  it("applies local drafts to proposal rendering without mutating source proposal", () => {
    const proposal = {
      id: "proposal-2",
      selectedImageCandidateId: "candidate-a",
      fields: [
        { path: "summary", before: "old", after: "current" },
        { path: "aliases", before: ["A"], after: ["A"] },
      ],
    };

    const drafted = applyProposalDraft(proposal, {
      selectedImageCandidateId: "candidate-b",
      fieldsPatchMap: {
        summary: "draft summary",
        aliases: ["A", "B"],
      },
    });

    expect(drafted.selectedImageCandidateId).toBe("candidate-b");
    expect(drafted.fields).toEqual([
      { path: "summary", before: "old", after: "draft summary" },
      { path: "aliases", before: ["A"], after: ["A", "B"] },
    ]);
    expect(proposal.selectedImageCandidateId).toBe("candidate-a");
    expect(proposal.fields[0]?.after).toBe("current");
  });

  it("falls back to stored drafts when a live form snapshot looks unchanged", () => {
    const proposal = {
      id: "proposal-3",
      selectedImageCandidateId: "candidate-a",
      fields: [{ path: "abbreviations", before: [], after: [] }],
    };
    const liveDraft = {
      selectedImageCandidateId: "candidate-a",
      fieldsPatchMap: {
        abbreviations: [],
      },
    };
    const storedDraft = {
      selectedImageCandidateId: "candidate-a",
      fieldsPatchMap: {
        abbreviations: ["RS-TYPED"],
      },
    };

    expect(resolveProposalDraft(proposal, liveDraft, storedDraft)).toEqual(storedDraft);
    expect(
      resolveProposalDraft(
        proposal,
        {
          selectedImageCandidateId: "candidate-b",
          fieldsPatchMap: {
            abbreviations: ["LIVE"],
          },
        },
        storedDraft,
      ),
    ).toEqual({
      selectedImageCandidateId: "candidate-b",
      fieldsPatchMap: {
        abbreviations: ["LIVE"],
      },
    });
  });

  it("treats null drafts as empty instead of crashing proposal actions", () => {
    const proposal = {
      id: "proposal-4",
      selectedImageCandidateId: "",
      fields: [{ path: "summary", before: "", after: "" }],
    };

    expect(hasProposalDraftChanges(proposal, null)).toBe(false);
    expect(resolveProposalDraft(proposal, { fieldsPatchMap: {} }, null)).toEqual({ fieldsPatchMap: {} });
    expect(applyProposalDraft(proposal, null)).toEqual(proposal);
  });

  it("returns only current page confirmed pending proposals for page apply actions", () => {
    const proposals = [
      { id: "p-1", reviewState: "confirmed", status: "pending" },
      { id: "p-2", reviewState: "viewed", status: "pending" },
      { id: "p-3", reviewState: "confirmed", status: "applied" },
      { id: "p-4", reviewState: "confirmed", status: "pending" },
    ];

    expect(
      getProposalsForReviewAction(proposals, "apply-confirmed", {
        scope: "page",
        scopeIds: ["p-1", "p-2", "p-3"],
      }).map((proposal) => proposal.id),
    ).toEqual(["p-1"]);
  });

  it("returns all matching proposals for global review actions regardless of current page ids", () => {
    const proposals = [
      { id: "p-1", reviewState: "confirmed", status: "pending" },
      { id: "p-2", reviewState: "viewed", status: "pending" },
      { id: "p-3", reviewState: "confirmed", status: "pending" },
      { id: "p-4", reviewState: "confirmed", status: "ignored" },
    ];

    expect(
      getProposalsForReviewAction(proposals, "apply-confirmed", {
        scope: "all",
        scopeIds: ["p-1"],
      }).map((proposal) => proposal.id),
    ).toEqual(["p-1", "p-3"]);

    expect(
      getProposalsForReviewAction(proposals, "ignore-pending", {
        scope: "all",
        scopeIds: ["p-1"],
      }).map((proposal) => proposal.id),
    ).toEqual(["p-1", "p-2", "p-3"]);
  });
});

