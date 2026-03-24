import { promises as fs } from "node:fs";
import path from "node:path";

export type OrchestraReferenceEntry = {
  preferredValue: string;
  canonicalLatin: string;
  values: string[];
  chineseValues: string[];
  latinValues: string[];
  abbreviations: string[];
};

export type PersonReferenceEntry = {
  role: string;
  preferredValue: string;
  canonicalLatin: string;
  values: string[];
  chineseValues: string[];
  latinValues: string[];
};

export type ReferenceRegistry = {
  orchestraEntries: OrchestraReferenceEntry[];
  personEntries: PersonReferenceEntry[];
  orchestraLookup: Map<string, OrchestraReferenceEntry[]>;
  personLookup: Map<string, PersonReferenceEntry[]>;
};

type BuildReferenceRegistryOptions = {
  orchestraSourceText?: string;
  personSourceText?: string;
  orchestraEntries?: OrchestraReferenceEntry[];
  personEntries?: PersonReferenceEntry[];
};

type LoadReferenceRegistryOptions = {
  orchestraPath?: string;
  personPath?: string;
};

const orchestraReferenceDefaultPath = path.join(process.cwd(), "materials", "references", "Orchestra Abbreviation Comparison.txt");
const personReferenceDefaultPath = path.join(process.cwd(), "materials", "references", "person-name-aliases.txt");

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function dedupeValues(values: Array<unknown>) {
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

function looksLikeChineseText(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function looksLikeAbbreviation(value: string) {
  return /^[A-Z0-9][A-Z0-9 .&/-]{1,15}$/.test(compact(value));
}

function normalizeLookupKey(value: unknown) {
  return compact(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\u3400-\u9fff]+/gu, "");
}

function splitReferenceValues(line: string) {
  return dedupeValues(
    line
      .split("=")
      .map((item) => compact(item))
      .filter(Boolean),
  );
}

function selectCanonicalLatin(values: string[], strategy: "first" | "longest" = "first") {
  const latinCandidates = values.filter((value) => !looksLikeChineseText(value) && !looksLikeAbbreviation(value));
  if (latinCandidates.length === 0) {
    return values.find((value) => !looksLikeChineseText(value)) || "";
  }
  if (strategy === "longest") {
    return [...latinCandidates].sort((left, right) => right.length - left.length)[0] || "";
  }
  return latinCandidates[0] || "";
}

function buildOrchestraEntry(values: string[]): OrchestraReferenceEntry {
  const orderedValues = dedupeValues(values);
  const chineseValues = orderedValues.filter((value) => looksLikeChineseText(value));
  const abbreviations = orderedValues.filter((value) => looksLikeAbbreviation(value));
  const latinValues = orderedValues.filter((value) => !looksLikeChineseText(value) && !looksLikeAbbreviation(value));
  const canonicalLatin = selectCanonicalLatin(orderedValues, "first");
  return {
    preferredValue: chineseValues[0] || canonicalLatin || orderedValues[0] || "",
    canonicalLatin,
    values: orderedValues,
    chineseValues,
    latinValues,
    abbreviations,
  };
}

function buildPersonEntry(role: string, values: string[]): PersonReferenceEntry {
  const orderedValues = dedupeValues(values);
  const chineseValues = orderedValues.filter((value) => looksLikeChineseText(value));
  const latinValues = orderedValues.filter((value) => !looksLikeChineseText(value));
  const canonicalLatin = selectCanonicalLatin(orderedValues, "longest");
  return {
    role: compact(role).toLowerCase() || "global",
    preferredValue: chineseValues[0] || canonicalLatin || orderedValues[0] || "",
    canonicalLatin,
    values: orderedValues,
    chineseValues,
    latinValues,
  };
}

function appendLookupEntry<T>(lookup: Map<string, T[]>, key: string, entry: T) {
  const bucket = lookup.get(key) ?? [];
  if (!bucket.includes(entry)) {
    bucket.push(entry);
  }
  lookup.set(key, bucket);
}

export function parseOrchestraReferenceText(sourceText: string) {
  const entries: OrchestraReferenceEntry[] = [];
  for (const rawLine of String(sourceText ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const values = splitReferenceValues(line);
    if (values.length === 0) {
      continue;
    }
    entries.push(buildOrchestraEntry(values));
  }
  return entries;
}

export function parsePersonAliasReferenceText(sourceText: string) {
  const entries: PersonReferenceEntry[] = [];
  let currentRole = "global";
  for (const rawLine of String(sourceText ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("#")) {
      if (/^#[A-Za-z][\w-]*$/.test(line)) {
        currentRole = line.slice(1).toLowerCase();
      }
      continue;
    }
    const values = splitReferenceValues(line);
    if (values.length === 0) {
      continue;
    }
    entries.push(buildPersonEntry(currentRole, values));
  }
  return entries;
}

export function buildReferenceRegistry(options: BuildReferenceRegistryOptions = {}): ReferenceRegistry {
  const orchestraEntries = options.orchestraEntries ?? parseOrchestraReferenceText(options.orchestraSourceText || "");
  const personEntries = options.personEntries ?? parsePersonAliasReferenceText(options.personSourceText || "");
  const orchestraLookup = new Map<string, OrchestraReferenceEntry[]>();
  const personLookup = new Map<string, PersonReferenceEntry[]>();

  for (const entry of orchestraEntries) {
    for (const value of entry.values) {
      const key = normalizeLookupKey(value);
      if (!key) {
        continue;
      }
      appendLookupEntry(orchestraLookup, key, entry);
    }
  }

  for (const entry of personEntries) {
    for (const value of entry.values) {
      const key = normalizeLookupKey(value);
      if (!key) {
        continue;
      }
      appendLookupEntry(personLookup, key, entry);
    }
  }

  return {
    orchestraEntries,
    personEntries,
    orchestraLookup,
    personLookup,
  };
}

export function lookupOrchestraReference(registry: ReferenceRegistry, value: string) {
  const matches = registry.orchestraLookup.get(normalizeLookupKey(value)) ?? [];
  if (matches.length === 0) {
    return null;
  }
  const uniqueMatches = [...new Map(matches.map((entry) => [`${entry.preferredValue}::${entry.canonicalLatin}`, entry])).values()];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
}

export function lookupOrchestraReferences(registry: ReferenceRegistry, value: string) {
  return registry.orchestraLookup.get(normalizeLookupKey(value)) ?? [];
}

export function lookupPersonReference(registry: ReferenceRegistry, value: string, role?: string | string[]) {
  const entries = registry.personLookup.get(normalizeLookupKey(value)) ?? [];
  if (entries.length === 0) {
    return null;
  }

  const requestedRoles = dedupeValues(Array.isArray(role) ? role : role ? [role] : []).map((item) => item.toLowerCase());
  for (const requestedRole of requestedRoles) {
    const matched = entries.find((entry) => entry.role === requestedRole);
    if (matched) {
      return matched;
    }
  }

  const globalEntry = entries.find((entry) => entry.role === "global");
  if (globalEntry) {
    return globalEntry;
  }

  return entries[0] || null;
}

async function readOptionalTextFile(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function loadReferenceRegistry(options: LoadReferenceRegistryOptions = {}) {
  const [orchestraSourceText, personSourceText] = await Promise.all([
    readOptionalTextFile(options.orchestraPath || orchestraReferenceDefaultPath),
    readOptionalTextFile(options.personPath || personReferenceDefaultPath),
  ]);
  return buildReferenceRegistry({ orchestraSourceText, personSourceText });
}

export function getOrchestraReferenceDefaultPath() {
  return orchestraReferenceDefaultPath;
}

export function getPersonReferenceDefaultPath() {
  return personReferenceDefaultPath;
}
