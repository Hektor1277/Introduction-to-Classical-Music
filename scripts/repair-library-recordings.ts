import { spawnSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadLibraryFromDisk, saveLibraryToDisk, writeGeneratedArtifacts } from "../packages/data-core/src/library-store.js";
import { parseLegacyRecordingHtml } from "../packages/data-core/src/legacy-parser.js";
import { backfillRecordingWorkTypeHints, repairRecordingFromLegacyParse } from "../packages/data-core/src/recording-repair.js";
import { createEntityId, createSlug, createSortKey } from "../packages/shared/src/slug.js";

const SOURCE_ROOT_NAME = "an incomplete guide to classical music";
const defaultSources = [
  path.join(process.cwd(), "materials", "archive", "an incomplete guide to classical music.rar"),
];

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function hasPlaceholderCredits(recording: { credits?: Array<{ personId?: unknown; displayName?: unknown }> }) {
  return (recording.credits || []).some((credit) => compact(credit.personId) === "person-item" || compact(credit.displayName) === "-");
}

function isMetadataIncomplete(recording: { performanceDateText?: unknown; venueText?: unknown; albumTitle?: unknown; label?: unknown; releaseDate?: unknown }) {
  return !compact(recording.performanceDateText) || !compact(recording.venueText) || (!compact(recording.albumTitle) && !compact(recording.label) && !compact(recording.releaseDate));
}

function needsLegacyRepair(recording: {
  legacyPath?: unknown;
  credits?: Array<{ personId?: unknown; displayName?: unknown }>;
  performanceDateText?: unknown;
  venueText?: unknown;
  albumTitle?: unknown;
  label?: unknown;
  releaseDate?: unknown;
}) {
  return Boolean(compact(recording.legacyPath)) && (hasPlaceholderCredits(recording) || isMetadataIncomplete(recording));
}

async function exists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function extractArchive(sourcePath: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "classical-guide-repair-"));
  const result = spawnSync("tar", ["-xf", sourcePath, "-C", tempDir], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return tempDir;
}

async function findLegacyRoot(startDir: string): Promise<string | null> {
  const queue = [startDir];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    if (entries.some((entry) => entry.isDirectory() && entry.name === "作曲家")) {
      return currentDir;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push(path.join(currentDir, entry.name));
      }
    }
  }
  return null;
}

async function resolveArchiveRoot() {
  const sourcePath = defaultSources.find((candidate) => requirePath(candidate));
  if (!sourcePath) {
    throw new Error("找不到原始 RAR 档案，无法执行录音修复。");
  }
  const tempDir = await extractArchive(sourcePath);
  const rootDir = await findLegacyRoot(tempDir);
  if (!rootDir) {
    throw new Error(`在解包目录中未找到 ${SOURCE_ROOT_NAME} 根结构。`);
  }
  return { tempDir, rootDir };
}

function requirePath(candidate: string) {
  return existsSync(candidate);
}

function normalizeNameKey(value: unknown) {
  return compact(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'"`"“”‘’.,;:!?()[\]{}\-_/\\|&]+/g, "");
}

function isPlaceholderPerson(person: { id?: unknown; name?: unknown }) {
  return compact(person.id) === "person-item" || compact(person.name) === "-";
}

function matchExistingPerson(library: Awaited<ReturnType<typeof loadLibraryFromDisk>>, role: string, displayName: string) {
  const target = normalizeNameKey(displayName);
  if (!target) {
    return null;
  }
  const candidates = (library.people || []).filter((person) => {
    if (isPlaceholderPerson(person)) {
      return false;
    }
    if (role === "orchestra" || role === "ensemble" || role === "chorus") {
      return (person.roles || []).some((personRole) => ["orchestra", "ensemble", "chorus"].includes(personRole));
    }
    return true;
  });
  return (
    candidates.find((person) =>
      [person.name, person.nameLatin, ...(person.aliases || [])].some((value) => normalizeNameKey(value) === target),
    ) || null
  );
}

function ensurePeopleForParsedCredits(library: Awaited<ReturnType<typeof loadLibraryFromDisk>>, parsedCredits: Array<{ role: string; displayName: string }>) {
  const nextPeople = [...library.people];
  let changed = false;

  for (const credit of parsedCredits) {
    if (!["orchestra", "ensemble", "chorus"].includes(credit.role)) {
      continue;
    }
    const displayName = compact(credit.displayName);
    if (!displayName || displayName === "-") {
      continue;
    }
    const existing = matchExistingPerson({ ...library, people: nextPeople }, credit.role, displayName);
    if (existing) {
      continue;
    }
    changed = true;
    const id = createEntityId(`person-${credit.role}`, displayName);
    nextPeople.push({
      id,
      slug: createSlug(displayName),
      name: displayName,
      nameLatin: /[A-Za-z]/.test(displayName) ? displayName : "",
      country: "",
      avatarSrc: "",
      aliases: [],
      sortKey: createSortKey(nextPeople.length),
      summary: "",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [] },
      roles: [credit.role as "orchestra" | "ensemble" | "chorus"],
    });
  }

  return changed ? { ...library, people: nextPeople } : library;
}

function stripUnusedPlaceholderPeople(library: Awaited<ReturnType<typeof loadLibraryFromDisk>>) {
  const referencedPersonIds = new Set(
    (library.recordings || []).flatMap((recording) => (recording.credits || []).map((credit) => compact(credit.personId)).filter(Boolean)),
  );
  return {
    ...library,
    people: (library.people || []).filter((person) => person.id !== "person-item" || referencedPersonIds.has(person.id)),
  };
}

async function main() {
  const originalLibrary = await loadLibraryFromDisk();
  let library = backfillRecordingWorkTypeHints(originalLibrary);

  const recordingsToRepair = library.recordings.filter((recording) => needsLegacyRepair(recording));
  let repairedCount = 0;
  let backfilledCount = library.recordings.filter((recording, index) => recording.workTypeHint !== originalLibrary.recordings[index]?.workTypeHint).length;

  if (recordingsToRepair.length > 0) {
    const { tempDir, rootDir } = await resolveArchiveRoot();
    try {
      const repairedRecordings = [];
      for (const recording of library.recordings) {
        if (!needsLegacyRepair(recording)) {
          repairedRecordings.push(recording);
          continue;
        }
        const legacyRelativePath = compact(recording.legacyPath).replace(/\//g, path.sep);
        const legacyFilePath = path.join(rootDir, legacyRelativePath);
        if (!(await exists(legacyFilePath))) {
          repairedRecordings.push(recording);
          continue;
        }
        const html = await fs.readFile(legacyFilePath, "utf8");
        const parsed = parseLegacyRecordingHtml(html);
        library = ensurePeopleForParsedCredits(library, parsed.credits || []);
        repairedRecordings.push(repairRecordingFromLegacyParse(library, recording, parsed));
        repairedCount += 1;
      }
      library = {
        ...library,
        recordings: repairedRecordings,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  library = stripUnusedPlaceholderPeople(library);
  await saveLibraryToDisk(library);
  await writeGeneratedArtifacts();

  const remainingUnknown = library.recordings.filter((recording) => compact(recording.workTypeHint) === "unknown").length;
  const remainingPlaceholderCredits = library.recordings.filter((recording) => hasPlaceholderCredits(recording)).length;

  console.log(
    JSON.stringify(
      {
        recordingsTotal: library.recordings.length,
        workTypeBackfilled: backfilledCount,
        recordingsRepairedFromLegacy: repairedCount,
        remainingUnknownWorkTypeHints: remainingUnknown,
        remainingPlaceholderCredits,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
