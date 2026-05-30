# Ghi chú triển khai nhanh trong backend Node/Express

## 1. Khi import/chunk tài liệu

Sau khi tách chunk, chạy thêm bước applyManualOverrides:

```js
function applyManualOverrides(entity) {
  if (entity.canonical_name === 'Cao Đình Lạng') {
    entity.required_title = 'Thủy Tổ';
    entity.generation = entity.generation ?? 1;
    entity.display_name = 'cụ Cao Đình Lạng - Thủy Tổ';
    entity.aliases = unique([...(entity.aliases || []), 'Nhiêu Lạng', 'Lạng', 'cụ Lạng', 'ông Lạng']);
  }

  if (entity.canonical_name === 'Cao Đình Thuật') {
    entity.required_title = 'Cao Tổ';
    entity.generation = entity.generation ?? 0;
    entity.lineage_position_note = 'Đứng trước Thủy Tổ trong thứ tự hiển thị/kỹ thuật; khi trả lời người dùng ưu tiên danh xưng Cao Tổ.';
    entity.display_name = 'cụ Cao Đình Thuật - Cao Tổ';
    entity.aliases = unique([...(entity.aliases || []), 'Thuật', 'cụ Thuật', 'Cao Tổ']);
  }

  return entity;
}
```

## 2. Khi search câu hỏi

```js
async function searchKnowledgeWithAliases(query, user) {
  const variants = buildSearchVariants(query);

  const aliasMatches = await searchPersonAliases(variants, user);
  const ftsMatches = await searchChunksFts(variants, user);

  const merged = rerank([...aliasMatches, ...ftsMatches]);

  if (!merged.length) {
    return {
      matches: [],
      fallback: 'Chưa có dữ liệu xác minh trong kho tri thức hiện tại.'
    };
  }

  if (isAmbiguousShortName(query, aliasMatches)) {
    return {
      matches: aliasMatches.slice(0, 5),
      needs_clarification: true,
      clarification_message: 'Trong kho tri thức có nhiều người có tên gần giống. Bạn muốn hỏi người nào?'
    };
  }

  return { matches: merged.slice(0, 8) };
}
```

Lưu ý triển khai:

- Không loại bỏ “Cao Tổ” hoặc “Thủy Tổ” khỏi biến thể search chính. Đây là alias ưu tiên.
- Có thể bỏ kính xưng như “cụ”, “ông”, “bà” trong biến thể phụ để match tên, nhưng vẫn phải giữ bản query gốc.
- Với tên thiếu/sai như “Thuần”, chỉ gợi ý ứng viên. Không tự khẳng định nếu chưa có dữ liệu xác minh trong phả đồ/tài liệu gốc.

## 3. Khi build answer prompt

Luôn đưa manual note vào đầu context nếu câu hỏi liên quan đến:

- Cao Đình Lạng
- Cao Đình Thuật
- Thủy Tổ
- Cao Tổ
- chữ Hán/Nôm
- tên rút gọn/alias

## 4. Không tự sửa Hán/Nôm

Các trường nghi vấn nên lưu như sau:

```json
{
  "han_nom_candidates": [
    {"value": "高廷兩", "status": "needs_family_confirmation"},
    {"value": "高廷諒", "status": "needs_family_confirmation"}
  ],
  "han_nom_confirmed": null
}
```

Khi dòng họ xác nhận, admin mới cập nhật:

```json
{
  "han_nom_confirmed": "高廷兩",
  "han_nom_status": "confirmed",
  "confirmed_by": "family_admin",
  "confirmed_at": "..."
}
```
