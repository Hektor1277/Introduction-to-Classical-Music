// @ts-nocheck
import express from "express";
import path from "node:path";

import {
  applyAutomationProposal,
  applyPendingAutomationProposals,
  canApplyAutomationProposal,
  ignoreAutomationProposal,
  ignorePendingAutomationProposals,
  revertAutomationProposal,
  summarizeAutomationRun,
  updateAutomationProposalReview,
} from "../../../packages/automation/src/automation.js";
import { createAutomationJobManager } from "../../../packages/automation/src/automation-jobs.js";
import { buildArticlePreviewModel, validateArticles } from "../../../packages/data-core/src/articles.js";
import {
  deleteAutomationRun,
  findRunSnapshot,
  listAutomationRuns,
  loadAutomationRun,
  loadLlmConfig,
  loadRecordingRetrievalConfig,
  persistRemoteImageAsset,
  persistUploadedImageAsset,
  saveAutomationRun,
  saveLlmConfig,
} from "../../../packages/automation/src/automation-store.js";
import {
  analyzeBatchImport,
  loadOrchestraAbbreviationMap,
  type BatchDraftEntities,
} from "../../../packages/automation/src/batch-import.js";
import {
  deleteBatchImportSession,
  listBatchImportSessions,
  loadBatchImportSession,
  saveBatchImportSession,
} from "../../../packages/automation/src/batch-import-store.js";
import { buildRecordingDisplayTitle, collectLibraryDataIssues, getDisplayData, getWebsiteDisplay } from "../../../packages/shared/src/display.js";
import { defaultLlmConfig, mergeLlmConfigPatch, sanitizeLlmConfig, testOpenAiCompatibleConfig } from "../../../packages/automation/src/llm.js";
import { fetchWithWindowsFallback } from "../../../packages/automation/src/external-fetch.js";
import { resolveLibraryAssetPath } from "../../../packages/data-core/src/owner-assets.js";
import { getAffectedPaths, mergeLibraryEntities } from "../../../packages/automation/src/owner-tools.js";
import {
  loadArticlesFromDisk,
  loadLibraryFromDisk,
  loadSiteConfig,
  readGeneratedArticles,
  saveArticlesToDisk,
  saveLibraryToDisk,
  saveSiteConfig,
  writeGeneratedArtifacts,
} from "../../../packages/data-core/src/library-store.js";
import { validateLibrary } from "../../../packages/shared/src/schema.js";
import { createEntityId, createSlug, createSortKey } from "../../../packages/shared/src/slug.js";
import { mergeSiteConfigPatch } from "../../../packages/data-core/src/site-content.js";
import { runAutomationChecks } from "../../../packages/automation/src/automation-checks.js";
import { createHttpRecordingRetrievalProvider } from "../../../packages/automation/src/recording-retrieval.js";
import { mergeBatchSessionIntoLibrary, replaceBatchDraftEntities, resolveConfirmedBatchSelection } from "./batch-session-utils.js";
import { sanitizeAutomationRunProposalFields, sanitizeProposalPatchMap } from "./proposal-patch-utils.js";

const app = express();
const port = Number(process.env.OWNER_PORT || 4322);
const ownerDir = path.join(process.cwd(), "apps", "owner", "web");
const publicDir = path.join(process.cwd(), "apps", "site", "public");
const templateDir = path.join(process.cwd(), "materials", "fixtures", "templates");
const jobManager = createAutomationJobManager();

app.use(express.json({ limit: "8mb" }));
app.use((request, response, next) => {
  if (request.path === "/" || request.path.endsWith(".js") || request.path.endsWith(".css") || request.path.endsWith(".html")) {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});
app.use(express.static(ownerDir));
app.use("/template", express.static(templateDir));
app.get(/^\/library-assets\/(.+)$/, (request, response, next) => {
  const resolvedAssetPath = resolveLibraryAssetPath(publicDir, request.path);
  if (!resolvedAssetPath) {
    response.status(404).json({ error: "Asset not found" });
    return;
  }

  response.sendFile(resolvedAssetPath, (error) => {
    if (error && !response.headersSent) {
      next(error);
    }
  });
});
app.use("/library-assets", express.static(path.join(publicDir, "library-assets")));

const automationFetch: typeof fetch = (input, init) => fetchWithWindowsFallback(input, init, { fetchImpl: fetch });

async function buildRecordingRunOptions(source = {}) {
  const config = await loadRecordingRetrievalConfig();
  if (!config.enabled) {
    return {};
  }
  return {
    recordingProvider: createHttpRecordingRetrievalProvider({ baseUrl: config.baseUrl }),
    recordingRequestOptions: {
      source,
      timeoutMs: config.timeoutMs,
    },
    recordingExecutionOptions: {
      timeoutMs: config.timeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    },
  };
}

function nextSortKey(collection) {
  return createSortKey(collection.length);
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function parseStructuredLinks(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        platform: String(item?.platform || "other").trim() || "other",
        url: String(item?.url || "").trim(),
        title: String(item?.title || "").trim(),
      }))
      .filter((item) => item.url);
  }
  if (typeof value === "string") {
    try {
      return parseStructuredLinks(JSON.parse(value));
    } catch {
      const legacyUrl = value.trim();
      return legacyUrl ? [{ platform: "other", url: legacyUrl, title: "" }] : [];
    }
  }
  return [];
}

function ensureWorkGroups(library, composerId, groupPath) {
  const groupIds = [];

  groupPath.forEach((title) => {
    const existing = library.workGroups.find(
      (group) =>
        group.composerId === composerId &&
        group.path.join("/") ===
          [...groupIds.map((id) => library.workGroups.find((item) => item.id === id)?.title).filter(Boolean), title].join("/"),
    );

    if (existing) {
      groupIds.push(existing.id);
      return;
    }

    const nextPath = [...groupIds.map((id) => library.workGroups.find((item) => item.id === id)?.title).filter(Boolean), title];
    const group = {
      id: createEntityId(`group-${composerId}`, nextPath.join("-")),
      composerId,
      title,
      slug: createSlug(title),
      path: nextPath,
      sortKey: nextSortKey(library.workGroups),
    };
    library.workGroups.push(group);
    groupIds.push(group.id);
  });

  return groupIds;
}

function upsertCollection(collection, entity) {
  const index = collection.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    collection[index] = entity;
    return entity;
  }
  collection.push(entity);
  return entity;
}

function parseInfoPanel(payload) {
  const collectionLinks = parseStructuredLinks(payload?.infoPanel?.collectionLinks || payload?.infoPanelCollectionLinks);
  const legacyCollectionUrl = String(payload?.infoPanel?.collectionUrl || payload?.infoPanelCollectionUrl || "").trim();
  return {
    text: payload?.infoPanel?.text || payload?.infoPanelText || "",
    articleId: payload?.infoPanel?.articleId || payload?.infoPanelArticleId || "",
    collectionLinks: collectionLinks.length
      ? collectionLinks
      : legacyCollectionUrl
        ? [{ platform: "other", url: legacyCollectionUrl, title: "" }]
        : [],
  };
}

function assertEntityCanDelete(library, entityType, entityId) {
  if (entityType === "recording") {
    return;
  }
  if (entityType === "work") {
    const dependentRecording = library.recordings.find((item) => item.workId === entityId);
    if (dependentRecording) {
      throw new Error(`该作品仍被版本“${dependentRecording.title}”引用，无法删除。`);
    }
    return;
  }
  if (entityType === "person") {
    const dependentRecording = library.recordings.find((item) => (item.credits || []).some((credit) => credit.personId === entityId));
    if (dependentRecording) {
      throw new Error(`该人物仍被版本“${dependentRecording.title}”引用，无法删除。`);
    }
    return;
  }
  if (entityType === "composer") {
    const dependentWork = library.works.find((item) => item.composerId === entityId);
    if (dependentWork) {
      throw new Error(`该作曲家仍拥有作品“${dependentWork.title}”，无法删除。`);
    }
    const dependentGroup = library.workGroups.find((item) => item.composerId === entityId);
    if (dependentGroup) {
      throw new Error(`该作曲家仍拥有作品分组“${dependentGroup.title}”，无法删除。`);
    }
  }
}

function removeEntityFromLibrary(library, entityType, entityId) {
  const collection = entityCollectionByType(library, entityType);
  const index = collection.findIndex((item) => item.id === entityId);
  if (index < 0) {
    throw new Error("Entity not found");
  }
  collection.splice(index, 1);
  return library;
}

function normalizeWorkComparableText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[，,:：;；()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCatalogueFromWorkSegment(segment, catalogue) {
  const normalizedSegment = String(segment ?? "").trim();
  const normalizedCatalogue = String(catalogue ?? "").trim();
  if (!normalizedSegment || !normalizedCatalogue) {
    return normalizedSegment;
  }
  if (normalizeWorkComparableText(normalizedSegment) === normalizeWorkComparableText(normalizedCatalogue)) {
    return "";
  }
  const escapedCatalogue = escapeRegExp(normalizedCatalogue).replace(/\s+/g, "\\s+");
  const trailingPatterns = [
    new RegExp(`(?:\\s*[,，:：;；/|·-]\\s*|\\s+)\\(?${escapedCatalogue}\\)?$`, "i"),
    new RegExp(`\\(${escapedCatalogue}\\)$`, "i"),
  ];
  return trailingPatterns.reduce((currentValue, pattern) => currentValue.replace(pattern, "").trim(), normalizedSegment);
}

function buildWorkDisplayParts(work, composer = null) {
  return [
    String(work?.title ?? work?.id ?? "").trim(),
    stripCatalogueFromWorkSegment(work?.titleLatin ?? "", work?.catalogue ?? ""),
    String(work?.catalogue ?? "").trim(),
    String(composer?.name ?? "").trim(),
    String(composer?.nameLatin ?? "").trim(),
  ].filter(Boolean);
}

const recordingWorkTypeHints = new Set(["orchestral", "concerto", "opera_vocal", "chamber_solo", "unknown"]);

function normalizeRecordingWorkTypeHint(value) {
  const normalized = compact(value).toLowerCase();
  return recordingWorkTypeHints.has(normalized) ? normalized : "unknown";
}

function getPersonById(library, personId) {
  return (library.people || []).find((person) => person.id === personId) || null;
}

function upsertRecordingCredit(credits, nextCredit) {
  const nextCredits = (credits || []).filter((credit) => !(credit.role === nextCredit.role && nextCredit.personId));
  nextCredits.push(nextCredit);
  return nextCredits;
}

function buildCanonicalRecordingCredit(library, role, personId) {
  const person = getPersonById(library, personId);
  if (!person) {
    return null;
  }
  return {
    role,
    personId: person.id,
    displayName: role === "orchestra" ? getWebsiteDisplay(person).heading : getDisplayData(person).primary || getWebsiteDisplay(person).heading,
    label: "",
  };
}

function buildRecordingEntity(library, payload, infoPanel, timestamp) {
  const existing = payload.id ? library.recordings.find((item) => item.id === payload.id) : null;
  let credits = Array.isArray(payload.credits) ? [...payload.credits] : [];
  const canonicalConductorCredit = buildCanonicalRecordingCredit(library, "conductor", payload.conductorPersonId);
  const canonicalOrchestraCredit = buildCanonicalRecordingCredit(library, "orchestra", payload.orchestraPersonId);

  if (canonicalConductorCredit) {
    credits = upsertRecordingCredit(credits, canonicalConductorCredit);
  }
  if (canonicalOrchestraCredit) {
    credits = upsertRecordingCredit(credits, canonicalOrchestraCredit);
  }
  if (canonicalConductorCredit?.personId) {
    credits = credits.filter(
      (credit) =>
        !["soloist", "instrumentalist", "singer"].includes(credit.role) || compact(credit.personId || "") !== canonicalConductorCredit.personId,
    );
  }

  const baseRecording = {
    id: existing?.id || payload.id || createEntityId("recording", payload.title || payload.workId || "recording"),
    workId: payload.workId,
    slug: existing?.slug || "",
    title: payload.title || existing?.title || "",
    workTypeHint: normalizeRecordingWorkTypeHint(payload.workTypeHint || existing?.workTypeHint),
    sortKey: existing?.sortKey || nextSortKey(library.recordings),
    isPrimaryRecommendation: Boolean(payload.isPrimaryRecommendation),
    updatedAt: timestamp,
    images: payload.images || existing?.images || [],
    credits,
    links: payload.links || existing?.links || [],
    notes: payload.notes || "",
    performanceDateText: payload.performanceDateText || "",
    venueText: payload.venueText || "",
    albumTitle: payload.albumTitle || "",
    label: payload.label || "",
    releaseDate: payload.releaseDate || "",
    infoPanel,
  };

  const computedTitle = buildRecordingDisplayTitle(baseRecording, library) || payload.title || existing?.title || "未命名版本";
  return {
    ...baseRecording,
    slug: existing?.slug || createSlug(computedTitle),
    title: computedTitle,
  };
}

function buildEntity(library, entityType, payload) {
  const timestamp = new Date().toISOString();
  const infoPanel = parseInfoPanel(payload);
  const workSlugSource = [
    payload.title,
    stripCatalogueFromWorkSegment(payload.titleLatin || "", payload.catalogue || ""),
    payload.catalogue,
  ]
    .filter(Boolean)
    .join(" ");

  if (entityType === "composer") {
    return {
      id: payload.id || createEntityId("composer", payload.slug || payload.name),
      slug: payload.slug || createSlug(payload.name),
      name: payload.name,
      nameLatin: payload.nameLatin || "",
      country: payload.country || "",
      avatarSrc: payload.avatarSrc || "",
      imageSourceUrl: payload.imageSourceUrl || "",
      imageSourceKind: payload.imageSourceKind || "",
      imageAttribution: payload.imageAttribution || "",
      imageUpdatedAt: payload.imageUpdatedAt || "",
      birthYear: parseNumber(payload.birthYear),
      deathYear: parseNumber(payload.deathYear),
      roles: payload.roles?.length ? payload.roles : ["composer"],
      aliases: parseList(payload.aliases),
      sortKey: payload.sortKey || nextSortKey(library.composers),
      summary: payload.summary || "",
      infoPanel,
    };
  }

  if (entityType === "person") {
    return {
      id: payload.id || createEntityId("person", payload.slug || payload.name),
      slug: payload.slug || createSlug(payload.name),
      name: payload.name,
      nameLatin: payload.nameLatin || "",
      country: payload.country || "",
      avatarSrc: payload.avatarSrc || "",
      imageSourceUrl: payload.imageSourceUrl || "",
      imageSourceKind: payload.imageSourceKind || "",
      imageAttribution: payload.imageAttribution || "",
      imageUpdatedAt: payload.imageUpdatedAt || "",
      birthYear: parseNumber(payload.birthYear),
      deathYear: parseNumber(payload.deathYear),
      roles: payload.roles?.length ? payload.roles : ["other"],
      aliases: parseList(payload.aliases),
      sortKey: payload.sortKey || nextSortKey(library.people),
      summary: payload.summary || "",
      infoPanel,
    };
  }

  if (entityType === "work") {
    const groupIds = ensureWorkGroups(library, payload.composerId, payload.groupPath || []);
    return {
      id: payload.id || createEntityId("work", payload.slug || workSlugSource || payload.title),
      composerId: payload.composerId,
      groupIds,
      slug: payload.slug || createSlug(workSlugSource || payload.title),
      title: payload.title,
      titleLatin: payload.titleLatin || "",
      aliases: parseList(payload.aliases),
      catalogue: payload.catalogue || "",
      summary: payload.summary || "",
      infoPanel,
      sortKey: payload.sortKey || nextSortKey(library.works),
      updatedAt: timestamp,
    };
  }

  return buildRecordingEntity(library, payload, infoPanel, timestamp);
}

function buildArticle(articles, payload) {
  const timestamp = new Date().toISOString();
  const nextId = payload.id || createEntityId("article", payload.slug || payload.title);
  return {
    id: nextId,
    slug: payload.slug || createSlug(payload.title),
    title: payload.title,
    summary: payload.summary || "",
    markdown: payload.markdown || "",
    createdAt: payload.createdAt || articles.find((item) => item.id === nextId)?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

async function previewOrSave(entityType, payload, shouldSave) {
  const library = await loadLibraryFromDisk();
  const entity = buildEntity(library, entityType, payload);

  if (entityType === "composer") {
    upsertCollection(library.composers, entity);
  } else if (entityType === "person") {
    upsertCollection(library.people, entity);
  } else if (entityType === "work") {
    upsertCollection(library.works, entity);
  } else {
    upsertCollection(library.recordings, entity);
  }

  const validated = validateLibrary(library);
  const entityId = entity.id;
  const savedEntity =
    entityType === "composer"
      ? validated.composers.find((item) => item.id === entityId)
      : entityType === "person"
        ? validated.people.find((item) => item.id === entityId)
        : entityType === "work"
          ? validated.works.find((item) => item.id === entityId)
          : validated.recordings.find((item) => item.id === entityId);

  const affectedPaths = getAffectedPaths(validated, entityType, entityId);

  if (shouldSave) {
    await saveLibraryToDisk(validated);
    await writeGeneratedArtifacts();
  }

  return {
    entity: savedEntity,
    affectedPaths,
    saved: shouldSave,
  };
}

function buildBatchCheckRequest(session) {
  const selection = resolveConfirmedBatchSelection(session);
  const request = {
    categories: [],
    workIds: [],
    recordingIds: [],
  };
  if (selection.createdEntityRefs.recordings.length) {
    request.recordingIds = [...selection.createdEntityRefs.recordings];
  }
  request.categories = request.recordingIds.length ? ["recording"] : [];
  return request;
}

function buildBatchRecordingOverrides(session) {
  return Object.fromEntries(
    (session.draftEntities?.recordings || []).map((entry) => [
      entry.entity.id,
      {
        sourceLine: entry.sourceLine || "",
        workTypeHint: session.workTypeHint || "unknown",
      },
    ]),
  );
}

function entityCollectionByType(library, entityType) {
  if (entityType === "composer") return library.composers;
  if (entityType === "person") return library.people;
  if (entityType === "work") return library.works;
  return library.recordings;
}

function buildSearchResults(library, site, query, type) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const composerById = new Map((library.composers || []).map((item) => [item.id, item]));
  const makeKeywords = (values) =>
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
  const matchesRequestedType = (entry) => {
    if (!type) {
      return true;
    }
    if (type === "person") {
      return entry.searchBucket === "person" || entry.type === "composer";
    }
    if (type === "group") {
      return entry.searchBucket === "group";
    }
    return entry.type === type || entry.searchBucket === type;
  };
  const buckets = [
    ["site", [{ id: "site", title: site.title, subtitle: site.subtitle || site.description || "", type: "site", searchBucket: "site" }]],
    [
      "composer",
      library.composers.map((item) => {
        const display = getDisplayData(item);
        return {
          id: item.id,
          title: getWebsiteDisplay(item).heading,
          subtitle: [display.primary !== getWebsiteDisplay(item).heading ? display.primary : "", item.nameLatin || display.latin, item.country].filter(Boolean).join(" / "),
          type: "composer",
          searchBucket: "person",
          roles: item.roles?.length ? item.roles : ["composer"],
          keywords: makeKeywords([
            display.primary,
            display.full,
            display.latin,
            item.name,
            item.nameLatin,
            item.aliases,
            item.abbreviations,
            item.country,
          ]),
        };
      }),
    ],
    [
      "person",
      library.people.map((item) => {
        const display = getDisplayData(item);
        const isGroup = item.roles.some((role) => ["orchestra", "ensemble", "chorus"].includes(role));
        const websiteDisplay = getWebsiteDisplay(item);
        return {
          id: item.id,
          title: websiteDisplay.heading,
          subtitle: [websiteDisplay.short, item.nameLatin || display.latin, (item.abbreviations || []).join(" / "), item.country].filter(Boolean).join(" / "),
          type: "person",
          searchBucket: isGroup ? "group" : "person",
          roles: item.roles,
          keywords: makeKeywords([
            display.primary,
            display.full,
            display.latin,
            item.name,
            item.nameLatin,
            item.aliases,
            item.abbreviations,
            item.country,
            item.roles,
          ]),
        };
      }),
      ],
      [
        "work",
      library.works.map((item) => {
          const composer = library.composers.find((composerItem) => composerItem.id === item.composerId);
          const composerDisplay = composer?.name || composer?.nameLatin || "";
          return {
            id: item.id,
            title: buildWorkDisplayParts(item, composer).slice(0, 3).join(" / "),
            subtitle: [composerDisplay, composer?.nameLatin && composer?.nameLatin !== composerDisplay ? composer.nameLatin : ""].filter(Boolean).join(" / "),
            type: "work",
            searchBucket: "work",
            roles: [],
            keywords: makeKeywords([item.title, item.titleLatin, item.catalogue, item.aliases, composerDisplay, composer?.nameLatin]),
          };
        }),
      ],
      [
        "recording",
        library.recordings.map((item) => {
          const work = library.works.find((workItem) => workItem.id === item.workId);
          const composer = work ? composerById.get(work.composerId) : null;
          const title = buildRecordingDisplayTitle(item, library);
          return {
            id: item.id,
            title,
            subtitle: [work?.title, composer ? getWebsiteDisplay(composer).heading : "", item.albumTitle || item.performanceDateText || ""]
              .filter(Boolean)
              .join(" / "),
            type: "recording",
            searchBucket: "recording",
            roles: [],
            keywords: makeKeywords([
              title,
              item.title,
              work?.title,
              work?.titleLatin,
              work?.catalogue,
              composer?.name,
              composer?.nameLatin,
              item.albumTitle,
              item.performanceDateText,
              item.venueText,
              item.credits?.map((credit) => [credit.displayName, credit.label, credit.personId]),
            ]),
          };
        }),
      ],
    ];

  return buckets
    .flatMap(([, entries]) => entries)
    .filter((entry) => matchesRequestedType(entry))
    .filter((entry) => !normalizedQuery || [entry.title, entry.subtitle, ...(entry.keywords || [])].join(" ").toLowerCase().includes(normalizedQuery))
    .slice(0, 100);
}

function buildRelatedEntityReference(library, entityType, entity) {
  if (!entity) {
    return null;
  }
  if (entityType === "composer") {
    const display = getWebsiteDisplay(entity);
    return {
      entityType,
      id: entity.id,
      label: display.heading,
      title: display.heading,
      subtitle: [display.short, entity.nameLatin || display.latin, entity.country].filter(Boolean).join(" / "),
    };
  }
  if (entityType === "person") {
    const display = getWebsiteDisplay(entity);
    return {
      entityType,
      id: entity.id,
      label: display.heading,
      title: display.heading,
      subtitle: [display.short, entity.nameLatin || display.latin, entity.country].filter(Boolean).join(" / "),
    };
  }
  if (entityType === "work") {
    const composer = (library.composers || []).find((item) => item.id === entity.composerId);
    return {
      entityType,
      id: entity.id,
      label: [entity.title, entity.titleLatin, entity.catalogue].filter(Boolean).join(" / "),
      title: entity.title,
      subtitle: [composer ? getWebsiteDisplay(composer).heading : "", entity.titleLatin, entity.catalogue].filter(Boolean).join(" / "),
    };
  }
  return {
    entityType,
    id: entity.id,
    label: buildRecordingDisplayTitle(entity, library),
    title: buildRecordingDisplayTitle(entity, library),
    subtitle: [entity.performanceDateText || "", entity.venueText || "", entity.albumTitle || ""].filter(Boolean).join(" / "),
  };
}

function collectRelatedEntities(library, entityType, entityId) {
  const results = [];
  const append = (nextType, nextEntity) => {
    const reference = buildRelatedEntityReference(library, nextType, nextEntity);
    if (!reference) {
      return;
    }
    const key = `${reference.entityType}:${reference.id}`;
    if (results.some((item) => `${item.entityType}:${item.id}` === key)) {
      return;
    }
    results.push(reference);
  };

  if (entityType === "composer") {
    (library.works || []).filter((item) => item.composerId === entityId).forEach((item) => append("work", item));
    return results;
  }

  if (entityType === "person") {
    (library.recordings || [])
      .filter((item) => (item.credits || []).some((credit) => credit.personId === entityId))
      .forEach((item) => append("recording", item));
    return results;
  }

  if (entityType === "work") {
    const work = (library.works || []).find((item) => item.id === entityId);
    if (work) {
      const composer = (library.composers || []).find((item) => item.id === work.composerId);
      if (composer) {
        append("composer", composer);
      }
    }
    (library.recordings || []).filter((item) => item.workId === entityId).forEach((item) => append("recording", item));
    return results;
  }

  if (entityType === "recording") {
    const recording = (library.recordings || []).find((item) => item.id === entityId);
    if (!recording) {
      return results;
    }
    const work = (library.works || []).find((item) => item.id === recording.workId);
    if (work) {
      append("work", work);
    }
    (recording.credits || []).forEach((credit) => {
      const person = (library.people || []).find((item) => item.id === credit.personId);
      if (person) {
        append("person", person);
      }
    });
  }

  return results;
}

function appendOrReplaceField(fields, nextField) {
  const index = fields.findIndex((field) => field.path === nextField.path);
  if (index >= 0) {
    fields[index] = nextField;
    return fields;
  }
  fields.push(nextField);
  return fields;
}

function getValueAtPath(target, path) {
  if (!target || !path) {
    return "";
  }
  const imageMatch = /^images\[(\d+)\]\.(.+)$/.exec(path);
  if (imageMatch) {
    return target.images?.[Number(imageMatch[1])]?.[imageMatch[2]] ?? "";
  }
  return target[path] ?? "";
}

function decodeBase64Bytes(contentBase64 = "") {
  return Uint8Array.from(Buffer.from(String(contentBase64 || ""), "base64"));
}

function bucketForEntityType(entityType) {
  if (entityType === "composer") return "composers";
  if (entityType === "person") return "people";
  if (entityType === "recording") return "recordings";
  return "misc";
}

async function saveValidatedLibrary(library) {
  const validated = validateLibrary(library);
  await saveLibraryToDisk(validated);
  await writeGeneratedArtifacts();
  return validated;
}

async function prepareProposalRunForApply(run, proposalId, fetchImpl) {
  const proposal = run.proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const proposalFields = [...proposal.fields];
  const candidate = proposal.imageCandidates?.find((item) => item.id === proposal.selectedImageCandidateId);
  if (candidate) {
    if (proposal.entityType === "composer" || proposal.entityType === "person") {
      const assetPath = await persistRemoteImageAsset({
        bucket: proposal.entityType === "composer" ? "composers" : "people",
        slug: proposal.entityId,
        sourceUrl: candidate.src,
        fetchImpl,
      });
      appendOrReplaceField(proposalFields, { path: "avatarSrc", before: "", after: assetPath });
      appendOrReplaceField(proposalFields, { path: "imageSourceUrl", before: "", after: candidate.sourceUrl });
      appendOrReplaceField(proposalFields, { path: "imageSourceKind", before: "", after: candidate.sourceKind });
      appendOrReplaceField(proposalFields, { path: "imageAttribution", before: "", after: candidate.attribution });
      appendOrReplaceField(proposalFields, { path: "imageUpdatedAt", before: "", after: new Date().toISOString() });
    }

    if (proposal.entityType === "recording") {
      const assetPath = await persistRemoteImageAsset({
        bucket: "recordings",
        slug: proposal.entityId,
        sourceUrl: candidate.src,
        fetchImpl,
      });
      appendOrReplaceField(proposalFields, {
        path: "images[0]",
        before: null,
        after: {
          src: assetPath,
          alt: candidate.title || proposal.summary,
          kind: proposal.summary.includes("现场") ? "performance" : "cover",
          sourceUrl: candidate.sourceUrl,
          sourceKind: candidate.sourceKind,
          attribution: candidate.attribution,
          updatedAt: new Date().toISOString(),
          width: candidate.width,
          height: candidate.height,
          score: candidate.score,
        },
      });
    }
  }

  return summarizeAutomationRun({
    ...run,
    proposals: run.proposals.map((item) =>
      item.id === proposal.id
        ? {
            ...item,
            fields: proposalFields,
          }
        : item,
    ),
  });
}

function buildEntityCheckRequest(entityType, entityId, library) {
  if (entityType === "composer") {
    return { categories: ["composer"], composerIds: [entityId] };
  }
  if (entityType === "person") {
    const person = library.people.find((item) => item.id === entityId);
    if (!person) {
      throw new Error("Entity not found");
    }
    if (person.roles.includes("conductor")) {
      return { categories: ["conductor"], conductorIds: [entityId] };
    }
    if (person.roles.includes("orchestra")) {
      return { categories: ["orchestra"], orchestraIds: [entityId] };
    }
    return { categories: ["artist"], artistIds: [entityId] };
  }
  if (entityType === "work") {
    return { categories: ["work"], workIds: [entityId] };
  }
  return { categories: ["recording"], recordingIds: [entityId] };
}

function persistRunOnComplete(job) {
  if (job.run) {
    return saveAutomationRun(job.run);
  }
}

app.get("/api/library", async (_request, response) => {
  try {
    const [library, articles] = await Promise.all([loadLibraryFromDisk(), loadArticlesFromDisk()]);
    response.json({
      library,
      articles,
      dataIssues: collectLibraryDataIssues(library),
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/data-issues", async (_request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    response.json({ issues: collectLibraryDataIssues(library) });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/search", async (request, response) => {
  try {
    const [library, site] = await Promise.all([loadLibraryFromDisk(), loadSiteConfig()]);
    response.json({
      results: buildSearchResults(library, site, String(request.query.q || ""), String(request.query.type || "")),
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/entity/:entityType/:id", async (request, response) => {
  try {
    if (request.params.entityType === "site") {
      const site = await loadSiteConfig();
      response.json({ entity: site });
      return;
    }

    const library = await loadLibraryFromDisk();
    const collection = entityCollectionByType(library, request.params.entityType);
    const entity = collection.find((item) => item.id === request.params.id);
    if (!entity) {
      response.status(404).json({ error: "Entity not found" });
      return;
    }

    response.json({
      entity,
      relatedEntities: collectRelatedEntities(library, request.params.entityType, request.params.id),
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/site", async (_request, response) => {
  try {
    const site = await loadSiteConfig();
    response.json({ site });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/site", async (request, response) => {
  try {
    const currentSite = await loadSiteConfig();
    const site = mergeSiteConfigPatch(currentSite, request.body ?? {});
    await saveSiteConfig(site);
    await writeGeneratedArtifacts();
    response.json({
      saved: true,
      site,
      affectedPaths: ["/", "/about/"],
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/rebuild", async (_request, response) => {
  try {
    const { indexes } = await writeGeneratedArtifacts();
    response.json({
      rebuilt: true,
      stats: indexes.stats,
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/preview/:entityType", async (request, response) => {
  try {
    const result = await previewOrSave(request.params.entityType, request.body, false);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/save/:entityType", async (request, response) => {
  try {
    const result = await previewOrSave(request.params.entityType, request.body, true);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/api/entity/:entityType/:id", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    assertEntityCanDelete(library, request.params.entityType, request.params.id);
    const nextLibrary = removeEntityFromLibrary(library, request.params.entityType, request.params.id);
    const validated = await saveValidatedLibrary(nextLibrary);
    response.json({
      deleted: true,
      entityType: request.params.entityType,
      entityId: request.params.id,
      affectedPaths: getAffectedPaths(validated, request.params.entityType, request.params.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.status(message === "Entity not found" ? 404 : 400).json({ error: message });
  }
});

app.post("/api/entity/:entityType/:id/merge", async (request, response) => {
  try {
    const entityType = String(request.params.entityType || "");
    const duplicateId = String(request.params.id || "");
    const primaryId = String(request.body?.targetId || "").trim();
    if (!primaryId) {
      response.status(400).json({ error: "Missing merge target id" });
      return;
    }
    if (!["composer", "person", "work"].includes(entityType)) {
      response.status(400).json({ error: "This entity type does not support manual merge." });
      return;
    }

    const library = await loadLibraryFromDisk();
    const mergedLibrary = mergeLibraryEntities(library, entityType as "composer" | "person" | "work", primaryId, duplicateId);
    const validated = await saveValidatedLibrary(mergedLibrary);
    response.json({
      merged: true,
      entityType,
      primaryId,
      duplicateId,
      affectedPaths: [...new Set(getAffectedPaths(validated, entityType as EditableEntityType, primaryId))],
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/automation/runs", async (_request, response) => {
  try {
    const runs = await listAutomationRuns();
    response.json({ runs });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/automation/runs/:runId", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.params.runId);
    response.json({ run });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/batch-import/sessions", async (_request, response) => {
  try {
    const sessions = await listBatchImportSessions();
    response.json({ sessions });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/batch-import/:sessionId", async (request, response) => {
  try {
    const session = await loadBatchImportSession(request.params.sessionId);
    response.json({ session });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/analyze", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    const llmConfig = await loadLlmConfig();
    const selectedComposerId = String(request.body?.selectedComposerId || "").trim();
    const selectedWorkId = String(request.body?.selectedWorkId || "").trim();
    const workTypeHint = String(request.body?.workTypeHint || "unknown").trim();
    const result = await analyzeBatchImport({
      sourceText: request.body?.sourceText || "",
      composerId: selectedComposerId,
      workId: selectedWorkId,
      workTypeHint,
      library,
      llmConfig,
      fetchImpl: automationFetch,
      orchestraAbbreviations: await loadOrchestraAbbreviationMap(),
    });

    const now = new Date().toISOString();
    const session = await saveBatchImportSession({
      id: `batch-${now.replace(/[:.]/g, "-")}`,
      createdAt: now,
      updatedAt: now,
      sourceText: request.body?.sourceText || "",
      sourceFileName: request.body?.sourceFileName || "",
      status: "analyzed",
      selectedComposerId: result.selectedComposerId,
      selectedWorkId: result.selectedWorkId,
      workTypeHint: result.workTypeHint,
      composerId: result.composerId,
      workId: result.workId,
      baseLibrary: library,
      draftLibrary: result.draftLibrary,
      draftEntities: result.draftEntities,
      createdEntityRefs: result.createdEntityRefs,
      warnings: result.warnings,
      parseNotes: result.parseNotes,
      llmUsed: result.llmUsed,
      recordingEnrichment: {
        providerName: "recording-retrieval-service",
        status: "queued",
        itemMap: Object.fromEntries((result.draftEntities.recordings || []).map((entry) => [entry.entity.id, entry.sourceLine])),
      },
      runId: "",
    });

    response.json({ session });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/:sessionId/confirm-create", async (request, response) => {
  try {
    const session = await loadBatchImportSession(request.params.sessionId);
    const replacedSession = replaceBatchDraftEntities(session, request.body?.draftEntities || session.draftEntities);
    const selection = resolveConfirmedBatchSelection(replacedSession);
    const library = await loadLibraryFromDisk();
    await saveValidatedLibrary(
      mergeBatchSessionIntoLibrary(library, {
        draftLibrary: selection.draftLibrary,
        createdEntityRefs: selection.createdEntityRefs,
      }),
    );
    const nextSession = await saveBatchImportSession({
      ...replacedSession,
      status: "created",
      createdEntityRefs: selection.createdEntityRefs,
    });
    response.json({ session: nextSession, createdEntityRefs: selection.createdEntityRefs });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/:sessionId/check", async (request, response) => {
  try {
    let session = await loadBatchImportSession(request.params.sessionId);
    if (request.body?.draftEntities) {
      session = replaceBatchDraftEntities(session, request.body.draftEntities);
    }
    const selection = resolveConfirmedBatchSelection(session);

    const llmConfig = await loadLlmConfig();
    const checkRequest = buildBatchCheckRequest(session);
    if (!checkRequest.categories.length) {
      const nextSession = await saveBatchImportSession({
        ...session,
        status: "checked",
        updatedAt: new Date().toISOString(),
        createdEntityRefs: selection.createdEntityRefs,
        runId: "",
        run: undefined,
      });
      response.json({ session: nextSession, run: null });
      return;
    }

    const run = await runAutomationChecks(
      selection.draftLibrary,
      checkRequest,
      automationFetch,
      llmConfig,
      {
        ...(await buildRecordingRunOptions({
          kind: "owner-batch-check",
          batchSessionId: session.id,
        })),
        recordingRequestOptions: {
          source: {
            kind: "owner-batch-check",
            batchSessionId: session.id,
          },
          overrides: buildBatchRecordingOverrides(session),
        },
      },
    );
    await saveAutomationRun(run);
    const nextSession = await saveBatchImportSession({
      ...session,
      status: "checked",
      updatedAt: new Date().toISOString(),
      createdEntityRefs: selection.createdEntityRefs,
      recordingEnrichment: run.provider
        ? {
            providerName: run.provider.providerName,
            providerJobId: run.provider.providerJobId,
            requestId: run.provider.requestId,
            submittedAt: run.provider.submittedAt,
            lastSyncedAt: run.provider.lastSyncedAt,
            status: run.provider.status,
            itemProgress: run.provider.progress,
            itemMap: Object.fromEntries(checkRequest.recordingIds.map((id) => [id, id])),
            error: run.provider.error,
          }
        : session.recordingEnrichment,
      runId: run.id,
      run,
    });
    response.json({ session: nextSession, run });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/:sessionId/apply", async (request, response) => {
  try {
    let session = await loadBatchImportSession(request.params.sessionId);
    if (request.body?.draftEntities) {
      session = replaceBatchDraftEntities(session, request.body.draftEntities);
    }
    const selection = resolveConfirmedBatchSelection(session);

    let draftLibrary = structuredClone(selection.draftLibrary);
    let run = session.runId ? await loadAutomationRun(session.runId) : session.run;

    if (run) {
      for (const proposal of run.proposals.filter((item) => item.reviewState === "confirmed" && item.status === "pending")) {
        const preparedRun = await prepareProposalRunForApply(run, proposal.id, automationFetch);
        const applied = applyAutomationProposal(draftLibrary, preparedRun, proposal.id);
        draftLibrary = applied.library;
        run = applied.run;
      }
      await saveAutomationRun(run);
    }

    const library = await loadLibraryFromDisk();
    const mergedLibrary = mergeBatchSessionIntoLibrary(library, {
      ...session,
      draftLibrary,
      run,
    });
    await saveValidatedLibrary(mergedLibrary);

    const nextSession = await saveBatchImportSession({
      ...session,
      draftLibrary,
      createdEntityRefs: selection.createdEntityRefs,
      runId: run?.id || session.runId,
      run,
      status: "applied",
      updatedAt: new Date().toISOString(),
    });

    response.json({
      session: nextSession,
      affectedPaths: [
        ...getAffectedPaths(mergedLibrary, "work", nextSession.workId),
        ...selection.createdEntityRefs.recordings.map((recordingId) => `/recordings/${recordingId}/`),
      ],
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/:sessionId/abandon", async (request, response) => {
  try {
    const session = await loadBatchImportSession(request.params.sessionId);
    if (session.runId) {
      await deleteAutomationRun(session.runId);
    }
    await deleteBatchImportSession(request.params.sessionId);
    response.json({ abandoned: request.params.sessionId });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/batch-import/:sessionId/abandon-unconfirmed", async (request, response) => {
  try {
    let session = await loadBatchImportSession(request.params.sessionId);
    if (request.body?.draftEntities) {
      session = replaceBatchDraftEntities(session, request.body.draftEntities);
    }

    const prunedDraftEntities = {
      composers: (session.draftEntities.composers || []).filter((entry) => entry.reviewState === "confirmed"),
      people: (session.draftEntities.people || []).filter((entry) => entry.reviewState === "confirmed"),
      works: (session.draftEntities.works || []).filter((entry) => entry.reviewState === "confirmed"),
      recordings: (session.draftEntities.recordings || []).filter((entry) => entry.reviewState === "confirmed"),
    };
    let nextSession = replaceBatchDraftEntities(session, prunedDraftEntities);
    const selection = resolveConfirmedBatchSelection(nextSession);

    if (nextSession.runId) {
      await deleteAutomationRun(nextSession.runId);
      nextSession = {
        ...nextSession,
        runId: "",
        run: undefined,
      };
    }

    const savedSession = await saveBatchImportSession({
      ...nextSession,
      status: selection.createdEntityRefs.recordings.length || selection.createdEntityRefs.works.length || selection.createdEntityRefs.composers.length
        ? "created"
        : "analyzed",
      updatedAt: new Date().toISOString(),
      createdEntityRefs: selection.createdEntityRefs,
      draftLibrary: selection.draftLibrary,
    });
    response.json({ session: savedSession });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/selection-preview", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    const preview = jobManager.previewSelection(library, request.body ?? {});
    response.json({ preview });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/automation/jobs", async (_request, response) => {
  response.json({ jobs: jobManager.listJobs() });
});

app.post("/api/automation/jobs", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    const llmConfig = await loadLlmConfig();
    const runChecksOptions = await buildRecordingRunOptions({ kind: "owner-entity-check" });
    const job = jobManager.createJob({
      library,
      request: request.body ?? {},
      fetchImpl: automationFetch,
      llmConfig,
      maxConcurrency: 6,
      runChecksOptions,
      onCompleted: async (currentJob) => {
        if (!currentJob.run) {
          return;
        }
        const runWithNotes = summarizeAutomationRun({
          ...currentJob.run,
          notes: [
            ...currentJob.run.notes,
            ...currentJob.errors.map((item) => `[${item.entityType ?? "job"}] ${item.message}`),
            llmConfig.enabled ? "LLM 辅助：已启用 OpenAI-compatible 配置。" : "LLM 辅助：未启用，已回退到纯规则模式。",
          ],
        });
        currentJob.run = runWithNotes;
        await persistRunOnComplete(currentJob);
      },
    });

    response.json({ job });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/check", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    const llmConfig = await loadLlmConfig();
    const runChecksOptions = await buildRecordingRunOptions({ kind: "owner-entity-check" });
    const job = jobManager.createJob({
      library,
      request: request.body ?? {},
      fetchImpl: automationFetch,
      llmConfig,
      maxConcurrency: 6,
      runChecksOptions,
      onCompleted: persistRunOnComplete,
    });
    response.json({ job });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/automation/jobs/:jobId", async (request, response) => {
  const job = jobManager.getJob(request.params.jobId);
  if (!job) {
    response.status(404).json({ error: "Job not found" });
    return;
  }
  response.json({ job });
});

app.post("/api/automation/jobs/:jobId/cancel", async (request, response) => {
  const job = jobManager.cancelJob(request.params.jobId);
  if (!job) {
    response.status(404).json({ error: "Job not found" });
    return;
  }
  response.json({ job });
});

app.post("/api/automation/entity-check/:entityType/:id", async (request, response) => {
  try {
    const library = await loadLibraryFromDisk();
    const llmConfig = await loadLlmConfig();
    const runChecksOptions = await buildRecordingRunOptions({ kind: "owner-entity-check" });
    const job = jobManager.createJob({
      library,
      request: buildEntityCheckRequest(request.params.entityType, request.params.id, library),
      fetchImpl: automationFetch,
      llmConfig,
      maxConcurrency: 2,
      runChecksOptions,
      onCompleted: persistRunOnComplete,
    });
    response.json({ job });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/proposals/:proposalId/review-state", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.body?.runId);
    const nextRun = updateAutomationProposalReview(
      run,
      request.params.proposalId,
      request.body?.reviewState || "viewed",
      request.body?.selectedImageCandidateId || "",
    );
    await saveAutomationRun(nextRun);
    response.json({ run: nextRun });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/assets/upload", async (request, response) => {
  try {
    const bucket = String(request.body?.bucket || "misc");
    const slug = String(request.body?.slug || "asset");
    const fileName = String(request.body?.fileName || "upload.jpg");
    const contentBase64 = String(request.body?.contentBase64 || "");
    if (!contentBase64) {
      response.status(400).json({ error: "Missing file content" });
      return;
    }

    const src = await persistUploadedImageAsset({
      bucket,
      slug,
      fileName,
      bytes: decodeBase64Bytes(contentBase64),
    });

    response.json({
      asset: {
        src,
        imageSourceKind: "manual",
        imageSourceUrl: "",
        imageAttribution: fileName,
        imageUpdatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/articles", async (_request, response) => {
  try {
    const articles = await loadArticlesFromDisk();
    response.json({ articles });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/articles/preview", async (request, response) => {
  try {
    response.json({
      preview: buildArticlePreviewModel({
        title: request.body?.title || "",
        summary: request.body?.summary || "",
        markdown: request.body?.markdown || "",
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/articles", async (request, response) => {
  try {
    const articles = await loadArticlesFromDisk();
    const article = buildArticle(articles, request.body || {});
    const validated = validateArticles(upsertCollection(articles, article) && articles);
    await saveArticlesToDisk(validated);
    await writeGeneratedArtifacts();
    response.json({
      mode: "created",
      article,
      affectedPaths: [`/columns/${article.slug}/`],
      preview: buildArticlePreviewModel(article),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/articles/:id", async (request, response) => {
  try {
    const articles = await loadArticlesFromDisk();
    const article = buildArticle(articles, {
      ...(request.body || {}),
      id: request.params.id,
    });
    const validated = validateArticles(upsertCollection(articles, article) && articles);
    await saveArticlesToDisk(validated);
    await writeGeneratedArtifacts();
    response.json({
      mode: "updated",
      article,
      affectedPaths: [`/columns/${article.slug}/`],
      preview: buildArticlePreviewModel(article),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/api/articles/:id", async (request, response) => {
  try {
    const articles = await loadArticlesFromDisk();
    const nextArticles = articles.filter((item) => item.id !== request.params.id);
    await saveArticlesToDisk(nextArticles);
    await writeGeneratedArtifacts();
    response.json({ deleted: request.params.id });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/proposals/:proposalId/edit", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.body?.runId);
    const proposal = run.proposals.find((item) => item.id === request.params.proposalId);
    if (!proposal) {
      response.status(404).json({ error: "Proposal not found" });
      return;
    }

    const patchMap = sanitizeProposalPatchMap(
      proposal.entityType,
      request.body?.fieldsPatchMap && typeof request.body.fieldsPatchMap === "object" ? request.body.fieldsPatchMap : {},
    );
    const selectedImageCandidateId = typeof request.body?.selectedImageCandidateId === "string" ? request.body.selectedImageCandidateId : proposal.selectedImageCandidateId || "";
    const library = await loadLibraryFromDisk();
    const entity = entityCollectionByType(library, proposal.entityType).find((item) => item.id === proposal.entityId);

    const nextRun = summarizeAutomationRun({
      ...run,
      proposals: run.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              reviewState: "edited",
              status: item.status === "applied" ? "applied" : "pending",
              selectedImageCandidateId,
              fields: Object.entries(patchMap).reduce((fields, [path, after]) => {
                const existing = item.fields.find((field) => field.path === path);
                return appendOrReplaceField(fields, {
                  path,
                  before: existing ? existing.before : getValueAtPath(entity, path),
                  after,
                });
              }, [...item.fields]),
            }
          : item,
      ),
    });

    await saveAutomationRun(nextRun);
    response.json({ run: nextRun });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/proposals/:proposalId/upload-image", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.body?.runId);
    const proposal = run.proposals.find((item) => item.id === request.params.proposalId);
    if (!proposal) {
      response.status(404).json({ error: "Proposal not found" });
      return;
    }
    const fileName = String(request.body?.fileName || "upload.jpg");
    const contentBase64 = String(request.body?.contentBase64 || "");
    if (!contentBase64) {
      response.status(400).json({ error: "Missing file content" });
      return;
    }

    const src = await persistUploadedImageAsset({
      bucket: bucketForEntityType(proposal.entityType),
      slug: proposal.entityId,
      fileName,
      bytes: decodeBase64Bytes(contentBase64),
    });

    const candidateId = `${proposal.id}-manual-${Date.now()}`;
    const nextCandidate = {
      id: candidateId,
      src,
      sourceUrl: "",
      sourceKind: "manual",
      attribution: fileName,
      title: fileName,
      score: 100,
    };

    const nextRun = summarizeAutomationRun({
      ...run,
      proposals: run.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              reviewState: "edited",
              status: item.status === "applied" ? "applied" : "pending",
              selectedImageCandidateId: candidateId,
              imageCandidates: [...(item.imageCandidates || []), nextCandidate],
            }
          : item,
      ),
    });

    await saveAutomationRun(nextRun);
    response.json({ run: nextRun, candidate: nextCandidate });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/proposals/:proposalId/apply", async (request, response) => {
  try {
    const { runId, imageCandidateId } = request.body ?? {};
    const [library, run] = await Promise.all([loadLibraryFromDisk(), loadAutomationRun(runId)]);
    const proposal = run.proposals.find((item) => item.id === request.params.proposalId);
    if (!proposal) {
      response.status(404).json({ error: "Proposal not found" });
      return;
    }
    if (!canApplyAutomationProposal(proposal)) {
      response.status(400).json({ error: "This proposal is for review only and cannot be applied directly." });
      return;
    }

    let preparedRun = summarizeAutomationRun({
      ...run,
      proposals: run.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              reviewState: "confirmed",
              selectedImageCandidateId: imageCandidateId || item.selectedImageCandidateId || "",
            }
          : item,
      ),
    });

    preparedRun = await prepareProposalRunForApply(preparedRun, proposal.id, automationFetch);
    preparedRun = sanitizeAutomationRunProposalFields(preparedRun);
    const applied = applyAutomationProposal(library, preparedRun, proposal.id);
    await saveValidatedLibrary(applied.library);
    await saveAutomationRun(applied.run);

    response.json({
      run: applied.run,
      snapshot: applied.snapshot,
      affectedPaths: getAffectedPaths(applied.library, proposal.entityType, proposal.entityId),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/proposals/:proposalId/ignore", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.body?.runId);
    const nextRun = ignoreAutomationProposal(
      updateAutomationProposalReview(run, request.params.proposalId, "discarded"),
      request.params.proposalId,
    );
    await saveAutomationRun(nextRun);
    response.json({ run: nextRun });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/runs/:runId/apply-confirmed", async (_request, response) => {
  try {
    const [library, run] = await Promise.all([loadLibraryFromDisk(), loadAutomationRun(_request.params.runId)]);
    let preparedRun = run;
    for (const proposal of preparedRun.proposals) {
      if (proposal.status !== "pending" || proposal.reviewState !== "confirmed" || !canApplyAutomationProposal(proposal)) {
        continue;
      }
      preparedRun = await prepareProposalRunForApply(preparedRun, proposal.id, automationFetch);
    }

    const confirmReadyRun = sanitizeAutomationRunProposalFields(summarizeAutomationRun({
      ...preparedRun,
      proposals: preparedRun.proposals.map((proposal) =>
        proposal.status === "pending" && proposal.reviewState !== "confirmed" ? { ...proposal, status: "ignored" } : proposal,
      ),
    }));

    const applied = applyPendingAutomationProposals(library, confirmReadyRun);
    await saveValidatedLibrary(applied.library);
    await saveAutomationRun(applied.run);
    response.json({ run: applied.run, snapshots: applied.snapshots });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/runs/:runId/ignore-pending", async (request, response) => {
  try {
    const run = await loadAutomationRun(request.params.runId);
    const nextRun = ignorePendingAutomationProposals(run);
    await saveAutomationRun(nextRun);
    response.json({ run: nextRun });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/snapshots/:snapshotId/revert", async (request, response) => {
  try {
    const [library, run] = await Promise.all([loadLibraryFromDisk(), loadAutomationRun(request.body?.runId)]);
    const snapshot = findRunSnapshot(run, request.params.snapshotId);
    if (!snapshot) {
      response.status(404).json({ error: "Snapshot not found" });
      return;
    }

    const revertedLibrary = revertAutomationProposal(library, run, snapshot.id);
    const nextRun = summarizeAutomationRun({
      ...run,
      proposals: run.proposals.map((proposal) =>
        proposal.id === snapshot.proposalId ? { ...proposal, status: "pending", reviewState: "viewed" } : proposal,
      ),
      snapshots: run.snapshots.filter((item) => item.id !== snapshot.id),
    });

    await saveValidatedLibrary(revertedLibrary);
    await saveAutomationRun(nextRun);

    response.json({
      run: nextRun,
      affectedPaths: getAffectedPaths(revertedLibrary, snapshot.entityType, snapshot.entityId),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/automation/llm/config", async (_request, response) => {
  const config = await loadLlmConfig();
  response.json({ config: sanitizeLlmConfig(config) });
});

app.post("/api/automation/llm/config", async (request, response) => {
  try {
    const current = await loadLlmConfig();
    const next = mergeLlmConfigPatch(current ?? defaultLlmConfig, request.body ?? {});
    await saveLlmConfig(next);
    response.json({ config: sanitizeLlmConfig(next) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/automation/llm/test", async (request, response) => {
  try {
    const current = await loadLlmConfig();
    const config = mergeLlmConfigPatch(current ?? defaultLlmConfig, request.body ?? {});
    const result = await testOpenAiCompatibleConfig(config, automationFetch);
    response.json({ result, config: sanitizeLlmConfig(config) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Owner tool running at http://127.0.0.1:${port}\n`);
});


























