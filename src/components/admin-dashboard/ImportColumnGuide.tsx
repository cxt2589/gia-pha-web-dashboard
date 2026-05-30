import { FileText, HelpCircle } from 'lucide-react';

export function ImportColumnGuide() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3 text-ink-charcoal/80 text-xs shadow-inner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
        <span className="font-serif font-bold text-primary flex items-center gap-1.5 text-xs">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>Hướng dẫn thiết lập các cột tương thích trên Google Sheet</span>
        </span>
        <a
          href="/mau-excel-gia-pha-chuan-v3.xlsx"
          download="mau-excel-gia-pha-chuan-v3.xlsx"
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[10.5px] font-sans font-extrabold shadow-sm hover:shadow transition-all shrink-0 cursor-pointer text-center"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>📥 TẢI FILE MẪU EXCEL CHUẨN (.XLSX)</span>
        </a>
      </div>

      <div className="space-y-1.5 leading-relaxed font-sans text-slate-700 text-[11px]">
        <p className="font-semibold text-slate-800 text-xs bg-amber-50 rounded border border-amber-100 p-2 text-[11px] leading-relaxed">
          💡 <strong>Lời khuyên hữu ích:</strong> Quý vị hãy tải file mẫu chuẩn của chúng tôi bằng nút phía trên, mở bằng Microsoft Excel hoặc Google Sheets để điền thông tin đúng cột mẫu. Hệ thống tự động nhận diện các cột không phụ thuộc thứ tự sắp xếp!
        </p>
        <p>File mẫu đang dùng tên cột tiếng Việt. Hệ thống vẫn nhận thêm các alias ngắn như id/name/parentId, nhưng để dễ nhập liệu nên giữ đúng các cột trong file mẫu:</p>
        <div className="bg-white border rounded p-2.5 font-mono text-[10px] grid grid-cols-1 md:grid-cols-2 gap-1.5 text-slate-800">
          <div>• Mã định danh cá nhân <span className="text-slate-400 font-sans">(id duy nhất)</span></div>
          <div>• Họ và tên đầy đủ</div>
          <div>• Giới tính <span className="text-slate-400 font-sans">(Nam / Nữ)</span></div>
          <div>• Tên thường gọi / Bí danh / Tên tự (nếu có)</div>
          <div>• Số điện thoại / Số điện thoại phụ</div>
          <div>• Nơi ở / Email</div>
          <div>• Ngày sinh (Trên giấy tờ)</div>
          <div>• Tình trạng (còn sống/đã mất)</div>
          <div>• (Nếu đã mất) Ngày tháng năm mất (dương lịch)</div>
          <div>• (Nếu đã mất) Ngày mất theo âm lịch / Kỵ nhật <span className="text-slate-400 font-sans">(VD: 15/3 Canh Ngọ, 13/6)</span></div>
          <div>• (Nếu đã mất) Nơi an táng</div>
          <div>• Đời thứ mấy</div>
          <div>• Mã số cha <span className="text-slate-400 font-sans">(parentId)</span></div>
          <div>• Họ và tên Cha ruột / Họ và tên Mẹ ruột</div>
          <div>• Họ và tên Vợ/Chồng</div>
          <div>• Các cột Con ruột 1, 2, 3... <span className="text-slate-400 font-sans">(nếu nhập dạng phụ)</span></div>
        </div>
        <p className="text-slate-400 italic">Ví dụ: đời 0 có parentId để trống. Người con có parentId bằng đúng id của bố/mẹ. Nếu đã mất nhưng chưa rõ ngày dương lịch, vẫn có thể điền ngày mất âm lịch để hiển thị ngày giỗ.</p>
      </div>
    </div>
  );
}
