/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling between content scripts and external APIs.
 */

importScripts(
  "modules/constants/models.js",
  "modules/constants/icons.js",
  "modules/constants/prompts.js",
  "constants.js",
  "modules/utils/helpers.js",
  "modules/utils/crypto.js",
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
    chrome.storage.local.set({ showDonateModal: true }); // Set the flag to show the donate modal
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
     * LOOKUP_AND_TRANSLATE_COMMENT:
     * 1. Find matched Redmine issue from Backlog issue key.
     * 2. Translate comment from Backlog to Vietnamese.
     * 3. Return preview for user confirmation.
     */
    LOOKUP_AND_TRANSLATE_COMMENT: async () => {
      const settings = await getSettings();
      assertSettings(settings);

      // Find Redmine issue by issue key + summary
      const redmineIssue = await findRedmineIssue(
        settings.redmineDomain,
        settings.redmineApiKey,
        message.issueKey,
        message.issueSummary
      );

      // Translate comment to Vietnamese
      const translated = await translateText(message.commentText, settings, message.commentUrl);

      return {
        redmineIssueId: redmineIssue?.id || "",
        issueTitle: redmineIssue?.title || message.issueSummary,
        previewText: translated,
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
        const isSettingsError =
          err.message &&
          (err.message.includes("API Key") ||
            err.message.includes("API key") ||
            err.message.includes("Setting") ||
            err.message.includes("cấu hình"));

        if (!isSettingsError && err.message.includes("(403)")) {
          console.warn(
            `${DEBUG_PREFIX} Permission denied (403) for:`,
            message.endpoint || message.type
          );
        } else {
          console.error(`${DEBUG_PREFIX} Message handler error:`, err);
        }

        sendResponse({ ok: false, error: err.message, isSettingsError: !!isSettingsError });
      });
    return true; // Keep channel open for async response
  }
});

/**
 * Loads and decrypts extension settings from chrome.storage.local.
 * @returns {Promise<object>} Decrypted settings object
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "redmineApiKey",
        "backlogDomain",
        "backlogApiKey",
        "geminiApiKey",
        "cerebrasApiKey",
        "aiProvider",
        "geminiModel",
        "geminiFallbackModel",
        "cerebrasModel",
        "defaultProjectId",
      ],
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
          defaultProjectId: items.defaultProjectId || "",
        });
      }
    );
  });
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
  if (settings.aiProvider === TB.PROVIDERS.CEREBRAS) {
    if (!settings.cerebrasApiKey) {
      throw new Error("Missing Cerebras API Key.");
    }
  } else if (!settings.geminiApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
  }
}

/**
 * Fetches metadata from Redmine API endpoint.
 * @param {string} endpoint - API endpoint (e.g., "/projects.json")
 * @returns {Promise<object>} API response data
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
