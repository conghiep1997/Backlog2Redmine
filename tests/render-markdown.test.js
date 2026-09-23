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

function createRedminePreview() {
  const helpersSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "modules", "utils", "helpers.js"),
    "utf8"
  );
  const markdownSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "modules", "utils", "markdown.js"),
    "utf8"
  );
  const context = vm.createContext({
    window: {},
    globalThis: {},
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  });
  context.globalThis = context;
  vm.runInContext(helpersSource, context);
  vm.runInContext(markdownSource, context);
  vm.runInContext(source, context);
  return context.window.renderRedmineNotePreview;
}

test("Redmine preview shows Textile collapse and attachments", () => {
  const renderRedmineNotePreview = createRedminePreview();
  const html = renderRedmineNotePreview(
    [
      "**bold** and [docs](https://example.com)",
      "",
      "```",
      "line--with--dashes",
      "```",
      "",
      "{{collapse(VN)",
      "",
      "noi dung",
      "}}",
      "",
      "!shot.png!",
    ].join("\n")
  );

  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /<pre><code>line--with--dashes<\/code><\/pre>/);
  assert.match(html, /tb-redmine-collapse/);
  assert.match(html, /<summary>VN<\/summary>/);
  assert.match(html, /tb-redmine-attachment/);
  assert.match(html, />shot\.png</);
  assert.doesNotMatch(html, /```/);
  assert.doesNotMatch(html, /\*\*bold\*\*/);
});

test("Redmine preview escapes unsafe content in collapse titles", () => {
  const renderRedmineNotePreview = createRedminePreview();
  const html = renderRedmineNotePreview("{{collapse(<script>x</script>)\n\nbody\n}}");
  // Textile uses &#60;/&#62; for non-allowlisted tags; preview HTML-escapes `&` → &amp;#60;
  assert.match(html, /(?:&lt;script&gt;|&amp;#60;script&amp;#62;)/);
  assert.doesNotMatch(html, /<script>x<\/script>/);
});

test("Redmine preview keeps literal </pre> inside fenced code", () => {
  const renderRedmineNotePreview = createRedminePreview();
  const html = renderRedmineNotePreview("```\n</pre>hack\n```");
  assert.match(html, /<pre><code>&lt;\/pre&gt;hack<\/code><\/pre>/);
  assert.equal((html.match(/<\/pre>/gi) || []).length, 1);
});

test("Redmine preview renders markdown blockquotes instead of showing raw markers", () => {
  const renderRedmineNotePreview = createRedminePreview();
  const html = renderRedmineNotePreview(
    ["> 【Merge Request】", "> ", "> ・couix-api:", "> https://example.com"].join("\n")
  );

  assert.match(
    html,
    /<blockquote>【Merge Request】<br><br>・couix-api:<br>https:\/\/example\.com<\/blockquote>/
  );
  assert.doesNotMatch(html, /&gt; 【Merge Request】/);
});

test("markdown preview renders empty blockquote lines", () => {
  const renderMarkdownHtml = createRenderer();
  const html = renderMarkdownHtml("> first\n> \n> second");
  assert.equal(html, "<blockquote>first<br><br>second</blockquote>");
});
