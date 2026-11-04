"use client";

import { useEffect, useId, useRef, useState } from "react";
import { parseQuickRecords } from "../../lib/quick-records";
import { describeQuickRecord } from "../../lib/workbench-records";
import styles from "./voice-quick-record.module.css";

export default function VoiceQuickRecord({ session, onPrepare, onSave, onUndo, onOpen, saved, onSaved }) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [configured, setConfigured] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("说出想记录的内容，自动填写到对应模块，核对后保存。");
  const [pending, setPending] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const busy = phase !== "idle";

  function releaseMicrophone() {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      requestRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder) { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); }
      releaseMicrophone();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setConfigured(false);
    fetch("/api/voice/transcribe", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        setConfigured(response.ok && data.configured);
        if (!response.ok || !data.configured) setStatus(response.status === 401 ? "请先在设置中解锁在线语音；未解锁时文字仅支持饮水和运动。" : "在线语音与全模块理解尚未启用；现在可用文字记录饮水和运动。");
        else setStatus("点击开始录音，最多60秒；说完后自动填写相关记录，核对后保存。");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("暂时无法连接录音服务；可以使用手机输入法语音填写文字。"); });
    return () => controller.abort();
  }, [session]);

  function saveRecords(result) {
    if (!result.records.length) return;
    try {
      const receipt = onSave(result);
      onSaved({ receipt, records: result.records });
      setPending(null);
      setText("");
      setStatus(`已保存${result.records.length}项，已更新对应记录和统计。${result.issues.length ? "提示中的内容尚未保存。" : "可以撤销本次记录。"}`);
    } catch (error) { setStatus(error.message || "保存失败，请重新识别后重试"); }
  }

  async function processText(value, now = new Date(), signal) {
    setPhase("extracting");
    setStatus("正在填写对应记录…");
    let result;
    let fallbackMessage = "";
    if (configured) {
      try {
        const response = await fetch("/api/voice/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, recordedAt: now.toISOString() }), signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "记录理解失败，请重试");
        result = data;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        fallbackMessage = `${error.message}；本次仅使用饮水、运动文字规则。`;
      }
    }
    if (!result) {
      const local = parseQuickRecords(value, now);
      result = { records: local.records.map((record) => ({ kind: record.value.type === "water" ? "water" : "exercise", action: "add", value: record.value })), issues: local.issues };
      if (!configured) fallbackMessage = "全模块联动需要启用在线服务；本次仅使用饮水、运动文字规则。";
    }
    if (!activeRef.current) return;
    const prepared = onPrepare(result.records);
    const issues = [...result.issues, ...prepared.issues];
    if (fallbackMessage) issues.unshift(fallbackMessage);
    setPending({ ...prepared, issues });
    setStatus(prepared.records.length ? `已填写${prepared.records.length}项，核对下方结果后保存。` : "还没有可保存的记录，请按下方提示补充。");
  }

  async function transcribe(blob, recordedAt) {
    if (!activeRef.current) return;
    setPhase("transcribing");
    setStatus("正在识别语音…");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `recording.${extension}`);
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "识别失败，请重试");
      if (!activeRef.current) return;
      setText(data.text);
      await processText(data.text, recordedAt, controller.signal);
    } catch (error) {
      if (activeRef.current && error.name !== "AbortError") setStatus(error.message || "识别失败，请重试");
    } finally {
      busyRef.current = false;
      requestRef.current = null;
      if (activeRef.current) setPhase("idle");
    }
  }

  async function startRecording() {
    if (busyRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setStatus("当前浏览器不支持录音，请使用手机输入法的语音按钮填写文字。"); return; }
    busyRef.current = true;
    setPhase("permission");
    setStatus("请允许浏览器使用麦克风…");
    const recordedAt = new Date();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        recorder.onstop = null;
        releaseMicrophone();
        busyRef.current = false;
        setPhase("idle");
        setStatus("录音失败，请重试或使用手机输入法语音。");
      };
      recorder.onstop = () => {
        releaseMicrophone();
        recorderRef.current = null;
        transcribe(new Blob(chunks, { type: recorder.mimeType }), recordedAt);
      };
      recorder.start();
      setPending(null);
      setPhase("recording");
      setSeconds(0);
      setStatus("正在录音，说完后点击“停止并填写”。");
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= 60 && recorder.state === "recording") recorder.stop();
      }, 1000);
    } catch (error) {
      releaseMicrophone();
      busyRef.current = false;
      if (activeRef.current) {
        setPhase("idle");
        setStatus(error.name === "NotAllowedError" ? "麦克风权限未开启，请在浏览器权限中允许录音，或使用输入法语音。" : "无法启动麦克风，请检查设备后重试。");
      }
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      setPhase("transcribing");
      setStatus("正在处理录音…");
      recorderRef.current.stop();
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!text.trim() || busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    try { await processText(text, new Date(), controller.signal); }
    catch (error) { if (activeRef.current && error.name !== "AbortError") setStatus(error.message || "记录理解失败，请重试"); }
    finally { busyRef.current = false; requestRef.current = null; if (activeRef.current) setPhase("idle"); }
  }

  return (
    <section className={`panel ${styles.root}`} aria-label="语音快速记录">
      <div className="panel-head"><h2>语音快速记录</h2></div>
      <form onSubmit={submit}>
        <label className={styles.label} htmlFor={inputId}>今天做了什么？</label>
        <textarea id={inputId} className={styles.input} rows={2} maxLength={2000} value={text} disabled={busy} placeholder="早上喝了一杯水，体重65公斤，完成了读书任务，还想记录一部电影…" onChange={(event) => { setText(event.target.value); setPending(null); }} />
        <div className={styles.actions}>
          <button className={styles.recordButton} type="button" disabled={phase !== "recording" && (busy || !configured)} onClick={phase === "recording" ? stopRecording : startRecording}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
            {phase === "recording" ? `停止并填写 · ${seconds}s` : phase === "transcribing" ? "转写中…" : phase === "extracting" ? "填写中…" : phase === "permission" ? "等待麦克风…" : "开始录音"}
          </button>
          <button className={styles.textButton} type="submit" disabled={busy || !text.trim()}>识别并填写</button>
        </div>
      </form>
      <p className={styles.status} role="status">{status}</p>
      <p className={styles.disclosure}>可联动饮水、饮食、运动、体重、任务、习惯、观影、资产、订阅、旅行、纪念日、星光计划、生活记录，以及基金和指数追踪。</p>
      <p className={styles.disclosure}>启用在线服务后，本次录音和文字会发送到 Cloudflare；已有记录的匹配在本地完成。缺失的信息会提示补充。</p>
      {pending && <div className={styles.results}>
        {pending.issues.map((issue, index) => <p className={styles.issue} key={index}>{issue}</p>)}
        {pending.records.map((record, index) => <p key={index}>{describeQuickRecord(record)}</p>)}
        {pending.records.length > 0 && <button type="button" className={styles.textButton} disabled={busy} onClick={() => saveRecords(pending)}>确认保存{pending.records.length}项记录</button>}
      </div>}
      {saved && <div className={styles.results}>
        {saved.records.map((record, index) => <div className={styles.savedRow} key={index}><p>{describeQuickRecord(record)}</p><button type="button" className={styles.textButton} disabled={busy} onClick={() => onOpen(record)}>查看{record.label}</button></div>)}
        <button type="button" className={styles.textButton} disabled={busy} onClick={() => { try { const message = onUndo(saved.receipt); onSaved(null); setStatus(message); } catch (error) { setStatus(error.message || "撤销失败，请稍后重试"); } }}>撤销本次记录</button>
      </div>}
    </section>
  );
}
