import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Send } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api, fileUrl } from "../../api";
import { ROLES, hasRole } from "../../roles";
import { toast } from "../../toast";
import { FilePick } from "./RolePages";

// Documents: send files with a message to a colleague (for example a tester to a developer).
// The person it is sent to sees it here and on their bell; the admin sees everything in the CRM.

const DEV = ["app", "web", "back", "full", "other"];
const tm = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const roleL = (r) => ROLES[r]?.l || r;

function Files({ files }) {
  if (!files?.length) return null;
  return <div className="doc-files">{files.map(f => <a key={f.url} className="bug-chip" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"><FileText size={12} /> {f.name}</a>)}</div>;
}

export default function Documents() {
  const P = usePortal();
  const me = P.session.user;
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [tab, setTab] = useState("received");
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const load = useCallback(() => api("/docs").then(j => setData(j.data), e => { toast(e.message); setData(d => d || { received: [], sent: [] }); }), []);
  useEffect(() => { queueMicrotask(load); api("/people").then(j => setPeople(j.data), () => {}); }, [load]);
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const rec = data?.received || [], sent = data?.sent || [];
  const unseen = rec.filter(d => !d.seenAt).length;
  const list = (tab === "sent" ? sent : rec).filter(d => !q || `${d.title} ${d.refName} ${d.fromName} ${d.toName} ${d.text}`.toLowerCase().includes(q.toLowerCase()));
  const cur = [...rec, ...sent].find(d => d._id === open);

  const act = async (d, body, ok) => {
    try {
      const j = await api(`/docs/${d._id}`, { method: "PATCH", body });
      setData(x => ({ received: x.received.map(y => (y._id === d._id ? { ...j.data, mine: false } : y)), sent: x.sent.map(y => (y._id === d._id ? { ...j.data, mine: true } : y)) }));
      if (ok) toast(ok);
      return true;
    } catch (e) { toast(e.message); return false; }
  };
  const openDoc = (d) => { setOpen(d._id); if (!d.mine && !d.seenAt) act(d, { action: "seen" }); };

  return (
    <>
      <h2 className="t">Documents<span>.</span></h2>
      <p className="lead">Send test reports, screenshots, specs or any file with a message to a colleague. They see it here and on their bell, and can reply. Your admin can see everything shared.</p>
      <div className="row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div className="seg">
          {[["received", `Received${unseen ? ` · ${unseen} new` : ""}`], ["sent", "Sent"], ["new", "Send documents"]].map(([k, t]) => <button type="button" key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setOpen(""); }}>{t}</button>)}
        </div>
        {tab !== "new" && <input type="search" className="mt-q" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search documents" />}
      </div>

      {tab === "new" ? <SendForm people={people} me={me} assigned={P.assigned} onSent={() => { load(); setTab("sent"); }} /> : (
        <div className="grid2">
          <section className="card"><h3>{tab === "sent" ? "Sent by you" : "Sent to you"} <small>{list.length}</small></h3>
            {data == null ? <div className="empty">Loading…</div> : list.length ? list.map(d => (
              <button type="button" key={d._id} className={`mcard ${open === d._id ? "on" : ""}`} onClick={() => openDoc(d)}>
                <b style={{ display: "block", color: "var(--navy)", fontWeight: 600 }}>{d.title}</b>
                <span className="sub">{d.mine ? `To ${d.toName}` : `From ${d.fromName}`}{d.refName ? ` · ${d.refName}` : ""} · {tm(d.createdAt)} · {d.files.length} file{d.files.length === 1 ? "" : "s"}{d.replies.length ? ` · ${d.replies.length} repl${d.replies.length === 1 ? "y" : "ies"}` : ""}</span>
                {d.done ? <span className="pill p-ok">Done</span> : d.seenAt ? <span className="pill p-blue">Seen {tm(d.seenAt)}</span> : <span className="pill p-amb">{d.mine ? "Not opened yet" : "New"}</span>}
              </button>
            )) : <div className="empty">{tab === "sent" ? <>Nothing sent yet. Use <b>Send documents</b>.</> : "Nothing has been sent to you yet."}</div>}
          </section>
          <div>{cur ? <Thread d={cur} act={act} /> : <section className="card"><div className="empty">Pick a document to read it and reply.</div></section>}</div>
        </div>
      )}
    </>
  );
}

function SendForm({ people, me, assigned, onSent }) {
  const [to, setTo] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  // developers first for a tester, then everyone else
  const sorted = useMemo(() => [...people].sort((a, b) => (hasRole(me, ["test"]) ? (DEV.includes(b.role) - DEV.includes(a.role)) : 0) || a.name.localeCompare(b.name)), [people, me]);
  const submit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!to) { toast("Pick who to send it to"); return; }
    if (!files.length && !d.text.trim()) { toast("Attach a document or write a message"); return; }
    setBusy(true);
    try {
      await api("/docs", { method: "POST", body: { to, refName: d.ref.trim(), title: d.title.trim(), text: d.text, files } });
      toast(`Sent to ${people.find(p => p.id === to)?.name}`);
      onSent();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <section className="card" style={{ maxWidth: 760 }}><h3>Send documents</h3>
      <form className="pad" onSubmit={submit}>
        <div className="g2">
          <div className="f"><label htmlFor="dc1">Send to</label>
            <select id="dc1" value={to} onChange={e => setTo(e.target.value)} required>
              <option value="">Pick a colleague…</option>
              {sorted.map(p => <option key={p.id} value={p.id}>{p.name} · {roleL(p.role)}</option>)}
            </select></div>
          <div className="f"><label htmlFor="dc2">Project</label><input id="dc2" name="ref" type="text" list="dc2l" placeholder="Optional" />
            <datalist id="dc2l">{[...assigned.projects, ...assigned.clients].map(r => <option key={r.id} value={r.name} />)}</datalist></div>
        </div>
        <div className="f"><label htmlFor="dc3">Title</label><input id="dc3" name="title" type="text" required placeholder="Test report for login and checkout, build 1.4" /></div>
        <div className="f"><label htmlFor="dc4">Message</label><textarea id="dc4" name="text" rows={6} placeholder="What is in the files and what you need from them" /></div>
        <div className="f"><label>Images and documents</label><FilePick id="dc5" files={files} onChange={setFiles} /></div>
        <div className="row"><button className="btn p lg" disabled={busy}><Send size={15} /> {busy ? "Sending…" : "Send"}</button></div>
      </form>
    </section>
  );
}

function Thread({ d, act }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const reply = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (await act(d, { action: "reply", text, files }, "Reply sent")) { setText(""); setFiles([]); }
    setBusy(false);
  };
  return (
    <section className="card"><h3>{d.title}</h3>
      <div className="pad">
        <p className="sub" style={{ marginTop: 0 }}>{d.mine ? `You sent this to ${d.toName}` : `${d.fromName} sent you this`}{d.refName ? ` · ${d.refName}` : ""} · {tm(d.createdAt)}{d.seenAt ? ` · seen ${tm(d.seenAt)}` : ""}</p>
        {d.text && <div className="doc-msg">{d.text}</div>}
        <Files files={d.files} />
        {!d.mine && (
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className={`btn sm ${d.done ? "" : "p"}`} onClick={() => act(d, { action: d.done ? "undone" : "done" }, d.done ? "Marked not done" : "Marked done")}>{d.done ? "Mark not done" : "Mark done"}</button>
          </div>
        )}
        {d.replies.length > 0 && <div className="doc-replies">{d.replies.map((r, i) => (
          <div key={i} className="doc-r"><b>{r.name}</b> <span className="sub" style={{ display: "inline" }}>{tm(r.at)}</span>{r.text && <div className="doc-msg">{r.text}</div>}<Files files={r.files} /></div>
        ))}</div>}
        <form onSubmit={reply} style={{ marginTop: 14 }}>
          <div className="f"><label htmlFor={`dr-${d._id}`}>Reply</label><textarea id={`dr-${d._id}`} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Write a reply" /></div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <FilePick id={`drf-${d._id}`} files={files} onChange={setFiles} />
            <button className="btn p" disabled={busy || (!text.trim() && !files.length)}>Send reply</button>
          </div>
        </form>
      </div>
    </section>
  );
}
