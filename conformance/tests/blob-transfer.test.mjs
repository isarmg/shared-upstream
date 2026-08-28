import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateBlobTransferConfiguration,
  verifyBlobTransferInputs,
} from "../blob-transfer.mjs";

const contract = JSON.parse(await readFile(new URL("../../contracts/blob-transfer-v1.json", import.meta.url), "utf8"));
const configuration = JSON.parse(await readFile(new URL("../blob-transfer-projects.json", import.meta.url), "utf8"));

test("Dufs and Photo proposals cover every draft state and error vocabulary", () => {
  const projects = validateBlobTransferConfiguration(contract, configuration);
  assert.deepEqual(projects.map(project => project.id), ["dufs-ram", "photo-backup"]);
});

test("an incomplete proposed mapping is rejected", () => {
  const broken = structuredClone(configuration);
  delete broken.projects[0].proposed_state_map.unknown;
  assert.throws(
    () => validateBlobTransferConfiguration(contract, broken),
    /does not map canonical state unknown/u,
  );
});

test("a proposed mapping cannot invent a stable error outside the draft", () => {
  const broken = structuredClone(configuration);
  broken.projects[1].proposed_error_map.unexpected = "silent_data_loss";
  assert.throws(
    () => validateBlobTransferConfiguration(contract, broken),
    /maps unknown stable error silent_data_loss/u,
  );
});

test("a proposal must disclose implementation gaps", () => {
  const broken = structuredClone(configuration);
  broken.projects[0].known_gaps = [];
  assert.throws(
    () => validateBlobTransferConfiguration(contract, broken),
    /proposal must disclose known gaps/u,
  );
});

test("a draft configuration cannot claim runtime conformance", () => {
  const broken = structuredClone(configuration);
  broken.runtime_conformance_claimed = true;
  assert.throws(
    () => validateBlobTransferConfiguration(contract, broken),
    /cannot claim runtime conformance/u,
  );
});

test("vendored draft contracts and related source markers match upstream", async () => {
  const projects = validateBlobTransferConfiguration(contract, configuration);
  assert.deepEqual(await verifyBlobTransferInputs(projects), []);
});
