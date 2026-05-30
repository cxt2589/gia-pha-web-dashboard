type LunarDeathBurialFieldsProps = {
  lunarAnniversary: string;
  burialPlace: string;
  onLunarAnniversaryChange: (value: string) => void;
  onBurialPlaceChange: (value: string) => void;
};

export function LunarDeathBurialFields({
  lunarAnniversary,
  burialPlace,
  onLunarAnniversaryChange,
  onBurialPlaceChange
}: LunarDeathBurialFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase block min-h-[24px] leading-3">
          Ngày mất âm lịch / Kỵ nhật
        </label>
        <input
          type="text"
          placeholder="15/3 Canh Ngọ hoặc 13/6"
          value={lunarAnniversary}
          onChange={(event) => onLunarAnniversaryChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-[#7b5800] uppercase block min-h-[24px] leading-3">
          Nơi an táng lăng mộ
        </label>
        <input
          type="text"
          value={burialPlace}
          onChange={(event) => onBurialPlaceChange(event.target.value)}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}
