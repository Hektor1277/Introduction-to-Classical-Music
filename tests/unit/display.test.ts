import { describe, expect, it } from "vitest";

import { buildIndexes } from "@/lib/indexes";
import { buildRecordingListEntry, collectLibraryDataIssues } from "@/lib/display";
import { validateLibrary } from "@/lib/schema";

const library = validateLibrary({
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "路德维希·冯·贝多芬",
      nameLatin: "Ludwig van Beethoven",
      displayName: "贝多芬",
      displayFullName: "路德维希·冯·贝多芬",
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
      displayLatinName: "Herbert von Karajan",
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
      displayLatinName: "Maurizio Pollini",
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
      summary: "贝多芬协奏曲。",
      sortKey: "0500",
      updatedAt: "2026-03-09T00:00:00.000Z",
    },
  ],
  recordings: [
    {
      id: "karajan-bpo-pollini-1977",
      workId: "emperor",
      slug: "karajan-bpo-pollini-1977",
      title: "卡拉扬 1977",
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

    expect(entry.title).toBe("卡拉扬 - BPO - 波里尼");
    expect(entry.secondaryText).toContain("Herbert von Karajan");
    expect(entry.secondaryText).toContain("Berliner Philharmoniker");
    expect(entry.secondaryText).toContain("Maurizio Pollini");
    expect(entry.metaText).toBe("1977 · Berlin");
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
});
