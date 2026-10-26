import { createCredentials, verifyPassword } from "../data/accessStore";
import { assertNotLocked, recordFailure, recordSuccess } from "../data/loginThrottle";

const ADMIN_KEY = "super_admin_data_v1";
const ADMIN_SESSION_KEY = "super_admin_session";
let tenantId = "";
let patched = false;

const scoped = (key) => tenantId && String(key).startsWith("crm_") ? `tenant:${tenantId}:${key}` : key;

export function activateTenantStorage(id) {
  tenantId = id || "";
  if (patched || !tenantId) return;
  patched = true;
  const get = Storage.prototype.getItem;
  const set = Storage.prototype.setItem;
  const remove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function (key) { return get.call(this, scoped(key)); };
  Storage.prototype.setItem = function (key, value) { return set.call(this, scoped(key), value); };
  Storage.prototype.removeItem = function (key) { return remove.call(this, scoped(key)); };
}

export const ADMIN_IDLE_OPTIONS = [10, 15, 30, 60];
export const DEFAULT_ADMIN_PREFERENCES = { messagePopup: true, titleBadge: true, idleMinutes: 30 };

const plainObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

// Saytda tarif tushunchasi yo'q: eski versiyada saqlangan "plan" maydonlari o'qishda tashlab yuboriladi.
const withoutPlan = ({ plan, ...tenant }) => tenant;

function normalizePreferences(value) {
  const { defaultPlan, ...saved } = plainObject(value);
  const prefs = { ...DEFAULT_ADMIN_PREFERENCES, ...saved };
  if (!ADMIN_IDLE_OPTIONS.includes(prefs.idleMinutes)) prefs.idleMinutes = DEFAULT_ADMIN_PREFERENCES.idleMinutes;
  prefs.messagePopup = prefs.messagePopup !== false;
  prefs.titleBadge = prefs.titleBadge !== false;
  return prefs;
}

export function readAdminData() {
  try {
    const data = JSON.parse(localStorage.getItem(ADMIN_KEY) || "{}");
    return {
      account: data.account || null,
      tenants: Array.isArray(data.tenants) ? data.tenants.map(withoutPlan) : [],
      tickets: Array.isArray(data.tickets) ? data.tickets : [],
      profile: plainObject(data.profile),
      preferences: normalizePreferences(data.preferences),
      meta: plainObject(data.meta),
    };
  } catch { return { account: null, tenants: [], tickets: [], profile: {}, preferences: normalizePreferences(), meta: {} }; }
}

export function saveAdminData(data) { localStorage.setItem(ADMIN_KEY, JSON.stringify(data)); }
export function tenantLink(tenant) { return `${window.location.origin}${window.location.pathname}?tenant=${encodeURIComponent(tenant.id)}&invite=${encodeURIComponent(tenant.invite)}`; }

// Super Admin hisobi: parol ochiq saqlanmaydi, faqat PBKDF2 xeshi.
// Sessiya "1" emas, hisob salt'iga bog'langan: parol almashsa, eski sessiya yaroqsiz bo'ladi.
export async function createAdminAccount(login, password) {
  const data = readAdminData();
  if (data.account) throw new Error("Super Admin hisobi allaqachon mavjud.");
  const account = await createCredentials(login, password);
  saveAdminData({ ...data, account, meta: { ...data.meta, lastLoginAt: new Date().toISOString() } });
  sessionStorage.setItem(ADMIN_SESSION_KEY, account.salt);
}

export async function loginAdmin(login, password) {
  const normalized = login.trim().toLowerCase();
  assertNotLocked("super-admin");
  const data = readAdminData();
  let account = data.account;
  if (!account || account.login !== normalized) { recordFailure("super-admin"); throw new Error("Login yoki parol noto'g'ri."); }
  // Eski versiyada parol ochiq saqlangan: bir marta tekshirib, xeshga o'tkazamiz.
  const ok = account.password !== undefined ? account.password === password : await verifyPassword(account, password);
  if (!ok) { recordFailure("super-admin"); throw new Error("Login yoki parol noto'g'ri."); }
  if (account.password !== undefined) account = await createCredentials(normalized, password);
  const meta = { ...data.meta, previousLoginAt: data.meta.lastLoginAt || null, lastLoginAt: new Date().toISOString() };
  saveAdminData({ ...data, account, meta });
  recordSuccess("super-admin");
  sessionStorage.setItem(ADMIN_SESSION_KEY, account.salt);
}

export function hasAdminSession() {
  const account = readAdminData().account;
  return Boolean(account?.salt) && sessionStorage.getItem(ADMIN_SESSION_KEY) === account.salt;
}

export function logoutAdmin() { sessionStorage.removeItem(ADMIN_SESSION_KEY); }

// Login va/yoki parolni almashtirish. Joriy parol tekshiriladi, xato urinishlar bloklanadi.
// Parol almashsa yangi salt yaratiladi: boshqa ochiq sessiyalar bekor bo'ladi, joriy sessiya davom etadi.
export async function changeAdminCredentials({ currentPassword, login, newPassword = "" }) {
  assertNotLocked("super-admin-settings");
  const data = readAdminData();
  const account = data.account;
  if (!account) throw new Error("Super Admin hisobi topilmadi.");
  if (!currentPassword || !await verifyPassword(account, currentPassword)) {
    recordFailure("super-admin-settings");
    throw new Error("Joriy parol noto'g'ri.");
  }
  recordSuccess("super-admin-settings");
  const normalized = String(login || "").trim().toLowerCase();
  if (normalized.length < 3) throw new Error("Login kamida 3 belgidan iborat bo'lsin.");
  if (newPassword && newPassword.length < 8) throw new Error("Yangi parol kamida 8 belgidan iborat bo'lsin.");
  if (!newPassword && normalized === account.login) throw new Error("Login yoki parolni o'zgartiring.");
  const updated = newPassword ? await createCredentials(normalized, newPassword) : { ...account, login: normalized };
  const meta = { ...data.meta, credentialsChangedAt: new Date().toISOString() };
  saveAdminData({ ...data, account: updated, meta });
  sessionStorage.setItem(ADMIN_SESSION_KEY, updated.salt);
  return { passwordChanged: Boolean(newPassword) };
}

// Zaxira nusxa: mijozlar ro'yxati, yordam xabarlari, sozlamalar va har bir mijozning CRM ma'lumotlari.
// Super Admin login/parol xeshi zaxiraga KIRMAYDI.
const BACKUP_FORMAT = "crm-control-center-backup";
const TENANT_PREFIX = "tenant:";

function tenantStorageEntries() {
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(TENANT_PREFIX)) entries[key] = localStorage[key];
  }
  return entries;
}

export function adminStorageStats() {
  const entries = tenantStorageEntries();
  const bytes = Object.entries(entries).reduce((sum, [key, value]) => sum + (key.length + String(value).length) * 2, 0)
    + (localStorage[ADMIN_KEY] || "").length * 2;
  return { keys: Object.keys(entries).length, bytes };
}

export function buildAdminBackup() {
  const { tenants, tickets, profile, preferences } = readAdminData();
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), admin: { tenants, tickets, profile, preferences }, tenantData: tenantStorageEntries() };
}

// Faylni ishonchsiz ma'lumot deb tekshiramiz: faqat kutilgan tuzilma va "tenant:" kalitlari qabul qilinadi.
export function parseAdminBackup(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error("Fayl JSON formatida emas."); }
  if (backup?.format !== BACKUP_FORMAT || backup.version !== 1) throw new Error("Bu Control Center zaxira fayli emas.");
  const admin = plainObject(backup.admin);
  const tenants = Array.isArray(admin.tenants) ? admin.tenants.filter((t) => t && typeof t.id === "string" && typeof t.name === "string").map(withoutPlan) : null;
  if (!tenants) throw new Error("Zaxirada mijozlar ro'yxati topilmadi.");
  const tickets = Array.isArray(admin.tickets) ? admin.tickets.filter((t) => t && typeof t.id === "string") : [];
  const tenantData = Object.fromEntries(Object.entries(plainObject(backup.tenantData))
    .filter(([key, value]) => key.startsWith(TENANT_PREFIX) && typeof value === "string"));
  return { exportedAt: backup.exportedAt, tenants, tickets, profile: plainObject(admin.profile), preferences: normalizePreferences(admin.preferences), tenantData };
}

// Joriy mijoz ma'lumotlari zaxiradagisi bilan almashtiriladi. Super Admin hisobi o'zgarmaydi.
export function restoreAdminBackup(parsed) {
  const current = readAdminData();
  const previous = { admin: localStorage[ADMIN_KEY], tenantData: tenantStorageEntries() };
  try {
    Object.keys(previous.tenantData).forEach((key) => localStorage.removeItem(key));
    Object.entries(parsed.tenantData).forEach(([key, value]) => localStorage.setItem(key, value));
    saveAdminData({ ...current, tenants: parsed.tenants, tickets: parsed.tickets, profile: parsed.profile, preferences: parsed.preferences, meta: { ...current.meta, restoredAt: new Date().toISOString() } });
  } catch (error) {
    // Xotira to'lib qolsa, eski holatga qaytaramiz.
    Object.keys(tenantStorageEntries()).forEach((key) => localStorage.removeItem(key));
    Object.entries(previous.tenantData).forEach(([key, value]) => localStorage.setItem(key, value));
    if (previous.admin) localStorage.setItem(ADMIN_KEY, previous.admin);
    throw new Error(error?.name === "QuotaExceededError" ? "Brauzer xotirasi yetarli emas. Zaxira tiklanmadi." : "Zaxirani tiklab bo'lmadi.");
  }
}
