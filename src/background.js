/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling between content scripts and external APIs.
 */

/* global TB_LOGGER, getBacklogIssueInfo, getBacklogUsers, testModelAvailability */

importScripts(
  "modules/utils/version.js",
  "modules/utils/settings-view.js",
  "modules/utils/message-validation.js",
  "modules/utils/request-deduper.js",
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
const UPDATE_NOTIFICATION_ID = "b2r-update-available";
const CHECK_INTERVAL_HOURS = 24;

// ============================================================================
// Extension Lifecycle & Update Checks
// ============================================================================

/**
 * Opens the options page when the user clicks on the extension icon.
 */
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

/**
 * Handles extension installation or update.
 * Opens options page on first install and checks for updates.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await TB_LOGGER.sanitizeStoredLogs();
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
  // Always check for updates on install/update and set a recurring alarm.
  await checkForUpdates();
  chrome.alarms.create("checkForUpdates", { periodInMinutes: CHECK_INTERVAL_HOURS * 60 });
});

/**
 * Handles extension startup.
 * Checks for updates if it hasn't been done recently.
 */
chrome.runtime.onStartup.addListener(async () => {
  await TB_LOGGER.sanitizeStoredLogs();
  console.log(`${DEBUG_PREFIX} Extension started, checking for updates...`);
  const shouldCheck = await shouldCheckForUpdates();
  if (shouldCheck) {
    await checkForUpdates();
  }
});

/**
 * Handles the recurring alarm for update checks.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkForUpdates") {
    await checkForUpdates();
  }
});

/**
 * Handles notification clicks to direct users to the download page.
 */
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;

  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ url: "https://hipppo.vercel.app/" });
});

/**
 * Handles notification button clicks.
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;

  chrome.notifications.clear(notificationId);
  if (buttonIndex === 0) {
    // "Download ngay" button
    chrome.tabs.create({ url: "https://hipppo.vercel.app/" });
  }
});

/**
 * Checks if an update check should be performed.
 * @returns {Promise<boolean>} True if the last check was more than CHECK_INTERVAL_HOURS ago.
 */
async function shouldCheckForUpdates() {
  const result = await chrome.storage.local.get(["lastUpdateCheck"]);
  const lastCheck = result.lastUpdateCheck;
  if (!lastCheck) return true;

  const hoursSinceLastCheck = (Date.now() - new Date(lastCheck).getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCheck >= CHECK_INTERVAL_HOURS;
}

/**
 * Fetches the latest version from the backend and updates the extension badge and notifications.
 */
async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;

  try {
    const response = await fetch(`${TB_VERSION.API_URL}/versions/latest`);
    if (!response.ok) {
      console.warn(`${DEBUG_PREFIX} Failed to fetch latest version: ${response.status}`);
      return;
    }

    const data = await response.json();
    const latestVersion = data.version_number;
    if (!TB_VERSION.isValid(latestVersion)) {
      console.warn(`${DEBUG_PREFIX} Backend returned an invalid version.`);
      return;
    }

    const comparison = TB_VERSION.compare(currentVersion, latestVersion);

    if (comparison < 0) {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
      await chrome.notifications.create(UPDATE_NOTIFICATION_ID, {
        type: "basic",
        iconUrl: "assets/icons/icon-48.png",
        title: "🚀 Cập nhật mới sẵn sàng!",
        message: `Phiên bản ${latestVersion} đã ra mắt. Click để xem chi tiết!`,
        priority: 2,
        buttons: [{ title: "Download ngay" }, { title: "Để sau" }],
      });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }

    await chrome.storage.local.set({ lastUpdateCheck: new Date().toISOString() });
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Update check failed:`, error.message);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Main message listener for requests from content scripts and options page.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    TB_MESSAGE_VALIDATION.assertInternalSender(sender, chrome.runtime.id);
    TB_MESSAGE_VALIDATION.assertMessage(message);
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
    return false;
  }

  const handlers = {
    OPEN_OPTIONS_PAGE: () => chrome.runtime.openOptionsPage(),
    GET_UI_SETTINGS: async () => TB_SETTINGS_VIEW.forUi(await getSettings()),
    GET_REPORT_SETTINGS: async () => {
      const settings = await getSettings();
      assertTrustedRedmineSender(sender, settings.redmineDomain);
      return TB_SETTINGS_VIEW.forReport(settings);
    },
    LOG_ERROR: ({ log }) => TB_LOGGER?.saveLogToStorage(log),

    TEST_MODEL_WITH_KEY: ({ provider, modelId, apiKey }) => {
      assertOptionsSender(sender);
      return testModelAvailability(provider, modelId, createProviderTestSettings(provider, apiKey));
    },
    LOOKUP_AND_TRANSLATE_COMMENT: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["redmineApiKey", "ai"]);
      const redmineIssue = await findRedmineIssueWithCache(
        settings.redmineDomain,
        settings.redmineApiKey,
        msg.issueKey,
        msg.issueSummary
      );
      const translated = await translateText(msg.commentText, settings, msg.commentUrl);
      const finalPreview = msg.userInfo ? `${msg.userInfo}\n${translated}` : translated;
      return {
        redmineIssueId: redmineIssue?.id || "",
        issueTitle: redmineIssue?.title || msg.issueSummary,
        previewText: finalPreview,
      };
    },
    SEND_TO_REDMINE: (msg) =>
      TB_REQUEST_DEDUPER.run(TB_REQUEST_DEDUPER.createKey(msg.type, msg), () =>
        handleSendToRedmine(msg, sender)
      ),
    SEND_TO_BACKLOG: (msg) =>
      TB_REQUEST_DEDUPER.run(TB_REQUEST_DEDUPER.createKey(msg.type, msg), () =>
        handleSendToBacklog(msg)
      ),
    GET_BACKLOG_ISSUE_INFO: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["backlogApiKey"]);
      return getBacklogIssueInfo(msg.issueKey);
    },
    GET_BACKLOG_USERS: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["backlogApiKey"]);
      return getBacklogUsers(msg.projectKey);
    },
    FETCH_REDMINE_METADATA: (msg) => handleFetchMetadata(msg.endpoint),
    FETCH_REDMINE_PROJECTS_WITH_KEY: ({ domain, apiKey }) => {
      assertOptionsSender(sender);
      return handleFetchProjectsWithCredentials(domain, apiKey);
    },
    CREATE_REDMINE_ISSUE: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["redmineApiKey", "ai"]);
      return handleCreateRedmineIssue(msg);
    },
    EXTRACT_JAPANESE_CONTENT: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["ai"]);
      return {
        previewText: await translateText(
          msg.commentText,
          settings,
          null,
          TB.PROMPTS.EXTRACT_JAPANESE
        ),
      };
    },
    TRANSLATE_TEXT_SIMPLE: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["ai"]);
      return {
        translatedText: await translateText(msg.text, settings, null, TB.PROMPTS.SIMPLE_TRANSLATE),
      };
    },
    TRANSLATE_COMMENT_FULL: async (msg) => {
      const settings = await getSettings();
      assertSettings(settings, ["ai"]);
      return {
        translatedText: await translateText(
          msg.commentText,
          settings,
          msg.commentUrl || null,
          TB.PROMPTS.USER
        ),
      };
    },
  };

  const handler = handlers[message.type];
  if (handler) {
    Promise.resolve(handler(message))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        const errorString = err instanceof Error ? err.message : String(err || "Unknown error");
        const isSettingsError = /api key|setting|cấu hình/i.test(errorString);
        console.error(`${DEBUG_PREFIX} Message handler error for '${message.type}':`, err);
        TB_LOGGER?.logError("Background", err, { messageType: message.type });
        sendResponse({ ok: false, error: errorString, isSettingsError });
      });
    return true; // Keep channel open for async response
  }
});

// ============================================================================
// Settings Management
// ============================================================================

let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 15000; // 15 seconds
const issueLookupCache = new Map();
const LOOKUP_CACHE_TTL = 60000; // 1 minute

/**
 * Loads, decrypts, and caches extension settings.
 * @returns {Promise<object>} Decrypted settings object.
 */
async function getSettings() {
  const now = Date.now();
  if (settingsCache && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }

  const keys = [
    "redmineApiKey",
    "redmineDomain",
    "backlogDomain",
    "backlogApiKey",
    "geminiApiKey",
    "geminiApiKeys",
    "geminiModels",
    "cerebrasApiKey",
    "cerebrasApiKeys",
    "cerebrasModels",
    "groqApiKey",
    "groqApiKeys",
    "groqModels",
    "openrouterApiKey",
    "openrouterApiKeys",
    "openrouterModels",
    "fallbackGeminiApiKeys",
    "fallbackGeminiModels",
    "fallbackCerebrasApiKey",
    "fallbackCerebrasApiKeys",
    "fallbackCerebrasModels",
    "fallbackGroqApiKey",
    "fallbackGroqApiKeys",
    "fallbackGroqModels",
    "fallbackOpenrouterApiKey",
    "fallbackOpenrouterApiKeys",
    "fallbackOpenrouterModels",
    "primaryProvider",
    "primaryModel",
    "fallbackProvider",
    "fallbackModel",
    "defaultProjectId",
    "reportProjectId",
    "manualFields",
    "showRedmineSuccessModal",
  ];
  const items = await chrome.storage.local.get(keys);

  const geminiApiKeysStr = items.geminiApiKeys ? await decryptData(items.geminiApiKeys) : "";
  const geminiModelsStr = items.geminiModels ? await decryptData(items.geminiModels) : "";
  const cerebrasApiKeysStr = items.cerebrasApiKeys ? await decryptData(items.cerebrasApiKeys) : "";
  const cerebrasModelsStr = items.cerebrasModels ? await decryptData(items.cerebrasModels) : "";
  const groqApiKeysStr = items.groqApiKeys ? await decryptData(items.groqApiKeys) : "";
  const groqModelsStr = items.groqModels ? await decryptData(items.groqModels) : "";
  const openrouterApiKeysStr = items.openrouterApiKeys
    ? await decryptData(items.openrouterApiKeys)
    : "";
  const openrouterModelsStr = items.openrouterModels
    ? await decryptData(items.openrouterModels)
    : "";
  const fallbackCerebrasApiKeysStr = items.fallbackCerebrasApiKeys
    ? await decryptData(items.fallbackCerebrasApiKeys)
    : "";
  const fallbackCerebrasModelsStr = items.fallbackCerebrasModels
    ? await decryptData(items.fallbackCerebrasModels)
    : "";
  const fallbackGeminiApiKeysStr = items.fallbackGeminiApiKeys
    ? await decryptData(items.fallbackGeminiApiKeys)
    : "";
  const fallbackGeminiModelsStr = items.fallbackGeminiModels
    ? await decryptData(items.fallbackGeminiModels)
    : "";
  const fallbackGroqApiKeysStr = items.fallbackGroqApiKeys
    ? await decryptData(items.fallbackGroqApiKeys)
    : "";
  const fallbackGroqModelsStr = items.fallbackGroqModels
    ? await decryptData(items.fallbackGroqModels)
    : "";
  const fallbackOpenrouterApiKeysStr = items.fallbackOpenrouterApiKeys
    ? await decryptData(items.fallbackOpenrouterApiKeys)
    : "";
  const fallbackOpenrouterModelsStr = items.fallbackOpenrouterModels
    ? await decryptData(items.fallbackOpenrouterModels)
    : "";

  const decryptedSettings = {
    redmineDomain: items.redmineDomain || TB.REDMINE_DOMAIN,
    redmineApiKey: await decryptData(items.redmineApiKey ?? ""),
    backlogDomain: items.backlogDomain || TB.BACKLOG_DOMAIN,
    backlogApiKey: await decryptData(items.backlogApiKey ?? ""),
    primaryProvider: items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER,
    primaryModel: items.primaryModel ?? TB.DEFAULT_PRIMARY_MODEL,
    fallbackProvider: items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER,
    fallbackModel: items.fallbackModel ?? TB.DEFAULT_FALLBACK_MODEL,
    geminiApiKey: await decryptData(items.geminiApiKey ?? ""), // Legacy fallback
    geminiApiKeys: geminiApiKeysStr.split("\n").filter(Boolean),
    geminiModels: geminiModelsStr.split("\n").filter(Boolean),
    cerebrasApiKey: await decryptData(items.cerebrasApiKey ?? ""),
    cerebrasApiKeys: cerebrasApiKeysStr.split("\n").filter(Boolean),
    cerebrasModels: cerebrasModelsStr.split("\n").filter(Boolean),
    groqApiKey: await decryptData(items.groqApiKey ?? ""),
    groqApiKeys: groqApiKeysStr.split("\n").filter(Boolean),
    groqModels: groqModelsStr.split("\n").filter(Boolean),
    openrouterApiKey: await decryptData(items.openrouterApiKey ?? ""),
    openrouterApiKeys: openrouterApiKeysStr.split("\n").filter(Boolean),
    openrouterModels: openrouterModelsStr.split("\n").filter(Boolean),
    fallbackCerebrasApiKey: await decryptData(items.fallbackCerebrasApiKey ?? ""),
    fallbackGeminiApiKeys: fallbackGeminiApiKeysStr.split("\n").filter(Boolean),
    fallbackGeminiModels: fallbackGeminiModelsStr.split("\n").filter(Boolean),
    fallbackCerebrasApiKeys: fallbackCerebrasApiKeysStr.split("\n").filter(Boolean),
    fallbackCerebrasModels: fallbackCerebrasModelsStr.split("\n").filter(Boolean),
    fallbackGroqApiKey: await decryptData(items.fallbackGroqApiKey ?? ""),
    fallbackGroqApiKeys: fallbackGroqApiKeysStr.split("\n").filter(Boolean),
    fallbackGroqModels: fallbackGroqModelsStr.split("\n").filter(Boolean),
    fallbackOpenrouterApiKey: await decryptData(items.fallbackOpenrouterApiKey ?? ""),
    fallbackOpenrouterApiKeys: fallbackOpenrouterApiKeysStr.split("\n").filter(Boolean),
    fallbackOpenrouterModels: fallbackOpenrouterModelsStr.split("\n").filter(Boolean),
    defaultProjectId: items.defaultProjectId || "",
    reportProjectId: items.reportProjectId || "",
    manualFields: items.manualFields || "",
    showRedmineSuccessModal: items.showRedmineSuccessModal !== false,
  };

  settingsCache = decryptedSettings;
  settingsCacheTime = Date.now();
  return decryptedSettings;
}

/**
 * Clears the settings cache when storage is changed.
 */
chrome.storage.onChanged.addListener(() => {
  settingsCache = null;
  settingsCacheTime = 0;
  issueLookupCache.clear();
});

/**
 * Validates that essential settings are configured.
 * @param {object} settings - The settings object.
 * @param {Array<string>} required - A list of contexts to check ('redmineApiKey', 'ai', 'backlogApiKey').
 * @throws {Error} If a required setting is missing.
 */
function assertSettings(settings, required = []) {
  if (required.includes("redmineApiKey") && !settings.redmineApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.REDMINE_API_KEY_REQUIRED);
  }
  if (required.includes("backlogApiKey") && !settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }
  if (required.includes("ai")) {
    const provider = settings.primaryProvider;
    if (
      provider === TB.PROVIDERS.GEMINI &&
      !settings.geminiApiKey &&
      settings.geminiApiKeys.length === 0
    ) {
      throw new Error(TB.MESSAGES.SETTINGS.GEMINI_API_KEY_REQUIRED);
    }
    if (
      provider === TB.PROVIDERS.GROQ &&
      !settings.groqApiKey &&
      settings.groqApiKeys.length === 0
    ) {
      throw new Error("Missing Groq API Key.");
    }
    if (
      provider === TB.PROVIDERS.CEREBRAS &&
      !settings.cerebrasApiKey &&
      settings.cerebrasApiKeys.length === 0
    ) {
      throw new Error("Missing Cerebras API Key.");
    }
    if (
      provider === TB.PROVIDERS.OPENROUTER &&
      !settings.openrouterApiKey &&
      settings.openrouterApiKeys.length === 0
    ) {
      throw new Error("Missing OpenRouter API Key.");
    }
  }
}

// ============================================================================
// Caching & Utility Functions
// ============================================================================

async function findRedmineIssueWithCache(domain, apiKey, issueKey, summary) {
  const cacheKey = JSON.stringify([domain, issueKey, summary]);
  const now = Date.now();
  const cached = issueLookupCache.get(cacheKey);

  if (cached && now - cached.time < LOOKUP_CACHE_TTL) {
    return cached.data;
  }

  const result = await findRedmineIssue(domain, apiKey, issueKey, summary);
  issueLookupCache.set(cacheKey, { data: result, time: now });
  return result;
}

async function handleFetchMetadata(endpoint) {
  const settings = await getSettings();
  assertSettings(settings, ["redmineApiKey"]);
  assertAllowedRedmineMetadataEndpoint(endpoint);
  const url = buildRedmineUrl(settings.redmineDomain, endpoint);
  const response = await timeoutFetch(
    url,
    {
      headers: { "X-Redmine-API-Key": settings.redmineApiKey, Accept: "application/json" },
    },
    10000
  );

  if (!response.ok) {
    throw new Error(
      `${TB.MESSAGES.REDMINE.API_REQUEST_FAILED} (${response.status}) for ${endpoint}`
    );
  }
  return await response.json();
}

async function handleFetchProjectsWithCredentials(domain, apiKey) {
  if (!TB_SETTINGS_VIEW.hasSameOrigin(domain, TB.REDMINE_DOMAIN)) {
    throw new Error("Unsupported Redmine domain.");
  }
  if (!apiKey) {
    throw new Error("Missing Redmine API key.");
  }

  const response = await timeoutFetch(
    new URL("/projects.json?limit=100", domain).toString(),
    {
      headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
    },
    10000
  );
  if (!response.ok) {
    throw new Error(`Redmine projects request failed (${response.status}).`);
  }
  const data = await safeReadJson(response);
  return data?.projects || [];
}

function createProviderTestSettings(provider, apiKey) {
  if (!apiKey) throw new Error("Missing provider API key.");
  return {
    geminiApiKey: provider === TB.PROVIDERS.GEMINI ? apiKey : "",
    geminiApiKeys: provider === TB.PROVIDERS.GEMINI ? [apiKey] : [],
    groqApiKey: provider === TB.PROVIDERS.GROQ ? apiKey : "",
    cerebrasApiKey: provider === TB.PROVIDERS.CEREBRAS ? apiKey : "",
    openrouterApiKey: provider === TB.PROVIDERS.OPENROUTER ? apiKey : "",
  };
}

function assertAllowedRedmineMetadataEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
    throw new Error("Unsupported Redmine metadata endpoint.");
  }

  const parsedEndpoint = new URL(endpoint, "https://redmine.local");
  const pathname = parsedEndpoint.pathname;
  const allowedPatterns = [
    /^\/projects\.json$/,
    /^\/issues\/\d+\.json$/,
    /^\/trackers\.json$/,
    /^\/enumerations\/issue_priorities\.json$/,
    /^\/projects\/\d+\/versions\.json$/,
  ];

  if (!allowedPatterns.some((pattern) => pattern.test(pathname))) {
    throw new Error("Unsupported Redmine metadata endpoint.");
  }

  if (pathname === "/projects.json") {
    const limit = parsedEndpoint.searchParams.get("limit");
    if (limit && !/^\d+$/.test(limit)) {
      throw new Error("Unsupported Redmine metadata query.");
    }
    return;
  }

  if (parsedEndpoint.search) {
    throw new Error("Unsupported Redmine metadata query.");
  }
}

function assertTrustedRedmineSender(sender, redmineDomain) {
  if (TB_SETTINGS_VIEW.hasSameOrigin(sender?.url, redmineDomain)) return;

  throw new Error("Redmine report settings are unavailable for this page.");
}

function assertOptionsSender(sender) {
  if (sender?.url !== chrome.runtime.getURL("src/options.html")) {
    throw new Error("This operation is only available from the options page.");
  }
}
