import { useEffect, useState } from 'react';
import { convertSolarToLunarText, convertSolarToLunarTextFromLich247 } from '../../utils/lunarConverter';

type SolarDateFieldsProps = {
  birthDate: string;
  deathDate: string;
  isLiving: boolean;
  theme?: 'amber' | 'rose';
  onBirthDateChange: (value: string) => void;
  onDeathDateChange: (value: string) => void;
  onBirthYearDetected: (year: string) => void;
  onDeathYearDetected: (year: string) => void;
};

const detectYear = (value: string) => {
  const parts = value.split('/');
  return parts.length === 3 && parts[2].length === 4 ? parts[2] : '';
};

export function SolarDateFields({
  birthDate,
  deathDate,
  isLiving,
  theme = 'amber',
  onBirthDateChange,
  onDeathDateChange,
  onBirthYearDetected,
  onDeathYearDetected
}: SolarDateFieldsProps) {
  const isRose = theme === 'rose';
  const wrapperClass = isRose
    ? 'grid grid-cols-2 gap-2 bg-rose-50/30 p-2 rounded border border-rose-950/10'
    : 'grid grid-cols-2 gap-2 bg-amber-50/20 p-2 rounded border border-amber-900/5';
  const labelClass = isRose
    ? 'text-[9px] font-semibold text-rose-950 uppercase block'
    : 'text-[9px] font-semibold text-amber-950 uppercase block';

  const [birthLunar, setBirthLunar] = useState('');
  const [deathLunar, setDeathLunar] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!birthDate) {
      setBirthLunar('');
      return;
    }
    convertSolarToLunarTextFromLich247(birthDate).then((value) => {
      if (!cancelled) setBirthLunar(value || convertSolarToLunarText(birthDate));
    });
    return () => {
      cancelled = true;
    };
  }, [birthDate]);

  useEffect(() => {
    let cancelled = false;
    if (isLiving || !deathDate) {
      setDeathLunar('');
      return;
    }
    convertSolarToLunarTextFromLich247(deathDate).then((value) => {
      if (!cancelled) setDeathLunar(value || convertSolarToLunarText(deathDate));
    });
    return () => {
      cancelled = true;
    };
  }, [deathDate, isLiving]);

  return (
    <div className={wrapperClass}>
      <div className="space-y-1">
        <label className={labelClass}>Ngày sinh Dương lịch</label>
        <input
          type="text"
          placeholder="19/04/1990"
          value={birthDate}
          onChange={(event) => {
            const value = event.target.value;
            onBirthDateChange(value);
            const year = detectYear(value);
            if (year) onBirthYearDetected(year);
          }}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
        />
        {birthLunar && (
          <p className="text-[9px] text-[#7b5800] leading-tight font-medium mt-0.5">
            Tức: {birthLunar}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className={labelClass}>Ngày mất Dương lịch</label>
        <input
          type="text"
          disabled={isLiving}
          placeholder={isLiving ? 'Còn sống' : '25/12/2021'}
          value={isLiving ? '' : deathDate}
          onChange={(event) => {
            const value = event.target.value;
            onDeathDateChange(value);
            const year = detectYear(value);
            if (year) onDeathYearDetected(year);
          }}
          className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary disabled:opacity-50"
        />
        {deathLunar && (
          <p className="text-[9px] text-rose-900 leading-tight font-medium mt-0.5">
            Tức: {deathLunar}
          </p>
        )}
      </div>
    </div>
  );
}
