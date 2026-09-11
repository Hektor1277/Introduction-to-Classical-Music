import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const SOURCE_RELATIVE_PATHS = [
  "library.manifest.json",
  "content",
  "assets",
];

export const REQUIRED_JSON_PATHS = [
  "content/library/composers.json",
  "content/library/people.json",
  "content/library/work-groups.json",
  "content/library/works.json",
  "content/library/recordings.json",
  "content/library/entity-vitals-review.json",
  "content/library/review-queue.json",
  "content/library/person-links.json",
  "content/site/config.json",
  "content/site/articles.json",
];

export const GENERATED_RELATIVE_PATHS = ["build", "runtime", "exports"];

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
]);

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

async function exists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(rootDir, relativeDir = "") {
  const absoluteDir = path.join(rootDir, relativeDir);
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    const absolutePath = path.join(rootDir, relativePath);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, relativePath)));
    } else if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: normalizeRelativePath(relativePath),
      });
    }
  }
  return files;
}

async function sha256File(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function hashDirectory(rootDir, options = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const excluded = new Set(options.exclude || []);
  const includePrefixes = options.includePrefixes || null;
  const files = (await collectFiles(resolvedRoot))
    .filter((file) => !excluded.has(file.relativePath))
    .filter((file) => !includePrefixes || includePrefixes.some((prefix) => file.relativePath === prefix || file.relativePath.startsWith(`${prefix}/`)))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const entries = [];
  for (const file of files) {
    entries.push({ path: file.relativePath, sha256: await sha256File(file.absolutePath) });
  }
  const digest = createHash("sha256")
    .update(entries.map((entry) => `${entry.path}\0${entry.sha256}\n`).join(""))
    .digest("hex");
  return { digest, files: entries };
}

async function readJson(rootDir, relativePath, errors) {
  const filePath = path.join(rootDir, relativePath);
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    errors.push({
      code: "invalid-json-or-missing",
      path: relativePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function countValue(value) {
  return Array.isArray(value) ? value.length : null;
}

function inspectForbiddenText(relativePath, text, findings) {
  const checks = [
    ["test-link", /guide-test-3|testtesttest/i],
    ["local-host", /localhost|127\.0\.0\.1/i],
    ["absolute-windows-path", /[A-Z]:\\/],
  ];
  for (const [code, pattern] of checks) {
    if (pattern.test(text)) {
      findings.push({ code, path: relativePath });
    }
  }
}

export async function auditLibraryRoot(rootDir, options = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const mode = options.mode || "source";
  const errors = [];
  const warnings = [];
  const findings = [];
  const counts = {};

  if (!(await exists(resolvedRoot))) {
    errors.push({ code: "root-missing", path: resolvedRoot });
    return {
      ok: false,
      rootDir: resolvedRoot,
      mode,
      errors,
      warnings,
      findings,
      counts,
      sourceDigest: "",
      sourceFiles: [],
    };
  }

  const manifest = await readJson(resolvedRoot, "library.manifest.json", errors);
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    if (manifest.schemaVersion !== "library-bundle-v1") {
      errors.push({ code: "unsupported-schema", path: "library.manifest.json", value: manifest.schemaVersion });
    }
    if (!String(manifest.libraryId || "").trim()) {
      errors.push({ code: "library-id-missing", path: "library.manifest.json" });
    }
  }

  for (const relativePath of REQUIRED_JSON_PATHS) {
    const value = await readJson(resolvedRoot, relativePath, errors);
    if (relativePath.endsWith("person-links.json")) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push({ code: "person-links-shape", path: relativePath });
      }
    } else if (relativePath.endsWith("config.json")) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push({ code: "site-config-shape", path: relativePath });
      }
    } else if (relativePath.endsWith("articles.json")) {
      const count = countValue(value);
      if (count === null) {
        errors.push({ code: "articles-shape", path: relativePath });
      } else {
        counts.articles = count;
      }
    } else {
      const count = countValue(value);
      if (count === null) {
        errors.push({ code: "entity-array-shape", path: relativePath });
      } else {
        const name = path.basename(relativePath, ".json");
        counts[name] = count;
      }
    }
  }

  for (const generatedPath of GENERATED_RELATIVE_PATHS) {
    if (await exists(path.join(resolvedRoot, generatedPath))) {
      if (mode === "source") {
        errors.push({ code: "generated-path-present", path: generatedPath });
      } else {
        warnings.push({ code: "generated-path-present", path: generatedPath });
      }
    }
  }

  const sourceTree = await hashDirectory(resolvedRoot, {
    includePrefixes: ["library.manifest.json", "content", "assets"],
  });
  const sourceFiles = sourceTree.files;

  for (const entry of sourceFiles) {
    if (!TEXT_EXTENSIONS.has(path.extname(entry.path).toLowerCase())) {
      continue;
    }
    try {
      const text = await readFile(path.join(resolvedRoot, entry.path), "utf8");
      inspectForbiddenText(entry.path, text, findings);
    } catch (error) {
      errors.push({ code: "source-read-failed", path: entry.path, message: error instanceof Error ? error.message : String(error) });
    }
    if (/\/test(?:test)?\//i.test(entry.path) || /(^|\/)test[^/]*\.(?:png|jpe?g|jfif|webp)$/i.test(entry.path)) {
      findings.push({ code: "test-asset-path", path: entry.path });
    }
  }

  if (findings.length > 0) {
    errors.push({ code: "forbidden-content", findings });
  }

  return {
    ok: errors.length === 0,
    rootDir: resolvedRoot,
    mode,
    manifest,
    counts,
    errors,
    warnings,
    findings,
    sourceDigest: sourceTree.digest,
    sourceFiles,
  };
}

export function parseCliArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const equalsIndex = token.indexOf("=");
    if (equalsIndex > 2) {
      args[token.slice(2, equalsIndex)] = token.slice(equalsIndex + 1);
      continue;
    }
    const key = token.slice(2);
    if (key === "apply" || key === "json" || key === "publish") {
      args[key] = true;
      continue;
    }
    args[key] = argv[index + 1] || "";
    index += 1;
  }
  return args;
}

export function normalizeSiteBase(value = "/") {
  const trimmed = String(value || "/").trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}
