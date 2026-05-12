# Changelog - Backlog2Redmine

## [1.8.06] - 2026-05-11
### Added
- Thêm regex để phân tách notes trong modal, cải thiện parsing cho batch notes
- Thêm hỗ trợ multi-select cho fallback models và keys trong trang Options
- Thêm các function quản lý provider models và keys với mã hóa/giải mã
### Changed
- Cập nhật options.html: xóa dropdown model cũ, thêm cấu hình fallback Gemini mới
- Cải thiện UX với cập nhật UI động dựa trên provider và models được chọn
### Refactored
- Refactor logic xử lý notes trong openConfirmModal để sử dụng function parsing mới
- Cải thiện options.js để hỗ trợ multi-select và render models/keys được chọn

## [1.8.05] - 2026-05-08
### Removed
- Xóa bỏ hoàn toàn chức năng "Đồng bộ tất cả comments sang Backlog" do lỗi hiển thị và không cần thiết ở thời điểm hiện tại

## [1.8.04] - 2024-05-24
### Added
- Thêm hỗ trợ cho các mô hình "Generative Enhanced Models" (GEM) tùy chỉnh
- Tạo mục cấu hình riêng cho "Custom GEM", cho phép chỉ định API endpoint và API key
### Fixed
- Sửa lỗi nghiêm trọng trong chức năng "Migrate Issue" khi xử lý file đính kèm
- Cải thiện ghi log lỗi cho chức năng migrate với đầy đủ payload
- Khắc phục lỗi lưu API key, ngăn lưu giá trị ******
### Refactored
- Dọn dẹp và tái cấu trúc file background.js để loại bỏ code trùng lặp
### Chore
- Sửa tất cả lỗi và cảnh báo từ ESLint

## [1.8.03] - 2024-04-26
### Added
- Flow Redmine → Backlog: đồng bộ ngược từ Redmine sang Backlog
- Attachment handling: tự động extract và upload file đính kèm
- Batch sync: nút "Đồng bộ tất cả comments" với progress tracking
- Smart @mentions với dropdown gợi ý users khi gõ @
- Project-specific user loading từ API /api/v2/projects/{key}/users
- Lazy user loading chỉ khi nhập issue key hợp lệ
### Fixed
- Sửa lỗi userId: null khiến không tag được users
- Sửa lỗi modal không hiển thị user suggestions khi gõ @
- Sửa lỗi auto-load users với project key sai
- Thêm null checks cho user data
### Changed
- Không auto-load users khi mở modal
- Hiển thị hint rõ ràng khi chưa có issue key
- Cải thiện UX: chỉ hiển thị dropdown khi có data users hợp lệ
### Docs
- Cập nhật README.md với hướng dẫn flow Redmine → Backlog

## [1.8.02] - 2024-04-23
### Improved
- Tối ưu translateBatch với Promise.all batch 5
- Thêm cleanup handlers để tránh memory leak
- Giới hạn MutationObserver scope vào container cụ thể
- Thêm projects caching 5 phút và debounce 500ms
- Thêm debounce và throttle utility functions
### Fixed
- Sửa reportProjectId dropdown không populate data
- Sửa lỗi status message bị mất sau khi lưu cấu hình
### Changed
- Chuẩn hóa code style: đổi single quotes sang double quotes

## [1.8.01] - 2024-04-23
### Added
- Triển khai danh sách "Tứ trụ" AI mạnh mẽ (Gemma 3/4, Gemini 3.1)
- Cơ chế Load Balancing: xáo trộn random Model & Key
- Tự động nhận diện Gemma để sửa lỗi Error 400
### Fixed
- Khôi phục logic tìm kiếm Redmine ổn định
- Sửa lỗi hiển thị "Model ma" và cải thiện UI chọn model
- Vá lỗi cú pháp HTML trong trang Options

## [1.8.00] - 2024-04-23
### Added
- Cải thiện giao diện Options với collapsible sections
- Multiple Gemini Models dạng button clickable
- Multiple Gemini Keys gộp chung với Models
- Default chọn 5 models đầu tiên khi chưa có cấu hình
### Changed
- Xóa dropdown Model cũ
- Fallback provider mặc định là "none"
- Loại bỏ Gemma 12B khỏi danh sách model
### Improved
- Tối ưu margin/padding
- Đưa Custom Fields vào section Redmine
- Cải thiện hiệu năng AI với caching layer
- Tối ưu batch translation
- Cải thiện Redmine formatting trong preview
- Refactor AI service cho Gemma models
- Ổn định cấu hình "Tứ trụ" AI models
### Fixed
- Sửa logic load models mặc định khi không có cấu hình
- Clean up code thừa

## [1.7.02] - 2024-04-22
### Added
- Thêm lệnh npm run bump để tự tăng patch version
- Tự động tạo stub entry trong CHANGELOG.md khi bump
- Script check:version-sync kiểm tra đồng bộ version
- Multiple Gemini Models trong Options
- Cập nhật danh sách Gemini models lên series 2.5
- Cải thiện AI fallback cho lỗi 503
### Changed
- Đổi màu giao diện từ đỏ sang xanh cho đồng nhất Cyan-Flow
- Primary Provider cố định là Gemini
### Fixed
- Khắc phục rủi ro CI/CD dùng version cũ
- Thêm fail-fast trong workflow
### Docs
- Loại bỏ version hardcoded khỏi README.md
- Cập nhật .skills/agent_workflow.md và DEVELOPMENT.md

## [1.7.01] - 2024-04-22
### Added
- Thêm qwen/qwen3-32b vào danh sách model của Groq
### Changed
- Curate lại danh sách model Groq và Cerebras
- Loại bỏ model 8B khỏi dropdown
### Fixed
- Sửa model ID của Cerebras Qwen thành qwen-3-235b-a22b-instruct-2507

## [1.7.00] - 2024-04-22
### Added
- Thêm Groq làm lựa chọn cho cả AI chính và dự phòng
- Multiple Gemini Keys trong trang Options
- Toggle preview trong modal
- Khối nhập Groq API Key cho cả primary và fallback
- Nút + Thêm Key để nhập nhanh Gemini keys
### Changed
- Điều chỉnh bố cục form migrate
- Hoàn thiện dropdown model Groq
- Cập nhật danh sách Cerebras theo docs mới
### Fixed
- Mở rộng validate cấu hình và luồng đọc settings
- Cải thiện logic quét attachment
- Nới giới hạn chuẩn hóa xuống 2 dòng trống liên tiếp

## [1.6.01] - 2024-04-21
### Added
- Thêm tên người tạo và thời gian tạo comment vào bản ghi
- Tích hợp trường Target Version trong Modal Migrate
- Cơ chế "Look-Ahead" gộp file media
- Tự động tìm và gộp file đính kèm
### Changed
- Chuyển Gemini làm AI chính và Cerebras làm fallback
- Cập nhật model mặc định: Gemini 3.1 Flash Lite, Cerebras GPT OSS 120B
- Giá trị mặc định Due Date là 3 ngày làm việc tiếp theo
- AI tự động nhận diện định dạng べ cavity original Japanese
### Fixed
- Sửa lỗi không hiển thị "Saved" khi nhập Cerebras API Key
- Sửa lỗi mất dòng trống trong comment
- Sửa lỗi Ordered List và Blockquotes
- Đảm bảo đường dẫn dạng link click được
- Fix linting và parsing error
- Tối ưu khai báo global variables

## [1.6.00] - 2024-04-20
### Added
- Hiệu ứng làm mờ và Spinner khi đang migrate
- Nút Đồng bộ Project cập nhật danh sách dự án
### Changed
- Tự động đóng Modal sau khi nhấn "Xem trên Redmine"
- Việt hóa và làm đẹp khu vực Logs
- Cache attachment (Deduplication)
### Fixed
- Xử lý triệt để lỗi AI làm sai định dạng ảnh
- Nhận diện Marker linh hoạt hơn
- Khắc phục lỗi hiển thị Due Date tràn dòng

## [1.5.01] - 2024-04-19
### Fixed
- Sửa lỗi kỹ thuật trong mã nguồn để code sạch hơn

## [1.5.00] - 2024-04-19
### Added
- Thông báo lỗi cấu hình rõ ràng kèm link Options
- Nhấp vào biểu tượng extension mở thẳng trang Options
### Changed
- Đổi tên extension thành B2R

## [1.4.07] - 2024-04-19
### Added
- Cơ chế tự động đồng bộ API Key giữa các provider
### Changed
- Hợp nhất khối cấu hình Redmine vào giao diện đồng nhất
- Tối ưu logic hiển thị nút Migrate Issue

## [1.4.06] - 2024-04-18
### Improved
- Chuyển sang OAuth2 Refresh Token để khắc phục quota Service Account

## [1.4.05] - 2024-04-18
### Added
- Hỗ trợ đính kèm Video (.mp4, .mov, .webm) và các loại tệp tin
- Video hiển thị bằng trình phát nội bộ
### Changed
- Nâng cấp hệ thống quét attachment tự động
- Khôi phục và bổ sung hướng dẫn lấy API key
### Fixed
- Fix toàn bộ lỗi linting

## [1.4.04] - 2024-04-18
### Fixed
- Điều chỉnh cấu trúc thư mục trong bản build khớp với Manifest

## [1.4.03] - 2024-04-18
### Added
- Thêm Qwen 3 235B và GPT OSS 120B vào danh sách Cerebras
### Changed
- Chuyển Primary Model mặc định về Llama 3.1 8B

## [1.4.02] - 2024-04-18
### Changed
- Chuyển model chính mặc định sang Llama 3.1 70B
- Thêm quy tắc AI không thay đổi tag ảnh và code blocks
### Fixed
- Mở rộng quyền truy cập và gửi kèm session cookies

## [1.4.01] - 2024-04-18
### Changed
- Đặt Llama 3.1 70B làm model chính và Gemma 3 27B IT làm fallback
- Nâng cấp prompt và logic giữ nguyên code blocks
### Docs
- Viết lại Changelog súc tích và cập nhật README

## [1.4.00] - 2024-04-18
### Added
- Nút tạo nhanh Issue Redmine từ Header của Backlog
- Chọn nhà cung cấp AI chính/phụ độc lập với failover
### Changed
- Giao diện Cyan-Flow hiện đại
- Tái cấu trúc service-based

## [1.3.00] - 2024-04-18
### Added
- Di chuyển tất cả bình luận cùng lúc
- Tự động lấy danh sách Dự án, Tracker, Priority từ Redmine

## [1.2.00] - 2024-04-17
### Added
- Thiết lập hệ thống kỹ năng cho AI Agent
### Fixed
- Sửa lỗi hiển thị Blockquote và định dạng tag tên người dùng
- Khắc phục lỗi UI hover và modal

## [1.1.00] - 2024-04-16
### Added
- Thêm bộ chọn model và cải thiện tìm kiếm Issue Redmine
### Security
- Mã hóa API key khi lưu trữ cục bộ

## [1.0.01] - 2024-04-15
### Added
- Phiên bản đầu tiên: dịch tiếng Nhật sang Việt và đồng bộ Backlog → Redmine
