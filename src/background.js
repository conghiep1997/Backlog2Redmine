/**
 * Service Worker Entry Point for Backlog2Redmine Extension.
 * Loads modules and coordinates message handling between content scripts and external APIs.
 */

/* global TB_LOGGER, getBacklogIssueInfo, getBacklogUsers */

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

// ✅ Backend API URL for version check
const BACKEND_API_URL = "https://dev-tool-platform-api.onrender.com/api";

/**
 * Check if we should run update check today
 * Returns true if never checked or last check was yesterday or earlier
 */
function shouldCheckForUpdates() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastUpdateCheck'], (result) => {
      const lastCheck = result.lastUpdateCheck;
      
      if (!lastCheck) {
        // Never checked before
        resolve(true);
        return;
      }
      
      const lastCheckDate = new Date(lastCheck);
      const now = new Date();
      
      // Check if it's a new day (or 24 hours have passed)
      const hoursSinceLastCheck = (now - lastCheckDate) / (1000 * 60 * 60);
      
      if (hoursSinceLastCheck >= 24) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Mark update check as completed for today
 */
function markUpdateCheckComplete() {
  return chrome.storage.local.set({
    lastUpdateCheck: new Date().toISOString()
  });
}

// Check for updates when extension starts
chrome.runtime.onStartup.addListener(async () => {
  console.log(`${DEBUG_PREFIX} Extension started, checking for updates...`);
  const shouldCheck = await shouldCheckForUpdates();
  if (shouldCheck) {
    await checkForUpdates();
    await markUpdateCheckComplete();
  }
});

// Check when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
  
  // Always check on install/update
  await checkForUpdates();
  await markUpdateCheckComplete();
});

// Optional: Check when extension receives a message (can be triggered by content script or options page)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkForUpdates") {
    checkForUpdates().then(() => {
      sendResponse({status: "checked"});
    });
    return true; // Keep message channel open for async response
  }
  return false;
});

// ✅ Check for updates function
async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;
  
  try {
    const response = await fetch(`${BACKEND_API_URL}/versions/latest`);
    if (!response.ok) {
      console.warn(`${DEBUG_PREFIX} Failed to fetch latest version: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const latestVersion = data.version_number;
    
    // Compare semantic versions
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpToDate = comparison >= 0;
    
    console.log(`${DEBUG_PREFIX} Version check: current=${currentVersion}, latest=${latestVersion}, upToDate=${isUpToDate}`);
    
    if (!isUpToDate) {
      // Set red badge
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
      
      // Store update info for options page to read
      await chrome.storage.local.set({
        updateAvailable: true,
        latestVersion: latestVersion,
        changelog: data.changelog || [],
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Update available! Badge set.`);
      
      // Show notification popup
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-48.png',
        title: '🚀 Cập nhật mới sẵn sàng!',
        message: `Phiên bản ${latestVersion} đã ra mắt. Click để download ngay!`,
        priority: 2,
        buttons: [
          { title: 'Download ngay' },
          { title: 'Để sau' }
        ]
      });
    } else {
      // Clear badge if up to date
      await chrome.action.setBadgeText({ text: "" });
      
      // Store status
      await chrome.storage.local.set({
        updateAvailable: false,
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Extension is up to date.`);
    }
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Update check failed:`, error.message);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ 
    url: 'https://dev-tool-platform.vercel.app/' 
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);
  
  if (buttonIndex === 0) {
    // Download now button
    chrome.tabs.create({ 
      url: 'https://dev-tool-platform.vercel.app/' 
    });
  }
  // Button 1 (Later) - just dismiss
});

// --- Donate Modal Logic ---
// --- End of Donate Modal Logic ---


// Check for updates when extension starts
chrome.runtime.onStartup.addListener(async () => {
  console.log(`${DEBUG_PREFIX} Extension started, checking for updates...`);
  const shouldCheck = await shouldCheckForUpdates();
  if (shouldCheck) {
    await checkForUpdates();
    await markUpdateCheckComplete();
  }
});

// Also check when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
  
  // Always check on install/update
  await checkForUpdates();
  await markUpdateCheckComplete();
});

// Optional: Check when extension receives a message (can be triggered by content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkForUpdates") {
    checkForUpdates().then(() => {
      sendResponse({status: "checked"});
    });
    return true; // Keep message channel open for async response
  }
  return false;
});

// Also check periodically (once per day) as backup
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkForUpdates") {
    await checkForUpdates();
  }
});

// Initialize alarm for daily check
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkForUpdates", { periodInMinutes: 60 }); // Check hourly as backup
});

// Check on startup to set up alarm
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("checkForUpdates", { periodInMinutes: 60 });
});

/**
 * Message handler for chrome.runtime.onMessage.
 * Handles messages from content scripts and options page.
 */
// ✅ Backend API URL for version check
const BACKEND_API_URL = "https://dev-tool-platform-api.onrender.com/api";
const CHECK_INTERVAL_HOURS = 24; // Check once per day

/**
 * Check if we should run update check today
 * Returns true if never checked or last check was yesterday or earlier
 */
function shouldCheckForUpdates() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastUpdateCheck'], (result) => {
      const lastCheck = result.lastUpdateCheck;
      
      if (!lastCheck) {
        // Never checked before
        resolve(true);
        return;
      }
      
      const lastCheckDate = new Date(lastCheck);
      const now = new Date();
      
      // Check if it's a new day (or 24 hours have passed)
      const hoursSinceLastCheck = (now - lastCheckDate) / (1000 * 60 * 60);
      
      if (hoursSinceLastCheck >= CHECK_INTERVAL_HOURS) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Mark update check as completed for today
 */
function markUpdateCheckComplete() {
  return chrome.storage.local.set({
    lastUpdateCheck: new Date().toISOString()
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log(`${DEBUG_PREFIX} Extension installed, opening options page.`);
    chrome.runtime.openOptionsPage();
  }
  
  // ✅ Check on install
  await checkForUpdates();
  await markUpdateCheckComplete();
});

// ✅ Handle alarm for periodic update checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkForUpdates") {
    await checkForUpdates();
  }
});

// ✅ Check for updates function
async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;
  
  try {
    const response = await fetch(`${BACKEND_API_URL}/versions/latest`);
    if (!response.ok) {
      console.warn(`${DEBUG_PREFIX} Failed to fetch latest version: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const latestVersion = data.version_number;
    
    // Compare semantic versions
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpToDate = comparison >= 0;
    
    console.log(`${DEBUG_PREFIX} Version check: current=${currentVersion}, latest=${latestVersion}, upToDate=${isUpToDate}`);
    
    if (!isUpToDate) {
      // Set red badge
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
      
      // Store update info for options page to read
      await chrome.storage.local.set({
        updateAvailable: true,
        latestVersion: latestVersion,
        changelog: data.changelog || [],
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Update available! Badge set.`);
      
      // Show notification popup
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-48.png',
        title: '🚀 Cập nhật mới sẵn sàng!',
        message: `Phiên bản ${latestVersion} đã ra mắt. Click để download ngay!`,
        priority: 2,
        buttons: [
          { title: 'Download ngay' },
          { title: 'Để sau' }
        ]
      });
    } else {
      // Clear badge if up to date
      await chrome.action.setBadgeText({ text: "" });
      
      // Store status
      await chrome.storage.local.set({
        updateAvailable: false,
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Extension is up to date.`);
    }
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Update check failed:`, error.message);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ 
    url: 'https://dev-tool-platform.vercel.app/' 
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);
  
  if (buttonIndex === 0) {
    // Download now button
    chrome.tabs.create({ 
      url: 'https://dev-tool-platform.vercel.app/' 
    });
  }
  // Button 1 (Later) - just dismiss
});

// ✅ Check for updates function
async function checkForUpdates() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;
  
  try {
    const response = await fetch(`${BACKEND_API_URL}/versions/latest`);
    if (!response.ok) {
      console.warn(`${DEBUG_PREFIX} Failed to fetch latest version: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const latestVersion = data.version_number;
    
    // Compare semantic versions
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpToDate = comparison >= 0;
    
    console.log(`${DEBUG_PREFIX} Version check: current=${currentVersion}, latest=${latestVersion}, upToDate=${isUpToDate}`);
    
    if (!isUpToDate) {
      // Set red badge
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
      
      // Store update info for options page to read
      await chrome.storage.local.set({
        updateAvailable: true,
        latestVersion: latestVersion,
        changelog: data.changelog || [],
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Update available! Badge set.`);
      
      // Show notification popup
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-48.png',
        title: '🚀 Cập nhật mới sẵn sàng!',
        message: `Phiên bản ${latestVersion} đã ra mắt. Click để download ngay!`,
        priority: 2,
        buttons: [
          { title: 'Download ngay' },
          { title: 'Để sau' }
        ]
      });
    } else {
      // Clear badge if up to date
      await chrome.action.setBadgeText({ text: "" });
      
      // Store status
      await chrome.storage.local.set({
        updateAvailable: false,
        lastChecked: new Date().toISOString()
      });
      
      console.log(`${DEBUG_PREFIX} Extension is up to date.`);
    }
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Update check failed:`, error.message);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.tabs.create({ 
    url: 'https://dev-tool-platform.vercel.app/' 
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);
  
  if (buttonIndex === 0) {
    // Download now button
    chrome.tabs.create({ 
      url: 'https://dev-tool-platform.vercel.app/' 
    });
  }
  // Button 1 (Later) - just dismiss
});
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Error checking for updates:`, error);
  }
}

// ✅ Simple semantic version comparison
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

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
     * GET_BACKLOG_ISSUE_INFO:
     * Fetch Backlog issue information by issue key.
     */
    GET_BACKLOG_ISSUE_INFO: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      return getBacklogIssueInfo(message.issueKey);
    },

    /**
     * GET_BACKLOG_USERS:
     * Fetch list of Backlog users for mention suggestions.
     */
    GET_BACKLOG_USERS: async () => {
      const settings = await getSettings();
      assertSettings(settings);
      return getBacklogUsers(message.projectKey);
    },

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
