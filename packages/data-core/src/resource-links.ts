import type { ResourceLink } from "../../shared/src/schema.js";

export type ResourceLinkAuditIssue = {
  code: "invalid-url" | "platform-mismatch" | "title-looks-like-url";
  message: string;
  link: ResourceLink;
};

const platformLabels: Record<ResourceLink["platform"], string> = {
  bilibili: "bilibili",
  youtube: "YouTube",
  netease: "网易云音乐",
  "apple-music": "Apple Music",
  "amazon-music": "Amazon Music",
  other: "其他资源",
};

export function detectPlatformFromUrl(url: string): ResourceLink["platform"] {
  if (/bilibili\.com/i.test(url)) {
    return "bilibili";
  }
  if (/youtube\.com|youtu\.be/i.test(url)) {
    return "youtube";
  }
  if (/music\.163\.com/i.test(url)) {
    return "netease";
  }
  if (/music\.apple\.com/i.test(url)) {
    return "apple-music";
  }
  if (/amazon\.[^/]+\/music/i.test(url)) {
    return "amazon-music";
  }
  return "other";
}

export function getPlatformBadgeLabel(platform: ResourceLink["platform"]) {
  return platformLabels[platform] ?? platformLabels.other;
}

export function normalizeResourceLink(link: ResourceLink): ResourceLink {
  const normalizedUrl = link.url.trim();
  const detectedPlatform = /^https?:\/\//i.test(normalizedUrl) ? detectPlatformFromUrl(normalizedUrl) : link.platform;
  return {
    platform: link.platform || detectedPlatform,
    url: normalizedUrl,
    title: (link.title ?? "").trim(),
  };
}

export function auditResourceLinks(links: ResourceLink[]): ResourceLinkAuditIssue[] {
  const issues: ResourceLinkAuditIssue[] = [];

  for (const link of links.map(normalizeResourceLink)) {
    if (!/^https?:\/\//i.test(link.url)) {
      issues.push({
        code: "invalid-url",
        message: `Link is not a valid http/https URL: ${link.url}`,
        link,
      });
      continue;
    }

    const detectedPlatform = detectPlatformFromUrl(link.url);
    if (link.platform !== "other" && detectedPlatform !== "other" && detectedPlatform !== link.platform) {
      issues.push({
        code: "platform-mismatch",
        message: `Platform ${link.platform} does not match URL ${link.url}`,
        link,
      });
    }

    if (/^https?:\/\//i.test(link.title ?? "")) {
      issues.push({
        code: "title-looks-like-url",
        message: `Title appears to contain a URL: ${link.title}`,
        link,
      });
    }
  }

  return issues;
}

export function getResourceLinkPresentation(link: ResourceLink) {
  const normalized = normalizeResourceLink(link);
  return {
    href: normalized.url,
    label: getPlatformBadgeLabel(normalized.platform),
    metadataTitle: normalized.title || "",
    platform: normalized.platform,
  };
}

