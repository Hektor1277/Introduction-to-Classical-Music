import { buildIndexes } from "../../data-core/src/indexes.js";
import type { LibraryData } from "../../shared/src/schema.js";

export type EditableEntityType = "composer" | "person" | "work" | "recording";

export function getAffectedPaths(library: LibraryData, entityType: EditableEntityType, entityId: string) {
  const indexes = buildIndexes(library);
  const paths = new Set<string>(["/", "/search/", "/about/"]);

  if (entityType === "composer") {
    const composer = library.composers.find((item) => item.id === entityId);
    if (composer) {
      paths.add(`/composers/${composer.slug}/`);
      paths.add("/composers/");
    }
    return [...paths];
  }

  if (entityType === "person") {
    const person = library.people.find((item) => item.id === entityId);
    if (person) {
      const href = indexes.personIndex[person.id]?.href;
      if (href) {
        paths.add(href);
      }
      if (person.roles.includes("conductor")) {
        paths.add("/conductors/");
      }
      if (person.roles.includes("orchestra")) {
        paths.add(`/orchestras/${person.slug}/`);
      }
    }
    return [...paths];
  }

  if (entityType === "work") {
    const work = library.works.find((item) => item.id === entityId);
    if (work) {
      paths.add(`/works/${work.id}/`);
      const composer = library.composers.find((item) => item.id === work.composerId);
      if (composer) {
        paths.add(`/composers/${composer.slug}/`);
      }
    }
    return [...paths];
  }

  const recording = library.recordings.find((item) => item.id === entityId);
  if (!recording) {
    return [...paths];
  }

  paths.add(`/recordings/${recording.id}/`);

  const work = library.works.find((item) => item.id === recording.workId);
  if (work) {
    paths.add(`/works/${work.id}/`);
    const composer = library.composers.find((item) => item.id === work.composerId);
    if (composer) {
      paths.add(`/composers/${composer.slug}/`);
    }
  }

  for (const credit of recording.credits) {
    if (!credit.personId) {
      continue;
    }

    const href = indexes.personIndex[credit.personId]?.href;
    if (href) {
      paths.add(href);
    }
  }

  return [...paths];
}


