import { Lunar } from 'lunar-javascript';

const MONTH_NAMES = new Map([
  ['gieng', 1],
  ['mot', 1],
  ['hai', 2],
  ['ba', 3],
  ['bon', 4],
  ['tu', 4],
  ['nam', 5],
  ['sau', 6],
  ['bay', 7],
  ['tam', 8],
  ['chin', 9],
  ['muoi', 10],
  ['muoi mot', 11],
  ['muoi hai', 12],
  ['chap', 12]
]);

const DAY_NAMES = new Map([
  ['mot', 1],
  ['hai', 2],
  ['ba', 3],
  ['bon', 4],
  ['tu', 4],
  ['nam', 5],
  ['lam', 5],
  ['sau', 6],
  ['bay', 7],
  ['tam', 8],
  ['chin', 9],
  ['muoi', 10],
  ['ram', 15]
]);

export function normalizeGenealogyDateText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function baseDate(rawText, defaultCalendar = 'unknown') {
  const calendar = ['solar', 'lunar', 'unknown'].includes(defaultCalendar) ? defaultCalendar : 'unknown';
  return {
    calendar,
    precision: 'unknown',
    day: null,
    month: null,
    year: null,
    rawText: String(rawText || '').trim(),
    certainty: 'uncertain',
    isLeapMonth: false
  };
}

function detectCalendar(normalized, defaultCalendar) {
  if (/\b(am|al|lunar|am lich)\b/.test(normalized)) return 'lunar';
  if (/\b(duong|dl|solar|duong lich)\b/.test(normalized)) return 'solar';
  return ['solar', 'lunar'].includes(defaultCalendar) ? defaultCalendar : 'unknown';
}

function monthNameToNumber(value) {
  const normalized = normalizeGenealogyDateText(value);
  if (MONTH_NAMES.has(normalized)) return MONTH_NAMES.get(normalized);
  return null;
}

function dayNameToNumber(value) {
  const normalized = normalizeGenealogyDateText(value)
    .replace(/^(ngay|mung|mong)\s+/g, '')
    .trim();
  if (/^\d{1,2}$/.test(normalized)) return Number(normalized);
  if (DAY_NAMES.has(normalized)) return DAY_NAMES.get(normalized);

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && parts[0] === 'muoi' && DAY_NAMES.has(parts[1])) {
    return 10 + DAY_NAMES.get(parts[1]);
  }
  if (parts.length === 2 && parts[0] === 'hai' && parts[1] === 'muoi') {
    return 20;
  }
  if (parts.length === 3 && parts[0] === 'hai' && parts[1] === 'muoi' && DAY_NAMES.has(parts[2])) {
    return 20 + DAY_NAMES.get(parts[2]);
  }
  if (parts.length === 2 && parts[0] === 'ba' && parts[1] === 'muoi') {
    return 30;
  }
  if (parts.length === 3 && parts[0] === 'ba' && parts[1] === 'muoi' && DAY_NAMES.has(parts[2])) {
    return 30 + DAY_NAMES.get(parts[2]);
  }
  return null;
}

function validDayMonth(day, month) {
  return Number.isInteger(day) && Number.isInteger(month) && day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

export function parseGenealogyDateText(value, defaultCalendar = 'unknown') {
  const rawText = String(value || '').trim();
  const result = baseDate(rawText, defaultCalendar);
  const normalized = normalizeGenealogyDateText(rawText);
  if (!normalized || /\b(khuyet|khong ro|chua ro|chua biet|unknown|n\/a|null)\b/.test(normalized)) {
    return result;
  }

  result.calendar = detectCalendar(normalized, defaultCalendar);
  result.certainty = /\b(khoang|uoc|doan|tam|co le|kha nang)\b/.test(normalized) ? 'uncertain' : 'verified';
  result.isLeapMonth = /\b(nhuan|leap)\b/.test(normalized);

  const fullDate = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{3,4})\b/);
  if (fullDate) {
    const day = Number(fullDate[1]);
    const month = Number(fullDate[2]);
    if (validDayMonth(day, month)) {
      result.day = day;
      result.month = month;
      result.year = Number(fullDate[3]);
      result.precision = 'full_date';
      if (result.calendar === 'unknown') result.calendar = defaultCalendar === 'lunar' ? 'lunar' : 'solar';
      return result;
    }
  }

  const dayMonthSlash = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})\b/);
  if (dayMonthSlash) {
    const day = Number(dayMonthSlash[1]);
    const month = Number(dayMonthSlash[2]);
    if (validDayMonth(day, month)) {
      result.day = day;
      result.month = month;
      result.year = null;
      result.precision = 'day_month';
      if (result.calendar === 'unknown') result.calendar = defaultCalendar === 'solar' ? 'solar' : 'lunar';
      return result;
    }
  }

  const dayMonthWords = normalized.match(/\b(?:ngay\s+)?(?:mung|mong)?\s*(\d{1,2}|[a-z]+(?:\s+[a-z]+){0,2})\s*thang\s*([a-z0-9\s]+?)(?:\b|$)/);
  if (dayMonthWords) {
    const monthRaw = dayMonthWords[2].replace(/\b(am|al|lich|duong|dl|nhuan)\b/g, '').trim();
    const month = /^\d{1,2}$/.test(monthRaw) ? Number(monthRaw) : monthNameToNumber(monthRaw);
    const day = dayNameToNumber(dayMonthWords[1]);
    if (validDayMonth(day, month)) {
      result.day = day;
      result.month = month;
      result.year = null;
      result.precision = 'day_month';
      if (result.calendar === 'unknown') result.calendar = defaultCalendar === 'solar' ? 'solar' : 'lunar';
      return result;
    }
  }

  const monthYear = normalized.match(/\bthang\s*(\d{1,2})\s*(?:nam)?\s*(\d{3,4})\b/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    if (month >= 1 && month <= 12) {
      result.month = month;
      result.year = Number(monthYear[2]);
      result.precision = 'month_year';
      return result;
    }
  }

  const yearOnly = normalized.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (yearOnly) {
    result.year = Number(yearOnly[1]);
    result.precision = result.certainty === 'uncertain' ? 'approximate' : 'year';
    return result;
  }

  result.precision = 'unknown';
  return result;
}

export function formatGenealogyDateStructured(date) {
  if (!date || typeof date !== 'object' || date.precision === 'unknown') return '';
  const calendarText = date.calendar === 'lunar' ? 'am lich' : date.calendar === 'solar' ? 'duong lich' : 'chua ro lich';
  if (date.precision === 'full_date' && date.day && date.month && date.year) {
    return `${date.day}/${date.month}/${date.year} ${calendarText}`;
  }
  if (date.precision === 'day_month' && date.day && date.month) {
    return `${date.day} thang ${date.month} ${calendarText}`;
  }
  if (date.precision === 'month_year' && date.month && date.year) {
    return `thang ${date.month}/${date.year} ${calendarText}`;
  }
  if ((date.precision === 'year' || date.precision === 'approximate') && date.year) {
    return `${date.precision === 'approximate' ? 'khoang ' : ''}${date.year}`;
  }
  return date.rawText || '';
}

export function convertLunarToSolar(_date) {
  const day = Number(_date?.day);
  const month = Number(_date?.month);
  const lunarYear = Number(_date?.lunarYear);
  if (!validDayMonth(day, month) || !Number.isInteger(lunarYear) || lunarYear < 1000 || lunarYear > 2150) {
    return null;
  }
  try {
    const lunar = Lunar.fromYmd(lunarYear, _date?.isLeapMonth ? -Math.abs(month) : month, day);
    const solar = lunar.getSolar();
    return {
      day: solar.getDay(),
      month: solar.getMonth(),
      year: solar.getYear(),
      isoDate: `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`,
      displayDate: `${String(solar.getDay()).padStart(2, '0')}/${String(solar.getMonth()).padStart(2, '0')}/${solar.getYear()}`
    };
  } catch {
    return null;
  }
}
