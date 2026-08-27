import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateHttp, evaluateSource, evaluateWaiver, safeBaseUrl, summarize, validateConfiguration,
} from "./lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const mode = process.argv.includes("--inventory") ? "inventory" : "live";
if (mode === "live" && !process.argv.includes("--all")) {
  throw new Error("use --all for live conformance or --inventory for source-only inventory");
}

const contract = JSON.parse(await readFile(join(root, "contracts/http-v1.json"), "utf8"));
const configuration = JSON.parse(await readFile(join(root, "conformance/projects.json"), "utf8"));
const requirements = validateConfiguration(contract, configuration);
const generatedAt = new Date();
const projects = [];

for (const project of configuration.projects) {
  const baseValue = process.env[project.base_url_env];
  const checks = [];
  for (const check of project.checks) {
    let outcome;
    if (check.kind === "waiver") outcome = await evaluateWaiver(check, workspace, generatedAt);
    else if (check.kind === "source") outcome = await evaluateSource(check, workspace);
    else if (mode === "inventory") {
      outcome = { status: "not_run", message: `live check declared; set ${project.base_url_env}` };
    } else if (!baseValue) {
      outcome = { status: "not_run", message: `${project.base_url_env} is not configured` };
    } else outcome = await evaluateHttp(check, baseValue);
    checks.push({
      id: check.id,
      category: requirements.get(check.id).category,
      ...outcome,
    });
  }
  const projectSummary = summarize([{ checks }]);
  projects.push({
    id: project.id,
    ...(baseValue ? { base_url: safeBaseUrl(baseValue) } : {}),
    checks,
    summary: projectSummary,
  });
}

const report = {
  schema_version: 1,
  contract: configuration.contract,
  mode,
  generated_at: generatedAt.toISOString(),
  projects,
  summary: summarize(projects),
};
const date = generatedAt.toISOString().slice(0, 10);
const destination = join(root, `conformance/reports/${mode}-${date}.json`);
const temporary = `${destination}.tmp`;
await mkdir(dirname(destination), { recursive: true });
await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
await rename(temporary, destination);

process.stdout.write(`${JSON.stringify(report.summary)}\n${destination}\n`);
const strictMissing = mode === "live" && process.env.SARMG_CONFORMANCE_STRICT === "1" && report.summary.not_run > 0;
if (report.summary.fail > 0 || strictMissing) process.exitCode = 1;
