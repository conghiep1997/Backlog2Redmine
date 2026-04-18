# Backlog to Redmine Translator (v1.4.6)

Chrome extension dịch comment từ Backlog sang tiếng Việt và đồng bộ dữ liệu thông minh sang Redmine.

**Latest Update:** Phase 1 & 2 completed - Improved Markdown conversion, per-user encryption, timeout handling, and full JSDoc documentation.

---

## 📦 Cấu trúc dự án

```
Backlog2Redmine/
├── src/                         # Source code
│   ├── background.js            # Service worker (API orchestration)
│   ├── content.js               # Backlog content script
│   ├── redmine_content.js       # Redmine content script (sync ngược)
│   ├── constants.js             # Global constants, messages, prompts
│   ├── options.html/js          # Settings page
│   └── modules/
│       ├── services/
│       │   ├── ai.js            # AI translation (Gemini/Cerebras)
│       │   ├── redmine.js       # Redmine API wrapper
│       │   └── backlog.js       # Backlog API wrapper
│       ├── ui/
│       │   ├── modal.js         # Modal UI management
│       │   ├── toast.js         # Toast notifications
│       │   └── styles.js        # Injected CSS styles
│       └── utils/
│           ├── helpers.js       # Shared utilities (timeoutFetch, etc.)
│           ├── crypto.js        # AES-GCM-256 encryption (per-user salt)
│           └── markdown.js      # HTML → Markdown conversion
├── assets/icons/                # Extension icons (16, 48, 128px)
├── scripts/
│   ├── build.js                 # Build script
│   └── build-zip.js             # Package for Chrome Web Store
├── dist/                        # Build output (generated)
├── manifest.json                # Extension manifest v3
├── package.json                 # NPM dependencies
├── .eslintrc.json              # ESLint config
├── .prettierrc                 # Prettier config
├── README.md                    # This file
└── DEVELOPMENT.md              # Developer guide
```

---

## 🤖 Hệ thống AI hỗ trợ

Phiên bản 1.4.6 tối ưu hóa cho tài khoản Free Tier:

| Provider | Model | Rate Limit | Best For |
|----------|-------|------------|----------|
| **Primary** | Llama 3.1 8B (Cerebras) | 1000 RPM / 100k RPD | Fast & stable |
| **Options** | Qwen 3 235B (Cerebras) | High quota | Complex translation |
| **Fallback** | Gemma 3 27B IT (Gemini) | 15 RPM / 31 RPD | Quality backup |

---

## ✨ Tính năng nổi bật

### Core Features

- ✅ **Dịch Backlog → Redmine**: Tự động dịch Nhật/Anh → Việt bằng AI
- ✅ **Sync Redmine → Backlog**: Lọc nội dung tiếng Nhật, gửi ngược lại
- ✅ **Migrate Issue**: Tạo issue mới trên Redmine từ Backlog (1-click)
- ✅ **Batch Translate**: Dịch và gửi hàng loạt comments liên tiếp
- ✅ **Image & Video Handling**: Tự động download/upload ảnh và video (.mp4, .mov...). Video có trình phát ngay trên Redmine.
- ✅ **Markdown Preservation**: Giữ nguyên format (bold, italic, lists, tables, code blocks)

### UI/UX

- 🎨 **Cyan-Flow Design**: Giao diện modern, pill-shaped buttons
- 🔔 **Toast Notifications**: Feedback trực quan cho mọi action
- 📦 **Confirm Modal**: Preview và edit trước khi gửi
- ⚡ **Loading States**: Spinner và disabled states rõ ràng

### Security

- 🔐 **AES-GCM-256**: Mã hóa API keys trước khi lưu
- 🧂 **Per-User Salt**: Mỗi installation có salt duy nhất
- 🛡️ **Timeout Fetch**: Tránh treo kết nối (15s timeout)

---

## 🚀 Hướng dẫn sử dụng

### Cài đặt nhanh

```bash
# 1. Install dependencies
npm install

# 2. Build extension
npm run build

# 3. Load in Chrome
- Mở chrome://extensions/
- Bật "Developer mode"
- Click "Load unpacked"
- Chọn folder dist/
```

### 1. Di chuyển Issue (Migrate)

1. Mở issue chi tiết trên Backlog
2. Click nút **Migrate Issue** (góc trên phải)
3. Điền thông tin Redmine:
   - Project
   - Tracker
   - Priority
   - Subject
4. Preview nội dung dịch → Click **Tạo & Di cư toàn bộ**

### 2. Dịch và Gửi Comment

1. Tìm comment cần dịch trên Backlog
2. Click nút **Redmine** (icon translate)
3. Modal hiện ra với:
   - Redmine Issue ID (auto-fill nếu tìm thấy)
   - Preview nội dung dịch
   - Option: Dịch batch (từ vị trí click → cuối)
4. Click **Xác nhận & Gửi**

### 3. Sync ngược (Redmine → Backlog)

1. Mở issue trên Redmine
2. Click nút **Backlog** (share icon)
3. AI lọc phần tiếng Nhật
4. Nhập Backlog Issue Key → Gửi

---

## 🛠️ Development

### Commands

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Build for production
npm run build

# Create ZIP package
npm run build:zip
```

### Debugging

**Content Script (Backlog/Redmine):**
- F12 → Console → Filter: `[TB-Redmine]`

**Service Worker:**
- `chrome://extensions/` → Details → Service Worker → Inspect

**Options Page:**
- Mở Options → F12 → Console

### Testing Checklist

- [ ] Button xuất hiện đúng vị trí
- [ ] Dịch 1 comment thành công
- [ ] Dịch batch (nhiều comments) thành công
- [ ] Hình ảnh được upload đúng
- [ ] Markdown format được giữ nguyên (bold, lists, tables, code)
- [ ] Settings lưu và load đúng
- [ ] Fallback AI hoạt động khi rate limit

---

## 📊 Performance

| Operation | Avg Time | Notes |
|-----------|----------|-------|
| AI Translation | 1-5s | Depends on model |
| Image Download | ~500ms/image | From Backlog |
| Image Upload | ~300ms/image | To Redmine |
| Issue Lookup | ~1s | HTML search + API fallback |

---

## 🔐 Security

- API keys encrypted với **AES-GCM-256**
- Per-user salt từ `chrome.storage` UUID
- Timeout fetch: 10-15s cho mọi API calls
- Không gửi keys ra ngoài extension

---

## 📜 Nhật ký thay đổi 

Chi tiết các thay đổi qua từng phiên bản có thể được xem tại: **[CHANGELOG.md](./CHANGELOG.md)**

---

## 📚 Resources

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Chi tiết kiến trúc và debugging
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cerebras API](https://docs.cerebras.ai/)
- [Redmine REST API](https://www.redmine.org/projects/redmine/wiki/Rest_api)

---

**Developed by Hipppo** 🦛 | Version **1.4.6** (April 2026)
