import {
  ONLINE_WINDOW_MS, PRESENCE_KEY, formatRelative, readPresence, reportError, reportHeartbeat, reportLogin,
  reportOffline, resolveTenantErrors, systemHealth, tenantLiveStatus,
} from "./tenantPresence";

const director = { type: "director", name: "Direktor" };

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-15T09:00:00Z"));
});
afterEach(() => jest.useRealTimers());

test("hech qachon kirmagan mijoz 'never' holatida", () => {
  expect(tenantLiveStatus(undefined).state).toBe("never");
});

test("kirgandan keyin onlayn, signal to'xtasa offline bo'ladi", () => {
  reportLogin("t1", director);
  let status = tenantLiveStatus(readPresence().t1, Date.now());
  expect(status.state).toBe("online");
  expect(status.lastLoginBy.role).toBe("Direktor");

  jest.advanceTimersByTime(ONLINE_WINDOW_MS + 1000);
  status = tenantLiveStatus(readPresence().t1, Date.now());
  expect(status.state).toBe("offline");

  reportHeartbeat("t1", director);
  expect(tenantLiveStatus(readPresence().t1, Date.now()).state).toBe("online");
});

test("chiqqanda darhol offline bo'ladi", () => {
  reportLogin("t1", director);
  jest.advanceTimersByTime(1000);
  reportOffline("t1");
  expect(tenantLiveStatus(readPresence().t1, Date.now()).state).toBe("offline");
});

test("bir xil xato birlashtiriladi, hal qilingani ochiqlar ro'yxatidan chiqadi", () => {
  reportError("t1", { message: "Yuklanmadi" });
  reportError("t1", { message: "Yuklanmadi" });
  reportError("t1", { message: "Boshqa xato" });
  let errors = tenantLiveStatus(readPresence().t1).openErrors;
  expect(errors).toHaveLength(2);
  expect(errors.find((error) => error.message === "Yuklanmadi").count).toBe(2);

  resolveTenantErrors("t1", errors[0].id);
  expect(tenantLiveStatus(readPresence().t1).openErrors).toHaveLength(1);
  resolveTenantErrors("t1");
  expect(tenantLiveStatus(readPresence().t1).openErrors).toHaveLength(0);
});

test("buzilgan saqlangan ma'lumot xatoga olib kelmaydi", () => {
  localStorage.setItem(PRESENCE_KEY, "{buzilgan");
  expect(readPresence()).toEqual({});
  expect(() => reportHeartbeat("t1", director)).not.toThrow();
});

test("tizim holati: barqaror, xatolik bor, ishlamayapti", () => {
  expect(systemHealth({ openErrorCount: 0, onlineCount: 1, tenantCount: 2 })).toMatchObject({ level: "ok", title: "Tizimlar barqaror ishlayapti" });
  expect(systemHealth({ openErrorCount: 3, onlineCount: 1, tenantCount: 2 })).toMatchObject({ level: "warning", title: "3 ta xatolik bor" });
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(systemHealth({ openErrorCount: 0, onlineCount: 0, tenantCount: 0 })).toMatchObject({ level: "down", title: "Tizim ishlamayapti" });
  spy.mockRestore();
});

test("nisbiy vaqt o'qiladigan ko'rinishda", () => {
  const now = Date.now();
  expect(formatRelative(new Date(now - 20 * 1000).toISOString(), now)).toBe("hozirgina");
  expect(formatRelative(new Date(now - 5 * 60 * 1000).toISOString(), now)).toBe("5 daqiqa oldin");
  expect(formatRelative(new Date(now - 3 * 60 * 60 * 1000).toISOString(), now)).toBe("3 soat oldin");
  expect(formatRelative(null)).toBe("—");
});
