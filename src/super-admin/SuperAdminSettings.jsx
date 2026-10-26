import { useRef, useState } from "react";
import {
  ArrowLeft, BadgeCheck, BellRing, Check, Clock3, Crown, Database, Download, Eye, EyeOff, HardDrive,
  History, KeyRound, Layers, Lock, Mail, Phone, ShieldCheck, TriangleAlert, Upload, UserRound,
} from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { useLoginLock } from "../data/loginThrottle";
import {
  ADMIN_IDLE_OPTIONS, adminStorageStats, buildAdminBackup, changeAdminCredentials,
  parseAdminBackup, readAdminData, restoreAdminBackup,
} from "./tenantStorage";
import "./superAdminSettings.css";

const SETTINGS_LOCK_SCOPE = "super-admin-settings";
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const SECTIONS = [
  { id: "profile", label: "Profil", hint: "Ism va aloqa ma'lumotlari", icon: UserRound },
  { id: "security", label: "Xavfsizlik", hint: "Login, parol va sessiya", icon: ShieldCheck },
  { id: "notifications", label: "Xabarnomalar", hint: "Yordam so'rovlari haqida xabar", icon: BellRing },
  { id: "backup", label: "Zaxira nusxa", hint: "Yuklab olish va tiklash", icon: Database },
];


export const adminInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("uz-UZ") : "SA";
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatBytes = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`);

function passwordStrength(password) {
  if (!password) return { score: 0, label: "", tone: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: "Juda zaif", tone: "weak" }, { label: "Zaif", tone: "weak" }, { label: "O'rtacha", tone: "fair" },
    { label: "Yaxshi", tone: "good" }, { label: "Kuchli", tone: "strong" }, { label: "Juda kuchli", tone: "strong" },
  ];
  return { score, ...levels[score] };
}

function Switch({ checked, onChange, label, description, icon: Icon }) {
  return (
    <div className="sas-switch-row">
      <span className="sas-tile-icon"><Icon size={18} /></span>
      <div className="sas-switch-text"><b>{label}</b><small>{description}</small></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`sas-switch${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

function Field({ label, icon: Icon, children, hint }) {
  return (
    <label className="sas-field">
      <span className="sas-field-label">{label}</span>
      <span className="sas-input">{Icon && <Icon size={17} aria-hidden="true" />}{children}</span>
      {hint && <small className="sas-field-hint">{hint}</small>}
    </label>
  );
}

function PasswordInput({ value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="sas-eye" aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </>
  );
}

function SectionHead({ icon: Icon, title, text }) {
  return (
    <div className="sas-section-head">
      <span className="sas-section-icon"><Icon size={20} /></span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
  );
}

function ProfileSection({ data, onSaved }) {
  const [form, setForm] = useState(() => ({ name: data.profile.name || "", email: data.profile.email || "", phone: data.profile.phone || "" }));
  const [error, setError] = useState("");
  const dirty = form.name !== (data.profile.name || "") || form.email !== (data.profile.email || "") || form.phone !== (data.profile.phone || "");
  const submit = (event) => {
    event.preventDefault(); setError("");
    const profile = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() };
    if (profile.name.length > 60) return setError("Ism 60 belgidan oshmasin.");
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(profile.email)) return setError("Elektron pochta manzili noto'g'ri.");
    if (profile.phone && !/^\+?[\d\s()-]{7,20}$/.test(profile.phone)) return setError("Telefon raqami noto'g'ri.");
    onSaved({ profile }, "Profil saqlandi");
    setForm(profile);
  };
  return (
    <form className="sas-card" onSubmit={submit}>
      <SectionHead icon={UserRound} title="Profil" text="Control Center menyusida va xabarlarda ko'rinadigan ma'lumotlar." />
      <div className="sas-grid-2">
        <Field label="To'liq ism" icon={UserRound}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Super Administrator" autoComplete="name" maxLength={60} /></Field>
        <Field label="Elektron pochta" icon={Mail}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@kompaniya.uz" autoComplete="email" /></Field>
        <Field label="Telefon" icon={Phone}><input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" autoComplete="tel" /></Field>
        <Field label="Login" icon={KeyRound} hint="Loginni Xavfsizlik bo'limida o'zgartirasiz."><input value={data.account?.login || ""} readOnly aria-readonly="true" /></Field>
      </div>
      {error && <p className="sas-error" role="alert">{error}</p>}
      <div className="sas-actions"><button type="submit" className="sas-btn-primary" disabled={!dirty}><Check size={17} /> Saqlash</button></div>
    </form>
  );
}

function SecuritySection({ data, onSaved, onPreference }) {
  const { success } = useToast();
  const lock = useLoginLock(SETTINGS_LOCK_SCOPE);
  const [form, setForm] = useState(() => ({ login: data.account?.login || "", current: "", next: "", confirm: "" }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(form.next);
  const submit = async (event) => {
    event.preventDefault();
    if (busy || lock.locked) return;
    setError("");
    if (form.next !== form.confirm) return setError("Yangi parollar bir xil emas.");
    setBusy(true);
    try {
      const result = await changeAdminCredentials({ currentPassword: form.current, login: form.login, newPassword: form.next });
      setForm({ login: form.login.trim().toLowerCase(), current: "", next: "", confirm: "" });
      onSaved({}, null);
      success(result.passwordChanged ? "Parol yangilandi" : "Login yangilandi", result.passwordChanged ? "Boshqa qurilmalardagi ochiq sessiyalar bekor qilindi." : undefined);
    } catch (err) { setError(err.message || "Saqlab bo'lmadi."); }
    finally { setBusy(false); lock.refresh(); }
  };
  return (
    <>
      <div className="sas-stat-row">
        <div className="sas-stat"><History size={18} /><div><small>Joriy kirish</small><b>{formatDateTime(data.meta.lastLoginAt)}</b></div></div>
        <div className="sas-stat"><Clock3 size={18} /><div><small>Avvalgi kirish</small><b>{formatDateTime(data.meta.previousLoginAt)}</b></div></div>
        <div className="sas-stat"><BadgeCheck size={18} /><div><small>Parol/login yangilangan</small><b>{formatDateTime(data.meta.credentialsChangedAt)}</b></div></div>
      </div>
      <form className="sas-card" onSubmit={submit}>
        <SectionHead icon={Lock} title="Login va parol" text="O'zgartirish uchun joriy parolni kiriting. Xato urinishlarda tugma vaqtincha bloklanadi." />
        <div className="sas-grid-2">
          <Field label="Login" icon={KeyRound}><input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="username" /></Field>
          <Field label="Joriy parol" icon={Lock}><PasswordInput value={form.current} onChange={(current) => setForm({ ...form, current })} autoComplete="current-password" /></Field>
          <Field label="Yangi parol (ixtiyoriy)" icon={Lock}><PasswordInput value={form.next} onChange={(next) => setForm({ ...form, next })} autoComplete="new-password" placeholder="Kamida 8 belgi" /></Field>
          <Field label="Yangi parolni tasdiqlang" icon={Lock}><PasswordInput value={form.confirm} onChange={(confirm) => setForm({ ...form, confirm })} autoComplete="new-password" /></Field>
        </div>
        {form.next && (
          <div className={`sas-strength is-${strength.tone}`} aria-live="polite">
            <div className="sas-strength-bar">{[1, 2, 3, 4, 5].map((step) => <i key={step} className={step <= strength.score ? "is-filled" : ""} />)}</div>
            <span>Parol kuchi: <b>{strength.label}</b></span>
          </div>
        )}
        {error && <p className="sas-error" role="alert">{error}</p>}
        <div className="sas-actions">
          <button type="submit" className="sas-btn-primary" disabled={busy || lock.locked || !form.current} aria-live="polite">
            {lock.locked ? <><Lock size={16} /> Qayta urinish: <span className="sas-num">{lock.label}</span></> : <><ShieldCheck size={17} /> Yangilash</>}
          </button>
        </div>
      </form>
      <div className="sas-card">
        <SectionHead icon={Clock3} title="Avtomatik chiqish" text="Panel shuncha vaqt ishlatilmasa, hisobdan avtomatik chiqiladi." />
        <div className="sas-segmented" role="radiogroup" aria-label="Avtomatik chiqish vaqti">
          {ADMIN_IDLE_OPTIONS.map((minutes) => (
            <button key={minutes} type="button" role="radio" aria-checked={data.preferences.idleMinutes === minutes} className={data.preferences.idleMinutes === minutes ? "is-active" : ""} onClick={() => onPreference({ idleMinutes: minutes })}>
              {minutes < 60 ? `${minutes} daqiqa` : "1 soat"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function NotificationsSection({ data, onPreference }) {
  const prefs = data.preferences;
  return (
    <>
      <div className="sas-card">
        <SectionHead icon={BellRing} title="Xabarnomalar" text="Mijozlardan kelgan yordam so'rovlari haqida qanday xabar olishingizni tanlang." />
        <div className="sas-switch-list">
          <Switch icon={BellRing} label="Yangi xabar oynasi" description="Panel ochilganda o'qilmagan yordam xabari haqida oyna chiqadi." checked={prefs.messagePopup} onChange={(messagePopup) => onPreference({ messagePopup })} />
          <Switch icon={Layers} label="Brauzer sarlavhasida hisoblagich" description="Tab nomida o'qilmagan xabarlar soni ko'rinadi, masalan “(3) Control Center”." checked={prefs.titleBadge} onChange={(titleBadge) => onPreference({ titleBadge })} />
        </div>
      </div>
    </>
  );
}

function BackupSection({ data, onRestored }) {
  const { success, error: showError } = useToast();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const stats = adminStorageStats();
  const download = () => {
    const backup = buildAdminBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `control-center-zaxira-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    success("Zaxira nusxa yuklab olindi", `${backup.admin.tenants.length} ta mijoz, ${Object.keys(backup.tenantData).length} ta yozuv.`);
  };
  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(""); setPending(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return setError("Fayl juda katta (20 MB dan oshmasin).");
    try { setPending({ name: file.name, ...parseAdminBackup(await file.text()) }); }
    catch (err) { setError(err.message); }
  };
  const restore = () => {
    setConfirmOpen(false);
    try { restoreAdminBackup(pending); setPending(null); onRestored(); success("Zaxira tiklandi", "Mijozlar va ularning ma'lumotlari yangilandi."); }
    catch (err) { showError("Tiklanmadi", err.message); }
  };
  return (
    <>
      <div className="sas-stat-row">
        <div className="sas-stat"><Layers size={18} /><div><small>Mijozlar</small><b>{data.tenants.length} ta</b></div></div>
        <div className="sas-stat"><BellRing size={18} /><div><small>Yordam xabarlari</small><b>{data.tickets.length} ta</b></div></div>
        <div className="sas-stat"><HardDrive size={18} /><div><small>Brauzerdagi hajm</small><b>{formatBytes(stats.bytes)}</b></div></div>
      </div>
      <div className="sas-card">
        <SectionHead icon={Download} title="Zaxira nusxani yuklab olish" text="Barcha mijozlar, ularning CRM ma'lumotlari, yordam xabarlari va sozlamalar bitta faylga saqlanadi. Login va parol faylga kirmaydi." />
        <div className="sas-actions is-start"><button type="button" className="sas-btn-primary" onClick={download}><Download size={17} /> Yuklab olish (.json)</button></div>
      </div>
      <div className="sas-card">
        <SectionHead icon={Upload} title="Zaxiradan tiklash" text="Avval faylni tanlang: tiklashdan oldin uning tarkibini ko'rasiz." />
        <div className="sas-note is-warning"><TriangleAlert size={18} /><span>Tiklash joriy mijozlar ro'yxati va ularning barcha CRM ma'lumotlarini fayldagisi bilan <b>almashtiradi</b>. Avval joriy holatning zaxira nusxasini oling.</span></div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={choose} />
        <div className="sas-actions is-start"><button type="button" className="sas-btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={17} /> Faylni tanlash</button></div>
        {error && <p className="sas-error" role="alert">{error}</p>}
        {pending && (
          <div className="sas-preview">
            <div><small>Fayl</small><b>{pending.name}</b></div>
            <div><small>Yaratilgan</small><b>{formatDateTime(pending.exportedAt)}</b></div>
            <div><small>Mijozlar</small><b>{pending.tenants.length} ta</b></div>
            <div><small>Ma'lumot yozuvlari</small><b>{Object.keys(pending.tenantData).length} ta</b></div>
            <button type="button" className="sas-btn-danger" onClick={() => setConfirmOpen(true)}><Upload size={16} /> Tiklash</button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Zaxiradan tiklansinmi?"
        message={`Joriy ${data.tenants.length} ta mijoz va ularning ma'lumotlari o'chirilib, fayldagi ${pending?.tenants.length || 0} ta mijoz yuklanadi. Bu amalni ortga qaytarib bo'lmaydi.`}
        confirmLabel="Ha, tiklash"
        onConfirm={restore}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default function SuperAdminSettings({ data, save, onBack }) {
  const { success } = useToast();
  const [section, setSection] = useState("profile");
  const name = data.profile.name || "Super Administrator";
  // Har doim eng yangi saqlangan holatga qo'shamiz: boshqa tabdagi o'zgarishlar yo'qolmaydi.
  const persist = (patch, message) => {
    save({ ...readAdminData(), ...patch });
    if (message) success(message);
  };
  const setPreference = (patch) => persist({ preferences: { ...readAdminData().preferences, ...patch } }, "Sozlama saqlandi");
  const active = SECTIONS.find((item) => item.id === section) || SECTIONS[0];

  return (
    <div className="sas-page">
      <section className="sa-heading">
        <button className="app-back-button sa-back" type="button" onClick={onBack}><ArrowLeft size={17} /> Orqaga</button>
        <div><h2>Sozlamalar</h2><p>Control Center hisobingiz, xavfsizlik, xabarnomalar va zaxira nusxa.</p></div>
      </section>

      <div className="sas-layout">
        <div className="sas-side">
          <div className="sas-hero">
            <span className="sas-hero-avatar">{adminInitials(data.profile.name)}</span>
            <div className="sas-hero-text">
              <b>{name}</b>
              <span className="sas-badge"><Crown size={12} /> Super Admin</span>
              <small>@{data.account?.login || "admin"}</small>
            </div>
          </div>
          <div className="sas-nav" role="navigation" aria-label="Sozlamalar bo'limlari">
            {SECTIONS.map(({ id, label, hint, icon: Icon }) => (
              <button key={id} type="button" className={section === id ? "is-active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>
                <span className="sas-tile-icon"><Icon size={18} /></span>
                <span className="sas-nav-text"><b>{label}</b><small>{hint}</small></span>
              </button>
            ))}
          </div>
        </div>

        <div className="sas-content" key={active.id}>
          {section === "profile" && <ProfileSection data={data} onSaved={persist} />}
          {section === "security" && <SecuritySection data={data} onSaved={persist} onPreference={setPreference} />}
          {section === "notifications" && <NotificationsSection data={data} onPreference={setPreference} />}
          {section === "backup" && <BackupSection data={data} onRestored={() => save(readAdminData())} />}
        </div>
      </div>
    </div>
  );
}

