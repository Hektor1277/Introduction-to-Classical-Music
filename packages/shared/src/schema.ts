import { z } from "zod";

export const personRoleValues = [
  "conductor",
  "soloist",
  "singer",
  "ensemble",
  "orchestra",
  "chorus",
  "instrumentalist",
  "other",
] as const;

export const linkPlatformValues = [
  "bilibili",
  "youtube",
  "netease",
  "apple-music",
  "amazon-music",
  "other",
] as const;

export const imageKindValues = ["cover", "artist", "performance", "other"] as const;
export const mediaSourceKindValues = [
  "wikipedia",
  "wikidata",
  "wikimedia-commons",
  "streaming",
  "official-site",
  "manual",
  "other",
] as const;

export const personRoleSchema = z.enum(personRoleValues);
export const linkPlatformSchema = z.enum(linkPlatformValues);
export const imageKindSchema = z.enum(imageKindValues);
export const mediaSourceKindSchema = z.enum(mediaSourceKindValues);

const textField = z.string().trim();
const optionalTextField = z.string().trim().default("");
const optionalMediaSourceKindField = z.union([mediaSourceKindSchema, z.literal("")]).default("");

function compact(value: unknown) {
  return String(value ?? "").trim();
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

function normalizeAliases(values: unknown) {
  return Array.isArray(values) ? uniqueStrings(values) : [];
}

function normalizeNamedEntityInput(raw: unknown) {
  const source = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const shortName = compact(source.displayName) || compact(source.name);
  const fullChineseName = compact(source.displayFullName) || compact(source.fullName) || compact(source.name);
  const nameLatin = compact(source.nameLatin) || compact(source.displayLatinName);

  return {
    ...source,
    name: fullChineseName || shortName,
    nameLatin,
    aliases: uniqueStrings([
      ...normalizeAliases(source.aliases),
      ...normalizeAliases(source.abbreviations),
      shortName && shortName !== fullChineseName ? shortName : "",
    ]),
  };
}

const imageAttributionFields = {
  imageSourceUrl: optionalTextField,
  imageSourceKind: optionalMediaSourceKindField,
  imageAttribution: optionalTextField,
  imageUpdatedAt: optionalTextField,
} as const;

const namedEntityFields = {
  id: textField.min(1),
  slug: textField.min(1),
  name: textField.min(1),
  nameLatin: optionalTextField,
  country: optionalTextField,
  avatarSrc: optionalTextField,
  birthYear: z.number().int().optional(),
  deathYear: z.number().int().optional(),
  aliases: z.array(textField).default([]),
  sortKey: textField.min(1),
  summary: optionalTextField,
  ...imageAttributionFields,
} as const;

const workGroupSchema = z.object({
  id: textField.min(1),
  composerId: textField.min(1),
  title: textField.min(1),
  slug: textField.min(1),
  path: z.array(textField.min(1)).min(1),
  sortKey: textField.min(1),
});

const imageSchema = z.object({
  src: textField.min(1),
  alt: optionalTextField.optional(),
  kind: imageKindSchema.optional(),
  sourceUrl: optionalTextField.optional(),
  sourceKind: optionalMediaSourceKindField.optional(),
  attribution: optionalTextField.optional(),
  updatedAt: optionalTextField.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  score: z.number().optional(),
});

const creditSchema = z.object({
  role: personRoleSchema,
  personId: optionalTextField.optional(),
  displayName: textField.min(1),
  label: optionalTextField.optional(),
});

const resourceLinkSchema = z.object({
  platform: linkPlatformSchema,
  url: z.url(),
  title: optionalTextField.optional(),
});

function normalizeInfoPanelInput(raw: unknown) {
  const source = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const collectionLinks = Array.isArray(source.collectionLinks)
    ? source.collectionLinks
    : compact(source.collectionUrl)
      ? [{ platform: "other", url: compact(source.collectionUrl), title: "" }]
      : [];
  return {
    ...source,
    collectionLinks,
  };
}

const infoPanelSchema = z.preprocess(
  normalizeInfoPanelInput,
  z.object({
    text: optionalTextField,
    articleId: optionalTextField,
    collectionLinks: z.array(resourceLinkSchema).default([]),
    collectionUrl: optionalTextField.optional(),
  }),
);

const namedEntityFieldsWithInfoPanel = {
  ...namedEntityFields,
  infoPanel: infoPanelSchema.default({ text: "", articleId: "", collectionLinks: [] }),
} as const;

const composerSchema = z.preprocess(normalizeNamedEntityInput, z.object(namedEntityFieldsWithInfoPanel));

const personSchema = z.preprocess(
  normalizeNamedEntityInput,
  z.object({
    ...namedEntityFieldsWithInfoPanel,
    roles: z.array(personRoleSchema).min(1),
  }),
);

const workSchema = z.object({
  id: textField.min(1),
  composerId: textField.min(1),
  groupIds: z.array(textField.min(1)).min(1),
  slug: textField.min(1),
  title: textField.min(1),
  titleLatin: optionalTextField,
  aliases: z.array(textField).default([]),
  catalogue: optionalTextField,
  summary: optionalTextField,
  infoPanel: infoPanelSchema.default({ text: "", articleId: "", collectionLinks: [] }),
  sortKey: textField.min(1),
  updatedAt: textField.min(1),
});

const recordingSchema = z.object({
  id: textField.min(1),
  workId: textField.min(1),
  slug: textField.min(1),
  title: textField.min(1),
  sortKey: textField.min(1),
  isPrimaryRecommendation: z.boolean().default(false),
  updatedAt: textField.min(1),
  images: z.array(imageSchema).default([]),
  credits: z.array(creditSchema).default([]),
  links: z.array(resourceLinkSchema).default([]),
  notes: optionalTextField,
  performanceDateText: optionalTextField,
  venueText: optionalTextField,
  albumTitle: optionalTextField,
  label: optionalTextField,
  releaseDate: optionalTextField,
  infoPanel: infoPanelSchema.default({ text: "", articleId: "", collectionLinks: [] }),
  legacyPath: optionalTextField.optional(),
});

export const librarySchema = z.object({
  composers: z.array(composerSchema),
  people: z.array(personSchema),
  workGroups: z.array(workGroupSchema),
  works: z.array(workSchema),
  recordings: z.array(recordingSchema),
});

type LegacyNamedEntityCompat = {
  fullName?: string;
  displayName?: string;
  displayFullName?: string;
  displayLatinName?: string;
  abbreviations?: string[];
};

export type Composer = z.infer<typeof composerSchema> & LegacyNamedEntityCompat;
export type Person = z.infer<typeof personSchema> & LegacyNamedEntityCompat;
export type WorkGroup = z.infer<typeof workGroupSchema>;
export type Work = z.infer<typeof workSchema>;
export type Credit = z.infer<typeof creditSchema>;
export type ResourceLink = z.infer<typeof resourceLinkSchema>;
export type RecordingImage = z.infer<typeof imageSchema>;
export type Recording = z.infer<typeof recordingSchema>;
export type InfoPanel = z.infer<typeof infoPanelSchema>;
export type LibraryData = z.infer<typeof librarySchema>;
export type PersonRole = z.infer<typeof personRoleSchema>;
export type MediaSourceKind = z.infer<typeof mediaSourceKindSchema>;

function ensureUniqueIds<T extends { id: string }>(label: string, collection: T[]) {
  const ids = new Set<string>();

  for (const item of collection) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }
    ids.add(item.id);
  }
}

export function validateLibrary(input: unknown): LibraryData {
  const library = librarySchema.parse(input);

  ensureUniqueIds("composer", library.composers);
  ensureUniqueIds("person", library.people);
  ensureUniqueIds("work group", library.workGroups);
  ensureUniqueIds("work", library.works);
  ensureUniqueIds("recording", library.recordings);

  const composerIds = new Set(library.composers.map((composer) => composer.id));
  const personIds = new Set(library.people.map((person) => person.id));
  const groupMap = new Map(library.workGroups.map((group) => [group.id, group]));
  const workMap = new Map(library.works.map((work) => [work.id, work]));

  for (const group of library.workGroups) {
    if (!composerIds.has(group.composerId)) {
      throw new Error(`Unknown composer for work group: ${group.id}`);
    }
  }

  for (const work of library.works) {
    if (!composerIds.has(work.composerId)) {
      throw new Error(`Unknown composer for work: ${work.id}`);
    }

    for (const groupId of work.groupIds) {
      const group = groupMap.get(groupId);
      if (!group) {
        throw new Error(`Unknown work group for work: ${work.id}`);
      }

      if (group.composerId !== work.composerId) {
        throw new Error(`Mismatched work group composer for work: ${work.id}`);
      }
    }
  }

  for (const recording of library.recordings) {
    if (!workMap.has(recording.workId)) {
      throw new Error(`Unknown work for recording: ${recording.id}`);
    }

    for (const credit of recording.credits) {
      if (credit.personId && !personIds.has(credit.personId)) {
        throw new Error(`Unknown person for recording credit: ${recording.id}`);
      }
    }

    for (const image of recording.images) {
      if (!image.src.trim()) {
        throw new Error(`Recording image is missing a src: ${recording.id}`);
      }
    }
  }

  return library;
}
