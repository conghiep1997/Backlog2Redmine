const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const optionsSource = fs.readFileSync(path.join(root, "src", "options.js"), "utf8");

test("dynamic Redmine registration preserves static content-script load order", () => {
  const staticRegistration = manifest.content_scripts.find((entry) =>
    entry.matches.some((match) => match.includes("redmine"))
  );
  const block = optionsSource.match(/const REDMINE_CONTENT_SCRIPTS = \[([\s\S]*?)\];/);
  assert.ok(block, "REDMINE_CONTENT_SCRIPTS must exist");
  const dynamicScripts = [...block[1].matchAll(/"([^"]+\.js)"/g)].map((match) => match[1]);
  assert.deepEqual(dynamicScripts, staticRegistration.js);
});

test("manifest declares scripting and optional custom Redmine hosts", () => {
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.optional_host_permissions.includes("http://*/*"));
  assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
});
