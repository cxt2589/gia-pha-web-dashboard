import React from 'react';
import { Solar, Lunar } from 'lunar-javascript';
import { Calendar, ChevronLeft, ChevronRight, Compass, Info, Moon, RefreshCw, Star, Sun } from 'lucide-react';

type Lich247DayInfo = {
  solar: { day: number; month: number; year: number };
  lunar: { day: number; month: number; year: number; isLeap?: boolean };
  canChi: { day: string; month: string; year: string; hour?: string };
  dayOfWeek: string;
  term: string;
  truc: string;
  isHoangDao?: boolean;
  isBlackDay?: boolean;
  isDaiCat?: boolean;
  zodiacHours: string[];
};

type ConversionResult = Lich247DayInfo & {
  source: string;
  targetType: 'Lunar' | 'Solar';
  day: number;
  month: number;
  year: number;
  directions: { xi: string; cai: string };
  lunarObject: any;
};

const GAN_MAP: Record<string, string> = {
  jia: 'Giáp', yi: 'Ất', bing: 'Bính', ding: 'Đinh', wu: 'Mậu',
  ji: 'Kỷ', geng: 'Canh', xin: 'Tân', ren: 'Nhâm', gui: 'Quý',
};

const ZHI_MAP: Record<string, string> = {
  zi: 'Tý', chou: 'Sửu', yin: 'Dần', mao: 'Mão', chen: 'Thìn', si: 'Tỵ',
  wu: 'Ngọ', wei: 'Mùi', shen: 'Thân', you: 'Dậu', xu: 'Tuất', hai: 'Hợi',
};

const ANIMAL_MAP: Record<string, string> = {
  zi: 'Chuột', chou: 'Trâu', yin: 'Hổ', mao: 'Mèo', chen: 'Rồng', si: 'Rắn',
  wu: 'Ngựa', wei: 'Dê', shen: 'Khỉ', you: 'Gà', xu: 'Chó', hai: 'Heo',
};

const SOLAR_TERM_MAP: Record<string, string> = {
  '立春': 'Lập Xuân', '雨水': 'Vũ Thủy', '惊蛰': 'Kinh Trập', '春分': 'Xuân Phân',
  '清明': 'Thanh Minh', '谷雨': 'Cốc Vũ', '立夏': 'Lập Hạ', '小满': 'Tiểu Mãn',
  '芒种': 'Mang Chủng', '夏至': 'Hạ Chí', '小暑': 'Tiểu Thử', '大暑': 'Đại Thử',
  '立秋': 'Lập Thu', '处暑': 'Xử Thử', '白露': 'Bạch Lộ', '秋分': 'Thu Phân',
  '寒露': 'Hàn Lộ', '霜降': 'Sương Giáng', '立冬': 'Lập Đông', '小雪': 'Tiểu Tuyết',
  '大雪': 'Đại Tuyết', '冬至': 'Đông Chí', '小寒': 'Tiểu Hàn', '大寒': 'Đại Hàn',
};

const WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const toVietnameseGanChi = (gan: string, zhi: string): string => {
  const g = GAN_MAP[String(gan || '').toLowerCase()] || '';
  const z = ZHI_MAP[String(zhi || '').toLowerCase()] || '';
  return g && z ? `${g} ${z}` : (g || z || 'Không rõ');
};

const getZodiacAnimal = (zhi: string): string => ANIMAL_MAP[String(zhi || '').toLowerCase()] || 'không rõ';

const getHyThanDirection = (dayGan: string): string => {
  const gan = dayGan.toLowerCase();
  if (['jia', 'ji'].includes(gan)) return 'Đông Bắc';
  if (['yi', 'geng'].includes(gan)) return 'Tây Bắc';
  if (['bing', 'xin'].includes(gan)) return 'Tây Nam';
  if (['ding', 'ren'].includes(gan)) return 'Chính Nam';
  return 'Đông Nam';
};

const getTaiThanDirection = (dayGan: string): string => {
  const gan = dayGan.toLowerCase();
  if (['jia', 'yi'].includes(gan)) return 'Đông Nam';
  if (['bing', 'ding'].includes(gan)) return 'Chính Đông';
  if (gan === 'wu') return 'Chính Bắc';
  if (gan === 'ji') return 'Chính Nam';
  if (['geng', 'xin'].includes(gan)) return 'Chính Tây';
  if (gan === 'ren') return 'Tây Bắc';
  return 'Chính Nam';
};

const translateJieQi = (value: string): string => {
  if (!value) return 'Không rõ';
  return SOLAR_TERM_MAP[value] || value;
};

const getZodiacHoursFallback = (dayZhi: string): string[] => {
  if (['zi', 'wu', '子', '午'].includes(dayZhi)) {
    return ['Tý (23h-1h)', 'Sửu (1h-3h)', 'Mão (5h-7h)', 'Ngọ (11h-13h)', 'Thân (15h-17h)', 'Dậu (17h-19h)'];
  }
  if (['chou', 'wei', '丑', '未'].includes(dayZhi)) {
    return ['Dần (3h-5h)', 'Mão (5h-7h)', 'Tỵ (9h-11h)', 'Thân (15h-17h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)'];
  }
  if (['yin', 'shen', '寅', '申'].includes(dayZhi)) {
    return ['Tý (23h-1h)', 'Sửu (1h-3h)', 'Thìn (7h-9h)', 'Tỵ (9h-11h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)'];
  }
  if (['mao', 'you', '卯', '酉'].includes(dayZhi)) {
    return ['Tý (23h-1h)', 'Dần (3h-5h)', 'Mão (5h-7h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Dậu (17h-19h)'];
  }
  if (['chen', 'xu', '辰', '戌'].includes(dayZhi)) {
    return ['Dần (3h-5h)', 'Thìn (7h-9h)', 'Tỵ (9h-11h)', 'Thân (15h-17h)', 'Dậu (17h-19h)', 'Hợi (21h-23h)'];
  }
  return ['Sửu (1h-3h)', 'Thìn (7h-9h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)'];
};

const dayQualityLabel = (info?: Pick<Lich247DayInfo, 'isDaiCat' | 'isHoangDao' | 'isBlackDay'>) => {
  if (info?.isDaiCat) return 'Đại cát';
  if (info?.isHoangDao) return 'Hoàng đạo';
  if (info?.isBlackDay) return 'Hắc đạo';
  return 'Bình thường';
};

const dayQualityClass = (info?: Pick<Lich247DayInfo, 'isDaiCat' | 'isHoangDao' | 'isBlackDay'>) => {
  if (info?.isDaiCat || info?.isHoangDao) return 'text-emerald-800';
  if (info?.isBlackDay) return 'text-red-800';
  return 'text-stone-700';
};

const getAvoidanceNotes = (info?: Pick<Lich247DayInfo, 'isBlackDay' | 'isHoangDao' | 'isDaiCat' | 'truc'>) => {
  if (!info) return ['Chưa có dữ liệu đánh giá ngày.'];
  const notes: string[] = [];
  if (info.isBlackDay) notes.push('Hạn chế khởi công việc lớn, cưới hỏi, ký kết hoặc khai trương nếu không thật cần thiết.');
  if (info.truc) notes.push(`Trực ${info.truc}: nên đối chiếu thêm mục đích công việc trước khi chọn giờ.`);
  if (info.isHoangDao || info.isDaiCat) notes.push('Có thể ưu tiên các khung giờ Hoàng đạo, vẫn cần xét tuổi và việc cụ thể.');
  return notes.length ? notes : ['Không có cảnh báo đặc biệt từ dữ liệu ngày hiện tại.'];
};

const sameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatSolarDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

function buildFallbackDayInfo(date: Date): Lich247DayInfo {
  const now = new Date();
  const solar = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  const lunar = solar.getLunar();
  return {
    solar: { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() },
    lunar: {
      day: lunar.getDay(),
      month: Math.abs(lunar.getMonth()),
      year: lunar.getYear(),
      isLeap: lunar.getMonth() < 0,
    },
    canChi: {
      day: toVietnameseGanChi(lunar.getDayGan(), lunar.getDayZhi()),
      month: toVietnameseGanChi(lunar.getMonthGan(), lunar.getMonthZhi()),
      year: toVietnameseGanChi(lunar.getYearGan(), lunar.getYearZhi()),
      hour: toVietnameseGanChi(lunar.getTimeGan(), lunar.getTimeZhi()),
    },
    dayOfWeek: WEEKDAY_LABELS[date.getDay()],
    term: translateJieQi(lunar.getJieQi() || 'Không có'),
    truc: 'Không rõ',
    zodiacHours: getZodiacHoursFallback(lunar.getDayZhi()),
  };
}

export default function LichAmSection() {
  const today = React.useMemo(() => new Date(), []);
  const [direction, setDirection] = React.useState<'solar2lunar' | 'lunar2solar'>('solar2lunar');
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const [sDay, setSDay] = React.useState(today.getDate());
  const [sMonth, setSMonth] = React.useState(today.getMonth() + 1);
  const [sYear, setSYear] = React.useState(today.getFullYear());
  const [lDay, setLDay] = React.useState(15);
  const [lMonth, setLMonth] = React.useState(8);
  const [lYear, setLYear] = React.useState(today.getFullYear());
  const [lIsLeap, setLIsLeap] = React.useState(false);

  const [dayInfo, setDayInfo] = React.useState<Lich247DayInfo>(() => buildFallbackDayInfo(today));
  const [conversionResult, setConversionResult] = React.useState<ConversionResult | null>(null);
  const [isLoadingDay, setIsLoadingDay] = React.useState(false);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 151 }, (_, i) => 1900 + i);

  const fetchDayInfo = React.useCallback(async (date: Date): Promise<Lich247DayInfo> => {
    const fallback = buildFallbackDayInfo(date);
    try {
      const response = await fetch(`/api/lunar/day?d=${date.getDate()}&m=${date.getMonth() + 1}&y=${date.getFullYear()}`);
      if (!response.ok) return fallback;
      const payload = await response.json();
      const data = payload?.data || {};
      const lunar = data.lunar || {};
      const canChi = data.can_chi || {};
      return {
        solar: {
          day: Number(data.solar?.day ?? fallback.solar.day),
          month: Number(data.solar?.month ?? fallback.solar.month),
          year: Number(data.solar?.year ?? fallback.solar.year),
        },
        lunar: {
          day: Number(lunar.day ?? fallback.lunar.day),
          month: Number(lunar.month ?? fallback.lunar.month),
          year: Number(lunar.year ?? fallback.lunar.year),
          isLeap: Boolean(lunar.is_leap || lunar.leap || lunar.nhuan || fallback.lunar.isLeap),
        },
        canChi: {
          day: canChi.day || fallback.canChi.day,
          month: canChi.month || fallback.canChi.month,
          year: canChi.year || fallback.canChi.year,
          hour: canChi.hour || fallback.canChi.hour,
        },
        dayOfWeek: data.day_of_week || fallback.dayOfWeek,
        term: data.tiet_khi || fallback.term,
        truc: data.truc || fallback.truc,
        isHoangDao: data.isHoangDao,
        isBlackDay: data.isBlackDay,
        isDaiCat: data.isDaiCat,
        zodiacHours: Array.isArray(data.gioHoangDao) && data.gioHoangDao.length ? data.gioHoangDao : fallback.zodiacHours,
      };
    } catch (error) {
      console.warn('LICH247 day info fallback:', error);
      return fallback;
    }
  }, []);

  const buildSolarConversion = React.useCallback(async (date: Date): Promise<ConversionResult> => {
    const info = await fetchDayInfo(date);
    const now = new Date();
    const solar = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    const lunarObject = solar.getLunar();
    return {
      ...info,
      source: `Dương lịch: Ngày ${formatSolarDate(date)}`,
      targetType: 'Lunar',
      day: info.lunar.day,
      month: info.lunar.month,
      year: info.lunar.year,
      directions: {
        xi: getHyThanDirection(lunarObject.getDayGan()),
        cai: getTaiThanDirection(lunarObject.getDayGan()),
      },
      lunarObject,
    };
  }, [fetchDayInfo]);

  const selectSolarDate = React.useCallback(async (date: Date) => {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(nextDate);
    setSDay(nextDate.getDate());
    setSMonth(nextDate.getMonth() + 1);
    setSYear(nextDate.getFullYear());
    setDirection('solar2lunar');
    setIsLoadingDay(true);
    try {
      const result = await buildSolarConversion(nextDate);
      setDayInfo(result);
      setConversionResult(result);
    } finally {
      setIsLoadingDay(false);
    }
  }, [buildSolarConversion]);

  const handleConvert = React.useCallback(async () => {
    try {
      if (direction === 'solar2lunar') {
        await selectSolarDate(new Date(sYear, sMonth - 1, sDay));
        return;
      }

      const lunarObj = Lunar.fromYmd(lYear, lMonth, lDay);
      const solarObj = lunarObj.getSolar();
      const solarDate = new Date(solarObj.getYear(), solarObj.getMonth() - 1, solarObj.getDay());
      const info = await fetchDayInfo(solarDate);
      setConversionResult({
        ...info,
        source: `Âm lịch: Ngày ${lDay}/${lMonth}/${lYear} ${lIsLeap ? '(Nhuận)' : ''}`,
        targetType: 'Solar',
        day: solarObj.getDay(),
        month: solarObj.getMonth(),
        year: solarObj.getYear(),
        directions: { xi: getHyThanDirection(lunarObj.getDayGan()), cai: getTaiThanDirection(lunarObj.getDayGan()) },
        lunarObject: lunarObj,
      });
      setDayInfo(info);
      setSelectedDate(solarDate);
      setCalendarMonth(new Date(solarDate.getFullYear(), solarDate.getMonth(), 1));
    } catch (err) {
      console.error(err);
      alert('Phát hiện ngày không hợp lệ. Vui lòng kiểm tra lại số ngày trong tháng.');
    }
  }, [direction, fetchDayInfo, lDay, lIsLeap, lMonth, lYear, sDay, sMonth, sYear, selectSolarDate]);

  React.useEffect(() => {
    void selectSolarDate(today);
  }, [selectSolarDate, today]);

  const calendarDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const blanks = Array.from({ length: firstDay.getDay() }, () => null);
    const dates = Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1));
    return [...blanks, ...dates];
  }, [calendarMonth]);

  const goToday = () => {
    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    void selectSolarDate(now);
  };

  const activeResult = conversionResult;

  return (
    <div className="space-y-8 animate-fade-in" id="lunar-calendar-converter-root">
      <div className="text-center md:text-left space-y-2 border-b border-[#8c716e]/15 pb-6">
        <span className="text-xs font-mono tracking-widest text-secondary uppercase font-bold">Thần cơ dị toán</span>
        <h2 className="font-serif text-3xl font-extrabold text-primary tracking-tight">Bộ Quy Đổi Lịch Âm - Dương</h2>
        <p className="text-xs md:text-sm text-ink-charcoal/70 leading-relaxed font-sans max-w-2xl">
          Công cụ dịch chuyển cổ lịch Việt Nam phục vụ việc định chế giỗ chạp, lễ nghi, hiếu hỉ, tra cứu phong thủy và thời thần hằng ngày thuận tiện nhất cho dòng họ và khách viếng.
        </p>
      </div>

      <div className="bg-white border border-[#8c716e]/15 rounded p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <p className="font-serif text-lg font-extrabold text-primary">Lịch tháng và đánh giá ngày</p>
              <p className="text-[11px] text-ink-charcoal/60">Chọn một ngày trên lịch để xem tiết khí, Can Chi, Hoàng đạo/Hắc đạo và giờ tốt.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="h-8 w-8 inline-flex items-center justify-center border border-[#8c716e]/20 rounded hover:bg-silk-paper"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-32 text-center text-xs font-bold text-ink-charcoal">
              {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </span>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="h-8 w-8 inline-flex items-center justify-center border border-[#8c716e]/20 rounded hover:bg-silk-paper"
              aria-label="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="h-8 px-3 text-xs font-bold border border-primary/30 text-primary rounded hover:bg-primary/5">
              Hôm nay
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-ink-charcoal/50 uppercase mb-1">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                if (!date) return <div key={`blank-${index}`} className="aspect-square" />;
                const isSelected = sameDate(date, selectedDate);
                const isToday = sameDate(date, today);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => void selectSolarDate(date)}
                    className={`aspect-square rounded border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-primary text-silk-paper border-primary shadow-sm'
                        : isToday
                          ? 'bg-amber-50 text-primary border-amber-300'
                          : 'bg-silk-paper/40 border-[#8c716e]/10 text-ink-charcoal hover:border-primary/40 hover:bg-white'
                    }`}
                  >
                    <span>{date.getDate()}</span>
                    {isToday && !isSelected && <span className="text-[8px] font-medium">nay</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-silk-paper/50 border border-[#8c716e]/10 rounded p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono text-[#7b5800] font-bold uppercase">{formatSolarDate(selectedDate)} · {dayInfo.dayOfWeek}</p>
                <h3 className="font-serif text-xl font-black text-primary">
                  {dayQualityLabel(dayInfo)}
                </h3>
              </div>
              {isLoadingDay && <span className="text-[10px] text-stone-500">Đang tải...</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-ink-charcoal/55">Âm lịch:</span> <strong>{dayInfo.lunar.day}/{dayInfo.lunar.month}/{dayInfo.lunar.year}</strong></div>
              <div><span className="text-ink-charcoal/55">Can Chi:</span> <strong>{dayInfo.canChi.day}</strong></div>
              <div><span className="text-ink-charcoal/55">Tiết khí:</span> <strong>{dayInfo.term}</strong></div>
              <div><span className="text-ink-charcoal/55">Trực:</span> <strong>{dayInfo.truc}</strong></div>
            </div>
            <div className="border-t border-[#8c716e]/10 pt-3">
              <p className="text-[11px] font-bold text-stone-700 mb-1">Kiêng kỵ tham khảo</p>
              <ul className="space-y-1 text-[11px] text-stone-600 leading-relaxed">
                {getAvoidanceNotes(dayInfo).map((note) => <li key={note}>- {note}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white border border-[#8c716e]/15 rounded p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex bg-silk-paper p-1 rounded-sm border border-[#8c716e]/10">
              <button
                onClick={() => {
                  setDirection('solar2lunar');
                  setConversionResult(null);
                }}
                className={`flex-1 py-2 text-xs font-sans font-bold rounded-sm transition-all flex items-center justify-center gap-1.5 ${
                  direction === 'solar2lunar' ? 'bg-primary text-silk-paper shadow' : 'text-ink-charcoal hover:text-primary hover:bg-white/50'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Dương lịch → Âm lịch</span>
              </button>
              <button
                onClick={() => {
                  setDirection('lunar2solar');
                  setConversionResult(null);
                }}
                className={`flex-1 py-2 text-xs font-sans font-bold rounded-sm transition-all flex items-center justify-center gap-1.5 ${
                  direction === 'lunar2solar' ? 'bg-primary text-silk-paper shadow' : 'text-ink-charcoal hover:text-primary hover:bg-white/50'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Âm lịch → Dương lịch</span>
              </button>
            </div>

            {direction === 'solar2lunar' ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-primary font-serif font-bold text-sm">
                  <Sun className="w-4 h-4 text-amber-600" />
                  <span>Cập nhật ngày Dương lịch cần quy đổi</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Ngày</label>
                    <select value={sDay} onChange={(e) => setSDay(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {days.map((d) => <option key={d} value={d}>Ngày {d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Tháng</label>
                    <select value={sMonth} onChange={(e) => setSMonth(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {months.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Năm</label>
                    <select value={sYear} onChange={(e) => setSYear(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-primary font-serif font-bold text-sm">
                  <Moon className="w-4 h-4 text-indigo-700" />
                  <span>Cập nhật ngày Âm lịch cần quy đổi</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Ngày âm</label>
                    <select value={lDay} onChange={(e) => setLDay(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Ngày {d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Tháng âm</label>
                    <select value={lMonth} onChange={(e) => setLMonth(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {months.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-ink-charcoal/50 uppercase">Năm âm</label>
                    <select value={lYear} onChange={(e) => setLYear(Number(e.target.value))} className="w-full text-xs font-sans p-2 bg-silk-paper border border-[#8c716e]/20 rounded focus:outline-none focus:border-primary text-ink-charcoal">
                      {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-2 bg-silk-paper p-2.5 rounded border border-[#8c716e]/10 mt-1">
                  <input id="lIsLeapCheckbox" type="checkbox" checked={lIsLeap} onChange={(e) => setLIsLeap(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary border-[#8c716e]/30 cursor-pointer" />
                  <label htmlFor="lIsLeapCheckbox" className="text-xs font-sans text-ink-charcoal/80 cursor-pointer select-none">
                    Tháng này là <strong>tháng Nhuận</strong>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-[#8c716e]/10 space-y-3">
            <button onClick={() => void handleConvert()} className="w-full py-2.5 bg-[#8b1c1c] hover:bg-[#a02222] text-silk-paper rounded font-sans font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>BẮT ĐẦU QUY ĐỔI CHI TIẾT</span>
            </button>
            <button onClick={goToday} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-ink-charcoal border border-slate-300 rounded font-sans font-medium text-xs transition-all flex items-center justify-center">
              Chọn ngày hôm nay
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {activeResult ? (
            <div className="bg-white border border-primary/25 rounded-md p-6 shadow-md shadow-primary/5 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
              <div className="border-b border-[#8c716e]/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono tracking-wider font-extrabold text-[#7b5800] uppercase block">{activeResult.source}</span>
                  <h3 className="font-serif text-xl font-black text-primary mt-1">
                    {activeResult.targetType === 'Lunar'
                      ? <>Kết quả Âm lịch: <strong className="text-primary text-2xl">Ngày {activeResult.day}</strong> tháng {activeResult.month} {activeResult.lunar.isLeap ? '(Nhuận)' : ''}</>
                      : <>Kết quả Dương lịch: <strong className="text-primary text-2xl">Ngày {activeResult.day}/{activeResult.month}/{activeResult.year}</strong></>}
                  </h3>
                </div>
                <div className="bg-amber-100 text-[#7b5800] border border-amber-300/40 py-1.5 px-3 rounded text-center shrink-0">
                  <span className="text-[9px] font-mono font-bold uppercase block tracking-wide">Năm Âm lịch</span>
                  <span className="text-xs font-serif font-bold text-[#5c4000]">{activeResult.canChi.year} (Tuổi {getZodiacAnimal(activeResult.lunarObject.getYearZhi())})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-silk-paper/60 border border-[#8c716e]/10 rounded p-4 space-y-2.5">
                  <span className="text-xs font-serif font-extrabold text-[#8b1c1c] border-b border-[#8c716e]/10 pb-1 flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>Lục Thập Hoa Giáp</span>
                  </span>
                  <div className="text-xs font-sans space-y-1.5 text-ink-charcoal/85">
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Thứ trong tuần:</span><strong className="font-serif">{activeResult.dayOfWeek}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Giờ hiện tại:</span><strong className="font-serif">{activeResult.canChi.hour || 'Không rõ'}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Ngày Can Chi:</span><strong className="font-serif">{activeResult.canChi.day}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Tháng Can Chi:</span><strong className="font-serif">{activeResult.canChi.month}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Năm Can Chi:</span><strong className="font-serif">{activeResult.canChi.year}</strong></p>
                  </div>
                </div>

                <div className="bg-silk-paper/60 border border-[#8c716e]/10 rounded p-4 space-y-2.5">
                  <span className="text-xs font-serif font-extrabold text-[#8b1c1c] border-b border-[#8c716e]/10 pb-1 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Tiết khí và cát hướng</span>
                  </span>
                  <div className="text-xs font-sans space-y-1.5 text-ink-charcoal/85">
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Tiết khí:</span><strong className="text-emerald-800">{activeResult.term}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Trực ngày:</span><strong className="text-[#8b1c1c]">{activeResult.truc}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Đánh giá ngày:</span><strong className={dayQualityClass(activeResult)}>{dayQualityLabel(activeResult)}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Hướng Hỷ Thần:</span><strong className="text-indigo-800">{activeResult.directions.xi}</strong></p>
                    <p className="flex justify-between"><span className="text-ink-charcoal/60">Hướng Tài Thần:</span><strong className="text-amber-800">{activeResult.directions.cai}</strong></p>
                  </div>
                </div>
              </div>

              {activeResult.zodiacHours.length > 0 && (
                <div className="bg-amber-50/40 border border-amber-300/25 rounded p-4 space-y-2">
                  <span className="text-xs font-serif font-bold text-[#7b5800] block">Khung giờ Hoàng đạo trong ngày ({activeResult.canChi.day}):</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeResult.zodiacHours.map((hour) => (
                      <span key={hour} className="text-[11px] font-sans font-semibold bg-white border border-amber-300/40 px-2.5 py-1 text-amber-900 rounded-sm shadow-sm">{hour}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded p-4 flex gap-3 text-slate-800">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold">Kiêng kỵ và lưu ý chọn ngày:</p>
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {getAvoidanceNotes(activeResult).map((note) => <li key={note}>- {note}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#8c716e]/10 rounded-md p-10 text-center text-ink-charcoal/55 italic">
              Vui lòng cập nhật các bộ chọn ngày và nhấn nút "Bắt đầu quy đổi" để xem kết quả phong tục học.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
