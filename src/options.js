// Wait for DOM and constants.js to be ready
/* global TB_LOGGER, setStatus, loadOptions, updateModelDropdown, updateKeyVisibility, fetchProjects */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof TB === "undefined") {
    console.error("[OPTIONS] Lỗi: TB chưa được định nghĩa! constants.js có thể chưa tải xong.");
    return;
  }

  // Get DOM elements
  const form = document.getElementById("optionsForm");
  const redmineDomainInput = document.getElementById("redmineDomain");
  const redmineApiKeyInput = document.getElementById("redmineApiKey");

  // New field for Report Project ID

  // Backlog elements
  const backlogDomainInput = document.getElementById("backlogDomain");
  const backlogApiKeyInput = document.getElementById("backlogApiKey");

  // Primary elements
  const primaryProviderSelect = document.getElementById("primaryProvider");

  // Fallback elements
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const fallbackModelSelect = document.getElementById("fallbackModel");
  const fallbackModelField = document.getElementById("fallbackModelField");

  // Credentials elements (Fallback)
  const fallbackCerebrasKeyContainer = document.getElementById("fallbackCerebrasKeyContainer");
  const fallbackGroqKeyContainer = document.getElementById("fallbackGroqKeyContainer");
  const fallbackCerebrasApiKeyInput = document.getElementById("fallbackCerebrasApiKey");
  const fallbackGroqApiKeyInput = document.getElementById("fallbackGroqApiKey");

  const defaultProjectIdSelect = document.getElementById("defaultProjectId");
  const reportProjectIdSelect = document.getElementById("reportProjectId");
  const manualFieldsInput = document.getElementById("manualFields");
  const statusEl = document.getElementById("status");

  // Multiple Models/Keys elements
  const geminiModelsList = document.getElementById("geminiModelsList");
  const geminiKeysList = document.getElementById("geminiKeysList");
  const geminiApiKeysInput = document.getElementById("geminiApiKeys");

  // Store selected items
  let selectedGeminiModels = [];
  const selectedGeminiKeys = [];

  if (!form || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  // Load existing options
  loadOptions();

  // Listeners

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

  const syncProjectsBtn = document.getElementById("syncProjectsBtn");
  syncProjectsBtn?.addEventListener("click", async () => {
    if (redmineApiKeyInput.value.trim()) {
      fetchProjects(
        redmineApiKeyInput.value.trim(),
        defaultProjectIdSelect.value,
        reportProjectIdSelect.value
      );
    } else {
      alert("Vui lòng nhập Redmine API Key trước khi đồng bộ.");
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
  syncFields("cerebras-key-sync");

  // Handle Export Logs
  const exportLogsBtn = document.getElementById("exportLogsBtn");
  exportLogsBtn?.addEventListener("click", async () => {
    try {
      if (typeof TB_LOGGER === "undefined") {
        alert("Logger utility chưa được tải.");
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
      console.error("Xuất log thất bại", e);
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

    let settings = {};
    try {
      settings = {
        redmineApiKey: await encryptData(redmineApiKeyInput.value.trim()),
        reportProjectId: reportProjectIdSelect.value,
        backlogDomain: backlogDomainInput.value.trim() || TB.BACKLOG_DOMAIN,
        backlogApiKey: await encryptData(backlogApiKeyInput.value.trim()),
        primaryProvider: primaryProviderSelect.value,
        fallbackProvider: fallbackProviderSelect.value,
        fallbackModel: fallbackModelSelect.value,
        defaultProjectId: defaultProjectIdSelect.value,
        manualFields: manualFieldsInput.value.trim(),
      };

      // Save Multiple Gemini Configuration
      if (selectedGeminiModels.length > 0) {
        settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
      }
      if (selectedGeminiKeys.length > 0) {
        settings.geminiApiKeys = await encryptData(selectedGeminiKeys.join("\n"));
        // For backward compatibility and single-key fallback
        settings.geminiApiKey = await encryptData(selectedGeminiKeys[0]);
      }

      // Fallback specific keys
      if (settings.fallbackProvider === TB.PROVIDERS.CEREBRAS) {
        const key = fallbackCerebrasApiKeyInput.value.trim();
        if (key) settings.cerebrasApiKey = await encryptData(key);
      }
      if (settings.fallbackProvider === TB.PROVIDERS.GROQ) {
        const key = fallbackGroqApiKeyInput.value.trim();
        if (key) settings.groqApiKey = await encryptData(key);
      }
    } catch (e) {
      console.error("[OPTIONS] Data gathering failed:", e);
      setStatus("Lỗi thu thập dữ liệu: " + e.message);
      return;
    }

    try {
      await chrome.storage.local.set(settings);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_SUCCESS);
      // Briefly clear password inputs for security
      if (settings.cerebrasApiKey) {
        fallbackCerebrasApiKeyInput.value = "";
      }
      if (settings.groqApiKey) {
        fallbackGroqApiKeyInput.value = "";
      }
      // Delay loadOptions to allow status to be displayed
      setTimeout(() => loadOptions(), 100);
    } catch (error) {
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR(error.message));
    }
  });

  // Functions
  function loadOptions() {
    chrome.storage.local.get(
      [
        "redmineApiKey",
        "reportProjectId",
        "backlogDomain",
        "backlogApiKey",
        "geminiApiKey",
        "geminiApiKeys",
        "geminiModels",
        "cerebrasApiKey",
        "groqApiKey",
        "primaryProvider",
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
          fetchProjects(key, items.defaultProjectId, items.reportProjectId);
        }

        backlogDomainInput.value = items.backlogDomain || TB.BACKLOG_DOMAIN;

        primaryProviderSelect.value = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
        // updateModelDropdown(primaryModelSelect, primaryProviderSelect.value);
        // primaryModelSelect.value = items.primaryModel || TB.DEFAULT_PRIMARY_MODEL;

        fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
        if (fallbackProviderSelect.value !== TB.PROVIDERS.NONE) {
          fallbackModelField.style.display = "block";
          updateModelDropdown(fallbackModelSelect, fallbackProviderSelect.value);
          fallbackModelSelect.value = items.fallbackModel || TB.DEFAULT_FALLBACK_MODEL;
        } else {
          fallbackModelField.style.display = "none";
        }

        if (items.geminiModels) {
          try {
            const modelsStr = await decryptData(items.geminiModels);
            if (modelsStr) {
              const loadedModels = modelsStr.split("\n").filter((m) => m.trim());
              // Only keep models that exist in the current TB.GEMINI_MODELS list
              const validIds = TB.GEMINI_MODELS.map((m) => m.value);
              selectedGeminiModels = loadedModels.filter((m) => validIds.includes(m));
              renderGeminiModelsTags();
            }
          } catch (e) {
            console.warn("Failed to load Gemini models", e);
          }
        }

        if (items.geminiApiKeys) {
          try {
            const keys = await decryptData(items.geminiApiKeys);
            if (keys) {
              selectedGeminiKeys.length = 0;
              selectedGeminiKeys.push(...keys.split("\n").filter((k) => k.trim()));
              renderGeminiKeysButtons();
            }
          } catch (e) {
            console.warn("Failed to load Gemini keys", e);
          }
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

  async function fetchProjects(apiKey, selectedId = "", selectedReportId = "") {
    if (!apiKey) return;
    const syncBtn = document.getElementById("syncProjectsBtn");
    try {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = "⌛ Đang tải...";
      }
      defaultProjectIdSelect.innerHTML = '<option value="">Đang tải project...</option>';
      reportProjectIdSelect.innerHTML = '<option value="">Đang tải project...</option>';
      const response = await fetch(`${TB.REDMINE_DOMAIN}/projects.json?limit=100`, {
        headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      defaultProjectIdSelect.innerHTML = '<option value="">-- Chọn project --</option>';
      reportProjectIdSelect.innerHTML = '<option value="">-- Chọn project --</option>';
      data.projects.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        defaultProjectIdSelect.appendChild(opt);
        reportProjectIdSelect.appendChild(opt.cloneNode(true));
      });
      if (selectedId) {
        defaultProjectIdSelect.value = selectedId;
      }
      if (selectedReportId) {
        reportProjectIdSelect.value = selectedReportId;
      }
    } catch (e) {
      defaultProjectIdSelect.innerHTML =
        '<option value="">Lỗi tải project (Kiểm tra API Key)</option>';
      reportProjectIdSelect.innerHTML =
        '<option value="">Lỗi tải project (Kiểm tra API Key)</option>';
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = "🔄 Đồng bộ Project";
      }
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
          : provider === TB.PROVIDERS.GROQ
            ? TB.GROQ_MODELS
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
    const f = fallbackProviderSelect.value;
    if (fallbackCerebrasKeyContainer) {
      fallbackCerebrasKeyContainer.style.display = f === TB.PROVIDERS.CEREBRAS ? "block" : "none";
    }
    if (fallbackGroqKeyContainer) {
      fallbackGroqKeyContainer.style.display = f === TB.PROVIDERS.GROQ ? "block" : "none";
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
    window.setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = "";
      }
    }, 2500);
  }

  // Render Multiple Models as clickable buttons
  function renderGeminiModelsTags() {
    if (!geminiModelsList || !TB.GEMINI_MODELS) return;
    geminiModelsList.innerHTML = "";

    TB.GEMINI_MODELS.forEach((model) => {
      const isSelected = selectedGeminiModels.includes(model.value);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: ${isSelected ? "#059669" : "#ffffff"};
        border: 2px solid ${isSelected ? "#059669" : "#e2e8f0"};
        border-radius: 10px;
        font-size: 13px;
        font-weight: ${isSelected ? "700" : "500"};
        color: ${isSelected ? "#ffffff" : "#475569"};
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: ${isSelected ? "0 4px 6px -1px rgba(16, 185, 129, 0.2)" : "none"};
      `;
      btn.textContent = model.label;
      btn.addEventListener("click", () => {
        if (isSelected) {
          selectedGeminiModels = selectedGeminiModels.filter((m) => m !== model.value);
        } else {
          if (selectedGeminiModels.length < 5) {
            selectedGeminiModels.push(model.value);
          }
        }
        renderGeminiModelsTags();
      });
      geminiModelsList.appendChild(btn);
    });

    // Update count display
    const countEl = document.getElementById("selectedModelCount");
    if (countEl) countEl.textContent = selectedGeminiModels.length;
  }

  // Render Multiple Keys as clickable buttons
  function renderGeminiKeysButtons() {
    if (!geminiKeysList) return;
    geminiKeysList.innerHTML = "";

    selectedGeminiKeys.forEach((key, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: #bfdbfe;
        border: 1px solid #3b82f6;
        border-radius: 6px;
        font-size: 11px;
        font-family: monospace;
        color: #1e40af;
        cursor: pointer;
      `;
      btn.textContent = key.slice(0, 8) + "...";
      btn.title = key;
      btn.addEventListener("click", () => {
        selectedGeminiKeys.splice(index, 1);
        renderGeminiKeysButtons();
      });
      geminiKeysList.appendChild(btn);
    });

    // Update count display
    const countEl = document.getElementById("selectedKeyCount");
    if (countEl) countEl.textContent = selectedGeminiKeys.length;
  }

  // Handle Enter key in keys input
  geminiApiKeysInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const key = geminiApiKeysInput.value.trim();
      if (key && !selectedGeminiKeys.includes(key)) {
        if (selectedGeminiKeys.length < 10) {
          selectedGeminiKeys.push(key);
          renderGeminiKeysButtons();
        }
      }
      geminiApiKeysInput.value = "";
    }
  });

  // Render on load
  if (geminiModelsList) {
    // If we have default models and none selected yet, initialize them
    // but only if loadOptions hasn't populated them yet.
    // We'll move this into loadOptions or keep as fallback.
    setTimeout(() => {
      if (selectedGeminiModels.length === 0 && TB.GEMINI_MODELS) {
        // Default select all available models
        selectedGeminiModels = TB.GEMINI_MODELS.map((m) => m.value);
        renderGeminiModelsTags();
      }
    }, 200);

    renderGeminiModelsTags();
    renderGeminiKeysButtons();
  }

  // --- Donate Modal Logic ---
  // --- End of Donate Modal Logic ---
});
