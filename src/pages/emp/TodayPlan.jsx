import { useEffect, useState } from "react";
import { api } from "../../api";
import { toast } from "../../toast";
import Linkify from "../../Linkify";

// Plans for today: what the employee means to get done, ticked off through the day.
// The manager sees the same list in the CRM (Employee Portal → Plans for today).
export default function TodayPlan({ refs = [], yesterday = "" }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api("/plans").then(j => live && setItems(j.data.items || []), () => live && setItems([]));
    return () => { live = false; };
  }, []);
  const run = async (fn) => {
    try { const j = await fn(); setItems(j.data.items || []); return true; }
    catch (e) { toast(e.message); return false; }
  };
  const add = async (e, t = text) => {
    e?.preventDefault();
    const v = t.trim();
    if (!v || busy) return;
    setBusy(true);
    if (await run(() => api("/plans", { method: "POST", body: { text: v, refName: ref } }))) setText("");
    setBusy(false);
  };
  const tick = (it) => run(() => api(`/plans/${it._id}`, { method: "PATCH", body: { done: !it.done } }));
  const del = (it) => run(() => api(`/plans/${it._id}`, { method: "DELETE" }));
  const L = items || [], done = L.filter(i => i.done).length;
  const names = [...new Set(refs.map(r => r.name).filter(Boolean))];
  return (
    <section className="card tp"><h3>Plans for today <small>{L.length ? `${done} of ${L.length} done` : "your manager sees this"}</small></h3>
      {items == null ? <div className="empty">Loading…</div> : (
        <>
          {L.map(it => (
            <div key={it._id} className={`li tp-i${it.done ? " done" : ""}`}>
              <label className="tp-c">
                <input type="checkbox" checked={!!it.done} onChange={() => tick(it)} aria-label={it.done ? "Mark as not done" : "Mark as done"} />
                <span className="x"><b><Linkify text={it.text} /></b>{it.refName && <span className="sub">{it.refName}</span>}</span>
              </label>
              <button type="button" className="btn sm" onClick={() => del(it)} aria-label={`Remove ${it.text}`}>Remove</button>
            </div>
          ))}
          {!L.length && <div className="empty">Write what you plan to finish today, one item at a time, and tick each one off when it is done.</div>}
          {!L.length && yesterday && (
            <div className="li"><div className="x"><span className="sub">Yesterday you planned for today:</span><b>{yesterday}</b></div>
              <button type="button" className="btn sm" disabled={busy} onClick={() => add(null, yesterday)}>Add it</button></div>
          )}
          <form className="tp-add" onSubmit={add}>
            <input value={text} onChange={e => setText(e.target.value)} maxLength={300} placeholder="Add a plan, e.g. Finish the login page" aria-label="New plan for today" />
            {names.length > 0 && (
              <select value={ref} onChange={e => setRef(e.target.value)} aria-label="Project">
                <option value="">No project</option>
                {names.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <button type="submit" className="btn p sm" disabled={busy || !text.trim()}>Add</button>
          </form>
        </>
      )}
    </section>
  );
}
