type LivingStatusFieldsProps = {
  livingId: string;
  deceasedId: string;
  isLiving: boolean;
  livingLabel?: string;
  onLivingChange: (isLiving: boolean) => void;
  accent?: 'primary' | 'rose';
};

export function LivingStatusFields({
  livingId,
  deceasedId,
  isLiving,
  livingLabel = 'Người này còn sống',
  onLivingChange,
  accent = 'primary'
}: LivingStatusFieldsProps) {
  const checkboxClass = accent === 'rose'
    ? 'w-3.5 h-3.5 text-rose-600 border-[#8c716e]/20 rounded focus:ring-rose-500'
    : 'w-3.5 h-3.5 text-primary border-[#8c716e]/20 rounded focus:ring-amber-500';
  const livingLabelClass = accent === 'rose'
    ? 'text-[10px] font-sans font-bold text-rose-900 cursor-pointer'
    : 'text-[10px] font-sans font-bold text-[#7b5800] cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <input
        type="checkbox"
        id={livingId}
        checked={isLiving}
        onChange={(event) => onLivingChange(event.target.checked)}
        className={checkboxClass}
      />
      <label htmlFor={livingId} className={livingLabelClass}>
        {livingLabel}
      </label>
      <input
        type="checkbox"
        id={deceasedId}
        checked={!isLiving}
        onChange={(event) => {
          if (event.target.checked) onLivingChange(false);
        }}
        className={checkboxClass}
      />
      <label htmlFor={deceasedId} className="text-[10px] font-sans font-bold text-[#8b1c1c] cursor-pointer">
        Đã mất
      </label>
    </div>
  );
}
