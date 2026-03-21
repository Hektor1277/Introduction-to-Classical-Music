import { describe, expect, it } from "vitest";

import { cleanupLibraryPeople, ensurePeopleForCredits } from "../../packages/data-core/src/person-cleanup.js";
import { validateLibrary, type Credit, type LibraryData } from "../../packages/shared/src/schema.js";

function createBaseLibrary(overrides?: Partial<LibraryData>): LibraryData {
  return validateLibrary({
    composers: [
      {
        id: "composer-beethoven",
        slug: "beethoven",
        name: "贝多芬",
        nameLatin: "Ludwig van Beethoven",
        country: "Germany",
        avatarSrc: "",
        aliases: [],
        sortKey: "0010",
        summary: "",
        imageSourceUrl: "",
        imageSourceKind: "",
        imageAttribution: "",
        imageUpdatedAt: "",
        infoPanel: { text: "", articleId: "", collectionLinks: [] },
        roles: ["composer"],
      },
    ],
    people: [],
    workGroups: [
      {
        id: "work-group-symphony",
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
        groupIds: ["work-group-symphony"],
        slug: "symphony-9",
        title: "第九交响曲“合唱”",
        titleLatin: "Symphony No.9",
        aliases: [],
        catalogue: "Op.125",
        summary: "",
        infoPanel: { text: "", articleId: "", collectionLinks: [] },
        sortKey: "0010",
        updatedAt: "2026-03-21T00:00:00.000Z",
      },
    ],
    recordings: [],
    ...overrides,
  });
}

function credit(input: Partial<Credit> & Pick<Credit, "role" | "displayName">): Credit {
  return {
    role: input.role,
    displayName: input.displayName,
    personId: input.personId ?? "",
    label: input.label ?? "",
  };
}

describe("person cleanup", () => {
  it("creates a formal ensemble person for parsed orchestra credits", () => {
    const library = createBaseLibrary();

    const nextLibrary = ensurePeopleForCredits(library, [
      credit({
        role: "orchestra",
        displayName: "Bayreuth Festival Orchestra & Chorus",
        label: "乐团",
      }),
    ]);

    expect(nextLibrary.people).toHaveLength(1);
    expect(nextLibrary.people[0]).toMatchObject({
      name: "Bayreuth Festival Orchestra & Chorus",
      roles: ["orchestra"],
    });
  });

  it("rebinds placeholder ensemble credits to formal people and removes unused placeholders", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-orchestra-unknown",
          slug: "unknown",
          name: "未知",
          nameLatin: "",
          country: "",
          avatarSrc: "",
          aliases: [],
          sortKey: "0010",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
      ],
      recordings: [
        {
          id: "recording-furt-1951",
          workId: "work-beethoven-9",
          slug: "furt-1951",
          title: "富特文格勒 - Bayreuth Festival Orchestra & Chorus - 1951",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-orchestra-unknown",
              displayName: "Bayreuth Festival Orchestra & Chorus",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1951",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);
    const nextRecording = nextLibrary.recordings[0];

    expect(nextLibrary.people.some((person) => person.name === "未知")).toBe(false);
    expect(nextLibrary.people.some((person) => person.name === "Bayreuth Festival Orchestra & Chorus")).toBe(true);
    expect(nextRecording.credits[0]).toMatchObject({
      role: "orchestra",
      displayName: "Bayreuth Festival Orchestra & Chorus",
    });
    expect(nextRecording.credits[0].personId).not.toBe("person-orchestra-unknown");
  });

  it("infers a missing orchestra credit from metadata when the venue text matches a known ensemble", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-staatskapelle-dresden",
          slug: "saechsische-staatskapelle-dresden",
          name: "Sächsische Staatskapelle Dresden",
          nameLatin: "Sächsische Staatskapelle Dresden",
          country: "Germany",
          avatarSrc: "",
          aliases: [],
          sortKey: "0010",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
        {
          id: "person-sinopoli",
          slug: "sinopoli",
          name: "朱塞佩·西诺波利",
          nameLatin: "Giuseppe Sinopoli",
          country: "Italy",
          avatarSrc: "",
          aliases: [],
          sortKey: "0020",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["conductor"],
        },
      ],
      recordings: [
        {
          id: "recording-sinopoli-1999",
          workId: "work-beethoven-9",
          slug: "sinopoli-1999",
          title: "西诺波利 - 1999",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [credit({ role: "conductor", personId: "person-sinopoli", displayName: "朱塞佩·西诺波利", label: "指挥" })],
          links: [],
          notes: "",
          performanceDateText: "1999",
          venueText: "Sächsische Staatskapelle Dresden",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);
    const orchestraCredit = nextLibrary.recordings[0].credits.find((item) => item.role === "orchestra");

    expect(orchestraCredit).toMatchObject({
      personId: "person-staatskapelle-dresden",
      displayName: "Sächsische Staatskapelle Dresden",
    });
  });

  it("does not invent a formal person when both displayName and metadata are placeholders", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-orchestra-unknown",
          slug: "unknown",
          name: "未知",
          nameLatin: "",
          country: "",
          avatarSrc: "",
          aliases: [],
          sortKey: "0010",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
      ],
      recordings: [
        {
          id: "recording-unsafe-placeholder",
          workId: "work-beethoven-9",
          slug: "unsafe-placeholder",
          title: "未知 - 1916",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [credit({ role: "orchestra", personId: "person-orchestra-unknown", displayName: "未知", label: "乐团" })],
          links: [],
          notes: "",
          performanceDateText: "1916",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);

    expect(nextLibrary.people).toHaveLength(1);
    expect(nextLibrary.people[0].id).toBe("person-orchestra-unknown");
    expect(nextLibrary.recordings[0].credits[0].personId).toBe("person-orchestra-unknown");
  });

  it("rebinds thin duplicate group entities to the canonical group entry", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-wiener-philharmoniker",
          slug: "wiener-philharmoniker",
          name: "维也纳爱乐乐团",
          nameLatin: "Vienna Philharmonic Orchestra",
          country: "Austria",
          avatarSrc: "",
          aliases: ["维也纳爱乐", "Wiener Philharmoniker"],
          sortKey: "0010",
          summary: "正式条目",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
        {
          id: "person-orchestra-wiener-philharmoniker",
          slug: "wiener-philharmoniker",
          name: "Wiener Philharmoniker",
          nameLatin: "Wiener Philharmoniker",
          country: "",
          avatarSrc: "",
          aliases: [],
          sortKey: "0020",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
      ],
      recordings: [
        {
          id: "recording-bohm-1976",
          workId: "work-beethoven-9",
          slug: "bohm-1976",
          title: "伯姆 - 维也纳爱乐乐团 - 1976",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-21T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-orchestra-wiener-philharmoniker",
              displayName: "Wiener Philharmoniker",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1976",
          venueText: "",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);

    expect(nextLibrary.recordings[0].credits[0]).toMatchObject({
      personId: "person-wiener-philharmoniker",
      displayName: "维也纳爱乐乐团",
    });
    expect(nextLibrary.people.some((person) => person.id === "person-orchestra-wiener-philharmoniker")).toBe(false);
  });
});
