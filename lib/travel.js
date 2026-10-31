export function travelStatus(item, today) {
  if (item.startDate > today) return "待出发";
  if ((item.endDate || item.startDate) < today) return "已结束";
  return "旅途中";
}

export function travelDays(item) {
  const start = Date.parse(`${item.startDate}T00:00:00Z`);
  const end = Date.parse(`${item.endDate || item.startDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.round((end - start) / 86400000) + 1) : 0;
}

export function normalizeTravelRecord(values) {
  const destination = String(values.destination || "").trim();
  const startDate = String(values.startDate || "");
  const endDate = String(values.endDate || startDate);
  const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!destination) throw new Error("请填写目的地");
  if (!validDate(startDate) || !validDate(endDate)) throw new Error("请选择有效的出发和返程日期");
  if (endDate < startDate) throw new Error("返程日期不能早于出发日期");
  const cost = values.cost === "" || values.cost == null ? null : Number(values.cost);
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) throw new Error("费用请填写不小于 0 的金额");
  return { destination, startDate, endDate, cost, notes: String(values.notes || "").trim() };
}
