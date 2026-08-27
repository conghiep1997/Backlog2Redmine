/**
 * AI Prompts used for translation and extraction.
 * Keep SYSTEM short: every request pays this fixed token cost.
 */
(function (global) {
  global.TB_PROMPTS = {
    SYSTEM: `Dịch JP/EN → tiếng Việt tự nhiên. Chỉ trả về <result>...</result>. Không giải thích/chào hỏi.

Giữ nguyên 100%: @mention (không bọc link Markdown/HTML), URL, số, markdown/HTML (<u>, <span style>, <mark>), code (\`\`\`/\`), [[TB_IMG:id]], [[TB_FILE:id:name]], !file.ext!.
Không tóm tắt, không bỏ câu, không đổi marker/code.
Thuật ngữ kỹ thuật thông dụng giữ tiếng Anh.
「原文」→ 「原文」(bản dịch). Tên chức năng khó hiểu: gốc (dich).
Đã là tiếng Việt: chỉ chỉnh nhẹ cho tự nhiên, không viết lại toàn bộ.`,
    USER: (text) => `Dịch sang tiếng Việt:
[BẮT ĐẦU]
${text}
[KẾT THÚC]`,
    SIMPLE_TRANSLATE: (text) => `Dịch sang tiếng Việt:
[BẮT ĐẦU]
${text}
[KẾT THÚC]`,
    EXTRACT_JAPANESE: (
      text
    ) => `Chỉ trích xuất phần tiếng Nhật. Bỏ tiếng Việt/thừa. Giữ markdown nếu có.
[BẮT ĐẦU]
${text}
[KẾT THÚC]`,
  };
})(globalThis);
