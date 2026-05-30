const RANK_ROLE_OPTIONS = [
  '',
  'Trưởng chi',
  'Trưởng tộc',
  'Đệ nhị',
  'Đệ tam',
  'Gái cả',
  'Gái thứ 1',
  'Gái thứ 2',
  'Gái thứ 3',
  'Đích tôn'
];

type MemberIdentityFieldsProps = {
  name: string;
  gender: 'nam' | 'nữ';
  rankRole: string;
  customSuffix: string;
  autoTitle: string;
  onNameChange: (value: string) => void;
  onGenderChange: (value: 'nam' | 'nữ') => void;
  onRankRoleChange: (value: string) => void;
  onCustomSuffixChange: (value: string) => void;
  nameLabel?: string;
  namePlaceholder?: string;
};

export function MemberIdentityFields({
  name,
  gender,
  rankRole,
  customSuffix,
  autoTitle,
  onNameChange,
  onGenderChange,
  onRankRoleChange,
  onCustomSuffixChange,
  nameLabel = 'Họ & Tên hậu duệ *',
  namePlaceholder = 'Cao Văn Xuân'
}: MemberIdentityFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block h-5 flex items-end pb-0.5">
            {nameLabel}
          </label>
          <input
            type="text"
            required
            placeholder={namePlaceholder}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block font-semibold text-[#7b5800] h-5 flex items-end pb-0.5">
            Giới tính
          </label>
          <select
            value={gender}
            onChange={(event) => onGenderChange(event.target.value as 'nam' | 'nữ')}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none focus:border-primary"
          >
            <option value="nam">Nam (Con trai)</option>
            <option value="nữ">Nữ (Con gái)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 p-2.5 bg-amber-50/20 border border-[#8c716e]/10 rounded-sm">
        <label className="text-[10px] font-mono text-ink-charcoal/60 uppercase block font-semibold">
          Tước hàm/Danh xưng (Vừa chọn vừa điền)
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] font-sans text-ink-charcoal/50 block">
              1. Vai vế/Danh xưng chính
            </label>
            <select
              value={RANK_ROLE_OPTIONS.includes(rankRole) ? rankRole : (rankRole ? 'custom' : '')}
              onChange={(event) => {
                if (event.target.value !== 'custom') {
                  onRankRoleChange(event.target.value);
                }
              }}
              className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none focus:border-primary"
            >
              <option value="">-- Không chọn --</option>
              <option value="Trưởng tộc">Trưởng tộc</option>
              <option value="Trưởng chi">Trưởng chi</option>
              <option value="Đích tôn">Đích tôn</option>
              <option value="Đệ nhị">Đệ nhị</option>
              <option value="Đệ tam">Đệ tam</option>
              <option value="Gái cả">Gái cả</option>
              <option value="Gái thứ 1">Gái thứ 1</option>
              <option value="Gái thứ 2">Gái thứ 2</option>
              <option value="Gái thứ 3">Gái thứ 3</option>
              <option value="custom">Nhập tự do...</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-sans text-ink-charcoal/50 block">
              Nhập vai vế (nếu tự do)
            </label>
            <input
              type="text"
              placeholder="Hoặc tự nhập vai vế..."
              value={rankRole}
              onChange={(event) => onRankRoleChange(event.target.value)}
              className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-sans text-ink-charcoal/50 block">
            2. Tước vị / Học hàm / Danh hiệu khác (nếu có)
          </label>
          <input
            type="text"
            placeholder="Tiến sĩ, Đại tá, Giáo sư, Anh hùng..."
            value={customSuffix}
            onChange={(event) => onCustomSuffixChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none focus:border-primary"
          />
        </div>

        <div className="text-[9px] text-[#7b5800] bg-white/50 border border-amber-100 rounded px-1.5 py-1 font-sans flex flex-col gap-0.5">
          <span className="font-bold uppercase tracking-wider text-[8px] text-ink-charcoal/55">
            Danh xưng hiển thị tự động:
          </span>
          <span className="font-semibold text-[10px] text-primary">{autoTitle}</span>
        </div>
      </div>
    </>
  );
}
