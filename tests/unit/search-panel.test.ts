import { describe, expect, it } from "vitest";

import { buildSearchGroups, normalizeSearchQuery, type SearchPanelEntry } from "@/lib/search-panel";

const baseEntries: SearchPanelEntry[] = [
  { id: "1", kind: "orchestra", primaryText: "Berliner Philharmoniker", secondaryText: "BPO", href: "/1", matchTokens: [], aliasTokens: [] },
  { id: "2", kind: "orchestra", primaryText: "Berlin Philharmonic Orchestra", secondaryText: "BPO", href: "/2", matchTokens: [], aliasTokens: [] },
  { id: "3", kind: "orchestra", primaryText: "Konzerthausorchester Berlin", secondaryText: "", href: "/3", matchTokens: [], aliasTokens: [] },
  { id: "4", kind: "orchestra", primaryText: "Rundfunk-Sinfonieorchester Berlin", secondaryText: "", href: "/4", matchTokens: [], aliasTokens: [] },
  { id: "5", kind: "orchestra", primaryText: "Symphony Orchestra Berlin", secondaryText: "", href: "/5", matchTokens: [], aliasTokens: [] },
  { id: "6", kind: "orchestra", primaryText: "Akademie fur Alte Musik Berlin", secondaryText: "", href: "/6", matchTokens: [], aliasTokens: [] },
  { id: "7", kind: "orchestra", primaryText: "Berliner Symphoniker", secondaryText: "", href: "/7", matchTokens: [], aliasTokens: [] },
];

describe("search panel helpers", () => {
  it("normalizes punctuation and spacing in queries", () => {
    expect(normalizeSearchQuery(" Berlin（BPO） ")).toBe("berlin bpo");
  });

  it("keeps preview groups capped when there is no query", () => {
    const groups = buildSearchGroups(baseEntries, "", {});
    expect(groups).toHaveLength(1);
    expect(groups[0]?.totalItems).toBe(7);
    expect(groups[0]?.items).toHaveLength(5);
    expect(groups[0]?.totalPages).toBe(1);
  });

  it("shows all matched results up to the full query page size instead of collapsing to five", () => {
    const groups = buildSearchGroups(baseEntries, "berlin", {});
    expect(groups[0]?.items).toHaveLength(7);
    expect(groups[0]?.totalItems).toBe(7);
    expect(groups[0]?.totalPages).toBe(1);
  });

  it("paginates matched groups independently when a query returns many results", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      id: `work-${index + 1}`,
      kind: "work" as const,
      primaryText: `Symphony ${index + 1}`,
      secondaryText: `Berlin Edition ${index + 1}`,
      href: `/works/${index + 1}`,
      matchTokens: [],
      aliasTokens: [],
    }));

    const groups = buildSearchGroups(entries, "berlin", { work: 2 });
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["work-11", "work-12"]);
    expect(groups[0]?.page).toBe(2);
    expect(groups[0]?.totalPages).toBe(2);
  });

  it("does not surface work-group taxonomy as a duplicated top-level result group", () => {
    const entries: SearchPanelEntry[] = [
      {
        id: "group-symphony-beethoven",
        kind: "workGroup",
        primaryText: "交响曲",
        secondaryText: "贝多芬",
        href: "/composers/beethoven#symphony",
        matchTokens: ["交响曲", "贝多芬"],
        aliasTokens: [],
      },
      {
        id: "work-beethoven-5",
        kind: "work",
        primaryText: "第五交响曲",
        secondaryText: "贝多芬 / 交响曲 / Op. 67",
        href: "/works/beethoven-5",
        matchTokens: ["第五交响曲", "交响曲", "贝多芬", "Op. 67"],
        aliasTokens: [],
      },
    ];

    const groups = buildSearchGroups(entries, "交响曲", {});

    expect(groups.map((group) => group.kind)).toEqual(["work"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["work-beethoven-5"]);
  });
});
