import type { LibraryData, Recording } from "../../shared/src/schema.js";
import type { RecordingRetrievalProviderStatus } from "./recording-retrieval.js";

export type RecordingRetrievalAuditGroupKey =
  | "missingAlbumTitle"
  | "missingLabel"
  | "missingReleaseDate"
  | "missingImages";

export type RecordingRetrievalAuditGroup = {
  key: RecordingRetrievalAuditGroupKey;
  label: string;
  totalCandidates: number;
  selectedRecordingIds: string[];
};

export type RecordingRetrievalAuditTarget = {
  recordingId: string;
  title: string;
  groupKeys: RecordingRetrievalAuditGroupKey[];
};

export type RecordingRetrievalAuditPlan = {
  groups: RecordingRetrievalAuditGroup[];
  targets: RecordingRetrievalAuditTarget[];
  totalCandidates: number;
  totalTargets: number;
};

export type RecordingRetrievalAuditResult = {
  recordingId: string;
  title: string;
  groupKeys: RecordingRetrievalAuditGroupKey[];
  providerStatus: RecordingRetrievalProviderStatus;
  reviewStatus: "ok" | "needs-attention" | "already-complete";
  proposalCount: number;
  proposalFields: string[];
  warnings: string[];
  issues: string[];
};

export type RecordingRetrievalAuditGroupSummary = {
  key: RecordingRetrievalAuditGroupKey;
  label: string;
  sampleCount: number;
  providerStatusCounts: Partial<Record<RecordingRetrievalProviderStatus, number>>;
  reviewStatusCounts: Partial<Record<RecordingRetrievalAuditResult["reviewStatus"], number>>;
  topFieldPaths: string[];
  topWarnings: string[];
};

export type RecordingRetrievalAuditSummary = {
  totalTargets: number;
  providerStatusCounts: Partial<Record<RecordingRetrievalProviderStatus, number>>;
  reviewStatusCounts: Partial<Record<RecordingRetrievalAuditResult["reviewStatus"], number>>;
  groups: RecordingRetrievalAuditGroupSummary[];
};

type RecordingRetrievalAuditProposalLike = {
  fields?: Array<{ path: string }>;
  warnings?: string[];
};

type RecordingRetrievalAuditReviewLike = {
  status: RecordingRetrievalAuditResult["reviewStatus"];
  issues: string[];
};

const groupDefinitions: Array<{
  key: RecordingRetrievalAuditGroupKey;
  label: string;
  predicate: (recording: Recording) => boolean;
}> = [
  { key: "missingAlbumTitle", label: "缺专辑名", predicate: (recording) => !String(recording.albumTitle || "").trim() },
  { key: "missingLabel", label: "缺厂牌", predicate: (recording) => !String(recording.label || "").trim() },
  { key: "missingReleaseDate", label: "缺发行日期", predicate: (recording) => !String(recording.releaseDate || "").trim() },
  { key: "missingImages", label: "缺图片", predicate: (recording) => (recording.images?.length || 0) === 0 },
];

function incrementCounter<T extends string>(counter: Partial<Record<T, number>>, key: T) {
  counter[key] = (counter[key] || 0) + 1;
}

function sortCounterKeys(counter: Record<string, number>) {
  return Object.entries(counter)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key]) => key);
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

export function buildRecordingRetrievalAuditPlan(library: LibraryData, options: { sampleSizePerGroup?: number } = {}): RecordingRetrievalAuditPlan {
  const sampleSizePerGroup = Math.max(1, options.sampleSizePerGroup ?? 3);
  const groups: RecordingRetrievalAuditGroup[] = [];
  const targetMap = new Map<string, RecordingRetrievalAuditTarget>();
  const assignmentCounts = new Map<string, number>();

  for (const definition of groupDefinitions) {
    const candidates = library.recordings.filter(definition.predicate);
    const selected = [...candidates]
      .sort((left, right) => {
        const leftCount = assignmentCounts.get(left.id) ?? 0;
        const rightCount = assignmentCounts.get(right.id) ?? 0;
        return leftCount - rightCount || left.sortKey.localeCompare(right.sortKey) || left.id.localeCompare(right.id);
      })
      .slice(0, sampleSizePerGroup);
    groups.push({
      key: definition.key,
      label: definition.label,
      totalCandidates: candidates.length,
      selectedRecordingIds: selected.map((recording) => recording.id),
    });

    for (const recording of selected) {
      const existing = targetMap.get(recording.id);
      if (existing) {
        existing.groupKeys.push(definition.key);
      } else {
        targetMap.set(recording.id, {
          recordingId: recording.id,
          title: recording.title,
          groupKeys: [definition.key],
        });
      }
      assignmentCounts.set(recording.id, (assignmentCounts.get(recording.id) ?? 0) + 1);
    }
  }

  return {
    groups,
    targets: [...targetMap.values()],
    totalCandidates: groups.reduce((sum, group) => sum + group.totalCandidates, 0),
    totalTargets: targetMap.size,
  };
}

export function buildRecordingRetrievalAuditResult(input: {
  target: RecordingRetrievalAuditTarget;
  recording: Pick<Recording, "id" | "title">;
  providerStatus: RecordingRetrievalProviderStatus;
  providerError?: string;
  proposals: RecordingRetrievalAuditProposalLike[];
  review: RecordingRetrievalAuditReviewLike;
}): RecordingRetrievalAuditResult {
  const warnings = uniqueStrings([input.providerError, ...input.proposals.flatMap((proposal) => proposal.warnings || [])]);
  const issues = [...input.review.issues];
  let reviewStatus = input.review.status;

  if (
    ["failed", "timed_out", "unavailable", "canceled"].includes(input.providerStatus) ||
    (input.providerStatus === "partial" && input.proposals.length === 0)
  ) {
    reviewStatus = "needs-attention";
    issues.unshift(`外部检索状态为 ${input.providerStatus}，本轮抽样未得到可直接采纳的版本提案。`);
  }

  return {
    recordingId: input.recording.id,
    title: input.recording.title,
    groupKeys: input.target.groupKeys,
    providerStatus: input.providerStatus,
    reviewStatus,
    proposalCount: input.proposals.length,
    proposalFields: uniqueStrings(input.proposals.flatMap((proposal) => (proposal.fields || []).map((field) => field.path))),
    warnings,
    issues: uniqueStrings(issues),
  };
}

export function summarizeRecordingRetrievalAudit(results: RecordingRetrievalAuditResult[]): RecordingRetrievalAuditSummary {
  const providerStatusCounts: Partial<Record<RecordingRetrievalProviderStatus, number>> = {};
  const reviewStatusCounts: Partial<Record<RecordingRetrievalAuditResult["reviewStatus"], number>> = {};
  const groupBuckets = new Map<RecordingRetrievalAuditGroupKey, RecordingRetrievalAuditResult[]>();

  for (const result of results) {
    incrementCounter(providerStatusCounts, result.providerStatus);
    incrementCounter(reviewStatusCounts, result.reviewStatus);
    for (const key of result.groupKeys) {
      const bucket = groupBuckets.get(key) ?? [];
      bucket.push(result);
      groupBuckets.set(key, bucket);
    }
  }

  return {
    totalTargets: results.length,
    providerStatusCounts,
    reviewStatusCounts,
    groups: groupDefinitions.map((definition) => {
      const bucket = groupBuckets.get(definition.key) ?? [];
      const groupProviderStatusCounts: Partial<Record<RecordingRetrievalProviderStatus, number>> = {};
      const groupReviewStatusCounts: Partial<Record<RecordingRetrievalAuditResult["reviewStatus"], number>> = {};
      const fieldCounter: Record<string, number> = {};
      const warningCounter: Record<string, number> = {};

      for (const result of bucket) {
        incrementCounter(groupProviderStatusCounts, result.providerStatus);
        incrementCounter(groupReviewStatusCounts, result.reviewStatus);
        for (const field of result.proposalFields) {
          fieldCounter[field] = (fieldCounter[field] || 0) + 1;
        }
        for (const warning of result.warnings) {
          warningCounter[warning] = (warningCounter[warning] || 0) + 1;
        }
      }

      return {
        key: definition.key,
        label: definition.label,
        sampleCount: bucket.length,
        providerStatusCounts: groupProviderStatusCounts,
        reviewStatusCounts: groupReviewStatusCounts,
        topFieldPaths: sortCounterKeys(fieldCounter),
        topWarnings: sortCounterKeys(warningCounter),
      } satisfies RecordingRetrievalAuditGroupSummary;
    }),
  };
}
