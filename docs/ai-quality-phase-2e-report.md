# Phase 2E AI Quality Report

Generated at: 2026-05-30T21:35:10.890Z

## Summary

- Base URL: http://127.0.0.1:5196
- Commit target: a945e95 or newer
- Total cases: 14
- Passed: 14
- Failed: 0
- Knowledge status: sources=12, chunks=277, aliases=15, indexedSources=12

## Rules Checked

- Database/tree should stay higher priority than alias rules and TXT knowledge.
- Phase 2A alias rules must map Cao Dinh Thuat to Cao To and Cao Dinh Lang to Thuy To.
- Phase 2D TXT chunks must be retrieved for history, verification, and Han Nom questions.
- Missing anniversary dates must not be invented.
- Old sample Cao Ninh Binh/Cao Quy Cong/Cao Van Lam answers must not appear.

## Results

| Case | Pass | Knowledge | Sources | Reason |
|---|---:|---:|---:|---|
| alias-cao-to | PASS | 6 | 5 | Cao Dinh Thuat must be Cao To. |
| alias-thuy-to | PASS | 6 | 3 | Cao Dinh Lang must be Thuy To. |
| alias-cu-lang | PASS | 6 | 3 | ok |
| anniversary-lang-unverified | PASS | 6 | 2 | If no verified anniversary date exists, the AI must not invent one. |
| anniversary-thuat-unverified | PASS | 6 | 2 | ok |
| death-lang-unverified | PASS | 6 | 3 | ok |
| anniversary-moi-candidate | PASS | 7 | 1 | ok |
| grave-moi-candidate | PASS | 7 | 1 | ok |
| hometown-moi-candidate | PASS | 7 | 1 | ok |
| origin-cao-toc | PASS | 6 | 1 | ok |
| han-nom-docs | PASS | 3 | 1 | ok |
| admin-verification-points | PASS | 2 | 2 | ok |
| alias-thuan-unverified | PASS | 6 | 5 | Thuan is only an example/needs verification alias. |
| lang-is-not-cao-to | PASS | 6 | 3 | ok |

## Answer Previews

### alias-cao-to

Question: Cao Tổ là ai?

Answer: Cao Tổ trong kho tri thức hiện được map về cụ Cao Đình Thuật - Cao Tổ. Đời/generation kỹ thuật: 0. Khi trả lời về nhân vật này, không gọi cụ Cao Đình Thuật là Thủy Tổ.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 164)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 164)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 164)
- Cao Tộc Phả - Ngày sinh, ngày mất, quê quán, mộ chí (source_i2VHgoq43EvqUXwav81i9Vf7, score 164)

### alias-thuy-to

Question: Thủy Tổ là ai?

Answer: Thủy Tổ trong kho tri thức hiện được map về cụ Cao Đình Lạng - Thủy Tổ. Đời/generation kỹ thuật: 1. Nếu người dùng hỏi Lạng, cụ Lạng hoặc Nhiêu Lạng và không có nhân vật khác trùng tên, ưu tiên map về Cao Đình Lạng.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 140)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 140)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 140)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 140)

### alias-cu-lang

Question: cụ Lạng là ai?

Answer: Thủy Tổ trong kho tri thức hiện được map về cụ Cao Đình Lạng - Thủy Tổ. Đời/generation kỹ thuật: 1. Nếu người dùng hỏi Lạng, cụ Lạng hoặc Nhiêu Lạng và không có nhân vật khác trùng tên, ưu tiên map về Cao Đình Lạng.

Top search sources:
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 140)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 140)
- manual notes for knowledge base (source_sSxwso35MqnMoJt3MEI70vnR, score 122)
- entity alias role overrides (source_hRxzuV59T3L4NWoDvMoRIsEO, score 122)

### anniversary-lang-unverified

Question: ngày giỗ cụ Cao Đình Lạng là ngày nào?

Answer: Chưa tìm thấy dữ liệu xác minh trực tiếp về ngày giỗ của cụ Cao Đình Lạng - Thủy Tổ trong kho tri thức hiện tại. Các nguồn đã đối chiếu: Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR; Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh. Nếu trong database/lịch giỗ có bản ghi riêng, cần ưu tiên bản ghi đó. Nếu chưa có, không tự suy đoán ngày âm lịch/dương lịch từ tài liệu tham chiếu.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)

### anniversary-thuat-unverified

Question: ngày giỗ cụ Cao Đình Thuật là ngày nào?

Answer: Chưa tìm thấy dữ liệu xác minh trực tiếp về ngày giỗ của cụ Cao Đình Thuật - Cao Tổ trong kho tri thức hiện tại. Các nguồn đã đối chiếu: Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR; Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh. Nếu trong database/lịch giỗ có bản ghi riêng, cần ưu tiên bản ghi đó. Nếu chưa có, không tự suy đoán ngày âm lịch/dương lịch từ tài liệu tham chiếu.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)

### death-lang-unverified

Question: ngày mất cụ Cao Đình Lạng là ngày nào?

Answer: Chưa tìm thấy dữ liệu xác minh trực tiếp về ngày mất/tạ thế của cụ Cao Đình Lạng - Thủy Tổ trong kho tri thức hiện tại. Các nguồn đã đối chiếu: Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR; Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh; Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời. Nếu trong database/lịch giỗ có bản ghi riêng, cần ưu tiên bản ghi đó. Nếu chưa có, không tự suy đoán ngày âm lịch/dương lịch từ tài liệu tham chiếu.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 132)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)

### anniversary-moi-candidate

Question: ngày giỗ Cao Văn Mới là ngày nào?

Answer: Theo candidate trích xuất từ Cao Tộc Phả file 04, tôi tìm thấy: - Cao Văn Mới: ngày giỗ/ngày tạ thế âm lịch: Ngày mùng 10 tháng Bảy; ngày mất/tạ thế: Ngày mùng 10 tháng Bảy, năm Âm lịch; ngày/năm sinh: Giáp Dần – 1874; quê quán: thôn Giáp Ba, xã Quỹ Đê, huyện Trực Ninh, tỉnh Nam Định; mộ chí: [Trang 34] Mộ chí của ông bà: [Trang 34] Phần mộ của ông và các bà đều đã được quy tụ về Lăng Cao Tổ họ Cao ở cánh đồng Hạ Quan xã Trực Hưng, huyện Trực Ninh chu đáo.; chưa khớp chắc với cây phả. Nguồn: Cao Tộc Phả - Ngày sinh

Top search sources:
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)

### grave-moi-candidate

Question: mộ chí Cao Văn Mới ở đâu?

Answer: Theo candidate trích xuất từ Cao Tộc Phả file 04, tôi tìm thấy: - Cao Văn Mới: ngày giỗ/ngày tạ thế âm lịch: Ngày mùng 10 tháng Bảy; ngày mất/tạ thế: Ngày mùng 10 tháng Bảy, năm Âm lịch; ngày/năm sinh: Giáp Dần – 1874; quê quán: thôn Giáp Ba, xã Quỹ Đê, huyện Trực Ninh, tỉnh Nam Định; mộ chí: [Trang 34] Mộ chí của ông bà: [Trang 34] Phần mộ của ông và các bà đều đã được quy tụ về Lăng Cao Tổ họ Cao ở cánh đồng Hạ Quan xã Trực Hưng, huyện Trực Ninh chu đáo.; chưa khớp chắc với cây phả. Nguồn: Cao Tộc Phả - Ngày sinh

Top search sources:
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 96)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 96)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 96)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 96)

### hometown-moi-candidate

Question: quê quán Cao Văn Mới ở đâu?

Answer: Theo candidate trích xuất từ Cao Tộc Phả file 04, tôi tìm thấy: - Cao Văn Mới: ngày giỗ/ngày tạ thế âm lịch: Ngày mùng 10 tháng Bảy; ngày mất/tạ thế: Ngày mùng 10 tháng Bảy, năm Âm lịch; ngày/năm sinh: Giáp Dần – 1874; quê quán: thôn Giáp Ba, xã Quỹ Đê, huyện Trực Ninh, tỉnh Nam Định; mộ chí: [Trang 34] Mộ chí của ông bà: [Trang 34] Phần mộ của ông và các bà đều đã được quy tụ về Lăng Cao Tổ họ Cao ở cánh đồng Hạ Quan xã Trực Hưng, huyện Trực Ninh chu đáo.; chưa khớp chắc với cây phả. Nguồn: Cao Tộc Phả - Ngày sinh

Top search sources:
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 114)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 114)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 114)
- Cao Tộc Phả - Phả hệ và danh sách nhân vật theo đời (source_WYYX50YpozEH5CdTace2dGi1, score 114)

### origin-cao-toc

Question: họ Cao có nguồn gốc từ đâu?

Answer: Theo kho tri thức local, tôi tìm thấy các đoạn liên quan sau: - Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh: hư sau: [Trang 1] 1- Gìn giữ mồ mả của Tổ Tiên. [Trang 1] Tại sao phải giữ gìn mồ mả của tổ tiên? Người đời thường nói : “Giữ như giữ mảTổ”. Điều này không thể dễ dàng mà hiểu ngay được! Tất cả chỉ biết rằng: nhân loại trên toàn thế giới, ‘từ Á sang Âu, từ Xưa tới Nay’, dân tộc nào cũng coi trọng mồ mả của Tổ Tiên, hoặc mồ mả người trị vì đất nước. Ví như Kim Tự Tháp là lăng mộ của vua Ai Cập c

Top search sources:
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 104)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 104)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 104)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 104)

### han-nom-docs

Question: tài liệu nào đang cần kiểm chứng Hán Nôm?

Answer: Tài liệu cần kiểm chứng Hán Nôm/admin xác minh đang được ưu tiên trong kho tri thức là: - Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR: ỏ đoạn lặp; kiểm chứng niên đại 1932, chức danh Tộc Biểu, Tiên Chỉ Đền Tây qua sắc/tư liệu thôn. Trung bình | Nạn đói Ất Dậu 1944-1945 | Tr. 23: “Nạn đói khủng khiếp tháng 3 năm Ất Dậu 1944-1945 ở Bắc Kỳ, hơn 2 triệu người dân Việt Nam chết đói, nặng nhất ở các tỉnh Nam Định, Thái Bình, Hà Nam, Hải Dương, Ninh Bình và Thanh Hóa. Dân Trại Đò cũng không thoát... [đã rút gọ

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 114)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 114)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 114)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 114)

### admin-verification-points

Question: có những điểm nào trong tài liệu cần admin xác minh?

Answer: Tài liệu cần kiểm chứng Hán Nôm/admin xác minh đang được ưu tiên trong kho tri thức là: - Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR: ính tài liệu cũng nghi ngờ không phải hàm chính quy triều đình. | Giữ nguyên trích dẫn gốc, nhưng thêm chú thích: 'cần kiểm chứng chức danh; chưa xác nhận trong hệ thống quan chế triều đình'. Rất cao | Cao Đình Lạng/Lượng: chữ Hán tên húy | Tr. 7: “ở đất này từ thời Nguyễn Thế Tổ-Gia Long ngũ niên-1807, đó là ông Cao Đình Lạng hoặc Lượng (高廷兩) hoặc (高廷諒). Nh... [đã rút g

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 96)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 96)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 96)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 86)

### alias-thuan-unverified

Question: Thuần là ai?

Answer: Tôi tìm thấy "Thuần" trong tài liệu Phase 2A như một ví dụ alias/tên ngắn cần gợi ý. Chưa có dữ liệu xác minh trong kho tri thức hiện tại. Vui lòng cung cấp thêm họ tên đầy đủ, đời, chi/ngành hoặc tài liệu đối chiếu để xác minh.

Top search sources:
- entity alias role overrides (source_hRxzuV59T3L4NWoDvMoRIsEO, score 122)
- search alias rules (source_bElifZ_E8tzg3NyG4ASg6Hmo, score 122)
- metadata examples (source_Z4Bp-JI96A2wfpzNg5XbD73f, score 122)
- README (source_yNF-1-ImWUUm7J6Rzwobijsj, score 122)

### lang-is-not-cao-to

Question: Cao Đình Lạng có phải Cao Tổ không?

Answer: Cao Tổ trong kho tri thức hiện được map về cụ Cao Đình Thuật - Cao Tổ. Đời/generation kỹ thuật: 0. Khi trả lời về nhân vật này, không gọi cụ Cao Đình Thuật là Thủy Tổ.

Top search sources:
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)
- Cao Tộc Phả - Điểm cần kiểm chứng, lỗi Hán/Nôm, lỗi OCR (source_M4sobpfDTlwXlpFfyExW_uzN, score 132)
- Cao Tộc Phả - Lịch sử, nguồn gốc, mốc thời gian, địa danh (source_9fI2EDwePIm8SPZEPnjyQeoU, score 132)

