import { describe, expect, it } from "vitest";

import { mergeBatchSessionIntoLibrary } from "../../apps/owner/server/batch-session-utils";
import { buildConfirmedBatchSelection } from "@/lib/batch-import";
import { validateLibrary } from "@/lib/schema";

describe("batch session utils", () => {
  it("persists confirmed batch drafts into the library when create is confirmed", () => {
    const library = validateLibrary({
      composers: [
        {
          id: "composer-tchaikovsky",
          slug: "tchaikovsky",
          name: "柴可夫斯基",
          fullName: "",
          nameLatin: "Pyotr Ilyich Tchaikovsky",
          displayName: "柴可夫斯基",
          displayFullName: "",
          displayLatinName: "Pyotr Ilyich Tchaikovsky",
          country: "Russia",
          avatarSrc: "",
          aliases: [],
          abbreviations: [],
          sortKey: "0010",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          imageSourceUrl: "",
          imageSourceKind: "",
          imageAttribution: "",
          imageUpdatedAt: "",
        },
      ],
      people: [],
      workGroups: [
        {
          id: "group-symphony",
          composerId: "composer-tchaikovsky",
          title: "交响曲",
          slug: "symphony",
          path: ["交响曲"],
          sortKey: "0010",
        },
      ],
      works: [
        {
          id: "work-tchaikovsky-5",
          composerId: "composer-tchaikovsky",
          groupIds: ["group-symphony"],
          slug: "tchaikovsky-5",
          title: "第五交响曲",
          titleLatin: "Symphony No. 5 in E minor",
          aliases: [],
          catalogue: "Op. 64",
          summary: "",
          infoPanel: { text: "", articleId: "", collectionLinks: [] },
          sortKey: "0010",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      ],
      recordings: [],
    });

    const selection = buildConfirmedBatchSelection(
      library,
      validateLibrary({
        ...library,
        recordings: [
          {
            id: "recording-kempe-1964",
            workId: "work-tchaikovsky-5",
            slug: "kempe-1964",
            title: "Kempe - LSO - 1964",
            sortKey: "0100",
            isPrimaryRecommendation: false,
            updatedAt: "2026-03-17T00:00:00.000Z",
            images: [],
            credits: [],
            links: [],
            notes: "",
            performanceDateText: "1964",
            venueText: "",
            albumTitle: "",
            label: "",
            releaseDate: "",
            infoPanel: { text: "", articleId: "", collectionLinks: [] },
          },
        ],
      }),
      {
        composers: [],
        people: [],
        works: [],
        recordings: [
          {
            draftId: "recording:1",
            entityType: "recording",
            sourceLine: "Kempe | LSO | 1964 | -",
            notes: [],
            reviewState: "confirmed",
            entity: {
              id: "recording-kempe-1964",
              workId: "work-tchaikovsky-5",
              slug: "kempe-1964",
              title: "Kempe - LSO - 1964",
              sortKey: "0100",
              isPrimaryRecommendation: false,
              updatedAt: "2026-03-17T00:00:00.000Z",
              images: [],
              credits: [],
              links: [],
              notes: "",
              performanceDateText: "1964",
              venueText: "",
              albumTitle: "",
              label: "",
              releaseDate: "",
              infoPanel: { text: "", articleId: "", collectionLinks: [] },
            },
          },
        ],
      },
    );

    const merged = mergeBatchSessionIntoLibrary(library, {
      draftLibrary: selection.draftLibrary,
      createdEntityRefs: selection.createdEntityRefs,
    });

    expect(merged.recordings.map((recording) => recording.id)).toContain("recording-kempe-1964");
  });
});
