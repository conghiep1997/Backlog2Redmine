/**
 * Logger utility for Backlog2Redmine Extension.
 * Handles persistent error logging to chrome.storage.local.
 */

const MAX_LOGS = 100;
const MAX_LOG_FIELD_LENGTH = 10000;
const MAX_CONTEXT_DEPTH = 4;
const MAX_CONTEXT_ENTRIES = 50;

function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/([?&](?:key|apiKey|token|access_token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .slice(0, MAX_LOG_FIELD_LENGTH);
}

function sanitizeLogValue(value, depth = 0, seen = new WeakSet()) {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_CONTEXT_DEPTH || seen.has(value)) return "[TRUNCATED]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_CONTEXT_ENTRIES)
      .map((item) => sanitizeLogValue(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_CONTEXT_ENTRIES)
      .map(([key, item]) => [
        key,
        /api.?key|authorization|token/i.test(key)
          ? "[REDACTED]"
          : sanitizeLogValue(item, depth + 1, seen),
      ])
  );
}

function sanitizeLogEntry(logEntry) {
  const entry = logEntry && typeof logEntry === "object" ? logEntry : {};
  return {
    timestamp: redactSensitiveText(entry.timestamp),
    source: redactSensitiveText(entry.source || "Unknown"),
    message: redactSensitiveText(entry.message || "Unknown error"),
    stack: entry.stack ? redactSensitiveText(entry.stack) : null,
    context: sanitizeLogValue(entry.context || {}),
  };
}

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

  const newLog = sanitizeLogEntry({
    timestamp,
    source,
    message: errorMessage,
    stack: errorStack,
    context,
  });

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
  const sanitizedLogEntry = sanitizeLogEntry(logEntry);
  return new Promise((resolve) => {
    chrome.storage.local.get(["errorLogs"], (result) => {
      let logs = result.errorLogs || [];
      logs.unshift(sanitizedLogEntry); // Add to beginning

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
globalThis.TB_LOGGER = { logError, getLogs, clearLogs, saveLogToStorage, sanitizeLogEntry };
