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
  
  // Credentials elements
  const credentialsSection = document.getElementById("credentialsSection");
  const geminiKeyContainer = document.getElementById("geminiKeyContainer");
  const cerebrasKeyContainer = document.getElementById("cerebrasKeyContainer");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const cerebrasApiKeyInput = document.getElementById("cerebrasApiKey");
  
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
    const needsGemini = settings.primaryProvider === TB.PROVIDERS.GEMINI || settings.fallbackProvider === TB.PROVIDERS.GEMINI;
    const needsCerebras = settings.primaryProvider === TB.PROVIDERS.CEREBRAS || settings.fallbackProvider === TB.PROVIDERS.CEREBRAS;
    
    if (needsGemini) {
        const key = geminiApiKeyInput.value.trim();
        if (!key && !geminiApiKeyInput.placeholder.includes("Đã lưu")) {
            setStatus("❌ Vui lòng nhập Gemini API Key."); return;
        }
        if (key) settings.geminiApiKey = await encryptData(key);
    }
    
    if (needsCerebras) {
        const key = cerebrasApiKeyInput.value.trim();
        if (!key && !cerebrasApiKeyInput.placeholder.includes("Đã lưu")) {
            setStatus("❌ Vui lòng nhập Cerebras API Key."); return;
        }
        if (key) settings.cerebrasApiKey = await encryptData(key);
    }
    
    try {
      await chrome.storage.local.set(settings);
      setStatus("✅ Đã lưu cấu hình thành công!");
      // Briefly clear password inputs for security
      if (settings.geminiApiKey) geminiApiKeyInput.value = "";
      if (settings.cerebrasApiKey) cerebrasApiKeyInput.value = "";
      loadOptions(); // Refresh placeholders
    } catch (error) {
      setStatus(`❌ Lỗi khi lưu: ${error.message}`);
    }
  });
  
  // Functions
  function loadOptions() {
    chrome.storage.local.get(
      ["redmineApiKey", "backlogDomain", "backlogApiKey", "geminiApiKey", "cerebrasApiKey", "primaryProvider", "primaryModel", "fallbackProvider", "fallbackModel"],
      async (items) => {
        redmineDomainInput.value = TB.REDMINE_DOMAIN;
        if (items.redmineApiKey) redmineApiKeyInput.value = await decryptData(items.redmineApiKey);
        
        backlogDomainInput.value = items.backlogDomain || TB.BACKLOG_DOMAIN;
        if (items.backlogApiKey) backlogApiKeyInput.value = await decryptData(items.backlogApiKey);
        
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
        
        if (items.geminiApiKey) geminiApiKeyInput.placeholder = "********** (Đã lưu)";
        if (items.cerebrasApiKey) cerebrasApiKeyInput.placeholder = "********** (Đã lưu)";
        
        updateKeyVisibility();
      }
    );
  }
  
  function updateModelDropdown(selectElement, provider) {
    if (!selectElement) return;
    const models = provider === TB.PROVIDERS.GEMINI ? TB.GEMINI_MODELS : (provider === TB.PROVIDERS.CEREBRAS ? TB.CEREBRAS_MODELS : []);
    
    selectElement.innerHTML = '';
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
    const needsGemini = p === TB.PROVIDERS.GEMINI || f === TB.PROVIDERS.GEMINI;
    const needsCerebras = p === TB.PROVIDERS.CEREBRAS || f === TB.PROVIDERS.CEREBRAS;
    
    credentialsSection.style.display = (needsGemini || needsCerebras) ? "block" : "none";
    geminiKeyContainer.style.display = needsGemini ? "block" : "none";
    cerebrasKeyContainer.style.display = needsCerebras ? "block" : "none";
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
