import { readEmployees, saveEmployees } from "./employeeStore";
import { assertNotLocked, recordFailure, recordSuccess } from "./loginThrottle";

const DIRECTOR_KEY = "crm_director_account";
const LOCAL_LOGIN_KEY = "crm_local_login_v1";
export const SESSION_KEY = "crm_access_session";
export const ACCESS_SECTIONS = [
  { id: "dashboard", label: "Dashboard" }, { id: "sales", label: "Sotuvlar" },
  { id: "orders", label: "Buyurtmalar" },
  { id: "products", label: "Mahsulotlar" }, { id: "customers", label: "Mijozlar" },
  { id: "suppliers", label: "Ta'minotchilar" }, { id: "employees", label: "Xodimlar" },
  { id: "ustolar", label: "Ustolar" }, { id: "finance", label: "Moliya" },
  { id: "reports", label: "Hisobotlar" }, { id: "settings", label: "Sozlamalar" },
  { id: "ai-chat", label: "AI Chat" },
  { id: "drafts", label: "Qoralama" },
];

export function sectionForPage(page) {
  if (page === "help" || page === "notifications") return null;
  if (page.startsWith("customer-")) return "customers";
  if (page.startsWith("product-")) return "products";
  if (page.startsWith("supplier-")) return "suppliers";
  if (page.startsWith("employee-")) return "employees";
  if (page.startsWith("debt-")) return "finance";
  if (page.startsWith("sales-")) return "sales";
  if (page === "orders") return "orders";
  if (page.startsWith("products-")) return "products";
  if (page.startsWith("customers-")) return "customers";
  if (page.startsWith("finance-")) return "finance";
  return page;
}

export function canAccess(user, page) {
  if (!user) return false;
  if (user.type === "director") return true;
  const section = sectionForPage(page);
  return !section || user.permissions?.includes(section);
}

export function getDirector() {
  try {
    const director = JSON.parse(localStorage.getItem(DIRECTOR_KEY));
    if (director && !director.resetVersion) {
      const migrated = { ...director, resetVersion: 1 };
      localStorage.setItem(DIRECTOR_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return director;
  }
  catch { return null; }
}

export function readLocalLogin() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_LOGIN_KEY) || "null");
    localStorage.removeItem(LOCAL_LOGIN_KEY);
    return value?.login ? { login: value.login } : null;
  } catch { return null; }
}

const PASSWORD_ITERATIONS = 310000;
async function digest(password, salt, iterations = PASSWORD_ITERATIONS) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function legacyDigest(password, salt) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(record, password) {
  if (!record?.salt || !record?.passwordHash) return false;
  const candidate = record.passwordIterations ? await digest(password, record.salt, record.passwordIterations) : await legacyDigest(password, record.salt);
  return record.passwordHash === candidate;
}

export async function createCredentials(login, password) {
  const salt = crypto.randomUUID();
  return { login: login.trim().toLowerCase(), salt, passwordHash: await digest(password, salt), passwordIterations: PASSWORD_ITERATIONS };
}

export function loginExists(login) {
  const normalized = login.trim().toLowerCase();
  return getDirector()?.login === normalized || readEmployees().some((employee) => employee.login === normalized);
}

export async function registerDirector(login, password) {
  if (getDirector()) throw new Error("Direktor hisobi allaqachon yaratilgan.");
  if (loginExists(login)) throw new Error("Bu login band.");
  localStorage.setItem(DIRECTOR_KEY, JSON.stringify({ ...await createCredentials(login, password), resetVersion: 1 }));
  localStorage.removeItem(LOCAL_LOGIN_KEY);
  return { type: "director", name: "Direktor", credentialId: getDirector()?.salt };
}

export async function resetDirectorAfterRecovery(password) {
  if (password.length < 8) throw new Error("Yangi parol kamida 8 belgidan iborat bo'lsin.");
  const director = getDirector();
  if (!director) throw new Error("Direktor hisobi topilmadi.");
  const updated = { ...await createCredentials(director.login, password), resetVersion: 1 };
  localStorage.setItem(DIRECTOR_KEY, JSON.stringify(updated));
  localStorage.removeItem(LOCAL_LOGIN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return { type: "director", name: "Direktor", credentialId: updated.salt };
}

export async function updateDirectorCredentials(login, currentPassword, newPassword = "") {
  const normalized = login.trim().toLowerCase();
  const director = getDirector();
  if (!director) throw new Error("Direktor hisobi topilmadi.");
  assertNotLocked("crm-settings");
  if (!currentPassword || !await verifyPassword(director, currentPassword)) {
    recordFailure("crm-settings");
    throw new Error("Hozirgi parol noto'g'ri.");
  }
  if (!normalized) throw new Error("Yangi loginni kiriting.");
  if (readEmployees().some((employee) => employee.login === normalized)) {
    throw new Error("Bu login xodim tomonidan ishlatilmoqda.");
  }
  if (!newPassword && normalized === director.login) throw new Error("Login yoki parolni o'zgartiring.");
  if (newPassword && newPassword.length < 8) throw new Error("Yangi parol kamida 8 belgidan iborat bo'lsin.");
  const updated = newPassword
    ? { ...await createCredentials(normalized, newPassword), resetVersion: 1 }
    : { ...director, login: normalized, resetVersion: 1 };
  localStorage.setItem(DIRECTOR_KEY, JSON.stringify(updated));
  localStorage.removeItem(LOCAL_LOGIN_KEY);
  return updated;
}

export async function authenticate(login, password) {
  const normalized = login.trim().toLowerCase();
  assertNotLocked("crm");
  const director = getDirector();
  if (director?.login === normalized && await verifyPassword(director, password)) {
    if (!director.passwordIterations) localStorage.setItem(DIRECTOR_KEY, JSON.stringify({ ...director, ...await createCredentials(normalized, password), resetVersion: 1 }));
    localStorage.removeItem(LOCAL_LOGIN_KEY);
    recordSuccess("crm");
    return { type: "director", name: "Direktor", credentialId: getDirector()?.salt };
  }
  const employee = readEmployees().find((entry) => entry.login === normalized);
  if (employee?.status === "active" && await verifyPassword(employee, password)) {
    if (!employee.passwordIterations) {
      const upgraded = { ...employee, ...await createCredentials(normalized, password) };
      saveEmployees(readEmployees().map(entry => entry.id === employee.id ? upgraded : entry));
    }
    localStorage.removeItem(LOCAL_LOGIN_KEY);
    recordSuccess("crm");
    return { type: "employee", id: employee.id, name: employee.name, role: employee.role, permissions: employee.permissions || [], credentialId: employee.salt };
  }
  recordFailure("crm");
  throw new Error("Login yoki parol noto'g'ri, yoxud xodim hisobi faol emas.");
}

export function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (saved?.type === "director") {
      const director = getDirector();
      return director && saved.credentialId === director.salt ? saved : null;
    }
    if (saved?.type === "employee") {
      const employee = readEmployees().find((entry) => entry.id === saved.id && entry.status === "active" && entry.login);
      return employee && saved.credentialId === employee.salt
        ? { type: "employee", id: employee.id, name: employee.name, role: employee.role, permissions: employee.permissions || [], credentialId: employee.salt }
        : null;
    }
  } catch { /* Invalid session */ }
  return null;
}
