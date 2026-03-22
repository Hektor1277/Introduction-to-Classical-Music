import type { LlmProposalReview } from "./llm.js";

type ReviewBase = {
  ok: boolean;
  status: string;
  issues: string[];
  preview: unknown;
  hasChanges: boolean;
};

function formatNormalizedValueSuggestion(normalizedValue: Record<string, unknown> | undefined) {
  if (!normalizedValue) {
    return "";
  }

  const entries = Object.entries(normalizedValue)
    .map(([field, value]) => {
      const normalized = typeof value === "string" ? value.trim() : JSON.stringify(value);
      return normalized ? `${field}=${normalized}` : "";
    })
    .filter(Boolean);

  return entries.length > 0 ? `建议标准化：${entries.join("；")}` : "";
}

export function mergeProposalReviewResults<T extends ReviewBase>(review: T, llmReview: LlmProposalReview | null) {
  if (!llmReview) {
    return review;
  }

  const issues = [...review.issues];
  if (llmReview.status === "needs-attention") {
    issues.push(...llmReview.issues);
    issues.push(...llmReview.reasons);
    if (llmReview.rejectBecause) {
      issues.push(llmReview.rejectBecause);
    }
    const normalizedValueSuggestion = formatNormalizedValueSuggestion(llmReview.normalizedValue);
    if (normalizedValueSuggestion) {
      issues.push(normalizedValueSuggestion);
    }
  }

  const status =
    llmReview.status === "needs-attention"
      ? "needs-attention"
      : review.status === "already-complete" && review.hasChanges
        ? "ok"
        : review.status;

  return {
    ...review,
    ok: status === "ok",
    status,
    issues: [...new Set(issues)],
  };
}
