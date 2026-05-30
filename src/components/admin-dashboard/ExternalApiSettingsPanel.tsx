import React from 'react';
import { Key, Send } from 'lucide-react';
import { AppConfig } from '../../utils/configManager';

type ExternalApiSettingsPanelProps = {
  settings: AppConfig;
  setSettings: React.Dispatch<React.SetStateAction<AppConfig>>;
};

export function ExternalApiSettingsPanel({ settings, setSettings }: ExternalApiSettingsPanelProps) {
  return (
    <div className="p-5 space-y-6 animate-fade-in bg-white">
      <div className="space-y-4">
        <span className="text-xs font-serif font-extrabold text-primary flex items-center gap-1.5">
          <Key className="w-4 h-4 text-[#7b5800]" />
          <span>Trí tuệ nhân tạo Gemini AI Client</span>
        </span>

        <p className="text-[10px] text-ink-charcoal/60 leading-normal">
          Thiết lập API Key của Google Gemini giúp Trợ lý Thư phòng có thể hỗ trợ giải nghĩa cổ luật phả hề chuyên sâu, trực tiếp bằng dữ liệu thức thời.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Gemini Developer API Key</label>
            <input
              type="password"
              placeholder="Dán mã API Key của Google Cloud (AI Studio)..."
              value={settings.geminiApiKey}
              onChange={(event) => setSettings({ ...settings, geminiApiKey: event.target.value })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Mã Phân bản Gemini (Model Version)</label>
            <select
              value={settings.geminiModelName}
              onChange={(event) => setSettings({ ...settings, geminiModelName: event.target.value })}
              className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Nhanh và tối ưu)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Siêu ngoại suy phả hệ)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Bản cũ ổn định)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-[#8c716e]/10 pt-5 animate-fade-in">
        <span className="text-xs font-serif font-extrabold text-[#0068ff] flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          <span>Zalo Official Account & Chia sẻ Webhook</span>
        </span>

        <p className="text-[10px] text-ink-charcoal/60 leading-normal">
          Khai báo webhook cho phép liên thông đẩy các thông báo giỗ Tổ dòng họ chép từ "Lịch Giỗ" trực tiếp tới tài khoản Zalo OA của bà con cô bác dòng tộc thuận tiện.
        </p>

        <div className="space-y-1">
          <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Zalo Webhook/Sharing API Endpoint URL</label>
          <input
            type="text"
            placeholder="https://api.zalo.me/v2.0/oa/message/transaction..."
            value={settings.zaloWebhookUrl}
            onChange={(event) => setSettings({ ...settings, zaloWebhookUrl: event.target.value })}
            className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-[#0068ff] text-ink-charcoal"
          />
        </div>
      </div>
    </div>
  );
}
