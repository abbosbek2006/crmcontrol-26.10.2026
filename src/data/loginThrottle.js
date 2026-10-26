// Noto'g'ri login/paroldan keyin kirish tugmasini vaqtincha bloklash.
// Har bir xatodan keyin kutish vaqti oshib boradi: 5s, 10s, 30s, 1 daq, 5 daq, 10 daq, 30 daq, 1 soat,
// keyin har safar ikki baravar (24 soatgacha). Muvaffaqiyatli kirishda hisob nolga tushadi.
// Blok login nomiga emas, shu qurilmadagi kirish oynasiga (scope) qo'yiladi: boshqa login yozib
// aylanib o'tib bo'lmaydi. Haqiqiy cheklov backendda (IP va hisob bo'yicha) ham qilinishi shart.
import { useCallback, useEffect, useState } from "react";

const KEY = "crm_login_throttle_v2";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const LOCK_STEPS = [5 * SECOND, 10 * SECOND, 30 * SECOND, MINUTE, 5 * MINUTE, 10 * MINUTE, 30 * MINUTE, HOUR];
const MAX_LOCK = 24 * HOUR;
// Uzoq vaqt xato bo'lmasa, bosqichlar boshidan boshlanadi.
const RESET_AFTER = 24 * HOUR;

export const LOGIN_SCOPES = { crm: "crm", settings: "crm-settings", superAdmin: "super-admin" };

const read = () => {
  try { const data = JSON.parse(localStorage.getItem(KEY) || "{}"); return data && typeof data === "object" ? data : {}; }
  catch { return {}; }
};
const write = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* xotira yopiq */ } };

export function lockDuration(failures) {
  if (failures <= 0) return 0;
  if (failures <= LOCK_STEPS.length) return LOCK_STEPS[failures - 1];
  return Math.min(HOUR * 2 ** (failures - LOCK_STEPS.length), MAX_LOCK);
}

export function getLockRemaining(scope) {
  const entry = read()[scope];
  return entry?.lockedUntil ? Math.max(0, entry.lockedUntil - Date.now()) : 0;
}

export function formatLockTime(ms) {
  const total = Math.ceil(ms / SECOND);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function assertNotLocked(scope) {
  const remaining = getLockRemaining(scope);
  if (remaining > 0) throw new Error(`Juda ko'p noto'g'ri urinish. ${formatLockTime(remaining)} dan keyin qayta urinib ko'ring.`);
}

export function recordFailure(scope) {
  const data = read();
  const previous = data[scope];
  const stale = !previous?.lastFailure || Date.now() - previous.lastFailure > RESET_AFTER;
  const failures = (stale ? 0 : previous.failures || 0) + 1;
  const now = Date.now();
  data[scope] = { failures, lastFailure: now, lockedUntil: now + lockDuration(failures) };
  write(data);
  return lockDuration(failures);
}

export function recordSuccess(scope) {
  const data = read();
  delete data[scope];
  write(data);
}

// Kirish tugmasi uchun: qolgan vaqtni har soniyada yangilaydi, boshqa tabdagi xatolarni ham ko'radi.
export function useLoginLock(scope) {
  const [remaining, setRemaining] = useState(() => getLockRemaining(scope));
  const refresh = useCallback(() => setRemaining(getLockRemaining(scope)), [scope]);
  const locked = remaining > 0;
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    // Soniya hisoblagichi faqat blok paytida ishlaydi.
    const timer = locked ? window.setInterval(refresh, 250) : undefined;
    return () => { window.clearInterval(timer); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [refresh, locked]);
  return { locked, remaining, label: formatLockTime(remaining), refresh };
}
