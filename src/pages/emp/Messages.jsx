import { useEffect, useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api } from "../../api";
import { toast } from "../../toast";
import { fdw } from "../../util";

// Chat between the employee and the admin (the admin replies from the CRM → Employee Portal → Messages)
const tm = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dk = (d) => new Date(d).toLocaleDateString("en-CA");

export default function Messages() {
  const P = usePortal();
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);
  const end = useRef(null);
  const { loadNotifs } = P;
  const refs = [...P.assigned.clients, ...P.assigned.projects];

  useEffect(() => {
    let live = true;
    const load = () => api("/messages").then(
      j => { if (live) { setList(j.data); loadNotifs(); } },
      e => { if (live) { setList(l => l || []); toast(e.message); } },
    );
    load();
    const t = setInterval(load, 20000);
    return () => { live = false; clearInterval(t); };
  }, [n, loadNotifs]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api("/messages", { method: "POST", body: { text: text.trim(), refName: ref } }); setText(""); setRef(""); setN(x => x + 1); }
    catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  const L = list || [];

  return (
    <>
      <h2 className="t">Messages<span>.</span></h2>
      <p className="lead">Ask a question, share an update or reply to your admin. They answer from the CRM.</p>
      <section className="card chat">
        <div className="chat-h"><span className="av" style={{ background: "#0F172A" }}><ShieldCheck size={17} /></span>
          <span><b>NNC Admin</b><span className="sub">Harish and the management team</span></span></div>
        <div className="chat-b">
          {list == null ? <div className="empty">Loading…</div> : !L.length ? <div className="empty">No messages yet. Send the first one below.</div> : L.map((m, i) => (
            <div key={m._id}>
              {(i === 0 || dk(L[i - 1].createdAt) !== dk(m.createdAt)) && <div className="chat-day"><span>{fdw(dk(m.createdAt))}</span></div>}
              <div className={`cm ${m.from === "emp" ? "me" : "them"}`}>
                <div className="bub">
                  {m.from === "admin" && <b className="who">{m.by || "Admin"}</b>}
                  {m.refName && <span className="about">About {m.refName}</span>}
                  <span className="txt">{m.text}</span>
                  <small>{tm(m.createdAt)}{m.from === "emp" ? (m.readAdmin ? " · seen" : " · sent") : ""}</small>
                </div>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="chat-f" onSubmit={send}>
          {refs.length > 0 && (
            <select value={ref} onChange={e => setRef(e.target.value)} aria-label="About">
              <option value="">General</option>{refs.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          )}
          <textarea rows={1} value={text} onChange={e => setText(e.target.value)} placeholder="Write a message…" aria-label="Message"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
          <button className="btn p" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
        </form>
      </section>
    </>
  );
}
