/**
 * Markdown conversion utility for Backlog2Redmine Extension.
 * Converts HTML from Backlog to Markdown format for Redmine.
 *
 * Supported formats:
 * - Inline: bold, italic, strike-through, underline, inline code, links, colored text
 * - Block: headings, code blocks, blockquotes, lists (incl. task lists), tables, hr
 * - Special: Backlog attachment images/files ([[TB_IMG:id]], [[TB_FILE:id:name]])
 */

/**
 * Extracts text content from Backlog comment HTML and converts to Markdown.
 *
 * @param {HTMLElement} element - DOM element containing comment content
 * @returns {string} Markdown-formatted content
 */
function extractBacklogContent(element) {
  if (!element) {
    return "";
  }

  let result = "";
  const listStack = []; // Stack to track nested lists (ul/ol)
  let tableRows = []; // Accumulator for table rows
  let isInsideTable = false;

  /**
   * Recursive tree walker to traverse DOM nodes.
   * @param {Node} node - Current DOM node
   * @param {object} options - Walking options
   * @param {boolean} options.isInsideBlockquote - Currently in blockquote context
   * @param {boolean} options.isInsidePre - Currently in pre/code block
   */
  function walk(node, options = {}) {
    const { isInsideBlockquote = false, isInsidePre = false } = options;

    // TEXT NODE: Process text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      // Normalize whitespace (unless inside pre block)
      if (!isInsidePre) {
        // Keep original line breaks, but normalize multiple spaces on a single line
        text = text.replace(/[^\n]\s{2,}/g, (match) => match[0] + " ");
      }
      // Process text inside blockquote
      if (isInsideBlockquote && result.endsWith("> ")) {
        text = text.trimStart();
      }
      result += text;
    }
    // ELEMENT NODE: Process element nodes
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      // ========================================================================
      // INLINE FORMATTING
      // ========================================================================

      // Bold: <strong>, <b> -> **text**
      if (tag === "strong" || tag === "b") {
        result += "**";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "**";
        return;
      }

      // Italic: <em>, <i> -> *text*
      if (tag === "em" || tag === "i") {
        result += "*";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "*";
        return;
      }

      // Strike-through: <del>, <s>, <strike> -> ~~text~~
      if (tag === "del" || tag === "s" || tag === "strike") {
        result += "~~";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "~~";
        return;
      }

      // Underline: <u>, <ins> -> keep HTML (Markdown has no underline; Redmine accepts <u>)
      if (tag === "u" || tag === "ins") {
        result += "<u>";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "</u>";
        return;
      }

      // Colored / highlighted text from Backlog (&color(...), mark)
      if (tag === "mark") {
        result += "<mark>";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "</mark>";
        return;
      }
      if (tag === "span" || tag === "font") {
        const styleColor = extractCssColor(node.getAttribute("style") || "", "color");
        const styleBg = extractCssColor(node.getAttribute("style") || "", "background-color");
        const fontColor = tag === "font" ? node.getAttribute("color") || "" : "";
        const color = styleColor || fontColor;
        if (color || styleBg) {
          const styleParts = [];
          if (color) styleParts.push(`color: ${color}`);
          if (styleBg) styleParts.push(`background-color: ${styleBg}`);
          result += `<span style="${styleParts.join("; ")}">`;
          for (const child of node.childNodes) {
            walk(child, options);
          }
          result += "</span>";
          return;
        }
      }

      // Inline code: <code> (when not inside <pre>) -> `code`
      // Preserve literals such as --, /*, ;, 0xAB inside backticks for Redmine.
      if (tag === "code" && !isInsidePre) {
        const codeText = node.textContent || "";
        result += "`" + codeText.replace(/`/g, "\\`") + "`";
        return;
      }

      // Links: <a> -> [text](url) or plain text (user links)
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const textBefore = result;
        for (const child of node.childNodes) {
          walk(child, options);
        }
        const linkText = result.slice(textBefore.length).trim();

        if (href && linkText) {
          // Check if this is an attachment link (Video or File)
          if (href.includes("ViewAttachmentVideo.action") || href.includes("downloadAttachment/")) {
            const match =
              href.match(/attachmentId=(\d+)/) || href.match(/downloadAttachment\/(\d+)/);
            if (match) {
              result = textBefore + ` [[TB_FILE:${match[1]}:${linkText}]] `;
              return;
            }
          }

          // User profile links: keep as text, do not create markdown link
          if (
            href.startsWith("/user/") ||
            (href.startsWith("https://") && href.includes(".backlog.com/user/"))
          ) {
            result = textBefore + linkText;
          } else {
            // External/other links: create markdown link [text](url)
            result = textBefore + `[${linkText}](${href})`;
          }
        } else if (href) {
          result = textBefore + `[${href}](${href})`;
        }
        return;
      }

      // ========================================================================
      // BLOCK ELEMENTS
      // ========================================================================

      // Code blocks: <pre> or <pre><code> -> ```lang\n...\n```
      // Also treat Backlog/GFM highlight wrappers the same when they nest <pre>.
      if (tag === "pre") {
        const codeEl = node.querySelector("code");
        let codeContent = "";
        let language = "";

        if (codeEl) {
          const langClass = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
          if (langClass) {
            language = langClass.replace("language-", "");
          }
          codeContent = codeEl.textContent;
        } else {
          codeContent = node.textContent;
        }

        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        result += "```" + language + "\n";
        result += codeContent.replace(/^\n+|\n+$/g, "");
        result += "\n```\n";
        return;
      }

      // Backlog/GFM highlight wrappers without relying only on nested walk order
      if (
        tag === "div" &&
        /\b(highlight|code-block|codeblock|preformatted)\b/i.test(node.className || "")
      ) {
        const nestedPre = node.querySelector("pre");
        if (nestedPre) {
          walk(nestedPre, options);
          return;
        }
        const codeText = (node.textContent || "").replace(/^\n+|\n+$/g, "");
        if (codeText) {
          if (result.length > 0 && !result.endsWith("\n")) {
            result += "\n";
          }
          result += "```\n" + codeText + "\n```\n";
          return;
        }
      }

      // Headings: <h1>-<h6> -> # Heading
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        const level = parseInt(tag[1]);
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        result += "#".repeat(level) + " ";
        for (const child of node.childNodes) {
          walk(child, options);
        }
        result += "\n\n";
        return;
      }

      // Images: <img> -> ![](url) or [[TB_IMG:id]] for Backlog attachments
      if (tag === "img") {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";

        if (node.classList.contains("loom-internal-image") || src.includes("ViewAttachmentImage")) {
          const match = src.match(/attachmentId=(\d+)/);
          if (match) {
            result += ` [[TB_IMG:${match[1]}]] `;
          }
        } else {
          result += `![${alt}](${src}) `;
        }
        return;
      }

      // Blockquotes: <blockquote> -> > text
      if (tag === "blockquote") {
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        const quoteStart = result.length;
        for (const child of node.childNodes) {
          walk(child, { ...options, isInsideBlockquote: true });
        }
        const quoteText = result.slice(quoteStart);
        result =
          result.slice(0, quoteStart) +
          quoteText
            .trimEnd()
            .split("\n")
            .map((line) => "> " + line.trimStart())
            .join("\n");
        result += "\n\n";
        return;
      }

      // Unordered/Ordered lists: <ul>, <ol> -> * or 1.
      if (tag === "ul" || tag === "ol") {
        const newMarker = tag === "ul" ? "*" : "1.";
        listStack.push({ type: tag, marker: newMarker, counter: 0 });
        for (const child of node.childNodes) {
          walk(child, options);
        }
        listStack.pop();
        if (!result.endsWith("\n")) {
          result += "\n";
        }
        return;
      }

      // List items: <li> -> * item, 1. item, or task list - [ ] / - [x]
      if (tag === "li") {
        const indent = "  ".repeat(Math.max(0, listStack.length - 1));
        const listInfo = listStack[listStack.length - 1];
        const checkbox = findDirectCheckbox(node);

        if (!result.endsWith("\n")) {
          result += "\n";
        }

        if (listInfo?.type === "ol") {
          listInfo.counter++;
          result += `${indent}${listInfo.counter}. `;
        } else if (checkbox) {
          result += `${indent}* [${checkbox.checked ? "x" : " "}] `;
        } else {
          result += `${indent}* `;
        }

        let skipLeadingWhitespace = Boolean(checkbox);
        for (const child of node.childNodes) {
          if (
            child.nodeType === Node.ELEMENT_NODE &&
            child.tagName.toLowerCase() === "input" &&
            child.getAttribute("type") === "checkbox"
          ) {
            continue;
          }
          if (skipLeadingWhitespace && child.nodeType === Node.TEXT_NODE) {
            const trimmed = child.textContent.replace(/^\s+/, "");
            if (!trimmed) {
              continue;
            }
            skipLeadingWhitespace = false;
            result += trimmed;
            continue;
          }
          skipLeadingWhitespace = false;
          walk(child, options);
        }
        return;
      }

      // Tables: <table> -> Markdown table
      if (tag === "table") {
        isInsideTable = true;
        tableRows = [];
        for (const child of node.childNodes) {
          walk(child, options);
        }
        isInsideTable = false;

        if (tableRows.length > 0) {
          if (result.length > 0 && !result.endsWith("\n")) {
            result += "\n";
          }
          const maxCols = Math.max(...tableRows.map((r) => r.length));
          const headerRow = tableRows[0] || [];
          while (headerRow.length < maxCols) {
            headerRow.push("");
          }
          result += "| " + headerRow.join(" | ") + " |\n";
          result += "|" + " --- |".repeat(maxCols) + "\n";
          for (let i = 1; i < tableRows.length; i++) {
            const row = tableRows[i];
            while (row.length < maxCols) {
              row.push("");
            }
            result += "| " + row.join(" | ") + " |\n";
          }
          result += "\n";
        }
        return;
      }

      // Table rows: <tr> -> extract cells
      if (tag === "tr") {
        const currentRow = [];
        for (const child of node.childNodes) {
          if (
            child.nodeType === Node.ELEMENT_NODE &&
            ["td", "th"].includes(child.tagName.toLowerCase())
          ) {
            const cellText = child.textContent.trim().replace(/\n/g, " ");
            currentRow.push(cellText);
          }
        }
        if (currentRow.length > 0) {
          tableRows.push(currentRow);
        }
        return;
      }

      // Paragraphs and divs: <p>, <div> -> add newline
      if (["p", "div"].includes(tag)) {
        const textBefore = result;
        for (const child of node.childNodes) {
          walk(child, options);
        }
        const textAfter = result.slice(textBefore.length);
        // Only add double newline if there's actual content and not already present
        if (textAfter.trim() && !result.endsWith("\n\n")) {
          result += "\n\n";
        }
        return;
      }

      // Line breaks: <br> -> newline
      if (tag === "br") {
        result += "\n";
        return;
      }

      // Horizontal rules: <hr> -> ---
      if (tag === "hr") {
        if (!result.endsWith("\n")) {
          result += "\n";
        }
        result += "---\n\n";
        return;
      }

      // Default: process children recursively
      for (const child of node.childNodes) {
        walk(child, options);
      }
    }
  }

  walk(element);

  // Cleanup: remove redundant formatting while preserving meaningful line breaks.
  // Do NOT collapse backtick runs — that would destroy fenced code blocks (```).
  return result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n") // Keep max 3 consecutive newlines (2 blank lines)
    .replace(/\*\*\*\*(?!\*)/g, "**")
    .trim();
}

/**
 * Extract a CSS color value from an inline style attribute.
 * @param {string} style
 * @param {string} property
 * @returns {string}
 */
function extractCssColor(style, property) {
  if (!style || !property) {
    return "";
  }
  const pattern = new RegExp(
    `${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+)`,
    "i"
  );
  const match = String(style).match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Find a direct-child checkbox inside a list item (task list).
 * @param {Element} listItem
 * @returns {HTMLInputElement|null}
 */
function findDirectCheckbox(listItem) {
  for (const child of listItem.childNodes) {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      child.tagName.toLowerCase() === "input" &&
      (child.getAttribute("type") || "").toLowerCase() === "checkbox"
    ) {
      return child;
    }
  }
  return null;
}

/**
 * Convert Markdown (used in modal preview) to Textile for Redmine notes.
 * Redmine uses Textile macros ({{collapse}}, !image!), so MD fences/bold
 * would otherwise show as raw text on the issue page.
 *
 * @param {string} markdown
 * @returns {string}
 */
function escapeHtmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToTextile(markdown) {
  if (!markdown) {
    return "";
  }

  const protections = [];
  const protect = (value) => {
    const token = `§§TBPROT${protections.length}§§`;
    protections.push(value);
    return token;
  };

  let text = String(markdown);

  // Protect Textile attachments / markers that must stay untouched
  text = text.replace(/!([^!\s\n]+)!/g, (m) => protect(m));
  text = text.replace(/attachment:[^\s]+/gi, (m) => protect(m));
  text = text.replace(/\{\{video\([^)]+\)\}\}/gi, (m) => protect(m));
  text = text.replace(/\[\[TB_(?:IMG|FILE):[^\]]+\]\]/gi, (m) => protect(m));

  // Fenced code blocks → <pre> (widely rendered by Redmine Textile)
  text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    const body = escapeHtmlText(String(code).replace(/^\n+|\n+$/g, ""));
    return protect(`<pre>\n${body}\n</pre>`);
  });

  // Inline code → <code> (avoids clashing with @mentions in Textile)
  text = text.replace(/`([^`\n]+)`/g, (_m, code) =>
    protect(`<code>${escapeHtmlText(code)}</code>`)
  );

  // Links [label](url) → "label":url
  text = text.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/gi, (_m, label, url) =>
    protect(`"${label}":${url}`)
  );

  // Images ![alt](src) → !src! (Redmine Textile attachment/image syntax)
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, _alt, src) => protect(`!${src}!`));

  // Headings
  text = text.replace(/^######\s+(.+)$/gm, "h6. $1");
  text = text.replace(/^#####\s+(.+)$/gm, "h5. $1");
  text = text.replace(/^####\s+(.+)$/gm, "h4. $1");
  text = text.replace(/^###\s+(.+)$/gm, "h3. $1");
  text = text.replace(/^##\s+(.+)$/gm, "h2. $1");
  text = text.replace(/^#\s+(.+)$/gm, "h1. $1");

  // Blockquotes: keep Markdown `>` markers intact for this Redmine instance.

  // Bold **text** → Textile *text* (protect so later passes leave it alone)
  text = text.replace(/\*\*(.+?)\*\*/g, (_m, inner) => protect(`*${inner}*`));
  text = text.replace(/~~(.+?)~~/g, "-$1-");
  // Keep single *text* untouched: in Textile that is bold; MD italic should use _text_
  // (already valid Textile italic), so we do not rewrite *…* → _…_.

  // Ordered lists 1. → #
  text = text.replace(/^(\s*)\d+\.\s+/gm, "$1# ");

  // Task lists keep checkbox marker under Textile list syntax
  text = text.replace(/^(\s*)[*-]\s+\[(x|X| )\]\s+/gm, (_m, indent, mark) => {
    return `${indent}* [${mark === " " ? " " : "x"}] `;
  });

  // Unordered lists: leading "-" → "*"
  text = text.replace(/^(\s*)-\s+/gm, "$1* ");

  // Markdown tables → Textile pipe rows (drop separator)
  text = text.replace(/^\|(.+)\|$/gm, (line) => {
    if (/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim())) {
      return "";
    }
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    return `|${cells.join("|")}|`;
  });

  for (let i = protections.length - 1; i >= 0; i--) {
    text = text.split(`§§TBPROT${i}§§`).join(protections[i]);
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

if (typeof globalThis !== "undefined") {
  globalThis.markdownToTextile = markdownToTextile;
}
