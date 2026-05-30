import React from 'react';
import { Image, Palette, Sliders } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';

type AppearanceSettingsPanelProps = {
  settings: AppConfig;
  setSettings: React.Dispatch<React.SetStateAction<AppConfig>>;
};

export function AppearanceSettingsPanel({ settings, setSettings }: AppearanceSettingsPanelProps) {
  return (
    <div className="p-5 space-y-6 animate-fade-in bg-white">
      <div className="space-y-4">
        <span className="text-xs font-serif font-extrabold text-primary flex items-center gap-1.5">
          <Image className="w-4 h-4 text-[#7b5800]" />
          <span>Hình ảnh phông nền & Phương thức hòa trộn CSS (Blend Mode)</span>
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Đường dẫn Hình ảnh Phông nền (Unsplash/Imgur/URL)</label>
            <input
              type="text"
              value={settings.backgroundImageUrl}
              onChange={(event) => setSettings({ ...settings, backgroundImageUrl: event.target.value })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Phương thức hòa trộn phông nền (Mix Blend Mode)</label>
            <select
              value={settings.backgroundBlendMode}
              onChange={(event) => setSettings({ ...settings, backgroundBlendMode: event.target.value })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            >
              <option value="multiply">Multiply (Ưu tiên cho giấy sần antique)</option>
              <option value="normal">Normal (Bản gốc nguyên trạng)</option>
              <option value="overlay">Overlay (Phác đè sáng mờ)</option>
              <option value="luminosity">Luminosity (Hòa trộn sắc xám đen phong sương)</option>
              <option value="screen">Screen (Cường lăng sáng phản)</option>
              <option value="darken">Darken (Hòa sắc tối sâu)</option>
              <option value="lighten">Lighten (Sáng dịu tôn)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-[#8c716e]/10 pt-5">
        <span className="text-xs font-serif font-extrabold text-primary flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-[#7b5800]" />
          <span>Hệ sắc màu Vương Gia (Theme Master Keys)</span>
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ['Màu Chủ Đạo (Primary Red)', 'primaryColor'],
            ['Gương Nền (Background Tint)', 'backgroundColorTint'],
            ['Nút Điểm Nhấn (Accent Brass)', 'accentColor'],
            ['Sắc Chữ (Text Ink)', 'textColor']
          ].map(([label, key]) => {
            const value = settings[key as keyof AppConfig] as string;
            return (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-sans font-bold text-ink-charcoal/50 uppercase block">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
                    className="w-8 h-8 rounded border cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
                    className="w-full px-2 text-xs font-mono border rounded focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t border-[#8c716e]/10 pt-5">
        <span className="text-xs font-serif font-extrabold text-primary flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-[#7b5800]" />
          <span>Hiệu chỉnh Kích cỡ & Trục tọa độ Cây Gia Phả</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Độ rộng Node Hộp thành viên (Node Width, px)</label>
            <input
              type="number"
              value={settings.treeNodeWidth}
              onChange={(event) => setSettings({ ...settings, treeNodeWidth: parseInt(event.target.value) || 170 })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Độ dày dây liên kết nhánh (Line Thickness, px)</label>
            <input
              type="number"
              min={1}
              max={6}
              value={settings.treeLineThickness}
              onChange={(event) => setSettings({ ...settings, treeLineThickness: parseInt(event.target.value) || 2 })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Khoảng cách gián cách ngang (Spacing X, px)</label>
            <input
              type="number"
              value={settings.treeSpacingX}
              onChange={(event) => setSettings({ ...settings, treeSpacingX: parseInt(event.target.value) || 185 })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Bo góc hộp phả hệ (Border Radius)</label>
            <select
              value={settings.nodeBorderRadius}
              onChange={(event) => setSettings({ ...settings, nodeBorderRadius: event.target.value })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            >
              <option value="rounded-none">Chữ nhật vuông góc (rounded-none)</option>
              <option value="rounded-sm">Vát nhẹ tự nhiên (rounded-sm)</option>
              <option value="rounded-md">Mượt mà chuẩn mực (rounded-md)</option>
              <option value="rounded-full">Tròn thầu kính (rounded-full)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase block">Màu sọc dây nối gia chi</label>
          <div className="flex gap-2 max-w-xs">
            <input
              type="color"
              value={settings.treeLineColor}
              onChange={(event) => setSettings({ ...settings, treeLineColor: event.target.value })}
              className="w-8 h-8 rounded border cursor-pointer shrink-0"
            />
            <input
              type="text"
              value={settings.treeLineColor}
              onChange={(event) => setSettings({ ...settings, treeLineColor: event.target.value })}
              className="w-full px-2 text-xs font-mono border rounded focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
