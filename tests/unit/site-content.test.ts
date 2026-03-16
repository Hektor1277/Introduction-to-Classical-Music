import { describe, expect, it } from "vitest";

import type { LibraryData } from "@/lib/schema";
import type { SiteConfig } from "@/lib/library-store";
import { buildRecentWorkUpdates, mergeSiteConfigPatch } from "@/lib/site-content";

const library: LibraryData = {
  composers: [
    {
      id: "beethoven",
      slug: "beethoven",
      name: "贝多芬",
      fullName: "路德维希·凡·贝多芬",
      nameLatin: "Ludwig van Beethoven",
      country: "Germany",
      avatarSrc: "",
      birthYear: 1770,
      deathYear: 1827,
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
      slug: "symphonies",
      path: ["交响曲"],
      sortKey: "0100",
    },
  ],
  works: [
    {
      id: "work-5",
      composerId: "beethoven",
      groupIds: ["group-symphony"],
      slug: "symphony-5",
      title: "第五交响曲",
      titleLatin: "",
      aliases: [],
      catalogue: "Op. 67",
      summary: "",
      sortKey: "0100",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
    {
      id: "work-7",
      composerId: "beethoven",
      groupIds: ["group-symphony"],
      slug: "symphony-7",
      title: "第七交响曲",
      titleLatin: "",
      aliases: [],
      catalogue: "Op. 92",
      summary: "",
      sortKey: "0200",
      updatedAt: "2026-03-02T00:00:00.000Z",
    },
  ],
  recordings: [
    {
      id: "recording-1",
      workId: "work-5",
      slug: "recording-1",
      title: "版本 1",
      sortKey: "0100",
      isPrimaryRecommendation: true,
      updatedAt: "2026-03-07T10:00:00.000Z",
      images: [],
      credits: [],
      links: [{ platform: "youtube", url: "https://www.youtube.com/watch?v=1", title: "" }],
      notes: "",
      performanceDateText: "",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
    },
    {
      id: "recording-2",
      workId: "work-5",
      slug: "recording-2",
      title: "版本 2",
      sortKey: "0200",
      isPrimaryRecommendation: false,
      updatedAt: "2026-03-06T10:00:00.000Z",
      images: [],
      credits: [],
      links: [{ platform: "youtube", url: "https://www.youtube.com/watch?v=2", title: "" }],
      notes: "",
      performanceDateText: "",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
    },
    {
      id: "recording-3",
      workId: "work-7",
      slug: "recording-3",
      title: "版本 3",
      sortKey: "0300",
      isPrimaryRecommendation: false,
      updatedAt: "2026-03-05T10:00:00.000Z",
      images: [],
      credits: [],
      links: [{ platform: "youtube", url: "https://www.youtube.com/watch?v=3", title: "" }],
      notes: "",
      performanceDateText: "",
      venueText: "",
      albumTitle: "",
      label: "",
      releaseDate: "",
    },
  ],
};

describe("buildRecentWorkUpdates", () => {
  it("returns unique work-level updates instead of recording-level duplicates", () => {
    expect(buildRecentWorkUpdates(library, 5)).toEqual([
      {
        composerName: "路德维希·凡·贝多芬",
        href: "/works/work-5/",
        updatedAt: "2026-03-07",
        workId: "work-5",
        workTitle: "第五交响曲",
      },
      {
        composerName: "路德维希·凡·贝多芬",
        href: "/works/work-7/",
        updatedAt: "2026-03-05",
        workId: "work-7",
        workTitle: "第七交响曲",
      },
    ]);
  });
});

describe("mergeSiteConfigPatch", () => {
  it("merges editable site fields and preserves unspecified values", () => {
    const current: SiteConfig = {
      title: "古典导聆不全书",
      subtitle: "公益性的古典音乐版本导聆目录",
      description: "旧描述",
      heroIntro: "旧首页引言",
      about: ["第一段", "第二段"],
      contact: {
        label: "联系",
        value: "QQ 123456",
      },
      copyrightNotice: "旧版权",
      lastImportedAt: "2026-03-07T15:13:50.982Z",
    };

    expect(
      mergeSiteConfigPatch(current, {
        subtitle: "新的副标题",
        about: ["新的第一段"],
        contact: {
          value: "QQ 439183718",
        },
      }),
    ).toEqual({
      title: "古典导聆不全书",
      subtitle: "新的副标题",
      description: "旧描述",
      heroIntro: "旧首页引言",
      about: ["新的第一段"],
      contact: {
        label: "联系",
        value: "QQ 439183718",
      },
      copyrightNotice: "旧版权",
      lastImportedAt: "2026-03-07T15:13:50.982Z",
    });
  });
});
