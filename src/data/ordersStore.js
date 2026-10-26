const KEY = "crm_customer_orders_v1";

export function readOrders() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.filter((order) => order && order.id && Array.isArray(order.cart)) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order) {
  try {
    const orders = readOrders();
    const next = orders.some((item) => String(item.id) === String(order.id))
      ? orders.map((item) => String(item.id) === String(order.id) ? order : item)
      : [order, ...orders];
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("crm-orders-updated"));
    return true;
  } catch {
    return false;
  }
}

export function removeOrder(orderId) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readOrders().filter((order) => String(order.id) !== String(orderId))));
    window.dispatchEvent(new Event("crm-orders-updated"));
    return true;
  } catch {
    return false;
  }
}

export function reservedQuantities(excludeOrderId = null, orders = readOrders()) {
  return orders.reduce((reserved, order) => {
    if (order.status !== "reserved" || String(order.id) === String(excludeOrderId)) return reserved;
    (order.cart || []).forEach((item) => {
      const id = String(item.id);
      reserved[id] = (reserved[id] || 0) + Math.max(0, Number(item.qty) || 0);
    });
    return reserved;
  }, {});
}
