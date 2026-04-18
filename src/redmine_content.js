const TB = globalThis.TB_CONSTANTS;
if (!TB) {
  throw new Error("TB_CONSTANTS is not available.");
}

const BUTTON_CLASS = "tb-backlog-btn";
const PROCESSING_TEXT = "Đang xử lý...";
const BUTTON_TEXT = "Backlog";

// Redmine Icon (reuse or replace)
const BACKLOG_ICON = TB.ICONS.BACKLOG;

let modalHost = null;
let modalShadow = null;
let modalElements = null;
let journalObserver = null;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (journalObserver) {
    journalObserver.disconnect();
    journalObserver = null;
  }
});

injectStyles();
scanAndInjectButtons();
observeJournalActions();

function observeJournalActions() {
  journalObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const element = node;
        if (element.matches?.("div.journal div.contextual")) {
          injectButtonIfNeeded(element);
        } else {
          element.querySelectorAll?.("div.journal div.contextual").forEach(injectButtonIfNeeded);
        }
      }
    }
  });

  journalObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.journal div.contextual").forEach(injectButtonIfNeeded);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") return;

  const button = document.createElement("a");
  button.href = "#";
  button.className = `${BUTTON_CLASS} icon icon-share`; // Use Redmine icon class if needed
  button.title = "Đồng bộ nội dung tiếng Nhật sang Backlog";
  button.innerHTML = `
    <span class="tb-backlog-btn__icon" style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:4px;">${BACKLOG_ICON}</span>
    <span class="tb-backlog-btn__text">${BUTTON_TEXT}</span>
  `;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleExtractAndOpenModal(actionsEl, button);
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

async function handleExtractAndOpenModal(actionsEl, button) {
  const journalEl = actionsEl.closest(".journal");
  const commentContentEl = journalEl?.querySelector("div.wiki");
  const rawText = commentContentEl?.innerText?.trim() || "";

  if (!rawText) {
    showToast("Không tìm thấy nội dung bình luận.", "error");
    return;
  }

  // Attempt to find Backlog Key in page
  const backlogIssueKey = findBacklogKeyInPage();

  setButtonLoading(button, true);

  try {
    const result = await sendRuntimeMessage({
      type: "EXTRACT_JAPANESE_CONTENT",
      commentText: rawText,
    });

    openBacklogConfirmModal({
      backlogIssueKey,
      previewText: result.previewText,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ backlogIssueKey, content, notifiedUserId }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_BACKLOG",
          backlogIssueKey,
          content,
          notifiedUserId,
        });

        openSuccessModal({
          url: sendResult.backlogUrl,
          title: "✅ Đã gửi thành công!",
          subtitle: "Bình luận đã được gửi sang Backlog.",
          viewButtonText: "Xem trên Backlog",
          onClose: () => setButtonLoading(button, false),
        });
      }
    });

    setButtonLoading(button, false);
  } catch (error) {
    setButtonLoading(button, false);
    showToast(error instanceof Error ? error.message : String(error), "error");
  }
}

function findBacklogKeyInPage() {
  // Common patterns in Redmine issues for Backlog keys
  const patterns = [
    // In title: [CP-123] Title or CP-123 Title
    /([A-Z0-9]+-[0-9]+)/
  ];

  // Try title first
  const title = document.querySelector("#content h2")?.innerText || "";
  for (const p of patterns) {
    const match = title.match(p);
    if (match) return match[1];
  }

  // Try description
  const desc = document.querySelector("div.description div.wiki")?.innerText || "";
  for (const p of patterns) {
    const match = desc.match(p);
    if (match) return match[1];
  }

  return "";
}

function openBacklogConfirmModal({ backlogIssueKey = "", previewText = "", onCancel, onConfirm }) {
  ensureModalShell();

  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdLabel,
    issueIdInput,
    issueTitleField,
    previewTextarea,
    notifyUsersEl,
    notifyUsersInput,
    closeButton,
    cancelButton,
    confirmButton,
  } = modalElements;

  titleEl.textContent = "Gửi bình luận sang Backlog";
  subtitleEl.textContent = "Chỉ bao gồm phần tiếng Nhật đã được AI lọc ra.";
  
  issueIdLabel.textContent = TB.MESSAGES.MODAL.BACKLOG_ISSUE_KEY_LABEL;
  issueIdInput.value = backlogIssueKey;
  issueIdInput.placeholder = "Ví dụ: CP-123";
  
  // Hide Redmine-specific fields if any
  if (issueTitleField) issueTitleField.hidden = true;
  
  previewTextarea.value = previewText;
  
  if (notifyUsersEl) {
    notifyUsersEl.hidden = false;
    notifyUsersInput.value = "";
  }

  confirmButton.disabled = false;
  confirmButton.textContent = "Xác nhận & Gửi";

  const safeClose = () => {
    closeConfirmModal();
    onCancel?.();
  };

  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;

  confirmButton.onclick = async () => {
    const key = issueIdInput.value.trim();
    if (!key) {
      showToast("Vui lòng nhập Backlog Issue Key.", "error");
      return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = "Đang gửi...";

    try {
      await onConfirm({
        backlogIssueKey: key,
        content: previewTextarea.value,
        notifiedUserId: notifyUsersInput.value.trim(),
      });
      closeConfirmModal();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = "Xác nhận & Gửi";
      showToast(error.message, "error");
    }
  };

  overlay.hidden = false;
  document.body.classList.add("tb-modal-open");
}

function openSuccessModal({ url, title, subtitle, viewButtonText, onClose }) {
  ensureModalShell();

  const {
    overlay,
    successModal,
    successTitleEl,
    successSubtitleEl,
    successLinkEl,
    successViewButton,
    successCloseButton,
  } = modalElements;

  successTitleEl.textContent = title;
  successSubtitleEl.textContent = subtitle;
  successLinkEl.textContent = url;
  successLinkEl.href = url;
  successViewButton.textContent = viewButtonText;
  successViewButton.onclick = () => window.open(url, '_blank');
  
  successCloseButton.onclick = () => {
    closeSuccessModal();
    onClose?.();
  };

  successModal.hidden = false;
  overlay.hidden = false;
}

function closeConfirmModal() {
  if (modalElements?.overlay) modalElements.overlay.hidden = true;
  document.body.classList.remove("tb-modal-open");
}

function closeSuccessModal() {
  if (modalElements?.successModal) modalElements.successModal.hidden = true;
  if (modalElements?.overlay) modalElements.overlay.hidden = true;
  document.body.classList.remove("tb-modal-open");
}

function ensureModalShell() {
  if (modalHost && modalShadow && modalElements) return;

  modalHost = document.createElement("div");
  modalHost.id = "tb-backlog-modal-host";
  modalShadow = modalHost.attachShadow({ mode: "open" });

  modalShadow.innerHTML = `
    <style>${modalStyles()}</style>
    <div class="tb-modal-overlay" hidden>
      <div class="tb-modal" role="dialog" aria-modal="true">
        <div class="tb-modal__header">
          <div>
            <div class="tb-modal__title"></div>
            <div class="tb-modal__subtitle"></div>
          </div>
          <button type="button" class="tb-modal__close">×</button>
        </div>
        <label class="tb-field">
          <span class="tb-field__label" id="issue-id-label"></span>
          <input class="tb-input" type="text" id="issue-id-input" />
        </label>
        <div class="tb-field" id="issue-title-field" hidden>
           <span class="tb-field__label">Redmine Issue Title</span>
           <input class="tb-input tb-input--readonly" type="text" readonly />
        </div>
        <div class="tb-field">
          <span class="tb-field__label">Nội dung gửi đi</span>
          <textarea class="tb-textarea" rows="12"></textarea>
        </div>
        <div class="tb-field" id="notify-users-field" hidden>
          <span class="tb-field__label">${TB.MESSAGES.MODAL.NOTIFY_USERS_LABEL}</span>
          <input class="tb-input" type="text" id="notify-users-input" placeholder="Ví dụ: 12345, 67890" />
        </div>
        <div class="tb-modal__hint">Mẹo: Backlog sẽ gửi thông báo cho những người được tag qua ID.</div>
        <div class="tb-modal__actions">
          <button type="button" class="tb-btn tb-btn--ghost">Hủy bỏ</button>
          <button type="button" class="tb-btn tb-btn--primary">Xác nhận & Gửi</button>
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
            <a class="tb-success-link" href="#" target="_blank"></a>
          </div>
          <div class="tb-modal__actions tb-modal__actions--center">
            <button type="button" class="tb-btn tb-btn--primary tb-btn--open"></button>
            <button type="button" class="tb-btn tb-btn--ghost">Đóng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalHost);

  modalElements = {
    overlay: modalShadow.querySelector(".tb-modal-overlay"),
    titleEl: modalShadow.querySelector(".tb-modal__title"),
    subtitleEl: modalShadow.querySelector(".tb-modal__subtitle"),
    issueIdLabel: modalShadow.querySelector("#issue-id-label"),
    issueIdInput: modalShadow.querySelector("#issue-id-input"),
    issueTitleField: modalShadow.querySelector("#issue-title-field"),
    previewTextarea: modalShadow.querySelector(".tb-textarea"),
    notifyUsersEl: modalShadow.querySelector("#notify-users-field"),
    notifyUsersInput: modalShadow.querySelector("#notify-users-input"),
    closeButton: modalShadow.querySelector(".tb-modal__close"),
    cancelButton: modalShadow.querySelector(".tb-btn--ghost"),
    confirmButton: modalShadow.querySelector(".tb-btn--primary"),
    successModal: modalShadow.querySelector(".tb-modal-success"),
    successTitleEl: modalShadow.querySelector(".tb-modal__title--success"),
    successSubtitleEl: modalShadow.querySelector(".tb-modal-success .tb-modal__subtitle"),
    successLinkEl: modalShadow.querySelector(".tb-success-link"),
    successViewButton: modalShadow.querySelector(".tb-btn--open"),
    successCloseButton: modalShadow.querySelector(".tb-modal-success .tb-btn--ghost"),
  };
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
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
  if (modalElements?.toast) return;

  const toast = document.createElement("div");
  toast.className = "tb-toast";
  toast.hidden = true;
  document.body.appendChild(toast);

  modalElements = modalElements ?? {};
  modalElements.toast = toast;
}

async function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(new Error(response?.error || "Unknown error"));
      }
    });
  });
}

function injectStyles() {
  if (document.getElementById("tb-injected-styles")) return;

  const style = document.createElement("style");
  style.id = "tb-injected-styles";
  style.textContent = `
    .${BUTTON_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 10px !important;
      color: #c93b2f !important;
      font-weight: bold;
      vertical-align: middle;
    }

    .tb-backlog-btn__icon svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .tb-redmine-btn__spinner {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid rgba(201, 59, 47, 0.2);
      border-top-color: #c93b2f;
      animation: tb-spin 0.8s linear infinite;
      display: inline-block;
      margin-right: 4px;
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
      font-family: system-ui, sans-serif;
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
  // Reuse styles from content.js or similar
  return `
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
      font-family: system-ui, -apple-system, sans-serif;
    }
    .tb-modal {
      width: min(800px, 100%);
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .tb-modal__header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .tb-modal__title { font-size: 1.25rem; font-weight: 700; }
    .tb-modal__subtitle { color: #6b7280; font-size: 0.875rem; }
    .tb-modal__close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    .tb-field { display: block; margin-bottom: 16px; }
    .tb-field__label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.875rem; }
    .tb-input, .tb-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.875rem;
    }
    .tb-textarea { resize: vertical; }
    .tb-modal__hint { font-size: 0.75rem; color: #6b7280; margin-bottom: 20px; }
    .tb-modal__actions { display: flex; justify-content: flex-end; gap: 12px; }
    .tb-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .tb-btn--primary { background: #c93b2f; color: #fff; }
    .tb-btn--ghost { background: #f3f4f6; color: #374151; }
    .tb-modal-success {
      position: absolute;
      inset: 0;
      background: #fff;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      padding: 24px;
    }
    [hidden] { display: none !important; }
    .tb-success-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
    .tb-success-icon { font-size: 3rem; }
    .tb-success-link { color: #c93b2f; text-decoration: none; word-break: break-all; text-align: center; }
  `;
}
