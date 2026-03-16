import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveLibraryAssetPath } from "@/lib/owner-assets";

describe("owner assets", () => {
  const publicDir = path.resolve("apps/site/public");

  it("resolves encoded Chinese library asset paths", () => {
    const resolved = resolveLibraryAssetPath(
      publicDir,
      "/library-assets/managed/composers/composer-%E5%B8%83%E9%B2%81%E5%85%8B%E7%BA%B3/composer-%E5%B8%83%E9%B2%81%E5%85%8B%E7%BA%B3-3c2a16492d.jpg",
    );

    expect(resolved).toBeTruthy();
    expect(path.normalize(resolved ?? "")).toContain(path.join("apps", "site", "public", "library-assets", "managed", "composers"));
    expect(path.basename(resolved ?? "")).toBe("composer-\u5e03\u9c81\u514b\u7eb3-3c2a16492d.jpg");
    expect(path.basename(path.dirname(resolved ?? ""))).toBe("composer-\u5e03\u9c81\u514b\u7eb3");
  });

  it("rejects traversal outside library-assets", () => {
    const resolved = resolveLibraryAssetPath(publicDir, "/library-assets/../../package.json");

    expect(resolved).toBeNull();
  });
});
