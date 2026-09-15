const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "redmine.js"),
  "utf8"
);

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
    `${source}
this.pickBestRedmineSearchResult = pickBestRedmineSearchResult;
this.hasStrongRedmineTextMatch = hasStrongRedmineTextMatch;
this.extractJapaneseTitlePart = extractJapaneseTitlePart;
this.normalizeLoose = normalizeLoose;`,
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

  assert.equal(
    hasStrongRedmineTextMatch(
      "Bug #1 COUIX_PJ-3557 title",
      normalizeLoose("COUIX_PJ-3557"),
      normalizeLoose("short")
    ),
    true
  );
  assert.equal(
    hasStrongRedmineTextMatch(
      "Bug #1 long japanese title here",
      normalizeLoose(""),
      normalizeLoose("long japanese title here")
    ),
    true
  );
  assert.equal(
    hasStrongRedmineTextMatch("Bug #1 fix bug", normalizeLoose(""), normalizeLoose("fix bug")),
    false
  );
});

test("extractJapaneseTitlePart keeps JP and drops VN translation segment", () => {
  const { extractJapaneseTitlePart } = createExtractor();

  assert.equal(
    extractJapaneseTitlePart(
      "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる / ([Điều tra] Tại các trang web có áp dụng Design theme, hệ thống mất nhiều thời gian để lấy dữ liệu theme khi chuyển trang)"
    ),
    "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる"
  );
});

test("pickBestRedmineSearchResult matches JP-only when Redmine subject has VN translation", () => {
  const { pickBestRedmineSearchResult, normalizeLoose, extractJapaneseTitlePart } =
    createExtractor();

  const backlogJp =
    "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる";
  const redmineSubject = `${backlogJp} / ([Điều tra] Bản dịch VN khác hoàn toàn so với bản khác)`;

  const picked = pickBestRedmineSearchResult(
    [
      {
        id: 3587,
        subject: `Task #3587 (New): ${redmineSubject}`,
        tracker: "Task",
      },
    ],
    normalizeLoose("COUIX_PJ-3587"),
    normalizeLoose(extractJapaneseTitlePart(backlogJp)),
    ["task"]
  );

  assert.equal(picked?.id, 3587);
});
