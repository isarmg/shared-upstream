import { access, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", "playwright-report"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

const failures = [];
for (const file of await markdownFiles(root)) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = resolve(dirname(file), decodeURIComponent(target));
    try { await access(resolved); }
    catch { failures.push(`${relative(root, file)} -> ${target}`); }
  }
}
if (failures.length) throw new Error(`broken local Markdown links:\n${failures.join("\n")}`);
process.stdout.write("documentation links verified\n");

