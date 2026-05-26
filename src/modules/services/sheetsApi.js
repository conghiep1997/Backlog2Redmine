(function (global) {
  const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
  const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const OAUTH_CLIENT_ID_KEY = "sheetsOAuthClientId";

  async function getAccessToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false, scopes: [SHEETS_SCOPE] }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Chưa đăng nhập Google. Vui lòng bấm 'Kết nối Google' trước."));
          return;
        }
        if (!token) {
          reject(new Error("Không lấy được access token. Có thể chưa cấp quyền."));
          return;
        }
        resolve(token);
      });
    });
  }

  function extractSpreadsheetId(input) {
    if (!input || input.trim() === "") {
      return null;
    }
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  async function sheetsRequest(endpoint, token, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${SHEETS_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      throw new Error("OAuth token hết hạn. Vui lòng ngắt kết nối và kết nối lại Google.");
    }
    if (response.status === 403) {
      const body = await response.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason || "";
      if (reason === "forbidden") {
        throw new Error("Không có quyền truy cập Spreadsheet này.");
      }
      if (reason === "rateLimitExceeded") {
        throw new Error("Google Sheets API đang bị giới hạn (429). Vui lòng chờ và thử lại.");
      }
      throw new Error("Lỗi 403: Không có quyền truy cập Google Sheets API.");
    }
    if (response.status === 404) {
      throw new Error("Không tìm thấy Spreadsheet. ID có thể không đúng.");
    }
    if (response.status === 429) {
      throw new Error("Google Sheets API rate limit (429). Vui lòng chờ vài giây rồi thử lại.");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = body?.error?.message || response.statusText;
      throw new Error(`Lỗi Google Sheets API (${response.status}): ${msg}`);
    }

    return response.json();
  }

  async function getSpreadsheetMetadata(spreadsheetId, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID không hợp lệ.");
    }
    return sheetsRequest(`/${spreadsheetId}?includeGridData=false`, token);
  }

  async function getSheetIdByName(metadata, sheetName) {
    const sheets = metadata?.sheets || [];
    const found = sheets.find((s) => s.properties?.title === sheetName);
    if (!found) {
      const available = sheets.map((s) => s.properties?.title).filter(Boolean);
      throw new Error(
        `Sheet "${sheetName}" không tồn tại. Các sheet có sẵn: ${available.join(", ") || "không có"}`
      );
    }
    return found.properties.sheetId;
  }

  async function readSheetValues(spreadsheetId, sheetName, range, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID không hợp lệ.");
    }
    const encodedSheet = encodeURIComponent(sheetName);
    const rangeParam = range ? `!${range}` : "";
    const endpoint = `/${spreadsheetId}/values/${encodedSheet}${rangeParam}`;
    const data = await sheetsRequest(endpoint, token);
    return data.values || [];
  }

  async function clearSheetRange(spreadsheetId, sheetName, startRow, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID không hợp lệ.");
    }
    const lastCol = "J";
    const clearRange = `${sheetName}!A${startRow}:${lastCol}`;
    await sheetsRequest(`/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, token, {
      method: "POST",
    });
  }

  async function clearSheetColumnRange(spreadsheetId, sheetName, column, startRow, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID khÃ´ng há»£p lá»‡.");
    }
    const clearRange = `${sheetName}!${column}${startRow}:${column}`;
    await sheetsRequest(`/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, token, {
      method: "POST",
    });
  }

  async function writeSheetValues(spreadsheetId, sheetName, startRow, values, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID không hợp lệ.");
    }
    const lastCol = "J";
    const range = `${sheetName}!A${startRow}:${lastCol}`;
    const endpoint = `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await sheetsRequest(endpoint, token, {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    });
  }

  async function writeSheetColumnValues(spreadsheetId, sheetName, column, startRow, values, token) {
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID khÃ´ng há»£p lá»‡.");
    }
    const endRow = startRow + values.length - 1;
    const range = `${sheetName}!${column}${startRow}:${column}${endRow}`;
    const endpoint = `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await sheetsRequest(endpoint, token, {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    });
  }

  async function launchOAuthFlow() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true, scopes: [SHEETS_SCOPE] }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Đăng nhập Google thất bại: " + chrome.runtime.lastError.message));
          return;
        }
        resolve(token);
      });
    });
  }

  async function revokeToken(token) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
  }

  global.TB_SHEETS_API = {
    getAccessToken,
    extractSpreadsheetId,
    getSpreadsheetMetadata,
    getSheetIdByName,
    readSheetValues,
    clearSheetRange,
    clearSheetColumnRange,
    writeSheetValues,
    writeSheetColumnValues,
    launchOAuthFlow,
    revokeToken,
  };
})(globalThis);
