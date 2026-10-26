export const fmt = (n) => {
  if (n === null || n === undefined) {
    return "0";
  }

  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + " mln";
  }

  if (n >= 1000) {
    return (n / 1000).toFixed(0) + " ming";
  }

  return n.toLocaleString();
};

export const statusVisual = {
  paid: {
    bg: "var(--success-light)",
    color: "var(--success)",
  },

  debt: {
    bg: "var(--danger-light)",
    color: "var(--danger)",
  },

  partial: {
    bg: "var(--warning-light)",
    color: "var(--warning)",
  },

  returned: {
    bg: "var(--border-subtle)",
    color: "var(--text-muted)",
  },
};

export const stockVisual = {
  critical: {
    bg: "var(--danger-light)",
    color: "var(--danger)",
  },

  low: {
    bg: "var(--warning-light)",
    color: "var(--warning)",
  },

  ok: {
    bg: "var(--success-light)",
    color: "var(--success)",
  },
};

// Daily buckets for short periods; monthly buckets for the last year.
export function buildSalesChart(sales, range, now = new Date()) {
  const day = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  };
  const today = day(now);
  const monthly = range === "1y";
  const count = monthly ? 12 : ({ "7d": 7, "30d": 30, "3m": 90 }[range] || 7);
  const end = new Date(today + "T00:00:00Z");
  const buckets = new Map();
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(end);
    if (monthly) { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - offset); }
    else date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, monthly ? 7 : 10);
    const label = monthly ? key.slice(5) + "." + key.slice(0, 4) : key.slice(8) + "." + key.slice(5, 7);
    buckets.set(key, { date: label, revenue: 0, profit: 0, expenses: 0 });
  }
  for (const sale of sales) {
    const saleDay = day(sale.createdAt || sale.date);
    if (!saleDay || saleDay > today || new Date(sale.createdAt || sale.date) > now) continue;
    const bucket = buckets.get(monthly ? saleDay.slice(0, 7) : saleDay);
    if (!bucket) continue;
    const revenue = Number(sale.netAmount || 0);
    const expenses = Number(sale.netCost || 0);
    bucket.revenue += revenue;
    bucket.expenses += expenses;
    bucket.profit += Math.max(0, revenue - expenses);
  }
  return [...buckets.values()];
}
