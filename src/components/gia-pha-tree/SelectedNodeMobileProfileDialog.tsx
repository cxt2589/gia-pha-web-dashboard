import React from 'react';
import { Award, Bookmark, Calendar, Heart, MapPin, Scroll, Users, X } from 'lucide-react';
import { AncestorNode } from '../../types';
import { convertSolarToLunarText, getAnniversaryCountdown } from '../../utils/lunarConverter';
import { formatNodeTitle, isUnknownText } from '../../utils/lineageDisplay';

type AnniversaryInfo = ReturnType<typeof getAnniversaryCountdown>;
type SpouseDetail = NonNullable<AncestorNode['spouseDetails']>[number];

type SelectedNodeMobileProfileDialogProps = {
  isOpen: boolean;
  selectedNode: AncestorNode | null;
  selectedNodeIsLiving: boolean;
  effectiveLunarAnniversary: string;
  anniversaryInfo: AnniversaryInfo;
  selectedSpouses: string[];
  motherDetail: SpouseDetail | null;
  showExactDates: boolean;
  showAnniversaryDetails: boolean;
  expandedSpouseNames: Record<string, boolean>;
  isAdmin: boolean;
  isFullTreeView: boolean;
  isNgoaiTonNode: (node: AncestorNode) => boolean;
  setIsMobileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowExactDates: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAnniversaryDetails: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedSpouseNames: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  startEditSpouse: (spouseName: string, detail?: SpouseDetail) => void;
};

export function SelectedNodeMobileProfileDialog({
  isOpen,
  selectedNode,
  selectedNodeIsLiving,
  effectiveLunarAnniversary,
  anniversaryInfo,
  selectedSpouses,
  motherDetail,
  showExactDates,
  showAnniversaryDetails,
  expandedSpouseNames,
  isAdmin,
  isFullTreeView,
  isNgoaiTonNode,
  setIsMobileModalOpen,
  setShowExactDates,
  setShowAnniversaryDetails,
  setExpandedSpouseNames,
  startEditSpouse
}: SelectedNodeMobileProfileDialogProps) {
  return (
    <>
  {/* MOBILE POPUP DIALOG FOR COMPACT NOTE CARD CLICK EXPANSIONS */}
  {isOpen && selectedNode && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-fade-in"
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className={`bg-[#fafaf5] border-2 border-[#7b5800] rounded-lg ${isFullTreeView ? 'max-w-2xl' : 'max-w-md'} w-full max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 space-y-5`}
        style={{ touchAction: 'pan-y' }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        
        {/* Close button top right */}
        <button
          onClick={() => setIsMobileModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 hover:bg-[#eeeee9] rounded-full text-ink-charcoal/70 hover:text-rose-700 font-bold"
        >
          <X className="w-5 h-5 shadow-none" />
        </button>

        {/* Mobile Tag generation */}
        <div className="inline-block py-1 px-2.5 bg-primary text-silk-paper text-[9px] font-mono font-bold rounded uppercase tracking-widest leading-none">
          THẾ HỆ ĐỜI {selectedNode.generation}
        </div>

        {/* Hero names */}
        <div className="space-y-1.5 border-b border-[#8c716e]/20 pb-3">
          <span className="text-[9px] font-mono text-[#7b5800] tracking-widest uppercase font-semibold mb-1 flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 animate-pulse" />
            <span>Xác thực gia phả</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-bold text-primary">{selectedNode.name}</h3>
          </div>
          {formatNodeTitle(selectedNode) && (
            <p className="text-xs font-sans font-bold text-[#7b5800] tracking-wide uppercase">
              {isNgoaiTonNode(selectedNode)
                ? formatNodeTitle({
                    generation: selectedNode.generation,
                    isLiving: selectedNode.isLiving,
                    birthYear: selectedNode.birthYear,
                    deathYear: selectedNode.deathYear,
                    rankRole: 'Ngoại tôn',
                    customSuffix: selectedNode.customSuffix
                  })
                : formatNodeTitle(selectedNode)}
            </p>
          )}

          {/* Giỗ năm nay directly below title / text.xs on mobile */}
          {anniversaryInfo && (
            <div className="pt-2 text-xs font-sans text-ink-charcoal/85 space-y-1 block border-t border-[#8c716e]/10 mt-2" id="anniversary-bio-banner-mobile">
              {anniversaryInfo.daysLeft > 0 ? (
                <>
                  <div className="text-[11px] font-medium text-rose-950">
                    Giỗ năm nay: <span className="font-semibold text-rose-900">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                  </div>
                  <div className="text-rose-800 text-[10.5px] font-medium italic">
                    (Còn {anniversaryInfo.daysLeft} ngày nữa)
                  </div>
                </>
              ) : anniversaryInfo.isToday ? (
                <>
                  <div className="text-[11px] font-medium text-rose-950">
                    Giỗ năm nay: <span className="font-semibold text-rose-900">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                  </div>
                  <div className="text-rose-700 font-bold animate-pulse text-[11px] uppercase tracking-wide">
                    (Hôm nay chính sự ngày giỗ!)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-medium text-rose-950">
                    Giỗ năm nay: <span className="font-semibold text-ink-charcoal/70">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                  </div>
                  <div className="text-ink-charcoal/50 italic text-[10.5px]">
                    (Đã qua {Math.abs(anniversaryInfo.daysLeft)} ngày)
                  </div>
                  <div className="text-[11px] pt-1 border-t border-black/[0.03] mt-1 space-y-0.5">
                    <div>
                      Giỗ tiếp theo: <span className="font-semibold text-rose-900">{anniversaryInfo.nextSolarDateStr} ({anniversaryInfo.nextDayOfWeek})</span>
                    </div>
                    <div className="text-rose-800/80 text-[10.5px] font-medium italic">
                      (còn {anniversaryInfo.nextDaysLeft} ngày)
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comprehensive details for Mobile */}
        <div className="space-y-3.5 text-xs font-sans animate-fade-in">
          
           {/* Sinh mất correctly mapped */}
          <div
            onClick={() => setShowExactDates(!showExactDates)}
            className="bg-white p-3 rounded border border-black/[0.03] flex items-center gap-3 cursor-pointer hover:bg-amber-50/40 hover:border-amber-200/50 transition-all select-none"
          >
            <Calendar className="w-4 h-4 text-[#7b5800]" />
            <div className="flex-1">
              <span className="block text-[8px] font-mono uppercase text-ink-charcoal/40 tracking-wider">Sinh thời & Tạ thế</span>
              <span className="font-semibold text-primary">
                {(selectedNode.isLiving || (!selectedNode.deathYear && selectedNode.birthYear && parseInt(selectedNode.birthYear) > 1920)) 
                  ? `${selectedNode.birthYear || '?'}` 
                  : `${selectedNode.birthYear || '?'} – ${selectedNode.deathYear || '?'}`}
              </span>
              <span className="block text-[8px] text-[#7b5800] font-mono font-bold pt-1">
                {showExactDates ? "▲ Thu gọn" : "▼ Xem chi tiết"}
              </span>
            </div>
          </div>

          {showExactDates && (
            <div className="bg-rose-50/50 p-3 rounded border border-rose-100/50 text-[10.5px] text-rose-950 space-y-3 shadow-xs animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] font-mono text-rose-950/60 uppercase tracking-wide">Chi tiết Ngày sinh</span>
                  <span className="font-semibold block text-xs text-primary bg-white/70 px-2 py-1 rounded border border-rose-100/30">
                    {selectedNode.solarBirthDate ? `${selectedNode.solarBirthDate} (Dương lịch)` : "Chưa cập nhật ngày dương lịch"}
                  </span>
                  {selectedNode.solarBirthDate && convertSolarToLunarText(selectedNode.solarBirthDate) ? (
                    <div className="text-[10px] text-[#7b5800] bg-amber-50/80 border border-amber-100 px-2 py-1 rounded-sm font-medium">
                      Quy đổi Âm lịch: <strong>{convertSolarToLunarText(selectedNode.solarBirthDate)}</strong>
                    </div>
                  ) : null}
                </div>

                {!selectedNodeIsLiving && (
                  <div className="space-y-1 text-left">
                    <span className="block text-[8px] font-mono text-rose-950/60 uppercase tracking-wide">Chi tiết Ngày mất</span>
                    <span className="font-semibold block text-xs text-primary bg-white/70 px-2 py-1 rounded border border-rose-100/30">
                      {selectedNode.solarDeathDate ? `${selectedNode.solarDeathDate} (Dương lịch)` : "Chưa cập nhật ngày dương lịch"}
                    </span>
                    {selectedNode.solarDeathDate && convertSolarToLunarText(selectedNode.solarDeathDate) ? (
                      <div className="text-[10px] text-rose-950 bg-rose-100/40 border border-rose-200/30 px-2 py-1 rounded-sm font-medium">
                        Quy đổi Âm lịch: <strong>{convertSolarToLunarText(selectedNode.solarDeathDate)}</strong>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lunar Death Date address */}
          <div 
            onClick={() => setShowAnniversaryDetails(!showAnniversaryDetails)}
            className="bg-white p-3 rounded border border-black/[0.03] flex flex-col gap-1.5 cursor-pointer hover:bg-rose-50/30 transition-all select-none"
          >
            <div className="flex items-start gap-3">
              <Scroll className="w-4 h-4 text-rose-700 mt-0.5" />
              <div className="w-full text-left">
                <span className="block text-[8px] font-mono uppercase text-rose-950/40 tracking-wider">Kỵ nhật (Âm lịch)</span>
                <span className="font-semibold text-rose-950 block">{effectiveLunarAnniversary || 'Chưa khảo trích'}</span>
              </div>
            </div>
            <div className="pl-7 flex items-center text-[8px] text-rose-800 font-mono font-bold leading-none">
              <span>{showAnniversaryDetails ? "▲ Thu gọn" : "▼ Xem chi tiết ngày giỗ"}</span>
            </div>
          </div>

          {/* Show anniversary details on mobile directly under */}
          {showAnniversaryDetails && !selectedNode.isLiving && effectiveLunarAnniversary && (
            <div className="bg-rose-50/40 p-3 rounded border border-rose-100/50 text-[10.5px] text-rose-950 space-y-1.5 text-left shadow-xs animate-fade-in">
              <div className="font-bold text-rose-800 uppercase tracking-widest text-[8px] font-mono border-b border-rose-950/5 pb-1 mb-1.5 flex items-center gap-1">
                <Scroll className="w-3 h-3 text-rose-700 hover:shadow-none" />
                Chi tiết Ngày giỗ năm nay
              </div>
              {(() => {
                const info = getAnniversaryCountdown(effectiveLunarAnniversary);
                if (!info) return <span className="text-rose-950/50">Chưa xác định kỵ nhật năm nay</span>;
                return (
                  <div className="space-y-1 bg-white/40 p-2 rounded border border-rose-100/20 leading-relaxed font-sans">
                    <div className="font-medium text-rose-950 text-[11px]">
                      Giỗ năm nay: <strong className="text-rose-900">{info.solarDateStr} ({info.dayOfWeek})</strong>
                    </div>
                    <div className="text-[10.5px]">
                      {info.isToday ? (
                        <strong className="text-emerald-700 font-bold uppercase tracking-wide">★ Hôm nay chính kỵ</strong>
                      ) : info.daysLeft > 0 ? (
                        <span className="text-rose-800 italic">(Còn {info.daysLeft} ngày nữa)</span>
                      ) : (
                        <div className="space-y-1 text-rose-900">
                          <span className="italic block text-rose-800/80">(Đã qua {Math.abs(info.daysLeft)} ngày)</span>
                          {info.nextSolarDateStr && (
                            <div className="pt-1 mt-1 border-t border-rose-950/5 text-[10.5px]">
                              Bản giỗ tiếp theo: <strong>{info.nextSolarDateStr} ({info.nextDayOfWeek})</strong> <span className="italic text-rose-850">(còn {info.nextDaysLeft} ngày)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Optional Birth & Death Places */}
          {selectedNode.birthPlace && (
            <div className="bg-white p-3 rounded border border-black/[0.03] flex items-center gap-3">
              <MapPin className="w-4 h-4 text-[#4a90e2]" />
              <div>
                <span className="block text-[8px] font-mono uppercase text-ink-charcoal/40 tracking-wider">Nơi sinh / Nguyên quán</span>
                <span className="font-semibold text-ink-charcoal">{selectedNode.birthPlace}</span>
              </div>
            </div>
          )}

          {selectedNode.deathPlace && !selectedNode.isLiving && (
            <div className="bg-white p-3 rounded border border-black/[0.03] flex items-center gap-3">
              <MapPin className="w-4 h-4 text-[#e25c5c]" />
              <div>
                <span className="block text-[8px] font-mono uppercase text-[#e25c5c] tracking-wider">Nơi mất</span>
                <span className="font-semibold text-ink-charcoal">{selectedNode.deathPlace}</span>
              </div>
            </div>
          )}

          {/* Residence */}
          <div className="bg-white p-3 rounded border border-black/[0.03] flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#7b5800] mt-0.5 shrink-0" />
            <div>
              <span className="block text-[8px] font-mono uppercase text-ink-charcoal/40 tracking-wider">Bản quán / Nơi cư trú</span>
              <span className="font-semibold text-ink-charcoal inline-block">{selectedNode.residence || 'Chưa cập nhật'}</span>
            </div>
          </div>

          {/* Burial place */}
          <div className="bg-white p-3 rounded border border-black/[0.03] flex items-start gap-3">
            <Award className="w-4 h-4 text-[#7b5800] mt-0.5 shrink-0" />
            <div>
              <span className="block text-[8px] font-mono uppercase text-ink-charcoal/40 tracking-wider">Nơi an táng lăng mộ</span>
              <span className="font-semibold text-ink-charcoal inline-block">{selectedNode.burialPlace || 'Chưa cập nhật'}</span>
            </div>
          </div>

          {/* Phone lists for Mobile */}
          {(selectedNode.phone1 || selectedNode.phone2 || selectedNode.phone3) && (
            <div className="bg-amber-100/30 p-3 rounded border border-amber-200/50 space-y-1.5Col space-y-1">
              <span className="block text-[#7b5800] text-[8px] font-mono uppercase tracking-wider font-bold">Điện thoại liên hệ</span>
              <div className="flex flex-col gap-1">
                {selectedNode.phone1 && (
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-200 text-[#7b5800] text-[8px] px-1 py-0.5 rounded font-mono">SĐT 1</span>
                    <a href={`tel:${selectedNode.phone1}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone1}</a>
                  </div>
                )}
                {selectedNode.phone2 && (
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-200 text-[#7b5800] text-[8px] px-1 py-0.5 rounded font-mono">SĐT 2</span>
                    <a href={`tel:${selectedNode.phone2}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone2}</a>
                  </div>
                )}
                {selectedNode.phone3 && (
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-200 text-[#7b5800] text-[8px] px-1 py-0.5 rounded font-mono">SĐT 3</span>
                    <a href={`tel:${selectedNode.phone3}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone3}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Multi wife Mother details */}
          {selectedNode.motherName && (
            <div className="bg-rose-50/50 p-3 rounded border border-rose-100/50 space-y-1.5 flex flex-col text-rose-950">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-700 shrink-0" />
                <div>
                  <span className="block text-[8px] font-mono uppercase text-rose-950/40 tracking-wider">Thống hệ mẫu thân</span>
                  <span className="font-bold">Bà: {selectedNode.motherName}</span>
                </div>
              </div>
              {motherDetail && (
                <div className="pt-1.5 border-t border-rose-200/50 text-[10.5px] grid grid-cols-1 gap-1">
                  <div>• Tình trạng: <strong>{motherDetail.isLiving ? "Còn sống" : "Đã mất (hoặc không rõ)"}</strong></div>
                  {motherDetail.solarBirthDate && <div>• Ngày sinh: <strong>{motherDetail.solarBirthDate}</strong></div>}
                  {!motherDetail.solarBirthDate && motherDetail.birthYear && <div>• Năm sinh: <strong>{motherDetail.birthYear}</strong></div>}
                  {motherDetail.solarDeathDate && <div>• Ngày mất: <strong>{motherDetail.solarDeathDate}</strong></div>}
                  {!motherDetail.solarDeathDate && motherDetail.deathYear && <div>• Năm mất: <strong>{motherDetail.deathYear}</strong></div>}
                  {motherDetail.birthPlace && <div>• Quê quán: <strong>{motherDetail.birthPlace}</strong></div>}
                  {motherDetail.deathPlace && <div>• Nơi mất: <strong>{motherDetail.deathPlace}</strong></div>}
                  {motherDetail.burialPlace && motherDetail.burialPlace !== motherDetail.deathPlace && <div>• Nơi an táng: <strong>{motherDetail.burialPlace}</strong></div>}
                  {motherDetail.residence && <div>• Nơi ở: <strong>{motherDetail.residence}</strong></div>}
                  {motherDetail.lunarAnniversary && <div>• Ngày giỗ: <strong>{motherDetail.lunarAnniversary}</strong></div>}
                </div>
              )}
            </div>
          )}

          {/* Spouses listed and numbered */}
          <div className="bg-white p-3 rounded border border-black/[0.03] space-y-2">
            <span className="block text-[8px] font-mono uppercase text-ink-charcoal/40 tracking-wider">Phối ngẫu (Vợ / Chồng)</span>
            {selectedSpouses.length > 0 ? (
              <div className="space-y-1.5 font-sans">
                {selectedSpouses.map((sp, idx) => {
                  const isFem = selectedNode.gender === 'nữ';
                  const spRanks = ["Chính thất", "Vợ thứ hai (Thứ thất)", "Vợ thứ ba (Kế thất)"];
                  const totalSp = selectedSpouses.length;
                  const spLabel = isFem ? (totalSp <= 1 ? "Chồng" : (idx === 0 ? "Chồng đầu" : "Chồng thứ")) : (idx < spRanks.length ? spRanks[idx] : `Vợ thứ ${idx + 1}`);
                  const spouseIsUnknown = isUnknownText(sp);
                  
                  const cleanSpouseName = sp.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
                  const sDetail = selectedNode.spouseDetails?.find(d => {
                    const dName = d.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
                    return dName === cleanSpouseName || dName.includes(cleanSpouseName) || cleanSpouseName.includes(dName);
                  });

                  const isExpanded = !!expandedSpouseNames[sp];
                  const toggleSpouse = () => {
                    setExpandedSpouseNames(prev => ({ ...prev, [sp]: !prev[sp] }));
                  };

                  return (
                    <div key={idx} className="border-b border-gray-100 pb-1.5 last:border-0 last:pb-0 space-y-1">
                      <div onClick={toggleSpouse} className="flex items-center justify-between text-xs bg-[#fafaf5] px-2 py-1 rounded cursor-pointer">
                        <span className="flex items-center gap-1 font-medium text-rose-900">
                          <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                          <span className={`underline ${spouseIsUnknown ? 'animate-pulse font-semibold' : ''}`}>{sp}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          {!spouseIsUnknown && (
                            <span className="text-[8px] font-mono font-bold text-[#7b5800] uppercase">
                              {spLabel}
                            </span>
                          )}
                          <span className="text-[8px] text-gray-400">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-2 bg-rose-50/30 border-l border-rose-300 rounded text-[10.5px] leading-normal text-ink-charcoal space-y-1">
                          {sDetail ? (
                            <>
                              <div>• Tình trạng: <strong>{sDetail.isLiving ? "Còn sống" : "Đã mất (hoặc không rõ)"}</strong></div>
                              {sDetail.solarBirthDate && <div>• Ngày sinh: <strong>{sDetail.solarBirthDate}</strong></div>}
                              {!sDetail.solarBirthDate && sDetail.birthYear && <div>• Năm sinh: <strong>{sDetail.birthYear}</strong></div>}
                              {sDetail.solarDeathDate && <div>• Ngày mất: <strong>{sDetail.solarDeathDate}</strong></div>}
                              {!sDetail.solarDeathDate && sDetail.deathYear && <div>• Năm mất: <strong>{sDetail.deathYear}</strong></div>}
                              {sDetail.birthPlace && <div>• Quê quán: <strong>{sDetail.birthPlace}</strong></div>}
                              {sDetail.deathPlace && <div>• Nơi mất: <strong>{sDetail.deathPlace}</strong></div>}
                              {sDetail.burialPlace && sDetail.burialPlace !== sDetail.deathPlace && <div>• Nơi an táng: <strong>{sDetail.burialPlace}</strong></div>}
                              {sDetail.residence && <div>• Nơi cư trú: <strong>{sDetail.residence}</strong></div>}
                              {sDetail.lunarAnniversary && <div>• Ngày giỗ: <strong>{sDetail.lunarAnniversary}</strong></div>}
                              {(sDetail.phone1 || sDetail.phone2 || sDetail.phone3) && (
                                <div className="pt-1 font-mono text-[9px]">
                                  📞 SĐT liên hệ: {sDetail.phone1 || sDetail.phone2 || sDetail.phone3}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-400 italic">Chưa ghi chép hành trạng chi tiết phối ngẫu.</div>
                          )}

                          {/* Edit spouse button on Mobile */}
                          {isAdmin && (
                            <div className="pt-1.5 border-t border-rose-200/50 mt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Close mobile modal sheet to let form show on screen
                                  setIsMobileModalOpen(false);
                                  startEditSpouse(sp, sDetail);
                                }}
                                className="px-2 py-0.5 bg-amber-100 font-semibold text-amber-950 text-[9px] rounded border border-amber-200 cursor-pointer animate-pulse"
                              >
                                Cập nhật phối ngẫu (Sửa chắp bút)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-ink-charcoal/40 italic block text-[10px]">Chưa ghi chép phối tỷ dã</span>
            )}
          </div>

        </div>

        {/* Hand-scrollable description biography */}
        <div className="space-y-1 bg-[#eeeee9]/40 p-3 rounded border border-ink-charcoal/5">
          <span className="block text-[8px] font-mono text-ink-charcoal/40 uppercase">Tiểu sử vắn tắt dã sử</span>
          <p className="text-[11px] text-ink-charcoal/80 leading-relaxed text-justify max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
            {selectedNode.description || 'Chưa cập nhật'}
          </p>
        </div>

        {/* Mobile close trigger buttons */}
        <button
          onClick={() => setIsMobileModalOpen(false)}
          className="w-full py-2 bg-primary hover:bg-[#8b1c1c] text-[#fafaf5] rounded font-serif text-xs font-semibold uppercase shadow-md transition-all text-center cursor-pointer"
        >
          Kính bái đóng thông tin
        </button>

      </div>
    </div>
  )}


    </>
  );
}
