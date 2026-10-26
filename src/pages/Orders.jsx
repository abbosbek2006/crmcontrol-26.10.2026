import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, ClipboardList, CreditCard, Package, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import { translateText as tx } from "../locales/translateText";
import { formatCurrency } from "../data/currency";
import { readOrders, removeOrder, reservedQuantities, saveOrder } from "../data/ordersStore";
import { requestSaleDraftResume } from "../data/savedSaleDrafts";
import { useToast } from "../context/ToastContext";
import POS from "./POS";
import ConfirmDialog from "../components/ConfirmDialog";
import "./Orders.css";

const orderDate = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";
const reservedCount = (order) => (order.cart || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
const orderAmountFontSize = (amount) => `${Math.max(11, 17 - Math.max(0, String(amount).length - 10) * 0.8)}px`;
const capitalizeSearchStart = (value) => value.replace(/^(\s*)(\S)/u, (_, spaces, first) => spaces + first.toLocaleUpperCase("uz-UZ"));
const normalizeOrderSearch = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[ʻʼ‘’`´]/g, "'")
  .toLocaleLowerCase("uz-UZ")
  .trim();

export default function Orders({ currentUser, onNavigate, onBackButtonVisibilityChange }) {
  useUILanguage();
  const toast = useToast();
  const [orders, setOrders] = useState(readOrders);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [canSave, setCanSave] = useState(false);
  const [cartWindowOpen, setCartWindowOpen] = useState(false);
  const saveActionRef = useRef(null);

  useEffect(() => {
    const refresh = () => setOrders(readOrders());
    window.addEventListener("crm-orders-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("crm-orders-updated", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  useEffect(() => {
    onBackButtonVisibilityChange?.(Boolean(editing));
    return () => onBackButtonVisibilityChange?.(false);
  }, [editing, onBackButtonVisibilityChange]);

  const searchTerm = normalizeOrderSearch(query);
  const visibleOrders = useMemo(() => {
    const searchTerms = searchTerm.split(/\s+/).filter(Boolean);
    return orders
      .filter((order) => order.status === "reserved")
      .filter((order) => {
        if (!searchTerms.length) return true;
        const searchable = normalizeOrderSearch([order.orderNumber, order.customerName, order.customerPhone, ...(order.cart || []).map((item) => item.name)].join(" "));
        return searchTerms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => String(a.customerName || "").localeCompare(String(b.customerName || ""), "uz-UZ", { sensitivity: "base", numeric: true })
        || String(a.orderNumber || a.id || "").localeCompare(String(b.orderNumber || b.id || ""), "uz-UZ", { numeric: true }));
  }, [orders, searchTerm]);
  const reserved = useMemo(() => reservedQuantities(null, orders), [orders]);
  const reservedUnits = Object.values(reserved).reduce((sum, value) => sum + Number(value || 0), 0);
  const reservedTotal = orders.filter((order) => order.status === "reserved").reduce((sum, order) => sum + Number(order.total || 0), 0);

  const startNew = () => {
    setCanSave(false);
    setCartWindowOpen(false);
    setEditing({ id: null, customerName: "", customerPhone: "", cart: [], globalDiscount: 0, addresses: [], deliveryAddress: "", orderNumber: "", createdAt: new Date().toISOString(), openedAt: new Date().toISOString() });
  };
  const startEdit = (order) => {
    setCanSave(false);
    setCartWindowOpen(false);
    setEditing(order);
  };
  const leaveEditor = () => {
    setEditing(null);
    setCanSave(false);
    setCartWindowOpen(false);
    setOrders(readOrders());
  };
  const persistOrder = useCallback((order) => {
    if (!saveOrder(order)) {
      toast.error("Buyurtma saqlanmadi", "Qayta urinib ko‘ring.");
      return false;
    }
    setOrders(readOrders());
    setEditing(null);
    setCanSave(false);
    return true;
  }, [toast]);
  const cancelOrder = () => {
    if (deleting && removeOrder(deleting.id)) {
      setOrders(readOrders());
      toast.success("Buyurtma bekor qilindi", "Band qilingan mahsulotlar yana sotuvga ochiq.");
    } else if (deleting) toast.error("Buyurtma bekor qilinmadi", "Qayta urinib ko‘ring.");
    setDeleting(null);
  };
  const convertToSale = (order) => {
    const resumed = requestSaleDraftResume({
      ...order,
      workspaceKey: "crm_pos_windows",
      draftKeyPrefix: "crm_pos_draft_",
      posDraft: {
        cart: order.cart,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        globalDiscount: order.globalDiscount,
        deliveryAddress: order.deliveryAddress,
        addresses: order.addresses,
        selectedAddressId: order.selectedAddressId,
        addressConfirmed: order.addressConfirmed,
        sourceOrderId: order.id,
      },
    });
    if (!resumed) { toast.error("Sotuv oynasi ochilmadi", "Qayta urinib ko‘ring."); return; }
    onNavigate?.("sales-new");
  };

  if (editing) {
    const editKey = editing.id || editing.openedAt;
    return (
      <section className="orders-page orders-editor-page">
        <header className="orders-editor-topbar">
          <button type="button" className="app-back-button" onClick={leaveEditor}><ArrowLeft size={16} />{tx("Buyurtmalarga qaytish")}</button>
          <div className="orders-editor-heading"><span>{tx(editing.id ? "BUYURTMA" : "YANGI BUYURTMA")}</span><strong>{tx(editing.orderNumber || "Yangi buyurtma")}</strong></div>
          <button type="button" className="orders-save-button" disabled={!canSave} onClick={() => saveActionRef.current?.()}><ClipboardList size={17} />{tx("Buyurtmani vaqtincha saqlash")}</button>
        </header>
        <p className="orders-editor-note">{tx("Saqlangan buyurtma mahsulotlarni band qiladi, lekin sotuv va ombor chiqimi hali qayd etilmaydi.")}</p>
        <div className="app-pos-content orders-pos-content">
          <POS
            key={String(editKey)}
            orderMode
            currentUser={currentUser}
            draftKey={"crm_order_editor_" + String(editKey)}
            initialOrderDraft={editing}
            reservationOrderId={editing.id}
            onSaveOrder={persistOrder}
            onOrderSaleComplete={leaveEditor}
            cartWindowOpen={cartWindowOpen}
            onCartWindowChange={setCartWindowOpen}
            saveOrderActionRef={saveActionRef}
            onOrderSaveAvailabilityChange={setCanSave}
            hideSaveDraftButton
          />
        </div>
      </section>
    );
  }

  return (
    <section className="orders-page">
      <header className="orders-heading">
        <div><span className="orders-eyebrow">{tx("SOTUVLAR")}</span><h1>{tx("Buyurtmalar")}</h1><p>{tx("Mijozlar uchun mahsulotlarni vaqtincha band qiling.")}</p></div>
      </header>
      <div className="orders-stats">
        <article><span>{tx("Faol buyurtmalar")}</span><strong>{orders.filter((order) => order.status === "reserved").length}</strong></article>
        <article><span>{tx("Band qilingan mahsulotlar")}</span><strong>{reservedUnits} {tx("dona")}</strong></article>
        <article><span>{tx("Buyurtmalar summasi")}</span><strong>{formatCurrency(reservedTotal)}</strong></article>
      </div>
      <div className="orders-toolbar">
        <label><Search size={17} /><input value={query} onChange={(event) => setQuery(capitalizeSearchStart(event.target.value))} placeholder={tx("Buyurtma, mijoz yoki mahsulotni qidiring...")} /></label>
        <span>{visibleOrders.length} {tx("ta buyurtma")}</span>
      </div>
      <div className="orders-overview">
        {visibleOrders.length ? (
          <div className="orders-grid">
            <button type="button" className="order-new-tile" onClick={startNew}>
              <span><Plus size={30} strokeWidth={1.7} /></span>
              <strong>{tx("Yangi buyurtma")}</strong>
              <small>{tx("Mijoz uchun mahsulotlarni vaqtincha band qiling.")}</small>
            </button>
            {visibleOrders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-top"><span className="order-number"><ClipboardList size={16} />{tx(order.orderNumber || order.id)}</span><span className="order-status">{tx("Band qilingan")}</span></div>
                <div className="order-customer"><span><UserRound size={16} /></span><div><strong>{order.customerName}</strong><small>+998 {String(order.customerPhone || "").replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4")}</small></div></div>
                <div className="order-products">{(order.cart || []).slice(0, 3).map((item) => <div key={item.cartKey || item.id}><span>{item.name}</span><strong>{item.qty} {tx("dona")}</strong></div>)}{order.cart?.length > 3 && <small>+ {order.cart.length - 3} {tx("xil mahsulot")}</small>}</div>
                <div className="order-card-meta"><span><Package size={14} />{reservedCount(order)} {tx("dona band")}</span><span><CalendarClock size={14} />{orderDate(order.updatedAt || order.createdAt)}</span></div>
                <div className="order-card-total"><span>{tx("Jami summa")}</span><strong style={{ fontSize: orderAmountFontSize(formatCurrency(order.total || 0)) }}>{formatCurrency(order.total || 0)}</strong></div>
                <footer><button type="button" className="order-cancel" onClick={() => setDeleting(order)}><Trash2 size={15} />{tx("Bekor qilish")}</button><button type="button" className="order-edit" onClick={() => startEdit(order)}><Pencil size={15} />{tx("Davom ettirish")}</button><button type="button" className="order-convert" onClick={() => convertToSale(order)}><CreditCard size={15} />{tx("Sotuvga o‘tkazish")}</button></footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="orders-grid orders-empty-grid">
            <button type="button" className="order-new-tile" onClick={startNew}>
              <span><Plus size={30} strokeWidth={1.7} /></span>
              <strong>{tx("Yangi buyurtma")}</strong>
              <small>{tx("Mijoz uchun mahsulotlarni vaqtincha band qiling.")}</small>
            </button>
            {searchTerm && <div className="orders-empty"><span><ClipboardList size={25} /></span><h2>{tx("Buyurtma topilmadi")}</h2><p>{tx("Qidiruv so‘zini o‘zgartiring.")}</p></div>}
          </div>
        )}
      </div>
      <ConfirmDialog open={!!deleting} title="Buyurtmani bekor qilasizmi?" message={deleting ? (deleting.customerName + " uchun band qilingan " + reservedCount(deleting) + " dona mahsulot sotuvga qaytariladi.") : ""} confirmLabel="Bekor qilish" onCancel={() => setDeleting(null)} onConfirm={cancelOrder} />
    </section>
  );
}
