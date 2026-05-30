/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LINEAGE_NEWS_DATA, CLAN_CONTRIBUTIONS } from '../data/lineageData';
import { Share2, Printer, Download, ArrowRight, Table, Landmark, HandHelping, Trophy, Coins, MessageCircleCode, Sparkles } from 'lucide-react';

export default function TinTucSection() {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  
  // Contribution state to show live contributions & simulated additions
  const [contributions, setContributions] = React.useState(CLAN_CONTRIBUTIONS);
  const [newDonorName, setNewDonorName] = React.useState('');
  const [newDonorAmount, setNewDonorAmount] = React.useState('');
  const [newDonorPurpose, setNewDonorPurpose] = React.useState('');

  const filterCategories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'su_kien', label: 'Sự kiện' },
    { id: 'hoat_dong', label: 'Khuyến học & Hoạt động' },
    { id: 'dong_gop', label: 'Kêu gọi công đức' }
  ];

  const filteredNews = React.useMemo(() => {
    if (selectedCategory === 'all') return LINEAGE_NEWS_DATA;
    return LINEAGE_NEWS_DATA.filter(n => n.category === selectedCategory);
  }, [selectedCategory]);

  const handleApplyDonation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDonorName.trim() || !newDonorAmount.trim() || !newDonorPurpose.trim()) return;

    setContributions(prev => [
      {
        id: `nc-${Date.now()}`,
        name: newDonorName,
        generation: 15,
        branch: 'Ban tòng bái tự',
        amount: newDonorAmount + ' VND',
        purpose: newDonorPurpose,
        date: new Date().toLocaleDateString('vi-VN')
      },
      ...prev
    ]);
    setNewDonorName('');
    setNewDonorAmount('');
    setNewDonorPurpose('');
  };

  return (
    <div className="space-y-12 animate-fade-in" id="tintuc-container">
      {/* Top Banner & Quick Intro */}
      <section className="bg-gradient-to-r from-primary to-primary-hover p-8 md:p-12 text-silk-paper rounded-sm shadow-lg relative overflow-hidden" id="tintuc-welcome-banner">
        <div className="absolute right-0 bottom-0 select-none pointer-events-none opacity-5 translate-y-6">
          <Landmark className="w-96 h-96" />
        </div>
        <div className="max-w-2xl space-y-4 relative z-10">
          <span className="text-[10px] uppercase font-mono tracking-widest text-secondary bg-silk-paper/10 py-1 px-2.5 rounded-full">
            Tin Tức & Truyền Thông Gia Tộc
          </span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
            Ban trị sự họ Cao Ninh Bình kính chào con cháu nội ngoại
          </h1>
          <p className="text-sm text-silk-paper/85 leading-relaxed font-sans max-w-xl">
            Cổng thông tin kết nối con cháu họ Cao, phục vụ tra cứu phả hệ, cập nhật tin tức, đóng góp tư liệu và gìn giữ cội nguồn gia tộc.
          </p>
        </div>
      </section>

      {/* Main Core grid: News feeds on Left, Ledger / form on Right */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left column of News item cards */}
        <div className="xl:col-span-7 space-y-8" id="news-column">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-charcoal/10 pb-4">
            <h2 className="font-serif text-xl font-bold text-primary flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-secondary" />
              <span>Bản tin quy phái đầu năm</span>
            </h2>

            {/* Custom filters */}
            <div className="flex flex-wrap gap-1.5" id="news-cats-filters">
              {filterCategories.map((cat) => (
                <button
                  key={cat.id}
                  id={`cat-filter-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`py-1.5 px-3 text-xs font-sans font-medium rounded-sm transition-all duration-200 ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-silk-paper shadow-sm'
                      : 'bg-paper-card text-ink-charcoal/70 hover:bg-ink-charcoal/5 hover:text-primary'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {filteredNews.map((news) => (
              <article 
                key={news.id}
                id={`news-card-${news.id}`}
                className="bg-white border border-ink-charcoal/5 rounded-sm overflow-hidden hover:shadow-md transition-shadow duration-300 grid grid-cols-1 md:grid-cols-12 gap-6 p-5"
              >
                {/* News Image representation if any */}
                {news.imageUrl && (
                  <div className="md:col-span-4 h-40 md:h-full overflow-hidden rounded-sm relative shadow-inner">
                    <img 
                      src={news.imageUrl} 
                      alt={news.title}
                      className="object-cover w-full h-full grayscale-[5%] scale-100 hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                
                {/* News texts */}
                <div className={`${news.imageUrl ? 'md:col-span-8' : 'md:col-span-12'} flex flex-col justify-between space-y-4`}>
                  <div className="space-y-2">
                    {/* Tag + author */}
                    <div className="flex justify-between items-center text-[10px] font-mono text-ink-charcoal/40 font-semibold tracking-wider">
                      <span className="text-secondary bg-secondary/5 py-0.5 px-1.5 rounded-sm uppercase">
                        {news.category === 'su_kien' ? 'Lịch sự kiện' : news.category === 'hoat_dong' ? 'Khuyến học' : 'Kêu gọi tòng bảo'}
                      </span>
                      <span>{news.date}</span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-primary group-hover:text-primary-hover leading-snug">
                      {news.title}
                    </h3>
                    
                    <p className="text-xs text-ink-charcoal/75 leading-relaxed font-sans line-clamp-3">
                      {news.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-ink-charcoal/5 text-[11px] font-sans text-ink-charcoal/50">
                    <span>Đăng tuyển: <strong>{news.author}</strong></span>
                    <button 
                      onClick={() => alert(`Lịch sử chi tiết bài viết: "${news.title}" đang được liên hệ sao chép bản quyển phả hệ truyền lục.`)}
                      className="text-primary hover:text-primary-hover flex items-center space-x-1 font-semibold group cursor-pointer"
                    >
                      <span>Xem đầy đủ</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Right column: Contributions Ledgers and custom donor logger */}
        <div className="xl:col-span-5 space-y-8" id="contribution-column">
          <div className="space-y-1.5 border-b border-ink-charcoal/10 pb-4">
            <h2 className="font-serif text-xl font-bold text-primary flex items-center space-x-2">
              <HandHelping className="w-5 h-5 text-secondary" />
              <span>Sổ vàng công đức lưu truyền</span>
            </h2>
            <p className="text-xs text-ink-charcoal/50">Cập nhật công khai và trong suốt các đóng góp phục vụ số hóa, khuyến học và gìn giữ phả hệ.</p>
          </div>

          {/* Interactive quick form to simulated donor and append log to table */}
          <div className="bg-silk-paper border border-secondary/20 p-5 rounded-sm shadow-inner" id="donor-portal-box">
            <h4 className="font-serif text-sm font-bold text-primary mb-3 flex items-center space-x-1">
              <Coins className="w-4 h-4 text-secondary" />
              <span>Gió công đức phát bái vọng niệm</span>
            </h4>
            
            <form onSubmit={handleApplyDonation} className="space-y-3" id="donation-submit-form">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Họ & Tên cư dân"
                  value={newDonorName}
                  onChange={(e) => setNewDonorName(e.target.value)}
                  className="bg-white border border-ink-charcoal/10 py-1.5 px-2.5 text-xs focus:outline-none focus:border-primary rounded-sm"
                  id="donor-name-field"
                />
                <input
                  type="text"
                  required
                  placeholder="Kinh văn (Ví dụ: 2.000.000)"
                  value={newDonorAmount}
                  onChange={(e) => setNewDonorAmount(e.target.value)}
                  className="bg-white border border-ink-charcoal/10 py-1.5 px-2.5 text-xs focus:outline-none focus:border-primary rounded-sm"
                  id="donor-amount-field"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Mục đích dâng lễ (Ví dụ: Quỹ khuyến học đời 15)"
                value={newDonorPurpose}
                onChange={(e) => setNewDonorPurpose(e.target.value)}
                className="bg-white border border-ink-charcoal/10 py-1.5 px-2.5 text-xs focus:outline-none focus:border-primary rounded-sm w-full"
                id="donor-purpose-field"
              />
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-silk-paper font-sans font-semibold text-xs py-2 rounded-sm transition-all"
                id="donor-submit-btn"
              >
                Cát Tòng Phát Thệ Công Đức
              </button>
            </form>
          </div>

          {/* List ledger table */}
          <div className="bg-white rounded-sm border border-ink-charcoal/5 overflow-hidden shadow-sm shadow-inner" id="contribution-table-panel">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="bg-paper-card text-ink-charcoal/50 border-b border-ink-charcoal/5 font-mono">
                  <th className="p-3">HÀNH VIÊN dâng cúng</th>
                  <th className="p-3">KINH TẾ</th>
                  <th className="p-3">MỤC ĐÍCH</th>
                  <th className="p-3 text-right">NGÀY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-charcoal/5" id="contributions-table-rows">
                {contributions.map((con) => (
                  <tr key={con.id} className="hover:bg-silk-paper transition-colors duration-150">
                    <td className="p-3 font-semibold text-primary">{con.name}</td>
                    <td className="p-3 text-secondary font-semibold font-mono">{con.amount}</td>
                    <td className="p-3 text-ink-charcoal/70 line-clamp-1 truncate max-w-[130px]">{con.purpose}</td>
                    <td className="p-3 text-right text-ink-charcoal/40 font-mono">{con.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
