/* globals getTrackers, findIssues, logTimeFromReport */

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
 * Retrieves all necessary settings from chrome.storage.local.
 */
async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["redmineDomain", "redmineApiKey", "reportProjectId"], (items) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(items);
    });
  });
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

  const modal = openConfirmModal({
    issueTitle: `Log Time cho Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    previewText:
      '<div id="monthly-log-progress" style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; background: #f9f9f9;">Khởi tạo...</div>',
    confirmLabel: "Bắt đầu",
    cancelLabel: "Hủy",
    onConfirm: async (modalInstance) => {
      const progressDiv = modalInstance.modalEl.querySelector("#monthly-log-progress");
      const confirmBtn = modalInstance.modalEl.querySelector(".tb-modal-confirm");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Đang xử lý...";

      const updateProgress = (message) => {
        progressDiv.innerHTML += `<br>${message}`;
        progressDiv.scrollTop = progressDiv.scrollHeight; // Auto-scroll
      };

      try {
        updateProgress('Đang tìm kiếm các issue "Report" của tháng...');
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        // UPDATED: Search query no longer uses the hardcoded "日報s" prefix.
        // It now flexibly searches for the year and month within the correct project and tracker.
        const subjectQuery = `${year}年${month}月`;

        const trackers = await getTrackers(redmineDomain, redmineApiKey);
        const reportTracker = trackers.find((t) => t.name.toLowerCase() === "report");
        if (!reportTracker) {
          throw new Error(
            'Không thể tìm thấy Tracker "Report". Vui lòng kiểm tra cấu hình Redmine.'
          );
        }

        const issues = await findIssues(redmineDomain, redmineApiKey, {
          project_id: reportProjectId,
          tracker_id: reportTracker.id,
          subject: `~${subjectQuery}`,
          status_id: "*",
          limit: 100,
        });

        if (issues.length === 0) {
          updateProgress('Không tìm thấy issue "Report" nào khớp với tháng này.');
          confirmBtn.textContent = "Đã xong";
          return;
        }

        updateProgress(`Tìm thấy ${issues.length} issue(s). Bắt đầu log time...`);

        const resultsForSheet = [];

        for (const issue of issues) {
          try {
            const dateMatch = issue.subject.match(/(\d{4})年(\d{2})月(\d{2})日/);
            let dateLabel = `issue #${issue.id}`;
            if (dateMatch) {
              dateLabel = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            }

            updateProgress(`- Đang xử lý: <b>${dateLabel}</b>`);
            const loggedTasks = await logTimeFromReport(issue.id, true);

            if (loggedTasks.length > 0) {
              resultsForSheet.push({
                date: dateLabel,
                tasks: loggedTasks.map((t) => `#${t}`).join(","),
              });
              updateProgress(`  => Thành công: ${loggedTasks.length} task(s)`);
            } else {
              updateProgress("  => Không có task nào được log.");
            }
          } catch (error) {
            updateProgress(`  => Lỗi: ${error.message}`);
          }
        }

        updateProgress("<br><b>Hoàn tất! Dưới đây là dữ liệu để copy vào Timesheet:</b>");

        let tableHtml =
          '<div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; margin-top: 10px;"><table id="timesheet-results-table" style="width:100%; border-collapse: collapse;"><thead><tr><th style="border:1px solid #ccc; padding:8px; position: sticky; top: 0; background: #f0f0f0;">Ngày</th><th style="border:1px solid #ccc; padding:8px; position: sticky; top: 0; background: #f0f0f0;">Tasks</th></tr></thead><tbody>';
        resultsForSheet.sort((a, b) => a.date.localeCompare(b.date));
        for (const result of resultsForSheet) {
          tableHtml += `<tr><td style="border:1px solid #ccc; padding:8px;">${result.date}</td><td style="border:1px solid #ccc; padding:8px;">${result.tasks}</td></tr>`;
        }
        tableHtml +=
          '</tbody></table></div><br><button id="copy-ts-btn" class="secondary">Copy Bảng</button>';

        progressDiv.innerHTML += `<br>${tableHtml}`;

        document.getElementById("copy-ts-btn").onclick = () => {
          const table = document.getElementById("timesheet-results-table");
          const range = document.createRange();
          range.selectNode(table);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          try {
            document.execCommand("copy");
            alert("Đã copy nội dung bảng!");
          } catch (err) {
            alert("Không thể copy tự động. Vui lòng copy thủ công.");
          }
          window.getSelection().removeAllRanges();
        };

        confirmBtn.textContent = "Đã xong";
      } catch (error) {
        updateProgress(`<b>Đã xảy ra lỗi nghiêm trọng:</b> ${error.message}`);
        confirmBtn.textContent = "Lỗi";
      }
    },
  });
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
    const result = await sendRuntimeMessage({
      type: "EXTRACT_JAPANESE_CONTENT",
      commentText: rawText,
    });
    openBacklogModal({
      backlogIssueKey,
      previewText: result.data.previewText,
      onCancel: () => setButtonLoading(button, false),
      onConfirm: async ({ backlogIssueKey: confirmedKey, content, notifiedUserId }) => {
        const sendResult = await sendRuntimeMessage({
          type: "SEND_TO_BACKLOG",
          backlogIssueKey: confirmedKey,
          content,
          notifiedUserId,
        });
        openSuccessModal({
          redmineUrl: sendResult.data.backlogUrl,
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
