import { loadLibraryFromDisk } from "../packages/data-core/src/library-store.js";
import { auditLibraryData, summarizeLibraryAuditIssues } from "../packages/data-core/src/library-audit.js";

async function main() {
  const library = await loadLibraryFromDisk();
  const issues = auditLibraryData(library);
  const summary = summarizeLibraryAuditIssues(issues);

  console.log(
    JSON.stringify(
      {
        summary,
        sample: issues.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
