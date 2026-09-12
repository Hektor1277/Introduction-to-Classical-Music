import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadLibraryFromBundleRoot } from "../../packages/data-core/src/library-merge.js";

const fixtures = path.resolve("docs/manual-fixtures");

describe("unified library packages", () => {
  it("loads the same schema from compressed and directory packages", async () => {
    const compressed = await loadLibraryFromBundleRoot(path.join(fixtures, "library-b.icmlibrary"));
    const directory = await loadLibraryFromBundleRoot(path.join(fixtures, "library-b-directory.icmlibrary"));
    expect(compressed).toEqual(directory);
    expect(compressed.works).toHaveLength(2);
  });

  it("provides overlapping fixtures with additions and conflicts", async () => {
    const a = await loadLibraryFromBundleRoot(path.join(fixtures, "library-a.icmlibrary"));
    const b = await loadLibraryFromBundleRoot(path.join(fixtures, "library-b.icmlibrary"));
    expect(a.works).toHaveLength(1);
    expect(b.works).toHaveLength(2);
    expect(a.recordings[0].title).not.toBe(b.recordings[0].title);
  });
});
