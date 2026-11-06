"use client";

import { useEffect, useId, useRef, useState } from "react";
import { parseQuickRecords } from "../../lib/quick-records";
import { describeQuickRecord } from "../../lib/workbench-records";
import styles from "./voice-quick-record.module.css";

export default function VoiceQuickRecord({ session, onPrepare, onSave, onUndo, onOpen, onSettings, saved, onSaved }) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [service, setService] = useState("checking");
  const [phase, setPhase] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("正在检查录音和自动归类服务…");
  const [pending, setPending] = useState(null);
  const [native, setNative] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const nativeRecordingRef = useRef(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const busy = phase !== "idle";
  const configured = service === "ready";

  useEffect(() => {
    const detect = () => setNative(Boolean(window.QiyeNative?.recordAudio));
    detect();
    window.addEventListener("qiye-native-ready", detect);
    return () => window.removeEventListener("qiye-native-ready", detect);
  }, []);

  useEffect(() => {
    setText(localStorage.getItem("qiyeworkbench:quickRecordDraft") || "");
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (text) localStorage.setItem("qiyeworkbench:quickRecordDraft", text);
    else localStorage.removeItem("qiyeworkbench:quickRecordDraft");
  }, [text, draftReady]);

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
      if (nativeRecordingRef.current) window.QiyeNative?.cancelRecording();
      const recorder = recorderRef.current;
      if (recorder) { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); }
      releaseMicrophone();
    };
  }, []);

  async function checkService(signal) {
    setService("checking");
    try {
      const response = await fetch("/api/voice/transcribe", { signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]) });
      const data = await response.json();
      if (signal?.aborted) return;
      setService(response.status === 401 ? "locked" : response.ok && data.configured ? "ready" : "unavailable");
      setStatus(response.status === 401 ? "请先解锁工作台，录音和手打才能自动写入全部栏目。输入会保留。" : response.ok && data.configured ? "录音或手打均可自动归类；保存成功后，下方会显示写入的栏目。" : "自动归类服务暂不可用；当前文字仅支持饮水和运动，其他内容不会写入。");
    } catch (error) {
      if (!signal?.aborted) { setService("unavailable"); setStatus("暂时无法连接自动归类服务，请重试。输入会保留；当前文字仅支持饮水和运动。"); }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    checkService(controller.signal);
    return () => controller.abort();
  }, [session]);

  function saveRecords(result) {
    if (!result.records.length) return;
    try {
      const receipt = onSave(result);
      onSaved({ receipt, records: result.records });
      setPending(null);
      if (!result.issues.length) setText("");
      setStatus(`已写入${result.records.length}项，已更新对应栏目和统计。${result.issues.length ? "其余内容未保存，原文已保留；再次提交时请去掉已保存的部分。" : "可以查看或撤销本次记录。"}`);
    } catch (error) { setPending(result); setStatus(`未保存：${error.message || "保存失败，请重试"}。输入已保留。`); }
  }

  async function processText(value, now = new Date(), signal) {
    setPhase("extracting");
    setStatus("正在识别并保存到对应栏目…");
    let result;
    let fallbackMessage = "";
    if (configured) {
      const response = await fetch("/api/voice/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, recordedAt: now.toISOString() }), signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
      const data = await response.json();
      if (response.status === 401) setService("locked");
      if (!response.ok) throw new Error(data.error || "记录理解失败，请重试");
      result = data;
    }
    if (!result) {
      const local = parseQuickRecords(value, now);
      result = { records: local.records.map((record) => ({ kind: record.value.type === "water" ? "water" : "exercise", action: "add", value: record.value })), issues: local.issues };
      fallbackMessage = "自动归类服务未启用，本次仅识别饮水和运动；请确认是否只保存这些内容。";
    }
    if (!activeRef.current) return;
    const prepared = onPrepare(result.records);
    const issues = [...result.issues, ...prepared.issues];
    if (fallbackMessage) issues.unshift(fallbackMessage);
    const submission = { ...prepared, issues };
    if (prepared.records.length && !issues.length) saveRecords(submission);
    else {
      setPending(submission);
      setStatus(prepared.records.length ? `尚未保存：${prepared.records.length}项可以写入，其余内容需要补充。请核对下方结果。` : "未保存：没有可写入的记录，请按下方提示补充。输入已保留。");
    }
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
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
      const data = await response.json();
      if (response.status === 401) setService("locked");
      if (!response.ok) throw new Error(data.error || "识别失败，请重试");
      if (!activeRef.current) return;
      const combined = [text.trim(), data.text].filter(Boolean).join("\n");
      setText(combined);
      await processText(combined, recordedAt, controller.signal);
    } catch (error) {
      if (activeRef.current && error.name !== "AbortError") setStatus(`未保存：${error.message || "识别失败，请重试"}。已识别的文字会保留。`);
    } finally {
      busyRef.current = false;
      requestRef.current = null;
      if (activeRef.current) setPhase("idle");
    }
  }

  async function startRecording() {
    if (busyRef.current) return;
    if (service === "locked") { setStatus("请先解锁语音识别服务，录音权限会在开始录音时申请。输入已保留。"); onSettings(); return; }
    if (!configured) { await checkService(); return; }
    if (window.QiyeNative?.recordAudio) {
      busyRef.current = true;
      nativeRecordingRef.current = true;
      setMicDenied(false);
      setPhase("permission");
      setStatus("请允许七夜online使用麦克风…");
      const recordedAt = new Date();
      try {
        const blob = await window.QiyeNative.recordAudio(() => {
          if (!activeRef.current) return;
          setPhase("recording");
          setSeconds(0);
          setPending(null);
          setStatus("手机正在录音，说完后点“停止并保存”。切到后台会取消录音。");
          let elapsed = 0;
          timerRef.current = setInterval(() => setSeconds(++elapsed), 1000);
        });
        clearInterval(timerRef.current);
        nativeRecordingRef.current = false;
        await transcribe(blob, recordedAt);
      } catch (error) {
        clearInterval(timerRef.current);
        nativeRecordingRef.current = false;
        busyRef.current = false;
        if (activeRef.current) {
          setPhase("idle");
          setMicDenied(error.name === "NotAllowedError");
          setStatus(error.message || "手机录音启动失败，请重试。");
        }
      }
      return;
    }
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
      setStatus("正在录音，说完后点击“停止并保存”，自动归类到对应栏目。");
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
    if (nativeRecordingRef.current) {
      clearInterval(timerRef.current);
      setPhase("transcribing");
      setStatus("正在处理手机录音…");
      window.QiyeNative.stopRecording();
      return;
    }
    if (recorderRef.current?.state === "recording") {
      setPhase("transcribing");
      setStatus("正在处理录音…");
      recorderRef.current.stop();
    }
  }

  function cancelRecording() {
    if (nativeRecordingRef.current) window.QiyeNative.cancelRecording();
    else {
      if (recorderRef.current) { recorderRef.current.onstop = null; recorderRef.current.stop(); recorderRef.current = null; }
      releaseMicrophone();
      busyRef.current = false;
      setPhase("idle");
      setStatus("录音已取消，未保存任何内容。");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!text.trim() || busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    try { await processText(text, new Date(), controller.signal); }
    catch (error) { if (activeRef.current && error.name !== "AbortError") setStatus(`未保存：${error.message || "记录理解失败，请重试"}。输入已保留。`); }
    finally { busyRef.current = false; requestRef.current = null; if (activeRef.current) setPhase("idle"); }
  }

  return (
    <section className={`panel quick-record-panel ${styles.root}`} aria-label="语音快速记录">
      <div className={styles.header}>
        <h2>快速记录</h2>
        <button className={styles.recordButton} type="button" aria-pressed={phase === "recording"} disabled={phase !== "recording" && (busy || service === "checking")} onClick={phase === "recording" ? stopRecording : startRecording}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
          {phase === "recording" ? `停止并保存 · ${seconds}s` : phase === "transcribing" ? "转写中…" : phase === "extracting" ? "保存中…" : phase === "permission" ? "等待麦克风…" : service === "locked" ? "解锁后录音" : service === "unavailable" ? "重试语音连接" : native ? "手机录音" : "开始录音"}
        </button>
      </div>
        <form onSubmit={submit}>
          <label className={styles.label} htmlFor={inputId}>说一句，或直接写下来</label>
          <textarea id={inputId} aria-describedby={`${inputId}-status`} className={styles.input} rows={2} maxLength={2000} value={text} disabled={busy || !draftReady} placeholder="例如：喝了300毫升水，跑步30分钟" onChange={(event) => { setText(event.target.value); setPending(null); }} />
          <div className={styles.actions}>
            {phase === "recording" && <button className={styles.textButton} type="button" onClick={cancelRecording}>取消录音</button>}
            {micDenied && native && <button className={styles.textButton} type="button" onClick={() => window.QiyeNative.openPermissions()}>开启麦克风权限</button>}
            <button className={styles.saveButton} type="submit" disabled={busy || service === "checking" || !text.trim()}>{phase === "extracting" ? "正在保存…" : "保存到各栏目"}</button>
            {service === "locked" && <button className={styles.textButton} type="button" onClick={onSettings}>去设置解锁</button>}
            {service === "unavailable" && <button className={styles.textButton} type="button" disabled={busy} onClick={() => checkService()}>重试连接</button>}
          </div>
        </form>
        <p id={`${inputId}-status`} className={styles.status} role="status">{status}</p>
        <details className={styles.disclosure}>
          <summary>支持的栏目与录入说明</summary>
          <p>可写入饮水、饮食、运动、体重、任务、习惯、观影、资产、订阅、旅行、纪念日、星光目标、生活记录、基金及指数追踪。更新已有内容时请说清完整名称；缺少字段或存在同名记录时会提示补充。</p>
          <p>录音最多60秒。在线识别会将本次录音和文字发送到 Cloudflare，已有记录在本机匹配。完整识别后直接保存，有缺项时由你确认可保存的部分。</p>
        </details>
        {pending && <div className={styles.results}>
          {pending.issues.map((issue, index) => <p className={styles.issue} key={index}>{issue}</p>)}
          {pending.records.map((record, index) => <p key={index}>{describeQuickRecord(record)}</p>)}
          {pending.records.length > 0 && <button type="button" className={styles.saveButton} disabled={busy} onClick={() => saveRecords(pending)}>仅保存已识别的{pending.records.length}项</button>}
        </div>}
        {saved && <div className={styles.results}>
          <p className={styles.issue}>最近一次已保存</p>
          {saved.records.map((record, index) => <div className={styles.savedRow} key={index}><p>{describeQuickRecord(record)}</p><button type="button" className={styles.textButton} disabled={busy} onClick={() => onOpen(record)}>查看{record.label}</button></div>)}
          <button type="button" className={styles.textButton} disabled={busy} onClick={() => { try { const message = onUndo(saved.receipt); onSaved(null); setStatus(message); } catch (error) { setStatus(error.message || "撤销失败，请稍后重试"); } }}>撤销本次记录</button>
        </div>}
    </section>
  );
}
