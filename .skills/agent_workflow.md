# AI Agent Workflow & Contribution Guide

File này quy định quy trình làm việc dành cho các AI Agent khi chỉnh sửa hoặc phát triển dự án Backlog2Redmine. Mục tiêu là giữ code, tài liệu, version và quy trình release nhất quán với trạng thái thực tế của repo.

## Nguyên Tắc Chung

1. **Đọc ngữ cảnh trước khi sửa**
   - Kiểm tra file liên quan, luồng gọi hàm và manifest/script load order trước khi thay đổi.
   - Không đoán vị trí logic chỉ dựa trên tên file. Ví dụ: `extractBacklogContent` hiện nằm trong `src/modules/utils/markdown.js`, không nằm trực tiếp trong `src/content.js`.

2. **Giữ phạm vi thay đổi nhỏ**
   - Chỉ sửa các file cần thiết cho yêu cầu hiện tại.
   - Không format hoặc refactor file không liên quan nếu không cần thiết.
   - Nếu tool format làm thay đổi ngoài phạm vi, phải kiểm tra `git diff` và loại bỏ thay đổi không liên quan trước khi bàn giao.

3. **Tôn trọng worktree hiện tại**
   - Luôn kiểm tra `git status --short` trước và sau khi sửa.
   - Không revert thay đổi của người khác nếu không được yêu cầu.
   - Khi gặp file đang có thay đổi ngoài nhiệm vụ, chỉ làm việc với phần cần thiết và nêu rõ trong báo cáo nếu có rủi ro.

## Quy Trình Khi Sửa Code

Khi thay đổi logic hoặc tính năng, Agent phải thực hiện tối thiểu các bước sau:

1. **Xác định luồng ảnh hưởng**
   - Content script, background service worker, options page và service modules giao tiếp chủ yếu qua `chrome.runtime.sendMessage`.
   - Nếu thêm message type mới, phải kiểm tra cả nơi gửi, nơi nhận và dữ liệu trả về.
   - Nếu thêm file module mới cho content script hoặc options page, phải cập nhật đúng thứ tự trong `manifest.json` hoặc HTML tương ứng.

2. **Kiến trúc và kích thước file**
   - Ưu tiên tách code theo module trong `src/modules/`:
     - `ui/`: modal, toast, styles.
     - `services/`: API Redmine, Backlog, AI, version checker.
     - `utils/`: helper, markdown, crypto, logger.
     - `constants/`: model, prompt, icon.
   - Mục tiêu: mỗi file dưới 500 dòng.
   - Ngoại lệ: file xử lý UI/phân tích markdown có thể lớn hơn, nhưng nếu vượt 1000 dòng phải đề xuất hướng tách module.

3. **Post-edit audit**
   - Sau mọi thao tác edit file, kiểm tra nhanh syntax, dấu ngoặc `{}`, `()`, `[]`, template literal và phần cuối file.
   - Với extension scripts dùng global namespace, tránh khai báo lại các global như `TB`, `TB_LOGGER`, `openConfirmModal`.
   - Kiểm tra các hàm init quan trọng không bị mất hoặc bị cắt cụt, ví dụ `injectStyles`, `scanAndInjectButtons`, `openConfirmModal`.

4. **Verification**
   - Chạy lint sau khi sửa code:
     - Windows/PowerShell: dùng `npm.cmd run lint` nếu `npm run lint` bị chặn bởi ExecutionPolicy.
     - Môi trường khác: dùng `npm run lint`.
   - Nếu thay đổi HTML/CSS hoặc chuẩn format, chạy thêm `npm run format:check` hoặc `npx prettier --check <file>`.
   - Trước khi release/build, chạy `npm run build`.
   - Nếu không chạy được lệnh nào, phải ghi rõ lý do và hướng kiểm tra thủ công.

## Quy Trình Release

Chỉ thực hiện các bước này khi người dùng yêu cầu release, build bản phát hành, hoặc thay đổi đã sẵn sàng đóng gói. Không bắt buộc bump version cho mọi fix nhỏ trong lúc đang review.

1. **Version source of truth**
   - `manifest.json` là source of truth cho release.
   - `package.json.version` phải khớp với `manifest.json.version`.
   - CI/CD, tên file ZIP, GitHub Release tag và upload Google Drive đọc version từ `manifest.json`.

2. **Bump version**
   - Patch (`1.2.x`): bug fix hoặc cải tiến nhỏ.
   - Minor (`1.x.0`): tính năng lớn hoặc thay đổi kiến trúc đáng kể.
   - Có thể gom nhiều thay đổi nhỏ trong cùng một ngày vào một lần bump.
   - Lệnh chuẩn:
     - `npm run bump` để tăng patch version.
     - `npm run bump -- 1.7.2` để chỉ định version cụ thể.
   - Script bump sẽ đồng bộ `manifest.json`, `package.json` và tạo stub trong `CHANGELOG.md` nếu chưa có.

3. **CHANGELOG.md**
   - Hoàn thiện entry version mới sau khi chạy bump.
   - Nội dung log dùng tiếng Việt, ngắn gọn nhưng đủ ý.
   - Gợi ý nhóm mục:
     - `Added`: tính năng mới.
     - `Fixed`: sửa lỗi.
     - `Changed`: thay đổi hành vi hoặc UI.
     - `Docs`: cập nhật tài liệu.

4. **README.md**
   - Cập nhật nếu thay đổi ảnh hưởng cách dùng, UI, cấu hình, quyền extension hoặc kiến trúc.
   - Nếu README có badge/version text, phải khớp với `manifest.json`.

5. **Final release audit**
   - `npm run check:version-sync` phải pass.
   - `npm run lint` hoặc `npm.cmd run lint` phải pass không error.
   - `npm run build` phải pass trước khi đóng gói.
   - Kiểm tra `git diff --stat` để đảm bảo chỉ có file liên quan.

## Logic Chuyển Đổi Nội Dung

Agent cần đặc biệt cẩn thận với logic chuyển nội dung Backlog sang Markdown trong `src/modules/utils/markdown.js`, đặc biệt là hàm `extractBacklogContent`.

- Hàm này duyệt DOM để giữ Markdown tương thích với Redmine.
- Không thêm marker `> ` bên trong tag con của blockquote; để node cha xử lý blockquote sau khi thu thập toàn bộ text.
- Cẩn thận với regex xử lý khoảng trắng để không làm mất dữ liệu, link, code block hoặc marker attachment.
- Các marker nội bộ như `[[TB_IMG:id]]` và `[[TB_FILE:id:filename]]` phải được giữ nguyên cho bước upload/replace attachment.

## Checklist Trước Khi Bàn Giao

- Đã kiểm tra `git diff` và loại bỏ thay đổi không liên quan.
- Đã chạy lint hoặc nêu rõ vì sao không chạy được.
- Đã kiểm tra build/format nếu thay đổi có ảnh hưởng tới release hoặc HTML/CSS.
- Đã ghi rõ file đã sửa và hành vi đã thay đổi.
- Nếu có rủi ro còn lại hoặc cần kiểm thử thủ công trên Chrome extension, phải nêu cụ thể.

---

Tài liệu này là workflow nội bộ giúp các AI Agent hiểu đúng kỳ vọng của maintainer khi làm việc trong repo.
