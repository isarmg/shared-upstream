import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(await readFile(join(root, "baseline/projects.json"), "utf8"));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

if (args.includes("--list")) {
  for (const [name, project] of Object.entries(inventory.projects)) {
    process.stdout.write(`${name}\t${project.version}\t${project.http}\t${project.database}\n`);
  }
  process.exit(0);
}

const mode = option("--mode", "quick");
if (!new Set(["quick", "full"]).has(mode)) throw new Error("--mode must be quick or full");
const requested = option("--project", null);
const names = args.includes("--all") ? Object.keys(inventory.projects) : [requested];
if (!names[0]) throw new Error("use --project <name> or --all");
for (const name of names) {
  if (!inventory.projects[name]) throw new Error(`unknown project: ${name}`);
}

const report = {
  schema_version: 1,
  kind: "project-baseline",
  mode,
  started_at: new Date().toISOString(),
  workspace_root: inventory.workspace_root,
  projects: [],
};

function run(command, cwd) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 200_000) output = output.slice(-200_000);
      process.stdout.write(chunk);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => resolveRun({ exit_code: null, error: error.message, duration_ms: Date.now() - started, output_tail: output.slice(-8000) }));
    child.on("close", (code) => resolveRun({ exit_code: code, duration_ms: Date.now() - started, output_tail: output.slice(-8000) }));
  });
}

let failed = false;
for (const name of names) {
  const project = inventory.projects[name];
  const result = { name, version: project.version, revision: project.revision, commands: [] };
  report.projects.push(result);
  for (const step of project[mode]) {
    const cwd = join(inventory.workspace_root, step.cwd);
    process.stdout.write(`\n[${name}] ${step.command.join(" ")}\n`);
    const execution = await run(step.command, cwd);
    result.commands.push({ cwd: step.cwd, command: step.command, ...execution });
    if (execution.exit_code !== 0) {
      failed = true;
      break;
    }
  }
  result.status = result.commands.every((command) => command.exit_code === 0) ? "pass" : "fail";
}

report.finished_at = new Date().toISOString();
report.status = failed ? "fail" : "pass";
const defaultReport = join(root, "baseline/reports", `${mode}-${new Date().toISOString().replaceAll(":", "-")}.json`);
const reportPath = resolve(option("--report", defaultReport));
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`\nbaseline report: ${reportPath}\n`);
process.exitCode = failed ? 1 : 0;

