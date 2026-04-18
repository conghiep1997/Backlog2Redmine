// Wait for DOM and constants.js to be ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[OPTIONS] DOMContentLoaded fired");
  console.log("[OPTIONS] TB available:", typeof TB !== "undefined");

  if (typeof TB === "undefined") {
    console.error("[OPTIONS] TB is not defined! constants.js may not have loaded.");
    return;
  }

  // Get DOM elements
  const form = document.getElementById("optionsForm");
  const redmineDomainInput = document.getElementById("redmineDomain");
  const redmineApiKeyInput = document.getElementById("redmineApiKey");

  // Backlog elements
  const backlogDomainInput = document.getElementById("backlogDomain");
  const backlogApiKeyInput = document.getElementById("backlogApiKey");

  // Primary elements
  const primaryProviderSelect = document.getElementById("primaryProvider");
  const primaryModelSelect = document.getElementById("primaryModel");

  // Fallback elements
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const fallbackModelSelect = document.getElementById("fallbackModel");
  const fallbackModelField = document.getElementById("fallbackModelField");

  // Credentials elements (Primary)
  const primaryGeminiKeyContainer = document.getElementById("primaryGeminiKeyContainer");
  const primaryCerebrasKeyContainer = document.getElementById("primaryCerebrasKeyContainer");
  const primaryGeminiApiKeyInput = document.getElementById("primaryGeminiApiKey");
  const primaryCerebrasApiKeyInput = document.getElementById("primaryCerebrasApiKey");

  // Credentials elements (Fallback)
  const fallbackGeminiKeyContainer = document.getElementById("fallbackGeminiKeyContainer");
  const fallbackCerebrasKeyContainer = document.getElementById("fallbackCerebrasKeyContainer");
  const fallbackGeminiApiKeyInput = document.getElementById("fallbackGeminiApiKey");
  const fallbackCerebrasApiKeyInput = document.getElementById("fallbackCerebrasApiKey");

  const statusEl = document.getElementById("status");

  if (!form || !primaryProviderSelect || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Missing DOM elements");
    return;
  }

  // Load existing options
  loadOptions();

  // Listeners
  primaryProviderSelect.addEventListener("change", () => {
    updateModelDropdown(primaryModelSelect, primaryProviderSelect.value);
    updateKeyVisibility();
  });

  fallbackProviderSelect.addEventListener("change", () => {
    const provider = fallbackProviderSelect.value;
    if (provider === TB.PROVIDERS.NONE) {
      fallbackModelField.style.display = "none";
    } else {
      fallbackModelField.style.display = "block";
      updateModelDropdown(fallbackModelSelect, provider);
    }
    updateKeyVisibility();
  });

  // Sync key fields with same class
  const syncFields = (className) => {
    const fields = document.querySelectorAll(`.${className}`);
    fields.forEach((f) => {
      f.addEventListener("input", (e) => {
        fields.forEach((other) => {
          if (other !== e.target) {
            other.value = e.target.value;
          }
        });
      });
    });
  };
  syncFields("gemini-key-sync");
  syncFields("cerebras-key-sync");

  // Form submit handler
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const settings = {
      redmineApiKey: await encryptData(redmineApiKeyInput.value.trim()),
      backlogDomain: backlogDomainInput.value.trim() || TB.BACKLOG_DOMAIN,
      backlogApiKey: await encryptData(backlogApiKeyInput.value.trim()),
      primaryProvider: primaryProviderSelect.value,
      primaryModel: primaryModelSelect.value,
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: fallbackModelSelect.value,
    };

    // Validate and encrypt needed keys
    const needsGemini =
      settings.primaryProvider === TB.PROVIDERS.GEMINI ||
      settings.fallbackProvider === TB.PROVIDERS.GEMINI;
    const needsCerebras =
      settings.primaryProvider === TB.PROVIDERS.CEREBRAS ||
      settings.fallbackProvider === TB.PROVIDERS.CEREBRAS;

    if (needsGemini) {
      const key = (primaryGeminiApiKeyInput.value || fallbackGeminiApiKeyInput.value).trim();
      const placeholder =
        primaryGeminiApiKeyInput.placeholder || fallbackGeminiApiKeyInput.placeholder;
      if (
        !key &&
        !placeholder.includes(
          TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER.replace("********** ", "")
        )
      ) {
        setStatus(TB.MESSAGES.SETTINGS.OPTIONS_GEMINI_KEY_REQUIRED);
        return;
      }
      if (key) {
        settings.geminiApiKey = await encryptData(key);
      }
    }

    if (needsCerebras) {
      const key = (primaryCerebrasApiKeyInput.value || fallbackCerebrasApiKeyInput.value).trim();
      const placeholder =
        primaryCerebrasApiKeyInput.placeholder || fallbackCerebrasApiKeyInput.placeholder;
      if (
        !key &&
        !placeholder.includes(
          TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER.replace("********** ", "")
        )
      ) {
        setStatus(TB.MESSAGES.SETTINGS.OPTIONS_CEREBRAS_KEY_REQUIRED);
        return;
      }
      if (key) {
        settings.cerebrasApiKey = await encryptData(key);
      }
    }

    try {
      await chrome.storage.local.set(settings);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_SUCCESS);
      // Briefly clear password inputs for security
      if (settings.geminiApiKey) {
        primaryGeminiApiKeyInput.value = "";
        fallbackGeminiApiKeyInput.value = "";
      }
      if (settings.cerebrasApiKey) {
        primaryCerebrasApiKeyInput.value = "";
        fallbackCerebrasApiKeyInput.value = "";
      }
      loadOptions(); // Refresh placeholders
    } catch (error) {
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR(error.message));
    }
  });

  // Functions
  function loadOptions() {
    chrome.storage.local.get(
      [
        "redmineApiKey",
        "backlogDomain",
        "backlogApiKey",
        "geminiApiKey",
        "cerebrasApiKey",
        "primaryProvider",
        "primaryModel",
        "fallbackProvider",
        "fallbackModel",
      ],
      async (items) => {
        redmineDomainInput.value = TB.REDMINE_DOMAIN;
        if (items.redmineApiKey) {
          redmineApiKeyInput.value = await decryptData(items.redmineApiKey);
        }

        backlogDomainInput.value = items.backlogDomain || TB.BACKLOG_DOMAIN;
        if (items.backlogApiKey) {
          backlogApiKeyInput.value = await decryptData(items.backlogApiKey);
        }

        primaryProviderSelect.value = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
        updateModelDropdown(primaryModelSelect, primaryProviderSelect.value);
        primaryModelSelect.value = items.primaryModel || TB.DEFAULT_PRIMARY_MODEL;

        fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
        if (fallbackProviderSelect.value !== TB.PROVIDERS.NONE) {
          fallbackModelField.style.display = "block";
          updateModelDropdown(fallbackModelSelect, fallbackProviderSelect.value);
          fallbackModelSelect.value = items.fallbackModel || TB.DEFAULT_FALLBACK_MODEL;
        } else {
          fallbackModelField.style.display = "none";
        }

        if (items.geminiApiKey) {
          primaryGeminiApiKeyInput.placeholder = TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER;
          fallbackGeminiApiKeyInput.placeholder = TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER;
        }
        if (items.cerebrasApiKey) {
          primaryCerebrasApiKeyInput.placeholder = TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER;
          fallbackCerebrasApiKeyInput.placeholder = TB.MESSAGES.SETTINGS.OPTIONS_SAVED_PLACEHOLDER;
        }

        updateKeyVisibility();
      }
    );
  }

  function updateModelDropdown(selectElement, provider) {
    if (!selectElement) {
      return;
    }
    const models =
      provider === TB.PROVIDERS.GEMINI
        ? TB.GEMINI_MODELS
        : provider === TB.PROVIDERS.CEREBRAS
          ? TB.CEREBRAS_MODELS
          : [];

    selectElement.innerHTML = "";
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      selectElement.appendChild(option);
    });
  }

  function updateKeyVisibility() {
    const p = primaryProviderSelect.value;
    const f = fallbackProviderSelect.value;

    primaryGeminiKeyContainer.style.display = p === TB.PROVIDERS.GEMINI ? "block" : "none";
    primaryCerebrasKeyContainer.style.display = p === TB.PROVIDERS.CEREBRAS ? "block" : "none";

    fallbackGeminiKeyContainer.style.display = f === TB.PROVIDERS.GEMINI ? "block" : "none";
    fallbackCerebrasKeyContainer.style.display = f === TB.PROVIDERS.CEREBRAS ? "block" : "none";
  }

  function setStatus(message) {
    statusEl.textContent = message;
    window.setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = "";
      }
    }, 2500);
  }
});
