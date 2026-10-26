import { createReportPdf } from "../locales/reportPdf";
import * as XLSX from "xlsx";
import { getTenantCompanyName } from "./tenantBrand";
export function printReturnReceipt(record, statusLabel) {
  const popup = window.open("", "_blank", "width=900,height=800");
  if (!popup) return false;
  const companyName = getTenantCompanyName();
  const escape = value => String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const money = value => Number(value || 0).toLocaleString("en-US") + " so‘m";
  const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) : "—";
  const rows = record.lines.map((line,index) => '<tr><td>' + (index+1) + '</td><td><b>' + escape(line.product) + '</b><small>' + escape(line.reason) + '</small></td><td>' + escape(line.quantity ?? "—") + '</td><td>' + money(line.unitPrice ?? (line.quantity ? line.amount / line.quantity : 0)) + '</td><td>' + money(line.amount) + '</td></tr>').join("");
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escape(companyName) + ' · ' + escape(record.id) + '</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;line-height:1.5}header{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:24px;margin-bottom:28px}.brand{font-size:12px;letter-spacing:2px;color:#64748b}h1{font-size:28px;margin:8px 0}small{display:block;color:#64748b;font-size:11px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}.meta div{padding-bottom:12px;border-bottom:1px solid #e2e8f0}.meta b{display:block;margin-top:4px}table{width:100%;border-collapse:collapse}th{text-align:left;background:#f1f5f9;color:#475569;font-size:11px;padding:12px}td{font-size:12px;padding:14px 12px;border-bottom:1px solid #e2e8f0}td:nth-child(n+3){white-space:nowrap}.total{text-align:right;margin-top:24px;padding:20px;background:#f8fafc}.total strong{display:block;font-size:25px}footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:11px;color:#64748b}thead{display:table-header-group}tr{break-inside:avoid}@media screen{body{max-width:800px;margin:40px auto;padding:24px}}</style></head><body><header><div><div class="brand">' + escape(companyName) + ' · QAYTARISHLAR</div><h1>Qaytarish cheki</h1><small>' + escape(record.id) + '</small></div><div>' + escape(statusLabel) + '<small>' + escape(date(record.date)) + '</small></div></header><section class="meta"><div><small>Mijoz</small><b>' + escape(record.customer) + '</b></div><div><small>Sotuv raqami</small><b>' + escape(record.saleId) + '</b></div><div><small>Xarid sanasi va vaqti</small><b>' + escape(date(record.purchaseDate)) + '</b></div><div><small>Manzil</small><b>' + escape(record.deliveryAddress) + '</b></div></section><table><thead><tr><th>#</th><th>Mahsulot / qaytarish sababi</th><th>Miqdor</th><th>Birlik narxi</th><th>Summa</th></tr></thead><tbody>' + rows + '</tbody></table><div class="total"><small>Jami qaytarish summasi · ' + record.lines.length + ' xil mahsulot</small><strong>' + money(record.amount) + '</strong></div><footer>Holat: ' + escape(statusLabel) + '. Ushbu chek ' + escape(companyName) + ' tizimida qayd etilgan qaytarish ma’lumotlarini ko‘rsatadi.<br>Hujjat shakllantirilgan vaqt: ' + escape(date(new Date())) + '</footer></body></html>');
  popup.document.close(); popup.onload = () => { popup.focus(); popup.print(); };
  return true;
}

const documentDate = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) : "—";
export function returnReceiptRows(record, statusLabel) {
  return [
    [getTenantCompanyName()],
    ["QAYTARISH CHEKI", record.id],
    ["Mijoz", record.customer], ["Sotuv ID", record.saleId],
    ["Qaytarish sanasi", documentDate(record.date)], ["Xarid sanasi", documentDate(record.purchaseDate)],
    ["Manzil", record.deliveryAddress || "—"], ["Holat", statusLabel], [],
    ["№", "Mahsulot", "Miqdor", "Birlik narxi (so‘m)", "Summa (so‘m)", "Sabab"],
    ...record.lines.map((line,index) => [index+1,line.product,Number(line.quantity || 0),Number(line.unitPrice ?? (line.quantity ? line.amount/line.quantity : 0)),Number(line.amount || 0),line.reason]),
    ["", "Jami", record.lines.reduce((sum,line)=>sum+Number(line.quantity||0),0), "", Number(record.amount || 0)],
  ];
}
export function downloadReturnExcel(record, statusLabel) {
  const rows = returnReceiptRows(record,statusLabel), sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{wch:25},{wch:40},{wch:18},{wch:25},{wch:25},{wch:45}];
  sheet["!autofilter"] = { ref: "A10:F" + (10 + record.lines.length) };
  for (let row=11; row<11+record.lines.length; row++) for(const col of ["D","E"]) sheet[col+row].z = '#,##0.00';
  const totalRow = 11 + record.lines.length;
  sheet["E"+totalRow] = {t:"n",v:Number(record.amount||0),f:"SUM(E11:E"+(totalRow-1)+")",z:'#,##0.00'};
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,"Qaytarish cheki");
  XLSX.writeFile(book,"Qaytarish-"+record.id+".xlsx");
}
export function downloadReturnPdf(record,statusLabel) {
  const companyName = getTenantCompanyName();
  const lines = [{t:companyName+"  /  QAYTARISHLAR",s:11,b:true},{t:"Qaytarish cheki",s:24,b:true},{t:"Hujjat № "+record.id,s:12,b:true},{t:"",s:12}];
  returnReceiptRows(record,statusLabel).slice(2,8).forEach(row=>lines.push({t:row[0]+": "+row[1],s:12}));
  lines.push({t:"",s:12},{t:"QAYTARILGAN MAHSULOTLAR",s:13,b:true});
  const wrap = text => { const words=String(text).split(/\s+/),result=[];let line="";for(const word of words){if((line+" "+word).length>85 && line){result.push(line);line="";}line+=(line?" ":"")+word;}if(line)result.push(line);return result; };
  record.lines.forEach((item,index)=>{
    wrap((index+1)+". "+item.product).forEach(t=>lines.push({t,s:13,b:true}));
    lines.push({t:"Miqdor: "+(item.quantity??"—")+"  |  Birlik narxi: "+Number(item.unitPrice??(item.quantity?item.amount/item.quantity:0)).toLocaleString("en-US")+" so‘m",s:11});
    wrap("Sabab: "+item.reason).forEach(t=>lines.push({t,s:11}));
    lines.push({t:"Summa: "+Number(item.amount||0).toLocaleString("en-US")+" so‘m",s:12,b:true},{t:"",s:11});
  });
  lines.push({t:"JAMI: "+Number(record.amount||0).toLocaleString("en-US")+" so‘m",s:18,b:true},{t:"Holat: "+statusLabel,s:11},{t:companyName+" qayd etgan qaytarish hujjati. "+documentDate(new Date()),s:10});
  const url=URL.createObjectURL(createReportPdf(lines)),link=document.createElement("a");link.href=url;link.download="Qaytarish-"+record.id+".pdf";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
