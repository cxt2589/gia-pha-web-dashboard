# Quy tắc tìm kiếm alias/tên địa phương cho AI gia phả họ Cao

## 1. Mục tiêu

Người dùng có thể hỏi không đầy đủ tên, ví dụ:

- “Lạng là ai?”
- “Cụ Lạng là Thủy Tổ đúng không?”
- “Thuần thuộc đời nào?”
- “Cụ Thuật là ai?”

Hệ thống vẫn phải tìm được trong kho tri thức nếu dữ liệu có trên VPS/database.

## 2. Chuẩn hóa câu hỏi

Khi search, tạo nhiều khóa:

```txt
Bản gốc:       Cụ Cao Đình Lạng
lowercase:     cụ cao đình lạng
bỏ kính xưng:  cao đình lạng
không dấu:     cao dinh lang
short name:    lạng / lang
```

Danh sách kính xưng nên bỏ khi match:

```txt
cụ, ông, bà, bác, chú, cô, anh, chị, cụ tổ
```

Nhưng không xóa khỏi câu trả lời; chỉ xóa để search. Riêng “Cao Tổ” và “Thủy Tổ” không được bỏ khỏi biến thể chính, vì đây là alias/danh xưng quan trọng:

```txt
User: “Cao Tổ là ai?”
System: giữ biến thể “cao tổ/cao to” để ưu tiên map về Cao Đình Thuật.

User: “Thủy Tổ là ai?”
System: giữ biến thể “thủy tổ/thuy to” để ưu tiên map về Cao Đình Lạng.
```

## 3. Alias cần lưu cho mỗi người

Mỗi entity/person nên có:

```json
{
  "canonical_name": "Cao Đình Lạng",
  "display_title": "cụ Cao Đình Lạng - Thủy Tổ",
  "aliases": [
    "Cao Đình Lạng",
    "Nhiêu Lạng",
    "Lạng",
    "cụ Lạng",
    "ông Lạng",
    "cao dinh lang",
    "nhieu lang",
    "lang"
  ],
  "han_nom_aliases": ["高廷兩", "高廷諒"],
  "han_nom_status": "needs_family_confirmation"
}
```

## 4. Ưu tiên match

1. Trùng tên đầy đủ có dấu.
2. Trùng tên đầy đủ không dấu.
3. Trùng alias/tên thường gọi.
4. Trùng Hán/Nôm.
5. Trùng tên riêng ngắn, ví dụ “Lạng”, “Thuần”.
6. Fuzzy match.

## 5. Xử lý tên ngắn

Nếu tên ngắn là duy nhất:

```txt
User: “Lạng là ai?”
System: tìm thấy duy nhất Cao Đình Lạng → trả lời trực tiếp.
```

Nếu tên ngắn không duy nhất:

```txt
User: “Thuần là ai?”
System: tìm thấy nhiều người có tên Thuần → hỏi lại:
“Trong kho tri thức có nhiều người tên Thuần. Bạn muốn hỏi Cao Văn Thuần đời X hay người khác?”
```

Không được tự chọn người có score cao hơn nếu độ chênh không rõ.

Nếu người dùng nhớ thiếu họ/tên đệm hoặc nhớ sai gần đúng:

```txt
User: “Thuần là ai?”
System: search tên riêng, alias và fuzzy. Nếu chỉ có một ứng viên rõ ràng, trả lời “tôi tìm thấy người phù hợp nhất là...”. Nếu nhiều ứng viên, đưa danh sách để người dùng chọn.
```

Tên “Thuần” trong tài liệu này là ví dụ kỹ thuật cho cơ chế gợi ý, không tự động trở thành dữ liệu nhân vật đã xác nhận.

## 6. Trả lời khi không có dữ liệu

Nếu không tìm thấy chunk/entity phù hợp:

```txt
Chưa có dữ liệu xác minh trong kho tri thức hiện tại.
```

Không được tự bịa thêm quan hệ hoặc thông tin.

## 7. Gợi ý kỹ thuật

Nên có bảng hoặc JSON alias riêng:

```sql
CREATE TABLE IF NOT EXISTS person_aliases (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  alias_ascii TEXT NOT NULL,
  alias_type TEXT,
  confidence TEXT DEFAULT 'source_text',
  status TEXT DEFAULT 'active'
);
```

Nếu chưa có bảng persons chuẩn, có thể lưu alias trong `entity_refs_json` của `knowledge_chunks` và tạo thêm bảng phụ sau.
