"use client";

import { useState } from "react";
import { chartScale } from "../../lib/chart-scale";
import "./statistics-charts.css";

const numberText = (value, decimals = 0) => value.toLocaleString("zh-CN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

export function WeeklyChart({ title, days, series, unit, summary, target, line = false, onSelect, selectedDate, emptyText }) {
  const [pickedDate, setPickedDate] = useState(null);
  const activeIndex = Math.max(0, days.findIndex((day) => day.dateKey === (selectedDate || pickedDate || days.at(-1)?.dateKey)));
  const values = days.map((day) => line ? day[series[0].key] : series.reduce((sum, item) => sum + (day[item.key] || 0), 0));
  const hasData = values.some((value) => value != null && (line || value > 0));
  const scale = chartScale(values, { fromZero: !line, target, integer: !line });
  const y = (value) => 150 - ((value - scale.min) / (scale.max - scale.min)) * 122;
  const x = (index) => 72 + index * 40;
  const activeDay = days[activeIndex];
  const decimals = line ? 2 : 0;
  const detail = (day) => series.map((item) => `${series.length > 1 ? `${item.label} ` : ""}${day[item.key] == null ? "未记录" : `${numberText(day[item.key], decimals)} ${unit}`}`).join(" · ");
  const linePath = line ? values.map((value, index) => value == null ? "" : `${index === 0 || values[index - 1] == null ? "M" : "L"}${x(index)},${y(value)}`).join(" ") : "";

  return (
    <section className={`statistics-chart${line && !hasData ? " statistics-no-points" : ""}`} aria-label={title}>
      <div className="statistics-chart-head"><h3>{title}</h3><span>{unit}</span></div>
      {summary && <p className="statistics-summary">{summary}</p>}
      <div className="statistics-legend">
        {series.map((item, index) => <span key={item.key}><i className={`chart-color-${item.tone || index}`} />{item.label}</span>)}
        {target > 0 && <span><i className="chart-target-key" />每日目标 {numberText(target)} {unit}</span>}
      </div>
      <svg className="statistics-plot" viewBox="0 0 360 174" role="img" aria-label={`${title}。${days.map((day) => `${day.label}：${detail(day)}`).join("；")}`}>
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-gridline" x1="52" x2="332" y1={y(tick)} y2={y(tick)} />
            <text className="chart-axis" x="44" y={y(tick) + 4} textAnchor="end">{numberText(tick, line ? 1 : 0)}</text>
          </g>
        ))}
        <rect className="chart-selection" x={x(activeIndex) - 18} y="18" width="36" height="132" rx="6" />
        {line ? (
          <>
            <path className="chart-line chart-color-0" d={linePath} />
            {values.map((value, index) => value != null && <g key={days[index].dateKey}>
              <circle className="chart-point chart-color-0" cx={x(index)} cy={y(value)} r={index === activeIndex ? 5 : 3.5} />
              <text className="chart-value" x={x(index)} y={y(value) - 11} textAnchor="middle">{numberText(value, 2)}</text>
            </g>)}
          </>
        ) : days.map((day, index) => {
          let total = 0;
          return <g key={day.dateKey}>
            {series.map((item, seriesIndex) => {
              const value = day[item.key] || 0;
              const bottom = total;
              total += value;
              return value > 0 && <rect key={item.key} className={`chart-bar chart-color-${item.tone || seriesIndex}`} x={x(index) - 11} y={y(total)} width="22" height={y(bottom) - y(total)} rx={series.length === 1 ? 4 : 0} />;
            })}
            <text className="chart-value" x={x(index)} y={y(total) - 7} textAnchor="middle">{numberText(total)}</text>
          </g>;
        })}
        {target > 0 && <line className="chart-target-line" x1="52" x2="332" y1={y(target)} y2={y(target)} />}
      </svg>
      <div className="statistics-days">
        {days.map((day, index) => <button type="button" key={day.dateKey} aria-pressed={index === activeIndex} aria-label={`${day.label}，${detail(day)}${onSelect ? "，点击编辑" : ""}`} onClick={() => { setPickedDate(day.dateKey); onSelect?.(day); }}>{day.label}</button>)}
      </div>
      <p className="statistics-detail" aria-live="polite"><strong>{activeDay.label}</strong><span>{detail(activeDay)}{target > 0 && activeDay[series[0].key] > 0 ? activeDay[series[0].key] >= target ? " · 已达标" : ` · 还差 ${numberText(target - activeDay[series[0].key])} ${unit}` : ""}</span></p>
      {!hasData && <p className="statistics-note">{emptyText || "近 7 天暂无记录，添加记录后会显示变化。"}</p>}
      {line && hasData && <p className="statistics-note">纵轴 {numberText(scale.min, 1)}–{numberText(scale.max, 1)} kg，便于看清变化；未记录的日期留空。点日期可编辑体重。</p>}
      {!line && hasData && <p className="statistics-note">点日期查看详情；0 表示当天暂无记录。</p>}
    </section>
  );
}

export function MealBreakdown({ records }) {
  const meals = ["早餐", "午餐", "晚餐", "加餐"];
  const items = meals.map((label) => ({ label, value: records.filter((item) => item.meal === label).reduce((sum, item) => sum + Number(item.calories || 0), 0) }));
  const other = records.filter((item) => !meals.includes(item.meal)).reduce((sum, item) => sum + Number(item.calories || 0), 0);
  if (other > 0) items.push({ label: "其他", value: other });
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return (
    <section className="statistics-chart" aria-label="今日各餐热量占比">
      <div className="statistics-chart-head"><h3>今日热量分布</h3><span>kcal</span></div>
      <div className="meal-breakdown">
        <div className="meal-donut">
          <svg viewBox="0 0 120 120" role="img" aria-label={total ? items.map((item) => `${item.label} ${item.value} kcal，占 ${(item.value / total * 100).toFixed(1)}%`).join("；") : "今天还没有饮食记录"}>
            <circle className="chart-donut-track" cx="60" cy="60" r="48" fill="none" strokeWidth="13" />
            {items.map((item, index) => {
              const percent = total ? item.value / total * 100 : 0;
              const start = offset;
              offset += percent;
              return percent > 0 && <circle key={item.label} className={`chart-donut-segment chart-color-${index}`} cx="60" cy="60" r="48" fill="none" strokeWidth="13" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />;
            })}
          </svg>
          <div><strong>{numberText(total)}</strong><span>今日摄入</span></div>
        </div>
        <div className="meal-distribution">
          {items.map((item, index) => <div key={item.label}><i className={`chart-color-${index}`} /><span>{item.label}</span><strong>{numberText(item.value)}</strong><small>{total ? `${(item.value / total * 100).toFixed(1)}%` : "—"}</small></div>)}
        </div>
      </div>
      <p className="statistics-note">{total ? "占比按已记录的摄入热量计算，不代表每日推荐量。" : "添加一餐记录后，就能看到各餐的热量占比。"}</p>
    </section>
  );
}
