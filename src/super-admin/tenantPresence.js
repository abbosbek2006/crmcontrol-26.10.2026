// Mijoz CRM'larining jonli holati: onlayn yoki yo'qligi, oxirgi faollik, oxirgi kirish va xatoliklar.
//
// Hozir backend yo'q, shuning uchun holat brauzerning localStorage'ida saqlanadi. Bu Super Admin
// va mijoz portali BIR brauzerda ochilganda real vaqtda ishlaydi. Backend ulanganda faqat shu
// fayldagi o'qish/yozish funksiyalari API so'rovlariga almashtiriladi — ekranlar o'zgarmaydi.
//
// Kalit "crm_" bilan boshlanmaydi: mijoz portalida localStorage kalitlari mijozga ajratiladi
// (tenantStorage.js), bu kalit esa ataylab umumiy qoladi.
import { useEffect, useState } from "react";
import { readProfile } from "../data/profileStore";

export const PRESENCE_KEY = "tenant_presence_v1";
export const HEARTBEAT_MS = 30 * 1000;
// Fondagi tablarda brauzer taymerlarni sekinlashtiradi (daqiqasiga 1 marta), shuning uchun zaxira bilan.
export const ONLINE_WINDOW_MS = 150 * 1000;
const MAX_ERRORS = 25;
const ERROR_DEDUPE_MS = 60 * 1000;

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export function readPresence() {
  try {
    const value = JSON.parse(localStorage.getItem(PRESENCE_KEY) || "{}");
    return isObject(value) ? value : {};
  } catch { return {}; }
}

function updateTenant(tenantId, updater) {
  if (!tenantId) return;
  try {
    const all = readPresence();
    const current = isObject(all[tenantId]) ? all[tenantId] : {};
    all[tenantId] = { ...current, ...updater(current) };
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(all));
  } catch { /* Xotira yopiq yoki to'lgan: holat yozilmaydi, ilova ishlashda davom etadi. */ }
}

const nowIso = () => new Date().toISOString();
// Profilda ism bo'lsa o'shani, bo'lmasa hisob nomini olamiz.
function userLabel(user) {
  if (!user) return null;
  let profile = {};
  try { profile = readProfile(user) || {}; } catch { /* profil o'qilmadi */ }
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  const role = profile.position || (user.type === "director" ? "Direktor" : user.role || "Xodim");
  return { name: String(fullName || user.name || role).slice(0, 60), role: String(role).slice(0, 40) };
}

/* ---------------- Mijoz (CRM) tomoni ---------------- */

export function reportLogin(tenantId, user) {
  const at = nowIso();
  updateTenant(tenantId, () => ({ lastLoginAt: at, lastLoginBy: userLabel(user), lastSeen: at, offlineAt: null }));
}

export function reportHeartbeat(tenantId, user) {
  updateTenant(tenantId, () => ({ lastSeen: nowIso(), offlineAt: null, activeUser: userLabel(user) }));
}

export function reportOffline(tenantId) {
  const at = nowIso();
  updateTenant(tenantId, () => ({ lastSeen: at, offlineAt: at, activeUser: null }));
}

export function reportError(tenantId, { message, source = "" } = {}) {
  const text = String(message || "Noma'lum xatolik").replace(/\s+/g, " ").trim().slice(0, 300);
  const at = nowIso();
  updateTenant(tenantId, (current) => {
    const errors = Array.isArray(current.errors) ? current.errors : [];
    const recent = errors.find((error) => !error.resolvedAt && error.message === text && Date.now() - new Date(error.lastAt).getTime() < ERROR_DEDUPE_MS);
    const next = recent
      ? errors.map((error) => (error === recent ? { ...error, count: (error.count || 1) + 1, lastAt: at } : error))
      : [{ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, message: text, source: String(source).slice(0, 120), at, lastAt: at, count: 1 }, ...errors];
    return { errors: next.slice(0, MAX_ERRORS) };
  });
}

// Mijoz portalida chaqiriladi: global xatoliklarni ushlaydi va kirgan foydalanuvchi uchun signal yuboradi.
export function useTenantPresenceReporter(tenantId, user) {
  useEffect(() => {
    if (!tenantId) return undefined;
    const onError = (event) => reportError(tenantId, { message: event.message || event.error?.message, source: event.filename ? `${event.filename}:${event.lineno || 0}` : "" });
    const onRejection = (event) => reportError(tenantId, { message: event.reason?.message || String(event.reason || "Promise rad etildi"), source: "promise" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [tenantId]);

  const userKey = user ? `${user.type}:${user.id || "director"}` : "";
  useEffect(() => {
    if (!tenantId || !user) return undefined;
    const beat = () => reportHeartbeat(tenantId, user);
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    const onLeave = () => reportOffline(tenantId);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", beat);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", beat);
      window.removeEventListener("pagehide", onLeave);
      reportOffline(tenantId); // chiqish yoki foydalanuvchi almashganda
    };
    // userKey foydalanuvchi almashganini bildiradi; user obyekti har renderda yangi bo'lishi mumkin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, userKey]);
}

/* ---------------- Super Admin tomoni ---------------- */

export function resolveTenantErrors(tenantId, errorId = null) {
  const at = nowIso();
  updateTenant(tenantId, (current) => ({
    errors: (Array.isArray(current.errors) ? current.errors : []).map((error) => (!error.resolvedAt && (!errorId || error.id === errorId) ? { ...error, resolvedAt: at } : error)),
  }));
}

export function tenantLiveStatus(entry, now = Date.now()) {
  const lastSeenMs = entry?.lastSeen ? new Date(entry.lastSeen).getTime() : 0;
  const offline = entry?.offlineAt && new Date(entry.offlineAt).getTime() >= lastSeenMs;
  const openErrors = (Array.isArray(entry?.errors) ? entry.errors : []).filter((error) => !error.resolvedAt);
  const state = !lastSeenMs ? "never" : !offline && now - lastSeenMs <= ONLINE_WINDOW_MS ? "online" : "offline";
  return { state, lastSeen: entry?.lastSeen || null, lastLoginAt: entry?.lastLoginAt || null, lastLoginBy: entry?.lastLoginBy || null, activeUser: state === "online" ? entry?.activeUser || null : null, openErrors };
}

// Super Admin panelida: holatni har bir necha soniyada va boshqa tabdagi o'zgarishda yangilaydi.
export function useLivePresence(intervalMs = 5000) {
  const [snapshot, setSnapshot] = useState(() => ({ presence: readPresence(), now: Date.now() }));
  useEffect(() => {
    const refresh = () => setSnapshot({ presence: readPresence(), now: Date.now() });
    const timer = window.setInterval(refresh, intervalMs);
    const onStorage = (event) => { if (!event.key || event.key === PRESENCE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", refresh); };
  }, [intervalMs]);
  const refresh = () => setSnapshot({ presence: readPresence(), now: Date.now() });
  return { ...snapshot, refresh };
}

// Tizimning umumiy holati: xotira ishlayaptimi, internet bormi, ochiq xatoliklar bormi.
export function systemHealth({ openErrorCount, onlineCount, tenantCount, now = Date.now() }) {
  const checkedAt = new Date(now).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  let storageOk = true;
  try { const probe = "__crm_health_probe__"; localStorage.setItem(probe, "1"); localStorage.removeItem(probe); } catch { storageOk = false; }
  if (!storageOk) return { level: "down", title: "Tizim ishlamayapti", detail: "Brauzer xotirasiga yozib bo'lmayapti", checkedAt };
  let usedBytes = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); usedBytes += (key.length + (localStorage[key] || "").length) * 2; } } catch { /* o'lchab bo'lmadi */ }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { level: "warning", title: "Internet aloqasi yo'q", detail: `Tizim lokal ishlayapti · ${checkedAt}`, checkedAt };
  if (openErrorCount > 0) return { level: "warning", title: `${openErrorCount} ta xatolik bor`, detail: `Live Monitoring bo'limida ko'ring · ${checkedAt}`, checkedAt };
  if (usedBytes > 4.5 * 1024 * 1024) return { level: "warning", title: "Xotira deyarli to'lgan", detail: "Zaxira oling va eski ma'lumotlarni tozalang", checkedAt };
  return { level: "ok", title: "Tizimlar barqaror ishlayapti", detail: `${onlineCount}/${tenantCount} mijoz onlayn · ${checkedAt}`, checkedAt };
}

export function formatRelative(iso, now = Date.now()) {
  if (!iso) return "—";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hozirgina";
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} kun oldin`;
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export const formatExact = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

export const formatShort = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
