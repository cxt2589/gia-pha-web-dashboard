import React from 'react';
import { Sliders } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';

type BrandingLabelsPanelProps = {
  settings: AppConfig;
  setSettings: React.Dispatch<React.SetStateAction<AppConfig>>;
};

const tabFields: Array<[string, keyof AppConfig]> = [
  ['Tab Tin tức', 'tabTintucLabel'],
  ['Tab Gia phả', 'tabGiaphaLabel'],
  ['Tab Phả ký', 'tabPhakyLabel'],
  ['Tab Tộc ước', 'tabTocuocLabel'],
  ['Tab Lịch giỗ', 'tabLichgioLabel'],
  ['Tab Đổi lịch âm', 'tabLichamLabel'],
  ['Tab Quản trị', 'tabDashboardLabel']
];

export function BrandingLabelsPanel({ settings, setSettings }: BrandingLabelsPanelProps) {
  return (
    <div className="p-5 space-y-6 animate-fade-in bg-white">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Ký tự chữ triện Thượng thủ (Brand Logo Character)</label>
          <input
            type="text"
            maxLength={2}
            value={settings.brandChar}
            onChange={(event) => setSettings({ ...settings, brandChar: event.target.value })}
            className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal text-center font-bold"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Tiêu đề Dòng họ (Home Title Flag)</label>
          <input
            type="text"
            value={settings.homeTitle}
            onChange={(event) => setSettings({ ...settings, homeTitle: event.target.value })}
            className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#8c716e]/10 pt-5">
        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Địa bàn / Chú thích dòng họ (Home Subtitle)</label>
          <input
            type="text"
            value={settings.homeSubtitle}
            onChange={(event) => setSettings({ ...settings, homeSubtitle: event.target.value })}
            className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Dòng chữ Chân trang (Footer Text Ban liên lạc)</label>
          <input
            type="text"
            value={settings.footerText}
            onChange={(event) => setSettings({ ...settings, footerText: event.target.value })}
            className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-[#8c716e]/10 pt-5">
        <span className="text-xs font-serif font-extrabold text-primary flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-[#7b5800]" />
          <span>Hiệu chỉnh hiển thị TỰ TRÊN CÁC NÚT TAB THƯ MỤC</span>
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {tabFields.map(([label, key]) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-sans font-bold text-ink-charcoal/50 block">{label}</label>
              <input
                type="text"
                value={settings[key] as string}
                onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
                className="w-full text-xs font-sans p-2 border rounded text-ink-charcoal"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
