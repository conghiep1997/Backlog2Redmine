const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "settings-view.js"),
  "utf8"
);
const context = vm.createContext({ URL });
vm.runInContext(source, context);

const settings = {
  ai: { provider: "gemini" },
  backlogApiKey: "backlog-secret",
  defaultProjectId: "12",
  manualFields: "{}",
  redmineApiKey: "redmine-secret",
  redmineDomain: "https://redmine.example.com",
  reportProjectId: "34",
  showRedmineSuccessModal: true,
};

test("UI settings exclude credentials", () => {
  assert.deepEqual(
    { ...context.TB_SETTINGS_VIEW.forUi(settings) },
    {
      defaultProjectId: "12",
      manualFields: "{}",
      showRedmineSuccessModal: true,
    }
  );
});

test("report settings expose only required Redmine fields", () => {
  assert.deepEqual(
    { ...context.TB_SETTINGS_VIEW.forReport(settings) },
    {
      redmineApiKey: "redmine-secret",
      redmineDomain: "https://redmine.example.com",
      reportProjectId: "34",
    }
  );
});
test("origin checks accept only the configured Redmine origin", () => {
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin(
      "https://redmine.example.com/issues/1",
      "https://redmine.example.com"
    ),
    true
  );
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin(
      "https://attacker.example.com",
      "https://redmine.example.com"
    ),
    false
  );
  assert.equal(
    context.TB_SETTINGS_VIEW.hasSameOrigin("not-a-url", "https://redmine.example.com"),
    false
  );
});
