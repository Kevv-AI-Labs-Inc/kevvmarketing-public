// legacy page — incrementally migrated
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Hash,
  MoveRight,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
// @ts-expect-error — lunar-javascript has no TS declarations
import { Lunar, Solar } from "lunar-javascript";

/* ─── Feng Shui helpers ──────────────────────────────────────── */

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
type Direction = (typeof DIRECTIONS)[number];

const DIRECTION_LABELS: Record<string, Record<Direction, string>> = {
  zh: { N: "北", NE: "东北", E: "东", SE: "东南", S: "南", SW: "西南", W: "西", NW: "西北" },
  en: { N: "North", NE: "Northeast", E: "East", SE: "Southeast", S: "South", SW: "Southwest", W: "West", NW: "Northwest" },
};

const ELEMENTS_ZH = ["金", "木", "水", "火", "土"];
const ELEMENTS_EN = ["Metal", "Wood", "Water", "Fire", "Earth"];

function houseNumberDigitSum(addr: string): number {
  const digits = addr.replace(/\D/g, "");
  if (!digits) return 0;
  let sum = 0;
  for (const d of digits) sum += Number(d);
  while (sum > 9) {
    let next = 0;
    for (const d of String(sum)) next += Number(d);
    sum = next;
  }
  return sum;
}

const LUCKY_NUMBERS = new Set([1, 2, 3, 6, 8, 9]);
const NEUTRAL_NUMBERS = new Set([5]);

function numberMeaning(n: number, locale: string): { luck: "good" | "neutral" | "bad"; text: string } {
  if (locale === "zh") {
    const map: Record<number, { luck: "good" | "neutral" | "bad"; text: string }> = {
      1: { luck: "good", text: "一帆风顺。象征独立与新开始。" },
      2: { luck: "good", text: "好事成双。象征和谐与伙伴关系。" },
      3: { luck: "good", text: "谐音「生」，生生不息。" },
      4: { luck: "bad", text: "谐音「死」，传统上不被偏好。" },
      5: { luck: "neutral", text: "五行之数。中性，代表平衡。" },
      6: { luck: "good", text: "谐音「溜」或「禄」，象征顺利。" },
      7: { luck: "neutral", text: "七上八下。中性偏吉。" },
      8: { luck: "good", text: "谐音「发」，最受欢迎的吉利数字。" },
      9: { luck: "good", text: "谐音「久」，象征长久与圆满。" },
      0: { luck: "neutral", text: "无特殊含义。" },
    };
    return map[n] ?? { luck: "neutral", text: "" };
  }
  const map: Record<number, { luck: "good" | "neutral" | "bad"; text: string }> = {
    1: { luck: "good", text: "Smooth sailing. Symbolizes independence and new beginnings." },
    2: { luck: "good", text: "Good things come in pairs. Symbolizes harmony." },
    3: { luck: "good", text: "Sounds like 'shēng' (birth/life). Growth energy." },
    4: { luck: "bad", text: "Sounds like 'sǐ' (death). Traditionally avoided." },
    5: { luck: "neutral", text: "The five elements. Neutral, represents balance." },
    6: { luck: "good", text: "Sounds like 'lù' (prosperity). Smooth flow." },
    7: { luck: "neutral", text: "Mixed associations. Generally neutral." },
    8: { luck: "good", text: "Sounds like 'fā' (wealth). Most auspicious number." },
    9: { luck: "good", text: "Sounds like 'jiǔ' (long-lasting). Completeness." },
    0: { luck: "neutral", text: "No special meaning." },
  };
  return map[n] ?? { luck: "neutral", text: "" };
}

function getElementForNumber(n: number): number {
  // Wu Xing cycle: 1,2→Wood, 3,4→Fire, 5,6→Earth, 7,8→Metal, 9,0→Water
  if (n === 1 || n === 2) return 1; // Wood
  if (n === 3 || n === 4) return 3; // Fire
  if (n === 5 || n === 6) return 4; // Earth
  if (n === 7 || n === 8) return 0; // Metal
  return 2; // Water
}

function getDirectionAdvice(dir: Direction, locale: string): string {
  if (locale === "zh") {
    const map: Record<Direction, string> = {
      N: "坐北朝南，采光充足，冬暖夏凉，传统最佳朝向。",
      NE: "东北方属艮卦，适合书房和安静空间。",
      E: "紫气东来，朝东有旺盛的上升气场。",
      SE: "东南方为财位所在，招财聚气的好方位。",
      S: "南向门户光线充足，但夏季需注意遮阳。",
      SW: "西南方属坤卦，适合年长女性居住，利家庭和睦。",
      W: "西向采光好但西晒明显，可用窗帘缓解。",
      NW: "西北方属乾卦，适合家中男性主人。",
    };
    return map[dir];
  }
  const map: Record<Direction, string> = {
    N: "South-facing (sitting north). Excellent natural light, warm in winter, cool in summer. The most favored orientation in traditional feng shui.",
    NE: "Northeast belongs to the Gen trigram. Ideal for studies and quiet spaces.",
    E: "East-facing draws rising energy. Auspicious for new beginnings.",
    SE: "Southeast is the wealth corner. Attracts prosperity and accumulates qi.",
    S: "South-facing entrance gets ample light, but may need sun shading in summer.",
    SW: "Southwest belongs to the Kun trigram. Favors family harmony.",
    W: "West-facing gets good afternoon light but strong western sun. Use curtains.",
    NW: "Northwest belongs to the Qian trigram. Favors the male head of household.",
  };
  return map[dir];
}

/* ─── Almanac helpers ────────────────────────────────────────── */

type DayInfo = {
  solar: { year: number; month: number; day: number; weekDay: number };
  lunar: { monthName: string; dayName: string; yearGanZhi: string; monthGanZhi: string; dayGanZhi: string };
  yi: string[];
  ji: string[];
  isAuspiciousForMoving: boolean;
  jieQi: string;
  chong: string;
  sha: string;
};

function getDayInfo(year: number, month: number, day: number): DayInfo {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const dayObj = lunar.getDay ? lunar : lunar;

  const yi: string[] = (dayObj.getDayYi?.() ?? []) as string[];
  const ji: string[] = (dayObj.getDayJi?.() ?? []) as string[];
  const isAuspiciousForMoving = yi.some((s: string) =>
    s.includes("入宅") || s.includes("搬家") || s.includes("移徙")
  );

  return {
    solar: { year, month, day, weekDay: solar.getWeek() },
    lunar: {
      monthName: lunar.getMonthInChinese() + "月",
      dayName: lunar.getDayInChinese(),
      yearGanZhi: lunar.getYearInGanZhi(),
      monthGanZhi: lunar.getMonthInGanZhi(),
      dayGanZhi: lunar.getDayInGanZhi(),
    },
    yi,
    ji,
    isAuspiciousForMoving,
    jieQi: (lunar.getJieQi?.() ?? "") as string,
    chong: (lunar.getDayChongDesc?.() ?? "") as string,
    sha: (lunar.getDaySha?.() ?? "") as string,
  };
}

function getMonthDays(year: number, month: number): DayInfo[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DayInfo[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    result.push(getDayInfo(year, month, d));
  }
  return result;
}

/* ─── Component ──────────────────────────────────────────────── */

export default function Cultural() {
  const { t, locale } = useT();

  // Feng Shui state
  const [address, setAddress] = useState("");
  const [selectedDirection, setSelectedDirection] = useState<Direction>("S");
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  const monthDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);

  const firstDayOffset = useMemo(() => {
    const d = new Date(calYear, calMonth - 1, 1);
    return d.getDay();
  }, [calYear, calMonth]);

  const digitSum = houseNumberDigitSum(address);
  const numInfo = numberMeaning(digitSum, locale);
  const elementIdx = getElementForNumber(digitSum);
  const dirAdvice = getDirectionAdvice(selectedDirection, locale);

  const prevMonth = useCallback(() => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
    setSelectedDay(null);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
    setSelectedDay(null);
  }, [calMonth]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
    }).format(new Date(calYear, calMonth - 1));
  }, [calYear, calMonth, locale]);

  const weekHeaders = locale === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const runAnalysis = () => {
    if (!address.trim()) return;
    setShowAnalysis(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          {t("cultural.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("cultural.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ─── Feng Shui Panel ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Compass className="h-4 w-4" />
                {t("cultural.fengShuiTitle")}
              </CardTitle>
              <CardDescription>
                {t("cultural.fengShuiDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">{t("cultural.addressLabel")}</label>
                <Input
                  placeholder={t("cultural.addressPlaceholder")}
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setShowAnalysis(false); }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("cultural.directionLabel")}</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {DIRECTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDirection(d)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedDirection === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent/50"
                      }`}
                    >
                      {DIRECTION_LABELS[locale]?.[d] ?? d}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={runAnalysis} disabled={!address.trim()} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("cultural.analyze")}
              </Button>
            </CardContent>
          </Card>

          {showAnalysis && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("cultural.analysisResult")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* House number */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Hash className="h-4 w-4 text-primary" />
                    {t("cultural.houseNumber")}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold tabular-nums">{digitSum}</span>
                    <Badge variant={numInfo.luck === "good" ? "default" : numInfo.luck === "bad" ? "destructive" : "secondary"}>
                      {numInfo.luck === "good" ? t("cultural.auspicious") : numInfo.luck === "bad" ? t("cultural.inauspicious") : t("cultural.neutral")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{numInfo.text}</p>
                </div>

                {/* Element */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Star className="h-4 w-4 text-primary" />
                    {t("cultural.elementTitle")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{locale === "zh" ? ELEMENTS_ZH[elementIdx] : ELEMENTS_EN[elementIdx]}</span>
                    <span className="text-sm text-muted-foreground">
                      ({locale === "zh" ? ELEMENTS_EN[elementIdx] : ELEMENTS_ZH[elementIdx]})
                    </span>
                  </div>
                </div>

                {/* Direction */}
                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MoveRight className="h-4 w-4 text-primary" />
                    {t("cultural.direction")}: {DIRECTION_LABELS[locale]?.[selectedDirection]}
                  </div>
                  <p className="text-sm text-muted-foreground">{dirAdvice}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Chinese Almanac Panel ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t("cultural.lunarCalendar")}
              </CardTitle>
              <CardDescription>
                {t("cultural.calendarDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Month navigator */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-semibold text-sm">{monthLabel}</span>
                <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>

              {/* Week headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekHeaders.map((w) => (
                  <div key={w} className="text-center text-xs font-medium text-muted-foreground py-1">{w}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {monthDays.map((dayInfo) => {
                  const isToday =
                    dayInfo.solar.year === today.getFullYear() &&
                    dayInfo.solar.month === today.getMonth() + 1 &&
                    dayInfo.solar.day === today.getDate();
                  const isSelected =
                    selectedDay?.solar.day === dayInfo.solar.day &&
                    selectedDay?.solar.month === dayInfo.solar.month;

                  return (
                    <button
                      key={dayInfo.solar.day}
                      onClick={() => setSelectedDay(dayInfo)}
                      className={`relative flex flex-col items-center rounded-lg py-1.5 text-sm transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                            ? "bg-primary/10 font-semibold"
                            : "hover:bg-accent/50"
                      }`}
                    >
                      <span className="font-medium">{dayInfo.solar.day}</span>
                      <span className={`text-[10px] leading-tight ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {dayInfo.lunar.dayName}
                      </span>
                      {dayInfo.isAuspiciousForMoving && (
                        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  {t("cultural.goodForMoving")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Selected day detail */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selectedDay.solar.year}/{selectedDay.solar.month}/{selectedDay.solar.day}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {selectedDay.lunar.monthName}{selectedDay.lunar.dayName}
                  </span>
                </CardTitle>
                <CardDescription>
                  {selectedDay.lunar.yearGanZhi}年 {selectedDay.lunar.monthGanZhi}月 {selectedDay.lunar.dayGanZhi}日
                  {selectedDay.jieQi && ` · ${selectedDay.jieQi}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDay.chong && (
                  <p className="text-xs text-muted-foreground">
                    {locale === "zh" ? "冲" : "Clash"}: {selectedDay.chong}
                    {selectedDay.sha && ` · ${locale === "zh" ? "煞" : "Sha"}: ${selectedDay.sha}`}
                  </p>
                )}
                <div>
                  <p className="text-xs font-semibold text-emerald-600 mb-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {t("cultural.auspicious")} (宜)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDay.yi.length > 0
                      ? selectedDay.yi.map((item) => (
                          <Badge key={item} variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{item}</Badge>
                        ))
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {t("cultural.inauspicious")} (忌)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDay.ji.length > 0
                      ? selectedDay.ji.map((item) => (
                          <Badge key={item} variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">{item}</Badge>
                        ))
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </div>
                </div>
                {selectedDay.isAuspiciousForMoving && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                    <Check className="h-3 w-3 mr-1" />
                    {t("cultural.goodForMoving")}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
