export const REVIEW_PAGE_SIZE = 5;

export const buildDataAttributeSelector = (attributeName, value) =>
  `[${attributeName}="${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;

const stableSerialize = (value) => JSON.stringify(value ?? null);

export const buildExcerpt = (value, maxLength = 120) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return { text: "", truncated: false };
  }
  if (normalized.length <= maxLength) {
    return { text: normalized, truncated: false };
  }
  return {
    text: `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`,
    truncated: true,
  };
};

export const paginateItems = (items, page = 1, pageSize = REVIEW_PAGE_SIZE) => {
  const safePageSize = Math.max(1, Number(pageSize) || REVIEW_PAGE_SIZE);
  const totalItems = Array.isArray(items) ? items.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    items: (items || []).slice(startIndex, startIndex + safePageSize),
  };
};

export const getProposalsForReviewAction = (proposals, action, options = {}) => {
  const scope = options.scope === "page" ? "page" : "all";
  const scopeIds = new Set((options.scopeIds || []).map((value) => String(value)));
  const scopedProposals =
    scope === "page"
      ? (proposals || []).filter((proposal) => scopeIds.has(String(proposal?.id || "")))
      : proposals || [];

  if (action === "apply-confirmed") {
    return scopedProposals.filter(
      (proposal) => proposal?.reviewState === "confirmed" && proposal?.status === "pending",
    );
  }

  if (action === "ignore-pending") {
    return scopedProposals.filter((proposal) => proposal?.status === "pending");
  }

  return [];
};

export const hasProposalDraftChanges = (proposal, draft = {}) => {
  if (!proposal) {
    return false;
  }

  const safeDraft = draft && typeof draft === "object" ? draft : {};

  const currentSelectedId = String(proposal.selectedImageCandidateId || "");
  if (
    typeof safeDraft.selectedImageCandidateId === "string" &&
    safeDraft.selectedImageCandidateId !== currentSelectedId
  ) {
    return true;
  }

  const patchMap = safeDraft.fieldsPatchMap || {};
  for (const field of proposal.fields || []) {
    if (!(field.path in patchMap)) {
      continue;
    }
    if (stableSerialize(patchMap[field.path]) !== stableSerialize(field.after)) {
      return true;
    }
  }

  return false;
};

export const resolveProposalDraft = (proposal, liveDraft = null, storedDraft = null) => {
  if (hasProposalDraftChanges(proposal, liveDraft)) {
    return liveDraft;
  }
  if (hasProposalDraftChanges(proposal, storedDraft)) {
    return storedDraft;
  }
  return liveDraft || storedDraft || null;
};

export const applyProposalDraft = (proposal, draft = {}) => {
  if (!proposal) {
    return proposal;
  }

  const safeDraft = draft && typeof draft === "object" ? draft : {};

  const patchMap = safeDraft.fieldsPatchMap || {};
  return {
    ...proposal,
    selectedImageCandidateId:
      typeof safeDraft.selectedImageCandidateId === "string"
        ? safeDraft.selectedImageCandidateId
        : proposal.selectedImageCandidateId || "",
    fields: (proposal.fields || []).map((field) =>
      field.path in patchMap
        ? {
            ...field,
            after: patchMap[field.path],
          }
        : field,
    ),
  };
};
