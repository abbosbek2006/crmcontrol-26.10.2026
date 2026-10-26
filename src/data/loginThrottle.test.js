import { assertNotLocked, formatLockTime, getLockRemaining, lockDuration, recordFailure, recordSuccess } from "./loginThrottle";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T09:00:00Z"));
});

afterEach(() => jest.useRealTimers());

test("har bir xatodan keyin kutish vaqti jadval bo'yicha oshadi", () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8].map(lockDuration)).toEqual([
    5 * SECOND, 10 * SECOND, 30 * SECOND, MINUTE, 5 * MINUTE, 10 * MINUTE, 30 * MINUTE, HOUR,
  ]);
  expect(lockDuration(9)).toBe(2 * HOUR);
  expect(lockDuration(10)).toBe(4 * HOUR);
  expect(lockDuration(50)).toBe(24 * HOUR);
  expect(lockDuration(0)).toBe(0);
});

test("xatodan keyin blok qo'yiladi va vaqt tugagach ochiladi", () => {
  expect(getLockRemaining("crm")).toBe(0);
  recordFailure("crm");
  expect(getLockRemaining("crm")).toBe(5 * SECOND);
  expect(() => assertNotLocked("crm")).toThrow("00:05");

  jest.advanceTimersByTime(5 * SECOND);
  expect(getLockRemaining("crm")).toBe(0);
  expect(() => assertNotLocked("crm")).not.toThrow();

  recordFailure("crm");
  expect(getLockRemaining("crm")).toBe(10 * SECOND);
});

test("to'g'ri kirish hisobni nolga tushiradi", () => {
  recordFailure("crm");
  recordFailure("crm");
  recordSuccess("crm");
  expect(getLockRemaining("crm")).toBe(0);
  recordFailure("crm");
  expect(getLockRemaining("crm")).toBe(5 * SECOND);
});

test("24 soat xato bo'lmasa, bosqichlar boshidan boshlanadi", () => {
  recordFailure("crm");
  recordFailure("crm");
  recordFailure("crm");
  jest.advanceTimersByTime(25 * HOUR);
  recordFailure("crm");
  expect(getLockRemaining("crm")).toBe(5 * SECOND);
});

test("kirish oynalari bir-biridan alohida hisoblanadi", () => {
  recordFailure("super-admin");
  expect(getLockRemaining("super-admin")).toBe(5 * SECOND);
  expect(getLockRemaining("crm")).toBe(0);
});

test("buzilgan saqlangan ma'lumot xatoga olib kelmaydi", () => {
  localStorage.setItem("crm_login_throttle_v2", "{buzilgan");
  expect(getLockRemaining("crm")).toBe(0);
  expect(() => recordFailure("crm")).not.toThrow();
});

test("qolgan vaqt tugmada o'qiladigan ko'rinishda chiqadi", () => {
  expect(formatLockTime(5 * SECOND)).toBe("00:05");
  expect(formatLockTime(4 * SECOND + 200)).toBe("00:05");
  expect(formatLockTime(5 * MINUTE)).toBe("05:00");
  expect(formatLockTime(2 * HOUR)).toBe("2:00:00");
});
