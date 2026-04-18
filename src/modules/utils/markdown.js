/**
 * Markdown conversion utility for Backlog2Redmine Extension.
 * Converts HTML from Backlog to Markdown format for Redmine.
 *
 * Supported formats:
 * - Inline: bold, italic, strike-through, code, links
 * - Block: headings, code blocks, blockquotes, lists, tables
 * - Special: Backlog attachment images ([[TB_IMG:id]])
 */

/**
 * Extracts text content from Backlog comment HTML and converts to Markdown.
 *
 * @param {HTMLElement} element - DOM element containing comment content
 * @returns {string} Markdown-formatted content
 *
 * @example
 * // Backlog HTML: <strong>Bold</strong> text
 * // Returns: **Bold** text
 *
 * @example
 * // Backlog HTML: <ul><li>Item 1</li></ul>
 * // Returns: * Item 1
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
        text = text.replace(/([^\n])\s+/g, "$1 ").replace(/^\s+/, " ");
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

      // Inline code: <code> (when not inside <pre>) -> `code`
      if (tag === "code" && !isInsidePre) {
        result += "`";
        for (const child of node.childNodes) {
          walk(child, { ...options, isInsidePre: false });
        }
        result += "`";
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
            const match = href.match(/attachmentId=(\d+)/) || href.match(/downloadAttachment\/(\d+)/);
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
            // External/other links: create markdown link
            result = textBefore + `[${linkText}](${href})`;
          }
        }
        return;
      }


      // ========================================================================
      // BLOCK ELEMENTS
      // ========================================================================

      // Code blocks: <pre> or <pre><code> -> ```lang\n...\n```
      if (tag === "pre") {
        const codeEl = node.querySelector("code");
        let codeContent = "";
        let language = "";

        if (codeEl) {
          // Extract language from class (e.g., "language-javascript")
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
        result += codeContent.trim();
        result += "\n```\n";
        return;
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

        // Backlog attachment image: keep marker for later processing
        if (node.classList.contains("loom-internal-image") || src.includes("ViewAttachmentImage")) {
          const match = src.match(/attachmentId=(\d+)/);
          if (match) {
            result += ` [[TB_IMG:${match[1]}]] `;
          }
        } else {
          // External image: create markdown image
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
        // Add "> " to the start of each line
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

      // List items: <li> -> * item or 1. item
      if (tag === "li") {
        // Calculate indentation based on list stack depth
        const indent = "  ".repeat(Math.max(0, listStack.length - 1));
        const listInfo = listStack[listStack.length - 1];

        if (!result.endsWith("\n")) {
          result += "\n";
        }

        if (listInfo?.type === "ol") {
          listInfo.counter++;
          result += `${indent}${listInfo.counter}. `;
        } else {
          result += `${indent}* `;
        }

        for (const child of node.childNodes) {
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

        // Convert table rows to Markdown table format
        if (tableRows.length > 0) {
          if (result.length > 0 && !result.endsWith("\n")) {
            result += "\n";
          }
          const maxCols = Math.max(...tableRows.map((r) => r.length));

          // Header row
          const headerRow = tableRows[0] || [];
          while (headerRow.length < maxCols) {
            headerRow.push("");
          }
          result += "| " + headerRow.join(" | ") + " |\n";

          // Separator row
          result += "|" + " --- |".repeat(maxCols) + "\n";

          // Data rows
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
        if (textAfter.trim() && !result.endsWith("\n")) {
          result += "\n";
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

  // Start walking from root element
  walk(element);

  // Cleanup: Remove redundant formatting
  return result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .replace(/\*\*\*\*/g, "**") // Fix nested bold markers
    .replace(/``+/g, "`") // Fix multiple backticks
    .trim();
}
