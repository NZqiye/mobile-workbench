"use client";

import { useEffect, useState } from "react";
import styles from "./native-notification-panel.module.css";

const categories = [["tasks", "待办"], ["watch", "追剧"], ["anniversaries", "纪念日"], ["subscriptions", "订阅与话费"]];
const formatTime = value => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

export default function NativeNotificationPanel({ compact = false, onSettings }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const native = window.QiyeNative;
      setSupported(Boolean(native?.notificationState));
      if (native?.notificationState) native.notificationState().then(async value => {
        if (value.categories && categories.some(([kind]) => value.categories[kind] === false) && native.configureNotifications) {
          value = await native.configureNotifications(Object.fromEntries(categories.map(([kind]) => [kind, true])));
        }
        if (active) setState(value);
      }).catch(error => { if (active) setStatus(error.message); });
    };
    const receive = event => { setState(event.detail); setStatus(""); };
    const failed = event => setStatus(event.detail);
    refresh();
    window.addEventListener("qiye-native-ready", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("qiye-notification-state", receive);
    window.addEventListener("qiye-notification-error", failed);
    return () => {
      active = false;
      window.removeEventListener("qiye-native-ready", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("qiye-notification-state", receive);
      window.removeEventListener("qiye-notification-error", failed);
    };
  }, []);
  async function act(method, message = "") {
    setBusy(true); setStatus("");
    try {
      const value = await window.QiyeNative[method]();
      setState(value);
      window.dispatchEvent(new CustomEvent("qiye-notification-state", { detail: value }));
      setStatus(value.permitted ? message : "系统通知未允许，请在通知设置中开启。");
    } catch (error) { setStatus(error.message || "连接失败，请稍后重试。"); }
    finally { setBusy(false); }
  }
  const enabled = state?.enabled && state?.permitted;
  if (compact) {
    if (!supported || !state || enabled && !state.error) return null;
    return <section className={`panel ${styles.panel}`} aria-label="开启手机提醒"><div className="panel-head"><div><h2>开启重要提醒</h2><p>待办、追剧、纪念日与订阅到期</p></div><button type="button" className="chip-button" disabled={busy} onClick={() => act("enableNotifications")}>{busy ? "开启中…" : "开启提醒"}</button></div>{(status || state.error) && <p role="status" className={styles.status}>{status || state.error}</p>}<button type="button" className={styles.settingsLink} onClick={onSettings}>查看提醒设置</button></section>;
  }
  return <section className={`panel ${styles.panel}`} aria-label="App 消息提醒">
    <div className="panel-head"><div><h2>消息提醒</h2><p>{!supported ? "安装新版后开启" : !state ? "正在读取提醒状态…" : enabled ? `已开启 · ${state.pending} 条待提醒` : state.enabled ? "系统通知未允许" : "未开启"}</p></div>{supported ? !enabled && <button className="chip-button" type="button" disabled={busy || !state} onClick={() => act("enableNotifications")}>{busy ? "处理中…" : "允许手机提醒"}</button> : <a href="https://github.com/NZqiye/mobile-workbench/releases/latest" target="_blank" rel="noopener noreferrer">下载新版</a>}</div>
    <p className={styles.description}>待办、追剧、纪念日、订阅与话费到期都会提醒，无需逐项开启。</p>
    <p className={styles.description}>提醒会安排到手机系统，后台、锁屏或暂时断网也能发送。电脑上修改的记录，需要先打开手机 App 同步。以下时间均为北京时间。</p>
    {supported && state && categories.some(([kind]) => state.channels?.[kind] === false) && <p className={styles.status} role="status">系统阻止了{categories.filter(([kind]) => state.channels?.[kind] === false).map(([, title]) => title).join("、")}提醒，请在通知设置中允许。</p>}
    {supported && state && !state.categories && <p className={styles.description}>当前安装包仅支持待办提醒，更新 App 后可接收全部提醒。</p>}
    {supported && state && <div className={styles.actions}>
      <button type="button" disabled={busy || !enabled} onClick={() => act("testNotification", "测试通知已发送，请查看手机通知栏。")}>发送测试通知</button>
      <button type="button" onClick={() => window.QiyeNative.openNotificationSettings()}>通知设置</button>
      {!state.exact && <button type="button" onClick={() => window.QiyeNative.openExactAlarmSettings()}>允许准时提醒</button>}
    </div>}
    {supported && state && !state.exact && <p className={styles.description}>未开启“闹钟和提醒”权限时，系统可能延迟提醒。</p>}
    {state?.lastSynced > 0 && <p className={styles.description}>最近同步 {formatTime(state.lastSynced)}{enabled && state.nextAt > 0 ? ` · 下次 ${formatTime(state.nextAt)}` : ""}</p>}
    <p className={styles.description}>纪念日支持公历和农历。追剧只提醒已同步的排期，话费充值日按当前余额估算。强行停止 App 后需重新打开；若仍收不到，请允许后台运行并取消电池限制。</p>
    {(status || state?.error) && <p className={styles.status} role="status">{status || state.error}</p>}
  </section>;
}
