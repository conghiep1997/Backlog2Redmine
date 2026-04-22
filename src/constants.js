/**
 * Main Constants Entry Point for Backlog2Redmine Extension.
 * Aggregates modular constants and provides i18n support.
 */
(function (global) {
  // Vietnamese messages fallback (used when chrome.i18n fails)
  const viMessages = {
    button_title: "Dịch bình luận và gửi sang Redmine",
    button_text: "Redmine",
    migrate_button_text: "Migrate Issue",
    processing: "Đang xử lý...",
    toast_no_comment_content: "Không tìm thấy nội dung bình luận.",
    toast_missing_issue_key: "Không đọc được Mã Issue (Key) từ Backlog.",
    modal_title: "Gửi bình luận sang Redmine",
    modal_subtitle: "Chỉnh sửa nội dung trước khi gửi nếu cần thiết.",
    modal_issue_id_label: "Mã Issue Redmine",
    modal_issue_title_label: "Tiêu đề Issue Redmine",
    modal_preview_label: "Xem trước nội dung",
    modal_hint: "Tip: Bạn có thể gõ @username trước khi gửi, Redmine sẽ tự nhận diện nếu tên đúng.",
    modal_confirm: "Xác nhận & Gửi",
    modal_cancel: "Hủy bỏ",
    modal_success_title: "✅ Hoàn thành!",
    modal_success_subtitle: "Bình luận đã được gửi thành công sang Redmine.",
    modal_success_view_button: "Xem trên Redmine",
    modal_success_close_button: "Đóng",
    modal_empty_issue_id: "Vui lòng nhập Mã Issue Redmine.",
    modal_loading_title: "Đang tải tiêu đề...",
    modal_error_numeric_id: "⚠️ ID phải là chữ số!",
    modal_error_not_found: "⚠️ Không tìm thấy Issue hoặc lỗi kết nối!",
    modal_batch_title_multiple: "✅ Đã gửi thành công $count$ bình luận!",
    modal_batch_subtitle_multiple: "Tất cả bình luận đã được dịch và gửi sang Redmine.",
    modal_batch_subtitle_preparing: "Sẽ thực hiện dịch và gửi $count$ bình luận liên tiếp.",
    modal_batch_text: "Dịch toàn bộ bình luận đến cuối cùng ($count$ bình luận)",
    modal_batch_confirm: "Dịch & Gửi $count$ bình luận",
    modal_waiting_translation: "[Đang chờ xác nhận để dịch thêm...]",
    modal_migrate_title: "Tạo Issue mới trên Redmine",
    modal_migrate_subtitle: "Sẽ tạo 1 ticket và đính kèm $count$ bình luận.",
    modal_migrate_confirm: "Tạo & Di chuyển toàn bộ",
    modal_migrate_comments_text: "Dịch và di chuyển tất cả $count$ bình luận",
  };

  const getMsg = (key, substitution) => {
    try {
      // Priority 1: Use hardcoded Vietnamese (Temporary hide multi-language)
      let viMsg = viMessages[key];
      if (viMsg) {
        if (substitution) {
          viMsg = viMsg.replace(/\$count\$/g, substitution);
        }
        return viMsg;
      }

      // Fallback: Try chrome.i18n
      const msg = chrome.i18n?.getMessage(key, substitution);
      if (msg && msg !== key) {
        return msg;
      }

      return key;
    } catch (e) {
      console.error("[TB] i18n error:", e);
      return viMessages[key] || key;
    }
  };

  global.TB_CONSTANTS = Object.freeze({
    DEBUG_PREFIX: "[TB-Redmine]",
    LOG_LEVEL: "debug",

    // Use values from modular constants if loaded, otherwise defaults
    GEMINI_MODEL: global.TB_MODELS?.GEMINI || "gemini-3.1-flash-lite-preview",
    GEMINI_FALLBACK_MODEL: global.TB_MODELS?.GEMINI_FALLBACK || "gemini-flash-lite-latest",
    CEREBRAS_MODEL: global.TB_MODELS?.CEREBRAS || "gpt-oss-120b",
    DEFAULT_PROVIDER: "gemini",

    PROVIDERS: {
      GEMINI: "gemini",
      CEREBRAS: "cerebras",
      NONE: "none",
    },

    DEFAULT_PRIMARY_PROVIDER: "gemini",
    DEFAULT_PRIMARY_MODEL: "gemini-3.1-flash-lite-preview",
    DEFAULT_FALLBACK_PROVIDER: "cerebras",
    DEFAULT_FALLBACK_MODEL: "gpt-oss-120b",

    BACKLOG_DOMAIN: "https://shift7.backlog.com",
    REDMINE_DOMAIN: "https://redmine.splus-software.com",

    GEMINI_MODELS: global.TB_MODELS?.GEMINI_MODELS || [],
    CEREBRAS_MODELS: global.TB_MODELS?.CEREBRAS_MODELS || [],

    ICONS: global.TB_ICONS || {},

    MESSAGES: {
      BUTTON_TITLE: getMsg("button_title"),
      BUTTON_ARIA: getMsg("button_title"),
      BUTTON_TEXT: getMsg("button_text"),
      BUTTON_TITLE_BACKLOG: getMsg("button_title_backlog"),
      MIGRATE_BUTTON_TEXT: getMsg("migrate_button_text"),
      PROCESSING: getMsg("processing"),
      TOAST: {
        NO_COMMENT_CONTENT: getMsg("toast_no_comment_content"),
        EMPTY_COMMENT: getMsg("toast_empty_comment"),
        MISSING_ISSUE_KEY: getMsg("toast_missing_issue_key"),
        SEND_SUCCESS: getMsg("toast_send_success"),
        SEND_BACKLOG_SUCCESS: getMsg("toast_send_backlog_success"),
        RATE_LIMIT_RETRY: getMsg("toast_rate_limit_retry"),
        RATE_LIMIT_FAILED: getMsg("toast_rate_limit_failed"),
        CROSS_PROVIDER_RETRY: (provider) => getMsg("toast_cross_provider_retry", provider),
      },
      MODAL: {
        TITLE: getMsg("modal_title"),
        SUBTITLE: getMsg("modal_subtitle"),
        ISSUE_ID_LABEL: getMsg("modal_issue_id_label"),
        ISSUE_TITLE_LABEL: getMsg("modal_issue_title_label"),
        PREVIEW_LABEL: getMsg("modal_preview_label"),
        HINT: getMsg("modal_hint"),
        CONFIRM: getMsg("modal_confirm"),
        CANCEL: getMsg("modal_cancel"),
        CLOSE_ARIA: getMsg("modal_close_aria"),
        SENDING: getMsg("modal_sending"),
        EMPTY_ISSUE_ID: getMsg("modal_empty_issue_id"),
        EMPTY_NOTES: getMsg("modal_empty_notes"),
        SUCCESS_TITLE: getMsg("modal_success_title"),
        SUCCESS_SUBTITLE: getMsg("modal_success_subtitle"),
        SUCCESS_VIEW_BUTTON: getMsg("modal_success_view_button"),
        SUCCESS_CLOSE_BUTTON: getMsg("modal_success_close_button"),
        NOTIFY_USERS_LABEL: getMsg("modal_notify_users_label"),
        BACKLOG_ISSUE_KEY_LABEL: getMsg("modal_backlog_issue_key_label"),
        MIGRATE_TITLE: getMsg("modal_migrate_title"),
        MIGRATE_SUBTITLE: (count) => getMsg("modal_migrate_subtitle", count.toString()),
        MIGRATE_CONFIRM: getMsg("modal_migrate_confirm"),
        MIGRATE_COMMENTS_TEXT: (count) => getMsg("modal_migrate_comments_text", count.toString()),
        PROJECT_LABEL: getMsg("modal_project_label"),
        TRACKER_LABEL: getMsg("modal_tracker_label"),
        PRIORITY_LABEL: getMsg("modal_priority_label"),
        SUBJECT_LABEL: getMsg("modal_subject_label"),
        LOADING_METADATA: getMsg("modal_loading_metadata"),
        WAITING_TRANSLATION: getMsg("modal_waiting_translation"),
        LOADING_TITLE: getMsg("modal_loading_title"),
        ERROR_NUMERIC_ID: getMsg("modal_error_numeric_id"),
        ERROR_NOT_FOUND: getMsg("modal_error_not_found"),
        ERROR_SELECT_PROJECT: getMsg("modal_error_select_project"),
        BACKLOG_TITLE: getMsg("modal_backlog_title"),
        BACKLOG_SUBTITLE: getMsg("modal_backlog_subtitle"),
        BACKLOG_PLACEHOLDER: getMsg("modal_backlog_placeholder"),
        BACKLOG_EMPTY_KEY: getMsg("modal_backlog_empty_key"),
        BATCH_TITLE_MULTIPLE: (count) => getMsg("modal_batch_title_multiple", count.toString()),
        BATCH_SUBTITLE_MULTIPLE: getMsg("modal_batch_subtitle_multiple"),
        BATCH_SUBTITLE_PREPARING: (count) =>
          getMsg("modal_batch_subtitle_preparing", count.toString()),
        ERROR_METADATA: getMsg("modal_error_metadata"),
        BATCH_TEXT: (count) => getMsg("modal_batch_text", count.toString()),
        BATCH_CONFIRM: (count) => getMsg("modal_batch_confirm", count.toString()),
      },
      SETTINGS: {
        REDMINE_DOMAIN_REQUIRED: getMsg("settings_redmine_domain_required"),
        REDMINE_API_KEY_REQUIRED: getMsg("settings_redmine_api_key_required"),
        BACKLOG_API_KEY_REQUIRED: getMsg("settings_backlog_api_key_required"),
        GEMINI_API_KEY_REQUIRED: getMsg("settings_gemini_api_key_required"),
        OPTIONS_GEMINI_KEY_REQUIRED: getMsg("options_gemini_key_required"),
        OPTIONS_CEREBRAS_KEY_REQUIRED: getMsg("options_cerebras_key_required"),
        OPTIONS_SAVE_SUCCESS: getMsg("options_save_success"),
        OPTIONS_SAVE_ERROR: (err) => getMsg("options_save_error", err),
        OPTIONS_SAVED_PLACEHOLDER: getMsg("options_saved_placeholder"),
      },
      REDMINE: {
        LOOKUP_FAILED: getMsg("redmine_lookup_failed"),
        SEARCH_EMPTY_HTML: getMsg("redmine_search_empty_html"),
        SEARCH_NO_MATCH: getMsg("redmine_search_no_match"),
        SEARCH_PAGE_ERROR: getMsg("redmine_search_page_error"),
        API_REQUEST_FAILED: getMsg("redmine_api_request_failed"),
      },
      GEMINI: {
        EMPTY_TRANSLATION: getMsg("gemini_empty_translation"),
        RATE_LIMIT_ERROR: getMsg("gemini_rate_limit_error"),
      },
      FALLBACK: {
        NO_FALLBACK: getMsg("fallback_no_fallback"),
      },
      BACKLOG: {
        LOOKUP_FAILED: getMsg("backlog_lookup_failed"),
        POST_FAILED: getMsg("backlog_post_failed"),
      },
    },
    PROMPTS: global.TB_PROMPTS || {},
  });

  global.TB = global.TB_CONSTANTS;
})(globalThis);
