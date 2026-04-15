// Wait for DOM and constants.js to be ready
document.addEventListener("DOMContentLoaded", () => {
  // Create TB alias for constants
  const TB = globalThis.TB_CONSTANTS;
  
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
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const geminiModelSelect = document.getElementById("geminiModel");
  const fetchModelsBtn = document.getElementById("fetchModelsBtn");
  const statusEl = document.getElementById("status");
  
  if (!form || !redmineDomainInput || !redmineApiKeyInput || !geminiApiKeyInput || !geminiModelSelect || !statusEl) {
    console.error("[OPTIONS] Missing DOM elements");
    return;
  }
  
  // Populate model dropdown with defaults
  populateModelDropdown();
  
  // Add fetch models button listener
  if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener("click", fetchAndPopulateModels);
  }
  
  // Load existing options
  loadOptions();
  
  // Form submit handler
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    // Redmine domain is hardcoded, use constant
    const redmineDomain = TB.REDMINE_DOMAIN;
    
    const redmineApiKey = redmineApiKeyInput.value.trim();
    if (!redmineApiKey) {
      setStatus("❌ Redmine API Key không được để trống.");
      return;
    }
    
    const geminiApiKey = geminiApiKeyInput.value.trim();
    if (!geminiApiKey) {
      setStatus("❌ Gemini API Key không được để trống.");
      return;
    }
    
    const geminiModel = geminiModelSelect.value;
    
    console.log("Saving settings...", {
      redmineDomain,
      redmineApiKey: redmineApiKey ? "***" : "empty",
      geminiApiKey: geminiApiKey ? "***" : "empty",
      geminiModel,
    });
    
    const payload = {
      redmineApiKey,
      geminiApiKey,
      geminiModel,
    };
    
    try {
      // Mã hóa API keys trước khi lưu
      const encryptedPayload = {
        redmineApiKey: await encryptData(payload.redmineApiKey),
        geminiApiKey: await encryptData(payload.geminiApiKey),
        geminiModel: payload.geminiModel,
      };
      
      console.log("Encrypted payload:", {
        redmineApiKey: encryptedPayload.redmineApiKey ? "encrypted" : "empty",
        geminiApiKey: encryptedPayload.geminiApiKey ? "encrypted" : "empty",
        geminiModel: encryptedPayload.geminiModel,
      });
      
      await chrome.storage.local.set(encryptedPayload);
      
      // Verify save
      const verify = await chrome.storage.local.get(["geminiModel"]);
      console.log("Verified save:", verify);
      
      setStatus("✅ Đã lưu cấu hình thành công!");
    } catch (error) {
      console.error("Save error:", error);
      setStatus(`❌ Lỗi khi lưu: ${error.message}`);
    }
  });
  
  // Functions
  function loadOptions() {
    console.log("Loading options...");
    
    chrome.storage.local.get(
      ["redmineApiKey", "geminiApiKey", "geminiModel"],
      async (items) => {
        console.log("Loaded items:", items);
        
        // Redmine domain is hardcoded, no need to load from storage
        redmineDomainInput.value = TB.REDMINE_DOMAIN;
        
        // Only decrypt and populate if keys exist
        if (items.redmineApiKey) {
          const decryptedRedmine = await decryptData(items.redmineApiKey);
          if (decryptedRedmine) {
            redmineApiKeyInput.value = decryptedRedmine;
            console.log("Redmine API Key loaded: ***");
          }
        }
        
        if (items.geminiApiKey) {
          const decryptedGemini = await decryptData(items.geminiApiKey);
          if (decryptedGemini) {
            geminiApiKeyInput.value = decryptedGemini;
            console.log("Gemini API Key loaded: ***");
          }
        }
        
        // Load model (use default if not set)
        const savedModel = items.geminiModel ?? TB.GEMINI_MODEL;
        geminiModelSelect.value = savedModel;
        console.log("Model loaded:", savedModel);
        
        console.log("Form populated successfully");
      }
    );
  }
  
  function populateModelDropdown(models = null) {
    if (!geminiModelSelect) {
      console.warn("[OPTIONS] geminiModelSelect not found, skipping populate");
      return;
    }
    
    console.log("[OPTIONS] Populating model dropdown...");
    console.log("[OPTIONS] models param:", models);
    console.log("[OPTIONS] TB.GEMINI_MODELS:", TB.GEMINI_MODELS);
    
    geminiModelSelect.innerHTML = '';
    
    const modelsToUse = models || TB.GEMINI_MODELS;
    
    if (!modelsToUse || modelsToUse.length === 0) {
      console.warn("[OPTIONS] No models available, using default");
      const option = document.createElement("option");
      option.value = TB.GEMINI_MODEL;
      option.textContent = "Default: " + TB.GEMINI_MODEL;
      option.selected = true;
      geminiModelSelect.appendChild(option);
      console.log("[OPTIONS] Populated with default model:", TB.GEMINI_MODEL);
      return;
    }
    
    modelsToUse.forEach((model) => {
      console.log("[OPTIONS] Adding model:", model.value, model.label);
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      if (model.default) {
        option.selected = true;
      }
      geminiModelSelect.appendChild(option);
    });
    
    console.log("[OPTIONS] Populated dropdown with", modelsToUse.length, "models");
    console.log("[OPTIONS] Select innerHTML:", geminiModelSelect.innerHTML);
  }
  
  async function fetchAndPopulateModels() {
    const apiKey = geminiApiKeyInput.value.trim();
    
    if (!apiKey) {
      setStatus("⚠️ Vui lòng nhập Gemini API Key trước!");
      return;
    }
    
    setStatus("🔄 Đang fetch models từ Google AI...");
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const allModels = data.models || [];
      
      // Filter for generateContent support
      const supportedModels = allModels.filter(model => {
        const methods = model.supportedGenerationMethods || [];
        return methods.includes('generateContent');
      });
      
      // Filter for free tier (RPD >= 50, RPM >= 10)
      const freeTierModels = supportedModels.filter(model => {
        const limits = model.outputTokenLimits || model.inputTokenLimits || {};
        // Check if model has reasonable limits (not too restrictive)
        const rpd = limits.requestsPerDay || 100; // Default if not specified
        const rpm = limits.requestsPerMinute || 60; // Default if not specified
        
        return rpd >= TB.FREE_TIER_LIMITS.minRpd && 
               rpm >= TB.FREE_TIER_LIMITS.minRpm;
      });
      
      // Format models for dropdown
      const formattedModels = freeTierModels.map(model => {
        const modelName = model.name.replace('models/', '');
        const displayName = formatModelName(modelName);
        const isGemma4 = modelName.includes('gemma-4');
        const isDefault = modelName === 'gemma-4-31b-it';
        
        return {
          value: modelName,
          label: `${displayName}${isGemma4 ? ' ⭐' : ''}`,
          default: isDefault,
          rpd: model.outputTokenLimits?.requestsPerDay || 'N/A',
          rpm: model.outputTokenLimits?.requestsPerMinute || 'N/A',
        };
      });
      
      // Sort: Gemma 4 first, then others
      formattedModels.sort((a, b) => {
        if (a.value.includes('gemma-4') && !b.value.includes('gemma-4')) return -1;
        if (!a.value.includes('gemma-4') && b.value.includes('gemma-4')) return 1;
        return a.label.localeCompare(b.label);
      });
      
      if (formattedModels.length === 0) {
        setStatus("⚠️ Không tìm thấy models phù hợp free tier");
        return;
      }
      
      populateModelDropdown(formattedModels);
      setStatus(`✅ Đã fetch ${formattedModels.length} models (free tier)`);
      
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setStatus(`❌ Lỗi: ${error.message}`);
    }
  }
  
  function formatModelName(name) {
    // "models/gemma-4-31b-it" → "Gemma 4 31B IT"
    return name
      .replace('models/', '')
      .split('-')
      .map((word, index) => {
        // Keep numbers as-is, capitalize first letter of words
        if (/^\d+$/.test(word)) return word;
        if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
        return word.toUpperCase();
      })
      .join(' ');
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
