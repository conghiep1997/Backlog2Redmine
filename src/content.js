const TB = globalThis.TB_CONSTANTS;
if (!TB) {
  throw new Error("TB_CONSTANTS is not available.");
}

const BUTTON_CLASS = "tb-redmine-btn";
const PROCESSING_TEXT = TB.MESSAGES.PROCESSING;
const BUTTON_TEXT = TB.MESSAGES.BUTTON_TEXT;

// Icons8 Translate Icon - Inline SVG for best performance
const REDMINE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><path d="M 4 2 C 2.894531 2 2 2.894531 2 4 L 2 13 C 2 14.105469 2.894531 15 4 15 L 5 15 L 5 17 L 7 19 L 9 19 L 9 20 C 9 21.105469 9.894531 22 11 22 L 20 22 C 21.105469 22 22 21.105469 22 20 L 22 11 C 22 9.894531 21.105469 9 20 9 L 15 9 L 15 4 C 15 2.894531 14.105469 2 13 2 Z M 4 4 L 13 4 L 13 9 L 11 9 C 10.339844 9 9.769531 9.320313 9.40625 9.8125 C 9.246094 9.703125 9.109375 9.574219 8.96875 9.46875 C 9.601563 8.804688 10.234375 8 10.75 7 L 12 7 L 12 6 L 9 6 L 9 5 L 8 5 L 8 6 L 5 6 L 5 7 L 6.125 7 C 6.003906 7.136719 5.96875 7.328125 6.03125 7.5 C 6.03125 7.5 6.199219 8.007813 6.71875 8.6875 C 6.90625 8.933594 7.167969 9.207031 7.46875 9.5 C 6.324219 10.472656 5.34375 10.90625 5.34375 10.90625 C 5.085938 11.011719 4.957031 11.304688 5.0625 11.5625 C 5.167969 11.820313 5.460938 11.949219 5.71875 11.84375 C 5.71875 11.84375 6.914063 11.355469 8.25 10.1875 C 8.484375 10.367188 8.75 10.535156 9.03125 10.71875 C 9.019531 10.8125 9 10.902344 9 11 L 9 13 L 4 13 Z M 6.875 7 L 9.5625 7 C 9.136719 7.722656 8.671875 8.34375 8.1875 8.84375 C 7.902344 8.574219 7.667969 8.3125 7.5 8.09375 C 7.0625 7.523438 7 7.21875 7 7.21875 C 6.976563 7.136719 6.933594 7.0625 6.875 7 Z M 14.84375 12 L 16.15625 12 L 19 20 L 17.84375 20 L 17.09375 17.8125 L 13.84375 17.8125 L 13.125 20 L 12 20 Z M 15.4375 12.90625 C 15.3125 13.382813 14.15625 17 14.15625 17 L 16.8125 17 C 16.8125 17 15.59375 13.371094 15.46875 12.90625 Z M 7 15 L 9 15 L 9 17 L 7 17 Z"/></svg>`;

let modalHost = null;
let modalShadow = null;
let modalElements = null;
let commentObserver = null;

// Cleanup on page unload (prevent memory leaks)
window.addEventListener('beforeunload', () => {
  if (commentObserver) {
    commentObserver.disconnect();
    commentObserver = null;
  }
});

injectStyles();
scanAndInjectButtons();
observeCommentActions();

function observeCommentActions() {
  commentObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        const element = node;
        if (element.matches?.("div.comment-item__actions")) {
          injectButtonIfNeeded(element);
        } else {
          element.querySelectorAll?.("div.comment-item__actions").forEach(injectButtonIfNeeded);
        }
      }
    }
  });

  commentObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.comment-item__actions").forEach(injectButtonIfNeeded);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") {
    return;
  }

  if (actionsEl.querySelector(`.${BUTTON_CLASS}`)) {
    actionsEl.dataset.tbInjected = "1";
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.title = TB.MESSAGES.BUTTON_TITLE;
  button.setAttribute("aria-label", TB.MESSAGES.BUTTON_ARIA);
  button.innerHTML = `
    <span class="tb-redmine-btn__icon" aria-hidden="true">${REDMINE_ICON}</span>
    <span class="tb-redmine-btn__text">${BUTTON_TEXT}</span>
  `;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await handleTranslateAndOpenModal(actionsEl, button);
  });

  // Insert before the "Quote" button if possible
  const quoteBtn = actionsEl.querySelector("a.icon-comment");
  if (quoteBtn) {
    quoteBtn.before(button);
  } else {
    actionsEl.appendChild(button);
  }

  actionsEl.dataset.tbInjected = "1";
}

async function handleTranslateAndOpenModal(actionsEl, button) {
  const commentItem = actionsEl.closest(".comment-item") ?? actionsEl.parentElement;
  const { issueKey, issueSummary } = getBacklogHeaderInfo();
  
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  const allCommentItems = Array.from(document.querySelectorAll(".comment-item"));
  const clickedIndex = allCommentItems.findIndex(item => item === commentItem);
  
  if (clickedIndex === -1) {
    showToast(TB.MESSAGES.TOAST.NO_COMMENT_CONTENT, "error");
    return;
  }

  const commentsToProcess = allCommentItems.slice(clickedIndex);
  const clickedCommentContentEl = commentItem?.querySelector("div.comment-content");
  const clickedCommentText = extractBacklogContent(clickedCommentContentEl);
  const clickedCommentUrl = getCommentUrl(commentItem);
  
  if (!clickedCommentText) {
    showToast(TB.MESSAGES.TOAST.EMPTY_COMMENT, "error");
    return;
  }

  setButtonLoading(button, true);

  try {
    // CHỈ dịch comment được click trước để hiện popup ngay lập tức
    const result = await sendRuntimeMessage({
      type: "LOOKUP_AND_TRANSLATE_COMMENT",
      issueKey,
      issueSummary,
      commentText: clickedCommentText,
      commentUrl: clickedCommentUrl,
    });

    const remainingComments = commentsToProcess.slice(1).map(item => {
      const contentEl = item.querySelector("div.comment-content");
      return {
        text: extractBacklogContent(contentEl),
        url: getCommentUrl(item)
      };
    }).filter(c => c.text);

    openConfirmModal({
      redmineIssueId: result.redmineIssueId,
      issueTitle: result.issueTitle,
      previewText: result.previewText,
      remainingComments: remainingComments,
      hasBatchOption: remainingComments.length > 0,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ redmineIssueId, notesList }) => {
        // Gửi từng note lần lượt lên Redmine
        const results = [];
        for (const notes of notesList) {
          const sendResult = await sendRuntimeMessage({
            type: "SEND_TO_REDMINE",
            redmineIssueId,
            notes,
          });
          results.push(sendResult);
        }

        // Hiện modal thành công
        const lastResult = results[results.length - 1];
        openSuccessModal({
          redmineUrl: lastResult.redmineUrl,
          commentCount: results.length,
          onClose: () => setButtonLoading(button, false),
        });
      },
      // Helper để dịch các comment còn lại khi người dùng xác nhận
      translateBatch: async (comments) => {
        const batchPromises = comments.map(c => 
          sendRuntimeMessage({
            type: "LOOKUP_AND_TRANSLATE_COMMENT",
            issueKey,
            issueSummary,
            commentText: c.text,
            commentUrl: c.url,
          }).then(res => res.previewText)
        );
        return await Promise.all(batchPromises);
      }
    });

    // Sau khi mở modal thành công, reset trạng thái nút (ngầm định)
    setButtonLoading(button, false);
  } catch (error) {
    setButtonLoading(button, false);
    showToast(error instanceof Error ? error.message : String(error), "error");
  }
}

function getCommentUrl(commentItem) {
  let commentId = commentItem?.getAttribute("id");
  if (!commentId) return null;
  
  // Format lại ID: Backlog dùng comment-item-xxxx cho thẻ div nhưng link là #comment-xxxx
  if (commentId.startsWith("comment-item-")) {
    commentId = commentId.replace("comment-item-", "comment-");
  }
  
  if (!commentId.startsWith("comment-")) return null;
  return `${window.location.origin}${window.location.pathname}#${commentId}`;
}

function getBacklogHeaderInfo() {
  const issueKey = document.querySelector('[data-testid="issueKey"]')?.textContent?.trim() ?? "";
  const issueSummary =
    document.querySelector('[data-testid="issueSummary"]')?.textContent?.trim() ?? "";

  return {
    issueKey,
    issueSummary,
    title: [issueKey, issueSummary].filter(Boolean).join(" "),
  };
}

function openConfirmModal({ redmineIssueId = "", issueTitle = "", previewText = "", remainingComments = [], hasBatchOption = false, onCancel, onConfirm, translateBatch }) {
  ensureModalShell();

  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdInput,
    issueTitleInput,
    previewTextarea,
    closeButton,
    cancelButton,
    confirmButton,
    batchInfoEl,
    batchOptionEl,
    batchOptionCheckbox,
    batchOptionText,
  } = modalElements;

  let currentMode = false;
  let currentNotesList = [previewText];
  let memoizedBatchNotes = null; // Lưu trữ kết quả dịch batch để không cần dịch lại nếu check/uncheck

  function updateModalState() {
    if (currentMode && hasBatchOption) {
      // Chế độ Batch
      titleEl.textContent = `Dịch ${remainingComments.length + 1} bình luận → Redmine`;
      subtitleEl.textContent = `Từ vị trí click đến cuối trang`;
      
      if (memoizedBatchNotes) {
        const allComments = [previewText, ...memoizedBatchNotes];
        previewTextarea.value = allComments
          .map((text, index) => `--- Note ${index + 1} ---\n${text}`)
          .join('\n\n');
        currentNotesList = allComments;
      } else {
        // Nếu chuyển sang chế độ batch nhưng chưa dịch batch
        previewTextarea.value = `${previewText}\n\n[Đang chờ xác nhận để dịch thêm ${remainingComments.length} bình luận...]`;
      }
      
      if (batchInfoEl) {
        batchInfoEl.hidden = false;
        batchInfoEl.textContent = `📦 Sẽ gửi tổng cộng ${remainingComments.length + 1} notes`;
      }
      
      confirmButton.textContent = `Dịch & Gửi ${remainingComments.length + 1} notes`;
    } else {
      // Chế độ Single
      titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
      subtitleEl.textContent = TB.MESSAGES.MODAL.SUBTITLE;
      previewTextarea.value = previewText;
      currentNotesList = [previewText];
      
      if (batchInfoEl) {
        batchInfoEl.hidden = true;
      }
      
      confirmButton.textContent = TB.MESSAGES.MODAL.CONFIRM;
    }
  }

  // Cấu hình checkbox batch
  if (batchOptionEl && batchOptionCheckbox && batchOptionText) {
    if (hasBatchOption) {
      batchOptionEl.hidden = false;
      batchOptionText.textContent = `Dịch đến comment cuối trang (${remainingComments.length + 1} bình luận)`;
      batchOptionCheckbox.checked = false;
      
      batchOptionCheckbox.onchange = async (event) => {
        currentMode = event.target.checked;
        
        if (currentMode && !memoizedBatchNotes) {
          // Bắt đầu dịch ngay khi người dùng tích chọn
          updateModalState();
          try {
            // Disable nút xác nhận tạm thời để tránh bấm gửi khi chưa dịch xong
            confirmButton.disabled = true;
            memoizedBatchNotes = await translateBatch(remainingComments);
            confirmButton.disabled = false;
            updateModalState();
          } catch (error) {
            confirmButton.disabled = false;
            showToast("Lỗi khi dịch hàng loạt: " + error.message, "error");
            batchOptionCheckbox.checked = false;
            currentMode = false;
            updateModalState();
          }
        } else {
          updateModalState();
        }
      };
    } else {
      batchOptionEl.hidden = true;
    }
  }

  issueIdInput.value = redmineIssueId;
  issueTitleInput.value = issueTitle;
  confirmButton.disabled = false;

  const safeClose = () => {
    closeConfirmModal();
    onCancel?.();
  };

  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;
  overlay.onclick = (event) => {
    if (event.target === overlay) {
      safeClose();
    }
  };

  confirmButton.onclick = async () => {
    const redmineIssueIdValue = issueIdInput.value.trim();
    if (!redmineIssueIdValue) {
      showToast(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID, "error");
      return;
    }

    confirmButton.disabled = true;
    
    try {
      if (currentMode && hasBatchOption && !memoizedBatchNotes) {
        // Thực hiện dịch batch "Lazy" ngay lúc bấm xác nhận
        confirmButton.textContent = `Đang dịch ${remainingComments.length} comments...`;
        memoizedBatchNotes = await translateBatch(remainingComments);
        currentNotesList = [previewText, ...memoizedBatchNotes];
      }

      const count = currentNotesList.length;
      confirmButton.textContent = count > 1 ? `Đang gửi ${count} notes...` : TB.MESSAGES.MODAL.SENDING;
      
      await onConfirm({ redmineIssueId: redmineIssueIdValue, notesList: currentNotesList });
      closeConfirmModal();
    } catch (error) {
      confirmButton.disabled = false;
      updateModalState();
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  };

  updateModalState();
  overlay.hidden = false;
  document.body.classList.add("tb-modal-open");
}

function openSuccessModal({ redmineUrl, commentCount = 1, onClose }) {
  ensureModalShell();

  const {
    overlay,
    successTitleEl,
    successSubtitleEl,
    successLinkEl,
    successViewButton,
    successCloseButton,
  } = modalElements;

  successTitleEl.textContent = commentCount > 1 
    ? `✅ Đã gửi ${commentCount} notes thành công!` 
    : TB.MESSAGES.MODAL.SUCCESS_TITLE;
  successSubtitleEl.textContent = commentCount > 1
    ? `Tất cả bình luận đã được dịch và gửi lên Redmine`
    : TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
  successLinkEl.textContent = redmineUrl;
  successLinkEl.href = redmineUrl;
  successViewButton.textContent = TB.MESSAGES.MODAL.SUCCESS_VIEW_BUTTON;
  successViewButton.onclick = () => {
    window.open(redmineUrl, '_blank');
  };
  successCloseButton.textContent = TB.MESSAGES.MODAL.SUCCESS_CLOSE_BUTTON;
  successCloseButton.onclick = () => {
    closeSuccessModal();
    onClose?.();
  };

  overlay.hidden = false;
  document.body.classList.add("tb-modal-open");
}

function closeSuccessModal() {
  if (modalElements?.overlay) {
    modalElements.overlay.hidden = true;
  }
  document.body.classList.remove("tb-modal-open");
}

function closeConfirmModal() {
  if (modalElements?.overlay) {
    modalElements.overlay.hidden = true;
  }
  document.body.classList.remove("tb-modal-open");
}

/**
 * Trích xuất nội dung từ HTML của Backlog comment, chuyển đổi HTML tags sang Markdown.
 * Hỗ trợ: bold, italic, code, lists, tables, links, headings, blockquotes, strike-through.
 */
function extractBacklogContent(element) {
  if (!element) return "";
  
  let result = "";
  let listStack = []; // Stack để track nested lists
  let tableRows = [];
  let isInsideTable = false;
  
  function walk(node, options = {}) {
    const {
      isInsideBlockquote = false,
      isInsidePre = false,
      listMarker = null,
      headingLevel = 0,
    } = options;
    
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      // Nếu đang trong pre/code block, giữ nguyên whitespace
      if (!isInsidePre) {
        // Replace multiple spaces with single space (nhưng giữ newlines)
        text = text.replace(/([^\n])\s+/g, '$1 ').replace(/^\s+/, ' ');
      }
      if (isInsideBlockquote && result.endsWith("> ")) {
        text = text.trimStart();
      }
      result += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      
      // === INLINE FORMATTING ===
      
      // Bold: <strong>, <b>
      if (tag === "strong" || tag === "b") {
        result += "**";
        for (const child of node.childNodes) walk(child, options);
        result += "**";
        return;
      }
      
      // Italic: <em>, <i>
      if (tag === "em" || tag === "i") {
        result += "*";
        for (const child of node.childNodes) walk(child, options);
        result += "*";
        return;
      }
      
      // Strike-through: <del>, <s>, <strike>
      if (tag === "del" || tag === "s" || tag === "strike") {
        result += "~~";
        for (const child of node.childNodes) walk(child, options);
        result += "~~";
        return;
      }
      
      // Inline code: <code> (khi không nằm trong <pre>)
      if (tag === "code" && !isInsidePre) {
        result += "`";
        for (const child of node.childNodes) walk(child, { ...options, isInsidePre: false });
        result += "`";
        return;
      }
      
      // Links: <a>
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const textBefore = result;
        for (const child of node.childNodes) walk(child, options);
        const linkText = result.slice(textBefore.length);
        // Chỉ tạo link nếu có href và text
        if (href && linkText.trim()) {
          // Nếu là link mention người dùng trong Backlog (/user/*), chỉ lấy phần text
          if (href.startsWith("/user/") || href.startsWith("https://") && href.includes(".backlog.com/user/")) {
            result = textBefore + linkText.trim();
          } else {
            // Xóa text vừa add, thay bằng markdown link
            result = textBefore + `[${linkText.trim()}](${href})`;
          }
        }
        return;
      }
      
      // === BLOCK ELEMENTS ===
      
      // Code blocks: <pre>, <pre><code>
      if (tag === "pre") {
        // Tìm code element bên trong
        const codeEl = node.querySelector("code");
        let codeContent = "";
        let language = "";
        
        if (codeEl) {
          // Extract language từ class (e.g., "language-javascript")
          const langClass = Array.from(codeEl.classList).find(c => c.startsWith("language-"));
          if (langClass) language = langClass.replace("language-", "");
          codeContent = codeEl.textContent;
        } else {
          codeContent = node.textContent;
        }
        
        // Thêm newline trước code block
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        result += "```" + language + "\n";
        result += codeContent.trim();
        result += "\n```\n";
        return;
      }
      
      // Headings: <h1> - <h6>
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        const level = parseInt(tag[1]);
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        result += "#".repeat(level) + " ";
        for (const child of node.childNodes) walk(child, options);
        result += "\n\n";
        return;
      }
      
      // Images: <img>
      if (tag === "img") {
        // Check nếu là Backlog attachment image
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        
        if (node.classList.contains("loom-internal-image") || src.includes("ViewAttachmentImage")) {
          const match = src.match(/attachmentId=(\d+)/);
          if (match) {
            result += ` [[TB_IMG:${match[1]}]] `;
          }
        } else {
          // External image
          result += `![${alt}](${src}) `;
        }
        return;
      }
      
      // Blockquotes: <blockquote>
      if (tag === "blockquote") {
        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
        
        // Process từng child, thêm "> " vào đầu mỗi line
        const quoteStart = result.length;
        for (const child of node.childNodes) {
          walk(child, { ...options, isInsideBlockquote: true });
        }
        // Ensure mỗi line trong blockquote có "> "
        const quoteText = result.slice(quoteStart);
        result = result.slice(0, quoteStart) + 
          quoteText.trimEnd().split("\n").map(line => "> " + line.trimStart()).join("\n");
        
        result += "\n\n";
        return;
      }
      
      // Lists: <ul>, <ol>
      if (tag === "ul" || tag === "ol") {
        const newMarker = tag === "ul" ? "*" : "1.";
        listStack.push({ type: tag, marker: newMarker, counter: 0 });
        for (const child of node.childNodes) walk(child, options);
        listStack.pop();
        if (!result.endsWith("\n")) result += "\n";
        return;
      }
      
      // List items: <li>
      if (tag === "li") {
        // Tính indentation dựa trên depth của list stack
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
      
      // Tables: <table>
      if (tag === "table") {
        isInsideTable = true;
        tableRows = [];
        for (const child of node.childNodes) walk(child, options);
        isInsideTable = false;
        
        // Convert table rows to Markdown
        if (tableRows.length > 0) {
          if (result.length > 0 && !result.endsWith("\n")) result += "\n";
          
          // Build markdown table
          const maxCols = Math.max(...tableRows.map(r => r.length));
          
          // Header row
          const headerRow = tableRows[0] || [];
          while (headerRow.length < maxCols) headerRow.push("");
          result += "| " + headerRow.join(" | ") + " |\n";
          
          // Separator row
          result += "|" + " --- |".repeat(maxCols) + "\n";
          
          // Data rows
          for (let i = 1; i < tableRows.length; i++) {
            const row = tableRows[i];
            while (row.length < maxCols) row.push("");
            result += "| " + row.join(" | ") + " |\n";
          }
          result += "\n";
        }
        return;
      }
      
      // Table rows: <tr>
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
      
      // Paragraphs và divs: <p>, <div>
      if (["p", "div"].includes(tag)) {
        const textBefore = result;
        for (const child of node.childNodes) walk(child, options);
        const textAfter = result.slice(textBefore.length);
        
        // Chỉ thêm newline nếu có nội dung thực sự
        if (textAfter.trim() && !result.endsWith("\n")) {
          result += "\n";
        }
        return;
      }
      
      // Line breaks: <br>
      if (tag === "br") {
        result += "\n";
        return;
      }
      
      // Horizontal rules: <hr>
      if (tag === "hr") {
        if (!result.endsWith("\n")) result += "\n";
        result += "---\n\n";
        return;
      }
      
      // Default: process children
      for (const child of node.childNodes) walk(child, options);
    }
  }
  
  walk(element);
  
  // Cleanup: Dọn dẹp khoảng trắng và formatting dư thừa
  let cleaned = result
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")  // Max 2 consecutive newlines
    .replace(/\*\*\*\*/g, "**")   // Fix nested bold
    .replace(/\*\*\*/g, "***")    // Fix bold+italic
    .replace(/``+/g, "`")         // Fix multiple backticks
    .trim();
  
  // Fix blockquote formatting: "> \n" → ">\n"
  cleaned = cleaned.replace(/> \n/g, ">\n");
  
  return cleaned;
}

function ensureModalShell() {
  if (modalHost && modalShadow && modalElements) {
    return;
  }

  modalHost = document.createElement("div");
  modalHost.id = "tb-modal-host";
  modalShadow = modalHost.attachShadow({ mode: "open" });

  modalShadow.innerHTML = `
    <style>${modalStyles()}</style>
    <div class="tb-modal-overlay" hidden>
      <div class="tb-modal" role="dialog" aria-modal="true">
        <div class="tb-modal__header">
          <div>
            <div class="tb-modal__title">${TB.MESSAGES.MODAL.TITLE}</div>
            <div class="tb-modal__subtitle">${TB.MESSAGES.MODAL.SUBTITLE}</div>
          </div>
          <button type="button" class="tb-modal__close" aria-label="${TB.MESSAGES.MODAL.CLOSE_ARIA}">×</button>
        </div>
        <label class="tb-field">
          <span class="tb-field__label">${TB.MESSAGES.MODAL.ISSUE_ID_LABEL}</span>
          <input class="tb-input" type="text" />
        </label>
        <label class="tb-field">
          <span class="tb-field__label">${TB.MESSAGES.MODAL.ISSUE_TITLE_LABEL}</span>
          <textarea class="tb-input tb-input--readonly" readonly rows="2"></textarea>
        </label>
        <div class="tb-field">
          <span class="tb-field__label">${TB.MESSAGES.MODAL.PREVIEW_LABEL}</span>
          <textarea class="tb-textarea" rows="16"></textarea>
        </div>
        <div class="tb-modal__batch-info" hidden></div>
        <div class="tb-modal__batch-option" hidden>
          <label class="tb-modal__batch-option-label">
            <input type="checkbox" class="tb-modal__batch-option-checkbox" />
            <span class="tb-modal__batch-option-text"></span>
          </label>
        </div>
        <div class="tb-modal__hint">${TB.MESSAGES.MODAL.HINT}</div>
        <div class="tb-modal__actions">
          <button type="button" class="tb-btn tb-btn--ghost">${TB.MESSAGES.MODAL.CANCEL}</button>
          <button type="button" class="tb-btn tb-btn--primary">${TB.MESSAGES.MODAL.CONFIRM}</button>
        </div>
      </div>
      
      <!-- Success Modal -->
      <div class="tb-modal-success" hidden>
        <div class="tb-modal tb-modal--success">
          <div class="tb-modal__header">
            <div>
              <div class="tb-modal__title tb-modal__title--success"></div>
              <div class="tb-modal__subtitle"></div>
            </div>
          </div>
          <div class="tb-success-content">
            <div class="tb-success-icon">✅</div>
            <p class="tb-success-message">Bình luận đã được gửi thành công!</p>
            <a class="tb-success-link" href="#" target="_blank" rel="noopener noreferrer"></a>
          </div>
          <div class="tb-modal__actions tb-modal__actions--center">
            <button type="button" class="tb-btn tb-btn--primary tb-btn--open">${TB.MESSAGES.MODAL.SUCCESS_VIEW_BUTTON}</button>
            <button type="button" class="tb-btn tb-btn--ghost">${TB.MESSAGES.MODAL.SUCCESS_CLOSE_BUTTON}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalHost);

  const overlay = modalShadow.querySelector(".tb-modal-overlay");
  const titleEl = modalShadow.querySelector(".tb-modal__title");
  const subtitleEl = modalShadow.querySelector(".tb-modal__subtitle");
  const closeButton = modalShadow.querySelector(".tb-modal__close");
  const cancelButton = modalShadow.querySelector(".tb-btn--ghost");
  const confirmButton = modalShadow.querySelector(".tb-btn--primary");
  const issueIdInput = modalShadow.querySelector(".tb-input:not(.tb-input--readonly)");
  const issueTitleInput = modalShadow.querySelector(".tb-input.tb-input--readonly");
  const previewTextarea = modalShadow.querySelector(".tb-textarea");
  const batchInfoEl = modalShadow.querySelector(".tb-modal__batch-info");
  const batchOptionEl = modalShadow.querySelector(".tb-modal__batch-option");
  const batchOptionCheckbox = modalShadow.querySelector(".tb-modal__batch-option-checkbox");
  const batchOptionText = modalShadow.querySelector(".tb-modal__batch-option-text");
  
  // Success modal elements
  const successModal = modalShadow.querySelector(".tb-modal-success");
  const successTitleEl = modalShadow.querySelector(".tb-modal__title--success");
  const successSubtitleEl = successModal?.querySelector(".tb-modal__subtitle");
  const successLinkEl = successModal?.querySelector(".tb-success-link");
  const successViewButton = successModal?.querySelector(".tb-btn--open");
  const successCloseButton = successModal?.querySelector(".tb-btn--ghost:last-of-type");

  modalElements = {
    overlay,
    titleEl,
    subtitleEl,
    closeButton,
    cancelButton,
    confirmButton,
    issueIdInput,
    issueTitleInput,
    previewTextarea,
    batchInfoEl,
    batchOptionEl,
    batchOptionCheckbox,
    batchOptionText,
    successModal,
    successTitleEl,
    successSubtitleEl,
    successLinkEl,
    successViewButton,
    successCloseButton,
  };
}

function setButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.dataset.originalHtml ??= button.innerHTML;
  button.innerHTML = isLoading
    ? `<span class="tb-redmine-btn__spinner" aria-hidden="true"></span><span>${PROCESSING_TEXT}</span>`
    : button.dataset.originalHtml;
}

function showToast(message, type = "info") {
  ensureToastShell();
  const toast = modalElements.toast;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("tb-toast--visible"));

  window.clearTimeout(toast._tbTimer);
  toast._tbTimer = window.setTimeout(() => {
    toast.classList.remove("tb-toast--visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 3000);
}

function ensureToastShell() {
  if (modalElements?.toast) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "tb-toast";
  toast.hidden = true;
  document.body.appendChild(toast);

  modalElements = modalElements ?? {};
  modalElements.toast = toast;
}

function injectStyles() {
  if (document.getElementById("tb-injected-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "tb-injected-styles";
  style.textContent = `
    .${BUTTON_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 20px;
      padding: 0 11px;
      height: 32px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: linear-gradient(180deg, #ffffff, #E0FFFF);
      color: #223047;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
      overflow: hidden;
      transition: all 120ms ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .${BUTTON_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(25, 31, 51, 0.12);
      background: linear-gradient(180deg, #f8f9fa, #e8ebf0);
    }

    .${BUTTON_CLASS}:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .${BUTTON_CLASS}:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .tb-redmine-btn__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .tb-redmine-btn__icon svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .tb-redmine-btn__text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tb-redmine-btn__spinner {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(34, 48, 71, 0.2);
      border-top-color: #d73527;
      animation: tb-spin 0.8s linear infinite;
    }

    @keyframes tb-spin {
      to { transform: rotate(360deg); }
    }

    body.tb-modal-open {
      overflow: hidden !important;
    }

    .tb-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-16px);
      z-index: 2147483647;
      max-width: min(480px, calc(100vw - 40px));
      padding: 14px 18px;
      border-radius: 12px;
      color: #fff;
      background: rgba(17, 24, 39, 0.96);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: opacity 200ms ease, transform 200ms ease;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
    }

    .tb-toast[data-type="success"] { background: rgba(16, 185, 129, 0.95); }
    .tb-toast[data-type="error"] { background: rgba(220, 38, 38, 0.95); }
    .tb-toast--visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;

  document.head.appendChild(style);
}

function modalStyles() {
  return `
    :host {
      all: initial;
    }
    .tb-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(17, 24, 39, 0.58);
      backdrop-filter: blur(4px);
      padding: 20px;
    }
    [hidden] {
      display: none !important;
    }
    .tb-modal-overlay[hidden] {
      display: none !important;
    }
    .tb-modal {
      width: min(900px, 100%);
      max-height: min(88vh, 920px);
      overflow: auto;
      background: #fff;
      color: #111827;
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.24);
    }
    .tb-modal__header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .tb-modal__title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
    }
    .tb-modal__subtitle,
    .tb-modal__hint {
      color: #6b7280;
      font-size: 13px;
      line-height: 1.5;
    }
    .tb-modal__batch-info {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tb-modal__batch-option {
      margin: 14px 0;
      padding: 12px 14px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .tb-modal__batch-option-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-size: 13px;
      color: #374151;
      user-select: none;
    }
    .tb-modal__batch-option-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #d73527;
    }
    .tb-modal__batch-option-text {
      font-weight: 500;
      line-height: 1.4;
    }
    .tb-modal__close {
      width: 32px;
      height: 32px;
      border: 0;
      background: #f3f4f6;
      border-radius: 10px;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
      color: #374151;
    }
    .tb-field {
      display: block;
      margin-bottom: 14px;
    }
    .tb-field__label {
      display: inline-block;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 13px;
      color: #374151;
    }
    .tb-input,
    .tb-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
      color: inherit;
      background: #fff;
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .tb-input:focus,
    .tb-textarea:focus {
      border-color: #d73527;
      box-shadow: 0 0 0 4px rgba(215, 53, 39, 0.12);
    }
    .tb-input--readonly {
      background: #f3f4f6;
      color: #6b7280;
      cursor: not-allowed;
      line-height: 1.5;
      min-height: 48px;
      height: auto;
      white-space: pre-wrap;
      overflow-y: auto;
      resize: none;
    }
    .tb-textarea {
      min-height: 340px;
      resize: vertical;
      font-family: inherit;
      white-space: pre-wrap;
    }
    .tb-modal__actions {
      display: flex;
      justify-content: end;
      gap: 10px;
      margin-top: 18px;
    }
    .tb-btn {
      border: 0;
      border-radius: 10px;
      padding: 11px 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .tb-btn--ghost {
      background: #eef2f7;
      color: #334155;
    }
    .tb-btn--primary {
      background: linear-gradient(180deg, #dc4c3f, #c93b2f);
      color: white;
      box-shadow: 0 8px 18px rgba(201, 59, 47, 0.28);
    }
    
    /* Success Modal Styles */
    .tb-modal-success {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(17, 24, 39, 0.58);
      backdrop-filter: blur(4px);
      padding: 20px;
    }
    .tb-modal-success[hidden] {
      display: none !important;
    }
    .tb-modal--success {
      text-align: center;
    }
    .tb-modal__title--success {
      color: #10b981;
      font-size: 24px;
    }
    .tb-success-content {
      padding: 24px 0;
    }
    .tb-success-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .tb-success-message {
      font-size: 16px;
      color: #374151;
      margin-bottom: 20px;
    }
    .tb-success-link {
      display: inline-block;
      color: #d73527;
      font-weight: 600;
      text-decoration: none;
      padding: 8px 16px;
      background: #fef2f2;
      border-radius: 8px;
      margin-bottom: 20px;
      word-break: break-all;
    }
    .tb-success-link:hover {
      background: #fee2e2;
      text-decoration: underline;
    }
    .tb-modal__actions--center {
      justify-content: center;
    }
  `;
}

function redmineIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c2.7 0 5.1 1.1 6.9 2.9 1.8 1.8 2.9 4.2 2.9 6.9 0 2.7-1.1 5.1-2.9 6.9-1.8 1.8-4.2 2.9-6.9 2.9-2.7 0-5.1-1.1-6.9-2.9A9.72 9.72 0 0 1 2.2 12c0-2.7 1.1-5.1 2.9-6.9A9.72 9.72 0 0 1 12 2.5Zm0 3.2c-1.8 0-3.4.7-4.6 1.9C6.1 8.8 5.4 10.4 5.4 12s.7 3.2 2 4.5c1.2 1.2 2.8 1.9 4.6 1.9s3.4-.7 4.6-1.9c1.2-1.2 1.9-2.8 1.9-4.5s-.7-3.4-1.9-4.6A6.42 6.42 0 0 0 12 5.7Z"/>
      <path d="M11.2 8.1h1.7l1.1 2.5 2.8.3.3 1.7-2.1 1.8.6 2.8-1.5.9-2.2-1.4-2.2 1.4-1.5-.9.6-2.8-2.1-1.8.3-1.7 2.8-.3 1.1-2.5Zm.8 2.1-.6 1.4-1.5.1 1.1 1-.4 1.5 1.4-.8 1.4.8-.4-1.5 1.1-1-1.5-.1-.6-1.4Z"/>
    </svg>
  `;
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Co loi khong xac dinh."));
        return;
      }
      resolve(response);
    });
  });
}
