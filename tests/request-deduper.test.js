const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "request-deduper.js"),
  "utf8"
);
const context = vm.createContext({ Promise });
vm.runInContext(source, context);

test("coalesces identical in-flight requests", async () => {
  let calls = 0;
  let release;
  const operation = () => {
    calls += 1;
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  const key = context.TB_REQUEST_DEDUPER.createKey("SEND_TO_REDMINE", {
    redmineIssueId: "12",
    backlogIssueKey: "TEST-1",
    notes: "hello",
  });

  const first = context.TB_REQUEST_DEDUPER.run(key, operation);
  const second = context.TB_REQUEST_DEDUPER.run(key, operation);
  await Promise.resolve();

  assert.equal(calls, 1);
  assert.equal(first, second);
  release("done");
  assert.equal(await first, "done");
});

test("allows the same request after completion", async () => {
  let calls = 0;
  const key = context.TB_REQUEST_DEDUPER.createKey("SEND_TO_BACKLOG", {
    backlogIssueKey: "TEST-1",
    content: "hello",
  });
  const operation = async () => {
    calls += 1;
    return calls;
  };

  assert.equal(await context.TB_REQUEST_DEDUPER.run(key, operation), 1);
  await Promise.resolve();
  assert.equal(await context.TB_REQUEST_DEDUPER.run(key, operation), 2);
});
