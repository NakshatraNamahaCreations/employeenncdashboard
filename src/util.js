// Dates and small formatters (local time, "YYYY-MM-DD")
export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
export const today = () => iso(new Date());
export const T = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fd = (s) => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const fdw = (s) => `${DOW[parse(s).getDay()]}, ${fd(s)}`;
// day/month/year: "17/11/2026" and "Tue, 17/11/2026" (also takes a full date-time string)
export const fdy = (s) => { const d = String(s || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : ""; };
export const fdwy = (s) => { const y = fdy(s); return y ? `${DOW[parse(String(s).slice(0, 10)).getDay()]}, ${y}` : ""; };
export const h1 = (n) => Math.round(n * 10) / 10;
export const pct = (a, b) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
export const weekStart = (s = today()) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
export const monthStart = (s = today()) => `${s.slice(0, 8)}01`;
export const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const rs = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
export const ampm = (t) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "am" : "pm"}`; };
