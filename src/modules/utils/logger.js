/**
 * Logger utility for Backlog2Redmine Extension.
 * Handles persistent error logging to chrome.storage.local.
 */

const MAX_LOGS = 100;

/**
 * Adds an error log entry.
 * @param {string} source - Source component (e.g. 'Content', 'Background', 'RedmineService')
 * @param {string|Error} error - Error object or message
 * @param {object} context - Additional context (optional)
 */
async function logError(source, error, context = {}) {
  const timestamp = new Date().toLocaleString("vi-VN");
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : null;

  const newLog = {
    timestamp,
    source,
    message: errorMessage,
    stack: errorStack,
    context,
  };

  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "LOG_ERROR", log: newLog });
    } else {
      await saveLogToStorage(newLog);
    }
  } catch (e) {
    console.error("[TB-Logger] Failed to log error:", e);
  }
}

/**
 * Persists a log entry to chrome.storage.local.
 * @param {object} logEntry - The log entry and metadata
 */
async function saveLogToStorage(logEntry) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["errorLogs"], (result) => {
      let logs = result.errorLogs || [];
      logs.unshift(logEntry); // Add to beginning

      if (logs.length > MAX_LOGS) {
        logs = logs.slice(0, MAX_LOGS);
      }

      chrome.storage.local.set({ errorLogs: logs }, () => {
        resolve();
      });
    });
  });
}

/**
 * Retrieves all saved logs.
 * @returns {Promise<Array>} List of log entries
 */
async function getLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["errorLogs"], (result) => {
      resolve(result.errorLogs || []);
    });
  });
}

/**
 * Clears all saved logs.
 */
async function clearLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["errorLogs"], () => {
      resolve();
    });
  });
}

// Global for scripts loaded via manifest
globalThis.TB_LOGGER = { logError, getLogs, clearLogs, saveLogToStorage };
