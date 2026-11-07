"use client";

import { useEffect, useState } from "react";
import styles from "./native-notification-panel.module.css";

export default function NativeNotificationPanel() {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const native = window.QiyeNative;
      setSupported(Boolean(native?.notificationState));
      if (native?.notificationState) native.notificationState().then(value => { if (active) setState(value); }).catch(error => { if (active) setStatus(error.message); });
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
      setStatus(value.permitted ? message : "系统通知未允许，请在通知设置中开启。");
    } catch (error) { setStatus(error.message || "连接失败，请稍后重试。"); }
    finally { setBusy(false); }
  }
  const enabled = state?.enabled && state?.permitted;
  return <section className={`panel ${styles.panel}`} aria-label="App 消息提醒">
    <div className="panel-head"><div><h2>消息提醒</h2><p>{!supported ? "安装新版后开启" : !state ? "正在读取提醒状态…" : enabled ? `已开启 · ${state.pending} 条待提醒` : "未开启"}</p></div>{supported ? <button className="chip-button" type="button" disabled={busy || !state} onClick={() => act(state?.enabled ? "disableNotifications" : "enableNotifications")}>{busy ? "处理中…" : state?.enabled ? "关闭提醒" : "开启提醒"}</button> : <a href="https://github.com/NZqiye/mobile-workbench/releases/latest" target="_blank" rel="noopener noreferrer">下载新版</a>}</div>
    <p className={styles.description}>给任务设置提醒时间后，App 会把提醒安排到手机系统。切到后台、锁屏或暂时断网时，也可收到已安排的通知。电脑上修改的任务，需要先在手机同步。</p>
    {supported && state && <div className={styles.actions}>
      <button type="button" disabled={busy || !enabled} onClick={() => act("testNotification", "测试通知已发送，请查看手机通知栏。")}>发送测试通知</button>
      <button type="button" onClick={() => window.QiyeNative.openNotificationSettings()}>通知设置</button>
      {!state.exact && <button type="button" onClick={() => window.QiyeNative.openExactAlarmSettings()}>允许准时提醒</button>}
    </div>}
    {supported && state && !state.exact && <p className={styles.description}>未开启“闹钟和提醒”权限时，系统可能延迟提醒。</p>}
    <p className={styles.description}>这是本机任务到时提醒；云端即时消息推送尚未接入。强行停止 App 后，请重新打开，以恢复提醒。</p>
    {(status || state?.error) && <p className={styles.status} role="status">{status || state.error}</p>}
  </section>;
}
