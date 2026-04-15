globalThis.TB_CONSTANTS = Object.freeze({
  DEBUG_PREFIX: "[TB-Redmine]",
  LOG_LEVEL: "debug", // Change to "error" for production to disable debug logs
  GEMINI_MODEL: "gemma-3-27b-it",
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
    },
    MODAL: {
      TITLE: "Gửi bình luận sang Redmine",
      SUBTITLE: "Chỉnh sửa nội dung trước khi gửi nếu cần thiết.",
      ISSUE_ID_LABEL: "Redmine Issue ID",
      PREVIEW_LABEL: "Xem trước nội dung",
      HINT: "Mẹo: Có thể gõ thêm @tên_người_dùng trước khi bấm gửi, Redmine sẽ tự nhận diện nếu tên đúng.",
      CONFIRM: "Xác nhận & Gửi",
      CANCEL: "Hủy bỏ",
      CLOSE_ARIA: "Đóng",
      SENDING: "Đang gửi...",
      EMPTY_ISSUE_ID: "Vui lòng nhập Redmine Issue ID.",
      EMPTY_NOTES: "Nội dung gửi không được để trống.",
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
    },
  },
});