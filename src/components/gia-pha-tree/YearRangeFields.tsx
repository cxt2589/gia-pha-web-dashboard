type YearRangeFieldsProps = {
  birthYear: string;
  deathYear: string;
  isLiving: boolean;
  deathPlaceholder?: string;
  onBirthYearChange: (value: string) => void;
  onDeathYearChange: (value: string) => void;
};

export function YearRangeFields({
  birthYear,
  deathYear,
  isLiving,
  deathPlaceholder = 'Năm mất',
  onBirthYearChange,
  onDeathYearChange
}: YearRangeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block h-6 flex items-end pb-0.5">Năm sinh</label>
        <input
          type="text"
          placeholder="1885"
          value={birthYear}
          onChange={(event) => onBirthYearChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block h-6 flex items-end pb-0.5">Năm mất (bỏ trống nếu sống)</label>
        <input
          type="text"
          disabled={isLiving}
          placeholder={isLiving ? 'Còn sống' : deathPlaceholder}
          value={isLiving ? '' : deathYear}
          onChange={(event) => onDeathYearChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary disabled:opacity-50"
        />
      </div>
    </div>
  );
}
