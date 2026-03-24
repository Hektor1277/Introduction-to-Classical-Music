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

    expect(nextLibrary.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Bayreuth Festival Orchestra", roles: ["orchestra"] }),
        expect.objectContaining({ name: "Bayreuth Festival Chorus", roles: ["chorus"] }),
      ]),
    );
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
    expect(nextLibrary.people.some((person) => person.name === "Bayreuth Festival Orchestra")).toBe(true);
    expect(nextLibrary.people.some((person) => person.name === "Bayreuth Festival Chorus")).toBe(true);
    expect(nextRecording.credits[0]).toMatchObject({
      role: "orchestra",
      displayName: "Bayreuth Festival Orchestra",
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

  it("splits composite orchestra and chorus credits into separate structured group entries", () => {
    const library = createBaseLibrary({
      recordings: [
        {
          id: "recording-furt-1951",
          workId: "work-beethoven-9",
          slug: "furt-1951",
          title: "富特文格勒 - Bayreuth Festival Orchestra & Chorus - 1951",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-22T00:00:00.000Z",
          images: [],
          credits: [credit({ role: "orchestra", displayName: "Bayreuth Festival Orchestra & Chorus", label: "乐团" })],
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
    const nextCredits = nextLibrary.recordings[0].credits;

    expect(nextCredits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "orchestra", displayName: "Bayreuth Festival Orchestra" }),
        expect.objectContaining({ role: "chorus", displayName: "Bayreuth Festival Chorus" }),
      ]),
    );
    expect(nextLibrary.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Bayreuth Festival Orchestra", roles: ["orchestra"] }),
        expect.objectContaining({ name: "Bayreuth Festival Chorus", roles: ["chorus"] }),
      ]),
    );
  });

  it("rebinds parenthetical legacy orchestra aliases to the canonical group entry", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-ndr",
          slug: "ndr-sinfonieorchester",
          name: "北德广播交响乐团",
          nameLatin: "NDR Elbphilharmonie Orchestra",
          country: "Germany",
          avatarSrc: "",
          aliases: ["NDRSO", "NDR Elbphilharmonie Orchestra"],
          sortKey: "0010",
          summary: "正式条目",
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
          id: "recording-1970",
          workId: "work-beethoven-9",
          slug: "1970",
          title: "汉斯施密特 - NDRSO (currently NDR Elbphilharmonie Orchestra) - 1970",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-22T00:00:00.000Z",
          images: [],
          credits: [credit({ role: "orchestra", displayName: "NDRSO (currently NDR Elbphilharmonie Orchestra)", label: "乐团" })],
          links: [],
          notes: "",
          performanceDateText: "1970",
          venueText: "Hamburg",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);

    expect(nextLibrary.recordings[0].credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "orchestra", personId: "person-ndr", displayName: "北德广播交响乐团" }),
      ]),
    );
  });

  it("creates a formal orchestra entry when venue metadata actually contains the ensemble name", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-sinopoli",
          slug: "sinopoli",
          name: "Giuseppe Sinopoli",
          nameLatin: "Giuseppe Sinopoli",
          country: "Italy",
          avatarSrc: "",
          aliases: [],
          sortKey: "0015",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["conductor"],
        },
      ],
      works: [
        {
          id: "work-mahler-5",
          composerId: "composer-beethoven",
          groupIds: ["work-group-symphony"],
          slug: "mahler-5",
          title: "Symphony No. 5",
          titleLatin: "Symphony No. 5",
          aliases: [],
          catalogue: "",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          sortKey: "0020",
          updatedAt: "2026-03-22T00:00:00.000Z",
        },
      ],
      recordings: [
        {
          id: "recording-sinopoli-1999",
          workId: "work-mahler-5",
          slug: "sinopoli-1999",
          title: "Sinopoli - 1999",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-22T00:00:00.000Z",
          images: [],
          credits: [credit({ role: "conductor", personId: "person-sinopoli", displayName: "Giuseppe Sinopoli", label: "指挥" })],
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
    const repairedRecording = nextLibrary.recordings[0];
    const createdPerson = nextLibrary.people.find((person) => person.nameLatin === "Sächsische Staatskapelle Dresden");

    expect(createdPerson).toMatchObject({
      roles: ["orchestra"],
      name: "Sächsische Staatskapelle Dresden",
    });
    expect(repairedRecording.credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "orchestra",
          personId: createdPerson?.id,
          displayName: "Sächsische Staatskapelle Dresden",
        }),
      ]),
    );
    expect(repairedRecording.venueText).toBe("");
  });

  it("removes unreferenced composite ensemble placeholder entries after credits are split and rebound", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-orchestra-bayreuth-festival-orchestra-and-chorus",
          slug: "bayreuth-festival-orchestra-and-chorus",
          name: "Bayreuth Festival Orchestra & Chorus",
          nameLatin: "Bayreuth Festival Orchestra & Chorus",
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
          id: "recording-furt-1951",
          workId: "work-beethoven-9",
          slug: "furt-1951",
          title: "富特文格勒 - Bayreuth Festival Orchestra & Chorus - 1951",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-22T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-orchestra-bayreuth-festival-orchestra-and-chorus",
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

    expect(nextLibrary.people.some((person) => person.id === "person-orchestra-bayreuth-festival-orchestra-and-chorus")).toBe(false);
  });

  it("downgrades referenced ambiguous composite ensemble people back to text credits", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-hko-and-ro",
          slug: "hko-and-ro",
          name: "HKO & RO",
          nameLatin: "",
          country: "",
          avatarSrc: "",
          aliases: [],
          sortKey: "0030",
          summary: "",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
        {
          id: "person-schn-evoigt",
          slug: "schneevoigt",
          name: "乔治·施内沃伊特",
          nameLatin: "Georg Schnéevoigt",
          country: "Finland",
          avatarSrc: "",
          aliases: [],
          sortKey: "0040",
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
          id: "recording-ignatius-1945",
          workId: "work-beethoven-9",
          slug: "ignatius-1945",
          title: "施内沃伊特 - 伊格内修斯 - HKO & RO - 1945.12.8",
          workTypeHint: "concerto",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-22T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-hko-and-ro",
              displayName: "HKO & RO",
              label: "乐团",
            }),
            credit({
              role: "conductor",
              personId: "person-schn-evoigt",
              displayName: "乔治·施内沃伊特",
              label: "指挥",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1945.12.8",
          venueText: "",
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
      role: "orchestra",
      personId: "",
      displayName: "HKO & RO",
    });
    expect(nextLibrary.people.some((person) => person.id === "person-hko-and-ro")).toBe(false);
  });

  it("rebinds polluted duplicate orchestra entities to the stronger canonical entry", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-leningrad",
          slug: "leningrad-philharmonic-orchestra",
          name: "列宁格勒爱乐乐团",
          fullName: "列宁格勒爱乐乐团",
          nameLatin: "Leningrad Philharmonic Orchestra",
          country: "Russia",
          avatarSrc: "",
          aliases: ["Saint Petersburg Philharmonic Orchestra"],
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
          id: "person-leningrad-polluted",
          slug: "leningrad-philharmonic-orchestra时间-地点-1979-东京",
          name: "列宁格勒爱乐乐团",
          fullName: "列宁格勒爱乐乐团",
          nameLatin: "Leningrad Philharmonic Orchestra",
          country: "Russia",
          avatarSrc: "",
          aliases: ["LPO"],
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
          id: "recording-muravinsky-1979",
          workId: "work-beethoven-9",
          slug: "muravinsky-1979",
          title: "穆拉文斯基 - 列宁格勒爱乐乐团 - 1979",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-24T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-leningrad-polluted",
              displayName: "列宁格勒爱乐乐团",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1979",
          venueText: "东京",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);

    expect(nextLibrary.recordings[0].credits[0]).toMatchObject({
      personId: "person-leningrad",
      displayName: "列宁格勒爱乐乐团",
    });
    expect(nextLibrary.people.some((person) => person.id === "person-leningrad-polluted")).toBe(false);
  });

  it("rebinds degraded latin orchestra duplicates when a stronger canonical entry exists", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-bpo",
          slug: "berliner-philharmoniker",
          name: "柏林爱乐乐团",
          fullName: "柏林爱乐乐团",
          nameLatin: "Berliner Philharmoniker",
          country: "Germany",
          avatarSrc: "",
          aliases: ["Berlin Philharmonic Orchestra", "Berlin Philharmonic", "BPO"],
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
          id: "person-bpo-degraded",
          slug: "berliner-philarmoniker",
          name: "Berliner Philarmoniker",
          fullName: "Berliner Philarmoniker",
          nameLatin: "Berliner Philarmoniker",
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
          id: "recording-furt-1953",
          workId: "work-beethoven-9",
          slug: "furt-1953",
          title: "富特文格勒 - Berliner Philarmoniker - 1953",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-24T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-bpo-degraded",
              displayName: "Berliner Philarmoniker",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1953",
          venueText: "Berlin",
          albumTitle: "",
          label: "",
          releaseDate: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
        },
      ],
    });

    const nextLibrary = cleanupLibraryPeople(library);

    expect(nextLibrary.recordings[0].credits[0]).toMatchObject({
      personId: "person-bpo",
      displayName: "柏林爱乐乐团",
    });
    expect(nextLibrary.people.some((person) => person.id === "person-bpo-degraded")).toBe(false);
  });

  it("does not rebind unrelated orchestras solely because they share an abbreviation alias", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-budapest",
          slug: "budapesti-filharmonikusok",
          name: "布达佩斯爱乐乐团",
          fullName: "布达佩斯爱乐乐团",
          nameLatin: "Budapest Philharmonic Orchestra",
          country: "Hungary",
          avatarSrc: "",
          aliases: ["BPO"],
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
          id: "person-berlin",
          slug: "berliner-philharmoniker",
          name: "柏林爱乐乐团",
          fullName: "柏林爱乐乐团",
          nameLatin: "Berliner Philharmoniker",
          country: "Germany",
          avatarSrc: "",
          aliases: ["BPO"],
          sortKey: "0020",
          summary: "正式条目",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
        {
          id: "person-budapest-polluted",
          slug: "budapesti-filharmo-niai-ta-rsasa-g-zenekara-en-budapest-philharmonic-orchestra-chn-布达佩斯爱乐乐团",
          name: "布达佩斯爱乐乐团",
          fullName: "布达佩斯爱乐乐团",
          nameLatin: "Budapest Philharmonic Orchestra",
          country: "Hungary",
          avatarSrc: "",
          aliases: ["BPO"],
          sortKey: "0030",
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
          id: "recording-kletzki-1954",
          workId: "work-beethoven-9",
          slug: "kletzki-1954",
          title: "克列茨基 - 安妮 - 布达佩斯爱乐乐团",
          workTypeHint: "concerto",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-24T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-budapest-polluted",
              displayName: "布达佩斯爱乐乐团",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1954",
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
      personId: "person-budapest",
      displayName: "布达佩斯爱乐乐团",
    });
    expect(nextLibrary.people.some((person) => person.id === "person-berlin")).toBe(true);
  });

  it("does not fuzzy-match different acronym-led symphony orchestras", () => {
    const library = createBaseLibrary({
      people: [
        {
          id: "person-nbc",
          slug: "nbc-symphony-orchestra",
          name: "NBC Symphony Orchestra",
          fullName: "NBC Symphony Orchestra",
          nameLatin: "NBC Symphony Orchestra",
          country: "United States",
          avatarSrc: "",
          aliases: [],
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
          id: "person-nhk",
          slug: "nhk-symphony-orchestra",
          name: "日本放送协会交响乐团",
          fullName: "日本放送协会交响乐团",
          nameLatin: "NHK Symphony Orchestra",
          country: "Japan",
          avatarSrc: "",
          aliases: [],
          sortKey: "0020",
          summary: "正式条目",
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          roles: ["orchestra"],
        },
        {
          id: "person-nbc-thin",
          slug: "nbc-symphony-orchestra",
          name: "NBC Symphony Orchestra",
          fullName: "NBC Symphony Orchestra",
          nameLatin: "NBC Symphony Orchestra",
          country: "",
          avatarSrc: "",
          aliases: [],
          sortKey: "0030",
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
          id: "recording-toscanini-1948",
          workId: "work-beethoven-9",
          slug: "toscanini-1948",
          title: "托斯卡尼尼 - NBC Symphony Orchestra - 1948",
          workTypeHint: "orchestral",
          sortKey: "0010",
          isPrimaryRecommendation: false,
          updatedAt: "2026-03-24T00:00:00.000Z",
          images: [],
          credits: [
            credit({
              role: "orchestra",
              personId: "person-nbc-thin",
              displayName: "NBC Symphony Orchestra",
              label: "乐团",
            }),
          ],
          links: [],
          notes: "",
          performanceDateText: "1948",
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
      personId: "person-nbc",
      displayName: "NBC Symphony Orchestra",
    });
    expect(nextLibrary.recordings[0].credits[0].personId).not.toBe("person-nhk");
  });
});
