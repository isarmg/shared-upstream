import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = ["content-card.css", "login.css", "accessibility.css"];

test("public design classes are namespaced", async () => {
  for (const name of files) {
    const css = await readFile(new URL(`../design/web/${name}`, import.meta.url), "utf8");
    const classNames = [...css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((match) => match[1]);
    assert.ok(classNames.length > 0, `${name} should expose classes`);
    for (const className of classNames) {
      assert.match(className, /^sarmg-/, `${name} contains unnamespaced .${className}`);
    }
  }
});

test("token source contains matching light and dark semantic keys", async () => {
  const tokens = JSON.parse(await readFile(new URL("../design/tokens/tokens.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(tokens.light).sort(), Object.keys(tokens.dark).sort());
});

