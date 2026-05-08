/* global TB_LOGGER, setStatus, loadOptions, updateModelDropdown, updateKeyVisibility, fetchProjects, compareVersions, BACKEND_API_URL */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof TB === "undefined") {
    console.error("[OPTIONS] TB is not defined! constants.js may not have loaded.");
    return;
  }

  // Cache for projects data
  let cachedProjects = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Debounce helper
  function debounceFetchProjects() {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fetchProjects(...args), 500);
    };
  }
  const debouncedFetch = debounceFetchProjects();

  // Get DOM elements
  const form = document.getElementById("optionsForm");
  const redmineApiKeyInput = document.getElementById("redmineApiKey");
  const backlogApiKeyInput = document.getElementById("backlogApiKey");
  const groqApiKeyInput = document.getElementById("groqApiKey");
  const cerebrasApiKeyInput = document.getElementById("cerebrasApiKey");
  const gemApiKeyInput = document.getElementById("gemApiKey");

  const primaryProviderSelect = document.getElementById("primaryProvider");
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const statusEl = document.getElementById("status");

  // Placeholder for functions that send messages to background
  const handleRefreshModels = (provider) => console.log(`TODO: Refresh ${provider} models`);
  const handleTestModels = (provider) => console.log(`TODO: Test ${provider} models`);
  const handleExportLogs = () => console.log("TODO: Export logs");
  const handleClearLogs = () => console.log("TODO: Clear logs");
  const checkForUpdates = () => console.log("TODO: Check for updates");

  if (!form || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  // Load existing options
  loadOptions();

  // --- Event Listeners ---
  primaryProviderSelect.addEventListener("change", () => handleProviderChange(primaryProviderSelect));
  fallbackProviderSelect.addEventListener("change", () => handleProviderChange(fallbackProviderSelect));
  redmineApiKeyInput.addEventListener("blur", () => handleRedmineKeyBlur());
  document.getElementById("syncProjectsBtn")?.addEventListener("click", () => handleSyncProjects());
  document.getElementById("refreshGeminiModelsBtn")?.addEventListener("click", () => handleRefreshModels("gemini"));
  document.getElementById("testGeminiModelsBtn")?.addEventListener("click", () => handleTestModels("gemini"));
  document.getElementById("exportLogsBtn")?.addEventListener("click", () => handleExportLogs());
  document.getElementById("clearLogsBtn")?.addEventListener("click", () => handleClearLogs());
  document.getElementById("geminiApiKeys")?.addEventListener("keydown", (e) => handleGeminiKeyInput(e));
  document.getElementById("checkUpdateBtn")?.addEventListener("click", checkForUpdates);
  document.getElementById("goToDashboardBtn")?.addEventListener("click", () => chrome.tabs.create({ url: "https://dev-tool-platform.vercel.app/" }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const settings = await gatherSettings();
      await chrome.storage.local.set(settings);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_SUCCESS);
      setTimeout(loadOptions, 200); // Reload to reflect changes and mask keys
    } catch (error) {
      console.error("[OPTIONS] Save failed:", error);
      setStatus(TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR(error.message));
    }
  });

  // --- Core Functions ---

  async function gatherSettings() {
    const settings = {};
    const fields = {
      backlogDomain: document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      primaryProvider: primaryProviderSelect.value,
      primaryModel: document.getElementById("primaryModel").value,
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: document.getElementById("fallbackModel").value,
      defaultProjectId: document.getElementById("defaultProjectId").value,
      reportProjectId: document.getElementById("reportProjectId").value,
      manualFields: document.getElementById("manualFields").value.trim(),
      gemEndpoint: document.getElementById("gemEndpoint").value.trim(),
    };

    Object.assign(settings, fields);

    // Securely handle API keys
    await Promise.all([
      handleApiKeyUpdate(settings, "redmineApiKey", redmineApiKeyInput),
      handleApiKeyUpdate(settings, "backlogApiKey", backlogApiKeyInput),
      handleApiKeyUpdate(settings, "groqApiKey", groqApiKeyInput),
      handleApiKeyUpdate(settings, "cerebrasApiKey", cerebrasApiKeyInput),
      handleApiKeyUpdate(settings, "gemApiKey", gemApiKeyInput),
    ]);

    // Handle multi-value Gemini fields
    const selectedGeminiModels = Array.from(document.querySelectorAll("#geminiModelsList button.selected")).map(b => b.dataset.modelId);
    if (selectedGeminiModels.length > 0) {
      settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
    }

    const selectedGeminiKeys = Array.from(document.querySelectorAll("#geminiKeysList button")).map(b => b.title);
    if (selectedGeminiKeys.length > 0) {
      settings.geminiApiKeys = await encryptData(selectedGeminiKeys.join("\n"));
      settings.geminiApiKey = await encryptData(selectedGeminiKeys[0]); // For backward compatibility
    }

    return settings;
  }

  async function handleApiKeyUpdate(settings, keyName, inputElement) {
    const value = inputElement.value.trim();
    if (value === "" || value === null) {
      // User wants to clear the key
      settings[keyName] = "";
    } else if (value !== "**********") {
      // User entered a new key
      settings[keyName] = await encryptData(value);
    } else {
      // Placeholder found, do not update the key. It will be excluded from the `settings` object.
      // This prevents overwriting the stored key with the placeholder.
    }
  }

  function loadOptions() {
    const keys = [
      "redmineApiKey", "reportProjectId", "backlogDomain", "backlogApiKey", "geminiApiKey",
      "geminiApiKeys", "geminiModels", "cerebrasApiKey", "groqApiKey", "gemEndpoint", "gemApiKey",
      "primaryProvider", "primaryModel", "fallbackProvider", "fallbackModel", "defaultProjectId", "manualFields"
    ];

    chrome.storage.local.get(keys, async (items) => {
      document.getElementById("redmineDomain").value = TB.REDMINE_DOMAIN;
      document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
      document.getElementById("gemEndpoint").value = items.gemEndpoint || TB.DEFAULT_GEM_ENDPOINT;
      document.getElementById("manualFields").value = items.manualFields || JSON.stringify({ "Severity": 46, "Role": 11 }, null, 2);

      // Set API key fields to placeholder if they exist
      redmineApiKeyInput.value = items.redmineApiKey ? "**********" : "";
      backlogApiKeyInput.value = items.backlogApiKey ? "**********" : "";
      groqApiKeyInput.value = items.groqApiKey ? "**********" : "";
      cerebrasApiKeyInput.value = items.cerebrasApiKey ? "**********" : "";
      gemApiKeyInput.value = items.gemApiKey ? "**********" : "";

      // Load providers and models
      primaryProviderSelect.value = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
      handleProviderChange(primaryProviderSelect, items.primaryModel || TB.DEFAULT_PRIMARY_MODEL);

      fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
      handleProviderChange(fallbackProviderSelect, items.fallbackModel || TB.DEFAULT_FALLBACK_MODEL);
      updateFallbackOptions();

      // Load projects if Redmine key exists
      if (items.redmineApiKey) {
        const decryptedKey = await decryptData(items.redmineApiKey);
        fetchProjects(decryptedKey, items.defaultProjectId, items.reportProjectId);
      }

      // Load and render Gemini multi-value fields
      if (items.geminiModels) {
        const modelsStr = await decryptData(items.geminiModels);
        const selectedModels = modelsStr ? modelsStr.split("\n").filter(Boolean) : [];
        renderGeminiModelsTags(selectedModels);
      }
      if (items.geminiApiKeys) {
        const keysStr = await decryptData(items.geminiApiKeys);
        const selectedKeys = keysStr ? keysStr.split("\n").filter(Boolean) : [];
        renderGeminiKeysButtons(selectedKeys);
      }

      updateConfigSectionsVisibility();
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
      if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = "⌛ Đang tải..."; }
      defaultProjectSelect.innerHTML = "<option value=\"\">Đang tải...</option>";
      reportProjectSelect.innerHTML = "<option value=\"\">Đang tải...</option>";

      const response = await fetch(`${TB.REDMINE_DOMAIN}/projects.json?limit=100`, {
        headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`API ${response.status}`);

      const data = await response.json();
      cachedProjects = data.projects;
      cacheTimestamp = now;
      renderProjectOptions(data.projects, selectedId, selectedReportId);

    } catch (e) {
      defaultProjectSelect.innerHTML = "<option value=\"\">Lỗi tải (Kiểm tra Key)</option>";
      reportProjectSelect.innerHTML = "<option value=\"\">Lỗi tải (Kiểm tra Key)</option>";
    } finally {
      if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = "🔄 Đồng bộ Project"; }
    }
  }

  function renderProjectOptions(projects, selectedId, selectedReportId) {
    const defaultSelect = document.getElementById("defaultProjectId");
    const reportSelect = document.getElementById("reportProjectId");
    defaultSelect.innerHTML = "<option value=\"\">-- Chọn project --</option>";
    reportSelect.innerHTML = "<option value=\"\">-- Chọn project --</option>";

    projects.forEach((p) => {
      const opt = new Option(p.name, p.id);
      defaultSelect.add(opt);
      reportSelect.add(opt.cloneNode(true));
    });

    if (selectedId) defaultSelect.value = selectedId;
    if (selectedReportId) reportSelect.value = selectedReportId;
  }

  function handleProviderChange(selectElement, selectedModel = null) {
    const provider = selectElement.value;
    const modelField = selectElement.id.includes("primary") ? document.getElementById("primaryModelField") : document.getElementById("fallbackModelField");
    const modelSelect = selectElement.id.includes("primary") ? document.getElementById("primaryModel") : document.getElementById("fallbackModel");

    if (provider === TB.PROVIDERS.GEMINI || provider === TB.PROVIDERS.NONE) {
      modelField.style.display = "none";
    } else {
      modelField.style.display = "block";
      updateModelDropdown(modelSelect, provider);
      if (selectedModel) {
        modelSelect.value = selectedModel;
      }
    }

    if (selectElement.id.includes("primary")) {
      updateFallbackOptions();
    }
    updateConfigSectionsVisibility();
  }

  // --- UI Update Functions ---

  function updateModelDropdown(selectElement, provider) {
    const models = TB.MODELS[`${provider.toUpperCase()}_MODELS`] || [];
    selectElement.innerHTML = "";
    models.forEach(model => selectElement.add(new Option(model.label, model.value)));
  }

  function updateFallbackOptions() {
    const primary = primaryProviderSelect.value;
    const currentFallback = fallbackProviderSelect.value;

    const options = [
      { value: "none", label: "Không dùng dự phòng" },
      { value: "gemini", label: "Google Gemini AI Studio" },
      { value: "groq", label: "Groq Cloud" },
      { value: "cerebras", label: "Cerebras" },
      { value: "gem", label: "Custom GEM" },
    ].filter(opt => opt.value === "none" || opt.value !== primary);

    fallbackProviderSelect.innerHTML = "";
    options.forEach(opt => fallbackProviderSelect.add(new Option(opt.label, opt.value)));

    fallbackProviderSelect.value = options.some(opt => opt.value === currentFallback) ? currentFallback : "none";
    handleProviderChange(fallbackProviderSelect);
  }

  function updateConfigSectionsVisibility() {
    const p = primaryProviderSelect.value;
    const f = fallbackProviderSelect.value;
    const activeProviders = new Set([p, f]);

    document.getElementById("geminiConfigSection").style.display = activeProviders.has(TB.PROVIDERS.GEMINI) ? "block" : "none";
    document.getElementById("groqConfigSection").style.display = activeProviders.has(TB.PROVIDERS.GROQ) ? "block" : "none";
    document.getElementById("cerebrasConfigSection").style.display = activeProviders.has(TB.PROVIDERS.CEREBRAS) ? "block" : "none";
    document.getElementById("gemConfigSection").style.display = activeProviders.has(TB.PROVIDERS.GEM) ? "block" : "none";
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status status-error" : "status status-success";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 3000);
  }

  // --- Gemini Multi-value Field Handlers ---

  function renderGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("geminiModelsList");
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach(model => {
      const isSelected = selectedModels.includes(model.value);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.modelId = model.value;
      btn.textContent = model.label;
      btn.className = isSelected ? "selected" : "";
      btn.onclick = () => {
        btn.classList.toggle("selected");
        document.getElementById("selectedModelCount").textContent = listEl.querySelectorAll(".selected").length;
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedModelCount").textContent = selectedModels.length;
  }

  function renderGeminiKeysButtons(keys = []) {
    const listEl = document.getElementById("geminiKeysList");
    listEl.innerHTML = "";
    keys.forEach(key => {
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

  function handleGeminiKeyInput(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const input = e.target;
    const key = input.value.trim();
    const listEl = document.getElementById("geminiKeysList");

    if (key && listEl.children.length < 10 && !Array.from(listEl.children).some(b => b.title === key)) {
      const keys = Array.from(listEl.children).map(b => b.title);
      keys.push(key);
      renderGeminiKeysButtons(keys);
      input.value = "";
    }
  }

  // --- Handlers for Buttons & Inputs ---

  async function handleRedmineKeyBlur() {
    const key = redmineApiKeyInput.value.trim();
    if (key && key !== "**********") {
      debouncedFetch(key, document.getElementById("defaultProjectId").value, document.getElementById("reportProjectId").value);
    }
  }

  async function handleSyncProjects() {
    const key = await decryptData((await chrome.storage.local.get("redmineApiKey")).redmineApiKey);
    if (key) {
      fetchProjects(key, document.getElementById("defaultProjectId").value, document.getElementById("reportProjectId").value);
    } else {
      alert("Vui lòng lưu Redmine API Key trước.");
    }
  }

});
