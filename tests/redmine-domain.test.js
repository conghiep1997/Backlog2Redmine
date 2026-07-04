const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "redmine-domain.js"),
  "utf8"
);
const context = vm.createContext({ URL });
vm.runInContext(source, context);

test("normalizes Redmine origins and creates host match patterns", () => {
  assert.equal(
    context.TB_REDMINE_DOMAIN.normalize("https://redmine.example.com/projects/1"),
    "https://redmine.example.com"
  );
  assert.equal(
    context.TB_REDMINE_DOMAIN.toMatchPattern("http://localhost:3000/redmine"),
    "http://localhost/*"
  );
  assert.equal(
    context.TB_REDMINE_DOMAIN.toMatchPattern("http://localhost:4000/other"),
    "http://localhost/*"
  );
  assert.equal(
    context.TB_REDMINE_DOMAIN.isDefault("http://localhost:4000", "http://localhost:3000"),
    true
  );
});

test("rejects unsupported protocols", () => {
  assert.throws(() => context.TB_REDMINE_DOMAIN.normalize("javascript:alert(1)"), /HTTP/);
});
