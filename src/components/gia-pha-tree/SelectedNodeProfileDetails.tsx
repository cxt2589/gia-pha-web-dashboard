import React from 'react';
import { Award, Bookmark, Calendar, FileText, Heart, Mail, MapPin, Phone, Scroll, Users } from 'lucide-react';
import { AncestorNode } from '../../types';
import { convertSolarToLunarText, getAnniversaryCountdown } from '../../utils/lunarConverter';
import { formatNodeTitle, isUnknownText } from '../../utils/lineageDisplay';
import { formatGenealogyDateStructured } from '../../utils/genealogyDate.mjs';

type AnniversaryInfo = ReturnType<typeof getAnniversaryCountdown>;

type SelectedNodeProfileDetailsProps = {
  selectedNode: AncestorNode;
  selectedNodeIsLiving: boolean;
  effectiveLunarAnniversary: string;
  anniversaryInfo: AnniversaryInfo;
  selectedSpouses: string[];
  motherDetail: NonNullable<AncestorNode['spouseDetails']>[number] | null;
  showExactDates: boolean;
  showAnniversaryDetails: boolean;
  expandedSpouseNames: Record<string, boolean>;
  isAdmin: boolean;
  clanLeaderRuleActive: boolean;
  leaderSpecsMap: Record<string, { role: string }>;
  isNgoaiTonNode: (node: AncestorNode) => boolean;
  setShowExactDates: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAnniversaryDetails: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedSpouseNames: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  startEditSpouse: (spouseName: string, detail?: NonNullable<AncestorNode['spouseDetails']>[number]) => void;
};

export function SelectedNodeProfileDetails({
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
  clanLeaderRuleActive,
  leaderSpecsMap,
  isNgoaiTonNode,
  setShowExactDates,
  setShowAnniversaryDetails,
  setExpandedSpouseNames,
  startEditSpouse
}: SelectedNodeProfileDetailsProps) {
  const portraitUrl = selectedNode.photo || '';
  const portraitInitials = selectedNode.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'C';
  const structuredDeathAnniversary = formatGenealogyDateStructured(selectedNode.deathAnniversaryLunarStructured);
  const structuredDeathDate = formatGenealogyDateStructured(selectedNode.deathDateStructured);
  const structuredBirthDate = formatGenealogyDateStructured(selectedNode.birthDateStructured);

  return (
    <>
      {/* Top background corner tag for elegance */}
      <div className="absolute top-0 right-0 py-1.5 px-3 bg-primary text-silk-paper text-[10px] font-mono font-bold rounded-bl uppercase tracking-widest">
        ĐỜI {selectedNode.generation}
      </div>

      {/* Bio primary headings */}
      <div className="space-y-2 pb-4 border-b border-[#8c716e]/20">
        <span className="text-[10px] font-mono text-[#7b5800] tracking-widest uppercase block font-semibold flex items-center gap-1">
          <Bookmark className="w-3.5 h-3.5 animate-pulse" />
          <span>Xác thực gia phả</span>
        </span>
        <div className="float-left mr-3 mb-2 h-20 w-16 overflow-hidden rounded-md border border-[#7b5800]/25 bg-white shadow-sm">
          {portraitUrl ? (
            <img src={portraitUrl} alt={`Chân dung ${selectedNode.name}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#fff7df] text-sm font-serif font-bold text-primary">
              {portraitInitials}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-2xl font-bold text-primary">
            {selectedNode.name}
          </h2>
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
              : clanLeaderRuleActive && leaderSpecsMap[selectedNode.id] 
              ? formatNodeTitle({
                  generation: selectedNode.generation,
                  isLiving: selectedNode.isLiving,
                  birthYear: selectedNode.birthYear,
                  deathYear: selectedNode.deathYear,
                  rankRole: leaderSpecsMap[selectedNode.id].role,
                  customSuffix: selectedNode.customSuffix
                })
              : formatNodeTitle(selectedNode)}
          </p>
        )}

        {/* Giỗ năm nay directly below title / text.xs */}
        {anniversaryInfo && (
          <div className="pt-2.5 text-xs font-sans text-ink-charcoal/85 space-y-1 block border-t border-[#8c716e]/10 mt-2" id="anniversary-bio-banner">
            {anniversaryInfo.daysLeft > 0 ? (
              <>
                <div className="text-[12px] font-medium text-rose-950">
                  Giỗ năm nay: <span className="font-semibold text-rose-900">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                </div>
                <div className="text-rose-800 text-[11px] font-medium italic">
                  (Còn {anniversaryInfo.daysLeft} ngày nữa)
                </div>
              </>
            ) : anniversaryInfo.isToday ? (
              <>
                <div className="text-[12px] font-medium text-rose-950">
                  Giỗ năm nay: <span className="font-semibold text-rose-900">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                </div>
                <div className="text-rose-700 font-bold animate-pulse text-[11.5px] uppercase tracking-wide">
                  (Hôm nay chính sự ngày giỗ!)
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px] font-medium text-rose-950">
                  Giỗ năm nay: <span className="font-semibold text-ink-charcoal/70">{anniversaryInfo.solarDateStr} ({anniversaryInfo.dayOfWeek})</span>
                </div>
                <div className="text-ink-charcoal/50 italic text-[11px]">
                  (Đã qua {Math.abs(anniversaryInfo.daysLeft)} ngày)
                </div>
                <div className="text-[12px] pt-1 border-t border-black/[0.03] mt-1 space-y-0.5">
                  <div>
                    Giỗ tiếp theo: <span className="font-semibold text-rose-900">{anniversaryInfo.nextSolarDateStr} ({anniversaryInfo.nextDayOfWeek})</span>
                  </div>
                  <div className="text-rose-800/80 text-[11px] font-medium italic">
                    (còn {anniversaryInfo.nextDaysLeft} ngày)
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Swapped Year of Birth and Death list + Lunar death anniversary */}
      {/* Swapped Year of Birth and Death list + Lunar death anniversary */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-ink-charcoal/40 font-mono tracking-widest uppercase">Trích lục hành trạng chi tiết</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
          
          {/* Birth - Death */}
          <div 
            onClick={() => setShowExactDates(!showExactDates)}
            className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-1.5 cursor-pointer hover:bg-amber-50/40 hover:border-amber-200/50 transition-all select-none col-span-1"
          >
            <div>
              <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Sinh thời & Tạ thế</span>
            </div>
            <div className="font-semibold text-primary flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-[#7b5800]" />
              <span>
                {(selectedNode.isLiving || (!selectedNode.deathYear && selectedNode.birthYear && parseInt(selectedNode.birthYear) > 1920)) 
                  ? `${selectedNode.birthYear || '?'}` 
                  : `${selectedNode.birthYear || '?'} – ${selectedNode.deathYear || '?'}`}
              </span>
            </div>

            <div className="flex items-center text-[8.5px] text-[#7b5800] hover:underline font-mono font-bold pt-0.5">
              <span>{showExactDates ? "▲ Thu gọn" : "▼ Xem chi tiết"}</span>
            </div>
          </div>

          {/* Lunar death date */}
          <div 
            onClick={() => setShowAnniversaryDetails(!showAnniversaryDetails)}
            className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-1.5 cursor-pointer hover:bg-rose-50/40 hover:border-rose-200/50 transition-all select-none col-span-1"
          >
            <div>
              <span className="block text-rose-950/40 text-[9px] font-mono uppercase tracking-wider">Kỵ nhật (Âm lịch)</span>
            </div>
            <div className="font-semibold text-rose-950 flex items-center space-x-1">
              <Scroll className="w-3.5 h-3.5 text-rose-700" />
              <span className="truncate">{effectiveLunarAnniversary || 'Chưa khảo cứu'}</span>
            </div>
            <div className="flex items-center text-[8.5px] text-rose-800 hover:underline font-mono font-bold pt-0.5">
              <span>{showAnniversaryDetails ? "▲ Thu gọn" : "▼ Xem chi tiết"}</span>
            </div>
          </div>

          {/* Show exact dates detailed panel below */}
          {showExactDates && (
            <div className="bg-rose-50/50 p-3.5 rounded border border-rose-100/50 text-[11px] text-rose-950 space-y-3 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] font-mono text-rose-950/60 uppercase tracking-wide">Chi tiết Ngày sinh:</span>
                  <span className="font-semibold block text-xs text-primary bg-white/70 px-2 py-1 rounded inline-block border border-rose-100/30">
                    {selectedNode.solarBirthDate ? `${selectedNode.solarBirthDate} (Dương lịch)` : "Chưa cập nhật ngày dương lịch"}
                  </span>
                  {selectedNode.solarBirthDate && convertSolarToLunarText(selectedNode.solarBirthDate) ? (
                    <div className="text-[10px] text-[#7b5800] bg-amber-50/80 border border-amber-100 px-2 py-1 rounded-sm mt-1 font-medium inline-block w-full">
                      Quy đổi Âm lịch: <strong>{convertSolarToLunarText(selectedNode.solarBirthDate)}</strong>
                    </div>
                  ) : null}
                </div>

                {!selectedNode.isLiving && (
                  <div className="space-y-1 text-left">
                    <span className="block text-[8px] font-mono text-rose-950/60 uppercase tracking-wide">Chi tiết Ngày mất:</span>
                    <span className="font-semibold block text-xs text-primary bg-white/70 px-2 py-1 rounded inline-block border border-rose-100/30">
                      {selectedNode.solarDeathDate ? `${selectedNode.solarDeathDate} (Dương lịch)` : "Chưa cập nhật ngày dương lịch"}
                    </span>
                    {selectedNode.solarDeathDate && convertSolarToLunarText(selectedNode.solarDeathDate) ? (
                      <div className="text-[10px] text-rose-950 bg-rose-100/40 border border-rose-200/30 px-2 py-1 rounded-sm mt-1 font-medium inline-block w-full">
                        Quy đổi Âm lịch: <strong>{convertSolarToLunarText(selectedNode.solarDeathDate)}</strong>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show anniversary detailed panel below */}
          {showAnniversaryDetails && !selectedNode.isLiving && effectiveLunarAnniversary && (
            <div className="bg-rose-50/40 p-4 rounded border border-rose-100/50 text-[11px] text-rose-950 space-y-2 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-rose-800 uppercase tracking-widest text-[9px] font-mono border-b border-rose-150 pb-1.5 mb-2">
                <Scroll className="w-3.5 h-3.5 text-rose-700 shadow-none" />
                Chi tiết Kỷ nhật (Ngày giỗ năm nay)
              </div>
              {structuredDeathAnniversary && (
                <div className="rounded border border-rose-100 bg-white/70 px-2 py-1 text-xs font-semibold text-primary">
                  Ngay gio: {structuredDeathAnniversary}
                  {selectedNode.deathAnniversaryLunarStructured?.precision === 'day_month' && !selectedNode.deathYear && !selectedNode.solarDeathDate
                    ? '; nam mat: chua ro'
                    : ''}
                </div>
              )}
              {(() => {
                const info = getAnniversaryCountdown(effectiveLunarAnniversary);
                if (!info) return <span className="text-rose-950/50">Chưa thể xác định kỵ nhật năm nay</span>;
                return (
                  <div className="space-y-2 text-xs text-rose-950 leading-relaxed font-sans">
                    <div className="font-semibold">
                      Giỗ năm nay: <span className="text-rose-900 font-bold">{info.solarDateStr} ({info.dayOfWeek})</span>
                    </div>
                    <div className="font-medium text-[11.5px]">
                      {info.isToday ? (
                        <span className="text-emerald-700 font-bold uppercase tracking-wider">★ Ngày hôm nay chính kỵ (Húy kỵ Đại giỗ)</span>
                      ) : info.daysLeft > 0 ? (
                        <span className="text-rose-800 italic">(Còn {info.daysLeft} ngày nữa)</span>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-ink-charcoal/50 italic">(Đã qua {Math.abs(info.daysLeft)} ngày)</div>
                          {info.nextSolarDateStr && (
                            <div className="pt-2 border-t border-[#8c716e]/10 mt-2 text-[11px] text-rose-950 space-y-0.5">
                              <div>
                                Giỗ tiếp theo: <strong className="text-rose-900 font-semibold">{info.nextSolarDateStr} ({info.nextDayOfWeek})</strong>
                              </div>
                              <div className="text-rose-800/80 italic text-[10.5px]">
                                (còn {info.nextDaysLeft} ngày nữa)
                              </div>
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

          {/* Birth Place */}
          {selectedNode.birthPlace && (
            <div className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-1">
              <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Nơi sinh (Quê quán)</span>
              <span className="font-semibold text-ink-charcoal flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#4a90e2]" />
                <span className="truncate">{selectedNode.birthPlace}</span>
              </span>
            </div>
          )}

          {/* Death Place */}
          {selectedNode.deathPlace && !selectedNode.isLiving && (
            <div className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-1">
              <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Nơi mất</span>
              <span className="font-semibold text-ink-charcoal flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#e25c5c]" />
                <span className="truncate">{selectedNode.deathPlace}</span>
              </span>
            </div>
          )}

          {/* Residence */}
          <div className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-0.5 md:col-span-2">
            <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Nơi cư trú hiện nay / xưa</span>
            <span className="font-semibold text-ink-charcoal flex items-start space-x-1">
              <MapPin className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
              <span className="leading-tight">{selectedNode.residence || 'Chưa cập nhật'}</span>
            </span>
          </div>

          {/* Burial place */}
          <div className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-0.5 md:col-span-2">
            <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Lăng mộ / Nơi an táng</span>
            <span className="font-semibold text-ink-charcoal flex items-start space-x-1">
              <Award className="w-3.5 h-3.5 text-[#7b5800] mt-0.5 shrink-0" />
              <span className="leading-tight">{selectedNode.burialPlace || 'Chưa cập nhật'}</span>
            </span>
          </div>

          {/* Phone list (Only shows phone 1, phone 2 enters if present) */}
          {(selectedNode.phone1 || selectedNode.phone2 || selectedNode.phone3) && (
            <div className="bg-amber-100/30 p-3 rounded border border-amber-200/50 space-y-1 md:col-span-2">
              <span className="block text-[#7b5800] text-[9.5px] font-mono uppercase tracking-wider font-bold">Số điện thoại liên lạc</span>
              <div className="flex flex-col gap-1 text-xs">
                {selectedNode.phone1 && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 bg-amber-200 text-[#7b5800] text-[8.5px] px-1 md:px-1.5 py-0.5 rounded font-mono font-bold leading-none">Liên lạc 1</span>
                    <a href={`tel:${selectedNode.phone1}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone1}</a>
                  </div>
                )}
                {selectedNode.phone2 && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 bg-amber-200 text-[#7b5800] text-[8.5px] px-1 md:px-1.5 py-0.5 rounded font-mono font-bold leading-none">Liên lạc 2</span>
                    <a href={`tel:${selectedNode.phone2}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone2}</a>
                  </div>
                )}
                {selectedNode.phone3 && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 bg-amber-200 text-[#7b5800] text-[8.5px] px-1 md:px-1.5 py-0.5 rounded font-mono font-bold leading-none">Liên lạc 3</span>
                    <a href={`tel:${selectedNode.phone3}`} className="text-primary hover:underline font-mono font-medium">{selectedNode.phone3}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email contact (Only shows if present) */}
          {selectedNode.email && (
            <div className="bg-amber-100/30 p-3 rounded border border-amber-200/50 space-y-1 md:col-span-2">
              <span className="block text-[#7b5800] text-[9.5px] font-mono uppercase tracking-wider font-bold">Địa chỉ Email liên lạc</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="shrink-0 bg-amber-200 text-[#7b5800] text-[8.5px] px-1.5 py-0.5 rounded font-mono font-bold leading-none uppercase">Email</span>
                <a href={`mailto:${selectedNode.email}`} className="text-primary hover:underline font-mono font-medium break-all">{selectedNode.email}</a>
              </div>
            </div>
          )}

          {/* Mother reference detail (Displays who refers to this child for multiple wives tracking with automated father.spouseDetails child lookup) */}
          {selectedNode.motherName && (
            <div className="bg-rose-50/50 p-3 rounded border border-rose-100/50 space-y-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="block text-rose-950/75 text-[9px] font-mono uppercase tracking-wider font-bold">Mẫu hệ (Mẹ sinh thành)</span>
                <span className="text-[8px] bg-rose-100/80 text-rose-800 px-1.5 py-0.5 rounded scale-90">Bản mẫu</span>
              </div>
              <span className="font-semibold text-rose-900 flex items-center space-x-1 py-0.5">
                <Users className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                <span>Bà: {selectedNode.motherName}</span>
              </span>
              
              {motherDetail ? (
                <div className="pt-2 border-t border-rose-200/50 space-y-1.5 text-[11px] font-sans text-ink-charcoal/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <span className="opacity-65">Tình trạng:</span> <strong className="text-rose-900">{motherDetail.isLiving ? "Còn sống" : "Đã mất (hoặc không rõ)"}</strong>
                    </div>
                    {motherDetail.solarBirthDate && (
                      <div className="sm:col-span-2">
                        <span className="opacity-65">Ngày sinh (Dương lịch):</span> <strong>{motherDetail.solarBirthDate}</strong>
                      </div>
                    )}
                    {!motherDetail.solarBirthDate && motherDetail.birthYear && (
                      <div>
                        <span className="opacity-65">Năm sinh:</span> <strong>{motherDetail.birthYear}</strong>
                      </div>
                    )}
                    {motherDetail.solarDeathDate && (
                      <div className="sm:col-span-2">
                        <span className="opacity-65">Ngày mất (Dương lịch):</span> <strong>{motherDetail.solarDeathDate}</strong>
                      </div>
                    )}
                    {!motherDetail.solarDeathDate && motherDetail.deathYear && (
                      <div>
                        <span className="opacity-65">Năm mất:</span> <strong>{motherDetail.deathYear}</strong>
                      </div>
                    )}
                    {motherDetail.birthPlace && (
                      <div className="sm:col-span-2"><span className="opacity-65">Quê sinh:</span> <strong>{motherDetail.birthPlace}</strong></div>
                    )}
                    {motherDetail.deathPlace && (
                      <div className="sm:col-span-2"><span className="opacity-65">Nơi mất:</span> <strong>{motherDetail.deathPlace}</strong></div>
                    )}
                    {motherDetail.burialPlace && motherDetail.burialPlace !== motherDetail.deathPlace && (
                      <div className="sm:col-span-2"><span className="opacity-65">Nơi an táng:</span> <strong>{motherDetail.burialPlace}</strong></div>
                    )}
                    {motherDetail.residence && (
                      <div className="sm:col-span-2"><span className="opacity-65">Nơi cư trú:</span> <strong>{motherDetail.residence}</strong></div>
                    )}
                    {motherDetail.lunarAnniversary && (
                      <div className="sm:col-span-2"><span className="opacity-65">Kỵ nhật (Ngày giỗ):</span> <strong>{motherDetail.lunarAnniversary}</strong></div>
                    )}
                    {(motherDetail.phone1 || motherDetail.phone2 || motherDetail.phone3) && (
                      <div className="sm:col-span-2 pt-1 uppercase text-[8px] tracking-wider leading-none text-rose-900/60 font-semibold font-mono">
                        📱 Điện thoại mẫu thân:
                        <div className="flex flex-col gap-0.5 mt-1 font-bold">
                          {motherDetail.phone1 && <div>SĐT 1: <a href={`tel:${motherDetail.phone1}`} className="underline font-mono text-primary">{motherDetail.phone1}</a></div>}
                          {motherDetail.phone2 && <div>SĐT 2: <a href={`tel:${motherDetail.phone2}`} className="underline font-mono text-primary">{motherDetail.phone2}</a></div>}
                          {motherDetail.phone3 && <div>SĐT 3: <a href={`tel:${motherDetail.phone3}`} className="underline font-mono text-primary">{motherDetail.phone3}</a></div>}
                        </div>
                      </div>
                    )}
                    {motherDetail.email && (
                      <div className="sm:col-span-2 pt-1 uppercase text-[8px] tracking-wider leading-none text-rose-900/60 font-semibold font-mono">
                        ✉️ Email mẫu thân:
                        <div className="mt-1 font-bold">
                          <a href={`mailto:${motherDetail.email}`} className="underline font-mono text-primary break-all">{motherDetail.email}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-rose-950/40 italic pt-1 border-t border-rose-200/50">
                  Chưa cập nhật chi tiết hành trạng mẫu thân.
                </div>
              )}
            </div>
          )}

          {/* Collapsible interactive Spouses layout with detailed metadata lookups */}
          <div className="bg-white/80 p-3 rounded border border-black/[0.03] space-y-1.5 md:col-span-2">
            <span className="block text-ink-charcoal/40 text-[9px] font-mono uppercase tracking-wider">Phối ngẫu (Vợ / Chồng)</span>
            <div className="font-semibold text-ink-charcoal space-y-1.5">
              {selectedSpouses.length > 0 ? (
                selectedSpouses.map((sp, idx) => {
                  const isFemale = selectedNode.gender === 'nữ';
                  const totalSpouses = selectedSpouses.length;
                  const spouseRanks = isFemale ? (totalSpouses <= 1 ? ["Chồng"] : ["Chồng đầu", "Chồng thứ"]) : ["Chính thất", "Thứ thất (Vợ thứ hai)", "Kế thất (Vợ thứ ba)"];
                  const rankLabel = isFemale ? (totalSpouses <= 1 ? "Chồng" : (idx === 0 ? "Chồng đầu" : "Chồng thứ")) : (idx < spouseRanks.length ? spouseRanks[idx] : `Khắp phụ (Phối ngẫu thứ ${idx + 1})`);
                  const spouseIsUnknown = isUnknownText(sp);
                  
                  // Look up spouse rich detail
                  const cleanSpouseName = sp.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
                  const sDetail = selectedNode.spouseDetails?.find(d => {
                    const dName = d.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
                    return dName === cleanSpouseName || dName.includes(cleanSpouseName) || cleanSpouseName.includes(dName);
                  });

                  const isExpanded = !!expandedSpouseNames[sp];
                  const toggleSpouse = () => {
                    setExpandedSpouseNames(prev => ({
                      ...prev,
                      [sp]: !prev[sp]
                    }));
                  };

                  return (
                    <div key={idx} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0 space-y-1.5">
                      <div onClick={toggleSpouse} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-black/[0.02] p-1 rounded transition-colors select-none">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600 shrink-0" />
                          <span className={`text-primary hover:underline ${spouseIsUnknown ? 'animate-pulse font-semibold' : ''}`}>{sp}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!spouseIsUnknown && (
                            <span className="text-[8.5px] bg-[#eeeee9] text-[#7b5800] px-1.5 py-0.5 rounded font-mono font-medium scale-95 uppercase">
                              {rankLabel}
                            </span>
                          )}
                          <span className="text-[8px] text-gray-400 font-normal">
                            {isExpanded ? '▲ Thu gọn' : '▼ Chi tiết'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pl-5 pr-2 py-1.5 bg-rose-50/20 border-l-2 border-rose-300 rounded text-xs font-sans text-ink-charcoal space-y-1">
                          {sDetail ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] leading-relaxed text-ink-charcoal/80">
                              <div>
                                <span className="text-ink-charcoal/45 font-medium">Tình trạng:</span> <strong className="text-rose-900">{sDetail.isLiving ? "Còn sống" : "Đã mất (hoặc không rõ)"}</strong>
                              </div>
                              {sDetail.solarBirthDate && (
                                <div className="sm:col-span-2">
                                  <span className="text-ink-charcoal/45 font-medium">Ngày sinh (Dương lịch):</span> <strong>{sDetail.solarBirthDate}</strong>
                                </div>
                              )}
                              {!sDetail.solarBirthDate && sDetail.birthYear && (
                                <div>
                                  <span className="text-ink-charcoal/45 font-medium">Năm sinh:</span> <strong>{sDetail.birthYear}</strong>
                                </div>
                              )}
                              {sDetail.solarDeathDate && (
                                <div className="sm:col-span-2">
                                  <span className="text-ink-charcoal/45 font-medium">Ngày mất (Dương lịch):</span> <strong>{sDetail.solarDeathDate}</strong>
                                </div>
                              )}
                              {!sDetail.solarDeathDate && sDetail.deathYear && (
                                <div>
                                  <span className="text-ink-charcoal/45 font-medium">Năm mất:</span> <strong>{sDetail.deathYear}</strong>
                                </div>
                              )}
                              {sDetail.birthPlace && (
                                <div className="sm:col-span-2"><span className="text-ink-charcoal/45 font-medium">Quê quán (Nơi sinh):</span> <strong>{sDetail.birthPlace}</strong></div>
                              )}
                              {sDetail.deathPlace && (
                                <div className="sm:col-span-2"><span className="text-ink-charcoal/45 font-medium">Nơi mất:</span> <strong>{sDetail.deathPlace}</strong></div>
                              )}
                              {sDetail.burialPlace && sDetail.burialPlace !== sDetail.deathPlace && (
                                <div className="sm:col-span-2"><span className="text-ink-charcoal/45 font-medium">Nơi an táng:</span> <strong>{sDetail.burialPlace}</strong></div>
                              )}
                              {sDetail.residence && (
                                <div className="sm:col-span-2"><span className="text-ink-charcoal/45 font-medium">Nơi ở hiện tại/xưa:</span> <strong>{sDetail.residence}</strong></div>
                              )}
                              {sDetail.lunarAnniversary && (
                                <div className="sm:col-span-2"><span className="text-ink-charcoal/45 font-medium">Kỵ nhật (Ngày giỗ):</span> <strong>{sDetail.lunarAnniversary}</strong></div>
                              )}
                              {(sDetail.phone1 || sDetail.phone2 || sDetail.phone3) && (
                                <div className="sm:col-span-2 pt-1 font-semibold uppercase text-[8px] tracking-wider leading-none text-rose-900/60 font-mono">
                                  📱 Số điện thoại liên lạc:
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {sDetail.phone1 && <a href={`tel:${sDetail.phone1}`} className="underline font-mono text-primary bg-white px-1.5 py-0.5 border border-rose-200 rounded shrink-0">{sDetail.phone1}</a>}
                                    {sDetail.phone2 && <a href={`tel:${sDetail.phone2}`} className="underline font-mono text-primary bg-white px-1.5 py-0.5 border border-rose-200 rounded shrink-0">{sDetail.phone2}</a>}
                                    {sDetail.phone3 && <a href={`tel:${sDetail.phone3}`} className="underline font-mono text-primary bg-white px-1.5 py-0.5 border border-rose-200 rounded shrink-0">{sDetail.phone3}</a>}
                                  </div>
                                </div>
                              )}
                              {sDetail.email && (
                                <div className="sm:col-span-2 pt-1 font-semibold uppercase text-[8px] tracking-wider leading-none text-rose-900/60 font-mono">
                                  ✉️ Địa chỉ Email:
                                  <div className="mt-1">
                                    <a href={`mailto:${sDetail.email}`} className="underline font-mono text-primary bg-white px-1.5 py-0.5 border border-rose-200 rounded shrink-0 font-medium inline-block break-all">{sDetail.email}</a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5 text-[11px] leading-relaxed text-ink-charcoal/80">
                              <p className="italic text-gray-500 text-[10.5px]">Chưa lưu hành trạng chi tiết của vị phối ngẫu này.</p>
                            </div>
                          )}

                          {/* Edit spouse action for PC Sidebar */}
                          {isAdmin && (
                            <div className="pt-2 border-t border-rose-200/50 mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditSpouse(sp, sDetail);
                                }}
                                className="px-2.5 py-1 bg-amber-100/90 hover:bg-amber-200 text-amber-950 text-[10.5px] font-sans font-semibold rounded border border-amber-200 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <FileText className="w-3 h-3 text-rose-750" />
                                <span>Sửa hành trạng hành phả</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <span className="text-ink-charcoal/40 italic text-[11px] block">Chưa ghi chép bàng thất</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Detailed chronicle text */}
      <div className="space-y-2">
        <span className="block text-[9.5px] font-mono text-ink-charcoal/40 uppercase tracking-widest">
          Hành trạng tiên nhân chép tạc
        </span>
        <div className="bg-white p-4 rounded-sm border border-[#8c716e]/10 text-xs text-ink-charcoal/80 leading-relaxed text-justify shadow-inner max-h-[190px] overflow-y-auto scrollbar-thin">
          {selectedNode.description || 'Chưa cập nhật'}
        </div>
      </div>


    </>
  );
}
