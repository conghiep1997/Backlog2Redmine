# DEVELOPMENT GUIDE - Backlog2Redmine Extension

Hướng dẫn phát triển extension Backlog2Redmine.

---

## 📋 Table of Contents

1. [Kiến trúc](#kiến-trúc)
2. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
3. [Quy trình dịch thuật](#quy-trình-dịch-thuật)
4. [Xử lý hình ảnh](#xử-lý-hình-ảnh)
5. [Security](#security)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Kiến trúc

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Backlog.com   │────▶│  Chrome Extension│────▶│   Redmine API   │
│  (HTML + API)   │     │  (Content + BG)  │     │  (REST API)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   Gemini/Cerebras│
                        │   AI Translation │
                        └──────────────────┘
```

### Components

| Component | File | Responsibility |
|-----------|------|---------------|
| **Content Script (Backlog)** | `content.js` | Inject buttons, extract HTML, show modals |
| **Content Script (Redmine)** | `redmine_content.js` | Sync ngược từ Redmine → Backlog |
| **Service Worker** | `background.js` | API calls, translation, coordination |
| **Options Page** | `options.html/js` | User settings, API keys |
| **Modules** | `modules/` | Shared utilities and services |

---

## 📁 Cấu trúc thư mục

```
Backlog2Redmine/
├── src/                          # Source code
│   ├── background.js             # Service worker entry
│   ├── content.js                # Backlog content script
│   ├── redmine_content.js        # Redmine content script
│   ├── constants.js              # Global constants, messages, prompts
│   ├── options.html              # Settings page UI
│   ├── options.js                # Settings logic
│   └── modules/
│       ├── services/
│       │   ├── ai.js             # AI translation (Gemini/Cerebras)
│       │   ├── redmine.js        # Redmine API wrapper
│       │   └── backlog.js        # Backlog API wrapper
│       ├── ui/
│       │   ├── modal.js          # Modal UI management
│       │   ├── toast.js          # Toast notifications
│       │   └── styles.js         # Injected CSS styles
│       └── utils/
│           ├── helpers.js        # Shared utilities
│           ├── crypto.js         # Encryption/decryption
│           └── markdown.js       # HTML → Markdown conversion
├── assets/
│   └── icons/                    # Extension icons (16, 48, 128px)
├── scripts/
│   ├── build.js                  # Build script
│   └── build-zip.js              # Package for Chrome Store
├── dist/                         # Build output (generated)
├── manifest.json                 # Extension manifest v3
├── package.json                  # NPM dependencies
├── .eslintrc.json               # ESLint config
├── .prettierrc                  # Prettier config
├── README.md                     # User documentation
└── DEVELOPMENT.md               # This file
```

---

## 🔄 Quy trình dịch thuật

### Flow: Backlog Comment → Redmine Note

```
1. User clicks "Dịch → Redmine" button
   └─> content.js: handleTranslateAndOpenModal()

2. Extract HTML content from Backlog comment
   └─> markdown.js: extractBacklogContent()
       - Converts HTML tags → Markdown
       - Preserves: bold, italic, lists, code, tables
       - Replaces images: [[TB_IMG:attachmentId]]

3. Send to background worker
   └─> background.js: LOOKUP_AND_TRANSLATE_COMMENT
       a. findRedmineIssue() - Search Redmine by issue key
       b. translateText() - Call AI service
          └─> ai.js: callGeminiAPI() or callCerebrasAPI()

4. Show confirm modal with preview
   └─> modal.js: openConfirmModal()
       - User can edit translation
       - Supports batch mode (multiple comments)

5. User confirms → Send to Redmine
   └─> background.js: SEND_TO_REDMINE
       a. processNotesImages() - Download images from Backlog
       b. uploadToRedmine() - Upload images, get tokens
       c. PUT /issues/{id}.json - Add note with attachments
```

### Batch Translate

Khi user chọn "Dịch đến comment cuối trang":

```javascript
// 1. Dịch comment được click trước
const result = await translateText(clickedComment);

// 2. Dịch song song các comments còn lại
const batchPromises = remainingComments.map(c => translateText(c.text));
const batchResults = await Promise.all(batchPromises);

// 3. Gửi lần lượt từng note
for (const note of [result, ...batchResults]) {
  await sendToRedmine(note);
}
```

---

## 🖼️ Xử lý hình ảnh

### Image Flow

```
Backlog Comment HTML
    ↓
<img src="...ViewAttachmentImage.action?attachmentId=123">
    ↓
markdown.js: extractBacklogContent()
    ↓
[[TB_IMG:123]]   (placeholder marker)
    ↓
background.js: processNotesImages()
    ↓
downloadBacklogImage() → Blob
    ↓
uploadToRedmine() → { token: "abc123" }
    ↓
Replace: [[TB_IMG:123]] → !image_123.png!
    ↓
Redmine Note with attachment
```

### Supported Image Types

| Type | Source | Handling |
|------|--------|----------|
| Backlog attachments | `ViewAttachmentImage.action` | Download → Upload → Replace marker |
| External images | `https://...` | Keep as `![alt](url)` |
| Loom internal | `.loom-internal-image` | Same as Backlog attachments |

---

## 🔐 Security

### API Key Encryption

```javascript
// Keys are encrypted before storage
const encrypted = await encryptData(apiKey);
await chrome.storage.local.set({ redmineApiKey: encrypted });

// Decrypted on use
const encrypted = (await chrome.storage.local.get('redmineApiKey')).redmineApiKey;
const apiKey = await decryptData(encrypted);
```

### Per-User Salt

Mỗi installation có salt duy nhất:

```javascript
// crypto.js: deriveKey()
const storageId = await getUserStorageId(); // UUID from chrome.storage
const combinedSalt = `openclaw-backlog2redmine-${storageId}-2026`;
```

### Permissions

```json
{
  "permissions": ["storage"],
  "host_permissions": [
    "*://*.backlog.com/*",
    "*://*.backlog.jp/*",
    "https://redmine.splus-software.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.cerebras.ai/*"
  ]
}
```

---

## 🛠️ Development Workflow

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Build extension
npm run build

# 3. Load in Chrome
- Open chrome://extensions/
- Enable "Developer mode"
- Click "Load unpacked"
- Select dist/ folder
```

### Daily Development

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Build for testing
npm run build
```

### Versioning Rules

- `manifest.json` là **source of truth** cho version phát hành của extension.
- Workflow release trong `.github/workflows/deploy.yml` đọc version từ `manifest.json`, không đọc từ `package.json`.
- Tên file ZIP và bước upload Google Drive cũng dựa trên `manifest.json.version`.
- Dùng `npm run bump` để tự tăng patch version, hoặc `npm run bump -- 1.7.2` để chỉ định version cụ thể. Lệnh này cập nhật đồng bộ `manifest.json`, `package.json` và tạo sẵn stub entry trong `CHANGELOG.md`.
- Khi bump version để release, còn phải cập nhật:
  - `CHANGELOG.md`
  - `README.md` chỉ khi nội dung tài liệu thay đổi, không cần sửa version text thủ công nữa
- Nếu chỉ tăng `package.json` mà quên `manifest.json`, CI/CD sẽ tiếp tục dùng tag cũ và có thể skip release/upload artifact.

### Debugging

**Content Script:**
1. Open Backlog page
2. F12 → Console
3. Filter: `[TB-Redmine]`

**Service Worker:**
1. `chrome://extensions/`
2. Find extension → Details
3. Click "Service Worker" → Inspect

**Options Page:**
1. Open Options from extension popup
2. F12 → Console

### Common Debug Scenarios

| Issue | Debug Location |
|-------|---------------|
| Button không hiện | content.js console |
| Dịch lỗi | background.js console |
| Settings không lưu | options.js console |
| API call failed | Network tab + background.js |

---

## 🐛 Troubleshooting

### Button không xuất hiện

**Check:**
1. Console có log "TB_CONSTANTS is not available"?
2. Backlog URL có match với manifest `content_scripts.matches`?
3. Đã reload page sau khi load extension?

**Fix:**
```javascript
// content.js: Check constants loaded
if (typeof TB === 'undefined') {
  console.error('[TB] Constants not loaded!');
  return;
}
```

### Dịch trả về lỗi 429

**Nguyên nhân:** Rate limit từ AI provider

**Fix:**
- Extension tự động fallback sang model phụ
- Check console log: `[TB-AI] Primary rate limited. Falling back...`
- Đợi 1 phút hoặc check API quota

### Hình ảnh không hiển thị

**Check:**
1. Console log từ `processNotesImages()`
2. Backlog domain có đúng không?
3. Redmine upload API có response token?

**Debug:**
```javascript
// background.js: Add logging
async function processNotesImages(notes, backlogDomain, settings) {
  console.log('[BG] Processing images:', notes.match(/\[\[TB_IMG:\d+\]\]/g));
  // ...
}
```

### Settings không lưu được

**Check:**
1. `chrome.storage.local` quota (5MB limit)
2. API keys có bị encrypt/decrypt đúng không?
3. Console log từ options.js

**Test:**
```javascript
// In console:
chrome.storage.local.get(null, console.log); // Show all stored data
```

---

## 📊 Performance Considerations

### AI Translation

| Provider | Avg Latency | Rate Limit | Best For |
|----------|-------------|------------|----------|
| Cerebras | 1-3s | 1000 RPM / 100k RPD | Fast translation |
| Gemini 27B | 3-5s | 15 RPM / 31 RPD | High quality |
| Gemini Flash | 1-2s | 17 RPM | Fallback |

### Image Processing

- Download từ Backlog: ~500ms/image
- Upload lên Redmine: ~300ms/image
- Total: ~1s/image

**Optimization:** Process images in parallel với Promise.all()

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Button xuất hiện đúng vị trí
- [ ] Click button → Modal hiện ra
- [ ] Dịch 1 comment thành công
- [ ] Dịch batch (nhiều comments) thành công
- [ ] Hình ảnh được upload đúng
- [ ] Markdown format được giữ nguyên
- [ ] Settings lưu và load đúng
- [ ] Fallback AI hoạt động khi rate limit

### Edge Cases

- [ ] Comment không có nội dung
- [ ] Comment chỉ có hình ảnh
- [ ] Comment với code blocks
- [ ] Comment với tables
- [ ] Nested lists (3+ levels)
- [ ] Blockquotes với multiple lines
- [ ] Mixed formatting (bold + italic + code)

---

## 📚 Resources

- [Chrome Extension Manifest v3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Cerebras API Docs](https://docs.cerebras.ai/)
- [Redmine REST API](https://www.redmine.org/projects/redmine/wiki/Rest_api)
- [Backlog API Docs](https://developer.backlog.com/)

---

**Last Updated:** 2026-04-18  
**Version:** 1.4.3
