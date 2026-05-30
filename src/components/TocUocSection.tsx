/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, ShieldCheck, Heart, Sparkles } from 'lucide-react';

export default function TocUocSection() {
  return (
    <div className="space-y-16 animate-fade-in max-w-5xl mx-auto py-4" id="tocuoc-container">
      {/* Header Section */}
      <header className="text-center mb-16" id="tocuoc-header">
        <div className="inline-block mb-6 relative">
          <div className="absolute -inset-4 border border-primary/10 rounded-xl pointer-events-none"></div>
          <div className="w-16 h-16 bg-white border border-secondary/20 flex items-center justify-center rounded-lg shadow-sm text-secondary">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 13-5 5" />
              <path d="m3 21 3-3" />
              <path d="m16 11-4-4" />
              <path d="m11 16-4-4" />
              <path d="m20 15-5-5L17 8l5 5-2 2Z" />
              <path d="m7 12 5-5L10 5 5 10l2 2Z" />
              <path d="M15 4h6v6" />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary tracking-tight mb-4">
          Tộc ước Cao Gia
        </h1>
        <p className="text-lg md:text-xl font-serif italic text-ink-charcoal/70">
          Gìn giữ nề nếp, phát huy truyền thống
        </p>
        <div className="mt-12 h-px w-32 bg-secondary/30 mx-auto"></div>
      </header>

      {/* Bento Layout for Core Values */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-24" id="tocuoc-bento-grid">
        
        {/* Đạo Hiếu SECTION (col-span-12 lg:col-span-7) */}
        <section className="lg:col-span-7 bg-paper-card p-8 md:p-12 rounded-lg relative overflow-hidden group border border-ink-charcoal/5 shadow-sm">
          <div className="relative z-10 space-y-4">
            <span className="text-xs font-mono tracking-[0.2em] text-secondary uppercase block">
              CHƯƠNG I
            </span>
            <h2 className="text-3xl font-serif font-bold text-primary">
              Đạo Hiếu &amp; Tổ Tiên
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-ink-charcoal/90 text-justify font-sans">
              <p>
                Lấy chữ Hiếu làm đầu, con cháu họ Cao đời đời ghi nhớ công ơn sinh thành dưỡng dục. Việc phụng thờ tổ tiên phải được thực hiện trang nghiêm, đúng lễ nghi truyền thống.
              </p>
              <ul className="list-none space-y-3.5 pt-4">
                <li className="flex items-start">
                  <span className="text-secondary mr-3 text-xs mt-1 select-none">✦</span>
                  <span>Chăm lo phụng dưỡng cha mẹ khi về già, đảm bảo đời sống tinh thần và vật chất.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-secondary mr-3 text-xs mt-1 select-none">✦</span>
                  <span>Giữ gìn, tôn tạo từ đường và các phần mộ tổ tiên luôn sạch đẹp, tôn nghiêm.</span>
                </li>
              </ul>
            </div>
          </div>
          {/* Faded background Vietnamese pagoda vector hán tự temple art */}
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-700 select-none pointer-events-none">
            <svg className="w-48 h-48 text-secondary" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
              {/* Ornate layered lineage pagoda roof line representation */}
              <path d="M10 80 Q 50 77 90 80" />
              <path d="M20 60 Q 50 58 80 60" />
              <path d="M30 40 Q 50 38 70 40" />
              <path d="M40 20 L 50 10 L 60 20 Z" />
              <path d="M48 20 L 48 80 M52 20 L 52 80" strokeDasharray="1 2" />
              <path d="M25 60 L 25 80 M75 60 L 75 80" />
              <path d="M35 40 L 35 60 M65 40 L 65 60" />
              {/* Swept structural ends */}
              <path d="M10 80 C 5 80 2 75 5 70 Q 15 70 15 70" />
              <path d="M90 80 C 95 80 98 75 95 70 Q 85 70 85 70" />
              <path d="M20 60 C 15 60 12 55 14 50 Q 23 50 23 50" />
              <path d="M80 60 C 85 60 88 55 86 50 Q 77 50 77 50" />
            </svg>
          </div>
        </section>

        {/* Học Vấn SECTION (col-span-12 lg:col-span-5) */}
        <section className="lg:col-span-5 bg-primary text-silk-paper p-8 md:p-12 rounded-lg flex flex-col justify-between border border-primary-hover shadow-md relative overflow-hidden group">
          <div className="space-y-4">
            <span className="text-xs font-mono tracking-[0.2em] text-[#fdc34d] uppercase block">
              CHƯƠNG II
            </span>
            <h2 className="text-3xl font-serif font-bold text-silk-paper">
              Học Vấn &amp; Tài Năng
            </h2>
            <p className="text-sm leading-relaxed text-silk-paper/85 text-justify font-sans">
              Khuyến khích con cháu dù ở phương trời nào cũng phải lấy việc học làm trọng, đem tài đức cống hiến cho xã hội và làm rạng danh dòng họ.
            </p>
          </div>

          <div className="mt-8 p-6 bg-primary-hover/50 border border-silk-paper/10 rounded-sm relative z-10">
            <h4 className="font-serif font-bold text-base text-silk-paper mb-2.5 flex items-center space-x-2">
              <Award className="w-5 h-5 text-[#fdc34d]" />
              <span>Quỹ Khuyến Học Cao Gia</span>
            </h4>
            <p className="text-xs text-silk-paper/80 leading-relaxed font-sans">
              Hằng năm tổ chức tuyên dương và cấp học bổng cho các cá nhân có thành tích xuất sắc trong học tập và nghiên cứu.
            </p>
          </div>
        </section>

        {/* Tương Thân Tương Ái SECTION (col-span-12 lg:col-span-5) */}
        <section className="lg:col-span-5 bg-paper-card p-8 md:p-12 rounded-lg flex flex-col justify-between border border-ink-charcoal/5 shadow-sm">
          <div className="space-y-4">
            <span className="text-xs font-mono tracking-[0.2em] text-secondary uppercase block">
              CHƯƠNG III
            </span>
            <h2 className="text-3xl font-serif font-bold text-primary">
              Tương Thân Tương Ái
            </h2>
            <p className="text-sm leading-relaxed text-ink-charcoal/80 text-justify font-sans">
              &quot;Giọt máu đào hơn ao nước lã&quot;. Con cháu trong họ phải biết yêu thương, đùm bọc lẫn nhau trong lúc khó khăn, hoạn nạn.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white p-4 rounded-sm border border-black/[0.03] shadow-sm flex flex-col justify-between min-h-[90px]">
              <span className="text-[10px] font-mono font-bold uppercase text-secondary tracking-widest block mb-1">
                HỖ TRỢ
              </span>
              <p className="text-xs text-ink-charcoal/80 leading-snug">Gia đình khó khăn, neo đơn.</p>
            </div>
            <div className="bg-white p-4 rounded-sm border border-black/[0.03] shadow-sm flex flex-col justify-between min-h-[90px]">
              <span className="text-[10px] font-mono font-bold uppercase text-secondary tracking-widest block mb-1">
                KẾT NỐI
              </span>
              <p className="text-xs text-ink-charcoal/80 leading-snug">Tạo việc làm cho thanh niên.</p>
            </div>
          </div>
        </section>

        {/* Nề Nếp & Gia Phong SECTION (col-span-12 lg:col-span-7) */}
        <section className="lg:col-span-7 bg-white p-8 md:p-12 rounded-lg border border-ink-charcoal/5 shadow-sm space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-mono tracking-[0.2em] text-secondary uppercase block">
              CHƯƠNG IV
            </span>
            <h2 className="text-3xl font-serif font-bold text-primary">
              Nề Nếp &amp; Gia Phong
            </h2>
            <p className="text-sm leading-relaxed text-ink-charcoal/85 text-justify font-sans">
              Xây dựng nếp sống văn minh, lịch sự trong giao tiếp và sinh hoạt. Tuân thủ pháp luật nhà nước và các quy định của địa phương nơi cư trú.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-ink-charcoal/5">
            <div className="space-y-2">
              <h4 className="font-serif font-bold text-ink-charcoal text-base">Hôn hỉ &amp; Tang chế</h4>
              <p className="text-xs text-ink-charcoal/70 leading-relaxed text-justify">
                Tổ chức tiết kiệm, trang trọng, tránh phô trương lãng phí nhưng vẫn giữ được bản sắc văn hóa Cao Gia.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-serif font-bold text-ink-charcoal text-base">Lời ăn tiếng nói</h4>
              <p className="text-xs text-ink-charcoal/70 leading-relaxed text-justify">
                Kính trên nhường dưới, xưng hô đúng tôn ti trật tự theo thế hệ trong dòng tộc.
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Seal of Approval Section with Wax stamp link */}
      <section className="mt-20 text-center p-8 md:p-12 bg-paper-card rounded-xl border border-secondary/10 relative overflow-hidden shadow-sm" id="tocuoc-certificate">
        {/* Subtle ornate background corners */}
        <div className="absolute top-3 left-3 w-5 h-5 border-t border-l border-secondary/30"></div>
        <div className="absolute top-3 right-3 w-5 h-5 border-t border-r border-secondary/30"></div>
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b border-l border-secondary/30"></div>
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b border-r border-secondary/30"></div>

        {/* Big wax seal of Cao Family placed centered */}
        <div className="relative -mt-20 mb-6 flex justify-center z-10">
          <div className="w-28 h-28 bg-silk-paper p-1 rounded-full shadow-lg border border-secondary/15 overflow-hidden flex items-center justify-center">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZ7a0JeWNymV15txCwW5YAExtqzrKIEfJtBTX6RYBpM6qDR_IQDjMZv4hCQgP1LqnqG2G4saOvJ3PaZiIm3r_xsq9m208Np_ATNLRmorw0L79Z7iXXhxCcbpusaRkzjItlq0etoGvwX4kNXeOIczZEkCsu2gGwSOAkhgJoMv2NRIwRobif1bEP2xa2pcklidK0o2-ue8HLdC5qPDTKdttW52ILvuqwo7r9Nw4Z4mqC_y2iBm_BJZ7lqPBR3nxy_sg6QkDf-1lrOw" 
              alt="Lineage Seal" 
              className="w-full h-full object-cover rounded-full mix-blend-multiply opacity-80 contrast-125 grayscale"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <h3 className="text-2xl font-serif font-bold text-primary mb-12">
          Chứng thực bởi Hội đồng tộc biểu
        </h3>

        {/* Responsive Signatories Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 items-center max-w-4xl mx-auto mb-6">
          
          {/* Signatory left: Trưởng tộc */}
          <div className="space-y-2 flex flex-col items-center">
            <p className="font-serif italic text-xs text-ink-charcoal/50">Trưởng tộc</p>
            <p className="text-xl md:text-2xl font-serif font-bold text-ink-charcoal">Cao Văn Minh</p>
            <div className="h-[1px] w-24 bg-primary/20 mt-3"></div>
          </div>

          {/* Center Ornate Double Circle stamp saying Chuơng Ấn */}
          <div className="flex justify-center select-none">
            <div className="w-28 h-28 border-4 border-double border-primary/20 rounded-full flex items-center justify-center bg-primary/5">
              <span className="font-serif font-bold text-xs text-primary/70 tracking-widest text-center leading-normal uppercase">
                Chương<br />Ấn
              </span>
            </div>
          </div>

          {/* Signatory right: Thư ký Hội đồng */}
          <div className="space-y-2 flex flex-col items-center">
            <p className="font-serif italic text-xs text-ink-charcoal/50">Thư ký Hội đồng</p>
            <p className="text-xl md:text-2xl font-serif font-bold text-ink-charcoal">Cao Thế Anh</p>
            <div className="h-[1px] w-24 bg-primary/20 mt-3"></div>
          </div>

        </div>

        <p className="mt-16 text-[10px] font-mono tracking-widest text-ink-charcoal/50 uppercase">
          Ban hành ngày 15 tháng 01 năm Giáp Thìn
        </p>
      </section>
    </div>
  );
}
