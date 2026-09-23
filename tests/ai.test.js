const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "ai.js"),
  "utf8"
);

function createNormalizer() {
  const helpersSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
    "utf8"
  );
  const context = vm.createContext({
    console,
    globalThis: {},
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(helpersSource, context);
  vm.runInContext(
    `${source}\nthis.normalizeTranslationOutput = normalizeTranslationOutput;`,
    context
  );
  return context.normalizeTranslationOutput;
}

test("normalizeTranslationOutput removes prompt boundary markers from AI output", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = ["[BẮT ĐẦU]", "Nội dung dịch tiếng Việt", "[KẾT THÚC]"].join("\n");

  assert.equal(normalizeTranslationOutput(raw), "Nội dung dịch tiếng Việt");
});

test("normalizeTranslationOutput keeps Vietnamese sentences that contain start/end words", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = "Chúng ta bắt đầu kiểm tra và kết thúc sau khi deploy.";

  assert.equal(normalizeTranslationOutput(raw), raw);
});

test("normalizeTranslationOutput removes prompt boundary markers in the middle of content", () => {
  const normalizeTranslationOutput = createNormalizer();
  const raw = ["Dòng đầu", "[BẮT ĐẦU]", "Dòng giữa", "[KẾT THÚC]", "Dòng cuối"].join("\n");

  assert.equal(normalizeTranslationOutput(raw), "Dòng đầu\nDòng giữa\nDòng cuối");
});

test("normalizeTranslationOutput decodes HTML-escaped angle brackets outside code", () => {
  const normalizeTranslationOutput = createNormalizer();
  assert.equal(
    normalizeTranslationOutput("flow_guide/display/&lt;flow_guide_id&gt;"),
    "flow_guide/display/<flow_guide_id>"
  );
  assert.equal(
    normalizeTranslationOutput("keep `&lt;code&gt;` literal"),
    "keep `&lt;code&gt;` literal"
  );
});
