document.addEventListener("DOMContentLoaded", () => {
  const oauthStatusEl = document.getElementById("oauthStatus");
  const oauthBtn = document.getElementById("oauthBtn");
  const logArea = document.getElementById("logArea");
  const form = document.getElementById("converterForm");

  const sourceSpreadsheetInput = document.getElementById("sourceSpreadsheet");
  const sourceSheetNameInput = document.getElementById("sourceSheetName");
  const sourceStartRowInput = document.getElementById("sourceStartRow");

  const destSpreadsheetInput = document.getElementById("destSpreadsheet");
  const destSheetNameInput = document.getElementById("destSheetName");
  const destStartRowInput = document.getElementById("destStartRow");
  const clearDestCheckbox = document.getElementById("clearDest");

  const testConnBtn = document.getElementById("testConnBtn");
  const convertBtn = document.getElementById("convertBtn");

  const STORAGE_KEYS = {
    SOURCE_URL: "tc_source_url",
    SOURCE_SHEET: "tc_source_sheet",
    SOURCE_ROW: "tc_source_row",
    DEST_URL: "tc_dest_url",
    DEST_SHEET: "tc_dest_sheet",
    DEST_ROW: "tc_dest_row",
    CLEAR_DEST: "tc_clear_dest",
  };

  let currentToken = null;

  // Initialize Guide Snippets
  const extId = chrome.runtime.id;
  const extIdDisplay = document.getElementById("extIdDisplay");
  const manifestSnippet = document.getElementById("manifestSnippet");
  if (extIdDisplay && manifestSnippet) {
    extIdDisplay.textContent = extId;
    manifestSnippet.textContent = JSON.stringify(
      {
        oauth2: {
          client_id: "DÁN_OAUTH_CLIENT_ID_VÀO_ĐÂY.apps.googleusercontent.com",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        },
      },
      null,
      2
    );
  }

  // Initialize
  checkOAuthToken(false);
  loadSavedInputs();

  // Attach Event Listeners
  oauthBtn.addEventListener("click", handleOAuthButtonClick);
  testConnBtn.addEventListener("click", handleTestConnection);
  form.addEventListener("submit", handleConvertSubmit);

  // Auto-save form inputs on change
  [
    sourceSpreadsheetInput,
    sourceSheetNameInput,
    sourceStartRowInput,
    destSpreadsheetInput,
    destSheetNameInput,
    destStartRowInput,
    clearDestCheckbox,
  ].forEach((input) => {
    input.addEventListener("change", saveInputs);
  });

  // Log functions
  function addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = `log-line log-${type}`;
    line.textContent = `[${timestamp}] ${message}`;
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  }

  function clearLogs() {
    logArea.innerHTML = "";
  }

  // Load / Save Config
  function loadSavedInputs() {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (res) => {
      if (res[STORAGE_KEYS.SOURCE_URL]) {
        sourceSpreadsheetInput.value = res[STORAGE_KEYS.SOURCE_URL];
      }
      if (res[STORAGE_KEYS.SOURCE_SHEET]) {
        sourceSheetNameInput.value = res[STORAGE_KEYS.SOURCE_SHEET];
      }
      if (res[STORAGE_KEYS.SOURCE_ROW] !== undefined) {
        sourceStartRowInput.value = res[STORAGE_KEYS.SOURCE_ROW];
      }
      if (res[STORAGE_KEYS.DEST_URL]) {
        destSpreadsheetInput.value = res[STORAGE_KEYS.DEST_URL];
      }
      if (res[STORAGE_KEYS.DEST_SHEET]) {
        destSheetNameInput.value = res[STORAGE_KEYS.DEST_SHEET];
      }
      if (res[STORAGE_KEYS.DEST_ROW] !== undefined) {
        destStartRowInput.value = res[STORAGE_KEYS.DEST_ROW];
      }
      if (res[STORAGE_KEYS.CLEAR_DEST] !== undefined) {
        clearDestCheckbox.checked = res[STORAGE_KEYS.CLEAR_DEST];
      }
    });
  }

  function saveInputs() {
    chrome.storage.local.set({
      [STORAGE_KEYS.SOURCE_URL]: sourceSpreadsheetInput.value,
      [STORAGE_KEYS.SOURCE_SHEET]: sourceSheetNameInput.value,
      [STORAGE_KEYS.SOURCE_ROW]: parseInt(sourceStartRowInput.value, 10) || 2,
      [STORAGE_KEYS.DEST_URL]: destSpreadsheetInput.value,
      [STORAGE_KEYS.DEST_SHEET]: destSheetNameInput.value,
      [STORAGE_KEYS.DEST_ROW]: parseInt(destStartRowInput.value, 10) || 3,
      [STORAGE_KEYS.CLEAR_DEST]: clearDestCheckbox.checked,
    });
  }

  // Authentication Flow
  async function checkOAuthToken(interactive = false) {
    try {
      oauthStatusEl.textContent = "Đang kiểm tra kết nối...";
      oauthStatusEl.className = "";
      oauthStatusEl.style.color = "var(--muted)";

      if (interactive) {
        currentToken = await TB_SHEETS_API.launchOAuthFlow();
      } else {
        currentToken = await TB_SHEETS_API.getAccessToken();
      }

      oauthStatusEl.textContent = "Đã kết nối";
      oauthStatusEl.style.color = "#137333";
      oauthBtn.textContent = "🔌 Ngắt kết nối";
      oauthBtn.className = "oauth-btn connected";
      return true;
    } catch (err) {
      currentToken = null;
      oauthStatusEl.textContent = "Chưa kết nối";
      oauthStatusEl.style.color = "var(--danger-text)";
      oauthBtn.textContent = "🔑 Kết nối Google";
      oauthBtn.className = "oauth-btn";
      if (interactive) {
        addLog(err.message, "error");
      }
      return false;
    }
  }

  async function handleOAuthButtonClick() {
    if (currentToken) {
      // Disconnect
      try {
        await TB_SHEETS_API.revokeToken(currentToken);
        currentToken = null;
        addLog("Đã hủy bỏ token và ngắt kết nối tài khoản Google.", "warning");
        await checkOAuthToken(false);
      } catch (err) {
        addLog("Lỗi khi ngắt kết nối: " + err.message, "error");
      }
    } else {
      // Connect
      addLog("Đang kích hoạt cửa sổ xác thực của Google...", "info");
      await checkOAuthToken(true);
      if (currentToken) {
        addLog("Kết nối tài khoản Google thành công!", "success");
      }
    }
  }

  // Test Connection
  async function handleTestConnection() {
    clearLogs();
    addLog("Bắt đầu kiểm tra kết nối...", "info");

    const sourceRaw = sourceSpreadsheetInput.value;
    const destRaw = destSpreadsheetInput.value;
    const sourceSheetName = sourceSheetNameInput.value;
    const destSheetName = destSheetNameInput.value;

    const sourceId = TB_SHEETS_API.extractSpreadsheetId(sourceRaw);
    const destId = TB_SHEETS_API.extractSpreadsheetId(destRaw);

    if (!sourceId) {
      addLog("Spreadsheet ID hoặc URL nguồn không hợp lệ.", "error");
      return;
    }
    if (!destId) {
      addLog("Spreadsheet ID hoặc URL đích không hợp lệ.", "error");
      return;
    }

    try {
      if (!currentToken) {
        addLog("Chưa kết nối tài khoản Google. Đang yêu cầu đăng nhập...", "warning");
        const success = await checkOAuthToken(true);
        if (!success || !currentToken) {
          addLog("Không thể tiếp tục do không có quyền truy cập.", "error");
          return;
        }
      }

      addLog(`Đang kết nối Spreadsheet Nguồn (ID: ${sourceId})...`, "info");
      const sourceMeta = await TB_SHEETS_API.getSpreadsheetMetadata(sourceId, currentToken);
      addLog(`✓ Đã kết nối Spreadsheet Nguồn: "${sourceMeta.properties.title}"`, "success");

      addLog(`Kiểm tra Sheet Nguồn "${sourceSheetName}"...`, "info");
      await TB_SHEETS_API.getSheetIdByName(sourceMeta, sourceSheetName);
      addLog("✓ Sheet Nguồn hợp lệ.", "success");

      addLog(`Đang kết nối Spreadsheet Đích (ID: ${destId})...`, "info");
      const destMeta = await TB_SHEETS_API.getSpreadsheetMetadata(destId, currentToken);
      addLog(`✓ Đã kết nối Spreadsheet Đích: "${destMeta.properties.title}"`, "success");

      addLog(`Kiểm tra Sheet Đích "${destSheetName}"...`, "info");
      await TB_SHEETS_API.getSheetIdByName(destMeta, destSheetName);
      addLog("✓ Sheet Đích hợp lệ.", "success");

      addLog("🎉 KIỂM TRA KẾT NỐI THÀNH CÔNG! Tất cả cấu hình đều chính xác.", "success");
    } catch (err) {
      addLog(`❌ Kiểm tra thất bại: ${err.message}`, "error");
    }
  }

  // Convert Action
  async function handleConvertSubmit(e) {
    e.preventDefault();
    clearLogs();

    const sourceRaw = sourceSpreadsheetInput.value;
    const destRaw = destSpreadsheetInput.value;
    const sourceSheetName = sourceSheetNameInput.value;
    const destSheetName = destSheetNameInput.value;
    const sourceStartRow = parseInt(sourceStartRowInput.value, 10);
    const destStartRow = parseInt(destStartRowInput.value, 10);
    const clearDest = clearDestCheckbox.checked;

    if (isNaN(sourceStartRow) || sourceStartRow < 1) {
      addLog("Dòng bắt đầu của sheet nguồn phải lớn hơn hoặc bằng 1.", "error");
      return;
    }
    if (isNaN(destStartRow) || destStartRow < 1) {
      addLog("Dòng bắt đầu của sheet đích phải lớn hơn hoặc bằng 1.", "error");
      return;
    }

    const sourceId = TB_SHEETS_API.extractSpreadsheetId(sourceRaw);
    const destId = TB_SHEETS_API.extractSpreadsheetId(destRaw);

    if (!sourceId) {
      addLog("Spreadsheet ID hoặc URL nguồn không hợp lệ.", "error");
      return;
    }
    if (!destId) {
      addLog("Spreadsheet ID hoặc URL đích không hợp lệ.", "error");
      return;
    }

    // Disable UI
    convertBtn.disabled = true;
    convertBtn.textContent = "⏳ Đang chuyển đổi...";
    testConnBtn.disabled = true;

    try {
      if (!currentToken) {
        addLog("Chưa kết nối tài khoản Google. Đang yêu cầu đăng nhập...", "warning");
        const success = await checkOAuthToken(true);
        if (!success || !currentToken) {
          addLog("Lỗi: Không lấy được quyền truy cập OAuth.", "error");
          return;
        }
      }

      // Step 1: Read data
      addLog("Đang đọc dữ liệu từ sheet nguồn...", "info");
      // Read all rows. We'll slice them during conversion.
      const rows = await TB_SHEETS_API.readSheetValues(sourceId, sourceSheetName, "", currentToken);
      addLog(`✓ Đã đọc được ${rows.length} dòng từ sheet nguồn (bao gồm cả header).`, "success");

      if (rows.length === 0 || rows.length < sourceStartRow) {
        addLog(
          `Cảnh báo: Sheet nguồn trống hoặc không có dữ liệu kể từ dòng ${sourceStartRow}.`,
          "warning"
        );
        addLog("Quá trình kết thúc.", "info");
        return;
      }

      // Step 2: Convert
      addLog("Đang thực hiện convert dữ liệu theo mapping mới...", "info");
      // startRow is 1-indexed, array index is 0-indexed, so we subtract 1.
      const convertedRows = TB_TESTCASE_CONVERTER.convertRows(rows, sourceStartRow - 1);
      addLog(
        `✓ Đã convert thành công ${convertedRows.length} dòng testcase (đã loại bỏ dòng trống).`,
        "success"
      );

      if (convertedRows.length === 0) {
        addLog("Dữ liệu sau khi convert rỗng. Không có gì để ghi.", "warning");
        return;
      }

      // Step 3: Clear dest if checked
      if (clearDest) {
        addLog(`Đang xóa dữ liệu cũ tại sheet đích bắt đầu từ dòng A${destStartRow}...`, "info");
        await TB_SHEETS_API.clearSheetRange(destId, destSheetName, destStartRow, currentToken);
        addLog("✓ Đã dọn dẹp dữ liệu cũ.", "success");
      }

      // Step 4: Write values
      addLog(
        `Đang ghi ${convertedRows.length} dòng dữ liệu sang sheet đích kể từ dòng A${destStartRow}...`,
        "info"
      );
      await TB_SHEETS_API.writeSheetValues(
        destId,
        destSheetName,
        destStartRow,
        convertedRows,
        currentToken
      );

      addLog(
        `🎉 HOÀN THÀNH! Đã ghi thành công ${convertedRows.length} dòng sang sheet đích.`,
        "success"
      );
    } catch (err) {
      addLog(`❌ Thất bại: ${err.message}`, "error");
    } finally {
      // Re-enable UI
      convertBtn.disabled = false;
      convertBtn.textContent = "⚡ Bắt đầu chuyển đổi";
      testConnBtn.disabled = false;
    }
  }
});
