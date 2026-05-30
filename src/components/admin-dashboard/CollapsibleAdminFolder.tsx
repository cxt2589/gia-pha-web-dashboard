import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';

type CollapsibleAdminFolderProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function CollapsibleAdminFolder({
  title,
  isOpen,
  onToggle,
  children
}: CollapsibleAdminFolderProps) {
  return (
    <div className="border border-[#8c716e]/15 rounded bg-white overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full p-4 bg-slate-50 flex items-center justify-between border-b border-[#8c716e]/10 text-left hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center space-x-3 text-primary font-serif font-bold text-sm md:text-base">
          {isOpen ? (
            <FolderOpen className="w-5.5 h-5.5 text-[#7b5800]" />
          ) : (
            <Folder className="w-5.5 h-5.5 text-[#7b5800]" />
          )}
          <span>{title}</span>
        </div>
        <span className="text-[10px] font-mono text-ink-charcoal/40 font-bold uppercase">
          {isOpen ? 'Thu gọn ▲' : 'Mở rộng ▼'}
        </span>
      </button>

      {isOpen && children}
    </div>
  );
}
