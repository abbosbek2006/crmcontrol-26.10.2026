import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X, CircleAlert, ShoppingBag } from "lucide-react";
import POS from "./POS";
import Modal from "../components/Modal";
import { readPosDraft, POS_DRAFT_KEY, phoneDigits } from "./posHelpers";
import { translateText as tx } from "../locales/translateText";
import "./PosWorkspace.css";
import { formatCurrency } from "../data/currency";
import { saveSaleDraft, readSaleDraftResume, clearSaleDraftResume } from "../data/savedSaleDrafts";
const createTab = (number, openedAt = new Date().toISOString()) => ({ id: crypto.randomUUID(), number, customerName: "", customerPhone: "", count: 0, openedAt });
const restore = (workspaceKey, draftPrefix, migrateLegacyDraft) => {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(workspaceKey) || "null"); } catch {}
  if (!saved?.tabs?.length || !saved.tabs.every((tab) => typeof tab.id === "string")) {
    const tab = createTab(1);
    saved = { tabs: [tab], active: tab.id, next: 2 };
    if (migrateLegacyDraft) {
    const legacy = readPosDraft();
    if (legacy.cart?.length || legacy.customerName) { localStorage.setItem(draftPrefix + tab.id, JSON.stringify(legacy)); localStorage.removeItem(POS_DRAFT_KEY); tab.customerName = legacy.customerName || ""; tab.count = legacy.cart?.length || 0; }
    }
  }
  saved = { ...saved, tabs: saved.tabs.map(tab => ({ ...tab, customerPhone: tab.customerPhone || "", openedAt: tab.openedAt || new Date().toISOString() })), next: Number(saved.next) || 2 };
  const pending = readSaleDraftResume();
  if (pending?.workspaceKey === workspaceKey) {
    const tabNumber = Math.max(saved.next, ...saved.tabs.map(tab => Number(tab.number) || 0), 0);
    const tab = createTab(tabNumber, pending.openedAt || pending.savedAt || new Date().toISOString());
    try {
      localStorage.setItem(draftPrefix + tab.id, JSON.stringify(pending.posDraft));
      clearSaleDraftResume();
      tab.customerName = pending.customerName || "";
      tab.count = pending.cart?.length || 0;
      return { ...saved, tabs: [...saved.tabs, tab], active: tab.id, next: tab.number + 1 };
    } catch { /* Keep the pending resume record so it can be retried. */ }
  }
  return saved;
};
export default function PosWorkspace({ workspaceKey = "crm_pos_windows", draftKeyPrefix = "crm_pos_draft_", migrateLegacyDraft = true, singleSaleMode = false, saveDraftActionRef: externalSaveDraftActionRef, onSaveAvailabilityChange, onSaleDraftSaved, ...posProps }) {
  const [state, setState] = useState(() => restore(workspaceKey, draftKeyPrefix, migrateLegacyDraft));
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(null);
  const localSaveDraftActionRef = useRef(null);
  const saveDraftActionRef = externalSaveDraftActionRef || localSaveDraftActionRef;
  const active = state.tabs.find((tab) => tab.id === state.active) || state.tabs[0];
  const canSaveTemporarily = Boolean(active.count > 0 && active.customerName?.trim() && phoneDigits(active.customerPhone).length === 9);
  useEffect(() => { onSaveAvailabilityChange?.(canSaveTemporarily); }, [canSaveTemporarily, onSaveAvailabilityChange]);
  useEffect(() => { sessionStorage.setItem(workspaceKey, JSON.stringify(state)); }, [state, workspaceKey]);
  const draftKey = (id) => draftKeyPrefix + id;
  const updateDraft = useCallback((draft) => setState((previous) => ({ ...previous, tabs: previous.tabs.map((tab) => tab.id === previous.active ? { ...tab, ...draft } : tab) })), []);
  const saveWorkspaceDraft = useCallback((draft) => {
    const saved = saveSaleDraft({
      ...draft,
      posDraft: {
        cart: draft.cart,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        globalDiscount: draft.globalDiscount,
        deliveryAddress: draft.deliveryAddress,
        addresses: draft.addresses,
        selectedAddressId: draft.selectedAddressId,
        addressConfirmed: draft.addressConfirmed,
      },
      workspaceKey,
      draftKeyPrefix,
    });
    if (saved) {
      setState(previous => ({ ...previous, tabs: previous.tabs.map(tab => tab.id === previous.active ? { ...tab, customerName: "", customerPhone: "", count: 0, openedAt: new Date().toISOString() } : tab) }));
      onSaleDraftSaved?.();
    }
    return saved;
  }, [workspaceKey, draftKeyPrefix, onSaleDraftSaved]);
  const activate = (id) => { if (!busy) { posProps.onCartWindowChange?.(false); setState((previous) => ({ ...previous, active: id })); } };
  const add = () => { if (busy) return; const tab = createTab(state.tabs.length === 1 ? 2 : state.next); posProps.onCartWindowChange?.(false); setState((previous) => ({ tabs: [...previous.tabs, tab], active: tab.id, next: tab.number + 1 })); };
  const remove = (id) => {
    localStorage.removeItem(draftKey(id)); posProps.onCartWindowChange?.(false); setBusy(false);
    setState((previous) => { const tabs = previous.tabs.filter((tab) => tab.id !== id); if (!tabs.length) { const tab = createTab(1); return { tabs: [tab], active: tab.id, next: 2 }; } if (tabs.length === 1) return { tabs: [{ ...tabs[0], number: 1 }], active: tabs[0].id, next: 2 }; return { ...previous, tabs, active: previous.active === id ? tabs[0].id : previous.active }; }); setClosing(null);
  };
  const closingTab = state.tabs.find((tab) => tab.id === closing);
  const closingDraft = closing ? readPosDraft(draftKey(closing)) : {};
  const closingCart = closingDraft.cart || [];
  const closingTotal = closingCart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0) * (1 - Number(item.discount || 0) / 100), 0) * (1 - Math.min(100, Math.max(0, Number(closingDraft.globalDiscount || 0))) / 100);
  return <div className="pos-workspace">{!singleSaleMode && <div className="pos-window-bar"><div className="pos-window-tabs" role="tablist" aria-label={tx("Mijoz oynalari")}>{state.tabs.map((tab) => <div className={tab.id === active.id ? "pos-window-tab is-active" : "pos-window-tab"} key={tab.id}><button role="tab" aria-selected={tab.id === active.id} disabled={busy} onClick={() => activate(tab.id)}><span>{tab.customerName || tx("Mijoz") + " " + tab.number}</span><small>{tab.count} {tx("xil")}</small></button><button className="pos-window-close" disabled={busy} aria-label={tx("Oynani yopish")} onClick={() => setClosing(tab.id)}><X size={14} /></button></div>)}</div><button className="pos-window-new" disabled={busy} onClick={add}><Plus size={18}/><span>{tx("Yangi mijoz")}</span></button></div>}<POS key={active.id} {...posProps} draftKey={draftKey(active.id)} draftOpenedAt={active.openedAt} onDraftChange={updateDraft} onBusyChange={setBusy} onSaveSaleDraft={saveWorkspaceDraft} saveDraftActionRef={saveDraftActionRef} hideSaveDraftButton={singleSaleMode}/><Modal contentOnly open={!!closing} title={tx("Mijoz oynasi yopilsinmi?")} subtitle={tx("Yopishdan oldin savatchani tekshiring")} icon={CircleAlert} onClose={() => setClosing(null)} width={480}>
      <div className="pos-close-summary"><div className="pos-close-customer"><span className="pos-close-avatar">{(closingTab?.customerName || "M").slice(0, 1).toLocaleUpperCase("uz-UZ")}</span><div><small>{tx("Mijoz oynasi")}</small><strong>{closingTab?.customerName || tx("Mijoz") + " " + closingTab?.number}</strong>{closingDraft.customerPhone && <small>{closingDraft.customerPhone}</small>}</div></div><div className="pos-close-cart"><span><ShoppingBag size={16}/>{closingCart.length} {tx("xil mahsulot")}</span><strong>{formatCurrency(closingTotal)}</strong></div></div>
      <p className="pos-close-warning">{tx("Bu oynadagi savatcha va kiritilgan mijoz ma'lumotlari o'chiriladi. Boshqa mijoz oynalari saqlanadi.")}</p>
      <div className="pos-window-confirm"><button className="pos-close-keep" autoFocus onClick={() => setClosing(null)}>{tx("Savatchaga qaytish")}</button><button className="pos-close-discard" onClick={() => remove(closing)}>{tx("Ha, oynani yopish")}</button></div>
    </Modal></div>;
}
