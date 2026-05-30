import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

type LineageDiagnosticsReportProps = {
  diagnostics: any;
};

export function LineageDiagnosticsReport({ diagnostics }: LineageDiagnosticsReportProps) {
  if (!diagnostics) return null;

  return (
    <div className="border border-[#8c716e]/20 rounded-lg overflow-hidden bg-slate-50 p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-[#8c716e]/10 pb-3">
        <div>
          <h4 className="font-serif font-black text-xs md:text-sm text-primary uppercase">
            📊 Công Cụ Báo Cáo Liên Kết & Phân Tích Phả Hệ
          </h4>
          <p className="text-[10px] text-ink-charcoal/60">
            Bản tin kiểm soát chất lượng dữ liệu Google Sheet của dòng họ
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-emerald-100 text-emerald-800">
          Hệ thống tự động khớp
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3 border border-slate-200 rounded text-center">
          <div className="text-[10px] font-mono text-ink-charcoal/50 uppercase">Thành viên nạp</div>
          <div className="text-xl font-bold text-slate-800">{diagnostics.totalParsed || 0}</div>
        </div>
        <div className="bg-white p-3 border border-slate-200 rounded text-center">
          <div className="text-[10px] font-mono text-ink-charcoal/50 uppercase">Con tự động tạo</div>
          <div className="text-xl font-bold text-amber-600">{diagnostics.virtualChildrenCount || 0}</div>
        </div>
        <div className="bg-white p-3 border border-slate-200 rounded text-center">
          <div className="text-[10px] font-mono text-ink-charcoal/50 uppercase">Mồ côi (Chưa khớp)</div>
          <div className={`text-xl font-bold ${diagnostics.unlinkedNodes?.length > 0 ? 'text-red-600 animate-pulse' : 'text-emerald-600'}`}>
            {diagnostics.unlinkedNodes?.length || 0}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-4.5 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] font-serif font-black text-amber-950">
          <HelpCircle className="w-4 h-4 text-amber-700" />
          <span>💡 HƯỚNG DẪN GHÉP BỐ MẸ VÀ CON DỄ DÀNG NHẤT</span>
        </div>
        <p className="text-[11px] text-amber-900 leading-relaxed font-sans">
          Hệ thống phả hệ hỗ trợ hai phương pháp kết nối. Với dữ liệu dòng họ có nhiều tên trùng hoặc gần trùng, nên dùng mã định danh để ghép nhánh chắc chắn nhất:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
          <div className="bg-white p-3 border border-amber-200/50 rounded space-y-1.5 font-sans">
            <div className="font-bold text-emerald-800 flex items-center gap-1">
              <span className="w-4 h-4 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-[9px] font-mono font-bold">1</span>
              <span>Cách 1: Khớp Tự Động theo Tên (Fuzzy Name)</span>
            </div>
            <p className="text-slate-600 text-[10px] leading-relaxed">
              Quý vị có thể điền cột <strong>"Họ và tên Cha ruột"</strong> hoặc <strong>"Họ và tên Mẹ ruột"</strong>. Hệ thống sẽ chuẩn hóa chữ cái, bỏ dấu tiếng Việt và bỏ danh xưng tôn kính để tìm cha/mẹ. Cách này tiện khi dữ liệu ít tên trùng, nhưng vẫn có thể cảnh báo nếu có nhiều người gần giống tên nhau.
            </p>
          </div>

          <div className="bg-white p-3 border border-amber-200/50 rounded space-y-1.5 font-sans">
            <div className="font-bold text-indigo-800 flex items-center gap-1">
              <span className="w-4 h-4 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-[9px] font-mono font-bold">2</span>
              <span>Cách 2: Khớp Theo Mã số ID (Tuyệt đối 100%)</span>
            </div>
            <p className="text-slate-600 text-[10px] leading-relaxed">
              Với logic mới, đây là cách khuyến nghị: điền cột <strong>"Mã định danh cá nhân"</strong> hoặc <strong>"id"</strong> cho mỗi người, rồi điền <strong>"Mã số cha"</strong>, <strong>"Mã cha"</strong> hoặc <strong>"parentId"</strong> của con bằng đúng mã của bố/mẹ. Khi có mã cha, hệ thống ưu tiên nối theo mã trước, sau đó mới dùng tên để hỗ trợ.
            </p>
          </div>
        </div>
      </div>

      {diagnostics.duplicateNames && diagnostics.duplicateNames.length > 0 && (
        <div className="bg-amber-100/70 border border-amber-300 p-3 rounded space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 font-sans">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Cảnh báo tên trùng lặp trong phả hệ</span>
          </div>
          <p className="text-[10px] text-amber-900 leading-relaxed font-sans">
            Phát hiện tên trùng lặp: <strong className="font-mono text-amber-950">{diagnostics.duplicateNames.join(", ")}</strong>.
            Để tránh hệ thống khớp sai bố con khi nhập tự động, Ban liên lạc nên khai báo cột <strong>"Mã số"</strong> và <strong>"Mã cha"</strong> cho các dòng này để chỉ định chính xác cây phả hệ.
          </p>
        </div>
      )}

      {diagnostics.unlinkedNodes && diagnostics.unlinkedNodes.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-serif font-black text-rose-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
              <span>Danh sách chưa liên kết vào sơ đồ cây ({diagnostics.unlinkedNodes.length})</span>
            </span>
          </div>

          <p className="text-[10px] text-ink-charcoal/60 leading-normal font-sans">
            Sau đây là danh sách những thành viên có ghi danh ở trang tính nhưng hệ thống <strong>chưa tìm thấy cha mẹ tương ứng</strong> để đưa lên cây. Vui lòng kiểm tra kỹ gợi ý ghép nối ở cột bên phải bên dưới để cập nhật lại trên Google Sheet của dòng họ:
          </p>

          <div className="max-h-64 overflow-y-auto border border-red-100 rounded-lg divide-y divide-red-50 bg-white shadow-inner">
            {diagnostics.unlinkedNodes.map((node: any) => (
              <div key={node.id} className="p-3 hover:bg-slate-50 transition-colors text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-900 rounded font-mono font-bold text-[9px]">
                      Đời {node.generation}
                    </span>
                    <span className="font-bold text-slate-800">{node.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">ID: {node.id}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans">
                    {node.fatherName && <span>Cha khai báo: <strong className="text-slate-700">{node.fatherName}</strong></span>}
                    {node.fatherName && node.motherName && <span className="mx-2">|</span>}
                    {node.motherName && <span>Mẹ khai báo: <strong className="text-slate-700">{node.motherName}</strong></span>}
                  </div>
                </div>

                <div className="shrink-0 font-sans md:text-right">
                  {node.potentialParents && node.potentialParents.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono">🔍 GỢI Ý MÃ CHA ĐỂ DÁN VÀO SHEET:</div>
                      <div className="flex flex-wrap gap-1 md:justify-end">
                        {node.potentialParents.map((parent: any) => (
                          <div key={parent.id} className="px-2 py-1 border border-emerald-300 bg-emerald-50 text-emerald-950 rounded text-[10px] flex items-center gap-1 font-sans">
                            <span>Dán <strong>{parent.id}</strong></span>
                            <span className="text-emerald-500 text-[9px] font-mono font-bold">(Bố: {parent.name})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] italic text-slate-400">
                      Không thấy ứng viên đời {node.generation - 1} phù hợp
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded flex items-center gap-2 text-xs text-emerald-950 font-sans">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Tuyệt vời! Tất cả các thành viên đã được liên kết thông suốt vào hệ thống cây phả hệ dòng họ mà không có bất kỳ dòng mồ côi nào.</span>
        </div>
      )}
    </div>
  );
}
