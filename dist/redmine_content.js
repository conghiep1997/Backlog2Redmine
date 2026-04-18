/**
 * Redmine Content Script Entry Point for Backlog2Redmine Extension.
 * Handles extracting Japanese content and syncing to Backlog.
 */

const BUTTON_CLASS = "tb-backlog-btn";
const BACKLOG_ICON = TB?.ICONS?.BACKLOG;

let journalObserver = null;

// Initialization
injectStyles();
scanAndInjectButtons();
observeJournalActions();

function observeJournalActions() {
  journalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("div.journal div.contextual")) {
            injectButtonIfNeeded(node);
          } else {
            node.querySelectorAll?.("div.journal div.contextual").forEach(injectButtonIfNeeded);
          }
        }
      }
    }
  });
  journalObserver.observe(document.body, { childList: true, subtree: true });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.journal div.contextual").forEach(injectButtonIfNeeded);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") {
    return;
  }
  const button = document.createElement("a");
  button.href = "#";
  button.className = `${BUTTON_CLASS} icon icon-share`;
  button.title = TB.MESSAGES.BUTTON_TITLE_BACKLOG;
  button.innerHTML = `<span class="tb-backlog-btn__icon">${BACKLOG_ICON}</span><span class="tb-backlog-btn__text">Backlog</span>`;
  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleExtractAndOpenModal(actionsEl, button);
  };

  const quoteBtn = actionsEl.querySelector("a.icon-comment");
  if (quoteBtn) {
    quoteBtn.before(button);
  } else {
    actionsEl.appendChild(button);
  }
  actionsEl.dataset.tbInjected = "1";
}

async function handleExtractAndOpenModal(actionsEl, button) {
  const commentContentEl = actionsEl.closest(".journal")?.querySelector("div.wiki");
  const rawText = commentContentEl?.innerText?.trim() || "";
  if (!rawText) {
    showToast(TB.MESSAGES.TOAST.NO_COMMENT_CONTENT, "error");
    return;
  }

  const backlogIssueKey = findBacklogKeyInPage();
  setButtonLoading(button, true);

  try {
    const result = await sendRuntimeMessage({
      type: "EXTRACT_JAPANESE_CONTENT",
      commentText: rawText,
    });
    openBacklogModal({
      backlogIssueKey,
      previewText: result.previewText,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ backlogIssueKey: confirmedKey, content, notifiedUserId }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_BACKLOG",
          backlogIssueKey: confirmedKey,
          content,
          notifiedUserId,
        });
        openSuccessModal({
          redmineUrl: sendResult.backlogUrl,
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

function findBacklogKeyInPage() {
  const patterns = [/([A-Z0-9]+-[0-9]+)/];
  const title = document.querySelector("#content h2")?.innerText || "";
  for (const p of patterns) {
    const m = title.match(p);
    if (m) {
      return m[1];
    }
  }
  const desc = document.querySelector("div.description div.wiki")?.innerText || "";
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) {
      return m[1];
    }
  }
  return "";
}

function setButtonLoading(btn, isLoading) {
  if (!btn) {
    return;
  }
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.5" : "1";
  btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
  btn.innerHTML = isLoading
    ? `<span class="tb-loading">${TB.MESSAGES.PROCESSING}</span>`
    : btn.dataset.originalHtml;
}
