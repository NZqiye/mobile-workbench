export function anniversaryProgress(item, targetDate, today) {
  if (item.calendarType === "lunar") return null;
  const day = (date) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  if (!Number.isFinite(day(targetDate))) return null;
  let startDate = item.startDate;
  if (!startDate && (item.type || "memory") !== "countdown") {
    const previous = new Date(`${targetDate}T00:00:00Z`);
    previous.setUTCFullYear(previous.getUTCFullYear() - 1);
    startDate = previous.toISOString().slice(0, 10);
    if (startDate < item.date) startDate = item.date;
  }
  const total = day(targetDate) - day(startDate);
  const elapsed = day(today) - day(startDate);
  if (!Number.isFinite(total) || !Number.isFinite(elapsed) || total <= 0 || elapsed < 0) return null;
  return { total, elapsed: Math.min(total, elapsed), percent: Math.min(100, Math.round(elapsed / total * 100)) };
}
