/**
 * Markdown to HTML rendering utility for preview mode.
 * Used in modal preview to render markdown as HTML.
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isSafeMarkdownHref(href) {
  const trimmedHref = String(href || "").trim();
  return /^(https?:|mailto:|#|\/(?!\/))/i.test(trimmedHref);
}

function renderInlineMarkdown(text) {
  const codeTokens = [];
  let html = text.replace(/`([^`]+?)`/g, (_match, code) => {
    const token = `@@TB_CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      if (!isSafeMarkdownHref(href)) {
        return label;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  codeTokens.forEach((value, index) => {
    html = html.replace(`@@TB_CODE_${index}@@`, value);
  });

  return html;
}

function flushParagraph(blocks, paragraphLines) {
  if (!paragraphLines.length) return;
  blocks.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`);
  paragraphLines.length = 0;
}

function flushList(blocks, listState) {
  if (!listState.items.length) return;

  const tag = listState.type === "ol" ? "ol" : "ul";
  const className = listState.hasTasks ? ' class="tb-task-list"' : "";
  blocks.push(`<${tag}${className}>${listState.items.join("")}</${tag}>`);
  listState.items = [];
  listState.type = "ul";
  listState.hasTasks = false;
}

function flushBlockquote(blocks, quoteLines) {
  if (!quoteLines.length) return;
  blocks.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join("<br>")}</blockquote>`);
  quoteLines.length = 0;
}

function flushOpenBlocks(blocks, paragraphLines, listState, quoteLines) {
  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listState);
  flushBlockquote(blocks, quoteLines);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableRow(line) {
  return line.includes("|") && !/^\s*\|?\s*$/.test(line);
}

function splitTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(tableLines) {
  const [headerLine, _separatorLine, ...rowLines] = tableLines;
  const headers = splitTableCells(headerLine);
  const rows = rowLines.map(splitTableCells);

  const thead = `<thead><tr>${headers
    .map((header) => `<th>${renderInlineMarkdown(header)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows
        .map(
          (row) =>
            `<tr>${headers
              .map((_header, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody>`
    : "";

  return `<div class="tb-preview-table-wrap"><table>${thead}${tbody}</table></div>`;
}

function collectTable(lines, startIndex) {
  if (!isTableRow(lines[startIndex]) || !isTableSeparator(lines[startIndex + 1] || "")) {
    return null;
  }

  const tableLines = [lines[startIndex], lines[startIndex + 1]];
  let nextIndex = startIndex + 2;
  while (nextIndex < lines.length && isTableRow(lines[nextIndex])) {
    tableLines.push(lines[nextIndex]);
    nextIndex++;
  }

  return { html: renderTable(tableLines), nextIndex };
}

function renderTaskListItem(content, checkedMarker) {
  const checked = /^x$/i.test(checkedMarker) ? " checked" : "";
  return `<li class="tb-task-list-item"><input type="checkbox" disabled${checked}> <span>${renderInlineMarkdown(content)}</span></li>`;
}

/**
 * Renders markdown text as HTML.
 * @param {string} text - Markdown text to render
 * @returns {string} - HTML string
 */
function renderMarkdownHtml(text) {
  const lines = escapeHtml(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const paragraphLines = [];
  const quoteLines = [];
  const listState = { type: "ul", items: [], hasTasks: false };
  let codeLines = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (/^```/.test(trimmedLine)) {
      if (codeLines) {
        blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
        codeLines = null;
      } else {
        flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    if (!trimmedLine) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      continue;
    }

    const table = collectTable(lines, index);
    if (table) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^&gt;\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (taskMatch || unorderedMatch || orderedMatch) {
      flushParagraph(blocks, paragraphLines);
      flushBlockquote(blocks, quoteLines);

      const nextType = orderedMatch ? "ol" : "ul";
      if (listState.items.length && listState.type !== nextType) {
        flushList(blocks, listState);
      }

      listState.type = nextType;
      if (taskMatch) {
        listState.hasTasks = true;
        listState.items.push(renderTaskListItem(taskMatch[2], taskMatch[1]));
      } else {
        listState.items.push(
          `<li>${renderInlineMarkdown((unorderedMatch || orderedMatch)[1])}</li>`
        );
      }
      continue;
    }

    flushList(blocks, listState);
    flushBlockquote(blocks, quoteLines);
    paragraphLines.push(line);
  }

  if (codeLines) {
    blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  }
  flushOpenBlocks(blocks, paragraphLines, listState, quoteLines);

  return blocks.join("");
}
window.escapeHtml = escapeHtml;
window.renderMarkdownHtml = renderMarkdownHtml;
