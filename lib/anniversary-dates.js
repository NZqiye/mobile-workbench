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
  const annual = item.type !== "countdown" && !/^holiday-\d{4}-/.test(item.id || "");
  if (item.calendarType === "lunar") {
    try {
      const year = Math.max(originalYear, Number(lunarParts(new Date(`${today}T12:00:00+08:00`)).relatedYear));
      const years = annual ? [year, year + 1, year + 2] : [originalYear];
      return years.map(value => lunarDates(value).get(`${month}-${day}`)).filter(Boolean);
    } catch { return []; }
  }
  const original = new Date(`${item.date}T00:00:00Z`);
  if (!Number.isFinite(original.getTime()) || original.toISOString().slice(0, 10) !== item.date) return [];
  if (!annual) return [item.date];
  const year = Math.max(originalYear, Number(today.slice(0, 4)));
  return [year, year + 1, year + 2].map(value => new Date(Date.UTC(value, month - 1, day)).toISOString().slice(0, 10));
}

export function anniversarySnapshot(items, today) {
  return (Array.isArray(items) ? items : []).filter(item => item.id && item.title).map(item => ({
    id: String(item.id).slice(0, 120),
    title: String(item.title).replace(/\s+/g, " ").slice(0, 80),
    calendarType: item.calendarType === "lunar" ? "lunar" : "solar",
    annual: item.type !== "countdown" && !/^holiday-\d{4}-/.test(item.id),
    dates: anniversaryDates(item, today),
  })).filter(item => item.dates.length > 0);
}
