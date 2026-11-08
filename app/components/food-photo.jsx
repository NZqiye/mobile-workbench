"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./food-photo.module.css";

async function preparePhoto(file) {
  if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) throw new Error("请选择25MB以内的食物照片");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("照片无法读取，请换一张 JPG 或 PNG 照片")); img.src = source;
    });
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error("照片处理失败，请换一张照片");
    return { blob, url: URL.createObjectURL(blob) };
  } finally { URL.revokeObjectURL(source); }
}

export default function FoodPhoto({ onUseEstimate }) {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const camera = useRef(null), gallery = useRef(null), controller = useRef(null), generation = useRef(0);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function selectPhoto(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    controller.current?.abort(); const ticket = ++generation.current;
    setResult(null); setMessage(""); setError(false); setPhoto(null); setBusy("preparing");
    try {
      const prepared = await preparePhoto(file);
      if (ticket !== generation.current) { URL.revokeObjectURL(prepared.url); return; }
      setPhoto(prepared);
    } catch (failure) { if (ticket === generation.current) { setMessage(failure.message); setError(true); } }
    finally { if (ticket === generation.current) setBusy(""); }
  }

  async function recognize() {
    if (!photo || busy) return;
    const request = new AbortController(); controller.current = request;
    const ticket = ++generation.current;
    setBusy("recognizing"); setResult(null); setMessage(""); setError(false);
    const timeout = setTimeout(() => request.abort(), 55000);
    try {
      const body = new FormData(); body.append("photo", photo.blob, "food.jpg");
      const response = await fetch("/api/food/recognize", { method: "POST", body, signal: request.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "识别失败，请稍后重试");
      if (!Array.isArray(data.items) || !data.items.length || !Number.isFinite(data.totalCalories) || data.totalCalories <= 0 || typeof data.title !== "string") throw new Error("识别结果不完整，请重试");
      if (ticket === generation.current) setResult(data);
    } catch (failure) {
      if (ticket === generation.current) { setMessage(failure.name === "AbortError" ? "识别超时，照片已保留，可以重试" : failure.message); setError(true); }
    } finally { clearTimeout(timeout); if (ticket === generation.current) setBusy(""); }
  }

  function cancel(remove = false) {
    generation.current++; controller.current?.abort(); setBusy(""); setResult(null); setError(false);
    if (remove) setPhoto(null);
    setMessage(remove ? "" : "已取消识别，照片未保存");
  }

  return (
    <section className={styles.root} aria-label="照片估算热量" aria-busy={Boolean(busy)}>
      <div className={styles.heading}><strong>拍照估算热量</strong><span>AI 估算</span></div>
      <p className={styles.help}>拍清食物和份量，识别后可调整再保存。</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => camera.current?.click()} disabled={Boolean(busy)}>拍照</button>
        <button type="button" onClick={() => gallery.current?.click()} disabled={Boolean(busy)}>选择照片</button>
        <input ref={camera} className={styles.file} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="拍摄食物照片" onChange={selectPhoto} />
        <input ref={gallery} className={styles.file} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择食物照片" onChange={selectPhoto} />
      </div>
      {photo && <div className={styles.preview}>
        <img src={photo.url} alt="本次待识别的食物照片" width="240" height="180" />
        <div className={styles.actions}>
          <button className={styles.primary} type="button" onClick={recognize} disabled={Boolean(busy)}>{busy === "recognizing" ? "正在识别…" : result ? "重新识别" : "识别食物"}</button>
          <button type="button" onClick={() => cancel(busy !== "recognizing")}>{busy === "recognizing" ? "取消识别" : "移除照片"}</button>
        </div>
      </div>}
      {busy === "preparing" && <p className={styles.status} role="status">正在处理照片…</p>}
      {result && <div className={styles.result}>
        <ul>{result.items.map((item, index) => <li key={index}><span><strong>{item.name}</strong><small>{item.portion}</small></span><b>{item.calories} kcal</b></li>)}</ul>
        <p className={styles.total}>预估合计 <strong>{result.totalCalories} kcal</strong></p>
        <p className={styles.help}>{result.note}</p>
        <button className={styles.primary} type="button" onClick={() => { onUseEstimate(result); setResult(null); setPhoto(null); setMessage("已填入下方，请确认食物和热量后点击添加"); }}>填入下方记录</button>
      </div>}
      {message && <p className={error ? styles.error : styles.status} role={error ? "alert" : "status"}>{message}</p>}
      <p className={styles.privacy}>点击识别才将照片发给 Cloudflare AI；上传前去除照片定位信息，照片不加入记录或备份。份量、用油和酱料会影响实际热量。</p>
    </section>
  );
}
