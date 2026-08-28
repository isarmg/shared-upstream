import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const upstream = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = resolve(upstream, "..");
const contractSource = await readFile(resolve(upstream, "contracts/blob-transfer-v1.json"), "utf8");
const contract = JSON.parse(contractSource);
const configuration = JSON.parse(await readFile(resolve(upstream, "conformance/blob-transfer-projects.json"), "utf8"));

export function validateBlobTransferConfiguration(contractValue, configurationValue) {
  if (contractValue.status !== "draft") throw new Error("blob-transfer contract must remain an explicit draft");
  if (configurationValue.schema_version !== 1) throw new Error("unsupported blob-transfer configuration");
  if (configurationValue.contract !== `${contractValue.contract}@${contractValue.version}`) {
    throw new Error("blob-transfer contract identity mismatch");
  }
  if (configurationValue.contract_status !== contractValue.status) {
    throw new Error("blob-transfer contract status mismatch");
  }
  if (configurationValue.runtime_conformance_claimed !== false) {
    throw new Error("draft blob-transfer configuration cannot claim runtime conformance");
  }
  if (!Array.isArray(configurationValue.projects) || configurationValue.projects.length !== 2) {
    throw new Error("blob-transfer draft requires exactly Dufs and Photo Backup proposals");
  }
  const canonical = new Set(contractValue.canonical_states);
  const stableErrors = new Set(contractValue.stable_errors);
  const ids = new Set();
  for (const project of configurationValue.projects) {
    if (ids.has(project.id)) throw new Error(`duplicate blob-transfer project ${project.id}`);
    ids.add(project.id);
    if (project.mapping_status !== "proposed") {
      throw new Error(`${project.id} mapping must be marked proposed`);
    }
    if (!Array.isArray(project.known_gaps) || project.known_gaps.length === 0) {
      throw new Error(`${project.id} proposal must disclose known gaps`);
    }
    const mappedStates = new Set(Object.values(project.proposed_state_map ?? {}));
    for (const state of canonical) {
      if (!mappedStates.has(state)) throw new Error(`${project.id} does not map canonical state ${state}`);
    }
    for (const state of mappedStates) {
      if (!canonical.has(state)) throw new Error(`${project.id} maps unknown canonical state ${state}`);
    }
    const mappedErrors = new Set(Object.values(project.proposed_error_map ?? {}));
    for (const code of stableErrors) {
      if (!mappedErrors.has(code)) throw new Error(`${project.id} does not map stable error ${code}`);
    }
    for (const code of mappedErrors) {
      if (!stableErrors.has(code)) throw new Error(`${project.id} maps unknown stable error ${code}`);
    }
  }
  if (!ids.has("dufs-ram") || !ids.has("photo-backup")) throw new Error("unexpected blob-transfer projects");
  return configurationValue.projects;
}

export async function verifyBlobTransferInputs(projects, root = workspace) {
  const failures = [];
  for (const project of projects) {
    const vendored = resolve(root, project.vendored_contract);
    if (vendored !== root && !vendored.startsWith(`${root}${sep}`)) {
      failures.push(`${project.id}: vendored contract escapes workspace`);
    } else {
      try {
        if (await readFile(vendored, "utf8") !== contractSource) failures.push(`${project.id}: stale vendored contract`);
      } catch {
        failures.push(`${project.id}: missing vendored contract`);
      }
    }
    for (const evidence of project.related_evidence ?? []) {
      const path = resolve(root, evidence.file);
      if (path !== root && !path.startsWith(`${root}${sep}`)) {
        failures.push(`${project.id}: evidence escapes workspace`);
        continue;
      }
      let source;
      try { source = await readFile(path, "utf8"); }
      catch { failures.push(`${project.id}: missing ${evidence.file}`); continue; }
      for (const needle of evidence.contains ?? []) {
        if (!source.includes(needle)) failures.push(`${project.id}: ${evidence.file} lacks ${JSON.stringify(needle)}`);
      }
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projects = validateBlobTransferConfiguration(contract, configuration);
  const failures = await verifyBlobTransferInputs(projects);
  if (failures.length) {
    for (const failure of failures) process.stderr.write(`${failure}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `validated ${projects.length} proposed blob-transfer mappings against ${contract.contract}@${contract.version}; runtime conformance is not claimed\n`,
    );
  }
}
