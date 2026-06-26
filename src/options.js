document.addEventListener("DOMContentLoaded", () => {
  if (typeof TB === "undefined") {
    console.error("[OPTIONS] TB is not defined! constants.js may not have loaded.");
    return;
  }

  let cachedProjects = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5 * 60 * 1000;

  const form = document.getElementById("optionsForm");
  const redmineApiKeyInput = document.getElementById("redmineApiKey");
  const backlogApiKeyInput = document.getElementById("backlogApiKey");
  const groqApiKeyInput = document.getElementById("groqApiKey");
  const cerebrasApiKeyInput = document.getElementById("cerebrasApiKey");
  const openrouterApiKeyInput = document.getElementById("openrouterApiKey");
  const fallbackGroqApiKeyInput = document.getElementById("fallbackGroqApiKey");
  const fallbackCerebrasApiKeyInput = document.getElementById("fallbackCerebrasApiKey");
  const fallbackOpenrouterApiKeyInput = document.getElementById("fallbackOpenrouterApiKey");
  const fallbackGeminiApiKeysInput = document.getElementById("fallbackGeminiApiKeys");
  const primaryProviderSelect = document.getElementById("primaryProvider");
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const showRedmineSuccessModalInput = document.getElementById("showRedmineSuccessModal");
  const statusEl = document.getElementById("status");
  const PRIMARY_PROVIDER_CONFIGS = [
    {
      provider: "groq",
      keyInput: groqApiKeyInput,
      keysStorage: "groqApiKeys",
      modelsStorage: "groqModels",
    },
    {
      provider: "cerebras",
      keyInput: cerebrasApiKeyInput,
      keysStorage: "cerebrasApiKeys",
      modelsStorage: "cerebrasModels",
    },
    {
      provider: "openrouter",
      keyInput: openrouterApiKeyInput,
      keysStorage: "openrouterApiKeys",
      modelsStorage: "openrouterModels",
    },
  ];
  const FALLBACK_PROVIDER_CONFIGS = [
    {
      provider: "groq",
      keyInput: fallbackGroqApiKeyInput,
      keysStorage: "fallbackGroqApiKeys",
      modelsStorage: "fallbackGroqModels",
    },
    {
      provider: "cerebras",
      keyInput: fallbackCerebrasApiKeyInput,
      keysStorage: "fallbackCerebrasApiKeys",
      modelsStorage: "fallbackCerebrasModels",
    },
    {
      provider: "openrouter",
      keyInput: fallbackOpenrouterApiKeyInput,
      keysStorage: "fallbackOpenrouterApiKeys",
      modelsStorage: "fallbackOpenrouterModels",
    },
  ];

  if (!form || !primaryProviderSelect || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  initProviderMultiControls();
  loadOptions();

  primaryProviderSelect.addEventListener("change", () =>
    handleProviderChange(primaryProviderSelect)
  );
  fallbackProviderSelect.addEventListener("change", () =>
    handleProviderChange(fallbackProviderSelect)
  );
  redmineApiKeyInput.addEventListener("blur", handleRedmineKeyBlur);
  document.getElementById("syncProjectsBtn")?.addEventListener("click", handleSyncProjects);

  document.getElementById("geminiApiKeys")?.addEventListener("keydown", handleGeminiKeyInput);
  fallbackGeminiApiKeysInput?.addEventListener("keydown", handleFallbackGeminiKeyInput);
  document.getElementById("checkUpdateBtn")?.addEventListener("click", handleManualUpdateCheck);
  document
    .getElementById("goToDashboardBtn")
    ?.addEventListener("click", () => chrome.tabs.create({ url: "https://hipppo.vercel.app/" }));
  document.getElementById("exportLogsBtn")?.addEventListener("click", handleExportLogs);
  document.getElementById("clearLogsBtn")?.addEventListener("click", handleClearLogs);

  async function handleExportLogs() {
    if (!globalThis.TB_LOGGER?.getLogs) {
      setStatus("Không thể đọc log lỗi.", true);
      return;
    }

    const logs = await globalThis.TB_LOGGER.getLogs();
    if (logs.length === 0) {
      setStatus("Không có log lỗi để xuất.");
      return;
    }

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `b2r-error-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Đã xuất file log lỗi.");
  }

  async function handleClearLogs() {
    if (!globalThis.TB_LOGGER?.clearLogs) {
      setStatus("Không thể xóa log lỗi.", true);
      return;
    }

    const confirmed = confirm("Xóa toàn bộ lịch sử log lỗi?");
    if (!confirmed) return;

    await globalThis.TB_LOGGER.clearLogs();
    setStatus("Đã xóa lịch sử log lỗi.");
  }

  async function handleManualUpdateCheck() {
    const btn = document.getElementById("checkUpdateBtn");
    const statusDiv = document.getElementById("updateStatus");
    if (!btn || !statusDiv) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Đang kiểm tra...";
    statusDiv.innerHTML = "<p style='margin: 0; color: #64748b;'>Đang kết nối đến server...</p>";

    try {
      const manifest = chrome.runtime.getManifest();
      const currentVersion = manifest.version;
      const BACKEND_API_URL = "https://dev-tool-platform-api.onrender.com/api";

      const response = await fetch(`${BACKEND_API_URL}/versions/latest`);
      if (!response.ok) throw new Error(`Server trả về lỗi ${response.status}`);

      const data = await response.json();
      const latestVersion = data.version_number;

      // Hàm so sánh version đơn giản
      const v1 = currentVersion.split(".").map(Number);
      const v2 = latestVersion.split(".").map(Number);
      let isNewer = false;
      for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        if (num2 > num1) {
          isNewer = true;
          break;
        }
        if (num1 > num2) break;
      }

      if (isNewer) {
        statusDiv.innerHTML = `
          <p style="margin: 0; color: #f59e0b; font-weight: 600;">
            🚀 Có phiên bản mới: <span style="color: #d97706">v${latestVersion}</span>
          </p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
            Phiên bản hiện tại: v${currentVersion}. Vui lòng tải bản mới để có trải nghiệm tốt nhất.
          </p>
        `;
      } else {
        statusDiv.innerHTML = `
          <p style="margin: 0; color: #10b981; font-weight: 600;">
            ✅ Bạn đang sử dụng phiên bản mới nhất (v${currentVersion})
          </p>
        `;
      }
    } catch (error) {
      console.error("[OPTIONS] Update check failed:", error);
      statusDiv.innerHTML = `
        <p style="margin: 0; color: #ef4444; font-weight: 600;">
          ❌ Lỗi kiểm tra: ${error.message}
        </p>
      `;
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const settings = await gatherSettings();
      await chrome.storage.local.set(settings);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_SUCCESS);
      setTimeout(loadOptions, 200);
    } catch (error) {
      console.error("[OPTIONS] Save failed:", error);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR(error.message));
    }
  });

  async function gatherSettings() {
    const primaryModels = getSelectedModelsForProvider("primary", primaryProviderSelect.value);
    const fallbackModels = getSelectedModelsForProvider("fallback", fallbackProviderSelect.value);
    const settings = {
      redmineDomain: document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN,
      backlogDomain: document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      primaryProvider: primaryProviderSelect.value,
      primaryModel: primaryModels[0] || getDefaultModel(primaryProviderSelect.value),
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: fallbackModels[0] || getDefaultModel(fallbackProviderSelect.value),
      defaultProjectId: document.getElementById("defaultProjectId").value,
      reportProjectId: document.getElementById("reportProjectId").value,
      manualFields: document.getElementById("manualFields").value.trim(),
      showRedmineSuccessModal: showRedmineSuccessModalInput?.checked !== false,
    };

    await Promise.all([
      handleApiKeyUpdate(settings, "redmineApiKey", redmineApiKeyInput),
      handleApiKeyUpdate(settings, "backlogApiKey", backlogApiKeyInput),
      handleApiKeyUpdate(settings, "groqApiKey", groqApiKeyInput),
      handleApiKeyUpdate(settings, "cerebrasApiKey", cerebrasApiKeyInput),
      handleApiKeyUpdate(settings, "openrouterApiKey", openrouterApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackGroqApiKey", fallbackGroqApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackCerebrasApiKey", fallbackCerebrasApiKeyInput),
      handleApiKeyUpdate(settings, "fallbackOpenrouterApiKey", fallbackOpenrouterApiKeyInput),
    ]);

    const selectedFallbackGeminiModels = Array.from(
      document.querySelectorAll("#fallbackGeminiModelsList button.selected")
    ).map((button) => button.dataset.modelId);
    settings.fallbackGeminiModels =
      selectedFallbackGeminiModels.length > 0
        ? await encryptData(selectedFallbackGeminiModels.join("\n"))
        : "";

    const selectedFallbackGeminiKeys = Array.from(
      document.querySelectorAll("#fallbackGeminiKeysList button")
    ).map((button) => button.title);
    if (selectedFallbackGeminiKeys.length > 0) {
      settings.fallbackGeminiApiKeys = await encryptData(selectedFallbackGeminiKeys.join("\n"));
    } else {
      settings.fallbackGeminiApiKeys = "";
    }

    for (const config of PRIMARY_PROVIDER_CONFIGS) {
      const selectedModels = getSelectedProviderModels("primary", config.provider);
      settings[config.modelsStorage] =
        selectedModels.length > 0 ? await encryptData(selectedModels.join("\n")) : "";

      const selectedKeys = getProviderKeys("primary", config.provider, config.keyInput);
      if (selectedKeys.length > 0) {
        settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
        settings[`${config.provider}ApiKey`] = await encryptData(selectedKeys[0]);
      } else if (!config.keyInput?.value.trim() || config.keyInput.value.trim() === "**********") {
        settings[config.keysStorage] = "";
      }
    }

    for (const config of FALLBACK_PROVIDER_CONFIGS) {
      const selectedModels = getSelectedProviderModels("fallback", config.provider);
      settings[config.modelsStorage] =
        selectedModels.length > 0 ? await encryptData(selectedModels.join("\n")) : "";

      const selectedKeys = getProviderKeys("fallback", config.provider, config.keyInput);
      const legacyKeyName = `fallback${capitalize(config.provider)}ApiKey`;
      if (selectedKeys.length > 0) {
        settings[config.keysStorage] = await encryptData(selectedKeys.join("\n"));
        settings[legacyKeyName] = await encryptData(selectedKeys[0]);
      } else if (!config.keyInput?.value.trim() || config.keyInput.value.trim() === "**********") {
        settings[config.keysStorage] = "";
      }
    }

    const selectedGeminiModels = Array.from(
      document.querySelectorAll("#geminiModelsList button.selected")
    ).map((b) => b.dataset.modelId);
    if (selectedGeminiModels.length > 0) {
      settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
    } else {
      settings.geminiModels = "";
    }

    const selectedGeminiKeys = Array.from(document.querySelectorAll("#geminiKeysList button")).map(
      (b) => b.title
    );
    if (selectedGeminiKeys.length > 0) {
      settings.geminiApiKeys = await encryptData(selectedGeminiKeys.join("\n"));
      settings.geminiApiKey = await encryptData(selectedGeminiKeys[0]);
    } else {
      settings.geminiApiKeys = "";
      settings.geminiApiKey = "";
    }

    return settings;
  }

  async function handleApiKeyUpdate(settings, keyName, inputElement) {
    if (!inputElement) return;
    const value = inputElement.value.trim();
    if (value === "") {
      settings[keyName] = "";
    } else if (value !== "**********") {
      settings[keyName] = await encryptData(value);
    }
    // If value is "**********", don't modify settings[keyName] - keep existing value
  }

  function loadOptions() {
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
      "fallbackCerebrasApiKey",
      "fallbackGeminiApiKeys",
      "fallbackGeminiModels",
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

    chrome.storage.local.get(keys, async (items) => {
      document.getElementById("redmineDomain").value = items.redmineDomain || TB.REDMINE_DOMAIN;
      document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
      document.getElementById("manualFields").value =
        items.manualFields || JSON.stringify({ Severity: 46, Role: 11 }, null, 2);
      if (showRedmineSuccessModalInput) {
        showRedmineSuccessModalInput.checked = items.showRedmineSuccessModal !== false;
      }

      redmineApiKeyInput.value = items.redmineApiKey ? "**********" : "";
      backlogApiKeyInput.value = items.backlogApiKey ? "**********" : "";
      groqApiKeyInput.value = items.groqApiKey ? "**********" : "";
      cerebrasApiKeyInput.value = items.cerebrasApiKey ? "**********" : "";
      openrouterApiKeyInput.value = items.openrouterApiKey ? "**********" : "";
      fallbackGroqApiKeyInput.value = items.fallbackGroqApiKey ? "**********" : "";
      fallbackCerebrasApiKeyInput.value = items.fallbackCerebrasApiKey ? "**********" : "";
      fallbackOpenrouterApiKeyInput.value = items.fallbackOpenrouterApiKey ? "**********" : "";

      const primaryProvider = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
      primaryProviderSelect.value = primaryProvider;
      handleProviderChange(primaryProviderSelect, items.primaryModel);

      fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
      updateFallbackOptions();
      renderFallbackGeminiModelsTags(await decryptStoredList(items.fallbackGeminiModels));
      renderFallbackGeminiKeysButtons(await decryptStoredList(items.fallbackGeminiApiKeys));

      for (const config of PRIMARY_PROVIDER_CONFIGS) {
        const models = await decryptStoredList(items[config.modelsStorage]);
        const providerKeys = await decryptStoredList(items[config.keysStorage]);
        renderProviderModelsTags("primary", config.provider, models);
        renderProviderKeysButtons("primary", config.provider, providerKeys);
      }

      for (const config of FALLBACK_PROVIDER_CONFIGS) {
        const models = await decryptStoredList(items[config.modelsStorage]);
        const providerKeys = await decryptStoredList(items[config.keysStorage]);
        renderProviderModelsTags("fallback", config.provider, models);
        renderProviderKeysButtons("fallback", config.provider, providerKeys);
      }

      if (items.redmineApiKey) {
        try {
          const decryptedKey = await decryptData(items.redmineApiKey);
          if (decryptedKey) {
            fetchProjects(decryptedKey, items.defaultProjectId, items.reportProjectId);
          } else {
            console.warn("[OPTIONS] Failed to decrypt redmineApiKey");
          }
        } catch (e) {
          console.error("[OPTIONS] Error decrypting redmineApiKey:", e);
        }
      }

      if (items.geminiModels) {
        try {
          const modelsStr = await decryptData(items.geminiModels);
          renderGeminiModelsTags(modelsStr ? modelsStr.split("\n").filter(Boolean) : []);
        } catch (e) {
          console.error("[OPTIONS] Error decrypting geminiModels:", e);
          renderGeminiModelsTags([]);
        }
      } else {
        renderGeminiModelsTags([]);
      }

      if (items.geminiApiKeys) {
        try {
          const keysStr = await decryptData(items.geminiApiKeys);
          renderGeminiKeysButtons(keysStr ? keysStr.split("\n").filter(Boolean) : []);
        } catch (e) {
          console.error("[OPTIONS] Error decrypting geminiApiKeys:", e);
          renderGeminiKeysButtons([]);
        }
      }
    });
  }

  function initProviderMultiControls() {
    [...PRIMARY_PROVIDER_CONFIGS, ...FALLBACK_PROVIDER_CONFIGS].forEach((config) => {
      const isFallback = config.keysStorage.startsWith("fallback");
      const scope = isFallback ? "fallback" : "primary";
      const { provider, keyInput } = config;
      const configEl = document.getElementById(`${scope}${capitalize(provider)}Config`);
      if (!configEl || configEl.dataset.multiReady === "1") return;

      const modelsBlock = document.createElement("div");
      modelsBlock.style.margin = "0 0 12px";
      modelsBlock.innerHTML = `
        <p style="margin: 0 0 6px; font-size: 11px; color: #166534; font-weight: 500">Models (click chọn/bỏ, dùng round-robin)</p>
        <div id="${scope}${capitalize(provider)}ModelsList" class="provider-models-list" style="display: flex; flex-wrap: wrap; gap: 6px"></div>
        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted)">Đã chọn: <span id="${scope}${capitalize(provider)}SelectedModelCount">0</span></p>
      `;
      configEl.prepend(modelsBlock);

      const keysBlock = document.createElement("div");
      keysBlock.style.margin = "8px 0 0";
      keysBlock.innerHTML = `
        <p style="margin: 0 0 6px; font-size: 11px; color: #166534; font-weight: 500">Keys (nhập + Enter để thêm, click để xóa)</p>
        <div id="${scope}${capitalize(provider)}KeysList" class="provider-keys-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px"></div>
        <p style="margin: 4px 0 0; font-size: 11px; color: var(--muted)">Đã thêm: <span id="${scope}${capitalize(provider)}SelectedKeyCount">0</span>/10</p>
      `;
      configEl.appendChild(keysBlock);

      if (keyInput) {
        keyInput.placeholder = "Nhập key + Enter để thêm";
        keyInput.addEventListener("keydown", (event) =>
          handleProviderKeyInput(event, scope, provider)
        );
      }
      renderProviderModelsTags(scope, provider, []);
      renderProviderKeysButtons(scope, provider, []);
      configEl.dataset.multiReady = "1";
    });
  }

  async function fetchProjects(apiKey, selectedId = "", selectedReportId = "") {
    if (!apiKey) return;
    const now = Date.now();
    if (cachedProjects && now - cacheTimestamp < CACHE_DURATION) {
      renderProjectOptions(cachedProjects, selectedId, selectedReportId);
      return;
    }
    const syncBtn = document.getElementById("syncProjectsBtn");
    const defaultProjectSelect = document.getElementById("defaultProjectId");
    const reportProjectSelect = document.getElementById("reportProjectId");
    try {
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = "⌛ Đang tải...";
      }
      defaultProjectSelect.innerHTML = '<option value="">Đang tải...</option>';
      reportProjectSelect.innerHTML = '<option value="">Đang tải...</option>';
      const redmineDomain =
        document.getElementById("redmineDomain").value.trim() || TB.REDMINE_DOMAIN;
      const redmineBase = redmineDomain.endsWith("/") ? redmineDomain : `${redmineDomain}/`;
      const response = await fetch(new URL("projects.json?limit=100", redmineBase).toString(), {
        headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      cachedProjects = data.projects;
      cacheTimestamp = now;
      renderProjectOptions(data.projects, selectedId, selectedReportId);
    } catch (_e) {
      defaultProjectSelect.innerHTML = '<option value="">Lỗi tải (Kiểm tra Key)</option>';
      reportProjectSelect.innerHTML = '<option value="">Lỗi tải (Kiểm tra Key)</option>';
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = "🔄 Đồng bộ Project";
      }
    }
  }

  function renderProjectOptions(projects, selectedId, selectedReportId) {
    const defaultSelect = document.getElementById("defaultProjectId");
    const reportSelect = document.getElementById("reportProjectId");
    defaultSelect.innerHTML = '<option value="">-- Chọn project --</option>';
    reportSelect.innerHTML = '<option value="">-- Chọn project --</option>';
    projects.forEach((p) => {
      const opt = new Option(p.name, p.id);
      defaultSelect.add(opt);
      reportSelect.add(opt.cloneNode(true));
    });
    if (selectedId) defaultSelect.value = selectedId;
    if (selectedReportId) reportSelect.value = selectedReportId;
  }

  function handleProviderChange(selectElement, selectedModel = null) {
    const isPrimary = selectElement.id === "primaryProvider";
    const provider = selectElement.value;

    if (isPrimary) {
      updateProviderKeyVisibility(provider);
      updateFallbackOptions();
    } else {
      updateFallbackKeyVisibility(provider);
    }
  }

  function updateProviderKeyVisibility(provider) {
    const sections = {
      gemini: document.getElementById("primaryGeminiConfig"),
      groq: document.getElementById("primaryGroqConfig"),
      cerebras: document.getElementById("primaryCerebrasConfig"),
      openrouter: document.getElementById("primaryOpenrouterConfig"),
    };
    Object.entries(sections).forEach(([key, el]) => {
      if (el) el.style.display = provider === key ? "block" : "none";
    });
  }

  function updateFallbackKeyVisibility(provider) {
    const sections = {
      gemini: document.getElementById("fallbackGeminiConfig"),
      groq: document.getElementById("fallbackGroqConfig"),
      cerebras: document.getElementById("fallbackCerebrasConfig"),
      openrouter: document.getElementById("fallbackOpenrouterConfig"),
    };
    Object.entries(sections).forEach(([key, el]) => {
      if (el) el.style.display = provider === key ? "block" : "none";
    });
  }

  function getDefaultModel(provider) {
    const key = `${provider.toUpperCase()}_MODELS`;
    const models = TB[key] || globalThis.TB_MODELS?.[key] || [];
    return models.find((model) => model.default)?.value || models[0]?.value || "";
  }

  function getProviderModels(provider) {
    const key = `${provider.toUpperCase()}_MODELS`;
    return TB[key] || globalThis.TB_MODELS?.[key] || [];
  }

  function updateFallbackOptions() {
    const primary = primaryProviderSelect.value;
    const currentFallback = fallbackProviderSelect.value;
    const options = [
      { value: "none", label: "Không dùng dự phòng" },
      { value: "gemini", label: "Google Gemini AI Studio" },
      { value: "groq", label: "Groq Cloud" },
      { value: "cerebras", label: "Cerebras" },
      { value: "openrouter", label: "OpenRouter" },
    ].filter((opt) => opt.value === "none" || opt.value !== primary);

    fallbackProviderSelect.innerHTML = "";
    options.forEach((opt) => fallbackProviderSelect.add(new Option(opt.label, opt.value)));
    fallbackProviderSelect.value = options.some((opt) => opt.value === currentFallback)
      ? currentFallback
      : "none";
    handleProviderChange(fallbackProviderSelect);
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status status-error" : "status status-success";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 3000);
  }

  function renderGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("geminiModelsList");
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.modelId = model.value;
      btn.dataset.modelLabel = model.label;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      btn.innerHTML = `${model.label} <span class="test-icon" style="margin-left:6px;opacity:0.6;cursor:pointer;">🧪</span>`;
      btn.onclick = (e) => {
        if (e.target.classList.contains("test-icon")) {
          e.stopPropagation();
          handleTestSingleModel(model.value, model.label, btn);
        } else {
          btn.classList.toggle("selected");
          document.getElementById("selectedModelCount").textContent =
            listEl.querySelectorAll(".selected").length;
        }
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedModelCount").textContent =
      listEl.querySelectorAll(".selected").length;
  }

  function renderProviderModelsTags(scope, provider, selectedModels = []) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const listEl = document.getElementById(`${idPrefix}ModelsList`);
    const countEl = document.getElementById(`${idPrefix}SelectedModelCount`);
    if (!listEl || !countEl) return;

    const models = getProviderModels(provider);
    listEl.innerHTML = "";
    models.forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.provider = provider;
      btn.dataset.modelId = model.value;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      btn.innerHTML = `${model.label} <span class="test-icon" style="margin-left:6px;opacity:0.6;cursor:pointer;">🧪</span>`;

      Object.assign(btn.style, {
        background: btn.classList.contains("selected") ? "#10b981" : "#dbeafe",
        color: btn.classList.contains("selected") ? "#fff" : "#1e40af",
        border: `1px solid ${btn.classList.contains("selected") ? "#059669" : "#bfdbfe"}`,
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
      });

      btn.onclick = (e) => {
        if (e.target.classList.contains("test-icon")) {
          e.stopPropagation();
          handleTestProviderModel(scope, provider, model.value, model.label, btn);
        } else {
          btn.classList.toggle("selected");
          const isSelected = btn.classList.contains("selected");
          btn.style.background = isSelected ? "#10b981" : "#dbeafe";
          btn.style.color = isSelected ? "#fff" : "#1e40af";
          btn.style.borderColor = isSelected ? "#059669" : "#bfdbfe";
          countEl.textContent = listEl.querySelectorAll(".selected").length;
        }
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = listEl.querySelectorAll(".selected").length;
  }

  async function handleTestProviderModel(scope, provider, modelId, modelLabel, btn) {
    const keys = getProviderKeys(scope, provider);
    if (keys.length === 0) return setStatus(`Nhập ${capitalize(provider)} key trước`, true);

    const apiKey = keys[0];
    const icon = btn.querySelector(".test-icon");
    const originalIcon = icon.textContent;
    icon.textContent = "⏳";
    icon.style.display = "inline-block";
    icon.style.animation = "spin 1s linear infinite";
    setStatus(`Đang test ${provider}: ${modelLabel}...`);

    try {
      let url = "";
      const headers = { "Content-Type": "application/json" };
      let body = {};

      if (provider === "groq") {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body = {
          model: modelId,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        };
      } else if (provider === "cerebras") {
        url = "https://api.cerebras.ai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body = {
          model: modelId,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        };
      } else if (provider === "openrouter") {
        url = "https://openrouter.ai/api/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body = {
          model: modelId,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        icon.textContent = "✅";
        icon.style.animation = "";
        setStatus(`✅ Model ${modelLabel} (${provider}) hoạt động tốt`);
      } else {
        const errorData = await res.json();
        throw new Error(errorData?.error?.message || `Lỗi ${res.status}`);
      }
    } catch (e) {
      icon.textContent = "❌";
      icon.style.animation = "";
      setStatus(`❌ ${e.message}`, true);
    } finally {
      setTimeout(() => {
        if (icon.textContent !== "🧪") {
          // Giữ icon kết quả một lúc rồi có thể reset hoặc để nguyên
        }
      }, 3000);
    }
  }

  function getSelectedProviderModels(scope, provider) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    return Array.from(document.querySelectorAll(`#${idPrefix}ModelsList button.selected`)).map(
      (button) => button.dataset.modelId
    );
  }

  function getSelectedModelsForProvider(scope, provider) {
    if (provider === TB.PROVIDERS.GEMINI) {
      if (scope === "fallback") {
        return Array.from(
          document.querySelectorAll("#fallbackGeminiModelsList button.selected")
        ).map((button) => button.dataset.modelId);
      }
      return Array.from(document.querySelectorAll("#geminiModelsList button.selected")).map(
        (button) => button.dataset.modelId
      );
    }
    return getSelectedProviderModels(scope, provider);
  }

  function renderProviderKeysButtons(scope, provider, keys = []) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const listEl = document.getElementById(`${idPrefix}KeysList`);
    const countEl = document.getElementById(`${idPrefix}SelectedKeyCount`);
    if (!listEl || !countEl) return;

    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
      Object.assign(btn.style, {
        background: "#dbeafe",
        color: "#1e40af",
        border: "1px solid #bfdbfe",
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: "12px",
      });
      btn.onclick = () => {
        btn.remove();
        countEl.textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = keys.length;
  }

  function getProviderChipStyle(isSelected) {
    return {
      background: isSelected ? "#10b981" : "#dbeafe",
      color: isSelected ? "#fff" : "#1e40af",
      border: `1px solid ${isSelected ? "#059669" : "#bfdbfe"}`,
      borderRadius: "8px",
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "12px",
    };
  }

  function handleProviderKeyInput(event, scope, provider) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const input = event.target;
    const key = input.value.trim();
    if (!key || key === "**********") return;

    const currentKeys = getProviderKeys(scope, provider);
    if (currentKeys.length >= 10 || currentKeys.includes(key)) {
      input.value = "";
      return;
    }
    renderProviderKeysButtons(scope, provider, [...currentKeys, key]);
    input.value = "";
  }

  function getProviderKeys(scope, provider, inputElement = null) {
    const idPrefix = `${scope}${capitalize(provider)}`;
    const keys = Array.from(document.querySelectorAll(`#${idPrefix}KeysList button`)).map(
      (button) => button.title
    );
    const inputValue = inputElement?.value?.trim();
    if (inputValue && inputValue !== "**********" && !keys.includes(inputValue)) {
      keys.push(inputValue);
    }
    return keys;
  }

  async function decryptStoredList(value) {
    if (!value) return [];
    try {
      const listStr = await decryptData(value);
      return listStr ? listStr.split("\n").filter(Boolean) : [];
    } catch (error) {
      console.error("[OPTIONS] Error decrypting list:", error);
      return [];
    }
  }

  function capitalize(value) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
  }

  async function handleTestSingleModel(modelId, modelLabel, btn) {
    const apiKey = getFirstGeminiKey();
    if (!apiKey) return setStatus("Nhập Gemini key trước", true);
    const icon = btn.querySelector(".test-icon");
    icon.textContent = "⏳";
    icon.style.animation = "spin 1s linear infinite";
    setStatus(`Đang test: ${modelLabel}...`);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
          }),
        }
      );
      if (res.ok) {
        icon.textContent = "✅";
        icon.style.animation = "";
        setStatus(`✅ Model ${modelLabel} hoạt động tốt`);
      } else {
        icon.textContent = "❌";
        icon.style.animation = "";
        const errorData = await res.json();
        setStatus(`❌ ${errorData?.error?.message || "Lỗi không xác định"}`, true);
      }
    } catch (e) {
      icon.textContent = "❌";
      icon.style.animation = "";
      setStatus(`❌ Lỗi kiểm tra model: ${e.message}`, true);
    }
  }

  function renderGeminiKeysButtons(keys = []) {
    const listEl = document.getElementById("geminiKeysList");
    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
      btn.onclick = () => {
        btn.remove();
        document.getElementById("selectedKeyCount").textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedKeyCount").textContent = keys.length;
  }

  function renderFallbackGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("fallbackGeminiModelsList");
    const countEl = document.getElementById("fallbackGeminiSelectedModelCount");
    if (!listEl || !countEl) return;
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach((model) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.modelId = model.value;
      btn.className = selectedModels.includes(model.value) ? "selected" : "";
      btn.textContent = model.label;
      Object.assign(btn.style, getProviderChipStyle(btn.classList.contains("selected")));
      btn.onclick = () => {
        btn.classList.toggle("selected");
        Object.assign(btn.style, getProviderChipStyle(btn.classList.contains("selected")));
        countEl.textContent = listEl.querySelectorAll(".selected").length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = selectedModels.length;
  }

  function renderFallbackGeminiKeysButtons(keys = []) {
    const listEl = document.getElementById("fallbackGeminiKeysList");
    const countEl = document.getElementById("fallbackGeminiSelectedKeyCount");
    if (!listEl || !countEl) return;
    listEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = key;
      btn.textContent = `${key.slice(0, 8)}...`;
      Object.assign(btn.style, getProviderChipStyle(false), { fontFamily: "monospace" });
      btn.onclick = () => {
        btn.remove();
        countEl.textContent = listEl.children.length;
      };
      listEl.appendChild(btn);
    });
    countEl.textContent = keys.length;
  }

  function handleFallbackGeminiKeyInput(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const key = event.target.value.trim();
    if (!key) return;
    const currentKeys = Array.from(document.querySelectorAll("#fallbackGeminiKeysList button")).map(
      (button) => button.title
    );
    if (currentKeys.length < 10 && !currentKeys.includes(key)) {
      renderFallbackGeminiKeysButtons([...currentKeys, key]);
    }
    event.target.value = "";
  }

  function handleGeminiKeyInput(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const input = e.target;
    const key = input.value.trim();
    const listEl = document.getElementById("geminiKeysList");
    if (
      key &&
      listEl.children.length < 10 &&
      !Array.from(listEl.children).some((b) => b.title === key)
    ) {
      renderGeminiKeysButtons([...Array.from(listEl.children).map((b) => b.title), key]);
      input.value = "";
    }
  }

  function getFirstGeminiKey() {
    const keys = Array.from(document.querySelectorAll("#geminiKeysList button")).map(
      (b) => b.title
    );
    return keys[0] || "";
  }

  async function handleRedmineKeyBlur() {
    const key = redmineApiKeyInput.value.trim();
    if (key && key !== "**********") {
      const defaultId = document.getElementById("defaultProjectId").value;
      const reportId = document.getElementById("reportProjectId").value;
      setTimeout(() => fetchProjects(key, defaultId, reportId), 500);
    }
  }

  async function handleSyncProjects() {
    const stored = await chrome.storage.local.get("redmineApiKey");
    const key = stored.redmineApiKey ? await decryptData(stored.redmineApiKey) : null;
    if (key) {
      fetchProjects(
        key,
        document.getElementById("defaultProjectId").value,
        document.getElementById("reportProjectId").value
      );
    } else {
      alert("Vui lòng lưu Redmine API Key trước.");
    }
  }
});
