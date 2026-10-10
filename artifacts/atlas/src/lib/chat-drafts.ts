// Drafts are tab-scoped and never contain Settings credentials.
// Storage-denied/private browsing still works with the React state.
export function readDraft(id: string) {
  try { return sessionStorage.getItem(`atlas-draft:${id}`); } catch { return null; }
}
export function writeDraft(id: string, value: string) {
  try {
    if (value) sessionStorage.setItem(`atlas-draft:${id}`, value);
    else sessionStorage.removeItem(`atlas-draft:${id}`);
  } catch { /* Do not make chat depend on browser storage permissions. */ }
}
