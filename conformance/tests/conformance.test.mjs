import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateHttp, normalizeError, safeBaseUrl, summarize, validNormalizedError,
  validateConfiguration,
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

test("the four consumers cover every v1 requirement through the Union-only live entry", async () => {
  const contract = JSON.parse(await readFile(new URL("../../contracts/http-v1.json", import.meta.url), "utf8"));
  const configuration = JSON.parse(await readFile(new URL("../projects.json", import.meta.url), "utf8"));
  assert.equal(validateConfiguration(contract, configuration).size, 8);
  assert(configuration.projects.every((project) => project.base_url_env === "UNION_BASE_URL"));
  for (const project of configuration.projects.filter((item) => item.id !== "union-rust")) {
    const prefix = `/modules/${project.id === "dufs-ram" ? "dufs" : project.id}`;
    for (const check of project.checks.filter((item) => item.kind === "http")) {
      assert(check.path.startsWith(`${prefix}/`), `${project.id}/${check.id} bypasses Union prefix`);
    }
  }
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
