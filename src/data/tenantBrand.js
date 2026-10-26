import { useEffect, useState } from "react";
import { readAdminData } from "../super-admin/tenantStorage";

const DEFAULT_COMPANY_NAME = "CRM tizimi";

export function getTenantCompanyName(tenantId = "", invite = "") {
  if (typeof window === "undefined") return DEFAULT_COMPANY_NAME;
  const params = new URLSearchParams(window.location.search);
  const id = tenantId || params.get("tenant") || "";
  const inviteCode = invite || params.get("invite") || "";
  if (!id) return DEFAULT_COMPANY_NAME;

  const tenant = readAdminData().tenants.find((item) =>
    String(item.id) === String(id) && (!inviteCode || item.invite === inviteCode)
  );
  return String(tenant?.name || DEFAULT_COMPANY_NAME).trim() || DEFAULT_COMPANY_NAME;
}

export function useTenantCompanyName(tenantId = "", invite = "") {
  const [companyName, setCompanyName] = useState(() => getTenantCompanyName(tenantId, invite));

  useEffect(() => {
    const refresh = () => setCompanyName(getTenantCompanyName(tenantId, invite));
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [tenantId, invite]);

  return companyName;
}
