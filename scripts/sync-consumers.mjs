import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const dist = join(root, "dist/design");
const checkOnly = process.argv.includes("--check");

const mappings = [
  {
    project: "union-rust",
    destination: "union-rust/web/vendor/sarmg-design",
    files: ["reset.css", "tokens.css", "content-card.css", "login.css", "accessibility.css", "manifest.json"],
  },
  {
    project: "dufs-ram",
    destination: "dufs-ram/assets",
    files: [
      ["bundle.css", "sarmg-design.css"],
      ["manifest.json", "sarmg-design.manifest.json"],
    ],
  },
];

const contractMappings = [
  "dufs-ram/vendor/sarmg-contracts/blob-transfer-v1.json",
  "photo-backup/vendor/sarmg-contracts/blob-transfer-v1.json",
];

async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, { mode: 0o644 });
  await rename(temporary, path);
}

for (const mapping of mappings) {
  for (const entry of mapping.files) {
    const [sourceName, destinationName] = Array.isArray(entry) ? entry : [entry, entry];
    const source = await readFile(join(dist, sourceName), "utf8");
    const destination = join(workspace, mapping.destination, destinationName);
    if (checkOnly) {
      let current;
      try { current = await readFile(destination, "utf8"); }
      catch { throw new Error(`${mapping.project} is missing vendored ${destinationName}`); }
      if (current !== source) throw new Error(`${mapping.project} has stale vendored ${destinationName}`);
    } else {
      await writeAtomic(destination, source);
    }
  }
}

const blobContract = await readFile(join(root, "contracts/blob-transfer-v1.json"), "utf8");
for (const relativeDestination of contractMappings) {
  const destination = join(workspace, relativeDestination);
  if (checkOnly) {
    let current;
    try { current = await readFile(destination, "utf8"); }
    catch { throw new Error(`missing vendored ${relativeDestination}`); }
    if (current !== blobContract) throw new Error(`stale vendored ${relativeDestination}`);
  } else {
    await writeAtomic(destination, blobContract);
  }
}

process.stdout.write(
  `${checkOnly ? "verified" : "synchronized"} ${mappings.length} design consumers and ${contractMappings.length} contract consumers\n`,
);
