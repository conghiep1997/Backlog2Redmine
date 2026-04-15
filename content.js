const TB = globalThis.TB_CONSTANTS;
if (!TB) {
  throw new Error("TB_CONSTANTS is not available.");
}

const BUTTON_CLASS = "tb-redmine-btn";
const PROCESSING_TEXT = TB.MESSAGES.PROCESSING;

let modalHost = null;
let modalShadow = null;
let modalElements = null;

injectStyles();
scanAndInjectButtons();
observeCommentActions();

function observeCommentActions() {
  const observer = new MutationObserver((mutations) => {
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

  observer.observe(document.body, {
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
    <span class="tb-redmine-btn__icon" aria-hidden="true">${redmineIconSvg()}</span>
    <span class="tb-redmine-btn__text">${TB.MESSAGES.BUTTON_TEXT}</span>
  `;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await handleTranslateAndOpenModal(actionsEl, button);
  });

  actionsEl.appendChild(button);
  actionsEl.dataset.tbInjected = "1";
}

async function handleTranslateAndOpenModal(actionsEl, button) {
  const commentItem = actionsEl.closest(".comment-item") ?? actionsEl.parentElement;
  const commentContentEl = commentItem?.querySelector("div.comment-content");

  if (!commentContentEl) {
    showToast(TB.MESSAGES.TOAST.NO_COMMENT_CONTENT, "error");
    return;
  }

  const commentText = commentContentEl.innerText.trim();
  if (!commentText) {
    showToast(TB.MESSAGES.TOAST.EMPTY_COMMENT, "error");
    return;
  }

  const { issueKey, issueSummary } = getBacklogHeaderInfo();
  if (!issueKey) {
    showToast(TB.MESSAGES.TOAST.MISSING_ISSUE_KEY, "error");
    return;
  }

  setButtonLoading(button, true);

  try {
    const result = await sendRuntimeMessage({
      type: "LOOKUP_AND_TRANSLATE_COMMENT",
      issueKey,
      issueSummary,
      commentText,
    });

    openConfirmModal({
      redmineIssueId: result.redmineIssueId,
      previewText: result.previewText,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ redmineIssueId, notes }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_REDMINE",
          redmineIssueId,
          notes,
        });

        showToast(sendResult.message ?? TB.MESSAGES.TOAST.SEND_SUCCESS, "success");
        setButtonLoading(button, false);
      },
    });
  } catch (error) {
    setButtonLoading(button, false);
    showToast(error instanceof Error ? error.message : String(error), "error");
  }
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

function openConfirmModal({ redmineIssueId = "", previewText = "", onCancel, onConfirm }) {
  ensureModalShell();

  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdInput,
    previewTextarea,
    closeButton,
    cancelButton,
    confirmButton,
  } = modalElements;

  titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
  subtitleEl.textContent = TB.MESSAGES.MODAL.SUBTITLE;
  issueIdInput.value = redmineIssueId;
  previewTextarea.value = previewText;
  confirmButton.disabled = false;
  confirmButton.textContent = TB.MESSAGES.MODAL.CONFIRM;

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
    const notes = previewTextarea.value.trim();

    if (!redmineIssueIdValue) {
      showToast(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID, "error");
      return;
    }
    if (!notes) {
      showToast(TB.MESSAGES.MODAL.EMPTY_NOTES, "error");
      return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = TB.MESSAGES.MODAL.SENDING;

    try {
      await onConfirm({ redmineIssueId: redmineIssueIdValue, notes });
      closeConfirmModal();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = TB.MESSAGES.MODAL.CONFIRM;
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  };

  overlay.hidden = false;
  document.body.classList.add("tb-modal-open");
}

function closeConfirmModal() {
  if (modalElements?.overlay) {
    modalElements.overlay.hidden = true;
  }
  document.body.classList.remove("tb-modal-open");
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
        <div class="tb-field">
          <span class="tb-field__label">${TB.MESSAGES.MODAL.PREVIEW_LABEL}</span>
          <textarea class="tb-textarea" rows="16"></textarea>
        </div>
        <div class="tb-modal__hint">${TB.MESSAGES.MODAL.HINT}</div>
        <div class="tb-modal__actions">
          <button type="button" class="tb-btn tb-btn--ghost">${TB.MESSAGES.MODAL.CANCEL}</button>
          <button type="button" class="tb-btn tb-btn--primary">${TB.MESSAGES.MODAL.CONFIRM}</button>
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
  const issueIdInput = modalShadow.querySelector(".tb-input");
  const previewTextarea = modalShadow.querySelector(".tb-textarea");

  modalElements = {
    overlay,
    titleEl,
    subtitleEl,
    closeButton,
    cancelButton,
    confirmButton,
    issueIdInput,
    previewTextarea,
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
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: linear-gradient(180deg, #ffffff, #f3f5f9);
      color: #223047;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    }

    .${BUTTON_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(25, 31, 51, 0.12);
    }

    .${BUTTON_CLASS}:disabled {
      opacity: 0.7;
      cursor: wait;
      transform: none;
    }

    .tb-redmine-btn__icon svg {
      display: block;
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .tb-redmine-btn__spinner {
      width: 12px;
      height: 12px;
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
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      max-width: min(420px, calc(100vw - 40px));
      padding: 12px 14px;
      border-radius: 12px;
      color: #fff;
      background: rgba(17, 24, 39, 0.94);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 180ms ease, transform 180ms ease;
      font-size: 13px;
    }

    .tb-toast[data-type="success"] { background: rgba(16, 185, 129, 0.95); }
    .tb-toast[data-type="error"] { background: rgba(220, 38, 38, 0.95); }
    .tb-toast--visible {
      opacity: 1;
      transform: translateY(0);
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
