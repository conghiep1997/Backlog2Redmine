const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
  "utf8"
);

function loadHelpers() {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(
    `${source}
this.normalizeBacklogOrigin = normalizeBacklogOrigin;
this.buildRedmineUploadUrl = buildRedmineUploadUrl;
this.buildRedmineUrl = buildRedmineUrl;`,
    context
  );
  return context;
}

test("normalizeBacklogOrigin accepts hostname and full URL", () => {
  const { normalizeBacklogOrigin } = loadHelpers();
  assert.equal(normalizeBacklogOrigin("space.backlog.com"), "https://space.backlog.com");
  assert.equal(
    normalizeBacklogOrigin("https://space.backlog.com/"),
    "https://space.backlog.com"
  );
  assert.equal(
    normalizeBacklogOrigin("https://space.backlog.jp/view/PROJ-1"),
    "https://space.backlog.jp"
  );
  assert.equal(normalizeBacklogOrigin(""), "");
});

test("buildRedmineUploadUrl includes encoded filename query param", () => {
  const { buildRedmineUploadUrl } = loadHelpers();
  const url = buildRedmineUploadUrl(
    "https://redmine.example.com",
    "3653_API呼び出しあり.mp4"
  );
  const parsed = new URL(url);
  assert.equal(parsed.pathname.endsWith("/uploads.json"), true);
  assert.equal(parsed.searchParams.get("filename"), "3653_API呼び出しあり.mp4");
});
