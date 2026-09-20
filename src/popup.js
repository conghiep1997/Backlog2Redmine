const DONATION_METHODS = [
  {
    id: "bank",
    labelKey: "popup_donate_bank",
    titleKey: "popup_donate_bank_title",
    descriptionKey: "popup_donate_bank_description",
    qrImage: "../assets/donate/tpbank.png",
  },
  {
    id: "momo",
    labelKey: "popup_donate_momo",
    titleKey: "popup_donate_momo_title",
    descriptionKey: "popup_donate_momo_description",
    qrImage: "../assets/donate/momo.png",
  },
  {
    id: "paypal",
    labelKey: "popup_donate_paypal",
    titleKey: "popup_donate_paypal_title",
    descriptionKey: "popup_donate_paypal_description",
    url: "",
  },
];

const PROVIDER_LABELS = {
  gemini: "Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
};

let messages = null;
let storedSettings = {};
const t = (key, substitutions) =>
  messages?.[key]?.message || chrome.i18n.getMessage(key, substitutions) || key;

async function loadMessages() {
  const { languagePreference } = storedSettings;
  const language = languagePreference || "vi";
  try {
    const response = await fetch(`../_locales/${language}/messages.json`);
    if (response.ok) messages = await response.json();
  } catch (_error) {
    // Fall back to Chrome's built-in locale lookup.
  }
}

async function applyTheme() {
  const { themePreference } = storedSettings;
  const theme = themePreference || "system";
  const resolved =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

function localizePopup() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = storedSettings.languagePreference || "vi";
}

document.addEventListener("DOMContentLoaded", async () => {
  const manifest = chrome.runtime.getManifest();
  storedSettings = await chrome.storage.local.get(["languagePreference", "themePreference"]);
  await loadMessages();
  await applyTheme();
  localizePopup();
  document.getElementById("version").textContent = `v${manifest.version}`;
  await renderStatus();
  setupActions();
  setupDonate();
});

async function renderStatus() {
  const items = await chrome.storage.local.get([
    "redmineApiKey",
    "backlogApiKey",
    "primaryProvider",
    "backlogDomain",
    "defaultProjectId",
    "defaultProjectName",
  ]);
  const redmineReady = Boolean(items.redmineApiKey);
  const backlogReady = Boolean(items.backlogApiKey);
  const provider =
    PROVIDER_LABELS[items.primaryProvider] || items.primaryProvider || t("popup_not_selected");
  const forwardReady = redmineReady && backlogReady;
  setState("forwardStatus", forwardReady, forwardReady ? t("popup_active") : t("popup_not_ready"));
  setState("reverseStatus", false, t("popup_not_ready"));
  setState("providerStatus", Boolean(items.primaryProvider), provider);
  const configured = forwardReady && Boolean(items.primaryProvider);
  document.getElementById("statusBadge").textContent = configured
    ? t("popup_ready")
    : t("popup_needs_setup");
  document.getElementById("statusBadge").classList.toggle("ready", configured);
  document.getElementById("statusBadge").classList.toggle("error", !redmineReady && !backlogReady);
  document.getElementById("overallStatus").textContent = configured
    ? t("popup_configured")
    : t("popup_setup_required");
  document.getElementById("defaultProjectValue").textContent =
    items.defaultProjectName || items.defaultProjectId || t("popup_not_selected");
  if (!items.defaultProjectName && items.defaultProjectId) {
    document.getElementById("defaultProjectValue").textContent = t("popup_loading_project");
  }
  if (items.defaultProjectId && !items.defaultProjectName) loadDefaultProjectName();
  document.getElementById("projectSummary").textContent = items.defaultProjectName
    ? t("popup_project_summary")
    : t("popup_project_summary_empty");
}

async function loadDefaultProjectName() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_PROJECT_SUMMARY" });
    if (response?.ok && response.data?.name) {
      document.getElementById("defaultProjectValue").textContent = response.data.name;
      await chrome.storage.local.set({ defaultProjectName: response.data.name });
    } else if (!response?.ok) {
      document.getElementById("defaultProjectValue").textContent = t("popup_project_load_failed");
    }
  } catch (_error) {
    document.getElementById("defaultProjectValue").textContent = t("popup_project_load_failed");
  }
}

function formatDomain(value) {
  if (!value) return t("popup_not_configured");
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function setState(id, ready, text) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.toggle("ok", ready);
  element.classList.toggle("missing", !ready);
}

function setupActions() {
  document
    .getElementById("openSettings")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
  document
    .getElementById("openRedmine")
    .addEventListener("click", () => openTab("https://redmine.splus-software.com"));
  document.getElementById("openBacklog").addEventListener("click", async () => {
    const { backlogDomain } = await chrome.storage.local.get("backlogDomain");
    openTab(backlogDomain || "https://backlog.com");
  });
}

function openTab(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    chrome.tabs.create({ url: parsed.href });
  } catch {
    // Ignore malformed or unsupported URLs from stored settings.
  }
}

function setupDonate() {
  const modal = document.getElementById("donateModal");
  const tabs = document.getElementById("donateTabs");
  DONATION_METHODS.forEach((method, index) => {
    const tab = document.createElement("button");
    tab.className = "donate-tab";
    tab.type = "button";
    tab.textContent = t(method.labelKey);
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => selectDonation(method.id));
    tabs.appendChild(tab);
    if (index === 0) tab.classList.add("active");
  });
  document.getElementById("donateButton").addEventListener("click", () => {
    modal.hidden = false;
    selectDonation(DONATION_METHODS[0].id);
  });
  document.getElementById("closeDonate").addEventListener("click", () => {
    modal.hidden = true;
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.hidden = true;
  });
}

function selectDonation(id) {
  const method = DONATION_METHODS.find((item) => item.id === id);
  if (!method) return;
  document
    .querySelectorAll(".donate-tab")
    .forEach((tab) => tab.classList.toggle("active", tab.textContent === t(method.labelKey)));
  const content = document.getElementById("donateContent");
  content.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = t(method.titleKey);
  content.appendChild(title);
  const description = document.createElement("p");
  description.textContent = t(method.descriptionKey);
  content.appendChild(description);
  if (method.qrImage) {
    const image = document.createElement("img");
    image.className = "qr-image";
    image.src = method.qrImage;
    image.alt = `${t(method.labelKey)} QR`;
    content.appendChild(image);
  } else if (method.url) {
    const link = document.createElement("a");
    link.className = "donate-link";
    link.href = method.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = t("popup_open_paypal");
    content.appendChild(link);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "qr-placeholder";
    placeholder.textContent = t("popup_qr_pending");
    content.appendChild(placeholder);
  }
}
