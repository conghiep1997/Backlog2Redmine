# CI/CD Setup for Automated Version Upload & Registration

## GitHub Secrets cần thêm

Trong repo `Backlog2Redmine`, vào **Settings → Secrets and variables → Actions** và thêm:

### Google Drive
- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_REFRESH_TOKEN`
- `GDRIVE_FOLDER_ID` = `15PkcPaQGbbBwYGowpSXSJMK6TKzx4sqW`

### Backend
- `BACKEND_URL` = URL backend của Dev Tool Platform, ví dụ: `https://dev-tool-platform-api.onrender.com`
- `BACKEND_API_KEY` = nếu backend có auth thì thêm, chưa có thì để trống

### Frontend (Dashboard)
- `DASHBOARD_URL` = URL frontend dashboard, ví dụ: `https://dev-tool-platform.vercel.app`

## Flow CI/CD
1. Build extension
2. Tạo file zip
3. Upload zip lên Google Drive
4. Tự động gọi `POST /api/versions` để đăng ký version vào backend

## Chạy local test
```bash
cd C:\Projects\Extensions\Backlog2Redmine
npm install
npm run build
npm run build:zip
$env:GDRIVE_CLIENT_ID="..."
$env:GDRIVE_CLIENT_SECRET="..."
$env:GDRIVE_REFRESH_TOKEN="..."
$env:GDRIVE_FOLDER_ID="15PkcPaQGbbBwYGowpSXSJMK6TKzx4sqW"
$env:VERSION="1.8.3"
$env:BACKEND_URL="http://localhost:8000"
$env:DASHBOARD_URL="http://localhost:3000"
node scripts/upload-gdrive.js
```
