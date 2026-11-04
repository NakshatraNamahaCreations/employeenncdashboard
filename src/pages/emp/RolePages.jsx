import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { ROLES } from "../../roles";
import { api } from "../../api";
import { toast } from "../../toast";
import { EntryLi } from "./EmpPages";
import Modal from "../../Modal";
import { today, fd, fdw, greet, rs, monthStart } from "../../util";

export function RolePage() {
  const { rolePage } = useParams();
  const { session } = usePortal();
  const R = ROLES[session.user.role];
  if (rolePage !== R.page[0]) return <Navigate to="/" replace />;
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
const bugPill = (s) => ({ open: <span className="pill p-red">Open</span>, reopened: <span className="pill p-red">Reopened</span>, fixed: <span className="pill p-blue">Fixed, to verify</span>, verified: <span className="pill p-ok">Verified</span> }[s] || null);

function BugLi({ b, children }) {
  const m = b.meta || {};
  return (
    <div className="li">
      <div className="x">
        <span className="tag">{m.bug}</span><b>{b.title}</b>
        <span className="sub">{[b.refName, m.mod, m.sev, m.assignName ? `to ${m.assignName}` : "", b.account?.name ? `by ${b.account.name}` : "", fd(b.date)].filter(Boolean).join(" · ")}</span>
        {m.steps && <span className="sub">Steps: {m.steps}</span>}
        {m.note && <span className="sub">Note: {m.note}</span>}
        {b.url && <a className="url" href={b.url} target="_blank" rel="noopener noreferrer">{b.url.replace(/^https?:\/\//, "")}</a>}
      </div>
      {bugPill(m.status)}{children}
    </div>
  );
}

function Bugs() {
  const P = usePortal();
  const tester = P.session.user.role === "test";
  const B = useGet("/bugs");
  const [fix, setFix] = useState(null);
  const [reopen, setReopen] = useState(null);
  const all = (B.data || []).slice().sort((a, b) => (SEV[a.meta?.sev] ?? 1) - (SEV[b.meta?.sev] ?? 1));
  const act = async (id, body, ok) => {
    try { await api(`/bugs/${id}`, { method: "PATCH", body }); toast(ok); B.reload(); P.refresh(); return true; }
    catch (ex) { toast(ex.message); return false; }
  };
  const open = all.filter(b => ["open", "reopened"].includes(b.meta?.status));
  const fixed = all.filter(b => b.meta?.status === "fixed");
  const done = all.filter(b => b.meta?.status === "verified").slice(0, 15);
  return (
    <>
      <h2 className="t">{tester ? "Bugs" : "My bugs"}<span>.</span></h2>
      <p className="lead">{tester ? "Bugs you raised. When a developer marks one fixed, verify it or reopen it." : "Bugs testers assigned to you, highest priority first. Mark them fixed with the commit link and the tester gets them back to verify."}</p>
      {tester && <div className="row" style={{ marginBottom: 14 }}><Link className="btn p" to="/log">+ Raise a bug</Link></div>}
      {B.err && <div className="alert am">{B.err}</div>}
      {tester ? (
        <>
          <section className="card"><h3>Fixed, waiting for you <small>{fixed.length}</small></h3>
            {fixed.length ? fixed.map(b => (
              <BugLi key={b._id} b={b}>
                <button type="button" className="btn sm" onClick={() => setReopen(b)}>Reopen</button>
                <button type="button" className="btn sm p" onClick={() => act(b._id, { action: "verify" }, "Bug verified")}>Verified</button>
              </BugLi>
            )) : <div className="empty">{B.loading ? "Loading…" : "Nothing to verify."}</div>}</section>
          <section className="card"><h3>Still open <small>{open.length}</small></h3>
            {open.length ? open.map(b => <BugLi key={b._id} b={b} />) : <div className="empty">No open bugs.</div>}</section>
        </>
      ) : (
        <>
          <section className="card"><h3>To fix <small>{open.length}</small></h3>
            {open.length ? open.map(b => (
              <BugLi key={b._id} b={b}><button type="button" className="btn sm p" onClick={() => setFix(b)}>Mark fixed</button></BugLi>
            )) : <div className="empty">{B.loading ? "Loading…" : "No bugs assigned to you."}</div>}</section>
          <section className="card"><h3>Fixed, with the tester <small>{fixed.length}</small></h3>
            {fixed.length ? fixed.map(b => <BugLi key={b._id} b={b} />) : <div className="empty">None.</div>}</section>
        </>
      )}
      <section className="card"><h3>Recently verified</h3>
        {done.length ? done.map(b => <BugLi key={b._id} b={b} />) : <div className="empty">None.</div>}</section>

      {fix && (
        <Modal title={`Mark ${fix.meta?.bug} fixed`} onClose={() => setFix(null)}>
          <form onSubmit={async (ev) => {
            ev.preventDefault(); const d = Object.fromEntries(new FormData(ev.target));
            const u = d.url ? (/^https?:/.test(d.url) ? d.url : `https://${d.url}`) : "";
            if (await act(fix._id, { action: "fix", url: u, hrs: +d.hrs || 0, note: d.note, date: today() }, "Sent back to the tester")) setFix(null);
          }}>
            <p className="sub" style={{ marginTop: 0 }}>{fix.title}</p>
            <div className="f"><label htmlFor="fx1">Commit link for the fix</label><input id="fx1" name="url" type="text" /></div>
            <div className="g2">
              <div className="f"><label htmlFor="fx2">Time spent (hours)</label><input id="fx2" name="hrs" type="number" min="0" step="0.25" defaultValue="0.5" /></div>
              <div className="f"><label htmlFor="fx3">Note for the tester</label><input id="fx3" name="note" type="text" /></div>
            </div>
            <button className="btn p">Mark fixed</button>
          </form>
        </Modal>
      )}
      {reopen && (
        <Modal title={`Reopen ${reopen.meta?.bug}`} onClose={() => setReopen(null)}>
          <form onSubmit={async (ev) => { ev.preventDefault(); if (await act(reopen._id, { action: "reopen", note: new FormData(ev.target).get("note") }, "Bug reopened")) setReopen(null); }}>
            <div className="f"><label htmlFor="ro">What is still wrong?</label><textarea id="ro" name="note" rows={3} required /></div>
            <button className="btn w">Reopen</button>
          </form>
        </Modal>
      )}
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
