import { describe, expect, it } from "vitest";

import { buildComposerDirectoryEntry, buildDirectorySections, createDirectoryDisplayEntry } from "@/lib/directory";

describe("buildDirectorySections", () => {
  const entries = [
    buildComposerDirectoryEntry(
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
        summary: "德国作曲家。",
      },
      {
        href: "/composers/beethoven/",
        representativeWorks: ["第三交响曲《英雄》", "第五交响曲《命运》"],
      },
    ),
    buildComposerDirectoryEntry(
      {
        id: "berlioz",
        slug: "berlioz",
        name: "柏辽兹",
        fullName: "艾克托尔·路易·柏辽兹",
        nameLatin: "Hector Louis Berlioz",
        country: "France",
        avatarSrc: "",
        birthYear: 1803,
        deathYear: 1869,
        aliases: [],
        summary: "法国作曲家。",
      },
      {
        href: "/composers/berlioz/",
        representativeWorks: ["幻想交响曲"],
      },
    ),
  ];

  it("groups entries alphabetically by surname", () => {
    const grouped = buildDirectorySections(entries, "surname");

    expect(grouped.rail).toEqual(["B"]);
    expect(grouped.sections[0]?.items.map((item) => item.id)).toEqual(["beethoven", "berlioz"]);
  });

  it("groups entries chronologically by birth decade", () => {
    const grouped = buildDirectorySections(entries, "birth");

    expect(grouped.rail).toEqual(["1770s", "1800s"]);
    expect(grouped.sections[0]?.title).toBe("1770s");
    expect(grouped.sections[1]?.title).toBe("1800s");
  });

  it("groups entries alphabetically by country", () => {
    const grouped = buildDirectorySections(entries, "country");

    expect(grouped.rail).toEqual(["F", "G"]);
    expect(grouped.sections.map((section) => section.title)).toEqual(["France", "Germany"]);
  });

  it("creates a fixed-height display model with clamped summary and representative works", () => {
    const display = createDirectoryDisplayEntry({
      ...entries[0],
      summary:
        "贝多芬的简介被故意拉长，用来测试目录条目在统一固定高度布局下是否会提前被截断，并且不会因为内容过长而把单条目录项撑得比其他条目更高。",
      representativeWorks: [
        "第三交响曲《英雄》",
        "第五交响曲《命运》",
        "第九交响曲《合唱》",
        "第二十三钢琴奏鸣曲《热情》",
        "庄严弥撒",
      ],
    });

    expect(display.summaryExcerpt.length).toBeLessThan(display.summary.length);
    expect(display.representativeWorks).toHaveLength(3);
    expect(display.representativeWorksLabel).toContain("第三交响曲《英雄》");
  });
});
