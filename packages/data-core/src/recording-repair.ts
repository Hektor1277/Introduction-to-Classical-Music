import { parseLegacyRecordingHtml } from "./legacy-parser.js";
import type { LibraryData, Person, Recording } from "../../shared/src/schema.js";
import { resolveRecordingWorkTypeHintValue } from "../../shared/src/recording-rules.js";

type ParsedLegacyRecording = ReturnType<typeof parseLegacyRecordingHtml>;

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNameKey(value: unknown) {
  return compact(value)
    .toLowerCase()
    .replace(/[\s'"`"“”‘’.,;:!?()[\]{}\-_/\\|&]+/g, "");
}

function isPlaceholderValue(value: unknown) {
  const text = compact(value);
  return !text || text === "-" || text === "unknown";
}

function isPlaceholderCredit(credit: { personId?: unknown; displayName?: unknown }) {
  return compact(credit.personId) === "person-item" || isPlaceholderValue(credit.displayName);
}

function isPlaceholderPerson(person: Person) {
  return person.id === "person-item" || isPlaceholderValue(person.name);
}

function personMatchesName(person: Person, value: string) {
  const target = normalizeNameKey(value);
  if (!target) {
    return false;
  }
  const candidates = [
    person.name,
    person.fullName,
    person.displayName,
    person.displayFullName,
    person.nameLatin,
    person.displayLatinName,
    ...(person.aliases || []),
    ...(person.abbreviations || []),
  ];
  return candidates.some((candidate) => normalizeNameKey(candidate) === target);
}

function findPersonForCredit(library: LibraryData, role: string, displayName: string) {
  const candidates = (library.people || []).filter((person) => {
    if (isPlaceholderPerson(person)) {
      return false;
    }
    if (role === "orchestra") {
      return (person.roles || []).some((personRole) => ["orchestra", "ensemble", "chorus"].includes(personRole));
    }
    if (role === "ensemble") {
      return (person.roles || []).some((personRole) => ["ensemble", "orchestra", "chorus"].includes(personRole));
    }
    if (role === "chorus") {
      return (person.roles || []).includes("chorus");
    }
    return true;
  });
  return candidates.find((person) => personMatchesName(person, displayName)) || null;
}

function canonicalCreditDisplayName(person: Person, role: string) {
  if (role === "orchestra" || role === "ensemble" || role === "chorus") {
    return compact(person.name || person.fullName || person.nameLatin);
  }
  return compact(person.name || person.fullName || person.nameLatin);
}

function buildPatchedCredit(library: LibraryData, credit: Recording["credits"][number]) {
  const matchedPerson = findPersonForCredit(library, credit.role, credit.displayName);
  if (!matchedPerson) {
    return {
      ...credit,
      personId: compact(credit.personId),
      displayName: compact(credit.displayName),
      label: compact(credit.label),
    };
  }
  return {
    ...credit,
    personId: matchedPerson.id,
    displayName: canonicalCreditDisplayName(matchedPerson, credit.role),
    label: compact(credit.label),
  };
}

function getRecordingWorkContext(library: LibraryData, recording: Recording) {
  const work = (library.works || []).find((item) => item.id === recording.workId) || null;
  const workGroups = (work?.groupIds || [])
    .map((groupId) => (library.workGroups || []).find((group) => group.id === groupId))
    .filter((group): group is LibraryData["workGroups"][number] => Boolean(group));
  return { work, workGroups };
}

export function backfillRecordingWorkTypeHints(library: LibraryData): LibraryData {
  return {
    ...library,
    recordings: (library.recordings || []).map((recording) => {
      const { work, workGroups } = getRecordingWorkContext(library, recording);
      return {
        ...recording,
        workTypeHint: resolveRecordingWorkTypeHintValue(recording.workTypeHint, work, workGroups),
      };
    }),
  };
}

export function repairRecordingFromLegacyParse(library: LibraryData, recording: Recording, parsed: ParsedLegacyRecording): Recording {
  const keptCredits = (recording.credits || []).filter((credit) => !isPlaceholderCredit(credit));
  const nextCredits = [...keptCredits];

  for (const parsedCredit of parsed.credits || []) {
    if (isPlaceholderValue(parsedCredit.displayName)) {
      continue;
    }
    const existingSameRole = nextCredits.find((credit) => credit.role === parsedCredit.role);
    if (existingSameRole) {
      continue;
    }
    nextCredits.push(
      buildPatchedCredit(library, {
        ...parsedCredit,
        personId: compact(parsedCredit.personId),
        displayName: compact(parsedCredit.displayName),
        label: compact(parsedCredit.label),
      }),
    );
  }

  const { work, workGroups } = getRecordingWorkContext(library, recording);

  return {
    ...recording,
    workTypeHint: resolveRecordingWorkTypeHintValue(recording.workTypeHint, work, workGroups),
    credits: nextCredits,
    performanceDateText: compact(parsed.performanceDateText) || recording.performanceDateText,
    venueText: compact(parsed.venueText) || recording.venueText,
    albumTitle: compact(parsed.albumTitle) || recording.albumTitle,
    label: compact(parsed.label) || recording.label,
    releaseDate: compact(parsed.releaseDate) || recording.releaseDate,
    links: (recording.links || []).length > 0 ? recording.links : parsed.links,
    images: (recording.images || []).length > 0 ? recording.images : parsed.images,
  };
}
