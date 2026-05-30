# Ke hoach tich hop dashboard

Du an nay duoc tao tu web view goc tai `C:\Users\truon\Documents\Game\giapha-codex` va bo tai lieu dashboard tai `C:\Users\truon\Documents\Game\tai lieu lam dashboard`.

## Nguyen tac

- Giao dien nguoi dung giu theo web view hien co.
- Quan tri nhanh cu giu nguyen trong luong tinh nang hien tai.
- Dashboard tong duoc bo sung thanh khu rieng tai `/admin`.
- Dashboard tham chieu nam trong `docs/dashboard-reference`.
- Khong tron code tham chieu truc tiep vao web view cho den khi da map ro du lieu, quyen va route.

## Nguon dashboard tham chieu

- `docs/dashboard-reference/dashboard.md`: mo ta tinh nang va yeu cau san pham.
- `docs/dashboard-reference/dashboard.json`: dac ta UI/theme/tinh nang.
- `docs/dashboard-reference/source`: source dashboard mau da tach rieng de doi chieu component, data model va workflow.

## Cac module can ghep

- Tong quan: thong ke thanh vien, kien, quy, hoat dong, canh bao.
- Pha he: cay gia pha, danh sach thanh vien, import Excel/CSV, validation du lieu.
- Su kien: danh sach su kien, dang ky tham du, tao noi dung AI.
- Quy: thu/chi, cong no, bao cao quy theo vai tro.
- Bai viet: tao/sua/xuat ban noi dung.
- Zalo: nhom, nguoi theo doi, broadcast, auto-reply, lich gui.
- AI Helper: tro ly noi bo cho du lieu gia pha.
- Cai dat: vai tro, giao dien, cau hinh AI, thong tin dong ho.

## Viec can lam tiep

1. Tao route `/admin` rieng, khong de route nay hien man hinh pha ky cua web view.
2. Tach `AdminDashboard` moi tu source tham chieu thanh component trong `src`.
3. Dung data model hien co cua web view truoc, bo sung field con thieu sau khi doi chieu.
4. Ket noi import Excel san co voi luong dashboard.
5. Giu admin cu nhu mot khu "Quan tri nhanh" trong dashboard hoac trong tab hien co, tuy theo quyen admin.
