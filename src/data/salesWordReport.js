import { reportDay } from "./reportPeriod";
import { getTenantCompanyName } from "./tenantBrand";

const pad = value => String(value).padStart(2, "0");
const makeDay = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

export function salesReportWeeks(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const firstMondayOffset = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - firstMondayOffset);
  const weeks = [];

  while (cursor <= last) {
    const start = new Date(Math.max(cursor.getTime(), first.getTime()));
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 6);
    if (end > last) end.setTime(last.getTime());
    weeks.push({
      week: weeks.length + 1,
      start: makeDay(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
      end: makeDay(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

export function salesPeriodRange(period, now = new Date()) {
  if (!period || period.type === "today") {
    const today = reportDay(now);
    return { start: today, end: today };
  }

  const { type, year, month } = period;
  if (type === "year") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (type === "month") {
    const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: makeDay(year, month, 1), end: makeDay(year, month, end) };
  }
  if (type === "week") {
    const selectedWeek = salesReportWeeks(Number(year), Number(month))[Number(period.week) - 1];
    return selectedWeek || { start: "", end: "" };
  }
  return { start: "", end: "" };
}

export function salesForPeriod(sales, period, now = new Date()) {
  const { start, end } = salesPeriodRange(period, now);
  const today = reportDay(now);
  return sales.filter(sale => {
    const day = reportDay(sale.createdAt || sale.date);
    return day && day >= start && day <= end && day <= today;
  });
}

const periodTitle = period => ({ today: "Bugungi", week: "Haftalik", month: "Oylik", year: "Yillik" }[period?.type || period] || "Sotuv");
const displayDay = day => day ? new Date(`${day}T00:00:00Z`).toLocaleDateString("uz-UZ", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }) : "—";
const xml = value => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const paragraph = (text, size = 22, bold = false, color = "172033") => '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:sz w:val="' + size + '"/><w:color w:val="' + color + '"/>' + (bold ? '<w:b/>' : '') + '</w:rPr><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r></w:p>';

// DOCX uses a standard uncompressed ZIP container (UTF-8 XML).
function zip(files) {
  const encoder = new TextEncoder(), chunks = [], central = [];
  let offset = 0;
  const crc = bytes => {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  };
  for (const [name, content] of Object.entries(files)) {
    const path = encoder.encode(name), data = encoder.encode(content), checksum = crc(data);
    const header = new Uint8Array(30 + path.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint32(14, checksum, true);
    view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, path.length, true);
    header.set(path, 30); chunks.push(header, data);
    const directory = new Uint8Array(46 + path.length), dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true);
    dv.setUint32(16, checksum, true); dv.setUint32(20, data.length, true); dv.setUint32(24, data.length, true);
    dv.setUint16(28, path.length, true); dv.setUint32(42, offset, true); directory.set(path, 46);
    central.push(directory); offset += header.length + data.length;
  }
  const length = central.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, central.length, true); view.setUint16(10, central.length, true);
  view.setUint32(12, length, true); view.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export function createSalesWord(sales, period, now = new Date(), companyName = getTenantCompanyName()) {
  const label = periodTitle(period), { start, end } = salesPeriodRange(period, now);
  const money = value => Number(value || 0).toLocaleString("en-US") + " so‘m";
  const total = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const debt = sales.reduce((sum, sale) => sum + Number(sale.debtBalance || 0), 0);
  let body = paragraph(companyName + "  /  SOTUVLAR", 20, true, "64748B") + paragraph(label + " sotuv hisoboti", 40, true);
  body += paragraph("Hisobot davri: " + displayDay(start) + (start !== end ? " — " + displayDay(end) : ""), 22, false, "64748B");
  body += paragraph("Shakllantirilgan sana: " + now.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }), 20, false, "64748B");
  body += paragraph("UMUMIY KO‘RSATKICHLAR", 24, true) + paragraph("Sotuvlar soni: " + sales.length);
  body += paragraph("Jami savdo: " + money(total), 26, true) + paragraph("To‘langan: " + money(total - debt));
  body += paragraph("Qolgan qarz: " + money(debt), 22, true, "DC2626") + paragraph("SOTUVLAR TAFSILOTI", 26, true);
  const cell = text => '<w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>' + paragraph(text, 18) + '</w:tc>';
  const headings = ["Sotuv / sana", "Mijoz", "Mahsulotlar", "Jami summa", "Qarz"];
  body += '<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"].map(edge => '<w:' + edge + ' w:val="single" w:sz="4" w:color="E2E8F0"/>').join("") + '</w:tblBorders></w:tblPr><w:tblGrid>' + headings.map(() => '<w:gridCol w:w="1900"/>').join("") + '</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>' + headings.map(cell).join("") + '</w:tr>';
  sales.forEach(sale => {
    const date = new Date(sale.createdAt || sale.date).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
    body += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + [(sale.displayId || sale.id) + " / " + date, sale.customer, (sale.items || []).map(item => item.name + " × " + (item.qty ?? item.quantity ?? 0)).join("; ") || sale.products + " xil", money(sale.amount), money(sale.debtBalance)].map(cell).join("") + '</w:tr>';
  });
  body += '</w:tbl>' + paragraph(sales.length ? "Summalar saqlangan sotuvlar va joriy qarz qoldiqlari asosida hisoblandi." : "Tanlangan davrda sotuvlar qayd etilmagan.", 20, false, "64748B");
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>',
  });
}
