# SỔ TAY QUẢN LÝ VÀ ĐỒNG BỘ GIA PHẢ HỌ CAO NINH BÌNH
## 📔 ĐẶC TẢ KỸ THUẬT GIAO DIỆN & HỆ THỐNG PHÂN QUYỀN TRUNG ƯƠNG

Tài liệu này đặc tả chi tiết mọi khía cạnh cấu trúc hiển thị, bảng mã màu, kiểu chữ (typography), tương tác chuyển động (motion/react), quy chuẩn phả đồ 55 cột và cách thức vận hành bộ máy kỹ thuật của ứng dụng **Gia Phả Họ Cao Ninh Bình**. Đây là tài liệu quy mẫu cao cấp để lập trình viên và quản trị viên có thể tái hiện hoặc phát triển hệ thống với độ chính xác tuyệt đối.

---

## 🎨 I. ĐẶC TẢ PHONG CÁCH QUY CHUẨN (VISUAL IDENTITY & DESIGN SYSTEM)

### 1. Phác Thảo Bảng Màu (Color Palette System)
Hệ thống sử dụng bảng màu **Imperial Heritage** mang đậm phong cách truyền thống, tôn nghiêm của hoàng gia Việt xưa kết hợp với sự hiện đại, tôn vinh gia thế linh thiêng dòng họ Cao Ninh Bình:

| Thành phần giao diện | Mã màu HEX / Lớp Tailwind CSS | Ứng dụng cụ thể trong Dashboard |
| :--- | :--- | :--- |
| **Tông màu Chủ đạo** | `#064e3b` / `bg-emerald-950` / `bg-emerald-900` | Phần đầu phong màn (Header), Sidebar và nút lệnh chính của gia tộc. |
| **Tông màu Chiêu dụ** | `#fef3c7` / `text-amber-100` / `text-amber-200` | Biểu thị chức vụ cao cấp, ngôi vương giả, các tước vị tôn kính. |
| **Nền Đệm Cơ sở** | `#fafaf9` / `bg-stone-50` / `bg-[#fcfbf9]` | Nền của các trang quản lý chính, bọc ngoài bế thế dòng họ. |
| **Đường viền/Phân cách**| `#e7e5e4` / `border-stone-200` / `border-stone-150` | Tạo lưới chia tách khối thông tin tộc nhân rõ ràng nhưng tinh tế. |
| **Tông Cụ Quy Tiên (Tử)** | `#991b1b` / `text-red-800` / `bg-red-50` | Hiển thị thông tin đối với thờ tự, kỵ nhật tiên phả, cụ đã quy tiên. |
| **Tông Trọng Nam (Đinh)**| `#1e3a8a` / `text-blue-900` / `bg-blue-50` | Biểu hiệu đối với quý nhân đinh trong tộc. |
| **Tông Tỷ Nữ (Nữ)** | `#9d174d` / `text-pink-800` / `bg-pink-50` | Biểu hiệu đối với khuê nữ, phụ nữ liên kết dòng họ. |

---

### 2. Thiết Kế Chữ Nghĩa (Typography System)
Toàn bộ văn phong biểu thị trên hệ thống được nhập quy mô từ ba bộ phông chữ tiêu chuẩn tạo nhịp điệu hài hòa:

1.  **Phông Chữ Tiên Tổ (Serif Text) — `Playfair Display`**:
    *   *Khai báo CSS:* `font-serif`
    *   *Ứng dụng:* Các tiêu đề chương, danh vị cao quý, tên các cụ tổ đời lớn, tiêu đề biểu mẫu trọng đại.
    *   *Cảm quan:* Trang trọng, tôn kính, lưu giữ hồn xưa nét cũ.
2.  **Phông Chữ Hành Chính (Sans-serif Text) — `Inter`**:
    *   *Khai báo CSS:* `font-sans`
    *   *Ứng dụng:* Nội dung kê khai, bảng biểu thống kê, thẻ thông tin đinh tộc, nhập liệu hành chính hàng ngày.
    *   *Cảm quan:* Hiện đại, tối giản, độ dễ dọc rất cao cả trên di động và máy tính.
3.  **Phông Chữ Thông Số Kỹ Thuật (Monospace Text) — `Fira Code`**:
    *   *Khai báo CSS:* `font-mono`
    *   *Ứng dụng:* Mã số cá nhân, số điện thoại liên lạc, các mốc năm sinh năm tử, điểm số đối chiếu bảng cột.
    *   *Cảm quan:* Chặt chẽ, định dạng số ngăn nắp, dễ đối chiếu hàng dọc.

---

### 3. Tương Tác & Chuyển Động (Transitions & Micro-Animations)
Trải nghiệm người dùng mượt mà, phản hồi lập tức nhưng không phô trương:
*   **Hi ứng Hover**: Các nút tương tác tích hợp lớp `transition-all duration-200 ease-in-out` giúp màu sắc biến chuyển nhẹ nhàng khi rê chuột.
*   **Bọc lót Sidebar trên Di Động**: Khi Sidebar mở ra trên thiết bị cầm tay, một màng phủ bóng mờ tối màu phía sau được thiết lập với lớp:
    `lg:hidden fixed inset-0 bg-black/60 z-35 backdrop-blur-xs`
    Cho phép nhấp tay vào vùng tối này để thu lại Sidebar ngay lập tức.
*   **Trạng thái Nạp Tệp**: Biểu tượng tải tệp lên trong hộp thoại được gắn hiệu ứng nhấp nháy chuyển động nhẹ nhàng `animate-bounce` định kỳ để thu hút cử chỉ thả tệp tin của người biên soạn.

---

## 👥 II. HỆ THỐNG ĐA CHỨC SỰ SONG HÀNH (MULTI-ROLE MANAGEMENT ARCHITECTURE)

Một trong những bước tiến công nghệ lớn nhất của phiên bản này là chuyển đổi hoàn toàn cấu trúc quản trị viên từ **đơn chức vụ** (Single-role) sang **đa chức vụ song hành** (Multiple Roles):

### 1. Cơ Chế Bản Ghi Dữ Liệu
Trên lược đồ thực thể đinh viên, trường thuộc tính vai trò cũ được bảo lưu làm vai trò chính, đồng thời mở rộng mảng `roles: string[]` để lưu giữ toàn nhiệm:

```typescript
interface UserSession {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "user" | "writer" | "treasurer" | "secretary";
  roles: string[]; // Chứa danh sách các chức sự đang đảm nhận
  isKYCed: boolean;
}
```

### 2. Trình Biểu Thị Danh Hiệu Trên Sidebar
Thanh điều hướng biểu thị danh vị của tộc nhân bằng cách chuỗi hóa các chức vụ họ gánh vác, dùng ký tự liên kết `&` sang trọng:

*   **Nguyên lý lọc hiển thị danh hiệu:**
    ```typescript
    const roles = currentUser.roles || [currentUser.role];
    const labels = roles.map(r => {
      if (r === "admin") return "👑 Chánh Tổng Quản";
      if (r === "writer") return "✍️ Sử Biên Ký";
      if (r === "treasurer") return "💰 Thủ Quỹ Gia Tộc";
      if (r === "secretary") return "📝 Thư Ký Họ";
      return "";
    }).filter(Boolean);

    if (labels.length > 0) return labels.join(" & ");
    return currentUser.isKYCed ? "✓ Đinh Viên Tuyên Đức" : "⏳ Hương Đinh Tự Do";
    ```

### 3. Bộ Giao Diện Thay Đổi Chức Sự Tại Bảng Điều Hành
Cung cấp bảng nút kiểm chọn (Checkbox grid) trực tuyến. Cho phép Chánh Tổng Quản lựa chọn/hủy kích hoạt bất kỳ vai trò nào cho thành viên dòng họ. Khi tất cả vai trò bị bỏ chọn, hệ thống cảnh báo yêu cầu tộc nhân phải có ít nhất một chức vụ:
*   *Lớp màu Checkbox:* `rounded text-red-800 focus:ring-red-800 accent-red-800`

---

## 📊 III. TIÊU CHUẨN ĐẶC TẢ PHẢ ĐỒ 55 CỘT (CAO CLAN 55-COLUMN SPECIFICATION)

Để số hóa thế đồ dòng tộc Cao Ninh Bình một cách trọn vẹn, cấu trúc bảng tính Excel nạp vào phải sắp xếp thẳng hàng theo **55 trường quan hệ cốt tử**. Hệ thống đối chiếu nghiêm ngặt vị trí chỉ mục (Index) từ cột 1 tới 55:

```
[CỘT 1 - 10: THÔNG TIN BẢN THÂN]
Cột 1 : Mã định danh cá nhân (Khóa chính liên hệ gia hệ)
Cột 2 : Họ và tên đầy đủ (Quý danh đinh viên bắt buộc)
Cột 3 : Giới tính ("Nam" hoặc "Nữ")
Cột 4 : Tên thường gọi / Bí danh / Tên tự / Tên hiệu (Nơi biên chép tước vị cổ)
Cột 5 : Số điện thoại chính
Cột 6 : Số điện thoại phụ
Cột 7 : Nơi ở (Địa chỉ trú quán phục vụ truyền tin Zalo)
Cột 8 : Email (Hòm tuyển thư điện tử)
Cột 9 : Ngày tháng năm sinh (Ghi trên giấy tờ chính thức)
Cột 10: Tình trạng sinh tử ("Còn sống" hoặc "Đã mất")

[CỘT 11 - 13: THỜ TỰ CHI TIẾT (NẾU ĐÃ MẤT)]
Cột 11: Ngày tháng năm mất lịch Dương tinh tú
Cột 12: Ngày giỗ theo âm lịch / Kỵ nhật tiên linh
Cột 13: Nơi an táng / Địa vị mộ phần

[CỘT 14 - 23: PHỤ HỆ CHI TIẾT]
Cột 14: Họ và tên Cha ruột
Cột 15: Nơi ở của cha ruột
Cột 16: Số điện thoại liên lạc của cha
Cột 17: Ngày sinh của cha
Cột 18: Tình trạng sinh tử của cha ("Còn sống" / "Đã mất")
Cột 19: Ngày tháng năm mất lịch Dương của cha
Cột 20: Ngày kỵ âm lịch của cha
Cột 21: Nơi an táng mộ phần của cha
Cột 22: Mã số định danh của cha (Dùng khóa ngoại liên kết dòng truyền dòng hệ)

[CỘT 24 - 31: MẪU HỆ CHI TIẾT]
Cột 24: Họ và tên Mẹ ruột
Cột 25: Nơi ở của mẹ
Cột 26: Số điện thoại của mẹ
Cột 27: Ngày sinh của mẹ
Cột 28: Tình trạng của mẹ ("Còn sống" / "Đã mất")
Cột 29: Ngày mất lịch Dương của mẹ
Cột 30: Ngày kỵ âm lịch của mẹ
Cột 31: Nơi an táng của mẹ

[CỘT 32 - 39: THÔNG TIN BẠN ĐỜI (PHỐI NGẪU)]
Cột 32: Họ và tên phối ngẫu (Vợ/Chồng chính thất)
Cột 33: Nơi ở của phối ngẫu
Cột 34: Số điện thoại của phối ngẫu
Cột 35: Ngày sinh phối ngẫu
Cột 36: Tình trạng sinh tử phối ngẫu ("Còn sống" / "Đã mất")
Cột 37: Ngày mất dương của phối ngẫu
Cột 38: Ngày kỵ âm lịch phối ngẫu
Cột 39: Nơi an táng phối ngẫu

[CỘT 40 - 55: DANH SÁCH 8 CON RUỘT VÀ GIỚI TÍNH TƯƠNG ỨNG]
Cột 40: Họ tên con thứ 1      | Cột 41: Giới tính con thứ 1
Cột 42: Họ tên con thứ 2      | Cột 43: Giới tính con thứ 2
Cột 44: Họ tên con thứ 3      | Cột 45: Giới tính con thứ 3
Cột 46: Họ tên con thứ 4      | Cột 47: Giới tính con thứ 4
Cột 48: Họ tên con thứ 5      | Cột 49: Giới tính con thứ 5
Cột 50: Họ tên con thứ 6      | Cột 51: Giới tính con thứ 6
Cột 52: Họ tên con thứ 7      | Cột 53: Giới tính con thứ 7
Cột 54: Họ tên con thứ 8      | Cột 55: Giới tính con thứ 8
```

---

## 📥 IV. MODULE TRÍ TUỆ ĐỒNG BỘ EXCEL (EXCEL ALIGNMENT SYSTEM)

Giao diện nâng cấp cung cấp trải nghiệm nhập phả đắc sắc với bảng thống kê đối chiếu trước khi thực thi:

### 1. Thuật Toán Thẩm Định Tỷ Lệ Khớp (Validation Alignment Engine)
Hộp thoại lọc sạch khoảng trắng, loại bỏ dấu chấm câu biến chữ viết hoa thành viết thường nhằm tăng khả năng nhận diện tiêu đề tiếng Việt:

```typescript
const simplifiedSpec = specName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9àáạảãâ...]/g, "");
const simplifiedIncoming = incomingHeader.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9àáạảãâ...]/g, "");
```

Hệ thống tính toán **Mức Độ Dự Đoán Phù Hợp (%)** dựa trên số lượng cột trùng khớp cấu trúc thật trên tổng số 55 trường:
$$\text{Độ Khớp Cấu Trúc} = \left( \frac{\text{Số cột khớp thành công}}{55} \right) \times 100\%$$

*   **Hiển thị trực quan:** Bản đồ ô đố được tạo lập bằng bảng lưới linh hoạt (`grid grid-cols-2 sm:grid-cols-4 gap-1.5`) với 3 trạng thái chỉ màu cao cấp:
    1.  🟢 **Xanh lá tươi (`bg-emerald-500/5 border-emerald-200`)**: Cột nạp tương thích tuyệt đối với phả chuẩn 55 dòng học, hiển thị kèm ô dữ liệu ví dụ thực tế.
    2.  🟡 **Màu cam san hô (`bg-amber-500/5 border-amber-200`)**: Trường bổ sung ngoài tiêu chuẩn hoặc có sự sai lệch nhẹ về ký tự viết thường.
    3.  ⚪ **Màu xám đá (`bg-stone-50 border-stone-200`)**: Trường trống chưa xuất hiện dữ liệu trên file nguồn tải lên.

---

### 2. Thiết Kế Hai Chế Độ Nạp Dữ Liệu
Để ngăn ngừa rủi ro mất mát dữ liệu gốc mĩ mãn hoặc đẩy phả rác, ban trị sự có thể kiểm soát linh hoạt nút chọn thuộc tính:

*   **Bổ sung tiếp nối (`importMode = 'append'`)**:
    *   *Trực quan:* Đường viền hộp chọn chuyển sang màu xanh ngọc lam.
    *   *Hành vi thuật toán:* Ghép nối các bản ghi từ file Excel vào sau danh sách tiên phả hiện hành qua hàm mở rộng `setMembers((prev) => [...prev, ...newMems])`.
*   **Xóa hết làm mới (`importMode = 'replace'`)**:
    *   *Trực quan:* Hiển thị cảnh báo viền đỏ rực rỡ, phím bấm đồng bộ biến thành màu đỏ thẫm đe dọa trực tuyến `bg-red-750`.
    *   *Hành vi thuật toán:* Thay mới hoàn toàn cơ sở dữ liệu phả đồ, giải phóng bộ nhớ phả cũ và đặt tệp tin mới làm trung tâm phả đồ `setMembers(newMems)`.

---

## 💬 V. CHIẾN DỊCH PHÁT KIẾN ZALO & BAN HOẠT ĐỘNG CHUYÊN THỂ

Mô-đun cổng thông tin liên lạc Zalo (Zalo Notification Hub) hỗ trợ hai mảng lớn để ban trị sự tiếp cận đinh viên:

### 1. Phân Nhóm Nhận thông Điệp Đa Điểm
Thay vì gửi phát tràn lan gây phiền hà, hệ thống thiết kế ba nút chọn đối tượng gửi thông báo tiên quyết:
1.  **Gửi Toàn Tổ dòng họ (All Members)**: Kéo gửi cho toàn thể tộc nhân trong gia tộc Cao Ninh Bính.
2.  **Phát theo Tổ Nhóm (Target Groups)**: Giao dịch hộp thư chọn theo phân hệ như: *Thanh niên dòng họ*, *Ngành Trưởng tông phái*, *Ban khuyến học*, *Hội đồng hương Ninh Bình*.
3.  **Gửi Đích Danh (Direct Individual)**: Ô tìm kiếm thông tin nhanh lẹ cho phép chọn duy nhất 1 tộc nhân đặc thù trong cây phả họ để gửi một chỉ dụ Zalo trực diện.

### 2. Trình Quản Lý Ban Hoạt Động (Dynamic Activity Group Portal)
*   Cho phép khởi tạo không giới hạn các phân hội hoạt động dòng tộc mới đại diện cho các phong trào nhang hương, dọn mộ, thể dục thể thao hay quyên góp tôn nghiêm.
*   Thiết kế công cụ ngăn chặn xóa nhầm đối với các Ban truyền thống bất khả xâm phạm bao gồm: `Ban Trị Sự`, `Thanh Niên Họ`, `Ngành Trưởng`, `Ngành Thứ`, `Hội Tương Trợ dòng họ`.

---

## 🚀 VI. KHỞI CHẠY VÀ CÀI ĐẶT

Hệ thống đã được đóng gói loại bỏ mọi nguy cơ sai sót kiểu dữ liệu và sẵn sàng triển khai trên hạ tầng máy chủ gia tộc. Toàn bộ thông tin cập nhật phía trên đã được số hóa hoàn hảo trong mã nguồn ứng dụng thực tế.
