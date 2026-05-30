import React from 'react';
import { Link, RefreshCw, Upload } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';
import { ImportValidationReport, PendingLineageImport } from './ImportValidationReport';

type SyncMode = 'overwrite' | 'merge';

type ImportSourceControlsProps = {
  settings: AppConfig;
  setSettings: React.Dispatch<React.SetStateAction<AppConfig>>;
  syncMode: SyncMode;
  setSyncMode: React.Dispatch<React.SetStateAction<SyncMode>>;
  isSyncing: boolean;
  isImportingFile: boolean;
  pendingLineageImport: PendingLineageImport | null;
  onSyncGoogleSheet: () => void;
  onImportLineageFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmPendingImport: () => void;
  onCancelPendingImport: () => void;
};

export function ImportSourceControls({
  settings,
  setSettings,
  syncMode,
  setSyncMode,
  isSyncing,
  isImportingFile,
  pendingLineageImport,
  onSyncGoogleSheet,
  onImportLineageFile,
  onConfirmPendingImport,
  onCancelPendingImport
}: ImportSourceControlsProps) {
  return (
    <div className="bg-emerald-50/50 border border-emerald-300 rounded p-4 space-y-4">
      <div className="flex items-center space-x-2 text-emerald-950 font-serif font-black text-sm">
        <Link className="w-4 h-4 text-emerald-800" />
        <span>Nguồn dữ liệu Phả hệ trực tiếp</span>
      </div>

      <p className="text-[11px] text-emerald-900/80 leading-relaxed font-sans space-y-1">
        <span>Hệ thống hỗ trợ nạp dữ liệu gia phả trực tiếp từ một trang <strong>Google Sheets</strong> trực tuyến. Để đồng bộ, hãy đặt chế độ chia sẻ Google Sheet là <strong>"Bất kỳ ai có liên kết đều có thể xem"</strong> rồi dán ID hoặc nguyên liên kết của trang đó vào ô dưới đây.</span>
        <br />
        <span className="block mt-1 text-[10px] text-emerald-850 bg-emerald-100/50 p-2 rounded border border-emerald-200/45">
          💡 <strong>Mẹo nhỏ cực kỳ quan trọng:</strong>
          <br />- Google Sheets sẽ luôn xuất dữ liệu từ <strong>trang bảng tính (tab) đầu tiên bên trái ngoài cùng</strong>. Hãy chắc chắn di chuyển tab chứa bảng gia phả của bạn về vị trí số 1.
          <br />- Hệ thống đã tự động lọc các ký tự Byte Order Mark (BOM) sinh ra khi lưu file từ Excel tiếng Việt, đồng thời tự vẽ phả hệ và tự cân chỉnh thế hệ (Đời) một cách thông minh bằng thuật toán tự liên kết Cha - Con, giúp cây thẳng hàng ngay cả khi Sheet bị thiếu thông tin thế hệ.
        </span>
      </p>

      <div className="space-y-2 border-t border-b border-emerald-200/50 py-3">
        <label className="text-[10px] font-mono font-bold text-emerald-950/70 uppercase block mb-1">
          Chế độ nhập dữ liệu dòng tộc
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSyncMode('overwrite')}
            className={`text-left p-3 rounded border transition-all flex flex-col justify-between ${
              syncMode === 'overwrite'
                ? 'bg-[#ffebee]/65 border-red-400 shadow-sm ring-1 ring-red-400/10'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="sync_mode"
                id="sync_mode_overwrite"
                checked={syncMode === 'overwrite'}
                onChange={() => setSyncMode('overwrite')}
                className="bg-white border-slate-300 text-red-600 focus:ring-red-400 h-3.5 w-3.5 cursor-pointer"
              />
              <span className={`text-xs font-bold font-sans ${syncMode === 'overwrite' ? 'text-red-950' : 'text-slate-700'}`}>
                🗑️ GHI ĐÈ & NHẬP LẠI (Xóa sạch cũ)
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 lines-normal font-sans">
              Hệ thống sẽ hoàn toàn xóa sạch tất cả thành viên trong phả hệ cũ và vẽ lại thành lập từ đầu dựa theo dữ liệu Sheet chuẩn hiện tại.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSyncMode('merge')}
            className={`text-left p-3 rounded border transition-all flex flex-col justify-between ${
              syncMode === 'merge'
                ? 'bg-[#e3f2fd]/65 border-blue-400 shadow-sm ring-1 ring-blue-400/10'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="sync_mode"
                id="sync_mode_merge"
                checked={syncMode === 'merge'}
                onChange={() => setSyncMode('merge')}
                className="bg-white border-slate-300 text-blue-600 focus:ring-blue-400 h-3.5 w-3.5 cursor-pointer"
              />
              <span className={`text-xs font-bold font-sans ${syncMode === 'merge' ? 'text-blue-950' : 'text-slate-700'}`}>
                📝 SỬA & BỔ SUNG (Gộp thông tin)
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 lines-normal font-sans">
              Giữ lại toàn bộ dữ liệu đang có, cập nhật thêm thành viên mới dán vào hoặc hoàn thiện thuộc tính/tiểu sử của người đang có nếu dán trùng.
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono font-bold text-emerald-950/70 uppercase">
          Google Sheet ID hoặc Đường dẫn đường truyền
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Dán ID Sheet (ví dụ: 1aBcDeFgHiJkLmNoP...)"
            value={settings.googleSheetId}
            onChange={(event) => setSettings({ ...settings, googleSheetId: event.target.value })}
            className="flex-1 text-xs font-sans p-2 bg-white border border-emerald-300 rounded focus:outline-none focus:border-emerald-700 text-ink-charcoal"
          />
          <button
            onClick={onSyncGoogleSheet}
            disabled={isSyncing}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white rounded text-xs font-sans font-bold flex items-center gap-1 shadow-sm shrink-0 transition-colors"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>ĐỒNG BỘ NGAY</span>
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-emerald-200/50 pt-3">
        <label className="text-[10px] font-mono font-bold text-emerald-950/70 uppercase">
          Hoặc nhập trực tiếp từ file Excel/CSV trên máy
        </label>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded text-xs font-sans font-bold shadow-sm transition-colors border cursor-pointer ${
              isImportingFile
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300'
            }`}
          >
            {isImportingFile ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{isImportingFile ? 'ĐANG NHẬP FILE...' : 'CHỌN FILE EXCEL/CSV'}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={onImportLineageFile}
              disabled={isImportingFile}
              className="sr-only"
            />
          </label>
          <span className="text-[10px] text-emerald-900/65 leading-relaxed">
            Có thể chọn .csv, .xlsx hoặc .xls. File Excel sẽ đọc sheet đầu tiên, rồi ghi đè hoặc gộp theo chế độ đang chọn.
          </span>
        </div>
      </div>

      {pendingLineageImport && (
        <ImportValidationReport
          pendingLineageImport={pendingLineageImport}
          onConfirm={onConfirmPendingImport}
          onCancel={onCancelPendingImport}
        />
      )}
    </div>
  );
}
