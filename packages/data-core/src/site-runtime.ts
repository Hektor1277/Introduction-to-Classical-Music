import path from "node:path";

import { getRuntimePaths } from "./app-paths.js";

export function getSiteBuildOutDir() {
  return getRuntimePaths().library.buildSiteDir;
}

export type SiteBuildEnvironmentOptions = {
  outputDir?: string;
  siteBase?: string;
};

export function createSiteBuildEnvironment(
  baseEnv: NodeJS.ProcessEnv = process.env,
  options: SiteBuildEnvironmentOptions = {},
) {
  const runtimePaths = getRuntimePaths();
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    ICM_REPO_ROOT: runtimePaths.repoRoot,
    ICM_SITE_OUT_DIR: path.resolve(options.outputDir || runtimePaths.library.buildSiteDir),
  };

  if (options.siteBase !== undefined) {
    env.ICM_SITE_BASE = options.siteBase;
  }

  if (runtimePaths.mode === "bundle") {
    env.ICM_ACTIVE_LIBRARY_DIR = runtimePaths.library.rootDir;
  }

  if (baseEnv.ICM_APP_DATA_DIR) {
    env.ICM_APP_DATA_DIR = baseEnv.ICM_APP_DATA_DIR;
  }

  return env;
}
