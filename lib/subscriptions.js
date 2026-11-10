export function phoneFeeProjection(item, today) {
  const monthlyFee = Math.round(Number(item.price) * 100);
  const balance = Math.round(Number(item.balance) * 100);
  const billingDay = Number(item.billingDay);
  const confirmed = Date.parse(`${item.purchaseDate}T00:00:00+08:00`);
  const current = Date.parse(`${today}T00:00:00+08:00`);
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0 || !Number.isFinite(balance) || balance < 0 || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31 || !Number.isFinite(confirmed) || !Number.isFinite(current) || confirmed > current) return null;

  const [year, month] = item.purchaseDate.split("-").map(Number);
  const billingDate = (offset) => {
    const lastDay = new Date(Date.UTC(year, month + offset, 0)).getUTCDate();
    return new Date(Date.UTC(year, month - 1 + offset, Math.min(billingDay, lastDay))).toISOString().slice(0, 10);
  };
  const firstOffset = billingDate(0) <= item.purchaseDate ? 1 : 0;
  const affordableMonths = Math.floor(balance / monthlyFee);
  const rechargeDate = billingDate(firstOffset + affordableMonths);
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const currentOffset = (currentYear - year) * 12 + currentMonth - month;
  const billedMonths = Math.max(0, currentOffset - firstOffset + (billingDate(currentOffset) <= today ? 1 : 0));
  return {
    rechargeDate,
    daysRemaining: Math.round((Date.parse(`${rechargeDate}T00:00:00+08:00`) - current) / 86400000),
    estimatedBalance: Math.max(0, balance - billedMonths * monthlyFee) / 100,
  };
}

export function upcomingSubscriptions(items, today) {
  const start = Date.parse(`${today}T00:00:00+08:00`);
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item.purchaseType !== "手机话费") return item;
      const projection = phoneFeeProjection(item, today);
      return { ...item, endDate: projection?.rechargeDate || "" };
    })
    .filter((item) => item.purchaseType !== "永久会员" && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate || ""))
    .map((item) => ({ ...item, daysRemaining: Math.round((Date.parse(`${item.endDate}T00:00:00+08:00`) - start) / 86400000) }))
    .filter((item) => (item.daysRemaining >= 0 || item.purchaseType === "手机话费") && item.daysRemaining <= 30)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}
