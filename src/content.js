const TB = globalThis.TB_CONSTANTS;
if (!TB) {
  throw new Error("TB_CONSTANTS is not available.");
}

const BUTTON_CLASS = "tb-redmine-btn";
const PROCESSING_TEXT = "Đang dịch...";
const BUTTON_TEXT = "Dịch → Redmine";

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
  button.title = "Dịch bình luận này sang tiếng Việt và gửi lên Redmine";
  button.setAttribute("aria-label", "Dịch bình luận sang tiếng Việt và gửi lên Redmine");
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
      issueTitle: result.issueTitle,
      previewText: result.previewText,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ redmineIssueId, notes }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_REDMINE",
          redmineIssueId,
          notes,
        });

        // Show success modal with link
        openSuccessModal({
          redmineUrl: sendResult.redmineUrl,
          onClose: () => setButtonLoading(button, false),
        });
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

function openConfirmModal({ redmineIssueId = "", issueTitle = "", previewText = "", onCancel, onConfirm }) {
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
  } = modalElements;

  titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
  subtitleEl.textContent = TB.MESSAGES.MODAL.SUBTITLE;
  issueIdInput.value = redmineIssueId;
  issueTitleInput.value = issueTitle;
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

function openSuccessModal({ redmineUrl, onClose }) {
  ensureModalShell();

  const {
    overlay,
    successTitleEl,
    successSubtitleEl,
    successLinkEl,
    successViewButton,
    successCloseButton,
  } = modalElements;

  successTitleEl.textContent = TB.MESSAGES.MODAL.SUCCESS_TITLE;
  successSubtitleEl.textContent = TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
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
          <input class="tb-input tb-input--readonly" type="text" readonly />
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
    .tb-input--readonly {
      background: #f3f4f6;
      color: #6b7280;
      cursor: not-allowed;
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
