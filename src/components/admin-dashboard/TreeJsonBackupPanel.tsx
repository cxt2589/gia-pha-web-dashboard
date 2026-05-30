import { FileText, Eye, Plus } from 'lucide-react';

type TreeJsonBackupPanelProps = {
  rawLineageInput: string;
  treeImportMsg: string;
  onRawLineageInputChange: (value: string) => void;
  onExportTreeJson: () => void;
  onImportTreeJson: () => void;
  onResetTreeDatabase: () => void;
  onClearAllTreeData: () => void;
};

export function TreeJsonBackupPanel({
  rawLineageInput,
  treeImportMsg,
  onRawLineageInputChange,
  onExportTreeJson,
  onImportTreeJson,
  onResetTreeDatabase,
  onClearAllTreeData
}: TreeJsonBackupPanelProps) {
  return (
    <div className="space-y-3.5 border-t border-[#8c716e]/10 pt-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-xs font-extrabold text-primary flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[#7b5800]" />
          <span>Sao lưu & Nhập xuất Cây Phả hệ trực tiếp (JSON Format)</span>
        </span>
      </div>

      <p className="text-[10px] text-ink-charcoal/60 leading-normal">
        Nếu không dùng Google Sheet, quý vị có thể tải lên/tải xuống cấu trúc JSON của gia hệ để sao lưu dự phòng phòng khi trình duyệt bị xóa dữ liệu cục bộ.
      </p>

      <textarea
        rows={4}
        placeholder="Dán chuỗi dữ liệu JSON xuất phả hệ ở đây..."
        value={rawLineageInput}
        onChange={(event) => onRawLineageInputChange(event.target.value)}
        className="w-full text-[10px] font-mono p-2.5 bg-silk-paper border border-[#8c716e]/20 rounded placeholder-ink-charcoal/30 text-ink-charcoal focus:outline-none focus:border-primary"
      />

      {treeImportMsg && (
        <div className="text-[11px] text-amber-900 bg-amber-50 p-2 border border-amber-200 rounded">
          {treeImportMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onExportTreeJson}
          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded text-xs font-sans font-bold flex items-center gap-1 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Xuất File JSON Hiện Tại</span>
        </button>

        <button
          type="button"
          onClick={onImportTreeJson}
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-sans font-bold flex items-center gap-1 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nhập & Ghi Đè Bản Gốc</span>
        </button>

        <button
          type="button"
          onClick={onResetTreeDatabase}
          className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 rounded text-xs font-sans font-bold flex items-center gap-1 transition-all"
        >
          <span>Khôi phục Cây Phả hệ Cao Gia gốc Ninh Bình ⚠️</span>
        </button>

        <button
          type="button"
          onClick={onClearAllTreeData}
          className="px-3.5 py-1.5 bg-[#8b1c1c] hover:bg-[#a02222] text-white rounded text-xs font-sans font-bold flex items-center gap-1 transition-all"
        >
          <span>🗑️ Xóa Sạch Hoàn Toàn & Nhập Mới</span>
        </button>
      </div>
    </div>
  );
}
