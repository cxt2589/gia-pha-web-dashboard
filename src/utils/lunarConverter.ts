import { Solar, Lunar } from 'lunar-javascript';

const parseSolarDateParts = (solarDateStr?: string): { day: number; month: number; year: number } | null => {
  if (!solarDateStr) return null;

  const cleanStr = solarDateStr.trim();
  const parts = cleanStr.includes('/') ? cleanStr.split('/') : cleanStr.split('-');
  if (parts.length !== 3) return null;

  let day = 0;
  let month = 0;
  let year = 0;

  if (cleanStr.includes('-') && parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);

    if (year < 100) {
      year += year >= 30 ? 1900 : 2000;
    }

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000 || year > 2150) return null;

  return { day, month, year };
};

export async function convertSolarToLunarTextFromLich247(solarDateStr?: string): Promise<string> {
  const parts = parseSolarDateParts(solarDateStr);
  if (!parts) return '';

  try {
    const response = await fetch(`/api/lunar/day?d=${parts.day}&m=${parts.month}&y=${parts.year}`);
    if (!response.ok) throw new Error(`LICH247 HTTP ${response.status}`);
    const payload = await response.json();
    const data = payload?.data || payload?.result || payload;
    const lunar = data?.lunar || data?.am_lich || data?.lunar_date || data;
    const canChi = data?.can_chi || data?.canChi || data?.can_chi_date || {};
    const lunarDay = lunar?.day ?? lunar?.ngay ?? lunar?.lunar_day;
    const lunarMonth = lunar?.month ?? lunar?.thang ?? lunar?.lunar_month;
    const canChiYear = canChi?.year || canChi?.nam || canChi?.can_chi_nam;
    if (!lunarDay || !lunarMonth || !canChiYear) return '';
    const day = String(lunarDay).padStart(2, '0');
    const month = String(Math.abs(Number(lunarMonth))).padStart(2, '0');
    const leapSuffix = lunar.is_leap || lunar.leap || lunar.nhuan ? ' nhuận' : '';
    return `${day}/${month}${leapSuffix} ${canChiYear}`;
  } catch (error) {
    console.warn('LICH247 lunar conversion fallback for:', solarDateStr, error);
    return convertSolarToLunarText(solarDateStr);
  }
}

export async function deriveLunarAnniversaryFromSolarDeathDateViaLich247(solarDeathDate?: string): Promise<string> {
  const text = await convertSolarToLunarTextFromLich247(solarDeathDate);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})(\s+nhu\u1eadn)?/);
  if (!match) return deriveLunarAnniversaryFromSolarDeathDate(solarDeathDate);
  const day = match[1].padStart(2, '0');
  const monthNumber = Number(match[2]);
  const monthLabel = monthNumber === 1 ? 'Gi\u00eang' : monthNumber === 12 ? 'Ch\u1ea1p' : String(monthNumber).padStart(2, '0');
  return `Ng\u00e0y ${day} th\u00e1ng ${monthLabel}${match[3] || ''} (\u00c2m l\u1ecbch)`;
}

/**
 * Converts a Solar Date string (DD/MM/YYYY) into Lunar Date with Can Chi,
 * e.g., "19/04/1990" -> "24/03 Canh Ngọ"
 */
export function convertSolarToLunarText(solarDateStr?: string): string {
  const parts = parseSolarDateParts(solarDateStr);
  if (!parts) return '';

  const { day, month, year } = parts;
  
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    
    const lDay = lunar.getDay();
    const lMonth = lunar.getMonth();
    const lYear = lunar.getYear();
    
    // Traditional Vietnamese Heavenly Stems (Thiên can) & Earthly Branches (Địa chi)
    const stems = ["Gi\u00e1p", "\u1ea4t", "B\u00ednh", "\u0110inh", "M\u1eadu", "K\u1ef7", "Canh", "T\u00e2n", "Nh\u00e2m", "Qu\u00fd"];
    const branches = ["T\u00fd", "S\u1eedu", "D\u1ea7n", "M\u00e3o", "Th\u00ecn", "T\u1ecb", "Ng\u1ecd", "M\u00f9i", "Th\u00e2n", "D\u1eadu", "Tu\u1ea5t", "H\u1ee3i"];
    
    // Stem index formula
    const stemIdx = (lYear - 4) % 10;
    const branchIdx = (lYear - 4) % 12;
    
    const stemName = stems[stemIdx >= 0 ? stemIdx : stemIdx + 10];
    const branchName = branches[branchIdx >= 0 ? branchIdx : branchIdx + 12];
    const canChiYear = `${stemName} ${branchName}`;
    
    const dStr = lDay < 10 ? `0${lDay}` : `${lDay}`;
    const mStr = Math.abs(lMonth) < 10 ? `0${Math.abs(lMonth)}` : `${Math.abs(lMonth)}`;
    
    // Leap month check: commonly returned as negative in getMonth() or isMonthLeap()
    const leapSuffix = lunar.getMonth() < 0 ? ' nhu\u1eadn' : '';
    
    return `${dStr}/${mStr}${leapSuffix} ${canChiYear}`;
  } catch (error) {
    console.warn('Lunar conversion failure for:', solarDateStr, error);
    return '';
  }
}

export function deriveLunarAnniversaryFromSolarDeathDate(solarDeathDate?: string): string {
  const parts = parseSolarDateParts(solarDeathDate);
  if (!parts) return '';

  try {
    const solar = Solar.fromYmd(parts.year, parts.month, parts.day);
    const lunar = solar.getLunar();
    const lunarMonth = Math.abs(lunar.getMonth());
    const monthLabel = lunarMonth === 1 ? 'Gi\u00eang' : lunarMonth === 12 ? 'Ch\u1ea1p' : String(lunarMonth).padStart(2, '0');
    const leapSuffix = lunar.getMonth() < 0 ? ' nhu\u1eadn' : '';
    return `Ng\u00e0y ${String(lunar.getDay()).padStart(2, '0')} th\u00e1ng ${monthLabel}${leapSuffix} (\u00c2m l\u1ecbch)`;
  } catch (error) {
    console.warn('Lunar anniversary derivation failure for:', solarDeathDate, error);
    return '';
  }
}

/**
 * Decodes the lunar anniversary string into month and day,
 * then calculates the solar date for the current/next year and counts down.
 */
export interface AnniversaryInfo {
  solarDateStr: string;   // e.g., "15/06/2026"
  dayOfWeek: string;      // e.g., "Thứ Hai"
  daysLeft: number;       // e.g., 18 (positive, or 0, or negative if passed)
  isToday: boolean;
  isPassed: boolean;
  nextSolarDateStr?: string;
  nextDayOfWeek?: string;
  nextDaysLeft?: number;
}

export function parseLunarAnniversary(lunarAnniversaryStr?: string): { day: number; month: number } | null {
  if (!lunarAnniversaryStr) return null;
  const str = lunarAnniversaryStr.trim();
  
  const dayMatch = str.match(/Ngày\s+(\d+)/i);
  const monthMatch = str.match(/tháng\s+([^\s\()]+)/i);
  
  if (!dayMatch) return null;
  const day = parseInt(dayMatch[1], 10);
  
  let month = 1;
  if (monthMatch) {
    const mStr = monthMatch[1].toLowerCase().trim();
    if (mStr.includes('giêng')) {
      month = 1;
    } else if (mStr.includes('chạp')) {
      month = 12;
    } else {
      month = parseInt(mStr, 10);
    }
  } else {
    return null;
  }
  
  if (isNaN(day) || isNaN(month)) return null;
  return { day, month };
}

export function getAnniversaryCountdown(lunarAnniversaryStr?: string): AnniversaryInfo | null {
  const parsed = parseLunarAnniversary(lunarAnniversaryStr);
  if (!parsed) return null;
  
  const { day, month } = parsed;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    
    // Convert current year lunar date
    const lunarThisYear = Lunar.fromYmd(currentYear, month, day);
    const solarThisYear = lunarThisYear.getSolar();
    const solarDateThisYear = new Date(solarThisYear.getYear(), solarThisYear.getMonth() - 1, solarThisYear.getDay());
    solarDateThisYear.setHours(0, 0, 0, 0);
    
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const formattedThisYearStr = `${solarThisYear.getDay() < 10 ? '0' : ''}${solarThisYear.getDay()}/${solarThisYear.getMonth() < 10 ? '0' : ''}${solarThisYear.getMonth()}/${solarThisYear.getYear()}`;
    const dayOfWeekThisYear = daysOfWeek[solarDateThisYear.getDay()];
    
    const diffTimeThisYear = solarDateThisYear.getTime() - today.getTime();
    const diffDaysThisYear = Math.round(diffTimeThisYear / (1000 * 60 * 60 * 24));
    
    const isToday = diffDaysThisYear === 0;
    const isPassed = diffDaysThisYear < 0;
    
    let result: AnniversaryInfo = {
      solarDateStr: formattedThisYearStr,
      dayOfWeek: dayOfWeekThisYear,
      daysLeft: diffDaysThisYear,
      isToday,
      isPassed
    };
    
    if (isPassed) {
      // Find next lunar year's occurrence
      const nextYear = currentYear + 1;
      const lunarNextYear = Lunar.fromYmd(nextYear, month, day);
      const solarNextYear = lunarNextYear.getSolar();
      const solarDateNextYear = new Date(solarNextYear.getYear(), solarNextYear.getMonth() - 1, solarNextYear.getDay());
      solarDateNextYear.setHours(0, 0, 0, 0);
      
      const formattedNextYearStr = `${solarNextYear.getDay() < 10 ? '0' : ''}${solarNextYear.getDay()}/${solarNextYear.getMonth() < 10 ? '0' : ''}${solarNextYear.getMonth()}/${solarNextYear.getYear()}`;
      const dayOfWeekNextYear = daysOfWeek[solarDateNextYear.getDay()];
      
      const diffTimeNextYear = solarDateNextYear.getTime() - today.getTime();
      const diffDaysNextYear = Math.round(diffTimeNextYear / (1000 * 60 * 60 * 24));
      
      result.nextSolarDateStr = formattedNextYearStr;
      result.nextDayOfWeek = dayOfWeekNextYear;
      result.nextDaysLeft = diffDaysNextYear;
    }
    
    return result;
  } catch (err) {
    console.warn("Anniversary countdown failure", lunarAnniversaryStr, err);
    return null;
  }
}
