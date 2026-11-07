import Linkify from "../../Linkify";
import { useEffect, useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api } from "../../api";
import { toast } from "../../toast";
import { fdw } from "../../util";
import { useNewMessage } from "../../ding";
import { useLive, every, useTyping, sayTyping, typingText } from "../../live";
import { Tick } from "../../Tick";

const mine = (m) => m.from !== "admin";

// Chat between the employee and the admin (the admin replies from the CRM → Employee Portal → Messages)
const tm = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dk = (d) => new Date(d).toLocaleDateString("en-CA");

export default function Messages() {
  const P = usePortal();
  const [list, setList] = useState(null);
  useNewMessage(list, "admin", mine);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);
  const end = useRef(null);
  const { loadNotifs } = P;
  const refs = [...P.assigned.clients, ...P.assigned.projects];
  const typingIn = useTyping((d) => (d.chat === "pm" && d.from === "admin" ? { chat: "pm", person: "admin" } : null));
  const tp = typingIn("pm");

  useEffect(() => {
    let live = true;
    const load = () => api("/messages").then(
      j => { if (live) { setList(j.data); loadNotifs(); } },
      e => { if (live) { setList(l => l || []); toast(e.message); } },
    );
    load();
    const stop = every(2500, load);
    return () => { live = false; stop(); };
  }, [n, loadNotifs]);
  // the admin wrote (or another tab of mine sent): reload straight away
  useLive("pm", () => setN(x => x + 1));
  // Scroll only the message box, and only for a new message or when already at the bottom (so older messages can be read)
  const lastSeen = useRef("");
  useEffect(() => {
    const b = end.current;
    if (!b || !list) return;
    const last = list[list.length - 1]?._id || "";
    if (last !== lastSeen.current || b.scrollHeight - b.scrollTop - b.clientHeight < 80) b.scrollTop = b.scrollHeight;
    lastSeen.current = last;
  }, [list]);

  // The message shows straight away; it is swapped for the saved one when the server answers
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const tmp = { _id: `tmp-${Date.now()}`, from: "emp", text: t, refName: ref, createdAt: new Date().toISOString(), pending: true };
    setList(L => [...(L || []), tmp]); setText(""); setRef(""); setBusy(true);
    try {
      const j = await api("/messages", { method: "POST", body: { text: t, refName: tmp.refName } });
      setList(L => (L || []).map(m => (m._id === tmp._id ? j.data : m)));
    } catch (ex) { setList(L => (L || []).filter(m => m._id !== tmp._id)); setText(t); toast(ex.message); }
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
        <div className="chat-b" ref={end}>
          {list == null ? <div className="empty">Loading…</div> : !L.length ? <div className="empty">No messages yet. Send the first one below.</div> : L.map((m, i) => (
            <div key={m._id}>
              {(i === 0 || dk(L[i - 1].createdAt) !== dk(m.createdAt)) && <div className="chat-day"><span>{fdw(dk(m.createdAt))}</span></div>}
              <div className={`cm ${m.from === "emp" ? "me" : "them"}`}>
                <div className="bub">
                  {m.from === "admin" && <b className="who">{m.by || "Admin"}</b>}
                  {m.refName && <span className="about">About {m.refName}</span>}
                  <span className="txt"><Linkify text={m.text} /></span>
                  <small>{tm(m.createdAt)}{m.from === "emp" && <Tick pending={m.pending} seen={m.readAdmin} title={m.readAdmin ? `Seen${m.seenAt ? ` ${tm(m.seenAt)}` : ""}` : "Sent"} />}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
        {tp.length > 0 && <div className="typing" aria-live="polite"><i><b /><b /><b /></i>{typingText(tp)}</div>}
        <form className="chat-f" onSubmit={send}>
          {refs.length > 0 && (
            <select value={ref} onChange={e => setRef(e.target.value)} aria-label="About">
              <option value="">General</option>{refs.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          )}
          <textarea rows={1} value={text} onChange={e => { setText(e.target.value); if (e.target.value) sayTyping({ chat: "pm" }); }} placeholder="Write a message…" aria-label="Message"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
          <button className="btn p" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
        </form>
      </section>
    </>
  );
}
