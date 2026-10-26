export function reportDay(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() + 18000000).toISOString().slice(0,10);
}
export function filterReportPeriod(data, range, now = new Date()) {
  const count = { today:1, week:7, month:30, quarter:90, year:365 }[range] || 30;
  const end = new Date(reportDay(now) + "T00:00:00Z");
  const buckets = new Map();
  for(let offset=count-1; offset>=0; offset--) {
    const date=new Date(end); date.setUTCDate(date.getUTCDate()-offset);
    const day=date.toISOString().slice(0,10);
    buckets.set(day,{date:day,revenue:0,profit:0,expenses:0});
  }
  data.forEach(item=>{const bucket=buckets.get(item.date);if(!bucket)return;for(const key of ["revenue","profit","expenses"])bucket[key]+=Number(item[key]||0);});
  return [...buckets.values()];
}
