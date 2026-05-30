import { MousePointerClick } from 'lucide-react';

export function TreeCanvasLegend() {
  return (
    <div className="flex justify-between items-center mb-6 relative z-10 text-[10px] font-mono text-[#7b5800] bg-white/70 p-2.5 rounded border border-ink-charcoal/5">
      <div className="flex items-center gap-1.5">
        <MousePointerClick className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span>Bấm click chọn cụ tổ/con cháu để mở tiểu sử chiêu bái</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-primary/10 border border-primary rounded-sm inline-block"></span>
          <span>Thế hệ dục bái</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-rose-50 border border-rose-100 rounded-sm inline-block"></span>
          <span>Phối ngẫu (Vợ / Chồng)</span>
        </span>
      </div>
    </div>
  );
}
