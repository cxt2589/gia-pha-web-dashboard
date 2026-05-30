import React, { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Link2, Search, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { FamilyMember, UserSession } from "../types";

interface MemberAccountsManagerProps {
  usersList: UserSession[];
  members: FamilyMember[];
  currentUser: UserSession;
  onUpdateUsersList: (users: UserSession[]) => void;
}

const roleLabels: Record<UserSession["role"], string> = {
  admin: "Admin",
  user: "Thành viên",
  writer: "Biên tập",
  treasurer: "Thủ quỹ",
  secretary: "Thư ký"
};

const loginLabels: Record<UserSession["loginType"], string> = {
  username: "Tài khoản",
  zalo: "Zalo",
  email: "Gmail"
};

function normalizeUser(user: UserSession): UserSession {
  const isApproved = user.isApproved !== undefined ? user.isApproved : user.approvalStatus === "approved";
  return {
    ...user,
    isApproved,
    approvalStatus: user.approvalStatus || (isApproved ? "approved" : "pending"),
    kycStatus: user.kycStatus || (user.isKYCed ? "verified" : "not_submitted")
  };
}

export default function MemberAccountsManager({ usersList, members, currentUser, onUpdateUsersList }: MemberAccountsManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "kyc" | "not_kyc">("all");
  const [activeKycUserId, setActiveKycUserId] = useState<string | null>(null);
  const [memberLookupTerm, setMemberLookupTerm] = useState("");

  const normalizedUsers = useMemo(() => usersList.map(normalizeUser), [usersList]);
  const stats = useMemo(() => {
    const registered = normalizedUsers.length;
    const kyc = normalizedUsers.filter((user) => user.isKYCed || user.kycStatus === "verified").length;
    const approved = normalizedUsers.filter((user) => user.isApproved || user.approvalStatus === "approved").length;
    const pending = normalizedUsers.filter((user) => !user.isApproved && user.approvalStatus !== "approved").length;
    return { registered, kyc, approved, pending };
  }, [normalizedUsers]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return normalizedUsers.filter((user) => {
      const linkedMember = user.linkedMemberId ? members.find((member) => member.id === user.linkedMemberId) : undefined;
      const text = [
        user.fullName,
        user.username,
        user.email,
        user.phone,
        linkedMember?.name,
        user.loginType,
        user.role
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesSearch = !term || text.includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !user.isApproved) ||
        (statusFilter === "approved" && !!user.isApproved) ||
        (statusFilter === "kyc" && !!user.isKYCed) ||
        (statusFilter === "not_kyc" && !user.isKYCed);

      return matchesSearch && matchesStatus;
    });
  }, [members, normalizedUsers, searchTerm, statusFilter]);

  const updateUser = (userId: string, patch: Partial<UserSession>) => {
    onUpdateUsersList(
      normalizedUsers.map((user) => {
        if (user.id !== userId) return user;
        const next = { ...user, ...patch };
        if (patch.isKYCed !== undefined && patch.kycStatus === undefined) {
          next.kycStatus = patch.isKYCed ? "verified" : "not_submitted";
        }
        if (patch.isApproved !== undefined && patch.approvalStatus === undefined) {
          next.approvalStatus = patch.isApproved ? "approved" : "pending";
        }
        return next;
      })
    );
  };

  const rejectUser = (userId: string) => {
    updateUser(userId, {
      isApproved: false,
      approvalStatus: "rejected",
      isKYCed: false,
      kycStatus: "not_submitted"
    });
    if (activeKycUserId === userId) {
      setActiveKycUserId(null);
      setMemberLookupTerm("");
    }
  };

  const kycCandidateMembers = useMemo(() => {
    const term = memberLookupTerm.trim().toLowerCase();
    return members
      .filter((member) => {
        if (!term) return true;
        return [
          member.name,
          member.branch,
          member.birthYear,
          member.email,
          member.phone1,
          member.phone2,
          member.phone3,
          `đời ${member.generation}`
        ].filter(Boolean).join(" ").toLowerCase().includes(term);
      })
      .slice(0, 8);
  }, [memberLookupTerm, members]);

  const startKycMapping = (user: UserSession) => {
    setActiveKycUserId(user.id);
    setMemberLookupTerm(user.fullName || user.username || "");
  };

  const approveKycWithMember = (userId: string, member: FamilyMember) => {
    updateUser(userId, {
      linkedMemberId: member.id,
      fullName: member.name,
      isKYCed: true,
      kycStatus: "verified",
      isApproved: true,
      approvalStatus: "approved"
    });
    setActiveKycUserId(null);
    setMemberLookupTerm("");
  };

  const canAdmin = currentUser.role === "admin" || currentUser.roles?.includes("admin");

  return (
    <div className="space-y-5 text-stone-800">
      <section className="bg-white border border-stone-150 rounded-xl shadow-sm p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-red-800">Quản lý thành viên</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-stone-900">Thành viên đăng ký & xét duyệt</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-500">
              Theo dõi tài khoản đã đăng ký qua Zalo/Gmail hoặc thêm thủ công, trạng thái KYC và quyền được duyệt vào hệ thống gia phả.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full xl:min-w-[520px]">
            {[
              { label: "Đã đăng ký", value: stats.registered, icon: Users, color: "text-stone-800", bg: "bg-stone-50" },
              { label: "Đã KYC", value: stats.kyc, icon: ShieldCheck, color: "text-emerald-800", bg: "bg-emerald-50" },
              { label: "Đã duyệt", value: stats.approved, icon: UserCheck, color: "text-blue-800", bg: "bg-blue-50" },
              { label: "Chờ duyệt", value: stats.pending, icon: Clock3, color: "text-amber-800", bg: "bg-amber-50" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`${item.bg} rounded-lg border border-stone-150 p-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-stone-500">{item.label}</span>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <p className={`mt-2 font-mono text-2xl font-black ${item.color}`}>{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white border border-stone-150 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-stone-100 bg-stone-50/60 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên, email, Zalo, số điện thoại, người trong gia phả..."
              className="w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-red-800"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-red-800"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chưa duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="kyc">Đã KYC</option>
            <option value="not_kyc">Chưa KYC</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-white text-[10px] uppercase tracking-wide text-stone-400">
              <tr className="border-b border-stone-100">
                <th className="px-4 py-3 font-bold">Thành viên</th>
                <th className="px-4 py-3 font-bold">Tài khoản đăng ký</th>
                <th className="px-4 py-3 font-bold">Liên kết gia phả</th>
                <th className="px-4 py-3 font-bold">KYC</th>
                <th className="px-4 py-3 font-bold">Duyệt hệ thống</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredUsers.map((user) => {
                const linkedMember = user.linkedMemberId ? members.find((member) => member.id === user.linkedMemberId) : undefined;
                const isApproved = !!user.isApproved;
                const isKyc = !!user.isKYCed;
                return (
                  <React.Fragment key={user.id}>
                  <tr className="hover:bg-stone-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-950 text-amber-100 border border-amber-400 flex items-center justify-center font-bold overflow-hidden">
                          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.fullName || user.username).slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{user.fullName || user.username}</p>
                          <p className="mt-0.5 text-[10px] text-stone-400">Đăng ký: {user.regDate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-stone-700">{user.username}</p>
                      <p className="mt-1 text-[10px] text-stone-400">
                        {loginLabels[user.loginType]} · {user.email || user.phone || "Chưa có liên hệ"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {linkedMember ? (
                        <div>
                          <p className="font-semibold text-stone-800">{linkedMember.name}</p>
                          <p className="text-[10px] text-stone-400">{linkedMember.branch || `Đời ${linkedMember.generation}`}</p>
                        </div>
                      ) : (
                        <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 border border-amber-100">Chưa quy chiếu gia phả</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold border ${
                        isKyc ? "bg-emerald-50 text-emerald-800 border-emerald-150" : "bg-stone-50 text-stone-500 border-stone-200"
                      }`}>
                        {isKyc ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                        {isKyc ? "Đã KYC" : "Chưa KYC"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold border ${
                        isApproved ? "bg-blue-50 text-blue-800 border-blue-150" : "bg-amber-50 text-amber-800 border-amber-150"
                      }`}>
                        {isApproved ? <UserCheck className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                        {isApproved ? "Đã duyệt" : "Chưa duyệt"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canAdmin}
                          onClick={() => startKycMapping(user)}
                          className="rounded border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-800 disabled:opacity-40 hover:bg-blue-100"
                        >
                          <Link2 className="inline h-3 w-3 align-[-2px]" /> Quy chiếu KYC
                        </button>
                        <button
                          type="button"
                          disabled={!canAdmin || !linkedMember}
                          onClick={() => updateUser(user.id, { isKYCed: !isKyc, kycStatus: isKyc ? "not_submitted" : "verified" })}
                          className="rounded border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-stone-700 disabled:opacity-40 hover:bg-stone-50"
                          title={!linkedMember ? "Cần quy chiếu tài khoản với một thành viên trong gia phả trước khi duyệt KYC." : undefined}
                        >
                          {isKyc ? "Gỡ KYC" : "Duyệt KYC"}
                        </button>
                        <button
                          type="button"
                          disabled={!canAdmin}
                          onClick={() => updateUser(user.id, { isApproved: !isApproved, approvalStatus: isApproved ? "pending" : "approved" })}
                          className={`rounded px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-40 ${
                            isApproved ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-red-800 text-white hover:bg-red-900"
                          }`}
                        >
                          {isApproved ? "Gỡ duyệt" : "Duyệt"}
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectUser(user.id)}
                          className="rounded border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-800 hover:bg-red-100"
                        >
                          <UserX className="inline h-3 w-3 align-[-2px]" /> Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                  {activeKycUserId === user.id && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="rounded-lg border border-blue-150 bg-white p-4 shadow-sm">
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            <div className="lg:w-72 shrink-0">
                              <p className="font-serif font-bold text-stone-900">Quy chiếu KYC tài khoản</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                                Admin chọn đúng người trong cây gia phả để gán tài khoản này. Sau khi gán, hệ thống sẽ đánh dấu đã KYC và đã duyệt.
                              </p>
                              <div className="mt-3 rounded bg-stone-50 border border-stone-150 p-3 text-[11px]">
                                <p className="font-bold text-stone-800">{user.fullName || user.username}</p>
                                <p className="mt-1 font-mono text-stone-500">{user.username}</p>
                                <p className="mt-1 text-stone-500">{loginLabels[user.loginType]} · {user.email || user.phone || "Chưa có liên hệ"}</p>
                              </div>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                  value={memberLookupTerm}
                                  onChange={(event) => setMemberLookupTerm(event.target.value)}
                                  placeholder="Nhập tên, đời, chi họ, email hoặc số điện thoại trong gia phả..."
                                  className="w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-700"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-auto pr-1">
                                {kycCandidateMembers.map((member) => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => approveKycWithMember(user.id, member)}
                                    className="text-left rounded-lg border border-stone-150 bg-white p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-bold text-stone-900">{member.name}</p>
                                        <p className="mt-0.5 text-[10px] text-stone-500">
                                          Đời {member.generation} · {member.branch || "Chưa rõ chi họ"}
                                        </p>
                                        <p className="mt-1 text-[10px] text-stone-400">
                                          {member.birthYear || "khuyết"} - {member.isDeceased ? (member.deathYear || "khuyết") : "còn sống"}
                                        </p>
                                      </div>
                                      <span className="rounded bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-800">Gán & duyệt</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-between gap-2 border-t border-stone-100 pt-3">
                                <p className="text-[10px] text-stone-400">
                                  Tìm thấy {kycCandidateMembers.length} gợi ý. Nếu chưa có người phù hợp, cần bổ sung thành viên ở mục Gia phả trước.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveKycUserId(null);
                                    setMemberLookupTerm("");
                                  }}
                                  className="rounded border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-stone-50"
                                >
                                  Đóng quy chiếu
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-stone-400">Chưa có thành viên phù hợp bộ lọc.</div>
        )}
      </section>
    </div>
  );
}
