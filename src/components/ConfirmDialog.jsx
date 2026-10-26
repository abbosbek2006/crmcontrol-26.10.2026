import { translateText as tx } from "../locales/translateText";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "../utils/motion";

// Yopilish animatsiyasi davomiyligi (src/styles/motion.css dagi m-alert-out bilan mos).
const CONFIRM_EXIT_MS = 160;

export default function ConfirmDialog({ open, title, message, confirmLabel = "Ha", confirmDanger = false, onConfirm, onCancel }) {
  useUILanguage();
  const cancelRef = useRef(null);
  // Yopilganda matn oxirgi holatda qoladi, oyna esa teskari animatsiya bilan yo'qoladi.
  const [rendered, setRendered] = useState(open);
  const frozen = useRef({ title, message, confirmLabel });
  if (open) frozen.current = { title, message, confirmLabel };

  useEffect(() => {
    if (open) { setRendered(true); return undefined; }
    if (!rendered) return undefined;
    const timer = window.setTimeout(() => setRendered(false), prefersReducedMotion() ? 0 : CONFIRM_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open && !rendered) return null;
  const closing = !open;
  const view = open ? { title, message, confirmLabel } : frozen.current;

  return createPortal(
    <div
      className={`motion-overlay${closing ? " is-closing" : ""}`}
      aria-hidden={closing || undefined}
      onMouseDown={(event) => { if (!closing && event.target === event.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,.5)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"
        className={`motion-alert${closing ? " is-closing" : ""}`}
        style={{ width: "100%", maxWidth: 400, padding: 24, borderRadius: 20, background: "var(--surface)",
          color: "var(--text-primary)", boxShadow: "0 20px 60px rgba(15,23,42,.2)" }}>
        <h2 id="confirm-dialog-title" className="text-lg font-bold">{tx(view.title)}</h2>
        <p id="confirm-dialog-message" className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{tx(view.message)}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={closing} className="btn-ghost">{tx("Yo‘q, bekor qilish")}</button>
          <button type="button" onClick={onConfirm} disabled={closing} className={`btn-primary${confirmDanger ? " confirm-dialog-danger" : ""}`}>{tx(view.confirmLabel)}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
