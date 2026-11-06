export function chartScale(values, { fromZero = true, target = 0, integer = false } = {}) {
  const recorded = values.filter((value) => value != null && Number.isFinite(value));
  const high = Math.max(target, ...recorded, 0);
  const low = fromZero ? 0 : Math.min(...recorded, high);
  const padding = fromZero ? 0 : Math.max((high - low) * 0.15, 0.2);
  const rawStep = Math.max((high - low + padding * 2) / 4, integer ? 1 : 0.1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= rawStep) * magnitude;
  const min = fromZero ? 0 : Math.max(0, Math.floor((low - padding) / step) * step);
  const max = Math.max(min + step, Math.ceil((high + padding) / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + step * index).toFixed(4)));
  return { min, max, ticks };
}
