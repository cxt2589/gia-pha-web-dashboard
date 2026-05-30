import React from 'react';
import { Home, Search } from 'lucide-react';

type TreeSearchBoxProps = {
  searchTerm: string;
  resultCount: number;
  onSearchTermChange: (value: string) => void;
  onSubmit: () => void;
  onReturnToRoot: () => void;
};

export function TreeSearchBox({
  searchTerm,
  resultCount,
  onSearchTermChange,
  onSubmit,
  onReturnToRoot
}: TreeSearchBoxProps) {
  const hasSearchTerm = searchTerm.trim().length > 0;
  const canSubmit = hasSearchTerm && resultCount > 0;

  return (
    <div className="mb-4 relative z-10 max-w-md">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffe8a8]" />
          <input
            type="text"
            placeholder="Tìm tên, năm sinh, nơi ở..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              }
            }}
            className="bg-primary border border-[#d8b765]/70 rounded-md pl-9 pr-3 py-2.5 text-sm w-full focus:outline-none focus:border-[#d8b765]/70 focus:ring-0 text-silk-paper placeholder:text-gray-300/45 placeholder:italic font-medium"
            id="inside-search-tree"
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="group shrink-0 w-14 px-3 py-2.5 overflow-hidden bg-primary hover:bg-[#a3312b] active:bg-[#7f1f1b] disabled:bg-ink-charcoal/25 disabled:text-silk-paper/70 text-[#ffe8a8] rounded-md text-sm font-semibold shadow-sm border border-[#d8b765]/50 transition-colors duration-150 active:shadow-inner"
        >
          <span className="inline-block transition-all duration-150 group-active:scale-110 group-active:text-silk-paper">Tìm</span>
        </button>
        <button
          type="button"
          onClick={onReturnToRoot}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[#d8b765]/55 bg-white px-3 py-2.5 text-xs font-bold text-primary shadow-sm hover:bg-[#fff7df]"
          title="Về cụ Cao Tổ"
        >
          <Home className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Về gốc</span>
        </button>
      </div>
      {hasSearchTerm && (
        <div className="mt-1 text-[10px] font-mono text-[#7b5800]">
          {resultCount > 0
            ? `${resultCount} kết quả. Nhấn Enter để tới kết quả đầu tiên.`
            : 'Không tìm thấy trong phả đồ.'}
        </div>
      )}
    </div>
  );
}
