import { describe, expect, it } from "vitest";

import {
  auditResourceLinks,
  getPlatformBadgeLabel,
  getResourceLinkPresentation,
  normalizeResourceLink,
} from "@/lib/resource-links";

describe("resource links", () => {
  it("normalizes platform labels for button rendering", () => {
    expect(getPlatformBadgeLabel("bilibili")).toBe("bilibili");
    expect(getPlatformBadgeLabel("youtube")).toBe("YouTube");
    expect(getPlatformBadgeLabel("apple-music")).toBe("Apple Music");
    expect(getPlatformBadgeLabel("other")).toBe("其他资源");
  });

  it("presents only clickable platform buttons while preserving titles as metadata", () => {
    const normalized = normalizeResourceLink({
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=SayJA16R0ZQ",
      title: "Appassionata, 1st Movement, performed by Solomon Cutner",
    });

    const presentation = getResourceLinkPresentation(normalized);
    expect(presentation.label).toBe("YouTube");
    expect(presentation.href).toBe("https://www.youtube.com/watch?v=SayJA16R0ZQ");
    expect(presentation.metadataTitle).toBe("Appassionata, 1st Movement, performed by Solomon Cutner");
  });

  it("flags mismatched or invalid external links for review", () => {
    const audit = auditResourceLinks([
      { platform: "youtube", url: "https://www.bilibili.com/video/BV1Qd4y1B7N9", title: "wrong" },
      { platform: "bilibili", url: "Appassionata, 1st Movement", title: "broken" },
    ]);

    expect(audit).toHaveLength(2);
    expect(audit[0]?.code).toBe("platform-mismatch");
    expect(audit[1]?.code).toBe("invalid-url");
  });
});
