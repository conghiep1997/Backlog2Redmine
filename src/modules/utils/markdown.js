/**
 * Markdown conversion utility for Backlog2Redmine Extension.
 * Converts Backlog's HTML-rendered content into clean Markdown/Textile for Redmine.
 */

function extractBacklogContent(element) {
  if (!element) return "";
  
  let result = "";
  let listStack = []; // Stack to track nested lists
  let tableRows = [];
  let isInsideTable = false;
  
  function walk(node, options = {}) {
    const {
      isInsideBlockquote = false,
      isInsidePre = false,
    } = options;
    
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      if (!isInsidePre) {
        text = text.replace(/([^\n])\s+/g, '$1 ').replace(/^\s+/, ' ');
      }
      if (isInsideBlockquote && result.endsWith("> ")) {
        text = text.trimStart();
      }
      result += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      
      // Inline formatting
      if (tag === "strong" || tag === "b") {
        result += "**";
        for (const child of node.childNodes) walk(child, options);
        result += "**";
        return;
      }
      
      if (tag === "em" || tag === "i") {
        result += "*";
        for (const child of node.childNodes) walk(child, options);
        result += "*";
        return;
      }
      
      if (tag === "del" || tag === "s" || tag === "strike") {
        result += "~~";
        for (const child of node.childNodes) walk(child, options);
        result += "~~";
        return;
      }
      
      if (tag === "code" && !isInsidePre) {
        result += "`";
        for (const child of node.childNodes) walk(child, { ...options, isInsidePre: false });
        result += "`";
        return;
      }
      
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const textBefore = result;
        for (const child of node.childNodes) walk(child, options);
        const linkText = result.slice(textBefore.length);
        if (href && linkText.trim()) {
          if (href.startsWith("/user/") || (href.startsWith("https://") && href.includes(".backlog.com/user/"))) {
            result = textBefore + linkText.trim();
          } else {
            result = textBefore + `[${linkText.trim()}](${href})`;
          }
        }
        return;
      }
      
      // Block elements
      if (tag === "pre") {
        const codeEl = node.querySelector("code");
        let codeContent = "";
        let language = "";
        
        if (codeEl) {
          const langClass = Array.from(codeEl.classList).find(c => c.startsWith("language-"));
          if (langClass) language = langClass.replace("language-", "");
          codeContent = codeEl.textContent;
        } else {
          codeContent = node.textContent;
        }
        
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        result += "```" + language + "\n";
        result += codeContent.trim();
        result += "\n```\n";
        return;
      }
      
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        const level = parseInt(tag[1]);
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        result += "#".repeat(level) + " ";
        for (const child of node.childNodes) walk(child, options);
        result += "\n\n";
        return;
      }
      
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
      
      if (tag === "blockquote") {
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        const quoteStart = result.length;
        for (const child of node.childNodes) {
          walk(child, { ...options, isInsideBlockquote: true });
        }
        const quoteText = result.slice(quoteStart);
        result = result.slice(0, quoteStart) + 
          quoteText.trimEnd().split("\n").map(line => "> " + line.trimStart()).join("\n");
        result += "\n\n";
        return;
      }
      
      if (tag === "ul" || tag === "ol") {
        const newMarker = tag === "ul" ? "*" : "1.";
        listStack.push({ type: tag, marker: newMarker, counter: 0 });
        for (const child of node.childNodes) walk(child, options);
        listStack.pop();
        if (!result.endsWith("\n")) result += "\n";
        return;
      }
      
      if (tag === "li") {
        const indent = "  ".repeat(Math.max(0, listStack.length - 1));
        const listInfo = listStack[listStack.length - 1];
        if (!result.endsWith("\n")) result += "\n";
        if (listInfo?.type === "ol") {
          listInfo.counter++;
          result += `${indent}${listInfo.counter}. `;
        } else {
          result += `${indent}* `;
        }
        for (const child of node.childNodes) walk(child, options);
        return;
      }
      
      if (tag === "table") {
        isInsideTable = true;
        tableRows = [];
        for (const child of node.childNodes) walk(child, options);
        isInsideTable = false;
        
        if (tableRows.length > 0) {
          if (result.length > 0 && !result.endsWith("\n")) result += "\n";
          const maxCols = Math.max(...tableRows.map(r => r.length));
          const headerRow = tableRows[0] || [];
          while (headerRow.length < maxCols) headerRow.push("");
          result += "| " + headerRow.join(" | ") + " |\n";
          result += "|" + " --- |".repeat(maxCols) + "\n";
          for (let i = 1; i < tableRows.length; i++) {
            const row = tableRows[i];
            while (row.length < maxCols) row.push("");
            result += "| " + row.join(" | ") + " |\n";
          }
          result += "\n";
        }
        return;
      }
      
      if (tag === "tr") {
        const currentRow = [];
        for (const child of node.childNodes) {
          if (child.nodeType === Node.ELEMENT_NODE && 
              ["td", "th"].includes(child.tagName.toLowerCase())) {
            const cellText = child.textContent.trim().replace(/\n/g, " ");
            currentRow.push(cellText);
          }
        }
        if (currentRow.length > 0) {
          tableRows.push(currentRow);
        }
        return;
      }
      
      if (["p", "div"].includes(tag)) {
        const textBefore = result;
        for (const child of node.childNodes) walk(child, options);
        const textAfter = result.slice(textBefore.length);
        if (textAfter.trim() && !result.endsWith("\n")) {
          result += "\n";
        }
        return;
      }
      
      if (tag === "br") {
        result += "\n";
        return;
      }
      
      if (tag === "hr") {
        if (!result.endsWith("\n")) result += "\n";
        result += "---\n\n";
        return;
      }
      
      for (const child of node.childNodes) walk(child, options);
    }
  }
  
  walk(element);
  
  return result
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*\*\*/g, "**")
    .replace(/``+/g, "`")
    .trim();
}
