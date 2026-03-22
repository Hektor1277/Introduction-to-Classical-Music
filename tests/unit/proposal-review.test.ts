import { describe, expect, it } from "vitest";

import { mergeProposalReviewResults } from "@/lib/proposal-review";

describe("proposal review merge", () => {
  it("surfaces llm rejection reasons and normalized suggestions as review issues", () => {
    const merged = mergeProposalReviewResults(
      {
        ok: true,
        status: "ok",
        issues: [],
        preview: { country: "Austria" },
        hasChanges: true,
      },
      {
        verdict: "reject",
        status: "needs-attention",
        issues: ["现有规范字段质量更高"],
        reasons: ["候选值与现有规范字段冲突"],
        rejectBecause: "现有中文全名已经是高质量规范值",
        normalizedValue: {
          country: "Austria",
          displayFullName: "安东·布鲁克纳",
        },
        confidence: 0.93,
        rationale: "应阻止低价值覆盖。",
      },
    );

    expect(merged.ok).toBe(false);
    expect(merged.status).toBe("needs-attention");
    expect(merged.issues).toContain("现有中文全名已经是高质量规范值");
    expect(merged.issues).toContain("候选值与现有规范字段冲突");
    expect(merged.issues).toContain("建议标准化：country=Austria；displayFullName=安东·布鲁克纳");
  });
});
