import type { Credit, LibraryData } from "../../shared/src/schema.js";
import { ensurePeopleForCredits, findPersonForCredit } from "./person-cleanup.js";
import { rebuildRecordingDerivedFields } from "./recording-repair.js";

export type ManualRecordingBackfillEntry = {
  recordingId: string;
  credits?: Array<Pick<Credit, "role" | "displayName"> & Partial<Pick<Credit, "label" | "personId">>>;
};

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeManualCredit(credit: Pick<Credit, "role" | "displayName"> & Partial<Pick<Credit, "label" | "personId">>): Credit {
  return {
    role: credit.role,
    displayName: compact(credit.displayName),
    label: compact(credit.label),
    personId: compact(credit.personId),
  };
}

function mergeCredits(existing: Credit[], additions: Credit[]) {
  const seen = new Set(existing.map((credit) => `${compact(credit.role)}::${compact(credit.personId)}::${compact(credit.displayName)}`));
  const merged = [...existing];
  for (const credit of additions) {
    const key = `${compact(credit.role)}::${compact(credit.personId)}::${compact(credit.displayName)}`;
    if (!compact(credit.displayName) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(credit);
  }
  return merged;
}

export function applyManualRecordingBackfills(library: LibraryData, entries: ManualRecordingBackfillEntry[]) {
  let nextLibrary = library;
  let changed = false;

  for (const entry of entries || []) {
    const recordingIndex = (nextLibrary.recordings || []).findIndex((recording) => recording.id === entry.recordingId);
    if (recordingIndex < 0) {
      continue;
    }

    const normalizedCredits = (entry.credits || []).map(normalizeManualCredit).filter((credit) => compact(credit.displayName));
    if (normalizedCredits.length === 0) {
      continue;
    }

    nextLibrary = ensurePeopleForCredits(nextLibrary, normalizedCredits);

    const resolvedCredits = normalizedCredits.map((credit) => {
      const matchedPerson = compact(credit.personId)
        ? (nextLibrary.people || []).find((person) => person.id === compact(credit.personId)) || null
        : findPersonForCredit(nextLibrary, credit.role, credit.displayName);
      return matchedPerson
        ? {
            ...credit,
            personId: matchedPerson.id,
            displayName: compact(matchedPerson.name || matchedPerson.nameLatin || credit.displayName),
          }
        : credit;
    });

    const nextRecordings = [...nextLibrary.recordings];
    const currentRecording = nextRecordings[recordingIndex];
    const mergedCredits = mergeCredits(currentRecording.credits || [], resolvedCredits);
    const rebuiltRecording = rebuildRecordingDerivedFields(nextLibrary, {
      ...currentRecording,
      credits: mergedCredits,
    });
    nextRecordings[recordingIndex] = rebuiltRecording;
    nextLibrary = {
      ...nextLibrary,
      recordings: nextRecordings,
    };
    changed = true;
  }

  return changed ? nextLibrary : library;
}
