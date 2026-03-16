import { describe, expect, it } from "vitest";

import {
  applyAutomationProposal,
  applyPendingAutomationProposals,
  createAutomationRun,
  ignoreAutomationProposal,
  ignorePendingAutomationProposals,
  rankImageCandidates,
  revertAutomationProposal,
  updateAutomationProposalReview,
} from "@/lib/automation";
import { runAutomationChecks } from "@/lib/automation-checks";
import { validateLibrary } from "@/lib/schema";

const library = validateLibrary({
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "路德维希·凡·贝多芬",
      nameLatin: "Ludwig van Beethoven",
      country: "Germany",
      avatarSrc: "",
      aliases: [],
      sortKey: "beethoven",
      summary: "德国作曲家。",
    },
  ],
  people: [
    {
      id: "kleiber",
      slug: "kleiber",
      name: "卡洛斯·克莱伯",
      fullName: "Carlos Kleiber",
      nameLatin: "Carlos Kleiber",
      country: "Germany",
      avatarSrc: "",
      roles: ["conductor"],
      aliases: ["Carlos Kleiber"],
      sortKey: "kleiber",
      summary: "著名指挥家。",
    },
    {
      id: "kleiber-duplicate",
      slug: "kleiber-duplicate",
      name: "老克莱伯",
      fullName: "Carlos Kleiber",
      nameLatin: "Carlos Kleiber",
      country: "Germany",
      avatarSrc: "",
      roles: ["conductor"],
      aliases: ["Carlos Kleiber"],
      sortKey: "kleiber-duplicate",
      summary: "重复条目。",
    },
    {
      id: "pollini",
      slug: "pollini",
      name: "波里尼",
      fullName: "Maurizio Pollini",
      nameLatin: "Maurizio Pollini",
      country: "Italy",
      avatarSrc: "",
      roles: ["soloist"],
      aliases: ["Maurizio Pollini"],
      sortKey: "pollini",
      summary: "钢琴家。",
    },
  ],
  workGroups: [
    {
      id: "beethoven-sonata",
      composerId: "beethoven",
      title: "钢琴奏鸣曲",
      slug: "sonata",
      path: ["钢琴奏鸣曲"],
      sortKey: "0100",
    },
  ],
  works: [
    {
      id: "appassionata",
      composerId: "beethoven",
      groupIds: ["beethoven-sonata"],
      slug: "appassionata",
      title: "第二十三钢琴奏鸣曲“热情”",
      titleLatin: "Piano Sonata No. 23 'Appassionata'",
      aliases: [],
      catalogue: "Op. 57",
      summary: "贝多芬钢琴奏鸣曲。",
      sortKey: "0200",
      updatedAt: "2026-03-08T00:00:00.000Z",
    },
  ],
  recordings: [
    {
      id: "cutner-appassionata",
      workId: "appassionata",
      slug: "cutner-appassionata",
      title: "Solomon Cutner",
      sortKey: "0100",
      isPrimaryRecommendation: true,
      updatedAt: "2026-03-08T00:00:00.000Z",
      images: [],
      credits: [
        { role: "conductor", displayName: "Carlos Kleiber", personId: "kleiber" },
        { role: "soloist", displayName: "Maurizio Pollini", personId: "pollini" },
      ],
      links: [{ platform: "bilibili", url: "https://www.bilibili.com/video/BV1Qd4y1B7N9", title: "BV1Qd4y1B7N9" }],
      notes: "",
      performanceDateText: "",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
    },
  ],
});

function createMockRecordingProvider(itemsBuilder = () => []) {
  const acceptedAt = "2026-03-15T00:00:00.000Z";
  return {
    name: "recording-retrieval-service",
    protocolVersion: "v1",
    checkHealth: async () => ({
      service: "recording-retrieval-service",
      version: "1.0.0",
      protocolVersion: "v1",
      status: "ok",
    }),
    createJob: async (request) => ({
      jobId: "provider-job-1",
      requestId: request.requestId,
      status: "accepted",
      itemCount: request.items.length,
      acceptedAt,
    }),
    getJob: async () => ({
      jobId: "provider-job-1",
      requestId: "request-1",
      status: "succeeded",
      progress: {
        total: 1,
        completed: 1,
        succeeded: 1,
        partial: 0,
        failed: 0,
        notFound: 0,
      },
      items: [{ itemId: "cutner-appassionata", status: "succeeded" }],
      logs: [{ timestamp: acceptedAt, message: "done" }],
    }),
    getResults: async () => ({
      jobId: "provider-job-1",
      requestId: "request-1",
      status: "succeeded",
      completedAt: acceptedAt,
      items: itemsBuilder(),
    }),
    cancelJob: async () => ({
      jobId: "provider-job-1",
      requestId: "request-1",
      status: "canceled",
      progress: {
        total: 1,
        completed: 1,
        succeeded: 0,
        partial: 0,
        failed: 1,
        notFound: 0,
      },
      items: [{ itemId: "cutner-appassionata", status: "failed" }],
      logs: [{ timestamp: acceptedAt, message: "canceled" }],
    }),
  };
}

describe("automation proposals", () => {
  it("applies, ignores and reverts proposals without mutating unrelated data", () => {
    const run = createAutomationRun(library, {
      categories: ["artist"],
      proposals: [
        {
          id: "proposal-1",
          entityType: "person",
          entityId: "kleiber",
          summary: "补充图片来源与国家别名",
          risk: "low",
          sources: ["https://commons.wikimedia.org/wiki/File:Carlos_Kleiber.jpg"],
          fields: [
            { path: "avatarSrc", before: "", after: "/library-assets/people/kleiber-a1.jpg" },
            { path: "imageSourceUrl", before: "", after: "https://commons.wikimedia.org/wiki/File:Carlos_Kleiber.jpg" },
            { path: "aliases", before: ["Carlos Kleiber"], after: ["Carlos Kleiber", "克莱伯"] },
          ],
        },
      ],
    });

    const applied = applyAutomationProposal(library, run, "proposal-1");
    expect(applied.library.people[0]?.avatarSrc).toBe("/library-assets/people/kleiber-a1.jpg");
    expect(applied.library.people[0]?.aliases).toContain("克莱伯");
    expect(applied.snapshot.after.avatarSrc).toBe("/library-assets/people/kleiber-a1.jpg");

    const reverted = revertAutomationProposal(applied.library, applied.run, applied.snapshot.id);
    expect(reverted.people[0]?.avatarSrc).toBe("");
    expect(reverted.people[0]?.aliases).toEqual(["Carlos Kleiber"]);

    const ignoredRun = ignoreAutomationProposal(run, "proposal-1");
    expect(ignoredRun.proposals[0]?.status).toBe("ignored");
  });

  it("supports batch apply and batch ignore for pending proposals", () => {
    const run = createAutomationRun(library, {
      categories: ["recording"],
      proposals: [
        {
          id: "proposal-a",
          entityType: "recording",
          entityId: "cutner-appassionata",
          summary: "修正平台",
          risk: "low",
          sources: ["https://www.youtube.com/watch?v=SayJA16R0ZQ"],
          fields: [{ path: "links[0].platform", before: "bilibili", after: "youtube" }],
        },
        {
          id: "proposal-b",
          entityType: "person",
          entityId: "kleiber",
          summary: "仅供审查",
          kind: "merge",
          risk: "high",
          sources: [],
          fields: [],
        },
      ],
    });

    const applied = applyPendingAutomationProposals(library, run);
    expect(applied.run.summary.applied).toBe(1);
    expect(applied.library.recordings[0]?.links[0]?.platform).toBe("youtube");

    const ignored = ignorePendingAutomationProposals(run);
    expect(ignored.summary.ignored).toBe(2);
  });

  it("synchronizes proposal status with review state", () => {
    const run = createAutomationRun(library, {
      categories: ["artist"],
      proposals: [
        {
          id: "proposal-review",
          entityType: "person",
          entityId: "kleiber",
          summary: "同步 review 与 status",
          risk: "low",
          sources: [],
          fields: [{ path: "country", before: "Germany", after: "Austria" }],
        },
      ],
    });

    const viewed = updateAutomationProposalReview(run, "proposal-review", "viewed");
    expect(viewed.proposals[0]?.reviewState).toBe("viewed");
    expect(viewed.proposals[0]?.status).toBe("pending");

    const discarded = updateAutomationProposalReview(viewed, "proposal-review", "discarded");
    expect(discarded.proposals[0]?.reviewState).toBe("discarded");
    expect(discarded.proposals[0]?.status).toBe("ignored");

    const confirmed = updateAutomationProposalReview(discarded, "proposal-review", "confirmed");
    expect(confirmed.proposals[0]?.reviewState).toBe("confirmed");
    expect(confirmed.proposals[0]?.status).toBe("pending");
  });

  it("ranks image candidates by score before selection", () => {
    const ranked = rankImageCandidates(
      {
        title: "Carlos Kleiber",
        entityKind: "person",
      },
      [
        {
          id: "low",
          src: "https://example.com/low.jpg",
          sourceUrl: "https://example.com/low",
          sourceKind: "other",
          width: 320,
          height: 120,
          attribution: "",
        },
        {
          id: "high",
          src: "https://commons.wikimedia.org/high.jpg",
          sourceUrl: "https://commons.wikimedia.org/wiki/File:Carlos_Kleiber.jpg",
          sourceKind: "wikimedia-commons",
          width: 1200,
          height: 1200,
          attribution: "Wikimedia Commons",
        },
        {
          id: "logo",
          src: "https://baike.baidu.com/logo.png",
          sourceUrl: "https://baike.baidu.com/logo.png",
          sourceKind: "official-site",
          width: 1200,
          height: 1200,
          attribution: "Baidu Baike logo",
          title: "Baidu logo",
        },
      ],
    );

    expect(ranked[0]?.id).toBe("high");
    expect(ranked.at(-1)?.id).toBe("logo");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});

describe("automation checks", () => {
  it("filters recordings by conductor and produces merge review proposals for duplicate people", async () => {
    const fetchImpl = async (url) => {
      const value = String(url);
      if (value.includes("w/api.php")) {
        return {
          ok: true,
          json: async () => ({ query: { search: [{ title: "Carlos Kleiber" }] } }),
        };
      }
      if (value.includes("google.com/search")) {
        return {
          ok: true,
          text: async () =>
            '<html><body><a href="/url?q=https%3A%2F%2Fwww.example-classical.com%2Frecordings%2Fkleiber-beethoven&sa=U">result</a></body></html>',
        };
      }
      if (value.includes("api/rest_v1/page/summary")) {
        return {
          ok: true,
          json: async () => ({
            extract: "Carlos Kleiber was a German conductor.",
            description: "German conductor",
            content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Carlos_Kleiber" } },
            originalimage: { source: "https://upload.wikimedia.org/example.jpg" },
            title: "Carlos Kleiber",
          }),
        };
      }
      if (value.includes("www.example-classical.com/recordings/kleiber-beethoven")) {
        return {
          ok: true,
          text: async () =>
            '<html><head><title>Kleiber Beethoven</title><meta property="og:title" content="Kleiber Beethoven Appassionata"><meta property="og:description" content="Label: DG | Venue: Vienna | 1963-01-01"><meta property="og:image" content="https://cdn.example.com/cover.jpg"></head></html>',
        };
      }
      return {
        ok: true,
        text: async () => "<html></html>",
      };
    };
    const recordingProvider = createMockRecordingProvider(() => [
      {
        itemId: "cutner-appassionata",
        status: "succeeded",
        confidence: 0.84,
        warnings: [],
        result: {
          label: "DG",
          releaseDate: "1963",
          links: [{ url: "https://www.example-classical.com/recordings/kleiber-beethoven", platform: "other" }],
        },
        evidence: [{ field: "label", sourceUrl: "https://www.example-classical.com/recordings/kleiber-beethoven", sourceLabel: "Example", confidence: 0.84 }],
        linkCandidates: [{ url: "https://www.example-classical.com/recordings/kleiber-beethoven", platform: "other", confidence: 0.84 }],
        imageCandidates: [],
        logs: [{ timestamp: "2026-03-15T00:00:00.000Z", message: "done" }],
      },
    ]);

    const run = await runAutomationChecks(
      library,
      {
        categories: ["conductor", "recording"],
        conductorIds: ["kleiber"],
      },
      fetchImpl,
      undefined,
      { recordingProvider },
    );

    expect(run.categories).toEqual(["conductor", "recording"]);
    expect(run.notes.some((note) => note.includes("人物检查"))).toBe(true);
    expect(run.proposals.some((proposal) => proposal.summary.includes("疑似重复人物"))).toBe(true);
    expect(run.proposals.some((proposal) => proposal.entityType === "recording")).toBe(true);
  });

  it("creates recording proposals from the external retrieval provider without mutating formal data", async () => {
    const recordingLibrary = validateLibrary({
      ...library,
      recordings: [
        {
          ...library.recordings[0],
          links: [{ platform: "youtube", url: "https://www.youtube.com/watch?v=SayJA16R0ZQ", title: "Video" }],
        },
      ],
    });

    const run = await runAutomationChecks(recordingLibrary, { categories: ["recording"] }, fetch, undefined, {
      recordingProvider: createMockRecordingProvider(() => [
        {
          itemId: "cutner-appassionata",
          status: "succeeded",
          confidence: 0.91,
          warnings: [],
          result: {
            links: [{ url: "https://www.youtube.com/watch?v=SayJA16R0ZQ", platform: "youtube" }],
            images: [{ src: "https://cdn.example.com/cover.jpg", sourceUrl: "https://cdn.example.com/cover.jpg", sourceKind: "official-site" }],
          },
          evidence: [],
          linkCandidates: [{ url: "https://www.youtube.com/watch?v=SayJA16R0ZQ", platform: "youtube" }],
          imageCandidates: [{ src: "https://cdn.example.com/cover.jpg", sourceUrl: "https://cdn.example.com/cover.jpg", sourceKind: "official-site" }],
          logs: [{ timestamp: "2026-03-15T00:00:00.000Z", message: "done" }],
        },
      ]),
    });
    const coverProposal = run.proposals.find((proposal) => proposal.entityType === "recording");

    expect(coverProposal).toBeTruthy();
    expect(coverProposal?.imageCandidates?.length).toBeGreaterThan(0);
    expect(recordingLibrary.recordings[0]?.images).toHaveLength(0);
  });

  it("fails explicitly when recording checks run without an external retrieval provider", async () => {
    await expect(runAutomationChecks(library, { categories: ["recording"] }, fetch)).rejects.toThrow(
      "版本自动检索工具未配置或不可用",
    );
  });

  it("drops suspicious baidu logo image candidates for named entities", async () => {
    const namedLibrary = validateLibrary({
      composers: [
        {
          id: "berlioz",
          slug: "berlioz",
          name: "柏辽兹",
          fullName: "",
          nameLatin: "Hector Berlioz",
          displayName: "柏辽兹",
          displayFullName: "",
          displayLatinName: "Hector Berlioz",
          country: "",
          avatarSrc: "",
          aliases: [],
          abbreviations: [],
          sortKey: "berlioz",
          summary: "",
        },
      ],
      people: [],
      workGroups: [],
      works: [],
      recordings: [],
    });

    const run = await runAutomationChecks(
      namedLibrary,
      { categories: ["composer"], composerIds: ["berlioz"] },
      async (url) => {
        const value = String(url);
        if (value.includes("w/api.php") || value.includes("api/rest_v1/page/summary")) {
          throw new Error("blocked");
        }
        return {
          ok: true,
          url: "https://baike.baidu.com/item/%E6%9F%8F%E8%BE%BD%E5%85%B9",
          text: async () =>
            '<html><head><meta property="og:title" content="柏辽兹"><meta name="description" content="Hector Berlioz French composer, 1803-1869."><meta property="og:image" content="https://baike.baidu.com/logo.png"></head></html>',
        } as Response;
      },
    );

    expect(run.proposals).toHaveLength(1);
    expect(run.proposals[0]?.imageCandidates).toHaveLength(0);
    expect(run.proposals[0]?.warnings?.some((warning) => warning.includes("图片"))).toBe(true);
  });

  it("still generates named-entity proposals when Wikipedia and Baidu are unavailable but LLM returns structured knowledge", async () => {
    const incompleteLibrary = validateLibrary({
      composers: [
        {
          id: "bruckner",
          slug: "bruckner",
          name: "布鲁克纳",
          fullName: "",
          nameLatin: "Anton Bruckner",
          displayName: "布鲁克纳",
          displayFullName: "",
          displayLatinName: "Anton Bruckner",
          country: "",
          avatarSrc: "",
          aliases: [],
          abbreviations: [],
          sortKey: "bruckner",
          summary: "",
        },
      ],
      people: [],
      workGroups: [],
      works: [],
      recordings: [],
    });

    const llmConfig = {
      enabled: true,
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret-key",
      model: "deepseek-reasoner",
      timeoutMs: 30000,
    };

    const fetchImpl = async (url, init) => {
      const value = String(url);
      if (value.includes("api.example.com/v1/chat/completions")) {
        const body = JSON.parse(String(init?.body || "{}"));
        const primaryAttempt = body.response_format?.type === "json_object";
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: primaryAttempt
                    ? JSON.stringify({ normalizedTitle: "Anton Bruckner" })
                    : JSON.stringify({
                        displayName: "布鲁克纳",
                        displayFullName: "安东·布鲁克纳",
                        displayLatinName: "Anton Bruckner",
                        aliases: ["布鲁克纳"],
                        abbreviations: [],
                        country: "Austria",
                        birthYear: 1824,
                        deathYear: 1896,
                        summary: "奥地利作曲家，布鲁克纳交响曲代表人物。",
                        confidence: 0.88,
                        rationale: "LLM 依据常见中文译名、英文全名与音乐史常识给出补全。",
                      }),
                },
              },
            ],
          }),
        } as Response;
      }
      throw new Error(`blocked: ${value}`);
    };

    const run = await runAutomationChecks(
      incompleteLibrary,
      { categories: ["composer"], composerIds: ["bruckner"] },
      fetchImpl as typeof fetch,
      llmConfig,
    );

    expect(run.proposals).toHaveLength(1);
    expect(run.notes.some((note) => note.includes("LLM 已启用"))).toBe(true);
    expect(run.proposals[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "name", after: "安东·布鲁克纳" }),
        expect.objectContaining({ path: "aliases", after: expect.arrayContaining(["安东·布鲁克纳"]) }),
        expect.objectContaining({ path: "country", after: "Austria" }),
      ]),
    );
  });

  it("checks work entities directly without falling through to recording checks", async () => {
    const workLibrary = validateLibrary({
      composers: [
        {
          id: "beethoven",
          slug: "beethoven",
          name: "贝多芬",
          fullName: "路德维希·凡·贝多芬",
          nameLatin: "Ludwig van Beethoven",
          country: "Germany",
          avatarSrc: "",
          aliases: [],
          sortKey: "beethoven",
          summary: "德国作曲家。",
        },
      ],
      people: [],
      workGroups: [
        {
          id: "group-symphony",
          composerId: "beethoven",
          title: "交响曲",
          slug: "symphony",
          path: ["交响曲"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "beethoven-5",
          composerId: "beethoven",
          groupIds: ["group-symphony"],
          slug: "beethoven-5",
          title: "第五交响曲",
          titleLatin: "",
          aliases: [],
          catalogue: "",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
          sortKey: "0010",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      ],
      recordings: [
        {
          id: "recording-beethoven-5-1963",
          workId: "beethoven-5",
          slug: "recording-beethoven-5-1963",
          title: "克莱伯 1963",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-15T00:00:00.000Z",
          images: [],
          credits: [],
          links: [],
          notes: "",
          performanceDateText: "1963",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionUrl: "" },
        },
      ],
    });

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("w/api.php")) {
        return new Response(
          JSON.stringify({
            query: {
              search: [{ title: "Symphony No. 5 (Beethoven)" }],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/page/summary/")) {
        return new Response(
          JSON.stringify({
            title: "Symphony No. 5 (Beethoven)",
            extract: "Symphony No. 5 in C minor, Op. 67 is a symphony by Ludwig van Beethoven.",
            content_urls: {
              desktop: {
                page: "https://en.wikipedia.org/wiki/Symphony_No._5_(Beethoven)",
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const run = await runAutomationChecks(workLibrary, { categories: ["work"], workIds: ["beethoven-5"] }, fetchImpl);

    expect(run.categories).toEqual(["work"]);
    expect(run.proposals).toHaveLength(1);
    expect(run.proposals[0]?.entityType).toBe("work");
    expect(run.proposals[0]?.entityId).toBe("beethoven-5");
    expect(run.proposals[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "titleLatin", after: "Symphony No. 5 (Beethoven)" }),
        expect.objectContaining({ path: "catalogue", after: "Op. 67" }),
        expect.objectContaining({ path: "summary", after: expect.stringContaining("Beethoven") }),
      ]),
    );
  });
});
