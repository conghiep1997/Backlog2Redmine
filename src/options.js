// Wait for DOM and constants.js to be ready
/* global TB_LOGGER, setStatus, loadOptions, updateModelDropdown, updateKeyVisibility, fetchProjects */
document.addEventListener("DOMContentLoaded", () => {
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

  const defaultProjectIdSelect = document.getElementById("defaultProjectId");
  const manualFieldsInput = document.getElementById("manualFields");
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

  // Fetch projects if API key is available
  redmineApiKeyInput.addEventListener("blur", () => {
    if (redmineApiKeyInput.value.trim()) {
      fetchProjects(redmineApiKeyInput.value.trim());
    }
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

  // Handle Export Logs
  const exportLogsBtn = document.getElementById("exportLogsBtn");
  exportLogsBtn?.addEventListener("click", async () => {
    try {
      if (typeof TB_LOGGER === "undefined") {
        alert("Logger utility not loaded.");
        return;
      }
      const logs = await TB_LOGGER.getLogs();
      if (logs.length === 0) {
        alert("Hiện chưa có log lỗi nào.");
        return;
      }

      const logLines = logs.map((log) => {
        return `[${log.timestamp}] [${log.source}] ${log.message}\nContext: ${JSON.stringify(log.context || {})}\nStack: ${log.stack || "N/A"}\n----------------------------------------`;
      });
      const logContent = logLines.join("\n\n");

      const blob = new Blob([logContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `b2r_error_logs_${new Date().getTime()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
      alert("Lỗi khi xuất log: " + e.message);
    }
  });

  // Handle Clear Logs
  const clearLogsBtn = document.getElementById("clearLogsBtn");
  clearLogsBtn?.addEventListener("click", async () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử lỗi không?")) {
      if (typeof TB_LOGGER !== "undefined") {
        await TB_LOGGER.clearLogs();
        alert("Đã xóa toàn bộ log.");
      }
    }
  });

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
      defaultProjectId: defaultProjectIdSelect.value,
      manualFields: manualFieldsInput.value.trim(),
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
        "defaultProjectId",
        "manualFields",
      ],
      async (items) => {
        redmineDomainInput.value = TB.REDMINE_DOMAIN;
        if (items.redmineApiKey) {
          const key = await decryptData(items.redmineApiKey);
          redmineApiKeyInput.value = key;
          fetchProjects(key, items.defaultProjectId);
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

        if (items.manualFields) {
          manualFieldsInput.value = items.manualFields;
        } else {
          manualFieldsInput.value = JSON.stringify(
            {
              Severity: 46,
              "Reproduction Rate": 0,
              Role: 11,
              "QC Activity": 8,
            },
            null,
            2
          );
        }

        updateKeyVisibility();
      }
    );
  }

  async function fetchProjects(apiKey, selectedId = "") {
    if (!apiKey) return;
    try {
      defaultProjectIdSelect.innerHTML = "<option value=\"\">Đang tải project...</option>";
      const response = await fetch(`${TB.REDMINE_DOMAIN}/projects.json?limit=100`, {
        headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      defaultProjectIdSelect.innerHTML = "<option value=\"\">-- Chọn project --</option>";
      data.projects.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        defaultProjectIdSelect.appendChild(opt);
      });
      if (selectedId) {
        defaultProjectIdSelect.value = selectedId;
      }
    } catch (e) {
      defaultProjectIdSelect.innerHTML =
        "<option value=\"\">Lỗi tải project (Kiểm tra API Key)</option>";
    }
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

  // --- Donate Modal Logic ---
  // --- End of Donate Modal Logic ---
});
