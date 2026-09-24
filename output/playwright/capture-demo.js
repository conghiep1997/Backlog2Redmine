const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const dist = path.join(root, "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(dist, "manifest.json"), "utf8"));

const demoPage = (type) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>B2R demo</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#24334b;font:15px Arial,sans-serif}
  header{height:64px;background:#fff;border-bottom:1px solid #dce4ed;display:flex;align-items:center;padding:0 46px;gap:28px}
  .brand{font-weight:750;font-size:21px;color:#2674b8}.nav{color:#617289}
  main{max-width:1120px;margin:34px auto;background:#fff;border:1px solid #e1e8f0;border-radius:12px;padding:34px 42px;box-shadow:0 8px 28px #293a5210}
  .badge{display:inline-block;padding:5px 10px;border-radius:20px;background:#e7f5ee;color:#23805a;font-weight:600;font-size:12px}
  h1{font-size:27px;margin:16px 0 12px}h2{font-size:17px;margin:0 0 20px}.muted{color:#708197}
  .description{margin:30px 0;padding:22px;background:#f9fbfd;border:1px solid #edf0f4;border-radius:9px;line-height:1.7}
  .comment-item,.journal{border-top:1px solid #e7edf3;padding:24px 0}.author{font-weight:700;color:#2c608d}
  .comment-item__actions,.journal .contextual{margin-top:13px}.demo-label{position:fixed;right:24px;bottom:20px;color:#718096;background:#ffffffdf;padding:7px 12px;border-radius:6px;font-size:12px;z-index:1}
</style></head><body>
<header><div class="brand">${type === "backlog" ? "Backlog" : "Redmine"}</div><span class="nav">Projects</span><span class="nav">Issues</span><span class="nav">Activity</span></header>
<main>
  <span class="badge">Demo workspace</span>
  <h1>${type === "backlog" ? '<span data-testid="issueKey">DEMO-42</span> <span data-testid="issueSummary">Improve the sign-in flow</span>' : 'DEMO-42 — Improve the sign-in flow'}</h1>
  <p class="muted">${type === "backlog" ? "Product / Issues / DEMO-42" : "Demo Project / Issues / #142"}</p>
  <div class="title-group__edit-actions"></div>
  <section class="description"><h2>Description</h2>Make error messages clearer and keep the entered email when a sign-in attempt fails.</section>
  <h2>Comments</h2>
  ${type === "backlog" ? `<article class="comment-item"><div class="author">Alex Morgan · Today, 09:30</div><div class="comment-item__content"><p>Please translate this update and send it to the Redmine issue.</p></div><div class="comment-item__actions"></div></article>` : `<article class="journal"><div class="author">Alex Morgan · Today, 09:30</div><div class="wiki">The sign-in form now keeps the entered email and displays a clear validation message.</div><div class="contextual"><a class="icon-comment" href="#">Quote</a></div></article>`}
</main><span class="demo-label">Illustrative demo data</span></body></html>`;

async function main() {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/view/DEMO-42" || pathname === "/issues/142") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(demoPage(pathname.startsWith("/view/") ? "backlog" : "redmine"));
      return;
    }
    const file = path.resolve(dist, "." + pathname);
    if (path.relative(dist, file).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) return response.writeHead(404).end();
      const ext = path.extname(file);
      const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";
      response.writeHead(200, { "Content-Type": mime });
      response.end(bytes);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  async function pageFor(pathname, seed, viewport) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.addInitScript(({ initial, version }) => {
      const state = { ...initial };
      const listeners = new Set();
      const get = (keys) => {
        if (keys == null) return { ...state };
        if (typeof keys === "string") return { [keys]: state[keys] };
        if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, state[key]]));
        return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]));
      };
      window.chrome = {
        storage: {
          local: {
            get(keys, callback) { const result = get(keys); if (callback) queueMicrotask(() => callback(result)); return Promise.resolve(result); },
            set(items, callback) { const changes = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { oldValue: state[key], newValue }])); Object.assign(state, items); listeners.forEach((listener) => listener(changes, "local")); if (callback) queueMicrotask(callback); return Promise.resolve(); },
            remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; if (callback) queueMicrotask(callback); return Promise.resolve(); },
          },
          onChanged: { addListener(listener) { listeners.add(listener); } },
        },
        runtime: {
          id: "demo-extension", lastError: null,
          onMessage: { addListener() {} },
          getManifest() { return { version }; },
          getURL(resource) { return `${location.origin}/${resource}`; },
          openOptionsPage() {},
          sendMessage(message, callback) {
            let data = {};
            if (message.type === "GET_UI_SETTINGS") data = { defaultProjectId: "1", showRedmineSuccessModal: true };
            if (message.type === "FETCH_REDMINE_PROJECTS_WITH_KEY") data = [{ id: 1, name: "Demo Project" }];
            if (message.type === "FETCH_REDMINE_METADATA") {
              if (message.endpoint.includes("projects.json")) data = { projects: [{ id: 1, name: "Demo Project" }] };
              else if (message.endpoint.includes("trackers.json")) data = { trackers: [{ id: 2, name: "Task" }] };
              else if (message.endpoint.includes("issue_priorities.json")) data = { issue_priorities: [{ id: 2, name: "Normal", is_default: true }] };
              else data = { versions: [] };
            }
            if (message.type === "GET_BACKLOG_ISSUE_INFO") data = { summary: "Improve the sign-in flow" };
            const result = { ok: true, data };
            if (callback) queueMicrotask(() => callback(result));
            return Promise.resolve(result);
          },
        },
        i18n: { getMessage() { return ""; } },
        tabs: { create() {}, query: async () => [] },
        permissions: { request: async () => true, remove: async () => true },
        scripting: { registerContentScripts: async () => {}, unregisterContentScripts: async () => {}, executeScript: async () => [] },
      };
    }, { initial: seed, version: manifest.version });
    await page.goto(`${base}/${pathname}`);
    return page;
  }

  async function inject(page, registration) {
    for (const script of registration.js) await page.addScriptTag({ url: `${base}/${script}` });
  }

  try {
    const popup = await pageFor("src/popup.html", {
      languagePreference: "en", themePreference: "light", redmineApiKey: "demo-only", backlogApiKey: "demo-only",
      primaryProvider: "gemini", defaultProjectId: "1", defaultProjectName: "Demo Project",
      backlogDomain: "https://demo.backlog.com",
    }, { width: 360, height: 520 });
    await popup.locator("#statusBadge").getByText("Ready").waitFor();
    await popup.screenshot({ path: path.join(__dirname, "01-popup-en.png") });
    await popup.close();

    const options = await pageFor("src/options.html", { languagePreference: "en", themePreference: "light" }, { width: 1280, height: 800 });
    await options.locator("#onboardingCard").waitFor();
    await options.locator("#redmineDomain").evaluate((input) => {
      input.value = "https://redmine.example.invalid";
    });
    await options.screenshot({ path: path.join(__dirname, "02-options-onboarding-en.png") });
    await options.evaluate(() => chrome.storage.local.set({ syncActivity: [
      { timestamp: new Date().toISOString(), operation: "translate", issue: "DEMO-42", count: 2, ok: true, url: "https://redmine.example.invalid/issues/142" },
      { timestamp: new Date(Date.now() - 3600000).toISOString(), operation: "translate", issue: "DEMO-41", count: 1, partial: true, ok: false, detail: "1 comment could not be posted.", url: "https://redmine.example.invalid/issues/141" },
    ] }));
    await options.locator("#syncActivityList li").first().waitFor();
    await options.evaluate(() => window.scrollTo(0, document.getElementById("syncHistoryTitle").getBoundingClientRect().top + window.scrollY - 210));
    await options.screenshot({ path: path.join(__dirname, "03-options-activity-en.png") });
    await options.close();

    const backlog = await pageFor("view/DEMO-42", { languagePreference: "en" }, { width: 1280, height: 800 });
    await inject(backlog, manifest.content_scripts[0]);
    await backlog.locator("button.tb-redmine-btn").first().waitFor();
    await backlog.waitForFunction(() => globalThis.TB_GET_MESSAGE("options_preview_notice").startsWith("Review"));
    await backlog.screenshot({ path: path.join(__dirname, "04-backlog-controls-en.png") });
    await backlog.evaluate(() => openConfirmModal({
      redmineIssueId: "142", issueTitle: "Improve the sign-in flow",
      previewText: "Alex Morgan\n\nThe sign-in form now keeps the entered email and displays a clear validation message.",
      remainingComments: [], onCancel() {}, onConfirm() {},
    }));
    await backlog.locator("#tb-redmine-overlay").waitFor();
    await backlog.waitForTimeout(500);
    await backlog.screenshot({ path: path.join(__dirname, "05-backlog-preview-en.png") });
    await backlog.locator("#tb-dry-run").click();
    await backlog.locator("#tb-dry-run-result").waitFor();
    await backlog.screenshot({ path: path.join(__dirname, "07-backlog-dry-run-en.png") });
    await backlog.close();

    const redmine = await pageFor("issues/142", { languagePreference: "en" }, { width: 1280, height: 800 });
    await inject(redmine, manifest.content_scripts[1]);
    await redmine.waitForFunction(() => globalThis.TB_GET_MESSAGE("options_preview_notice").startsWith("Review"));
    await redmine.evaluate(() => openBacklogModal({
      backlogIssueKey: "DEMO-42", previewText: "The sign-in form now keeps the entered email and displays a clear validation message.",
      onCancel() {}, onConfirm() {},
    }));
    await redmine.locator("#tb-redmine-overlay").waitFor();
    await redmine.waitForTimeout(500);
    await redmine.screenshot({ path: path.join(__dirname, "06-redmine-preview-en.png") });
    await redmine.close();
    console.log("Captured 7 English demo screenshots in output/playwright/");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
