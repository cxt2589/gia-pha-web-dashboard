import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Users, Landmark, Calendar, Award, ArrowUpRight, ArrowDownRight, Bell, Clock, FileText, UserPlus, Coins, ShieldCheck, Heart, Sparkles, TrendingUp } from "lucide-react";
import { FamilyMember, ClanEvent, TreasuryTx, OutstandingMember } from "../types";

interface OverviewProps {
  onSetActiveTab: (tab: string) => void;
  onSetAIInitialPrompt?: (prompt: string, type: string) => void;
  members: FamilyMember[];
  events: ClanEvent[];
  transactions: TreasuryTx[];
  outstandingMembers: OutstandingMember[];
}

export default function Overview({ 
  onSetActiveTab, 
  onSetAIInitialPrompt, 
  members, 
  events, 
  transactions, 
  outstandingMembers 
}: OverviewProps) {
  
  // Calculate reactive human stats
  const totalLivingMembers = useMemo(() => {
    return members.filter(m => !m.isDeceased).length;
  }, [members]);

  const totalLivingMales = useMemo(() => {
    return members.filter(m => !m.isDeceased && m.gender === "Nghị").length; // Nghị is male
  }, [members]);

  const totalLivingFemales = useMemo(() => {
    return members.filter(m => !m.isDeceased && m.gender === "Nữ").length;
  }, [members]);

  const totalDeceased = useMemo(() => {
    return members.filter(m => m.isDeceased).length;
  }, [members]);

  const totalMembersCount = members.length;

  // Treasury stats calculated reactively
  const totalCollected = useMemo(() => {
    return transactions
      .filter(tx => tx.type === "Thu")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);
      
  const totalSpent = useMemo(() => {
    return transactions
      .filter(tx => tx.type === "Chi")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);
      
  const netBalance = totalCollected - totalSpent;

  const upcomingEvent = useMemo(() => {
    return events.find(e => e.status !== "Đã hoàn thành") || events[0];
  }, [events]);

  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  // State for chart tooltips
  const [hoveredGenIdx, setHoveredGenIdx] = useState<number | null>(null);
  const [hoveredFundCategory, setHoveredFundCategory] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"generation" | "annuality">("generation");
  const [hoveredDecadeIdx, setHoveredDecadeIdx] = useState<number | null>(null);
  const [yearSearch, setYearSearch] = useState("");

  // Group born members by decades for a clean chart representation (1950s to 2020s)
  const decadeGrowthData = useMemo(() => {
    const targetDecades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
    const stats = targetDecades.map(dec => {
      const decMembers = members.filter(m => {
        if (!m.birthYear) return false;
        const bYr = parseInt(m.birthYear.replace(/\D/g, ""));
        if (!bYr) return false;
        return bYr >= dec && bYr < dec + 10;
      });
      const decMales = decMembers.filter(m => m.gender === "Nghị");
      return {
        decadeStr: `${dec}s`,
        decade: dec,
        newMembers: decMembers.length,
        newMales: decMales.length
      };
    });

    // Accumulate for line curve drawing
    let cumMembers = 0;
    let cumMales = 0;
    return stats.map(s => {
      cumMembers += s.newMembers;
      cumMales += s.newMales;
      return {
        ...s,
        cumMembers,
        cumMales
      };
    });
  }, [members]);

  const maxDecadeCumCount = useMemo(() => {
    const maxVal = Math.max(...decadeGrowthData.map(d => d.cumMembers));
    return maxVal > 0 ? maxVal : 30;
  }, [decadeGrowthData]);

  // Year by Year additions sorted descending
  const annualHistory = useMemo(() => {
    const statsMap: Record<number, { total: number; males: number; names: string[] }> = {};
    members.forEach(m => {
      if (!m.birthYear) return;
      const bYr = parseInt(m.birthYear.replace(/\D/g, ""));
      if (!bYr) return;
      if (!statsMap[bYr]) {
        statsMap[bYr] = { total: 0, males: 0, names: [] };
      }
      statsMap[bYr].total += 1;
      if (m.gender === "Nghị") {
        statsMap[bYr].males += 1;
      }
      statsMap[bYr].names.push(`${m.name} (${m.branch})`);
    });

    return Object.entries(statsMap)
      .map(([yr, data]) => ({
        yearStr: yr,
        year: parseInt(yr),
        ...data
      }))
      .sort((a, b) => b.year - a.year);
  }, [members]);

  const filteredAnnualHistory = useMemo(() => {
    if (!yearSearch) return annualHistory;
    return annualHistory.filter(h => h.yearStr.includes(yearSearch.trim()));
  }, [annualHistory, yearSearch]);

  // 1. Calculate population data generation by generation (Generations 1 to 8)
  const populationGrowthData = useMemo(() => {
    const generationCounts = Array.from({ length: 8 }, (_, idx) => {
      const genNum = idx + 1;
      const genMembers = members.filter(m => m.generation === genNum);
      const genMales = genMembers.filter(m => m.gender === "Nghị");
      return {
        generation: genNum,
        newMembers: genMembers.length,
        newMales: genMales.length,
      };
    });

    // Make cumulative totals
    let cumMembers = 0;
    let cumMales = 0;
    return generationCounts.map((g) => {
      cumMembers += g.newMembers;
      cumMales += g.newMales;
      return {
        ...g,
        cumMembers,
        cumMales
      };
    });
  }, [members]);

  // Max cumulative count for SVG scaling
  const maxCumCount = useMemo(() => {
    const maxVal = Math.max(...populationGrowthData.map(d => d.cumMembers));
    return maxVal > 0 ? maxVal : 30;
  }, [populationGrowthData]);


  // 2. Compute dynamic sub-funds balances based on transactional data
  // Fund categories to track
  // - Quỹ Chung: default 45,000,000 VND base + Category "Đóng góp thường niên" & others
  // - Quỹ Khuyến học: default 18,000,005 VND base + Category "Khuyến học"
  // - Quỹ Trùng tu: default 125,000,000 VND base + Category "Sự nghiệp Trùng tu"
  // - Quỹ Tế lễ giỗ chạp: default 12,000,000 VND base + Category "Chi Tế lễ"
  const fundStatistics = useMemo(() => {
    const bases = {
      "Quỹ chung liên chi": 45000000,
      "Quỹ khuyến học trẻ": 18000000,
      "Quỹ sự nghiệp trùng tu": 125000000,
      "Quỹ giỗ chạp tế lễ": 12000000
    };

    const accum = {
      "Quỹ chung liên chi": { collects: 0, expenditures: 0 },
      "Quỹ khuyến học trẻ": { collects: 0, expenditures: 0 },
      "Quỹ sự nghiệp trùng tu": { collects: 0, expenditures: 0 },
      "Quỹ giỗ chạp tế lễ": { collects: 0, expenditures: 0 }
    };

    transactions.forEach(tx => {
      let targetFund: keyof typeof accum = "Quỹ chung liên chi";
      if (tx.category === "Khuyến học") {
        targetFund = "Quỹ khuyến học trẻ";
      } else if (tx.category === "Sự nghiệp Trùng tu") {
        targetFund = "Quỹ sự nghiệp trùng tu";
      } else if (tx.category === "Chi Tế lễ") {
        targetFund = "Quỹ giỗ chạp tế lễ";
      }

      if (tx.type === "Thu") {
        accum[targetFund].collects += tx.amount;
      } else {
        accum[targetFund].expenditures += tx.amount;
      }
    });

    return Object.keys(bases).map(key => {
      const k = key as keyof typeof bases;
      const initial = bases[k];
      const coll = accum[k].collects;
      const spent = accum[k].expenditures;
      const currentBalance = initial + coll - spent;
      return {
        fundName: k,
        initialBase: initial,
        collections: coll,
        spent,
        balance: currentBalance
      };
    });
  }, [transactions]);

  // Max balance for sub-funds column charts
  const maxFundVal = useMemo(() => {
    const maxVal = Math.max(...fundStatistics.map(f => f.balance));
    return maxVal > 0 ? maxVal : 150000000;
  }, [fundStatistics]);

  const handleQuickWritePrayer = () => {
    if (onSetAIInitialPrompt) {
      onSetAIInitialPrompt(
        `Kính thưa Trợ lý Gia tộc, hãy soạn giúp tôi một bài Văn khấn trang trọng dâng cúng hương hồn đức Thủy Tổ Cao Quý Công (húy Cao Văn Lãm) nhân ngày Đại lễ Giỗ Tổ mùng 15 tháng 3 năm nay. Bài văn sớ cần nêu bật công lao khai hoang lập ấp tại Ninh Bình của đức Tổ và cầu chúc bình an cho con cháu dòng họ học hành đỗ đạt.`, 
        "ceremony"
      );
      onSetActiveTab("ai");
    }
  };

  const handleQuickAppealLetter = () => {
    if (onSetAIInitialPrompt) {
      onSetAIInitialPrompt(
        `Kính thưa Trợ lý Gia tộc, tôi muốn soạn một bức Thư ngỏ thay mặt Ban Trị Sự dòng họ Cao Ninh Bình để kêu gọi con cháu ba chi chung tay dâng gạch hiến cát phát tâm quyên góp trùng tu dãy Hữu vu Tổ đường làm nhà lưu niệm hiện vật cổ. Hãy viết lời hiệu triệu tha thiết đầy xúc động.`,
        "appeal"
      );
      onSetActiveTab("ai");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Welcome Traditional Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950 via-red-900 to-amber-950 px-6 py-8 text-white shadow-xl border border-amber-950">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-y-[-10%] translate-x-[10%]">
          <svg width="320" height="320" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 0 C77.6 0 100 22.4 100 50 C100 77.6 77.6 100 50 100 C22.4 100 0 77.6 0 50 C0 22.4 22.4 0 50 0 Z M50 10 C27.9 10 10 27.9 10 50 C10 72.1 27.9 90 50 90 C72.1 90 90 72.1 90 50 C90 27.9 72.1 10 50 10 Z" />
          </svg>
        </div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 border border-amber-500/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            Hệ thống Quản trị Số hóa Gia tộc Cao Ninh Bình
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif tracking-tight text-amber-100">
            Kính chào Ban Trị Sự Dòng Họ Cao!
          </h1>
          <p className="text-sm text-red-100 leading-relaxed max-w-xl">
            Nơi kết nối huyết thống, giữ nguyên gia bản phả hệ cổ từ tổ phụ Cao Quý Công (Yên Khánh - Hoa Lư, Ninh Bình). Hệ thống tra cứu phả đồ, sổ quỹ thủ chi, tế lễ gia tông và sớ văn nhờ sự hỗ trợ của Trợ lý AI.
          </p>
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button 
              onClick={() => onSetActiveTab("tree")}
              className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-red-950 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Users className="h-4 w-4" /> Tra cứu Gia phả
            </button>
            <button 
              onClick={() => onSetActiveTab("ai")}
              className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-sm transition-all cursor-pointer"
            >
              Hán Nôm AI Helper
            </button>
          </div>
        </div>
      </div>

      {/* 2. CRITICAL FEATURE: Prominent Human Statistics Panel at the Very Top */}
      <div className="bg-white rounded-2xl border-2 border-red-900/10 shadow-md p-5 relative overflow-hidden">
        {/* Subtle decorative background tag */}
        <div className="absolute right-4 top-4 text-red-950 opacity-[0.03] select-none text-7xl font-serif tracking-tighter col-span-2 font-black">
          CAO PHẢ
        </div>

        <div className="flex items-center gap-2 pb-4 border-b border-stone-150">
          <div className="h-8.5 w-8.5 rounded-lg bg-red-100 text-red-850 flex items-center justify-center border border-red-250">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-serif font-bold text-red-950 uppercase tracking-wide">
              Thống kê Con người & Đinh phả tối cấp
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">Báo biểu nhân số sinh trưởng thực tế của gia tộc đang được số hóa trực tuyến.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
          
          {/* Main living males card - đinh còn sống (con trai) */}
          <div className="bg-gradient-to-br from-red-50 to-amber-50/60 p-4.5 rounded-xl border border-red-900/15 relative overflow-hidden group">
            <div className="space-y-1 relative z-10 select-none">
              <span className="text-[10px] text-red-800 uppercase font-black tracking-wider block">Hương Đinh Còn Sống (Nam)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-serif text-red-900">{totalLivingMales}</span>
                <span className="text-xs text-amber-800 font-bold">nhân đinh</span>
              </div>
              <p className="text-[10px] text-stone-400 block font-medium">Nòng cốt tế sự phả đại tộc</p>
            </div>
            <div className="absolute right-3 bottom-3 opacity-20 text-red-800 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-10 w-10 strokeWidth={1}" />
            </div>
          </div>

          {/* Total living members - tổng số thành viên còn sống */}
          <div className="bg-gradient-to-br from-indigo-50/40 to-blue-50/60 p-4.5 rounded-xl border border-blue-900/10 relative overflow-hidden group">
            <div className="space-y-1 relative z-10 select-none">
              <span className="text-[10px] text-blue-900 uppercase font-black tracking-wider block">Thành Viên Còn Sống (Tổng)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-serif text-slate-900">{totalLivingMembers}</span>
                <span className="text-xs text-blue-800 font-bold">con cháu</span>
              </div>
              <p className="text-[10px] text-stone-400 block font-medium">Đang cư ngụ tại VN & Ngoại bang</p>
            </div>
            <div className="absolute right-3 bottom-3 opacity-15 text-blue-950 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-10 w-10 strokeWidth={1}" />
            </div>
          </div>

          {/* Historical lineage total members (living + deceased) */}
          <div className="bg-stone-50 p-4.5 rounded-xl border border-stone-150 relative overflow-hidden group">
            <div className="space-y-1 relative z-10 select-none">
              <span className="text-[10px] text-stone-550 uppercase font-black tracking-wider block">Tổng Diện Biên Phả Hệ</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-serif text-stone-850">{totalMembersCount}</span>
                <span className="text-xs text-stone-500 font-bold">tiên linh & hậu thế</span>
              </div>
              <p className="text-[10px] text-stone-400 block font-medium">Bao gồm {totalDeceased} tổ khảo đã khuất</p>
            </div>
            <div className="absolute right-3 bottom-3 opacity-10 text-stone-900 group-hover:scale-110 transition-transform duration-300">
              <Heart className="h-10 w-10 strokeWidth={1}" />
            </div>
          </div>

          {/* Female living members */}
          <div className="bg-stone-50 p-4.5 rounded-xl border border-stone-150 relative overflow-hidden group">
            <div className="space-y-1 relative z-10 select-none">
              <span className="text-[10px] text-stone-550 uppercase font-black tracking-wider block font-bold">Nữ Kiệt Còn Sống (Nội ngoại)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-serif text-stone-800">{totalLivingFemales}</span>
                <span className="text-xs text-stone-500 font-bold">chị em o phái</span>
              </div>
              <p className="text-[10px] text-stone-400 block font-medium">Bồi nạp giáo tông tôn nhân</p>
            </div>
            <div className="absolute right-3 bottom-3 opacity-10 text-stone-900 group-hover:scale-110 transition-transform duration-300">
              <Award className="h-10 w-10 strokeWidth={1}" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. CHARTS GRID (Population Growth & Sub-funds balances side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Population Growth Curve Chart (Custom SVG implementation for highest correctness & beauty) */}
        <div className="bg-white rounded-xl border border-stone-150 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-sm text-stone-850 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-red-800" />
                Biểu Đồ Tăng Trưởng Dân Số
              </h3>
              <p className="text-[11px] text-stone-500">
                Lũy kế sinh nhân mới qua thế hệ phả phái hoặc theo lịch sử năm sinh/thập kỷ.
              </p>
            </div>

            {/* View Switcher segment button */}
            <div className="flex bg-stone-105 p-1 bg-stone-100 rounded-lg border border-stone-150 text-[10px] font-bold shrink-0 select-none">
              <button 
                type="button"
                onClick={() => setChartView("generation")}
                className={`px-2 py-1 rounded cursor-pointer transition-all ${
                  chartView === "generation" ? "bg-white text-red-900 shadow-xs border border-stone-200/50 font-bold" : "text-stone-500 hover:text-stone-850"
                }`}
              >
                Xem theo Thế hệ
              </button>
              <button 
                type="button"
                onClick={() => setChartView("annuality")}
                className={`px-2 py-1 rounded cursor-pointer transition-all ${
                  chartView === "annuality" ? "bg-white text-red-900 shadow-xs border border-stone-200/50 font-bold" : "text-stone-500 hover:text-stone-850"
                }`}
              >
                Thống kê theo Năm/Kỷ
              </button>
            </div>
          </div>

          {chartView === "generation" ? (
            <div className="space-y-4">
              {/* SVG Draw area for generations */}
              <div className="relative border border-stone-100 rounded-lg p-2.5 bg-stone-50/50">
                <svg viewBox="0 0 540 240" className="w-full h-auto select-none overflow-visible">
                  {/* Definitions for Gradients */}
                  <defs>
                    <linearGradient id="membersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="malesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Horizontal Guidelines */}
                  <line x1="45" y1="40" x2="510" y2="40" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="90" x2="510" y2="90" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="140" x2="510" y2="140" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="190" x2="510" y2="190" stroke="#a3a3a3" strokeWidth="1" />

                  {/* Grid Y Axis Labels */}
                  <text x="35" y="44" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{maxCumCount}</text>
                  <text x="35" y="94" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{Math.round(maxCumCount * 0.6)}</text>
                  <text x="35" y="144" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{Math.round(maxCumCount * 0.3)}</text>
                  <text x="35" y="194" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">0</text>

                  {(() => {
                    const points = populationGrowthData.map((d, i) => {
                      const x = 50 + (i * 62);
                      const yMembers = 190 - (d.cumMembers / maxCumCount) * 150;
                      const yMales = 190 - (d.cumMales / maxCumCount) * 150;
                      return { x, yMembers, yMales, ...d };
                    });

                    const membersPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMembers}`).join(" ");
                    const malesPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMales}`).join(" ");

                    const membersArea = `${membersPath} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;
                    const malesArea = `${malesPath} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;

                    return (
                      <>
                        <path d={membersArea} fill="url(#membersGrad)" />
                        <path d={malesArea} fill="url(#malesGrad)" />

                        <path d={membersPath} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={malesPath} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="3 1" strokeLinecap="round" strokeLinejoin="round" />

                        {points.map((p, idx) => (
                          <g 
                            key={idx}
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredGenIdx(idx)}
                            onMouseLeave={() => setHoveredGenIdx(null)}
                          >
                            <line x1={p.x} y1="40" x2={p.x} y2="190" stroke={hoveredGenIdx === idx ? "#991b1b" : "transparent"} strokeWidth="1" strokeDasharray="2 2" />

                            <circle cx={p.x} cy={p.yMembers} r={hoveredGenIdx === idx ? "6.5" : "4.5"} className="fill-red-700 stroke-white cursor-pointer" strokeWidth="1.5" />
                            <circle cx={p.x} cy={p.yMales} r={hoveredGenIdx === idx ? "5" : "3.5"} className="fill-amber-600 stroke-white cursor-pointer" strokeWidth="1" />

                            <text x={p.x} y="215" className={`font-serif text-[10px] text-center font-bold ${hoveredGenIdx === idx ? "fill-red-800" : "fill-stone-500"}`} textAnchor="middle">
                              Đời {p.generation}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                {/* Live Tooltip */}
                <div className="h-6 flex items-center justify-center text-[10px] bg-white border border-stone-150 rounded px-2 select-none">
                  {hoveredGenIdx !== null ? (
                    <div className="flex gap-4 font-bold text-stone-750">
                      <span className="text-red-955 font-serif">Đời thứ {populationGrowthData[hoveredGenIdx].generation}</span>
                      <span>Lũy kế nhân đinh: <strong className="text-red-800 font-mono">{populationGrowthData[hoveredGenIdx].cumMembers} members</strong>.</span>
                      <span>Sống có: <strong className="text-amber-800 font-mono">{populationGrowthData[hoveredGenIdx].cumMales} đinh</strong>.</span>
                    </div>
                  ) : (
                    <span className="text-stone-400 font-medium italic">Di chuyển chuột để kiểm nghiệm chi tiết sớ thành đinh theo từng Đời</span>
                  )}
                </div>
              </div>

              {/* Legend indicators */}
              <div className="flex justify-center gap-4 text-[10px] font-bold text-stone-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-650" /> Tổng thành viên lũy tích</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Hương đinh Nam bối lũy tích</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SVG Area for decades representation */}
              <div className="relative border border-stone-100 rounded-lg p-2.5 bg-stone-50/50">
                <svg viewBox="0 0 540 240" className="w-full h-auto select-none overflow-visible">
                  <defs>
                    <linearGradient id="decadesMembersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="decadesMalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <line x1="45" y1="40" x2="510" y2="40" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="90" x2="510" y2="90" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="140" x2="510" y2="140" stroke="#e5e5e5" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="45" y1="190" x2="510" y2="190" stroke="#a3a3a3" strokeWidth="1" />

                  <text x="35" y="44" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{maxDecadeCumCount}</text>
                  <text x="35" y="94" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{Math.round(maxDecadeCumCount * 0.6)}</text>
                  <text x="35" y="144" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">{Math.round(maxDecadeCumCount * 0.3)}</text>
                  <text x="35" y="194" className="fill-stone-400 font-mono text-[9px] text-right font-semibold" textAnchor="end">0</text>

                  {(() => {
                    const points = decadeGrowthData.map((d, i) => {
                      const x = 50 + (i * 64);
                      const yMembers = 190 - (d.cumMembers / maxDecadeCumCount) * 150;
                      const yMales = 190 - (d.cumMales / maxDecadeCumCount) * 150;
                      return { x, yMembers, yMales, ...d };
                    });

                    const membersPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMembers}`).join(" ");
                    const malesPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMales}`).join(" ");

                    const membersArea = `${membersPath} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;
                    const malesArea = `${malesPath} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;

                    return (
                      <>
                        <path d={membersArea} fill="url(#decadesMembersGrad)" />
                        <path d={malesArea} fill="url(#decadesMalesGrad)" />

                        <path d={membersPath} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={malesPath} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="3 1" strokeLinecap="round" strokeLinejoin="round" />

                        {points.map((p, idx) => (
                          <g 
                            key={idx}
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredDecadeIdx(idx)}
                            onMouseLeave={() => setHoveredDecadeIdx(null)}
                          >
                            <line x1={p.x} y1="40" x2={p.x} y2="190" stroke={hoveredDecadeIdx === idx ? "#991b1b" : "transparent"} strokeWidth="1" strokeDasharray="2 2" />
                            <circle cx={p.x} cy={p.yMembers} r={hoveredDecadeIdx === idx ? "6.5" : "4.5"} className="fill-red-700 stroke-white" strokeWidth="1.5" />
                            <circle cx={p.x} cy={p.yMales} r={hoveredDecadeIdx === idx ? "5" : "3.5"} className="fill-amber-600 stroke-white" strokeWidth="1" />
                            <text x={p.x} y="215" className={`font-serif text-[10px] text-center font-bold ${hoveredDecadeIdx === idx ? "fill-red-800" : "fill-stone-500"}`} textAnchor="middle">
                              {p.decadeStr}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                <div className="h-6 flex items-center justify-center text-[10px] bg-white border border-stone-150 rounded px-2 select-none">
                  {hoveredDecadeIdx !== null ? (
                    <div className="flex gap-4 font-bold text-stone-750">
                      <span className="text-red-955 font-serif">Thập kỷ {decadeGrowthData[hoveredDecadeIdx].decadeStr}</span>
                      <span>Mới trong kỷ: <strong className="text-red-800 font-mono">+{decadeGrowthData[hoveredDecadeIdx].newMembers} sinh nhân</strong>.</span>
                      <span>Trong đó có: <strong className="text-amber-800 font-mono">+{decadeGrowthData[hoveredDecadeIdx].newMales} đinh</strong>.</span>
                      <span>Lũy tích dòng tộc: <strong className="text-stone-850 font-mono">{decadeGrowthData[hoveredDecadeIdx].cumMembers} bối</strong>.</span>
                    </div>
                  ) : (
                    <span className="text-stone-400 font-medium italic">Sát trỏ chuột để đối chiếu lũy tích nhân số dòng họ theo từng Thập kỷ</span>
                  )}
                </div>
              </div>

              {/* Detailed Annual History Logs panel */}
              <div className="space-y-2 text-left bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/50 pb-2">
                  <span className="font-serif font-black text-amber-950 text-[11px] uppercase flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-800" />
                    BẢN TRA CỨU SINH NHÂN THEO NĂM LỊCH NIÊN
                  </span>
                  
                  {/* Miniature search */}
                  <input 
                    type="text"
                    placeholder="Gõ tìm năm sinh (ví dụ: 2005)..."
                    value={yearSearch}
                    onChange={(e) => setYearSearch(e.target.value)}
                    className="bg-white border border-stone-200 rounded px-2 py-1 text-[10px] w-full sm:w-44 focus:outline-none focus:border-red-800 shadow-inner"
                  />
                </div>

                <div className="max-h-28 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin divide-y divide-stone-100">
                  {filteredAnnualHistory.length === 0 ? (
                    <p className="text-[10px] text-stone-400 py-3 text-center italic font-semibold">Hiện chưa tìm thấy năm sinh phù hợp với truy vấn thiết lập.</p>
                  ) : (
                    filteredAnnualHistory.map((h) => (
                      <div key={h.year} className="flex items-start justify-between text-[11px] pt-1.5 first:pt-0">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="font-bold text-stone-850 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-800" /> 
                            Lịch niên năm {h.year}
                          </p>
                          <p className="text-[9.5px] text-stone-500 font-medium whitespace-normal leading-relaxed line-clamp-2" title={h.names.join(", ")}>
                            Tên cháu: <strong className="text-stone-750 font-bold">{h.names.join(", ")}</strong>
                          </p>
                        </div>
                        <div className="flex gap-2 font-mono shrink-0 select-none font-extrabold text-[10px] text-right">
                          <span className="text-red-800 font-bold bg-red-50 px-1.5 py-0.5 rounded leading-none">+{h.total} Sinh nhân</span>
                          <span className="text-amber-850 font-bold bg-amber-50 px-1.5 py-0.5 rounded leading-none">+{h.males} Đinh</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Legend indicators */}
              <div className="flex justify-center gap-4 text-[10px] font-bold text-stone-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-650" /> Tổng thành viên lũy tích</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Hương đinh Nam bối lũy tích</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Treasury Sub-Funds Curve Chart (Quỹ chung, Khuyến học, Tổ chức sự kiện trùng tu, Giỗ chạp) */}
        <div className="bg-white rounded-xl border border-stone-150 p-5 shadow-xs space-y-4 text-xs">
          <div>
            <h3 className="font-serif font-bold text-sm text-stone-850 flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-amber-700" />
              Tổng Quan Số Dư Của Các Quỹ Dòng Họ
            </h3>
            <p className="text-[11px] text-stone-500">
              Trị số tích lũy quỹ của từng quỹ sự vụ (Quỹ liên chi, Quỹ khuyến học trẻ đằng khoa, Quỹ tôn kiến lăng mộ, Quỹ giỗ chạp tế Tổ cổ sự).
            </p>
          </div>

          {/* Table display and bar graphics */}
          <div className="space-y-4 border border-stone-150 rounded-lg p-3 bg-stone-50/50">
            {fundStatistics.map((fund, idx) => {
              const percentage = Math.min(100, Math.max(12, (fund.balance / maxFundVal) * 100));
              return (
                <div 
                  key={idx} 
                  className="space-y-1"
                  onMouseEnter={() => setHoveredFundCategory(fund.fundName)}
                  onMouseLeave={() => setHoveredFundCategory(null)}
                >
                  <div className="flex justify-between font-bold text-[11px]">
                    <span className="font-serif text-slate-900">{fund.fundName}</span>
                    <span className="font-mono text-red-950 font-extrabold">{formatVND(fund.balance)}</span>
                  </div>

                  {/* Horizontal Bar Graphic */}
                  <div className="w-full h-4 bg-stone-200/55 rounded-full overflow-hidden border border-stone-150 flex items-center relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full cursor-pointer opacity-90 ${
                        fund.fundName.includes("chung") 
                          ? "bg-slate-700" 
                          : fund.fundName.includes("khuyến") 
                          ? "bg-purple-700" 
                          : fund.fundName.includes("sự nghiệp trùng tu")
                          ? "bg-red-850"
                          : "bg-amber-600"
                      }`}
                    />

                    {/* Little details within bars */}
                    <span className="absolute left-2 text-[9px] text-stone-800 font-extrabold pb-[1px]">
                      Hỷ cúng: {formatVND(fund.collections).replace("₫", "")} | Tế chi: {formatVND(fund.spent).replace("₫", "")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-[10px] text-stone-400 font-medium">
            <span>*Bao gồm Quỹ định chế khẩn hiến & Sổ sách thu chi thủ quỹ năm 2026.</span>
            <button onClick={() => onSetActiveTab("finance")} className="text-red-900 font-bold hover:underline cursor-pointer">
              Truy cập sổ quỹ chi tiết
            </button>
          </div>

        </div>

      </div>

      {/* 4. Traditional events and system audit ledger (Remains exactly identical to the visual mockup style for consistency, but reactive with props) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column (8 cols): Event detail and Ledger summary */}
        <div className="lg:col-span-8 space-y-6 text-xs">
          
          {/* Nearest Upcoming Event Widget */}
          {upcomingEvent && (
            <div className="bg-white rounded-xl border border-stone-150 shadow-xs overflow-hidden">
              <div className="border-b border-stone-100 px-5 py-4 bg-stone-100/50 flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold text-stone-850 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-red-800" />
                  Sự kiện tế lễ tộc đường cận kề
                </h3>
                <span className="rounded bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                  Lịch họ tộc
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2 text-left">
                  <h4 className="text-base font-bold text-red-950 font-serif leading-snug">
                    {upcomingEvent.title}
                  </h4>
                  <p className="text-stone-600 leading-relaxed text-[11px]">
                    {upcomingEvent.description}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-[#fbfaf6] p-4 rounded-lg border border-amber-500/10 text-stone-700 text-left">
                  <div className="space-y-1">
                    <span className="text-stone-400 block font-bold">Thời gian diễn ra:</span>
                    <p className="font-bold">Dương lịch: <strong className="text-stone-850">{upcomingEvent.solarDate}</strong></p>
                    <p className="font-bold">Âm lịch: <strong className="text-amber-800">{upcomingEvent.lunarDate}</strong></p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-stone-400 block font-bold">Địa điểm tôn kính:</span>
                    <p className="font-bold leading-relaxed">{upcomingEvent.location}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-stone-400 block font-bold font-bold">Thừa tế chủ trì:</span>
                    <p className="font-bold">{upcomingEvent.organizer}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-stone-400 block font-bold">Dự toán ngân quỹ:</span>
                    <p className="font-bold text-amber-800 font-mono text-xs">{formatVND(upcomingEvent.estimatedCost)}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button 
                    onClick={handleQuickWritePrayer}
                    className="w-full inline-flex items-center justify-center gap-1 bg-red-800 hover:bg-red-950 text-white rounded-lg px-3.5 py-2 font-bold cursor-pointer shadow-sm transition-all py-2.5"
                  >
                    <FileText className="h-3.5 w-3.5" /> Soạn thảo Sớ cúng bái (Hôm nay)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Ledger Activities */}
          <div className="bg-white rounded-xl border border-stone-150 shadow-xs">
            <div className="border-b border-stone-100 px-5 py-4 bg-stone-100/50 flex items-center justify-between">
              <h3 className="text-xs font-serif font-bold text-stone-850 flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-amber-700" />
                Giao dịch quỹ tộc môn mới nhất
              </h3>
              <button 
                onClick={() => onSetActiveTab("finance")}
                className="text-xs text-amber-900 hover:text-red-900 font-bold cursor-pointer"
              >
                Tất cả sổ thu chi
              </button>
            </div>
            <div className="p-4 overflow-x-auto text-left">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-stone-400 border-b border-stone-100 pb-2">
                    <th className="pb-2 font-semibold">Bổ túc nhân tự</th>
                    <th className="pb-2 font-semibold">Ngày lập</th>
                    <th className="pb-2 font-semibold">Danh mục sự sự</th>
                    <th className="pb-2 font-semibold text-right">Giá trị tiền quỹ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {transactions.slice(0, 4).map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-50/50 transition-all text-stone-700 text-xs">
                      <td className="py-2.5">
                        <div>
                          <p className="text-stone-800 font-bold">{tx.donorOrReceiver}</p>
                          <span className="text-[10px] text-stone-400 block font-medium">{tx.branch}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-stone-500 font-mono">{tx.date}</td>
                      <td className="py-2.5">
                        <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600 block w-max font-bold">
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-2.5 text-right font-bold text-xs font-mono select-none ${tx.type === "Thu" ? "text-emerald-700" : "text-red-700"}`}>
                        {tx.type === "Thu" ? "+" : "-"}{formatVND(tx.amount).replace("₫", "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column (4 cols): Smart utilities / System logs */}
        <div className="lg:col-span-4 space-y-6 text-xs text-left">
          {/* Quick Smart Actions for Admins */}
          <div className="bg-[#fbfaf6] rounded-xl border border-amber-200/50 shadow-xs p-4.5 space-y-4">
            <h3 className="text-xs font-serif font-bold text-stone-800 flex items-center gap-1.5 border-b border-amber-200/40 pb-2">
              <Clock className="h-4 w-4 text-amber-700" />
              Công cụ quản trị nhanh
            </h3>
            
            <div className="space-y-2">
              <button 
                onClick={handleQuickWritePrayer}
                className="w-full flex items-center justify-between text-left p-3 rounded-lg bg-white border border-stone-200 hover:border-amber-300 hover:bg-stone-50/30 transition-all group cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-50 text-red-800 flex items-center justify-center border border-red-100">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800">Tạo văn cúng Tổ đường</p>
                    <span className="text-[10px] text-stone-500 block">AI tự lập sớ tế ngày giỗ chạp</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-stone-400 group-hover:text-amber-650 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button 
                onClick={handleQuickAppealLetter}
                className="w-full flex items-center justify-between text-left p-3 rounded-lg bg-white border border-stone-200 hover:border-amber-300 hover:bg-stone-50/30 transition-all group cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800">Thư kêu gọi dâng cúng</p>
                    <span className="text-[10px] text-stone-500 block">Vận động công tâm quy hiến</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-stone-400 group-hover:text-amber-650 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button 
                onClick={() => onSetActiveTab("tree")}
                className="w-full flex items-center justify-between text-left p-3 rounded-lg bg-white border border-stone-200 hover:border-amber-300 hover:bg-stone-50/30 transition-all group cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800">Bổ sung danh linh</p>
                    <span className="text-[10px] text-stone-500 block">Khai nạp hương đinh thế hệ tự sự</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-stone-400 group-hover:text-amber-650 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          {/* System Audit Log */}
          <div className="bg-white rounded-xl border border-stone-150 shadow-xs p-4.5">
            <h3 className="text-xs font-serif font-bold text-stone-850 flex items-center gap-1.5 border-b border-stone-100 pb-2 mb-4">
              <Bell className="h-4 w-4 text-indigo-700" />
              Thông tri lịch sử hệ thống
            </h3>
            
            <div className="space-y-4">
              <div className="flex gap-3 text-xs leading-relaxed">
                <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-stone-800 font-bold">Bổ sung thành diệu sinh nhân</p>
                  <span className="text-[10px] text-stone-400 block mb-1">Hôm qua bởi Trưởng ban số hóa Cao Minh Tiến</span>
                  <p className="text-stone-500 text-[10px] bg-stone-50 p-1.5 rounded">Thêm cháu gái: Cao Thị Huyền Trang (Thế hệ thứ 8) đỗ Thạc sĩ kinh doanh quốc tế Fulbright.</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs leading-relaxed">
                <span className="h-2 w-2 rounded-full bg-red-650 mt-1.5 shrink-0" />
                <div>
                  <p className="text-stone-800 font-bold">Lập chứng từ thu chi tu bổ</p>
                  <span className="text-[10px] text-stone-400 block mb-1">26/05/2026 bởi Quản quỹ Cao Tiến Đạt</span>
                  <p className="text-stone-500 text-[10px] bg-stone-50 p-1.5 rounded">Ghi nhận khoản quy hiến 15,000,000đ đóng góp đợt một trùng tu Hữu vu từ bà Cao Thị Vân.</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs leading-relaxed">
                <span className="h-2 w-2 rounded-full bg-stone-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-stone-800 font-bold">Chỉnh lý bia mộ tộc công</p>
                  <span className="text-[10px] text-stone-400 block mb-1">19/05/2026 bởi Lão trưởng Cao Xuân Hòa</span>
                  <p className="text-stone-500 text-[10px] bg-stone-50 p-1.5 rounded">Sửa đổi thông tri tả vị, định danh lại tọa lạc mộ lăng của tổ tông đời thứ 3 Cụ Cao Văn Chước.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
