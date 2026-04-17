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
  const geminiFallbackModelSelect = document.getElementById("geminiFallbackModel");
  const statusEl = document.getElementById("status");
  
  if (!form || !redmineDomainInput || !redmineApiKeyInput || !geminiApiKeyInput || !geminiModelSelect || !geminiFallbackModelSelect || !statusEl) {
    console.error("[OPTIONS] Missing DOM elements");
    return;
  }
  
  // Populate model dropdowns with defaults from constants.js
  populateModelDropdown(geminiModelSelect);
  populateModelDropdown(geminiFallbackModelSelect, true); // true = include "no fallback" option
  
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
    const geminiFallbackModel = geminiFallbackModelSelect.value;
    
    console.log("Saving settings...", {
      redmineDomain,
      redmineApiKey: redmineApiKey ? "***" : "empty",
      geminiApiKey: geminiApiKey ? "***" : "empty",
      geminiModel,
      geminiFallbackModel,
    });
    
    const payload = {
      redmineApiKey,
      geminiApiKey,
      geminiModel,
      geminiFallbackModel,
    };
    
    try {
      // Mã hóa API keys trước khi lưu
      const encryptedPayload = {
        redmineApiKey: await encryptData(payload.redmineApiKey),
        geminiApiKey: await encryptData(payload.geminiApiKey),
        geminiModel: payload.geminiModel,
        geminiFallbackModel: payload.geminiFallbackModel,
      };
      
      console.log("Encrypted payload:", {
        redmineApiKey: encryptedPayload.redmineApiKey ? "encrypted" : "empty",
        geminiApiKey: encryptedPayload.geminiApiKey ? "encrypted" : "empty",
        geminiModel: encryptedPayload.geminiModel,
        geminiFallbackModel: encryptedPayload.geminiFallbackModel,
      });
      
      await chrome.storage.local.set(encryptedPayload);
      
      // Verify save
      const verify = await chrome.storage.local.get(["geminiModel", "geminiFallbackModel"]);
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
      ["redmineApiKey", "geminiApiKey", "geminiModel", "geminiFallbackModel"],
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
        
        // Load primary model (use default if not set)
        const savedModel = items.geminiModel ?? TB.GEMINI_MODEL;
        geminiModelSelect.value = savedModel;
        console.log("Primary Model loaded:", savedModel);
        
        // Load fallback model (use default if not set)
        const savedFallbackModel = items.geminiFallbackModel ?? TB.GEMINI_FALLBACK_MODEL;
        geminiFallbackModelSelect.value = savedFallbackModel;
        console.log("Fallback Model loaded:", savedFallbackModel);
        
        console.log("Form populated successfully");
      }
    );
  }
  
  function populateModelDropdown(selectElement, includeNoFallback = false) {
    if (!selectElement) {
      console.warn("[OPTIONS] Model select element not found, skipping populate");
      return;
    }
    
    console.log("[OPTIONS] Populating model dropdown...", selectElement.id);
    console.log("[OPTIONS] TB.GEMINI_MODELS:", TB.GEMINI_MODELS);
    
    selectElement.innerHTML = '';
    
    // Add "No Fallback" option for fallback dropdown
    if (includeNoFallback) {
      const noFallbackOption = document.createElement("option");
      noFallbackOption.value = "";
      noFallbackOption.textContent = TB.MESSAGES.FALLBACK.NO_FALLBACK;
      selectElement.appendChild(noFallbackOption);
    }
    
    const modelsToUse = TB.GEMINI_MODELS;
    
    if (!modelsToUse || modelsToUse.length === 0) {
      console.warn("[OPTIONS] No models available, using default");
      const option = document.createElement("option");
      option.value = TB.GEMINI_MODEL;
      option.textContent = "Default: " + TB.GEMINI_MODEL;
      option.selected = true;
      selectElement.appendChild(option);
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
      selectElement.appendChild(option);
    });
    
    console.log("[OPTIONS] Populated dropdown with", modelsToUse.length, "models");
    console.log("[OPTIONS] Select innerHTML:", selectElement.innerHTML);
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
