import { describe, expect, it } from "vitest";

import { validateLibrary } from "@/lib/schema";
import { backfillRecordingWorkTypeHints, repairRecordingFromLegacyParse } from "../../packages/data-core/src/recording-repair.js";

describe("recording repair helpers", () => {
  it("backfills unknown recording work type hints from related work context", () => {
    const library = validateLibrary({
      composers: [
        {
          id: "composer-schumann",
          slug: "schumann",
          name: "舒曼",
          fullName: "罗伯特·舒曼",
          nameLatin: "Robert Schumann",
          country: "Germany",
          avatarSrc: "",
          aliases: [],
          sortKey: "0010",
          summary: "",
        },
      ],
      people: [],
      workGroups: [
        {
          id: "group-schumann-concerto",
          composerId: "composer-schumann",
          title: "钢琴协奏曲",
          slug: "piano-concerto",
          path: ["协奏曲", "钢琴协奏曲"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "work-schumann-op54",
          composerId: "composer-schumann",
          groupIds: ["group-schumann-concerto"],
          slug: "op54",
          title: "a小调钢琴协奏曲",
          titleLatin: "Piano Concerto, Op. 54",
          aliases: [],
          catalogue: "Op. 54",
          summary: "",
          sortKey: "0010",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
      ],
      recordings: [
        {
          id: "recording-op54-kletzki",
          workId: "work-schumann-op54",
          slug: "kletzki-1954",
          title: "克列茨基 1954",
          workTypeHint: "unknown",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [],
          links: [],
          notes: "",
          performanceDateText: "1954",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          legacyPath: "",
        },
      ],
    });

    const repaired = backfillRecordingWorkTypeHints(library);

    expect(repaired.recordings[0]?.workTypeHint).toBe("concerto");
  });

  it("replaces placeholder orchestra credits with parsed legacy credits and preserves valid existing links", () => {
    const library = validateLibrary({
      composers: [
        {
          id: "composer-beethoven",
          slug: "beethoven",
          name: "贝多芬",
          fullName: "路德维希·凡·贝多芬",
          nameLatin: "Ludwig van Beethoven",
          country: "Germany",
          avatarSrc: "",
          aliases: [],
          sortKey: "0010",
          summary: "",
        },
      ],
      people: [
        {
          id: "person-item",
          slug: "item",
          name: "-",
          fullName: "-",
          nameLatin: "",
          country: "",
          avatarSrc: "",
          roles: ["orchestra"],
          aliases: [],
          sortKey: "0001",
          summary: "",
        },
        {
          id: "person-furtwangler",
          slug: "furtwangler",
          name: "威尔海姆·富特文格勒",
          fullName: "威尔海姆·富特文格勒",
          nameLatin: "Wilhelm Furtwangler",
          country: "Germany",
          avatarSrc: "",
          roles: ["conductor"],
          aliases: [],
          sortKey: "0010",
          summary: "",
        },
        {
          id: "person-bayreuth",
          slug: "bayreuth-festival-orchestra-chorus",
          name: "拜罗伊特节日剧院合唱团与管弦乐团",
          fullName: "拜罗伊特节日剧院合唱团与管弦乐团",
          nameLatin: "Bayreuth Festival Orchestra & Chorus",
          country: "Germany",
          avatarSrc: "",
          roles: ["orchestra", "chorus"],
          aliases: ["Bayreuth Festival Orchestra & Chorus"],
          sortKey: "0011",
          summary: "",
        },
      ],
      workGroups: [
        {
          id: "group-beethoven-symphony",
          composerId: "composer-beethoven",
          title: "交响曲",
          slug: "symphony",
          path: ["交响曲"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "work-beethoven-9",
          composerId: "composer-beethoven",
          groupIds: ["group-beethoven-symphony"],
          slug: "symphony-9",
          title: "第九交响曲“合唱”",
          titleLatin: "Symphony No. 9 in D minor, Op. 125",
          aliases: [],
          catalogue: "Op. 125",
          summary: "",
          sortKey: "0010",
          updatedAt: "2026-03-21T00:00:00.000Z",
        },
      ],
      recordings: [
        {
          id: "recording-beethoven-9-furt-1951",
          workId: "work-beethoven-9",
          slug: "furt-1951",
          title: "富特 1951",
          workTypeHint: "unknown",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [
            { role: "orchestra", personId: "person-item", displayName: "-", label: "乐团" },
            { role: "conductor", personId: "person-furtwangler", displayName: "威尔海姆·富特文格勒", label: "文件名推断" },
          ],
          links: [],
          notes: "",
          performanceDateText: "",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          legacyPath: "作曲家/贝多芬/交响曲/第九交响曲“合唱”/富特1951.htm",
        },
      ],
    });

    const repaired = repairRecordingFromLegacyParse(library, library.recordings[0], {
      credits: [
        { role: "orchestra", personId: "", displayName: "Bayreuth Festival Orchestra & Chorus", label: "乐团" },
        { role: "conductor", personId: "", displayName: "威尔海姆·富特文格勒", label: "指挥" },
      ],
      performanceDateText: "29 July 1951, at Festspielhaus",
      venueText: "in Bayreuth",
      albumTitle: "Bayreuth 1951",
      label: "Orfeo",
      releaseDate: "1952",
      images: [],
      links: [],
    });

    expect(repaired.workTypeHint).toBe("orchestral");
    expect(repaired.credits).toEqual([
      {
        role: "conductor",
        personId: "person-furtwangler",
        displayName: "威尔海姆·富特文格勒",
        label: "文件名推断",
      },
      {
        role: "orchestra",
        personId: "person-bayreuth",
        displayName: "拜罗伊特节日剧院合唱团与管弦乐团",
        label: "乐团",
      },
    ]);
    expect(repaired.performanceDateText).toBe("29 July 1951, at Festspielhaus");
    expect(repaired.venueText).toBe("in Bayreuth");
    expect(repaired.albumTitle).toBe("Bayreuth 1951");
    expect(repaired.label).toBe("Orfeo");
    expect(repaired.releaseDate).toBe("1952");
  });
});
