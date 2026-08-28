import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  evaluateHttp, evaluateModuleManifest, normalizeError, routePatternMatches, safeBaseUrl,
  summarize, validNormalizedError, validateConfiguration,
} from "../lib.mjs";

test("all supported error adapters normalize to the v1 shape", () => {
  const fixtures = [
    ["flat-code-message", { code: "unauthorized", message: "no" }],
    ["nested-error", { error: { code: "unauthorized", message: "no" } }],
    ["rfc9457-problem", { code: "authentication_required", detail: "no" }],
  ];
  for (const [adapter, payload] of fixtures) {
    assert.equal(validNormalizedError(normalizeError(adapter, payload)), true);
  }
  assert.equal(validNormalizedError({ code: "Bad-Code", message: "no" }), false);
});

test("report summary counts every standardized status", () => {
  assert.deepEqual(
    summarize([{ checks: [
      { status: "pass" }, { status: "fail" }, { status: "waived" }, { status: "not_run" },
    ] }]),
    { pass: 1, fail: 1, waived: 1, not_run: 1, total: 4 },
  );
});

test("report URLs never retain embedded credentials", () => {
  assert.equal(safeBaseUrl("https://user:secret@example.test:8443/"), "https://example.test:8443");
});

test("Core plus five private modules cover every v1 requirement without direct worker URLs", async () => {
  const contract = JSON.parse(await readFile(new URL("../../contracts/http-v1.json", import.meta.url), "utf8"));
  const configuration = JSON.parse(await readFile(new URL("../projects.json", import.meta.url), "utf8"));
  assert.equal(validateConfiguration(contract, configuration).size, 8);
  assert.deepEqual(
    configuration.projects.map((project) => project.id).sort(),
    ["dufs", "host-monitoring", "photo-backup", "sentinel-monitor", "sunshine", "union-core"],
  );
  const ingress = configuration.projects.filter((project) => project.role === "public_ingress");
  assert.equal(ingress.length, 1);
  assert.equal(ingress[0].base_url_env, "UNION_BASE_URL");
  const modules = configuration.projects.filter((project) => project.role === "private_module");
  assert.equal(modules.length, 5);
  assert(modules.every((project) => project.base_url_env === undefined));
  assert(modules.every((project) => project.checks.every((check) => check.kind !== "http")));
  const expectedManifest = new Map([
    ["sunshine", "sunshine-worker/manifest.json"],
    ["host-monitoring", "host-monitoring/host-monitoring-worker/manifest.json"],
    ["sentinel-monitor", "sentinel-monitor/manifest.json"],
    ["photo-backup", "photo-backup/manifest.json"],
    ["dufs", "dufs-ram/manifest.json"],
  ]);
  for (const module of modules) {
    const manifestChecks = module.checks.filter((check) => check.kind === "module_manifest");
    assert(manifestChecks.length > 0);
    assert(manifestChecks.every((check) => check.file === expectedManifest.get(module.id)));
  }
  assert(configuration.projects.flatMap((project) => project.checks)
    .filter((check) => check.kind === "http")
    .every((check) => !check.path.startsWith("/modules/")));
});

test("Axum-style wildcard matching detects a Gateway route covering a private health path", () => {
  assert.equal(routePatternMatches("/{*path}", "/__dufs__/health"), true);
  assert.equal(routePatternMatches("/hosts/{id}", "/hosts/one"), true);
  assert.equal(routePatternMatches("/hosts/{id}", "/health/live"), false);
  assert.equal(routePatternMatches("/v1/{*path}", "/health/live"), false);
});

test("private health validation passes a separated route and exposes the documented Dufs gap", async () => {
  const workspace = fileURLToPath(new URL("../../../", import.meta.url));
  const photo = await evaluateModuleManifest({
    file: "photo-backup/manifest.json",
    module_id: "photo-backup",
    assertion: "private_liveness",
  }, workspace);
  assert.equal(photo.status, "pass");
  const dufs = await evaluateModuleManifest({
    file: "dufs-ram/manifest.json",
    module_id: "dufs",
    assertion: "private_liveness",
  }, workspace);
  assert.equal(dufs.status, "fail");
  assert.match(dufs.message, /Gateway route\(s\): browse/u);
});

test("HTTP checks validate status, headers, and normalized payload", async () => {
  const fetchImpl = async () => new Response(
    JSON.stringify({ error: { code: "unauthorized", message: "sign in" } }),
    { status: 401, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } },
  );
  const result = await evaluateHttp({
    path: "/api/me",
    statuses: [401],
    content_type: "application/json",
    headers: { "x-content-type-options": "nosniff" },
    error_adapter: "nested-error",
  }, "https://example.test", fetchImpl);
  assert.equal(result.status, "pass");
});
