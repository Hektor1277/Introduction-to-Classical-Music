import type { LibraryData, MediaSourceKind } from "../../shared/src/schema.js";

import type { RecordingRetrievalProviderRuntimeState } from "./recording-retrieval.js";
export type AutomationEntityType = "composer" | "person" | "work" | "recording";
export type AutomationCheckCategory = "composer" | "conductor" | "orchestra" | "artist" | "work" | "recording";
export type AutomationRisk = "low" | "medium" | "high";
export type AutomationProposalStatus = "pending" | "applied" | "ignored";
export type AutomationProposalKind = "update" | "merge";
export type AutomationReviewState = "unseen" | "viewed" | "edited" | "confirmed" | "discarded";

export type AutomationFieldPatch = {
  path: string;
  before: unknown;
  after: unknown;
};

export type AutomationImageCandidate = {
  id: string;
  src: string;
  sourceUrl: string;
  sourceKind: MediaSourceKind | "other";
  attribution: string;
  width?: number;
  height?: number;
  title?: string;
  score?: number;
};

export type AutomationMergeCandidate = {
  targetId: string;
  targetLabel: string;
  reason: string;
};

export type AutomationProposalEvidence = {
  field: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: number;
  note?: string;
};

export type AutomationLinkCandidate = {
  platform: string;
  url: string;
  title?: string;
  sourceLabel?: string;
  confidence?: number;
};

export type AutomationProposal = {
  id: string;
  kind?: AutomationProposalKind;
  entityType: AutomationEntityType;
  entityId: string;
  summary: string;
  risk: AutomationRisk;
  status?: AutomationProposalStatus;
  reviewState?: AutomationReviewState;
  sources: string[];
  fields: AutomationFieldPatch[];
  warnings?: string[];
  imageCandidates?: AutomationImageCandidate[];
  mergeCandidates?: AutomationMergeCandidate[];
  selectedImageCandidateId?: string;
  evidence?: AutomationProposalEvidence[];
  linkCandidates?: AutomationLinkCandidate[];
};

export type AutomationSnapshot = {
  id: string;
  proposalId: string;
  entityType: AutomationEntityType;
  entityId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

export type AutomationRun = {
  id: string;
  createdAt: string;
  categories: AutomationCheckCategory[];
  proposals: AutomationProposal[];
  snapshots: AutomationSnapshot[];
  notes: string[];
  provider?: RecordingRetrievalProviderRuntimeState;
  summary: {
    total: number;
    pending: number;
    applied: number;
    ignored: number;
  };
};

export type AutomationRunInput = {
  categories: AutomationCheckCategory[];
  proposals: AutomationProposal[];
  notes?: string[];
  provider?: RecordingRetrievalProviderRuntimeState;
};

export type ImageRankingRequest = {
  title: string;
  entityKind: "person" | "group" | "recording";
};

const suspiciousImagePattern =
  /(^|[^a-z])(logo|icon|badge|brand|site\s*logo|baike[-_ ]?logo|baidubaike|baidu[-_ ]?baike|baidu[-_ ]?logo|bd[-_ ]?logo|favicon|placeholder|sprite|default[-_ ]?image|no[-_ ]?image|wordmark|signature|autograph|watermark)([^a-z]|$)/i;

function cloneLibrary<T>(library: T): T {
  return structuredClone(library);
}

export function summarizeAutomationRun(run: AutomationRun): AutomationRun {
  const pending = run.proposals.filter((proposal) => proposal.status === "pending").length;
  const applied = run.proposals.filter((proposal) => proposal.status === "applied").length;
  const ignored = run.proposals.filter((proposal) => proposal.status === "ignored").length;

  return {
    ...run,
    summary: {
      total: run.proposals.length,
      pending,
      applied,
      ignored,
    },
  };
}

function findEntityCollection(library: LibraryData, entityType: AutomationEntityType) {
  if (entityType === "composer") {
    return library.composers;
  }
  if (entityType === "person") {
    return library.people;
  }
  if (entityType === "work") {
    return library.works;
  }
  return library.recordings;
}

function parsePathSegments(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = parsePathSegments(path);
  let current: unknown = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];

    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        throw new Error(`Path ${path} does not point to an array`);
      }
      current[segment] ??= typeof nextSegment === "number" ? [] : {};
      current = current[segment];
      continue;
    }

    const record = current as Record<string, unknown>;
    record[segment] ??= typeof nextSegment === "number" ? [] : {};
    current = record[segment];
  }

  const finalSegment = segments.at(-1);
  if (typeof finalSegment === "undefined") {
    return;
  }

  if (typeof finalSegment === "number") {
    if (!Array.isArray(current)) {
      throw new Error(`Path ${path} does not point to an array`);
    }
    current[finalSegment] = value;
    return;
  }

  (current as Record<string, unknown>)[finalSegment] = value;
}

export function createAutomationRun(_library: LibraryData, input: AutomationRunInput): AutomationRun {
  const createdAt = new Date().toISOString();
  return summarizeAutomationRun({
    id: `run-${createdAt.replace(/[:.]/g, "-")}`,
    createdAt,
    categories: [...input.categories],
    proposals: input.proposals.map((proposal) => ({
      ...proposal,
      kind: proposal.kind ?? "update",
      status: proposal.status ?? "pending",
      reviewState: proposal.reviewState ?? "unseen",
      warnings: proposal.warnings ?? [],
      imageCandidates: proposal.imageCandidates ?? [],
      mergeCandidates: proposal.mergeCandidates ?? [],
      selectedImageCandidateId: proposal.selectedImageCandidateId ?? "",
      evidence: proposal.evidence ?? [],
      linkCandidates: proposal.linkCandidates ?? [],
    })),
    snapshots: [],
    notes: input.notes ?? [],
    provider: input.provider,
    summary: {
      total: 0,
      pending: 0,
      applied: 0,
      ignored: 0,
    },
  });
}

export function canApplyAutomationProposal(proposal: AutomationProposal) {
  return proposal.kind !== "merge" && (proposal.fields.length > 0 || (proposal.imageCandidates?.length ?? 0) > 0);
}

export function applyAutomationProposal(library: LibraryData, run: AutomationRun, proposalId: string) {
  const proposal = run.proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    throw new Error(`Unknown proposal: ${proposalId}`);
  }
  if (!canApplyAutomationProposal(proposal)) {
    throw new Error(`Proposal cannot be applied: ${proposalId}`);
  }

  const nextLibrary = cloneLibrary(library);
  const collection = findEntityCollection(nextLibrary, proposal.entityType);
  const entity = collection.find((item) => item.id === proposal.entityId) as Record<string, unknown> | undefined;
  if (!entity) {
    throw new Error(`Unknown entity for proposal: ${proposal.entityId}`);
  }

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of proposal.fields) {
    before[field.path] = field.before;
    setPath(entity, field.path, field.after);
    after[field.path] = field.after;
  }

  const snapshot: AutomationSnapshot = {
    id: `snapshot-${proposal.id}-${Date.now()}`,
    proposalId: proposal.id,
    entityType: proposal.entityType,
    entityId: proposal.entityId,
    before,
    after,
    createdAt: new Date().toISOString(),
  };

  const nextRun = summarizeAutomationRun({
    ...run,
    proposals: run.proposals.map((item) => (item.id === proposal.id ? { ...item, status: "applied" } : item)),
    snapshots: [...run.snapshots, snapshot],
  });

  return {
    library: nextLibrary,
    run: nextRun,
    snapshot,
  };
}

export function applyPendingAutomationProposals(library: LibraryData, run: AutomationRun) {
  let nextLibrary = cloneLibrary(library);
  let nextRun = run;
  const snapshots: AutomationSnapshot[] = [];

  for (const proposal of nextRun.proposals) {
    if (proposal.status !== "pending" || !canApplyAutomationProposal(proposal)) {
      continue;
    }
    const applied = applyAutomationProposal(nextLibrary, nextRun, proposal.id);
    nextLibrary = applied.library;
    nextRun = applied.run;
    snapshots.push(applied.snapshot);
  }

  return {
    library: nextLibrary,
    run: nextRun,
    snapshots,
  };
}

export function revertAutomationProposal(library: LibraryData, run: AutomationRun, snapshotId: string) {
  const snapshot = run.snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error(`Unknown snapshot: ${snapshotId}`);
  }

  const nextLibrary = cloneLibrary(library);
  const collection = findEntityCollection(nextLibrary, snapshot.entityType);
  const entity = collection.find((item) => item.id === snapshot.entityId) as Record<string, unknown> | undefined;
  if (!entity) {
    throw new Error(`Unknown entity for snapshot: ${snapshot.entityId}`);
  }

  for (const [path, value] of Object.entries(snapshot.before)) {
    setPath(entity, path, value);
  }

  return nextLibrary;
}

export function ignoreAutomationProposal(run: AutomationRun, proposalId: string) {
  return summarizeAutomationRun({
    ...run,
    proposals: run.proposals.map((proposal) =>
      proposal.id === proposalId ? { ...proposal, status: "ignored", reviewState: "discarded" } : proposal,
    ),
  });
}

export function ignorePendingAutomationProposals(run: AutomationRun) {
  return summarizeAutomationRun({
    ...run,
    proposals: run.proposals.map((proposal) =>
      proposal.status === "pending" ? { ...proposal, status: "ignored", reviewState: "discarded" } : proposal,
    ),
  });
}

export function updateAutomationProposalReview(
  run: AutomationRun,
  proposalId: string,
  reviewState: AutomationReviewState,
  selectedImageCandidateId?: string,
) {
  const reviewStatus =
    reviewState === "discarded"
      ? "ignored"
      : reviewState === "viewed" || reviewState === "edited" || reviewState === "confirmed"
        ? "pending"
        : undefined;

  return summarizeAutomationRun({
    ...run,
    proposals: run.proposals.map((proposal) =>
      proposal.id === proposalId
        ? {
            ...proposal,
            reviewState,
            status: proposal.status === "applied" ? "applied" : reviewStatus ?? proposal.status ?? "pending",
            selectedImageCandidateId:
              typeof selectedImageCandidateId === "string" ? selectedImageCandidateId : proposal.selectedImageCandidateId || "",
          }
        : proposal,
    ),
  });
}

export function isSuspiciousImageCandidate(candidate: AutomationImageCandidate) {
  const haystack = `${candidate.src} ${candidate.sourceUrl} ${candidate.attribution ?? ""} ${candidate.title ?? ""}`;
  return suspiciousImagePattern.test(haystack);
}

function scoreImageCandidate(request: ImageRankingRequest, candidate: AutomationImageCandidate) {
  const width = candidate.width ?? 0;
  const height = candidate.height ?? 0;
  const minDimension = Math.min(width, height);
  const aspectRatio = width && height ? width / height : 0;
  const squarePenalty = aspectRatio ? Math.abs(1 - aspectRatio) * 25 : 18;
  const sourceBoost =
    candidate.sourceKind === "wikimedia-commons"
      ? 24
      : candidate.sourceKind === "wikipedia" || candidate.sourceKind === "wikidata"
        ? 18
        : candidate.sourceKind === "streaming"
          ? 16
          : candidate.sourceKind === "official-site"
            ? 14
            : 4;
  const titleBoost = candidate.sourceUrl.toLowerCase().includes(request.title.toLowerCase().replace(/\s+/g, "-"))
    ? 8
    : candidate.title?.toLowerCase().includes(request.title.toLowerCase())
      ? 8
      : 0;
  const resolutionBoost = Math.min(minDimension / 40, 40);
  const attributionBoost = candidate.attribution ? 4 : 0;
  const watermarkPenalty = /watermark|sample|sprite/i.test(`${candidate.title ?? ""} ${candidate.sourceUrl}`) ? 16 : 0;
  const suspiciousPenalty = isSuspiciousImageCandidate(candidate) ? 48 : 0;

  return Math.max(0, sourceBoost + titleBoost + resolutionBoost + attributionBoost - squarePenalty - watermarkPenalty - suspiciousPenalty);
}

export function rankImageCandidates(request: ImageRankingRequest, candidates: AutomationImageCandidate[]) {
  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      score: scoreImageCandidate(request, candidate),
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

