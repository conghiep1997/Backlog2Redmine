/** Serializes activity mutations in the background service worker. */
(function (global) {
  let pending = Promise.resolve();

  function enqueue(operation) {
    const result = pending.then(operation);
    // A failed storage operation must not prevent subsequent writes.
    pending = result.catch(() => {});
    return result;
  }

  function redact(value) {
    return String(value || "")
      .replace(/([?&](?:apiKey|key|token)=)[^&\s]+/gi, "$1[REDACTED]")
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  }

  function record(entry) {
    const activity = {
      timestamp: new Date().toISOString(),
      operation: entry.operation,
      issue: entry.issue,
      count: entry.count,
      ok: entry.ok,
      partial: entry.partial === true,
      detail: redact(entry.detail).slice(0, 300),
      url: redact(entry.url),
    };
    return enqueue(async () => {
      const { syncActivity } = await chrome.storage.local.get("syncActivity");
      const previous = Array.isArray(syncActivity) ? syncActivity : [];
      await chrome.storage.local.set({ syncActivity: [activity, ...previous].slice(0, 50) });
    });
  }

  function clear() {
    return enqueue(() => chrome.storage.local.remove("syncActivity"));
  }

  global.TB_SYNC_ACTIVITY = Object.freeze({ record, clear });
})(globalThis);
