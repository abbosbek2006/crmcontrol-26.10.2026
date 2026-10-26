import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Store } from "lucide-react";
import { readProfile } from "../data/profileStore";
import { getDirector, resetDirectorAfterRecovery } from "../data/accessStore";
import { cancelRecovery, consumeRecoveryTicket, finishRecoveryVerification, recoveryDemoCode, resendRecoveryCode, startRecovery as beginRecovery, verifyRecoveryCode } from "../data/passwordRecovery";
import { readAdminData } from "../super-admin/tenantStorage";
import { useLanguage } from "../context/LanguageContext";
import "./PasswordRecovery.css";

const COPY = {
  uz: {
    title: "Parolni qayta tiklash", subtitle: "Hisobingizni tiklash uchun quyidagi qadamlarni bajaring.",
    steps: ["Brend", "Email", "Telefon", "Yangi parol"], cancel: "Bekor qilish",
    why: "Nega bu ma'lumotlar so'ralayapti?", whyBody: "Brendingiz va tasdiqlangan aloqa ma'lumotlari hisobingiz xavfsizligini ta'minlash uchun so'raladi.",
    brandTitle: "Brendingizni tasdiqlang", brandBody: "Avvalo, tizimdagi brend sizniki ekanini tasdiqlash uchun kompaniya yoki do'kon nomini kiriting.",
    brandPlaceholder: "Brend nomingizni kiriting", example: "Masalan: UyMarket, Aziz Shashlik, AERO NOVA va h.k.",
    emailTitle: "Emailingizni tasdiqlang", phoneTitle: "Raqamingizni tasdiqlang", codeBody: "Email manzilingizga yuborilgan 6 xonali kodni kiriting.", phoneCodeBody: "Telefon raqamingizga yuborilgan 6 xonali kodni kiriting.", brandSubtitle: "Hisobingizni tiklash uchun avval brendingizni tasdiqlang.", demoTitle: "Demo rejimi",
    sentEmail: `Demo: emailga yuborish ulanmagan. Kod: ${recoveryDemoCode}`, sentPhone: `Demo: SMS yuborish ulanmagan. Kod: ${recoveryDemoCode}`,
    newTitle: "Yangi parolingizni kiriting", newBody: "Hisobingiz uchun yangi parol yarating.", strong: "Xavfsizlik uchun kuchli yangi parol tanlang",
    newPass: "Yangi parol", confirm: "Parolni tasdiqlang", passPlaceholder: "Kamida 8 ta belgi", confirmPlaceholder: "Parolni qayta kiriting",
    min: "Parol barcha talablarni bajarsin.", rules: ["Kamida 8 ta belgi", "Katta va kichik harf", "Kamida bitta raqam", "Maxsus belgi (masalan: !@#$%)"], continue: "Davom etish", save: "Parolni saqlash", back: "Orqaga", resend: "Kodni qayta yuborish", wait: "Qayta yuborish", doneTitle: "Parol yangilandi", doneBody: "Endi yangi parolingiz bilan tizimga kirishingiz mumkin.", signIn: "Kirish",
    missing: "Avval Profil sozlamalarida tasdiqlangan email va telefon raqamini kiriting.", brandMismatch: "Kiritilgan brend nomi taklif havolasidagi nomga mos kelmadi.", noAccount: "Direktor hisobi topilmadi.", noTenant: "Brend ma'lumoti topilmadi.", invalidEmail: "Profilingizda yaroqli email manzili yo'q.", invalidPhone: "Profilingizda yaroqli telefon raqami yo'q.", mismatch: "Parollar mos kelmadi.", eyes: "Parolni ko'rsatish", hide: "Parolni yashirish", stepsLabel: "Tiklash bosqichlari", close: "Tiklashni yopish"
  },
  ru: {
    title: "Восстановление пароля", subtitle: "Выполните шаги ниже, чтобы восстановить доступ.",
    steps: ["Бренд", "Email", "Телефон", "Новый пароль"], cancel: "Отмена",
    why: "Зачем нужны эти данные?", whyBody: "Название бренда и подтверждённые контакты нужны для защиты вашей учётной записи.",
    brandTitle: "Подтвердите бренд", brandBody: "Введите название компании или магазина, чтобы подтвердить, что бренд принадлежит вам.",
    brandPlaceholder: "Введите название бренда", example: "Например: UyMarket, Aziz Shashlik, AERO NOVA и т. д.",
    emailTitle: "Подтвердите email", phoneTitle: "Подтвердите номер", codeBody: "Введите 6-значный код, отправленный на email.", phoneCodeBody: "Введите 6-значный код, отправленный на телефон.", brandSubtitle: "Сначала подтвердите бренд, чтобы восстановить доступ.", demoTitle: "Демо-режим",
    sentEmail: `Демо: отправка email не подключена. Код: ${recoveryDemoCode}`, sentPhone: `Демо: отправка SMS не подключена. Код: ${recoveryDemoCode}`,
    newTitle: "Введите новый пароль", newBody: "Создайте новый пароль для своей учётной записи.", strong: "Выберите надёжный новый пароль",
    newPass: "Новый пароль", confirm: "Подтвердите пароль", passPlaceholder: "Не менее 8 символов", confirmPlaceholder: "Введите пароль ещё раз",
    min: "Пароль должен соответствовать всем требованиям.", rules: ["Не менее 8 символов", "Строчные и заглавные буквы", "Хотя бы одна цифра", "Спецсимвол (например: !@#$%)"], continue: "Продолжить", save: "Сохранить пароль", back: "Назад", resend: "Отправить код повторно", wait: "Повторная отправка", doneTitle: "Пароль обновлён", doneBody: "Теперь войдите в систему с новым паролем.", signIn: "Войти",
    missing: "Сначала укажите подтверждённые email и телефон в настройках профиля.", brandMismatch: "Название бренда не совпадает с названием из ссылки-приглашения.", noAccount: "Учётная запись директора не найдена.", noTenant: "Данные бренда не найдены.", invalidEmail: "В профиле нет действительного email.", invalidPhone: "В профиле нет действительного номера телефона.", mismatch: "Пароли не совпадают.", eyes: "Показать пароль", hide: "Скрыть пароль", stepsLabel: "Этапы восстановления", close: "Закрыть восстановление"
  }
};

const maskEmail = (email) => { const [name, domain] = email.split("@"); return `${name.slice(0, 1)}${"•".repeat(Math.min(Math.max(name.length - 1, 2), 6))}@${domain}`; };
const maskPhone = (phone) => `${phone.slice(0, 4)} ${"•".repeat(Math.max(phone.length - 7, 3))} ${phone.slice(-3)}`;

export default function PasswordRecovery({ tenantId, tenantInvite, onBack, onComplete }) {
  const { lang, setLang } = useLanguage();
  const c = COPY[lang === "ru" ? "ru" : "uz"];
  const profile = useMemo(() => readProfile({ type: "director" }), []);
  const tenant = useMemo(() => readAdminData().tenants.find(item => item.id === tenantId && item.invite === tenantInvite), [tenantId, tenantInvite]);
  const [step, setStep] = useState(0); const [brand, setBrand] = useState("");
  const [challengeId, setChallengeId] = useState(""); const [code, setCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false); const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [seconds, setSeconds] = useState(60);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || "");
  const validPhone = /^\+\d{8,15}$/.test((profile.phone || "").replace(/[\s()-]/g, ""));
  const passwordRules = [password.length >= 8, /[a-zа-я]/.test(password) && /[A-ZА-ЯЁ]/.test(password), /\d/.test(password), /[^a-zа-яё\d]/i.test(password)];
  const RecoveryIcon = step === 1 ? Mail : step === 2 ? Phone : step === 3 ? LockKeyhole : ShieldCheck;
  const headingTitle = step === 0 ? c.brandTitle : step === 1 ? c.emailTitle : step === 2 ? c.phoneTitle : step === 3 ? c.newTitle : c.doneTitle;
  const headingBody = step === 0 ? c.brandSubtitle : step === 1 ? c.codeBody : step === 2 ? c.phoneCodeBody : step === 3 ? c.newBody : c.doneBody;

  useEffect(() => { if (step !== 1 && step !== 2) return undefined; if (seconds <= 0) return undefined; const timer = setTimeout(() => setSeconds(value => value - 1), 1000); return () => clearTimeout(timer); }, [step, seconds]);
  useEffect(() => () => { if (challengeId) cancelRecovery({ challengeId }); }, [challengeId]);

  const startRecovery = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!tenant) return setError(c.noTenant);
    if (!getDirectorSafe()) return setError(c.noAccount);
    if (!validEmail) return setError(c.invalidEmail);
    if (!validPhone) return setError(c.invalidPhone);
    if (!brand.trim() || brand.trim().toLocaleLowerCase() !== tenant.name.trim().toLocaleLowerCase()) return setError(c.brandMismatch);
    setLoading(true);
    try { const result = await beginRecovery({ tenantId, brand: brand.trim(), email: profile.email.trim().toLowerCase(), phone: profile.phone.replace(/[\s()-]/g, "") }); setChallengeId(result.challengeId); setSeconds(60); setStep(1); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const verifyCode = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!/^\d{6}$/.test(code)) return setError(c.codeBody);
    setLoading(true);
    try {
      await verifyRecoveryCode({ challengeId, channel: step === 1 ? "email" : "phone", code }); setCode("");
      if (step === 1) { setEmailVerified(true); setStep(2); setSeconds(60); }
      else { const result = await finishRecoveryVerification({ challengeId, email: profile.email.trim().toLowerCase(), tenantId }); setTicket(result.ticket); setStep(3); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const finish = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    if (!passwordRules.every(Boolean)) return setError(c.min);
    if (password !== confirmPassword) return setError(c.mismatch);
    setLoading(true);
    try { await consumeRecoveryTicket({ ticket, email: profile.email.trim().toLowerCase(), tenantId }); const account = await resetDirectorAfterRecovery(password); setStep(4); onComplete(account); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const resend = async (channel) => {
    if (seconds > 0) return;
    setError(""); setLoading(true);
    try { await resendRecoveryCode({ challengeId, channel }); if (channel === "email") setEmailVerified(false); setSeconds(60); setCode(""); setNotice(c.resend); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const steps = c.steps;
  return <div className="pr-page">
    <aside className="pr-brand-panel">
      <div className="pr-brand-top"><div className="pr-brand-mark"><Store size={20}/></div><div><strong>{tenant?.name || "CRM tizimi"}</strong><span>{lang === "ru" ? "Платформа управления бизнесом" : "Biznesni boshqarish platformasi"}</span></div><div className="pr-lang">{["uz", "ru"].map(code => <button type="button" key={code} onClick={() => setLang(code)} className={lang === code ? "active" : ""}>{code.toUpperCase()}</button>)}</div></div>
      <div className="pr-brand-copy"><h1>{lang === "ru" ? "Полный контроль над вашим бизнесом" : "Biznesingizni to'liq nazorat qiling"}</h1><p>{lang === "ru" ? "Управляйте продажами, складом, финансами и клиентами в одном месте." : "Savdo, ombor, moliya va mijozlarni bir joydan boshqaring."}</p>{(lang === "ru" ? ["Продажи и управление складом", "CRM клиентов и задолженность", "Финансовая аналитика и отчёты", "POS-терминал и чеки"] : ["Sotuv va inventar boshqaruvi", "Mijozlar CRM va qarzdorlik", "Moliyaviy tahlil va hisobotlar", "POS terminal va chek tizimi"]).map(item => <div className="pr-feature" key={item}><CheckCircle2 size={18}/>{item}</div>)}</div>
      <small>© 2026 {tenant?.name || "CRM tizimi"}. {lang === "ru" ? "Все права защищены." : "Barcha huquqlar himoyalangan."}</small>
    </aside>
    <main className="pr-main"><section className="pr-card">
      <div className="pr-card-controls"><button type="button" onClick={() => step ? (setStep(step === 3 && !emailVerified ? 1 : step - 1), setError("")) : onBack()} aria-label={c.back}><ArrowLeft size={18}/></button><button type="button" onClick={onBack} aria-label={c.close}>{c.cancel}</button></div>
      <div className="pr-heading"><div className="pr-shield"><RecoveryIcon size={32}/></div><h2>{headingTitle}</h2><p>{headingBody}</p></div>
      {step < 4 && <div className="pr-steps" aria-label={c.stepsLabel}>{steps.map((label, index) => <div className={`pr-step ${index === step ? "current" : index < step ? "complete" : ""}`} key={label}><span>{index < step ? <Check size={16}/> : index + 1}</span><small>{label}</small></div>)}</div>}
      {step < 3 && <div className="pr-tip"><ShieldCheck size={22}/><div><strong>{step === 0 ? c.why : c.demoTitle}</strong><span>{step === 0 ? c.whyBody : step === 1 ? c.sentEmail : c.sentPhone}</span></div></div>}
      {step === 0 && <form onSubmit={startRecovery} className="pr-form"><label className="pr-field"><span className="pr-sr-only">{c.brandTitle}</span><span className="pr-input"><Building2 size={18}/><input value={brand} onChange={e => setBrand(e.target.value)} placeholder={c.brandPlaceholder} autoComplete="organization" required/></span></label><small className="pr-example">{c.example}</small><div className="pr-contacts"><span><Mail size={15}/>{validEmail ? maskEmail(profile.email) : c.invalidEmail}</span><span><Phone size={15}/>{validPhone ? maskPhone(profile.phone.replace(/[\s()-]/g, "")) : c.invalidPhone}</span></div><button className="pr-primary" disabled={loading}>{loading ? "…" : c.continue}<ArrowRight size={18}/></button></form>}
      {(step === 1 || step === 2) && <form onSubmit={verifyCode} className="pr-form pr-verify"><div className="pr-recovery-contact">{step === 1 ? <Mail size={19}/> : <Phone size={19}/>}<strong>{step === 1 ? maskEmail(profile.email) : maskPhone(profile.phone.replace(/[\s()-]/g, ""))}</strong></div><label className="pr-otp-label"><span className="pr-sr-only">{step === 1 ? c.emailTitle : c.phoneTitle}</span><span className="pr-otp-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span className={index === code.length ? "focused" : ""} key={index}>{code[index] || ""}</span>)}</span><input id="pr-otp" className="pr-otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label={step === 1 ? c.emailTitle : c.phoneTitle} required/></label><div className="pr-resend">{lang === "ru" ? "Не получили код?" : "Kod kelmadimi?"}<button type="button" disabled={seconds > 0 || loading} onClick={() => resend(step === 1 ? "email" : "phone")}>{seconds > 0 ? `${c.wait} (${seconds}s)` : c.resend}</button></div><button className="pr-primary" disabled={loading}>{loading ? "…" : c.continue}<ArrowRight size={18}/></button></form>}
      {step === 3 && <form onSubmit={finish} className="pr-form"><label className="pr-field"><span>{c.newPass}</span><span className="pr-input"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={c.passPlaceholder} autoComplete="new-password" minLength={8} required/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? c.hide : c.eyes}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></span></label><label className="pr-field"><span>{c.confirm}</span><span className="pr-input"><input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={c.confirmPlaceholder} autoComplete="new-password" minLength={8} required/><button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? c.hide : c.eyes}>{showConfirm ? <EyeOff size={19}/> : <Eye size={19}/>}</button></span></label><div className="pr-password-rules"><strong>{c.strong}</strong>{c.rules.map((rule, index) => <span className={passwordRules[index] ? "met" : ""} key={rule}><CheckCircle2 size={15}/>{rule}</span>)}</div><button className="pr-primary" disabled={loading || !passwordRules.every(Boolean) || password !== confirmPassword}>{loading ? "…" : c.save}<ArrowRight size={18}/></button></form>}
      {error && <div className="pr-error" role="alert">{error}</div>}{notice && <div className="pr-notice" role="status">{notice}</div>}
    </section></main>
  </div>;
}

function getDirectorSafe() { try { return Boolean(getDirector()); } catch { return false; } }
