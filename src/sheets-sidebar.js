document.addEventListener("DOMContentLoaded", () => {
  const oauthStatusEl = document.getElementById("oauthStatus");
  const oauthBtn = document.getElementById("oauthBtn");
  const logArea = document.getElementById("logArea");

  const sourceSpreadsheetInput = document.getElementById("sourceSpreadsheet");
  const sourceSheetNameInput = document.getElementById("sourceSheetName");
  const sourceStartRowInput = document.getElementById("sourceStartRow");

  const destSpreadsheetInput = document.getElementById("destSpreadsheet");
  const destSheetNameInput = document.getElementById("destSheetName");
  const destStartRowInput = document.getElementById("destStartRow");
  const clearDestCheckbox = document.getElementById("clearDest");

  // Mapping fields
  const mapNoInput = document.getElementById("mapNo");
  const mapLevel3Input = document.getElementById("mapLevel3");
  const mapLevel2_1Input = document.getElementById("mapLevel2_1");
  const mapLevel2_2Input = document.getElementById("mapLevel2_2");
  const mapLevel4Input = document.getElementById("mapLevel4");
  const mapPreconditionInput = document.getElementById("mapPrecondition");
  const mapScenariosInput = document.getElementById("mapScenarios");
  const mapLevel7Input = document.getElementById("mapLevel7");
  const mapLevel8Input = document.getElementById("mapLevel8");

  const testConnBtn = document.getElementById("testConnBtn");
  const convertBtn = document.getElementById("convertBtn");

  const getSourceUrlBtn = document.getElementById("getSourceUrlBtn");
  const getDestUrlBtn = document.getElementById("getDestUrlBtn");

  const STORAGE_KEYS = {
    SOURCE_URL: "tc_sidebar_source_url",
    SOURCE_SHEET: "tc_sidebar_source_sheet",
    SOURCE_ROW: "tc_sidebar_source_row",
    DEST_URL: "tc_sidebar_dest_url",
    DEST_SHEET: "tc_sidebar_dest_sheet",
    DEST_ROW: "tc_sidebar_dest_row",
    CLEAR_DEST: "tc_sidebar_clear_dest",
    MAP_NO: "tc_map_no",
    MAP_LEVEL3: "tc_map_level3",
    MAP_LEVEL2_1: "tc_map_level2_1",
    MAP_LEVEL2_2: "tc_map_level2_2",
    MAP_LEVEL4: "tc_map_level4",
    MAP_PRECONDITION: "tc_map_precondition",
    MAP_SCENARIOS: "tc_map_scenarios",
    MAP_LEVEL7: "tc_map_level7",
    MAP_LEVEL8: "tc_map_level8",
  };

  let currentToken = null;
  let activeUrlInput = null;

  // Initialize
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

  checkOAuthToken(false);
  loadSavedInputs();

  // Attach Event Listeners
  oauthBtn.addEventListener("click", handleOAuthButtonClick);
  testConnBtn.addEventListener("click", handleTestConnection);
  convertBtn.addEventListener("click", handleConvertSubmit);

  getSourceUrlBtn.addEventListener("click", () => requestUrlFromParent(sourceSpreadsheetInput));
  getDestUrlBtn.addEventListener("click", () => requestUrlFromParent(destSpreadsheetInput));

  // Auto-save form inputs on change
  [
    sourceSpreadsheetInput,
    sourceSheetNameInput,
    sourceStartRowInput,
    destSpreadsheetInput,
    destSheetNameInput,
    destStartRowInput,
    clearDestCheckbox,
    mapNoInput,
    mapLevel3Input,
    mapLevel2_1Input,
    mapLevel2_2Input,
    mapLevel4Input,
    mapPreconditionInput,
    mapScenariosInput,
    mapLevel7Input,
    mapLevel8Input,
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

  // Column conversion helper: A -> 0, B -> 1, Z -> 25, AA -> 26
  function columnLetterToNumber(letter) {
    if (!letter) return -1;
    const str = String(letter).trim().toUpperCase();
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 26 + (str.charCodeAt(i) - 64);
    }
    return num - 1; // 0-indexed
  }

  // Load / Save Config
  function loadSavedInputs() {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (res) => {
      if (res[STORAGE_KEYS.SOURCE_URL]) sourceSpreadsheetInput.value = res[STORAGE_KEYS.SOURCE_URL];
      if (res[STORAGE_KEYS.SOURCE_SHEET]) {
        sourceSheetNameInput.value = res[STORAGE_KEYS.SOURCE_SHEET];
      }
      if (res[STORAGE_KEYS.SOURCE_ROW] !== undefined) {
        sourceStartRowInput.value = res[STORAGE_KEYS.SOURCE_ROW];
      }
      if (res[STORAGE_KEYS.DEST_URL]) destSpreadsheetInput.value = res[STORAGE_KEYS.DEST_URL];
      if (res[STORAGE_KEYS.DEST_SHEET]) destSheetNameInput.value = res[STORAGE_KEYS.DEST_SHEET];
      if (res[STORAGE_KEYS.DEST_ROW] !== undefined) {
        destStartRowInput.value = res[STORAGE_KEYS.DEST_ROW];
      }
      if (res[STORAGE_KEYS.CLEAR_DEST] !== undefined) {
        clearDestCheckbox.checked = res[STORAGE_KEYS.CLEAR_DEST];
      }

      // Mapping config
      if (res[STORAGE_KEYS.MAP_NO]) mapNoInput.value = res[STORAGE_KEYS.MAP_NO];
      if (res[STORAGE_KEYS.MAP_LEVEL3]) mapLevel3Input.value = res[STORAGE_KEYS.MAP_LEVEL3];
      if (res[STORAGE_KEYS.MAP_LEVEL2_1]) mapLevel2_1Input.value = res[STORAGE_KEYS.MAP_LEVEL2_1];
      if (res[STORAGE_KEYS.MAP_LEVEL2_2]) mapLevel2_2Input.value = res[STORAGE_KEYS.MAP_LEVEL2_2];
      if (res[STORAGE_KEYS.MAP_LEVEL4]) mapLevel4Input.value = res[STORAGE_KEYS.MAP_LEVEL4];
      if (res[STORAGE_KEYS.MAP_PRECONDITION]) {
        mapPreconditionInput.value = res[STORAGE_KEYS.MAP_PRECONDITION];
      }
      if (res[STORAGE_KEYS.MAP_SCENARIOS]) {
        mapScenariosInput.value = res[STORAGE_KEYS.MAP_SCENARIOS];
      }
      if (res[STORAGE_KEYS.MAP_LEVEL7]) mapLevel7Input.value = res[STORAGE_KEYS.MAP_LEVEL7];
      if (res[STORAGE_KEYS.MAP_LEVEL8]) mapLevel8Input.value = res[STORAGE_KEYS.MAP_LEVEL8];
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

      // Mapping
      [STORAGE_KEYS.MAP_NO]: mapNoInput.value,
      [STORAGE_KEYS.MAP_LEVEL3]: mapLevel3Input.value,
      [STORAGE_KEYS.MAP_LEVEL2_1]: mapLevel2_1Input.value,
      [STORAGE_KEYS.MAP_LEVEL2_2]: mapLevel2_2Input.value,
      [STORAGE_KEYS.MAP_LEVEL4]: mapLevel4Input.value,
      [STORAGE_KEYS.MAP_PRECONDITION]: mapPreconditionInput.value,
      [STORAGE_KEYS.MAP_SCENARIOS]: mapScenariosInput.value,
      [STORAGE_KEYS.MAP_LEVEL7]: mapLevel7Input.value,
      [STORAGE_KEYS.MAP_LEVEL8]: mapLevel8Input.value,
    });
  }

  // Ask parent page (Google Sheets) for its URL
  function requestUrlFromParent(targetInput) {
    activeUrlInput = targetInput;
    window.parent.postMessage({ type: "B2R_GET_CURRENT_URL" }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "B2R_CURRENT_URL_RESPONSE" && activeUrlInput) {
      activeUrlInput.value = event.data.url;
      saveInputs();
      addLog("Đã lấy được URL của sheet hiện tại!", "success");
      activeUrlInput = null;
    }
  });

  // Authentication Flow
  async function checkOAuthToken(interactive = false) {
    try {
      oauthStatusEl.textContent = "Checking...";
      oauthStatusEl.className = "oauth-status";

      if (interactive) {
        currentToken = await TB_SHEETS_API.launchOAuthFlow();
      } else {
        currentToken = await TB_SHEETS_API.getAccessToken();
      }

      oauthStatusEl.textContent = "Đã kết nối";
      oauthStatusEl.className = "oauth-status connected";
      oauthBtn.textContent = "Disconnect";
      return true;
    } catch (err) {
      currentToken = null;
      oauthStatusEl.textContent = "Chưa kết nối";
      oauthStatusEl.className = "oauth-status";
      oauthBtn.textContent = "Kết nối Google";
      if (interactive) {
        addLog(err.message, "error");
      }
      return false;
    }
  }

  async function handleOAuthButtonClick() {
    if (currentToken) {
      try {
        await TB_SHEETS_API.revokeToken(currentToken);
        currentToken = null;
        addLog("Đã ngắt kết nối tài khoản Google.", "warning");
        await checkOAuthToken(false);
      } catch (err) {
        addLog("Lỗi khi ngắt kết nối: " + err.message, "error");
      }
    } else {
      addLog("Đang kết nối tài khoản...", "info");
      await checkOAuthToken(true);
      if (currentToken) {
        addLog("Kết nối Google thành công!", "success");
      }
    }
  }

  // Test Connection
  async function handleTestConnection() {
    clearLogs();
    addLog("Bắt đầu kiểm tra...", "info");

    const sourceRaw = sourceSpreadsheetInput.value;
    const destRaw = destSpreadsheetInput.value;
    const sourceSheetName = sourceSheetNameInput.value;
    const destSheetName = destSheetNameInput.value;

    const sourceId = TB_SHEETS_API.extractSpreadsheetId(sourceRaw);
    const destId = TB_SHEETS_API.extractSpreadsheetId(destRaw);

    if (!sourceId || !destId) {
      addLog("Spreadsheet ID hoặc URL nguồn/đích trống/lỗi.", "error");
      return;
    }

    try {
      if (!currentToken) {
        addLog("Chưa đăng nhập. Đang mở cửa sổ auth...", "warning");
        const ok = await checkOAuthToken(true);
        if (!ok || !currentToken) return;
      }

      addLog("Đang đọc metadata sheet nguồn...", "info");
      const srcMeta = await TB_SHEETS_API.getSpreadsheetMetadata(sourceId, currentToken);
      await TB_SHEETS_API.getSheetIdByName(srcMeta, sourceSheetName);
      addLog("✓ Sheet nguồn hợp lệ.", "success");

      addLog("Đang đọc metadata sheet đích...", "info");
      const dstMeta = await TB_SHEETS_API.getSpreadsheetMetadata(destId, currentToken);
      await TB_SHEETS_API.getSheetIdByName(dstMeta, destSheetName);
      addLog("✓ Sheet đích hợp lệ.", "success");

      addLog("🎉 Kết nối thành công!", "success");
    } catch (err) {
      addLog(`Lỗi: ${err.message}`, "error");
    }
  }

  // Convert custom logic
  function convertOneRowCustom(row, config) {
    if (!row || !Array.isArray(row)) return null;

    const getVal = (colLetter) => {
      const idx = columnLetterToNumber(colLetter);
      return idx >= 0 && idx < row.length ? row[idx] : "";
    };

    const no = getVal(config.no);
    const type = getVal(config.level3);
    const targetFeature = getVal(config.level2_1);
    const feature = getVal(config.level2_2);
    const screen = getVal(config.level4);
    const precondition = getVal(config.precondition);

    const scenarioVals = (config.scenarios || []).map((letter) => getVal(letter));
    const expectedDisplay = getVal(config.level7);
    const expectedTransition = getVal(config.level8);

    const isEmptyVal = TB_TESTCASE_CONVERTER.isEmpty;
    if (
      isEmptyVal(no) &&
      isEmptyVal(type) &&
      isEmptyVal(targetFeature) &&
      isEmptyVal(feature) &&
      isEmptyVal(screen) &&
      isEmptyVal(precondition) &&
      scenarioVals.every((val) => isEmptyVal(val))
    ) {
      return null;
    }

    const level2 = targetFeature || feature || "";
    const level3 = type || "";
    const level4 = screen || "";
    const level5 = scenarioVals.filter((val) => !isEmptyVal(val)).join("\n");
    const level6 = "";
    const level7 = expectedDisplay || "";
    const level8 = expectedTransition || "";
    const date = TB_TESTCASE_CONVERTER.formatToday("Asia/Tokyo", "yyyy/MM/dd");

    return [
      no || "",
      level2,
      level3,
      level4,
      precondition || "",
      level5,
      level6,
      level7,
      level8,
      date,
    ];
  }

  async function handleConvertSubmit() {
    clearLogs();

    const sourceRaw = sourceSpreadsheetInput.value;
    const destRaw = destSpreadsheetInput.value;
    const sourceSheetName = sourceSheetNameInput.value;
    const destSheetName = destSheetNameInput.value;
    const sourceStartRow = parseInt(sourceStartRowInput.value, 10);
    const destStartRow = parseInt(destStartRowInput.value, 10);
    const clearDest = clearDestCheckbox.checked;

    const sourceId = TB_SHEETS_API.extractSpreadsheetId(sourceRaw);
    const destId = TB_SHEETS_API.extractSpreadsheetId(destRaw);

    if (!sourceId || !destId) {
      addLog("Spreadsheet ID hoặc URL nguồn/đích trống/lỗi.", "error");
      return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    try {
      if (!currentToken) {
        addLog("Chưa đăng nhập. Đang kết nối...", "warning");
        const ok = await checkOAuthToken(true);
        if (!ok || !currentToken) return;
      }

      // Build mapping config
      const mappingConfig = {
        no: mapNoInput.value,
        level3: mapLevel3Input.value,
        level2_1: mapLevel2_1Input.value,
        level2_2: mapLevel2_2Input.value,
        level4: mapLevel4Input.value,
        precondition: mapPreconditionInput.value,
        scenarios: mapScenariosInput.value.split(",").map((s) => s.trim()),
        level7: mapLevel7Input.value,
        level8: mapLevel8Input.value,
      };

      addLog("Đang đọc sheet nguồn...", "info");
      const rows = await TB_SHEETS_API.readSheetValues(sourceId, sourceSheetName, "", currentToken);
      addLog(`✓ Đã đọc ${rows.length} dòng.`, "success");

      if (rows.length === 0 || rows.length < sourceStartRow) {
        addLog("Sheet nguồn trống hoặc không đủ dòng dữ liệu.", "warning");
        return;
      }

      addLog("Đang convert testcase với custom mapping...", "info");
      const convertedRows = [];
      for (let i = sourceStartRow - 1; i < rows.length; i++) {
        const res = convertOneRowCustom(rows[i], mappingConfig);
        if (res) convertedRows.push(res);
      }

      addLog(`✓ Đã convert thành công ${convertedRows.length} dòng.`, "success");

      if (convertedRows.length === 0) {
        addLog("Không có dữ liệu hợp lệ sau khi convert.", "warning");
        return;
      }

      if (clearDest) {
        addLog("Đang dọn dẹp dữ liệu cũ ở sheet đích...", "info");
        await TB_SHEETS_API.clearSheetRange(destId, destSheetName, destStartRow, currentToken);
      }

      addLog(`Đang ghi dữ liệu sang sheet đích (A${destStartRow})...`, "info");
      await TB_SHEETS_API.writeSheetValues(
        destId,
        destSheetName,
        destStartRow,
        convertedRows,
        currentToken
      );

      addLog(`🎉 Xử lý hoàn tất! Đã ghi ${convertedRows.length} dòng thành công.`, "success");
    } catch (err) {
      addLog(`❌ Thất bại: ${err.message}`, "error");
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = "⚡ Convert";
    }
  }
});
