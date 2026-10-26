import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BellRing, Building2, CircleAlert, Crown, Headphones, HelpCircle, Link, LogOut, Menu, Pencil, Plus, Search, Send, Settings, ShieldCheck, TicketCheck, User, Users, X } from "lucide-react";
import { readAdminData, saveAdminData, tenantLink } from "./tenantStorage";
import SuperAdminSettings, { adminInitials } from "./SuperAdminSettings";
import { formatExact, formatRelative, formatShort, resolveTenantErrors, systemHealth, tenantLiveStatus, useLivePresence } from "./tenantPresence";
import "./superAdmin.css";
import "./superAdminEnhancements.css";
import "./superAdminExact.css";
import "./superAdminScroll.css";
import "./superAdminCompact.css";
import "./superAdminMobile.css";
import "./superAdminLive.css";
import "./superAdminBrand.css";

const now = () => new Date().toISOString();
// Faqat harf/raqamlardan bosh harf olinadi: "Sam (filial)" -> "SF", qavs yoki belgi emas.
const initials = (name) => String(name || "").split(/\s+/).map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] || "").join("").slice(0, 2).toLocaleUpperCase("uz-UZ") || "?";

export default function SuperAdminPanel({ onLogout }) {
  const [data, setData] = useState(readAdminData); const [tab, setTab] = useState("panel"); const [tabHistory, setTabHistory] = useState([]); const [sidebarOpen, setSidebarOpen] = useState(false); const [form, setForm] = useState(false); const [supportTicketId, setSupportTicketId] = useState(""); const [newMessageModal, setNewMessageModal] = useState(() => { const saved = readAdminData(); return saved.preferences.messagePopup && saved.tickets.some((ticket) => ticket.unread); });
  const [editingTenant, setEditingTenant] = useState(null); const [companyNameDraft, setCompanyNameDraft] = useState("");
  const [draft, setDraft] = useState(() => ({ name: "", domain: "", phone: "" })); const [copied, setCopied] = useState(""); const [query, setQuery] = useState("");
  const tenants = data.tenants;
  // Jonli holat: har 5 soniyada va mijoz tabidagi o'zgarishda yangilanadi.
  const { presence, now: clock, refresh: refreshPresence } = useLivePresence();
  const live = useMemo(() => Object.fromEntries(tenants.map((tenant) => [tenant.id, tenantLiveStatus(presence[tenant.id], clock)])), [tenants, presence, clock]);
  const online = tenants.filter((tenant) => live[tenant.id]?.state === "online").length;
  const save = (next) => { setData(next); saveAdminData(next); };
  useEffect(() => {
    const refreshMessages = () => setData(readAdminData());
    const interval = window.setInterval(refreshMessages, 1500);
    window.addEventListener("storage", refreshMessages);
    return () => { window.clearInterval(interval); window.removeEventListener("storage", refreshMessages); };
  }, []);
  const addTenant = (event) => { event.preventDefault(); if (!draft.name.trim()) return; const tenant = { ...draft, id: crypto.randomUUID(), invite: crypto.randomUUID(), status: "online", createdAt: now(), lastSeen: now(), errors: [] }; save({ ...data, tenants: [tenant, ...tenants] }); setDraft({ name: "", domain: "", phone: "" }); setForm(false); setTab("clients"); };
  const openTenantEditor = (tenant) => { setEditingTenant(tenant); setCompanyNameDraft(tenant.name || ""); };
  const updateTenantCompanyName = (event) => { event.preventDefault(); const name = companyNameDraft.trim(); if (!editingTenant || !name) return; save({ ...data, tenants: data.tenants.map((tenant) => tenant.id === editingTenant.id ? { ...tenant, name } : tenant) }); setEditingTenant(null); };
  const copy = async (tenant) => { await navigator.clipboard?.writeText(tenantLink(tenant)); setCopied(tenant.id); setTimeout(() => setCopied(""), 1600); };
  const alerts = useMemo(() => tenants.flatMap((tenant) => [
    ...(live[tenant.id]?.openErrors || []).map((error) => ({ ...error, tenant })),
    ...(tenant.errors || []).map((error, index) => ({ id: `legacy-${index}`, legacy: true, ...error, tenant })),
  ]).sort((a, b) => new Date(b.lastAt || b.at || 0) - new Date(a.lastAt || a.at || 0)), [tenants, live]);
  // Javob kutayotgan murojaatlar: oxirgi xabar mijozdan kelgan bo'lsa.
  const openTickets = data.tickets.filter((ticket) => { const last = (ticket.messages || []).at(-1); return last ? last.sender === "customer" : Boolean(ticket.unread); }).length;
  const health = systemHealth({ openErrorCount: alerts.length, onlineCount: online, tenantCount: tenants.length, now: clock });
  const resolveAlert = (alert) => { if (alert.legacy) save({ ...data, tenants: tenants.map((tenant) => tenant.id === alert.tenant.id ? { ...tenant, errors: [] } : tenant) }); else { resolveTenantErrors(alert.tenant.id, alert.id); refreshPresence(); } };
  const unreadTickets = data.tickets.filter((ticket) => ticket.unread); const unreadMessages = unreadTickets.length; const latestUnread = [...unreadTickets].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0]; const latestCustomerName = latestUnread ? (tenants.find((tenant) => tenant.id === latestUnread.tenantId)?.name || latestUnread.customerName || "Mijoz") : "Mijoz";
  const visibleTenants = tenants.filter((tenant) => `${tenant.name} ${tenant.domain || ""} ${tenant.phone || ""}`.toLocaleLowerCase("uz-UZ").includes(query.toLocaleLowerCase("uz-UZ")));
  const navigateTab = (nextTab) => { if (nextTab !== tab) { setTabHistory((items) => [...items, tab]); setTab(nextTab); } };
  const goBack = () => { const previous = tabHistory.at(-1); if (previous) { setTab(previous); setTabHistory((items) => items.slice(0, -1)); } else { onLogout(); } };
  const closeSidebar = () => setSidebarOpen(false);
  const selectTab = (nextTab) => { navigateTab(nextTab); window.setTimeout(closeSidebar, 170); }; const openNewMessage = () => { if (!latestUnread) return; save({ ...data, tickets: data.tickets.map((ticket) => ticket.id === latestUnread.id ? { ...ticket, unread: false } : ticket) }); setSupportTicketId(latestUnread.id); setNewMessageModal(false); navigateTab("support"); };
  const nav = [["panel", "Boshqaruv paneli", Crown], ["monitor", "Live Monitoring", Activity], ["clients", "Barcha mijozlar", Users], ["support", "Yordam markazi", Headphones], ["settings", "Sozlamalar", Settings]];
  const idleMinutes = data.preferences.idleMinutes; const titleBadge = data.preferences.titleBadge;
  // Sozlamalarda tanlangan vaqt davomida harakat bo'lmasa, avtomatik chiqish.
  useEffect(() => {
    const limit = idleMinutes * 60 * 1000; let timer = window.setTimeout(onLogout, limit);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(onLogout, limit); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)); };
  }, [idleMinutes, onLogout]);
  // Brauzer tab nomida o'qilmagan xabarlar soni.
  useEffect(() => {
    const original = document.title;
    document.title = titleBadge && unreadMessages > 0 ? `(${unreadMessages > 99 ? "99+" : unreadMessages}) Control Center` : "Control Center";
    return () => { document.title = original; };
  }, [titleBadge, unreadMessages]);
  return <div className={`sa-layout ${sidebarOpen ? "sidebar-open" : ""}`}><aside className={sidebarOpen ? "is-open" : ""}><button type="button" className="sa-sidebar-close" aria-label="Menyuni yopish" onClick={closeSidebar}><X size={20}/></button><div className="sa-brand"><Crown /> CONTROL CENTER</div><nav>{nav.map(([id, label, Icon]) => <button key={id} onClick={() => selectTab(id)} className={tab === id ? "active" : ""}><Icon size={18}/>{label}</button>)}</nav><div className="sa-side-bottom"><button type="button" className="sa-side-help" onClick={() => navigateTab("support")}><HelpCircle size={16}/>Yordam</button><div className="sa-side-status"><i/>Tizim ishlayapti</div><div className="sa-admin-profile"><span className="sa-admin-avatar" aria-hidden="true">{adminInitials(data.profile.name)}</span><div><b>{data.profile.name || "Super Administrator"}</b><small>Super Admin</small></div><button type="button" aria-label="Hisobdan chiqish" title="Hisobdan chiqish" onClick={onLogout}><LogOut size={15}/></button></div></div></aside>{sidebarOpen && <button type="button" className="sa-sidebar-backdrop is-open" aria-label="Menyuni yopish" onClick={closeSidebar}/>}<div className="sa-content"><header><div><h1><Crown size={24}/> Super Admin</h1><p>Barcha mijoz CRM tizimlari sizning nazoratingizda</p></div><div className="sa-header-tools"><button type="button" className="sa-menu-toggle" aria-label="Menyuni ochish" onClick={() => setSidebarOpen(true)}><Menu size={21}/></button><label className="sa-search"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mijoz, domen yoki telefon bo'yicha qidiring..."/><kbd>⌘ K</kbd></label><button type="button" className="sa-primary sa-add-client" onClick={() => setForm(true)} aria-label="Yangi mijoz qo‘shish" title="Yangi mijoz qo‘shish"><span className="sa-add-icons" aria-hidden="true"><Plus size={13} strokeWidth={3}/><User size={17} strokeWidth={2.2}/></span><span className="sa-add-text">Yangi mijoz</span></button><button type="button" className="sa-bell" aria-label={`${unreadMessages} ta yangi xabar`} onClick={() => navigateTab("support")}><BellRing size={21}/>{unreadMessages > 0 && <i>{unreadMessages > 99 ? "99+" : unreadMessages}</i>}</button></div></header><main>{tab === "panel" && <Dashboard tenants={visibleTenants} total={tenants.length} online={online} alerts={alerts} openTickets={openTickets} health={health} live={live} clock={clock} onTab={navigateTab} onBack={goBack} onCopy={copy} copied={copied} onEditTenant={openTenantEditor}/>} {tab === "clients" && <Clients tenants={visibleTenants} live={live} clock={clock} onCopy={copy} copied={copied} onEditTenant={openTenantEditor}/>} {tab === "monitor" && <Monitoring tenants={visibleTenants} alerts={alerts} live={live} clock={clock} health={health} onResolve={resolveAlert}/>} {tab === "support" && <Support data={data} save={save} ticketId={supportTicketId}/>} {tab === "settings" && <SuperAdminSettings data={data} save={save} onBack={goBack}/>}</main></div>{form && <div className="sa-modal"><form onSubmit={addTenant}><button type="button" className="sa-close" onClick={() => setForm(false)}>×</button><h2>Yangi mijoz qo‘shish</h2><p>Mijoz uchun alohida, toza CRM maydoni yaratiladi.</p><label>Kompaniya nomi<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label><label>Domen yoki izoh<input value={draft.domain} onChange={(e) => setDraft({ ...draft, domain: e.target.value })}/></label><label>Telefon<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })}/></label><button className="sa-primary"><Send size={17}/> Taklif yaratish</button></form></div>}{editingTenant && <div className="sa-modal"><form onSubmit={updateTenantCompanyName}><button type="button" className="sa-close" onClick={() => setEditingTenant(null)}>×</button><h2>Kompaniya nomini tahrirlash</h2><p>Bu nom direktor va xodimlar interfeysi hamda chek hujjatlarida chiqadi.</p><label>Kompaniya nomi<input required autoFocus value={companyNameDraft} onChange={(event) => setCompanyNameDraft(event.target.value)}/></label><button className="sa-primary"><Pencil size={16}/> Saqlash</button></form></div>}{newMessageModal && latestUnread && <NewMessageModal customerName={latestCustomerName} count={unreadMessages} onClose={() => setNewMessageModal(false)} onOpen={openNewMessage}/>}</div>;
}

function NewMessageModal({ customerName, count, onClose, onOpen }) { return <div className="sa-new-message-modal" role="dialog" aria-modal="true" aria-labelledby="sa-new-message-title"><div className="sa-new-message-card"><button className="sa-new-message-close" type="button" aria-label="Bildirishnomani yopish" onClick={onClose}><X size={19}/></button><div className="sa-new-message-icon"><Headphones size={26}/><i/></div><span className="sa-new-message-kicker">YANGI YORDAM XABARI</span><h2 id="sa-new-message-title">Sizga yangi xabar keldi</h2><p><b>{customerName}</b> yordam markazi orqali sizga xabar yubordi.</p>{count > 1 && <span className="sa-new-message-count">Yana {count - 1} ta o‘qilmagan xabar bor</span>}<div className="sa-new-message-actions"><button type="button" className="sa-new-message-later" onClick={onClose}>Keyinroq</button><button type="button" className="sa-primary" onClick={onOpen}><Headphones size={17}/> Xabarni ko‘rish</button></div></div></div>; }

function Support({ data, save, ticketId }) {
  const [selectedId, setSelectedId] = useState(ticketId || ""); const [reply, setReply] = useState("");
  const tickets = [...data.tickets].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const selected = tickets.find((ticket) => ticket.id === selectedId);
  const messages = selected?.messages || (selected?.message ? [{ id: selected.id, sender: "customer", text: selected.message, createdAt: selected.createdAt }] : []);
  const customerName = (ticket) => data.tenants.find((tenant) => tenant.id === ticket.tenantId)?.name || ticket.customerName || "Mijoz";
  const open = (ticket) => { setSelectedId(ticket.id); if (ticket.unread) save({ ...data, tickets: data.tickets.map((item) => item.id === ticket.id ? { ...item, unread: false } : item) }); };
  const send = (event) => { event.preventDefault(); if (!reply.trim() || !selected) return; const timestamp = now(), message = { id: crypto.randomUUID(), sender: "admin", text: reply.trim(), createdAt: timestamp }; save({ ...data, tickets: data.tickets.map((ticket) => ticket.id === selected.id ? { ...ticket, messages: [...(ticket.messages || []), message], updatedAt: timestamp, unread: false } : ticket) }); setReply(""); };
  return <section className="sa-support"><article className="sa-card sa-support-list"><div className="sa-card-title"><div><Headphones/> Yordam xabarlari</div><span>{tickets.filter((ticket) => ticket.unread).length} yangi</span></div>{tickets.length ? tickets.map((ticket) => { const last = (ticket.messages || []).at(-1)?.text || ticket.message || ""; return <button type="button" className={`sa-conversation ${selected?.id === ticket.id ? "selected" : ""}`} onClick={() => open(ticket)} key={ticket.id}><span className="sa-avatar">{initials(customerName(ticket))}</span><span><b>{customerName(ticket)} {ticket.unread && <em>Yangi</em>}</b><small>{last}</small></span><time>{new Date(ticket.updatedAt || ticket.createdAt).toLocaleString("uz-UZ")}</time></button>; }) : <div className="sa-empty">Hozircha yordam so‘rovi yo‘q.</div>}</article><article className="sa-card sa-support-chat">{selected ? <><div className="sa-card-title"><div><Headphones/> {customerName(selected)}</div><small>{selected.tenantId}</small></div><div className="sa-admin-messages">{messages.map((message) => <div className={`sa-admin-message ${message.sender === "admin" ? "admin" : "customer"}`} key={message.id}><span>{message.text}</span><small>{new Date(message.createdAt).toLocaleString("uz-UZ")}</small></div>)}</div><form onSubmit={send}><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Mijozga javob yozing..."/><button className="sa-primary"><Send size={16}/> Yuborish</button></form></> : <div className="sa-empty"><Headphones size={28}/><p>Chatni boshlash uchun xabarni tanlang.</p></div>}</article></section>;
}

function Stat({ icon: Icon, label, value, tone, onClick, hint }) {
  const body = <><span className={tone}><Icon size={21}/></span><div><small>{label}</small><strong>{value}</strong></div></>;
  return onClick ? <button type="button" className="sa-stat sa-stat-link" onClick={onClick} title={hint} aria-label={`${label}: ${value}. ${hint || ""}`}>{body}</button> : <article className="sa-stat">{body}</article>;
}

function SystemState({ health }) {
  return <div className={`sa-system-state is-${health.level}`} role="status" aria-live="polite"><span/>{health.title}<small>{health.detail}</small></div>;
}

function LiveBadge({ status }) {
  const label = status.state === "online" ? "Online" : status.state === "offline" ? "Offline" : "Kirmagan";
  return <span className={`sa-live is-${status.state}`}><i aria-hidden="true"/>{label}{status.openErrors.length > 0 && <em title="Hal qilinmagan xatoliklar">{status.openErrors.length} xato</em>}</span>;
}

function LastActivity({ status, clock }) {
  if (status.state === "never") return <span className="sa-last"><b>—</b><small>Hali kirilmagan</small></span>;
  const who = status.activeUser || status.lastLoginBy;
  const login = status.lastLoginAt ? `Kirish: ${formatShort(status.lastLoginAt)}${who ? ` · ${who.name}` : ""}` : "";
  return <span className="sa-last" title={`Oxirgi faollik: ${formatExact(status.lastSeen)}${status.lastLoginAt ? `\nOxirgi kirish: ${formatExact(status.lastLoginAt)}${who ? ` (${who.name}, ${who.role})` : ""}` : ""}`}><b>{formatRelative(status.lastSeen, clock)}</b>{login && <small>{login}</small>}</span>;
}

const NEVER = { state: "never", openErrors: [] };

function Dashboard({ tenants, total, online, alerts, openTickets, health, live, clock, onTab, onBack, onCopy, copied, onEditTenant }) {
  return <><section className="sa-heading"><button className="app-back-button sa-back" type="button" onClick={onBack}><ArrowLeft size={17}/> Orqaga</button><div><h2>Control Center</h2><p>Mijozlar, holat va qo‘llab-quvvatlashni shu yerdan boshqaring.</p></div><SystemState health={health}/></section><section className="sa-stats"><Stat icon={Users} label="Jami mijozlar" value={total} tone="blue" onClick={() => onTab("clients")} hint="Barcha mijozlarni ochish"/><Stat icon={Activity} label="Onlayn CRM" value={online} tone="green" onClick={() => onTab("monitor")} hint="Live Monitoring'ni ochish"/><Stat icon={CircleAlert} label="Ochiq muammolar" value={alerts.length} tone="red" onClick={() => onTab("monitor")} hint="Xatoliklarni ko'rish"/><Stat icon={TicketCheck} label="Support ticket" value={openTickets} tone="violet" onClick={() => onTab("support")} hint="Javob kutayotgan murojaatlar"/></section><section className="sa-grid"><article className="sa-card sa-wide"><div className="sa-card-title"><div><Activity/> <span>CRM Health<small>Barcha mijozlar holati va faolliyatini kuzating</small></span></div><button onClick={() => onTab("monitor")}>Barchasini ko‘rish →</button></div><TenantTable tenants={tenants} live={live} clock={clock} onCopy={onCopy} copied={copied} onEditTenant={onEditTenant}/></article><article className="sa-card sa-security"><div className="sa-card-title"><div><ShieldCheck/> <span>Xavfsizlik<small>Mijoz ma’lumotlaringiz himoyada</small></span></div></div><div className="sa-security-mark"><ShieldCheck size={54}/></div><p>Har bir mijoz ma’lumotlari maxsus ajratilgan saqlash maydonida ishlaydi.</p><p className="sa-good">● Ma’lumotlar ajratilgan</p><p className="sa-good">● Taklif havolalari faqat bir mijozga tegishli</p></article></section></>;
}

function Clients({ tenants, live, clock, onCopy, copied, onEditTenant }) { return <section className="sa-card"><div className="sa-card-title"><div><Building2/> Mijozlar</div><span>{tenants.length} ta</span></div><TenantTable tenants={tenants} live={live} clock={clock} onCopy={onCopy} copied={copied} onEditTenant={onEditTenant} full/></section>; }

function TenantTable({ tenants, live, clock, onCopy, copied, onEditTenant }) { return tenants.length ? <div className="sa-table-wrap"><table><thead><tr><th>Mijoz</th><th>Holat</th><th>Oxirgi faollik</th><th>Taklif havolasi</th></tr></thead><tbody>{tenants.map((tenant) => { const status = live[tenant.id] || NEVER; return <tr key={tenant.id}><td><span className="sa-avatar">{initials(tenant.name)}</span><b>{tenant.name}</b><button type="button" className="sa-tenant-edit" onClick={() => onEditTenant(tenant)} aria-label="Brend nomini tahrirlash" title="Kompaniya nomini tahrirlash"><Pencil size={14}/></button><small>{tenant.domain || tenant.phone || "—"}</small></td><td><LiveBadge status={status}/></td><td><LastActivity status={status} clock={clock}/></td><td><button className="sa-copy" onClick={() => onCopy(tenant)}><Link size={15}/>{copied === tenant.id ? "Nusxalandi" : "Havolani nusxalash"}</button></td></tr>; })}</tbody></table></div> : <div className="sa-empty"><Building2 size={26}/><p>Hozircha mijoz yo‘q. “Yangi mijoz” tugmasi orqali taklif yarating.</p></div>; }

function Monitoring({ tenants, alerts, live, clock, health, onResolve }) {
  return <section className="sa-grid"><article className="sa-card sa-wide"><div className="sa-card-title"><div><Activity/> <span>Live Monitoring<small>Har 5 soniyada avtomatik yangilanadi</small></span></div><SystemState health={health}/></div>{tenants.length ? tenants.map((tenant) => { const status = live[tenant.id] || NEVER; const who = status.activeUser || status.lastLoginBy; return <div className="sa-monitor" key={tenant.id}><div className="sa-monitor-name"><b>{tenant.name}</b><small>{tenant.domain || tenant.phone || "—"}</small></div><LiveBadge status={status}/><span className="sa-monitor-meta"><small>Oxirgi faollik</small>{status.state === "never" ? "—" : formatRelative(status.lastSeen, clock)}</span><span className="sa-monitor-meta"><small>Oxirgi kirish</small>{status.lastLoginAt ? `${formatRelative(status.lastLoginAt, clock)}${who ? ` · ${who.name || who.role}` : ""}` : "—"}</span></div>; }) : <div className="sa-empty">Monitoring uchun mijoz qo‘shing.</div>}</article><article className="sa-card"><div className="sa-card-title"><div><BellRing/> Xatoliklar</div><span>{alerts.length} ta</span></div>{alerts.length ? <div className="sa-alert-list">{alerts.map((alert) => <div key={`${alert.tenant.id}-${alert.id}`} className="sa-alert"><div><b>{alert.tenant.name}</b><p>{alert.message}</p><small>{alert.lastAt || alert.at ? formatRelative(alert.lastAt || alert.at, clock) : ""}{alert.count > 1 ? ` · ${alert.count} marta` : ""}</small></div><button type="button" onClick={() => onResolve(alert)}>Hal qilindi</button></div>)}</div> : <div className="sa-empty">Xatoliklar yo‘q. Tizim barqaror.</div>}</article></section>;
}
