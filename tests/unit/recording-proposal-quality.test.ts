import { describe, expect, it } from "vitest";

import { reviewRecordingAutomationProposalQuality } from "@/lib/automation-checks";
import type { AutomationProposal } from "@/lib/automation";
import type { Recording } from "@/lib/schema";

function createRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: "recording-bohm-1976",
    workId: "work-beethoven-7",
    slug: "bohm-1976",
    title: "Bohm - Vienna Philharmonic - 1976",
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
    summary: "补充版本检索结果：Bohm - Vienna Philharmonic - 1976",
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
    expect(review.issues.length).toBeGreaterThan(0);
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

  it("flags metadata proposals that still carry hard conflict warnings", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [
          { path: "releaseDate", before: "", after: "1983" },
          { path: "albumTitle", before: "", after: "The Originals: Bruckner Symphony No. 7" },
        ],
        warnings: ["多个候选URL日期或地点不匹配"],
      }),
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues.length).toBeGreaterThan(0);
  });

  it("does not block metadata-only proposals because unrelated venue threshold warnings remain", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [
          { path: "albumTitle", before: "", after: "Beethoven Recital" },
          { path: "label", before: "", after: "Philips" },
        ],
        warnings: ["venueText 未达到最终采纳阈值。"],
      }),
    ]);

    expect(review.status).toBe("ok");
    expect(review.issues).toEqual([]);
  });

  it("keeps date-related warnings blocking when the proposal changes date metadata", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [{ path: "releaseDate", before: "", after: "1978" }],
        warnings: ["部分候选URL表演者或年份不匹配"],
      }),
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues.length).toBeGreaterThan(0);
  });

  it("treats spelling-variant notes as non-blocking when core metadata is otherwise consistent", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [
          { path: "albumTitle", before: "", after: "Historic Violin Sonatas" },
          { path: "label", before: "", after: "Philips" },
        ],
        warnings: ["部分URL标题或描述存在拼写变体（如Mogilevsky/Moguilewsky），但核心信息一致"],
      }),
    ]);

    expect(review.status).toBe("ok");
    expect(review.issues).toEqual([]);
  });

  it("does not block on candidate-elimination notes that only explain rejected urls", () => {
    const review = reviewRecordingAutomationProposalQuality(createRecording(), [
      createProposal({
        fields: [{ path: "releaseDate", before: "", after: "1978" }],
        warnings: ["第7条URL标注年份为1953，可能为不同版本"],
      }),
    ]);

    expect(review.status).toBe("ok");
    expect(review.issues).toEqual([]);
  });
});
