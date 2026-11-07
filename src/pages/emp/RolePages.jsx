import Linkify from "../../Linkify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { ROLES, roleInfo, hasRole } from "../../roles";
import { api, upload, fileUrl } from "../../api";
import { toast } from "../../toast";
import { EntryLi } from "./EmpPages";
import Modal from "../../Modal";
import { today, fd, fdw, greet, rs, monthStart, iso } from "../../util";

export function RolePage() {
  const { rolePage } = useParams();
  const { session } = usePortal();
  const R = roleInfo(session.user);
  if (!R.pages.some(p => p[0] === rolePage)) return <Navigate to="/" replace />;
  return { ranks: <Ranks />, ads: <AdsReport />, designs: <Designs />, bugs: <Bugs />, payments: <Payments /> }[rolePage];
}

// Load one GET endpoint; reload() after a change
function useGet(path) {
  const [st, setSt] = useState({ data: null, err: "", key: "" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    api(path).then(j => live && setSt({ data: j.data, err: "", key: path }), e => live && setSt({ data: null, err: e.message, key: path }));
    return () => { live = false; };
  }, [path, n]);
  const fresh = st.key === path;
  return { data: fresh ? st.data : null, err: fresh ? st.err : "", loading: !!path && !fresh, reload: useCallback(() => setN(x => x + 1), []) };
}

function ClientPick({ clients, value, onChange }) {
  return (
    <div className="f" style={{ maxWidth: 420 }}><label htmlFor="cp">Client</label>
      <select id="cp" value={value} onChange={e => onChange(e.target.value)}>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></div>
  );
}
const NoClients = () => <div className="empty">No clients are assigned to you yet. Your manager assigns clients in the CRM (SEO & Ads Team → Clients).</div>;

/* ───────── SEO analyst: keyword positions ───────── */
function Ranks() {
  const P = usePortal();
  const C = P.assigned.clients;
  const [cid, setCid] = useState("");
  const client = cid || C[0]?.id || "";
  const K = useGet(client ? `/keywords?client=${client}` : "");
  const [pos, setPos] = useState({});
  const [busy, setBusy] = useState(false);
  const rows = K.data || [];
  const save = async () => {
    const list = Object.entries(pos).filter(([, v]) => +v > 0).map(([keyword, v]) => ({ keyword, pos: +v }));
    if (!list.length) { toast("Enter at least one position"); return; }
    setBusy(true);
    try { const j = await api("/ranks", { method: "POST", body: { client, date: today(), rows: list } }); toast(`${j.saved} positions saved`); setPos({}); K.reload(); P.refresh(); }
    catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <h2 className="t">Keyword positions<span>.</span></h2>
      <p className="lead">Update the Google position of every agreed keyword once a week. Day 1 is the position when work started.</p>
      {!C.length ? <section className="card"><NoClients /></section> : (
        <section className="card"><h3>Positions</h3>
          <div className="pad" style={{ paddingBottom: 0 }}><ClientPick clients={C} value={client} onChange={(v) => { setCid(v); setPos({}); }} /></div>
          <div className="tw"><table><thead><tr><th>Keyword</th><th style={{ textAlign: "right" }}>Day 1</th><th style={{ textAlign: "right" }}>Last update</th><th style={{ textAlign: "right" }}>Change since day 1</th><th style={{ width: 150 }}>Position today</th></tr></thead>
            <tbody>
              {K.loading ? <tr><td colSpan={5}><div className="empty">Loading…</div></td></tr>
                : K.err ? <tr><td colSpan={5}><div className="empty">{K.err}</div></td></tr>
                  : !rows.length ? <tr><td colSpan={5}><div className="empty">No keywords agreed for this client yet. They are added in the CRM (SEO & Ads Team → Keywords).</div></td></tr>
                    : rows.map(k => {
                      const h = k.hist.filter(x => x.pos != null || true), first = h[0], last = h[h.length - 1];
                      const p = (x) => (x ? (x.pos == null ? "100+" : x.pos) : "-");
                      const ch = first && last && first.pos != null && last.pos != null ? first.pos - last.pos : null;
                      return (
                        <tr key={k.id}>
                          <td><b>{k.keyword}</b></td>
                          <td style={{ textAlign: "right" }}>{p(first)}</td>
                          <td style={{ textAlign: "right" }}>{p(last)}{last ? <span className="sub">{fd(last.date)}</span> : null}</td>
                          <td style={{ textAlign: "right", color: ch > 0 ? "var(--ok)" : ch < 0 ? "var(--red)" : "var(--mut)" }}>{ch == null ? "-" : ch > 0 ? `up ${ch}` : ch < 0 ? `down ${-ch}` : "same"}</td>
                          <td><input type="number" min="1" max="101" aria-label={`Position for ${k.keyword}`} value={pos[k.keyword] || ""} onChange={e => setPos(s => ({ ...s, [k.keyword]: e.target.value }))} /></td>
                        </tr>
                      );
                    })}
            </tbody></table></div>
          <div className="pad row" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="sub" style={{ flex: 1 }}>Check positions in Google Search Console or your rank tracker. Not in the top 100? Enter 101.</span>
            <button type="button" className="btn p" disabled={busy || !rows.length} onClick={save}>{busy ? "Saving…" : "Save positions"}</button>
          </div>
        </section>
      )}
    </>
  );
}

/* ───────── Google Ads expert: daily report ───────── */
function parseTerms(txt) {
  const lines = String(txt || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (l) => (l.includes("\t") ? l.split("\t") : l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).map(x => x.replace(/^"|"$/g, "").trim());
  let idx = { t: 0, clicks: 1, cost: 2, conv: 3 }, start = 0;
  const h = split(lines[0]).map(x => x.toLowerCase());
  const fi = (re) => h.findIndex(x => re.test(x));
  if (fi(/search term|^term|keyword/) >= 0) { idx = { t: fi(/search term|^term|keyword/), clicks: fi(/^clicks/), cost: fi(/^cost/), conv: fi(/^conv/) }; start = 1; }
  const n = (s) => +String(s || "0").replace(/[^0-9.]/g, "") || 0;
  return lines.slice(start).map(split).filter(r => r[idx.t] && !/^total/i.test(r[idx.t])).map(r => ({ t: r[idx.t], clicks: n(r[idx.clicks]), cost: n(r[idx.cost]), conv: n(r[idx.conv]) }));
}
const wasted = (terms, spend) => terms.filter(t => t.conv === 0 && t.cost >= Math.max(150, spend * 0.05));

function AdsReport() {
  const P = usePortal();
  const C = P.assigned.clients;
  const [cid, setCid] = useState("");
  const client = cid || C[0]?.id || "";
  const cl = C.find(c => c.id === client);
  const H = useGet(client ? `/ads?client=${client}` : "");
  const [f, setF] = useState({ contact: "", spend: "", clicks: "", impr: "", conv: "" });
  const [terms, setTerms] = useState("");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const L = useMemo(() => parseTerms(terms), [terms]);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const sp = +f.spend || L.reduce((a, t) => a + t.cost, 0);
  const w = wasted(L, sp);
  const onFile = (file) => { if (!file) return; const r = new FileReader(); r.onload = () => { setTerms(String(r.result)); toast("Search terms loaded"); }; r.readAsText(file); };
  const pickClient = (v) => { setCid(v); setMsg(""); setSaved(null); };

  const write = async (e) => {
    e.preventDefault();
    const clicks = +f.clicks, impr = +f.impr, conv = +f.conv, spend = +f.spend;
    const top = [...L].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    const contact = f.contact || cl?.contact || "";
    setBusy(true);
    try {
      const j = await api("/ads", { method: "POST", body: { client, date: today(), spend, clicks, impr, conv, terms: L, negs: w.map(t => t.t) } });
      setSaved(j.data);
      setMsg(`${greet()}${contact ? ` ${contact}` : ""}, here is today's Google Ads update for ${cl?.name} (${fdw(today())}):

• Amount spent: ${rs(spend)}
• Clicks: ${clicks.toLocaleString("en-IN")} | Impressions: ${impr.toLocaleString("en-IN")} | CTR: ${impr ? ((clicks / impr) * 100).toFixed(1) : 0}%
• Leads: ${conv}${conv ? ` | Cost per lead: ${rs(spend / conv)}` : ""}
• Average cost per click: ${rs(clicks ? spend / clicks : 0)}
${top.length ? `\nTop search terms today:\n${top.map((t, i) => `${i + 1}. ${t.t}: ${t.clicks} clicks${t.conv ? `, ${t.conv} lead${t.conv > 1 ? "s" : ""}` : ""}`).join("\n")}\n` : ""}${w.length ? `\nTerms we have blocked to save budget: ${w.map(t => t.t).join(", ")}\n` : ""}
Regards,
${P.session.user.name}, Google Ads team
Nakshatra Namaha Creations`);
      toast("Saved to the CRM. Check the message and send it.");
      H.reload(); P.refresh();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  const sent = async () => {
    if (!saved?._id || saved.sent) return;
    try { await api(`/ads/${saved._id}/sent`, { method: "PUT" }); setSaved(s => ({ ...s, sent: true })); H.reload(); } catch { /* the message still opens */ }
  };
  const phone = String(cl?.phone || "").replace(/\D/g, "");

  if (!C.length) return (<><h2 className="t">Daily ads report<span>.</span></h2><section className="card"><NoClients /></section></>);
  return (
    <>
      <h2 className="t">Daily ads report<span>.</span></h2>
      <p className="lead">Enter today's numbers and upload the search terms. The client message is written for you.</p>
      <div className="grid2">
        <div>
          <section className="card"><h3>{fdw(today())}</h3>
            <form className="pad" onSubmit={write}>
              <div className="g2">
                <ClientPick clients={C} value={client} onChange={pickClient} />
                <div className="f"><label htmlFor="acn">Contact name (for the message)</label><input id="acn" type="text" value={f.contact} onChange={set("contact")} placeholder={cl?.contact || "Eg. Supreeth sir"} /></div>
              </div>
              <div className="g4">
                <div className="f"><label htmlFor="as">Amount spent (₹)</label><input id="as" type="number" min="0" required value={f.spend} onChange={set("spend")} /></div>
                <div className="f"><label htmlFor="acl">Clicks</label><input id="acl" type="number" min="0" required value={f.clicks} onChange={set("clicks")} /></div>
                <div className="f"><label htmlFor="ai">Impressions</label><input id="ai" type="number" min="0" required value={f.impr} onChange={set("impr")} /></div>
                <div className="f"><label htmlFor="av">Leads</label><input id="av" type="number" min="0" required value={f.conv} onChange={set("conv")} /></div>
              </div>
              <div className="f"><label htmlFor="tf">Search terms report: upload the CSV from Google Ads</label><input id="tf" type="file" accept=".csv,.txt,.tsv" onChange={e => onFile(e.target.files[0])} /></div>
              <div className="f"><label htmlFor="tt">or paste it here (search term, clicks, cost, leads)</label>
                <textarea id="tt" rows={6} value={terms} onChange={e => setTerms(e.target.value)} placeholder={"Search term, Clicks, Cost, Conversions\ncar ceramic coating, 22, 410, 2"} /></div>
              {L.length > 0 && (
                <div className="alert bl" style={{ display: "block" }}>
                  <b>{L.length} search terms read.</b> {L.reduce((a, t) => a + t.clicks, 0)} clicks, {rs(L.reduce((a, t) => a + t.cost, 0))} cost, {L.reduce((a, t) => a + t.conv, 0)} leads.
                  {w.length > 0 && <><br /><span style={{ color: "var(--red)" }}>No leads but spending money: {w.map(t => t.t).join(", ")}. Consider adding them as negative keywords.</span></>}
                </div>
              )}
              <button className="btn p lg" disabled={busy}>{busy ? "Saving…" : "Save and write client message"}</button>
            </form>
          </section>
          <section className="card"><h3>Recent reports <small>{cl?.name}</small></h3>
            {H.loading ? <div className="empty">Loading…</div> : (H.data || []).length ? H.data.map(r => (
              <div key={r._id} className="li"><div className="x"><b>{fdw(r.date)}</b>
                <span className="sub">{rs(r.spend)} spent · {r.clicks} clicks · {r.conv} leads</span></div>
                {r.sent ? <span className="pill p-ok">Sent</span> : <span className="pill p-amb">Not sent</span>}</div>
            )) : <div className="empty">No reports for this client yet.</div>}
          </section>
        </div>
        <section className="card"><h3>Message for the client</h3>
          <div className="pad">
            {msg ? (
              <>
                <textarea className="msg" value={msg} onChange={e => setMsg(e.target.value)} aria-label="Client message" />
                <div className="row" style={{ marginTop: 12 }}>
                  <a className="btn g" href={`https://wa.me/${phone.length >= 10 ? (phone.length === 10 ? `91${phone}` : phone) : ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" onClick={sent}>Send on WhatsApp</a>
                  <a className="btn" href={`mailto:?subject=${encodeURIComponent(`Google Ads update: ${cl?.name}`)}&body=${encodeURIComponent(msg)}`} onClick={sent}>Email</a>
                  <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(msg).then(() => toast("Copied"), () => toast("Select the text and copy it")); }}>Copy</button>
                </div>
              </>
            ) : <div className="empty">Fill in today's numbers and save. The message appears here.</div>}
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────── Designers ───────── */
function Designs() {
  const P = usePortal();
  const [fbFor, setFbFor] = useState(null);
  const D = P.entries.filter(e => ["screen", "revision", "poster"].includes(e.type));
  const st = (e) => e.meta?.status || "";
  const setStatus = (id, status, fb) => P.run(() => api(`/designs/${id}`, { method: "PATCH", body: { status, fb } }), status === "approved" ? "Marked approved" : "Changes noted");
  const ms = monthStart();
  return (
    <>
      <h2 className="t">My designs<span>.</span></h2>
      <p className="lead">Screens and creatives you sent to clients. Update each one when the client approves or asks for changes.</p>
      <div className="kpis">
        <div className="kpi"><span className="l">Changes asked</span><span className="v" style={{ color: "var(--amb)" }}>{D.filter(e => st(e) === "changes").length}</span></div>
        <div className="kpi"><span className="l">With client</span><span className="v">{D.filter(e => st(e) === "review").length}</span></div>
        <div className="kpi"><span className="l">Approved this month</span><span className="v" style={{ color: "var(--ok)" }}>{D.filter(e => st(e) === "approved" && e.date >= ms).length}</span></div>
        <div className="kpi"><span className="l">Posters this month</span><span className="v">{D.filter(e => e.type === "poster" && e.date >= ms).length}</span></div>
      </div>
      <section className="card"><h3>Logged designs <Link className="btn sm p r" to="/log">+ Log a design</Link></h3>
        {D.length ? D.map(e => (
          <div key={e._id}>
            <EntryLi e={e} />
            {e.type !== "poster" && (
              <div className="li" style={{ paddingTop: 0, borderTop: 0 }}>
                <div className="x sub">{st(e) === "changes" && e.meta?.fb ? `Client feedback: ${e.meta.fb}` : ""}</div>
                {st(e) === "approved" ? <span className="pill p-ok">Approved</span> : st(e) === "draft" ? <span className="pill">Draft</span> : (
                  <>
                    {st(e) === "changes" ? <span className="pill p-amb">Changes asked</span> : <span className="pill p-blue">With client</span>}
                    <button type="button" className="btn sm" onClick={() => setFbFor(e)}>Client asked changes</button>
                    <button type="button" className="btn sm p" onClick={() => setStatus(e._id, "approved")}>Approved</button>
                  </>
                )}
              </div>
            )}
          </div>
        )) : <div className="empty">No designs logged in the last 10 weeks.</div>}</section>
      {fbFor && (
        <Modal title="What did the client ask to change?" onClose={() => setFbFor(null)}>
          <form onSubmit={async (ev) => { ev.preventDefault(); await setStatus(fbFor._id, "changes", new FormData(ev.target).get("fb")); setFbFor(null); }}>
            <p className="sub" style={{ marginTop: 0 }}>{fbFor.title}{fbFor.refName ? ` · ${fbFor.refName}` : ""}</p>
            <div className="f"><label htmlFor="fb">Feedback</label><textarea id="fb" name="fb" rows={4} required /></div>
            <button className="btn p">Save</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ───────── Developers and testers: bugs ───────── */
const SEV = { High: 0, Medium: 1, Low: 2 };
const ST = {
  open: ["Open", "p-red"], reopened: ["Reopened", "p-red"], progress: ["In progress", "p-amb"], info: ["Needs more info", "p-amb"],
  fixed: ["Fixed, to verify", "p-blue"], notbug: ["Not a bug", "p-gr"], verified: ["Verified", "p-ok"],
};
const DEV_ST = [["open", "Open"], ["progress", "In progress"], ["info", "Needs more info"], ["fixed", "Fixed"], ["notbug", "Not a bug"]];
const bugPill = (s) => (ST[s] ? <span className={`pill ${ST[s][1]}`}>{ST[s][0]}</span> : null);
const hm = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
// A new or reopened bug: has the developer opened it yet?
const SeenPill = ({ m }) => (!["open", "reopened"].includes(m.status) ? null : m.seenAt
  ? <span className="pill p-blue" title={`Opened by ${m.assignName || "the developer"}`}>Opened {hm(m.seenAt)}</span>
  : <span className="pill p-gr">Not opened yet</span>);
const fmtMins = (m) => (!m ? "" : m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} h`);
const isImg = (f) => /^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp)$/i.test(f.url);
const fullUrl = (u) => (u ? (/^https?:/.test(u) ? u : `https://${u}`) : "");

// Attached screenshots and documents
function Files({ list }) {
  if (!list?.length) return null;
  return (
    <div className="bug-files">
      {list.map((f, i) => (
        <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" className={isImg(f) ? "bf-img" : "bf-doc"} title={f.name}>
          {isImg(f) ? <img src={fileUrl(f.url)} alt={f.name} loading="lazy" /> : <span>{f.name}</span>}
        </a>
      ))}
    </div>
  );
}

// Attach files: click to browse, drag them in, or paste (Ctrl+V) a copied screenshot or file.
// Each one uploads straight away. A paste goes to the attach box nearest to where you are typing.
const MAX_FILES = 10, MAX_MB = 25;
const kb = (n) => (!n ? "" : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const extOf = (f) => (String(f.name || f.url).split(".").pop() || "").slice(0, 4).toUpperCase();
// the largest part of the page that holds this attach box and no other
function scopeOf(el) {
  let s = el;
  while (s?.parentElement && s.tagName !== "FORM" && s.parentElement !== document.body && s.parentElement.querySelectorAll(".fp").length === 1) s = s.parentElement;
  return s;
}
// a pasted screenshot is called "image.png"; give it a readable name
const named = (f) => {
  if (!/^image\.(png|jpe?g|gif|webp)$/i.test(f.name || "")) return f;
  const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
  return new File([f], `Screenshot ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())}.${f.name.split(".").pop()}`, { type: f.type });
};

export function FilePick({ files, onChange, id }) {
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const zone = useRef(null);
  const count = useRef(files.length);
  useEffect(() => { count.current = files.length; }, [files.length]);

  const add = useCallback(async (list) => {
    let L = [...list].map(named);
    const room = MAX_FILES - count.current;
    if (room <= 0) { toast(`Up to ${MAX_FILES} files can be attached`); return; }
    if (L.length > room) { toast(`Only ${room} more file${room > 1 ? "s" : ""} can be attached`); L = L.slice(0, room); }
    setBusy(n => n + L.length);
    for (const f of L) {
      if (f.size > MAX_MB * 1048576) toast(`${f.name} is over ${MAX_MB} MB`);
      else {
        try { const d = await upload(f); onChange(prev => [...prev, { ...d, size: d.size || f.size }]); }
        catch (ex) { toast(ex.message); }
      }
      setBusy(n => n - 1);
    }
  }, [onChange]);

  // Ctrl+V with a copied image or file, anywhere in this form (text pastes work as usual)
  useEffect(() => {
    const onPaste = (e) => {
      const el = zone.current;
      if (!el) return;
      const t = e.target instanceof Element ? e.target : document.body;
      const mine = scopeOf(el).contains(t) || el.contains(document.activeElement) || (t === document.body && document.querySelectorAll(".fp").length === 1);
      if (!mine) return;
      const F = [...(e.clipboardData?.files || [])];
      if (!F.length) return;
      e.preventDefault();
      add(F);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [add]);

  const drop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) add(e.dataTransfer.files); };
  return (
    <div className="fp">
      <label ref={zone} htmlFor={id} className={`fp-zone${over ? " over" : ""}`} tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById(id)?.click(); } }}>
        <span className="fp-ic"><UploadCloud size={22} /></span>
        <span className="fp-t"><b>Drop files here, paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>, or <u>browse</u></b>
          <small>Screenshots, PDF, Word, Excel or zip · up to {MAX_FILES} files, {MAX_MB} MB each</small></span>
      </label>
      <input id={id} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {(files.length > 0 || busy > 0) && (
        <div className="fp-list">
          {files.map((f, i) => (
            <div key={f.url} className="fp-item">
              {isImg(f) ? <img src={fileUrl(f.url)} alt="" /> : <span className="fp-doc"><FileText size={18} /><em>{extOf(f)}</em></span>}
              <span className="fp-name"><a href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title={f.name}>{f.name}</a><small>{kb(f.size)}</small></span>
              <button type="button" className="fp-x" aria-label={`Remove ${f.name}`} onClick={() => onChange(prev => prev.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <div key={`u${i}`} className="fp-item up"><span className="fp-doc"><span className="fp-spin" /></span><span className="fp-name"><b>Uploading…</b></span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function BugLi({ b, onOpen, children }) {
  const m = b.meta || {}, nc = (m.comments || []).filter(c => c.text || c.files?.length).length;
  return (
    <div className="li">
      <div className="x">
        <span className="tag">{m.bug}</span><b>{b.title}</b>
        <span className="sub">{[b.refName, m.mod, m.sev, fmtMins(m.mins), m.assignName ? `to ${m.assignName}` : "", b.account?.name ? `by ${b.account.name}` : "", fd(b.date)].filter(Boolean).join(" · ")}</span>
        {m.steps && <span className="sub">Steps: <Linkify text={m.steps} /></span>}
        {m.note && <span className="sub">Note: <Linkify text={m.note} /></span>}
        {b.url && <a className="url" href={b.url} target="_blank" rel="noopener noreferrer">{b.url.replace(/^https?:\/\//, "")}</a>}
        {(m.files?.length > 0 || nc > 0) && <span className="sub">{[m.files?.length ? `${m.files.length} attachment${m.files.length > 1 ? "s" : ""}` : "", nc ? `${nc} comment${nc > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}</span>}
      </div>
      {bugPill(m.status)}<SeenPill m={m} />{children}
      {onOpen && <button type="button" className="btn sm" onClick={() => onOpen(b)}>View</button>}
    </div>
  );
}

// One test run a tester logged: what was tested, passed and failed
function TestLi({ t }) {
  const m = t.meta || {}, fail = +m.fail || 0;
  return (
    <div className="li">
      <div className="x"><b>{t.title}</b>
        <span className="sub">{[t.refName, m.mod, m.ver && `v${m.ver}`, t.account?.name ? `by ${t.account.name}` : "", fd(t.date)].filter(Boolean).join(" · ")}</span>
        {t.url && <a className="url" href={t.url} target="_blank" rel="noopener noreferrer">{t.url.replace(/^https?:\/\//, "")}</a>}
      </div>
      <span className="pill p-ok">{+m.pass || 0} passed</span>
      <span className={`pill ${fail ? "p-red" : "p-other"}`}>{fail} failed</span>
    </div>
  );
}

// A bug with its attachments, status and the comments between tester and developer
function BugView({ bug, tester, onClose, act, onSeen }) {
  const m = bug.meta || {};
  const [st, setSt] = useState(m.status === "reopened" ? "progress" : m.status);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [fix, setFix] = useState({ url: "", hrs: "" });
  const [busy, setBusy] = useState(false);
  const thread = (m.comments || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at));
  const devCan = !tester && m.status !== "verified";
  // the developer opening it tells the tester it has been seen
  const meId = usePortal().session.user.id;
  const seenOnce = useRef(false);
  useEffect(() => {
    if (m.assign !== meId || m.seenAt || seenOnce.current || !["open", "reopened"].includes(m.status)) return;
    seenOnce.current = true;
    api(`/bugs/${bug._id}`, { method: "PATCH", body: { action: "seen" } }).then(() => onSeen?.(), () => {});
  }, [meId, m.assign, m.seenAt, m.status, bug._id, onSeen]);
  const send = async (body, ok) => {
    setBusy(true);
    const r = await act(bug._id, { ...body, files }, ok);
    setBusy(false);
    if (r) { setText(""); setFiles([]); }
    return r;
  };
  const submit = async (e) => {
    e.preventDefault();
    if (devCan && st !== m.status) {
      await send({ action: "status", status: st, note: text.trim(), url: fullUrl(fix.url), hrs: +fix.hrs || 0 }, `Status: ${ST[st][0].replace(", to verify", "")}`);
    } else if (text.trim() || files.length) {
      await send({ action: "comment", text: text.trim() }, "Comment sent");
    } else toast("Write a comment or change the status");
  };
  return (
    <Modal title={`${m.bug} · ${bug.title}`} onClose={onClose}>
      <div className="bug-view">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {bugPill(m.status)}<SeenPill m={m} />{m.sev && <span className={`pill ${m.sev === "High" ? "p-red" : m.sev === "Low" ? "p-gr" : "p-amb"}`}>{m.sev}</span>}
          {m.mins > 0 && <span className="pill p-gr">Time: {fmtMins(m.mins)}</span>}
        </div>
        <p className="sub" style={{ marginTop: 0 }}>{[bug.refName, m.mod, b4(bug), m.assignName ? `to ${m.assignName}` : "", fd(bug.date)].filter(Boolean).join(" · ")}</p>
        {m.steps && <p className="bug-steps"><Linkify text={m.steps} /></p>}
        {bug.url && <a className="url" href={bug.url} target="_blank" rel="noopener noreferrer">{bug.url.replace(/^https?:\/\//, "")}</a>}
        <Files list={m.files} />

        <h4 className="bug-h">Updates</h4>
        <div className="bug-thread">
          {thread.length ? thread.map((c, i) => (
            <div key={i} className={`bug-c ${c.by === m.assign ? "dev" : "tst"}`}>
              <div className="bc-h"><b>{c.name}</b>{c.status && <> changed the status to {bugPill(c.status)}</>}<span>{fdt(c.at)}</span></div>
              {c.text && <div className="bc-t"><Linkify text={c.text} /></div>}
              <Files list={c.files} />
            </div>
          )) : <div className="empty">No updates yet.</div>}
        </div>

        <form onSubmit={submit} className="bug-reply">
          {devCan && (
            <div className="f"><label htmlFor="bv-st">Status</label>
              <select id="bv-st" value={st} onChange={e => setSt(e.target.value)}>
                {DEV_ST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                {!DEV_ST.some(([k]) => k === m.status) && <option value={m.status} disabled>{ST[m.status]?.[0] || m.status}</option>}
              </select></div>
          )}
          {devCan && st === "fixed" && st !== m.status && (
            <div className="g2">
              <div className="f"><label htmlFor="bv-u">Commit link for the fix</label><input id="bv-u" type="text" value={fix.url} onChange={e => setFix(s => ({ ...s, url: e.target.value }))} /></div>
              <div className="f"><label htmlFor="bv-h">Time spent (hours)</label><input id="bv-h" type="number" min="0" step="0.25" value={fix.hrs} onChange={e => setFix(s => ({ ...s, hrs: e.target.value }))} /></div>
            </div>
          )}
          <div className="f"><label htmlFor="bv-t">{tester ? "Comment for the developer" : "Comment for the tester"}</label>
            <textarea id="bv-t" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={tester ? "More detail, or what is still wrong" : "What you changed, or what you need from the tester"} /></div>
          <FilePick id="bv-f" files={files} onChange={setFiles} />
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="btn p" disabled={busy}>{busy ? "Sending…" : devCan && st !== m.status ? "Update status" : "Send comment"}</button>
            {tester && ["fixed", "notbug"].includes(m.status) && <>
              <button type="button" className="btn" disabled={busy || !text.trim()} title={text.trim() ? "" : "Write what is still wrong first"}
                onClick={() => send({ action: "reopen", note: text.trim() }, "Bug reopened")}>Reopen</button>
              <button type="button" className="btn p" disabled={busy} onClick={() => send({ action: "verify", note: text.trim() }, "Bug verified")}>Verified</button>
            </>}
          </div>
        </form>
      </div>
    </Modal>
  );
}
const b4 = (b) => (b.account?.name ? `by ${b.account.name}` : "");
const fdt = (d) => { const x = new Date(d); return `${fd(iso(x))}, ${x.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`; };

// Tester: send many bugs to one developer in one go
const newRow = () => ({ k: Math.random().toString(36).slice(2), title: "", mod: "", sev: "Medium", steps: "", t: "", unit: "min", url: "", files: [] });
function SendBugs({ onSent }) {
  const P = usePortal();
  const projects = P.assigned.projects;
  const [devs, setDevs] = useState(null);
  const [ref, setRef] = useState(projects[0]?.id || "");
  const [dev, setDev] = useState("");
  const [rows, setRows] = useState([newRow()]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/developers").then(j => setDevs(j.data), () => setDevs([])); }, []);
  const set = (k, field) => (v) => setRows(L => L.map(r => (r.k === k ? { ...r, [field]: typeof v === "function" ? v(r[field]) : v } : r)));
  const mins = (r) => Math.round((+r.t || 0) * (r.unit === "h" ? 60 : 1));
  const filled = rows.filter(r => r.title.trim());
  const total = filled.reduce((a, r) => a + mins(r), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!filled.length) { toast("Add at least one bug"); return; }
    setBusy(true);
    try {
      const items = filled.map(r => ({ title: r.title.trim(), mod: r.mod.trim(), sev: r.sev, steps: r.steps.trim(), mins: mins(r), url: fullUrl(r.url.trim()), files: r.files }));
      await api("/bugs/batch", { method: "POST", body: { refId: ref, assign: dev, date: today(), items } });
      toast(`${items.length} bug${items.length > 1 ? "s" : ""} sent to ${devs.find(d => d.id === dev)?.name || "the developer"}`);
      setRows([newRow()]); P.refresh(); onSent();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };

  if (!projects.length) return <div className="empty">No projects are assigned to you yet. Ask your manager to assign you in the CRM.</div>;
  return (
    <form onSubmit={submit}>
      <section className="card sb-top">
        <div className="sb-step"><span className="lw-n">1</span><b>Where and to whom</b></div>
        <div className="g2">
          <div className="f"><label htmlFor="sb-p">Project</label>
            <select id="sb-p" value={ref} onChange={e => setRef(e.target.value)} required>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="f"><label htmlFor="sb-d">Send to developer</label>
            <select id="sb-d" value={dev} onChange={e => setDev(e.target.value)} required>
              <option value="">{devs === null ? "Loading…" : devs.length ? "Choose a developer" : "No developers have an account yet"}</option>
              {(devs || []).map(d => <option key={d.id} value={d.id}>{d.name} · {ROLES[d.role]?.l || ""}</option>)}
            </select></div>
        </div>
      </section>

      <div className="sb-step"><span className="lw-n">2</span><b>The bugs</b><span className="sub">one card per bug</span></div>
      {rows.map((r, i) => (
        <section className={`card sb-bug sev-${r.sev.toLowerCase()}`} key={r.k}>
          <div className="sb-bug-h">
            <span className="sb-num">{i + 1}</span>
            <input type="text" className="sb-title" aria-label={`Bug ${i + 1}: what is wrong`} value={r.title} onChange={e => set(r.k, "title")(e.target.value)}
              placeholder="What is wrong? Eg. Checkout total wrong when coupon applied" required={i === 0} />
            {rows.length > 1 && <button type="button" className="iconbtn sm" aria-label={`Remove bug ${i + 1}`} title="Remove" onClick={() => setRows(L => L.filter(x => x.k !== r.k))}>×</button>}
          </div>
          <div className="sb-grid">
            <div className="f"><label htmlFor={`sb-m${r.k}`}>Module or screen</label><input id={`sb-m${r.k}`} type="text" value={r.mod} onChange={e => set(r.k, "mod")(e.target.value)} placeholder="Eg. Checkout" /></div>
            <div className="f"><label htmlFor={`sb-s${r.k}`}>Severity</label>
              <select id={`sb-s${r.k}`} value={r.sev} onChange={e => set(r.k, "sev")(e.target.value)}>{["High", "Medium", "Low"].map(x => <option key={x}>{x}</option>)}</select></div>
            <div className="f"><label htmlFor={`sb-h${r.k}`}>Time spent</label>
              <div className="sb-time">
                <input id={`sb-h${r.k}`} type="number" min="0" step={r.unit === "h" ? "0.25" : "5"} value={r.t} onChange={e => set(r.k, "t")(e.target.value)} placeholder={r.unit === "h" ? "1" : "30"} />
                <select aria-label="Unit" value={r.unit} onChange={e => set(r.k, "unit")(e.target.value)}><option value="min">min</option><option value="h">hours</option></select>
              </div></div>
          </div>
          <div className="f"><label htmlFor={`sb-st${r.k}`}>Steps to reproduce</label><textarea id={`sb-st${r.k}`} rows={3} value={r.steps} onChange={e => set(r.k, "steps")(e.target.value)} placeholder={"1. Open the cart\n2. Apply coupon NNC10\n3. Total does not change"} /></div>
          <div className="sb-foot">
            <div className="f"><label htmlFor={`sb-u${r.k}`}>Page or video link (optional)</label><input id={`sb-u${r.k}`} type="text" value={r.url} onChange={e => set(r.k, "url")(e.target.value)} placeholder="https://" /></div>
            <FilePick id={`sb-f${r.k}`} files={r.files} onChange={set(r.k, "files")} />
          </div>
        </section>
      ))}
      <button type="button" className="sb-add" onClick={() => setRows(L => [...L, newRow()])}>+ Add another bug</button>
      <div className="sb-bar">
        <span><b>{filled.length} bug{filled.length === 1 ? "" : "s"}</b>{dev ? ` to ${devs?.find(d => d.id === dev)?.name || ""}` : " · choose a developer"}{total ? ` · ${fmtMins(total)} on your timesheet` : ""}</span>
        <button className="btn p lg" disabled={busy || !dev || !filled.length}>{busy ? "Sending…" : `Send ${filled.length > 1 ? `${filled.length} bugs` : "bug"}`}</button>
      </div>
    </form>
  );
}

function Bugs() {
  const P = usePortal();
  const tester = hasRole(P.session.user, ["test"]);
  const [tab, setTab] = useState("list");
  const B = useGet("/bugs");
  const Act = useGet("/bugs/activity");
  const [viewId, setViewId] = useState(null);
  const all = (B.data || []).slice().sort((a, b) => (SEV[a.meta?.sev] ?? 1) - (SEV[b.meta?.sev] ?? 1));
  const view = all.find(b => b._id === viewId) || Act.data?.bugs.find(b => b._id === viewId) || null;
  const reload = B.reload, reloadAct = Act.reload;
  // Keep the open bug and the counts fresh while the page is open
  useEffect(() => { const t = setInterval(() => { reload(); reloadAct(); }, 20000); return () => clearInterval(t); }, [reload, reloadAct]);
  const act = async (id, body, ok) => {
    try { await api(`/bugs/${id}`, { method: "PATCH", body }); toast(ok); B.reload(); Act.reload(); P.refresh(); return true; }
    catch (ex) { toast(ex.message); return false; }
  };
  const open = all.filter(b => ["open", "reopened"].includes(b.meta?.status));
  const working = all.filter(b => ["progress", "info"].includes(b.meta?.status));
  const fixed = all.filter(b => b.meta?.status === "fixed");
  const notbug = all.filter(b => b.meta?.status === "notbug");
  const done = all.filter(b => b.meta?.status === "verified").slice(0, 15);
  const li = (b, extra) => <BugLi key={b._id} b={b} onOpen={(x) => setViewId(x._id)}>{extra}</BugLi>;
  const list = (L, empty) => (L.length ? L.map(b => li(b)) : <div className="empty">{B.loading ? "Loading…" : empty}</div>);
  return (
    <>
      <h2 className="t">{tester ? "Bugs" : "My bugs"}<span>.</span></h2>
      <p className="lead">{tester ? "Send bugs to a developer, with screenshots, documents and the time you spent. Follow their status and comments here, then verify or reopen." : "Bugs testers sent you, highest priority first. Open one to see the screenshots, change its status and reply to the tester."}</p>
      {tester && (
        <div className="seg" style={{ maxWidth: 420 }}>
          <button type="button" className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>My bugs ({all.length})</button>
          <button type="button" className={tab === "send" ? "on" : ""} onClick={() => setTab("send")}>Send bugs</button>
        </div>
      )}
      {B.err && <div className="alert am">{B.err}</div>}
      {tester && tab === "send" ? <SendBugs onSent={() => { setTab("list"); B.reload(); }} /> : (
        <>
          {tester ? (
            <>
              <section className="card"><h3>Fixed, waiting for you <small>{fixed.length + notbug.length}</small></h3>
                {fixed.length + notbug.length ? [...fixed, ...notbug].map(b => li(b, b.meta?.status === "fixed" &&
                  <button type="button" className="btn sm p" onClick={() => act(b._id, { action: "verify" }, "Bug verified")}>Verified</button>))
                  : <div className="empty">{B.loading ? "Loading…" : "Nothing to verify."}</div>}</section>
              <section className="card"><h3>Developer working on it <small>{working.length}</small></h3>{list(working, "None.")}</section>
              <section className="card"><h3>Still open <small>{open.length}</small></h3>{list(open, "No open bugs.")}</section>
            </>
          ) : (
            <>
              <section className="card"><h3>To fix <small>{open.length}</small></h3>{list(open, "No new bugs for you.")}</section>
              <section className="card"><h3>In progress or waiting for info <small>{working.length}</small></h3>{list(working, "None.")}</section>
              <section className="card"><h3>Fixed, with the tester <small>{fixed.length + notbug.length}</small></h3>{list([...fixed, ...notbug], "None.")}</section>
            </>
          )}
          <section className="card"><h3>Recently verified</h3>{list(done, "None.")}</section>

          <section className="card"><h3>{tester ? "Test runs" : "Test runs on my projects"} <small>{Act.data?.tests.length || 0}</small></h3>
            {Act.data?.tests.length ? Act.data.tests.map(t => <TestLi key={t._id} t={t} />)
              : <div className="empty">{Act.loading ? "Loading…" : tester ? "Log a test run from Log work." : "No test runs on your projects yet."}</div>}</section>
          {!tester && (
            <section className="card"><h3>Other bugs on my projects <small>{Act.data?.bugs.length || 0}</small></h3>
              {Act.data?.bugs.length ? Act.data.bugs.map(b => <BugLi key={b._id} b={b} />)
                : <div className="empty">{Act.loading ? "Loading…" : "No bugs raised for your teammates on these projects."}</div>}</section>
          )}
        </>
      )}

      {view && <BugView key={view._id} bug={view} tester={tester} onClose={() => setViewId(null)} act={act} onSeen={reload} />}
    </>
  );
}

/* ───────── Accountant ───────── */
function Payments() {
  const P = usePortal();
  const [q, setQ] = useState("");
  const L = P.assigned.projects;
  const bal = (p) => Math.max(0, (p.total || 0) - (p.received || 0));
  const shown = L.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => bal(b) - bal(a));
  const inv = P.entries.filter(e => e.type === "invoice" && e.date >= monthStart());
  return (
    <>
      <h2 className="t">Projects and payments<span>.</span></h2>
      <p className="lead">Project billing and payments received, from the CRM.</p>
      <div className="kpis">
        <div className="kpi"><span className="l">Balance to collect</span><span className="v">{rs(L.reduce((a, p) => a + bal(p), 0))}</span><span className="s">{L.filter(p => bal(p) > 0).length} projects</span></div>
        <div className="kpi"><span className="l">Received</span><span className="v" style={{ color: "var(--ok)" }}>{rs(L.reduce((a, p) => a + (p.received || 0), 0))}</span></div>
        <div className="kpi"><span className="l">Projects</span><span className="v">{L.length}</span></div>
        <div className="kpi"><span className="l">Invoices logged this month</span><span className="v">{inv.length}</span></div>
      </div>
      <section className="card"><h3>Projects <Link className="btn sm p r" to="/log">+ Log invoice or payment</Link></h3>
        <div className="pad" style={{ paddingBottom: 0 }}><input type="search" placeholder="Search projects" value={q} onChange={e => setQ(e.target.value)} aria-label="Search projects" style={{ maxWidth: 320 }} /></div>
        <div className="tw"><table><thead><tr><th>Project</th><th>Stage</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Received</th><th style={{ textAlign: "right" }}>Balance</th></tr></thead>
          <tbody>{shown.length ? shown.map(p => (
            <tr key={p.id}><td><b>{p.name}</b></td><td>{p.stage || "-"}</td><td style={{ textAlign: "right" }}>{rs(p.total || 0)}</td>
              <td style={{ textAlign: "right" }}>{rs(p.received || 0)}</td><td style={{ textAlign: "right", color: bal(p) ? "var(--red)" : "var(--ok)" }}>{rs(bal(p))}</td></tr>
          )) : <tr><td colSpan={5}><div className="empty">{L.length ? "No match." : "No closed projects in the CRM yet."}</div></td></tr>}</tbody></table></div>
      </section>
    </>
  );
}
