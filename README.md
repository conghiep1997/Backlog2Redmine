# Backlog to Redmine Translator (v1.4.3)

Chrome extension dich comment tu Backlog sang tieng Viet va dong bo du lieu thong minh sang Redmine.

## Cau truc du an

```
Backlog2Redmine/
├── src/                    # Ma nguon chinh
│   ├── modules/            # Services (AI, Redmine, Backlog), UI & Utils
│   ├── background.js       # Service worker
│   ├── constants.js        # Cau hinh & Ngon ngu
│   └── options.html/js     # Trang cai dat nang cao
└── assets/                 # Icons & Hinh anh
```

## He thong AI ho tro

Phien ban 1.4.3 toi uu hoa cho tai khoan Free Tier:

1. **Primary (Chinh) - Llama 3.1 8B (Cerebras)**: Toc do cuc nhanh, on dinh va khong bi gioi han nhu ban 70B.
2. **Options (Nang cao)**: Ho tro Qwen 3 235B va GPT OSS 120B cho nhu cau xu ly phuc tap (co the chon trong trang Options).
3. **Fallback (Du phong) - Gemma 3 27B IT (Gemini)**: Tu dong kich hoat khi Cerebras gap su co.

## Tinh nang noi bat

- **Migrate Issue**: Tao moi Issue tren Redmine tu noi dung Backlog chi voi 1-click.
- **Cyan-Flow UI**: Giao dien hien dai, pill-shaped.
- **Code Preservation**: Bao ve tuyet doi cac khoi ma nguon (```) va tag anh ([[TB_IMG:id]]).
- **Batch Translate**: Dich va gui hang loat binh luan lien tiep.
- **Security**: Ma hoa API keys bang AES-GCM-256.

## Huong dan su dung

### 1. Di chuyen Issue (Migrate)
- Tai trang chi tiet Issue cua Backlog, nhan nut **Migrate Issue** o goc tren ben phai.
- Extension se dich noi dung va mo Modal tao Issue moi tren Redmine.

### 2. Dich va Gui Comment
- Nhan nut **Redmine** tai moi binh luan tren Backlog.
- Xem truoc ban dich, chinh sua Redmine Issue ID va nhan **Xac nhan & Gui**.

---
Developed by **Hipppo** | Version **1.4.3** (April 2026)
