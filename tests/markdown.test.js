const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "utils", "markdown.js"),
  "utf8"
);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function createTextNode(text) {
  return {
    nodeType: TEXT_NODE,
    textContent: text,
    childNodes: [],
  };
}

function createElement(tagName, attrs = {}, children = []) {
  const className = attrs.class || "";
  const classParts = className.split(/\s+/).filter(Boolean);
  const el = {
    nodeType: ELEMENT_NODE,
    tagName: tagName.toUpperCase(),
    childNodes: children,
    className,
    classList: {
      contains: (name) => classParts.includes(name),
      [Symbol.iterator]: function* () {
        yield* classParts;
      },
    },
    getAttribute: (name) => {
      if (name === "class") return className;
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    querySelector: (selector) => querySelector(el, selector),
    get textContent() {
      return collectText(el);
    },
  };
  return el;
}

function collectText(node) {
  if (node.nodeType === TEXT_NODE) return node.textContent || "";
  return (node.childNodes || []).map(collectText).join("");
}

function querySelector(root, selector) {
  const tag = selector.toLowerCase();
  const stack = [...(root.childNodes || [])];
  while (stack.length) {
    const node = stack.shift();
    if (node.nodeType !== ELEMENT_NODE) continue;
    if (node.tagName.toLowerCase() === tag) return node;
    stack.push(...(node.childNodes || []));
  }
  return null;
}

function createExtractor() {
  const context = vm.createContext({
    Node: { TEXT_NODE, ELEMENT_NODE },
    globalThis: {},
    window: { location: { origin: "https://example.backlog.com" } },
    URL,
  });
  vm.runInContext(
    `${source}\nthis.extractBacklogContent = extractBacklogContent;\nthis.markdownToTextile = markdownToTextile;\nthis.resolveBacklogHref = resolveBacklogHref;`,
    context
  );
  return context;
}

test("preserves fenced code blocks with special URL characters", () => {
  const { extractBacklogContent } = createExtractor();
  const codeText =
    "https://example.com/my--page\nhttps://example.com/base/*\nhttps://example.com/a;b\nhttps://example.com/p?id=0xAB";
  const root = createElement("div", { class: "markdown-body" }, [
    createElement("pre", {}, [createElement("code", {}, [createTextNode(codeText)])]),
  ]);

  const markdown = extractBacklogContent(root);
  assert.match(markdown, /```\nhttps:\/\/example\.com\/my--page/);
  assert.match(markdown, /base\/\*/);
  assert.match(markdown, /a;b/);
  assert.match(markdown, /id=0xAB\n```/);
  assert.ok(markdown.includes("```\n"));
});

test("preserves inline code literals used in the QA note", () => {
  const { extractBacklogContent } = createExtractor();
  const root = createElement("p", {}, [
    createTextNode("blocked by "),
    createElement("code", {}, [createTextNode("--")]),
    createTextNode(", "),
    createElement("code", {}, [createTextNode("/*")]),
    createTextNode(", "),
    createElement("code", {}, [createTextNode(";")]),
    createTextNode(", "),
    createElement("code", {}, [createTextNode("0x[0-9a-fA-F]+")]),
  ]);

  assert.equal(extractBacklogContent(root), "blocked by `--`, `/*`, `;`, `0x[0-9a-fA-F]+`");
});

test("converts underline, color span, and task list checkboxes", () => {
  const { extractBacklogContent } = createExtractor();
  const checked = createElement("input", { type: "checkbox" });
  checked.checked = true;
  const unchecked = createElement("input", { type: "checkbox" });
  unchecked.checked = false;

  const root = createElement("div", {}, [
    createElement("p", {}, [
      createElement("u", {}, [createTextNode("under")]),
      createTextNode(" "),
      createElement("span", { style: "color: red" }, [createTextNode("red")]),
    ]),
    createElement("ul", {}, [
      createElement("li", {}, [checked, createTextNode(" done")]),
      createElement("li", {}, [unchecked, createTextNode(" todo")]),
    ]),
  ]);

  const markdown = extractBacklogContent(root);
  assert.match(markdown, /<u>under<\/u>/);
  assert.match(markdown, /<span style="color: red">red<\/span>/);
  assert.match(markdown, /\* \[x\] done/);
  assert.match(markdown, /\* \[ \] todo/);
});

test("markdownToTextile converts fences, bold, links for Redmine notes", () => {
  const { markdownToTextile } = createExtractor();
  const input = [
    "**bold** and `inline`",
    "",
    "```",
    "https://example.com/my--page",
    "```",
    "",
    "[docs](https://example.com)",
    "",
    "{{collapse(VN)",
    "",
    "**dich**",
    "}}",
  ].join("\n");

  const textile = markdownToTextile(input);
  assert.match(textile, /\*bold\*/);
  assert.match(textile, /<code>inline<\/code>/);
  assert.match(textile, /<pre>\nhttps:\/\/example\.com\/my--page\n<\/pre>/);
  assert.match(textile, /"docs":https:\/\/example\.com/);
  assert.match(textile, /\{\{collapse\(VN\)/);
  assert.match(textile, /\*dich\*/);
  assert.doesNotMatch(textile, /```/);
  assert.doesNotMatch(textile, /\*\*bold\*\*/);
});

test("extractBacklogContent absolutizes relative Backlog issue links", () => {
  const { extractBacklogContent } = createExtractor();
  const root = createElement("p", {}, [
    createElement("a", { href: "/view/COUIX_PJ-3649" }, [createTextNode("COUIX_PJ-3649")]),
    createTextNode(" 【性能改善】title"),
  ]);

  const markdown = extractBacklogContent(root);
  assert.match(
    markdown,
    /\[COUIX_PJ-3649\]\(https:\/\/example\.backlog\.com\/view\/COUIX_PJ-3649\)/
  );
});

test("markdownToTextile converts relative Backlog issue links to Textile", () => {
  const { markdownToTextile } = createExtractor();
  const textile = markdownToTextile(
    "[COUIX_PJ-3649](/view/COUIX_PJ-3649) 【性能改善】デザインテーマ"
  );
  assert.match(textile, /"COUIX_PJ-3649":https:\/\/example\.backlog\.com\/view\/COUIX_PJ-3649/);
  assert.doesNotMatch(textile, /\[COUIX_PJ-3649\]\(\/view\/COUIX_PJ-3649\)/);
});

test("markdownToTextile drops unsafe link schemes", () => {
  const { markdownToTextile } = createExtractor();
  const textile = markdownToTextile("[x](javascript:alert(1)) and [ok](https://example.com)");
  assert.doesNotMatch(textile, /javascript:/i);
  assert.match(textile, /"ok":https:\/\/example\.com/);
  assert.match(textile, /\bx\b/);
});

test("markdownToTextile preserves markdown blockquote markers", () => {
  const { markdownToTextile } = createExtractor();
  const textile = markdownToTextile("> first line\n> second line\n\nplain text");
  assert.equal(textile, "> first line\n> second line\n\nplain text");
});

test("markdownToTextile escapes closing pre/code tags inside fences", () => {
  const { markdownToTextile } = createExtractor();
  const textile = markdownToTextile("```\n</pre>hack\n```");
  assert.match(textile, /<pre>\n&lt;\/pre&gt;hack\n<\/pre>/);
  assert.equal((textile.match(/<\/pre>/gi) || []).length, 1);
});

test("markdownToTextile keeps single-asterisk Textile bold intact", () => {
  const { markdownToTextile } = createExtractor();
  assert.equal(markdownToTextile("*already* and **md**"), "*already* and *md*");
});

test("markdownToTextile escapes html special chars in inline code", () => {
  const { markdownToTextile } = createExtractor();
  assert.equal(markdownToTextile("`a<b>&c`"), "<code>a&lt;b&gt;&amp;c</code>");
});
