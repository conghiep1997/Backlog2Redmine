const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "render-markdown.js"),
  "utf8"
);

function createRenderer() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context);
  return context.window.renderMarkdownHtml;
}

test("renders paragraphs without adding break tags between block elements", () => {
  const renderMarkdownHtml = createRenderer();

  assert.equal(renderMarkdownHtml("first line\nsecond line"), "<p>first line<br>second line</p>");
  assert.equal(renderMarkdownHtml("# Title\n\nBody"), "<h1>Title</h1><p>Body</p>");
});

test("renders unordered, ordered, and task markdown lists", () => {
  const renderMarkdownHtml = createRenderer();

  assert.equal(
    renderMarkdownHtml("- one\n- **two**"),
    "<ul><li>one</li><li><strong>two</strong></li></ul>"
  );
  assert.equal(renderMarkdownHtml("1. first\n2. second"), "<ol><li>first</li><li>second</li></ol>");
  assert.equal(
    renderMarkdownHtml("- [x] done\n- [ ] todo"),
    '<ul class="tb-task-list"><li class="tb-task-list-item"><input type="checkbox" disabled checked> <span>done</span></li><li class="tb-task-list-item"><input type="checkbox" disabled> <span>todo</span></li></ul>'
  );
});

test("renders inline markdown and removes unsafe markdown links", () => {
  const renderMarkdownHtml = createRenderer();

  assert.equal(
    renderMarkdownHtml("~~old~~ and `code`"),
    "<p><del>old</del> and <code>code</code></p>"
  );
  assert.equal(renderMarkdownHtml("[bad](javascript:alert(1))"), "<p>bad)</p>");
  assert.equal(
    renderMarkdownHtml("[ok](https://example.com)"),
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a></p>'
  );
});

test("escapes html in regular text and tables", () => {
  const renderMarkdownHtml = createRenderer();

  assert.equal(
    renderMarkdownHtml("<script>alert(1)</script>"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
  );
  assert.equal(
    renderMarkdownHtml("| Name | Value |\n| --- | --- |\n| A | <b>safe</b> |"),
    '<div class="tb-preview-table-wrap"><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>&lt;b&gt;safe&lt;/b&gt;</td></tr></tbody></table></div>'
  );
});

test("renders fenced code without applying inline markdown", () => {
  const renderMarkdownHtml = createRenderer();

  assert.equal(
    renderMarkdownHtml("```\n**not bold**\n```"),
    "<pre><code>**not bold**</code></pre>"
  );
});
