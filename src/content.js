/**
 * Content Script Entry Point for Backlog2Redmine Extension.
 * Handles DOM injection, observers, and main event coordination.
 */

// Markdown conversion function is loaded from modules/utils/markdown.js via manifest.json
// extractBacklogContent() is available globally after markdown.js loads

const BUTTON_CLASS = "tb-redmine-btn";
const REDMINE_ICON =
  TB?.ICONS?.REDMINE ||
  "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24px\" height=\"24px\"><path d=\"M 4 2 C 2.894531 2 2 2.894531 2 4 L 2 13 C 2 14.105469 2.894531 15 4 15 L 5 15 L 5 17 L 7 19 L 9 19 L 9 20 C 9 21.105469 9.894531 22 11 22 L 20 22 C 21.105469 22 22 21.105469 22 20 L 22 11 C 22 9.894531 21.105469 9 20 9 L 15 9 L 15 4 C 15 2.894531 14.105469 2 13 2 Z M 4 4 L 13 4 L 13 9 L 11 9 C 10.339844 9 9.769531 9.320313 9.40625 9.8125 C 9.246094 9.703125 9.109375 9.574219 8.96875 9.46875 C 9.601563 8.804688 10.234375 8 10.75 7 L 12 7 L 12 6 L 9 6 L 9 5 L 8 5 L 8 6 L 5 6 L 5 7 L 6.125 7 C 6.003906 7.136719 5.96875 7.328125 6.03125 7.5 C 6.03125 7.5 6.199219 8.007813 6.71875 8.6875 C 6.90625 8.933594 7.167969 9.207031 7.46875 9.5 C 6.324219 10.472656 5.34375 10.90625 5.34375 10.90625 C 5.085938 11.011719 4.957031 11.304688 5.0625 11.5625 C 5.167969 11.820313 5.460938 11.949219 5.71875 11.84375 C 5.71875 11.84375 6.914063 11.355469 8.25 10.1875 C 8.484375 10.367188 8.75 10.535156 9.03125 10.71875 C 9.019531 10.8125 9 10.902344 9 11 L 9 13 L 4 13 Z M 6.875 7 L 9.5625 7 C 9.136719 7.722656 8.671875 8.34375 8.1875 8.84375 C 7.902344 8.574219 7.667969 8.3125 7.5 8.09375 C 7.0625 7.523438 7 7.21875 7 7.21875 C 6.976563 7.136719 6.933594 7.0625 6.875 7 Z M 14.84375 12 L 16.15625 12 L 19 20 L 17.84375 20 L 17.09375 17.8125 L 13.84375 17.8125 L 13.125 20 L 12 20 Z M 15.4375 12.90625 C 15.3125 13.382813 14.15625 17 14.15625 17 L 16.8125 17 C 16.8125 17 15.59375 13.371094 15.46875 12.90625 Z M 7 15 L 9 15 L 9 17 L 7 17 Z\"/></svg>";

let commentObserver = null;

// Initialization with error handling
try {
  injectStyles();
  scanAndInjectButtons();
  observeCommentActions();
} catch (err) {
  console.error("[TB-Content] Initialization failed:", err);
}

function observeCommentActions() {
  commentObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check for comments
          if (node.matches?.("div.comment-item__actions")) {
            injectButtonIfNeeded(node);
          } else {
            node.querySelectorAll?.("div.comment-item__actions").forEach(injectButtonIfNeeded);
          }

          // Check for header (newly added)
          if (node.matches?.(".title-group__edit-actions")) {
            injectHeaderButton();
          } else if (node.querySelector?.(".title-group__edit-actions")) {
            injectHeaderButton();
          }
        }
      }
    }
  });
  commentObserver.observe(document.body, { childList: true, subtree: true });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.comment-item__actions").forEach(injectButtonIfNeeded);
  injectHeaderButton();
}

/**
 * Creates a modern, high-end button with the 'Cyan-Flow' theme.
 */
function createModernButton(text, onClick, options = {}) {
  const { height = "32px", fontSize = "12px", margin = "0" } = options;

  const button = document.createElement("button");
  button.className = "tb-modern-btn";

  // Outer shell (Gradient border)
  Object.assign(button.style, {
    margin: margin,
    padding: "2px",
    height: height,
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.15)",
    overflow: "hidden",
  });

  // Inner wrapper (Glassy background)
  const innerWrap = document.createElement("div");
  Object.assign(innerWrap.style, {
    backgroundColor: "#ffffff",
    height: "100%",
    width: "100%",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    transition: "background-color 0.3s ease",
  });

  innerWrap.innerHTML = `
    <span style="display:flex; align-items:center;">${REDMINE_ICON}</span>
    <span class="tb-btn-text" style="margin-left:8px; font-weight:700; color:#1d4ed8; white-space:nowrap; font-size:${fontSize}; letter-spacing:0.2px;">${text}</span>
  `;

  button.appendChild(innerWrap);
  const textSpan = innerWrap.querySelector(".tb-btn-text");

  button.onmouseover = () => {
    button.style.transform = "translateY(-1px)";
    button.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
    innerWrap.style.backgroundColor = "transparent";
    textSpan.style.color = "#ffffff";
  };

  button.onmouseout = () => {
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 2px 6px rgba(59, 130, 246, 0.15)";
    innerWrap.style.backgroundColor = "#ffffff";
    textSpan.style.color = "#1d4ed8";
  };

  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(button);
  };

  return button;
}

function injectHeaderButton() {
  const container = document.querySelector(".title-group__edit-actions");
  if (!container || container.querySelector(".tb-header-migrate-btn")) {
    return;
  }

  const button = createModernButton(
    TB.MESSAGES.MIGRATE_BUTTON_TEXT,
    (btn) => handleIssueMigration(btn),
    { margin: "0 0 0 20px", height: "30px", fontSize: "12.5px" }
  );
  button.classList.add("tb-header-migrate-btn");

  container.appendChild(button);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") {
    return;
  }

  const button = createModernButton(
    TB.MESSAGES.BUTTON_TEXT,
    (btn) => handleTranslateAndOpenModal(actionsEl, btn),
    { margin: "0 0 0 12px", height: "30px", fontSize: "12.5px" }
  );
  button.classList.add(BUTTON_CLASS);

  const quoteBtn = actionsEl.querySelector("a.icon-comment");
  if (quoteBtn) {
    quoteBtn.before(button);
  } else {
    actionsEl.appendChild(button);
  }
  actionsEl.dataset.tbInjected = "1";
}

async function handleTranslateAndOpenModal(actionsEl, button) {
  const commentItem = actionsEl.closest(".comment-item") || actionsEl.parentElement;
  const { issueKey, issueSummary } = getBacklogHeaderInfo();
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  const allItems = Array.from(document.querySelectorAll(".comment-item"));
  const idx = allItems.findIndex((item) => item === commentItem);

  // Get content from the clicked comment with robust selector fallback
  const clickedCommentText = getCommentFullText(commentItem);

  const remainingItems = allItems
    .slice(idx + 1)
    .map((i) => {
      return {
        text: getCommentFullText(i),
        url: getCommentUrl(i),
      };
    })
    .filter((c) => c.text);

  setButtonLoading(button, true);
  try {
    // Translate the clicked comment from Backlog to Vietnamese
    const result = await sendRuntimeMessage({
      type: "LOOKUP_AND_TRANSLATE_COMMENT",
      issueKey,
      issueSummary,
      commentText: clickedCommentText,
      commentUrl: getCommentUrl(commentItem),
    });

    openConfirmModal({
      redmineIssueId: result.data.redmineIssueId,
      issueTitle: result.data.issueTitle,
      previewText: result.data.previewText || "",
      remainingComments: remainingItems,
      hasBatchOption: remainingItems.length > 0,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ redmineIssueId, notesList }) => {
        let lastRes = null;
        for (const notes of notesList) {
          const sendRes = await sendRuntimeMessage({
            type: "SEND_TO_REDMINE",
            redmineIssueId,
            notes,
          });
          lastRes = sendRes.data;
        }
        openSuccessModal({
          redmineUrl: lastRes.redmineUrl,
          commentCount: notesList.length,
          onClose: () => setButtonLoading(button, false),
        });
      },
      translateBatch: (comments) =>
        Promise.all(
          comments.map((c) =>
            sendRuntimeMessage({
              type: "LOOKUP_AND_TRANSLATE_COMMENT",
              issueKey,
              issueSummary,
              commentText: c.text,
              commentUrl: c.url,
            }).then((r) => r.data.previewText)
          )
        ),
    });
    setButtonLoading(button, false);
  } catch (err) {
    setButtonLoading(button, false);
    showToast(err.message, "error");
  }
}

async function handleIssueMigration(button) {
  // Migration: Create a new issue on Redmine from a Backlog issue
  const { issueKey, issueSummary } = getBacklogHeaderInfo();
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  // Collect all comments to migrate with the issue
  const comments = Array.from(document.querySelectorAll(".comment-item:not(.-dammy)"))
    .map((i) => {
      return {
        text: getCommentFullText(i),
        url: getCommentUrl(i),
      };
    })
    .filter((c) => c.text);

  setButtonLoading(button, true);
  try {
    // Translate the issue description
    const descriptionEl =
      document.querySelector("#issueDescription .markdown-body") ||
      document.querySelector(".issue-description .markdown-body") ||
      document.querySelector(".description .markdown-body");
    const descriptionText = descriptionEl ? extractBacklogContent(descriptionEl) : "";
    // Scrape attachments for description (it has its own attachment list in Modern UI)
    let fullDescription = descriptionText;
    const descAttachments = document.querySelectorAll(".issue-attachments .upload-item-list li a[href*=\"attachmentId=\"]");
    descAttachments.forEach((link) => {
      const match = link.getAttribute("href").match(/attachmentId=(\d+)/);
      if (match) {
        const id = match[1];
        const filename = link.textContent.trim();
        if (filename.toLowerCase() !== "download" && !fullDescription.includes(`[[TB_FILE:${id}:`)) {
          fullDescription += `\n\n**Attachment**: [[TB_FILE:${id}:${filename}]]`;
        }
      }
    });

    const res = await sendRuntimeMessage({
      type: "LOOKUP_AND_TRANSLATE_COMMENT",
      issueKey,
      issueSummary,
      commentText: fullDescription,
      commentUrl: window.location.href,
    });

    openConfirmModal({
      isMigration: true,
      issueTitle: [issueKey, issueSummary].filter(Boolean).join(" "),
      previewText: res.data.previewText,
      commentsCount: comments.length,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ issueData }) => {
        const result = await sendRuntimeMessage({
          type: "CREATE_REDMINE_ISSUE",
          issueData,
          comments: comments.map((c) => c.text),
        });
        openSuccessModal({
          redmineUrl: result.data.redmineUrl,
          commentCount: comments.length + 1,
          onClose: () => setButtonLoading(button, false),
        });
      },
    });
    setButtonLoading(button, false);
  } catch (err) {
    setButtonLoading(button, false);
    showToast(err.message, "error");
  }
}

// Helpers
function getCommentFullText(itemEl) {
  if (!itemEl) return "";
  const contentEl =
    itemEl.querySelector(".markdown-body") ||
    itemEl.querySelector(".comment-item__content") ||
    itemEl.querySelector(".comment-item__body") ||
    itemEl.querySelector(".comment-content") ||
    itemEl.querySelector(".item-body");

  let text = contentEl ? extractBacklogContent(contentEl) : itemEl.innerText || "";

  // Scrape attachments from Changelog
  const attachmentLinks = itemEl.querySelectorAll(
    ".comment-changelog__item a[href*=\"attachmentId=\"], .upload-item-list li a[href*=\"attachmentId=\"]"
  );
  attachmentLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const match = href.match(/attachmentId=(\d+)/);
    if (match) {
      const id = match[1];
      const filename = link.textContent.trim();
      // Skip download links and duplicate entries
      if (
        filename &&
        filename.toLowerCase() !== "download" &&
        !text.includes(`[[TB_FILE:${id}:`) &&
        !text.includes(`[[TB_IMG:${id}]]`)
      ) {
        text += `\n\n**Attachment**: [[TB_FILE:${id}:${filename}]]`;
      }
    }
  });
  return text.trim();
}

function getBacklogHeaderInfo() {
  // Try data-testid first (Modern UI)
  let issueKey = document.querySelector("[data-testid=\"issueKey\"]")?.textContent?.trim();
  let issueSummary = document.querySelector("[data-testid=\"issueSummary\"]")?.textContent?.trim();

  // Try legacy/alternative selectors
  if (!issueKey) {
    issueKey =
      document.querySelector(".ticket__key")?.textContent?.trim() ||
      document.querySelector(".issue-key")?.textContent?.trim();
  }
  if (!issueSummary) {
    issueSummary =
      document.querySelector(".ticket__summary")?.textContent?.trim() ||
      document.querySelector(".title-group__title-text")?.textContent?.trim();
  }

  // LAST RESORT: Extract Issue Key from URL
  if (!issueKey) {
    const urlMatch = window.location.pathname.match(/\/view\/([A-Z0-9]+-[0-9]+)/);
    if (urlMatch) {
      issueKey = urlMatch[1];
    }
  }

  // FALLBACK SUMMARY: Use page title if summary not found
  if (!issueSummary) {
    issueSummary = document.title.split("]")[1]?.split("-")[0]?.trim() || document.title;
  }

  return { issueKey: issueKey || "", issueSummary: issueSummary || "" };
}

function getCommentUrl(item) {
  let id = item?.getAttribute("id");
  if (!id) {
    return null;
  }
  if (id.startsWith("comment-item-")) {
    id = id.replace("comment-item-", "comment-");
  }
  return `${window.location.origin}${window.location.pathname}#${id}`;
}

function setButtonLoading(btn, isLoading) {
  if (!btn) {
    return;
  }
  btn.disabled = isLoading;
  btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;

  if (isLoading) {
    btn.innerHTML = `<span class="tb-loading">${TB.MESSAGES.PROCESSING}</span>`;
  } else {
    btn.innerHTML = btn.dataset.originalHtml;
    // Reset visual styles to non-hover state (Modern Button fix)
    const innerWrap = btn.querySelector("div");
    const textSpan = btn.querySelector(".tb-btn-text");
    if (innerWrap && textSpan) {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 2px 6px rgba(59, 130, 246, 0.15)";
      innerWrap.style.backgroundColor = "#ffffff";
      textSpan.style.color = "#1d4ed8";
    }
  }
}
