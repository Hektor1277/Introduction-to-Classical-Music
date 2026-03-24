import { promises as fs } from "node:fs";

import { loadLibraryFromDisk } from "../packages/data-core/src/library-store.js";
import {
  getOrchestraReferenceDefaultPath,
  getPersonReferenceDefaultPath,
  parseOrchestraReferenceText,
  parsePersonAliasReferenceText,
  type OrchestraReferenceEntry,
  type PersonReferenceEntry,
} from "../packages/data-core/src/reference-registry.js";
import type { Composer, Person } from "../packages/shared/src/schema.js";

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

function buildOverlapKeySet(values: string[]) {
  return new Set(values.map((value) => normalizeLookupKey(value)).filter(Boolean));
}

function entriesOverlap(leftValues: string[], rightValues: string[]) {
  const leftKeys = buildOverlapKeySet(leftValues);
  for (const key of buildOverlapKeySet(rightValues)) {
    if (leftKeys.has(key)) {
      return true;
    }
  }
  return false;
}

function filterStrongIdentityValues(values: string[]) {
  return values.filter((value) => !looksLikeAbbreviation(value));
}

function orchestraEntriesMatch(left: OrchestraReferenceEntry, right: OrchestraReferenceEntry) {
  const samePreferred = normalizeLookupKey(left.preferredValue) && normalizeLookupKey(left.preferredValue) === normalizeLookupKey(right.preferredValue);
  const sameCanonicalLatin = normalizeLookupKey(left.canonicalLatin) && normalizeLookupKey(left.canonicalLatin) === normalizeLookupKey(right.canonicalLatin);
  return samePreferred || sameCanonicalLatin || entriesOverlap(filterStrongIdentityValues(left.values), filterStrongIdentityValues(right.values));
}

function mergeValueLists(...valueGroups: string[][]) {
  return dedupeValues(valueGroups.flat());
}

function sortChineseValues(values: string[], preferred: string) {
  return dedupeValues([
    preferred,
    ...values.filter((value) => value !== preferred),
  ]).sort((left, right) => {
    if (left === preferred) return -1;
    if (right === preferred) return 1;
    return left.localeCompare(right, "zh-Hans-CN");
  });
}

function sortLatinValues(values: string[], preferred: string) {
  return dedupeValues([
    preferred,
    ...values.filter((value) => value !== preferred),
  ]).sort((left, right) => {
    if (left === preferred) return -1;
    if (right === preferred) return 1;
    return left.localeCompare(right, "en");
  });
}

function deriveOrchestraValues(person: Person) {
  const aliases = dedupeValues(person.aliases || []);
  const abbreviations = aliases.filter((value) => looksLikeAbbreviation(value));
  const chineseValues = dedupeValues([person.name, ...aliases.filter((value) => looksLikeChineseText(value))]);
  const latinValues = dedupeValues([person.nameLatin, ...aliases.filter((value) => !looksLikeChineseText(value) && !looksLikeAbbreviation(value))]);
  return {
    abbreviations,
    chineseValues,
    latinValues,
  };
}

function determinePersonSection(entity: Composer | Person, entityType: "composer" | "person") {
  if (entityType === "composer") {
    return "composer";
  }
  const roles = new Set((entity as Person).roles || []);
  if (roles.has("conductor")) {
    return "conductor";
  }
  if (roles.has("orchestra") || roles.has("ensemble") || roles.has("chorus")) {
    return "ensemble";
  }
  if (roles.has("soloist") || roles.has("instrumentalist") || roles.has("singer")) {
    return "soloist";
  }
  return "global";
}

function derivePersonValues(entity: Composer | Person) {
  const aliases = dedupeValues(entity.aliases || []);
  const chineseValues = dedupeValues([entity.name, ...aliases.filter((value) => looksLikeChineseText(value))]);
  const latinValues = dedupeValues([entity.nameLatin, ...aliases.filter((value) => !looksLikeChineseText(value))]);
  return {
    chineseValues,
    latinValues,
  };
}

function mergeOrchestraEntries(primary: OrchestraReferenceEntry, secondary: OrchestraReferenceEntry): OrchestraReferenceEntry {
  const abbreviations = dedupeValues([...(primary.abbreviations || []), ...(secondary.abbreviations || [])]).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const preferredValue = primary.preferredValue || secondary.preferredValue;
  const canonicalLatin = primary.canonicalLatin || secondary.canonicalLatin;
  const chineseValues = sortChineseValues(mergeValueLists(primary.chineseValues, secondary.chineseValues), preferredValue);
  const latinValues = sortLatinValues(mergeValueLists(primary.latinValues, secondary.latinValues), canonicalLatin);
  return {
    preferredValue,
    canonicalLatin,
    values: dedupeValues([
      ...(abbreviations.length ? abbreviations : []),
      ...chineseValues,
      ...latinValues,
    ]),
    chineseValues,
    latinValues,
    abbreviations,
  };
}

function mergePersonEntries(primary: PersonReferenceEntry, secondary: PersonReferenceEntry): PersonReferenceEntry {
  const preferredValue = primary.preferredValue || secondary.preferredValue;
  const canonicalLatin = primary.canonicalLatin || secondary.canonicalLatin;
  const chineseValues = sortChineseValues(mergeValueLists(primary.chineseValues, secondary.chineseValues), preferredValue);
  const latinValues = sortLatinValues(mergeValueLists(primary.latinValues, secondary.latinValues), canonicalLatin);
  return {
    role: primary.role,
    preferredValue,
    canonicalLatin,
    values: dedupeValues([...chineseValues, ...latinValues]),
    chineseValues,
    latinValues,
  };
}

function formatOrchestraEntry(entry: OrchestraReferenceEntry) {
  return dedupeValues([
    ...entry.abbreviations,
    ...sortChineseValues(entry.chineseValues, entry.preferredValue),
    ...sortLatinValues(entry.latinValues, entry.canonicalLatin),
  ]).join(" = ");
}

function formatPersonEntry(entry: PersonReferenceEntry) {
  return dedupeValues([
    ...sortChineseValues(entry.chineseValues, entry.preferredValue),
    ...sortLatinValues(entry.latinValues, entry.canonicalLatin),
  ]).join(" = ");
}

function buildOrchestraReferenceText(entries: OrchestraReferenceEntry[]) {
  const header = [
    "# 乐团名称对照表",
    "# 用法：",
    "# 1. 每行一个映射组，使用 = 连接缩写、中文译名、原文主名、原文别名等。",
    "# 2. 系统会双向读取：输入缩写、中文译名、原文别名，都可以回查规范名称。",
    "# 3. 推荐顺序：缩写 = 中文常用名 = 中文别名 = Latin/原文主名 = Latin/原文别名。",
    "",
  ];
  const body = [...entries]
    .sort((left, right) => left.preferredValue.localeCompare(right.preferredValue, "zh-Hans-CN"))
    .map(formatOrchestraEntry);
  return `${[...header, ...body].join("\n")}\n`;
}

function buildPersonReferenceText(entries: PersonReferenceEntry[]) {
  const sectionOrder = ["global", "composer", "conductor", "soloist", "pianist", "violinist", "soprano", "tenor", "baritone", "ensemble"];
  const header = [
    "# 人物姓名映射文档",
    "# 用法：",
    "# 1. 使用 #section-name 定义角色分组，例如 #global、#conductor、#soloist、#composer、#pianist。",
    "# 2. 每行一个映射组，使用 = 连接不同语言、不同译名、不同写法。",
    "# 3. 建议按“中文常用名 = 中文别名 = Latin/原文短名 = Latin/原文全名”填写。",
    "# 4. 系统会双向读取：输入中文可展开 Latin/原文，输入 Latin/原文也可回查中文或缩写。",
    "# 5. #global 中的映射适用于所有角色；角色分组中的映射会在对应角色里优先使用。",
    "",
  ];
  const groups = new Map<string, PersonReferenceEntry[]>();
  for (const role of sectionOrder) {
    groups.set(role, []);
  }
  for (const entry of entries) {
    const role = groups.has(entry.role) ? entry.role : "global";
    groups.get(role)?.push(entry);
  }

  const lines = [...header];
  for (const role of sectionOrder) {
    lines.push(`#${role}`);
    const roleEntries = [...(groups.get(role) || [])].sort((left, right) => left.preferredValue.localeCompare(right.preferredValue, "zh-Hans-CN"));
    for (const entry of roleEntries) {
      lines.push(formatPersonEntry(entry));
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

async function main() {
  const library = await loadLibraryFromDisk();
  const orchestraPath = getOrchestraReferenceDefaultPath();
  const personPath = getPersonReferenceDefaultPath();
  const [existingOrchestraSource, existingPersonSource] = await Promise.all([
    fs.readFile(orchestraPath, "utf8").catch(() => ""),
    fs.readFile(personPath, "utf8").catch(() => ""),
  ]);

  const existingOrchestraEntries = parseOrchestraReferenceText(existingOrchestraSource);
  const usedExistingOrchestra = new Set<number>();
  const orchestraEntries: OrchestraReferenceEntry[] = [];
  for (const person of library.people.filter((item) => item.roles.some((role) => ["orchestra", "ensemble", "chorus"].includes(role)))) {
    const derived = deriveOrchestraValues(person);
    const entry: OrchestraReferenceEntry = {
      preferredValue: derived.chineseValues[0] || derived.latinValues[0] || person.name,
      canonicalLatin: derived.latinValues[0] || "",
      values: dedupeValues([...derived.abbreviations, ...derived.chineseValues, ...derived.latinValues]),
      chineseValues: derived.chineseValues,
      latinValues: derived.latinValues,
      abbreviations: derived.abbreviations,
    };
    const matchedIndex = existingOrchestraEntries.findIndex(
      (candidate, index) => !usedExistingOrchestra.has(index) && orchestraEntriesMatch(candidate, entry),
    );
    if (matchedIndex >= 0) {
      usedExistingOrchestra.add(matchedIndex);
      orchestraEntries.push(entry);
      continue;
    }
    orchestraEntries.push(entry);
  }
  existingOrchestraEntries.forEach((entry, index) => {
    if (!usedExistingOrchestra.has(index)) {
      orchestraEntries.push(entry);
    }
  });

  const existingPersonEntries = parsePersonAliasReferenceText(existingPersonSource);
  const usedExistingPeople = new Set<number>();
  const personEntries: PersonReferenceEntry[] = [];
  const derivedPeople: Array<{ role: string; values: { chineseValues: string[]; latinValues: string[] } }> = [
    ...library.composers.map((composer) => ({
      role: determinePersonSection(composer, "composer"),
      values: derivePersonValues(composer),
    })),
    ...library.people.map((person) => ({
      role: determinePersonSection(person, "person"),
      values: derivePersonValues(person),
    })),
  ];
  for (const derivedPerson of derivedPeople) {
    const entry: PersonReferenceEntry = {
      role: derivedPerson.role,
      preferredValue: derivedPerson.values.chineseValues[0] || derivedPerson.values.latinValues[0] || "",
      canonicalLatin: derivedPerson.values.latinValues[0] || "",
      values: dedupeValues([...derivedPerson.values.chineseValues, ...derivedPerson.values.latinValues]),
      chineseValues: derivedPerson.values.chineseValues,
      latinValues: derivedPerson.values.latinValues,
    };
    const matchedIndex = existingPersonEntries.findIndex(
      (candidate, index) => !usedExistingPeople.has(index) && candidate.role === entry.role && entriesOverlap(candidate.values, entry.values),
    );
    if (matchedIndex >= 0) {
      usedExistingPeople.add(matchedIndex);
      personEntries.push(mergePersonEntries(entry, existingPersonEntries[matchedIndex]));
      continue;
    }
    personEntries.push(entry);
  }
  existingPersonEntries.forEach((entry, index) => {
    if (!usedExistingPeople.has(index)) {
      personEntries.push(entry);
    }
  });

  await Promise.all([
    fs.writeFile(orchestraPath, buildOrchestraReferenceText(orchestraEntries), "utf8"),
    fs.writeFile(personPath, buildPersonReferenceText(personEntries), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        orchestraEntries: orchestraEntries.length,
        personEntries: personEntries.length,
        orchestraPath,
        personPath,
      },
      null,
      2,
    ),
  );
}

await main();
