# Backlog to Redmine Translator 🔁

Chrome extension dịch comment từ Backlog sang tiếng Việt bằng Gemini AI và tự động đẩy sang Redmine.

## 📦 Cấu trúc

```
Backlog2Redmine/
├── manifest.json          # Extension manifest (v3)
├── src/                   # Source code
│   ├── background.js      # Service worker
│   ├── content.js         # Content script
│   ├── constants.js       # Configuration & messages
│   ├── options.html       # Settings page
│   ├── options.js         # Settings logic
│   └── styles.css         # Button styles
├── assets/
│   └── icons/             # Extension icons
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── docs/                  # Documentation
├── README.md              # This file
└── CHANGELOG.md           # Version history
```

## 🚀 Cài đặt

### Development

1. **Load extension:**
   - Mở `chrome://extensions/`
   - Bật "Developer mode"
   - Click "Load unpacked"
   - Chọn folder `Backlog2Redmine`

2. **Configure:**
   - Click "Options" trên extension
   - Nhập thông tin:
     - Redmine Domain: `https://redmine.splus-software.com`
     - Redmine API Key
     - Gemini API Key
     - Model: `gemma-4-31b-it` (default)
   - Click "Lưu cấu hình"

### Production Build

```bash
# 1. Zip extension
cd C:\Projects\Extensions
Compress-Archive -Path Backlog2Redmine -DestinationPath Backlog2Redmine.zip

# 2. Upload to Chrome Web Store
https://chrome.google.com/webstore/devconsole
```

## 🎯 Features

- ✅ **Auto-dịch comment** từ Backlog sang tiếng Việt
- ✅ **Auto-find Redmine issue** (search HTML + API fallback)
- ✅ **Confirm modal** với preview nội dung
- ✅ **Success notification** với link đến note
- ✅ **Multiple Gemini models** (Gemma 4, Gemini 3, etc.)
- ✅ **Free tier optimization** (RPD ≥ 50, RPM ≥ 10)
- ✅ **Encrypted API keys** (AES-GCM)

## 🔧 Development

### Requirements

- Node.js 18+ (optional)
- Chrome 88+
- Gemini API key
- Redmine API key

### Scripts

```bash
# Lint (optional)
npx eslint src/

# Test
# Manual testing via chrome://extensions/

# Build
npm run build  # TODO: Add build script
```

### Debug

1. **Service Worker:**
   - `chrome://extensions/` → Details → Service Worker
   - Open DevTools

2. **Content Script:**
   - Open Backlog page
   - F12 → Console
   - Filter: `[TB-Redmine]`

3. **Options Page:**
   - Open Options
   - F12 → Console

## 📝 Usage

1. **Open Backlog issue:**
   ```
   https://shift7.backlog.com/view/ISSUE-123
   ```

2. **Find comment with "Dịch → Redmine" button**

3. **Click button** → Modal hiện ra với:
   - Redmine Issue ID
   - Redmine Issue Title
   - Preview nội dung dịch

4. **Edit nếu cần** → Click "Xác nhận & Gửi"

5. **Success modal** → Click "Xem trên Redmine" để mở link

## 🔐 Security

- API keys được mã hóa (AES-GCM-256)
- Salt hardcoded + PBKDF2 (100k iterations)
- Keys lưu trong `chrome.storage.local`
- Không gửi keys ra ngoài

## 📊 Models

### Default: Gemma 4 31B IT
- **Latest:** April 2026
- **Quality:** Best for translation
- **Speed:** Moderate
- **Free Tier:** ✅ Yes

### Alternatives:
- `gemma-3-27b-it` - Stable, fast
- `gemini-3.1-pro` - Best quality (paid)
- `gemini-2.5-flash` - Fastest

## 🐛 Troubleshooting

### Settings không lưu?
- Check Console (F12) → Xem log "Saving settings..."
- Verify API keys không rỗng
- Check `chrome.storage.local` quota

### Button không hiện?
- Reload Backlog page
- Check Console → "TB_CONSTANTS is not available"
- Verify `manifest.json` paths correct

### Dịch lỗi?
- Check Gemini API key valid
- Check model name đúng (có `-it`)
- Xem log với prefix `[TB-Redmine]`

## 📄 License

MIT License - See LICENSE file

## 👨‍💻 Author

Developed for S+ Software Company

## 🗺️ Roadmap

- [ ] Batch translate (nhiều comments cùng lúc)
- [ ] Translation history
- [ ] Custom prompts
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Analytics dashboard
