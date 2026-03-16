import { describe, expect, it } from "vitest";

import { parseLegacyRecordingHtml, parseLegacyWorkPath } from "@/lib/legacy-parser";

const legacyHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p>资源链接：</p>
    <p>b站：<a href="https://www.bilibili.com/video/BV1ut4y1d7VM">BV</a></p>
    <p>油管：<a href="https://www.youtube.com/watch?v=SayJA16R0ZQ">Appassionata, 1st Movement, performed by Solomon Cutner</a></p>
    <hr />
    <p>乐团：Berliner Philharmoniker</p>
    <p>指挥：<a href="../../../../指挥家/卡拉扬.htm">赫伯特·冯·卡拉扬</a></p>
    <p>钢琴：<a href="../../../../独奏家/钢琴家/安妮·费舍尔.htm">安妮·费舍尔</a></p>
    <p>时间、地点：1963, Berlin</p>
    <p>专辑名称：Beethoven Symphonies</p>
    <p>发行商：DG</p>
    <p>发行日期：1963-10-01</p>
    <p><img src="../../../../pic/贝多芬/交响曲/第七/卡拉扬1963.png" /></p>
  </body>
</html>
`;

describe("legacy parser", () => {
  it("extracts work path structure from legacy paths", () => {
    const result = parseLegacyWorkPath("作曲家/贝多芬/奏鸣曲/钢琴奏鸣曲/第二十三钢琴奏鸣曲，热情/安妮·费舍尔1980.htm");

    expect(result.composerName).toBe("贝多芬");
    expect(result.groupPath).toEqual(["奏鸣曲", "钢琴奏鸣曲"]);
    expect(result.workName).toBe("第二十三钢琴奏鸣曲，热情");
    expect(result.recordingFileName).toBe("安妮·费舍尔1980");
  });

  it("parses anchor href as the real url while preserving anchor text as title", () => {
    const result = parseLegacyRecordingHtml(legacyHtml);

    expect(result.links).toHaveLength(2);
    expect(result.links[0]).toMatchObject({
      platform: "bilibili",
      url: "https://www.bilibili.com/video/BV1ut4y1d7VM",
      title: "BV",
    });
    expect(result.links[1]).toMatchObject({
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=SayJA16R0ZQ",
      title: "Appassionata, 1st Movement, performed by Solomon Cutner",
    });
    expect(result.credits.map((credit) => credit.role)).toEqual(["orchestra", "conductor", "soloist"]);
    expect(result.performanceDateText).toBe("1963");
    expect(result.venueText).toBe("Berlin");
    expect(result.albumTitle).toBe("Beethoven Symphonies");
    expect(result.label).toBe("DG");
    expect(result.releaseDate).toBe("1963-10-01");
    expect(result.images[0]?.src).toContain("卡拉扬1963.png");
  });
});
