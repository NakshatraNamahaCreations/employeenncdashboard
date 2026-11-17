import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { api } from "../../api";
import { toast } from "../../toast";
import Linkify from "../../Linkify";

// A text box that grows with what is typed, so long plans are easy to read and write
function GrowText({ value, onChange, onEnter, ...rest }) {
  const r = useRef(null);
  useEffect(() => { const el = r.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return (
    <textarea ref={r} rows={1} value={value} onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); } }} {...rest} />
  );
}

function ProjectPick({ names, value, onChange }) {
  if (!names.length) return null;
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Project">
      <option value="">No project</option>
      {[...new Set([...names, value].filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

// Plans for today: what the employee means to get done, ticked off through the day.
// The manager sees the same list in the CRM (Employee Portal → Plans for today).
export default function TodayPlan({ refs = [], yesterday = "" }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);   // { id, text, refName } while an item is being edited
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
  const saveEdit = async () => {
    const v = edit.text.trim();
    if (!v) { toast("Write the plan"); return; }
    setBusy(true);
    if (await run(() => api(`/plans/${edit.id}`, { method: "PATCH", body: { text: v, refName: edit.refName } }))) setEdit(null);
    setBusy(false);
  };
  const L = items || [], done = L.filter(i => i.done).length;
  const names = [...new Set(refs.map(r => r.name).filter(Boolean))];
  return (
    <section className="card tp"><h3>Plans for today <small>{L.length ? `${done} of ${L.length} done` : "your manager sees this"}</small></h3>
      {items == null ? <div className="empty">Loading…</div> : (
        <>
          {L.length > 0 && <div className="tp-bar"><i style={{ width: `${Math.round((done / L.length) * 100)}%` }} /></div>}
          <div className="tp-list">
            {L.map((it, n) => edit?.id === it._id ? (
              <div key={it._id} className="tp-i tp-edit">
                <GrowText value={edit.text} onChange={v => setEdit(s => ({ ...s, text: v }))} onEnter={saveEdit} autoFocus aria-label="Edit plan" />
                <div className="tp-f">
                  <ProjectPick names={names} value={edit.refName} onChange={v => setEdit(s => ({ ...s, refName: v }))} />
                  <span className="sp" />
                  <button type="button" className="btn sm" onClick={() => setEdit(null)} disabled={busy}>Cancel</button>
                  <button type="button" className="btn p sm" onClick={saveEdit} disabled={busy || !edit.text.trim()}>{busy ? "Saving…" : "Save"}</button>
                </div>
              </div>
            ) : (
              <div key={it._id} className={`tp-i${it.done ? " done" : ""}`}>
                <input type="checkbox" checked={!!it.done} onChange={() => tick(it)} aria-label={it.done ? "Mark as not done" : "Mark as done"} />
                <span className="tp-n">{n + 1}.</span>
                <div className="tp-body">
                  <div className="tp-txt"><Linkify text={it.text} /></div>
                  {it.refName && <span className="tp-ref">{it.refName}</span>}
                </div>
                <div className="tp-act">
                  <button type="button" className="tp-ib" onClick={() => setEdit({ id: it._id, text: it.text, refName: it.refName || "" })} title="Edit" aria-label="Edit this plan"><Pencil size={15} /></button>
                  <button type="button" className="tp-ib danger" onClick={() => del(it)} title="Remove" aria-label="Remove this plan"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          {!L.length && <div className="empty">Write what you plan to finish today, one item at a time, and tick each one off when it is done.</div>}
          {!L.length && yesterday && (
            <div className="li"><div className="x"><span className="sub">Yesterday you planned for today:</span><b>{yesterday}</b></div>
              <button type="button" className="btn sm" disabled={busy} onClick={() => add(null, yesterday)}>Add it</button></div>
          )}
          <form className="tp-add" onSubmit={add}>
            <GrowText value={text} onChange={setText} onEnter={() => add()} placeholder="Add a plan, e.g. Finish the login page. Shift + Enter for a new line." aria-label="New plan for today" />
            <div className="tp-f">
              <ProjectPick names={names} value={ref} onChange={setRef} />
              <span className="sp" />
              <button type="submit" className="btn p" disabled={busy || !text.trim()}><Plus size={15} /> Add plan</button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
