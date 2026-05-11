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
  const primaryProviderSelect = document.getElementById("primaryProvider");
  const fallbackProviderSelect = document.getElementById("fallbackProvider");
  const statusEl = document.getElementById("status");

  if (!form || !primaryProviderSelect || !fallbackProviderSelect || !statusEl) {
    console.error("[OPTIONS] Thiếu các phần tử DOM cần thiết");
    return;
  }

  loadOptions();

  primaryProviderSelect.addEventListener("change", () => handleProviderChange(primaryProviderSelect));
  fallbackProviderSelect.addEventListener("change", () => handleProviderChange(fallbackProviderSelect));
  redmineApiKeyInput.addEventListener("blur", handleRedmineKeyBlur);
  document.getElementById("syncProjectsBtn")?.addEventListener("click", handleSyncProjects);

  document.getElementById("geminiApiKeys")?.addEventListener("keydown", handleGeminiKeyInput);
  document.getElementById("checkUpdateBtn")?.addEventListener("click", () => console.log("TODO: Check for updates"));
  document.getElementById("goToDashboardBtn")?.addEventListener("click", () => chrome.tabs.create({ url: "https://dev-tool-platform.vercel.app/" }));

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
    const settings = {
      backlogDomain: document.getElementById("backlogDomain").value.trim() || TB.BACKLOG_DOMAIN,
      primaryProvider: primaryProviderSelect.value,
      primaryModel: document.getElementById("primaryModel").value,
      fallbackProvider: fallbackProviderSelect.value,
      fallbackModel: document.getElementById("fallbackModel").value,
      defaultProjectId: document.getElementById("defaultProjectId").value,
      reportProjectId: document.getElementById("reportProjectId").value,
      manualFields: document.getElementById("manualFields").value.trim(),
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

    const selectedGeminiModels = Array.from(document.querySelectorAll("#geminiModelsList button.selected")).map(b => b.dataset.modelId);
    if (selectedGeminiModels.length > 0) {
      settings.geminiModels = await encryptData(selectedGeminiModels.join("\n"));
    }

    const selectedGeminiKeys = Array.from(document.querySelectorAll("#geminiKeysList button")).map(b => b.title);
    if (selectedGeminiKeys.length > 0) {
      settings.geminiApiKeys = await encryptData(selectedGeminiKeys.join("\n"));
      settings.geminiApiKey = await encryptData(selectedGeminiKeys[0]);
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
      "redmineApiKey", "backlogDomain", "backlogApiKey",
      "geminiApiKey", "geminiApiKeys", "geminiModels",
      "cerebrasApiKey", "groqApiKey", "openrouterApiKey",
      "primaryProvider", "primaryModel", "fallbackProvider", "fallbackModel",
      "defaultProjectId", "reportProjectId", "manualFields",
    ];

    chrome.storage.local.get(keys, async (items) => {
      document.getElementById("redmineDomain").value = TB.REDMINE_DOMAIN;
      document.getElementById("backlogDomain").value = items.backlogDomain || TB.BACKLOG_DOMAIN;
      document.getElementById("manualFields").value = items.manualFields || JSON.stringify({ "Severity": 46, "Role": 11 }, null, 2);

      redmineApiKeyInput.value = items.redmineApiKey ? "**********" : "";
      backlogApiKeyInput.value = items.backlogApiKey ? "**********" : "";
      groqApiKeyInput.value = items.groqApiKey ? "**********" : "";
      cerebrasApiKeyInput.value = items.cerebrasApiKey ? "**********" : "";
      openrouterApiKeyInput.value = items.openrouterApiKey ? "**********" : "";

      const primaryProvider = items.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
      primaryProviderSelect.value = primaryProvider;
      handleProviderChange(primaryProviderSelect, items.primaryModel || TB.DEFAULT_PRIMARY_MODEL);

      fallbackProviderSelect.value = items.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
      handleProviderChange(fallbackProviderSelect, items.fallbackModel || TB.DEFAULT_FALLBACK_MODEL);
      updateFallbackOptions();

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
    } catch (_e) {
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
    const isPrimary = selectElement.id === "primaryProvider";
    const provider = selectElement.value;
    const modelField = document.getElementById(isPrimary ? "primaryModelField" : "fallbackModelField");
    const modelSelect = document.getElementById(isPrimary ? "primaryModel" : "fallbackModel");

    const showModel = provider !== TB.PROVIDERS.GEMINI && provider !== TB.PROVIDERS.NONE;
    modelField.style.display = showModel ? "block" : "none";
    if (showModel) {
      updateModelDropdown(modelSelect, provider);
      if (selectedModel) modelSelect.value = selectedModel;
    }

    if (isPrimary) {
      updateProviderKeyVisibility(provider);
      updateFallbackOptions();
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

  function updateModelDropdown(selectElement, provider) {
    const key = `${provider.toUpperCase()}_MODELS`;
    const models = TB.MODELS?.[key] || [];
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
      { value: "openrouter", label: "OpenRouter" },
    ].filter(opt => opt.value === "none" || opt.value !== primary);

    fallbackProviderSelect.innerHTML = "";
    options.forEach(opt => fallbackProviderSelect.add(new Option(opt.label, opt.value)));
    fallbackProviderSelect.value = options.some(opt => opt.value === currentFallback) ? currentFallback : "none";
    handleProviderChange(fallbackProviderSelect);
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status status-error" : "status status-success";
    setTimeout(() => { statusEl.textContent = ""; statusEl.className = "status"; }, 3000);
  }

  function renderGeminiModelsTags(selectedModels = []) {
    const listEl = document.getElementById("geminiModelsList");
    listEl.innerHTML = "";
    (TB.GEMINI_MODELS || []).forEach(model => {
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
          document.getElementById("selectedModelCount").textContent = listEl.querySelectorAll(".selected").length;
        }
      };
      listEl.appendChild(btn);
    });
    document.getElementById("selectedModelCount").textContent = selectedModels.length;
  }

  async function handleTestSingleModel(modelId, modelLabel, btn) {
    const apiKey = getFirstGeminiKey();
    if (!apiKey) return setStatus("Nhập Gemini key trước", true);
    const icon = btn.querySelector(".test-icon");
    icon.textContent = "⏳";
    icon.style.animation = "spin 1s linear infinite";
    setStatus(`Đang test: ${modelLabel}...`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ok" }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        }),
      });
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
      renderGeminiKeysButtons([...Array.from(listEl.children).map(b => b.title), key]);
      input.value = "";
    }
  }

  function getFirstGeminiKey() {
    const keys = Array.from(document.querySelectorAll("#geminiKeysList button")).map((b) => b.title);
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
      fetchProjects(key, document.getElementById("defaultProjectId").value, document.getElementById("reportProjectId").value);
    } else {
      alert("Vui lòng lưu Redmine API Key trước.");
    }
  }
});
