/**
 * Modal UI management for Backlog2Redmine Extension.
 */

const TB = globalThis.TB_CONSTANTS;
let modalElements = null;

function ensureModalShell() {
  let overlay = document.getElementById("tb-redmine-overlay");
  
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tb-redmine-overlay";
    overlay.className = "tb-modal-overlay";
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="tb-modal-container">
      <!-- Confirm Modal -->
      <div id="tb-confirm-modal" class="tb-modal-content">
        <div class="tb-modal-header">
          <h2 id="tb-modal-title" class="tb-modal-title">${TB.MESSAGES.MODAL.TITLE}</h2>
          <button id="tb-modal-close" class="tb-modal-close" aria-label="${TB.MESSAGES.MODAL.CLOSE_ARIA}">&times;</button>
        </div>
        <div class="tb-modal-body">
          <p id="tb-modal-subtitle" class="tb-modal-subtitle">${TB.MESSAGES.MODAL.SUBTITLE}</p>
          <div id="tb-standard-fields">
            <div class="tb-field-group">
              <label for="tb-redmine-issue-id">${TB.MESSAGES.MODAL.ISSUE_ID_LABEL}</label>
              <input type="text" id="tb-redmine-issue-id" placeholder="VD: 12345">
            </div>
            <div class="tb-field-group">
              <label for="tb-redmine-issue-title">${TB.MESSAGES.MODAL.ISSUE_TITLE_LABEL}</label>
              <input type="text" id="tb-redmine-issue-title" readonly>
            </div>
          </div>
          <div id="tb-migration-fields" hidden>
            <div class="tb-field-group">
              <label for="tb-migrate-project">${TB.MESSAGES.MODAL.PROJECT_LABEL}</label>
              <select id="tb-migrate-project">
                <option value="">${TB.MESSAGES.MODAL.LOADING_METADATA}</option>
              </select>
            </div>
            <div class="tb-field-row">
              <div class="tb-field-group">
                <label for="tb-migrate-tracker">${TB.MESSAGES.MODAL.TRACKER_LABEL}</label>
                <select id="tb-migrate-tracker"><option value="">-- Loader --</option></select>
              </div>
              <div class="tb-field-group" style="flex: 1; margin-left: 10px;">
                <label for="tb-migrate-priority">${TB.MESSAGES.MODAL.PRIORITY_LABEL}</label>
                <select id="tb-migrate-priority"><option value="">-- Loader --</option></select>
              </div>
            </div>
            <div class="tb-field-group">
              <label for="tb-migrate-subject">${TB.MESSAGES.MODAL.SUBJECT_LABEL}</label>
              <input type="text" id="tb-migrate-subject">
            </div>
          </div>
          <div class="tb-field-group">
            <label for="tb-redmine-preview">${TB.MESSAGES.MODAL.PREVIEW_LABEL}</label>
            <textarea id="tb-redmine-preview" rows="10"></textarea>
          </div>
          <div id="tb-batch-info" class="tb-batch-pill" hidden></div>
          <p class="tb-modal-hint">${TB.MESSAGES.MODAL.HINT}</p>
          <div id="tb-batch-option" class="tb-batch-option" hidden>
            <label><input type="checkbox" id="tb-batch-checkbox"> <span id="tb-batch-text"></span></label>
          </div>

          <!-- Backlog Specific Field -->
          <div id="tb-backlog-fields" hidden>
            <div class="tb-field-group">
              <label for="tb-backlog-notify">${TB.MESSAGES.MODAL.NOTIFY_USERS_LABEL}</label>
              <input type="text" id="tb-backlog-notify" placeholder="Ví dụ: 12345, 67890">
            </div>
            <p class="tb-modal-hint">Mẹo: Backlog sẽ gửi thông báo cho những người được tag qua ID.</p>
          </div>
        </div>
        <div class="tb-modal-footer">
          <button id="tb-modal-cancel" class="tb-btn tb-btn-secondary">${TB.MESSAGES.MODAL.CANCEL}</button>
          <button id="tb-modal-confirm" class="tb-btn tb-btn-primary">${TB.MESSAGES.MODAL.CONFIRM}</button>
        </div>
      </div>
      <!-- Success Modal -->
      <div id="tb-success-modal" class="tb-modal-content" hidden>
        <div class="tb-modal-header">
          <h2 id="tb-success-title" class="tb-modal-title">${TB.MESSAGES.MODAL.SUCCESS_TITLE}</h2>
        </div>
        <div class="tb-modal-body">
          <p id="tb-success-subtitle" class="tb-modal-subtitle">${TB.MESSAGES.MODAL.SUCCESS_SUBTITLE}</p>
          <div class="tb-success-link-container"><a id="tb-success-link" href="#" target="_blank" class="tb-success-link"></a></div>
        </div>
        <div class="tb-modal-footer">
          <button id="tb-success-view-btn" class="tb-btn tb-btn-primary">${TB.MESSAGES.MODAL.SUCCESS_VIEW_BUTTON}</button>
          <button id="tb-success-close-btn" class="tb-btn tb-btn-secondary">${TB.MESSAGES.MODAL.SUCCESS_CLOSE_BUTTON}</button>
        </div>
      </div>
    </div>
  `;

  modalElements = {
    overlay,
    confirmModal: overlay.querySelector("#tb-confirm-modal"),
    titleEl: overlay.querySelector("#tb-modal-title"),
    subtitleEl: overlay.querySelector("#tb-modal-subtitle"),
    issueIdInput: overlay.querySelector("#tb-redmine-issue-id"),
    issueTitleInput: overlay.querySelector("#tb-redmine-issue-title"),
    previewTextarea: overlay.querySelector("#tb-redmine-preview"),
    closeButton: overlay.querySelector("#tb-modal-close"),
    cancelButton: overlay.querySelector("#tb-modal-cancel"),
    confirmButton: overlay.querySelector("#tb-modal-confirm"),
    batchInfoEl: overlay.querySelector("#tb-batch-info"),
    batchOptionEl: overlay.querySelector("#tb-batch-option"),
    batchOptionCheckbox: overlay.querySelector("#tb-batch-checkbox"),
    batchOptionText: overlay.querySelector("#tb-batch-text"),
    successModal: overlay.querySelector("#tb-success-modal"),
    successTitleEl: overlay.querySelector("#tb-success-title"),
    successSubtitleEl: overlay.querySelector("#tb-success-subtitle"),
    successLinkEl: overlay.querySelector("#tb-success-link"),
    successViewButton: overlay.querySelector("#tb-success-view-btn"),
    successCloseButton: overlay.querySelector("#tb-success-close-btn"),
    standardFields: overlay.querySelector("#tb-standard-fields"),
    migrationFields: overlay.querySelector("#tb-migration-fields"),
    projectSelect: overlay.querySelector("#tb-migrate-project"),
    trackerSelect: overlay.querySelector("#tb-migrate-tracker"),
    prioritySelect: overlay.querySelector("#tb-migrate-priority"),
    migrateSubjectInput: overlay.querySelector("#tb-migrate-subject"),
    
    // Backlog Specific
    backlogFields: overlay.querySelector("#tb-backlog-fields"),
    backlogNotifyInput: overlay.querySelector("#tb-backlog-notify"),
    issueIdLabel: overlay.querySelector("label[for='tb-redmine-issue-id']")
  };
}

function openConfirmModal({ 
  redmineIssueId = "", issueTitle = "", previewText = "", 
  remainingComments = [], hasBatchOption = false, 
  isMigration = false, commentsCount = 0,
  onCancel, onConfirm, translateBatch 
}) {
  ensureModalShell();
  const { overlay, titleEl, subtitleEl, issueIdInput, issueTitleInput, previewTextarea, 
          closeButton, cancelButton, confirmButton, batchInfoEl, batchOptionEl, 
          batchOptionCheckbox, batchOptionText, standardFields, migrationFields, 
          projectSelect, trackerSelect, prioritySelect, migrateSubjectInput } = modalElements;

  let currentMode = false;
  let currentNotesList = [previewText];
  let memoizedBatchNotes = null;

  function updateModalState() {
    if (isMigration) {
      titleEl.textContent = TB.MESSAGES.MODAL.MIGRATE_TITLE;
      subtitleEl.textContent = `Sẽ tạo 1 ticket và đính kèm ${commentsCount} bình luận.`;
      standardFields.hidden = true;
      migrationFields.hidden = false;
      batchOptionEl.hidden = true;
      migrateSubjectInput.value = issueTitle;
      previewTextarea.value = previewText;
      confirmButton.textContent = "Tạo & Di cư toàn bộ";
    } else {
      titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
      subtitleEl.textContent = currentMode ? `Dịch ${remainingComments.length + 1} bình luận → Redmine` : TB.MESSAGES.MODAL.SUBTITLE;
      standardFields.hidden = false;
      migrationFields.hidden = true;
      if (currentMode) {
        previewTextarea.value = memoizedBatchNotes ? [previewText, ...memoizedBatchNotes].map((text, index) => `--- Note ${index + 1} ---\n${text}`).join('\n\n') : `${previewText}\n\n[Đang chờ dịch...]`;
        currentNotesList = memoizedBatchNotes ? [previewText, ...memoizedBatchNotes] : [previewText];
      } else {
        previewTextarea.value = previewText;
        currentNotesList = [previewText];
      }
      confirmButton.textContent = currentMode ? `Dịch & Gửi ${remainingComments.length + 1} notes` : TB.MESSAGES.MODAL.CONFIRM;
    }
  }

  if (isMigration) fetchRedmineMetadataForModal();

  if (!isMigration && hasBatchOption) {
    batchOptionEl.hidden = false;
    batchOptionText.textContent = `Dịch đến comment cuối trang (${remainingComments.length + 1} bình luận)`;
    batchOptionCheckbox.checked = false;
    batchOptionCheckbox.onchange = async (e) => {
      currentMode = e.target.checked;
      if (currentMode && !memoizedBatchNotes) {
        confirmButton.disabled = true;
        try { memoizedBatchNotes = await translateBatch(remainingComments); } catch (err) { showToast(err.message, "error"); currentMode = false; }
        confirmButton.disabled = false;
      }
      updateModalState();
    };
  } else {
    batchOptionEl.hidden = true;
  }

  issueIdInput.value = redmineIssueId;
  issueTitleInput.value = issueTitle;

  // Auto-load title logic
  let isValidated = false;
  let lastCheckedId = "";

  const loadRedmineTitle = async (id) => {
    id = id.trim();
    if (!id || id === lastCheckedId) return;
    
    lastCheckedId = id;
    isValidated = false;
    confirmButton.disabled = true;
    
    // Simple numeric check for Redmine
    if (!/^\d+$/.test(id)) {
      issueTitleInput.value = "⚠️ ID phải là một dãy số!";
      return;
    }

    issueTitleInput.value = "Đang tải tiêu đề...";
    
    try {
      const res = await sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: `/issues/${id}.json` });
      if (res?.data?.issue?.subject) {
        issueTitleInput.value = res.data.issue.subject;
        isValidated = true;
        confirmButton.disabled = false;
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      issueTitleInput.value = "⚠️ Không tìm thấy Issue hoặc lỗi kết nối!";
      isValidated = false;
      confirmButton.disabled = true;
    }
  };

  let checkTimer = null;
  issueIdInput.onblur = (e) => {
    clearTimeout(checkTimer);
    loadRedmineTitle(e.target.value);
  };
  issueIdInput.oninput = (e) => {
    const val = e.target.value.trim();
    // Keep disabled while typing unless it matches the last validated ID
    confirmButton.disabled = !(isValidated && val === lastCheckedId);
    
    // Auto-check after 600ms of inactivity
    clearTimeout(checkTimer);
    if (val && val !== lastCheckedId) {
      checkTimer = setTimeout(() => loadRedmineTitle(val), 600);
    }
  };

  // Initial load if ID exists
  if (redmineIssueId) {
    lastCheckedId = redmineIssueId; // Prevent double load if already correct
    loadRedmineTitle(redmineIssueId);
  } else {
    confirmButton.disabled = true;
  }

  const safeClose = () => { overlay.style.display = "none"; document.body.classList.remove("tb-modal-open"); onCancel?.(); };
  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;
  overlay.onclick = (e) => { if (e.target === overlay) safeClose(); };

  confirmButton.onclick = async () => {
    confirmButton.disabled = true;
    if (isMigration) {
      const issueData = { project_id: projectSelect.value, tracker_id: trackerSelect.value, priority_id: prioritySelect.value, subject: migrateSubjectInput.value.trim(), description: previewTextarea.value.trim() };
      if (!issueData.project_id) { showToast("Vui lòng chọn dự án Redmine.", "error"); confirmButton.disabled = false; return; }
      await onConfirm({ issueData });
    } else {
      const id = issueIdInput.value.trim();
      if (!id) { showToast(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID, "error"); confirmButton.disabled = false; return; }
      await onConfirm({ redmineIssueId: id, notesList: currentNotesList });
    }
  };

  updateModalState();
  modalElements.confirmModal.style.display = "block";
  modalElements.successModal.style.display = "none";
  overlay.style.display = "flex";
  document.body.classList.add("tb-modal-open");
}

function openBacklogModal({ backlogIssueKey = "", previewText = "", onCancel, onConfirm }) {
  ensureModalShell();
  const { overlay, titleEl, subtitleEl, issueIdInput, issueIdLabel, previewTextarea, 
          closeButton, cancelButton, confirmButton, standardFields, migrationFields, 
          backlogFields, backlogNotifyInput } = modalElements;

  titleEl.textContent = "Gửi bình luận sang Backlog";
  subtitleEl.textContent = "Chỉ bao gồm phần tiếng Nhật đã được AI lọc ra.";
  issueIdLabel.textContent = TB.MESSAGES.MODAL.BACKLOG_ISSUE_KEY_LABEL;
  issueIdInput.value = backlogIssueKey;
  issueIdInput.placeholder = "Ví dụ: CP-123";
  previewTextarea.value = previewText;

  standardFields.hidden = false;
  migrationFields.hidden = true;
  backlogFields.hidden = false;
  overlay.querySelector("#tb-redmine-issue-title").parentElement.hidden = true;

  confirmButton.disabled = false;
  confirmButton.textContent = "Xác nhận & Gửi";

  const safeClose = () => { overlay.style.display = "none"; document.body.classList.remove("tb-modal-open"); onCancel?.(); };
  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;

  confirmButton.onclick = async () => {
    const key = issueIdInput.value.trim();
    if (!key) { showToast("Vui lòng nhập Backlog Issue Key.", "error"); return; }
    confirmButton.disabled = true;
    try {
      await onConfirm({ backlogIssueKey: key, content: previewTextarea.value, notifiedUserId: backlogNotifyInput.value.trim() });
    } catch (err) { confirmButton.disabled = false; showToast(err.message, "error"); }
  };

  modalElements.confirmModal.style.display = "block";
  modalElements.successModal.style.display = "none";
  overlay.style.display = "flex";
  document.body.classList.add("tb-modal-open");
}

function openSuccessModal({ redmineUrl, commentCount = 1, onClose }) {
  ensureModalShell();
  const { overlay, successTitleEl, successSubtitleEl, successLinkEl, successViewButton, successCloseButton } = modalElements;
  successTitleEl.textContent = commentCount > 1 ? `✅ Đã gửi ${commentCount} notes thành công!` : TB.MESSAGES.MODAL.SUCCESS_TITLE;
  successSubtitleEl.textContent = commentCount > 1 ? `Tất cả bình luận đã được dịch và gửi lên Redmine` : TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
  successLinkEl.textContent = redmineUrl; successLinkEl.href = redmineUrl;
  successViewButton.onclick = () => window.open(redmineUrl, '_blank');
  successCloseButton.onclick = () => { overlay.style.display = "none"; document.body.classList.remove("tb-modal-open"); onClose?.(); };
  modalElements.confirmModal.style.display = "none";
  modalElements.successModal.style.display = "block";
  overlay.style.display = "flex";
  document.body.classList.add("tb-modal-open");
}

async function fetchRedmineMetadataForModal() {
  const { projectSelect, trackerSelect, prioritySelect } = modalElements;
  try {
    const [projectsRes, trackersRes, prioritiesRes] = await Promise.all([
      sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: "/projects.json?limit=100" }),
      sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: "/trackers.json" }),
      sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: "/enumerations/issue_priorities.json" })
    ]);
    projectSelect.innerHTML = projectsRes.data.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    trackerSelect.innerHTML = trackersRes.data.trackers.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    prioritySelect.innerHTML = prioritiesRes.data.issue_priorities.map(p => `<option value="${p.id}" ${p.is_default ? "selected" : ""}>${p.name}</option>`).join("");
  } catch (error) {
    showToast("Không thể tải dữ liệu Redmine.", "error");
  }
}
