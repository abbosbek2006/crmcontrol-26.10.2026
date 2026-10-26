import { migrateDocumentIds } from "./data/documentNumbers";
import { useTenantCompanyName } from "./data/tenantBrand";
import { translateText as tx } from "./locales/translateText";
import { useLanguage as useUILanguage } from "./context/LanguageContext";
import './App.css';
import './BackButton.css';
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { LanguageProvider } from "./context/LanguageContext";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

// Pages
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import POS from "./pages/PosWorkspace";
import Returns from "./pages/Returns";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
// import Inventory from "./pages/Inventory";  <----- OMBOR 
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Suppliers from "./pages/Suppliers";
import Employees from "./pages/Employees";
import Ustolar from "./pages/ustolar"; // <--- Ustolar sahifasi ulandi
import Finance from "./pages/Finance";
import DebtManagement from "./pages/DebtManagement";
import SupplierDetail from "./pages/SupplierDetail";
import EmployeeDetail from "./pages/EmployeeDetail";
import DebtDetail from "./pages/DebtDetail";
import Help from "./pages/Help";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import AIChat from "./pages/AIChat";
import Drafts from "./pages/Drafts";
import Orders from "./pages/Orders";
import Login from "./pages/Login";
import { notifications } from "./data/mockData";
import { ACCESS_SECTIONS, canAccess, SESSION_KEY } from "./data/accessStore";
import { readEmployees } from "./data/employeeStore";
import { readProfile } from "./data/profileStore";
import { prepareSaleReadyData } from "./data/saleReadyReset";
import { getDirector } from "./data/accessStore";
import { activateTenantStorage, hasAdminSession, logoutAdmin } from "./super-admin/tenantStorage";
import { reportLogin, useTenantPresenceReporter } from "./super-admin/tenantPresence";
import { runPageTransition } from "./utils/motion";
import SuperAdminLogin from "./super-admin/SuperAdminLogin";
import SuperAdminPanel from "./super-admin/SuperAdminPanel";
import TenantWelcome from "./super-admin/TenantWelcome";

const portalParams = new URLSearchParams(window.location.search);
const tenantId = portalParams.get("tenant") || "";
const tenantInvite = portalParams.get("invite") || "";
const isTenantPortal = Boolean(tenantId && tenantInvite);
if (isTenantPortal) activateTenantStorage(tenantId);

prepareSaleReadyData();
migrateDocumentIds();

// ── Placeholder ─────────────────────────────────────
const Placeholder = ({ title, sub }) => (
  <div className="flex flex-col items-center justify-center min-h-64 fade-in">
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-2xl"
      style={{ background: "var(--brand-light)" }}
    >
      📄
    </div>
    <h2
      className="font-display font-bold text-xl mb-2"
      style={{
        fontFamily: "'Manrope',sans-serif",
        color: "var(--text-primary)",
      }}
    >
      {tx(title)}
    </h2>
    <p
      className="text-sm text-center max-w-xs"
      style={{ color: "var(--text-muted)" }}
    >
      {tx(sub)}
    </p>
  </div>
);

// ── Router ──────────────────────────────────────────
function renderPage(page, onNavigate, onBack, user, onProfileSaved, posCartProps, ustaProps, ordersProps) {
  if (page.startsWith("customer-sale-")) {
    let saleCustomer = null;
    try {
      saleCustomer = JSON.parse(decodeURIComponent(page.slice("customer-sale-".length)));
    } catch {
      // Ignore malformed internal routes.
    }
    return <CustomerDetail saleCustomer={saleCustomer} onBack={onBack} onNavigate={onNavigate} />;
  }
  if (page.startsWith("customer-")) {
    const id = parseInt(page.replace("customer-", ""), 10);
    return (
      <CustomerDetail
        customerId={id}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );
  }
  if (page.startsWith("product-")) {
    const id = page.replace("product-", "");
    return (
      <ProductDetail productId={id} onBack={onBack} />
    );
  }
  if (page.startsWith("supplier-")) {
    const id = parseInt(page.replace("supplier-", ""), 10);
    return (
      <SupplierDetail
        supplierId={id}
        onBack={onBack}
      />
    );
  }
  if (page.startsWith("employee-")) {
    const id = parseInt(page.replace("employee-", ""), 10);
    return (
      <EmployeeDetail
        employeeId={id}
        onBack={onBack}
      />
    );
  }
  if (page.startsWith("debt-")) {
    const id = parseInt(page.replace("debt-", ""), 10);
    return <DebtDetail debtorId={id} onBack={onBack} />;
  }

  switch (page) {
    case "dashboard":
      return <Dashboard onNavigate={onNavigate} />;
    case "sales-all":
      return <Sales onNavigate={onNavigate} />;
    case "sales-new":
      return <POS key="primary-pos" {...posCartProps} currentUser={user} />;
    case "sales-pos":
      return <POS key="additional-pos" {...posCartProps} currentUser={user} headingText="Sotuv bo‘limi" workspaceKey="crm_additional_pos_windows_v2" draftKeyPrefix="crm_additional_pos_v2_draft_" migrateLegacyDraft={false} salesStorageKey="crm_additional_pos_sales" customerStorageKey="crm_additional_pos_customers" salesDocumentType="additional-pos" />;
    case "sales-returns":
      return <Returns />;
    case "orders":
      return <Orders currentUser={user} onNavigate={onNavigate} {...ordersProps} />;
    case "products-all":
      return <Products onNavigate={onNavigate} />;
    case "categories":
      return (
        <Placeholder
          title={tx("Kategoriyalar")}
          sub="Mahsulot kategoriyalarini boshqarish"
        />
      );
    case "brands":
      return (
        <Placeholder
          title={tx("Brendlar")}
          sub="Tovar brendlari va ishlab chiqaruvchilar"
        />
      );
    // case "inventory":
    //   return <Inventory />;
    case "customers-all":
      return <Customers filter="all" onNavigate={onNavigate} />;
    case "customers-debt":
      return <Customers filter="debt" onNavigate={onNavigate} />;
    case "customers-vip":
      return <Customers filter="vip" onNavigate={onNavigate} />;
    case "suppliers":
      return <Suppliers onNavigate={onNavigate} />;
    case "employees":
      return <Employees onNavigate={onNavigate} />;
    case "ustolar": // <--- Ustolar sahifasining yo'nalishi
      return <Ustolar {...ustaProps} />;
    case "finance-revenue":
    case "finance-expenses":
      return <Finance subpage={page} />;
    case "finance-debt":
      return <DebtManagement onNavigate={onNavigate} />;
    case "reports":
      return <Reports />;
    case "notifications":
      return <Notifications />;
    case "settings":
      return <Settings user={user} onProfileSaved={onProfileSaved} />;
    case "ai-chat":
      return <AIChat user={user} />;
    case "drafts":
      return <Drafts onBack={onBack} onNavigate={onNavigate} />;
    case "help":
      return <Help />;
    default:
      return <Dashboard onNavigate={onNavigate} />;
  }
}

// ── Shell ────────────────────────────────────────────
const detailPagePrefixes = ["customer-", "product-", "supplier-", "employee-", "debt-"];
const browserRouteKey = "__uyMarketCrmRoute";
const sectionStartPages = { sales: "sales-all", products: "products-all", customers: "customers-all", finance: "finance-revenue" };

function getFirstAllowedPage(user) {
  const section = ACCESS_SECTIONS.find((entry) => canAccess(user, entry.id));
  return section ? sectionStartPages[section.id] || section.id : "help";
}

function routeFromBrowserState(state) {
  const savedRoute = state?.[browserRouteKey];
  if (typeof savedRoute?.page !== "string" || !Array.isArray(savedRoute.history)) {
    return null;
  }
  return {
    page: savedRoute.page,
    history: savedRoute.history.filter((entry) => typeof entry === "string"),
  };
}

function Shell({ onLogout, user, initialPage }) {
  useUILanguage();
  const [, setCurrencyRevision] = useState(0);
  const [profile, setProfile] = useState(() => readProfile(user));
  const [route, setRoute] = useState(
    () => {
      const saved = routeFromBrowserState(window.history.state);
      return saved && canAccess(user, saved.page) ? saved : { page: initialPage || getFirstAllowedPage(user), history: [] };
    }
  );
  const routeRef = useRef(route);
  const { page, history } = route;
  const [collapsed, setCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [posCartOpen, setPosCartOpen] = useState(false);
  const [additionalPosTransitionLoading, setAdditionalPosTransitionLoading] = useState(false);
  const additionalPosBackTimerRef = useRef(null);
  const [ordersEditorOpen, setOrdersEditorOpen] = useState(false);
  const isPosPage = page === "sales-new" || page === "sales-pos";
  const [profileUsta, setProfileUsta] = useState(null);
  const contentRef = useRef(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const refreshMoney = () => setCurrencyRevision((value) => value + 1);
    window.addEventListener("crm-currency-change", refreshMoney);
    return () => window.removeEventListener("crm-currency-change", refreshMoney);
  }, []);

  useEffect(() => {
    if (!routeFromBrowserState(window.history.state)) {
      window.history.replaceState(
        { ...window.history.state, [browserRouteKey]: routeRef.current },
        ""
      );
    }

    const handleBrowserNavigation = (event) => {
      const browserRoute = routeFromBrowserState(event.state);
      const nextRoute = browserRoute && canAccess(user, browserRoute.page)
        ? browserRoute : { page: getFirstAllowedPage(user), history: [] };
      // Tarix qisqarsa — orqaga qaytish, aks holda oldinga (brauzerning "oldinga" tugmasi).
      const direction = nextRoute.history.length < routeRef.current.history.length ? "back" : "forward";
      routeRef.current = nextRoute;
      runPageTransition(direction, () => setRoute(nextRoute));
      setIsSidebarOpen(false);
    };

    window.addEventListener("popstate", handleBrowserNavigation);
    return () => window.removeEventListener("popstate", handleBrowserNavigation);
  }, [user]);

  useEffect(() => {
    if (!canAccess(user, routeRef.current.page)) {
      const allowed = { page: getFirstAllowedPage(user), history: [] };
      routeRef.current = allowed;
      setRoute(allowed);
      window.history.replaceState({ ...window.history.state, [browserRouteKey]: allowed }, "");
    }
  }, [user]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setPosCartOpen(false);
    setProfileUsta(null);
    setAdditionalPosTransitionLoading(false);
    window.clearTimeout(additionalPosBackTimerRef.current);
  }, [page]);

  useEffect(() => () => window.clearTimeout(additionalPosBackTimerRef.current), []);

  const navigateImmediately = (nextPage) => {
    const current = routeRef.current;
    if (current.page === nextPage) return;
    const nextRoute = {
      page: nextPage,
      history: [...current.history, current.page],
    };
    window.history.pushState(
      { ...window.history.state, [browserRouteKey]: nextRoute },
      ""
    );
    routeRef.current = nextRoute;
    runPageTransition("forward", () => setRoute(nextRoute));
    setIsSidebarOpen(false);
  };
  const navigate = (nextPage) => {
    if (!nextPage) {
      return;
    }

    if (nextPage === "login") {
      onLogout();
      return;
    }

    if (!canAccess(user, nextPage)) return;

    const current = routeRef.current;
    if (current.page === nextPage) return;
    if (nextPage === "sales-pos") {
      if (additionalPosBackTimerRef.current) return;
      setAdditionalPosTransitionLoading(true);
      additionalPosBackTimerRef.current = window.setTimeout(() => {
        additionalPosBackTimerRef.current = null;
        setAdditionalPosTransitionLoading(false);
        navigateImmediately(nextPage);
      }, 1000);
      return;
    }
    navigateImmediately(nextPage);
  };

  const goBack = () => {
    if (routeRef.current.history.length > 0) window.history.back();
  };

  const hasOwnBackButton = page === "drafts" || detailPagePrefixes.some((prefix) => page.startsWith(prefix));
  const handleShellBack = () => {
    if (page === "ustolar" && profileUsta) {
      setProfileUsta(null);
      return;
    }
    if (isPosPage && posCartOpen) {
      setPosCartOpen(false);
      return;
    }
    if (page === "sales-pos" && routeRef.current.history.length > 0) {
      if (additionalPosBackTimerRef.current) return;
      setAdditionalPosTransitionLoading(true);
      additionalPosBackTimerRef.current = window.setTimeout(() => {
        additionalPosBackTimerRef.current = null;
        setAdditionalPosTransitionLoading(false);
        goBack();
      }, 1000);
      return;
    }
    goBack();
  };

  return (
    <div
      className="flex h-full relative"
      style={{ background: "var(--bg)" }}
    >
      {page !== "sales-pos" && (
        <Sidebar
          user={user}
          profile={profile}
          active={page}
          onNavigate={navigate}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          notifCount={unread}
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onNavigate={navigate} notifCount={unread} user={user} profile={profile} />
        <div style={{ position: "relative", display: "flex", flex: "1 1 0%", flexDirection: "column", minHeight: 0, minWidth: 0, isolation: "isolate" }}>
        <main ref={contentRef} className={`app-main-view flex-1 overflow-y-auto p-6 ${isPosPage ? "app-pos-main" : ""}${page === "ai-chat" ? " ai-chat-shell-scroll" : ""}`} style={page === "sales-pos" ? { paddingLeft: "clamp(12px, 1.2vw, 24px)", paddingRight: "clamp(12px, 1.2vw, 24px)" } : undefined}>
          <div className={isPosPage ? "app-pos-content" : undefined} style={{ maxWidth: page === "sales-pos" ? "none" : 1400, margin: page === "sales-pos" ? 0 : "0 auto", width: "100%" }}>

            {(history.length > 0 || (page === "ustolar" && profileUsta) || (isPosPage && posCartOpen)) && !hasOwnBackButton && !(page === "orders" && ordersEditorOpen) && (
              <button
                type="button"
                onClick={handleShellBack}
                aria-label={tx(isPosPage && posCartOpen ? "Mahsulot tanlashga qaytish" : "Oldingi sahifaga qaytish")}
                className={`app-back-button${isPosPage && posCartOpen ? " is-cart-back" : ""}`}
              >
                <ArrowLeft size={16} aria-hidden="true" style={{ flexShrink: 0 }} />{tx("Orqaga")}</button>
            )}
            {tx(canAccess(user, page) ? renderPage(page, navigate, goBack, user, setProfile, {
              cartWindowOpen: posCartOpen,
              onCartWindowChange: setPosCartOpen,
            }, { profileUsta, setProfileUsta }, { onBackButtonVisibilityChange: setOrdersEditorOpen }) : null)}
          </div>
        </main>
        <div id="main-modal-root" style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }} />
        </div>
      </div>
      {additionalPosTransitionLoading && (
        <div className="additional-pos-backdrop" role="dialog" aria-modal="true" aria-label={tx("Sahifa yuklanmoqda")}>
          <div className="additional-pos-loading-orb" aria-hidden="true">
            <span className="additional-pos-spinner" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── App root ────────────────────────────────────────
export default function App() {
  const companyName = useTenantCompanyName(isTenantPortal ? tenantId : "", isTenantPortal ? tenantInvite : "");
  useEffect(() => {
    if (!isTenantPortal) return undefined;
    const previousTitle = document.title;
    document.title = companyName;
    return () => { document.title = previousTitle; };
  }, [companyName]);
  const [user, setUser] = useState(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Login still starts fresh. */ }
    return null;
  });
  const [firstTenantSetup, setFirstTenantSetup] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(hasAdminSession);
  useEffect(() => {
    const refreshEmployee = (event) => {
      if (event.type === "storage" && event.key !== "crm_employees" && !String(event.key || "").endsWith("crm_director_account")) return;
      setUser((current) => {
        if (current?.type === "director") {
          const director = getDirector();
          return director && current.credentialId === director.salt ? current : null;
        }
        if (current?.type !== "employee") return current;
        try {
          const employee = readEmployees().find((entry) => String(entry.id) === String(current.id));
          if (!employee || employee.status !== "active" || !employee.login || current.credentialId !== employee.salt) {
            return null;
          }
          const permissions = employee.permissions || [];
          if (current.name === employee.name && current.role === employee.role && JSON.stringify(current.permissions) === JSON.stringify(permissions)) return current;
          const updated = { type: "employee", id: employee.id, name: employee.name, role: employee.role, permissions, credentialId: employee.salt };
          return updated;
        } catch { return current; }
      });
    };
    window.addEventListener("storage", refreshEmployee);
    window.addEventListener("focus", refreshEmployee);
    return () => {
      window.removeEventListener("storage", refreshEmployee);
      window.removeEventListener("focus", refreshEmployee);
    };
  }, []);
  // 30 daqiqa harakatsizlikdan keyin avtomatik chiqish (ochiq qolgan kassa kompyuteri uchun).
  useEffect(() => {
    if (!user) return undefined;
    const IDLE_MS = 30 * 60 * 1000;
    let timer = window.setTimeout(() => setUser(null), IDLE_MS);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setUser(null), IDLE_MS); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)); };
  }, [user]);
  // Mijoz portali Super Admin'ga jonli holat yuboradi: kim qachon kirdi, onlaynmi, xatolik bormi.
  useTenantPresenceReporter(isTenantPortal ? tenantId : "", user);
  const handleLogin = (account) => { if (isTenantPortal) reportLogin(tenantId, account); setUser(account); };
  const handleLogout = () => setUser(null);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          {!isTenantPortal ? (
            superAdmin ? <SuperAdminPanel onLogout={() => { logoutAdmin(); setSuperAdmin(false); }} /> : <SuperAdminLogin onLogin={() => setSuperAdmin(true)} />
          ) : user ? (
            <Shell key={`${user.type}-${user.id || "director"}`} user={user} onLogout={handleLogout} initialPage={firstTenantSetup ? "settings" : undefined} />
          ) : getDirector() ? (
            <Login onLogin={handleLogin} tenantId={tenantId} tenantInvite={tenantInvite} />
          ) : (
            <TenantWelcome tenantId={tenantId} invite={tenantInvite} onReady={(account) => { reportLogin(tenantId, account); setFirstTenantSetup(true); setUser(account); }} />
          )}
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
