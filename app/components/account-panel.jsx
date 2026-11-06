"use client";

import { useEffect, useId, useState } from "react";
import "./account-panel.css";

export default function AccountPanel({ session, username, accountState, status, onLogin, onLogout, onSync, onRetry }) {
  const id = useId();
  const [name, setName] = useState(username);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => setName(username), [username]);

  async function submit(event) {
    event.preventDefault();
    if (busy || !name.trim() || !password) return;
    setBusy("login");
    try { if (await onLogin({ username: name.trim(), password })) setPassword(""); }
    finally { setBusy(""); }
  }

  async function signOut() {
    setBusy("logout");
    try { await onLogout(); }
    finally { setBusy(""); }
  }

  return <section className="panel account-panel" aria-label="账号登录与同步">
    <div className="panel-head"><div><h2>{session ? "我的账号" : "账号登录"}</h2><p>{session ? "登录时合并记录，修改后自动同步" : "电脑和手机使用同一个个人账号"}</p></div>{session && <span className="tag">已登录</span>}</div>
    {session ? <div className="account-identity"><strong>{session.user.name}</strong><div className="account-actions"><button className="chip-button" type="button" onClick={onSync} disabled={Boolean(busy) || status.startsWith("正在")}>立即同步</button><button className="chip-button" type="button" onClick={signOut} disabled={Boolean(busy)}>{busy === "logout" ? "退出中…" : "退出登录"}</button></div></div> : <form className="account-login-form" onSubmit={submit}>
      <label htmlFor={`${id}-name`}>账号<input id={`${id}-name`} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} value={name} onChange={event => setName(event.target.value)} disabled={busy || accountState === "checking"} required /></label>
      <label htmlFor={`${id}-password`}>密码<input id={`${id}-password`} name="password" type="password" autoComplete="current-password" maxLength={256} placeholder="输入账号密码" value={password} onChange={event => setPassword(event.target.value)} disabled={busy || accountState === "checking"} aria-describedby={`${id}-status`} required /></label>
      <button type="submit" disabled={busy || accountState === "checking"}>{busy ? "登录中…" : accountState === "checking" ? "检查登录状态…" : "登录并同步"}</button>
      <p className="account-help">已使用访问码的工作台，密码沿用原访问码。</p>
    </form>}
    <p id={`${id}-status`} className="account-feedback" role="status">{status}</p>
    {accountState === "error" && <button className="chip-button" type="button" onClick={onRetry} disabled={Boolean(busy)}>重试登录连接</button>}
  </section>;
}
