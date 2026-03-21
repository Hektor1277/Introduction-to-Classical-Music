import { describe, expect, it } from "vitest";

import { buildIndexes } from "@/lib/indexes";
import { buildRecordingDisplayModel, buildRecordingListEntry, collectLibraryDataIssues } from "@/lib/display";
import { validateLibrary } from "@/lib/schema";

const library = validateLibrary({
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "路德维希·凡·贝多芬",
      nameLatin: "Ludwig van Beethoven",
      displayName: "贝多芬",
      displayFullName: "路德维希·凡·贝多芬",
      displayLatinName: "Ludwig van Beethoven",
      country: "Germany",
      avatarSrc: "",
      aliases: ["L. v. Beethoven"],
      abbreviations: [],
      sortKey: "beethoven",
      summary: "德国作曲家。",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
      roles: ["composer"],
    },
  ],
  people: [
    {
      id: "karajan",
      slug: "karajan",
      name: "卡拉扬",
      fullName: "赫伯特·冯·卡拉扬",
      nameLatin: "Herbert von Karajan",
      displayName: "卡拉扬",
      displayFullName: "赫伯特·冯·卡拉扬",
      displayLatinName: "Karajan",
      country: "Austria",
      avatarSrc: "",
      roles: ["conductor"],
      aliases: ["Herbert von Karajan"],
      abbreviations: [],
      sortKey: "karajan",
      summary: "奥地利指挥家。",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
    },
    {
      id: "bpo",
      slug: "berlin-phil",
      name: "柏林爱乐乐团",
      fullName: "柏林爱乐乐团",
      nameLatin: "Berliner Philharmoniker",
      displayName: "柏林爱乐",
      displayFullName: "柏林爱乐乐团",
      displayLatinName: "Berliner Philharmoniker",
      country: "Germany",
      avatarSrc: "",
      roles: ["orchestra"],
      aliases: ["Berlin Philharmonic Orchestra"],
      abbreviations: ["BPO"],
      sortKey: "berlin-phil",
      summary: "德国乐团。",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
    },
    {
      id: "pollini",
      slug: "pollini",
      name: "波里尼",
      fullName: "毛里齐奥·波里尼",
      nameLatin: "Maurizio Pollini",
      displayName: "波里尼",
      displayFullName: "毛里齐奥·波里尼",
      displayLatinName: "Pollini",
      country: "Italy",
      avatarSrc: "",
      roles: ["soloist"],
      aliases: ["Maurizio Pollini"],
      abbreviations: [],
      sortKey: "pollini",
      summary: "意大利钢琴家。",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
    },
    {
      id: "vpo",
      slug: "vienna-phil",
      name: "维也纳爱乐乐团",
      fullName: "维也纳爱乐乐团",
      nameLatin: "Vienna Philharmonic Orchestra",
      displayName: "维也纳爱乐",
      displayFullName: "维也纳爱乐乐团",
      displayLatinName: "Vienna Philharmonic Orchestra",
      country: "Austria",
      avatarSrc: "",
      roles: ["orchestra"],
      aliases: ["Vienna Philharmonic"],
      abbreviations: ["VPO"],
      sortKey: "vienna-phil",
      summary: "奥地利乐团。",
      imageSourceUrl: "",
      imageSourceKind: "",
      imageAttribution: "",
      imageUpdatedAt: "",
    },
  ],
  workGroups: [
    {
      id: "concerto",
      composerId: "beethoven",
      title: "钢琴协奏曲",
      slug: "piano-concerto",
      path: ["钢琴协奏曲"],
      sortKey: "0100",
    },
  ],
  works: [
    {
      id: "emperor",
      composerId: "beethoven",
      groupIds: ["concerto"],
      slug: "emperor",
      title: "第五钢琴协奏曲《皇帝》",
      titleLatin: "Piano Concerto No. 5 'Emperor'",
      aliases: ["皇帝"],
      catalogue: "Op. 73",
      summary: "贝多芬钢琴协奏曲。",
      sortKey: "0500",
      updatedAt: "2026-03-09T00:00:00.000Z",
      infoPanel: { text: "", articleId: "", collectionLinks: [] },
    },
  ],
  recordings: [
    {
      id: "karajan-bpo-pollini-1977",
      workId: "emperor",
      slug: "karajan-bpo-pollini-1977",
      title: "卡拉扬 1977",
      workTypeHint: "concerto",
      sortKey: "0100",
      isPrimaryRecommendation: true,
      updatedAt: "2026-03-09T00:00:00.000Z",
      images: [],
      credits: [
        { role: "conductor", personId: "karajan", displayName: "Herbert von Karajan" },
        { role: "orchestra", personId: "bpo", displayName: "Berlin Philharmonic Orchestra" },
        { role: "soloist", personId: "pollini", displayName: "Maurizio Pollini" },
      ],
      links: [{ platform: "youtube", url: "https://www.youtube.com/watch?v=12345678901", title: "Video" }],
      notes: "",
      performanceDateText: "1977",
      venueText: "Berlin",
      albumTitle: "",
      label: "",
      releaseDate: "",
      infoPanel: { text: "", articleId: "", collectionLinks: [] },
    },
  ],
});

describe("display normalization", () => {
  it("builds search entries from canonical display fields and orchestra abbreviations", () => {
    const indexes = buildIndexes(library, { canonicalPersonLinks: {} });
    const orchestraEntry = indexes.searchIndex.find((entry) => entry.id === "vpo");

    expect(orchestraEntry?.primaryText).toBe("维也纳爱乐乐团");
    expect(orchestraEntry?.secondaryText).toContain("维也纳爱乐");
    expect(orchestraEntry?.secondaryText).toContain("Vienna Philharmonic Orchestra");
    expect(orchestraEntry?.aliasTokens).toContain("VPO");
  });

  it("builds normalized work recording titles from conductor, orchestra and artist display names", () => {
    const entry = buildRecordingListEntry(library.recordings[0], library);

    expect(entry.title).toBe("卡拉扬 - 波里尼 - 柏林爱乐乐团 - 1977");
    expect(entry.secondaryText).toContain("Karajan");
    expect(entry.secondaryText).toContain("Pollini");
    expect(entry.secondaryText).toContain("Berliner Philharmoniker");
    expect(entry.metaText).toContain("1977");
    expect(entry.metaText).toContain("Berlin");
  });

  it("collects visible website data issues as structured maintenance guidance", () => {
    const issues = collectLibraryDataIssues(
      validateLibrary({
        ...library,
        people: [
          {
            ...library.people[0],
            displayFullName: "",
            birthYear: 1979,
            deathYear: 1964,
          },
          ...library.people.slice(1),
        ],
      }),
    );

    expect(issues.some((issue) => issue.category === "year-conflict")).toBe(true);
  });

  /*
  it("flags a short Chinese display name without a distinct Chinese full name", () => {
    const issues = collectLibraryDataIssues(
      validateLibrary({
        ...library,
        composers: [
          {
            ...library.composers[0],
            name: "贝多芬",
            aliases: ["L. v. Beethoven"],
          },
        ],
      }),
    );

    expect(issues.some((issue) => issue.message.includes("规范全名") || issue.message.includes("全称"))).toBe(true);
  });
  */

  it("flags a short Chinese display name without a distinct Chinese full name", () => {
    const issues = collectLibraryDataIssues(
      validateLibrary({
        ...library,
        composers: [
          {
            ...library.composers[0],
            name: "短名",
            aliases: ["L. v. Beethoven"],
          },
        ],
      }),
    );

    expect(
      issues.some((issue) =>
        issue.message.includes("missing canonical full name or latin name"),
      ),
    ).toBe(true);
  });

  it("builds concerto daily cards with work-first ordering and only date/place detail slots", () => {
    const model = buildRecordingDisplayModel(library.recordings[0], library);

    expect(model.title).toBe("卡拉扬 - 波里尼 - 柏林爱乐乐团 - 1977");
    expect(model.subtitle).toBe("Karajan - Pollini - Berliner Philharmoniker - 1977");
    expect(model.daily.workPrimary).toContain("第五钢琴协奏曲");
    expect(model.daily.workSecondary).toContain("Piano Concerto");
    expect(model.daily.workSecondary).toContain(" | ");
    expect(model.daily.composerPrimary).not.toBe("");
    expect(model.daily.composerSecondary).toContain("Ludwig van Beethoven");
    expect(model.daily.principalPrimary).toBe("");
    expect(model.daily.principalSecondary).toBe("");
    expect(model.daily.supportingPrimary).toBe("");
    expect(model.daily.supportingSecondary).toBe("");
    expect(model.daily.ensemblePrimary).toBe("");
    expect(model.daily.ensembleSecondary).toBe("");
    expect(model.daily.datePlacePrimary).toBe("1977");
  });

  it("deduplicates conductor names out of soloist lines when the same person appears in both roles", () => {
    const dedupeLibrary = validateLibrary({
      ...library,
      people: [
        ...library.people,
        {
          id: "arrau",
          slug: "arrau",
          name: "阿劳",
          fullName: "克劳迪奥·阿劳",
          nameLatin: "Claudio Arrau",
          displayName: "阿劳",
          displayFullName: "克劳迪奥·阿劳",
          displayLatinName: "Arrau",
          country: "Chile",
          avatarSrc: "",
          roles: ["soloist"],
          aliases: ["Claudio Arrau"],
          abbreviations: [],
          sortKey: "arrau",
          summary: "钢琴家。",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
      ],
      recordings: [
        {
          ...library.recordings[0],
          id: "concerto-duplicate-credit",
          performanceDateText: "1958",
          credits: [
            { role: "conductor", personId: "karajan", displayName: "Herbert von Karajan" },
            { role: "soloist", personId: "karajan", displayName: "Herbert von Karajan" },
            { role: "soloist", personId: "arrau", displayName: "Claudio Arrau" },
            { role: "orchestra", personId: "bpo", displayName: "Berlin Philharmonic Orchestra" },
          ],
          links: [],
        },
      ],
    });

    const model = buildRecordingDisplayModel(dedupeLibrary.recordings[0], dedupeLibrary);

    expect(model.title).toBe("卡拉扬 - 阿劳 - 柏林爱乐乐团 - 1958");
    expect(model.daily.principalPrimary).toBe("");
    expect(model.daily.supportingPrimary).toBe("");
  });

  it("keeps the work secondary line on composer latin text instead of a removed display field", () => {
    const model = buildRecordingDisplayModel(library.recordings[0], library);

    expect(model.daily.composerSecondary).toContain("Ludwig van Beethoven");
  });

  it("returns empty work lines when the referenced work is missing", () => {
    const model = buildRecordingDisplayModel(
      {
        ...library.recordings[0],
        id: "missing-work-recording",
        workId: "missing-work",
      },
      library,
    );

    expect(model.daily.workPrimary).toBe("");
    expect(model.daily.workSecondary).toBe("");
    expect(model.daily.composerPrimary).toBe("");
    expect(model.daily.composerSecondary).toBe("");
  });

  it("combines orchestra and chorus credits inside orchestral recording titles", () => {
    const choralLibrary = validateLibrary({
      ...library,
      people: [
        ...library.people,
        {
          id: "bayreuth-chorus",
          slug: "bayreuth-festival-chorus",
          name: "拜罗伊特节日剧院合唱团",
          fullName: "拜罗伊特节日剧院合唱团",
          nameLatin: "Bayreuth Festival Chorus",
          displayName: "拜罗伊特节日剧院合唱团",
          displayFullName: "拜罗伊特节日剧院合唱团",
          displayLatinName: "Bayreuth Festival Chorus",
          country: "Germany",
          avatarSrc: "",
          roles: ["chorus"],
          aliases: [],
          abbreviations: [],
          sortKey: "bayreuth-chorus",
          summary: "合唱团。",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
      ],
      workGroups: [
        {
          id: "symphony",
          composerId: "beethoven",
          title: "交响曲",
          slug: "symphony",
          path: ["交响曲"],
          sortKey: "0200",
        },
      ],
      works: [
        {
          id: "beethoven-9",
          composerId: "beethoven",
          groupIds: ["symphony"],
          slug: "beethoven-9",
          title: "第九交响曲“合唱”",
          titleLatin: "Symphony No. 9 in D minor, Op. 125",
          aliases: [],
          catalogue: "Op. 125",
          summary: "",
          sortKey: "0900",
          updatedAt: "2026-03-21T00:00:00.000Z",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
      recordings: [
        {
          id: "furt-1951",
          workId: "beethoven-9",
          slug: "furt-1951",
          title: "富特 1951",
          workTypeHint: "orchestral",
          sortKey: "0200",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [
            { role: "conductor", personId: "karajan", displayName: "Herbert von Karajan" },
            { role: "orchestra", personId: "bpo", displayName: "Berlin Philharmonic Orchestra" },
            { role: "chorus", personId: "bayreuth-chorus", displayName: "Bayreuth Festival Chorus" },
          ],
          links: [],
          notes: "",
          performanceDateText: "1951",
          venueText: "Bayreuth",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const model = buildRecordingDisplayModel(choralLibrary.recordings[0], choralLibrary);

    expect(model.title).toBe("卡拉扬 - 柏林爱乐乐团 - 拜罗伊特节日剧院合唱团 - 1951");
    expect(model.subtitle).toBe("Karajan - Berliner Philharmoniker - Bayreuth Festival Chorus - 1951");
  });

  it("keeps multiple soloists in order for chamber recordings without forcing a fake ensemble", () => {
    const chamberLibrary = validateLibrary({
      ...library,
      people: [
        ...library.people,
        {
          id: "zimmermann",
          slug: "zimmermann",
          name: "齐默尔曼",
          fullName: "弗兰克·彼得·齐默尔曼",
          nameLatin: "Frank Peter Zimmermann",
          displayName: "齐默尔曼",
          displayFullName: "弗兰克·彼得·齐默尔曼",
          displayLatinName: "Zimmermann",
          country: "Germany",
          avatarSrc: "",
          roles: ["soloist"],
          aliases: [],
          abbreviations: [],
          sortKey: "zimmermann",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
        {
          id: "novak",
          slug: "novak",
          name: "诺瓦克",
          fullName: "米哈乌·诺瓦克",
          nameLatin: "Michal Novak",
          displayName: "诺瓦克",
          displayFullName: "米哈乌·诺瓦克",
          displayLatinName: "Novak",
          country: "Poland",
          avatarSrc: "",
          roles: ["soloist"],
          aliases: [],
          abbreviations: [],
          sortKey: "novak",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
      ],
      workGroups: [
        {
          id: "chamber",
          composerId: "beethoven",
          title: "室内乐",
          slug: "chamber",
          path: ["室内乐"],
          sortKey: "0300",
        },
      ],
      works: [
        {
          id: "duo-work",
          composerId: "beethoven",
          groupIds: ["chamber"],
          slug: "duo-work",
          title: "二重奏",
          titleLatin: "Duo",
          aliases: [],
          catalogue: "",
          summary: "",
          sortKey: "0301",
          updatedAt: "2026-03-21T00:00:00.000Z",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
      recordings: [
        {
          id: "duo-2025",
          workId: "duo-work",
          slug: "duo-2025",
          title: "临时组合 2025",
          workTypeHint: "chamber_solo",
          sortKey: "0301",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [
            { role: "soloist", personId: "zimmermann", displayName: "Frank Peter Zimmermann" },
            { role: "soloist", personId: "novak", displayName: "Michal Novak" },
          ],
          links: [],
          notes: "",
          performanceDateText: "2025",
          venueText: "Poland",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const model = buildRecordingDisplayModel(chamberLibrary.recordings[0], chamberLibrary);

    expect(model.title).toBe("齐默尔曼 - 诺瓦克 - Poland - 2025");
    expect(model.subtitle).toBe("Zimmermann - Novak - Poland - 2025");
  });
});
