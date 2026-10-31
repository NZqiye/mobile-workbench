export function upcomingSubscriptions(items, today) {
  const start = Date.parse(`${today}T00:00:00+08:00`);
  return (Array.isArray(items) ? items : [])
    .filter((item) => item.purchaseType !== "永久会员" && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate || ""))
    .map((item) => ({ ...item, daysRemaining: Math.round((Date.parse(`${item.endDate}T00:00:00+08:00`) - start) / 86400000) }))
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}
