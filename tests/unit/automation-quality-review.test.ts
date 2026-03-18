import { describe, expect, it } from "vitest";

import { reviewAutomationProposalQuality } from "@/lib/automation-checks";

describe("automation proposal quality review", () => {
  it("does not downgrade a complete named entity to needs-attention only because the image still needs applying", () => {
    const entity = {
      id: "barenboim",
      slug: "daniel-barenboim",
      name: "丹尼尔·巴伦博伊姆",
      nameLatin: "Daniel Barenboim",
      country: "Argentina",
      avatarSrc: "",
      roles: ["conductor"],
      aliases: ["巴伦博伊姆"],
      sortKey: "0010",
      summary: "阿根廷裔钢琴家、指挥家，1942年出生。",
    };

    const review = reviewAutomationProposalQuality(entity, [
      {
        id: "barenboim-image",
        kind: "update",
        entityType: "person",
        entityId: "barenboim",
        summary: "自动检查：丹尼尔·巴伦博伊姆",
        risk: "low",
        status: "pending",
        sources: ["https://commons.wikimedia.org/wiki/File:Daniel_Barenboim.jpg"],
        fields: [],
        imageCandidates: [
          {
            id: "barenboim-image-1",
            src: "https://upload.wikimedia.org/example.jpg",
            sourceUrl: "https://commons.wikimedia.org/wiki/File:Daniel_Barenboim.jpg",
            sourceKind: "wikimedia-commons",
            attribution: "Wikimedia Commons",
            title: "Daniel Barenboim",
            width: 1200,
            height: 1200,
          },
        ],
        warnings: [],
        reviewState: "unseen",
        mergeCandidates: [],
        selectedImageCandidateId: "",
        evidence: [],
        linkCandidates: [],
      },
    ]);

    expect(review.status).toBe("ok");
    expect(review.ok).toBe(true);
    expect(review.issues).toEqual([]);
  });

  it("flags implausible life years when the proposed years conflict with the preview summary", () => {
    const entity = {
      id: "barenboim",
      slug: "daniel-barenboim",
      name: "丹尼尔·巴伦博伊姆",
      nameLatin: "Daniel Barenboim",
      country: "",
      avatarSrc: "/library-assets/people/barenboim.jpg",
      roles: ["conductor"],
      aliases: ["巴伦博伊姆"],
      sortKey: "0010",
      summary: "",
    };

    const review = reviewAutomationProposalQuality(entity, [
      {
        id: "barenboim-years",
        kind: "update",
        entityType: "person",
        entityId: "barenboim",
        summary: "自动检查：丹尼尔·巴伦博伊姆",
        risk: "medium",
        status: "pending",
        sources: ["https://example.com/barenboim"],
        fields: [
          { path: "birthYear", before: undefined, after: 1992 },
          { path: "deathYear", before: undefined, after: 2023 },
          {
            path: "summary",
            before: "",
            after: "丹尼尔·巴伦博伊姆，1942年出生于布宜诺斯艾利斯，是钢琴家兼指挥家。",
          },
        ],
        imageCandidates: [],
        warnings: [],
        reviewState: "unseen",
        mergeCandidates: [],
        selectedImageCandidateId: "",
        evidence: [],
        linkCandidates: [],
      },
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues).toEqual(expect.arrayContaining(["生卒年份与当前摘要内容冲突，疑似提取错误。"]));
  });

  it("flags country mismatches when an orchestra summary and the proposed country disagree", () => {
    const entity = {
      id: "berlin-phil",
      slug: "berlin-philharmonic",
      name: "柏林爱乐乐团",
      nameLatin: "Berlin Philharmonic",
      country: "",
      avatarSrc: "/library-assets/people/berlin-phil.jpg",
      roles: ["orchestra"],
      aliases: ["柏林爱乐", "BPO"],
      sortKey: "1000",
      summary: "",
    };

    const review = reviewAutomationProposalQuality(entity, [
      {
        id: "berlin-country",
        kind: "update",
        entityType: "person",
        entityId: "berlin-phil",
        summary: "自动检查：柏林爱乐乐团",
        risk: "medium",
        status: "pending",
        sources: ["https://example.com/berlin-phil"],
        fields: [
          { path: "country", before: "", after: "Austria" },
          {
            path: "summary",
            before: "",
            after: "柏林爱乐乐团成立于1882年，是德国柏林的著名管弦乐团。",
          },
        ],
        imageCandidates: [],
        warnings: [],
        reviewState: "unseen",
        mergeCandidates: [],
        selectedImageCandidateId: "",
        evidence: [],
        linkCandidates: [],
      },
    ]);

    expect(review.status).toBe("needs-attention");
    expect(review.issues).toEqual(expect.arrayContaining(["国家字段与当前摘要内容冲突，疑似提取错误。"]));
  });
});
