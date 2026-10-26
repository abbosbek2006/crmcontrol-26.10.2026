// Yagona animatsiya tizimining JS qismi (CSS: src/styles/motion.css).
// 1) runPageTransition — sahifa almashganda View Transitions API orqali yo'nalishli animatsiya.
// 2) installExitAnimations — oyna/menyu DOM'dan olib tashlanganda uning vizual nusxasini
//    qisqa teskari animatsiya bilan yo'qotadi. Shunda har bir sahifadagi oynani alohida
//    qayta yozmasdan, hammasi bir xil uslubda yopiladi. Nusxa bosilmaydi va o'qilmaydi (inert).
import { flushSync } from "react-dom";

const PAGE_FALLBACK_MS = 200;
const PAGE_UPDATE_GUARD_MS = 250;
const EXIT_MS = 180;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;

/* ---------------- Sahifa almashuvi ---------------- */

export function runPageTransition(direction, update) {
  const root = document.documentElement;
  const canAnimate = typeof document.startViewTransition === "function" && !prefersReducedMotion() && document.visibilityState === "visible";
  if (!canAnimate) {
    update();
    if (!prefersReducedMotion()) {
      // View Transitions qo'llab-quvvatlanmasa: faqat shaffoflik (fixed elementlarga ta'sir qilmaydi).
      requestAnimationFrame(() => document.querySelector(".app-main-view")?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: PAGE_FALLBACK_MS, easing: "ease-out" }));
    }
    return;
  }
  const view = document.querySelector(".app-main-view");
  const cleanup = () => {
    if (view) view.style.viewTransitionName = "";
    if (root.dataset.navDirection === direction) delete root.dataset.navDirection;
  };
  root.dataset.navDirection = direction;
  if (view) view.style.viewTransitionName = "app-page";
  // Yangilanish faqat bir marta bajariladi: brauzer chaqirsa ham, himoya taymeri chaqirsa ham.
  let updated = false;
  const runUpdate = () => { if (updated) return; updated = true; flushSync(update); };
  try {
    const transition = document.startViewTransition(runUpdate);
    // Brauzer kadr chizishni kechiktirsa (masalan, oyna yashirin), sahifa qotib qolmasin:
    // animatsiya bekor qilinadi, sahifa esa baribir darhol almashadi.
    const guard = window.setTimeout(() => {
      if (updated) return;
      transition.skipTransition?.();
      runUpdate();
      cleanup();
    }, PAGE_UPDATE_GUARD_MS);
    transition.finished.finally(() => { window.clearTimeout(guard); cleanup(); });
  } catch {
    cleanup();
    runUpdate();
  }
}

/* ---------------- Yopilish animatsiyalari ---------------- */

// Oyna: orqa fon xiralashadi, karta kichrayadi (telefonda pastga tushadi).
function dialogExit(ghost) {
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: "ease-in", fill: "forwards" });
  const card = ghost.firstElementChild;
  const to = isPhone() ? { opacity: 0, transform: "translateY(24px)" } : { opacity: 0, transform: "translateY(8px) scale(.97)" };
  return card?.animate([{ opacity: 1, transform: "none" }, to], { duration: EXIT_MS, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
}

// Har bir tur uchun: qaysi element, qanday yopiladi.
const EXIT_RULES = [
  {
    // Sahifalardagi oynalar (kontent maydoni)
    match: (el, parent) => el.matches?.(".crm-content-modal") && parent?.id === "main-modal-root" && el.dataset.motion !== "manual",
    animate: dialogExit,
  },
  {
    // Sahifalarning o'z oynalari: Mijozlar oynasi va POS "Savatchadagi barcha mahsulotlar"
    match: (el) => el.matches?.(".customers-modal-overlay, .pos-cart-all-overlay"),
    animate: dialogExit,
  },
  {
    // Mobil yon menyu — chapga suriladi
    match: (el) => el.matches?.("aside.mobile-sidebar-active"),
    animate: (ghost) => ghost.animate([{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }], { duration: 220, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" }),
  },
  {
    match: (el) => el.matches?.(".sidebar-overlay, .sa-modal, .command-palette-overlay"),
    animate: (ghost) => {
      const card = ghost.matches(".sa-modal") ? ghost.querySelector("form") : ghost.matches(".command-palette-overlay") ? ghost.firstElementChild : null;
      card?.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: ghost.matches(".command-palette-overlay") ? "translateY(-12px) scale(.98)" : "translateY(8px) scale(.97)" }], { duration: EXIT_MS, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
      return ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: "ease-in", fill: "forwards" });
    },
  },
  {
    // Ochiladigan ro'yxatlar — tugma tomonga yig'iladi
    match: (el) => el.matches?.(".sales-product-options, .supplier-learned-options, .pos-address-popover"),
    animate: (ghost) => ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px) scale(.97)" }], { duration: 130, easing: "ease-in", fill: "forwards" }),
  },
];

function copyFormState(source, clone) {
  const from = source.querySelectorAll("input, textarea, select");
  const to = clone.querySelectorAll("input, textarea, select");
  from.forEach((field, index) => {
    const target = to[index];
    if (!target) return;
    if (field.type === "checkbox" || field.type === "radio") target.checked = field.checked;
    else target.value = field.value;
  });
}

function playExit(node, parent, nextSibling, rule) {
  if (!parent?.isConnected) return;
  const ghost = node.cloneNode(true);
  copyFormState(node, ghost);
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.dataset.motionGhost = "true";
  ghost.style.pointerEvents = "none";
  ghost.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  ghost.removeAttribute("id");
  try {
    parent.insertBefore(ghost, nextSibling && nextSibling.parentNode === parent ? nextSibling : null);
  } catch { return; }
  let removed = false;
  const remove = () => { if (removed) return; removed = true; ghost.remove(); };
  try {
    const animation = rule.animate(ghost);
    if (animation) { animation.onfinish = remove; animation.oncancel = remove; }
  } catch { /* animatsiya ishlamasa ham nusxa olib tashlanadi */ }
  // Tab fonda bo'lsa brauzer animatsiyani to'xtatadi — nusxa baribir o'chiriladi.
  window.setTimeout(remove, 400);
}

let installed = false;
export function installExitAnimations(root = document.body) {
  if (installed || typeof MutationObserver === "undefined" || !root) return () => {};
  installed = true;
  const observer = new MutationObserver((records) => {
    if (prefersReducedMotion() || document.visibilityState !== "visible") return;
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1 || node.dataset?.motionGhost) continue;
        // Olib tashlangan tugunning parentElement'i endi null, shuning uchun ota element alohida uzatiladi.
        const rule = EXIT_RULES.find((candidate) => candidate.match(node, record.target));
        if (rule) playExit(node, record.target, record.nextSibling, rule);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => { observer.disconnect(); installed = false; };
}
