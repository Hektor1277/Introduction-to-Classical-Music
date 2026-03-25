import { describe, expect, it } from "vitest";

import { reviewRecordingAutomationProposalQuality } from "@/lib/automation-checks";
import type { AutomationProposal } from "@/lib/automation";
import type { Recording } from "@/lib/schema";

function createRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: "recording-bohm-1976",
    workId: "work-beethoven-7",
    slug: "bohm-1976",
    title: "伯姆 - 维也纳爱乐乐团 - 1976",
    sortKey: "0010",
    isPrimaryRecommendation: true,
    updatedAt: "2026-03-25T00:00:00.000Z",
    images: [],
    credits: [],
    links: [],
    notes: "",
    performanceDateText: "1976",
    venueText: "Musikverein",
    albumTitle: "",
    label: "",
    releaseDate: "",
    infoPanel: { text: "", articleId: "", collectionLinks: [], collectionUrl: "" },
    ...overrides,
  };
}

function createProposal(overrides: Partial<AutomationProposal> = {}): AutomationProposal {
  return {
    id: "proposal-recording-bohm-1976",
    kind: "update",
    entityType: "recording",
    entityId: "recording-bohm-1976",
    summary: "补充版本检索结果：伯姆 - 维也纳爱乐乐团 - 1976",
    risk: "medium",
    status: "pending",
    reviewState: "unseen",
    sources: ["https://example.com/release"],
    fields: [],
    warnings: [],
    imageCandidates: [],
    mergeCandidates: [],
    selectedImageCandidateId: "",
    evidence: [],
    linkCandidates: [],
    ...overrides,
  };
}

describe("recording automation proposal quality review", () => {
  it("flags release dates earlier than the known performance year", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [{ path: "releaseDate", before: "", after: "1975" }],
      }),
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues).toEqual(expect.arrayContaining(["发行日期早于当前演出日期，疑似提取错误。"]));
  });

  it("keeps a clean image-only proposal reviewable", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        risk: "low",
        imageCandidates: [
          {
            id: "cover-1",
            src: "https://cdn.example.com/bohm-cover.jpg",
            sourceUrl: "https://example.com/release",
            sourceKind: "official-site",
            attribution: "example.com",
            title: "Bohm Beethoven 7",
            width: 1200,
            height: 1200,
          },
        ],
      }),
    ]);

    expect(review.status).toBe("ok");
    expect(review.ok).toBe(true);
    expect(review.issues).toEqual([]);
  });

  it("flags metadata proposals that still carry provider conflict warnings", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [
          { path: "albumTitle", before: "", after: "The Originals: Bruckner Symphony No. 7" },
          { path: "label", before: "", after: "DG" },
        ],
        warnings: ["候选1的指挥是卡拉扬而非伯姆"],
      }),
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues).toEqual(expect.arrayContaining(["版本提案仍带有来源冲突警告，应用前需要人工复核。"]));
  });
});
