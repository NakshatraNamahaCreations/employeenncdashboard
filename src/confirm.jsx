/* eslint-disable react-refresh/only-export-components */
// In-app confirm dialog (replaces the browser's "localhost says" box).
// Usage: if (await confirmBox({ title, text, ok: "Sign out", danger: true })) { ... }
import { useEffect, useState } from "react";

let push = null;
export function confirmBox(opts) {
  return new Promise(resolve => { if (push) push({ ...opts, resolve }); else resolve(window.confirm(opts.text || opts.title)); });
}

export function ConfirmHost() {
  const [q, setQ] = useState(null);
  useEffect(() => { push = setQ; return () => { push = null; }; }, []);
  useEffect(() => {
    if (!q) return undefined;
    const k = (e) => { if (e.key === "Escape") done(false); if (e.key === "Enter") done(true); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!q) return null;
  function done(v) { q.resolve(v); setQ(null); }
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) done(false); }}>
      <div className="modal cfm" role="alertdialog" aria-modal="true" aria-labelledby="cfm-t">
        <div className="mb">
          <b id="cfm-t" className="cfm-t">{q.title}</b>
          {q.text && <p className="cfm-x">{q.text}</p>}
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button type="button" className="btn" onClick={() => done(false)}>{q.cancel || "Cancel"}</button>
            <button type="button" className={`btn ${q.danger ? "d" : "p"}`} onClick={() => done(true)} autoFocus>{q.ok || "OK"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
