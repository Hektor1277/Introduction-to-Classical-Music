import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  GENERATED_RELATIVE_PATHS,
  SOURCE_RELATIVE_PATHS,
  auditLibraryRoot,
  parseCliArgs,
} from "./lib/library-ops.mjs";

function requiredArg(args, name) {
  const positionalIndex = name === "source" ? 0 : 1;
  const value = String(args[name] || args._[positionalIndex] || "").trim();
  if (!value) {
    throw new Error(`Missing required argument --${name}`);
  }
  return path.resolve(value);
}

function gitStatus(rootDir) {
  try {
    return execFileSync("git", ["-C", rootDir, "status", "--porcelain"], { encoding: "utf8" }).trim();
  } catch (error) {
    throw new Error(`Target is not a usable Git repository: ${rootDir}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

async function copyExistingPath(rootDir, relativePath, destinationRoot) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(destinationRoot, relativePath);
  await cp(source, target, { recursive: true, force: true });
}

async function backupTarget(targetRoot) {
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const backupRoot = path.join(path.dirname(targetRoot), ".icm-library-backups", timestamp);
  await mkdir(backupRoot, { recursive: true });
  const paths = [...SOURCE_RELATIVE_PATHS, ...GENERATED_RELATIVE_PATHS];
  for (const relativePath of paths) {
    try {
      await copyExistingPath(targetRoot, relativePath, backupRoot);
    } catch {
      // Missing paths are expected for source-only bundles.
    }
  }
  return backupRoot;
}

async function restoreTarget(targetRoot, backupRoot) {
  const paths = [...SOURCE_RELATIVE_PATHS, ...GENERATED_RELATIVE_PATHS];
  for (const relativePath of paths) {
    await rm(path.join(targetRoot, relativePath), { recursive: true, force: true });
  }
  for (const relativePath of paths) {
    try {
      await copyExistingPath(backupRoot, relativePath, targetRoot);
    } catch {
      // The original path was absent.
    }
  }
}

async function copySourceOnly(sourceRoot, targetRoot) {
  for (const relativePath of [...SOURCE_RELATIVE_PATHS, ...GENERATED_RELATIVE_PATHS]) {
    await rm(path.join(targetRoot, relativePath), { recursive: true, force: true });
  }
  await mkdir(targetRoot, { recursive: true });
  await cp(path.join(sourceRoot, "library.manifest.json"), path.join(targetRoot, "library.manifest.json"), { force: true });
  await cp(path.join(sourceRoot, "content"), path.join(targetRoot, "content"), { recursive: true, force: true });
  await cp(path.join(sourceRoot, "assets"), path.join(targetRoot, "assets"), { recursive: true, force: true });
}

const args = parseCliArgs(process.argv.slice(2));
try {
  const sourceRoot = requiredArg(args, "source");
  const targetRoot = requiredArg(args, "target");
  if (sourceRoot === targetRoot) {
    throw new Error("Source and target must be different directories");
  }

  const sourceAudit = await auditLibraryRoot(sourceRoot, { mode: "working" });
  const targetAudit = await auditLibraryRoot(targetRoot, { mode: "source" });
  const report = {
    sourceRoot,
    targetRoot,
    apply: Boolean(args.apply),
    sourceAudit,
    targetAudit,
    changes: [],
    backupRoot: "",
  };

  if (!sourceAudit.ok) {
    throw new Error("Source audit failed; no files were changed");
  }
  if (!targetAudit.ok && !args.apply) {
    report.changes.push({ code: "target-needs-cleanup", details: targetAudit.errors });
  }

  if (args.apply) {
    const status = gitStatus(targetRoot);
    if (status) {
      throw new Error(`Target Git worktree is not clean:\n${status}`);
    }
    const backupRoot = await backupTarget(targetRoot);
    report.backupRoot = backupRoot;
    try {
      await copySourceOnly(sourceRoot, targetRoot);
      const finalAudit = await auditLibraryRoot(targetRoot, { mode: "source" });
      report.targetAuditAfterApply = finalAudit;
      if (!finalAudit.ok) {
        throw new Error("Target audit failed after apply");
      }
    } catch (error) {
      await restoreTarget(targetRoot, backupRoot);
      throw error;
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
