import { describe, expect, it } from "vitest";

import { createAutomationRun } from "@/lib/automation";
import { createAutomationJobManager } from "@/lib/automation-jobs";
import { validateLibrary } from "@/lib/schema";

const library = validateLibrary({
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "",
      nameLatin: "Ludwig van Beethoven",
      displayName: "贝多芬",
      displayFullName: "",
      displayLatinName: "Ludwig van Beethoven",
      country: "Germany",
      avatarSrc: "",
      aliases: [],
      abbreviations: [],
      sortKey: "beethoven",
      summary: "",
    },
  ],
  people: [
    {
      id: "kleiber",
      slug: "kleiber",
      name: "克莱伯",
      fullName: "",
      nameLatin: "Carlos Kleiber",
      displayName: "克莱伯",
      displayFullName: "",
      displayLatinName: "Carlos Kleiber",
      country: "Germany",
      avatarSrc: "",
      roles: ["conductor"],
      aliases: ["Carlos Kleiber"],
      abbreviations: [],
      sortKey: "kleiber",
      summary: "",
    },
  ],
  workGroups: [],
  works: [],
  recordings: [],
});

describe("automation jobs", () => {
  it("creates an async job with progress and structured failures", async () => {
    const manager = createAutomationJobManager();
    const job = manager.createJob({
      library,
      request: { categories: ["composer", "conductor"] },
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });

    await manager.waitForJob(job.id);
    const current = manager.getJob(job.id);

    expect(current?.status).toBe("completed");
    expect(current?.progress.total).toBe(2);
    expect(current?.progress.processed).toBe(2);
    expect(current?.progress.failed).toBe(0);
    expect(current?.progress.attention).toBe(2);
    expect(current?.items.every((item) => item.status === "needs-attention")).toBe(true);
    expect(current?.errors[0]?.code).toBe("needs-attention");
  });

  it("runs selected items concurrently and stores per-item statuses", async () => {
    const multiComposerLibrary = validateLibrary({
      ...library,
      composers: [
        {
          ...library.composers[0],
          id: "beethoven",
          slug: "beethoven",
          name: "贝多芬",
          displayName: "贝多芬",
        },
        {
          ...library.composers[0],
          id: "bruckner",
          slug: "bruckner",
          name: "布鲁克纳",
          nameLatin: "Anton Bruckner",
          displayName: "布鲁克纳",
          displayLatinName: "Anton Bruckner",
        },
        {
          ...library.composers[0],
          id: "mahler",
          slug: "mahler",
          name: "马勒",
          nameLatin: "Gustav Mahler",
          displayName: "马勒",
          displayLatinName: "Gustav Mahler",
        },
      ],
      people: [],
    });

    let active = 0;
    let maxActive = 0;
    const manager = createAutomationJobManager();
    const job = manager.createJob({
      library: multiComposerLibrary,
      request: { categories: ["composer"] },
      maxConcurrency: 3,
      runChecksImpl: async (_library, request) => {
        const composerId = request.composerIds?.[0] || "unknown";
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 40));
        active -= 1;
        return createAutomationRun(multiComposerLibrary, {
          categories: ["composer"],
          proposals: [
            {
              id: `${composerId}-proposal`,
              entityType: "composer",
              entityId: composerId,
              summary: `补充 ${composerId}`,
              risk: "low",
              sources: ["https://example.com/source"],
              fields: [
                { path: "fullName", before: "", after: `${composerId}-full` },
                { path: "displayFullName", before: "", after: `${composerId}-full` },
              ],
            },
          ],
        });
      },
    });

    await manager.waitForJob(job.id);
    const current = manager.getJob(job.id);

    expect(maxActive).toBeGreaterThan(1);
    expect(current?.items).toHaveLength(3);
    expect(current?.items.every((item) => item.status === "needs-attention")).toBe(true);
    expect(current?.progress.succeeded).toBe(0);
    expect(current?.progress.attention).toBe(3);
  });

  it("marks a finished item as needing attention when post-check still finds missing fields", async () => {
    const manager = createAutomationJobManager();
    const job = manager.createJob({
      library,
      request: { categories: ["composer"], composerIds: ["beethoven"] },
      runChecksImpl: async () =>
        createAutomationRun(library, {
          categories: ["composer"],
          proposals: [
            {
              id: "beethoven-country-only",
              entityType: "composer",
              entityId: "beethoven",
              summary: "只补国家",
              risk: "low",
              sources: ["https://example.com/source"],
              fields: [{ path: "country", before: "Germany", after: "Austria" }],
            },
          ],
        }),
    });

    await manager.waitForJob(job.id);
    const current = manager.getJob(job.id);

    expect(current?.progress.failed).toBe(0);
    expect(current?.progress.succeeded).toBe(0);
    expect(current?.progress.attention).toBe(1);
    expect(current?.items[0]?.status).toBe("needs-attention");
    expect(current?.items[0]?.reviewIssues?.some((message) => message.includes("全名") || message.includes("规范"))).toBe(true);
  });

  it("builds a concrete selection preview before running a job", () => {
    const manager = createAutomationJobManager();
    const preview = manager.previewSelection(library, {
      categories: ["composer", "conductor"],
      composerIds: ["beethoven"],
      conductorIds: ["kleiber"],
    });

    expect(preview.groups.find((group) => group.category === "composer")?.items).toHaveLength(1);
    expect(preview.groups.find((group) => group.category === "conductor")?.items).toHaveLength(1);
    expect(preview.total).toBe(2);
  });

  it("filters people previews by related recordings when composer or work constraints are present", () => {
    const relatedLibrary = validateLibrary({
      composers: library.composers,
      people: [
        ...library.people,
        {
          id: "abbado",
          slug: "abbado",
          name: "\u963f\u5df4\u591a",
          fullName: "",
          nameLatin: "Claudio Abbado",
          displayName: "\u963f\u5df4\u591a",
          displayFullName: "",
          displayLatinName: "Claudio Abbado",
          country: "Italy",
          avatarSrc: "",
          roles: ["conductor"],
          aliases: [],
          abbreviations: [],
          sortKey: "abbado",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
        {
          id: "vpo",
          slug: "vpo",
          name: "\u7ef4\u4e5f\u7eb3\u7231\u4e50",
          fullName: "",
          nameLatin: "Wiener Philharmoniker",
          displayName: "\u7ef4\u4e5f\u7eb3\u7231\u4e50",
          displayFullName: "",
          displayLatinName: "Wiener Philharmoniker",
          country: "Austria",
          avatarSrc: "",
          roles: ["orchestra"],
          aliases: [],
          abbreviations: ["VPO"],
          sortKey: "vpo",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
      ],
      workGroups: [
        {
          id: "group-beethoven-symphony",
          composerId: "beethoven",
          title: "\u4ea4\u54cd\u66f2",
          slug: "symphony",
          path: ["\u4ea4\u54cd\u66f2"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "beethoven-7",
          composerId: "beethoven",
          groupIds: ["group-beethoven-symphony"],
          slug: "beethoven-7",
          title: "\u7b2c\u4e03\u4ea4\u54cd\u66f2",
          titleLatin: "",
          aliases: [],
          catalogue: "",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
          sortKey: "0010",
          updatedAt: "2026-03-13T00:00:00.000Z",
        },
      ],
      recordings: [
        {
          id: "recording-beethoven-7-abbado",
          workId: "beethoven-7",
          slug: "recording-beethoven-7-abbado",
          title: "\u963f\u5df4\u591a 1988",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-13T00:00:00.000Z",
          images: [],
          credits: [
            { role: "conductor", personId: "abbado", displayName: "\u963f\u5df4\u591a" },
            { role: "orchestra", personId: "vpo", displayName: "\u7ef4\u4e5f\u7eb3\u7231\u4e50" },
          ],
          links: [],
          notes: "",
          performanceDateText: "1988",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
        },
      ],
    });

    const manager = createAutomationJobManager();
    const conductorPreview = manager.previewSelection(relatedLibrary, {
      categories: ["conductor"],
      composerIds: ["beethoven"],
    });
    const orchestraPreview = manager.previewSelection(relatedLibrary, {
      categories: ["orchestra"],
      workIds: ["beethoven-7"],
    });

    expect(conductorPreview.groups[0]?.items.map((item) => item.entityId)).toEqual(["abbado"]);
    expect(orchestraPreview.groups[0]?.items.map((item) => item.entityId)).toEqual(["vpo"]);
  });

  it("previews work selections directly when requesting work auto-check", () => {
    const libraryWithWork = validateLibrary({
      ...library,
      workGroups: [
        {
          id: "group-beethoven-symphony",
          composerId: "beethoven",
          title: "交响曲",
          slug: "symphony",
          path: ["交响曲"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "beethoven-7",
          composerId: "beethoven",
          groupIds: ["group-beethoven-symphony"],
          slug: "beethoven-7",
          title: "第七交响曲",
          titleLatin: "Symphony No. 7",
          aliases: [],
          catalogue: "Op. 92",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
          sortKey: "0010",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      ],
      recordings: [],
    });

    const manager = createAutomationJobManager();
    const preview = manager.previewSelection(libraryWithWork, {
      categories: ["work"],
      workIds: ["beethoven-7"],
    });

    expect(preview.total).toBe(1);
    expect(preview.groups[0]?.category).toBe("work");
    expect(preview.groups[0]?.items[0]).toEqual(
      expect.objectContaining({
        entityId: "beethoven-7",
        label: "第七交响曲",
        description: "Symphony No. 7 / Op. 92",
      }),
    );
  });
});
