import { describe, expect, it } from "vitest";

import { parseLegacyRecordingHtml } from "../../packages/data-core/src/legacy-parser.js";

describe("legacy parser", () => {
  it("parses Chinese legacy recording labels without collapsing orchestra names to placeholders", () => {
    const parsed = parseLegacyRecordingHtml(`
      <html>
        <body>
          <p>乐团：Bayreuth Festival Orchestra &amp; Chorus</p>
          <p>指挥：威尔海姆·富特文格勒</p>
          <p>时间、地点：29 July 1951, at Festspielhaus, in Bayreuth</p>
          <p>专辑：Bayreuth 1951</p>
          <p>厂牌：Orfeo</p>
          <p>发行日期：1952</p>
        </body>
      </html>
    `);

    expect(parsed.credits).toEqual([
      {
        role: "orchestra",
        personId: "",
        displayName: "Bayreuth Festival Orchestra & Chorus",
        label: "乐团",
      },
      {
        role: "conductor",
        personId: "",
        displayName: "威尔海姆·富特文格勒",
        label: "指挥",
      },
    ]);
    expect(parsed.performanceDateText).toBe("29 July 1951, at Festspielhaus");
    expect(parsed.venueText).toBe("in Bayreuth");
    expect(parsed.albumTitle).toBe("Bayreuth 1951");
    expect(parsed.label).toBe("Orfeo");
    expect(parsed.releaseDate).toBe("1952");
  });
});
