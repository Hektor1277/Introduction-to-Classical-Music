import type { Composer, Credit, LibraryData, Person, PersonRole, Recording } from "./schema.js";

type NamedEntity = {
  id: string;
  name: string;
  fullName?: string;
  nameLatin?: string;
  displayName?: string;
  displayFullName?: string;
  displayLatinName?: string;
  aliases?: string[];
  abbreviations?: string[];
  country?: string;
  birthYear?: number;
  deathYear?: number;
  summary?: string;
};

export type NormalizedDisplay = {
  primary: string;
  full: string;
  latin: string;
  aliases: string[];
  abbreviations: string[];
};

export type WebsiteDisplay = {
  heading: string;
  short: string;
  latin: string;
};

export type RecordingListEntryDisplay = {
  title: string;
  secondaryText: string;
  metaText: string;
  noteExcerpt: string;
};

export type LibraryDataIssueCategory =
  | "name-normalization"
  | "year-conflict"
  | "country-missing"
  | "abbreviation-missing"
  | "summary-missing";

export type LibraryDataIssue = {
  entityType: "composer" | "person" | "work" | "recording";
  entityId: string;
  category: LibraryDataIssueCategory;
  message: string;
};

const artistRoles: PersonRole[] = ["soloist", "singer", "instrumentalist"];
const groupRoles: PersonRole[] = ["ensemble", "chorus"];
const shortTitleDelimiter = " - ";
const secondaryDelimiter = " / ";
const metaDelimiter = " · ";

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function dedupe(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => compact(value ?? "")).filter(Boolean))];
}

function looksLikeChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function looksLikeAbbreviation(value: string) {
  return /^[A-Z0-9][A-Z0-9 .&/-]{1,11}$/.test(value.trim());
}

function derivePrimaryName(entity: NamedEntity) {
  const explicit = compact(entity.displayName);
  if (explicit) {
    return explicit;
  }
  const canonical = compact(entity.name);
  const aliases = dedupe([...(entity.aliases ?? [])]);
  const shorterChineseAlias =
    aliases.find((value) => looksLikeChineseText(value) && compact(value).length < canonical.length) ||
    aliases.find((value) => looksLikeChineseText(value) && compact(value) !== canonical);
  return compact(shorterChineseAlias || canonical);
}

function deriveChineseFullName(entity: NamedEntity, primary: string) {
  const explicit = compact(entity.displayFullName || entity.fullName || "");
  if (explicit) {
    return explicit;
  }

  const aliases = dedupe([...(entity.aliases ?? []), entity.name, entity.displayName]);
  const aliasMatch =
    aliases.find((value) => looksLikeChineseText(value) && compact(value).length > compact(primary).length && compact(value).includes(primary)) ||
    aliases.find((value) => looksLikeChineseText(value) && compact(value).length > compact(primary).length);

  return compact(aliasMatch || primary);
}

export function normalizeSearchText(value: string) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[·•・・,.;:'"`()（）\[\]\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value: string, maxLength: number) {
  const normalized = compact(value);
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}…` : normalized;
}

export function getDisplayData(entity: NamedEntity): NormalizedDisplay {
  const primary = derivePrimaryName(entity);
  const full = deriveChineseFullName(entity, primary);
  const latin = compact(entity.displayLatinName || entity.nameLatin);
  const abbreviations = dedupe([
    ...(entity.abbreviations ?? []),
    ...(entity.aliases ?? []).filter((value) => looksLikeAbbreviation(value)),
  ]);

  return {
    primary,
    full,
    latin,
    aliases: dedupe([...(entity.aliases ?? []), entity.name, entity.fullName, entity.nameLatin]),
    abbreviations,
  };
}

export function getEntitySearchTexts(entity: NamedEntity) {
  const display = getDisplayData(entity);
  const primaryText = display.full || display.primary;
  const secondaryParts = dedupe([
    display.primary && display.primary !== primaryText ? display.primary : "",
    display.latin,
    ...(display.abbreviations ?? []),
  ]);
  return {
    primaryText,
    secondaryText: secondaryParts.join(secondaryDelimiter),
    matchTokens: dedupe([
      display.primary,
      display.full,
      display.latin,
      ...(display.aliases ?? []),
      ...(display.abbreviations ?? []),
      entity.country,
    ]),
    aliasTokens: dedupe([...(display.aliases ?? []), ...(display.abbreviations ?? [])]),
  };
}

export function getWebsiteDisplay(entity: NamedEntity): WebsiteDisplay {
  const display = getDisplayData(entity);
  const heading = display.full || display.primary;
  const short = display.primary !== heading ? display.primary : "";
  return {
    heading,
    short,
    latin: display.latin,
  };
}

function getPersonById(library: LibraryData, personId?: string) {
  if (!personId) {
    return undefined;
  }
  return library.people.find((person) => person.id === personId);
}

function displayForCredit(credit: Credit, library: LibraryData) {
  const person = getPersonById(library, credit.personId);
  if (!person) {
    const fallback = compact(credit.displayName);
    return {
      primary: fallback,
      secondary: fallback,
      shortLabel: fallback,
    };
  }

  const display = getDisplayData(person);
  const shortLabel =
    credit.role === "orchestra" || credit.role === "ensemble" || credit.role === "chorus"
      ? display.abbreviations[0] || display.primary
      : display.primary;

  return {
    primary: display.primary,
    secondary: display.latin || display.full || display.primary,
    shortLabel,
  };
}

function creditGroup(credits: Credit[], roles: PersonRole[]) {
  return credits.filter((credit) => roles.includes(credit.role));
}

export function buildRecordingListEntry(recording: Recording, library: LibraryData): RecordingListEntryDisplay {
  const conductors = creditGroup(recording.credits, ["conductor"]).map((credit) => displayForCredit(credit, library));
  const orchestras = creditGroup(recording.credits, ["orchestra"]).map((credit) => displayForCredit(credit, library));
  const artists = creditGroup(recording.credits, artistRoles).map((credit) => displayForCredit(credit, library));
  const groups = creditGroup(recording.credits, groupRoles).map((credit) => displayForCredit(credit, library));

  const titleParts = dedupe([
    ...conductors.map((item) => item.shortLabel),
    ...orchestras.map((item) => item.shortLabel),
    ...artists.map((item) => item.shortLabel),
    ...groups.map((item) => item.shortLabel),
  ]);

  const secondaryParts = dedupe([
    ...conductors.map((item) => item.secondary),
    ...orchestras.map((item) => item.secondary),
    ...artists.map((item) => item.secondary),
    ...groups.map((item) => item.secondary),
  ]);

  const metaText = dedupe([recording.performanceDateText, recording.venueText]).join(metaDelimiter);
  const fallbackPrimary = compact(recording.title);

  return {
    title: titleParts.join(shortTitleDelimiter) || fallbackPrimary,
    secondaryText: secondaryParts.join(secondaryDelimiter),
    metaText,
    noteExcerpt: excerpt(recording.notes || "", 120),
  };
}

export function collectLibraryDataIssues(library: LibraryData): LibraryDataIssue[] {
  const issues: LibraryDataIssue[] = [];

  for (const composer of library.composers) {
    const display = getDisplayData(composer);
    const composerCompat = composer as Composer;
    if (!composerCompat.displayFullName || !composerCompat.displayLatinName) {
      issues.push({
        entityType: "composer",
        entityId: composer.id,
        category: "name-normalization",
        message: `作曲家 ${display.primary} 缺少规范全名或外文名。`,
      });
    }
    if (composer.name && composerCompat.fullName && composer.name === composerCompat.fullName && composer.name.length <= 4) {
      issues.push({
        entityType: "composer",
        entityId: composer.id,
        category: "name-normalization",
        message: `作曲家 ${display.primary} 的中文名与中文全名未区分。`,
      });
    }
    if (!composer.country) {
      issues.push({
        entityType: "composer",
        entityId: composer.id,
        category: "country-missing",
        message: `作曲家 ${display.primary} 缺少国家信息。`,
      });
    }
  }

  for (const person of library.people) {
    const display = getDisplayData(person);
    const personCompat = person as Person;
    if (!personCompat.displayFullName || !personCompat.displayLatinName) {
      issues.push({
        entityType: "person",
        entityId: person.id,
        category: "name-normalization",
        message: `人物 ${display.primary} 缺少规范全名或外文名。`,
      });
    }
    if (person.name && personCompat.fullName && person.name === personCompat.fullName && person.name.length <= 4) {
      issues.push({
        entityType: "person",
        entityId: person.id,
        category: "name-normalization",
        message: `人物 ${display.primary} 的中文名与中文全名未区分。`,
      });
    }
    if (person.birthYear && person.deathYear && person.birthYear > person.deathYear) {
      issues.push({
        entityType: "person",
        entityId: person.id,
        category: "year-conflict",
        message: `人物 ${display.primary} 的生卒年份冲突。`,
      });
    }
    if (person.roles.some((role) => role === "orchestra" || role === "ensemble" || role === "chorus") && (personCompat.abbreviations?.length ?? 0) === 0) {
      issues.push({
        entityType: "person",
        entityId: person.id,
        category: "abbreviation-missing",
        message: `团体 ${display.primary} 缺少简称或缩写。`,
      });
    }
    if (!person.summary) {
      issues.push({
        entityType: "person",
        entityId: person.id,
        category: "summary-missing",
        message: `人物 ${display.primary} 缺少简介。`,
      });
    }
  }

  return issues;
}

