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
  return str
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

/**
 * Renders markdown text as HTML.
 * @param {string} text - Markdown text to render
 * @returns {string} - HTML string
 */
function renderMarkdownHtml(text) {
  let html = escapeHtml(text);

  // Convert blockquotes first (before line breaks)
  html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");

  // Convert other markdown
  html = html
    .replace(/(<li>.*<\/li>)(\s*<li>.*<\/li>)*/g, "<ul>$&</ul>")
    .replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes, content) => {
      const level = hashes.length;
      return `<h${level}>${content}</h${level}>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`{3}(\w*)\n?([\s\S]*?)`{3}/g, "<pre>$2</pre>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      if (!isSafeMarkdownHref(href)) {
        return label;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/\n/g, "<br>");

  return html;
}
window.escapeHtml = escapeHtml;
window.renderMarkdownHtml = renderMarkdownHtml;
