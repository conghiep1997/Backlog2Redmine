# AI Agent Workflow & Contribution Guide 🤖

File này quy định quy trình làm việc bắt buộc dành cho các AI Agent (như Antigravity, Claude, v.v.) khi tham gia chỉnh sửa hoặc phát triển dự án này. Việc tuân thủ quy trình này giúp đảm bảo dự án luôn nhất quán và tài liệu luôn đi đôi với code thực tế.

## 🛠 Quy tắc bắt buộc (Mandatory Rules)

Khi thực hiện bất kỳ thay đổi nào đối với logic hoặc tính năng, Agent **PHẢI** thực hiện các bước sau:

1.  **Cập nhật Version trong `manifest.json`**:
    *   **Patch (`1.2.x`)**: Dùng cho các bản sửa lỗi (bug fix) hoặc cải tiến tính năng nhỏ.
    *   **Minor (`1.x.0`)**: Dùng cho các chức năng lớn, quan trọng hoặc thay đổi đáng kể về kiến trúc.
    *   **Nhóm thay đổi (Grouping)**: Các thay đổi nhỏ thực hiện trong cùng một ngày có thể được gộp chung vào một lần tăng version duy nhất để giữ Log ngắn gọn.
    *   Ví dụ: `1.2.1` -> `1.2.2` (gộp nhiều fix bug trong ngày).

2.  **Ghi chép vào `CHANGELOG.md`**:
    *   Thêm mục mới cho version vừa tăng.
    *   Mô tả ngắn gọn nhưng đầy đủ các thay đổi (✨ Added, 🔧 Fixed, 🏗️ Refactored).
    *   Sử dụng tiếng Việt cho nội dung log.

3.  **Cập nhật `README.md`**:
    *   Nếu thay đổi ảnh hưởng đến cách sử dụng, giao diện hoặc kiến trúc, hãy cập nhật mục tương ứng trong README.
    *   Đảm bảo badge version (nếu có) hoặc thông tin phiên bản trong README khớp với `manifest.json`.

4.  **Kiểm tra tính năng (Verification)**:
    *   Luôn chạy thử script test nội bộ hoặc giải thích cách kiểm tra thủ công trong `walkthrough`.

## ⚙️ Logic Chuyển đổi (Conversion Logic)

Agent cần đặc biệt lưu ý logic trong `src/content.js` (hàm `extractBacklogContent`):
- Sử dụng đệ quy để duyệt DOM.
- Không thêm marker `> ` bên trong các tag con của blockquote; hãy để trình xử lý node cha thực hiện việc này sau khi thu thập toàn bộ text.
- Cẩn thận với các regex xử lý khoảng trắng để không làm mất dữ liệu.

---
*Tài liệu này là một "Skill" giúp các AI Agent hiểu rõ ngữ cảnh và kỳ vọng của Maintainer dự án.*
