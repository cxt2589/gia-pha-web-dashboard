# Bộ ghi chú kỹ thuật cho AI gia phả họ Cao

Bộ file này dùng để lưu lại các quy tắc quan trọng do dòng họ cung cấp, phục vụ hệ thống AI gia phả họ Cao.

Các điểm chính:
- Cụ Cao Đình Lạng phải gọi là Thủy Tổ.
- Cụ Cao Đình Thuật phải gọi là Cao Tổ.
- Hệ thống có thể dùng generation/display_order để sắp xếp kỹ thuật, nhưng AI và giao diện ưu tiên danh xưng chuẩn: Cao Tổ / Thủy Tổ.
- Giữ scope gốc `cao_toc_phu_my_ai_knowledge`, đồng thời bổ sung `system_scope` để dung hợp với website `giatochocao.site`.
- Các lỗi/chữ Hán Nôm nghi vấn chỉ được đánh dấu cần xác nhận, không tự ý sửa khi chưa có xác nhận từ dòng họ.
- Tên địa phương, tên thường gọi, tên rút gọn như “Lạng”, “Thuần” vẫn cần tìm được bằng cơ chế alias/tên riêng, nhưng nếu trùng nhiều người thì phải hỏi lại hoặc hiển thị các kết quả có thể.
- Tên “Thuần” trong bộ file này là ví dụ về cơ chế gợi ý tên thiếu/sai, không phải dữ liệu nhân vật đã xác nhận nếu chưa có trong phả đồ hoặc tài liệu gốc.

Khuyến nghị dùng:
1. Import file `01_manual_notes_for_knowledge_base.txt` vào knowledge_sources như một tài liệu ghi chú nội bộ.
2. Đọc file `02_entity_alias_role_overrides.json` để seed alias/role override vào backend.
3. Dùng `03_search_alias_rules.md` làm spec cho hàm search local.
4. Dùng `04_ai_guardrail_prompt.txt` nối vào system/developer prompt của AI Gateway.
5. Dùng `05_metadata_examples.json` làm mẫu metadata cho chunk/entity.

Lưu ý: Đây là ghi chú bổ sung, không thay thế dữ liệu gia phả gốc trên VPS/database. File SQL trong bộ này chỉ là gợi ý seed, không chạy trực tiếp trước khi schema Phase 2 được chốt.
