const dayKey = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() + 18000000).toISOString().slice(0,10).replace(/-/g, "");
};
export function documentNumbers(records, type) {
  const prefix = type === "returns" ? "Q-" : type === "additional-pos" ? "P-" : "S-";
  const key = "crm_document_numbers_" + type;
  let numbers = {}; try { numbers = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  if (!numbers || typeof numbers !== "object" || Array.isArray(numbers)) numbers = {};
  const unique = [...new Map(records.map(record => [String(record.groupId || record.id), record])).values()];
  unique.sort((a,b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0)).forEach(record => {
    const id = String(record.groupId || record.id);
    if (numbers[id]) return;
    const day = dayKey(record.createdAt || record.date || Number(id.match(/\d{13}/)?.[0]));
    if (!day) { numbers[id] = id; return; }
    const numericId = id.replace(/^[SQ]-/, "");
    if (/^\d{9,}$/.test(numericId) && numericId.startsWith(day)) { numbers[id] = numericId; return; }
    const used = new Set(Object.values(numbers));
    unique.filter(item => String(item.groupId || item.id).replace(/^[SQ]-/, "").startsWith(day)).forEach(item => used.add(String(item.groupId || item.id).replace(/^[SQ]-/, "")));
    let sequence = 1; while (used.has(prefix + day + sequence)) sequence++;
    numbers[id] = day + sequence;
  });
  try { localStorage.setItem(key, JSON.stringify(numbers)); } catch {}
  return Object.fromEntries(Object.entries(numbers).map(([id,number]) => [id, prefix + String(number).replace(/^[SQ]-/, "")]));
}
export function nextDocumentNumber(records, type, now = new Date()) {
  const prefix = type === "returns" ? "Q-" : type === "additional-pos" ? "P-" : "S-";
  const day = dayKey(now), used = new Set(Object.values(documentNumbers(records,type)));
  let sequence = 1; while (used.has(prefix + day + sequence)) sequence++;
  return prefix + day + sequence;
}

export function migrateDocumentIds() {
  const keys=["crm_sales","crm_returns","crm_debt_payments_v1","crm_customers"];
  const before={}, values={};
  try {
    for(const key of keys){before[key]=localStorage.getItem(key);values[key]=JSON.parse(before[key]||"[]");}
    const sales=Array.isArray(values.crm_sales)?values.crm_sales:[], returns=Array.isArray(values.crm_returns)?values.crm_returns:[];
    const saleMap=documentNumbers(sales,"sales"), returnMap=documentNumbers(returns,"returns");
    const mappings={...saleMap,...returnMap};
    returns.forEach(line=>{if(line.groupId && line.id!==line.groupId)mappings[line.id]=returnMap[line.groupId]+String(line.id).slice(String(line.groupId).length);});
    const replace=value=>{if(typeof value==="string")return mappings[value]||value;if(Array.isArray(value))return value.map(replace);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,replace(item)]));return value;};
    const changed=keys.filter(key=>before[key] && JSON.stringify(replace(values[key]))!==before[key]);
    if(!changed.length)return;
    localStorage.setItem("crm_document_id_backup",JSON.stringify(before));
    try{for(const key of changed)localStorage.setItem(key,JSON.stringify(replace(values[key])));}catch(error){for(const key of changed)if(before[key]!=null)localStorage.setItem(key,before[key]);throw error;}
  } catch { /* Keep original references when storage is unavailable. */ }
}
