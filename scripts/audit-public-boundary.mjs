import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function resolve(relativePath) {
  return path.join(repoRoot, relativePath.split("/").join(path.sep));
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(relativePath), "utf8"));
  } catch (error) {
    errors.push({ code: "invalid-json", path: relativePath, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

const arrayPaths = [
  "data/library/composers.json",
  "data/library/people.json",
  "data/library/work-groups.json",
  "data/library/works.json",
  "data/library/recordings.json",
  "data/library/entity-vitals-review.json",
  "data/library/review-queue.json",
  "data/site/articles.json",
];

const counts = {};
for (const relativePath of arrayPaths) {
  const value = await readJson(relativePath);
  const count = Array.isArray(value) ? value.length : null;
  counts[relativePath] = count;
  if (count !== 0) {
    errors.push({ code: "public-data-not-empty", path: relativePath, count });
  }
}

const personLinks = await readJson("data/library/person-links.json");
if (JSON.stringify(personLinks) !== JSON.stringify({ canonicalPersonLinks: {} })) {
  errors.push({ code: "public-person-links-not-empty", path: "data/library/person-links.json" });
}

const siteConfig = await readJson("data/site/config.json");
if (siteConfig && (siteConfig.lastImportedAt || siteConfig.contact?.label || siteConfig.contact?.value)) {
  errors.push({ code: "public-site-config-not-clean", path: "data/site/config.json" });
}

let trackedPaths = [];
try {
  trackedPaths = execFileSync("git", ["-C", repoRoot, "ls-files", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
} catch (error) {
  errors.push({ code: "git-list-failed", message: error instanceof Error ? error.message : String(error) });
}

const forbiddenPathPatterns = [
  /^materials\/archive\//,
  /^tools\/OwnerLauncher\//,
  /^data\/automation\/(?!batches\/\.gitkeep$|runs\/\.gitkeep$)/,
];
for (const trackedPath of trackedPaths) {
  if (forbiddenPathPatterns.some((pattern) => pattern.test(trackedPath))) {
    errors.push({ code: "private-path-tracked", path: trackedPath });
  }
}

const report = {
  ok: errors.length === 0,
  repoRoot,
  counts,
  trackedFileCount: trackedPaths.length,
  errors,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  process.exitCode = 1;
}
