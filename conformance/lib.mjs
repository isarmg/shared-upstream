import { access, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export const statuses = new Set(["pass", "fail", "waived", "not_run"]);
const projectRoles = new Set(["public_ingress", "private_module"]);
const routeAuthModes = new Set(["platform", "module"]);

export function normalizeError(adapter, payload) {
  if (!payload || typeof payload !== "object") return null;
  if (adapter === "flat-code-message") {
    return { code: payload.code, message: payload.message };
  }
  if (adapter === "nested-error") {
    return { code: payload.error?.code, message: payload.error?.message };
  }
  if (adapter === "rfc9457-problem") {
    return { code: payload.code, message: payload.detail ?? payload.title };
  }
  return null;
}

export function validNormalizedError(error) {
  return Boolean(
    error
    && typeof error.code === "string"
    && /^[a-z][a-z0-9_]{0,63}$/u.test(error.code)
    && typeof error.message === "string"
    && error.message.length > 0,
  );
}

export function summarize(projects) {
  const summary = { pass: 0, fail: 0, waived: 0, not_run: 0, total: 0 };
  for (const project of projects) {
    for (const check of project.checks) {
      if (!statuses.has(check.status)) throw new Error(`unknown result status ${check.status}`);
      summary[check.status] += 1;
      summary.total += 1;
    }
  }
  return summary;
}

export function safeBaseUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  return url.toString().replace(/\/$/u, "");
}

export function validateConfiguration(contract, configuration) {
  if (configuration.schema_version !== 1) throw new Error("unsupported project configuration");
  if (configuration.contract !== `${contract.contract}@${contract.version}`) {
    throw new Error(
      `configuration contract ${configuration.contract} does not match ${contract.contract}@${contract.version}`,
    );
  }
  const requirements = new Map(contract.requirements.map((item) => [item.id, item]));
  if (requirements.size !== contract.requirements.length) throw new Error("duplicate contract requirement");
  const projectIds = new Set();
  let publicIngresses = 0;
  let privateModules = 0;
  for (const project of configuration.projects) {
    if (projectIds.has(project.id)) throw new Error(`duplicate project ${project.id}`);
    projectIds.add(project.id);
    if (!projectRoles.has(project.role)) throw new Error(`${project.id}: unknown role ${project.role}`);
    if (project.role === "public_ingress") {
      publicIngresses += 1;
      if (project.base_url_env !== "UNION_BASE_URL") {
        throw new Error(`${project.id}: public ingress must use UNION_BASE_URL`);
      }
    } else {
      privateModules += 1;
      if (project.base_url_env !== undefined) {
        throw new Error(`${project.id}: private module must not declare a direct live base URL`);
      }
    }
    const checkIds = new Set();
    for (const check of project.checks) {
      if (!requirements.has(check.id)) throw new Error(`${project.id}: unknown check ${check.id}`);
      if (checkIds.has(check.id)) throw new Error(`${project.id}: duplicate check ${check.id}`);
      checkIds.add(check.id);
      if (!new Set(["http", "source", "waiver", "module_manifest"]).has(check.kind)) {
        throw new Error(`${project.id}/${check.id}: unknown kind ${check.kind}`);
      }
      if (project.role === "private_module" && check.kind === "http") {
        throw new Error(`${project.id}/${check.id}: private modules cannot declare direct live HTTP checks`);
      }
      const completeManifestCheck = ["file", "module_id", "assertion"]
        .every((field) => typeof check[field] === "string" && check[field]);
      if (check.kind === "module_manifest" && !completeManifestCheck) {
        throw new Error(`${project.id}/${check.id}: module_manifest check is incomplete`);
      }
    }
    for (const id of requirements.keys()) {
      if (!checkIds.has(id)) throw new Error(`${project.id}: missing check ${id}`);
    }
  }
  if (publicIngresses !== 1) throw new Error(`expected one public ingress, found ${publicIngresses}`);
  if (privateModules !== 5) throw new Error(`expected five private modules, found ${privateModules}`);
  return requirements;
}

export async function evaluateWaiver(check, workspace, now = new Date()) {
  const waiver = check.waiver ?? {};
  for (const field of ["adr", "owner", "review_by", "risk"]) {
    if (typeof waiver[field] !== "string" || !waiver[field]) {
      return { status: "fail", message: `waiver is missing ${field}` };
    }
  }
  const review = new Date(`${waiver.review_by}T23:59:59Z`);
  if (!Number.isFinite(review.valueOf()) || review < now) {
    return { status: "fail", message: `waiver expired on ${waiver.review_by}`, adr: waiver.adr };
  }
  try {
    await access(resolve(workspace, "upstream", waiver.adr));
  } catch {
    return { status: "fail", message: `waiver ADR does not exist: ${waiver.adr}`, adr: waiver.adr };
  }
  return {
    status: "waived",
    message: `${waiver.risk} risk; review by ${waiver.review_by}; owner ${waiver.owner}`,
    adr: waiver.adr,
  };
}

export async function evaluateSource(check, workspace) {
  const root = resolve(workspace);
  const missing = [];
  for (const item of check.evidence ?? []) {
    const path = resolve(root, item.file);
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      return { status: "fail", message: `evidence escapes workspace: ${item.file}` };
    }
    let source;
    try {
      source = await readFile(path, "utf8");
    } catch {
      missing.push(`${item.file} (missing file)`);
      continue;
    }
    for (const needle of item.contains ?? []) {
      if (!source.includes(needle)) missing.push(`${item.file} (missing ${JSON.stringify(needle)})`);
    }
  }
  if (missing.length) return { status: "fail", message: missing.join("; ") };
  return { status: "pass", message: `${check.evidence?.length ?? 0} source evidence set(s) verified` };
}

function safeWorkspacePath(workspace, relativePath) {
  const root = resolve(workspace);
  const path = resolve(root, relativePath);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`path escapes workspace: ${relativePath}`);
  }
  return path;
}

export function routePatternMatches(pattern, path) {
  const patternSegments = pattern.split("/");
  const pathSegments = path.split("/");
  let patternIndex = 0;
  let pathIndex = 0;
  while (patternIndex < patternSegments.length) {
    const segment = patternSegments[patternIndex];
    if (/^\{\*[^{}]+\}$/u.test(segment)) return patternIndex === patternSegments.length - 1;
    if (pathIndex >= pathSegments.length) return false;
    if (!/^\{[^{}]+\}$/u.test(segment) && segment !== pathSegments[pathIndex]) return false;
    patternIndex += 1;
    pathIndex += 1;
  }
  return pathIndex === pathSegments.length;
}

function validateModuleCommon(manifest, check) {
  const failures = [];
  if (manifest.id !== check.module_id) failures.push(`manifest id is ${JSON.stringify(manifest.id)}`);
  if (manifest.execution?.mode !== "process") failures.push("execution mode is not process");
  if (!["127.0.0.1", "::1"].includes(manifest.execution?.bind?.host)) {
    failures.push("process bind host is not loopback");
  }
  if (manifest.backend?.base_path !== `/api/modules/${check.module_id}`) {
    failures.push(`backend base path is not /api/modules/${check.module_id}`);
  }
  return failures;
}

function validatePrivateHealth(manifest, check) {
  const failures = validateModuleCommon(manifest, check);
  const field = check.assertion === "private_liveness" ? "liveness_path" : "readiness_path";
  if (manifest.health?.kind !== "http") failures.push("health kind is not http");
  const probePath = manifest.health?.[field];
  const invalidProbePath = typeof probePath !== "string"
    || !probePath.startsWith("/")
    || probePath.includes("?")
    || probePath.includes("#")
    || probePath.split("/").some((segment) => segment === "." || segment === "..");
  if (invalidProbePath) {
    failures.push(`${field} is not a normalized absolute HTTP path`);
  }
  const service = (manifest.services ?? []).find((item) => item.name === manifest.health?.service);
  if (!service || service.visibility !== "platform") {
    failures.push("health service is not a platform-visible supervised service");
  }
  if (typeof probePath === "string") {
    const exposingRoutes = (manifest.backend?.routes ?? []).filter((route) =>
      (route.methods ?? []).some((method) => method === "GET" || method === "HEAD")
      && typeof route.upstream_path === "string"
      && routePatternMatches(route.upstream_path, probePath));
    if (exposingRoutes.length) {
      const routeIds = exposingRoutes.map((route) => route.id).join(", ");
      failures.push(`private ${field} is covered by Gateway route(s): ${routeIds}`);
    }
  }
  return failures;
}

function validateCentralAuthentication(manifest, check) {
  const failures = validateModuleCommon(manifest, check);
  const routes = manifest.backend?.routes ?? [];
  const actualModuleAuth = routes
    .filter((route) => route.auth === "module")
    .map((route) => route.id)
    .sort();
  const expectedModuleAuth = [...(check.module_auth_routes ?? [])].sort();
  if (JSON.stringify(actualModuleAuth) !== JSON.stringify(expectedModuleAuth)) {
    failures.push(
      `module-auth routes ${JSON.stringify(actualModuleAuth)} do not match ${JSON.stringify(expectedModuleAuth)}`,
    );
  }
  for (const route of routes) {
    if (route.auth === "platform" && (typeof route.permission !== "string" || !route.permission)) {
      failures.push(`platform route ${route.id} has no permission`);
    } else if (route.auth === "module" && route.permission !== null) {
      failures.push(`module-auth route ${route.id} must not claim a platform permission`);
    } else if (!routeAuthModes.has(route.auth)) {
      failures.push(`route ${route.id} has unsupported auth ${JSON.stringify(route.auth)}`);
    }
  }
  return failures;
}

export async function evaluateModuleManifest(check, workspace) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(safeWorkspacePath(workspace, check.file), "utf8"));
  } catch (error) {
    return { status: "fail", message: `cannot read module manifest ${check.file}: ${error.message}` };
  }
  let failures;
  if (["private_liveness", "private_readiness"].includes(check.assertion)) {
    failures = validatePrivateHealth(manifest, check);
  } else if (check.assertion === "central_authentication") {
    failures = validateCentralAuthentication(manifest, check);
  } else {
    failures = [`unknown module manifest assertion ${JSON.stringify(check.assertion)}`];
  }
  if (!failures.length && check.evidence) {
    const source = await evaluateSource(check, workspace);
    if (source.status !== "pass") failures.push(source.message);
  }
  return failures.length
    ? { status: "fail", message: failures.join("; ") }
    : { status: "pass", message: `${check.assertion} verified for ${check.module_id}` };
}

function valueAt(payload, path) {
  return path.split(".").reduce((current, key) => current?.[key], payload);
}

export async function evaluateHttp(check, baseUrl, fetchImpl = fetch) {
  const started = performance.now();
  try {
    const url = new URL(check.path, `${baseUrl.replace(/\/$/u, "")}/`);
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(check.timeout_ms ?? 5000),
      headers: { accept: "application/json, text/plain;q=0.8, */*;q=0.1" },
    });
    const body = await response.text();
    const problems = [];
    if (!check.statuses.includes(response.status)) problems.push(`status ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (check.content_type && !contentType.toLowerCase().includes(check.content_type.toLowerCase())) {
      problems.push(`content-type ${JSON.stringify(contentType)}`);
    }
    for (const [name, expected] of Object.entries(check.headers ?? {})) {
      const actual = response.headers.get(name) ?? "";
      if (typeof expected === "string" && actual.toLowerCase() !== expected.toLowerCase()) {
        problems.push(`${name}=${JSON.stringify(actual)}`);
      } else if (typeof expected === "object" && !actual.toLowerCase().includes(expected.contains.toLowerCase())) {
        problems.push(`${name} does not contain ${JSON.stringify(expected.contains)}`);
      }
    }
    if (typeof check.body === "string" && body.trim() !== check.body) {
      problems.push(`body did not equal ${JSON.stringify(check.body)}`);
    }
    let payload;
    if (check.json || check.json_has || check.error_adapter) {
      try { payload = JSON.parse(body); }
      catch { problems.push("body is not valid JSON"); }
    }
    for (const [path, allowed] of Object.entries(check.json ?? {})) {
      if (!allowed.includes(valueAt(payload, path))) problems.push(`${path} is outside the allowed values`);
    }
    for (const path of check.json_has ?? []) {
      if (valueAt(payload, path) === undefined) problems.push(`${path} is missing`);
    }
    if (check.error_adapter && !validNormalizedError(normalizeError(check.error_adapter, payload))) {
      problems.push(`invalid ${check.error_adapter} error envelope`);
    }
    return {
      status: problems.length ? "fail" : "pass",
      message: problems.length ? problems.join("; ") : `${response.status} ${check.path}`,
      duration_ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Math.round(performance.now() - started),
    };
  }
}
