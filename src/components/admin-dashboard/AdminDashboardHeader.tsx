type AdminDashboardHeaderProps = {
  onLogout: () => void;
};

export function AdminDashboardHeader({ onLogout }: AdminDashboardHeaderProps) {
  return (
    <div className="text-center md:text-left space-y-2 border-b border-[#8c716e]/15 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <span className="text-xs font-mono tracking-widest text-[#7b5800] uppercase font-bold">Trang quan chức dòng tộc</span>
        <h2 className="font-serif text-3xl font-extrabold text-primary tracking-tight">
          Nội Phủ Tông tộc Dashboard 📜
        </h2>
        <p className="text-xs md:text-sm text-ink-charcoal/70 leading-relaxed font-sans max-w-2xl">
          Cơ sở quản trị chuyên sâu. Mọi cập nhật sẽ thay đổi cấu trúc thẩm mỹ, màu sắc, chế độ hòa trộn hình ảnh, kích thước của cây phả hệ, tên thanh nút bấm, liên kết với Google Sheets và các API thông minh.
        </p>
      </div>

      <button
        onClick={onLogout}
        className="px-3.5 py-1.5 self-center bg-slate-800 hover:bg-slate-700 text-silk-paper rounded font-sans font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 border border-slate-700"
      >
        Đăng xuất Admin 🔐
      </button>
    </div>
  );
}
