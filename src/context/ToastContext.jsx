import { translateText as tx } from "../locales/translateText";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import './ToastContext.css';
import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
const ToastContext = createContext(null);
const toastConfig = {
  success: {
    icon: CheckCircle,
    color: "var(--success)",
    bg: "var(--success-light)",
    border: "var(--success-border)",
  },
  error: {
    icon: XCircle,
    color: "var(--danger)",
    bg: "var(--danger-light)",
    border: "var(--danger-border)",
  },
  warning: {
    icon: AlertTriangle,
    color: "var(--warning)",
    bg: "var(--warning-light)",
    border: "var(--warning-border)",
  },
  info: {
    icon: Info,
    color: "var(--brand)",
    bg: "var(--brand-light)",
    border: "var(--brand-border)",
  },
};
export function ToastProvider({ children }) {
  useUILanguage();
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const toast = useCallback(
    (type, title, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev.slice(-4),
        {
          id,
          type,
          title,
          message,
        },
      ]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const success = useCallback((t, m) => toast("success", t, m), [toast]);
  const error = useCallback((t, m) => toast("error", t, m), [toast]);
  const warning = useCallback((t, m) => toast("warning", t, m), [toast]);
  const info = useCallback((t, m) => toast("info", t, m), [toast]);
  return (
    <ToastContext.Provider
      value={{
        toast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}

      {/* Toast portal */}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {[...toasts].reverse().map((t, index) => {
          const cfg = toastConfig[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className="toast-card"
              style={{
                "--toast-index": index,
                "--toast-color": cfg.color,
                "--toast-border": cfg.border,
                zIndex: toasts.length - index,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: cfg.bg,
                }}
              >
                <Icon
                  size={15}
                  style={{
                    color: cfg.color,
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className="text-sm font-semibold leading-tight"
                  style={{
                    color: "var(--text-primary)",
                  }}
                >
                  {tx(t.title)}
                </div>
                {t.message && (
                  <div
                    className="text-xs mt-0.5 leading-relaxed"
                    style={{
                      color: "var(--text-muted)",
                    }}
                  >
                    {tx(t.message)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
                aria-label={tx("Bildirishnomani yopish")}
                style={{
                  color: "var(--text-muted)",
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
