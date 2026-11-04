// Backend calls with the employee's portal token.
export const API = import.meta.env.VITE_API_BASE_URL || "";

const TKEY = "nnc-portal-auth";
export function readAuth() {
  try { return JSON.parse(localStorage.getItem(TKEY) || sessionStorage.getItem(TKEY) || "null"); } catch { return null; }
}
export function writeAuth(a, remember = true) {
  try {
    localStorage.removeItem(TKEY); sessionStorage.removeItem(TKEY);
    if (a) (remember ? localStorage : sessionStorage).setItem(TKEY, JSON.stringify(a));
  } catch { /* storage blocked */ }
}

let onExpired = () => {};
export const setOnExpired = (fn) => { onExpired = fn; };

export async function api(path, { method = "GET", body, token } = {}) {
  const t = token ?? readAuth()?.token;
  let res;
  try {
    res = await fetch(`${API}/api/portal${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Check your internet connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && t && !path.startsWith("/login") && !path.startsWith("/signup")) onExpired();
  if (!res.ok || json.success === false) {
    const e = new Error(json.message || `Request failed (${res.status})`);
    e.status = res.status; e.data = json;
    throw e;
  }
  return json;
}
