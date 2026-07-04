/**
 * Shared version-checking helpers for the service worker and options page.
 */
(function (global) {
  const VERSION_PATTERN = /^\d+(?:\.\d+)*$/;

  function isValid(version) {
    return typeof version === "string" && VERSION_PATTERN.test(version);
  }

  function compare(firstVersion, secondVersion) {
    if (!isValid(firstVersion) || !isValid(secondVersion)) {
      throw new TypeError("Versions must contain numeric dot-separated segments.");
    }

    const firstParts = firstVersion.split(".").map(Number);
    const secondParts = secondVersion.split(".").map(Number);
    const length = Math.max(firstParts.length, secondParts.length);

    for (let index = 0; index < length; index++) {
      const first = firstParts[index] || 0;
      const second = secondParts[index] || 0;
      if (first > second) return 1;
      if (first < second) return -1;
    }

    return 0;
  }

  global.TB_VERSION = Object.freeze({
    API_URL: "https://dev-tool-platform-api.onrender.com/api",
    compare,
    isValid,
  });
})(globalThis);
