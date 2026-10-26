export const normalizeProductText = (value) => String(value ?? "").trim().toLocaleLowerCase("uz-UZ").replace(/[‘’ʻʼ`]/g, "'");
export function saleMatchesProduct(sale, products, filter) {
  if (!filter.category && !filter.product && !filter.query) return true;
  const items = sale.items?.length ? sale.items : (sale.productIds || []).map((id) => ({ id }));
  return items.some((item) => {
    const product = products.find((p) => item.id != null && String(p.id) === String(item.id)) || products.find((p) => normalizeProductText(p.name) === normalizeProductText(item.name));
    const name = normalizeProductText(item.name || product?.name);
    const category = normalizeProductText(item.category || product?.category);
    return (!filter.category || category === normalizeProductText(filter.category)) &&
      (!filter.product || (filter.product.id != null ? String(item.id) === String(filter.product.id) : name === normalizeProductText(filter.product.name))) &&
      (filter.product || !filter.query || name.startsWith(normalizeProductText(filter.query)) || (!filter.category && category.startsWith(normalizeProductText(filter.query))));
  });
}
