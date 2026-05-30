-- SQL gợi ý để lưu ghi chú bổ sung vào kho tri thức.
-- KHÔNG chạy trực tiếp trên VPS trước khi schema Phase 2 được chốt.
-- Cần chỉnh lại tên bảng/cột theo migration thật của hệ thống.

INSERT INTO knowledge_sources (
  id, title, source_type, original_filename, content_hash,
  language, clan_scope, visibility, status,
  summary, tags_json, metadata_json, created_by, extracted_at, chunked_at
) VALUES (
  'ks_cao_manual_notes_alias_roles',
  'Ghi chú danh xưng, alias và xác nhận Hán Nôm cho AI gia phả họ Cao',
  'manual',
  '01_manual_notes_for_knowledge_base.txt',
  'manual_notes_alias_roles_v1',
  'vi',
  'cao_toc_phu_my',
  'admin',
  'ready',
  'Ghi chú bổ sung: Cao Đình Lạng gọi là Thủy Tổ; Cao Đình Thuật gọi là Cao Tổ; Hán Nôm nghi vấn cần dòng họ xác nhận; hỗ trợ tìm kiếm tên rút gọn/địa phương.',
  '["manual_note","alias","danh_xung","thuy_to","cao_to","han_nom_review"]',
  '{"source_confidence":"family_instruction","must_follow":true,"priority":"high","scope":"cao_toc_phu_my_ai_knowledge","clan_scope":"cao_toc_phu_my","system_scope":"ho_cao_giatochocao","domain":"giatochocao.site"}',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO knowledge_chunks (
  id, source_id, chunk_index, chunk_type,
  title, heading_path, content, content_norm, content_ascii,
  summary, tags_json, entity_refs_json, metadata_json
) VALUES (
  'kc_cao_manual_notes_alias_roles_001',
  'ks_cao_manual_notes_alias_roles',
  1,
  'manual_note',
  'Danh xưng bắt buộc và alias cho Cao Đình Lạng, Cao Đình Thuật',
  'GHI CHÚ BỔ SUNG > Danh xưng và alias',
  'Cụ Cao Đình Lạng phải gọi là Thủy Tổ. Cụ Cao Đình Thuật phải gọi là Cao Tổ. Một số tên Hán/Nôm nghi vấn chỉ được đánh dấu cần xác nhận từ dòng họ, không tự ý sửa. Hệ thống cần tìm được tên rút gọn hoặc tên địa phương như Lạng, Thuần; nếu trùng nhiều người thì hỏi lại hoặc đưa danh sách ứng viên, không đoán.',
  'cụ cao đình lạng phải gọi là thủy tổ. cụ cao đình thuật phải gọi là cao tổ. một số tên hán/nôm nghi vấn chỉ được đánh dấu cần xác nhận từ dòng họ, không tự ý sửa. hệ thống cần tìm được tên rút gọn hoặc tên địa phương như lạng, thuần; nếu trùng nhiều người thì hỏi lại hoặc đưa danh sách ứng viên, không đoán.',
  'cu cao dinh lang phai goi la thuy to. cu cao dinh thuat phai goi la cao to. mot so ten han/nom nghi van chi duoc danh dau can xac nhan tu dong ho, khong tu y sua. he thong can tim duoc ten rut gon hoac ten dia phuong nhu lang, thuan; neu trung nhieu nguoi thi hoi lai hoac dua danh sach ung vien, khong doan.',
  'Quy tắc bắt buộc về danh xưng, alias và xác nhận Hán/Nôm cho AI gia phả họ Cao.',
  '["manual_note","alias","danh_xung","thuy_to","cao_to","han_nom_can_xac_nhan"]',
  '[{"type":"person","canonical_name":"Cao Đình Lạng","required_title":"Thủy Tổ","generation":1,"aliases":["Nhiêu Lạng","Lạng","cụ Lạng","ông Lạng"]},{"type":"person","canonical_name":"Cao Đình Thuật","required_title":"Cao Tổ","generation":0,"aliases":["Thuật","cụ Thuật","Cao Tổ"]}]',
  '{"source_confidence":"family_instruction","must_follow":true,"priority":"high","scope":"cao_toc_phu_my_ai_knowledge","clan_scope":"cao_toc_phu_my","system_scope":"ho_cao_giatochocao","domain":"giatochocao.site","do_not_run_directly":true}'
);
