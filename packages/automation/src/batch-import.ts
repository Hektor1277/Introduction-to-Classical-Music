import { promises as fs } from "node:fs";
import path from "node:path";

import { detectPlatformFromUrl } from "../../data-core/src/resource-links.js";
import { validateLibrary, type Composer, type Credit, type LibraryData, type Person, type Recording, type Work } from "../../shared/src/schema.js";
import { createEntityId, createSlug, createSortKey, ensureUniqueValue } from "../../shared/src/slug.js";

export type BatchDraftReviewState = "unconfirmed" | "confirmed" | "discarded";

export type BatchDraftEntry<T> = {
  draftId: string;
  entityType: "composer" | "person" | "work" | "recording";
  sourceLine: string;
  notes: string[];
  reviewState: BatchDraftReviewState;
  entity: T;
};

export type BatchDraftEntities = {
  composers: BatchDraftEntry<Composer>[];
  people: BatchDraftEntry<Person>[];
  works: BatchDraftEntry<Work>[];
  recordings: BatchDraftEntry<Recording>[];
};

export type BatchCreatedEntityRefs = {
  composers: string[];
  people: string[];
  workGroups: string[];
  works: string[];
  recordings: string[];
};

export type AnalyzeBatchImportResult = {
  composerId: string;
  workId: string;
  selectedComposerId: string;
  selectedWorkId: string;
  workTypeHint: string;
  draftLibrary: LibraryData;
  createdEntityRefs: BatchCreatedEntityRefs;
  draftEntities: BatchDraftEntities;
  warnings: string[];
  parseNotes: string[];
  llmUsed: boolean;
};

type AnalyzeBatchImportOptions = {
  sourceText: string;
  library: LibraryData;
  composerId?: string;
  workId?: string;
  workTypeHint?: string;
};

const strictBatchWorkTypes = ["orchestral", "concerto", "opera_vocal", "chamber_solo", "unknown"] as const;

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function cloneLibrary(library: LibraryData): LibraryData {
  return structuredClone(library);
}

export function cloneBatchDraftEntities(draftEntities: BatchDraftEntities): BatchDraftEntities {
  return structuredClone(draftEntities);
}

function emptyInfoPanel() {
  return { text: "", articleId: "", collectionLinks: [] };
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const normalized = compact(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function uniqueId(prefix: string, value: string, ids: Set<string>) {
  const nextId = ensureUniqueValue(createEntityId(prefix, value), ids);
  ids.add(nextId);
  return nextId;
}

function uniqueSlug(value: string, slugs: Set<string>) {
  const nextSlug = ensureUniqueValue(createSlug(value), slugs);
  slugs.add(nextSlug);
  return nextSlug;
}

function createDraftEntry<T extends Composer | Person | Work | Recording>(
  entityType: BatchDraftEntry<T>["entityType"],
  entity: T,
  sourceLine: string,
  notes: string[] = [],
): BatchDraftEntry<T> {
  return {
    draftId: `${entityType}:${entity.id}`,
    entityType,
    sourceLine,
    notes,
    reviewState: "unconfirmed",
    entity,
  };
}

function upsertById<T extends { id: string }>(collection: T[], entity: T) {
  const index = collection.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    collection[index] = entity;
    return;
  }
  collection.push(entity);
}

function normalizeWorkTypeHintValue(value: unknown) {
  const normalized = compact(value).toLowerCase();
  return strictBatchWorkTypes.includes(normalized as (typeof strictBatchWorkTypes)[number]) ? normalized : "unknown";
}

function strictTemplateFieldCount(workTypeHint: string) {
  if (workTypeHint === "concerto" || workTypeHint === "opera_vocal") {
    return 5;
  }
  return 4;
}

function normalizeLooseBatchSeparator(line: string) {
  return String(line ?? "")
    .normalize("NFKC")
    .replace(/[｜￨│┃┆丨]/g, "|")
    .replace(/\s+[~～—–－]+\s+/g, " | ")
    .replace(/\s*\|\s*/g, " | ");
}

export function normalizeBatchImportSource(sourceText: string, workTypeHint: string) {
  const normalizedWorkTypeHint = normalizeWorkTypeHintValue(workTypeHint);
  const expectedFieldCount = strictTemplateFieldCount(normalizedWorkTypeHint);

  return String(sourceText ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => compact(normalizeLooseBatchSeparator(line)))
    .filter(Boolean)
    .map((line) => {
      const rawSlots = line.split("|").map((item) => compact(item));
      if (rawSlots.length === expectedFieldCount - 1) {
        return [...rawSlots, "-"].join(" | ");
      }
      return rawSlots.join(" | ");
    })
    .join("\n");
}

function splitStrictBatchLine(line: string) {
  return line.split("|").map((item) => compact(item));
}

function parseStrictBatchLinks(sourceText: string) {
  if (!compact(sourceText) || compact(sourceText) === "-") {
    return [];
  }
  return uniqueStrings(String(sourceText).split(",")).map((url) => ({
    platform: detectPlatformFromUrl(url),
    url,
    title: "",
  }));
}

function buildStrictRecordingTitle(workTypeHint: string, slots: string[]) {
  if (workTypeHint === "concerto") {
    const [soloist, conductor, orchestra, year] = slots;
    return [soloist, conductor, orchestra, year].filter((item) => item && item !== "-").join(" - ");
  }
  if (workTypeHint === "opera_vocal") {
    const [conductor, cast, ensemble, year] = slots;
    return [conductor, cast, ensemble, year].filter((item) => item && item !== "-").join(" - ");
  }
  if (workTypeHint === "chamber_solo") {
    const [lead, collaborator, year] = slots;
    return [lead, collaborator, year].filter((item) => item && item !== "-").join(" - ");
  }
  const [conductor, orchestra, year] = slots;
  return [conductor, orchestra, year].filter((item) => item && item !== "-").join(" - ");
}

function buildStrictRecordingCredits(workTypeHint: string, slots: string[]) {
  const credits: Credit[] = [];
  const pushCredit = (role: Credit["role"], displayName: string) => {
    if (!displayName || displayName === "-") {
      return;
    }
    credits.push({
      role,
      displayName,
      personId: "",
      label: "",
    });
  };

  if (workTypeHint === "concerto") {
    pushCredit("soloist", slots[0] || "");
    pushCredit("conductor", slots[1] || "");
    pushCredit("orchestra", slots[2] || "");
    return credits;
  }
  if (workTypeHint === "opera_vocal") {
    pushCredit("conductor", slots[0] || "");
    pushCredit("singer", slots[1] || "");
    pushCredit("orchestra", slots[2] || "");
    return credits;
  }
  if (workTypeHint === "chamber_solo") {
    pushCredit("soloist", slots[0] || "");
    pushCredit("ensemble", slots[1] || "");
    return credits;
  }

  pushCredit("conductor", slots[0] || "");
  pushCredit("orchestra", slots[1] || "");
  return credits;
}

function buildStrictBatchParseNotes(workTypeHint: string) {
  if (workTypeHint === "concerto") {
    return ["模板：独奏者 | 指挥 | 乐团 | 年份 | 链接列表"];
  }
  if (workTypeHint === "opera_vocal") {
    return ["模板：指挥 | 主演/卡司 | 乐团/合唱 | 年份 | 链接列表"];
  }
  if (workTypeHint === "chamber_solo") {
    return ["模板：主奏/组合 | 协作者 | 年份 | 链接列表"];
  }
  return ["模板：指挥 | 乐团 | 年份 | 链接列表"];
}

export function parseOrchestraAbbreviationText(sourceText: string) {
  const entries = Object.create(null) as Record<string, string>;
  for (const rawLine of String(sourceText ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z0-9]+)\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }
    entries[match[1].toUpperCase()] = match[2].trim();
  }
  return entries;
}

export async function loadOrchestraAbbreviationMap(
  filePath = path.join(process.cwd(), "materials", "references", "Orchestra Abbreviation Comparison.txt"),
) {
  const candidates = [filePath];

  for (const candidate of candidates) {
    try {
      const sourceText = await fs.readFile(candidate, "utf8");
      return parseOrchestraAbbreviationText(sourceText);
    } catch {
      // try next candidate
    }
  }

  return {};
}

function collectBatchSelections(baseLibrary: LibraryData, fullDraftLibrary: LibraryData, draftEntities: BatchDraftEntities) {
  const recordingMap = new Map((draftEntities.recordings || []).map((entry) => [entry.entity.id, entry]));
  const selectedRecordingIds = new Set<string>();

  for (const entry of draftEntities.recordings || []) {
    if (entry.reviewState === "confirmed") {
      selectedRecordingIds.add(entry.entity.id);
    }
  }

  const nextLibrary = cloneLibrary(baseLibrary);
  for (const recordingId of selectedRecordingIds) {
    const entry = recordingMap.get(recordingId);
    if (entry) {
      upsertById(nextLibrary.recordings, entry.entity);
    }
  }

  return {
    draftLibrary: validateLibrary(nextLibrary),
    createdEntityRefs: {
      composers: [],
      people: [],
      workGroups: [],
      works: [],
      recordings: [...selectedRecordingIds],
    } satisfies BatchCreatedEntityRefs,
  };
}

export function buildConfirmedBatchSelection(baseLibrary: LibraryData, fullDraftLibrary: LibraryData, draftEntities: BatchDraftEntities) {
  return collectBatchSelections(baseLibrary, fullDraftLibrary, draftEntities);
}

export async function analyzeBatchImport(options: AnalyzeBatchImportOptions): Promise<AnalyzeBatchImportResult> {
  const composerId = compact(options.composerId);
  const workId = compact(options.workId);
  if (!composerId || !workId) {
    throw new Error("批量导入前必须先选定作曲家和作品。");
  }

  const composer = options.library.composers.find((item) => item.id === composerId);
  const work = options.library.works.find((item) => item.id === workId);
  if (!composer) {
    throw new Error(`未找到已选作曲家：${composerId}`);
  }
  if (!work) {
    throw new Error(`未找到已选作品：${workId}`);
  }
  if (work.composerId !== composer.id) {
    throw new Error("所选作品不属于当前作曲家。");
  }

  const workTypeHint = normalizeWorkTypeHintValue(options.workTypeHint);
  const sourceText = normalizeBatchImportSource(options.sourceText ?? "", workTypeHint);
  const lines = sourceText
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error("批量导入文本不能为空。");
  }

  const draftLibrary = cloneLibrary(options.library);
  const draftEntities: BatchDraftEntities = {
    composers: [],
    people: [],
    works: [],
    recordings: [],
  };
  const createdEntityRefs: BatchCreatedEntityRefs = {
    composers: [],
    people: [],
    workGroups: [],
    works: [],
    recordings: [],
  };
  const warnings: string[] = [];
  const parseNotes = [...buildStrictBatchParseNotes(workTypeHint), `已选作曲家：${composer.name}`, `已选作品：${work.title}`];

  for (const line of lines) {
    const slots = splitStrictBatchLine(line);
    const fieldCount = strictTemplateFieldCount(workTypeHint);
    if (slots.length !== fieldCount) {
      throw new Error(`批量导入模板不合法：${line}。当前 ${workTypeHint} 模板要求 ${fieldCount} 个字段，并使用 | 分隔。`);
    }

    const year =
      workTypeHint === "concerto" || workTypeHint === "opera_vocal"
        ? compact(slots[3])
        : workTypeHint === "chamber_solo"
          ? compact(slots[2])
          : compact(slots[2]);
    const linkSlot =
      workTypeHint === "concerto" || workTypeHint === "opera_vocal"
        ? slots[4]
        : workTypeHint === "chamber_solo"
          ? slots[3]
          : slots[3];
    const links = parseStrictBatchLinks(linkSlot || "");
    const title = buildStrictRecordingTitle(workTypeHint, slots) || line;
    const recordingIds = new Set(draftLibrary.recordings.map((item) => item.id));
    const recordingSlugs = new Set(draftLibrary.recordings.map((item) => item.slug));
    const recording: Recording = {
      id: uniqueId("recording", `${work.id}-${title}`, recordingIds),
      workId: work.id,
      slug: uniqueSlug(title, recordingSlugs),
      title,
      sortKey: createSortKey(draftLibrary.recordings.length),
      isPrimaryRecommendation: false,
      updatedAt: new Date().toISOString(),
      images: [],
      credits: buildStrictRecordingCredits(workTypeHint, slots),
      links,
      notes: "",
      performanceDateText: year && year !== "-" ? year : "",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
      infoPanel: emptyInfoPanel(),
    };
    draftLibrary.recordings.push(recording);
    createdEntityRefs.recordings.push(recording.id);
    draftEntities.recordings.push(
      createDraftEntry("recording", recording, line, [
        `workTypeHint=${workTypeHint}`,
        ...(links.length ? [`links=${links.length}`] : []),
      ]),
    );
  }

  return {
    composerId,
    workId,
    selectedComposerId: composerId,
    selectedWorkId: workId,
    workTypeHint,
    draftLibrary: validateLibrary(draftLibrary),
    createdEntityRefs,
    draftEntities,
    warnings,
    parseNotes,
    llmUsed: false,
  };
}




