const form = document.getElementById("optionsForm");
const redmineDomainInput = document.getElementById("redmineDomain");
const redmineApiKeyInput = document.getElementById("redmineApiKey");
const geminiApiKeyInput = document.getElementById("geminiApiKey");
const statusEl = document.getElementById("status");

loadOptions();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const redmineDomain = redmineDomainInput.value.trim();
  if (!isValidUrl(redmineDomain)) {
    setStatus("Redmine Domain phải là URL hợp lệ (vd: https://example.com).");
    return;
  }

  const payload = {
    redmineDomain,
    redmineApiKey: redmineApiKeyInput.value.trim(),
    geminiApiKey: geminiApiKeyInput.value.trim(),
  };

  // Mã hóa API keys trước khi lưu
  const encryptedPayload = {
    redmineDomain,
    redmineApiKey: await encryptData(payload.redmineApiKey),
    geminiApiKey: await encryptData(payload.geminiApiKey),
  };

  await chrome.storage.local.set(encryptedPayload);
  setStatus("Đã lưu cấu hình.");
});

function loadOptions() {
  chrome.storage.local.get(
    ["redmineDomain", "redmineApiKey", "geminiApiKey"],
    async (items) => {
      redmineDomainInput.value = items.redmineDomain ?? "";
      redmineApiKeyInput.value = await decryptData(items.redmineApiKey ?? "");
      geminiApiKeyInput.value = await decryptData(items.geminiApiKey ?? "");
    }
  );
}

function setStatus(message) {
  statusEl.textContent = message;
  window.setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 2500);
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
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
