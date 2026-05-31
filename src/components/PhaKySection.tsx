/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PHA_KY_SECTIONS, COMPONENT_IMAGES } from '../data/lineageData';
import { ArrowRight, Book, History, Shield, Quote } from 'lucide-react';

export default function PhaKySection() {
  const [activeSectionId, setActiveSectionId] = React.useState('nguon-goc');

  // Find the currently active historical section based on side tab selection
  const activeSection = PHA_KY_SECTIONS.find(sec => sec.id === activeSectionId) || PHA_KY_SECTIONS[0];

  return (
    <div className="space-y-16 animate-fade-in" id="phaky-container">
      {/* Editorial Hero Area - exactly recreating the top visual layer of user mockup */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4" id="phaky-hero">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 pr-0 lg:pr-8">
          <div className="flex items-center space-x-2 text-xs font-mono tracking-widest text-secondary uppercase">
            <span className="w-6 h-[1px] bg-secondary"></span>
            <span>Di sản dòng họ Cao</span>
          </div>
          
          <h1 className="font-serif text-[42px] lg:text-[56px] font-bold text-primary leading-[1.1] tracking-tight">
            Phả ký & <br />
            Tộc ước
          </h1>
          
          <p className="text-base text-ink-charcoal/80 leading-relaxed font-sans max-w-lg">
            Nơi gìn giữ hồn cốt của dòng họ Cao Ninh Bình, quy chiếu theo cây phả hiện tại từ Cao Tổ Cao Đình Thuật và Thủy Tổ Cao Đình Lạng.
          </p>
          
          <div className="flex items-center space-x-4 pt-2">
            <a 
              href="#ancestral-detail"
              className="px-5 py-3 bg-primary hover:bg-primary-hover text-silk-paper text-sm font-medium rounded-sm flex items-center space-x-2 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>Chiêm bái Phả Thư</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <div className="flex -space-x-2">
              <span className="w-8 h-8 rounded-full border-2 border-silk-paper bg-secondary flex items-center justify-center text-[10px] font-serif text-silk-paper font-bold shadow-sm">高</span>
              <span className="w-8 h-8 rounded-full border-2 border-silk-paper bg-primary flex items-center justify-center text-[10px] font-serif text-silk-paper font-bold shadow-sm">寧</span>
              <span className="w-8 h-8 rounded-full border-2 border-silk-paper bg-emerald-800 flex items-center justify-center text-[10px] font-serif text-silk-paper font-bold shadow-sm">平</span>
            </div>
          </div>
        </div>

        {/* Traditional Artwork Display Column */}
        <div className="lg:col-span-5 relative group" id="phaky-hero-image">
          <div className="aspect-[4/3] lg:aspect-auto lg:h-[420px] w-full overflow-hidden rounded-sm relative shadow-xl">
            <img 
              src={COMPONENT_IMAGES.inkLandscape} 
              alt="Họ Cao Ninh Bình - tranh thủy mặc" 
              className="object-cover w-full h-full transform scale-100 group-hover:scale-105 transition-transform duration-1000 grayscale-[10%]"
              referrerPolicy="no-referrer"
            />
            {/* Soft dark wash gradients for visual depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90"></div>
            
            {/* Floating red seal tag representing the branch */}
            <div className="absolute bottom-6 left-6 bg-primary py-3 px-5 shadow-lg max-w-[200px]">
              <span className="block font-serif text-lg font-semibold text-silk-paper tracking-wide">
                Họ Cao Ninh Bình
              </span>
              <span className="block font-sans text-[10px] uppercase tracking-widest text-silk-paper/70 mt-1 font-mono">
                Đệ ngũ thế hệ
              </span>
            </div>
          </div>

          {/* Decorative frame elements */}
          <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-secondary/40 pointer-events-none"></div>
          <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-primary/40 pointer-events-none"></div>
        </div>
      </section>

      {/* Narrative Section featuring responsive sub-menu & editorial custom typesetting */}
      <section 
        className="pt-12 border-t border-ink-charcoal/5 grid grid-cols-1 md:grid-cols-12 gap-10 items-start scroll-mt-24"
        id="ancestral-detail"
      >
        {/* Left Side Sub-Navigation tabs */}
        <div className="md:col-span-4 space-y-6" id="phaky-side-tabs">
          <div className="sticky top-28 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-ink-charcoal/40 block pb-2 border-b border-ink-charcoal/10">
              Mục lục phả ký
            </span>
            {PHA_KY_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                id={`phaky-subtab-${sec.id}`}
                onClick={() => setActiveSectionId(sec.id)}
                className={`w-full text-left py-3.5 px-4 rounded-sm flex items-center justify-between group transition-all duration-300 ${
                  activeSectionId === sec.id
                    ? 'bg-primary text-silk-paper font-semibold shadow-md translate-x-2'
                    : 'bg-paper-card text-ink-charcoal/80 hover:bg-ink-charcoal/5 hover:text-primary'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-sm ${activeSectionId === sec.id ? 'bg-silk-paper/10' : 'bg-ink-charcoal/5'}`}>
                    {sec.id === 'nguon-goc' ? <History className="w-4 h-4" /> : sec.id === 'di-cu' ? <Book className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </div>
                  <span className="font-sans text-sm tracking-wide">{sec.title}</span>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  activeSectionId === sec.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`} />
              </button>
            ))}

            {/* Quote of Ancestral Guidance */}
            <div className="p-5 mt-10 bg-secondary/5 rounded-sm border-l-2 border-secondary relative overflow-hidden" id="pha-ky-quote-box">
              <Quote className="absolute right-2 top-2 w-16 h-16 text-secondary/5 transform pointer-events-none" />
              <p className="font-serif text-sm italic text-secondary leading-relaxed">
                "Cây vươn vạn nhánh từ chung rễ, nước cuộn ngàn dòng phát một nguồn. Có hiếu thờ cha kính tổ, muôn thuở hưng long đạo nhà phong."
              </p>
              <span className="block mt-2 font-mono text-[10px] text-ink-charcoal/50 uppercase tracking-wider">— Gia Huấn Ca họ Cao</span>
            </div>
          </div>
        </div>

        {/* Right Side Book-style Narrative Content Block */}
        <div className="md:col-span-8 space-y-10" id="phaky-content-display">
          {/* Main Book-page container */}
          <div className="bg-silk-paper p-8 lg:p-12 border border-ink-charcoal/5 shadow-sm rounded-sm relative" id="book-page">
            {/* Watermark Logo */}
            <div className="absolute right-12 bottom-12 w-32 h-32 text-primary/5 font-serif font-bold text-[120px] leading-none pointer-events-none select-none">
              高
            </div>

            <div className="flex flex-col space-y-4 mb-8">
              <span className="text-xs font-mono text-secondary tracking-widest uppercase">
                {activeSection.sub}
              </span>
              <h2 className="font-serif text-3xl font-bold text-primary leading-tight">
                {activeSection.title}
              </h2>
              <div className="w-12 h-[2px] bg-secondary/50"></div>
            </div>

            {/* Drop Cap & Editorial text columns */}
            <div className="prose prose-stone max-w-none">
              <p className="text-lg lg:text-xl text-ink-charcoal/90 leading-relaxed font-sans font-medium mb-6">
                <span className="float-left text-primary font-serif font-bold text-7xl lg:text-8xl leading-[0.8] mr-3 mt-1 text-center select-none">
                  {activeSection.dropCap}
                </span>
                {activeSection.text}
              </p>
              
              <p className="text-base text-ink-charcoal/70 leading-relaxed font-sans text-justify pt-4 border-t border-ink-charcoal/5">
                {activeSection.extraText}
              </p>
            </div>

            {/* Navigation buttons inside book-page represent traditional reader interface */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-ink-charcoal/5 text-xs text-ink-charcoal/40 font-mono">
              <span>TRANG {activeSectionId === 'nguon-goc' ? 'I / III' : activeSectionId === 'di-cu' ? 'II / III' : 'III / III'}</span>
              <span>BẢN DỊCH KHẢO CỔ — PHẢ CỔ 1689</span>
            </div>
          </div>

          {/* Architectural Secondary Section - Hành trình di cư và Tòa miếu cổ */}
          <div className="bg-paper-card p-6 rounded-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center" id="phaky-secondary-heritage">
            <div className="lg:col-span-7 space-y-3">
              <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Di sản kiến trúc</span>
              <h3 className="font-serif text-xl font-bold text-primary">Từ đường cổ kính họ Cao Ninh Bình</h3>
              <p className="text-xs text-ink-charcoal/70 leading-relaxed">
                Không gian từ đường và phả ký họ Cao Ninh Bình đang được số hóa, các chi tiết kiến trúc, văn bia và hiện vật cần được bổ sung bằng tài liệu xác thực trước khi công bố rộng rãi.
              </p>
            </div>
            
            <div className="lg:col-span-5 h-[160px] overflow-hidden rounded-sm relative shadow-md">
              <img 
                src={COMPONENT_IMAGES.templeRoof} 
                alt="Ancient temple roof decoration" 
                className="object-cover w-full h-full grayscale-[10%] hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              <span className="absolute bottom-2 right-2 text-[9px] font-mono text-silk-paper bg-primary/80 py-0.5 px-1.5 uppercase">Mái Từ Đường</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
