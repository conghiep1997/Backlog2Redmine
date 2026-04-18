/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling.
 */

importScripts(
  "constants.js",
  "modules/utils/helpers.js",
  "modules/utils/crypto.js",
  "modules/services/ai.js",
  "modules/services/redmine.js",
  "modules/services/backlog.js"
);

const DEBUG_PREFIX = "[TB-BG]";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = {
    LOOKUP_AND_TRANSLATE_COMMENT: async () => {
      const settings = await getSettings();
      const redmineIssue = await findRedmineIssue(
        settings.redmineDomain,
        settings.redmineApiKey,
        message.issueKey,
        message.issueSummary
      );
      const translated = await translateText(message.commentText, settings, message.commentUrl);
      return {
        redmineIssueId: redmineIssue?.id || "",
        issueTitle: redmineIssue?.title || message.issueSummary,
        previewText: translated,
      };
    },
    SEND_TO_REDMINE: () => handleSendToRedmine(message, sender),
    SEND_TO_BACKLOG: () => handleSendToBacklog(message),
    FETCH_REDMINE_METADATA: () => handleFetchMetadata(message.endpoint),
    CREATE_REDMINE_ISSUE: () => handleCreateRedmineIssue(message),
    EXTRACT_JAPANESE_CONTENT: async () => {
      const settings = await getSettings();
      const result = await translateText(message.commentText, settings, null, TB.PROMPTS.EXTRACT_JAPANESE);
      return { previewText: result };
    }
  }[message.type];

  if (handler) {
    handler()
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async
  }
});

// Settings asserted into service logic
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
  if (!settings.redmineApiKey) throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  if (settings.aiProvider === TB.PROVIDERS.CEREBRAS) {
    if (!settings.cerebrasApiKey) throw new Error("Missing Cerebras API Key.");
  } else if (!settings.geminiApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
  }
}

async function handleFetchMetadata(endpoint) {
  const settings = await getSettings();
  assertSettings(settings);
  const url = buildRedmineUrl(settings.redmineDomain, endpoint);
  const response = await fetch(url, {
    headers: { "X-Redmine-API-Key": settings.redmineApiKey, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${TB.MESSAGES.REDMINE.API_REQUEST_FAILED} (${response.status})`);
  return await response.json();
}
