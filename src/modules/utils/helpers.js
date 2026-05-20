/**
 * Shared helper functions for Backlog2Redmine Extension.
 */

/**
 * Debounce function to limit execution rate.
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Throttle function to limit execution rate.
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Normalizes a string by removing whitespace and converting to lowercase.
 * Used for loose matching of issue keys and summaries.
 */
function normalizeLoose(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Decodes HTML entities in a string.
 */
function decodeHtmlText(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

/**
 * Strips HTML tags from a string.
 */
function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ");
}

/**
 * Builds a Redmine URL from a base URL and path.
 */
function buildRedmineUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase).toString();
}

/**
 * Safely parses the JSON response body.
 * Returns null if the response is empty or if parsing fails.
 */
async function safeReadJson(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("[TB-Helper] JSON_PARSE_FAILED", {
      status: response.status,
      statusText: response.statusText,
      error: error.message,
    });
    return null;
  }
}

/**
 * Reads the error message from a response.
 */
async function readErrorMessage(response) {
  try {
    const text = await response.text();
    return text ? text.slice(0, 500) : response.statusText;
  } catch (error) {
    return response.statusText;
  }
}

/**
 * Low-level message sender for chrome.runtime.
 */
function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown background error."));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Fetch with timeout support.
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>} Fetch response
 */
async function timeoutFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
