// Local UI adapter for the recovery screens. Backend integration can replace
// these functions without changing the screens:
// startRecovery, verifyRecoveryCode, resendRecoveryCode,
// finishRecoveryVerification, consumeRecoveryTicket, and cancelRecovery.
const DEMO_CODE = "123456";
// Demo kod (123456) faqat dev rejimda VA .env.local da REACT_APP_DEMO_RECOVERY=true bo'lsa ishlaydi.
// Aks holda tiklash backend ulanmaguncha o'chiq turadi.
const demoMode = process.env.NODE_ENV !== "production" && process.env.REACT_APP_DEMO_RECOVERY === "true";
const challenges = new Map();
const tickets = new Map();
const ensureDemoMode = () => { if (!demoMode) throw new Error("Backend parol tiklash xizmati hali ulanmagan."); };

export async function startRecovery({ tenantId, brand, email, phone }) {
  ensureDemoMode();
  const challengeId = crypto.randomUUID();
  challenges.set(challengeId, {
    tenantId, brand, email: email.toLowerCase(), phone,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: { email: 0, phone: 0 }, verified: { email: false, phone: false },
  });
  return { challengeId, expiresIn: 600, delivery: "demo" };
}

export async function verifyRecoveryCode({ challengeId, channel, code }) {
  ensureDemoMode();
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) {
    challenges.delete(challengeId);
    throw new Error("Tiklash jarayoni tugagan. Qaytadan boshlang.");
  }
  if (!["email", "phone"].includes(channel) || !/^\d{6}$/.test(code || "")) {
    throw new Error("6 xonali kodni kiriting.");
  }
  if (challenge.attempts[channel] >= 5) throw new Error("Urinishlar limiti tugadi. Tiklashni boshidan boshlang.");
  challenge.attempts[channel]++;
  if (code !== DEMO_CODE) throw new Error("Demo kod noto'g'ri. 123456 kodini kiriting.");
  challenge.verified[channel] = true;
  return { verified: true };
}

export async function resendRecoveryCode({ challengeId, channel }) {
  ensureDemoMode();
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) throw new Error("Tiklash jarayoni tugagan. Qaytadan boshlang.");
  if (!["email", "phone"].includes(channel)) throw new Error("Tasdiqlash usuli noto'g'ri.");
  challenge.verified[channel] = false;
  challenge.attempts[channel] = 0;
  return { sent: true, delivery: "demo" };
}

export async function finishRecoveryVerification({ challengeId, email, tenantId }) {
  ensureDemoMode();
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.tenantId !== tenantId || challenge.email !== email.toLowerCase() || !challenge.verified.email || !challenge.verified.phone) {
    throw new Error("Email va telefon tasdiqlanmagan. Tiklashni boshidan boshlang.");
  }
  challenges.delete(challengeId);
  const ticket = crypto.randomUUID();
  tickets.set(ticket, { email: challenge.email, tenantId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return { ticket, expiresIn: 300 };
}

export async function consumeRecoveryTicket({ ticket, email, tenantId }) {
  ensureDemoMode();
  const record = tickets.get(ticket);
  tickets.delete(ticket);
  if (!record || record.expiresAt < Date.now() || record.tenantId !== tenantId || record.email !== email.toLowerCase()) {
    throw new Error("Tiklash ruxsati yaroqsiz yoki muddati tugagan.");
  }
  return { authorized: true };
}

export async function cancelRecovery({ challengeId }) {
  if (!demoMode) return;
  challenges.delete(challengeId);
}

export const recoveryDemoCode = demoMode ? DEMO_CODE : "backend integratsiyasi kutilmoqda";
