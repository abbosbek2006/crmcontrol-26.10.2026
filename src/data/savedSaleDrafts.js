export const SAVED_SALE_DRAFTS_KEY = "crm_saved_sale_drafts_v1";
export const SALE_DRAFT_RESUME_KEY = "crm_sale_draft_resume_v1";

export function readSavedSaleDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_SALE_DRAFTS_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === "string" && Array.isArray(item.cart)) : [];
  } catch {
    return [];
  }
}

export function saveSaleDraft(draft) {
  try {
    const saved = readSavedSaleDrafts();
    localStorage.setItem(SAVED_SALE_DRAFTS_KEY, JSON.stringify([draft, ...saved.filter(item => item.id !== draft.id)]));
    window.dispatchEvent(new Event("crm-saved-sale-drafts-updated"));
    return true;
  } catch {
    return false;
  }
}

export function deleteSaleDraft(id) {
  try {
    localStorage.setItem(SAVED_SALE_DRAFTS_KEY, JSON.stringify(readSavedSaleDrafts().filter(item => item.id !== id)));
    window.dispatchEvent(new Event("crm-saved-sale-drafts-updated"));
    return true;
  } catch {
    return false;
  }
}

export function requestSaleDraftResume(draft) {
  try {
    localStorage.setItem(SALE_DRAFT_RESUME_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readSaleDraftResume() {
  try {
    const pending = JSON.parse(localStorage.getItem(SALE_DRAFT_RESUME_KEY) || "null");
    return pending && typeof pending === "object" ? pending : null;
  } catch {
    return null;
  }
}

export function clearSaleDraftResume() {
  try { localStorage.removeItem(SALE_DRAFT_RESUME_KEY); } catch { /* Keep app navigation available if storage is blocked. */ }
}
