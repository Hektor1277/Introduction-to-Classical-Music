import {
  createAutomationRun,
  isSuspiciousImageCandidate,
  rankImageCandidates,
  type AutomationCheckCategory,
  type AutomationImageCandidate,
  type AutomationProposal,
  type AutomationRun,
} from "./automation.js";
import {
  generateConciseChineseSummary,
  generateEntityKnowledgeCandidate,
  isLlmConfigured,
  type LlmConfig,
} from "./llm.js";
import {
  buildRecordingRetrievalRequest,
  executeRecordingRetrievalJob,
  translateRecordingRetrievalResultsToProposals,
  type ExecuteRecordingRetrievalJobOptions,
  type RecordingRetrievalProvider,
  type RecordingRetrievalRequestOptions,
} from "./recording-retrieval.js";
import { auditResourceLinks, detectPlatformFromUrl } from "../../data-core/src/resource-links.js";
import type { Composer, LibraryData, Person, PersonRole, Recording, Work } from "../../shared/src/schema.js";

export type AutomationCheckRequest = {
  categories?: AutomationCheckCategory[];
  entityTypes?: AutomationCheckCategory[];
  composerIds?: string[];
  personIds?: string[];
  workIds?: string[];
  conductorIds?: string[];
  orchestraIds?: string[];
  artistIds?: string[];
  recordingIds?: string[];
};

export type RunAutomationChecksOptions = {
  recordingProvider?: RecordingRetrievalProvider;
  recordingRequestOptions?: RecordingRetrievalRequestOptions;
  recordingExecutionOptions?: ExecuteRecordingRetrievalJobOptions;
};

type EntitySourceCandidate = {
  sourceUrl: string;
  sourceKind: "wikipedia" | "wikimedia-commons" | "baidu-baike" | "llm" | "other";
  sourceLabel: string;
  summary: string;
  imageUrl: string;
  imageAttribution: string;
  birthYear?: number;
  deathYear?: number;
  country?: string;
  displayName?: string;
  displayFullName?: string;
  displayLatinName?: string;
  aliases?: string[];
  abbreviations?: string[];
  confidence?: number;
  rationale?: string;
};

const countryPatterns = [
  { value: "Austria", tokens: ["Austria", "Austrian", "奥地利", "奥地利籍"] },
  { value: "Germany", tokens: ["Germany", "German", "德国", "德意志"] },
  { value: "France", tokens: ["France", "French", "法国", "法兰西"] },
  { value: "Finland", tokens: ["Finland", "Finnish", "芬兰"] },
  { value: "Russia", tokens: ["Russia", "Russian", "俄国", "俄罗斯"] },
  { value: "Hungary", tokens: ["Hungary", "Hungarian", "匈牙利"] },
  { value: "Czech Republic", tokens: ["Czech Republic", "Czech", "捷克"] },
  { value: "Netherlands", tokens: ["Netherlands", "Dutch", "荷兰"] },
  { value: "Italy", tokens: ["Italy", "Italian", "意大利"] },
  { value: "Sweden", tokens: ["Sweden", "Swedish", "瑞典"] },
  { value: "United Kingdom", tokens: ["United Kingdom", "British", "英国", "英格兰"] },
  { value: "United States", tokens: ["United States", "American", "美国"] },
  { value: "China", tokens: ["China", "Chinese", "中国"] },
  { value: "Japan", tokens: ["Japan", "Japanese", "日本"] },
  { value: "Argentina", tokens: ["Argentina", "Argentinian", "阿根廷"] },
  { value: "Israel", tokens: ["Israel", "Israeli", "以色列"] },
  { value: "India", tokens: ["India", "Indian", "印度"] },
  { value: "Austria-Hungary", tokens: ["Austria-Hungary", "奥匈帝国"] },
];

const artistRoles: PersonRole[] = ["soloist", "singer", "ensemble", "chorus", "instrumentalist"];

function getEntityAbbreviations(entity: Composer | Person) {
  return uniqueStrings((entity.aliases || []).filter((value) => /^[A-Z0-9][A-Z0-9 .&/-]{1,15}$/.test(String(value ?? "").trim())));
}

function getEntityShortChineseName(entity: Composer | Person) {
  const aliases = uniqueStrings(entity.aliases || []);
  return (
    aliases.find((value) => /[\u3400-\u9fff]/.test(value) && value.length < entity.name.length) ||
    aliases.find((value) => /[\u3400-\u9fff]/.test(value) && value !== entity.name) ||
    entity.name
  );
}

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = error.cause && typeof error.cause === "object" ? error.cause : null;
  const code = cause && "code" in cause ? String(cause.code) : "";
  const details = cause && "message" in cause ? String(cause.message) : "";
  return [error.message, code, details].filter(Boolean).join(" | ");
}

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s·.,'"()\-_/]+/g, "")
    .trim();
}

function extractYearPair(value: string) {
  const matched = value.match(/(1[6-9]\d{2}|20\d{2}).{0,8}(1[6-9]\d{2}|20\d{2})/);
  if (!matched) {
    return { birthYear: undefined, deathYear: undefined };
  }
  return {
    birthYear: Number(matched[1]),
    deathYear: Number(matched[2]),
  };
}

function extractCountry(value: string) {
  const text = String(value || "");
  return countryPatterns.find((item) => item.tokens.some((token) => text.includes(token)))?.value ?? "";
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[‐‑‒–—]+/g, "-")
    .trim();
}

function sanitizeLatinDisplayName(value: string) {
  return normalizeWhitespace(
    String(value || "")
      .replace(/[,，]\s*(\d{3,4}|\d{1,2}\s*年.*)$/g, "")
      .replace(/\s*[（(]\s*(\d{3,4}|\d{1,2}\s*年.*)[)）]\s*$/g, "")
      .replace(/\s*(\d{4}\s*[-–—]\s*\d{4}|\d{4}\s*年.*)$/g, "")
      .replace(/\s+\|\s+.*$/, "")
      .replace(/[，,;；:：、\-\s]+$/g, "")
      .replace(/\s{2,}.*/, ""),
  );
}

function sanitizeBaiduTitle(value: string) {
  return normalizeWhitespace(
    String(value || "")
      .replace(/[_\-—–|｜]\s*百度百科.*$/i, "")
      .replace(/\s*-\s*百度百科.*$/i, "")
      .replace(/\s*百度百科.*$/i, ""),
  );
}

function extractLatinNameFromMixedText(value: string) {
  const matched = String(value || "").match(/[（(]([A-Za-zÀ-ÿ][^（）()]{2,120})[)）]/);
  return normalizeWhitespace(matched?.[1] || "");
}

function extractChineseLead(value: string) {
  const matched = String(value || "").match(/^([\u3400-\u9fff·•・．\s]{2,40})/);
  return normalizeWhitespace(matched?.[1] || "").replace(/\s+/g, "");
}

function sanitizeChineseName(value: string) {
  return normalizeWhitespace(
    String(value || "")
      .replace(/[（(][^（）()]{0,80}[)）]/g, " ")
      .replace(/[,，;；:：|｜].*$/g, "")
      .replace(/\s+/g, "")
      .trim(),
  );
}

function looksLikeChineseName(value: string) {
  return /^[\u3400-\u9fff·•・．]{2,24}$/.test(sanitizeChineseName(value));
}

function scoreChineseName(value: string, candidateScore: number, referenceName = "") {
  const normalized = sanitizeChineseName(value);
  if (!looksLikeChineseName(normalized)) {
    return -1;
  }
  const separatorBoost = /[·•・．]/.test(normalized) ? 8 : 0;
  const lengthBoost = Math.min(normalized.length, 16);
  const sameAsReferencePenalty = normalized === sanitizeChineseName(referenceName) ? 4 : 0;
  return candidateScore + separatorBoost + lengthBoost - sameAsReferencePenalty;
}

function pickBestChineseFullName(entity: Composer | Person, candidates: EntitySourceCandidate[]) {
  const options = [
    ...candidates.flatMap((candidate) => [
      { value: candidate.displayFullName, score: scoreEntityCandidate(candidate) + 16 },
      ...(candidate.aliases || []).map((value) => ({ value, score: scoreEntityCandidate(candidate) + 8 })),
      { value: extractChineseLead(candidate.summary), score: scoreEntityCandidate(candidate) + 4 },
    ]),
    { value: entity.name, score: 12 },
  ]
    .map((option) => ({
      value: sanitizeChineseName(option.value || ""),
      score: scoreChineseName(option.value || "", option.score, entity.name),
    }))
    .filter((option) => option.score >= 0)
    .sort((left, right) => right.score - left.score);

  return options[0]?.value || "";
}

function pickBestChineseShortName(entity: Composer | Person, candidates: EntitySourceCandidate[], fullName: string) {
  const options = [
    ...candidates.flatMap((candidate) => [
      { value: candidate.displayName, score: scoreEntityCandidate(candidate) + 12 },
      ...(candidate.aliases || []).map((value) => ({ value, score: scoreEntityCandidate(candidate) + 5 })),
    ]),
    { value: getEntityShortChineseName(entity), score: 10 },
    { value: entity.name, score: 8 },
    { value: fullName, score: 4 },
  ]
    .map((option) => {
      const value = sanitizeChineseName(option.value || "");
      const shortPenalty = value.length > 6 ? 18 : 0;
      return {
        value,
        score: scoreChineseName(option.value || "", option.score, fullName) - shortPenalty,
      };
    })
    .filter((option) => option.score >= 0)
    .sort((left, right) => right.score - left.score);

  return options[0]?.value || "";
}

function extractMetaContent(html: string, key: string, attr: "property" | "name" = "property") {
  const patternA = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
  const patternB = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`, "i");
  return html.match(patternA)?.[1] || html.match(patternB)?.[1] || "";
}

function extractBaiduBaikeImageUrl(html: string) {
  const patterns = [
    /https?:\/\/bkimg\.cdn\.bcebos\.com\/pic\/[^\s"'<>\\]+/gi,
    /https?:\/\/pic\.rmb\.bdstatic\.com\/[^\s"'<>\\]+/gi,
    /https?:\/\/baikebcs\.bdimg\.com\/[^\s"'<>\\]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    const usable = matches.find((value) => !/logo|favicon|default|placeholder|sprite/i.test(value));
    if (usable) {
      return usable.replace(/&amp;/g, "&");
    }
  }

  return "";
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function scoreEntityCandidate(candidate: EntitySourceCandidate) {
  const imageBoost = candidate.imageUrl ? 20 : 0;
  const summaryBoost = candidate.summary ? Math.min(candidate.summary.length / 6, 15) : 0;
  const fieldBoost = [
    candidate.country,
    candidate.birthYear,
    candidate.deathYear,
    candidate.displayName,
    candidate.displayFullName,
    candidate.displayLatinName,
    candidate.aliases?.length,
    candidate.abbreviations?.length,
  ].filter(Boolean).length * 6;
  const sourceBoost =
    candidate.sourceKind === "wikimedia-commons"
      ? 36
      : candidate.sourceKind === "wikipedia"
        ? 32
        : candidate.sourceKind === "baidu-baike"
          ? 30
          : candidate.sourceKind === "llm"
            ? 28
            : 16;
  const confidenceBoost = Math.round((candidate.confidence ?? 0.55) * 25);
  return sourceBoost + imageBoost + summaryBoost + fieldBoost + confidenceBoost;
}

async function fetchWikipediaEntityCandidate(name: string, fetchImpl: typeof fetch): Promise<EntitySourceCandidate | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(name)}`;
  let searchResponse;
  try {
    searchResponse = await fetchImpl(searchUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" } });
  } catch (error) {
    throw new Error(`Wikipedia search request failed for ${name}: ${describeFetchError(error)}`);
  }
  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search failed for ${name}: HTTP ${searchResponse.status}`);
  }

  const searchPayload = (await searchResponse.json()) as {
    query?: { search?: Array<{ title: string }> };
  };
  const title = searchPayload.query?.search?.[0]?.title;
  if (!title) {
    return null;
  }

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  let summaryResponse;
  try {
    summaryResponse = await fetchImpl(summaryUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" } });
  } catch (error) {
    throw new Error(`Wikipedia summary request failed for ${title}: ${describeFetchError(error)}`);
  }
  if (!summaryResponse.ok) {
    return null;
  }

  const summaryPayload = (await summaryResponse.json()) as {
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    title?: string;
  };
  const text = `${summaryPayload.description ?? ""} ${summaryPayload.extract ?? ""}`;
  const years = extractYearPair(text);
  const country = extractCountry(text);

  return {
    sourceUrl: summaryPayload.content_urls?.desktop?.page || summaryUrl,
    sourceKind: summaryPayload.originalimage?.source || summaryPayload.thumbnail?.source ? "wikimedia-commons" : "wikipedia",
    sourceLabel: "Wikipedia",
    summary: summaryPayload.extract ?? "",
    imageUrl: summaryPayload.originalimage?.source || summaryPayload.thumbnail?.source || "",
    imageAttribution: summaryPayload.title ? `Wikipedia: ${summaryPayload.title}` : "Wikipedia",
    birthYear: years.birthYear,
    deathYear: years.deathYear,
    country,
    displayLatinName: sanitizeLatinDisplayName(summaryPayload.title || title || name),
    confidence: 0.82,
  };
}

async function fetchBaiduBaikeCandidate(name: string, fetchImpl: typeof fetch): Promise<EntitySourceCandidate | null> {
  const urls = [
    `https://baike.baidu.com/item/${encodeURIComponent(name)}`,
    `https://baike.baidu.com/search/word?word=${encodeURIComponent(name)}`,
  ];

  for (const url of urls) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" },
      });
    } catch (error) {
      throw new Error(`Baidu Baike request failed for ${name}: ${describeFetchError(error)}`);
    }

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const rawTitle = extractMetaContent(html, "og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
    const title = sanitizeBaiduTitle(rawTitle);
    const summary = stripHtml(extractMetaContent(html, "description", "name") || extractMetaContent(html, "og:description"));
    const imageUrl = extractBaiduBaikeImageUrl(html);
    const text = `${title} ${summary}`;
    const years = extractYearPair(text);
    const country = extractCountry(text);
    const displayLatinName = sanitizeLatinDisplayName(extractLatinNameFromMixedText(summary) || extractLatinNameFromMixedText(text));
    const displayFullName = extractChineseLead(title) || extractChineseLead(summary);
    const displayName = normalizeWhitespace(name) || displayFullName;

    if (!title && !summary && !imageUrl) {
      continue;
    }

    return {
      sourceUrl: response.url || url,
      sourceKind: "baidu-baike",
      sourceLabel: "Baidu Baike",
      summary,
      imageUrl,
      imageAttribution: title ? `Baidu Baike: ${stripHtml(title)}` : "Baidu Baike",
      birthYear: years.birthYear,
      deathYear: years.deathYear,
      country,
      displayName,
      displayFullName,
      displayLatinName,
      confidence: 0.72,
    };
  }

  return null;
}

async function fetchBaiduSearchSnippetCandidate(name: string, fetchImpl: typeof fetch): Promise<EntitySourceCandidate | null> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(name)}`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" },
    });
  } catch (error) {
    throw new Error(`Baidu search request failed for ${name}: ${describeFetchError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Baidu search failed for ${name}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const rawTitle =
    html.match(/<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    html.match(/class=["']c-title["'][^>]*>\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    "";
  const title = sanitizeBaiduTitle(stripHtml(rawTitle));
  const summary =
    html.match(/class=["']c-abstract["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/class=["']content-right_8Zs40["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    "";
  const firstHref = html.match(/<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["']/i)?.[1] || url;
  const text = stripHtml(`${title} ${summary}`);
  const years = extractYearPair(text);
  const country = extractCountry(text);
  const displayLatinName = extractLatinNameFromMixedText(text);
  const displayFullName = extractChineseLead(title) || extractChineseLead(text);
  const displayName = normalizeWhitespace(name) || displayFullName;

  if (!text) {
    return null;
  }

  return {
    sourceUrl: response.url || url,
    sourceKind: "other",
    sourceLabel: "Baidu Search",
    summary: text,
    imageUrl: "",
    imageAttribution: title ? `Baidu Search: ${stripHtml(title)}` : "Baidu Search",
    birthYear: years.birthYear,
    deathYear: years.deathYear,
    country,
    displayName,
    displayFullName,
    displayLatinName,
    confidence: 0.58,
  };
}

async function fetchWikimediaCommonsImageCandidate(name: string, fetchImpl: typeof fetch): Promise<EntitySourceCandidate | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&iilimit=1&format=json&origin=*`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" },
    });
  } catch (error) {
    throw new Error(`Wikimedia Commons request failed for ${name}: ${describeFetchError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Wikimedia Commons failed for ${name}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            extmetadata?: {
              Artist?: { value?: string };
              Credit?: { value?: string };
              LicenseShortName?: { value?: string };
            };
          }>;
        }
      >;
    };
  };

  const usable = Object.values(payload.query?.pages || {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      const title = normalizeWhitespace((page.title || "").replace(/^File:/i, ""));
      const imageUrl = info?.thumburl || info?.url || "";
      const attribution = normalizeWhitespace(
        stripHtml(
          info?.extmetadata?.Artist?.value ||
            info?.extmetadata?.Credit?.value ||
            info?.extmetadata?.LicenseShortName?.value ||
            "Wikimedia Commons",
        ),
      );
      const score = (title.toLowerCase().includes(name.toLowerCase()) ? 2 : 0) + (/\.(jpe?g|png|webp)$/i.test(imageUrl) ? 1 : 0);
      return { title, imageUrl, attribution, score };
    })
    .filter((item) => item.imageUrl && !/logo|icon|signature|autograph|wordmark/i.test(`${item.title} ${item.imageUrl}`))
    .sort((left, right) => right.score - left.score)[0];

  if (!usable) {
    return null;
  }

  return {
    sourceUrl: url,
    sourceKind: "wikimedia-commons",
    sourceLabel: "Wikimedia Commons",
    summary: "",
    imageUrl: usable.imageUrl,
    imageAttribution: usable.attribution,
    displayLatinName: sanitizeLatinDisplayName(name),
    confidence: 0.76,
  };
}

async function fetchLlmEntityCandidate(
  entity: Composer | Person,
  entityType: "composer" | "person",
  llmConfig?: LlmConfig,
  fetchImpl?: typeof fetch,
): Promise<EntitySourceCandidate | null> {
  if (!isLlmConfigured(llmConfig)) {
    return null;
  }

  const title = uniqueStrings([entity.nameLatin, entity.name]).slice(0, 2).join(" / ");
  const candidate = await generateEntityKnowledgeCandidate({
    config: llmConfig,
    title,
    entityType,
    roles: "roles" in entity ? entity.roles : [],
    knownDisplayName: getEntityShortChineseName(entity),
    knownDisplayFullName: entity.name,
    knownDisplayLatinName: entity.nameLatin,
    knownAliases: entity.aliases,
    knownAbbreviations: getEntityAbbreviations(entity),
    fetchImpl,
  });
  if (!candidate) {
    return null;
  }

  return {
    sourceUrl: llmConfig.baseUrl,
    sourceKind: "llm",
    sourceLabel: "LLM",
    summary: candidate.summary || "",
    imageUrl: "",
    imageAttribution: llmConfig.model,
    birthYear: candidate.birthYear,
    deathYear: candidate.deathYear,
    country: candidate.country,
    displayName: candidate.displayName,
    displayFullName: candidate.displayFullName,
    displayLatinName: sanitizeLatinDisplayName(candidate.displayLatinName || ""),
    aliases: candidate.aliases,
    abbreviations: candidate.abbreviations,
    confidence: candidate.confidence ?? 0.65,
    rationale: candidate.rationale,
  };
}

async function collectEntitySourceCandidates(
  entity: Composer | Person,
  entityType: "composer" | "person",
  fetchImpl: typeof fetch,
  llmConfig?: LlmConfig,
) {
  const westernTerms = uniqueStrings([entity.nameLatin, entity.name, ...entity.aliases]).slice(0, 4);
  const chineseTerms = uniqueStrings([entity.name, ...entity.aliases]).slice(0, 4);

  const runUntilHit = async (terms: string[], resolver: (term: string) => Promise<EntitySourceCandidate | null>) => {
    const failures: string[] = [];
    for (const term of terms) {
      try {
        const candidate = await resolver(term);
        if (candidate) {
          return candidate;
        }
      } catch (error) {
        failures.push(`${term}: ${describeFetchError(error)}`);
      }
    }
    if (failures.length === terms.length && failures.length > 0) {
      throw new Error(failures.join(" || "));
    }
    return null;
  };

  const tasks: Array<{ label: string; run: () => Promise<EntitySourceCandidate | null> }> = [
    {
      label: "Wikipedia",
      run: () => runUntilHit(westernTerms.length ? westernTerms : [entity.name], (term) => fetchWikipediaEntityCandidate(term, fetchImpl)),
    },
    {
      label: "Baidu Baike",
      run: () => runUntilHit(chineseTerms.length ? chineseTerms : [entity.name], (term) => fetchBaiduBaikeCandidate(term, fetchImpl)),
    },
  ];

  if (isLlmConfigured(llmConfig)) {
    tasks.push({ label: "LLM", run: () => fetchLlmEntityCandidate(entity, entityType, llmConfig, fetchImpl) });
  }

  tasks.push({
    label: "Baidu Search",
    run: () => runUntilHit(chineseTerms.length ? chineseTerms : [entity.name], (term) => fetchBaiduSearchSnippetCandidate(term, fetchImpl)),
  });
  tasks.push({
    label: "Wikimedia Commons",
    run: () =>
      runUntilHit(
        westernTerms.length ? westernTerms : [entity.nameLatin || entity.name],
        (term) => fetchWikimediaCommonsImageCandidate(term, fetchImpl),
      ),
  });

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));
  const candidates: EntitySourceCandidate[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const label = tasks[index]?.label || "Unknown source";
    if (result.status === "fulfilled") {
      if (result.value) {
        candidates.push(result.value);
      } else {
        errors.push(`${label}: no result`);
      }
      return;
    }
    errors.push(`${label}: ${describeFetchError(result.reason)}`);
  });

  return { candidates, errors };
}

function buildEntityImageCandidates(entity: Composer | Person, candidates: EntitySourceCandidate[]) {
  const rawCandidates: AutomationImageCandidate[] = candidates
    .filter((candidate) => candidate.imageUrl)
    .map((candidate, index) => {
      const sourceKind: AutomationImageCandidate["sourceKind"] =
        candidate.sourceKind === "llm"
          ? "other"
          : candidate.sourceKind === "baidu-baike"
            ? "other"
            : candidate.sourceKind;
      return {
        id: `${entity.id}-image-${index}`,
        src: candidate.imageUrl,
        sourceUrl: candidate.sourceUrl,
        sourceKind,
        attribution: candidate.imageAttribution,
        title: candidate.displayFullName || candidate.displayLatinName || entity.nameLatin || entity.name,
        width: 1200,
        height: 1200,
      };
    });

  return rankImageCandidates(
    {
      title: entity.nameLatin || entity.name,
      entityKind:
        "roles" in entity && (entity.roles.includes("orchestra") || entity.roles.includes("ensemble") || entity.roles.includes("chorus"))
          ? "group"
          : "person",
    },
    rawCandidates,
  );
}

function chooseBestFieldCandidate(candidates: EntitySourceCandidate[], selector: (candidate: EntitySourceCandidate) => unknown) {
  return [...candidates]
    .filter((candidate) => selector(candidate))
    .sort((left, right) => scoreEntityCandidate(right) - scoreEntityCandidate(left))[0];
}

function looksLikeInstitutionAlias(value: string) {
  return /philharmonic|orchestra|ensemble|chorus|symphony|quartet|trio|愛樂|爱乐|樂團|乐团|交响乐团|交響樂團|合唱團|合唱团/.test(
    normalizeWhitespace(value).toLowerCase(),
  );
}

function containsRecordingContextNoise(value: string) {
  return /(?:19\d{2}|20\d{2}|youtube|bilibili|apple music|spotify|live|recording|concert|album|version|录音|现场|演出|版本|专辑)/i.test(
    normalizeWhitespace(value),
  );
}

function isAllowedAliasForEntity(entity: Composer | Person, value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || sanitizeChineseName(normalized) === sanitizeChineseName(entity.name) || normalized === entity.nameLatin) {
    return false;
  }
  if (containsRecordingContextNoise(normalized)) {
    return false;
  }
  if ("roles" in entity && !entity.roles.some((role) => ["orchestra", "ensemble", "chorus"].includes(role))) {
    if (/^[A-Z]{2,10}$/.test(normalized) || looksLikeInstitutionAlias(normalized)) {
      return false;
    }
  }
  return true;
}

function mergeAliases(entity: Composer | Person, existing: string[], incoming: string[] = []) {
  return [
    ...new Set(
      [...existing, ...incoming]
        .map((value) => String(value ?? "").trim())
        .filter((value) => isAllowedAliasForEntity(entity, value)),
    ),
  ];
}

function applyFieldPreview<T extends Record<string, unknown>>(entity: T, fields: AutomationProposal["fields"]) {
  const next = structuredClone(entity);
  for (const field of fields) {
    const segments = field.path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
    let current: unknown = next;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      const nextSegment = segments[index + 1];
      if (typeof segment === "number") {
        if (!Array.isArray(current)) {
          current = undefined;
          break;
        }
        current[segment] ??= typeof nextSegment === "number" ? [] : {};
        current = current[segment];
        continue;
      }
      const record = current as Record<string, unknown>;
      record[segment] ??= typeof nextSegment === "number" ? [] : {};
      current = record[segment];
    }
    if (typeof current === "undefined") {
      continue;
    }
    const finalSegment = segments.at(-1);
    if (typeof finalSegment === "undefined") {
      continue;
    }
    if (typeof finalSegment === "number") {
      if (Array.isArray(current)) {
        current[finalSegment] = field.after;
      }
      continue;
    }
    (current as Record<string, unknown>)[finalSegment] = field.after;
  }
  return next;
}

function looksLikeShortChineseName(value: string) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 && normalized.length <= 4;
}

function shouldRefreshEntityImage(entity: Composer | Person) {
  const haystack = `${entity.avatarSrc ?? ""} ${entity.imageSourceUrl ?? ""} ${entity.imageAttribution ?? ""} ${entity.imageSourceKind ?? ""}`;
  if (!String(entity.avatarSrc || "").trim()) {
    return true;
  }
  return isSuspiciousImageCandidate({
    id: `${entity.id}-current-image`,
    src: entity.avatarSrc,
    sourceUrl: entity.imageSourceUrl || entity.avatarSrc,
    sourceKind: entity.imageSourceKind || "other",
    attribution: entity.imageAttribution,
    title: entity.nameLatin || entity.name,
  }) || /baidu|baike|logo|favicon|placeholder|sprite|default/i.test(haystack);
}

function collectEntityCompletionIssues(entity: Composer | Person) {
  const issues: string[] = [];
  if (!String(entity.name || "").trim()) {
    issues.push("中文全名仍为空，未达到规范。");
  }
  if (!String(entity.nameLatin || "").trim()) {
    issues.push("英文或原文全名仍为空，未达到规范。");
  }
  if (looksLikeShortChineseName(getEntityShortChineseName(entity)) && getEntityShortChineseName(entity) === entity.name) {
    issues.push("缺少可区分的中文别名或简称，未达到规范。");
  }
  if ("roles" in entity && entity.roles.some((role) => ["orchestra", "ensemble", "chorus"].includes(role)) && getEntityAbbreviations(entity).length === 0) {
    issues.push("团体简称或缩写仍为空，未达到规范。");
  }
  if (shouldRefreshEntityImage(entity)) {
    issues.push("当前图片缺失或疑似为无效图片，仍需刷新以满足规范。");
  }
  return issues;
}

export function reviewAutomationProposalQuality(entity: Composer | Person, proposals: AutomationProposal[]) {
  const mergedPreview = applyFieldPreview(entity as Record<string, unknown>, proposals.flatMap((proposal) => proposal.fields || [])) as Composer | Person;
  const issues = collectEntityCompletionIssues(mergedPreview);
  const imageCandidates = proposals.flatMap((proposal) => proposal.imageCandidates || []);
  if (imageCandidates.some((candidate) => isSuspiciousImageCandidate(candidate))) {
    issues.push("图片候选疑似为站点 logo 或占位图。");
  }
  const hasChanges = proposals.some(
    (proposal) => (proposal.fields?.length ?? 0) > 0 || (proposal.imageCandidates?.length ?? 0) > 0 || (proposal.mergeCandidates?.length ?? 0) > 0,
  );
  const status = hasChanges ? (issues.length === 0 ? "ok" : "needs-attention") : issues.length === 0 ? "already-complete" : "needs-attention";
  return {
    ok: status === "ok",
    status,
    issues,
    preview: mergedPreview,
    hasChanges,
  };
}

async function inspectNamedEntity(
  entity: Composer | Person,
  entityType: "composer" | "person",
  fetchImpl: typeof fetch,
  llmConfig?: LlmConfig,
): Promise<AutomationProposal | null> {
  const { candidates, errors } = await collectEntitySourceCandidates(entity, entityType, fetchImpl, llmConfig);
  const existingIssues = collectEntityCompletionIssues(entity);
  const warnings = [...errors];
  if (!candidates.length) {
    if (!existingIssues.length) {
      return null;
    }
    return {
      id: `${entity.id}-${entityType}-review-only`,
      kind: "update",
      entityType,
      entityId: entity.id,
      summary: `自动复查：${entity.name}`,
      risk: "high",
      status: "pending",
      sources: [],
      fields: [],
      imageCandidates: [],
      warnings: uniqueStrings([
        ...warnings,
        ...existingIssues,
        "本轮未获取到可靠来源，请人工补录、启用 LLM 或稍后重试。",
      ]),
    };
  }

  const fields = [] as AutomationProposal["fields"];

  const chineseFullName = pickBestChineseFullName(entity, candidates);
  const chineseShortName = pickBestChineseShortName(entity, candidates, chineseFullName || entity.name);

  const summaryCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.summary);
  if (!entity.summary && summaryCandidate?.summary) {
    const llmSummary =
      llmConfig && summaryCandidate.sourceKind !== "llm"
        ? await generateConciseChineseSummary({
            config: llmConfig,
            title: entity.nameLatin || entity.name,
            sourceText: summaryCandidate.summary,
            fetchImpl,
          })
        : "";
    fields.push({ path: "summary", before: entity.summary, after: llmSummary || summaryCandidate.summary });
  }

  const countryCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.country);
  if (!entity.country && countryCandidate?.country) {
    fields.push({ path: "country", before: entity.country, after: countryCandidate.country });
  }

  const birthYearCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.birthYear);
  if (!entity.birthYear && birthYearCandidate?.birthYear) {
    fields.push({ path: "birthYear", before: entity.birthYear, after: birthYearCandidate.birthYear });
  }

  const deathYearCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.deathYear);
  if (!entity.deathYear && deathYearCandidate?.deathYear) {
    fields.push({ path: "deathYear", before: entity.deathYear, after: deathYearCandidate.deathYear });
  }

  const displayNameCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.displayName);
  const nextDisplayName =
    chineseShortName ||
    sanitizeChineseName(displayNameCandidate?.displayName || "") ||
    sanitizeChineseName(getEntityShortChineseName(entity) || entity.name || "");

  const displayFullNameCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.displayFullName);
  const nextFullName =
    chineseFullName ||
    sanitizeChineseName(displayFullNameCandidate?.displayFullName || "") ||
    sanitizeChineseName(entity.name || "");
  if (nextFullName && nextFullName !== entity.name) {
    fields.push({ path: "name", before: entity.name, after: nextFullName });
  }

  const displayLatinNameCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.displayLatinName);
  if (!entity.nameLatin && displayLatinNameCandidate?.displayLatinName) {
    fields.push({ path: "nameLatin", before: entity.nameLatin, after: displayLatinNameCandidate.displayLatinName });
  }

  const abbreviationsCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.abbreviations?.length);
  const aliasesCandidate = chooseBestFieldCandidate(candidates, (candidate) => candidate.aliases?.length);
  const aliasIncoming = mergeAliases(entity, aliasesCandidate?.aliases || [], [
    ...(abbreviationsCandidate?.abbreviations || []),
    nextFullName,
    nextDisplayName,
  ]);
  if (aliasIncoming.length) {
    const mergedAliases = mergeAliases(entity, entity.aliases || [], aliasIncoming);
    if (mergedAliases.length > (entity.aliases?.length ?? 0)) {
      fields.push({ path: "aliases", before: entity.aliases, after: mergedAliases });
    }
  }

  const imageNeedsRefresh = shouldRefreshEntityImage(entity);
  const imageCandidates = imageNeedsRefresh ? buildEntityImageCandidates(entity, candidates).filter((candidate) => !isSuspiciousImageCandidate(candidate)) : [];
  warnings.push(
    ...uniqueStrings(
      candidates
        .filter((candidate) => candidate.sourceKind === "llm" && candidate.rationale)
        .map((candidate) => `LLM 说明：${candidate.rationale}`),
    ),
  );
  if (!imageCandidates.length && imageNeedsRefresh) {
    warnings.push("未找到可用图片候选。");
  }
  if (candidates.some((candidate) => candidate.imageUrl) && imageCandidates.length === 0 && imageNeedsRefresh) {
    warnings.push("现有图片候选已因疑似 logo、占位图或低质量而被过滤。");
  }
  if (imageNeedsRefresh && entity.avatarSrc) {
    warnings.push("当前图片疑似为 logo、占位图或低质量图片，正在尝试替换。");
  }

  const reviewIssues = collectEntityCompletionIssues(applyFieldPreview(entity as Record<string, unknown>, fields) as Composer | Person);
  if (fields.length === 0 && imageCandidates.length === 0) {
    if (!reviewIssues.length) {
      return null;
    }
    return {
      id: `${entity.id}-${entityType}-review-only`,
      kind: "update",
      entityType,
      entityId: entity.id,
      summary: `自动复查：${entity.name}`,
      risk: reviewIssues.length ? "medium" : "low",
      status: "pending",
      sources: uniqueStrings(candidates.map((candidate) => candidate.sourceUrl)),
      fields: [],
      imageCandidates: [],
      warnings: uniqueStrings([
        ...warnings,
        ...reviewIssues,
        reviewIssues.length ? "当前没有可直接采用的候选，请人工补录、启用 LLM 或再次检查。" : "本轮未发现需要新增的信息。",
      ]),
    };
  }

  return {
    id: `${entity.id}-${entityType}-auto`,
    kind: "update",
    entityType,
    entityId: entity.id,
    summary: `自动检查：${entity.name}`,
    risk: imageCandidates.length && fields.length ? "medium" : "low",
    status: "pending",
    sources: uniqueStrings(candidates.map((candidate) => candidate.sourceUrl)),
    fields,
    imageCandidates,
    warnings,
  };
}

function extractYoutubeThumbnail(url: string) {
  try {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.replace(/^\//, "").trim();
    } else {
      videoId = parsed.searchParams.get("v") || "";
    }
    if (!videoId) {
      return null;
    }
    return {
      src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: url,
      sourceKind: "streaming" as const,
      attribution: "YouTube thumbnail",
      title: "YouTube thumbnail",
      width: 480,
      height: 360,
    };
  } catch {
    return null;
  }
}

async function fetchOpenGraphImageCandidate(url: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClassicalGuideBot/1.0)" },
    });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const imageUrl = extractMetaContent(html, "og:image");
    if (!imageUrl) {
      return null;
    }
    const title = extractMetaContent(html, "og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
    const hostname = new URL(url).hostname.toLowerCase();
    const sourceKind: "streaming" | "official-site" = hostname.includes("youtube") || hostname.includes("bilibili") ? "streaming" : "official-site";

    return {
      src: imageUrl,
      sourceUrl: url,
      sourceKind,
      attribution: hostname,
      title: stripHtml(title),
      width: 1200,
      height: 1200,
    };
  } catch {
    return null;
  }
}

async function inspectRecordingsViaProvider(
  library: LibraryData,
  recordings: Recording[],
  fetchImpl: typeof fetch,
  options?: RunAutomationChecksOptions,
) {
  if (!options?.recordingProvider) {
    throw new Error("版本自动检索工具未配置或不可用，当前不会回退到本地版本自动检查。");
  }
  if (recordings.length === 0) {
    return {
      proposals: [] as AutomationProposal[],
      provider: undefined,
    };
  }

  const request = buildRecordingRetrievalRequest(library, recordings, options.recordingRequestOptions);
  const execution = await executeRecordingRetrievalJob(
    options.recordingProvider,
    request,
    fetchImpl,
    options.recordingExecutionOptions,
  );

  return {
    proposals: translateRecordingRetrievalResultsToProposals(library, execution),
    provider: execution.runtimeState,
  };
}

function normalizeComparableText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s·.,'"()\-_/]+/g, " ")
    .trim();
}

function buildWorkSearchQueries(work: Work, library: LibraryData) {
  const composer = library.composers.find((item) => item.id === work.composerId);
  return [
    [composer?.name, composer?.nameLatin, work.title].filter(Boolean).join(" "),
    [composer?.nameLatin, work.titleLatin || work.title].filter(Boolean).join(" "),
    [work.title, work.titleLatin, work.catalogue].filter(Boolean).join(" "),
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
}

function extractCatalogueFromText(value: string) {
  return (
    String(value || "").match(
      /\b(?:Op\.?\s*\d+[a-z0-9-]*|BWV\s*\d+[a-z0-9-]*|K(?:V)?\.?\s*\d+[a-z0-9-]*|D\.?\s*\d+[a-z0-9-]*|S\.?\s*\d+[a-z0-9-]*|Hob\.?\s*[A-Z0-9:. -]+)\b/i,
    )?.[0] || ""
  ).trim();
}

function selectWorkLatinTitle(candidateTitle: string, work: Work) {
  const normalizedCandidate = normalizeWhitespace(candidateTitle);
  if (!normalizedCandidate || !/[A-Za-z]/.test(normalizedCandidate)) {
    return "";
  }
  if (normalizeComparableText(normalizedCandidate) === normalizeComparableText(work.titleLatin || work.title)) {
    return "";
  }
  return normalizedCandidate;
}

function matchesWorkCandidate(work: Work, composer: Composer | undefined, ...values: string[]) {
  const haystack = normalizeComparableText(values.join(" "));
  if (!haystack) {
    return false;
  }
  const workTokens = [work.title, work.titleLatin, ...(work.aliases || [])]
    .flatMap((value) => normalizeComparableText(value).split(" "))
    .filter((token) => token.length >= 2);
  const composerTokens = [composer?.name || "", composer?.nameLatin || ""]
    .flatMap((value) => normalizeComparableText(value).split(" "))
    .filter((token) => token.length >= 2);
  const workMatched = workTokens.some((token) => haystack.includes(token));
  const composerMatched = composerTokens.length === 0 || composerTokens.some((token) => haystack.includes(token));
  return workMatched && composerMatched;
}

async function fetchWikipediaWorkCandidate(work: Work, library: LibraryData, fetchImpl: typeof fetch) {
  const queries = buildWorkSearchQueries(work, library);
  for (const query of queries) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(query)}`;
      const searchResponse = await fetchImpl(searchUrl);
      if (!searchResponse.ok) {
        continue;
      }
      const searchPayload = (await searchResponse.json().catch(() => ({}))) as {
        query?: { search?: Array<{ title?: string }> };
      };
      const title = normalizeWhitespace(searchPayload.query?.search?.[0]?.title || "");
      if (!title) {
        continue;
      }
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryResponse = await fetchImpl(summaryUrl);
      if (!summaryResponse.ok) {
        continue;
      }
      const summaryPayload = (await summaryResponse.json().catch(() => ({}))) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      const summary = stripHtml(summaryPayload.extract || "");
      const sourceUrl = summaryPayload.content_urls?.desktop?.page || summaryUrl;
      const composer = library.composers.find((item) => item.id === work.composerId);
      if (!matchesWorkCandidate(work, composer, title, summary, query)) {
        continue;
      }
      return {
        sourceUrl,
        sourceLabel: "Wikipedia",
        titleLatin: selectWorkLatinTitle(summaryPayload.title || title, work),
        catalogue: extractCatalogueFromText(`${summaryPayload.title || ""} ${summary}`),
        summary,
        confidence: 0.86,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function filterWorks(library: LibraryData, request: AutomationCheckRequest) {
  let works = library.works;

  if (request.workIds?.length) {
    const ids = new Set(request.workIds);
    works = works.filter((work) => ids.has(work.id));
  }

  if (request.composerIds?.length) {
    const composerIds = new Set(request.composerIds);
    works = works.filter((work) => composerIds.has(work.composerId));
  }

  if (request.recordingIds?.length) {
    const workIds = new Set(
      library.recordings.filter((recording) => request.recordingIds?.includes(recording.id)).map((recording) => recording.workId),
    );
    works = works.filter((work) => workIds.has(work.id));
  }

  if (request.conductorIds?.length || request.artistIds?.length || request.orchestraIds?.length) {
    const relatedRecordingWorkIds = new Set(filterRecordings(library, request).map((recording) => recording.workId));
    works = works.filter((work) => relatedRecordingWorkIds.has(work.id));
  }

  return works;
}

async function inspectWorkEnhanced(
  work: Work,
  library: LibraryData,
  fetchImpl: typeof fetch,
  llmConfig?: LlmConfig,
): Promise<AutomationProposal | null> {
  const candidate = await fetchWikipediaWorkCandidate(work, library, fetchImpl);
  if (!candidate) {
    return null;
  }

  const fields: AutomationProposal["fields"] = [];
  if (!work.titleLatin && candidate.titleLatin) {
    fields.push({ path: "titleLatin", before: work.titleLatin, after: candidate.titleLatin });
  }
  if (!work.catalogue && candidate.catalogue) {
    fields.push({ path: "catalogue", before: work.catalogue, after: candidate.catalogue });
  }
  if (!work.summary && candidate.summary) {
    const llmSummary =
      llmConfig && isLlmConfigured(llmConfig)
        ? await generateConciseChineseSummary({
            config: llmConfig,
            title: work.titleLatin || work.title,
            sourceText: candidate.summary,
            fetchImpl,
          })
        : "";
    fields.push({ path: "summary", before: work.summary, after: llmSummary || candidate.summary });
  }

  if (!fields.length) {
    return null;
  }

  return {
    id: `${work.id}-work-auto`,
    kind: "update",
    entityType: "work",
    entityId: work.id,
    summary: `自动检查：${work.title}`,
    risk: "low",
    status: "pending",
    sources: [candidate.sourceUrl],
    fields,
    evidence: fields.map((field) => ({
      field: field.path,
      sourceUrl: candidate.sourceUrl,
      sourceLabel: candidate.sourceLabel,
      confidence: candidate.confidence,
    })),
    warnings: [],
  };
}

function selectPeopleByCategory(library: LibraryData, category: AutomationCheckCategory, request: AutomationCheckRequest) {
  if (category === "conductor") {
    const requestedIds = request.conductorIds?.length ? new Set(request.conductorIds) : null;
    return library.people.filter((person) => person.roles.includes("conductor") && (!requestedIds || requestedIds.has(person.id)));
  }

  if (category === "orchestra") {
    const requestedIds = request.orchestraIds?.length ? new Set(request.orchestraIds) : null;
    return library.people.filter((person) => person.roles.includes("orchestra") && (!requestedIds || requestedIds.has(person.id)));
  }

  const requestedIds = request.artistIds?.length ? new Set(request.artistIds) : null;
  return library.people.filter(
    (person) => person.roles.some((role) => artistRoles.includes(role)) && (!requestedIds || requestedIds.has(person.id)),
  );
}

function buildMergeProposals(people: Person[]) {
  const keyMap = new Map<string, Person[]>();

  people.forEach((person) => {
    const keys = new Set([
      normalizeName(person.name),
      normalizeName(person.nameLatin),
      ...person.aliases.map(normalizeName),
      ...getEntityAbbreviations(person).map(normalizeName),
    ].filter(Boolean));

    keys.forEach((key) => {
      const bucket = keyMap.get(key) ?? [];
      bucket.push(person);
      keyMap.set(key, bucket);
    });
  });

  const emitted = new Set<string>();
  const proposals: AutomationProposal[] = [];

  for (const [key, bucket] of keyMap.entries()) {
    const unique = [...new Map(bucket.map((item) => [item.id, item])).values()];
    if (!key || unique.length < 2) {
      continue;
    }
    const ids = unique.map((item) => item.id).sort();
    const signature = ids.join("|");
    if (emitted.has(signature)) {
      continue;
    }
    emitted.add(signature);

    proposals.push({
      id: `merge-${signature}`,
      kind: "merge",
      entityType: "person",
      entityId: ids[0],
      summary: `疑似重复人物：${unique.map((item) => item.name).join(" / ")}`,
      risk: "high",
      status: "pending",
      sources: [],
      fields: [],
      warnings: [`Close normalized key: ${key}`],
      mergeCandidates: unique.slice(1).map((item) => ({
        targetId: item.id,
        targetLabel: item.name,
        reason: `与 ${unique[0]?.name} 共享规范化名称或别名 ${key}`,
      })),
    });
  }

  return proposals;
}

function resolveCategories(request: AutomationCheckRequest): AutomationCheckCategory[] {
  const categories = request.categories?.length ? request.categories : request.entityTypes?.length ? request.entityTypes : [];
  return [...new Set(categories)].filter(Boolean) as AutomationCheckCategory[];
}

function filterRecordings(library: LibraryData, request: AutomationCheckRequest) {
  let recordings = library.recordings;

  if (request.recordingIds?.length) {
    const ids = new Set(request.recordingIds);
    recordings = recordings.filter((recording) => ids.has(recording.id));
  }

  if (request.workIds?.length) {
    const ids = new Set(request.workIds);
    recordings = recordings.filter((recording) => ids.has(recording.workId));
  }

  if (request.composerIds?.length) {
    const composerIds = new Set(request.composerIds);
    const allowedWorkIds = new Set(library.works.filter((work) => composerIds.has(work.composerId)).map((work) => work.id));
    recordings = recordings.filter((recording) => allowedWorkIds.has(recording.workId));
  }

  if (request.conductorIds?.length) {
    const ids = new Set(request.conductorIds);
    recordings = recordings.filter((recording) =>
      recording.credits.some((credit) => credit.role === "conductor" && credit.personId && ids.has(credit.personId)),
    );
  }

  if (request.artistIds?.length) {
    const ids = new Set(request.artistIds);
    recordings = recordings.filter((recording) =>
      recording.credits.some((credit) => credit.personId && ids.has(credit.personId) && credit.role !== "conductor"),
    );
  }

  if (request.orchestraIds?.length) {
    const ids = new Set(request.orchestraIds);
    recordings = recordings.filter((recording) =>
      recording.credits.some((credit) => credit.role === "orchestra" && credit.personId && ids.has(credit.personId)),
    );
  }

  return recordings;
}

export async function runAutomationChecks(
  library: LibraryData,
  request: AutomationCheckRequest,
  fetchImpl: typeof fetch = fetch,
  llmConfig?: LlmConfig,
  options?: RunAutomationChecksOptions,
): Promise<AutomationRun> {
  const categories = resolveCategories(request);
  const proposals: AutomationProposal[] = [];
  const notes: string[] = [];
  let provider: AutomationRun["provider"] | undefined;

  if (categories.includes("composer")) {
    const composers = request.composerIds?.length
      ? library.composers.filter((composer) => request.composerIds?.includes(composer.id))
      : library.composers;
    notes.push(`作曲家检查：${composers.length}`);
    for (const composer of composers) {
      const proposal = await inspectNamedEntity(composer, "composer", fetchImpl, llmConfig);
      if (proposal) {
        proposals.push(proposal);
      }
    }
  }

  const personCategories = categories.filter((category) => category === "conductor" || category === "orchestra" || category === "artist");
  if (personCategories.length > 0) {
    const selectedPeople = personCategories.flatMap((category) => selectPeopleByCategory(library, category, request));
    const uniquePeople = [...new Map(selectedPeople.map((person) => [person.id, person])).values()];
    notes.push(`人物检查：${uniquePeople.length}`);

    for (const person of uniquePeople) {
      const proposal = await inspectNamedEntity(person, "person", fetchImpl, llmConfig);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    const mergePool = personCategories.flatMap((category) => selectPeopleByCategory(library, category, {}));
    proposals.push(...buildMergeProposals([...new Map(mergePool.map((person) => [person.id, person])).values()]));
  }

  if (categories.includes("recording")) {
    const recordings = filterRecordings(library, request);
    notes.push(`版本检查：${recordings.length}`);
    const result = await inspectRecordingsViaProvider(library, recordings, fetchImpl, options);
    proposals.push(...result.proposals);
    provider = result.provider;
    if (result.provider) {
      notes.push(`版本自动检索工具：${result.provider.providerName} / ${result.provider.status}`);
    }
  }

  if (categories.includes("work")) {
    const works = filterWorks(library, request);
    notes.push(`作品检查：${works.length}`);
    for (const work of works) {
      const proposal = await inspectWorkEnhanced(work, library, fetchImpl, llmConfig);
      if (proposal) {
        proposals.push(proposal);
      }
    }
  }

  notes.push(`自动检查来源：Wikipedia / Baidu Baike${isLlmConfigured(llmConfig) ? " / LLM" : ""} / Baidu Search`);
  notes.push(isLlmConfigured(llmConfig) ? "LLM 已启用，并作为仅次于 Wikipedia / Baidu Baike 的候选来源参与字段判定。" : "LLM 未启用，当前为纯规则模式。");

  return createAutomationRun(library, {
    categories,
    proposals,
    notes,
    provider,
  });
}













