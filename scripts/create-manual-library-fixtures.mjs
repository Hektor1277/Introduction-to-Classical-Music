import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";

const root = path.resolve("docs/manual-fixtures");
const base = {
  composers: [{ id: "composer-demo", slug: "composer-demo", name: "复测作曲家", nameLatin: "Demo Composer", country: "", countries: [], aliases: [], sortKey: "demo", summary: "", roles: ["composer"], infoPanel: { text: "", articleId: "", collectionLinks: [] } }],
  people: [{ id: "person-demo-conductor", slug: "person-demo-conductor", name: "复测指挥", nameLatin: "Demo Conductor", country: "", countries: [], aliases: [], sortKey: "demo-conductor", summary: "", roles: ["conductor"], infoPanel: { text: "", articleId: "", collectionLinks: [] } }],
  workGroups: [{ id: "group-demo", composerId: "composer-demo", title: "复合作品组", slug: "group-demo", path: ["复合作品组"], sortKey: "demo" }],
  works: [{ id: "work-shared", composerId: "composer-demo", groupIds: ["group-demo"], slug: "work-shared", title: "共享作品", titleLatin: "Shared Work", aliases: [], catalogue: "", summary: "", infoPanel: { text: "", articleId: "", collectionLinks: [] }, sortKey: "shared", updatedAt: "2026-09-12" }],
  recordings: [{ id: "recording-shared", workId: "work-shared", slug: "recording-shared", title: "共享版本", workTypeHint: "unknown", sortKey: "shared", isPrimaryRecommendation: false, updatedAt: "2026-09-12", images: [], credits: [{ role: "conductor", personId: "person-demo-conductor", displayName: "复测指挥", label: "" }], links: [], notes: "", performanceDateText: "", venueText: "", albumTitle: "", label: "", releaseDate: "", infoPanel: { text: "", articleId: "", collectionLinks: [] } }],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const variants = {
  "library-a": base,
  "library-b": { ...clone(base), works: [...clone(base).works, { ...clone(base).works[0], id: "work-b-only", slug: "work-b-only", title: "B 独有作品", sortKey: "b-only" }], recordings: [{ ...clone(base).recordings[0], title: "共享版本（B 修订）" }] },
};
for (const [name, library] of Object.entries(variants)) {
  await rm(path.join(root, `${name}.icmlibrary`), { recursive: true, force: true });
  const dir = path.join(root, `${name}-directory.icmlibrary`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "content", "library"), { recursive: true });
  await mkdir(path.join(dir, "content", "site"), { recursive: true });
  await mkdir(path.join(dir, "assets"), { recursive: true });
  await writeFile(path.join(dir, "library.manifest.json"), `${JSON.stringify({ schemaVersion: "library-bundle-v1", libraryId: name, libraryName: name, createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z", appMinVersion: "0.1.0" }, null, 2)}\n`);
  for (const [key, value] of Object.entries(library)) {
    const file = { composers: "composers", people: "people", workGroups: "work-groups", works: "works", recordings: "recordings" }[key];
    await writeFile(path.join(dir, "content", "library", `${file}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  await writeFile(path.join(dir, "content", "site", "config.json"), "{}\n");
  await writeFile(path.join(dir, "content", "site", "articles.json"), "[]\n");
  const archive = new AdmZip();
  archive.addLocalFile(path.join(dir, "library.manifest.json"));
  archive.addLocalFolder(path.join(dir, "content"), "content");
  archive.addLocalFolder(path.join(dir, "assets"), "assets");
  await archive.writeZipPromise(path.join(root, `${name}.icmlibrary`), { overwrite: true });
}
