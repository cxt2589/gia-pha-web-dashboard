import { Award, Lock, Maximize2, Unlock, ZoomIn, ZoomOut } from 'lucide-react';

type TreeToolbarProps = {
  zoomLevel: number;
  orientation: 'vertical' | 'horizontal';
  isFullTreeView: boolean;
  isAdmin: boolean;
  clanLeaderRuleActive: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onOrientationChange: (orientation: 'vertical' | 'horizontal') => void;
  onToggleFullTreeView: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAdminButtonClick: () => void;
  onToggleClanLeaderRule: () => void;
};

export function TreeToolbar({
  zoomLevel,
  orientation,
  isFullTreeView,
  isAdmin,
  clanLeaderRuleActive,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onOrientationChange,
  onToggleFullTreeView,
  onExpandAll,
  onCollapseAll,
  onAdminButtonClick,
  onToggleClanLeaderRule
}: TreeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" id="tree-utility-bar">
      <div className="bg-white border border-[#8c716e]/20 rounded p-1 flex items-center space-x-1 shadow-sm">
        <button onClick={onZoomOut} className="p-1.5 hover:bg-[#eeeee9] rounded text-ink-charcoal/75 text-xs font-semibold flex items-center" title="Thu nhỏ">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono px-2 font-bold text-[#7b5800] min-w-[40px] text-center">{zoomLevel}%</span>
        <button onClick={onZoomIn} className="p-1.5 hover:bg-[#eeeee9] rounded text-ink-charcoal/75" title="Phóng to">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onResetZoom} className="p-1.5 hover:bg-[#eeeee9] rounded text-ink-charcoal/50 hover:text-primary" title="Mặc định">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white border border-[#8c716e]/20 rounded p-1 flex items-center shadow-sm">
        <button
          onClick={() => onOrientationChange('vertical')}
          className={`px-3 py-1.5 text-xs font-sans font-medium rounded-sm transition-all ${
            orientation === 'vertical' ? 'bg-primary text-silk-paper font-semibold' : 'text-ink-charcoal/60 hover:text-primary'
          }`}
        >
          Sơ đồ đứng
        </button>
        <button
          onClick={() => onOrientationChange('horizontal')}
          className={`px-3 py-1.5 text-xs font-sans font-medium rounded-sm transition-all ${
            orientation === 'horizontal' ? 'bg-primary text-silk-paper font-semibold' : 'text-ink-charcoal/60 hover:text-primary'
          }`}
        >
          Sơ đồ ngang
        </button>
      </div>

      <button
        onClick={onToggleFullTreeView}
        className={`px-3 py-1.5 text-xs font-sans font-medium rounded shadow-sm transition-all border flex items-center gap-1.5 ${
          isFullTreeView
            ? 'bg-primary border-primary text-silk-paper'
            : 'bg-white border-[#8c716e]/20 hover:border-primary text-ink-charcoal/70 hover:text-primary'
        }`}
        title="Mở rộng phả đồ toàn chiều ngang; thông tin xác thực mở bằng popup khi chọn người"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>{isFullTreeView ? 'Thu gọn phả đồ' : 'Mở rộng phả đồ'}</span>
      </button>

      <div className="flex gap-1">
        <button onClick={onExpandAll} className="px-3 py-1.5 bg-white border border-[#8c716e]/20 hover:border-primary text-ink-charcoal/70 hover:text-primary text-[11px] font-sans rounded shadow-sm" title="Mở toàn nhánh">
          Bung nhánh
        </button>
        <button onClick={onCollapseAll} className="px-3 py-1.5 bg-white border border-[#8c716e]/20 hover:border-primary text-ink-charcoal/70 hover:text-primary text-[11px] font-sans rounded shadow-sm" title="Gọn sơ đồ">
          Thu nhánh
        </button>
      </div>

      <button
        onClick={onAdminButtonClick}
        className={`px-3 py-1.5 text-xs font-sans font-medium rounded shadow-sm transition-all border flex items-center gap-1.5 ${
          isAdmin
            ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
            : 'bg-white border-[#8c716e]/20 hover:border-[#8b1c1c] text-ink-charcoal hover:text-[#8b1c1c]'
        }`}
      >
        {isAdmin ? <Unlock className="w-3.5 h-3.5 text-amber-700" /> : <Lock className="w-3.5 h-3.5" />}
        <span>{isAdmin ? 'Quyền Admin: Bật' : 'Kích hoạt Admin'}</span>
      </button>

      {isAdmin && (
        <button
          onClick={onToggleClanLeaderRule}
          className={`px-3 py-1.5 text-xs font-sans font-medium rounded shadow-sm transition-all border flex items-center gap-1.5 animate-pulse ${
            clanLeaderRuleActive
              ? 'bg-emerald-600 border-emerald-700 text-white font-extrabold shadow-md ring-2 ring-emerald-400/50'
              : 'bg-amber-100 border-amber-400 text-amber-950 font-bold hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-900 shadow-md ring-2 ring-amber-300/50'
          }`}
          title="Kích hoạt thuật toán tự động phân giải Trưởng tộc, Trưởng nam và Đích tôn"
        >
          <Award className={`w-3.5 h-3.5 ${clanLeaderRuleActive ? 'text-amber-300 animate-bounce' : 'text-amber-600'}`} />
          <span>{clanLeaderRuleActive ? 'Kế thừa Gia tộc: BẬT' : 'Kích hoạt Kế thừa Gia tộc'}</span>
        </button>
      )}
    </div>
  );
}
