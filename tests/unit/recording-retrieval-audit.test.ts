import { describe, expect, it } from "vitest";

import { buildRecordingRetrievalAuditPlan, buildRecordingRetrievalAuditResult, summarizeRecordingRetrievalAudit } from "@/lib/recording-retrieval-audit";
import { validateLibrary } from "@/lib/schema";

const library = validateLibrary({
  composers: [
    {
      id: "composer-beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "",
      nameLatin: "Ludwig van Beethoven",
      displayName: "贝多芬",
      displayFullName: "",
      displayLatinName: "Ludwig van Beethoven",
      country: "Germany",
      avatarSrc: "",
      aliases: [],
      abbreviations: [],
      sortKey: "0010",
      summary: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [] },
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
    },
  ],
  people: [],
  workGroups: [
    {
      id: "group-symphony",
      composerId: "composer-beethoven",
      title: "交响曲",
      slug: "symphony",
      path: ["交响曲"],
      sortKey: "0010",
    },
  ],
  works: [
    {
      id: "work-beethoven-5",
      composerId: "composer-beethoven",
      groupIds: ["group-symphony"],
      slug: "beethoven-5",
      title: "第五交响曲",
      titleLatin: "Symphony No. 5",
      aliases: [],
      catalogue: "Op. 67",
      summary: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [] },
      sortKey: "0010",
      updatedAt: "2026-03-25T00:00:00.000Z",
    },
  ],
  recordings: [
    {
      id: "recording-a",
      workId: "work-beethoven-5",
      slug: "recording-a",
      title: "Recording A",
      sortKey: "0010",
      isPrimaryRecommendation: true,
      updatedAt: "2026-03-25T00:00:00.000Z",
      images: [],
      credits: [],
      links: [],
      notes: "",
      performanceDateText: "1976",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [], collectionUrl: "" },
    },
    {
      id: "recording-b",
      workId: "work-beethoven-5",
      slug: "recording-b",
      title: "Recording B",
      sortKey: "0020",
      isPrimaryRecommendation: false,
      updatedAt: "2026-03-25T00:00:00.000Z",
      images: [{ src: "/cover.jpg", alt: "cover" }],
      credits: [],
      links: [],
      notes: "",
      performanceDateText: "1980",
      venueText: "",
      albumTitle: "Official Release",
      label: "",
      releaseDate: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [], collectionUrl: "" },
    },
    {
      id: "recording-c",
      workId: "work-beethoven-5",
      slug: "recording-c",
      title: "Recording C",
      sortKey: "0030",
      isPrimaryRecommendation: false,
      updatedAt: "2026-03-25T00:00:00.000Z",
      images: [],
      credits: [],
      links: [],
      notes: "",
      performanceDateText: "1990",
      venueText: "",
      albumTitle: "Has Metadata",
      label: "DG",
      releaseDate: "1991",
      infoPanel: { text: "", articleId: "", collectionLinks: [], collectionUrl: "" },
    },
  ],
});

describe("recording retrieval audit helpers", () => {
  it("builds grouped live-audit targets from missing recording fields", () => {
    const plan = buildRecordingRetrievalAuditPlan(library, { sampleSizePerGroup: 1 });

    expect(plan.groups).toEqual([
      expect.objectContaining({ key: "missingAlbumTitle", totalCandidates: 1, selectedRecordingIds: ["recording-a"] }),
      expect.objectContaining({ key: "missingLabel", totalCandidates: 2, selectedRecordingIds: ["recording-b"] }),
      expect.objectContaining({ key: "missingReleaseDate", totalCandidates: 2, selectedRecordingIds: ["recording-a"] }),
      expect.objectContaining({ key: "missingImages", totalCandidates: 2, selectedRecordingIds: ["recording-c"] }),
    ]);
    expect(plan.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordingId: "recording-a", groupKeys: ["missingAlbumTitle", "missingReleaseDate"] }),
        expect.objectContaining({ recordingId: "recording-b", groupKeys: ["missingLabel"] }),
        expect.objectContaining({ recordingId: "recording-c", groupKeys: ["missingImages"] }),
      ]),
    );
    expect(plan.totalTargets).toBe(3);
  });

  it("summarizes live-audit results by group and review status", () => {
    const summary = summarizeRecordingRetrievalAudit([
      {
        recordingId: "recording-a",
        title: "Recording A",
        groupKeys: ["missingAlbumTitle", "missingLabel"],
        providerStatus: "partial",
        reviewStatus: "needs-attention",
        proposalCount: 1,
        proposalFields: ["albumTitle", "label"],
        warnings: ["第一条URL指挥不符"],
        issues: ["版本提案仍带有来源冲突警告，应用前需要人工复核。"],
      },
      {
        recordingId: "recording-b",
        title: "Recording B",
        groupKeys: ["missingLabel", "missingReleaseDate"],
        providerStatus: "succeeded",
        reviewStatus: "ok",
        proposalCount: 1,
        proposalFields: ["label", "releaseDate"],
        warnings: [],
        issues: [],
      },
    ]);

    expect(summary.totalTargets).toBe(2);
    expect(summary.reviewStatusCounts).toEqual({ ok: 1, "needs-attention": 1 });
    expect(summary.providerStatusCounts).toEqual({ partial: 1, succeeded: 1 });
    expect(summary.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "missingLabel",
          sampleCount: 2,
          reviewStatusCounts: { ok: 1, "needs-attention": 1 },
          topFieldPaths: ["label", "albumTitle", "releaseDate"],
        }),
        expect.objectContaining({
          key: "missingReleaseDate",
          sampleCount: 1,
          reviewStatusCounts: { ok: 1 },
          topWarnings: [],
        }),
      ]),
    );
  });

  it("marks provider failures as needs-attention even when no proposal is returned", () => {
    const result = buildRecordingRetrievalAuditResult({
      target: {
        recordingId: "recording-a",
        title: "Recording A",
        groupKeys: ["missingAlbumTitle"],
      },
      recording: {
        id: "recording-a",
        title: "Recording A",
      },
      providerStatus: "timed_out",
      providerError: "外部检索超时。",
      proposals: [],
      review: {
        status: "already-complete",
        issues: [],
      },
    });

    expect(result.reviewStatus).toBe("needs-attention");
    expect(result.warnings).toEqual(["外部检索超时。"]);
    expect(result.issues).toEqual(["外部检索状态为 timed_out，本轮抽样未得到可直接采纳的版本提案。"]);
  });
});
