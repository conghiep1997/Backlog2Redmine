# AI Agent Workflow & Contribution Guide 🤖

File này quy định quy trình làm việc bắt buộc dành cho các AI Agent (như Antigravity, Claude, v.v.) khi tham gia chỉnh sửa hoặc phát triển dự án này. Việc tuân thủ quy trình này giúp đảm bảo dự án luôn nhất quán và tài liệu luôn đi đôi với code thực tế.

## 🛠 Quy tắc bắt buộc (Mandatory Rules)

Khi thực hiện bất kỳ thay đổi nào đối với logic hoặc tính năng, Agent **PHẢI** thực hiện các bước sau:

1.  **Cập nhật Version với `manifest.json` là nguồn chính (source of truth)**:
     *   **Patch (`1.2.x`)**: Dùng cho các bản sửa lỗi (bug fix) hoặc cải tiến tính năng nhỏ.
     *   **Minor (`1.x.0`)**: Dùng cho các chức năng lớn, quan trọng hoặc thay đổi đáng kể về kiến trúc.
     *   **Nhóm thay đổi (Grouping)**: Các thay đổi nhỏ thực hiện trong cùng một ngày có thể được gộp chung vào một lần tăng version duy nhất để giữ Log ngắn gọn.
     *   Ví dụ: `1.2.1` -> `1.2.2` (gộp nhiều fix bug trong ngày).
     *   **Quan trọng**: CI/CD, tên file ZIP, GitHub Release tag và bước upload Google Drive hiện đều đọc version từ `manifest.json`, không phải từ `package.json`.
     *   **Bắt buộc đồng bộ**: Khi tăng version, Agent phải cập nhật ít nhất `manifest.json`, `package.json`, `CHANGELOG.md` và thông tin version trong `README.md` nếu có hiển thị.
     *   Nếu `package.json` và `manifest.json` lệch nhau, hãy coi `manifest.json` là chuẩn release và sửa các file còn lại để khớp.
     *   **Lệnh chuẩn để bump version**: Dùng `npm run bump` để tự tăng patch version, hoặc `npm run bump -- 1.7.2` để chỉ định version cụ thể. Lệnh này sẽ cập nhật đồng bộ `manifest.json`, `package.json` và tạo stub entry mới trong `CHANGELOG.md` nếu chưa có.

2.  **Ghi chép vào `CHANGELOG.md`**:
    *   Thêm mục mới cho version vừa tăng.
    *   Mô tả ngắn gọn nhưng đầy đủ các thay đổi (✨ Added, 🔧 Fixed, 🏗️ Refactored).
    *   Sử dụng tiếng Việt cho nội dung log.

3.  **Cập nhật `README.md`**:
    *   Nếu thay đổi ảnh hưởng đến cách sử dụng, giao diện hoặc kiến trúc, hãy cập nhật mục tương ứng trong README.
    *   Đảm bảo badge version (nếu có) hoặc thông tin phiên bản trong README khớp với `manifest.json`.

4.  **Kiến trúc & Cấu trúc file (Architecture & File Size)**:
    *   **Tính Module**: Ưu tiên tách code thành các module chuyên biệt trong thư mục `src/modules/` (ui, services, utils).
    *   **Giới hạn dòng (Line Limits)**: 
        *   Mục tiêu: Dưới **500 dòng** mỗi file.
        *   Ngoại lệ: Các tệp có tính đặc thù cao (như Parser Markdown) có thể lên tới **1000 dòng**, nhưng phải được giữ ở mức tối thiểu.
    *   **Giao tiếp**: Sử dụng `chrome.runtime.sendMessage` để phối hợp giữa Content Script và Background Script.

5.  **Kiểm tra tính năng (Verification)**:
    *   Luôn chạy thử script test nội bộ hoặc giải thích cách kiểm tra thủ công trong `walkthrough`.

6.  **Review & Verify sau mỗi lần chỉnh sửa (Post-Edit Audit)**:
    *   **Syntax Integrity**: Ngay sau khi dùng `replace_file_content`, Agent **PHẢI** kiểm tra lại sự cân bằng của các dấu ngoặc `{}`, `()`, `[]` và tính toàn vẹn của chuỗi template literals (backticks).
    *   **Namespace Collision**: Đảm bảo không sử dụng `const` cho các biến đã tồn tại trong không gian tên toàn cục (như `TB`).
    *   **Function Availability**: Nếu file chứa các hàm khởi tạo (như `injectStyles`), phải xác nhận file không bị cắt cụt (Unexpected end of input).
    *   **Tail-end Check**: Luôn kiểm tra phần cuối của file sau khi sửa để đảm bảo không có ký tự rác hoặc bị mất code.

## ⚙️ Quy trình Hậu kiểm bắt buộc (Mandatory Final Audit)

TRƯỚC khi báo cáo hoàn thành nhiệm vụ hoặc một phiên bản, Agent **PHẢI** thực hiện Audit nội bộ:

1.  **Version Consistency Check**:
     *   Đối chiếu `version` trong `manifest.json` với mục mới nhất trong `CHANGELOG.md`.
     *   Đảm bảo badge version hoặc thông tin version trong `README.md` (nếu có) cũng phải khớp hoặc đã được loại bỏ hoàn toàn để tránh lệch.
     *   Đối chiếu thêm `package.json.version` với `manifest.json.version`.
     *   Nếu có thay đổi version mà chưa sửa `manifest.json`, coi như chưa sẵn sàng release vì workflow `.github/workflows/deploy.yml` sẽ tiếp tục dùng version cũ để tạo `TAG`.
2.  **File Size & Modularity Audit**:
    *   Kiểm tra số dòng (LoC) của tất cả các file đã chỉnh sửa/tạo mới. 
    *   Nếu file > 500 dòng (trừ Parser), **PHẢI** đề xuất refactor ngay lập tức thay vì bỏ qua.
3.  **Project Cleanup**:
    *   Xóa toàn bộ Dead Code, Comment out không cần thiết.
    *   Xóa các file legacy, file backup hoặc resource không còn sử dụng (như `.css` cũ).
4.  **Manifest Integrity**:
    *   Đảm bảo tất cả các file module mới được liệt kê đúng thứ tự trong `manifest.json`.
5.  **Linting Check (Kiểm tra lỗi trình bày)**:
    *   **PHẢI** chạy lệnh `npm run lint` ngay sau khi hoàn thành code.
    *   **PHẢI** sửa toàn bộ các lỗi (Errors) và cảnh báo (Warnings) trước khi bàn giao nhiệm vụ hoặc báo cáo hoàn thành.

## ⚙️ Logic Chuyển đổi (Conversion Logic)

Agent cần đặc biệt lưu ý logic trong `src/content.js` (hàm `extractBacklogContent`):
- Sử dụng đệ quy để duyệt DOM.
- Không thêm marker `> ` bên trong các tag con của blockquote; hãy để trình xử lý node cha thực hiện việc này sau khi thu thập toàn bộ text.
- Cẩn thận với các regex xử lý khoảng trắng để không làm mất dữ liệu.

---
*Tài liệu này là một "Skill" giúp các AI Agent hiểu rõ ngữ cảnh và kỳ vọng của Maintainer dự án.*
