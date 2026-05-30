import { LivingStatusFields } from './LivingStatusFields';
import { SolarDateFields } from './SolarDateFields';
import { YearRangeFields } from './YearRangeFields';

type SpouseFormFieldsProps = {
  mode: 'spouse' | 'edit_spouse';
  name: string;
  birthYear: string;
  deathYear: string;
  birthPlace: string;
  deathPlace: string;
  residence: string;
  lunarAnniversary: string;
  phone1: string;
  phone2: string;
  phone3: string;
  isLiving: boolean;
  solarBirthDate: string;
  solarDeathDate: string;
  email: string;
  onNameChange: (value: string) => void;
  onBirthYearChange: (value: string) => void;
  onDeathYearChange: (value: string) => void;
  onBirthPlaceChange: (value: string) => void;
  onDeathPlaceChange: (value: string) => void;
  onResidenceChange: (value: string) => void;
  onLunarAnniversaryChange: (value: string) => void;
  onPhone1Change: (value: string) => void;
  onPhone2Change: (value: string) => void;
  onPhone3Change: (value: string) => void;
  onLivingChange: (isLiving: boolean) => void;
  onSolarBirthDateChange: (value: string) => void;
  onSolarDeathDateChange: (value: string) => void;
  onEmailChange: (value: string) => void;
};

export function SpouseFormFields({
  mode,
  name,
  birthYear,
  deathYear,
  birthPlace,
  deathPlace,
  residence,
  lunarAnniversary,
  phone1,
  phone2,
  phone3,
  isLiving,
  solarBirthDate,
  solarDeathDate,
  email,
  onNameChange,
  onBirthYearChange,
  onDeathYearChange,
  onBirthPlaceChange,
  onDeathPlaceChange,
  onResidenceChange,
  onLunarAnniversaryChange,
  onPhone1Change,
  onPhone2Change,
  onPhone3Change,
  onLivingChange,
  onSolarBirthDateChange,
  onSolarDeathDateChange,
  onEmailChange
}: SpouseFormFieldsProps) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block font-bold text-rose-800">
          {mode === 'edit_spouse' ? 'Họ & Tên vợ / chồng cần sửa *' : 'Họ & Tên vợ / chồng bổ sung *'}
        </label>
        <input
          type="text"
          required
          placeholder="Lê Thị Huệ (Thứ thất)"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1.5 px-2 text-xs focus:outline-none focus:border-primary font-semibold text-rose-900"
        />
      </div>

      <LivingStatusFields
        livingId="isLivingSpouseForm"
        deceasedId="isDeceasedSpouseForm"
        isLiving={isLiving}
        accent="rose"
        onLivingChange={(nextIsLiving) => {
          onLivingChange(nextIsLiving);
          if (nextIsLiving) {
            onDeathYearChange('');
            onSolarDeathDateChange('');
          }
        }}
      />

      <YearRangeFields
        birthYear={birthYear}
        deathYear={deathYear}
        isLiving={isLiving}
        deathPlaceholder="1970"
        onBirthYearChange={onBirthYearChange}
        onDeathYearChange={onDeathYearChange}
      />

      <SolarDateFields
        birthDate={solarBirthDate}
        deathDate={solarDeathDate}
        isLiving={isLiving}
        theme="rose"
        onBirthDateChange={onSolarBirthDateChange}
        onDeathDateChange={onSolarDeathDateChange}
        onBirthYearDetected={onBirthYearChange}
        onDeathYearDetected={onDeathYearChange}
      />

      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block min-h-[24px] leading-3">
          Ngày mất âm lịch / Kỵ nhật
        </label>
        <input
          type="text"
          placeholder="15/3 Canh Ngọ hoặc 13/6"
          value={lunarAnniversary}
          onChange={(event) => onLunarAnniversaryChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
            Quê quán (Nơi sinh)
          </label>
          <input
            type="text"
            placeholder="Phú Thọ"
            value={birthPlace}
            onChange={(event) => onBirthPlaceChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
            Nơi mất
          </label>
          <input
            type="text"
            disabled={isLiving}
            placeholder={isLiving ? 'Còn sống' : 'Ninh Bình'}
            value={isLiving ? '' : deathPlace}
            onChange={(event) => onDeathPlaceChange(event.target.value)}
            className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-[#8c716e]/10">
        <span className="text-[10px] font-serif font-bold text-primary uppercase tracking-wide">
          Thông tin cá nhân
        </span>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">
          Nơi cư trú
        </label>
        <input
          type="text"
          placeholder="Ninh Bình"
          value={residence}
          onChange={(event) => onResidenceChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none"
        />
      </div>

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
          placeholder="vi-du-phoi-ngau@email.com"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>

      <p className="text-[9.5px] text-rose-900 bg-rose-50 p-2 rounded border border-rose-100/50 leading-normal">
        * Vợ mới thêm sẽ tự động được gán là Chính thất, Thứ thất hoặc Kế thất theo thứ tự trong hồ sơ thờ phụng của cụ.
      </p>
    </div>
  );
}
