/**
 * Modal UI management for Backlog2Redmine Extension.
 */

const TB = globalThis.TB_CONSTANTS;
let modalElements = null;
let customFieldsMetadata = [];
let redmineSettings = null;

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
      <!-- Loading Overlay -->
      <div id="tb-modal-loading" class="tb-modal-loading" style="display: none;">
        <div class="tb-spinner"></div>
        <div id="tb-modal-loading-text" class="tb-loading-text">${TB.MESSAGES.PROCESSING}</div>
      </div>
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
              <textarea id="tb-redmine-issue-title" class="tb-multiline-input" readonly rows="2"></textarea>
            </div>
          </div>
          <div id="tb-migration-fields" hidden>
            <div class="tb-field-group">
              <label for="tb-migrate-project">${TB.MESSAGES.MODAL.PROJECT_LABEL}<span class="tb-required">*</span></label>
              <select id="tb-migrate-project">
                <option value="">${TB.MESSAGES.MODAL.LOADING_METADATA}</option>
              </select>
            </div>
            <div class="tb-field-group">
              <label for="tb-migrate-subject">${TB.MESSAGES.MODAL.SUBJECT_LABEL}<span class="tb-required">*</span></label>
              <input type="text" id="tb-migrate-subject">
            </div>
            <div class="tb-field-row">
              <div class="tb-field-group">
                <label for="tb-migrate-version">Target Version (Milestone)</label>
                <select id="tb-migrate-version"><option value="">-- Loader --</option></select>
              </div>
              <div id="tb-migrate-due-date-group" class="tb-field-group">
                <label id="tb-migrate-due-date-label" for="tb-migrate-due-date">Due Date</label>
                <input type="date" id="tb-migrate-due-date">
              </div>
            </div>
            <div class="tb-field-row">
              <div class="tb-field-group">
                <label for="tb-migrate-tracker">${TB.MESSAGES.MODAL.TRACKER_LABEL}<span class="tb-required">*</span></label>
                <select id="tb-migrate-tracker"><option value="">-- Loader --</option></select>
              </div>
              <div class="tb-field-group">
                <label for="tb-migrate-priority">${TB.MESSAGES.MODAL.PRIORITY_LABEL}<span class="tb-required">*</span></label>
                <select id="tb-migrate-priority"><option value="">-- Loader --</option></select>
              </div>
            </div>
            <!-- Dynamic Custom Fields Container -->
            <div id="tb-dynamic-fields" class="tb-field-grid"></div>
          </div>
          <div class="tb-field-group">
            <div class="tb-preview-header">
              <label id="tb-preview-label" for="tb-redmine-preview">${TB.MESSAGES.MODAL.PREVIEW_LABEL}</label>
              <button type="button" id="tb-preview-toggle" class="tb-preview-toggle" title="Toggle preview">👁</button>
            </div>
            <div class="tb-preview-container">
              <textarea id="tb-redmine-preview" rows="10"></textarea>
              <div id="tb-redmine-preview-html" class="tb-preview-html" hidden></div>
            </div>
          </div>
          <div id="tb-comments-preview-group" class="tb-field-group" hidden>
            <label for="tb-redmine-comments-preview">Xem trước bình luận</label>
            <textarea id="tb-redmine-comments-preview" rows="8"></textarea>
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
    versionSelect: overlay.querySelector("#tb-migrate-version"),
    migrateSubjectInput: overlay.querySelector("#tb-migrate-subject"),
    migrateDueDateInput: overlay.querySelector("#tb-migrate-due-date"),
    migrateDueDateLabel: overlay.querySelector("#tb-migrate-due-date-label"),
    migrateDueDateGroup: overlay.querySelector("#tb-migrate-due-date-group"),

    // Migration Specific
    commentsPreviewGroup: overlay.querySelector("#tb-comments-preview-group"),
    commentsPreviewTextarea: overlay.querySelector("#tb-redmine-comments-preview"),
    previewLabel: overlay.querySelector("#tb-preview-label"),

    dynamicFieldsContainer: overlay.querySelector("#tb-dynamic-fields"),
    // Backlog Specific UI elements
    backlogNotifyInput: overlay.querySelector("#tb-backlog-notify"),
    issueIdLabel: overlay.querySelector("label[for='tb-redmine-issue-id']"),

    loadingOverlay: overlay.querySelector("#tb-modal-loading"),
    loadingText: overlay.querySelector("#tb-modal-loading-text"),
  };
}

function setModalLoading(isLoading, customText = null) {
  if (!modalElements || !modalElements.loadingOverlay) return;
  modalElements.loadingOverlay.style.display = isLoading ? "flex" : "none";
  if (isLoading && customText) {
    modalElements.loadingText.textContent = customText;
  } else if (isLoading) {
    modalElements.loadingText.textContent = TB.MESSAGES.PROCESSING;
  }
}

function closeModal() {
  const overlay = document.getElementById("tb-redmine-overlay");
  if (overlay) {
    overlay.style.display = "none";
    document.body.classList.remove("tb-modal-open");
  }
}

function openConfirmModal(options) {
  const {
    redmineIssueId = "",
    issueTitle = "",
    previewText = "",
    remainingComments = [],
    hasBatchOption = false,
    isMigration = false,
    commentsCount = 0,
    onCancel,
    onConfirm,
    translateBatch,
    backlogIssueType = "",
    backlogMilestone = "",
  } = options;
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
    batchOptionEl,
    batchOptionCheckbox,
    batchOptionText,
    standardFields,
    migrationFields,
    projectSelect,
    trackerSelect,
    prioritySelect,
    versionSelect,
    migrateSubjectInput,
    migrateDueDateInput,
    commentsPreviewGroup,
    commentsPreviewTextarea,
    previewLabel,
  } = modalElements;
  const previewHtmlEl = overlay.querySelector("#tb-redmine-preview-html");
  const previewToggleBtn = overlay.querySelector("#tb-preview-toggle");

  let currentMode = false;
  let currentNotesList = [previewText];
  let memoizedBatchNotes = null;

  const validateMigrationForm = () => {
    if (!isMigration) return;
    const isProjectLoaded = projectSelect.options.length > 0 && projectSelect.value;
    const isSubjectValid = migrateSubjectInput.value.trim().length > 0;
    const isTranslationDone = !batchOptionCheckbox.checked || !!memoizedBatchNotes;

    const selectedTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;
    const isDueDateRequired = ["Bug", "Task"].includes(selectedTracker);
    const isDueDateFilled = !isDueDateRequired || migrateDueDateInput.value;

    // Validate dynamic mandatory fields
    const dynamicFields = modalElements.dynamicFieldsContainer.querySelectorAll(".tb-cf-input");
    let allRequiredFilled = true;
    dynamicFields.forEach((input) => {
      if (!input.value.trim()) {
        allRequiredFilled = false;
      }
    });

    confirmButton.disabled = !(
      isProjectLoaded &&
      isSubjectValid &&
      isTranslationDone &&
      allRequiredFilled &&
      isDueDateFilled
    );
  };

  // Internal state management for the modal
  function updateModalState() {
    if (isMigration) {
      titleEl.textContent = TB.MESSAGES.MODAL.MIGRATE_TITLE;
      subtitleEl.textContent = TB.MESSAGES.MODAL.MIGRATE_SUBTITLE(commentsCount);
      standardFields.hidden = true;
      migrationFields.hidden = false;
      previewLabel.textContent = "Xem trước mô tả";

      batchOptionEl.hidden = commentsCount === 0;
      batchOptionText.textContent = TB.MESSAGES.MODAL.MIGRATE_COMMENTS_TEXT(commentsCount);

      migrateSubjectInput.value = migrateSubjectInput.value || issueTitle;
      previewTextarea.value = previewText;
      confirmButton.textContent = TB.MESSAGES.MODAL.MIGRATE_CONFIRM;

      if (batchOptionCheckbox.checked) {
        commentsPreviewGroup.hidden = false;
        commentsPreviewTextarea.value = memoizedBatchNotes
          ? memoizedBatchNotes.map((text, i) => `--- Note ${i + 1} ---\n${text}`).join("\n\n")
          : TB.MESSAGES.MODAL.WAITING_TRANSLATION;
      } else {
        commentsPreviewGroup.hidden = true;
      }
      validateMigrationForm();
    } else {
      titleEl.textContent = TB.MESSAGES.MODAL.TITLE;
      subtitleEl.textContent = currentMode
        ? TB.MESSAGES.MODAL.BATCH_SUBTITLE_PREPARING(remainingComments.length + 1)
        : TB.MESSAGES.MODAL.SUBTITLE;
      standardFields.hidden = false;
      migrationFields.hidden = true;
      commentsPreviewGroup.hidden = true;
      previewLabel.textContent = TB.MESSAGES.MODAL.PREVIEW_LABEL;

      if (currentMode) {
        previewTextarea.value = memoizedBatchNotes
          ? [previewText, ...memoizedBatchNotes]
            .map((text, index) => `--- Note ${index + 1} ---\n${text}`)
            .join("\n\n")
          : `${previewText}\n\n${TB.MESSAGES.MODAL.WAITING_TRANSLATION}`;
        currentNotesList = memoizedBatchNotes
          ? [previewText, ...memoizedBatchNotes]
          : [previewText];
      } else {
        previewTextarea.value = previewText;
        currentNotesList = [previewText];
      }
      confirmButton.textContent = currentMode
        ? TB.MESSAGES.MODAL.BATCH_CONFIRM(remainingComments.length + 1)
        : TB.MESSAGES.MODAL.CONFIRM;
    }
  }

  if (isMigration) {
    confirmButton.disabled = true;
    trackerSelect.onchange = () => {
      const selectedTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;
      // Handle defaults when switching tracker
      if (selectedTracker === "Bug") {
        migrateDueDateInput.value = getPlus3WorkingDays();
        modalElements.migrateDueDateLabel.innerHTML = "Due Date<span class=\"tb-required\">*</span>";
      } else if (selectedTracker === "Task") {
        modalElements.migrateDueDateLabel.innerHTML = "Due Date<span class=\"tb-required\">*</span>";
      } else {
        migrateDueDateInput.value = "";
        modalElements.migrateDueDateLabel.innerHTML = "Due Date";
      }

      // Hide Due Date for others
      const isDueDateVisible = ["Bug", "Task"].includes(selectedTracker);
      modalElements.migrateDueDateGroup.style.display = isDueDateVisible ? "block" : "none";

      renderTrackerFields(selectedTracker, validateMigrationForm);
      validateMigrationForm();
    };

    migrateDueDateInput.onchange = validateMigrationForm;

    fetchRedmineMetadataForModal(backlogIssueType, backlogMilestone).then(() => {
      const initialTracker = trackerSelect.options[trackerSelect.selectedIndex]?.text;

      if (initialTracker === "Bug") {
        migrateDueDateInput.value = getPlus3WorkingDays();
        modalElements.migrateDueDateLabel.innerHTML = "Due Date<span class=\"tb-required\">*</span>";
      } else if (initialTracker === "Task") {
        modalElements.migrateDueDateLabel.innerHTML = "Due Date<span class=\"tb-required\">*</span>";
      }

      const isDueDateVisible = ["Bug", "Task"].includes(initialTracker);
      modalElements.migrateDueDateGroup.style.display = isDueDateVisible ? "block" : "none";

      renderTrackerFields(initialTracker, validateMigrationForm);
      validateMigrationForm();
    });

    projectSelect.onchange = (e) => {
      const newProjectId = e.target.value;
      if (newProjectId) {
        updateVersionsDropdown(newProjectId, backlogMilestone);
      }
      validateMigrationForm();
    };
    migrateSubjectInput.oninput = validateMigrationForm;
  }

  // Preview toggle logic
  if (previewToggleBtn && previewHtmlEl) {
    let isHtmlMode = false;
    const escapeHtml = (str) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };
    const renderMarkdownHtml = (text) => {
      let html = escapeHtml(text);
      // Fix lists: wrap consecutive <li> in <ul>
      html = html.replace(/(<li>.*<\/li>)(\s*<li>.*<\/li>)*/g, "<ul>$&</ul>");
      html = html
        .replace(/^#{1,6}\s+(.+)$/gm, "<h$1>$1</h$1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`{3}(\w*)\n?([\s\S]*?)`{3}/g, "<pre>$2</pre>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\">$1</a>")
        .replace(/\n/g, "<br>");
      return html;
    };

    const updatePreviewMode = () => {
      if (isHtmlMode) {
        const currentText = previewTextarea.value;
        previewHtmlEl.innerHTML = renderMarkdownHtml(currentText);
        previewTextarea.hidden = true;
        previewHtmlEl.hidden = false;
        previewToggleBtn.textContent = "📝";
      } else {
        previewTextarea.hidden = false;
        previewHtmlEl.hidden = true;
        previewToggleBtn.textContent = "👁";
      }
    };

    previewToggleBtn.onclick = () => {
      isHtmlMode = !isHtmlMode;
      updatePreviewMode();
    };

    previewTextarea.oninput = () => {
      if (isHtmlMode) {
        updatePreviewMode();
      }
    };
  }

  if (hasBatchOption || (isMigration && commentsCount > 0)) {
    batchOptionEl.hidden = false;
    batchOptionText.textContent = isMigration
      ? TB.MESSAGES.MODAL.MIGRATE_COMMENTS_TEXT(commentsCount)
      : TB.MESSAGES.MODAL.BATCH_TEXT(remainingComments.length + 1);

    batchOptionCheckbox.checked = false;
    batchOptionCheckbox.onchange = async (e) => {
      currentMode = e.target.checked;
      updateModalState();

      if (currentMode && !memoizedBatchNotes) {
        confirmButton.disabled = true;
        try {
          memoizedBatchNotes = await translateBatch(remainingComments);
        } catch (err) {
          showToast(err.message, "error");
          batchOptionCheckbox.checked = false;
          currentMode = false;
        }
        confirmButton.disabled = false;
      }
      updateModalState();
    };
  } else {
    batchOptionEl.hidden = true;
  }

  issueIdInput.value = redmineIssueId;
  issueTitleInput.value = issueTitle;

  let lastCheckedId = "";

  const loadRedmineTitle = async (id) => {
    id = id.trim();
    if (!id || id === lastCheckedId) return;

    lastCheckedId = id;
    confirmButton.disabled = true;

    if (!/^\d+$/.test(id)) {
      issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NUMERIC_ID;
      return;
    }

    issueTitleInput.value = TB.MESSAGES.MODAL.LOADING_TITLE;

    try {
      const res = await sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: `/issues/${id}.json`,
      });
      if (res?.data?.issue?.subject) {
        issueTitleInput.value = res.data.issue.subject;
        confirmButton.disabled = false;
      } else {
        throw new Error("Phản hồi không hợp lệ");
      }
    } catch (err) {
      issueTitleInput.value = TB.MESSAGES.MODAL.ERROR_NOT_FOUND;
      confirmButton.disabled = true;
    }
  };

  issueIdInput.onblur = (e) => loadRedmineTitle(e.target.value);

  const safeClose = () => {
    closeModal();
    onCancel?.();
  };
  closeButton.onclick = safeClose;
  cancelButton.onclick = safeClose;
  overlay.onclick = (e) => {
    if (e.target === overlay) safeClose();
  };

  confirmButton.onclick = async () => {
    setModalLoading(true);
    confirmButton.disabled = true;
    try {
      if (isMigration) {
        const custom_fields = [];
        const dynamicInputs = modalElements.dynamicFieldsContainer.querySelectorAll(".tb-cf-input");
        dynamicInputs.forEach((input) => {
          custom_fields.push({ id: input.getAttribute("data-cfId"), value: input.value.trim() });
        });

        const issueData = {
          project_id: projectSelect.value,
          tracker_id: trackerSelect.value,
          priority_id: prioritySelect.value,
          fixed_version_id: versionSelect.value, // Added Target Version
          subject: migrateSubjectInput.value.trim(),
          description: previewTextarea.value.trim(),
          due_date: migrateDueDateInput.value,
          custom_fields,
        };
        if (!issueData.project_id) {
          showToast(TB.MESSAGES.MODAL.ERROR_SELECT_PROJECT, "error");
          confirmButton.disabled = false;
          return;
        }
        await onConfirm({
          issueData,
          comments: batchOptionCheckbox.checked ? memoizedBatchNotes : [],
        });
      } else {
        const id = issueIdInput.value.trim();
        if (!id) {
          showToast(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID, "error");
          confirmButton.disabled = false;
          return;
        }
        await onConfirm({ redmineIssueId: id, notesList: currentNotesList });
      }
    } catch (err) {
      console.error("[TB-MODAL] Confirm error:", err);
      showToast(err.message || "Đã xảy ra lỗi khi di chuyển", "error");
      confirmButton.disabled = false;
      setModalLoading(false);
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
  const {
    overlay,
    titleEl,
    subtitleEl,
    issueIdInput,
    issueIdLabel,
    previewTextarea,
    confirmButton,
    backlogNotifyInput,
  } = modalElements;

  titleEl.textContent = TB.MESSAGES.MODAL.BACKLOG_TITLE;
  subtitleEl.textContent = TB.MESSAGES.MODAL.BACKLOG_SUBTITLE;
  issueIdLabel.textContent = TB.MESSAGES.MODAL.BACKLOG_ISSUE_KEY_LABEL;
  issueIdInput.value = backlogIssueKey;
  previewTextarea.value = previewText;

  modalElements.standardFields.hidden = false;
  modalElements.migrationFields.hidden = true;
  modalElements.backlogFields.hidden = false;
  confirmButton.disabled = false;

  confirmButton.onclick = async () => {
    const key = issueIdInput.value.trim();
    if (!key) {
      showToast(TB.MESSAGES.MODAL.BACKLOG_EMPTY_KEY, "error");
      return;
    }
    setModalLoading(true);
    confirmButton.disabled = true;
    try {
      await onConfirm({
        backlogIssueKey: key,
        content: previewTextarea.value,
        notifiedUserId: backlogNotifyInput.value.trim(),
      });
    } catch (err) {
      setModalLoading(false);
      confirmButton.disabled = false;
      showToast(err.message, "error");
    }
  };

  modalElements.confirmModal.style.display = "block";
  modalElements.successModal.style.display = "none";
  overlay.style.display = "flex";
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
  successTitleEl.textContent =
    commentCount > 1
      ? TB.MESSAGES.MODAL.BATCH_TITLE_MULTIPLE(commentCount)
      : TB.MESSAGES.MODAL.SUCCESS_TITLE;
  successSubtitleEl.textContent =
    commentCount > 1
      ? TB.MESSAGES.MODAL.BATCH_SUBTITLE_MULTIPLE
      : TB.MESSAGES.MODAL.SUCCESS_SUBTITLE;
  successLinkEl.textContent = redmineUrl;
  successLinkEl.href = redmineUrl;
  successViewButton.onclick = () => {
    window.open(redmineUrl, "_blank");
    closeModal();
  };
  successCloseButton.onclick = () => {
    closeModal();
    onClose?.();
  };
  modalElements.confirmModal.style.display = "none";
  modalElements.successModal.style.display = "block";
  overlay.style.display = "flex";
  setModalLoading(false);
  document.body.classList.add("tb-modal-open");
}

async function fetchRedmineMetadataForModal(backlogIssueType, backlogMilestone) {
  const { projectSelect, trackerSelect, prioritySelect, versionSelect } = modalElements;
  try {
    const [settings, projectsRes, trackersRes, prioritiesRes] = await Promise.all([
      sendRuntimeMessage({ type: "GET_SETTINGS" }).catch(() => ({})),
      sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: "/projects.json?limit=100",
      }).catch((e) => ({ error: e.message, data: { projects: [] } })),
      sendRuntimeMessage({ type: "FETCH_REDMINE_METADATA", endpoint: "/trackers.json" }).catch(
        (e) => ({ error: e.message, data: { trackers: [] } })
      ),
      sendRuntimeMessage({
        type: "FETCH_REDMINE_METADATA",
        endpoint: "/enumerations/issue_priorities.json",
      }).catch(() => ({ data: { issue_priorities: [] } })),
    ]);

    redmineSettings = settings.data || settings;
    customFieldsMetadata = [];

    projectSelect.innerHTML = (projectsRes.data?.projects || [])
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    if (redmineSettings?.defaultProjectId) projectSelect.value = redmineSettings.defaultProjectId;

    // Load versions for the default project
    if (projectSelect.value) {
      updateVersionsDropdown(projectSelect.value, backlogMilestone);
    }

    const allowedTrackers = ["Task", "Bug", "Issue", "CR", "Q/A", "Q&A"];
    trackerSelect.innerHTML = (trackersRes.data?.trackers || [])
      .filter((t) => allowedTrackers.includes(t.name))
      .map((t) => `<option value="${t.id}">${t.name}</option>`)
      .join("");

    // Detect tracker from backlogIssueType
    const mappedTracker = getMappedTrackerName(backlogIssueType || "");
    const matchedOption = Array.from(trackerSelect.options).find(
      (opt) => opt.text.toLowerCase() === mappedTracker.toLowerCase()
    );

    if (matchedOption) {
      trackerSelect.value = matchedOption.value;
    } else {
      // Fallback to Task
      const taskOption = Array.from(trackerSelect.options).find((opt) => opt.text === "Task");
      if (taskOption) {
        trackerSelect.value = taskOption.value;
      }
    }

    prioritySelect.innerHTML = (prioritiesRes.data?.issue_priorities || [])
      .map((p) => `<option value="${p.id}" ${p.is_default ? "selected" : ""}>${p.name}</option>`)
      .join("");
  } catch (error) {
    showToast(`${TB.MESSAGES.MODAL.ERROR_METADATA}: ${error.message}`, "error");
  }
}

async function updateVersionsDropdown(projectId, backlogMilestone) {
  const { versionSelect } = modalElements;
  versionSelect.innerHTML = "<option value=\"\">-- Tải version --</option>";
  try {
    const versionsRes = await sendRuntimeMessage({
      type: "FETCH_REDMINE_METADATA",
      endpoint: `/projects/${projectId}/versions.json`,
    });
    const versions = versionsRes.data?.versions || [];
    versionSelect.innerHTML = "<option value=\"\">-- Trống --</option>";
    versions.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      // Auto-select if version name matches Backlog milestone
      if (backlogMilestone && v.name.toLowerCase().includes(backlogMilestone.toLowerCase())) {
        opt.selected = true;
      }
      versionSelect.appendChild(opt);
    });
  } catch (err) {
    versionSelect.innerHTML = "<option value=\"\">-- Lỗi tải version --</option>";
  }
}

function renderTrackerFields(trackerName, validateCallback) {
  const container = modalElements.dynamicFieldsContainer;
  if (!container) return;
  container.innerHTML = "";

  let manualMap = {};
  if (redmineSettings?.manualFields) {
    try {
      manualMap = JSON.parse(redmineSettings.manualFields);
    } catch (e) {
      /* ignore */
    }
  }

  const configs = {
    Bug: ["Severity", "Role", "QC Activity"],
    "Q/A": ["Severity", "Role", "QC Activity", "Q&A Category"],
    "Q&A": ["Severity", "Role", "QC Activity", "Q&A Category"],
    CR: ["Severity"],
    Task: [],
    Issue: [],
  };

  const fieldsToShow = configs[trackerName] || [];
  if (fieldsToShow.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "grid";
  container.className = "tb-field-grid";

  fieldsToShow.forEach((fieldName) => {
    let cfId = manualMap[fieldName];
    if (!cfId) {
      cfId = customFieldsMetadata.find(
        (cf) => cf.name.toLowerCase() === fieldName.toLowerCase()
      )?.id;
    }
    // Hardcoded fallback for known fields if discovery fails (Case-insensitive)
    if (!cfId && fieldName.toLowerCase() === "q&a category") cfId = 58;

    if (!cfId) return;

    const group = document.createElement("div");
    group.className = "tb-field-group";
    group.innerHTML = `<label>${fieldName}<span class="tb-required">*</span></label>`;

    const optionsMap = {
      Severity: ["Critical", "Major", "Minor", "Trivial"],
      Role: [
        "Business Analysis",
        "Developer",
        "Tester",
        "Quality Assurance",
        "Reporter",
        "Comtor",
        "Customer",
        "Others",
      ],
      "QC Activity": [
        "Document Review",
        "Code Review",
        "Unit Test",
        "Integration Test",
        "Acceptance Test",
      ],
      "Q&A Category": [
        "10_Requirement",
        "20_Database Definition",
        "30_UI Design",
        "40_Logic",
        "50_Technical Issue",
        "60_API",
        "70_DLL",
        "80_Test Data",
        "90_Other",
      ],
    };

    if (optionsMap[fieldName]) {
      const select = document.createElement("select");
      select.className = "tb-cf-input";
      select.dataset.cfId = cfId;
      select.innerHTML = "<option value=\"\">-- Select --</option>";
      optionsMap[fieldName].forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      });
      select.addEventListener("change", validateCallback);
      group.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.className = "tb-cf-input";
      input.dataset.cfId = cfId;
      if (fieldName === "Reproduction Rate") input.value = "100%";
      input.addEventListener("input", validateCallback);
      group.appendChild(input);
    }
    container.appendChild(group);
  });
}

function getPlus3WorkingDays() {
  const d = new Date();
  let count = 0;
  while (count < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  // Use local ISO format YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Global for scripts loaded via manifest
globalThis.TB_MODAL = { openConfirmModal, openBacklogModal, openSuccessModal };

function getMappedTrackerName(backlogType) {
  if (!backlogType) return "";
  const type = backlogType.toLowerCase();
  if (type === "qa") return "Q&A";
  if (type === "bug") return "Bug";
  if (type === "task") return "Task";
  if (type === "cr") return "CR";
  return backlogType;
}
