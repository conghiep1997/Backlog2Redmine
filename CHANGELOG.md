# Nhật ký thay đổi (Changelog)

## [1.8.3] - 2026-04-26

### ✨ Tính năng mới
- **Flow Redmine → Backlog**: Hoàn thiện tính năng đồng bộ ngược từ Redmine sang Backlog
- **Attachment handling**: Tự động extract và upload file đính kèm từ Redmine sang Backlog
- **Batch sync**: Nút "🔄 Đồng bộ tất cả comments" để sync hàng loạt với progress tracking
- **Smart @mentions**: 
  - Hiển thị dropdown gợi ý users khi gõ `@` trong preview
  - Hỗ trợ cả `userId` (login ID) và fallback sang name khi không có userId
  - Tự động detect mentions từ preview text để gửi notification
  - Gửi danh sách numeric IDs qua `notifiedUserId[]` để Backlog gửi notification đúng
- **Project-specific user loading**: Dùng API `/api/v2/projects/{key}/users` (cần Project Member, không cần Admin)
- **Lazy user loading**: Chỉ load users khi nhập issue key hợp lệ, tránh gọi API sai project

### 🔧 Sửa lỗi
- Sửa lỗi `userId: null` khiến không tag được một số users trong Backlog
- Sửa lỗi modal không hiển thị user suggestions khi gõ `@`
- Sửa lỗi auto-load users với project key sai (COUIX_PJ vs CTRIAL)
- Thêm null checks cho user data để tránh crash khi API trả về data không đầy đủ
- Sửa duplicate code trong `updateAutoNotify()` function

### 🔄 Thay đổi
- Không auto-load users khi mở modal → tránh gọi API với project key sai
- Hiển thị hint rõ ràng khi chưa có issue key hoặc không load được users
- Cải thiện UX: chỉ hiển thị suggestion dropdown khi có data users hợp lệ

### 📝 Tài liệu
- Cập nhật README.md với hướng dẫn sử dụng flow Redmine → Backlog
- Thêm logging chi tiết để debug API calls


## [1.8.2] - 2026-04-23

### 🚀 Cải thiện hiệu năng
- Tối ưu `translateBatch` với `Promise.all()` batch 5 thay vì gọi tuần tự, giảm thời gian dịch batch comments
- Thêm cleanup handlers (`beforeunload`) để giải phóng interval và observer khi rời trang, tránh memory leak
- Giới hạn MutationObserver scope vào container cụ thể (`.comments`, `.comment-list`) thay vì `document.body` để giảm CPU usage
- Thêm projects caching (5 phút) và debounce (500ms) cho `fetchProjects` trong Options page
- Thêm `debounce()` và `throttle()` utility functions trong helpers.js

### 🔧 Sửa lỗi
- Sửa `reportProjectId` dropdown không được populate data tương tự `defaultProjectId`
- Sửa lỗi status message bị mất sau khi lưu cấu hình (thêm `setTimeout` trước `loadOptions`)

### 🔄 Thay đổi
- Chuẩn hóa code style: đổi single quotes sang double quotes


## [1.8.1] - 2026-04-23

### ✨ Tính năng mới
- Triển khai danh sách "Tứ trụ" AI mạnh mẽ (Gemma 3/4, Gemini 3.1) với RPD cao
- Cơ chế **Load Balancing**: Xáo trộn ngẫu nhiên Model & Key để tối ưu hóa hạn mức
- Tự động nhận diện Gemma để sửa lỗi **Error 400** (Developer instruction support)

### 🔧 Sửa lỗi
- Khôi phục logic tìm kiếm Redmine ổn định (Chuẩn hóa normalizeLoose & fallback search)
- Sửa lỗi hiển thị "Model ma" và cải thiện UI nút chọn model (màu sắc rõ ràng hơn)
- Vá các lỗi cú pháp HTML trong trang Options và dọn dẹp code thừa (`fallbackModel`)


## [1.8.0] - 2026-04-23

### ✨ Tính năng mới
- Cải thiện giao diện Options với collapsible sections độc lập (Redmine, Backlog, Primary AI, Fallback AI)
- **Multiple Gemini Models** hiển thị dạng button clickable, chọn/bỏ bằng click
- **Multiple Gemini Keys** gộp chung với Multiple Models trong section Primary AI
- Default chọn 5 models đầu tiên khi chưa có cấu hình

### 🔄 Thay đổi
- Xóa dropdown Model cũ (trùng lặp với Multiple Models)
- Fallback provider mặc định là "none" (không dùng dự phòng)
- Loại bỏ Gemma 12B khỏi danh sách model
- Tối ưu margin/padding: `.field` margin-bottom: 0, `.grid` gap: 0
- Đưa Custom Fields vào trong section Redmine

### 🚀 Cải thiện hiệu năng
- Cải thiện hiệu năng dịch AI bằng caching layer cho settings và Redmine issue lookups
- Tối ưu batch translation bằng cách giảm API calls và message overhead
- Default Modal UI ở tab "Preview" để trải nghiệm mượt mà hơn
- Cải thiện Redmine formatting trong preview (Headings, Tables, Lists, `{{collapse}}` macro)
- Refactor AI service để xử lý Gemma models bằng cách merge system instructions vào user prompts
- Ổn định cấu hình "Tứ trụ" AI models (Gemini 3.1 Flash Lite, Gemma 3/4)

### 🔧 Sửa lỗi
- Sửa logic load models mặc định khi không có cấu hình
- Clean up code thừa (primaryModelSelect, initialization duplicate)


## [1.7.2] - 2026-04-22
- **✨ Added**:
  - Thêm lệnh `npm run bump` để tự tăng patch version và đồng bộ `manifest.json` với `package.json`.
  - Thêm cơ chế tạo `stub entry` tự động trong `CHANGELOG.md` khi bump sang version mới.
  - Thêm script `check:version-sync` để kiểm tra đồng bộ version giữa `manifest.json` và `package.json`.
  - Thêm **Multiple Gemini Models** trong Options (tương tự Multiple Keys), hỗ trợ nhập tối đa 5 model IDs, random chọn model khi gọi API để tăng throughput khi bị rate limit.
  - Cập nhật danh sách **Gemini models** lên series 2.5: `gemini-2.5-flash-lite` (RPM 15), `gemini-2.5-flash` (RPM 10), `gemini-2.5-pro` (RPM 5).
  - Cải thiện AI fallback: xử lý thêm lỗi 503, "high demand", "try again later" và cross-provider retry.
- **🔄 Changed**:
  - Đổi màu giao diện từ đỏ (#c93b2f) sang xanh (#2563eb) cho đồng nhất với thiết kế Cyan-Flow.
  - Primary Provider cố định là Gemini để đảm bảo chất lượng dịch mặc định.
- **🔧 Fixed**:
  - Khắc phục rủi ro CI/CD tiếp tục dùng version cũ khi `package.json` đã tăng nhưng `manifest.json` chưa được cập nhật.
  - Thêm bước fail-fast trong workflow để chặn build/release khi version giữa các file metadata bị lệch.
- **📝 Docs**:
  - Loại bỏ version hardcoded khỏi `README.md` để giảm nguy cơ lệch version giữa tài liệu và artifact release.
  - Cập nhật `.skills/agent_workflow.md` và `DEVELOPMENT.md` để xác định rõ `manifest.json` là source of truth cho version phát hành.

## [1.7.1] - 2026-04-22
- **✨ Added**:
  - Thêm `qwen/qwen3-32b` vào danh sách model của **Groq** dưới dạng lựa chọn preview cho tác vụ đa ngôn ngữ.
- **🔄 Changed**:
  - Curate lại danh sách model của **Groq** và **Cerebras** theo hướng ưu tiên chất lượng dịch Nhật -> Việt.
  - Loại bỏ các model `8B` khỏi dropdown để tránh chọn các model cho chất lượng dịch không ổn định.
- **🔧 Fixed**:
  - Sửa model ID của **Cerebras Qwen** theo docs mới thành `qwen-3-235b-a22b-instruct-2507` để tránh lỗi gọi API sai model.

## [1.7.0] - 2026-04-22
- **✨ Added**:
  - Thêm **Groq** làm lựa chọn cho cả AI chính và AI dự phòng.
  - Bổ sung cấu hình **Multiple Gemini Keys** trong trang Options, hỗ trợ nhập tối đa 10 key và random chọn key để giảm khả năng bị rate limit.
  - Thêm chế độ **toggle preview** trong modal để chuyển nhanh giữa dạng text editor và HTML preview.
  - Thêm khối nhập **Groq API Key** cho cả primary và fallback provider.
  - Bổ sung nút `+ Thêm Key` để nhập nhanh danh sách Gemini API keys nhiều dòng.
- **🔄 Changed**:
  - Điều chỉnh lại bố cục form migrate: đưa `Target Version` và `Due Date` lên cùng một hàng, tách `Tracker` và `Priority` sang hàng riêng để dễ thao tác hơn.
  - Hoàn thiện dropdown model cho **Groq** với danh sách model được curate theo ưu tiên dịch Nhật -> Việt.
  - Cập nhật lại danh sách **Cerebras** theo docs mới, bao gồm sửa đúng model ID của Qwen preview.
- **🔧 Fixed**:
  - Mở rộng validate cấu hình và luồng đọc settings để hỗ trợ đầy đủ `geminiApiKeys` và `groqApiKey`.
  - Cải thiện logic quét attachment từ comment/changelog của Backlog để nhận diện file ổn định hơn.
  - Nới giới hạn chuẩn hóa xuống còn tối đa 2 dòng trống liên tiếp, giúp giữ khoảng cách đoạn văn tốt hơn trong Markdown preview/gửi sang Redmine.

## [1.6.1] - 2026-04-21
- **✨ Added**:
  - Thêm Tên người tạo và Thời gian tạo comment vào đầu mỗi bản ghi gửi sang Redmine.
  - Tích hợp trường Target Version trong Modal Migrate, tự động map từ Milestone của Backlog.
  - Triển khai cơ chế "Look-Ahead" để gộp các file media được upload ở các comment tiếp theo vào comment chính.
  - Tự động tìm và gộp file đính kèm từ comment sau nếu tên file được nhắc đến trong văn bản comment trước.
- **🔄 Changed**:
  - Chuyển Gemini sang làm AI chính (Primary) và Cerebras làm AI dự phòng (Fallback) để tối ưu chất lượng dịch thuật ban đầu.
  - Cập nhật model mặc định:
    - Gemini: Gemini 3.1 Flash Lite.
    - Cerebras: GPT OSS 120B.
  - Giá trị mặc định cho Due Date được tính là 3 ngày làm việc tiếp theo, bỏ qua Thứ Bảy và Chủ Nhật.
  - AI tự động nhận diện và trả về định dạng 「Nội dung gốc」 (Bản dịch) cho các thuật ngữ quan trọng hoặc nội dung trong ngoặc vuông Nhật Bản.
- **🔧 Fixed**:
  - Khắc phục lỗi không hiển thị trạng thái "Saved" khi nhập Cerebras API Key.
  - Sửa lỗi mất dòng trống trong comment, đảm bảo giữ lại khoảng trắng hợp lý giữa các đoạn văn.
  - Sửa lỗi hiển thị Ordered List và Blockquotes để khớp hoàn toàn với hiển thị của Redmine.
  - Đảm bảo mọi đường dẫn tài liệu được render dạng link click được thay vì chỉ hiển thị text.
  - Fix toàn bộ lỗi linting và parsing error trong `src/redmine_content.js` và `src/modules/services/report-log-time.js`.
  - Tối ưu hóa khai báo global variables để tương thích với ESLint.

## [1.6.0] - 2026-04-20
- **✨ Added**:
  - Thêm hiệu ứng làm mờ và vòng xoay (Spinner) khi đang di chuyển dữ liệu để tránh thao tác nhầm và cung cấp phản hồi trực quan.
  - Thêm nút **🔄 Đồng bộ Project** giúp cập nhật danh sách dự án từ Redmine bất cứ lúc nào kèm trạng thái hiển thị.
- **🔄 Changed**:
  - Tự động đóng Modal sau khi nhấn "Xem trên Redmine" để làm gọn giao diện người dùng.
  - Việt hóa và làm đẹp khu vực Logs với các tác vụ **📥 Xuất File Lỗi** và **🗑️ Xóa Lịch Sử Lỗi**.
  - Triển khai cơ chế Cache đính kèm (Deduplication) để tránh tải lên lặp lại cùng một tệp tin trong một phiên làm việc.
- **🔧 Fixed**:
  - Xử lý triệt để lỗi AI làm sai định dạng ảnh bằng cơ chế Marker Recovery.
  - Nhận diện Marker linh hoạt hơn với regex chấp nhận các biến thể có dấu cách dư thừa.
  - Khắc phục lỗi hiển thị trường Due Date bị tràn dòng hoặc bọc dòng không mong muốn.

## [1.5.1] - 2026-04-19
- **🔧 Fixed**:
  - Sửa một số lỗi kỹ thuật trong mã nguồn để giúp code sạch hơn, hoạt động ổn định và dễ bảo trì hơn trong tương lai.

## [1.5.0] - 2026-04-19
- **✨ Added**:
  - Khi gặp lỗi cấu hình như thiếu API key, extension sẽ hiển thị thông báo lỗi rõ ràng kèm link trực tiếp đến trang Options.
  - Nhấp vào biểu tượng extension trên thanh công cụ sẽ mở thẳng trang Options để cấu hình nhanh hơn.
- **🔄 Changed**:
  - Đổi tên extension thành **B2R** cho ngắn gọn và dễ nhớ.

## [1.4.7] - 2026-04-19
- **✨ Added**:
  - Bổ sung cơ chế tự động đồng bộ API Key giữa các provider nếu dùng chung một loại như Gemini hoặc Cerebras.
- **🔄 Changed**:
  - Hợp nhất khối cấu hình Redmine (Domain, API Key, Project, Custom Fields) vào một khung giao diện đồng nhất trong trang Options.
  - Tối ưu logic hiển thị nút Migrate Issue và tự động hóa việc xác định ID các trường Custom Fields của Redmine.

## [1.4.6] - 2026-04-18
- **🚀 CI/CD**:
  - Chuyển đổi sang cơ chế OAuth2 Refresh Token để khắc phục lỗi quota của Service Account trên Google Drive.

## [1.4.5] - 2026-04-18
- **✨ Added**:
  - Hỗ trợ đính kèm Video (`.mp4`, `.mov`, `.webm`) và các loại tệp tin khác như `.pdf`, `.zip`.
  - Video được hiển thị bằng trình phát nội bộ trên Redmine.
- **🔄 Changed**:
  - Nâng cấp hệ thống quét đính kèm tự động từ phần Changelog của Backlog.
  - Khôi phục và bổ sung đầy đủ hướng dẫn lấy API key trong trang Options.
- **🔧 Fixed**:
  - Fix toàn bộ lỗi linting, chuẩn hóa code style và bổ sung quy trình `npm run lint` bắt buộc vào Agent Workflow.

## [1.4.4] - 2026-04-18
- **🔧 Fixed**:
  - Điều chỉnh cấu trúc thư mục trong bản build để khớp với Manifest, giúp extension có thể cài đặt và chạy bình thường.

## [1.4.3] - 2026-04-18
- **✨ Added**:
  - Thêm Qwen 3 235B và GPT OSS 120B vào danh sách model của Cerebras để thay thế model Llama 70B bị giới hạn trên Free Tier.
- **🔄 Changed**:
  - Chuyển Primary Model mặc định về Llama 3.1 8B để tránh lỗi 404.

## [1.4.2] - 2026-04-18
- **🔄 Changed**:
  - Chuyển model chính mặc định sang Llama 3.1 70B để đảm bảo chất lượng dịch thuật tốt nhất.
  - Thêm quy tắc nghiêm ngặt để AI không làm thay đổi tag ảnh `[[TB_IMG:id]]` và code blocks.
- **🔧 Fixed**:
  - Mở rộng quyền truy cập và gửi kèm session cookies giúp hiển thị ảnh đầy đủ trên Redmine.

## [1.4.1] - 2026-04-18
- **🔄 Changed**:
  - Đặt Llama 3.1 70B (Cerebras) làm model chính và Gemma 3 27B IT (Gemini) làm model dự phòng.
  - Nâng cấp prompt và logic để giữ nguyên các khối code (```)
- **📝 Docs**:
  - Viết lại Changelog súc tích và cập nhật README với thông tin model mới.

## [1.4.0] - 2026-04-18
- **✨ Added**:
  - Thêm nút tạo nhanh Issue Redmine từ Header của Backlog.
  - Cho phép chọn nhà cung cấp AI chính/phụ độc lập với logic tự động failover.
- **🔄 Changed**:
  - Áp dụng giao diện Cyan-Flow hiện đại, tùy chỉnh linh hoạt và tự động tải tiêu đề Redmine.
  - Tái cấu trúc theo hướng service-based để dễ bảo trì.

## [1.3.0] - 2026-04-18
- **✨ Added**:
  - Di chuyển tất cả bình luận cùng lúc với cơ chế gửi tuần tự lên Redmine.
  - Tự động lấy danh sách Dự án, Tracker, Priority từ Redmine.

## [1.2.x] - 2026-04-17
- **✨ Added**:
  - Thiết lập hệ thống kỹ năng cho AI Agent và chuẩn hóa đánh số phiên bản.
- **🔧 Fixed**:
  - Sửa lỗi hiển thị Blockquote và định dạng tag tên người dùng.
  - Khắc phục lỗi UI liên quan đến hiệu ứng hover và hiển thị Modal.

## [1.1.0] - 2026-04-16
- **✨ Added**:
  - Thêm bộ chọn model và cải thiện tìm kiếm Issue Redmine.
- **🔒 Security**:
  - Mã hóa API key khi lưu trữ cục bộ.

## [1.0.1] - 2026-04-15
- **✨ Added**:
  - Phiên bản đầu tiên: dịch tiếng Nhật sang Việt và đồng bộ Backlog → Redmine.
