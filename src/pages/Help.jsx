import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageCircle, Phone, Send, UserRound } from "lucide-react";
import { translateText as tx } from "../locales/translateText";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import "./Help.css";
import "./HelpResponsive.css";

const ADMIN_KEY = "super_admin_data_v1";
const PHONE = "+998 97 935 97 07";
const TELEGRAM = "https://t.me/burhanov123";
const getAdminData = () => { try { const value = JSON.parse(localStorage.getItem(ADMIN_KEY) || "{}"); return { ...value, tenants: Array.isArray(value.tenants) ? value.tenants : [], tickets: Array.isArray(value.tickets) ? value.tickets : [] }; } catch { return { tenants: [], tickets: [] }; } };
const getIdentity = () => { try { const profile = JSON.parse(localStorage.getItem("crm_profile") || "{}"); return profile.name || profile.fullName || profile.company || "CRM mijoz"; } catch { return "CRM mijoz"; } };
const tenantId = new URLSearchParams(window.location.search).get("tenant") || "local-crm";
const formatTime = (value) => new Date(value).toLocaleString("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Help() {
  useUILanguage();
  const [text, setText] = useState(""); const [refresh, setRefresh] = useState(0);
  const admin = useMemo(getAdminData, [refresh]);
  const thread = useMemo(() => admin.tickets.find((ticket) => String(ticket.tenantId) === String(tenantId)), [admin]);
  const messages = thread?.messages || (thread?.message ? [{ id: thread.id, sender: "customer", text: thread.message, createdAt: thread.createdAt }] : []);
  useEffect(() => { const timer = window.setInterval(() => setRefresh((value) => value + 1), 1800); return () => window.clearInterval(timer); }, []);

  // Sahifa ekrandagi haqiqiy joyini o'lchab, qolgan balandlikni aniq egallaydi: tepada "Orqaga"
  // tugmasi bo'lsa ham yozish maydoni ekrandan chiqib ketmaydi.
  const pageRef = useRef(null);
  const listRef = useRef(null);
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;
    const fit = () => {
      const main = page.closest("main");
      const top = page.getBoundingClientRect().top + (main?.scrollTop || 0);
      const bottom = main ? parseFloat(window.getComputedStyle(main).paddingBottom) || 0 : 0;
      page.style.setProperty("--support-top", `${Math.max(0, Math.round(top))}px`);
      page.style.setProperty("--support-bottom", `${Math.round(bottom)}px`);
    };
    fit();
    // Kirish animatsiyasi sahifani biroz siljitadi — tugagach qayta o'lchaymiz.
    const timer = window.setTimeout(fit, 450);
    page.addEventListener("animationend", fit);
    window.addEventListener("resize", fit);
    return () => { window.clearTimeout(timer); page.removeEventListener("animationend", fit); window.removeEventListener("resize", fit); };
  }, []);

  // Oxirgi xabar doim ko'rinsin: ochilganda va yangi xabar kelganda pastga tushadi. Foydalanuvchi
  // yuqoriga chiqib eski xabarni o'qiyotgan bo'lsa, admin javobi uni majburan tushirmaydi.
  const lastSender = messages[messages.length - 1]?.sender;
  const stickToBottom = useRef(true);
  const shownCount = useRef(0);
  const onListScroll = (event) => {
    const list = event.currentTarget;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const first = shownCount.current === 0;
    const grew = messages.length > shownCount.current;
    const mine = lastSender === "customer";
    let timer;
    if (first || (grew && (stickToBottom.current || mine))) {
      list.scrollTo({ top: list.scrollHeight, behavior: first ? "auto" : "smooth" });
      stickToBottom.current = true;
      // Silliq aylantirish yetib bormasa (masalan, oyna fonda), baribir oxiriga o'tamiz.
      if (!first) timer = window.setTimeout(() => { const el = listRef.current; if (el && stickToBottom.current) el.scrollTop = el.scrollHeight; }, 350);
    }
    shownCount.current = messages.length;
    return () => window.clearTimeout(timer);
  }, [messages.length, lastSender]);
  // Balandlik o'lchanib bo'lgach (yuqoridagi fit) ham oxiriga tushiramiz.
  useEffect(() => {
    const timer = window.setTimeout(() => { const list = listRef.current; if (list && stickToBottom.current) list.scrollTop = list.scrollHeight; }, 480);
    return () => window.clearTimeout(timer);
  }, []);
  const contact = (kind) => {
    const contactMessage = kind === "telegram" ? `Telegram: ${TELEGRAM}` : `Telefon: ${PHONE}`, now = new Date().toISOString(), next = { id: `contact-${Date.now()}`, sender: "system", text: contactMessage, createdAt: now };
    const base = getAdminData(), index = base.tickets.findIndex((ticket) => String(ticket.tenantId) === String(tenantId)), ticket = index >= 0 ? base.tickets[index] : { id: crypto.randomUUID(), tenantId, customerName: getIdentity(), createdAt: now, messages: [] };
    const updated = { ...ticket, messages: [...(ticket.messages || []), next], updatedAt: now, message: next.text }, tickets = index >= 0 ? base.tickets.map((item, itemIndex) => itemIndex === index ? updated : item) : [updated, ...base.tickets];
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...base, tickets })); setRefresh((value) => value + 1);
  };
  const send = (event) => {
    event.preventDefault(); const value = text.trim(); if (!value) return;
    const now = new Date().toISOString(), message = { id: crypto.randomUUID(), sender: "customer", text: value, createdAt: now, read: false }, base = getAdminData(), index = base.tickets.findIndex((ticket) => String(ticket.tenantId) === String(tenantId)), ticket = index >= 0 ? base.tickets[index] : { id: crypto.randomUUID(), tenantId, customerName: getIdentity(), createdAt: now, messages: [] };
    const updated = { ...ticket, customerName: ticket.customerName || getIdentity(), messages: [...(ticket.messages || []), message], message: value, updatedAt: now, unread: true }, tickets = index >= 0 ? base.tickets.map((item, itemIndex) => itemIndex === index ? updated : item) : [updated, ...base.tickets];
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...base, tickets })); setText(""); setRefresh((value) => value + 1);
  };
  return <div ref={pageRef} className="support-page fade-in"><section className="support-head"><div><h1>{tx("Yordam markazi")}</h1><p>{tx("Savolingizni yozing, administrator shu chat orqali javob beradi.")}</p></div></section><section className="support-layout"><aside className="support-quick"><h2>{tx("Tezkor bog'lanish")}</h2><p>{tx("Kerakli usulni tanlang")}</p><button type="button" onClick={() => contact("telegram")}><MessageCircle size={20}/><span><small>Telegram</small><b>{tx("Telegram orqali bog'lanish")}</b></span><ExternalLink size={16}/></button><button type="button" onClick={() => contact("phone")}><Phone size={20}/><span><small>{tx("Telefon")}</small><b>{tx("Telefon raqam orqali bog'lanish")}</b></span><ExternalLink size={16}/></button></aside><section className="support-chat"><header><div className="support-agent"><span><UserRound size={19}/></span><div><b>{tx("Qo'llab-quvvatlash xizmati")}</b><small>{tx("Administrator javobini kuting")}</small></div></div></header><div className="support-messages" ref={listRef} onScroll={onListScroll} role="log" aria-live="polite">{messages.length ? messages.map((message) => <div key={message.id} className={`support-message ${message.sender === "admin" ? "admin" : message.sender === "system" ? "system" : "customer"}`}><p>{message.sender === "system" ? tx(message.text) : message.text}</p><small>{formatTime(message.createdAt)}</small></div>) : <div className="support-empty"><MessageCircle size={28}/><b>{tx("Xush kelibsiz!")}</b><span>{tx("Savolingizni yozing yoki yuqoridan bog'lanish usulini tanlang.")}</span></div>}</div><form onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={tx("Xabaringizni yozing...")}/><button type="submit" aria-label={tx("Yuborish")}><Send size={18}/></button></form></section></section></div>;
}
