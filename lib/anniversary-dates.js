const lunarYears = new Map();
let lunarFormatter;

export function beijingDateKey(value = Date.now()) {
  return new Date(Number(value) + 8 * 3600000).toISOString().slice(0, 10);
}

function lunarParts(date) {
  lunarFormatter ||= new Intl.DateTimeFormat("en-u-ca-chinese", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });
  return Object.fromEntries(lunarFormatter.formatToParts(date).map(part => [part.type, part.value]));
}

function lunarDates(year) {
  if (lunarYears.has(year)) return lunarYears.get(year);
  const dates = new Map();
  for (let time = Date.UTC(year, 0, 1); time < Date.UTC(year + 1, 2, 1); time += 86400000) {
    const parts = lunarParts(new Date(time));
    if (Number(parts.relatedYear) === year && !parts.month.includes("bis")) dates.set(`${Number(parts.month)}-${Number(parts.day)}`, new Date(time).toISOString().slice(0, 10));
  }
  if (lunarYears.size >= 6) lunarYears.delete(lunarYears.keys().next().value);
  lunarYears.set(year, dates);
  return dates;
}

export function anniversaryDates(item, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "") || !/^\d{4}-\d{2}-\d{2}$/.test(today || "")) return [];
  const [originalYear, month, day] = item.date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > (item.calendarType === "lunar" ? 30 : 31)) return [];
  const repeat = item.repeat || (item.type !== "countdown" && !/^holiday-\d{4}-/.test(item.id || "") ? "annual" : "once");
  if (item.calendarType === "lunar") {
    try {
      const year = Math.max(originalYear, Number(lunarParts(new Date(`${today}T12:00:00+08:00`)).relatedYear));
      const years = repeat === "once" ? [originalYear] : [year, year + 1, year + 2];
      return years.map(value => lunarDates(value).get(`${month}-${day}`)).filter(Boolean);
    } catch { return []; }
  }
  const original = new Date(`${item.date}T00:00:00Z`);
  if (!Number.isFinite(original.getTime()) || original.toISOString().slice(0, 10) !== item.date) return [];
  if (repeat === "once") return [item.date];
  const todayTime = Date.parse(`${today}T00:00:00Z`);
  const clampDate = (year, monthIndex, targetDay) => {
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, monthIndex, Math.min(targetDay, lastDay))).toISOString().slice(0, 10);
  };
  if (repeat === "weekly") {
    const weeks = Math.max(0, Math.ceil((todayTime - original.getTime()) / (7 * 86400000)));
    const first = new Date(original.getTime() + weeks * 7 * 86400000);
    return [0, 1, 2].map(offset => new Date(first.getTime() + offset * 7 * 86400000).toISOString().slice(0, 10));
  }
  const step = repeat === "quarterly" ? 3 : repeat === "monthly" ? 1 : 12;
  const todayDate = new Date(`${today}T00:00:00Z`);
  if (repeat === "annual") {
    const currentYear = todayDate.getUTCFullYear();
    return [0, 1, 2].map(offset => clampDate(Math.max(originalYear, currentYear + offset), month - 1, day));
  }
  const monthDistance = (todayDate.getUTCFullYear() - originalYear) * 12 + todayDate.getUTCMonth() - (month - 1);
  const cycles = Math.max(0, Math.ceil(monthDistance / step));
  return [0, 1, 2].map(offset => {
    const index = (month - 1) + (cycles + offset) * step;
    const year = originalYear + Math.floor(index / 12);
    return clampDate(year, index % 12, day);
  });
}

export function anniversarySnapshot(items, today) {
  return (Array.isArray(items) ? items : []).filter(item => item.id && item.title).map(item => ({
    id: String(item.id).slice(0, 120),
    title: String(item.title).replace(/\s+/g, " ").slice(0, 80),
    calendarType: item.calendarType === "lunar" ? "lunar" : "solar",
    repeat: item.repeat || (item.type !== "countdown" && !/^holiday-\d{4}-/.test(item.id) ? "annual" : "once"),
    annual: (item.repeat || (item.type !== "countdown" && !/^holiday-\d{4}-/.test(item.id) ? "annual" : "once")) !== "once",
    dates: anniversaryDates(item, today),
  })).filter(item => item.dates.length > 0);
}
