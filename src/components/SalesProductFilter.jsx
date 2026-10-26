import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { translateText as tx } from "../locales/translateText";

import { normalizeProductText } from "../data/salesProductFilter";
const capitalize = (value) => String(value ?? "").replace(/(^|\s)(\S)/g, (_, space, letter) => space + letter.toLocaleUpperCase("uz-UZ"));
const alphabetical = (a, b) => a.localeCompare(b, "uz", { sensitivity: "base", numeric: true });

export default function SalesProductFilter({ products, value, onChange, placeholder = "Kategoriya yoki mahsulot..." }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const optionsId = useId();
  const query = normalizeProductText(value.query);
  const categories = [...new Map(products.filter((p) => p.category).map((p) => [normalizeProductText(p.category), p.category])).values()]
    .filter((category) => normalizeProductText(category).startsWith(query)).sort(alphabetical);
  const matches = products.filter((p) => (!value.category || normalizeProductText(p.category) === normalizeProductText(value.category)) && normalizeProductText(p.name).startsWith(query))
    .sort((a, b) => alphabetical(a.name, b.name));
  const reset = () => onChange({ category: "", product: null, query: "" });
  const keyboard = (event) => {
    if (event.key === "Escape") { root.current.querySelector("input").focus(); setOpen(false); return; }
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault(); setOpen(true);
    const options = [...root.current.querySelectorAll('[role="option"]')];
    const index = options.indexOf(document.activeElement);
    options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
  };
  return <div className="sales-product-filter" ref={root} onKeyDown={keyboard} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="sales-search">
      <input role="combobox" aria-label={tx("Kategoriya yoki mahsulot qidirish")} aria-expanded={open} aria-controls={optionsId} aria-autocomplete="list"
        value={value.product ? capitalize(value.product.name) : (!open && !value.query ? capitalize(value.category) : value.query)} placeholder={value.category ? capitalize(value.category) : tx(placeholder)}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={(event) => { onChange({ ...value, product: null, query: capitalize(event.target.value) }); setOpen(true); }} />
      {(value.category || value.product || value.query) && <button type="button" aria-label={tx("Filtrni tozalash")} onClick={reset}><X size={14} /></button>}
    </div>
    {open && <div className="sales-product-options" id={optionsId} role="listbox" aria-label={tx("Kategoriya va mahsulotlar")}>
      <button type="button" role="option" aria-selected={!value.category && !value.product && !query} onClick={reset}>{tx("Barcha kategoriyalar")}</button>
      {value.category && <div className="sales-product-category">{capitalize(value.category)}</div>}
      {!value.category && categories.map((category) => <button type="button" role="option" aria-selected={false} key={'c:' + category} onClick={() => { onChange({ category, query: "", product: null }); root.current.querySelector("input").focus(); }}><b>{capitalize(category)}</b><small>{tx("Kategoriya")}</small></button>)}
      {(value.category || query) && matches.map((product, index) => <button type="button" role="option" aria-selected={value.product === product} key={'p:' + index} onClick={() => { onChange({ ...value, product, query: "" }); setOpen(false); }}><span>{capitalize(product.name)}</span><small>{capitalize(product.category)}</small></button>)}
      {!(value.category ? matches.length : categories.length || (query && matches.length)) && <p>{tx("Natija topilmadi")}</p>}
    </div>}
  </div>;
}
