# Nhật ký thay đổi (Changelog)

## [1.4.4] - 2026-04-18
- **Sửa lỗi nghiêm trọng**: Điều chỉnh cấu trúc thư mục trong bản build để khớp với Manifest. Đã có thể cài đặt và chạy bình thường.

## [1.4.3] - 2026-04-18
- **Cập nhật Model Cerebras**: Thêm Qwen 3 235B (Smartest) và GPT OSS 120B để thay thế Llama 70B bị giới hạn trên Free Tier.
- **Ổn định hệ thống**: Chuyển Primary Model mặc định về Llama 3.1 8B để tránh lỗi 404.

## [1.4.2] - 2026-04-18
- **Nâng cấp Model**: Chuyển Model chính mặc định sang Llama 3.1 70B để đảm bảo chất lượng dịch thuật tốt nhất.
- **Sửa lỗi hình ảnh**: Mở rộng quyền truy cập và gửi kèm session cookies giúp hiển thị ảnh đầy đủ trên Redmine.
- **Củng cố Prompt**: Thêm quy tắc nghiêm ngặt để AI không làm thay đổi tag ảnh `[[TB_IMG:id]]` và code blocks.

## [1.4.1] - 2026-04-18
- **Model mặc định mới**: Llama 3.1 70B (Cerebras) làm chính, Gemma 3 27B IT (Gemini) làm dự phòng.
- **Bảo vệ mã nguồn**: Nâng cấp prompt và logic để giữ nguyên các khối code (```).
- **Tài liệu**: Viết lại Changelog súc tích và cập nhật README với thông tin model mới.

## [1.4.0] - 2026-04-18
- **Migrate Issue**: Thêm nút tạo nhanh Issue Redmine từ Header của Backlog.
- **AI nâng cao**: Cho phép chọn nhà cung cấp chính/phụ độc lập với logic tự động failover.
- **Giao diện (UI/UX)**: Theme Cyan-Flow hiện đại, tủy chỉnh linh hoạt và tự động tải tiêu đề Redmine.
- **Kiến trúc**: Tái cấu trúc theo hướng Service-based để dễ bảo trì.

## [1.3.0] - 2026-04-18
- **Dịch hàng loạt**: Di chuyển tất cả bình luận cùng lúc với cơ chế gửi tuần tự lên Redmine.
- **Tích hợp API**: Tự động lấy danh sách Dự án, Tracker, Priority từ Redmine.

## [1.2.x] - 2026-04-17
- Thiết lập hệ thống kỹ năng cho AI Agent và chuẩn hóa đánh số phiên bản.
- Sửa lỗi hiển thị Blockquote và định dạng tag tên người dùng.
- Khắc phục lỗi UI (hiệu ứng hover, hiển thị Modal).

## [1.1.0] - 2026-04-16
- Thêm bộ chọn model và cải thiện tìm kiếm Issue Redmine.
- Bảo mật: Mã hóa API key khi lưu trữ cục bộ.

## [1.0.1] - 2026-04-15
- Phiên bản đầu tiên: Dịch tiếng Nhật sang Việt và đồng bộ Backlog → Redmine.
