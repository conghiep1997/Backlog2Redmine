const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "version.js"),
  "utf8"
);
const context = vm.createContext({});
vm.runInContext(source, context);

const { TB_VERSION } = context;

test("compares versions with different segment lengths", () => {
  assert.equal(TB_VERSION.compare("1.8.08", "1.8.8"), 0);
  assert.equal(TB_VERSION.compare("1.8.8", "1.9.0"), -1);
  assert.equal(TB_VERSION.compare("2.0", "1.99.99"), 1);
});

test("rejects invalid version values", () => {
  assert.equal(TB_VERSION.isValid("1.8.08"), true);
  assert.equal(TB_VERSION.isValid("1.8.beta"), false);
  assert.equal(TB_VERSION.isValid(undefined), false);
  assert.throws(() => TB_VERSION.compare("1.8", "latest"), /numeric dot-separated/);
});
