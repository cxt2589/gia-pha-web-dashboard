import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Coins, Landmark, ArrowUpRight, ArrowDownRight, Award, Plus, Calendar, Filter, Trash2, Search, X, Check, CheckCircle } from "lucide-react";
import { TreasuryTx, OutstandingMember, FamilyMember, UserSession } from "../types";

interface TreasuryProps {
  transactions: TreasuryTx[];
  outstandingMembers: OutstandingMember[];
  onAddTransaction: (tx: TreasuryTx) => void;
  onAddOutstandingMember: (member: OutstandingMember) => void;
  currentUser: UserSession;
}

export default function Treasury({ transactions, outstandingMembers, onAddTransaction, onAddOutstandingMember, currentUser }: TreasuryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Tất cả danh mục");
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddOutstandingOpen, setIsAddOutstandingOpen] = useState(false);

  // Form Tx states
  const [txType, setTxType] = useState<"Thu" | "Chi">("Thu");
  const [txAmount, setTxAmount] = useState(1000000);
  const [txDate, setTxDate] = useState("29/05/2026");
  const [txDonor, setTxDonor] = useState("");
  const [txBranch, setTxBranch] = useState("Chi Trưởng (Trường Yên)");
  const [txPurpose, setTxPurpose] = useState("");
  const [txCategory, setTxCategory] = useState<any>("Đóng góp thường niên");

  // Dynamic Preset Purposes for enhanced accounting granularity
  const [incomePurposes, setIncomePurposes] = useState<string[]>([
    "Đóng góp quỹ niên thường kỳ gia phả",
    "Phát tâm quyên dâng trùng tu ngôi Hữu vu",
    "Tuyển nạp Quỹ khuyến học trẻ đằng khoa",
    "Đại thí chủ cúng kiếng sự kiện Lễ Tế Tổ",
    "Quyên hiếu trợ duyên hoàn cảnh ngặt nghèo"
  ]);

  const [expensePurposes, setExpensePurposes] = useState<string[]>([
    "Chi mua nhang đăng, tế phẩm nghi thức giỗ",
    "Chi trùng tu đắp lại bảo tường, ngói mái tôn Từ Đường",
    "Chi trao thưởng khuyến tài khoa cử rằm tháng Tám",
    "Chi thăm bệnh, phong quyên tuất nghĩa tử bối",
    "Chi bồi trợ viết Chúc Văn tế cổ thư văn sớ"
  ]);

  const [selectedPresetPurpose, setSelectedPresetPurpose] = useState<string>("");
  const [isCustomPurpose, setIsCustomPurpose] = useState<boolean>(false);
  const [customPurposeInput, setCustomPurposeInput] = useState<string>("");
  const [shouldSaveNewPurpose, setShouldSaveNewPurpose] = useState<boolean>(true);

  // Synchronize defaults on transaction type changes
  React.useEffect(() => {
    const currentList = txType === "Thu" ? incomePurposes : expensePurposes;
    if (currentList.length > 0) {
      setSelectedPresetPurpose(currentList[0]);
      setIsCustomPurpose(false);
    } else {
      setSelectedPresetPurpose("khac");
      setIsCustomPurpose(true);
    }
  }, [txType, incomePurposes, expensePurposes]);

  // Form Scholar states
  const [schName, setSchName] = useState("");
  const [schAchievement, setSchAchievement] = useState("");
  const [schYear, setSchYear] = useState(2026);
  const [schBranch, setSchBranch] = useState("Chi Trưởng (Trường Yên)");
  const [schPrize, setSchPrize] = useState("");

  const categories = [
    "Tất cả danh mục",
    "Đóng góp thường niên",
    "Sự nghiệp Trùng tu",
    "Khuyến học",
    "Chi Tế lễ",
    "Hỗ trợ hoàn cảnh khó khăn",
    "Khác"
  ];

  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalCollected = transactions
      .filter(tx => tx.type === "Thu")
      .reduce((sum, tx) => sum + tx.amount, 0);
      
    const totalSpent = transactions
      .filter(tx => tx.type === "Chi")
      .reduce((sum, tx) => sum + tx.amount, 0);
      
    const balance = totalCollected - totalSpent;
    return { totalCollected, totalSpent, balance };
  }, [transactions]);

  // Group transactions for distribution ratio
  const distributionRatio = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    transactions.forEach(tx => {
      counts[tx.category] = (counts[tx.category] || 0) + tx.amount;
      total += tx.amount;
    });

    return Object.entries(counts).map(([cat, amount]) => ({
      name: cat,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0
    })).sort((a,b) => b.amount - a.amount);
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchSearch = tx.donorOrReceiver.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.purpose.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = activeCategory === "Tất cả danh mục" || tx.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [transactions, searchTerm, activeCategory]);

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== "admin" && currentUser.role !== "treasurer") {
      alert(`⚠️ Vi phạm phân quyền! Quý bối [${currentUser.fullName}] giữ vai trò [${currentUser.role.toUpperCase()}]. Chỉ có Chánh Tổng Quản (Admin) hoặc Thủ Quỹ Gia Tộc mới được gieo sớ ghi chép sổ cái.`);
      return;
    }
    if (!txDonor.trim()) return;

    // Resolve final calculated purpose based on presets vs custom fields
    const finalPurpose = isCustomPurpose ? customPurposeInput.trim() : selectedPresetPurpose;
    if (!finalPurpose) {
      alert("Kính thưa Trị sự viên, xin vui lòng kiểm tra bổ sung nội dung giải thích chứng từ hay quy mục tác nghiệp.");
      return;
    }

    // Optionally persist newly declared purpose in memory dropdown lists
    if (isCustomPurpose && shouldSaveNewPurpose) {
      if (txType === "Thu" && !incomePurposes.includes(finalPurpose)) {
        setIncomePurposes(prev => [...prev, finalPurpose]);
      } else if (txType === "Chi" && !expensePurposes.includes(finalPurpose)) {
        setExpensePurposes(prev => [...prev, finalPurpose]);
      }
    }

    const newTx: TreasuryTx = {
      id: "tx_" + Date.now(),
      type: txType,
      amount: Number(txAmount),
      date: txDate,
      donorOrReceiver: txDonor,
      branch: txBranch,
      purpose: finalPurpose,
      category: txCategory
    };

    onAddTransaction(newTx);
    
    // Reset Form
    setTxDonor("");
    setCustomPurposeInput("");
    setTxAmount(1000000);
    setIsAddTxOpen(false);
  };

  const handleSchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== "admin" && currentUser.role !== "treasurer") {
      alert(`⚠️ Vi phạm phân quyền! Sớ danh dự này chỉ có Ban Trị Sự Chánh quản hoặc Thủ Quỹ mới được phê văn.`);
      return;
    }
    if (!schName.trim() || !schAchievement.trim()) return;

    const newSch: OutstandingMember = {
      id: "sch_" + Date.now(),
      name: schName,
      achievement: schAchievement,
      year: Number(schYear),
      branch: schBranch,
      prizeAwarded: schPrize || undefined
    };

    onAddOutstandingMember(newSch);
    
    // Reset Form
    setSchName("");
    setSchAchievement("");
    setSchPrize("");
    setIsAddOutstandingOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Treasury Headers Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total balance card */}
        <div className="bg-gradient-to-br from-amber-900 to-red-950 p-5 rounded-2xl border border-amber-800 text-white shadow-lg space-y-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 font-bold text-7xl select-none translate-x-[15%] translate-y-[15%] font-serif leading-none text-amber-100">
            Cao
          </div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Tổng Tích Quỹ Hiện Có</span>
            <p className="text-3xl font-bold font-mono tracking-tight">{formatVND(stats.balance)}</p>
          </div>
          <p className="text-[11px] text-amber-100 leading-relaxed relative z-10">
            Số tích lập thực tại phục vụ công ích tế bái đại giỗ, khích lệ khuyến học & tu sửa từ miếu triều tiên khởi sắc dòng họ.
          </p>
        </div>

        {/* Total Inflow Tracker */}
        <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Tổng Thu Quyên Tiến</span>
            <p className="text-2xl font-bold font-mono text-emerald-800">+{formatVND(stats.totalCollected).replace("₫", "")}đ</p>
            <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block">
              Phát tâm công đức hằng kỳ
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-700 shrink-0 select-none">
            <ArrowUpRight className="h-6 w-6" />
          </div>
        </div>

        {/* Total Outflow Tracker */}
        <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Tổng Chi Sự Nghiệp</span>
            <p className="text-2xl font-bold font-mono text-red-800">-{formatVND(stats.totalSpent).replace("₫", "")}đ</p>
            <span className="text-[10px] text-red-700 font-medium bg-red-50 px-2.5 py-0.5 rounded-full inline-block">
              Chi công sự tôn tạo tế tự
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center border border-red-100 text-red-800 shrink-0 select-none">
            <ArrowDownRight className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Split section: Ledger vs Outstanding Honor Roll */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ledger Transactions (8 columns) */}
        <div className="lg:col-span-8 bg-white border border-stone-150 rounded-xl shadow-sm p-4.5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-lg font-serif font-semibold text-stone-850">
                Sổ Cái Kế Toán & Dân Công
              </h2>
              <p className="text-xs text-stone-500">
                Lưu trữ minh bạch các phiếu chi tu bổ từ đường, đóng góp từ con cháu hải ngoại và quỹ hội hiếu học.
              </p>
            </div>
            <button 
              onClick={() => {
                if (currentUser.role !== "admin" && currentUser.role !== "treasurer") {
                  alert(`⚠️ Quyền hạn Khuyết Vị! Quý bối [${currentUser.fullName}] có quyền là [${currentUser.role.toUpperCase()}]. Chỉ có Chánh Tổng quản (Admin) hoặc Thủ Quỹ mới được gieo sớ ghi chép tống sổ.`);
                  return;
                }
                setIsAddTxOpen(true);
              }}
              className={`inline-flex self-start sm:self-center items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow transition-all cursor-pointer ${
                (currentUser.role === "admin" || currentUser.role === "treasurer")
                  ? "bg-red-800 hover:bg-red-950 text-white"
                  : "bg-stone-105 bg-stone-100 text-stone-400 border border-stone-200"
              }`}
            >
              <Plus className="h-3.5 w-3.5" /> Ghi Phiếu Thu/Chi
            </button>
          </div>

          {/* Ledger Search/Filter bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Tìm danh linh đóng góp hoặc lý do chi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 placeholder-stone-400 focus:outline-none focus:border-amber-400 text-stone-800"
              />
            </div>

            {/* Select category */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-stone-400"><Filter className="h-3.5 w-3.5" /></span>
              <select 
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 text-stone-800 focus:outline-none focus:border-amber-400 font-medium"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transactions details list table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead>
                <tr className="text-stone-400 border-b border-stone-100 pb-2 bg-stone-50/50">
                  <th className="py-2.5 px-3 font-semibold">Tộc đinh gia nhân</th>
                  <th className="py-2.5 font-semibold">Ngày thực hiện</th>
                  <th className="py-2.5 font-semibold">Công sự sự lý</th>
                  <th className="py-2.5 font-semibold">Mục chính</th>
                  <th className="py-2.5 pr-3 font-semibold text-right">Giá trị tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-55">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50/70 transition-all">
                    <td className="py-3 px-3 font-semibold">
                      <div>
                        <p className="text-stone-800">{tx.donorOrReceiver}</p>
                        <span className="text-[9px] text-stone-400 leading-none block">{tx.branch}</span>
                      </div>
                    </td>
                    <td className="py-3 text-stone-500 font-mono text-[11px]">{tx.date}</td>
                    <td className="py-3 text-[11px] leading-relaxed max-w-[180px] truncate" title={tx.purpose}>{tx.purpose}</td>
                    <td className="py-3">
                      <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600 font-medium scale-95 origin-left">
                        {tx.category}
                      </span>
                    </td>
                    <td className={`py-3 pr-3 text-right font-mono font-bold text-xs ${tx.type === "Thu" ? "text-emerald-700" : "text-red-700"}`}>
                      {tx.type === "Thu" ? "Thụ +" : "Vơi -"}{formatVND(tx.amount).replace("₫", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scholar Honor Roll and Budgets statistics (4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Funds Distribution (Traditional SVG metrics bar chart) */}
          <div className="bg-[#fbfaf6] border border-amber-200/40 rounded-xl p-4.5 shadow-sm space-y-4">
            <h3 className="text-sm font-serif font-semibold text-stone-850 flex items-center gap-1.5 border-b border-amber-200/40 pb-2">
              <Landmark className="h-4 w-4 text-amber-700" />
              Cơ cấu đóng góp theo mục tế sự
            </h3>
            <div className="space-y-3">
              {distributionRatio.map((dr, idx) => {
                // Color mapping for progressive progress bars
                const colors = ["bg-amber-600", "bg-red-800", "bg-indigo-600", "bg-teal-600", "bg-emerald-600", "bg-stone-500"];
                const color = colors[idx % colors.length];
                return (
                  <div key={dr.name} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span className="font-semibold">{dr.name}</span>
                      <span className="font-bold text-stone-800">{dr.percentage.toFixed(0)}% ({formatVND(dr.amount).replace("₫", "").replace(",00", "")})</span>
                    </div>
                    {/* The decorative structural SVG / CSS bar chart */}
                    <div className="w-full bg-stone-200 h-2 rounded overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${dr.percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Honor scholars (Laurel Wreath display) */}
          <div className="bg-white border border-stone-150 rounded-xl p-4.5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-2">
              <h3 className="text-sm font-serif font-semibold text-stone-850 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" />
                Vinh Danh Học Giả Khuyến Học
              </h3>
              <button 
                onClick={() => {
                  if (currentUser.role !== "admin" && currentUser.role !== "treasurer") {
                    alert(`⚠️ Quyền hạn Khuyết Vị! Chỉ có Ban Trị Sự Chánh quản hoặc Thủ Quỹ mới được vinh danh.`);
                    return;
                  }
                  setIsAddOutstandingOpen(true);
                }}
                className={`text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${
                  (currentUser.role === "admin" || currentUser.role === "treasurer")
                    ? "text-red-800 hover:text-stone-950"
                    : "text-stone-400 cursor-not-allowed"
                }`}
              >
                + Bổ sung vinh dự
              </button>
            </div>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {outstandingMembers.map((sch) => (
                <div key={sch.id} className="p-3 rounded-lg bg-amber-50/50 border border-amber-500/10/40 relative overflow-hidden text-xs">
                  {/* Decorative faint background laurel or award */}
                  <div className="absolute right-2 bottom-1 opacity-5 text-amber-900 font-extrabold select-none pointer-events-none text-4xl">
                    <Award />
                  </div>
                  <div className="relative z-10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-red-900 flex items-center gap-1 font-serif text-sm">
                        {sch.name}
                      </h4>
                      <span className="text-[10px] text-stone-400 font-mono font-semibold">Khóa {sch.year}</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed text-[11px]">{sch.achievement}</p>
                    {sch.prizeAwarded && (
                      <p className="text-[10px] text-amber-800 font-bold bg-amber-100/60 p-1 rounded inline-block">
                        🎁 Phần thưởng dâng dâng: {sch.prizeAwarded}
                      </p>
                    )}
                    <span className="text-[9px] text-stone-400 uppercase font-bold tracking-wider block">Chi tộc phả tộc: {sch.branch}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal overlay */}
      <AnimatePresence>
        {isAddTxOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-md w-full border border-stone-200"
            >
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  Lập Chứng Từ Kế Toán Họ Tộc
                </h3>
                <button 
                  onClick={() => setIsAddTxOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleTxSubmit} className="p-5 space-y-4 text-xs">
                {/* Type selection */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => setTxType("Thu")}
                    className={`rounded-md py-1.5 font-bold transition-all cursor-pointer text-center ${
                      txType === "Thu" 
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    Thu (Dòng họ quy hiến / quyên góp)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTxType("Chi")}
                    className={`rounded-md py-1.5 font-bold transition-all cursor-pointer text-center ${
                      txType === "Chi" 
                        ? "bg-red-700 text-white shadow-sm"
                        : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    Chi (Công sự tu bổ tống bái)
                  </button>
                </div>

                {/* Amount & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Số tiền lập phiếu (VND):*</label>
                    <input 
                      type="number" 
                      required
                      placeholder="1000000" 
                      value={txAmount}
                      onChange={(e) => setTxAmount(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Ngày thực nhận/chi:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="dd/mm/yyyy" 
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                </div>

                {/* Name & Branch */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Nhân đinh đóng góp / Người thụ thụ:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ví dụ: Anh Cao Văn Thịnh" 
                      value={txDonor}
                      onChange={(e) => setTxDonor(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chi nhánh họ phái:*</label>
                    <select 
                      value={txBranch}
                      onChange={(e) => setTxBranch(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    >
                      <option value="Chi Trưởng (Trường Yên)">Chi Trưởng (Trường Yên)</option>
                      <option value="Chi Thứ Hai (Yên Khánh)">Chi Thứ Hai (Yên Khánh)</option>
                      <option value="Chi Thứ Ba (Gia Sinh)">Chi Thứ Ba (Gia Sinh)</option>
                      <option value="Trị Sự Ban">Ban Trị Sự Dòng Họ</option>
                    </select>
                  </div>
                </div>

                {/* Category selection */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Phân nhóm mục thu chi hợp quản:*</label>
                  <select 
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                  >
                    <option value="Đóng góp thường niên">Đóng góp thường niên</option>
                    <option value="Sự nghiệp Trùng tu">Sự nghiệp Trùng tu</option>
                    <option value="Khuyến học">Khuyến học</option>
                    <option value="Chi Tế lễ">Chi Tế lễ</option>
                    <option value="Hỗ trợ hoàn cảnh khó khăn">Hỗ trợ hoàn cảnh khó khăn</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                {/* Purpose Selection - Preset quick actions & Custom Input option */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">
                      Mục đích {txType === "Thu" ? "Thu Quỹ" : "Chi Tiền"}:*
                    </label>
                    <select 
                      value={isCustomPurpose ? "khac" : selectedPresetPurpose}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "khac") {
                          setIsCustomPurpose(true);
                        } else {
                          setIsCustomPurpose(false);
                          setSelectedPresetPurpose(val);
                        }
                      }}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs font-semibold font-serif"
                    >
                      {(txType === "Thu" ? incomePurposes : expensePurposes).map((p, pIdx) => (
                        <option key={pIdx} value={p}>{p}</option>
                      ))}
                      <option value="khac">-- Khác / Ghi nhận mục đích mới tự nhập --</option>
                    </select>
                  </div>

                  {isCustomPurpose && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-1 pb-1"
                    >
                      <label className="font-semibold text-[10px] text-red-900 block uppercase tracking-wider">
                        Điền mục đích / chứng từ thu chi khác:*
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ví dụ: Chi thanh toán tổ phục vụ dọn cỏ, sơn tường Từ Đường..."
                        value={customPurposeInput}
                        onChange={(e) => setCustomPurposeInput(e.target.value)}
                        className="w-full bg-stone-50 border border-red-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-semibold text-xs"
                      />
                      <label className="flex items-center gap-1.5 pt-1 text-[10px] text-stone-500 font-bold select-none cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={shouldSaveNewPurpose}
                          onChange={(e) => setShouldSaveNewPurpose(e.target.checked)}
                          className="rounded text-red-800 focus:ring-red-800 h-3.5 w-3.5 cursor-pointer"
                        />
                        Lưu mục đích mới này vào danh sách dùng nhanh lần sau
                      </label>
                    </motion.div>
                  )}
                </div>

                {/* Submit button footer */}
                <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddTxOpen(false)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-250 rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Hạ sớ Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer"
                  >
                    Kính chép Chứng Từ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Outstanding scholar modal */}
      <AnimatePresence>
        {isAddOutstandingOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-sm w-full border border-stone-200"
            >
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  Khai báo Vinh danh Khuyến Học
                </h3>
                <button 
                  onClick={() => setIsAddOutstandingOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSchSubmit} className="p-5 space-y-4 text-xs">
                {/* Scholar name */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Tên con cháu đạt thành tựu:*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: Cao Xuân Hưng" 
                    value={schName}
                    onChange={(e) => setSchName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>

                {/* Year & Branch */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Năm ghi danh lập công:</label>
                    <input 
                      type="number" 
                      required
                      value={schYear}
                      onChange={(e) => setSchYear(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chi nhánh họ tộc:*</label>
                    <select 
                      value={schBranch}
                      onChange={(e) => setSchBranch(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    >
                      <option value="Chi Trưởng (Trường Yên)">Chi Trưởng (Trường Yên)</option>
                      <option value="Chi Thứ Hai (Yên Khánh)">Chi Thứ Hai (Yên Khánh)</option>
                      <option value="Chi Thứ Ba (Gia Sinh)">Chi Thứ Ba (Gia Sinh)</option>
                    </select>
                  </div>
                </div>

                {/* Achievements text */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Chi tiết thành tích vinh danh:*</label>
                  <textarea 
                    rows={2.5}
                    required
                    placeholder="Ví dụ: Đỗ Thủ khoa trường Đại học Bách Khoa, đạt Học hàm Phó giáo sư hóa học..." 
                    value={schAchievement}
                    onChange={(e) => setSchAchievement(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs resize-none"
                  />
                </div>

                {/* Priest cash Award */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Phần thưởng & Lễ vật dòng họ trao tặng:</label>
                  <input 
                    type="text" 
                    placeholder="Bằng khen vinh danh & 3.000.000đ" 
                    value={schPrize}
                    onChange={(e) => setSchPrize(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>

                {/* Submit button footer */}
                <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddOutstandingOpen(false)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-250 rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Bỏ qua
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer"
                  >
                    Kính lập Vinh danh
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
