import { promises as fs } from "node:fs";
import path from "node:path";

import { validateArticles, type Article } from "./articles.js";
import { buildIndexes, type PersonLinkConfig } from "./indexes.js";
import { validateLibrary, type LibraryData } from "../../shared/src/schema.js";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const libraryDir = path.join(dataDir, "library");
const siteDataDir = path.join(dataDir, "site");
const generatedDir = path.join(rootDir, "apps", "site", "src", "generated");

const siteConfigDefaults = {
  title: "古典导聆不全书",
  subtitle: "公益性的古典音乐版本导聆目录",
  description: "",
  heroIntro: "",
  about: [],
  contact: {
    label: "",
    value: "",
  },
  copyrightNotice: "",
  lastImportedAt: "",
};

export type SiteConfig = typeof siteConfigDefaults;
export type ReviewQueueEntry = {
  entityId: string;
  entityType: "work" | "recording" | "person" | "composer";
  issue: string;
  sourcePath?: string;
  note?: string;
};

const fileMap = {
  composers: path.join(libraryDir, "composers.json"),
  people: path.join(libraryDir, "people.json"),
  personLinks: path.join(libraryDir, "person-links.json"),
  workGroups: path.join(libraryDir, "work-groups.json"),
  works: path.join(libraryDir, "works.json"),
  recordings: path.join(libraryDir, "recordings.json"),
  reviewQueue: path.join(libraryDir, "review-queue.json"),
  site: path.join(siteDataDir, "config.json"),
  articles: path.join(siteDataDir, "articles.json"),
  generatedLibrary: path.join(generatedDir, "library.json"),
  generatedIndexes: path.join(generatedDir, "indexes.json"),
  generatedSite: path.join(generatedDir, "site.json"),
  generatedArticles: path.join(generatedDir, "articles.json"),
} as const;

async function ensureDirectories() {
  await fs.mkdir(libraryDir, { recursive: true });
  await fs.mkdir(siteDataDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function loadLibraryFromDisk(): Promise<LibraryData> {
  await ensureDirectories();

  return validateLibrary({
    composers: await readJsonFile(fileMap.composers, []),
    people: await readJsonFile(fileMap.people, []),
    workGroups: await readJsonFile(fileMap.workGroups, []),
    works: await readJsonFile(fileMap.works, []),
    recordings: await readJsonFile(fileMap.recordings, []),
  });
}

export async function saveLibraryToDisk(library: LibraryData) {
  await ensureDirectories();
  await writeJsonFile(fileMap.composers, library.composers);
  await writeJsonFile(fileMap.people, library.people);
  await writeJsonFile(fileMap.workGroups, library.workGroups);
  await writeJsonFile(fileMap.works, library.works);
  await writeJsonFile(fileMap.recordings, library.recordings);
}

export async function loadPersonLinks(): Promise<PersonLinkConfig> {
  await ensureDirectories();
  const raw = await readJsonFile<Partial<PersonLinkConfig>>(fileMap.personLinks, {});
  return {
    canonicalPersonLinks: raw.canonicalPersonLinks ?? {},
  };
}

export async function savePersonLinks(config: PersonLinkConfig) {
  await ensureDirectories();
  await writeJsonFile(fileMap.personLinks, config);
}

export async function loadReviewQueue() {
  await ensureDirectories();
  return readJsonFile<ReviewQueueEntry[]>(fileMap.reviewQueue, []);
}

export async function saveReviewQueue(reviewQueue: ReviewQueueEntry[]) {
  await ensureDirectories();
  await writeJsonFile(fileMap.reviewQueue, reviewQueue);
}

export async function loadSiteConfig(): Promise<SiteConfig> {
  await ensureDirectories();
  const raw = await readJsonFile<SiteConfig>(fileMap.site, siteConfigDefaults);
  return {
    ...siteConfigDefaults,
    ...raw,
    contact: {
      ...siteConfigDefaults.contact,
      ...raw.contact,
    },
  };
}

export async function loadArticlesFromDisk(): Promise<Article[]> {
  await ensureDirectories();
  return validateArticles(await readJsonFile(fileMap.articles, []));
}

export async function saveArticlesToDisk(articles: Article[]) {
  await ensureDirectories();
  await writeJsonFile(fileMap.articles, validateArticles(articles));
}

export async function saveSiteConfig(siteConfig: SiteConfig) {
  await ensureDirectories();
  await writeJsonFile(fileMap.site, siteConfig);
}

export async function writeGeneratedArtifacts() {
  const [library, site, personLinks, articles] = await Promise.all([
    loadLibraryFromDisk(),
    loadSiteConfig(),
    loadPersonLinks(),
    loadArticlesFromDisk(),
  ]);
  const indexes = buildIndexes(library, personLinks);

  await ensureDirectories();
  await writeJsonFile(fileMap.generatedLibrary, library);
  await writeJsonFile(fileMap.generatedIndexes, indexes);
  await writeJsonFile(fileMap.generatedSite, site);
  await writeJsonFile(fileMap.generatedArticles, articles);

  return {
    library,
    site,
    indexes,
    articles,
  };
}

export async function readGeneratedLibrary() {
  return readJsonFile<LibraryData>(
    fileMap.generatedLibrary,
    validateLibrary({
      composers: [],
      people: [],
      workGroups: [],
      works: [],
      recordings: [],
    }),
  );
}

export async function readGeneratedIndexes() {
  return readJsonFile(
    fileMap.generatedIndexes,
    buildIndexes(
      validateLibrary({
        composers: [],
        people: [],
        workGroups: [],
        works: [],
        recordings: [],
      }),
      { canonicalPersonLinks: {} },
    ),
  );
}

export async function readGeneratedSite() {
  return readJsonFile<SiteConfig>(fileMap.generatedSite, siteConfigDefaults);
}

export async function readGeneratedArticles() {
  return validateArticles(await readJsonFile(fileMap.generatedArticles, []));
}

export function getDataPaths() {
  return fileMap;
}

