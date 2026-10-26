import Modal from "../components/Modal";
import { createSalesWord, salesForPeriod, salesReportWeeks } from "../data/salesWordReport";
import { formatCardNumber } from "../data/directorCards";
import { translateText as tx } from "../locales/translateText";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import { createPortal } from "react-dom";
import "./Sales.css";
import { useState } from "react";
import {
  Search,
  Download,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { readDebtPayments, readPosSales, withDebtBalance } from "../data/debtPayments";
import DateRangeFilter, { matchesDateRange } from "../components/DateRangeFilter";
import SalesProductFilter from "../components/SalesProductFilter";
import { normalizeProductText, saleMatchesProduct } from "../data/salesProductFilter";
import { reportDay } from "../data/reportPeriod";

import { formatCurrency } from "../data/currency";
const statusBadge = {
  paid: {
    label: "To'landi",
    bg: "var(--success-light)",
    color: "var(--success)",
  },

  debt: {
    label: "Qarz",
    bg: "var(--danger-light)",
    color: "var(--danger)",
  },

  partial: {
    label: "Qisman",
    bg: "var(--warning-light)",
    color: "var(--warning)",
  },

  returned: {
    label: "Qaytarilgan",
    bg: "var(--border-subtle)",
    color: "var(--text-muted)",
  },
};

export default function Sales({ onNavigate }) {
  const { lang } = useUILanguage();
  const [sales, setSales] = useState(() => {
    const payments = readDebtPayments();
    return [...readPosSales()].map((sale) => withDebtBalance(sale, payments));
  });

  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState({ category: "", product: null, query: "" });
  const [productCatalog] = useState(() => {
    let stored = [];
    try { const parsed = JSON.parse(localStorage.getItem("crm_products") || "[]"); if (Array.isArray(parsed)) stored = parsed; } catch { /* Empty catalog */ }
    const catalog = new Map();
    [...stored, ...sales.flatMap((sale) => sale.items || [])].forEach((product) => {
      const key = product.id != null ? String(product.id) : normalizeProductText(product.name);
      if (product.name && !catalog.has(key)) catalog.set(key, product);
    });
    return [...catalog.values()];
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [deleteSale, setDeleteSale] = useState(null);

  const [editSale, setEditSale] = useState(null);

  const openCustomerProfile = (sale) => {
    const name = sale.customer.trim();
    const sameName = (customer) =>
      customer.name.trim().toLowerCase() === name.toLowerCase();
    const customerSales = sales.filter((item) => sameName({ name: item.customer }));
    const debtAmount = customerSales
      .reduce((sum, item) => sum + Number(item.debtBalance || 0), 0);
    const saleCustomer = {
      name,
      phone: "—",
      region: "—",
      purchases: customerSales.length,
      spent: customerSales.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      debt: debtAmount,
      lastPurchase: sale.date,
      status: debtAmount > 0 ? "debtor" : "regular",
      sales: customerSales,
      selectedSaleId: sale.id,
      initialTab: Number(sale.debtBalance || 0) > 0 ? "debt" : "purchases",
    };
    onNavigate?.(`customer-sale-${encodeURIComponent(JSON.stringify(saleCustomer))}`);
  };

  /* ================= FILTER ================= */

  const filtered = sales.filter((sale) => {
    const searchText = normalizeProductText(search);

    const matchSearch =
      [sale.customer, sale.displayId, sale.id, sale.receiptNumber, ...(sale.items || []).flatMap((item) => [item.id, item.sku, item.name, item.category])].some((value) => (normalizeProductText(value).startsWith(searchText) || normalizeProductText(value).replace(/^[sq]-/, "").startsWith(searchText)));

    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "debt"
        ? Number(sale.debtBalance || 0) > 0
        : sale.status === statusFilter);

    return matchSearch && matchStatus && saleMatchesProduct(sale, productCatalog, productFilter) && matchesDateRange(sale.createdAt || sale.date, dateFrom, dateTo);
  });

  /* ================= DELETE ================= */

  const handleDelete = () => {
    if (!deleteSale) return;

    setSales((prev) =>
      prev.filter((sale) => sale.id !== deleteSale.id)
    );

    setDeleteSale(null);
  };

  /* ================= EDIT ================= */

  const handleEditSave = () => {
    if (!editSale) return;

    setSales((prev) =>
      prev.map((sale) =>
        sale.id === editSale.id ? editSale : sale
      )
    );

    setEditSale(null);
  };

  /* ================= EXPORT ================= */

  const handleExport = async period => {
    setExportBusy(true);
    setExportError("");
    try {
      const rows = salesForPeriod(sales, period), blob = createSalesWord(rows, period);
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      const rangeName = period.type === "month" ? `${period.year}-${String(period.month).padStart(2, "0")}` : period.type === "week" ? `${period.year}-${String(period.month).padStart(2, "0")}-hafta-${period.week}` : period.type === "year" ? String(period.year) : "bugungi";
      link.href = url;
      link.download = `Sotuv-hisoboti-${rangeName}.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportOpen(false);
      setSelectedReport(null);
    } catch { setExportError("Hisobot tayyorlanmadi. Qayta urinib ko‘ring."); }
    finally { setExportBusy(false); }
  };

  /* ================= STATS ================= */

  const returns = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("crm_returns") || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item.status === "approved") : [];
    } catch { return []; }
  })();
  const adjustedSales = sales.map((sale) => {
    const returnedAmount = returns
      .filter((item) => String(item.saleId) === String(sale.id))
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    return { ...sale, returnedAmount, netAmount: Math.max(0, Number(sale.amount || 0) - returnedAmount) };
  });
  const totalSalesAmount = adjustedSales.reduce((total, sale) => total + sale.netAmount, 0);
  const today = new Date().toDateString();
  const todaySalesAmount = adjustedSales
    .filter((sale) => {
      const date = new Date(sale.createdAt || sale.date);
      return !Number.isNaN(date.getTime()) && date.toDateString() === today;
    })
    .reduce((total, sale) => total + sale.netAmount, 0);
  const totalReturnedAmount = returns.reduce((total, item) => total + Number(item.amount || 0), 0);

  const stats = [
    {
      label: "Jami sotuvlar",
      value: formatCurrency(totalSalesAmount),
      change: "0%",
      icon: DollarSign,
      color: "var(--brand)",
      bg: "var(--brand-light)",
    },

    {
      label: "Bugun",
      value: formatCurrency(todaySalesAmount),
      change: "0%",
      icon: TrendingUp,
      color: "var(--success)",
      bg: "var(--success-light)",
    },

    {
      label: "Buyurtmalar",
      value: `${sales.length} ta`,
      change: "0%",
      icon: ShoppingCart,
      color: "var(--violet)",
      bg: "var(--violet-light)",
    },

    {
      label: "Qaytarilgan",
      value: formatCurrency(totalReturnedAmount),
      change: "0%",
      icon: RefreshCw,
      color: "var(--warning)",
      bg: "var(--warning-light)",
    },
  ];

  const currentReportDay = reportDay(new Date());
  const currentReportYear = Number(currentReportDay.slice(0, 4));
  const currentReportMonth = Number(currentReportDay.slice(5, 7));
  const currentReportWeek = salesReportWeeks(currentReportYear, currentReportMonth)
    .find(item => item.start <= currentReportDay && item.end >= currentReportDay)?.week || 1;

  return (
    <div className="space-y-6 fade-in">

      {/* ================= HEADER ================= */}

      <div className="flex items-center justify-between flex-wrap gap-4">

        <div>
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: "'Manrope', sans-serif",
              color: "var(--text-primary)",
            }}
          >{tx("Sotuvlar")}</h1>

          <p
            className="text-sm mt-1"
            style={{
              color: "var(--text-muted)",
            }}
          >{tx("Barcha savdolar va tranzaksiyalar")}</p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => { setExportError(""); setSelectedReport(null); setExportOpen(true); }}
            className="sales-header-btn"
          >
            <Download size={15} />{tx("Export")}</button>

          <button
            onClick={() => onNavigate("sales-new")}
            className="sales-new-btn"
          >{tx("+ Yangi sotuv")}</button>

        </div>
      </div>

      {/* ================= STATS ================= */}

      <div className="sales-stats-grid">

        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="sales-stat-card"
            >

              <div className="sales-stat-top">

                <div
                  className="sales-stat-icon"
                  style={{
                    background: stat.bg,
                  }}
                >
                  <Icon
                    size={17}
                    style={{
                      color: stat.color,
                    }}
                  />
                </div>

                <span
                  className="sales-stat-change"
                  style={{
                    color: stat.change.startsWith("+")
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                >
                  {tx(stat.change)}
                </span>

              </div>

              <div className="sales-stat-value">
                {tx(stat.value)}
              </div>

              <div className="sales-stat-label">
                {tx(stat.label)}
              </div>

            </div>
          );
        })}

      </div>

      {/* ================= TABLE ================= */}

      <div className="sales-table-box">

        {/* SEARCH */}

        <div className="sales-toolbar flex-wrap">

          <div className="sales-search">

            <Search
              size={15}
              style={{
                color: "var(--text-faint)",
              }}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value.replace(/(^|\s)(\S)/g, (_, space, letter) => space + letter.toLocaleUpperCase("uz-UZ")))
              }
              placeholder={tx("Sotuv yoki mijoz qidirish...")}
            />

          </div>

          <SalesProductFilter products={productCatalog} value={productFilter} onChange={setProductFilter} />
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

          <div className="sales-filters">

            {[
              ["all", "Barchasi"],
              ["paid", "To'landi"],
              ["debt", "Qarz"],
              ["partial", "Qisman"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() =>
                  setStatusFilter(key)
                }
                className={
                  statusFilter === key
                    ? "sales-filter active"
                    : "sales-filter"
                }
              >
                {tx(label)}
              </button>
            ))}

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[950px]">

            <thead>
              <tr className="sales-table-head">

                {[
                  "Sotuv ID",
                  "Mijoz",
                  "Mahsulotlar",
                  "Summa",
                  "To'lov",
                  "Sana",
                  "Holat",
                  "Amallar",
                ].map((title) => (
                  <th key={title}>
                    {tx(title)}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {filtered.map((sale) => {

                const status =
                  statusBadge[sale.status];

                return (
                  <tr
                    key={sale.id}
                    className="sales-table-row sales-table-row-link"
                    role="link"
                    tabIndex={0}
                    aria-label={tx(`${sale.customer} profilini ochish`)}
                    onClick={() => openCustomerProfile(sale)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCustomerProfile(sale);
                      }
                    }}
                  >

                    <td className="sales-id">
                      {sale.displayId || sale.id}
                    </td>

                    <td>
                      <div className="sales-customer">

                        <div className="sales-avatar">
                          {tx(sale.customer
                            .split(" ")
                            .map((name) => name[0])
                            .join("")
                            .slice(0, 2))}
                        </div>

                        <span>
                          {sale.customer}
                        </span>

                      </div>
                    </td>

                    <td className="sales-muted">
                      {tx(sale.products)}{tx(" ta")}</td>

                    <td className="sales-amount">
                      {formatCurrency(sale.amount)}</td>

                    <td className="sales-muted">
                      {tx(sale.payment)}
                      {sale.receivingCard && <small style={{ display: "block" }}>{formatCardNumber(sale.receivingCard.number)}<br />{formatCurrency(sale.initialPaidAmount ?? sale.paidAmount ?? 0)}</small>}
                    </td>

                    <td className="sales-date">
                      {tx(sale.date)}
                    </td>

                    <td>
                      <span
                        className="sales-status"
                        style={{
                          background: status.bg,
                          color: status.color,
                        }}
                      >
                        {tx(status.label)}
                      </span>
                    </td>

                    {/* ACTIONS */}

                    <td>

                      <div className="sales-actions">

                        {/* EDIT */}

                        <button
                          type="button"
                          className="sales-action edit"
                          title={tx("Tahrirlash")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditSale({
                              ...sale,
                            });
                          }}
                        >
                          <Pencil size={14} />
                        </button>

                        {/* DELETE */}

                        <button
                          type="button"
                          className="sales-action delete"
                          title={tx("O'chirish")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteSale(sale);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                      </div>

                    </td>

                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td
                    colSpan="8"
                    className="sales-empty"
                  >{tx("Sotuvlar topilmadi")}</td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div className="sales-footer">

          <span>{tx("Jami ")}{tx(filtered.length)}{tx(" ta sotuv")}</span>

          <div className="sales-pagination">

            {[1, 2, 3, "...", 12].map(
              (page, index) => (
                <button
                  key={index}
                  className={
                    page === 1
                      ? "active"
                      : ""
                  }
                >
                  {tx(page)}
                </button>
              )
            )}

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* DELETE MODAL */}
      {/* ================================================= */}

      {deleteSale && (

        createPortal(
        <div className="crm-content-modal">

          <div
            className="sales-delete-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="delete-modal-icon">
              <AlertTriangle size={19} />
            </div>

            <button
              type="button"
              className="modal-x"
              onClick={() =>
                setDeleteSale(null)
              }
            >
              <X size={16} />
            </button>

            <h3>{tx("Sotuvni o'chirasizmi?")}</h3>

            <p>
              <b>{deleteSale.id}</b>{tx(" sotuvini o'chirishni tasdiqlaysizmi?")}</p>

            <div className="modal-buttons">

              <button
                type="button"
                className="modal-no"
                onClick={() =>
                  setDeleteSale(null)
                }
              >{tx("Yo'q")}</button>

              <button
                type="button"
                className="modal-yes"
                onClick={handleDelete}
              >{tx("Ha, o'chirish")}</button>

            </div>

          </div>

        </div>,
        document.getElementById("main-modal-root")
      )

      )}

      {/* ================================================= */}
      {/* EDIT MODAL */}
      {/* ================================================= */}

      {editSale && (

        createPortal(
        <div className="crm-content-modal">

          <div
            className="sales-edit-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="edit-modal-header">

              <div>
                <h3>{tx("Sotuvni tahrirlash")}</h3>

                <span>
                  {editSale.id}
                </span>
              </div>

              <button
                type="button"
                className="modal-x"
                onClick={() =>
                  setEditSale(null)
                }
              >
                <X size={16} />
              </button>

            </div>

            <div className="edit-fields">

              <div className="edit-field full">
                <label>{tx("Mijoz")}</label>

                <input
                  value={editSale.customer}
                  onChange={(e) =>
                    setEditSale({
                      ...editSale,
                      customer:
                        e.target.value,
                    })
                  }
                />
              </div>

              <div className="edit-field">
                <label>{tx("Mahsulotlar")}</label>

                <input
                  type="number"
                  min="1"
                  value={editSale.products}
                  onChange={(e) =>
                    setEditSale({
                      ...editSale,
                      products:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                />
              </div>

              <div className="edit-field">
                <label>{tx("Summa")}</label>

                <input
                  type="number"
                  min="0"
                  value={editSale.amount}
                  onChange={(e) =>
                    setEditSale({
                      ...editSale,
                      amount:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                />
              </div>

              <div className="edit-field">
                <label>{tx("To'lov")}</label>

                <select
                  value={editSale.payment}
                  onChange={(e) =>
                    setEditSale({
                      ...editSale,
                      payment:
                        e.target.value,
                    })
                  }
                >
                  <option value="Naqd">{tx("Naqd")}</option>

                  <option value="Karta">{tx("Karta")}</option>

                  <option value="Payme">
                    Payme
                  </option>

                  <option value="Click">
                    Click
                  </option>

                  <option value="Qarz">{tx("Qarz")}</option>
                </select>
              </div>

              <div className="edit-field">
                <label>{tx("Holat")}</label>

                <select
                  value={editSale.status}
                  onChange={(e) =>
                    setEditSale({
                      ...editSale,
                      status:
                        e.target.value,
                    })
                  }
                >
                  <option value="paid">{tx("To'landi")}</option>

                  <option value="debt">{tx("Qarz")}</option>

                  <option value="partial">{tx("Qisman")}</option>

                  <option value="returned">{tx("Qaytarilgan")}</option>
                </select>
              </div>

            </div>

            <div className="edit-modal-footer">

              <button
                type="button"
                className="modal-no"
                onClick={() =>
                  setEditSale(null)
                }
              >{tx("Bekor qilish")}</button>

              <button
                type="button"
                className="modal-save"
                onClick={handleEditSave}
              >{tx("Saqlash")}</button>

            </div>

          </div>

        </div>,
        document.getElementById("main-modal-root")
      )

      )}

    <Modal open={exportOpen} onClose={() => { if (!exportBusy) { setExportOpen(false); setSelectedReport(null); } }} title="Sotuv hisobotini yuklash" subtitle="Davrni tanlang · Word hujjati" icon={Download} width={520} contentOnly>
      <div className="sales-export-options">
        {[
          { type: "today", title: "Bugungi hisobot", desc: "Bugun amalga oshirilgan sotuvlar", period: { type: "today" } },
          { type: "week", title: "Haftalik hisobot", desc: "Oy va hafta oralig‘ini tanlang", period: { type: "week", year: currentReportYear, month: currentReportMonth, week: currentReportWeek } },
          { type: "month", title: "Oylik hisobot", desc: "Yil va oyni tanlang", period: { type: "month", year: currentReportYear, month: currentReportMonth } },
          { type: "year", title: "Yillik hisobot", desc: "Kerakli yilni tanlang", period: { type: "year", year: currentReportYear } },
        ].map(option => (
          <button disabled={exportBusy} key={option.type} className={selectedReport?.type === option.type ? "is-selected" : ""} onClick={() => option.type === "today" ? handleExport(option.period) : setSelectedReport(previous => previous?.type === option.type ? previous : option.period)}>
            <span className="sales-export-icon"><Download size={20} /></span>
            <span><b>{tx(option.title)}</b><small>{tx(option.desc)}</small></span>
            <strong>{salesForPeriod(sales, selectedReport?.type === option.type ? selectedReport : option.period).length}<small>{tx("ta sotuv")}</small></strong>
          </button>
        ))}
      </div>
      {selectedReport && (
        <div className="sales-export-period">
          <label>
            <span>{tx("Yil")}</span>
            <select value={selectedReport.year} onChange={event => setSelectedReport(current => ({ ...current, year: Number(event.target.value), week: 1 }))}>
              {Array.from({ length: currentReportYear - 1999 }, (_, index) => currentReportYear - index).map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          {(selectedReport.type === "week" || selectedReport.type === "month") && (
            <label>
              <span>{tx("Oy")}</span>
              <select value={selectedReport.month} onChange={event => setSelectedReport(current => ({ ...current, month: Number(event.target.value), week: 1 }))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(month => <option key={month} value={month}>{new Date(Date.UTC(2024, month - 1, 1)).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "long", timeZone: "UTC" })}</option>)}
              </select>
            </label>
          )}
          {selectedReport.type === "week" && (
            <label>
              <span>{tx("Hafta")}</span>
              <select value={selectedReport.week} onChange={event => setSelectedReport(current => ({ ...current, week: Number(event.target.value) }))}>
                {salesReportWeeks(selectedReport.year, selectedReport.month).map(({ week, start, end }) => <option key={week} value={week}>{week}{lang === "ru" ? "-я неделя ·" : "-hafta ·"} {Number(start.slice(8))}–{Number(end.slice(8))} {new Date(Date.UTC(selectedReport.year, selectedReport.month - 1, 1)).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "long", timeZone: "UTC" })}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="sales-export-download" disabled={exportBusy} onClick={() => handleExport(selectedReport)}>
            <Download size={16} />{tx(exportBusy ? "Tayyorlanmoqda…" : `Hisobotni yuklash · ${salesForPeriod(sales, selectedReport).length} ta sotuv`)}
          </button>
        </div>
      )}
      {exportError && <p role="alert" className="text-danger-color">{exportError}</p>}
    </Modal>
    </div>
  );
}
