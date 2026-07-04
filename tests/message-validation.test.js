const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "message-validation.js"),
  "utf8"
);
const context = vm.createContext({});
vm.runInContext(source, context);

test("accepts known messages from the current extension", () => {
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertMessage({
      type: "TRANSLATE_TEXT_SIMPLE",
      text: "hello",
    })
  );
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertInternalSender({ id: "extension-id" }, "extension-id")
  );
  assert.doesNotThrow(() =>
    context.TB_MESSAGE_VALIDATION.assertMessage({
      type: "FETCH_REDMINE_PROJECTS_WITH_KEY",
      domain: "https://redmine.example.com",
      apiKey: "key",
    })
  );
});

test("rejects unknown, oversized, and malformed messages", () => {
  assert.throws(
    () => context.TB_MESSAGE_VALIDATION.assertMessage({ type: "UNKNOWN" }),
    /Unsupported/
  );
  assert.throws(
    () =>
      context.TB_MESSAGE_VALIDATION.assertMessage({
        type: "TRANSLATE_TEXT_SIMPLE",
        text: "x".repeat(100001),
      }),
    /too long/
  );
  assert.throws(
    () =>
      context.TB_MESSAGE_VALIDATION.assertMessage({
        type: "TRANSLATE_TEXT_SIMPLE",
        text: 123,
      }),
    /must be a string/
  );
  assert.throws(
    () => context.TB_MESSAGE_VALIDATION.assertInternalSender({ id: "other" }, "extension-id"),
    /Untrusted/
  );
});
