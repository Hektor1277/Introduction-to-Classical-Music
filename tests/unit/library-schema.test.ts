import { describe, expect, it } from "vitest";

import { validateLibrary } from "@/lib/schema";

const baseLibrary = {
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      nameLatin: "Ludwig van Beethoven",
      aliases: [],
      sortKey: "beethoven",
      summary: "德国作曲家。",
    },
  ],
  people: [
    {
      id: "karajan",
      slug: "karajan",
      name: "赫伯特·冯·卡拉扬",
      nameLatin: "Herbert von Karajan",
      roles: ["conductor"],
      aliases: [],
      sortKey: "karajan",
      summary: "奥地利指挥家。",
    },
  ],
  workGroups: [
    {
      id: "beethoven-symphony",
      composerId: "beethoven",
      title: "交响曲",
      slug: "交响曲",
      path: ["交响曲"],
      sortKey: "0100",
    },
  ],
  works: [
    {
      id: "beethoven-symphony-7",
      composerId: "beethoven",
      groupIds: ["beethoven-symphony"],
      slug: "第七交响曲",
      title: "第七交响曲",
      titleLatin: "Symphony No. 7 in A major, Op. 92",
      aliases: [],
      catalogue: "Op. 92",
      summary: "贝多芬第七交响曲。",
      sortKey: "0700",
      updatedAt: "2026-03-07T00:00:00.000Z",
    },
  ],
  recordings: [
    {
      id: "karajan-1963",
      workId: "beethoven-symphony-7",
      slug: "karajan-1963",
      title: "卡拉扬 1963",
      sortKey: "0100",
      isPrimaryRecommendation: true,
      updatedAt: "2026-03-07T00:00:00.000Z",
      images: [{ src: "/library/recordings/karajan-1963/cover.jpg", alt: "Karajan 1963" }],
      credits: [{ role: "conductor", personId: "karajan", displayName: "赫伯特·冯·卡拉扬" }],
      links: [{ platform: "bilibili", url: "https://www.bilibili.com/video/BV1ut4y1d7VM" }],
      notes: "柏林爱乐录音。",
      performanceDateText: "1963",
      venueText: "Berlin",
      albumTitle: "",
      label: "",
      releaseDate: "",
    },
  ],
};

describe("validateLibrary", () => {
  it("accepts a valid library payload", () => {
    const library = validateLibrary(baseLibrary);

    expect(library.composers).toHaveLength(1);
    expect(library.recordings[0]?.slug).toBe("karajan-1963");
  });

  it("migrates legacy named-entity fields into the canonical schema", () => {
    const library = validateLibrary({
      ...baseLibrary,
      composers: [
        {
          ...baseLibrary.composers[0],
          name: "贝多芬",
          fullName: "路德维希·凡·贝多芬",
          displayName: "贝多芬",
          displayFullName: "路德维希·凡·贝多芬",
          displayLatinName: "Ludwig van Beethoven",
          abbreviations: ["LvB"],
          aliases: ["L. v. Beethoven"],
        },
      ],
      people: [
        {
          ...baseLibrary.people[0],
          name: "卡拉扬",
          fullName: "赫伯特·冯·卡拉扬",
          displayName: "卡拉扬",
          displayFullName: "赫伯特·冯·卡拉扬",
          displayLatinName: "Herbert von Karajan",
          abbreviations: ["HVK"],
          aliases: ["Herbert von Karajan"],
        },
      ],
    });

    expect(library.composers[0]).toMatchObject({
      name: "路德维希·凡·贝多芬",
      nameLatin: "Ludwig van Beethoven",
    });
    expect(library.composers[0]?.aliases).toEqual(["L. v. Beethoven", "LvB", "贝多芬"]);
    expect(library.people[0]).toMatchObject({
      name: "赫伯特·冯·卡拉扬",
      nameLatin: "Herbert von Karajan",
    });
    expect(library.people[0]?.aliases).toEqual(["Herbert von Karajan", "HVK", "卡拉扬"]);
  });

  it("rejects unknown person roles", () => {
    const invalid = structuredClone(baseLibrary);
    invalid.people[0].roles = ["maestro"];

    expect(() => validateLibrary(invalid)).toThrow(/role/i);
  });

  it("rejects recordings that point to missing works", () => {
    const invalid = structuredClone(baseLibrary);
    invalid.recordings[0].workId = "missing-work";

    expect(() => validateLibrary(invalid)).toThrow(/work/i);
  });

  it("rejects empty resource links", () => {
    const invalid = structuredClone(baseLibrary);
    invalid.recordings[0].links = [{ platform: "youtube", url: "" }];

    expect(() => validateLibrary(invalid)).toThrow(/url/i);
  });

  it("migrates legacy info panel collectionUrl into collectionLinks", () => {
    const library = validateLibrary({
      ...baseLibrary,
      composers: [
        {
          ...baseLibrary.composers[0],
          infoPanel: {
            text: "延伸阅读",
            articleId: "",
            collectionUrl: "https://example.com/collection",
          },
        },
      ],
    });

    expect(library.composers[0]?.infoPanel.collectionLinks).toEqual([
      {
        platform: "other",
        url: "https://example.com/collection",
        title: "",
      },
    ]);
  });
});
