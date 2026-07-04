/**
 * Validates messages before privileged background handlers process them.
 */
(function (global) {
  const MAX_PAYLOAD_LENGTH = 1000000;
  const FIELD_LIMITS = Object.freeze({
    apiKey: 10000,
    commentText: 100000,
    commentUrl: 2000,
    domain: 2000,
    endpoint: 500,
    issueKey: 100,
    issueSummary: 1000,
    modelId: 300,
    projectKey: 100,
    provider: 50,
    text: 100000,
    userInfo: 1000,
  });
  const ALLOWED_TYPES = new Set([
    "CREATE_REDMINE_ISSUE",
    "EXTRACT_JAPANESE_CONTENT",
    "FETCH_REDMINE_METADATA",
    "FETCH_REDMINE_PROJECTS_WITH_KEY",
    "GET_BACKLOG_ISSUE_INFO",
    "GET_BACKLOG_USERS",
    "GET_REPORT_SETTINGS",
    "GET_UI_SETTINGS",
    "LOG_ERROR",
    "LOOKUP_AND_TRANSLATE_COMMENT",
    "OPEN_OPTIONS_PAGE",
    "SEND_TO_BACKLOG",
    "SEND_TO_REDMINE",
    "TEST_MODEL_WITH_KEY",
    "TRANSLATE_COMMENT_FULL",
    "TRANSLATE_TEXT_SIMPLE",
  ]);
  const REQUIRED_FIELDS = Object.freeze({
    FETCH_REDMINE_PROJECTS_WITH_KEY: ["domain", "apiKey"],
    TEST_MODEL_WITH_KEY: ["provider", "modelId", "apiKey"],
  });

  function assertMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new TypeError("Invalid extension message.");
    }
    if (typeof message.type !== "string" || !ALLOWED_TYPES.has(message.type)) {
      throw new TypeError("Unsupported extension message type.");
    }

    let serialized;
    try {
      serialized = JSON.stringify(message);
    } catch {
      throw new TypeError("Extension message must be serializable.");
    }
    if (serialized.length > MAX_PAYLOAD_LENGTH) {
      throw new RangeError("Extension message payload is too large.");
    }

    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (message[field] !== undefined && typeof message[field] !== "string") {
        throw new TypeError(`Message field '${field}' must be a string.`);
      }
      if (message[field]?.length > limit) {
        throw new RangeError(`Message field '${field}' is too long.`);
      }
    }

    for (const field of REQUIRED_FIELDS[message.type] || []) {
      if (!message[field]) {
        throw new TypeError(`Message field '${field}' is required.`);
      }
    }
  }

  function assertInternalSender(sender, runtimeId) {
    if (!runtimeId || sender?.id !== runtimeId) {
      throw new Error("Untrusted extension message sender.");
    }
  }

  global.TB_MESSAGE_VALIDATION = Object.freeze({
    assertInternalSender,
    assertMessage,
  });
})(globalThis);
