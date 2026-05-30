import React from 'react';
import { Save } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';

type SettingsMonitorPanelProps = {
  settings: AppConfig;
  isSaved: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function SettingsMonitorPanel({ settings, isSaved, onSave, onReset }: SettingsMonitorPanelProps) {
  return (
    <div className="bg-white border-2 border-primary rounded p-5 space-y-5 shadow-lg">
      <h4 className="font-serif text-sm font-bold text-primary border-b pb-2">
        Bộ giám sát Đồng bộ
      </h4>

      <div className="text-xs font-sans space-y-3">
        <div className="flex justify-between items-center bg-slate-50 p-2 border rounded">
          <span className="text-ink-charcoal/65">Thành viên phả hệ:</span>
          <span className="font-mono font-bold text-primary">Tự dãn động</span>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-2 border rounded">
          <span className="text-ink-charcoal/65">Sắc tông chủ thể:</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
            <span
              className="w-3.5 h-3.5 rounded border border-gray-300 block"
              style={{ backgroundColor: settings.primaryColor }}
            />
            {settings.primaryColor}
          </span>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-2 border rounded">
          <span className="text-ink-charcoal/65">Sọc nối chi phái:</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
            <span
              className="w-3.5 h-3.5 rounded border border-gray-300 block"
              style={{ backgroundColor: settings.treeLineColor }}
            />
            {settings.treeLineColor}
          </span>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-2 border rounded">
          <span className="text-ink-charcoal/65">Hòa trộn nền:</span>
          <span className="font-mono font-bold capitalize">{settings.backgroundBlendMode}</span>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-2 border rounded">
          <span className="text-ink-charcoal/65">Trục ngang dãn:</span>
          <span className="font-mono font-bold">{settings.treeSpacingX} px</span>
        </div>

        <div className="flex justify-between items-center bg-emerald-50/50 p-2 border rounded text-emerald-900 border-emerald-300">
          <span>Google Sheet Sync:</span>
          <span className="font-mono font-bold">
            {settings.googleSheetSyncEnabled ? 'Bật 📜' : 'Chưa bật ⚙️'}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 pt-2">
        <button
          onClick={onSave}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-sans font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          <span>ÁP DỤNG & LƯU THAY ĐỔI</span>
        </button>

        <button
          onClick={onReset}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-ink-charcoal rounded font-sans font-semibold text-xs border border-slate-300 transition-all flex items-center justify-center"
        >
          Đặt lại cài đặt ban đầu
        </button>
      </div>

      {isSaved && (
        <div className="text-center text-xs text-emerald-800 font-sans font-medium animate-pulse">
          ✓ Thiết lập đã được cập nhật thành công!
        </div>
      )}
    </div>
  );
}
