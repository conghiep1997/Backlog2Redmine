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
  
  // Provider elements
  const aiProviderSelect = document.getElementById("aiProvider");
  const geminiSection = document.getElementById("geminiSection");
  const cerebrasSection = document.getElementById("cerebrasSection");
  
  // Gemini elements
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const geminiModelSelect = document.getElementById("geminiModel");
  const geminiFallbackModelSelect = document.getElementById("geminiFallbackModel");
  
  // Cerebras elements
  const cerebrasApiKeyInput = document.getElementById("cerebrasApiKey");
  const cerebrasModelSelect = document.getElementById("cerebrasModel");
  
  const statusEl = document.getElementById("status");
  
  if (!form || !redmineDomainInput || !redmineApiKeyInput || !aiProviderSelect || !geminiSection || !cerebrasSection || !statusEl) {
    console.error("[OPTIONS] Missing DOM elements");
    return;
  }
  
  // Populate model dropdowns
  populateModelDropdown(geminiModelSelect, TB.GEMINI_MODELS);
  populateModelDropdown(geminiFallbackModelSelect, TB.GEMINI_MODELS, true); 
  populateModelDropdown(cerebrasModelSelect, TB.CEREBRAS_MODELS);
  
  // Load existing options
  loadOptions();
  
  // Provider change handler
  aiProviderSelect.addEventListener("change", () => {
    const provider = aiProviderSelect.value;
    if (provider === TB.PROVIDERS.CEREBRAS) {
      geminiSection.style.display = "none";
      cerebrasSection.style.display = "block";
    } else {
      geminiSection.style.display = "block";
      cerebrasSection.style.display = "none";
    }
  });
  
  // Form submit handler
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const redmineApiKey = redmineApiKeyInput.value.trim();
    if (!redmineApiKey) {
      setStatus("❌ Redmine API Key không được để trống.");
      return;
    }
    
    const aiProvider = aiProviderSelect.value;
    const settings = {
      redmineApiKey: await encryptData(redmineApiKey),
      backlogDomain: backlogDomainInput.value.trim() || TB.BACKLOG_DOMAIN,
      backlogApiKey: await encryptData(backlogApiKeyInput.value.trim()),
      aiProvider,
      geminiModel: geminiModelSelect.value,
      geminiFallbackModel: geminiFallbackModelSelect.value,
      cerebrasModel: cerebrasModelSelect.value,
    };
    
    // Validate and encrypt specific provider keys
    if (aiProvider === TB.PROVIDERS.GEMINI) {
      const geminiApiKey = geminiApiKeyInput.value.trim();
      if (!geminiApiKey) {
        setStatus("❌ Gemini API Key không được để trống.");
        return;
      }
      settings.geminiApiKey = await encryptData(geminiApiKey);
    } else if (aiProvider === TB.PROVIDERS.CEREBRAS) {
      const cerebrasApiKey = cerebrasApiKeyInput.value.trim();
      if (!cerebrasApiKey) {
        setStatus("❌ Cerebras API Key không được để trống.");
        return;
      }
      settings.cerebrasApiKey = await encryptData(cerebrasApiKey);
    }
    
    try {
      await chrome.storage.local.set(settings);
      setStatus("✅ Đã lưu cấu hình thành công!");
    } catch (error) {
      console.error("Save error:", error);
      setStatus(`❌ Lỗi khi lưu: ${error.message}`);
    }
  });
  
  // Functions
  function loadOptions() {
    chrome.storage.local.get(
      ["redmineApiKey", "backlogDomain", "backlogApiKey", "geminiApiKey", "cerebrasApiKey", "aiProvider", "geminiModel", "geminiFallbackModel", "cerebrasModel"],
      async (items) => {
        redmineDomainInput.value = TB.REDMINE_DOMAIN;
        
        if (items.redmineApiKey) {
          redmineApiKeyInput.value = await decryptData(items.redmineApiKey);
        }

        backlogDomainInput.value = items.backlogDomain || TB.BACKLOG_DOMAIN;
        if (items.backlogApiKey) {
          backlogApiKeyInput.value = await decryptData(items.backlogApiKey);
        }
        
        // Load provider preference
        const provider = items.aiProvider || TB.DEFAULT_PROVIDER;
        aiProviderSelect.value = provider;
        aiProviderSelect.dispatchEvent(new Event("change"));
        
        if (items.geminiApiKey) {
          geminiApiKeyInput.value = await decryptData(items.geminiApiKey);
        }
        
        if (items.cerebrasApiKey) {
          cerebrasApiKeyInput.value = await decryptData(items.cerebrasApiKey);
        }
        
        geminiModelSelect.value = items.geminiModel || TB.GEMINI_MODEL;
        geminiFallbackModelSelect.value = items.geminiFallbackModel ?? TB.GEMINI_FALLBACK_MODEL;
        cerebrasModelSelect.value = items.cerebrasModel || TB.CEREBRAS_MODEL;
      }
    );
  }
  
  function populateModelDropdown(selectElement, models, includeNoFallback = false) {
    if (!selectElement || !models) return;
    selectElement.innerHTML = '';
    
    if (includeNoFallback) {
      const noFallbackOption = document.createElement("option");
      noFallbackOption.value = "";
      noFallbackOption.textContent = TB.MESSAGES.FALLBACK.NO_FALLBACK;
      selectElement.appendChild(noFallbackOption);
    }
    
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      if (model.default) option.selected = true;
      selectElement.appendChild(option);
    });
  }
  
  function setStatus(message) {
    statusEl.textContent = message;
    window.setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = "";
      }
    }, 2500);
  }
  
  async function encryptData(data) {
    if (!data) return "";
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }
  
  async function decryptData(encryptedData) {
    if (!encryptedData) return "";
    try {
      const combined = new Uint8Array(atob(encryptedData).split("").map(c => c.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      const key = await deriveKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
      );
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error("Failed to decrypt data:", error);
      return "";
    }
  }
  
  async function deriveKey() {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("fixed-salt-for-internal-use-2026"),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("additional-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
});
