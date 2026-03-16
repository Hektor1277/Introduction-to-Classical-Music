import { load } from "cheerio";

import { detectPlatformFromUrl, normalizeResourceLink } from "./resource-links.js";
import type { Credit, RecordingImage, ResourceLink } from "../../shared/src/schema.js";

type ParsedLegacyRecording = {
  links: ResourceLink[];
  credits: Credit[];
  images: RecordingImage[];
  performanceDateText: string;
  venueText: string;
  albumTitle: string;
  label: string;
  releaseDate: string;
};

type ParsedLegacyPath = {
  composerName: string;
  groupPath: string[];
  workName: string;
  recordingFileName: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function roleFromLabel(label: string): Credit["role"] {
  if (label.includes("指挥") || label.includes("鎸囨尌")) {
    return "conductor";
  }
  if (label.includes("乐团") || label.includes("乐队") || label.includes("涔愬洟") || label.includes("涔愰槦")) {
    return "orchestra";
  }
  if (label.includes("合唱") || label.includes("鍚堝敱")) {
    return "chorus";
  }
  if (
    label.includes("女高音") ||
    label.includes("女中音") ||
    label.includes("次女高音") ||
    label.includes("男高音") ||
    label.includes("男中音") ||
    label.includes("男低音") ||
    label.includes("歌手") ||
    label.includes("姝屾墜")
  ) {
    return "singer";
  }
  if (label.includes("组合") || label.includes("四重奏") || label.includes("三重奏") || label.includes("缁勫悎")) {
    return "ensemble";
  }
  return "soloist";
}

function splitDateAndVenue(raw: string) {
  const text = normalizeWhitespace(raw);
  const separators = ["，", ","];

  for (const separator of separators) {
    const separatorIndex = text.lastIndexOf(separator);
    if (separatorIndex <= 0) {
      continue;
    }

    const left = text.slice(0, separatorIndex).trim();
    const right = text.slice(separatorIndex + 1).trim();
    if (right && !/^\d{4}/.test(right)) {
      return {
        performanceDateText: left,
        venueText: right,
      };
    }
  }

  return {
    performanceDateText: text,
    venueText: "",
  };
}

export function parseLegacyWorkPath(value: string): ParsedLegacyPath {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length < 5) {
    throw new Error(`Unsupported legacy path: ${value}`);
  }

  const recordingSegment = segments.at(-1) ?? "";
  const workName = segments.at(-2) ?? "";
  const groupPath = segments.slice(2, -2);

  return {
    composerName: segments[1] ?? "",
    groupPath,
    workName,
    recordingFileName: recordingSegment.replace(/\.htm$/i, ""),
  };
}

export function parseLegacyRecordingHtml(html: string): ParsedLegacyRecording {
  const $ = load(html);
  const links: ResourceLink[] = [];
  const credits: Credit[] = [];
  const images: RecordingImage[] = [];

  $("a").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href || !/^https?:\/\//.test(href)) {
      return;
    }

    links.push(
      normalizeResourceLink({
        platform: detectPlatformFromUrl(href),
        url: href,
        title: normalizeWhitespace($(element).text()),
      }),
    );
  });

  $("img").each((_, element) => {
    const src = $(element).attr("src")?.trim();
    if (!src) {
      return;
    }

    images.push({
      src,
      alt: normalizeWhitespace($(element).attr("alt") ?? ""),
      kind: "other",
    });
  });

  let performanceDateText = "";
  let venueText = "";
  let albumTitle = "";
  let label = "";
  let releaseDate = "";

  $("p").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (!text) {
      return;
    }

    const match = text.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (!match) {
      return;
    }

    const [, rawLabel, rawValue] = match;
    const labelText = normalizeWhitespace(rawLabel);
    const valueText = normalizeWhitespace(rawValue);

    if (!valueText) {
      return;
    }

    if (labelText.includes("时间")) {
      const split = splitDateAndVenue(valueText);
      performanceDateText = split.performanceDateText;
      venueText = split.venueText;
      return;
    }

    if (labelText.includes("专辑")) {
      albumTitle = valueText;
      return;
    }

    if (labelText.includes("发行商") || labelText.includes("厂牌")) {
      label = valueText;
      return;
    }

    if (labelText.includes("发行日期")) {
      releaseDate = valueText;
      return;
    }

    if (
      labelText.includes("乐团") ||
      labelText.includes("指挥") ||
      labelText.includes("独奏") ||
      labelText.includes("钢琴") ||
      labelText.includes("小提琴") ||
      labelText.includes("中提琴") ||
      labelText.includes("大提琴") ||
      labelText.includes("歌") ||
      labelText.includes("组合") ||
      labelText.includes("合唱") ||
      labelText.includes("涔愬洟") ||
      labelText.includes("鎸囨尌") ||
      labelText.includes("鐙") ||
      labelText.includes("閽㈢惔") ||
      labelText.includes("灏忔彁鐞") ||
      labelText.includes("涓彁鐞") ||
      labelText.includes("澶ф彁鐞") ||
      labelText.includes("姝") ||
      labelText.includes("缁勫悎") ||
      labelText.includes("鍚堝敱")
    ) {
      const localLink = $(element).find("a").first();
      credits.push({
        role: roleFromLabel(labelText),
        personId: "",
        displayName: normalizeWhitespace(localLink.text() || valueText),
        label: labelText,
      });
    }
  });

  return {
    links,
    credits,
    images,
    performanceDateText,
    venueText,
    albumTitle,
    label,
    releaseDate,
  };
}

