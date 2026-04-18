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
    handleSendToRedmine(message, sender)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true;
  }

  if (message.type === "EXTRACT_JAPANESE_CONTENT") {
    handleExtractJapanese(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true;
  }

  if (message.type === "SEND_TO_BACKLOG") {
    handleSendToBacklog(message)
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
async function handleLookupAndTranslate({ issueKey, issueSummary, commentText, commentUrl }) {
  const settings = await getSettings();
  assertSettings(settings);

  logDebug("LOOKUP_AND_TRANSLATE_COMMENT", {
    issueKey,
    issueSummary,
    commentUrl,
    commentLength: commentText?.length ?? 0,
    provider: settings.aiProvider,
  });

  const redmineIssue = await findRedmineIssue(
    settings.redmineDomain,
    settings.redmineApiKey,
    issueKey,
    issueSummary
  );

  const previewText = await translateText(commentText, settings, commentUrl);

  return {
    redmineIssueId: redmineIssue?.id ?? "",
    issueTitle: redmineIssue?.title ?? "",
    previewText,
  };
}

async function handleExtractJapanese({ commentText }) {
  const settings = await getSettings();
  assertSettings(settings);

  logDebug("EXTRACT_JAPANESE_CONTENT", {
    commentLength: commentText?.length ?? 0,
    provider: settings.aiProvider,
  });

  const provider = settings.aiProvider || TB.PROVIDERS.GEMINI;
  let extractedText = "";

  if (provider === TB.PROVIDERS.CEREBRAS) {
    extractedText = await callCerebrasAPI(
      settings.cerebrasApiKey,
      commentText,
      settings.cerebrasModel,
      TB.PROMPTS.EXTRACT_JAPANESE
    );
  } else {
    extractedText = await callGeminiAPI(
      settings.geminiApiKey,
      commentText,
      settings.geminiModel,
      settings.geminiFallbackModel, // Not used in callGeminiAPI currently, but for future consistency
      TB.PROMPTS.EXTRACT_JAPANESE
    );
  }

  return { previewText: extractedText };
}

async function handleSendToBacklog({ backlogIssueKey, content, notifiedUserId }) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = settings.backlogDomain || TB.BACKLOG_DOMAIN;
  const url = new URL(`api/v2/issues/${backlogIssueKey}/comments`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  const body = new URLSearchParams();
  body.append("content", content);
  if (Array.isArray(notifiedUserId)) {
    notifiedUserId.forEach((id) => body.append("notifiedUserId[]", id));
  } else if (notifiedUserId) {
    notifiedUserId.split(",").forEach((id) => body.append("notifiedUserId[]", id.trim()));
  }

  logDebug("SEND_TO_BACKLOG", {
    url: url.toString().replace(/apiKey=[^&]+/, "apiKey=[REDACTED]"),
    backlogIssueKey,
    contentLength: content.length,
  });

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`${TB.MESSAGES.BACKLOG.POST_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const result = await response.json();
  const backlogUrl = `${domain.endsWith("/") ? domain : domain + "/"}view/${backlogIssueKey}#comment-${result.id}`;

  return {
    message: TB.MESSAGES.TOAST.SEND_BACKLOG_SUCCESS,
    backlogUrl,
  };
}

async function translateText(commentText, settings, commentUrl = null) {
  const provider = settings.aiProvider || TB.PROVIDERS.CEREBRAS; // Use Cerebras if available, else Gemini

  try {
    if (provider === TB.PROVIDERS.CEREBRAS) {
      return await translateWithCerebras(
        settings.cerebrasApiKey,
        commentText,
        settings.cerebrasModel,
        commentUrl
      );
    } else {
      return await translateWithGemini(
        settings.geminiApiKey,
        commentText,
        settings.geminiModel,
        settings.geminiFallbackModel,
        commentUrl
      );
    }
  } catch (error) {
    // If ANY provider hits a rate limit (429), try to failover to Gemini Flash Lite
    if ((error.message.includes("429") || error.message.includes("rate limit")) && settings.geminiApiKey) {
      logDebug("FAILOVER_DETECTED", { originalError: error.message });
      
      // If the failed one was NOT already Gemini Flash Lite, try it
      if (settings.geminiModel !== TB.GEMINI_FALLBACK_MODEL || provider === TB.PROVIDERS.CEREBRAS) {
          logDebug("FAILING_OVER_TO_GEMINI_FLASH_LITE");
          try {
            // Note: We use callGeminiAPI directly to avoid infinite recursion if something is wrong
            return await callGeminiAPI(settings.geminiApiKey, commentText, TB.GEMINI_FALLBACK_MODEL, null, TB.PROMPTS.USER, commentUrl);
          } catch (failoverError) {
            logDebug("FAILOVER_FAILED", failoverError.message);
            throw new Error(TB.MESSAGES.TOAST.RATE_LIMIT_FAILED);
          }
      }
    }
    throw error;
  }
}

async function handleSendToRedmine({ redmineIssueId, notes }, sender) {
  const settings = await getSettings();
  assertSettings(settings);

  if (!redmineIssueId) {
    throw new Error(TB.MESSAGES.MODAL.EMPTY_ISSUE_ID);
  }

  const backlogDomain = sender?.tab?.url ? new URL(sender.tab.url).hostname : null;
  
  // 1. Xử lý ảnh (Tải từ Backlog và Upload lên Redmine)
  const { updatedNotes, uploads } = await processNotesImages(notes, backlogDomain, settings);

  const endpoint = buildRedmineUrl(
    settings.redmineDomain,
    `/issues/${redmineIssueId}.json`
  );

  logDebug("SEND_TO_REDMINE", {
    endpoint,
    redmineIssueId,
    notesLength: updatedNotes.length,
    uploadsCount: uploads.length,
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
        notes: updatedNotes,
        uploads: uploads.length > 0 ? uploads : undefined,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR}: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  // Extract note ID from response or generate link
  const responseData = await safeReadJson(response);
  const journalId = responseData?.journal?.id;
  
  return { 
    message: TB.MESSAGES.TOAST.SEND_SUCCESS,
    redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}${journalId ? `#note-${journalId}` : ''}`),
  };
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["redmineApiKey", "backlogDomain", "backlogApiKey", "geminiApiKey", "cerebrasApiKey", "aiProvider", "geminiModel", "geminiFallbackModel", "cerebrasModel"],
      async (items) => {
        resolve({
          redmineDomain: TB.REDMINE_DOMAIN,
          redmineApiKey: await decryptData(items.redmineApiKey ?? ""),
          backlogDomain: items.backlogDomain || TB.BACKLOG_DOMAIN,
          backlogApiKey: await decryptData(items.backlogApiKey ?? ""),
          aiProvider: items.aiProvider || TB.DEFAULT_PROVIDER,
          geminiApiKey: await decryptData(items.geminiApiKey ?? ""),
          geminiModel: items.geminiModel ?? TB.GEMINI_MODEL,
          geminiFallbackModel: items.geminiFallbackModel ?? TB.GEMINI_FALLBACK_MODEL,
          cerebrasApiKey: await decryptData(items.cerebrasApiKey ?? ""),
          cerebrasModel: items.cerebrasModel ?? TB.CEREBRAS_MODEL,
        });
      }
    );
  });
}

function assertSettings(settings) {
  if (!settings.redmineApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  }
  
  if (settings.aiProvider === TB.PROVIDERS.CEREBRAS) {
    if (!settings.cerebrasApiKey) {
      throw new Error("Missing Cerebras API Key. Please configure in Options.");
    }
  } else {
    // Gemini is default fallback or primary
    if (!settings.geminiApiKey) {
      throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
    }
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

  const data = await safeReadJson(response);
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
async function translateWithGemini(apiKey, commentText, model = DEFAULT_GEMINI_MODEL, fallbackModel = null, commentUrl = null) {
  // Try primary model first
  try {
    const result = await callGeminiAPI(apiKey, commentText, model, null, TB.PROMPTS.USER, commentUrl);
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
          const result = await callGeminiAPI(apiKey, commentText, fallbackModel);
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
 * @param {string} fallbackModel - The Gemini fallback model (not used here but passed for consistency).
 * @param {Function} promptFn - The prompt function to use (default: TB.PROMPTS.USER).
 * @returns {Promise<string>} The translated text.
 */
async function callGeminiAPI(apiKey, commentText, model, fallbackModel = null, promptFn = TB.PROMPTS.USER, commentUrl = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: TB.PROMPTS.SYSTEM }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: promptFn(commentText) }],
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
    throw new Error(`Gemini (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? "")
    .join("")
    .trim();

  if (!rawText) {
    throw new Error(TB.MESSAGES.GEMINI.EMPTY_TRANSLATION);
  }

  if (promptFn === TB.PROMPTS.USER) {
    return normalizeTranslationOutput(commentText, rawText, commentUrl);
  }
  
  return rawText;
}

/**
 * Translates text using Cerebras API (OpenAI-compatible).
 */
async function translateWithCerebras(apiKey, commentText, model, commentUrl = null) {
  return callCerebrasAPI(apiKey, commentText, model, TB.PROMPTS.USER, commentUrl);
}

async function callCerebrasAPI(apiKey, commentText, model, promptFn = TB.PROMPTS.USER, commentUrl = null) {
  try {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: TB.PROMPTS.SYSTEM,
          },
          {
            role: "user",
            content: promptFn(commentText),
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorMsg = await readErrorMessage(response);
      throw new Error(`Cerebras (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
    }

    const data = await safeReadJson(response);
    const rawText = data?.choices?.[0]?.message?.content?.trim();

    if (!rawText) {
      throw new Error("AI khong tra ve noi dung.");
    }

    if (promptFn === TB.PROMPTS.USER) {
        return normalizeTranslationOutput(commentText, rawText, commentUrl);
    }
    return rawText;
  } catch (error) {
    logDebug("CEREBRAS_API_ERROR", error.message);
    throw error;
  }
}

function normalizeTranslationOutput(originalText, rawText, commentUrl = null) {
  let cleaned = rawText.trim();

  // 1. Phát hiện thẻ kết quả (Hỗ trợ cả <result> và [result])
  const resultPatterns = [
    /<result>([\s\S]*?)<\/result>/i,
    /\[result\]([\s\S]*?)\[\/result\]/i,
    /result:([\s\S]*)/i
  ];

  let foundContent = "";
  for (const pattern of resultPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      foundContent = match[1].trim();
      break;
    }
  }

  if (foundContent) {
    cleaned = foundContent;
  } else {
    // 2. Dự phòng: Dọn dẹp truyền thống nếu không tìm thấy thẻ
    cleaned = cleaned
      .replace(/^```[\w-]*\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();

    const noiseMarkers = [
      "CÁC QUY TẮC PHẢI TUÂN THỦ:",
      "QUY TẮC BẮT BUỘC:",
      "BẢN DỊCH:",
      "NỘI DUNG CẦN DỊCH:",
      "NHIỆM VỤ:",
      "[TB_START]",
      "[TB_END]"
    ];
    
    let lines = cleaned.split("\n");
    let firstValidLineIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const isNoise = noiseMarkers.some(marker => line.toUpperCase().includes(marker.toUpperCase()));
      const isRuleLine = /^\d+\.\s+[A-Z\s]+/.test(line);

      if (isNoise || isRuleLine) {
        firstValidLineIndex = i + 1;
        continue;
      }
      
      if (i < 15) {
        if (line.length < 5 && /^[-*_]+$/.test(line)) {
            firstValidLineIndex = i + 1;
            continue;
        }
      }
      break;
    }
    
    cleaned = lines.slice(firstValidLineIndex).join("\n").trim();
  }

  // 3. Dọn dẹp bổ sung
  cleaned = cleaned
    .replace(/\[TB_END\]\s*$/g, "")
    .replace(/\[TB_START\]\s*$/g, "")
    .replace(/\[result\]/gi, "")
    .replace(/\[\/result\]/gi, "")
    .replace(/<result>/gi, "")
    .replace(/<\/result>/gi, "")
    .replace(/Nội dung bản dịch|Bản dịch hoàn chỉnh ở đây|Bản dịch của bạn ở đây/gi, "")
    .trim();

  // Đảm bảo không trả về rỗng nếu dọn dẹp quá tay
  if (!cleaned || cleaned.length < 2) {
    cleaned = rawText.trim(); 
  }

  const prefix = commentUrl ? `${commentUrl}\n\n` : "";
  return `${prefix}${originalText.trim()}\n\n---\n\n${cleaned}`;
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

/**
 * Safely parses the JSON response body.
 * Returns null if the response is empty or if parsing fails.
 * @param {Response} response - The fetch Response object.
 * @returns {Promise<any | null>} The parsed JSON data or null.
 */
async function safeReadJson(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    logDebug("JSON_PARSE_FAILED", {
      status: response.status,
      statusText: response.statusText,
      error: error.message,
    });
    return null;
  }
}

function sanitizeErrorMessage(message, status) {
  let displayMessage = message;
  
  try {
    const errorJson = JSON.parse(message);
    displayMessage = errorJson.error?.message || errorJson.error || errorJson.message || message;
  } catch (e) {
    // Not JSON
  }

  return `Lỗi ${status}: ${displayMessage.replace(/https?:\/\/[^\s]+/g, "[URL]").slice(0, 200)}`;
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

/**
 * Xử lý quét các marker ảnh và upload lên Redmine.
 */
async function processNotesImages(notes, backlogDomain, settings) {
  let updatedNotes = notes;
  const uploads = [];
  const imageMatches = [...notes.matchAll(/\[\[TB_IMG:(\d+)\]\]/g)];
  
  if (imageMatches.length === 0 || !backlogDomain) {
    return { updatedNotes, uploads };
  }

  for (const match of imageMatches) {
    const attachmentId = match[1];
    const marker = match[0];
    
    try {
      logDebug(`Processing image: ${attachmentId}`);
      
      // 1. Tải ảnh từ Backlog
      const imgBlob = await downloadBacklogImage(backlogDomain, attachmentId);
      
      // 2. Upload lên Redmine
      const filename = `image_${attachmentId}.png`;
      const token = await uploadToRedmine(settings.redmineDomain, settings.redmineApiKey, imgBlob, filename);
      
      if (token) {
        uploads.push({
          token,
          filename,
          content_type: "image/png"
        });
        // Thay thế bằng định dạng Textile của Redmine
        updatedNotes = updatedNotes.replace(marker, `!${filename}!`);
      }
    } catch (error) {
      logDebug(`Failed to process image ${attachmentId}:`, error.message);
      updatedNotes = updatedNotes.replace(marker, `[Lỗi tải ảnh: ${attachmentId}]`);
    }
  }

  return { updatedNotes, uploads };
}

/**
 * Tải ảnh từ Backlog dưới dạng Blob.
 */
async function downloadBacklogImage(domain, attachmentId) {
  const url = `https://${domain}/ViewAttachmentImage.action?attachmentId=${attachmentId}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Backlog image download failed: ${response.status}`);
  }
  
  return await response.blob();
}

/**
 * Upload ảnh lên Redmine và trả về token.
 */
async function uploadToRedmine(domain, apiKey, blob, filename) {
  const url = buildRedmineUrl(domain, "/uploads.json");
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: blob
  });

  if (!response.ok) {
    throw new Error(`Redmine upload failed: ${response.status}`);
  }

  const data = await response.json();
  return data?.upload?.token;
}
