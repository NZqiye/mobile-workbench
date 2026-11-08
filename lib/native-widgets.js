export function widgetSnapshot(plans, dietRecords, waterTarget, date) {
  const pending = plans.filter(plan => plan.title && (!plan.date || plan.date === date) && plan.status !== "已完成");
  const waterMl = dietRecords.filter(record => record.type === "water" && record.date === date)
    .reduce((sum, record) => sum + Math.max(0, Number(record.amount) || 0), 0);
  return {
    date,
    tasks: pending.slice(0, 3).map(plan => `${plan.time ? `${String(plan.time).slice(0, 5)} ` : ""}${String(plan.title).slice(0, 40)}`),
    pendingCount: pending.length,
    waterMl: Math.round(waterMl),
    targetMl: Math.max(250, Number(waterTarget) || 2000),
  };
}
