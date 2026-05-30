import { AlertTriangle } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';
import { ImportValidationSummary } from '../../utils/importValidation';

export type PendingLineageImport = {
  rows: any[];
  sourceLabel: string;
  treeData: any;
  summary: ImportValidationSummary;
  postConfirmSettings?: AppConfig;
};

type ImportValidationReportProps = {
  pendingLineageImport: PendingLineageImport;
  onConfirm: () => void;
  onCancel: () => void;
};

const formatIssue = (issue: { rowNumber?: number; message: string }) => (
  <>
    {issue.rowNumber ? `Dòng ${issue.rowNumber}: ` : ''}
    {issue.message}
  </>
);

export function ImportValidationReport({
  pendingLineageImport,
  onConfirm,
  onCancel
}: ImportValidationReportProps) {
  const { summary, postConfirmSettings } = pendingLineageImport;
  const hasErrors = summary.errors.length > 0;

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${
      hasErrors ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
    }`}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-charcoal/50">
            Báo cáo kiểm tra import
          </div>
          <h4 className="font-serif text-sm font-black text-primary">
            {summary.sourceLabel}
          </h4>
          <p className="text-[10.5px] text-ink-charcoal/65 leading-relaxed">
            Dữ liệu mới chỉ được kiểm tra, chưa ghi vào gia phả hiện tại. Nếu không có lỗi nghiêm trọng, bấm xác nhận để cập nhật.
            {postConfirmSettings && (
              <span className="block mt-1 text-emerald-800 font-semibold">
                Nguồn Google Sheet cũng sẽ được lưu sau khi xác nhận.
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onConfirm}
            disabled={hasErrors}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded text-[10.5px] font-sans font-bold shadow-sm"
          >
            Xác nhận nhập dữ liệu
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded text-[10.5px] font-sans font-bold shadow-sm"
          >
            Hủy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          ['Dòng đọc được', summary.rowCount],
          ['Người hợp lệ', summary.validPersonCount],
          ['Quan hệ cha-con', summary.relationCount],
          ['Vợ/chồng đọc được', summary.spouseCount],
          ['Con tự tạo', summary.virtualChildrenCount]
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-white/90 border border-white rounded p-2 text-center">
            <div className="text-[9px] font-mono text-ink-charcoal/45 uppercase">{label}</div>
            <div className="text-lg font-bold text-ink-charcoal">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-red-100 rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-900">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Lỗi nghiêm trọng ({summary.errors.length})</span>
          </div>
          {summary.errors.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {summary.errors.slice(0, 30).map((issue, index) => (
                <div key={`${issue.message}-${index}`} className="text-[10.5px] text-red-950 bg-red-50 border border-red-100 rounded px-2 py-1">
                  {formatIssue(issue)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-emerald-800">Không có lỗi chặn import.</p>
          )}
        </div>

        <div className="bg-white border border-amber-100 rounded p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cảnh báo có thể bổ sung sau ({summary.warnings.length})</span>
          </div>
          {summary.warnings.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {summary.warnings.slice(0, 30).map((issue, index) => (
                <div key={`${issue.message}-${index}`} className="text-[10.5px] text-amber-950 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                  {formatIssue(issue)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-emerald-800">Không có cảnh báo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
