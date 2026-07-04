/**
 * Normalizes Redmine origins and converts them to Chrome match patterns.
 */
(function (global) {
  const CUSTOM_SCRIPT_ID = "b2r-redmine-custom";

  function normalize(domain) {
    const url = new URL(String(domain || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new TypeError("Redmine domain must use HTTP or HTTPS.");
    }
    return url.origin;
  }

  function toMatchPattern(domain) {
    const url = new URL(normalize(domain));
    return `${url.protocol}//${url.hostname}/*`;
  }

  function isDefault(domain, defaultDomain) {
    return toMatchPattern(domain) === toMatchPattern(defaultDomain);
  }

  global.TB_REDMINE_DOMAIN = Object.freeze({
    CUSTOM_SCRIPT_ID,
    isDefault,
    normalize,
    toMatchPattern,
  });
})(globalThis);
