const DONATION_METHODS = [
  {
    id: "bank",
    label: "Ngân hàng",
    title: "Chuyển khoản ngân hàng",
    description: "QR tài khoản ngân hàng sẽ được cập nhật tại đây.",
    qrImage: "../assets/donate/tpbank.png",
  },
  {
    id: "momo",
    label: "MoMo",
    title: "Ủng hộ qua MoMo",
    description: "QR MoMo sẽ được cập nhật tại đây.",
    qrImage: "../assets/donate/momo.png",
  },
  {
    id: "paypal",
    label: "PayPal",
    title: "Ủng hộ qua PayPal",
    description: "Bạn có thể ủng hộ tác giả qua PayPal.",
    url: "",
  },
];

const PROVIDER_LABELS = {
  gemini: "Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
  openrouter: "OpenRouter",
};

document.addEventListener("DOMContentLoaded", async () => {
  const manifest = chrome.runtime.getManifest();
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
  const provider = PROVIDER_LABELS[items.primaryProvider] || items.primaryProvider || "Chưa chọn";
  const forwardReady = redmineReady && backlogReady;
  setState("forwardStatus", forwardReady, forwardReady ? "Đang hoạt động" : "Chưa sẵn sàng");
  setState("reverseStatus", false, "Chưa sẵn sàng");
  setState("providerStatus", Boolean(items.primaryProvider), provider);
  const configured = forwardReady && Boolean(items.primaryProvider);
  document.getElementById("statusBadge").textContent = configured ? "SẴN SÀNG" : "CẦN CẤU HÌNH";
  document.getElementById("statusBadge").classList.toggle("ready", configured);
  document.getElementById("statusBadge").classList.toggle("error", !redmineReady && !backlogReady);
  document.getElementById("overallStatus").textContent = configured
    ? "Mọi thành phần chính đã được cấu hình."
    : "Hoàn tất cấu hình để sử dụng đầy đủ tính năng.";
  document.getElementById("defaultProjectValue").textContent =
    items.defaultProjectName || items.defaultProjectId || "Chưa chọn";
  document.getElementById("defaultProjectValue").previousElementSibling.textContent =
    "Project Redmine";
  if (!items.defaultProjectName && items.defaultProjectId) {
    document.getElementById("defaultProjectValue").textContent = "Đang tải tên project...";
  }
  if (items.defaultProjectId && !items.defaultProjectName) loadDefaultProjectName();
  document.getElementById("projectSummary").textContent = items.defaultProjectName
    ? "Project dùng cho thao tác trên Redmine"
    : "Chọn project trong full settings để bắt đầu";
}

async function loadDefaultProjectName() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DEFAULT_PROJECT_SUMMARY" });
    if (response?.ok && response.data?.name) {
      document.getElementById("defaultProjectValue").textContent = response.data.name;
      await chrome.storage.local.set({ defaultProjectName: response.data.name });
    } else if (!response?.ok) {
      document.getElementById("defaultProjectValue").textContent = "Không tải được tên project";
    }
  } catch (_error) {
    document.getElementById("defaultProjectValue").textContent = "Không tải được tên project";
  }
}

function formatDomain(value) {
  if (!value) return "Chưa thiết lập";
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
    tab.textContent = method.label;
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
    .forEach((tab) => tab.classList.toggle("active", tab.textContent === method.label));
  const content = document.getElementById("donateContent");
  content.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = method.title;
  content.appendChild(title);
  const description = document.createElement("p");
  description.textContent = method.description;
  content.appendChild(description);
  if (method.qrImage) {
    const image = document.createElement("img");
    image.className = "qr-image";
    image.src = method.qrImage;
    image.alt = `${method.label} QR`;
    content.appendChild(image);
  } else if (method.url) {
    const link = document.createElement("a");
    link.className = "donate-link";
    link.href = method.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Mở PayPal";
    content.appendChild(link);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "qr-placeholder";
    placeholder.textContent = "QR sắp cập nhật";
    content.appendChild(placeholder);
  }
}
