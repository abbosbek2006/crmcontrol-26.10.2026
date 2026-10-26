import React, { useEffect, useRef, useState } from "react";
import { FilePenLine, Plus, Search, Pin, Trash2, Check, Pencil, ArrowLeft, ShoppingCart, Play, Save } from "lucide-react";
import { translateText as tx } from "../locales/translateText";
import { useLanguage } from "../context/LanguageContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { deleteSaleDraft, readSavedSaleDrafts, requestSaleDraftResume } from "../data/savedSaleDrafts";
import { formatCurrency } from "../data/currency";
import PosWorkspace from "./PosWorkspace";
import "./Drafts.css";
const KEY = "crm_notes_drafts_v1";
const DRAFT_POS_WORKSPACE = "crm_qoralama_pos_windows_v1";
const DRAFT_POS_PREFIX = "crm_qoralama_pos_draft_";
const read = () => { try { const data = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(data) ? data.filter(n => n && typeof n.id === "string" && typeof n.title === "string" && typeof n.body === "string") : []; } catch { return []; } };
const date = (value, lang) => new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }).format(new Date(value));
const capitalizeSearch = value => String(value).replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase("uz-UZ"));
export default function Drafts({ onBack, onNavigate }) {
  const { lang } = useLanguage();
  const [notes, setNotes] = useState(read);
  const [saleDrafts, setSaleDrafts] = useState(readSavedSaleDrafts);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingSale, setDeletingSale] = useState(null);
  const [saleMode, setSaleMode] = useState(false);
  const [canSaveTemporarily, setCanSaveTemporarily] = useState(false);
  const saleSaveActionRef = useRef(null);
  const toast = useToast();
  useEffect(() => {
    const refresh = () => setSaleDrafts(readSavedSaleDrafts());
    window.addEventListener("crm-saved-sale-drafts-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("crm-saved-sale-drafts-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const persist = next => { try { localStorage.setItem(KEY, JSON.stringify(next)); setNotes(next); return true; } catch { toast.error("Saqlanmadi", "Xotirada joy yetarli emas. Qoralamani nusxalab oling."); return false; } };
  const save = event => {
    event.preventDefault();
    if (!editor.title.trim() && !editor.body.trim()) return;
    const note = { ...editor, title: editor.title.trim() || "Sarlavhasiz qoralama", updatedAt: new Date().toISOString() };
    const next = notes.some(n => n.id === note.id) ? notes.map(n => n.id === note.id ? note : n) : [note, ...notes];
    if (persist(next)) { setEditor(null); toast.success("Qoralama saqlandi"); }
  };
  const searchTerm = query.trim().toLocaleLowerCase("uz-UZ");
  const visible = notes.filter(n => !searchTerm || (n.title + " " + n.body).toLocaleLowerCase("uz-UZ").includes(searchTerm)).sort((a,b) => a.title.localeCompare(b.title, "uz", { sensitivity: "base" }));
  const visibleSales = saleDrafts.filter(draft => !searchTerm || [draft.customerName, draft.customerPhone, ...(draft.cart || []).map(item => item.name)].join(" ").toLocaleLowerCase("uz-UZ").includes(searchTerm)).sort((a,b) => String(a.customerName || "").localeCompare(String(b.customerName || ""), "uz", { sensitivity: "base" }));
  const totalDrafts = notes.length + saleDrafts.length;
  const pinnedDrafts = notes.filter(note => note.pinned).length;
  const resumeSale = draft => {
    if (!requestSaleDraftResume({ ...draft, workspaceKey: DRAFT_POS_WORKSPACE, draftKeyPrefix: DRAFT_POS_PREFIX })) {
      toast.error("Sotuv ochilmadi", "Saqlangan sotuvni yuklash uchun xotirada joy yetarli emas.");
      return;
    }
    setSaleMode(true);
  };
  const saleDraftTotal = draft => {
    const subtotal = (draft.cart || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0) * (1 - Number(item.discount || 0) / 100), 0);
    return subtotal * (1 - Math.min(100, Math.max(0, Number(draft.globalDiscount || 0))) / 100);
  };
  const returnToList = () => {
    if (editor.title.trim() || editor.body.trim()) save({ preventDefault() {} });
    else setEditor(null);
  };
  if (saleMode) return <section className="drafts-page draft-sale-page">
    <div className="draft-sale-topbar"><button className="app-back-button" onClick={() => setSaleMode(false)}><ArrowLeft size={16}/>{tx("Qoralamalarga qaytish")}</button><button className="draft-sale-save-button" disabled={!canSaveTemporarily} title={tx(canSaveTemporarily ? "Savat va mijoz ma'lumotlarini vaqtincha saqlash" : "Mahsulot, mijoz ismi va telefon raqamini kiriting")} onClick={() => saleSaveActionRef.current?.()}><Save size={17}/>{tx("Vaqtincha saqlash")}</button></div>
    <div className="draft-sale-content app-pos-content">
      <PosWorkspace workspaceKey={DRAFT_POS_WORKSPACE} draftKeyPrefix={DRAFT_POS_PREFIX} migrateLegacyDraft={false} singleSaleMode saveDraftActionRef={saleSaveActionRef} onSaveAvailabilityChange={setCanSaveTemporarily} onSaleDraftSaved={() => setSaleMode(false)}/>
    </div>
  </section>;
  if (editor) return <section className="drafts-page draft-detail">
    <button className="app-back-button" onClick={returnToList}><ArrowLeft size={16}/>{tx("Qoralamalarga qaytish")}</button>
    <header className="drafts-heading"><div><span className="drafts-eyebrow">{tx("QORALAMA")}</span><h1>{editor.title || tx("Yangi qoralama")}</h1><p>{tx("Qaytganingizda yozuvingiz saqlanadi.")}</p></div></header>
    <form className="draft-editor draft-editor-page" onSubmit={save}><label>{tx("Sarlavha")}<input autoFocus maxLength={160} placeholder={tx("Qaydga nom bering...")} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })}/></label><label>{tx("Matn")}<textarea rows={14} placeholder={tx("Fikr yoki eslatmangizni yozing...")} value={editor.body} onChange={e => setEditor({ ...editor, body: e.target.value })}/></label><footer><span>{editor.body.length.toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ")} {tx("belgi")}</span><button className="btn-primary" disabled={!editor.title.trim() && !editor.body.trim()}><Check size={18}/>{tx("Saqlash")}</button></footer></form>
  </section>;
  return <section className="drafts-page"><button className="app-back-button" onClick={onBack}><ArrowLeft size={16}/>{tx("Orqaga")}</button>
    <header className="drafts-heading"><div><span className="drafts-eyebrow">{tx("SHAXSIY QAYDLAR")}</span><h1>{tx("Qoralama")}</h1></div></header>
    <div className="drafts-toolbar"><label><Search size={18}/><input aria-label={tx("Ism bo‘yicha qidirish")} placeholder={tx("Mijoz ismi yoki qoralama nomi bo‘yicha qidirish...")} value={query} onChange={e => setQuery(capitalizeSearch(e.target.value))}/></label><span>{totalDrafts} {tx("ta qoralama")} <i/> {pinnedDrafts} {tx("ta mahkamlangan")}</span></div>
    <div className="personal-drafts-heading"><h2 className="personal-drafts-title">{tx("Shaxsiy qoralamalar va sotuvlar")}</h2></div>
    <div className="drafts-overview">
      <div className="drafts-grid">
        <button className="draft-new-tile" onClick={() => setSaleMode(true)}>
          <span><Plus size={42} strokeWidth={1.5}/></span>
          <strong>{tx("Yangi sotuv")}</strong>
          <small>{tx("Mahsulotlarni tanlang yoki vaqtincha saqlang")}</small>
        </button>
        {visibleSales.map(draft => (
          <article className="saved-sale-draft saved-sale-draft-tile" key={`sale-${draft.id}`}>
            <div className="saved-sale-draft-top"><span><ShoppingCart size={16}/>{tx("Sotuv qoralamasi")}</span><time dateTime={draft.openedAt || draft.savedAt}>{date(draft.openedAt || draft.savedAt, lang)}</time></div>
            <div className="saved-sale-customer"><span className="saved-sale-avatar">{(draft.customerName || "M").slice(0, 1).toLocaleUpperCase("uz-UZ")}</span><div><h3>{draft.customerName || tx("Mijoz ko‘rsatilmagan")}</h3><p className="saved-sale-draft-phone">{draft.customerPhone ? `+998 ${String(draft.customerPhone).replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4")}` : tx("Telefon kiritilmagan")}</p></div></div>
            <div className="saved-sale-draft-products">{(draft.cart || []).slice(0, 2).map(item => <span key={item.cartKey || item.id}>{item.name} · {item.qty} {tx("dona")}</span>)}{draft.cart?.length > 2 && <span>+ {tx("yana")} {draft.cart.length - 2} {tx("xil mahsulot")}</span>}</div>
            <div className="saved-sale-draft-summary"><span>{tx("Jami summa")}</span><strong>{formatCurrency(saleDraftTotal(draft))}</strong></div>
            <footer><button className="saved-sale-delete" onClick={() => setDeletingSale(draft)}>{tx("O‘chirish")}</button><button className="saved-sale-resume" onClick={() => resumeSale(draft)}><Play size={15}/>{tx("Davom ettirish")}</button></footer>
          </article>
        ))}
        {visible.map(note => (
          <article className="draft-note" key={note.id}>
            <div className="draft-note-top">
              <span><FilePenLine size={17}/>{note.pinned ? tx("Mahkamlangan") : tx("Qoralama")}</span>
              <button aria-label={tx(note.pinned ? "Mahkamlashni bekor qilish" : "Mahkamlash")} aria-pressed={note.pinned} onClick={() => persist(notes.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n))}><Pin size={17}/></button>
            </div>
              <button className="draft-note-content" onClick={() => setEditor({ ...note })}>
              <h2>{note.title}</h2><p>{note.body || tx("Matn hali yozilmagan")}</p>
            </button>
            <footer>
              <time dateTime={note.updatedAt}>{date(note.updatedAt, lang)}</time>
              <div>
                <button aria-label={tx("Tahrirlash")} onClick={() => setEditor({ ...note })}><Pencil size={16}/></button>
                <button className="draft-delete" aria-label={tx("O‘chirish")} onClick={() => setDeleting(note)}><Trash2 size={16}/></button>
              </div>
            </footer>
          </article>
        ))}
      </div>
      {searchTerm && !visible.length && !visibleSales.length && <p className="draft-no-results">{tx("Mos qoralama yoki mijoz topilmadi.")}</p>}
    </div>
    <ConfirmDialog open={!!deleting} title="Qoralama o‘chirilsinmi?" message={deleting ? `“${deleting.title}” qaydini qayta tiklab bo‘lmaydi.` : ""} confirmLabel="O‘chirish" onCancel={() => setDeleting(null)} onConfirm={() => { if (persist(notes.filter(n => n.id !== deleting.id))) setDeleting(null); }}/>
    <ConfirmDialog open={!!deletingSale} title="Sotuv qoralamasi o‘chirilsinmi?" message={deletingSale ? `${deletingSale.customerName || "Mijoz ko‘rsatilmagan"} uchun saqlangan savat o‘chiriladi.` : ""} confirmLabel="O‘chirish" onCancel={() => setDeletingSale(null)} onConfirm={() => { if (deleteSaleDraft(deletingSale.id)) { setSaleDrafts(readSavedSaleDrafts()); setDeletingSale(null); } else toast.error("O‘chirilmadi", "Qayta urinib ko‘ring."); }}/>
  </section>;
}
