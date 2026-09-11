import { auditLibraryRoot, parseCliArgs } from "./lib/library-ops.mjs";

const args = parseCliArgs(process.argv.slice(2));
const root = String(args.root || args._[0] || "").trim();
const mode = args.mode === "working" || args._[1] === "working" ? "working" : "source";

if (!root) {
  console.error("Usage: node scripts/audit-library-bundle.mjs --root <library-root> --mode source|working");
  process.exitCode = 2;
} else {
  const report = await auditLibraryRoot(root, { mode });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) {
    process.exitCode = 1;
  }
}
