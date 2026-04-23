/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling between content scripts and external APIs.
 */

/* global TB_LOGGER */

importScripts(
  "modules/constants/models.js",
  "modules/constants/icons.js",
  "modules/constants/prompts.js",
  "constants.js",
  "modules/utils/helpers.js",
  "modules/utils/crypto.js",
  "modules/utils/logger.js",
  "modules/services/ai.js",
  "modules/services/redmine.js",
  "modules/services/backlog.js"
);

const DEBUG_PREFIX = "[TB-BG]";

// When the user clicks on the extension icon, open the options page.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

/**
 * Message handler for chrome.runtime.onMessage.
 * Handles messages from content scripts and options page.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = {
    OPEN_OPTIONS_PAGE: () => {
      chrome.runtime.openOptionsPage();
      return Promise.resolve();
    },

    /**
     * GET_SETTINGS:
     * Returns the decrypted extension settings.
     */
    GET_SETTINGS: async () => {
      const settings = await getSettings();
      return settings;
    },

    /**
     * LOG_ERROR:
     * Saves an error log entry to storage.
     */
    LOG_ERROR: async ({ log }) => {
      if (typeof TB_LOGGER !== "undefined") {
        await TB_LOGGER.saveLogToStorage(log);
      }
      return { ok: true };
    },

    /**
     * LOOKUP_AND_TRANSLATE_COMMENT:
     * 1. Find matched Redmine issue from Backlog issue key.
     * 2. Translate comment from Backlog to Vietnamese.
     * 3. Return preview for user confirmation.
     */
    LOOKUP_AND_TRANSLATE_COMMENT: async () => {
      const settings = await getSettings();
      assertSettings(settings);

      // Find Redmine issue by issue key + summary (using cache)
      const redmineIssue = await findRedmineIssueWithCache(
        settings.redmineDomain,
        settings.redmineApiKey,
        message.issueKey,
        message.issueSummary
      );

      // Translate comment to Vietnamese
      const translated = await translateText(message.commentText, settings, message.commentUrl);

      // Prepend user info to the final preview if provided
      const finalPreview = message.userInfo ? `${message.userInfo}\n${translated}` : translated;

      return {
        redmineIssueId: redmineIssue?.id || "",
        issueTitle: redmineIssue?.title || message.issueSummary,
        previewText: finalPreview,
      };
    },

    /**
     * SEND_TO_REDMINE:
     * Send translated note to Redmine issue.
     */
    SEND_TO_REDMINE: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      return handleSendToRedmine(message, sender);
    },

    /**
     * SEND_TO_BACKLOG:
     * Send Japanese content back to Backlog.
     */
    SEND_TO_BACKLOG: () => handleSendToBacklog(message),

    /**
     * FETCH_REDMINE_METADATA:
     * Fetch metadata from Redmine API (projects, trackers, priorities, etc.).
     */
    FETCH_REDMINE_METADATA: () => handleFetchMetadata(message.endpoint),

    /**
     * CREATE_REDMINE_ISSUE:
     * Create new issue on Redmine with description + comments from Backlog.
     */
    CREATE_REDMINE_ISSUE: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      return handleCreateRedmineIssue(message);
    },

    /**
     * EXTRACT_JAPANESE_CONTENT:
     * Extract Japanese portion from Redmine content (for reverse sync).
     */
    EXTRACT_JAPANESE_CONTENT: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      const result = await translateText(
        message.commentText,
        settings,
        null,
        TB.PROMPTS.EXTRACT_JAPANESE
      );
      return { previewText: result };
    },

    /**
     * TRANSLATE_TEXT_SIMPLE:
     * Translate plain text to Vietnamese without Reddy issue lookup.
     */
    TRANSLATE_TEXT_SIMPLE: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      const translated = await translateText(
        message.text,
        settings,
        null,
        TB.PROMPTS.SIMPLE_TRANSLATE || ((t) => t)
      );
      return { translatedText: translated };
    },
  }[message.type];

  if (handler) {
    handler()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        const errorString = err instanceof Error ? err.message : String(err || "Unknown error");
        const isSettingsError =
          errorString.includes("API Key") ||
          errorString.includes("API key") ||
          errorString.includes("Setting") ||
          errorString.includes("cấu hình");

        if (!isSettingsError && errorString.includes("(403)")) {
          console.warn(`${DEBUG_PREFIX} Permission denied (403) for:`, message.type);
        } else if (!isSettingsError && errorString.includes("(404)")) {
          console.warn(`${DEBUG_PREFIX} Resource not found (404) for:`, message.type);
        } else {
          console.error(`${DEBUG_PREFIX} Message handler error:`, err);
          if (typeof TB_LOGGER !== "undefined") {
            TB_LOGGER.logError("Background", err, { messageType: message.type });
          }
        }

        sendResponse({
          ok: false,
          error: errorString,
          isSettingsError: !!isSettingsError,
        });
      });
    return true; // Keep channel open for async response
  }
});

let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 30000; // 30 seconds

/**
 * Loads and decrypts extension settings from chrome.storage.local.
 * @returns {Promise<object>} Decrypted settings object
 */
async function getSettings() {
  const now = Date.now();
  if (settingsCache && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "redmineApiKey",
        "backlogDomain",
        "backlogApiKey",
        "geminiApiKey",
        "geminiApiKeys",
        "geminiModels",
        "cerebrasApiKey",
        "groqApiKey",
        "primaryProvider",
        "primaryModel",
        "fallbackProvider",
        "fallbackModel",
        "defaultProjectId",
      ],
      async (items) => {
        const geminiApiKeysStr = items.geminiApiKeys ? await decryptData(items.geminiApiKeys) : "";
        const geminiApiKeys = geminiApiKeysStr
          ? geminiApiKeysStr.split("\n").filter((k) => k.trim())
          : [];

        const geminiModelsStr = items.geminiModels ? await decryptData(items.geminiModels) : "";
        const geminiModels = geminiModelsStr
          ? geminiModelsStr.split("\n").filter((m) => m.trim())
          : [];

        const decryptedSettings = {
          redmineDomain: TB.REDMINE_DOMAIN,
          redmineApiKey: await decryptData(items.redmineApiKey ?? ""),
          backlogDomain: items.backlogDomain || TB.BACKLOG_DOMAIN,
          backlogApiKey: await decryptData(items.backlogApiKey ?? ""),
          primaryProvider: items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER,
          primaryModel: items.primaryModel ?? TB.DEFAULT_PRIMARY_MODEL,
          fallbackProvider: items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER,
          fallbackModel: items.fallbackModel ?? TB.DEFAULT_FALLBACK_MODEL,
          geminiApiKey: await decryptData(items.geminiApiKey ?? ""),
          geminiApiKeys: geminiApiKeys,
          geminiModels: geminiModels,
          cerebrasApiKey: await decryptData(items.cerebrasApiKey ?? ""),
          groqApiKey: await decryptData(items.groqApiKey ?? ""),
          defaultProjectId: items.defaultProjectId || "",
        };

        settingsCache = decryptedSettings;
        settingsCacheTime = Date.now();
        resolve(decryptedSettings);
      }
    );
  });
}

// Invalidate cache when storage changes
chrome.storage.onChanged.addListener(() => {
  settingsCache = null;
  settingsCacheTime = 0;
});

const issueLookupCache = new Map();
const LOOKUP_CACHE_TTL = 60000; // 1 minute

async function findRedmineIssueWithCache(domain, apiKey, issueKey, summary) {
  const cacheKey = `${issueKey}`;
  const now = Date.now();
  const cached = issueLookupCache.get(cacheKey);

  if (cached && now - cached.time < LOOKUP_CACHE_TTL) {
    return cached.data;
  }

  const result = await findRedmineIssue(domain, apiKey, issueKey, summary);
  issueLookupCache.set(cacheKey, { data: result, time: now });
  return result;
}

/**
 * Validates required settings based on selected provider.
 * @param {object} settings - Settings to validate
 * @throws {Error} If required settings are missing
 */
function assertSettings(settings) {
  if (!settings.redmineApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  }

  if (!settings.geminiApiKey && settings.geminiApiKeys?.length === 0) {
    throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
  }

  if (settings.fallbackProvider === TB.PROVIDERS.CEREBRAS && !settings.cerebrasApiKey) {
    throw new Error("Missing Cerebras API Key.");
  }

  if (settings.fallbackProvider === TB.PROVIDERS.GROQ && !settings.groqApiKey) {
    throw new Error("Missing Groq API Key.");
  }
}

/**
 * Fetches metadata from Redmine API endpoint.
 * @param {string} endpoint - API endpoint (e.g., "/projects.json")
 * @returns {Promise<object>} Decrypted settings object
 */
async function handleFetchMetadata(endpoint) {
  const settings = await getSettings();
  assertSettings(settings);

  const url = buildRedmineUrl(settings.redmineDomain, endpoint);

  // Use timeoutFetch to avoid hanging connections
  const response = await timeoutFetch(
    url,
    {
      headers: {
        "X-Redmine-API-Key": settings.redmineApiKey,
        Accept: "application/json",
      },
    },
    10000
  ); // 10s timeout for metadata fetch

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.API_REQUEST_FAILED} (${response.status}) for ${endpoint}`
    );
  }

  return await response.json();
}
