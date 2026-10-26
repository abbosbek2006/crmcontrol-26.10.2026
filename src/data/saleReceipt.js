import { getTenantCompanyName } from "./tenantBrand";

const escapeHtml = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export function printSaleReceipt({ sale, payment, customer, seller, refundRecords, currency, companyName = getTenantCompanyName() }) {
  const popup = window.open("", "_blank", "width=900,height=800");
  if (!popup) return false;

  const money = (value) => escapeHtml(currency(value));
  const date = (value) => value && !Number.isNaN(new Date(value).getTime())
    ? escapeHtml(new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", year: "numeric", month: "long", day: "2-digit", hour: "2-digit", minute: "2-digit" }))
    : "—";
  const itemRows = (sale.items || []).map((item, index) => {
    const quantity = Number(item.qty ?? item.quantity ?? 0);
    const returnedQuantity = Number(item.returnedQuantity || 0);
    const unitPrice = Number(item.price || 0);
    const lineTotal = Number(item.total ?? unitPrice * quantity);
    const refundAmount = Number(item.refundAmount || 0);
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.name || "Mahsulot")}</strong><small>${escapeHtml(item.sku || item.code || "")}</small></td><td>${quantity}</td><td>${money(unitPrice)}</td><td>${money(lineTotal)}</td><td>${returnedQuantity ? `${returnedQuantity} dona · ${money(refundAmount)}` : "—"}</td></tr>`;
  }).join("");
  const quantityTotal = (sale.items || []).reduce((sum, item) => sum + Number(item.qty ?? item.quantity ?? 0), 0);
  const returnedTotal = (sale.items || []).reduce((sum, item) => sum + Number(item.returnedQuantity || 0), 0);
  const refundAmount = refundRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const discountAmount = Number(sale.discountAmount || 0);
  const subtotal = Number(sale.subtotal || (Number(sale.amount || 0) + refundAmount + discountAmount));
  const saleTotal = Number(sale.amount || 0) + refundAmount;
  const cardNumber = payment.receivingCard?.number || payment.cardLast4 || sale.cardLast4;
  const method = payment.method || sale.payment || sale.paymentMethod || "—";
  const remaining = Number(sale.debtBalance || 0);
  const paid = Number(sale.paidAmount ?? Math.max(0, Number(sale.amount || 0) - remaining));

  popup.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(companyName)} · Chek ${escapeHtml(sale.displayId || sale.id)}</title>
  <style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef2f8;color:#172033;font:14px/1.5 Arial,sans-serif}.sheet{max-width:860px;margin:32px auto;padding:42px;background:#fff;border:1px solid #e3e9f2;border-radius:18px;box-shadow:0 18px 48px #15233b18}.toolbar{display:flex;justify-content:flex-end;gap:10px;margin:0 auto 14px;max-width:860px}.toolbar button{border:0;border-radius:10px;padding:11px 16px;background:#285ee8;color:#fff;font-weight:700;cursor:pointer}.toolbar button+button{background:#e8edf6;color:#33415c}.brand{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding-bottom:22px;border-bottom:2px solid #1e293b}.eyebrow{color:#64748b;font-size:11px;font-weight:700;letter-spacing:.13em}h1{margin:5px 0;font-size:28px;letter-spacing:-.03em} .receipt-no{text-align:right}.receipt-no strong{display:block;font-size:17px}.muted,small{color:#69768d}.meta{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;margin:22px 0}.meta div{padding:12px 0;border-bottom:1px solid #e8edf3}.meta span{display:block;color:#69768d;font-size:11px;margin-bottom:3px}.meta strong{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f2f5fa;color:#56647b;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:11px 9px}td{padding:12px 9px;border-bottom:1px solid #e7ecf3;font-size:12px;vertical-align:top}td:first-child,td:nth-child(3){text-align:center}td:nth-child(n+4){text-align:right;white-space:nowrap}td small{display:block;margin-top:3px}.totals{width:min(380px,100%);margin:22px 0 0 auto}.totals div{display:flex;justify-content:space-between;gap:16px;padding:7px 0;color:#526078}.totals .grand{margin-top:6px;padding-top:13px;border-top:2px solid #1e293b;color:#172033;font-size:17px;font-weight:800}.totals .refund{color:#d44e55}.payment{margin-top:24px;padding:16px 18px;border:1px solid #e1e8f2;border-radius:14px;background:#f8faff}.payment h2{margin:0 0 8px;font-size:14px}.payment-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}.payment-grid span{color:#69768d}.footer{display:flex;justify-content:space-between;gap:16px;border-top:1px solid #e6ebf2;margin-top:28px;padding-top:14px;color:#69768d;font-size:11px}.stamp{color:#285ee8;font-weight:700}@media(max-width:600px){.sheet{margin:10px;padding:22px}.meta{grid-template-columns:1fr}.payment-grid{grid-template-columns:1fr}table{font-size:10px}th,td{padding:8px 5px}.toolbar{padding:0 10px}}@media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none}.toolbar{display:none}tr{break-inside:avoid}thead{display:table-header-group}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Chekni chop etish</button><button onclick="window.close()">Yopish</button></div>
  <main class="sheet"><header class="brand"><div><div class="eyebrow">${escapeHtml(companyName)} · SOTUV HUJJATI</div><h1>Sotuv cheki</h1><div class="muted">Mijoz xaridi va to‘lov tafsilotlari</div></div><div class="receipt-no"><span class="eyebrow">CHEK RAQAMI</span><strong>${escapeHtml(sale.displayId || sale.receiptNumber || sale.id)}</strong><span class="muted">${date(sale.createdAt || sale.date)}</span></div></header>
  <section class="meta"><div><span>Mijoz</span><strong>${escapeHtml(customer.name || sale.customer || sale.customerName)}</strong></div><div><span>Telefon</span><strong>${escapeHtml(customer.phone || sale.customerPhone || "—")}</strong></div><div><span>Sotgan xodim</span><strong>${escapeHtml(seller || "Xodim biriktirilmagan")}</strong></div><div><span>Sotuv sanasi</span><strong>${date(sale.createdAt || sale.date)}</strong></div><div><span>Sotuv raqami</span><strong>${escapeHtml(sale.displayId || sale.id)}</strong></div><div><span>Mahsulotlar soni</span><strong>${quantityTotal} dona · ${Number(sale.items?.length || 0)} xil</strong></div></section>
  <table><thead><tr><th>№</th><th>Mahsulot</th><th>Soni</th><th>Birlik narxi</th><th>Jami</th><th>Qaytarilgan</th></tr></thead><tbody>${itemRows || '<tr><td colspan="6">Mahsulotlar tafsiloti saqlanmagan</td></tr>'}</tbody></table>
  <section class="totals"><div><span>Mahsulotlar summasi</span><strong>${money(subtotal)}</strong></div>${discountAmount > 0 ? `<div><span>Chegirma</span><strong>− ${money(discountAmount)}</strong></div>` : ""}<div><span>Sotuv summasi</span><strong>${money(saleTotal)}</strong></div><div class="refund"><span>Qaytarilgan tovar puli · ${returnedTotal} dona</span><strong>− ${money(refundAmount)}</strong></div><div class="grand"><span>Yakuniy summa</span><strong>${money(sale.amount)}</strong></div><div><span>Jami to‘langan</span><strong>${money(paid)}</strong></div><div><span>Qolgan qarz</span><strong>${money(remaining)}</strong></div></section>
  <section class="payment"><h2>Ushbu to‘lov</h2><div class="payment-grid"><div><span>To‘lov summasi: </span><strong>${money(payment.amount)}</strong></div><div><span>Usuli: </span><strong>${escapeHtml(method)}</strong></div><div><span>Sana va vaqt: </span><strong>${date(payment.createdAt || payment.date)}</strong></div><div><span>Tranzaksiya raqami: </span><strong>${escapeHtml(payment.id)}</strong></div>${cardNumber ? `<div><span>Karta: </span><strong>${escapeHtml(String(cardNumber).replace(/\d(?=\d{4})/g, "•"))}</strong></div>` : ""}${refundRecords.length ? `<div><span>Qaytarishlar soni: </span><strong>${refundRecords.length} ta</strong></div>` : ""}</div></section>
  <footer class="footer"><span>Chek ${escapeHtml(companyName)} sotuv va qaytarish ma’lumotlari asosida tuzildi.</span><span class="stamp">Xaridingiz uchun rahmat!</span></footer></main></body></html>`);
  popup.document.close();
  popup.onload = () => { popup.focus(); popup.print(); };
  return true;
}
