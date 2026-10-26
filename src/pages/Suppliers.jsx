import { createPortal } from "react-dom";
import { PaymentSuccessAnimation } from "./PosPaymentPanel";
import checkSound from "../assets/check animation sound.m4a";
import "./POS.css";
import { translateText as tx } from "../locales/translateText";
import { formatCurrency, moneyInputValue, toBaseMoney } from "../data/currency";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import "./Suppliers.css";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Truck,
  Package,
  PackagePlus,
  UserPlus,
  DollarSign,
  AlertCircle,
} from "lucide-react";

import Modal, { Field } from "../components/Modal";
import PhoneInput from "../components/PhoneInput";
import { useToast } from "../context/ToastContext";
import DateRangeFilter, { matchesDateRange } from "../components/DateRangeFilter";

const statusMap = {
  active: {
    label: "Faol",
    bg: "var(--success-light)",
    color: "var(--success)",
  },
  inactive: {
    label: "Nofaol",
    bg: "var(--border-subtle)",
    color: "var(--text-muted)",
  },
};

const emptyProduct = {
  productName: "", brand: "", sku: "", category: "", packaging: "", extraMeasurement: "", extraMeasurementValue: "",
  receivedQuantity: "", unitsPerPackage: "", liters: "", weight: "", volume: "",
  length: "", width: "", height: "", cost: "", price: "", measurementType: "count",
};

const pickProduct = (source) => Object.fromEntries(
  [...Object.keys(emptyProduct), "existingId"].map((key) => [key, source[key]])
);
const hasDuplicateProducts = (drafts) => {
  const keys = drafts.map((item) => String(item.existingId || item.productName || "").trim().toLocaleLowerCase("uz-UZ"));
  return new Set(keys).size !== keys.length;
};
const readList = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const moneyValue = (value) => Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
const moneyText = (value) => formatCurrency(value);

const capitalizeStart = (value = "") => value ? value[0].toLocaleUpperCase("uz-UZ") + value.slice(1) : "";

function LearnedInput({ value, options, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const matches = options.filter((item) => item.toLocaleLowerCase("uz-UZ").startsWith(value.toLocaleLowerCase("uz-UZ")));
  return <div className="supplier-learned-input" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}><input className="input-base" value={value} disabled={disabled} onFocus={() => !disabled && setOpen(true)} onClick={() => !disabled && setOpen(true)} onChange={(event) => { onChange(capitalizeStart(event.target.value)); setOpen(true); }} placeholder={tx("Yozing yoki tanlang")} autoComplete="off" />{!disabled && open && matches.length > 0 && <div className="supplier-learned-options">{matches.map((item) => <button type="button" key={item} onClick={() => { onChange(item); setOpen(false); }}>{item}</button>)}</div>}</div>;
}

function ReceiptProductFields({ value, onChange, packagingOptions, extraMeasurementOptions, suggestions = [], onChooseProduct, disabled = false }) {
  const update = (key, nextValue) => onChange((current) => ({ ...current, [key]: nextValue }));
  const changeName = (rawValue) => onChange((current) => current.existingId
    ? { ...current, ...emptyProduct, supplierId: current.supplierId, productName: capitalizeStart(rawValue), existingId: null }
    : { ...current, productName: capitalizeStart(rawValue) });
  const currencyField = (key, label, required = false) => (
    <Field label={tx(label)}>
      <div className="supplier-money-input">
        <input
          className="input-base"
          inputMode="decimal"
          aria-label={tx(label)}
          value={value[key] === "" ? "" : moneyInputValue(value[key])}
          onChange={(event) => update(key, event.target.value === "" ? "" : String(toBaseMoney(event.target.value)))}
          placeholder="0"
          required={required}
          disabled={disabled}
        />
        <span>{tx("so'm")}</span>
      </div>
    </Field>
  );
  return (
    <div className="supplier-product-fields">
      <Field label={tx("Tovar nomi *")}>
        <div className="supplier-product-name-input">
          <input className="input-base" value={value.productName} onChange={(event) => changeName(event.target.value)} placeholder={tx("Masalan: Kir yuvish kukuni")} autoComplete="off" required disabled={disabled} />
          {!disabled && suggestions.length > 0 && <div className="supplier-learned-options">{suggestions.map((product) => <button type="button" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onChooseProduct?.(product)}>{product.name}{product.brand ? ` · ${product.brand}` : ""}</button>)}</div>}
        </div>
      </Field>
      <Field label={tx("Brend")}><input className="input-base" value={value.brand} disabled={disabled} onChange={(event) => update("brand", capitalizeStart(event.target.value))} placeholder={tx("Ixtiyoriy")} /></Field>
      <Field label={tx("SKU kodi")}><input className="input-base" value={value.sku} disabled={disabled} onChange={(event) => update("sku", event.target.value)} placeholder={tx("Ixtiyoriy")} /></Field>
      <Field label={tx("Kategoriya")}><input className="input-base" value={value.category} disabled={disabled} onChange={(event) => update("category", capitalizeStart(event.target.value))} placeholder={tx("Masalan: Maishiy kimyo")} /></Field>
      <Field label={tx("O'lchov birligi *")}>
        <select className="input-base" value={value.measurementType || "count"} disabled={disabled} onChange={(event) => update("measurementType", event.target.value)}>
          <option value="count">{tx("Soni (dona)")}</option>
          <option value="weight">{tx("Og'irligi (kg)")}</option>
        </select>
      </Field>
      <Field label={tx("Qadoq turi")}><LearnedInput value={value.packaging} options={packagingOptions} disabled={disabled} onChange={(nextValue) => update("packaging", nextValue)} /></Field>
      <Field label={tx("Qo'shimcha o'lchov")}><LearnedInput value={value.extraMeasurement} options={extraMeasurementOptions} disabled={disabled} onChange={(nextValue) => onChange((current) => ({ ...current, extraMeasurement: nextValue, extraMeasurementValue: "" }))} /></Field>
      {value.extraMeasurement && <Field label={value.extraMeasurement}><input className="input-base" type="number" min="0" step="any" disabled={disabled} value={value.extraMeasurementValue} onChange={(event) => update("extraMeasurementValue", event.target.value)} placeholder="0" /></Field>}
      <Field label={tx("Qabul qilingan miqdor *")}><input className="input-base" type="number" min={value.measurementType === "weight" ? "0.001" : "1"} step={value.measurementType === "weight" ? "any" : "1"} value={value.receivedQuantity} disabled={disabled} onChange={(event) => update("receivedQuantity", event.target.value)} placeholder={tx(value.measurementType === "weight" ? "Masalan: 2.5" : "Masalan: 20")} required /></Field>
      {currencyField("cost", "Tan narxi *", true)}
      {currencyField("price", "Sotuv narxi (ixtiyoriy)")}
    </div>
  );
}

export default function Suppliers({ onNavigate }) {
  useUILanguage();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [suppliers, setSuppliers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("crm_suppliers") || "null");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [pendingProducts, setPendingProducts] = useState([]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    ...emptyProduct,
    status: "active",
  });

  const [err, setErr] = useState("");
  const [productErr, setProductErr] = useState("");
  const [productForm, setProductForm] = useState({ supplierId: "", ...emptyProduct, packaging: "" });
  const [productQueue, setProductQueue] = useState([]);
  const [supplierDebtInput, setSupplierDebtInput] = useState("");
  const [newSupplierDebtInput, setNewSupplierDebtInput] = useState("");
  const [receiptConfirmation, setReceiptConfirmation] = useState(false);
  const [receiptAnimation, setReceiptAnimation] = useState(null);
  const receiptTimer = useRef(null);
  useEffect(() => () => clearTimeout(receiptTimer.current), []);
  const knownProducts = readList("crm_products");
  const packagingOptions = [...new Set(knownProducts.map((item) => item.packaging).filter(Boolean))].sort();
  const extraMeasurementOptions = [...new Set(knownProducts.map((item) => item.extraMeasurement).filter(Boolean))].sort();
  const productSuggestions = productForm.productName.trim() && !productForm.existingId
    ? knownProducts.filter((item) => productForm.supplierId && String(item.supplierId) === String(productForm.supplierId)).filter((item) => String(item.name || "").toLocaleLowerCase("uz-UZ").startsWith(productForm.productName.toLocaleLowerCase("uz-UZ"))).filter((item, index, list) => list.findIndex((match) => String(match.name || "").toLocaleLowerCase("uz-UZ") === String(item.name || "").toLocaleLowerCase("uz-UZ")) === index).slice(0, 6)
    : [];
  const chooseProduct = (product) => setProductForm((current) => ({ ...current, productName: product.name, brand: product.brand || "", category: product.category || "", packaging: product.packaging || "", sku: product.sku || "", cost: String(product.cost ?? ""), price: String(product.price ?? ""), measurementType: product.measurementType || "count", extraMeasurement: product.extraMeasurement || "", extraMeasurementValue: String(product.extraMeasurementValue || ""), existingId: product.id }));
  const updateProductForm = (updater) => { setProductForm(updater); setProductErr(""); };
  const updateNewSupplierForm = (updater) => { setForm(updater); setErr(""); };
  const receiptDrafts = [...productQueue, ...(productForm.productName.trim() ? [productForm] : [])];
  const receiptTotal = receiptDrafts.reduce((sum, item) => sum + Math.max(0, Number(item.receivedQuantity) || 0) * Number(item.cost || 0), 0);
  const receiptDebt = Math.min(receiptTotal, moneyValue(supplierDebtInput));
  const receiptCash = Math.max(0, receiptTotal - receiptDebt);
  const newSupplierDrafts = [...pendingProducts, ...(form.productName.trim() ? [pickProduct(form)] : [])];
  const newSupplierTotal = newSupplierDrafts.reduce((sum, item) => sum + Math.max(0, Number(item.receivedQuantity) || 0) * moneyValue(item.cost), 0);
  const newSupplierDebt = Math.min(newSupplierTotal, moneyValue(newSupplierDebtInput));
  const newSupplierCash = Math.max(0, newSupplierTotal - newSupplierDebt);
  useEffect(() => { setNewSupplierDebtInput((value) => String(Math.min(newSupplierTotal, moneyValue(value)))); }, [newSupplierTotal]);
  useEffect(() => { setSupplierDebtInput((value) => value === "" ? "" : String(Math.min(receiptTotal, moneyValue(value)))); }, [receiptTotal]);

  const toast = useToast();

  const digits = form.phone.replace(/\D/g, "");
  const phoneValid = digits.length === 12;

  const productError = (product) => {
    const quantity = Number(product.receivedQuantity);
    const cost = Number(product.cost);
    if (!product.productName.trim() || product.receivedQuantity === "" || product.cost === "") {
      return "Tovar nomi, qabul qilingan miqdor va tan narxini kiriting";
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || (product.measurementType !== "weight" && !Number.isInteger(quantity)) || !Number.isFinite(cost) || cost < 0) {
      return "Miqdor va tan narxini to'g'ri kiriting";
    }
    return "";
  };

  const addPendingProduct = () => {
    const product = pickProduct(form);
    const error = productError(product);
    if (error) return setErr(error);
    if (hasDuplicateProducts([...pendingProducts, product])) return setErr("Bu mahsulot ro'yxatga allaqachon qo'shilgan.");
    setPendingProducts((items) => [...items, { ...product, key: `${Date.now()}-${items.length}` }]);
    setForm((current) => ({ ...current, ...emptyProduct }));
    setErr("");
  };

  const queueProduct = () => {
    if (!productForm.supplierId) return setProductErr("Ta'minotchini tanlang");
    const error = productError(productForm); if (error) return setProductErr(error);
    if (hasDuplicateProducts([...productQueue, productForm])) return setProductErr("Bu mahsulot qabul ro'yxatiga allaqachon qo'shilgan.");
    setProductQueue((items) => [...items, { ...pickProduct(productForm), key: `${Date.now()}-${items.length}` }]);
    setProductForm((current) => ({ ...current, ...emptyProduct, packaging: "", existingId: null, supplierId: current.supplierId }));
    setProductErr("");
  };

  const addProductToSupplier = () => {
    const supplier = suppliers.find((item) => String(item.id) === String(productForm.supplierId));
    if (!supplier) return setProductErr("Ta'minotchini tanlang");
    const drafts = [...productQueue, ...(productForm.productName.trim() ? [pickProduct(productForm)] : [])];
    if (!drafts.length) return setProductErr("Kamida bitta mahsulot nomini kiriting");
    if (hasDuplicateProducts(drafts)) return setProductErr("Bir xil mahsulot qabul ro'yxatida takrorlangan. Takrorlangan qatorni o'chiring.");

    const invalid = drafts.map(productError).find(Boolean); if (invalid) return setProductErr(invalid);
    if (!receiptConfirmation) { setReceiptConfirmation(new Date().toISOString()); return; }
    const createdAt = receiptConfirmation, savedProducts = readList("crm_products");
    const productsToSave = drafts.map((draft, index) => {
      const quantity = Math.max(0, Number(draft.receivedQuantity) || 0);
      const existing = savedProducts.find((item) => String(item.supplierId) === String(supplier.id) && (draft.existingId ? String(item.id) === String(draft.existingId) : String(item.name || "").trim().toLowerCase() === draft.productName.trim().toLowerCase()));
      if (existing) {
        const nextStock = Number(existing.stock || 0) + quantity;
        return { ...existing, measurementType: draft.measurementType || existing.measurementType || "count", extraMeasurement: draft.extraMeasurement, extraMeasurementValue: Number(draft.extraMeasurementValue) || 0, stock: nextStock, status: nextStock === 0 ? "out" : nextStock < 10 ? "low" : "active", brand: capitalizeStart(draft.brand.trim()) || existing.brand, sku: capitalizeStart(draft.sku.trim()) || existing.sku, category: capitalizeStart(draft.category.trim()) || existing.category, packaging: capitalizeStart(draft.packaging.trim()) || existing.packaging, cost: draft.cost === "" ? existing.cost : Number(draft.cost), price: draft.price === "" ? existing.price : Number(draft.price) };
      }
      return {
        id: `${Date.now()}-manual-${index}`, name: capitalizeStart(draft.productName.trim()),
        brand: draft.brand.trim(), sku: draft.sku.trim() || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`,
        category: draft.category.trim() || "Boshqa", packaging: capitalizeStart(draft.packaging.trim()),
        price: Number(draft.price) || 0, cost: Number(draft.cost) || 0, stock: quantity, measurementType: draft.measurementType || "count",
        status: quantity > 0 && quantity < 10 ? "low" : "active", supplierId: supplier.id,
        supplierName: supplier.name, extraMeasurement: draft.extraMeasurement, extraMeasurementValue: Number(draft.extraMeasurementValue) || 0, unitsPerPackage: Number(draft.unitsPerPackage) || 0,
        liters: Number(draft.liters) || 0, weight: Number(draft.weight) || 0,
        volume: Number(draft.volume) || 0, length: Number(draft.length) || 0,
        width: Number(draft.width) || 0, height: Number(draft.height) || 0, createdAt,
      };
    });
    const receiptLines = drafts.map((draft, index) => ({ id: productsToSave[index].id, name: productsToSave[index].name, quantity: Math.max(0, Number(draft.receivedQuantity) || 0), measurementType: draft.measurementType || "count", packaging: draft.packaging || "", cost: Number(draft.cost) }));
    const totalAmount = receiptLines.reduce((sum, item) => sum + item.quantity * item.cost, 0), debtAmount = Math.min(totalAmount, moneyValue(supplierDebtInput)), cashAmount = Math.max(0, totalAmount - debtAmount);
    const order = { id: `PO-${Date.now().toString().slice(-6)}`, supplierId: supplier.id, items: receiptLines.reduce((sum, item) => sum + item.quantity, 0), productCount: receiptLines.length, productNames: receiptLines.map((item) => item.name), productIds: receiptLines.map((item) => item.id), productDetails: receiptLines, amount: totalAmount, remaining: debtAmount, payment: cashAmount === totalAmount ? "Naqd" : cashAmount ? "Qisman" : "Qarz", status: debtAmount === 0 ? "paid" : cashAmount ? "partial" : "debt", paymentHistory: cashAmount > 0 ? [{ id: `PAY-INITIAL-${Date.now()}`, amount: cashAmount, method: "Naqd", date: createdAt, kind: "initial" }] : [], received: true, date: createdAt };
    const receipt = { id: `REC-${Date.now()}`, supplierId: supplier.id, supplier: supplier.name, orderId: order.id, items: order.items, products: order.productDetails, amount: order.amount, date: createdAt };
    const updated = suppliers.map((item) => item.id === supplier.id ? {
      ...item, products: (Number(item.products) || 0) + productsToSave.filter((product) => !savedProducts.some((saved) => String(saved.id) === String(product.id))).length,
      purchases: (Number(item.purchases) || 0) + order.amount, debt: (Number(item.debt) || 0) + debtAmount, lastOrder: createdAt,
    } : item);
    try {
      localStorage.setItem("crm_products", JSON.stringify([...productsToSave.filter((product) => !savedProducts.some((saved) => String(saved.id) === String(product.id))), ...savedProducts.map((saved) => productsToSave.find((product) => String(product.id) === String(saved.id)) || saved)]));
      localStorage.setItem("crm_suppliers", JSON.stringify(updated));
      localStorage.setItem(`crm_supplier_orders_${supplier.id}`, JSON.stringify([order, ...readList(`crm_supplier_orders_${supplier.id}`)]));
      localStorage.setItem("crm_supplier_receipts", JSON.stringify([receipt, ...readList("crm_supplier_receipts")]));
    } catch { return setProductErr("Mahsulot saqlanmadi. Qayta urinib ko'ring."); }
    setSuppliers(updated);
    setProductForm({ supplierId: "", ...emptyProduct, packaging: "" });
    setProductQueue([]);
    setSupplierDebtInput("");
    setProductErr("");
    setProductOpen(false);
    setReceiptConfirmation(false);
    setReceiptAnimation({ amount: totalAmount, remainingDebt: debtAmount });
    const sound = new Audio(checkSound); sound.play().catch(() => {});
    receiptTimer.current = setTimeout(() => setReceiptAnimation(null), 2400);
    window.dispatchEvent(new Event("crm-products-updated"));
    toast.success && toast.success(`${productsToSave.length} ta mahsulot ta'minotchiga biriktirildi`);
  };

  const submit = () => {
    if (!form.name.trim()) {
      return setErr("Ta'minotchi nomini kiriting");
    }

    if (!phoneValid) {
      return setErr("Telefon raqamini to'liq kiriting");
    }

    const productDrafts = newSupplierDrafts;
    if (!productDrafts.length) return setErr("Kamida bitta tovarni qabulga qo'shing");
    if (hasDuplicateProducts(productDrafts)) return setErr("Bir xil mahsulot qabul ro'yxatida takrorlangan. Takrorlangan qatorni o'chiring.");
    const invalid = productDrafts.map(productError).find(Boolean);
    if (invalid) return setErr(invalid);

    setErr("");

    const prev = suppliers;
    const createdAt = new Date().toISOString();
    const updated = [
      {
        id:
          Math.max(
            0,
            ...prev.map((x) => Number(x.id) || 0)
          ) + 1,

        name: form.name.trim(),
        phone: form.phone,
        products: productDrafts.length,
        purchases: productDrafts.reduce((sum, item) => sum + Number(item.receivedQuantity) * Number(item.cost), 0),
        debt: newSupplierDebt,
        lastOrder: createdAt,
        createdAt,
        status: "active",
      },
      ...prev,
    ];
    const supplierId = updated[0].id;
    const productsForReceipt = productDrafts.map((item, index) => {
      const receivedQuantity = Number(item.receivedQuantity);
      return {
        id: `${Date.now()}-${index}`,
        name: item.productName.trim(), brand: item.brand.trim(),
        sku: item.sku.trim() || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`,
        category: item.category.trim() || "Boshqa",
        price: Number(item.price) || 0, cost: Number(item.cost), stock: receivedQuantity, measurementType: item.measurementType || "count",
        status: receivedQuantity < 10 ? "low" : "active", supplierId,
        supplierName: form.name.trim(), packaging: item.packaging, extraMeasurement: item.extraMeasurement, extraMeasurementValue: Number(item.extraMeasurementValue) || 0,
        unitsPerPackage: Number(item.unitsPerPackage) || 0, liters: Number(item.liters) || 0,
        weight: Number(item.weight) || 0, volume: Number(item.volume) || 0,
        length: Number(item.length) || 0, width: Number(item.width) || 0, height: Number(item.height) || 0,
      };
    });
    const totalQuantity = productsForReceipt.reduce((sum, item) => sum + item.stock, 0);
    const totalAmount = productsForReceipt.reduce((sum, item) => sum + item.stock * item.cost, 0);
    const order = {
      id: `PO-${Date.now().toString().slice(-6)}`,
      supplierId,
      items: totalQuantity,
      productCount: productsForReceipt.length,
      productNames: productsForReceipt.map((item) => item.name),
      productIds: productsForReceipt.map((item) => item.id),
      productDetails: productsForReceipt.map((item) => ({ id: item.id, name: item.name, quantity: item.stock, measurementType: item.measurementType, packaging: item.packaging, cost: item.cost })),
      amount: totalAmount,
      remaining: newSupplierDebt,
      payment: newSupplierCash === totalAmount ? "Naqd" : newSupplierCash ? "Qisman" : "Qarz",
      status: newSupplierDebt === 0 ? "paid" : newSupplierCash ? "partial" : "debt",
      paymentHistory: newSupplierCash > 0 ? [{ id: `PAY-INITIAL-${Date.now()}`, amount: newSupplierCash, method: "Naqd", date: createdAt, kind: "initial" }] : [],
      received: true,
      date: createdAt,
    };
    const receipt = {
      id: `REC-${Date.now()}`,
      supplierId,
      supplier: form.name.trim(),
      orderId: order.id,
      items: totalQuantity,
      productCount: productsForReceipt.length,
      products: productsForReceipt.map((item) => ({ id: item.id, name: item.name, quantity: item.stock, measurementType: item.measurementType, packaging: item.packaging, cost: item.cost })),
      amount: order.amount,
      date: createdAt,
    };
    try {
      localStorage.setItem("crm_suppliers", JSON.stringify(updated));
      const savedProducts = JSON.parse(localStorage.getItem("crm_products") || "null");
      const products = Array.isArray(savedProducts) ? savedProducts : [];
      localStorage.setItem("crm_products", JSON.stringify([...productsForReceipt, ...products]));
      localStorage.setItem(`crm_supplier_orders_${supplierId}`, JSON.stringify([order]));
      const savedReceipts = JSON.parse(localStorage.getItem("crm_supplier_receipts") || "[]");
      localStorage.setItem("crm_supplier_receipts", JSON.stringify([receipt, ...(Array.isArray(savedReceipts) ? savedReceipts : [])]));
    }
    catch { setErr("Ta'minotchi saqlanmadi. Qayta urinib ko'ring."); return; }
    setSuppliers(updated);

    setForm({
      name: "",
      phone: "",
      ...emptyProduct,
      status: "active",
    });
    setPendingProducts([]);
    setNewSupplierDebtInput("");

    setOpen(false);
    window.dispatchEvent(new Event("crm-products-updated"));

    toast.success &&
      toast.success("Ta'minotchi qo'shildi");
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    matchesDateRange(s.lastOrder || s.createdAt, dateFrom, dateTo)
  );

  return (
    <div className="space-y-6 fade-in">

      {/* Sarlavha */}
      <div className="flex items-center justify-between supplier-page-heading">
        <div>
          <h1
            className="font-display text-2xl font-bold"
            style={{
              fontFamily: "'Manrope',sans-serif",
              color: "var(--text-primary)",
            }}
          >{tx("Ta'minotchilar")}</h1>

          <p
            className="text-sm mt-0.5"
            style={{
              color: "var(--text-muted)",
            }}
          >{tx("Yetkazib beruvchilar va shartnomalar")}</p>
        </div>

        <div className="flex items-center gap-2 supplier-heading-actions">
          <button
            type="button"
            onClick={() => { setProductForm({ supplierId: "", ...emptyProduct }); setProductQueue([]); setSupplierDebtInput(""); setProductErr(""); setProductOpen(true); }}
            aria-label={tx("Mahsulot qo'shish")}
            title={tx("Mahsulot qo'shish")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 supplier-add-product-btn"
            style={{ background: "var(--brand-light)", color: "var(--brand)", border: "1px solid var(--brand)" }}
          >
            <PackagePlus size={16} /><span>{tx("Mahsulot qo'shish")}</span></button>
          <button
            type="button"
            onClick={() => {
              setForm({ name: "", phone: "", ...emptyProduct, status: "active" });
              setPendingProducts([]);
              setNewSupplierDebtInput("");
              setErr("");
              setOpen(true);
            }}
            aria-label={tx("Ta'minotchi qo'shish")}
            title={tx("Ta'minotchi qo'shish")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 supplier-add-person-btn"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-hover))", boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
          >
            <UserPlus size={16} /><span>{tx("Ta'minotchi qo'shish")}</span></button>
        </div>
      </div>

      {/* Analitika kartalari */}
      <div className="suppliers-stats grid grid-cols-4 gap-4">
        {[
          {
            label: "Jami ta'minotchilar",
            value: suppliers.length,
            icon: Truck,
            color: "var(--brand)",
            bg: "var(--brand-light)",
          },
          {
            label: "Jami mahsulotlar",
            value: suppliers.reduce(
              (s, x) => s + x.products,
              0
            ),
            icon: Package,
            color: "var(--violet)",
            bg: "var(--violet-light)",
          },
          {
            label: "Jami xaridlar",
            value:
              (
                suppliers.reduce(
                  (s, x) => s + x.purchases,
                  0
                ) / 1000000
              ).toFixed(0) + " mln",
            icon: DollarSign,
            color: "var(--success)",
            bg: "var(--success-light)",
          },
          {
            label: "Qarz",
            value:
              (
                suppliers
                  .filter((s) => s.debt > 0)
                  .reduce(
                    (s, x) => s + x.debt,
                    0
                  ) / 1000000
              ).toFixed(1) + " mln",
            icon: AlertCircle,
            color: "var(--danger)",
            bg: "var(--danger-light)",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`supplier-stat-card rounded-2xl p-4 transition-card ${s.label === "Qarz" ? "debt-highlight" : ""}`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 2px 8px rgba(15,23,42,0.04)",
            }}
          >
            <div
              className="p-2.5 rounded-xl w-fit mb-3"
              style={{
                background: s.bg,
              }}
            >
              <s.icon
                size={18}
                style={{
                  color: s.color,
                }}
              />
            </div>

            <div
              className="text-xl font-display font-bold"
              style={{
                fontFamily: "'Manrope',sans-serif",
                color: "var(--text-primary)",
              }}
            >
              {tx(s.value)}
            </div>

            <div
              className="text-xs mt-0.5"
              style={{
                color: "var(--text-faint)",
              }}
            >
              {tx(s.label)}
            </div>
          </div>
        ))}
      </div>

      {/* Jadval */}
      <div
        className="suppliers-list-card rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.04)",
        }}
      >
        {/* Qidiruv */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-wrap"
          style={{
            borderBottom:
              "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              minWidth: 260,
            }}
          >
            <Search
              size={14}
              style={{
                color: "var(--text-faint)",
              }}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder={tx("Ta'minotchi qidirish...")}
              className="bg-transparent outline-none text-sm flex-1"
              style={{
                color: "var(--text-primary)",
              }}
            />
          </div>
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        </div>

        {/* Table */}
        <div className="suppliers-table-scroll" role="region" aria-label={tx("Ta'minotchilar jadvali")} tabIndex="0">
        <table className="suppliers-table w-full">
          <thead>
            <tr
              style={{
                background: "var(--table-stripe)",
              }}
            >
              {[
                "Ta'minotchi",
                "Telefon",
                "Mahsulotlar",
                "Jami xaridlar",
                "Qarzdorlik",
                "So'nggi buyurtma",
                "Holat",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3 text-xs font-semibold"
                  style={{
                    color: "var(--text-faint)",
                  }}
                >
                  {tx(h)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => {
              const st =
                statusMap[s.status] ||
                statusMap.active;

              return (
                <tr
                  onClick={() =>
                    onNavigate &&
                    onNavigate("supplier-" + s.id)
                  }
                  key={s.id}
                  className="border-t table-row-hover transition-colors"
                  style={{
                    cursor: "pointer",
                    borderColor:
                      "var(--border-subtle)",
                  }}
                >
                  {/* Ta'minotchi */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                        style={{
                          background:
                            "linear-gradient(135deg,var(--brand),var(--violet))",
                        }}
                      >
                        {tx(s.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join(""))}
                      </div>

                      <span
                        className="text-sm font-semibold"
                        style={{
                          color:
                            "var(--text-primary)",
                        }}
                      >
                        {s.name}
                      </span>
                    </div>
                  </td>

                  {/* Telefon */}
                  <td
                    className="px-5 py-3.5 text-sm"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    {s.phone}
                  </td>

                  {/* Mahsulotlar */}
                  <td
                    className="px-5 py-3.5 text-sm"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    {tx(s.products)}{tx(" ta")}</td>

                  {/* Xaridlar */}
                  <td
                    className="px-5 py-3.5 text-sm font-semibold"
                    style={{
                      color:
                        "var(--text-primary)",
                    }}
                  >
                    {formatCurrency(s.purchases)}</td>

                  {/* Qarzdorlik */}
                  <td className="px-5 py-3.5">
                    {s.debt > 0 ? (
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color:
                            "var(--danger)",
                        }}
                      >
                        {tx((s.debt / 1000000).toFixed(
                          1
                        ))}{" "}{tx("mln")}</span>
                    ) : (
                      <span
                        className="text-sm"
                        style={{
                          color:
                            "var(--success)",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  {/* So'nggi buyurtma */}
                  <td
                    className="px-5 py-3.5 text-xs"
                    style={{
                      color:
                        "var(--text-faint)",
                    }}
                  >
                    {tx(s.lastOrder)}
                  </td>

                  {/* Holat */}
                  <td className="px-5 py-3.5">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: st.bg,
                        color: st.color,
                      }}
                    >
                      {tx(st.label)}
                    </span>
                  </td>

                  {/* More */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{
                        color:
                          "var(--text-faint)",
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ============================= */}
      {/* TA'MINOTCHI QO'SHISH MODALI */}
      {/* ============================= */}

      <Modal
        contentOnly
        open={open}
        onClose={() => {
          setOpen(false);
          setErr("");
          setPendingProducts([]);
          setNewSupplierDebtInput("");
          setForm({ name: "", phone: "", ...emptyProduct, status: "active" });
        }}
        title={tx("Yangi ta'minotchi qo'shish")}
        subtitle={tx("Yetkazib beruvchi ma'lumotlari")}
        icon={Truck}
        width={760}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
              <Field label={tx("Ta'minotchi nomi *")}>
            <input
              className="input-base"
              value={form.name}
                  required
              onChange={(e) =>
                updateNewSupplierForm({
                  ...form,
                  name: e.target.value,
                })
              }
              placeholder={tx("Global Import MChJ")}
            />
          </Field>

          <Field
            label={tx("Telefon raqami")}
            hint={tx("Faqat raqam kiritiladi")}
          >
            <PhoneInput
              required
              value={form.phone}
              onChange={(v) =>
                updateNewSupplierForm({
                  ...form,
                  phone: v,
                })
              }
            />
          </Field>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{tx("Tovarni qabul qilish")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{tx("Bir yetkazib beruvchidan kelgan mahsulotlarni bitta qabulga kiriting. Nom, o'lchov birligi, miqdor va tan narxi majburiy.")}</div>

            {pendingProducts.length > 0 && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "var(--brand-light)", border: "1px solid var(--brand-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
                  <span>{tx("Qabulga qo'shilgan mahsulotlar")}</span>
                  <span>{pendingProducts.length} {tx("xil")}</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {pendingProducts.map((item, index) => (
                    <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "7px 9px", borderRadius: 8, background: "var(--surface)", fontSize: 12, color: "var(--text-secondary)" }}>
                      <span><b style={{ color: "var(--text-primary)" }}>{index + 1}. {item.productName}</b> · {item.receivedQuantity} {tx(item.measurementType === "weight" ? "kg" : "dona")}</span>
                      <button type="button" onClick={() => setPendingProducts((items) => items.filter((product) => product.key !== item.key))} style={{ border: 0, background: "transparent", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>{tx("O'chirish")}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ReceiptProductFields value={form} onChange={updateNewSupplierForm} packagingOptions={packagingOptions} extraMeasurementOptions={extraMeasurementOptions} />

            <button type="button" className="btn-ghost" onClick={addPendingProduct} style={{ marginTop: 14, width: "100%", justifyContent: "center", border: "1px dashed var(--brand)", color: "var(--brand)" }}>
              <Plus size={16} />{tx("Yana mahsulot qo'shish")}
            </button>
          </div>

          <div className="supplier-receipt-payment-grid">
            <div className="supplier-receipt-payment-total"><small>{tx("Umumiy summa")}</small><b>{moneyText(newSupplierTotal)}</b></div>
            <Field label={tx("Qarzga yoziladi")}><div className="supplier-money-input"><input className="input-base" inputMode="decimal" value={newSupplierDebtInput === "" ? "" : moneyInputValue(newSupplierDebtInput)} onChange={(event) => setNewSupplierDebtInput(event.target.value === "" ? "" : String(Math.min(newSupplierTotal, toBaseMoney(event.target.value))))} placeholder="0"/><span>{tx("so'm")}</span></div></Field>
            <div className="supplier-receipt-payment-total supplier-receipt-cash"><small>{tx("Naqd to'lov")}</small><b>{moneyText(newSupplierCash)}</b></div>
          </div>

          {err && (
            <div
              style={{
                fontSize: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  "var(--danger-light)",
                color: "var(--danger)",
                border:
                  "1px solid var(--danger-border)",
              }}
            >
              {tx(err)}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setOpen(false);
                setErr("");
                setPendingProducts([]);
                setNewSupplierDebtInput("");
                setForm({ name: "", phone: "", ...emptyProduct, status: "active" });
              }}
            >{tx("Bekor qilish")}</button>

            <button
              type="button"
              className="btn-primary"
              onClick={submit}
            >
              <Plus size={15} />{tx("Ta'minotchi va mahsulotlarni saqlash")}</button>
          </div>
        </div>
      </Modal>

      <Modal
        contentOnly
        open={productOpen}
        onClose={() => { setProductOpen(false); setProductErr(""); setProductQueue([]); setSupplierDebtInput(""); setProductForm({ supplierId: "", ...emptyProduct }); }}
        title={tx("Ta'minotchiga mahsulot qo'shish")}
        subtitle={tx("Mahsulotni mavjud ta'minotchiga biriktiring")}
        icon={Package}
        width={680}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: 12, borderRadius: 12, background: "var(--brand-light)", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
            {tx("Ta'minotchi, mahsulot nomi, o'lchov birligi, miqdor va tan narxi majburiy. Qolgan maydonlarni ixtiyoriy to'ldiring.")}
          </div>

          <Field label={tx("Ta'minotchi *")}>
            <select className="input-base" value={productForm.supplierId} onChange={(event) => {
              if (event.target.value === String(productForm.supplierId)) { setProductErr(""); return; }
              const currentLineHasInput = Object.entries(emptyProduct).some(([key, emptyValue]) => key !== "measurementType" && productForm[key] !== emptyValue);
              if (productQueue.length || currentLineHasInput) {
                setProductErr("Ta'minotchini almashtirishdan oldin joriy mahsulot ma'lumotlarini tozalang va qabul qatorlarini o'chiring.");
                return;
              }
              setProductForm({ ...emptyProduct, supplierId: event.target.value });
              setSupplierDebtInput("");
              setProductErr("");
            }} required>
              <option value="">{tx("Ta'minotchini tanlang")}</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </Field>
          {!suppliers.length && <p className="supplier-form-help">{tx("Avval kamida bitta ta'minotchi qo'shing.")}</p>}

          {productQueue.length > 0 && (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--brand-light)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--brand)" }}><span>{tx("Qo'shilgan mahsulotlar")}</span><span>{productQueue.length} {tx("xil")}</span></div>
              <div style={{ display: "grid", gap: 6 }}>{productQueue.map((item, index) => <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 9px", borderRadius: 8, background: "var(--surface)", fontSize: 12 }}><span>{index + 1}. <b>{item.productName}</b> · {item.receivedQuantity} {tx(item.measurementType === "weight" ? "kg" : "dona")}</span><button type="button" onClick={() => setProductQueue((items) => items.filter((product) => product.key !== item.key))} style={{ border: 0, background: "transparent", color: "var(--danger)", cursor: "pointer" }}>{tx("O'chirish")}</button></div>)}</div>
            </div>
          )}

          <ReceiptProductFields value={productForm} onChange={updateProductForm} packagingOptions={packagingOptions} extraMeasurementOptions={extraMeasurementOptions} suggestions={productSuggestions} onChooseProduct={(product) => { chooseProduct(product); setProductErr(""); }} disabled={!productForm.supplierId} />

          <button type="button" className="btn-ghost" disabled={!productForm.supplierId} onClick={queueProduct} style={{ width: "100%", justifyContent: "center", border: "1px dashed var(--brand)", color: "var(--brand)" }}><Plus size={16} />{tx("Yana mahsulot qo'shish")}</button>

          <div className="supplier-receipt-payment-grid">
            <div className="supplier-receipt-payment-total"><small>{tx("Umumiy summa")}</small><b>{moneyText(receiptTotal)}</b></div>
            <Field label={tx("Qarzga yoziladi")}><div className="supplier-money-input"><input className="input-base" inputMode="decimal" value={supplierDebtInput === "" ? "" : moneyInputValue(supplierDebtInput)} onChange={(event) => setSupplierDebtInput(event.target.value === "" ? "" : String(Math.min(receiptTotal, toBaseMoney(event.target.value))))} placeholder="0"/><span>{tx("so'm")}</span></div></Field>
            <div className="supplier-receipt-payment-total supplier-receipt-cash"><small>{tx("Naqd to'lov")}</small><b>{moneyText(receiptCash)}</b></div>
          </div>

          {productErr && <div style={{ fontSize: 12, padding: "10px 12px", borderRadius: 10, background: "var(--danger-light)", color: "var(--danger)", border: "1px solid var(--danger-border)" }}>{tx(productErr)}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={() => { setProductOpen(false); setProductErr(""); setProductQueue([]); setSupplierDebtInput(""); setProductForm({ supplierId: "", ...emptyProduct }); }}>{tx("Bekor qilish")}</button>
            <button type="button" className="btn-primary" onClick={addProductToSupplier}><Plus size={15} />{tx("Tovarni qabul qilish")}</button>
          </div>
        </div>
      </Modal>
      <Modal contentOnly open={!!receiptConfirmation} onClose={() => setReceiptConfirmation(false)} title={tx("Mahsulotlarni qabul qilish")} subtitle={tx("Ma'lumotlarni tekshirib, qabul qilishni tasdiqlang")} icon={Package} width={560}>
        <div className="supplier-receipt-confirm">
          <div className="supplier-receipt-heading"><strong>{suppliers.find((item) => String(item.id) === String(productForm.supplierId))?.name}</strong><time dateTime={receiptConfirmation || undefined}>{receiptConfirmation && new Date(receiptConfirmation).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
          <div className="supplier-receipt-items">{receiptDrafts.map((item, index) => <div key={index}><span><b>{capitalizeStart(item.productName)}</b><small>{Number(item.receivedQuantity)} {tx(item.measurementType === "weight" ? "kg" : "dona")}{item.packaging ? ` · ${tx(item.packaging)}` : ""}</small></span><strong>{moneyText(Number(item.receivedQuantity) * Number(item.cost || 0))}</strong></div>)}</div>
          <dl className="supplier-receipt-totals"><div><dt>{tx("Mahsulotlar")}</dt><dd>{receiptDrafts.length} {tx("xil")} · {receiptDrafts.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0)} {tx("birlik")}</dd></div><div><dt>{tx("Jami summa")}</dt><dd>{moneyText(receiptTotal)}</dd></div><div className="receipt-cash"><dt>{tx("Naqd to'lov")}</dt><dd>{moneyText(receiptCash)}</dd></div><div className="receipt-debt"><dt>{tx("Qarzga yoziladi")}</dt><dd>{moneyText(receiptDebt)}</dd></div></dl>
          <p className="supplier-receipt-question">{tx("Ushbu ta'minotchidan mahsulotlarni ko'rsatilgan naqd to'lov va qarz bilan qabul qilishni tasdiqlaysizmi?")}</p>
          <div className="supplier-receipt-buttons"><button className="btn-ghost" onClick={() => setReceiptConfirmation(false)}>{tx("Bekor qilish")}</button><button className="btn-primary" onClick={addProductToSupplier}>{tx("Ha, qabul qilish")}</button></div>
        </div>
      </Modal>
      {receiptAnimation && createPortal(<PaymentSuccessAnimation {...receiptAnimation} title="Tovarlar qabul qilindi" />, document.getElementById("main-modal-root"))}
    </div>
  );
}
