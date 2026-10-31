"use client";

import { useState } from "react";
import { normalizeTravelRecord, travelDays, travelStatus } from "../../lib/travel";
import { travelCities, travelCityImage, travelPlaceImage } from "../../lib/travel-places";

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const emptyForm = () => ({ destination: "", startDate: localDate(), endDate: localDate(), cost: "", notes: "", city: "", checkins: [] });
const money = (value) => Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });

function RatingStar({ filled }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></svg>;
}

export default function TravelBoard({ items = [], onAdd, onUpdate, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("全部");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [removeCheckinId, setRemoveCheckinId] = useState(null);
  const cityInfo = travelCities.find((entry) => entry.name === form.city.trim());
  const records = Array.isArray(items) ? items : [];
  const today = localDate();
  const visible = records.filter((item) => filter === "全部" || travelStatus(item, today) === filter)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const totalCost = records.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
    setForm(emptyForm());
    setRemoveCheckinId(null);
  }

  function edit(item) {
    setForm({ destination: item.destination || "", startDate: item.startDate || today, endDate: item.endDate || item.startDate || today, cost: item.cost == null ? "" : String(item.cost), notes: item.notes || "", city: item.city || "", checkins: Array.isArray(item.checkins) ? item.checkins.map((entry) => ({ ...entry, id: entry.id || crypto.randomUUID() })) : [] });
    setEditingId(item.id);
    setDeleteId(null);
    setError("");
    setRemoveCheckinId(null);
    setShowForm(true);
  }

  function addCheckin(name = "") {
    setForm((current) => ({ ...current, checkins: [...current.checkins, { id: crypto.randomUUID(), name, date: today >= current.startDate && today <= current.endDate ? today : current.startDate, rating: null, review: "" }] }));
  }

  function updateCheckin(id, values) {
    setForm((current) => ({ ...current, checkins: current.checkins.map((entry) => entry.id === id ? { ...entry, ...values } : entry) }));
  }

  function submit(event) {
    event.preventDefault();
    try {
      const values = normalizeTravelRecord(form);
      if (editingId) onUpdate(editingId, values);
      else onAdd(values);
      setFilter("全部");
      closeForm();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="travel-board" aria-label="旅游记录">
      <div className="travel-intro">
        <img src="/assets-icons/thiings/fashion/suitcase.webp" width="48" height="48" alt="" />
        <div><h2>旅游记录</h2><p>记下去过的地方，也留一份下一站的期待。</p></div>
      </div>
      <div className="travel-summary" aria-label="旅行概览">
        <div><span>累计旅行</span><strong>{records.length}<small> 次</small></strong></div>
        <div><span>待出发</span><strong>{records.filter((item) => travelStatus(item, today) === "待出发").length}<small> 次</small></strong></div>
        <div><span>已记费用</span><strong>¥{money(totalCost)}</strong></div>
      </div>
      <button className="asset-add-btn" type="button" onClick={() => { closeForm(); setDeleteId(null); setShowForm(true); }}>+ 添加旅游记录</button>
      {showForm && (
        <form className="asset-form travel-form" onSubmit={submit}>
          <div className="asset-form-head"><h3>{editingId ? "编辑旅行" : "记录一段旅行"}</h3><button type="button" onClick={closeForm}>取消</button></div>
          <label><span>所在城市（选填）</span><input list="travel-city-options" value={form.city} maxLength={60} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="选择或输入城市，例如：上海" /></label>
          <datalist id="travel-city-options">{travelCities.map((city) => <option key={city.name} value={city.name} />)}</datalist>
          {cityInfo && <div className="travel-city-preview"><img src={travelCityImage(cityInfo.name)} width="52" height="52" alt="" /><div><strong>{cityInfo.name}</strong><small>{cityInfo.iconNote || "通用旅行图标 · 支持自定义城市"}</small></div></div>}
          <label><span>目的地</span><input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="例如：杭州 · 西湖周末游" maxLength={120} required /></label>
          <div className="asset-form-row">
            <label><span>出发日期</span><input type="date" value={form.startDate} onChange={(event) => { const startDate = event.target.value; setForm({ ...form, startDate, endDate: form.endDate < startDate ? startDate : form.endDate }); }} required /></label>
            <label><span>返程日期</span><input type="date" value={form.endDate} min={form.startDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
          </div>
          <label><span>旅行费用（元，选填）</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} placeholder="留空表示尚未记录" /></label>
          <label><span>旅行笔记（选填）</span><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="行程、同行的人、住宿、美食，或想记住的瞬间…" /></label>
          <fieldset className="travel-checkin-editor">
            <legend>景点打卡与评价</legend>
            <p className="travel-checkin-hint">选择景点快捷填入，或手动添加。仅保存你的打卡与评价。</p>
            {cityInfo && <div className="travel-place-shortcuts" aria-label={`${cityInfo.name}景点快捷添加`}>{cityInfo.places.map((name) => <button type="button" key={name} disabled={form.checkins.some((entry) => entry.name === name)} onClick={() => addCheckin(name)}>+ {name}</button>)}</div>}
            {!cityInfo && <p className="travel-checkin-hint">填写城市可查看预设景点；其他城市也可手动记录。</p>}
            {form.checkins.map((entry, index) => <div className="travel-checkin-fields" key={entry.id}>
              <div className="travel-checkin-top"><strong>景点 {index + 1}</strong><button type="button" onClick={() => setRemoveCheckinId(entry.id)}>移除此项</button></div>
              <label><span>景点名称</span><input value={entry.name} maxLength={120} required onChange={(event) => updateCheckin(entry.id, { name: event.target.value })} placeholder="例如：外滩" /></label>
              <label><span>打卡日期</span><input type="date" value={entry.date} min={form.startDate} max={form.endDate} required onChange={(event) => updateCheckin(entry.id, { date: event.target.value })} /></label>
              <div className="travel-rating-field"><span>我的评分（选填）</span><div className="travel-rating-buttons" role="group" aria-label={`${entry.name || `景点${index + 1}`}评分`}>{[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} aria-label={`${rating}星`} aria-pressed={entry.rating === rating} onClick={() => updateCheckin(entry.id, { rating })}><RatingStar filled={rating <= Number(entry.rating)} /></button>)}<button type="button" className="travel-rating-clear" onClick={() => updateCheckin(entry.id, { rating: null })}>清除</button></div><small>{entry.rating ? `${entry.rating} / 5 星` : "尚未评分"}</small></div>
              <label><span>我的评价（选填）</span><textarea rows={3} value={entry.review || ""} onChange={(event) => updateCheckin(entry.id, { review: event.target.value })} placeholder="拍照体验、人流、排队、值得去的时段，或避坑建议…" /></label>
              {removeCheckinId === entry.id && <div className="travel-delete-confirm"><span>移除这项打卡？保存旅行后生效。</span><button type="button" onClick={() => setRemoveCheckinId(null)}>保留</button><button type="button" onClick={() => { setForm((current) => ({ ...current, checkins: current.checkins.filter((spot) => spot.id !== entry.id) })); setRemoveCheckinId(null); }}>确认移除</button></div>}
            </div>)}
            <button type="button" className="travel-add-checkin" onClick={() => addCheckin()}>+ 手动添加景点</button>
          </fieldset>
          {error && <p className="travel-error" role="alert">{error}</p>}
          <button className="asset-submit" type="submit">{editingId ? "保存修改" : "保存旅行"}</button>
        </form>
      )}
      <div className="travel-filters" aria-label="筛选旅行">
        {["全部", "待出发", "旅途中", "已结束"].map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => { setFilter(value); setDeleteId(null); }}>{value}</button>)}
      </div>
      {!visible.length && <div className="travel-empty"><h3>{records.length ? "这个分类还没有旅行" : "下一站，想去哪里？"}</h3><p>{records.length ? "切换其他分类查看，或添加一段新的旅程。" : "点击“添加旅游记录”，从一次周末出游开始。"}</p></div>}
      <div className="travel-list">
        {visible.map((item) => (
          <article className="travel-record" key={item.id}>
            <div className="travel-record-head"><div className="travel-record-place"><img src={travelCityImage(item.city)} width="44" height="44" alt="" /><div><h3>{item.destination}</h3>{item.city && <small>{item.city}</small>}</div></div><span className="travel-status">{travelStatus(item, today)}</span></div>
            <p className="travel-dates"><time dateTime={item.startDate}>{item.startDate}</time><span>至</span><time dateTime={item.endDate || item.startDate}>{item.endDate || item.startDate}</time><span>· {travelDays(item)} 天</span></p>
            {item.notes && <p className="travel-notes">{item.notes}</p>}
            {Array.isArray(item.checkins) && item.checkins.length > 0 && <div className="travel-checkins"><h4>景点打卡 · {item.checkins.length} 处</h4>{item.checkins.map((entry, index) => <div className="travel-checkin" key={entry.id || index}><div className="travel-checkin-top"><div className="travel-record-place"><img src={travelPlaceImage(item.city, entry.name)} width="32" height="32" alt="" /><strong>{entry.name}</strong></div><span className="travel-rating-readout">{entry.rating ? `${entry.rating} / 5 星` : "未评分"}</span></div><time dateTime={entry.date}>{entry.date}</time>{entry.review ? <p>{entry.review}</p> : <small>还没有写评价</small>}</div>)}</div>}
            <div className="travel-record-foot"><strong>{item.cost == null ? "费用未记录" : `¥${money(item.cost)}`}</strong><div className="travel-actions"><button type="button" aria-label={`编辑${item.destination}`} onClick={() => edit(item)}>编辑</button><button type="button" aria-label={`删除${item.destination}`} onClick={() => setDeleteId(item.id)}>删除</button></div></div>
            {deleteId === item.id && <div className="travel-delete-confirm" role="group" aria-label="确认删除旅行"><span>删除这条旅游记录？</span><button type="button" onClick={() => setDeleteId(null)}>取消</button><button type="button" onClick={() => { onDelete(item.id); if (editingId === item.id) closeForm(); setDeleteId(null); }}>确认删除</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
