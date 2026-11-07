"use client";

import { useEffect, useState } from "react";
import styles from "./app-update-panel.module.css";

export default function AppUpdatePanel() {
  const [version, setVersion] = useState("");
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const ready = () => {
      setVersion(window.QiyeNative?.version || "");
      setSupported(Boolean(window.QiyeNative?.checkUpdates));
      setStatus(window.QiyeNative?.updateStatus || "");
    };
    const receive = event => setStatus(event.detail);
    ready();
    window.addEventListener("qiye-native-ready", ready);
    window.addEventListener("qiye-update-status", receive);
    return () => { window.removeEventListener("qiye-native-ready", ready); window.removeEventListener("qiye-update-status", receive); };
  }, []);
  function check() {
    if (window.QiyeNative?.checkUpdates?.()) setStatus("正在检查新版本…");
    else setStatus("更新连接尚未就绪，请稍后重试。");
  }
  return <section className={`panel ${styles.panel}`} aria-label="应用更新">
    <div className="panel-head"><div><h2>应用更新</h2><p>{version ? `当前版本 ${version}` : "安卓安装版"}</p></div>{supported ? <button className="chip-button" type="button" onClick={check} disabled={status.startsWith("正在")}>检查更新</button> : <a className={styles.link} href="https://github.com/NZqiye/mobile-workbench/releases/latest" target="_blank" rel="noopener noreferrer">下载新版</a>}</div>
    <p className={styles.description}>{supported ? "打开 App 时自动检查，每天最多一次。有新版本会提示下载，安装时由系统确认。" : "安装 1.1.2 或更新版本后，可在 App 内检查、下载更新。请直接覆盖安装，保留记录。"}</p>
    {status && <p className={styles.status} role="status">{status}</p>}
  </section>;
}
