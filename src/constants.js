globalThis.TB_CONSTANTS = Object.freeze({
  DEBUG_PREFIX: "[TB-Redmine]",
  LOG_LEVEL: "debug", // Change to "error" for production to disable debug logs
  GEMINI_MODEL: "gemini-3.1-flash-lite-preview", // Primary model: Gemini 3.1 Flash Lite
  GEMINI_FALLBACK_MODEL: "gemma-3-27b-it", // Fallback when primary hits rate limit
  
  // Domains (Hardcoded - no need to configure)
  BACKLOG_DOMAIN: "https://shift7.backlog.com",
  REDMINE_DOMAIN: "https://redmine.splus-software.com",
  
  GEMINI_MODELS: [
    // 🥇 MAIN - Scale + ổn định nhất
    { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite ⭐", default: true },

    // 🥈 MAIN (fallback chất lượng tốt)
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash ⭐" },

    // 🥉 Backup cloud
    { value: "gemini-3-flash", label: "Gemini 3 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },

    // 💻 LOCAL (không phụ thuộc quota)
    { value: "gemma-4-31b-it", label: "Gemma 4 31B IT" },
    { value: "gemma-4-26b-a4b-it", label: "Gemma 4 26B A4B IT" },

    // 🧠 Local nhẹ hơn
    { value: "gemma-3-27b-it", label: "Gemma 3 27B IT ⭐" },
    { value: "gemma-3-12b-it", label: "Gemma 3 12B IT" }
  ],
  
  // Note: Models with "-it" suffix are Instruction Tuned (best for chat/translation)
  // Fetch latest list from: https://ai.google.dev/gemini-api/docs/models
  
  // SVG Icons (from Icons8 - https://icons8.com/icon/translate)
  ICONS: {
    REDMINE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px"><path d="M 4 2 C 2.894531 2 2 2.894531 2 4 L 2 13 C 2 14.105469 2.894531 15 4 15 L 5 15 L 5 17 L 7 19 L 9 19 L 9 20 C 9 21.105469 9.894531 22 11 22 L 20 22 C 21.105469 22 22 21.105469 22 20 L 22 11 C 22 9.894531 21.105469 9 20 9 L 15 9 L 15 4 C 15 2.894531 14.105469 2 13 2 Z M 4 4 L 13 4 L 13 9 L 11 9 C 10.339844 9 9.769531 9.320313 9.40625 9.8125 C 9.246094 9.703125 9.109375 9.574219 8.96875 9.46875 C 9.601563 8.804688 10.234375 8 10.75 7 L 12 7 L 12 6 L 9 6 L 9 5 L 8 5 L 8 6 L 5 6 L 5 7 L 6.125 7 C 6.003906 7.136719 5.96875 7.328125 6.03125 7.5 C 6.03125 7.5 6.199219 8.007813 6.71875 8.6875 C 6.90625 8.933594 7.167969 9.207031 7.46875 9.5 C 6.324219 10.472656 5.34375 10.90625 5.34375 10.90625 C 5.085938 11.011719 4.957031 11.304688 5.0625 11.5625 C 5.167969 11.820313 5.460938 11.949219 5.71875 11.84375 C 5.71875 11.84375 6.914063 11.355469 8.25 10.1875 C 8.484375 10.367188 8.75 10.535156 9.03125 10.71875 C 9.019531 10.8125 9 10.902344 9 11 L 9 13 L 4 13 Z M 6.875 7 L 9.5625 7 C 9.136719 7.722656 8.671875 8.34375 8.1875 8.84375 C 7.902344 8.574219 7.667969 8.3125 7.5 8.09375 C 7.0625 7.523438 7 7.21875 7 7.21875 C 6.976563 7.136719 6.933594 7.0625 6.875 7 Z M 14.84375 12 L 16.15625 12 L 19 20 L 17.84375 20 L 17.09375 17.8125 L 13.84375 17.8125 L 13.125 20 L 12 20 Z M 15.4375 12.90625 C 15.3125 13.382813 14.15625 17 14.15625 17 L 16.8125 17 C 16.8125 17 15.59375 13.371094 15.46875 12.90625 Z M 7 15 L 9 15 L 9 17 L 7 17 Z"/></svg>`,
  },
  
  MESSAGES: {
    BUTTON_TITLE: "Dịch bình luận và gửi sang Redmine",
    BUTTON_ARIA: "Dịch bình luận và gửi sang Redmine",
    BUTTON_TEXT: "Redmine",
    PROCESSING: "Đang xử lý...",
    TOAST: {
      NO_COMMENT_CONTENT: "Không tìm thấy nội dung bình luận.",
      EMPTY_COMMENT: "Nội dung bình luận đang trống.",
      MISSING_ISSUE_KEY: "Không đọc được issueKey từ tiêu đề Backlog.",
      SEND_SUCCESS: "Đã gửi bình luận lên Redmine thành công.",
      RATE_LIMIT_RETRY: "⚠️ Model chính chạm rate limit, đang retry với model phụ...",
      RATE_LIMIT_FAILED: "❌ Cả 2 models đều chạm rate limit. Vui lòng đợi hoặc kiểm tra API key.",
    },
    MODAL: {
      TITLE: "Gửi bình luận sang Redmine",
      SUBTITLE: "Chỉnh sửa nội dung trước khi gửi nếu cần thiết.",
      ISSUE_ID_LABEL: "Redmine Issue ID",
      ISSUE_TITLE_LABEL: "Redmine Issue Title",
      PREVIEW_LABEL: "Xem trước nội dung",
      HINT: "Mẹo: Có thể gõ thêm @tên_người_dùng trước khi bấm gửi, Redmine sẽ tự nhận diện nếu tên đúng.",
      CONFIRM: "Xác nhận & Gửi",
      CANCEL: "Hủy bỏ",
      CLOSE_ARIA: "Đóng",
      SENDING: "Đang gửi...",
      EMPTY_ISSUE_ID: "Vui lòng nhập Redmine Issue ID.",
      EMPTY_NOTES: "Nội dung gửi không được để trống.",
      SUCCESS_TITLE: "✅ Hoàn thành!",
      SUCCESS_SUBTITLE: "Bình luận đã được gửi thành công sang Redmine.",
      SUCCESS_VIEW_BUTTON: "Xem trên Redmine",
      SUCCESS_CLOSE_BUTTON: "Đóng",
    },
    SETTINGS: {
      REDMINE_DOMAIN_REQUIRED: "Thiếu tên miền Redmine trong trang Tùy chọn (Options).",
      REDMINE_API_KEY_REQUIRED: "Thiếu Redmine API Key trong trang Tùy chọn (Options).",
      GEMINI_API_KEY_REQUIRED: "Thiếu Gemini API Key trong trang Tùy chọn (Options).",
    },
    REDMINE: {
      LOOKUP_FAILED: "Không tìm thấy Issue tương ứng trên Redmine.",
      SEARCH_EMPTY_HTML: "Trang tìm kiếm Redmine trả về dữ liệu rỗng.",
      SEARCH_NO_MATCH: "Không tìm thấy kết quả khớp trong HTML, đang chuyển sang dùng API issues.json...",
      SEARCH_PAGE_ERROR: "Trang tìm kiếm Redmine xảy ra lỗi.",
      API_REQUEST_FAILED: "Yêu cầu đến API Redmine thất bại.",
    },
    GEMINI: {
      EMPTY_TRANSLATION: "Gemini không trả về nội dung dịch.",
      RATE_LIMIT_ERROR: "Model chạm rate limit (429 Too Many Requests)",
    },
    FALLBACK: {
      MODEL_LABEL: "Fallback Model (khi chính chạm rate limit)",
      NO_FALLBACK: "Không dùng fallback",
    },
  },
});