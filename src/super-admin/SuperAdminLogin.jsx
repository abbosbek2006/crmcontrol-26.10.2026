import { useState } from "react";
import { Crown, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { createAdminAccount, loginAdmin, readAdminData } from "./tenantStorage";
import { LOGIN_SCOPES, useLoginLock } from "../data/loginThrottle";
import "./superAdmin.css";

export default function SuperAdminLogin({ onLogin }) {
  const existing = readAdminData().account;
  const [login, setLogin] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false); const [error, setError] = useState("");
  const lock = useLoginLock(LOGIN_SCOPES.superAdmin);
  const locked = Boolean(existing) && lock.locked;
  const submit = async (event) => {
    event.preventDefault();
    if (locked || busy) return;
    setError("");
    if (!login.trim() || password.length < 8) return setError("Login va kamida 8 belgili parol kiriting.");
    setBusy(true);
    try { await (existing ? loginAdmin(login, password) : createAdminAccount(login, password)); setPassword(""); onLogin(); }
    catch (err) { setError(err.message || "Kirish amalga oshmadi."); }
    finally { setBusy(false); lock.refresh(); }
  };
  return <div className="sa-auth"><section><div className="sa-mark"><Crown /> Control Center</div><h1>CRM tarmoqlaringizni<br />bitta joydan boshqaring.</h1><p>Mijozlarni qo‘shing, ularning tizimi holatini kuzating va yordam so‘rovlarini qabul qiling.</p><div className="sa-safe"><ShieldCheck /> Har bir mijozning ma’lumotlari alohida saqlanadi.</div></section><main><div className="sa-login-card"><Crown className="sa-crown" /><h2>{existing ? "Super Admin kirishi" : "Super Admin hisobini yarating"}</h2><p>{existing ? "Control Center boshqaruviga kiring" : "Bu hisob faqat sizning boshqaruv panelingiz uchun"}</p><form onSubmit={submit}><label>Login<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" /></label><label>Parol<div className="sa-password"><input type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={existing ? "current-password" : "new-password"}/><button type="button" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{error && <small className="sa-error">{error}</small>}<button className="sa-primary" disabled={busy || locked} aria-live="polite" style={locked ? { opacity: 0.6, cursor: "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 } : undefined}>{locked ? <><Lock size={16}/> Qayta urinish: <span style={{ fontVariantNumeric: "tabular-nums" }}>{lock.label}</span></> : existing ? "Kirish" : "Hisob yaratish"}</button></form></div></main></div>;
}
