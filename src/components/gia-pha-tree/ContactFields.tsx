type ContactFieldsProps = {
  phone1: string;
  phone2: string;
  phone3: string;
  email: string;
  birthPlace: string;
  deathPlace: string;
  residence: string;
  isLiving: boolean;
  onPhone1Change: (value: string) => void;
  onPhone2Change: (value: string) => void;
  onPhone3Change: (value: string) => void;
  onEmailChange: (value: string) => void;
  onBirthPlaceChange: (value: string) => void;
  onDeathPlaceChange: (value: string) => void;
  onResidenceChange: (value: string) => void;
  birthPlacePlaceholder?: string;
  deathPlacePlaceholder?: string;
  residencePlaceholder?: string;
};

export function ContactFields({
  phone1,
  phone2,
  phone3,
  email,
  birthPlace,
  deathPlace,
  residence,
  isLiving,
  onPhone1Change,
  onPhone2Change,
  onPhone3Change,
  onEmailChange,
  onBirthPlaceChange,
  onDeathPlaceChange,
  onResidenceChange,
  birthPlacePlaceholder,
  deathPlacePlaceholder,
  residencePlaceholder
}: ContactFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block">
          Số điện thoại liên lạc (Nhập tối đa 3 số)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <input
            type="text"
            placeholder="SĐT số 1"
            value={phone1}
            onChange={(event) => onPhone1Change(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none"
          />
          <input
            type="text"
            placeholder="SĐT số 2"
            value={phone2}
            onChange={(event) => onPhone2Change(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none"
          />
          <input
            type="text"
            placeholder="SĐT số 3"
            value={phone3}
            onChange={(event) => onPhone3Change(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-1.5 text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block">
          Địa chỉ Email liên lạc
        </label>
        <input
          type="email"
          placeholder="vi-du@email.com"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
            Nơi sinh (Quê quán)
          </label>
          <input
            type="text"
            placeholder={birthPlacePlaceholder}
            value={birthPlace}
            onChange={(event) => onBirthPlaceChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
            Nơi mất
          </label>
          <input
            type="text"
            disabled={isLiving}
            placeholder={isLiving ? 'Còn sống' : deathPlacePlaceholder}
            value={isLiving ? '' : deathPlace}
            onChange={(event) => onDeathPlaceChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
          Nơi cư trú
        </label>
        <input
          type="text"
          placeholder={residencePlaceholder}
          value={residence}
          onChange={(event) => onResidenceChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>
    </>
  );
}
