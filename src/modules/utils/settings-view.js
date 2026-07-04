/**
 * Builds least-privilege settings views for extension content scripts.
 */
(function (global) {
  function pick(settings, fields) {
    return Object.fromEntries(fields.map((field) => [field, settings[field]]));
  }

  const UI_FIELDS = ["showRedmineSuccessModal", "defaultProjectId", "manualFields"];
  const REPORT_FIELDS = ["redmineDomain", "redmineApiKey", "reportProjectId"];

  function hasSameOrigin(firstUrl, secondUrl) {
    try {
      return new URL(firstUrl).origin === new URL(secondUrl).origin;
    } catch {
      return false;
    }
  }

  global.TB_SETTINGS_VIEW = Object.freeze({
    forReport: (settings) => pick(settings, REPORT_FIELDS),
    forUi: (settings) => pick(settings, UI_FIELDS),
    hasSameOrigin,
  });
})(globalThis);
