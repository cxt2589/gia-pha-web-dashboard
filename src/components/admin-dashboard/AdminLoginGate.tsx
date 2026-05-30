import React from 'react';
import { CheckCircle, Sliders } from 'lucide-react';

type AdminLoginGateProps = {
  passwordInput: string;
  loginError: string;
  setPasswordInput: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function AdminLoginGate({
  passwordInput,
  loginError,
  setPasswordInput,
  onSubmit
}: AdminLoginGateProps) {
  return (
    <div className="max-w-md mx-auto my-12 bg-white border border-[#8c716e]/15 shadow-2xl rounded p-8 space-y-6" id="admin-login-view-hub">
      <div className="text-center space-y-2">
        <span className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
          <Sliders className="w-6 h-6" />
        </span>
        <h2 className="font-serif text-2xl font-bold text-primary">Đăng Nhập Quản Trị</h2>
        <p className="text-xs text-ink-charcoal/60 leading-relaxed font-sans">
          Bảng cấu hình dành riêng cho Ban liên lạc dòng họ để hiệu chỉnh màu sắc giao diện, nút bấm, sơ đồ cây và cổng API.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-sans font-bold text-ink-charcoal/70 uppercase">Mật khẩu admin</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu quản quản trị..."
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            className="w-full text-sm p-2.5 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal placeholder-ink-charcoal/30"
            required
          />
          <p className="text-[10px] text-primary/75 italic">
            *Mật khẩu dùng thử nhanh: <strong>123</strong>
          </p>
        </div>

        {loginError && (
          <div className="text-xs text-primary font-medium bg-primary/5 p-2 rounded border border-primary/25">
            ⚠️ {loginError}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 bg-[#8b1c1c] hover:bg-[#a02222] text-silk-paper rounded font-sans font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <CheckCircle className="w-4 h-4" />
          <span>KÍCH HOẠT HỆ THỐNG</span>
        </button>
      </form>
    </div>
  );
}
