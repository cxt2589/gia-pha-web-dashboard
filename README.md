# Web gia tộc họ Cao

Ứng dụng web quản lý và trình bày thông tin gia tộc họ Cao, bao gồm gia phả, phả ký, tộc ước, lịch giỗ, công cụ đổi lịch âm/dương và dashboard quản trị dữ liệu.

## Công nghệ

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- lucide-react
- lunar-javascript
- Google Sheets CSV export để đồng bộ dữ liệu gia phả

## Chức năng chính

- Xem cây gia phả theo nhiều đời.
- Tìm kiếm, lọc và xem chi tiết thành viên.
- Quản trị giao diện: màu sắc, nhãn tab, logo/chữ hiệu, kích thước cây.
- Đồng bộ dữ liệu từ Google Sheets hoặc file CSV theo mẫu chuẩn.
- Nhập/xuất dữ liệu cây gia phả dạng JSON để sao lưu.
- Đổi lịch dương lịch ↔ âm lịch phục vụ giỗ chạp, lễ nghi.
- Chatbot gia tộc dạng mô phỏng trong giao diện.

## Chạy local

### Yêu cầu

- Node.js 20+ khuyến nghị
- npm

### Cài đặt

```bash
npm install
```

### Chạy môi trường phát triển

```bash
npm run dev
```

Mặc định Vite chạy ở cổng `3000` và bind `0.0.0.0`.

### Kiểm tra TypeScript

```bash
npm run lint
```

### Build production

```bash
npm run build
```

### Preview bản build

```bash
npm run preview
```

## Đồng bộ Google Sheets

Dashboard quản trị hỗ trợ nhập ID hoặc link Google Sheets. Ứng dụng sẽ tải CSV qua endpoint:

```text
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv
```

Lưu ý:

- Sheet cần bật quyền chia sẻ: **Bất kỳ ai có liên kết đều có thể xem**.
- Google Sheets export CSV thường lấy tab đầu tiên bên trái, nên hãy đặt tab dữ liệu gia phả làm tab đầu tiên.
- Dòng đầu tiên phải là tiêu đề cột.
- Có thể dùng file mẫu tại `public/mau-excel-gia-pha-chuan.csv`.

## Các cột dữ liệu khuyến nghị

Các cột tối thiểu nên có:

- `id` hoặc `Mã định danh cá nhân`
- `name` hoặc `Họ và tên đầy đủ`
- `generation` hoặc `Đời thứ mấy`
- `parentId` hoặc `Mã số cha`
- `gender` hoặc `Giới tính`
- thông tin cha, mẹ, vợ/chồng, con ruột nếu có

Parser hiện hỗ trợ nhiều tên cột tiếng Việt, nhưng để ổn định lâu dài nên chuẩn hóa sheet về bộ cột cố định.

## Cảnh báo bảo mật hiện tại

Dự án hiện phù hợp cho demo/MVP nội bộ. Trước khi triển khai công khai cho dữ liệu thật, cần xử lý:

1. Không dùng mật khẩu admin hardcode trong frontend.
2. Không lưu API key hoặc dữ liệu nhạy cảm trong localStorage.
3. Tách dữ liệu gia phả thật sang backend/database có phân quyền.
4. Ẩn hoặc giới hạn số điện thoại/email của thành viên còn sống.
5. Đưa việc gọi AI/Gemini sang server-side API thay vì gọi trực tiếp từ trình duyệt.

## Ghi chú AI

Package đã khai báo `@google/genai`, nhưng chatbot trong giao diện hiện đang là mô phỏng theo từ khóa. Muốn dùng Gemini thật, nên triển khai API route/serverless function để giữ an toàn cho API key.
