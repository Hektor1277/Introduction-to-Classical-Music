import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const servicePort = Number(process.env.LIVE_RECORDING_RETRIEVAL_AUDIT_PORT || 4793);
const serviceBaseUrl = process.env.RECORDING_RETRIEVAL_SERVICE_URL || `http://127.0.0.1:${servicePort}`;
const sampleSizePerGroup = Math.max(1, Number(process.env.RECORDING_LIVE_AUDIT_SAMPLE_SIZE || 1));
const serviceCwd = path.join(rootDir, "tools", "recording-retrieval-service", "app");
const servicePythonPath = path.join(serviceCwd, ".venv", "Scripts", "python.exe");

async function ensureFileExists(filePath) {
  const { access } = await import("node:fs/promises");
  await access(filePath);
}

async function waitForHealthy(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null) {
    return;
  }
  await Promise.race([
    once(child, "exit").catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await waitForExit(child, 1000);
  if (child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    await once(killer, "exit").catch(() => undefined);
    await waitForExit(child, 5000);
    return;
  }
  child.kill("SIGKILL");
  await waitForExit(child, 5000);
}

function buildSourceLine(recording) {
  return [
    recording.title,
    ...(recording.credits || []).map((credit) => credit.displayName || credit.label).filter(Boolean),
    recording.performanceDateText,
    recording.venueText,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function main() {
  await ensureFileExists(servicePythonPath);

  const logs = [];
  let serviceChild;
  try {
    serviceChild = spawn(servicePythonPath, ["-m", "app.main", "--mode", "service", "--host", "127.0.0.1", "--port", String(servicePort)], {
      cwd: serviceCwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    serviceChild.stdout?.on("data", (chunk) => logs.push(String(chunk)));
    serviceChild.stderr?.on("data", (chunk) => logs.push(String(chunk)));

    const health = await waitForHealthy(`${serviceBaseUrl}/health`);
    if (health?.protocolVersion !== "v1") {
      throw new Error(`Unexpected protocol version: ${health?.protocolVersion || "<missing>"}`);
    }

    const [{ loadLibraryFromDisk }, retrieval, checks, audit] = await Promise.all([
      import("./../output/runtime/packages/data-core/src/library-store.js"),
      import("./../output/runtime/packages/automation/src/recording-retrieval.js"),
      import("./../output/runtime/packages/automation/src/automation-checks.js"),
      import("./../output/runtime/packages/automation/src/recording-retrieval-audit.js"),
    ]);

    const library = await loadLibraryFromDisk();
    const plan = audit.buildRecordingRetrievalAuditPlan(library, { sampleSizePerGroup });
    const provider = retrieval.createHttpRecordingRetrievalProvider({ baseUrl: serviceBaseUrl });
    const results = [];

    for (const target of plan.targets) {
      const recording = library.recordings.find((item) => item.id === target.recordingId);
      if (!recording) {
        continue;
      }
      const request = retrieval.buildRecordingRetrievalRequest(library, [recording], {
        source: {
          kind: "owner-entity-check",
          ownerRunId: `recording-live-audit-${target.recordingId}`,
        },
        overrides: {
          [recording.id]: {
            sourceLine: buildSourceLine(recording),
            workTypeHint: recording.workTypeHint || "unknown",
          },
        },
        maxConcurrency: 1,
        timeoutMs: 45000,
        returnPartialResults: true,
      });
      const execution = await retrieval.executeRecordingRetrievalJob(provider, request, fetch, {
        pollIntervalMs: 1000,
        timeoutMs: 60000,
      });
      const proposals = retrieval.translateRecordingRetrievalResultsToProposals(library, execution);
      const review = checks.reviewRecordingAutomationProposalQuality(recording, proposals);
      results.push(
        audit.buildRecordingRetrievalAuditResult({
          target,
          recording,
          providerStatus: execution.runtimeState.status,
          providerError: execution.runtimeState.error,
          proposals,
          review,
        }),
      );
    }

    const summary = audit.summarizeRecordingRetrievalAudit(results);
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          serviceBaseUrl,
          sampleSizePerGroup,
          plan,
          summary,
          samples: results,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.stack || error.message : String(error),
          serviceBaseUrl,
          sampleSizePerGroup,
          logs: logs.join(""),
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  } finally {
    await stopChild(serviceChild);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
