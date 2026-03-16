import { getDisplayData, getWebsiteDisplay } from "../../shared/src/display.js";
import type { Composer, Person } from "../../shared/src/schema.js";

export type DirectorySortMode = "surname" | "birth" | "country";

export type DirectoryEntry = {
  id: string;
  href: string;
  shortName: string;
  fullName: string;
  highlight: string;
  nameLatin: string;
  originalName: string;
  summary: string;
  representativeWorks: string[];
  birthYear?: number;
  deathYear?: number;
  countryLabel: string;
  countrySortKey: string;
  surnameSortKey: string;
  quickKeys: {
    surname: string;
    birth: string;
    country: string;
  };
  avatarLabel: string;
  avatarSrc?: string;
};

export type DirectoryDisplayEntry = DirectoryEntry & {
  summaryExcerpt: string;
  representativeWorksLabel: string;
};

export type DirectorySection = {
  id: string;
  title: string;
  items: DirectoryEntry[];
};

export type DirectorySectionSet = {
  rail: string[];
  sections: DirectorySection[];
};

const particles = new Set(["van", "von", "de", "del", "da", "di", "du", "la", "le"]);
const countryMappings = [
  ["Austria", ["Austria", "Austrian", "奥地利"]],
  ["Germany", ["Germany", "German", "德国"]],
  ["France", ["France", "French", "法国"]],
  ["Finland", ["Finland", "Finnish", "芬兰"]],
  ["Russia", ["Russia", "Russian", "俄罗斯"]],
  ["Hungary", ["Hungary", "Hungarian", "匈牙利"]],
  ["Czech Republic", ["Czech Republic", "Czech", "捷克"]],
  ["Netherlands", ["Netherlands", "Dutch", "荷兰"]],
  ["Italy", ["Italy", "Italian", "意大利"]],
  ["Sweden", ["Sweden", "Swedish", "瑞典"]],
  ["United Kingdom", ["United Kingdom", "British", "英国"]],
  ["United States", ["United States", "American", "美国"]],
  ["China", ["China", "Chinese", "中国"]],
  ["Japan", ["Japan", "Japanese", "日本"]],
  ["Argentina", ["Argentina", "Argentine", "阿根廷"]],
  ["Israel", ["Israel", "Israeli", "以色列"]],
] as const;

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function extractLifeSpan(text: string, birthYear?: number, deathYear?: number) {
  if (birthYear || deathYear) {
    return { birthYear, deathYear };
  }

  const matched = text.match(/(1[6-9]\d{2}|20\d{2})[^\d]{0,16}(1[6-9]\d{2}|20\d{2})/);
  if (!matched) {
    return { birthYear, deathYear };
  }

  return {
    birthYear: Number(matched[1]),
    deathYear: Number(matched[2]),
  };
}

function extractCountry(country: string, summary: string) {
  if (country.trim()) {
    return {
      label: country.trim(),
      sortKey: country.trim(),
    };
  }

  for (const [label, tokens] of countryMappings) {
    if (tokens.some((token) => summary.includes(token))) {
      return {
        label,
        sortKey: label,
      };
    }
  }

  return {
    label: "Unknown",
    sortKey: "ZZZ Unknown",
  };
}

function extractLatinAndOriginal(nameLatin: string) {
  const [latin = "", original = ""] = nameLatin.split("|").map((value) => value.trim());
  return { latin, original };
}

function extractFullName(shortName: string, aliases: string[], summary: string, explicitFullName = "") {
  if (explicitFullName.trim()) {
    return explicitFullName.trim();
  }

  const alias = aliases.find((value) => value.includes(shortName)) ?? aliases[0];
  if (alias) {
    return alias.trim();
  }

  const firstSentence = summary
    .split(/[。!?]/)
    .map((value) => value.trim())
    .find(Boolean);

  if (firstSentence && firstSentence.includes(shortName)) {
    return firstSentence;
  }

  return shortName;
}

function extractHighlight(fullName: string, shortName: string, latinName: string) {
  if (fullName.includes(shortName)) {
    return shortName;
  }

  const tokens = latinName.split(/\s+/).filter(Boolean);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index].replace(/[.,]/g, "");
    if (!particles.has(token.toLowerCase())) {
      return token;
    }
  }

  return shortName;
}

function createAvatarLabel(fullName: string, shortName: string) {
  const latinWords = fullName.split(/\s+/).filter((word) => /[A-Za-z]/.test(word));
  if (latinWords.length >= 2) {
    return `${latinWords[0][0]}${latinWords[latinWords.length - 1][0]}`.toUpperCase();
  }

  return shortName.replace(/[·・\s]/g, "").slice(0, 2).toUpperCase();
}

function createSurnameSortKey(latinName: string, fallbackName: string) {
  const tokens = latinName.split(/\s+/).filter(Boolean);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index].replace(/[.,]/g, "");
    if (!particles.has(token.toLowerCase())) {
      return token;
    }
  }

  return fallbackName;
}

function createBirthKey(birthYear?: number) {
  if (!birthYear) {
    return "Unknown";
  }

  const decade = Math.floor(birthYear / 10) * 10;
  return `${decade}s`;
}

function clampText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}…` : normalized;
}

export function createDirectoryDisplayEntry(entry: DirectoryEntry): DirectoryDisplayEntry {
  const representativeWorks = entry.representativeWorks.slice(0, 3);
  return {
    ...entry,
    representativeWorks,
    summaryExcerpt: clampText(entry.summary, 60),
    representativeWorksLabel: representativeWorks.join(" / "),
  };
}

type DirectorySource = Pick<
  Person,
  | "id"
  | "slug"
  | "name"
  | "fullName"
  | "nameLatin"
  | "displayName"
  | "displayFullName"
  | "displayLatinName"
  | "aliases"
  | "abbreviations"
  | "summary"
  | "birthYear"
  | "deathYear"
  | "country"
  | "avatarSrc"
> &
  Pick<Composer, "id" | "slug" | "name" | "fullName" | "nameLatin" | "displayName" | "displayFullName" | "displayLatinName" | "aliases" | "abbreviations" | "summary" | "birthYear" | "deathYear" | "country" | "avatarSrc">;

function buildDirectoryEntry(
  entity: DirectorySource,
  options: {
    href: string;
    representativeWorks: string[];
  },
): DirectoryEntry {
  const display = getDisplayData(entity);
  const websiteDisplay = getWebsiteDisplay(entity);
  const { latin, original } = extractLatinAndOriginal(display.latin);
  const fullName = extractFullName(websiteDisplay.heading, entity.aliases ?? [], entity.summary ?? "", websiteDisplay.heading);
  const highlight = extractHighlight(fullName, websiteDisplay.short || display.primary, latin || display.latin || "");
  const { birthYear, deathYear } = extractLifeSpan(entity.summary ?? "", entity.birthYear, entity.deathYear);
  const country = extractCountry(entity.country ?? "", entity.summary ?? "");
  const surnameSortKey = createSurnameSortKey(latin || display.latin || "", websiteDisplay.heading);

  return {
    id: entity.id,
    href: options.href,
    shortName: websiteDisplay.heading,
    fullName: websiteDisplay.short,
    highlight,
    nameLatin: latin || display.latin || "",
    originalName: original,
    summary: entity.summary ?? "",
    representativeWorks: dedupe(options.representativeWorks).slice(0, 4),
    birthYear,
    deathYear,
    countryLabel: country.label,
    countrySortKey: country.sortKey,
    surnameSortKey,
    quickKeys: {
      surname: (surnameSortKey.charAt(0) || "#").toUpperCase(),
      birth: createBirthKey(birthYear),
      country: (country.sortKey.charAt(0) || "#").toUpperCase(),
    },
    avatarLabel: createAvatarLabel(fullName, websiteDisplay.short || websiteDisplay.heading),
    avatarSrc: entity.avatarSrc?.trim() || undefined,
  };
}

export function buildPersonDirectoryEntry(
  person: Pick<
    Person,
    | "id"
    | "slug"
    | "name"
    | "fullName"
    | "nameLatin"
    | "displayName"
    | "displayFullName"
    | "displayLatinName"
    | "aliases"
    | "abbreviations"
    | "summary"
    | "birthYear"
    | "deathYear"
    | "country"
    | "avatarSrc"
  >,
  options: {
    href: string;
    representativeWorks: string[];
  },
): DirectoryEntry {
  return buildDirectoryEntry(person, options);
}

export function buildComposerDirectoryEntry(
  composer: Pick<
    Composer,
    | "id"
    | "slug"
    | "name"
    | "fullName"
    | "nameLatin"
    | "displayName"
    | "displayFullName"
    | "displayLatinName"
    | "aliases"
    | "abbreviations"
    | "summary"
    | "birthYear"
    | "deathYear"
    | "country"
    | "avatarSrc"
  >,
  options: {
    href: string;
    representativeWorks: string[];
  },
): DirectoryEntry {
  return buildDirectoryEntry(composer, options);
}

export function buildDirectorySections(entries: DirectoryEntry[], mode: DirectorySortMode): DirectorySectionSet {
  const sortedEntries = [...entries].sort((left, right) => {
    if (mode === "surname") {
      return left.surnameSortKey.localeCompare(right.surnameSortKey, "en");
    }
    if (mode === "birth") {
      return (left.birthYear ?? Number.MAX_SAFE_INTEGER) - (right.birthYear ?? Number.MAX_SAFE_INTEGER);
    }

    return (
      left.countrySortKey.localeCompare(right.countrySortKey, "en") ||
      left.surnameSortKey.localeCompare(right.surnameSortKey, "en")
    );
  });

  const grouped = new Map<string, DirectorySection>();
  for (const entry of sortedEntries) {
    const sectionId =
      mode === "surname"
        ? entry.quickKeys.surname
        : mode === "birth"
          ? entry.quickKeys.birth
          : entry.quickKeys.country;

    if (!grouped.has(sectionId)) {
      grouped.set(sectionId, {
        id: sectionId,
        title: mode === "country" ? entry.countryLabel : sectionId,
        items: [],
      });
    }

    grouped.get(sectionId)?.items.push(entry);
  }

  const sections = [...grouped.values()];
  return {
    rail: sections.map((section) => section.id),
    sections,
  };
}


