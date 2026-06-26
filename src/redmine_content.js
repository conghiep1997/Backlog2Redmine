/* globals getTrackers, findIssues, findTimeEntries, deleteTimeEntry, getCurrentUser, logTimeFromReport */

/**
 * Redmine Content Script Entry Point for Backlog2Redmine Extension.
 * Handles extracting Japanese content, syncing to Backlog, and logging time from reports.
 */

const BUTTON_CLASS = "tb-backlog-btn";
const BACKLOG_ICON = TB?.ICONS?.BACKLOG;

let journalObserver = null;

// ====================
// INITIALIZATION
// ====================
injectStyles();
scanAndInjectButtons();
observeJournalActions();
injectLogTimeButton(); // For single report issue
injectMonthlyLogButton(); // For logging the entire month

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (journalObserver) journalObserver.disconnect();
});

// ====================
// GLOBAL HELPER FUNCTIONS
// ====================

/**
 * Retrieves decrypted settings through the background service worker.
 */
async function getSettings() {
  const response = await sendRuntimeMessage({ type: "GET_SETTINGS" });
  return response.data || {};
}

// ====================
// MONTHLY LOGGING FEATURE
// ====================

/**
 * Injects the 'Log Time Tháng' button into the top menu.
 */
function injectMonthlyLogButton() {
  const topMenu = document.querySelector("#top-menu ul");
  if (!topMenu || document.querySelector("#tb-monthly-log-btn")) {
    return;
  }

  const listItem = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#";
  link.id = "tb-monthly-log-btn";
  link.className = "icon icon-time-add";
  link.textContent = "Log Time Tháng";
  link.onclick = (e) => {
    e.preventDefault();
    logTimeForMonth();
  };

  listItem.appendChild(link);
  topMenu.appendChild(listItem);
}

/**
 * Main logic for logging time for the entire month.
 */
async function logTimeForMonth() {
  const settings = await getSettings();
  const { redmineDomain, redmineApiKey, reportProjectId } = settings;

  if (!redmineDomain || !redmineApiKey || !reportProjectId) {
    alert(
      "Lỗi: Vui lòng cấu hình đầy đủ Redmine Domain, API Key, và Report Project ID trong trang Options của extension."
    );
    return;
  }

  const currentMonthLabel = `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
  openMonthlyLogModal({
    monthLabel: currentMonthLabel,
    onDelete: async (modalInstance) => {
      if (
        !confirm(
          "Xác nhận xóa toàn bộ spent time của bạn trong tháng hiện tại?\n\nHành động này chỉ xóa entry thuộc đúng user hiện tại và đúng ngày trong tháng."
        )
      ) {
        return;
      }

      const { startButton, deleteButton, closeButton, progressList, statusText, stats } =
        modalInstance;
      startButton.disabled = true;
      deleteButton.disabled = true;
      closeButton.disabled = true;
      statusText.textContent = "Đang xóa spent time tháng...";

      const updateProgress = (message, type = "info") => {
        const item = document.createElement("div");
        item.className = `tb-monthly-log-progress-item tb-monthly-log-progress-item--${type}`;
        item.textContent = message;
        progressList.appendChild(item);
        progressList.scrollTop = progressList.scrollHeight;
      };

      try {
        const deletedCount = await deleteCurrentMonthSpentTime(
          redmineDomain,
          redmineApiKey,
          updateProgress
        );
        stats.logged.textContent = "0";
        stats.skipped.textContent = String(deletedCount);
        statusText.textContent = "Đã xóa spent time tháng";
        updateProgress(
          `Đã xóa ${deletedCount} spent time entr${deletedCount === 1 ? "y" : "ies"}.`,
          "success"
        );
      } catch (error) {
        statusText.textContent = "Xóa thất bại";
        updateProgress(`Không xóa: ${error.message}`, "error");
      } finally {
        startButton.disabled = false;
        deleteButton.disabled = false;
        closeButton.disabled = false;
      }
    },
    onStart: async (modalInstance) => {
      const { startButton, closeButton, progressList, resultBody, copyButton, statusText, stats } =
        modalInstance;
      startButton.disabled = true;
      startButton.textContent = "Đang xử lý...";
      closeButton.disabled = true;

      const updateProgress = (message, type = "info") => {
        const item = document.createElement("div");
        item.className = `tb-monthly-log-progress-item tb-monthly-log-progress-item--${type}`;
        item.textContent = message;
        progressList.appendChild(item);
        progressList.scrollTop = progressList.scrollHeight;
      };

      const setStat = (key, value) => {
        stats[key].textContent = String(value);
      };

      const renderResultRow = (result) => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        const tasksCell = document.createElement("td");
        const statusCell = document.createElement("td");

        dateCell.textContent = result.date;
        tasksCell.textContent = result.tasks;
        statusCell.textContent = result.status;

        row.append(dateCell, tasksCell, statusCell);
        resultBody.appendChild(row);
      };

      try {
        statusText.textContent = "Đang quét report tháng...";
        updateProgress('Đang tìm kiếm các issue "Report" của tháng...');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const copyRowsByDate = createMonthlyCopyRows(year, month);

        const trackers = await getTrackers(redmineDomain, redmineApiKey);
        const reportTracker = trackers.find((t) => t.name.toLowerCase() === "report");
        if (!reportTracker) {
          throw new Error(
            'Không thể tìm thấy Tracker "Report". Vui lòng kiểm tra cấu hình Redmine.'
          );
        }

        const issues = await findMonthlyReportIssues(redmineDomain, redmineApiKey, {
          projectId: reportProjectId,
          trackerId: reportTracker.id,
          year,
          month,
          updateProgress,
        });

        if (issues.length === 0) {
          statusText.textContent = "Không tìm thấy report";
          updateProgress('Không tìm thấy issue "Report" nào khớp với tháng này.');
          startButton.textContent = "Đã xong";
          closeButton.disabled = false;
          return;
        }

        setStat("reports", issues.length);
        statusText.textContent = `Tìm thấy ${issues.length} report, đang log time...`;
        updateProgress(`Tìm thấy ${issues.length} issue(s). Bắt đầu log time...`);

        const resultsForSheet = [];
        let loggedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const issue of issues) {
          let dateLabel = `issue #${issue.id}`;
          try {
            const reportDate = extractJapaneseReportDate(issue.subject);
            if (!reportDate) {
              throw new Error(`Cannot determine spent_on date from subject: ${issue.subject}`);
            }
            dateLabel = reportDate;

            updateProgress(dateLabel, "date");
            const logResult = await logTimeFromReport(issue.id, true, dateLabel);

            if (logResult.taskIds.length > 0) {
              const status = getLogResultStatusText(logResult);
              resultsForSheet.push({
                date: dateLabel,
                tasks: logResult.taskIds.map((t) => `#${t}`).join(","),
                status,
              });
              copyRowsByDate.set(dateLabel, logResult.taskIds.map((t) => `#${t}`).join(","));
              loggedCount += logResult.loggedTaskIds.length;
              skippedCount += logResult.skippedTaskIds.length;
              setStat("logged", loggedCount);
              setStat("skipped", skippedCount);
              renderResultRow(resultsForSheet[resultsForSheet.length - 1]);
              if (logResult.dayUpserted) {
                updateProgress(
                  `Đã cập nhật spent time từ ${logResult.existingDailyHours}h theo task trong report.`,
                  "success"
                );
              } else if (logResult.dayAlreadyFull) {
                updateProgress(
                  `Bỏ qua: ngày này đã spent time ${logResult.existingDailyHours}h.`,
                  "skip"
                );
              } else {
                updateProgress(
                  `Thành công: ${logResult.loggedTaskIds.length} task(s), bỏ qua trùng: ${logResult.skippedTaskIds.length} task(s)`,
                  "success"
                );
              }
            } else {
              updateProgress("Không có task nào được log.", "skip");
            }
          } catch (error) {
            const partialResult = error.logResult;
            if (partialResult?.taskIds?.length > 0) {
              resultsForSheet.push({
                date: dateLabel,
                tasks: partialResult.taskIds.map((t) => `#${t}`).join(","),
                status: `Partial: logged ${partialResult.loggedTaskIds.length}, failed ${partialResult.failedTasks.length}`,
              });
              copyRowsByDate.set(dateLabel, partialResult.taskIds.map((t) => `#${t}`).join(","));
              loggedCount += partialResult.loggedTaskIds.length;
              skippedCount += partialResult.skippedTaskIds.length;
              failedCount += partialResult.failedTasks.length;
              setStat("logged", loggedCount);
              setStat("skipped", skippedCount);
              setStat("failed", failedCount);
              renderResultRow(resultsForSheet[resultsForSheet.length - 1]);
              updateProgress(
                `Lỗi một phần: đã log ${partialResult.loggedTaskIds.length}, bỏ qua trùng ${partialResult.skippedTaskIds.length}, lỗi ${partialResult.failedTasks.length}. ${error.message}`,
                "error"
              );
            } else {
              failedCount += 1;
              setStat("failed", failedCount);
              updateProgress(`Lỗi: ${error.message}`, "error");
            }
          }
        }

        statusText.textContent = "Hoàn tất";
        updateProgress("Hoàn tất! Dưới đây là dữ liệu để copy vào Timesheet:");

        copyButton.disabled = resultsForSheet.length === 0;
        copyButton.onclick = () => {
          const copyText = [...copyRowsByDate.values()].join("\n");
          navigator.clipboard
            .writeText(copyText)
            .then(() => {
              alert("Đã copy danh sách task theo ngày!");
            })
            .catch(() => {
              copyTextWithSelectionFallback(copyText);
              alert("Đã copy danh sách task theo ngày!");
            });
        };

        startButton.textContent = "Đã xong";
        closeButton.disabled = false;
      } catch (error) {
        statusText.textContent = "Có lỗi";
        updateProgress(`Đã xảy ra lỗi nghiêm trọng: ${error.message}`);
        startButton.textContent = "Lỗi";
        closeButton.disabled = false;
      }
    },
  });
}

function createMonthlyCopyRows(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = new Map();

  for (let day = 1; day <= daysInMonth; day++) {
    rows.set(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "");
  }

  return rows;
}

function copyTextWithSelectionFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } catch (error) {
    console.warn("Copy fallback failed:", error);
  } finally {
    textarea.remove();
  }
}

function getLogResultStatusText(logResult) {
  if (logResult.dayUpserted) {
    return `Updated: replaced existing ${logResult.existingDailyHours}h`;
  }

  if (logResult.dayAlreadyFull) {
    return `Skipped: already ${logResult.existingDailyHours}h`;
  }

  return `Logged ${logResult.loggedTaskIds.length}, skipped ${logResult.skippedTaskIds.length}`;
}

async function deleteCurrentMonthSpentTime(redmineDomain, redmineApiKey, updateProgress) {
  const currentUser = await getCurrentUser(redmineDomain, redmineApiKey);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dates = [...createMonthlyCopyRows(year, month).keys()];
  const entriesToDelete = [];

  updateProgress(`Kiểm tra spent time của ${year}-${String(month).padStart(2, "0")}...`);

  for (const spentOn of dates) {
    const entries = await findTimeEntries(redmineDomain, redmineApiKey, {
      spent_on: spentOn,
      user_id: currentUser.id,
      limit: 100,
    });

    for (const entry of entries) {
      if (!isSafeMonthlyDeleteEntry(entry, currentUser, spentOn)) {
        throw new Error(
          `Entry #${entry?.id || "unknown"} không xác nhận được đúng user/ngày ${spentOn}.`
        );
      }
      entriesToDelete.push(entry);
    }
  }

  updateProgress(`Tìm thấy ${entriesToDelete.length} spent time entries cần xóa.`);

  for (const entry of entriesToDelete) {
    await deleteTimeEntry(redmineDomain, redmineApiKey, entry.id);
  }

  return entriesToDelete.length;
}

function isSafeMonthlyDeleteEntry(entry, currentUser, spentOn) {
  const entryUserId = entry?.user?.id ?? entry?.user_id;
  return (
    !!entry?.id &&
    !!entryUserId &&
    !!currentUser?.id &&
    entry.spent_on === spentOn &&
    Number(entryUserId) === Number(currentUser.id)
  );
}

function openMonthlyLogModal({ monthLabel, onStart, onDelete }) {
  const overlay = document.createElement("div");
  overlay.className = "tb-monthly-log-overlay";
  overlay.innerHTML = `
    <section class="tb-monthly-log-dialog" role="dialog" aria-modal="true" aria-labelledby="tb-monthly-log-title">
      <header class="tb-monthly-log-header">
        <div>
          <p class="tb-monthly-log-kicker">Redmine spent time</p>
          <h2 id="tb-monthly-log-title">Log time tháng ${monthLabel}</h2>
          <p id="tb-monthly-log-status" class="tb-monthly-log-status">Sẵn sàng quét các report trong tháng hiện tại.</p>
        </div>
        <button type="button" class="tb-monthly-log-close" aria-label="Đóng">&times;</button>
      </header>
      <div class="tb-monthly-log-body">
        <div class="tb-monthly-log-stats">
          <div><span id="tb-monthly-stat-reports">0</span><small>Reports</small></div>
          <div><span id="tb-monthly-stat-logged">0</span><small>Logged</small></div>
          <div><span id="tb-monthly-stat-skipped">0</span><small>Skipped</small></div>
          <div><span id="tb-monthly-stat-failed">0</span><small>Failed</small></div>
        </div>
        <div class="tb-monthly-log-grid">
          <section class="tb-monthly-log-panel">
            <div class="tb-monthly-log-panel-title">Tiến trình</div>
            <div id="tb-monthly-log-progress" class="tb-monthly-log-progress"></div>
          </section>
          <section class="tb-monthly-log-panel">
            <div class="tb-monthly-log-panel-title">Timesheet output</div>
            <div class="tb-monthly-log-table-wrap">
              <table id="timesheet-results-table" class="tb-monthly-log-table">
                <thead>
                  <tr><th>Ngày</th><th>Tasks</th><th>Trạng thái</th></tr>
                </thead>
                <tbody id="tb-monthly-log-results"></tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <footer class="tb-monthly-log-footer">
        <button type="button" id="tb-monthly-log-delete" class="tb-btn tb-btn-danger">Delete spent time tháng</button>
        <button type="button" id="tb-monthly-log-copy" class="tb-btn tb-btn-secondary" disabled>Copy bảng</button>
        <button type="button" id="tb-monthly-log-start" class="tb-btn tb-btn-primary">Bắt đầu log</button>
      </footer>
    </section>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("tb-modal-open");

  const closeButton = overlay.querySelector(".tb-monthly-log-close");
  const startButton = overlay.querySelector("#tb-monthly-log-start");
  const modalInstance = {
    overlay,
    startButton,
    closeButton,
    deleteButton: overlay.querySelector("#tb-monthly-log-delete"),
    copyButton: overlay.querySelector("#tb-monthly-log-copy"),
    statusText: overlay.querySelector("#tb-monthly-log-status"),
    progressList: overlay.querySelector("#tb-monthly-log-progress"),
    resultBody: overlay.querySelector("#tb-monthly-log-results"),
    table: overlay.querySelector("#timesheet-results-table"),
    stats: {
      reports: overlay.querySelector("#tb-monthly-stat-reports"),
      logged: overlay.querySelector("#tb-monthly-stat-logged"),
      skipped: overlay.querySelector("#tb-monthly-stat-skipped"),
      failed: overlay.querySelector("#tb-monthly-stat-failed"),
    },
  };

  const close = () => {
    overlay.remove();
    document.body.classList.remove("tb-modal-open");
  };
  closeButton.onclick = close;
  overlay.onclick = (event) => {
    if (event.target === overlay && !closeButton.disabled) close();
  };
  startButton.onclick = () => onStart(modalInstance);
  modalInstance.deleteButton.onclick = () => onDelete(modalInstance);

  return modalInstance;
}

async function findMonthlyReportIssues(
  redmineDomain,
  redmineApiKey,
  { projectId, trackerId, year, month, updateProgress }
) {
  const searchTerms = [`${year}年${month}月`, `${year}年${String(month).padStart(2, "0")}月`];
  const uniqueTerms = [...new Set(searchTerms)];
  const issuesById = new Map();

  for (const subjectQuery of uniqueTerms) {
    updateProgress(`Tìm report theo subject chứa "${subjectQuery}"`);
    const issues = await findIssues(redmineDomain, redmineApiKey, {
      project_id: projectId,
      tracker_id: trackerId,
      subject: `~${subjectQuery}`,
      status_id: "*",
      limit: 100,
    });

    for (const issue of issues) {
      issuesById.set(String(issue.id), issue);
    }
  }

  const issuesByDate = new Map();
  for (const issue of issuesById.values()) {
    const reportDate = extractJapaneseReportDate(issue.subject);
    if (!reportDate || !isDateInMonth(reportDate, year, month)) {
      continue;
    }

    if (!issuesByDate.has(reportDate)) {
      issuesByDate.set(reportDate, issue);
    }
  }

  return [...issuesByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([, issue]) => issue);
}

function extractJapaneseReportDate(subject = "") {
  const dateMatch = subject.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isDateInMonth(dateText, year, month) {
  return dateText.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}

// ====================
// SINGLE REPORT LOGGING
// ====================

async function injectLogTimeButton() {
  const issuePageMatch = window.location.pathname.match(/\/issues\/(\d+)/);
  if (!issuePageMatch) return;

  const issueId = issuePageMatch[1];

  const isReport =
    document.querySelector("#attributes td.tracker")?.innerText.trim().toLowerCase() === "report";
  if (isReport) {
    const container = document.querySelector("div.contextual");
    if (!container || container.querySelector("#tb-log-time-btn")) return;

    const button = document.createElement("a");
    button.href = "#";
    button.id = "tb-log-time-btn";
    button.className = "icon icon-time-add";
    button.innerText = "Log 8h From Report";

    button.onclick = async (e) => {
      e.preventDefault();
      button.innerText = "Processing...";
      button.classList.add("disabled");
      try {
        await logTimeFromReport(issueId, false); // false for single, interactive mode
        button.innerText = "Success!";
      } catch (error) {
        button.innerText = "Error! Check Console";
        console.error("Failed to log time from report:", error);
      }
    };

    Object.assign(button.style, { marginRight: "8px", fontWeight: "bold" });
    container.prepend(button);
  }
}

// ====================
// BACKLOG SYNCING FEATURE (Existing logic)
// ====================

function observeJournalActions() {
  const targetContainer =
    document.querySelector("#history") || document.querySelector(".journals") || document.body;

  journalObserver = new MutationObserver((mutations) => {
    let shouldRescan = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("div.journal div.contextual")) {
            injectButtonIfNeeded(node);
          } else {
            node.querySelectorAll?.("div.journal div.contextual").forEach(injectButtonIfNeeded);
            shouldRescan = true;
          }
        }
      }
    }
    if (shouldRescan) {
      scanAndInjectButtons();
    }
  });
  journalObserver.observe(targetContainer, { childList: true, subtree: true });
}

function scanAndInjectButtons() {
  document.querySelectorAll("div.journal div.contextual").forEach(injectButtonIfNeeded);
}

function injectButtonIfNeeded(actionsEl) {
  if (!actionsEl || actionsEl.dataset.tbInjected === "1") return;

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
  quoteBtn ? quoteBtn.before(button) : actionsEl.appendChild(button);
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
    const attachments = extractRedmineAttachments(commentContentEl);
    const result = await sendRuntimeMessage({
      type: "EXTRACT_JAPANESE_CONTENT",
      commentText: rawText,
    });
    openBacklogModal({
      backlogIssueKey,
      previewText: result.data.previewText,
      attachments,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({
        backlogIssueKey: confirmedKey,
        content,
        notifiedUserId,
        attachments: confirmedAttachments,
      }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_BACKLOG",
          backlogIssueKey: confirmedKey,
          content,
          notifiedUserId,
          attachments: confirmedAttachments,
        });
        await openSuccessModal({
          redmineUrl: sendResult.data.backlogUrl,
          onClose: () => setButtonLoading(button, false),
          isBacklog: true,
        });
      },
    });
    setButtonLoading(button, false);
  } catch (err) {
    setButtonLoading(button, false);
    showToast(err.message, "error");
  }
}

function extractRedmineAttachments(contentEl) {
  const attachments = [];
  if (!contentEl) return attachments;

  const attachmentLinks = contentEl.querySelectorAll("a[href*='/attachments/download']");
  attachmentLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const text = link.innerText.trim();
    if (href && text) {
      const attachmentId = href.match(/\/attachments\/download\/(\d+)/)?.[1];
      if (attachmentId) {
        attachments.push({
          id: attachmentId,
          filename: text,
          url: href,
        });
      }
    }
  });

  const images = contentEl.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.includes("/attachments/download")) {
      const attachmentId = src.match(/\/attachments\/download\/(\d+)/)?.[1];
      const filename = img.getAttribute("alt") || `image_${attachmentId}`;
      if (attachmentId && !attachments.find((a) => a.id === attachmentId)) {
        attachments.push({
          id: attachmentId,
          filename,
          url: src,
          isImage: true,
        });
      }
    }
  });

  return attachments;
}

function findBacklogKeyInPage() {
  const patterns = [/([A-Z0-9_]+-[0-9]+)/];
  const title = document.querySelector("#content h2")?.innerText || "";
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1];
  }
  const desc = document.querySelector("div.description div.wiki")?.innerText || "";
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[1];
  }
  return "";
}

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.5" : "1";
  btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
  btn.innerHTML = isLoading
    ? `<span class="tb-loading">${TB.MESSAGES.PROCESSING}</span>`
    : btn.dataset.originalHtml;
}
