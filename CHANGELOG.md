# Changelog

All notable changes to this project will be documented in this file.

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
