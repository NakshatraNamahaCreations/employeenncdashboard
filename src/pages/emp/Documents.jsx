import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Send, Inbox, SendHorizontal, Plus, Search, Check, Paperclip, MessageSquare, FolderOpen, Film, CheckCircle2 } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api, fileUrl } from "../../api";
import { ROLES, hasRole, initials } from "../../roles";
import { toast } from "../../toast";
import Linkify from "../../Linkify";
import { FilePick } from "../../FilePick";

// Documents: send files with a message to a colleague (for example a tester to a developer).
// The person it is sent to sees it here and on their bell; the admin sees everything in the CRM.

const DEV = ["app", "web", "back", "full", "other"];
const tm = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const roleL = (r) => ROLES[r]?.l || r || "";
const roleC = (r) => ROLES[r]?.c || "#64748B";
const isImg = (f) => /^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp)$/i.test(f.url || "");
const isVid = (f) => /^video\//.test(f.type || "") || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.url || "");
const ext = (f) => (String(f.name || f.url).split(".").pop() || "").slice(0, 4).toUpperCase();

const Av = ({ name, role, size = 38 }) => (
  <span className="dc-av" style={{ background: roleC(role), width: size, height: size, fontSize: size * 0.34 }}>{initials(name)}</span>
);

// Screenshots as thumbnails, other files as cards
function FileGrid({ files }) {
  if (!files?.length) return null;
  const img = files.filter(isImg), other = files.filter(f => !isImg(f));
  return (
    <div className="dc-files">
      {img.length > 0 && <div className="dc-thumbs">{img.map(f => <a key={f.url} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title={f.name}><img src={fileUrl(f.url)} alt={f.name} loading="lazy" /></a>)}</div>}
      {other.map(f => (
        <a key={f.url} className="dc-file" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title={f.name}>
          <span className={`dc-file-ic${isVid(f) ? " vid" : ""}`}>{isVid(f) ? <Film size={16} /> : <FileText size={16} />}<em>{isVid(f) ? "VIDEO" : ext(f)}</em></span>
          <span className="dc-file-n">{f.name}</span>
        </a>
      ))}
    </div>
  );
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
  const roleOf = (id) => people.find(p => p.id === String(id))?.role;

  const act = async (d, body, ok) => {
    try {
      const j = await api(`/docs/${d._id}`, { method: "PATCH", body });
      setData(x => ({ received: x.received.map(y => (y._id === d._id ? { ...j.data, mine: false } : y)), sent: x.sent.map(y => (y._id === d._id ? { ...j.data, mine: true } : y)) }));
      if (ok) toast(ok);
      return true;
    } catch (e) { toast(e.message); return false; }
  };
  const openDoc = (d) => { setOpen(d._id); if (!d.mine && !d.seenAt) act(d, { action: "seen" }); };
  const TABS = [["received", "Received", Inbox, rec.length], ["sent", "Sent", SendHorizontal, sent.length], ["new", "Send documents", Plus, null]];

  return (
    <>
      <div className="dc-hero">
        <span className="dc-hero-ic"><FolderOpen size={24} /></span>
        <div className="dc-hero-t">
          <h2 className="t">Documents<span>.</span></h2>
          <p className="lead">Send test reports, screenshots, screen recordings or any file to a colleague with a message. They get it on their bell and can reply. Your admin can see everything shared.</p>
        </div>
        {tab !== "new" && <button type="button" className="btn p lg" onClick={() => { setTab("new"); setOpen(""); }}><Plus size={16} /> Send documents</button>}
      </div>

      <div className="dc-bar">
        <div className="dc-tabs" role="tablist" aria-label="Documents">
          {TABS.map(([k, t, icon, n]) => (
            <button type="button" role="tab" aria-selected={tab === k} key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setOpen(""); }}>
              {createElement(icon, { size: 15 })} {t}{n != null && <small>{n}</small>}{k === "received" && unseen > 0 && <em>{unseen} new</em>}
            </button>
          ))}
        </div>
        {tab !== "new" && <label className="dc-search"><Search size={15} /><input type="search" placeholder="Search title, project or person" value={q} onChange={e => setQ(e.target.value)} aria-label="Search documents" /></label>}
      </div>

      {tab === "new" ? <SendForm people={people} me={me} assigned={P.assigned} onSent={() => { load(); setTab("sent"); }} /> : (
        <div className="dc-split">
          <section className="card dc-list">
            <div className="dc-list-h">{tab === "sent" ? "Sent by you" : "Sent to you"} <small>{list.length}</small></div>
            {data == null ? <div className="empty">Loading…</div> : list.length ? list.map(d => {
              const who = d.mine ? d.toName : d.fromName, wid = d.mine ? d.to : d.from;
              return (
                <button type="button" key={d._id} className={`dc-item${open === d._id ? " on" : ""}${!d.mine && !d.seenAt ? " new" : ""}`} onClick={() => openDoc(d)}>
                  <Av name={who} role={roleOf(wid)} />
                  <span className="dc-it">
                    <span className="dc-it-top"><b>{d.title}</b><small>{tm(d.createdAt)}</small></span>
                    <span className="dc-it-sub">{d.mine ? "To" : "From"} {who}{d.refName ? ` · ${d.refName}` : ""}</span>
                    <span className="dc-it-meta">
                      {d.files.length > 0 && <span className="dc-chip"><Paperclip size={12} /> {d.files.length}</span>}
                      {d.replies.length > 0 && <span className="dc-chip"><MessageSquare size={12} /> {d.replies.length}</span>}
                      {d.done ? <span className="pill p-ok">Done</span> : d.seenAt ? <span className="pill p-blue">Seen {tm(d.seenAt)}</span> : <span className="pill p-amb">{d.mine ? "Not opened yet" : "New"}</span>}
                    </span>
                  </span>
                </button>
              );
            }) : (
              <div className="dc-empty"><span><Inbox size={26} /></span>
                <b>{q ? "Nothing matches your search" : tab === "sent" ? "Nothing sent yet" : "Nothing sent to you yet"}</b>
                {!q && tab === "sent" && <button type="button" className="btn p" onClick={() => setTab("new")}><Plus size={15} /> Send documents</button>}</div>
            )}
          </section>
          <div>{cur ? <Thread d={cur} act={act} me={me} roleOf={roleOf} /> : (
            <section className="card"><div className="dc-empty"><span><FileText size={26} /></span><b>Pick a document</b><small>Open one on the left to see the files, reply or mark it done.</small></div></section>
          )}</div>
        </div>
      )}
    </>
  );
}

function SendForm({ people, me, assigned, onSent }) {
  const [to, setTo] = useState("");
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  // developers first for a tester, then everyone else
  const sorted = useMemo(() => [...people].sort((a, b) => (hasRole(me, ["test"]) ? (DEV.includes(b.role) - DEV.includes(a.role)) : 0) || a.name.localeCompare(b.name)), [people, me]);
  const shown = sorted.filter(p => !who.trim() || `${p.name} ${roleL(p.role)}`.toLowerCase().includes(who.trim().toLowerCase()));
  const person = people.find(p => p.id === to);
  const submit = async (e) => {
    e.preventDefault();
    if (!to) { toast("Pick who to send it to"); return; }
    if (!title.trim()) { toast("Give it a title"); return; }
    if (!files.length && !text.trim()) { toast("Attach a file or write a message"); return; }
    setBusy(true);
    try {
      await api("/docs", { method: "POST", body: { to, refName: ref.trim(), title: title.trim(), text, files } });
      toast(`Sent to ${person?.name}`);
      onSent();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <form className="dc-send" onSubmit={submit}>
      <section className="card dc-main">
        <div className="dc-step"><span>1</span> Who is it for?</div>
        <label className="dc-search wide"><Search size={15} /><input type="search" placeholder="Search a colleague by name or role" value={who} onChange={e => setWho(e.target.value)} aria-label="Search colleague" /></label>
        <div className="dc-people" role="listbox" aria-label="Colleagues">
          {shown.length ? shown.map(p => (
            <button type="button" role="option" aria-selected={to === p.id} key={p.id} className={`dc-person${to === p.id ? " on" : ""}`} onClick={() => setTo(p.id)}>
              <Av name={p.name} role={p.role} size={34} />
              <span><b>{p.name}</b><small>{roleL(p.role)}</small></span>
              {to === p.id && <span className="dc-ok"><Check size={14} /></span>}
            </button>
          )) : <div className="sub" style={{ padding: 8 }}>{people.length ? "Nobody matches." : "Loading colleagues…"}</div>}
        </div>

        <div className="dc-step"><span>2</span> What are you sending?</div>
        <div className="g2">
          <div className="f"><label htmlFor="dc3">Title</label><input id="dc3" type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Test report for login and checkout, build 1.4" /></div>
          <div className="f"><label htmlFor="dc2">Project <span className="sub" style={{ display: "inline" }}>(optional)</span></label><input id="dc2" type="text" list="dc2l" value={ref} onChange={e => setRef(e.target.value)} placeholder="Pick or type a project" />
            <datalist id="dc2l">{[...assigned.projects, ...assigned.clients].map(r => <option key={r.id} value={r.name} />)}</datalist></div>
        </div>
        <div className="f"><label htmlFor="dc4">Message</label><textarea id="dc4" rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="What is in the files and what you need from them" /></div>

        <div className="dc-step"><span>3</span> Attach files</div>
        <FilePick id="dc5" files={files} onChange={setFiles} />
      </section>

      <aside className="dc-side">
        <section className="card dc-preview">
          <div className="dc-pv-h">Ready to send</div>
          <div className="dc-pv-to">
            {person ? <><Av name={person.name} role={person.role} size={40} /><span><b>{person.name}</b><small>{roleL(person.role)}</small></span></>
              : <span className="dc-pv-none">Pick a colleague</span>}
          </div>
          <ul className="dc-pv-list">
            <li className={title.trim() ? "ok" : ""}><CheckCircle2 size={15} /> {title.trim() || "Title"}</li>
            <li className={ref.trim() ? "ok" : ""}><CheckCircle2 size={15} /> {ref.trim() || "Project (optional)"}</li>
            <li className={text.trim() ? "ok" : ""}><CheckCircle2 size={15} /> {text.trim() ? `Message · ${text.trim().length} characters` : "Message"}</li>
            <li className={files.length ? "ok" : ""}><CheckCircle2 size={15} /> {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} attached` : "Files"}</li>
          </ul>
          <button className="btn p lg dc-sendbtn" disabled={busy || !to}><Send size={16} /> {busy ? "Sending…" : person ? `Send to ${person.name.split(" ")[0]}` : "Send"}</button>
          <p className="sub dc-pv-note">They get a notification on their bell and can reply here. Your admin can see it too.</p>
        </section>
      </aside>
    </form>
  );
}

function Thread({ d, act, me, roleOf }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const reply = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (await act(d, { action: "reply", text, files }, "Reply sent")) { setText(""); setFiles([]); }
    setBusy(false);
  };
  const other = d.mine ? d.toName : d.fromName, otherId = d.mine ? d.to : d.from;
  return (
    <section className="card dc-thread">
      <div className="dc-th-h">
        <Av name={other} role={roleOf(otherId)} size={42} />
        <div className="dc-th-t"><b>{d.title}</b>
          <span className="sub">{d.mine ? `You sent this to ${d.toName}` : `${d.fromName} sent you this`}{d.refName ? ` · ${d.refName}` : ""} · {tm(d.createdAt)}{d.seenAt ? ` · seen ${tm(d.seenAt)}` : ""}</span></div>
        {!d.mine && <button type="button" className={`btn sm ${d.done ? "" : "p"}`} onClick={() => act(d, { action: d.done ? "undone" : "done" }, d.done ? "Marked not done" : "Marked done")}>{d.done ? "Mark not done" : <><Check size={14} /> Mark done</>}</button>}
      </div>
      <div className="dc-th-b">
        <div className={`dc-msg${d.mine ? " me" : ""}`}>
          <div className="dc-msg-h"><b>{d.fromName}</b><small>{tm(d.createdAt)}</small></div>
          {d.text && <div className="dc-msg-t"><Linkify text={d.text} /></div>}
          <FileGrid files={d.files} />
        </div>
        {d.replies.map((r, i) => (
          <div key={i} className={`dc-msg${String(r.by) === String(me.id) ? " me" : ""}`}>
            <div className="dc-msg-h"><b>{r.name}</b><small>{tm(r.at)}</small></div>
            {r.text && <div className="dc-msg-t"><Linkify text={r.text} /></div>}
            <FileGrid files={r.files} />
          </div>
        ))}
      </div>
      <form className="dc-reply" onSubmit={reply}>
        <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={`Reply to ${other.split(" ")[0]}…`} aria-label="Reply" />
        <FilePick id={`drf-${d._id}`} files={files} onChange={setFiles} hint="Paste a screenshot (Ctrl+V) or drop files" />
        <div className="dc-reply-f"><button className="btn p" disabled={busy || (!text.trim() && !files.length)}><Send size={15} /> {busy ? "Sending…" : "Send reply"}</button></div>
      </form>
    </section>
  );
}
