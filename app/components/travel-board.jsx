"use client";

import { useState } from "react";
import { normalizeTravelRecord, travelDays, travelStatus } from "../../lib/travel";

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const emptyForm = () => ({ destination: "", startDate: localDate(), endDate: localDate(), cost: "", notes: "" });
const money = (value) => Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });

export default function TravelBoard({ items = [], onAdd, onUpdate, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("全部");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
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
  }

  function edit(item) {
    setForm({ destination: item.destination || "", startDate: item.startDate || today, endDate: item.endDate || item.startDate || today, cost: item.cost == null ? "" : String(item.cost), notes: item.notes || "" });
    setEditingId(item.id);
    setDeleteId(null);
    setError("");
    setShowForm(true);
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
          <label><span>目的地</span><input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="例如：杭州 · 西湖周末游" maxLength={120} required /></label>
          <div className="asset-form-row">
            <label><span>出发日期</span><input type="date" value={form.startDate} onChange={(event) => { const startDate = event.target.value; setForm({ ...form, startDate, endDate: form.endDate < startDate ? startDate : form.endDate }); }} required /></label>
            <label><span>返程日期</span><input type="date" value={form.endDate} min={form.startDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
          </div>
          <label><span>旅行费用（元，选填）</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} placeholder="留空表示尚未记录" /></label>
          <label><span>旅行笔记（选填）</span><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="行程、同行的人、住宿、美食，或想记住的瞬间…" /></label>
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
            <div className="travel-record-head"><h3>{item.destination}</h3><span className="travel-status">{travelStatus(item, today)}</span></div>
            <p className="travel-dates"><time dateTime={item.startDate}>{item.startDate}</time><span>至</span><time dateTime={item.endDate || item.startDate}>{item.endDate || item.startDate}</time><span>· {travelDays(item)} 天</span></p>
            {item.notes && <p className="travel-notes">{item.notes}</p>}
            <div className="travel-record-foot"><strong>{item.cost == null ? "费用未记录" : `¥${money(item.cost)}`}</strong><div className="travel-actions"><button type="button" aria-label={`编辑${item.destination}`} onClick={() => edit(item)}>编辑</button><button type="button" aria-label={`删除${item.destination}`} onClick={() => setDeleteId(item.id)}>删除</button></div></div>
            {deleteId === item.id && <div className="travel-delete-confirm" role="group" aria-label="确认删除旅行"><span>删除这条旅游记录？</span><button type="button" onClick={() => setDeleteId(null)}>取消</button><button type="button" onClick={() => { onDelete(item.id); if (editingId === item.id) closeForm(); setDeleteId(null); }}>确认删除</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
