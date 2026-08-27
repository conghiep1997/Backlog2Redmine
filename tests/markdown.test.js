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
  });
  vm.runInContext(`${source}\nthis.extractBacklogContent = extractBacklogContent;`, context);
  return context.extractBacklogContent;
}

test("preserves fenced code blocks with special URL characters", () => {
  const extractBacklogContent = createExtractor();
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
  const extractBacklogContent = createExtractor();
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
  const extractBacklogContent = createExtractor();
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
