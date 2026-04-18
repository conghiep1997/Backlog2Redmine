# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-04-18

### ✨ Added
- **Modular architecture (Service-based)**: Tái cấu trúc mã nguồn theo hướng Service-based để dễ bảo trì.
- **New directory structure**: Tổ chức lại thư mục dưới `src/modules/` (ui, services, utils).
- **Code Guidelines**: Thiết lập quy định về giới hạn kích thước file (< 500 dòng) và cấu trúc code.
- **Enhanced Modal system**: Nâng cấp hệ thống Modal hỗ trợ đồng bộ cả Redmine và Backlog.

### 🔧 Fixed
- **Identifier 'TB' Redeclaration Error**: Sửa lỗi xung đột hằng số TB bằng cách gán vào globalThis và dọn dẹp khai báo cục bộ.
- **SyntaxError in Styles.js**: Sửa lỗi template literal bị cắt cụt do ký tự escape sai vị trí.
- **ReferenceError 'injectStyles'**: Khôi phục khả năng nạp stylesheet cho Content Script.
- **Backlog UI Missing Buttons**: Sửa lỗi logic observer khiến các nút bấm biến mất sau khi refactor.

## [1.3.0] - 2026-04-18

### ✨ Added
- **Issue Migration (Sync All)**: Tính năng di cư toàn bộ Backlog issue sang Redmine (nút "Redmine" ở Header).
- **Dynamic Metadata**: Tự động lấy danh sách Project, Tracker, Priority từ Redmine API để hiển thị dropdown trong Modal.
- **Workflow Automation**: Tự động tạo Ticket (`POST`) và đẩy tuần tự các bình luận (`PUT`) kèm theo.
- **Improved UI**: Giao diện Modal mới hiện đại, hỗ trợ nhiều trường nhập liệu đồng thời.

## [1.2.2] - 2026-04-18

### ✨ Added
- **AI Agent Skills System** - Thiết lập quy trình làm việc tự động cho AI trong `.skills/agent_workflow.md`.
- **Refined Versioning** - Quy định rõ cách đánh version (1.2.x cho lỗi/nhỏ, 1.x.0 cho tính năng lớn).

- **Success Modal Visibility** - Sửa lỗi modal thông báo thành công không hiển thị và bị đóng đè bởi modal xác nhận.
- **Blockquote trailing marker** - Xóa ký tự `> ` thừa ở dòng cuối cùng của blockquote và đảm bảo có dòng trắng phân cách với đoạn văn tiếp theo.
- **Backlog user mentions** - Xử lý tag tên người dùng gọn gàng hơn, không còn bị hiển thị kèm link `/user/`.
- **Author Update** - Cập nhật thông tin tác giả thành Hipppo.

## [1.2.1] - 2026-04-17

### 🔧 Fixed
- **Blockquote duplication** - Sửa lỗi lặp ký tự `> ` khi chuyển đổi comment có blockquote và xuống dòng (br/p/div).
- **Regex text simplification** - Sửa lỗi regex làm mất ký tự đứng trước khoảng trắng khi rút gọn văn bản.

## [1.2.0] - 2026-04-16

### ✨ Added
- **Batch translate** - Dịch từ comment click → cuối cùng
- Mỗi comment trở thành 1 note riêng trên Redmine
- Preview modal hiển thị tất cả comments với phân cách `--- Comment X ---`
- Badge "📦 Gửi X notes liên tiếp" trong confirm modal
- Success modal hiển thị số lượng notes đã gửi
- Tự động gửi tuần tự từng note (Redmine API limitation)

### 🔧 Changed
- Button text động: "Gửi X notes" khi batch mode
- Modal title động: "Dịch X bình luận → Redmine"
- Success message: "✅ Đã gửi X notes thành công!"

### 📝 Updated
- README.md: Thêm hướng dẫn Batch Translate
- Roadmap: Đánh dấu ✅ hoàn thành batch translate

## [1.1.0] - 2026-04-16

### ✨ Added
- Redmine Issue Title display in confirm modal (readonly)
- Success modal with direct link to note (#note-X)
- Model selector with fetch from Google AI API
- Free tier filtering (RPD ≥ 50, RPM ≥ 10)
- Default model: `gemma-4-31b-it` (latest Gemma 4)
- Button text: "Redmine" (clearer action)

### 🔧 Fixed
- Settings not saving issue (added validation + debug logs)
- Missing `geminiModel` parameter in `getSettings()`
- Missing `geminiModel` in `translateWithGemini()` call
- Added CSS for `.secondary` button in options

### 🏗️ Refactored
- Organized source into `src/` folder
- Moved icons to `assets/icons/`
- Updated manifest paths for production structure
- Added comprehensive README.md

### 📦 Assets
- Added extension icons (16x16, 48x48, 128x128)
- Created icon.svg template

## [1.0.1] - 2026-04-15

### ✨ Added
- Initial release
- Gemini translation (Japanese → Vietnamese)
- Auto-find Redmine issue
- Confirm modal before sending
- Encrypted API keys storage

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-04-16 | Batch translate (multiple comments) |
| 1.1.0 | 2026-04-16 | Major UI improvements, model selector, bug fixes |
| 1.0.1 | 2026-04-15 | Initial release |
