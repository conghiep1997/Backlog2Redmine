const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "modules", "services", "redmine.js"), "utf8");

function createExtractor() {
  const context = vm.createContext({
    console,
    normalizeLoose: (value) =>
      String(value ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .toLowerCase(),
    globalThis: {},
  });

  vm.runInContext(
    `${source}\nthis.pickBestRedmineSearchResult = pickBestRedmineSearchResult;\nthis.hasStrongRedmineTextMatch = hasStrongRedmineTextMatch;\nthis.normalizeLoose = normalizeLoose;`,
    context
  );

  return context;
}

test("pickBestRedmineSearchResult returns a strong match even when tracker differs", () => {
  const { pickBestRedmineSearchResult, normalizeLoose } = createExtractor();

  const results = [
    {
      id: 3557,
      subject:
        "Bug #3557 (New): COUIX_PJ-3557 【アンケート】コンテンツ一覧の表示設定_表示条件(URL)機能修正と追加",
      tracker: "Bug",
    },
    {
      id: 9999,
      subject: "Bug #9999 (New): something else",
      tracker: "Bug",
    },
  ];

  const picked = pickBestRedmineSearchResult(
    results,
    normalizeLoose("COUIX_PJ-3557"),
    normalizeLoose("【アンケート】コンテンツ一覧の表示設定_表示条件(URL)機能修正と追加"),
    ["task"]
  );

  assert.equal(picked?.id, 3557);
});

test("pickBestRedmineSearchResult prefers tracker when summary match is too weak", () => {
  const { pickBestRedmineSearchResult, normalizeLoose } = createExtractor();

  const results = [
    {
      id: 100,
      subject: "Bug #100 (New): fix bug",
      tracker: "Bug",
    },
    {
      id: 200,
      subject: "Task #200 (New): unrelated task",
      tracker: "Task",
    },
  ];

  const picked = pickBestRedmineSearchResult(
    results,
    normalizeLoose(""),
    normalizeLoose("fix bug"),
    ["task"]
  );

  assert.equal(picked?.id, 200);
});

test("hasStrongRedmineTextMatch requires issue key or long summary", () => {
  const { hasStrongRedmineTextMatch, normalizeLoose } = createExtractor();

  assert.equal(hasStrongRedmineTextMatch(normalizeLoose("Bug #1 COUIX_PJ-3557 title"), normalizeLoose("COUIX_PJ-3557"), normalizeLoose("short")), true);
  assert.equal(
    hasStrongRedmineTextMatch(
      normalizeLoose("Bug #1 long japanese title here"),
      normalizeLoose(""),
      normalizeLoose("long japanese title here")
    ),
    true
  );
  assert.equal(hasStrongRedmineTextMatch(normalizeLoose("Bug #1 fix bug"), normalizeLoose(""), normalizeLoose("fix bug")), false);
});
