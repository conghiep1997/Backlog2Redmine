importScripts("constants.js");

const TB = globalThis.TB_CONSTANTS;
if (!TB) {
  throw new Error("TB_CONSTANTS is not available.");
}

const DEFAULT_GEMINI_MODEL = TB.GEMINI_MODEL;
const DEBUG_PREFIX = TB.DEBUG_PREFIX;

// Cache for decrypted settings (5 minutes TTL)
let cachedSettings = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function logDebug(...args) {
  if (TB.LOG_LEVEL === "debug") {
    console.log(DEBUG_PREFIX, ...args);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "LOOKUP_AND_TRANSLATE_COMMENT") {
    handleLookupAndTranslate(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true;
  }

  if (message.type === "SEND_TO_REDMINE") {
    handleSendToRedmine(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true;
  }
});

/**
 * Handles the lookup and translation of a comment from Backlog.
 * Finds the corresponding Redmine issue and translates the comment using Gemini.
 * @param {Object} params - The parameters object.
 * @param {string} params.issueKey - The Backlog issue key.
 * @param {string} params.issueSummary - The Backlog issue summary.
 * @param {string} params.commentText - The comment text to translate.
 * @returns {Promise<Object>} An object containing redmineIssueId, issueTitle, and previewText.
 */
async function handleLookupAndTranslate({ issueKey, issueSummary, commentText }) {
  const settings = await getSettings();
  assertSettings(settings);

  logDebug("LOOKUP_AND_TRANSLATE_COMMENT", {
    issueKey,
    issueSummary,
    commentLength: commentText?.length ?? 0,
    redmineDomain: settings.redmineDomain,
    geminiModel: settings.geminiModel,
    geminiFallbackModel: settings.geminiFallbackModel,
  });

  const redmineIssue = await findRedmineIssue(
    settings.redmineDomain,
    settings.redmineApiKey,
    issueKey,
    issueSummary
  );

  const previewText = await translateWithGemini(
    settings.geminiApiKey,
    commentText,
    settings.geminiModel,
    settings.geminiFallbackModel
  );

  return {
    redmineIssueId: redmineIssue?.id ?? "",
    issueTitle: redmineIssue?.title ?? "",
    previewText,
  };
}

async function handleSendToRedmine({ redmineIssueId, notes }) {
  const settings = await getSettings();
  assertSettings(settings);

  if (!redmineIssueId) {
    throw new Error(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID);
  }

  const endpoint = buildRedmineUrl(
    settings.redmineDomain,
    `/issues/${redmineIssueId}.json`
  );

  logDebug("SEND_TO_REDMINE", {
    endpoint,
    redmineIssueId,
    notesLength: notes?.length ?? 0,
  });

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": settings.redmineApiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      issue: {
        notes,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR} ${response.status}: ${sanitizeErrorMessage(await readErrorMessage(response))}`
    );
  }

  // Extract note ID from response or generate link
  const responseData = await response.json();
  const journalId = responseData?.journal?.id;
  
  return { 
    message: TB.MESSAGES.TOAST.SEND_SUCCESS,
    redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}${journalId ? `#note-${journalId}` : ''}`),
  };
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["redmineApiKey", "geminiApiKey", "geminiModel", "geminiFallbackModel"],
      async (items) => {
        resolve({
          redmineDomain: TB.REDMINE_DOMAIN, // Hardcoded constant
          redmineApiKey: await decryptData(items.redmineApiKey ?? ""),
          geminiApiKey: await decryptData(items.geminiApiKey ?? ""),
          geminiModel: items.geminiModel ?? TB.GEMINI_MODEL,
          geminiFallbackModel: items.geminiFallbackModel ?? TB.GEMINI_FALLBACK_MODEL,
        });
      }
    );
  });
}

function assertSettings(settings) {
  // redmineDomain is hardcoded, no need to check
  if (!settings.redmineApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  }
  if (!settings.geminiApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
  }
}

/**
 * Finds the Redmine issue by searching Redmine's HTML or API.
 * Returns both issue ID and title.
 * First tries HTML search, falls back to API if no match.
 * @param {string} redmineDomain - The Redmine domain.
 * @param {string} apiKey - The Redmine API key.
 * @param {string} issueKey - The issue key to search for.
 * @param {string} issueSummary - The issue summary to search for.
 * @returns {Promise<{id: string, title: string} | null>} The Redmine issue object or null if not found.
 */
async function findRedmineIssue(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const normalizedIssueKey = normalizeLoose(issueKey);
  const normalizedIssueSummary = normalizeLoose(issueSummary);
  const searchQuery = buildRedmineSearchQuery(issueKey, issueSummary);
  const searchUrl = buildRedmineUrl(
    redmineDomain,
    `/search?${new URLSearchParams({
      q: searchQuery,
      scope: "all",
      all_words: "",
      titles_only: "1",
      issues: "1",
      news: "1",
      documents: "1",
      changesets: "1",
      wiki_pages: "1",
      messages: "1",
      projects: "1",
      attachments: "0",
      options: "1",
      commit: "Search",
    }).toString()}`
  );

  logDebug("REDMINE_SEARCH_REQUEST", {
    searchUrl,
    searchQuery,
    issueKey,
    issueSummary,
    normalizedIssueKey,
    normalizedIssueSummary,
  });

  const html = await fetchRedmineSearchHtml(searchUrl);
  const searchResults = extractRedmineSearchResults(html);

  logDebug("REDMINE_SEARCH_RESULTS", {
    count: searchResults.length,
    results: searchResults.map((item) => ({
      id: item.id,
      subject: item.subject,
      href: item.href,
    })),
  });

  const bestMatch = pickBestRedmineSearchResult(
    searchResults,
    normalizedIssueKey,
    normalizedIssueSummary
  );

  if (bestMatch) {
    logDebug("REDMINE_SEARCH_MATCH", {
      bestMatchId: bestMatch.id,
      bestMatchSubject: bestMatch.subject,
      bestMatchHref: bestMatch.href,
    });
    return {
      id: String(bestMatch.id),
      title: bestMatch.subject,
    };
  }

  logDebug("REDMINE_SEARCH_FALLBACK", TB.MESSAGES.REDMINE.SEARCH_NO_MATCH);
  return findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary);
}

async function findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const url = buildRedmineUrl(
    redmineDomain,
    `/issues.json?subject=${encodeURIComponent(issueKey)}&limit=10`
  );

  logDebug("REDMINE_API_REQUEST", {
    url,
    issueKey,
    issueSummary,
  });

  const response = await fetch(url, {
    headers: {
      "X-Redmine-API-Key": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.LOOKUP_FAILED}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const issues = Array.isArray(data?.issues) ? data.issues : [];

  logDebug("REDMINE_API_RESULTS", {
    count: issues.length,
    ids: issues.map((issue) => issue?.id),
    subjects: issues.map((issue) => issue?.subject),
  });

  if (issues.length === 0) {
    return null;
  }

  const bestMatch = pickBestRedmineSearchResult(
    issues.map((issue) => ({
      id: issue?.id,
      subject: issue?.subject,
      href: `/issues/${issue?.id}`,
    })),
    normalizeLoose(issueKey),
    normalizeLoose(issueSummary)
  );

  const result = (bestMatch ?? issues[0]);
  return {
    id: String(result?.id ?? ""),
    title: result?.subject ?? "",
  };
}

async function fetchRedmineSearchHtml(searchUrl) {
  const response = await fetch(searchUrl, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR} ${response.status}: ${response.statusText}`
    );
  }

  const html = await response.text();
  if (!html || html.length < 100) {
    throw new Error(TB.MESSAGES.REDMINE.SEARCH_EMPTY_HTML);
  }

  return html;
}

function extractRedmineSearchResults(html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href="([^"]*\/issues\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlText(match[1]);
    const id = match[2];
    const innerHtml = match[3];
    const subject = decodeHtmlText(stripHtml(innerHtml)).replace(/\s+/g, " ").trim();

    results.push({
      id,
      href,
      subject,
    });
  }

  return results;
}

function pickBestRedmineSearchResult(results, normalizedIssueKey, normalizedIssueSummary) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const scored = results
    .map((item) => {
      const normalizedSubject = normalizeLoose(item.subject);
      let score = 0;

      if (normalizedIssueKey && normalizedSubject.includes(normalizedIssueKey)) {
        score += 10;
      }

      if (normalizedIssueSummary && normalizedSubject.includes(normalizedIssueSummary)) {
        score += 5;
      }

      if (
        normalizedIssueKey &&
        normalizedIssueSummary &&
        normalizedSubject.includes(`${normalizedIssueKey}${normalizedIssueSummary}`)
      ) {
        score += 5;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].item : results[0];
}

/**
 * Translates the given comment text using Gemini API with fallback support.
 * Tries primary model first, falls back to secondary model on rate limit (429).
 * @param {string} apiKey - The Gemini API key.
 * @param {string} commentText - The text to translate.
 * @param {string} model - The primary Gemini model to use.
 * @param {string} fallbackModel - The fallback Gemini model (optional).
 * @returns {Promise<string>} The translated text in the specified format.
 */
async function translateWithGemini(apiKey, commentText, model = DEFAULT_GEMINI_MODEL, fallbackModel = null) {
  // Simple, direct prompt - no reasoning required
  const prompt = `Dịch đoạn sau sang tiếng Việt:
- Giữ nguyên Markdown
- Giữ nguyên @username và technical terms
- Chỉ trả về đúng format sau, không thêm bất kỳ lời nào khác:
  [Nội dung tiếng Nhật]

  ---
  
  [Nội dung tiếng Việt]

Nội dung:
${commentText}`;

  // Try primary model first
  try {
    const result = await callGeminiAPI(apiKey, commentText, model, prompt);
    return result;
  } catch (error) {
    // Check if it's a rate limit error (429)
    if (error.message.includes("429") || error.message.includes("rate limit")) {
      logDebug("RATE_LIMIT_DETECTED", {
        primaryModel: model,
        fallbackModel: fallbackModel,
        error: error.message,
      });

      // If fallback model is configured and different from primary, try it
      if (fallbackModel && fallbackModel !== model) {
        logDebug("RETRYING_WITH_FALLBACK", { fallbackModel });
        
        try {
          const result = await callGeminiAPI(apiKey, commentText, fallbackModel, prompt);
          logDebug("FALLBACK_SUCCESS", { fallbackModel });
          return result;
        } catch (fallbackError) {
          logDebug("FALLBACK_FAILED", { fallbackError: fallbackError.message });
          throw new Error(TB.MESSAGES.TOAST.RATE_LIMIT_FAILED);
        }
      }
    }
    // Re-throw non-rate-limit errors
    throw error;
  }
}

/**
 * Internal function to call Gemini API
 * @param {string} apiKey - The Gemini API key.
 * @param {string} commentText - The text to translate.
 * @param {string} model - The Gemini model to use.
 * @param {string} prompt - The translation prompt.
 * @returns {Promise<string>} The translated text.
 */
async function callGeminiAPI(apiKey, commentText, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `Gemini tra ve loi ${response.status}: ${sanitizeErrorMessage(errorMsg)}`
    );
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? "")
    .join("")
    .trim();

  if (!rawText) {
    throw new Error(TB.MESSAGES.GEMINI.EMPTY_TRANSLATION);
  }

  return normalizeTranslationOutput(commentText, rawText);
}

function normalizeTranslationOutput(originalText, geminiText) {
  const cleaned = geminiText
    .replace(/^```[\w-]*\n?/g, "")
    .replace(/\n?```$/g, "")
    .trim();

  if (cleaned.includes("\n---\n")) {
    return cleaned;
  }

  return `${originalText.trim()}\n---\n${cleaned}`;
}

function normalizeLoose(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function buildRedmineSearchQuery(issueKey, issueSummary) {
  return [issueKey, issueSummary]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ");
}

function decodeHtmlText(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function buildRedmineUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase).toString();
}

async function readErrorMessage(response) {
  try {
    const text = await response.text();
    return text ? text.slice(0, 500) : response.statusText;
  } catch (error) {
    return response.statusText;
  }
}

function sanitizeErrorMessage(message) {
  // Remove potential sensitive data like API keys or full responses
  // For simplicity, limit to 200 chars and remove any URLs or keys
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL]")
    .replace(/key=[^\s&]+/g, "key=[REDACTED]")
    .slice(0, 200);
}

async function encryptData(data) {
  if (!data) return "";
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData) {
  if (!encryptedData) return "";
  try {
    const combined = new Uint8Array(atob(encryptedData).split("").map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error(DEBUG_PREFIX, "Failed to decrypt data:", error);
    return "";
  }
}

async function deriveKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode("fixed-salt-for-internal-use-2026"),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("additional-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
