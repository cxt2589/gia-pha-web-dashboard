/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Share2, Printer, Download } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: string) => void;
}

export default function Footer({ setActiveTab }: FooterProps) {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Họ Cao Ninh Bình - Di sản Dòng họ',
        text: 'Chiêm bái Phả ký, Gia phả và Tộc ước dòng họ Cao Ninh Bình.',
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert('Đường dẫn chia sẻ liên kết gia phả đã được sao chép vào bộ nhớ tạm!');
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <footer 
      className="bg-silk-paper border-t border-ink-charcoal/10 py-8 px-6 lg:px-12 mt-16 text-xs text-ink-charcoal/60"
      id="app-footer"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left Side copyright and branding */}
        <div className="space-y-1 text-center md:text-left">
          <h4 className="font-serif text-sm font-bold text-primary">Họ Cao Ninh Bình</h4>
          <p>© 2026 Ban Trị Sự Họ Cao Ninh Bình. Dữ liệu phả hệ đang được kiểm chứng và số hóa.</p>
        </div>

        {/* Right side links and tools */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-6 font-semibold">
            <button 
              onClick={() => alert('Liên hệ Ban trị sự họ Cao Ninh Bình qua kênh liên lạc chính thức của dòng họ.')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Liên hệ
            </button>
            <button 
              onClick={() => alert('Đường dẫn bản đồ từ đường họ Cao Ninh Bình đang được Ban trị sự cập nhật.')} 
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Bản đồ
            </button>
            <button 
              onClick={() => setActiveTab('tin-tuc')} 
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Đóng góp
            </button>
          </div>

          {/* Icon trigger buttons as shown in user's mockup footer */}
          <div className="flex items-center space-x-4 border-t sm:border-t-0 sm:border-l border-ink-charcoal/10 pt-4 sm:pt-0 sm:pl-6" id="footer-action-icons">
            <button 
              onClick={handleShare}
              className="p-2 text-ink-charcoal/50 hover:text-primary rounded-full hover:bg-primary/5 transition-all"
              title="Chia sẻ lưu trữ"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2 text-ink-charcoal/50 hover:text-primary rounded-full hover:bg-primary/5 transition-all"
              title="In ấn hoặc lưu PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                alert('Tải xuống toàn văn Tộc ước và Bản dịch Phả ký PDF chính sắc của gia tộc linh bái.');
              }}
              className="p-2 text-ink-charcoal/50 hover:text-primary rounded-full hover:bg-primary/5 transition-all"
              title="Tải xuống Gia thư"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
