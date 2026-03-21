import { parseLegacyRecordingHtml } from "./legacy-parser.js";
import type { LibraryData, Person, Recording } from "../../shared/src/schema.js";
import { resolveRecordingWorkTypeHintValue } from "../../shared/src/recording-rules.js";
import { buildRecordingDisplayTitle } from "../../shared/src/display.js";

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

function canonicalizeCreditRole(person: Person | null, role: Recording["credits"][number]["role"]) {
  if (!person) {
    return role;
  }
  if (role !== "ensemble" && role !== "orchestra" && role !== "chorus") {
    return role;
  }
  const roles = new Set(person.roles || []);
  if (roles.has("orchestra")) {
    return "orchestra";
  }
  if (roles.has("chorus")) {
    return "chorus";
  }
  if (roles.has("ensemble")) {
    return "ensemble";
  }
  return role;
}

function dedupeCredits(credits: Recording["credits"]) {
  const seen = new Set<string>();
  const nextCredits: Recording["credits"] = [];
  for (const credit of credits) {
    const key = [compact(credit.role), compact(credit.personId), compact(credit.displayName)].join("::");
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    nextCredits.push(credit);
  }
  return nextCredits;
}

export function normalizeRecordingCredits(library: LibraryData, credits: Recording["credits"]) {
  const normalizedCredits = credits.map((credit) => {
    const person = compact(credit.personId) ? (library.people || []).find((item) => item.id === compact(credit.personId)) || null : null;
    return {
      ...credit,
      role: canonicalizeCreditRole(person, credit.role),
      personId: compact(credit.personId),
      displayName: compact(credit.displayName),
      label: compact(credit.label),
    };
  });
  return dedupeCredits(normalizedCredits);
}

export function normalizeRecordingMetadata(recording: Pick<Recording, "performanceDateText" | "venueText">) {
  const performanceDateText = compact(recording.performanceDateText);
  const venueText = compact(recording.venueText);
  if (venueText || !performanceDateText.includes(" / ")) {
    return {
      performanceDateText,
      venueText,
    };
  }
  const [nextPerformanceDateText, ...restVenueParts] = performanceDateText.split(" / ");
  return {
    performanceDateText: compact(nextPerformanceDateText),
    venueText: compact(restVenueParts.join(" / ")),
  };
}

export function rebuildRecordingDerivedFields(library: LibraryData, recording: Recording): Recording {
  const { work, workGroups } = getRecordingWorkContext(library, recording);
  const metadata = normalizeRecordingMetadata(recording);
  const credits = normalizeRecordingCredits(library, recording.credits || []);
  const nextRecording = {
    ...recording,
    credits,
    ...metadata,
    workTypeHint: resolveRecordingWorkTypeHintValue(recording.workTypeHint, work, workGroups),
  };
  return {
    ...nextRecording,
    title: buildRecordingDisplayTitle(nextRecording, library) || compact(recording.title),
  };
}

export function backfillRecordingWorkTypeHints(library: LibraryData): LibraryData {
  return {
    ...library,
    recordings: (library.recordings || []).map((recording) => rebuildRecordingDerivedFields(library, recording)),
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

  return rebuildRecordingDerivedFields(library, {
    ...recording,
    credits: nextCredits,
    performanceDateText:
      compact(parsed.performanceDateText) || compact(recording.performanceDateText) || compact(recording.venueText),
    venueText: compact(parsed.venueText) || recording.venueText,
    albumTitle: compact(parsed.albumTitle) || recording.albumTitle,
    label: compact(parsed.label) || recording.label,
    releaseDate: compact(parsed.releaseDate) || recording.releaseDate,
    links: (recording.links || []).length > 0 ? recording.links : parsed.links,
    images: (recording.images || []).length > 0 ? recording.images : parsed.images,
  });
}
