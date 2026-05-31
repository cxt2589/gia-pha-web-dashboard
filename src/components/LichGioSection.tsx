/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ANNIVERSARY_EVENTS } from '../data/lineageData';
import { Calendar, MapPin, Sparkles, User, ListChecks, Heart, Landmark, FlameKindling } from 'lucide-react';

type VerifiedAnniversary = {
  memberId: string;
  memberName: string;
  generation?: number;
  title?: string;
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  solarDate: string;
  solarDisplayDate?: string;
  daysUntil?: number | null;
  source: string;
  certainty: string;
  note?: string;
};

export default function LichGioSection() {
  const [virtualIncenses, setVirtualIncenses] = React.useState<Array<{ name: string; message: string; date: string }>>([
    { name: 'Cao Gia Tuấn', message: 'Kính lạy cụ Tổ, cháu ở xa quê hương không về bái tế mong cụ hiển linh phù hộ bản tộc cát tường.', date: '27/05/2026' },
    { name: 'Cao Khánh Linh', message: 'Con cháu đời tiếp nối nguyện tạc dạ nếp nhà thi thư của cha ông dưỡng đức lập thân.', date: '26/05/2026' }
  ]);
  const [donorName, setDonorName] = React.useState('');
  const [donorMessage, setDonorMessage] = React.useState('');
  const [offeringType, setOfferingType] = React.useState<'nhang' | 'hoa' | 'tra'>('nhang');
  const [offeringCount, setOfferingCount] = React.useState(122); // Simulated count of total ancestral offerings
  const [verifiedAnniversaries, setVerifiedAnniversaries] = React.useState<VerifiedAnniversary[]>([]);
  const [anniversaryLoading, setAnniversaryLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadAnniversaries = async () => {
      setAnniversaryLoading(true);
      try {
        const response = await fetch('/api/anniversaries/upcoming?days=366');
        const data = await response.json();
        if (!cancelled && Array.isArray(data.anniversaries)) {
          setVerifiedAnniversaries(data.anniversaries);
        }
      } catch {
        if (!cancelled) setVerifiedAnniversaries([]);
      } finally {
        if (!cancelled) setAnniversaryLoading(false);
      }
    };
    loadAnniversaries();
    return () => {
      cancelled = true;
    };
  }, []);

  // Form submit handler to add new live virtual incense logs
  const handleOfferIncense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !donorMessage.trim()) return;

    setVirtualIncenses(prev => [
      {
        name: donorName,
        message: donorMessage,
        date: new Date().toLocaleDateString('vi-VN')
      },
      ...prev
    ]);
    setOfferingCount(prev => prev + 1);
    setDonorName('');
    setDonorMessage('');
  };

  return (
    <div className="space-y-12 animate-fade-in" id="lichgio-container">
      {/* Page Header */}
      <section className="border-b border-ink-charcoal/10 pb-6 space-y-1">
        <span className="text-[11px] font-mono tracking-widest text-secondary uppercase block">Thần điện tế tự</span>
        <h1 className="font-serif text-3xl font-bold text-primary">Lịch kỵ nhật & Ghi lễ tộc</h1>
      </section>

      {/* Main Grid: Left side calendar list, Right side virtual portal */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Death anniversary list */}
        <div className="xl:col-span-7 space-y-6" id="anniversaries-list-column">
          <div className="space-y-1.5 mb-6">
            <h2 className="font-serif text-xl font-bold text-primary flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-secondary" />
              <span>Chánh Giỗ Cổ Lễ Gia Tộc</span>
            </h2>
            <p className="text-xs text-ink-charcoal/60">Danh sách các giỗ lớn theo dữ liệu phả hệ họ Cao Ninh Bình đang được kiểm chứng.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-secondary/20 rounded-sm p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Lịch giỗ xác minh từ phả hệ</h3>
                  <p className="text-xs text-ink-charcoal/60">Quy đổi âm lịch sang dương lịch cho năm hiện tại, chỉ dùng dữ liệu đã duyệt/applied hoặc dữ liệu phả hệ đọc được.</p>
                </div>
                <span className="text-[10px] font-mono uppercase text-secondary bg-secondary/10 px-2 py-1 rounded-sm">
                  {anniversaryLoading ? 'Đang tải' : `${verifiedAnniversaries.length} mục`}
                </span>
              </div>
              {verifiedAnniversaries.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {verifiedAnniversaries.slice(0, 8).map((item) => (
                    <div key={`${item.memberId}-${item.solarDate}`} className="border border-ink-charcoal/10 bg-silk-paper/50 rounded-sm p-3 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="font-serif text-sm text-primary">{item.memberName}</strong>
                        {typeof item.daysUntil === 'number' && (
                          <span className="font-mono text-[10px] text-secondary">{item.daysUntil === 0 ? 'Hôm nay' : `${item.daysUntil} ngày`}</span>
                        )}
                      </div>
                      {item.title && <p className="text-ink-charcoal/60">{item.title}</p>}
                      <p className="text-ink-charcoal/80">
                        Âm lịch: <strong>{item.lunarDay}/{item.lunarMonth}</strong> · Dương lịch {item.lunarYear}: <strong>{item.solarDisplayDate || item.solarDate}</strong>
                      </p>
                      <p className="text-[10px] text-ink-charcoal/45">{item.source} · {item.certainty}{item.note ? ` · ${item.note}` : ''}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ink-charcoal/55 bg-silk-paper/60 border border-dashed border-ink-charcoal/10 rounded-sm p-3">
                  {anniversaryLoading ? 'Đang tải lịch giỗ đã xác minh...' : 'Chưa có lịch giỗ đã xác minh trong khoảng một năm tới.'}
                </div>
              )}
            </div>

            {ANNIVERSARY_EVENTS.map((event) => (
              <div 
                key={event.id}
                id={`anniversary-card-${event.id}`}
                className="bg-white border border-ink-charcoal/5 rounded-sm p-6 lg:p-8 hover:shadow-md transition-shadow duration-300 relative overflow-hidden"
              >
                {/* Traditional color flag overlay */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />

                <div className="space-y-4">
                  {/* Calendar details */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-secondary font-mono font-semibold">
                    <span className="bg-secondary/10 px-2.5 py-1 rounded-sm flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{event.lunarDate}</span>
                    </span>
                    <span className="text-ink-charcoal/40 font-normal">Dương lịch chiếu: {event.solarDate}</span>
                  </div>

                  {/* Title & description */}
                  <div className="space-y-2">
                    <h3 className="font-serif text-xl font-bold text-primary">{event.title}</h3>
                    <p className="text-sm text-ink-charcoal/80 leading-relaxed font-sans">{event.description}</p>
                  </div>

                  {/* Metadatas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans text-ink-charcoal/70 bg-silk-paper/60 p-3 rounded-sm">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-primary/60 flex-shrink-0" />
                      <span><strong>Chủ tế:</strong> {event.host}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-rose-700/60 flex-shrink-0" />
                      <span><strong>Địa điểm:</strong> {event.location}</span>
                    </div>
                  </div>

                  {/* Step-by-step ritual instructions */}
                  <div className="space-y-2 pt-2">
                    <span className="block text-[10px] font-mono text-ink-charcoal/40 uppercase tracking-widest flex items-center space-x-1">
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>Nghi thức quy trình cử hành lễ</span>
                    </span>
                    <ul className="space-y-1.5 pl-4 list-disc text-xs text-ink-charcoal/70 leading-relaxed">
                      {event.ritualGuide.map((step, sIdx) => (
                        <li key={sIdx} className="marker:text-secondary">{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Traditional interactive shrine offerings side area */}
        <div className="xl:col-span-5 sticky top-28" id="virtual-remembrance-panel">
          <div className="bg-silk-paper border border-secondary/20 p-6 lg:p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden" id="shrine-plate">
            {/* Visual Header */}
            <div className="text-center space-y-2 pb-4 border-b border-ink-charcoal/15">
              <div className="mx-auto w-10 h-10 rounded-full border border-secondary/20 flex items-center justify-center bg-secondary/5 text-secondary">
                <FlameKindling className="w-5 h-5 animate-bounce" />
              </div>
              <h2 className="font-serif text-lg font-bold text-primary">Thắp nhang vọng kính tổ tiên</h2>
              <p className="text-[11px] text-ink-charcoal/50 max-w-sm mx-auto">
                Con cháu muôn phương bái kính, gửi tấm lòng chân mộc thành kính nhớ ơn cội nguồn.
              </p>
            </div>

            {/* Total count of offerings badge */}
            <div className="flex justify-center" id="offering-counts">
              <span className="bg-primary/5 border border-primary/20 text-primary font-mono text-xs font-semibold py-1.5 px-4 rounded-full flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-secondary animate-pulse" />
                <span>Đã dâng thắp vọng bái: {offeringCount} lần</span>
              </span>
            </div>

            {/* Form to submit virtual incense / prayer */}
            <form onSubmit={handleOfferIncense} className="space-y-4" id="prayer-form">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-ink-charcoal/50 uppercase tracking-wide">
                  Danh tính con cháu dâng kính (Họ & Tên)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cao Anh Tú (Đời 16)"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full bg-white border border-ink-charcoal/10 rounded-sm py-2 px-3 text-xs text-ink-charcoal focus:outline-none focus:border-primary"
                  id="incense-donor-name"
                />
              </div>

              {/* Selector for virtual offering type */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOfferingType('nhang')}
                  className={`py-2 px-1 text-center rounded-sm text-xs font-medium font-sans border transition-all duration-200 ${
                    offeringType === 'nhang'
                      ? 'bg-primary text-silk-paper border-primary shadow-sm'
                      : 'bg-white border-ink-charcoal/10 text-ink-charcoal/60 hover:bg-ink-charcoal/5'
                  }`}
                  id="offer-type-nhang"
                >
                  🕯️ Dâng Hương
                </button>
                <button
                  type="button"
                  onClick={() => setOfferingType('hoa')}
                  className={`py-2 px-1 text-center rounded-sm text-xs font-medium font-sans border transition-all duration-200 ${
                    offeringType === 'hoa'
                      ? 'bg-primary text-silk-paper border-primary shadow-sm'
                      : 'bg-white border-ink-charcoal/10 text-ink-charcoal/60 hover:bg-ink-charcoal/5'
                  }`}
                  id="offer-type-hoa"
                >
                  🌸 Dâng Hoa Cổ
                </button>
                <button
                  type="button"
                  onClick={() => setOfferingType('tra')}
                  className={`py-2 px-1 text-center rounded-sm text-xs font-medium font-sans border transition-all duration-200 ${
                    offeringType === 'tra'
                      ? 'bg-primary text-silk-paper border-primary shadow-sm'
                      : 'bg-white border-ink-charcoal/10 text-ink-charcoal/60 hover:bg-ink-charcoal/5'
                  }`}
                  id="offer-type-tra"
                >
                  🍵 Dâng Trà Thơm
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-ink-charcoal/50 uppercase tracking-wide">
                  Lời khẩn nguyện, bày lạy
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Bày tỏ lòng biết ơn tổ tiên hoặc gửi lời chúc lành tới chi tộc..."
                  value={donorMessage}
                  onChange={(e) => setDonorMessage(e.target.value)}
                  className="w-full bg-white border border-ink-charcoal/10 rounded-sm py-2 px-3 text-xs text-ink-charcoal focus:outline-none focus:border-primary resize-none"
                  id="incense-prayer-text"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-secondary hover:bg-amber-950 text-silk-paper font-sans font-semibold text-xs rounded-sm tracking-wide transition-all duration-300 shadow-md hover:shadow-lg"
                id="shrine-submit-btn"
              >
                Gởi Lễ Vọng Kính bái
              </button>
            </form>

            {/* Remembrance list scroll wall */}
            <div className="space-y-3 pt-4 border-t border-ink-charcoal/10">
              <span className="block text-[10px] font-mono text-secondary uppercase tracking-widest text-center font-semibold mb-2">
                Sổ tâm niệm gia tộc dâng trà lễ nhang
              </span>
              <div className="space-y-3 max-h-[170px] overflow-y-auto pr-1 flex flex-col scrollbar-thin" id="prayer-guestbook">
                {virtualIncenses.map((vic, index) => (
                  <div key={index} className="bg-white/80 p-3 rounded-sm border border-ink-charcoal/5 text-xs text-ink-charcoal/80 space-y-1 relative" id={`prayer-log-${index}`}>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-primary/80">
                      <span className="font-serif block text-secondary">{vic.name}</span>
                      <span className="font-mono text-ink-charcoal/30 font-normal">{vic.date}</span>
                    </div>
                    <p className="italic leading-relaxed">"{vic.message}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
