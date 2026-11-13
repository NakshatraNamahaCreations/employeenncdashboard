import Linkify from "../../Linkify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePick } from "../../FilePick";
import { createPortal } from "react-dom";
import { Plus, ArrowLeft, ChevronRight, Paperclip, MessageSquare, FolderKanban, Search, PlayCircle, CheckCircle2 } from "lucide-react";
export { FilePick };
import { Link, Navigate, useParams } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { ROLES, roleInfo, hasRole } from "../../roles";
import { api, fileUrl } from "../../api";
import { toast } from "../../toast";
import { EntryLi } from "./EmpPages";
import Modal from "../../Modal";
import { today, fd, fdw, greet, rs, monthStart, iso, T } from "../../util";
import { downloadCsv } from "../../csv";

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
  const [kwTxt, setKwTxt] = useState("");
  const [adding, setAdding] = useState(false);
  const rows = K.data || [];
  // one keyword per line; "keyword, 14" also saves today's position as day 1
  const addKws = async (e) => {
    e.preventDefault();
    const list = kwTxt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const m = /^(.*?)[,\t]\s*(\d{1,3})\s*$/.exec(l);
      return m ? { keyword: m[1].trim(), pos: +m[2] } : { keyword: l };
    }).filter(x => x.keyword);
    if (!list.length) { toast("Write at least one keyword"); return; }
    setAdding(true);
    try { const j = await api("/keywords", { method: "POST", body: { client, rows: list } }); toast(`${j.added} keyword${j.added === 1 ? "" : "s"} added${j.skipped ? `, ${j.skipped} already there` : ""}`); setKwTxt(""); K.reload(); }
    catch (ex) { toast(ex.message); }
    finally { setAdding(false); }
  };
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
                  : !rows.length ? <tr><td colSpan={5}><div className="empty">No keywords for this client yet. Add them below.</div></td></tr>
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
      {C.length > 0 && (
        <section className="card"><h3>Add keywords <small>for {C.find(c => c.id === client)?.name}</small></h3>
          <form className="pad" onSubmit={addKws}>
            <div className="f"><label htmlFor="kw-add">One keyword per line. Add a comma and the position to save today's position as day 1.</label>
              <textarea id="kw-add" rows={5} value={kwTxt} onChange={e => setKwTxt(e.target.value)} placeholder={"car ceramic coating hsr layout\ncar detailing bangalore, 14\nbest car wash near me, 101"} /></div>
            <div className="row"><button type="submit" className="btn p" disabled={adding || !kwTxt.trim()}>{adding ? "Adding…" : "Add keywords"}</button>
              <span className="sub">The admin sees them in the CRM under SEO & Ads Team → Keyword positions.</span></div>
          </form>
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

// Every saved report (Google and Meta), by day, with filters and an Excel export
function SavedAds({ clients, reload }) {
  const [from, setFrom] = useState(T(-29)), [to, setTo] = useState(today());
  const [cid, setCid] = useState(""), [pl, setPl] = useState(""), [q, setQ] = useState("");
  const [page, setPage] = useState(0), [per, setPer] = useState(10);
  const [L, setL] = useState(null);
  useEffect(() => {
    let live = true;
    api(`/ads/all?from=${from}&to=${to}`).then(j => live && setL(j.data.list), e => { if (live) { toast(e.message); setL([]); } });
    return () => { live = false; };
  }, [from, to, reload]);
  const hasG = (r) => !r.meta || r.spend || r.clicks || r.impr || r.conv;
  const ctrOf = (m) => (m.ctr != null ? +m.ctr : m.impr ? (m.clicks / m.impr) * 100 : 0);
  const cpcOf = (m) => (m.cpc != null ? +m.cpc : m.clicks ? m.spend / m.clicks : 0);
  const rows = (L || []).flatMap(r => [
    ...(hasG(r) ? [{ k: `${r._id}g`, cid: String(r.client), date: r.date, client: r.clientName, pl: "Google Ads", m: r, sent: r.sent }] : []),
    ...(r.meta ? [{ k: `${r._id}m`, cid: String(r.client), date: r.date, client: r.clientName, pl: "Meta Ads", m: r.meta, sent: r.metaSent }] : []),
  ]).filter(x => (!cid || x.cid === cid) && (!pl || x.pl === pl) && (!q || `${x.client} ${x.m.campaign || ""}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / per)), pg = Math.min(page, pages - 1);
  const shown = rows.slice(pg * per, pg * per + per);
  const sum = rows.reduce((o, x) => ({ spend: o.spend + (x.m.spend || 0), clicks: o.clicks + (x.m.clicks || 0), impr: o.impr + (x.m.impr || 0), conv: o.conv + (x.m.conv || 0) }), { spend: 0, clicks: 0, impr: 0, conv: 0 });
  const f = (fn) => (e) => { fn(e.target.value); setPage(0); };
  const exportCsv = () => {
    const out = [["Date", "Client", "Platform", "Campaign", "Impressions", "Clicks", "CTR %", "Cost (Rs)", "CPC (Rs)", "Conversions", "Cost per conversion (Rs)", "Sent to client"]];
    rows.forEach(x => out.push([x.date, x.client, x.pl, x.m.campaign || "", x.m.impr || 0, x.m.clicks || 0, ctrOf(x.m).toFixed(2), x.m.spend || 0, cpcOf(x.m).toFixed(2), x.m.conv || 0, x.m.conv ? (x.m.spend / x.m.conv).toFixed(2) : "", x.sent ? "Yes" : "No"]));
    out.push([], ["Total", "", "", `${rows.length} reports`, sum.impr, sum.clicks, sum.impr ? ((sum.clicks / sum.impr) * 100).toFixed(2) : "", sum.spend, sum.clicks ? (sum.spend / sum.clicks).toFixed(2) : "", sum.conv, sum.conv ? (sum.spend / sum.conv).toFixed(2) : "", ""]);
    const who = cid ? `_${(clients.find(c => c.id === cid)?.name || "client").replace(/[^a-z0-9]+/gi, "-")}` : "";
    downloadCsv(`ads-reports${who}${pl ? `_${pl.replace(" ", "-")}` : ""}_${from}_to_${to}.csv`, out);
  };
  return (
    <section className="card"><h3>Saved reports <small>{rows.length}</small></h3>
      <div className="ar-bar">
        <label className="ar-f"><span>From</span><input type="date" value={from} max={to} onChange={e => { if (e.target.value) { setFrom(e.target.value); setPage(0); } }} /></label>
        <label className="ar-f"><span>To</span><input type="date" value={to} min={from} max={today()} onChange={e => { if (e.target.value) { setTo(e.target.value); setPage(0); } }} /></label>
        <label className="ar-f"><span>Client</span><select value={cid} onChange={f(setCid)}><option value="">All clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="ar-f"><span>Platform</span><select value={pl} onChange={f(setPl)}><option value="">Google and Meta</option><option>Google Ads</option><option>Meta Ads</option></select></label>
        <label className="ar-f ar-q"><span>Search</span><input type="search" value={q} onChange={f(setQ)} placeholder="Client or campaign" /></label>
        <button type="button" className="btn p ar-exp" disabled={!rows.length} onClick={exportCsv} title="Downloads the reports matching these filters">Export {rows.length ? `(${rows.length})` : ""}</button>
      </div>
      {rows.length > 0 && <div className="ar-sum"><span><small>Cost</small><b>{rs(sum.spend)}</b></span><span><small>Impressions</small><b>{sum.impr.toLocaleString("en-IN")}</b></span><span><small>Clicks</small><b>{sum.clicks.toLocaleString("en-IN")}</b></span><span><small>CTR</small><b>{sum.impr ? ((sum.clicks / sum.impr) * 100).toFixed(2) : "0.00"}%</b></span><span><small>Conversions</small><b>{sum.conv}</b></span><span><small>Cost per conversion</small><b>{sum.conv ? rs(sum.spend / sum.conv) : "-"}</b></span></div>}
      {L == null ? <div className="empty">Loading…</div> : !rows.length ? <div className="empty">No reports for these filters.</div> : (<>
        <div className="ar-tw"><table>
          <thead><tr><th>Date</th><th>Client</th><th>Platform</th><th>Campaign</th><th style={{ textAlign: "right" }}>Impressions</th><th style={{ textAlign: "right" }}>Clicks</th><th style={{ textAlign: "right" }}>CTR</th><th style={{ textAlign: "right" }}>Cost</th><th style={{ textAlign: "right" }}>CPC</th><th style={{ textAlign: "right" }}>Conversions</th><th>Sent</th></tr></thead>
          <tbody>{shown.map(x => (
            <tr key={x.k}>
              <td>{fdw(x.date)}</td><td>{x.client}</td><td><span className={`pill ${x.pl === "Meta Ads" ? "p-blue" : "p-amb"}`}>{x.pl}</span></td><td className="ar-camp" title={x.m.campaign || ""}>{x.m.campaign || "-"}</td>
              <td style={{ textAlign: "right" }}>{(x.m.impr || 0).toLocaleString("en-IN")}</td><td style={{ textAlign: "right" }}>{(x.m.clicks || 0).toLocaleString("en-IN")}</td>
              <td style={{ textAlign: "right" }}>{ctrOf(x.m).toFixed(2)}%</td><td style={{ textAlign: "right" }}><b>{rs(x.m.spend || 0)}</b></td><td style={{ textAlign: "right" }}>{rs(cpcOf(x.m))}</td>
              <td style={{ textAlign: "right" }}><b>{x.m.conv || 0}</b></td>
              <td>{x.sent ? <span className="pill p-ok">Sent</span> : <span className="pill p-amb">Not sent</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="ar-pg">
          <span className="sub">{pg * per + 1}–{Math.min(rows.length, pg * per + per)} of {rows.length}</span>
          <label className="ar-per">Rows <select value={per} onChange={e => { setPer(+e.target.value); setPage(0); }}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Previous</button>
          <span className="ar-pn">Page {pg + 1} of {pages}</span>
          <button type="button" className="btn sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next</button>
        </div>
      </>)}
    </section>
  );
}

const CAMP0 = { campaign: "", impr: "", clicks: "", ctr: "", spend: "", cpc: "", conv: "" };
let kSeq = 1;
const newK = () => ++kSeq;
function AdsReport() {
  const P = usePortal();
  const C = P.assigned.clients;
  const [cid, setCid] = useState("");
  const client = cid || C[0]?.id || "";
  const cl = C.find(c => c.id === client);
  const H = useGet(client ? `/ads?client=${client}` : "");
  const [f, setF] = useState({ contact: "" });
  // one row per campaign (a client can run 2 or 3 at once); the report saves their totals too
  const [rows, setRows] = useState([{ ...CAMP0, k: 1 }]);
  const setRow = (k, key) => (e) => setRows(L => L.map(r => (r.k === k ? { ...r, [key]: e.target.value } : r)));
  const [plat, setPlat] = useState("google");   // google | meta
  const [fileKey, setFileKey] = useState(0);     // clears the chosen file after a save
  const [rn, setRn] = useState(0);               // reloads the saved reports after a save
  const [day, setDay] = useState(today());       // the day the numbers are for (yesterday's report can be sent today)
  const [terms, setTerms] = useState("");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const L = useMemo(() => parseTerms(terms), [terms]);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const tot = rows.reduce((o, r) => ({ spend: o.spend + (+r.spend || 0), clicks: o.clicks + (+r.clicks || 0), impr: o.impr + (+r.impr || 0), conv: o.conv + (+r.conv || 0) }), { spend: 0, clicks: 0, impr: 0, conv: 0 });
  const sp = tot.spend || L.reduce((a, t) => a + t.cost, 0);
  const w = wasted(L, sp);
  const onFile = (file) => { if (!file) return; const r = new FileReader(); r.onload = () => { setTerms(String(r.result)); toast("Search terms loaded"); }; r.readAsText(file); };
  const pickClient = (v) => { setCid(v); setMsg(""); setSaved(null); };
  const PL = plat === "meta" ? "Meta Ads" : "Google Ads";
  // CTR and CPC: what was typed, else worked out from the numbers
  const autoCtr = (r) => (+r.impr ? ((+r.clicks / +r.impr) * 100).toFixed(2) : "");
  const autoCpc = (r) => (+r.clicks ? (+r.spend / +r.clicks).toFixed(2) : "");

  const write = async (e) => {
    e.preventDefault();
    const has = (v) => String(v ?? "").trim() !== "";
    const R = rows.filter(r => ["campaign", "impr", "clicks", "ctr", "spend", "cpc", "conv"].some(k => has(r[k])));
    const any = (k) => R.some(r => has(r[k]));
    const one = R.length === 1 ? R[0] : null;
    const { clicks, impr, conv, spend } = tot;
    const ctr = one && has(one.ctr) ? +one.ctr : impr ? ((clicks / impr) * 100).toFixed(2) : "";
    const cpc = one && has(one.cpc) ? +one.cpc : clicks ? (spend / clicks).toFixed(2) : "";
    const names = R.map(r => r.campaign.trim()).filter(Boolean);
    const google = plat === "google";
    const top = google ? [...L].sort((a, b) => b.clicks - a.clicks).slice(0, 5) : [];
    const contact = f.contact || cl?.contact || "";
    const isToday = day === today();
    setBusy(true);
    try {
      const j = await api("/ads", { method: "POST", body: {
        client, date: day, platform: plat, campaign: names.join(", "),
        spend: any("spend") ? spend : "", clicks: any("clicks") ? clicks : "", impr: any("impr") ? impr : "", conv: any("conv") ? conv : "",
        ctr: one ? one.ctr : "", cpc: one ? one.cpc : "",
        campaigns: R.map(r => ({ campaign: r.campaign.trim(), spend: r.spend, clicks: r.clicks, impr: r.impr, conv: r.conv, ctr: has(r.ctr) ? r.ctr : autoCtr(r), cpc: has(r.cpc) ? r.cpc : autoCpc(r) })),
        ...(google ? { terms: L, negs: w.map(t => t.t) } : {}) } });
      setSaved({ ...j.data, plat });
      // only the numbers that were filled in go in the message
      const one1 = (r) => [
        has(r.spend) && `${rs(+r.spend)} spent`, has(r.impr) && `${(+r.impr).toLocaleString("en-IN")} impressions`, has(r.clicks) && `${(+r.clicks).toLocaleString("en-IN")} clicks`,
        (has(r.ctr) || autoCtr(r)) && `CTR ${has(r.ctr) ? r.ctr : autoCtr(r)}%`, (has(r.cpc) || autoCpc(r)) && `CPC ${rs(has(r.cpc) ? +r.cpc : +autoCpc(r))}`,
        has(r.conv) && `${r.conv} conversion${+r.conv === 1 ? "" : "s"}`,
      ].filter(Boolean).join(", ");
      const lines = R.length > 1 ? [
        ...R.map((r, i) => `• ${r.campaign.trim() || `Campaign ${i + 1}`}: ${one1(r) || "no numbers"}`),
        "",
        `Total: ${[any("spend") && `${rs(spend)} spent`, any("impr") && `${impr.toLocaleString("en-IN")} impressions`, any("clicks") && `${clicks.toLocaleString("en-IN")} clicks`, ctr !== "" && `CTR ${ctr}%`, any("conv") && `${conv} conversions${conv && spend ? ` (${rs(spend / conv)} each)` : ""}`].filter(Boolean).join(", ")}`,
      ] : [
        names[0] && `• Campaign: ${names[0]}`,
        any("spend") && `• Amount spent: ${rs(spend)}`,
        any("impr") && `• Impressions: ${impr.toLocaleString("en-IN")}`,
        any("clicks") && `• Clicks: ${clicks.toLocaleString("en-IN")}`,
        ctr !== "" && `• CTR: ${ctr}%`,
        cpc !== "" && `• Cost per click: ${rs(cpc)}`,
        any("conv") && `• Conversions: ${conv}${conv && spend ? ` | Cost per conversion: ${rs(spend / conv)}` : ""}`,
      ].filter(Boolean);
      setMsg(`${greet()}${contact ? ` ${contact}` : ""}, here is ${isToday ? "today's" : `the ${fdw(day)}`} ${PL} update for ${cl?.name}${isToday ? ` (${fdw(day)})` : ""}:

${lines.join("\n") || "• No numbers for this day."}
${top.length ? `\nTop search terms:\n${top.map((t, i) => `${i + 1}. ${t.t}: ${t.clicks} clicks${t.conv ? `, ${t.conv} lead${t.conv > 1 ? "s" : ""}` : ""}`).join("\n")}\n` : ""}${google && w.length ? `\nTerms we have blocked to save budget: ${w.map(t => t.t).join(", ")}\n` : ""}
Regards,
${P.session.user.name}, ${PL} team
Nakshatra Namaha Creations`);
      toast("Saved. Check the message and send it.");
      setRows([{ ...CAMP0, k: newK() }]);
      setTerms(""); setFileKey(k => k + 1);
      H.reload(); setRn(n => n + 1); P.refresh();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  const sent = async () => {
    if (!saved?._id || (saved.plat === "meta" ? saved.metaSent : saved.sent)) return;
    try { await api(`/ads/${saved._id}/sent${saved.plat === "meta" ? "?platform=meta" : ""}`, { method: "PUT" }); setSaved(s => ({ ...s, sent: true })); H.reload(); } catch { /* the message still opens */ }
  };
  const phone = String(cl?.phone || "").replace(/\D/g, "");

  if (!C.length) return (<><h2 className="t">Daily ads report<span>.</span></h2><section className="card"><NoClients /></section></>);
  return (
    <>
      <h2 className="t">Daily ads report<span>.</span></h2>
      <p className="lead">Pick the day and Google Ads or Meta Ads, fill in the numbers you have (none are required) and save. The client message is written for you.</p>
      <div className="grid2">
        <div>
          <section className="card"><h3>{PL} report <small>{day === today() ? "today" : fdw(day)}</small></h3>
            <form className="pad" onSubmit={write}>
              <div className="g3">
                <div className="f"><label htmlFor="ap">Platform</label>
                  <select id="ap" value={plat} onChange={e => { setPlat(e.target.value); setMsg(""); setSaved(null); }}><option value="google">Google Ads</option><option value="meta">Meta Ads</option></select></div>
                <div className="f"><label htmlFor="ad">Report for the day</label>
                  <input id="ad" type="date" value={day} max={today()} onChange={e => { if (e.target.value) { setDay(e.target.value); setMsg(""); setSaved(null); } }} /></div>
                <div className="f"><label htmlFor="acn">Contact name (for the message)</label><input id="acn" type="text" value={f.contact} onChange={set("contact")} placeholder={cl?.contact || "Eg. Supreeth sir"} /></div>
              </div>
              <ClientPick clients={C} value={client} onChange={pickClient} />
              {rows.map((r, i) => (
                <div key={r.k} className="ad-camp">
                  <div className="ad-camp-h">
                    <div className="f" style={{ margin: 0, flex: 1 }}><label htmlFor={`acp${r.k}`}>{rows.length > 1 ? `Campaign ${i + 1}` : "Campaign name"}</label>
                      <input id={`acp${r.k}`} type="text" value={r.campaign} onChange={setRow(r.k, "campaign")} placeholder="Eg. Ceramic coating - Search" /></div>
                    {rows.length > 1 && <button type="button" className="ad-x" onClick={() => setRows(L => L.filter(x => x.k !== r.k))} aria-label={`Remove campaign ${i + 1}`} title="Remove this campaign">×</button>}
                  </div>
                  <div className="g3">
                    <div className="f"><label htmlFor={`ai${r.k}`}>Impressions</label><input id={`ai${r.k}`} type="number" min="0" value={r.impr} onChange={setRow(r.k, "impr")} /></div>
                    <div className="f"><label htmlFor={`acl${r.k}`}>Clicks</label><input id={`acl${r.k}`} type="number" min="0" value={r.clicks} onChange={setRow(r.k, "clicks")} /></div>
                    <div className="f"><label htmlFor={`actr${r.k}`}>CTR (%)</label><input id={`actr${r.k}`} type="number" min="0" step="0.01" value={r.ctr} onChange={setRow(r.k, "ctr")} placeholder={autoCtr(r) ? `${autoCtr(r)} (auto)` : ""} /></div>
                    <div className="f"><label htmlFor={`as${r.k}`}>Cost (₹)</label><input id={`as${r.k}`} type="number" min="0" step="0.01" value={r.spend} onChange={setRow(r.k, "spend")} /></div>
                    <div className="f"><label htmlFor={`acpc${r.k}`}>CPC (₹)</label><input id={`acpc${r.k}`} type="number" min="0" step="0.01" value={r.cpc} onChange={setRow(r.k, "cpc")} placeholder={autoCpc(r) ? `${autoCpc(r)} (auto)` : ""} /></div>
                    <div className="f"><label htmlFor={`av${r.k}`}>Conversions</label><input id={`av${r.k}`} type="number" min="0" value={r.conv} onChange={setRow(r.k, "conv")} /></div>
                  </div>
                </div>
              ))}
              <button type="button" className="ad-add" onClick={() => setRows(L => [...L, { ...CAMP0, k: newK() }])} disabled={rows.length >= 10}>+ Add another campaign</button>
              {rows.length > 1 && <div className="ad-tot">Total for {rows.length} campaigns: <b>{rs(tot.spend)}</b> spent · {tot.impr.toLocaleString("en-IN")} impressions · {tot.clicks.toLocaleString("en-IN")} clicks · {tot.conv} conversions</div>}
              {plat === "google" && <>
              <div className="f"><label htmlFor="tf">Search terms report (optional): upload the CSV from Google Ads</label><input key={fileKey} id="tf" type="file" accept=".csv,.txt,.tsv" onChange={e => onFile(e.target.files[0])} /></div>
              <div className="f"><label htmlFor="tt">or paste it here (search term, clicks, cost, conversions)</label>
                <textarea id="tt" rows={5} value={terms} onChange={e => setTerms(e.target.value)} placeholder={"Search term, Clicks, Cost, Conversions\ncar ceramic coating, 22, 410, 2"} /></div>
              </>}
              {plat === "google" && L.length > 0 && (
                <div className="alert bl" style={{ display: "block" }}>
                  <b>{L.length} search terms read.</b> {L.reduce((a, t) => a + t.clicks, 0)} clicks, {rs(L.reduce((a, t) => a + t.cost, 0))} cost, {L.reduce((a, t) => a + t.conv, 0)} leads.
                  {w.length > 0 && <><br /><span style={{ color: "var(--red)" }}>No leads but spending money: {w.map(t => t.t).join(", ")}. Consider adding them as negative keywords.</span></>}
                </div>
              )}
              <button className="btn p lg" disabled={busy}>{busy ? "Saving…" : "Save and write client message"}</button>
            </form>
          </section>
        </div>
        <section className="card"><h3>Message for the client</h3>
          <div className="pad">
            {msg ? (
              <>
                <textarea className="msg" value={msg} onChange={e => setMsg(e.target.value)} aria-label="Client message" />
                <div className="row" style={{ marginTop: 12 }}>
                  <a className="btn g" href={`https://wa.me/${phone.length >= 10 ? (phone.length === 10 ? `91${phone}` : phone) : ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" onClick={sent}>Send on WhatsApp</a>
                  <a className="btn" href={`mailto:?subject=${encodeURIComponent(`${PL} update: ${cl?.name}`)}&body=${encodeURIComponent(msg)}`} onClick={sent}>Email</a>
                  <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(msg).then(() => toast("Copied"), () => toast("Select the text and copy it")); }}>Copy</button>
                </div>
              </>
            ) : <div className="empty">Fill in the numbers you have and save. The message appears here.</div>}
          </div>
        </section>
      </div>
      <SavedAds clients={C} reload={rn} />
    </>
  );
}

/* ───────── Designers ───────── */
function Designs() {
  const P = usePortal();
  const [fbFor, setFbFor] = useState(null);
  const D = P.entries.filter(e => ["screen", "revision", "poster", "logo", "vcard", "brochure", "corpvideo", "instavideo", "motion"].includes(e.type));
  const st = (e) => e.meta?.status || "";
  const setStatus = (id, status, fb) => P.run(() => api(`/designs/${id}`, { method: "PATCH", body: { status, fb } }), status === "approved" ? "Marked approved" : "Changes noted");
  const ms = monthStart();
  return (
    <>
      <h2 className="t">My designs<span>.</span></h2>
      <p className="lead">Screens, designs and videos you sent to clients. Update each one when the client approves or asks for changes.</p>
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

// Attached screenshots, videos and documents. Pictures and videos show as small previews;
// a click opens them large (videos play in their original quality). Documents stay as file chips.
const isVid = (f) => /^video\//.test(f.type || "") || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.url || "");
function Files({ list }) {
  const [big, setBig] = useState(null);
  useEffect(() => {
    if (!big) return undefined;
    const k = (e) => { if (e.key === "Escape") setBig(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [big]);
  if (!list?.length) return null;
  const media = list.filter(f => isImg(f) || isVid(f)), docs = list.filter(f => !isImg(f) && !isVid(f));
  return (
    <>
      {media.length > 0 && (
        <div className="bf-media">
          {media.map((f, i) => (
            <button key={i} type="button" className={`bf-tile${isVid(f) ? " vid" : ""}`} title={f.name} onClick={(e) => { e.stopPropagation(); setBig(f); }}>
              {isVid(f) ? <video src={`${fileUrl(f.url)}#t=0.5`} preload="metadata" muted playsInline /> : <img src={fileUrl(f.url)} alt={f.name} loading="lazy" />}
              {isVid(f) && <span className="bf-play"><PlayCircle size={26} /></span>}
            </button>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="bug-files">
          {docs.map((f, i) => <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" className="bf-doc" title={f.name}><span>{f.name}</span></a>)}
        </div>
      )}
      {big && createPortal(
        <div className="bf-box" role="dialog" aria-modal="true" aria-label={big.name} onClick={(e) => { e.stopPropagation(); setBig(null); }}>
          <div className="bf-box-in" onClick={(e) => e.stopPropagation()}>
            {isVid(big) ? <video src={fileUrl(big.url)} controls autoPlay playsInline /> : <img src={fileUrl(big.url)} alt={big.name} />}
            <div className="bf-box-f">
              <span>{big.name}</span>
              <a href={fileUrl(big.url)} target="_blank" rel="noopener noreferrer">Open in a new tab</a>
              <button type="button" onClick={() => setBig(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// One bug as a card: severity colour on the left, the essentials, status on the right. Click to open.
function BugCard({ b, tester, onOpen, onVerify }) {
  const m = b.meta || {}, nc = (m.comments || []).filter(c => c.text || c.files?.length).length;
  const open = onOpen ? () => onOpen(b) : null;
  return (
    <div className={`bg-card sev-${String(m.sev || "Medium").toLowerCase()}${open ? " click" : ""}`} {...(open ? { role: "button", tabIndex: 0, onClick: open, onKeyDown: (e) => { if (e.key === "Enter") open(); } } : {})}>
      <div className="bg-main">
        <div className="bg-top"><span className="bg-id">{m.bug}</span><b className="bg-title">{b.title}</b></div>
        <div className="bg-meta">
          <span className={`bg-sev s-${String(m.sev || "Medium").toLowerCase()}`}>{m.sev || "Medium"}</span>
          {b.refName && <span><FolderKanban size={13} /> {b.refName}</span>}
          {m.mod && <span>{m.mod}</span>}
          <span>{tester ? `To ${m.assignName || "-"}` : `From ${b.account?.name || "-"}`}</span>
          <span>{fd(b.date)}</span>
          {m.files?.length > 0 && <span><Paperclip size={13} /> {m.files.length}</span>}
          {nc > 0 && <span><MessageSquare size={13} /> {nc}</span>}
        </div>
        {m.steps && <p className="bg-steps"><Linkify text={m.steps} /></p>}
      </div>
      <div className="bg-side">
        <div className="bg-pills">{bugPill(m.status)}<SeenPill m={m} /></div>
        {onVerify && m.status === "fixed" && <button type="button" className="btn sm p" onClick={(e) => { e.stopPropagation(); onVerify(b); }}><CheckCircle2 size={14} /> Verified</button>}
        {open && <span className="bg-open">Open <ChevronRight size={15} /></span>}
      </div>
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
  const [fix, setFix] = useState({ url: "", h: "", m: "0" });
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
      await send({ action: "status", status: st, note: text.trim(), url: fullUrl(fix.url), hrs: Math.round(((+fix.h || 0) + (+fix.m || 0) / 60) * 100) / 100 }, `Status: ${ST[st][0].replace(", to verify", "")}`);
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
              <div className="f"><label htmlFor="bv-h">Time spent</label>
                <div className="lw-time">
                  <input id="bv-h" type="number" min="0" max="16" step="1" value={fix.h} placeholder="0" onChange={e => setFix(s => ({ ...s, h: e.target.value }))} aria-label="Hours" /><span>h</span>
                  <select value={fix.m} onChange={e => setFix(s => ({ ...s, m: e.target.value }))} aria-label="Minutes">{Array.from({ length: 12 }, (_, i) => i * 5).map(x => <option key={x} value={x}>{x}</option>)}</select><span>min</span>
                </div></div>
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
const OTHER = "__other";
const newRow = () => ({ k: Math.random().toString(36).slice(2), title: "", mod: "", sev: "Medium", steps: "", t: "", unit: "min", url: "", files: [] });
function SendBugs({ onSent }) {
  const P = usePortal();
  const projects = P.assigned.projects;
  const [devs, setDevs] = useState(null);
  const [ref, setRef] = useState(projects[0]?.id || OTHER);
  const [otherName, setOtherName] = useState("");         // project typed in when it is not in the list
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
    if (ref === OTHER && !otherName.trim()) { toast("Type the project name"); return; }
    setBusy(true);
    try {
      const items = filled.map(r => ({ title: r.title.trim(), mod: r.mod.trim(), sev: r.sev, steps: r.steps.trim(), mins: mins(r), url: fullUrl(r.url.trim()), files: r.files }));
      const where = ref === OTHER ? { refId: "", refName: otherName.trim() } : { refId: ref };
      await api("/bugs/batch", { method: "POST", body: { ...where, assign: dev, date: today(), items } });
      toast(`${items.length} bug${items.length > 1 ? "s" : ""} sent to ${devs.find(d => d.id === dev)?.name || "the developer"}`);
      setRows([newRow()]); P.refresh(); onSent();
    } catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <section className="card sb-top">
        <div className="sb-step"><span className="lw-n">1</span><b>Where and to whom</b></div>
        <div className="g2">
          <div className="f"><label htmlFor="sb-p">Project</label>
            <select id="sb-p" value={ref} onChange={e => setRef(e.target.value)} required>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={OTHER}>Other (not in this list)</option>
            </select></div>
          <div className="f"><label htmlFor="sb-d">Send to developer</label>
            <select id="sb-d" value={dev} onChange={e => setDev(e.target.value)} required>
              <option value="">{devs === null ? "Loading…" : devs.length ? "Choose a developer" : "No developers have an account yet"}</option>
              {(devs || []).map(d => <option key={d.id} value={d.id}>{d.name} · {ROLES[d.role]?.l || ""}</option>)}
            </select></div>
        </div>
        {ref === OTHER && (
          <div className="f sb-other"><label htmlFor="sb-o">Project name</label>
            <input id="sb-o" type="text" value={otherName} onChange={e => setOtherName(e.target.value)} required autoFocus maxLength={160} placeholder="Type the project or website name" />
            <span className="sub">Use this when the project is not assigned to you yet. The developer sees this name on the bug.</span></div>
        )}
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
        <span><b>{filled.length} bug{filled.length === 1 ? "" : "s"}</b>{ref === OTHER && otherName.trim() ? ` for ${otherName.trim()}` : ""}{dev ? ` to ${devs?.find(d => d.id === dev)?.name || ""}` : " · choose a developer"}{total ? ` · ${fmtMins(total)} on your timesheet` : ""}</span>
        <button className="btn p lg" disabled={busy || !dev || !filled.length}>{busy ? "Sending…" : `Send ${filled.length > 1 ? `${filled.length} bugs` : "bug"}`}</button>
      </div>
    </form>
  );
}

// The page in four simple boxes. Each role sees them in its own words.
const IN = (L) => (s) => L.includes(s);
const DEV_TABS = [
  ["fix", "To fix", IN(["open", "reopened"]), "red", "New and reopened bugs sent to you. Open one to see the details, then set it to In progress or Fixed."],
  ["work", "Working on", IN(["progress", "info"]), "amb", "Bugs you are fixing, or waiting for more information from the tester."],
  ["tester", "With the tester", IN(["fixed", "notbug"]), "blue", "You marked these fixed or not a bug. The tester checks them next."],
  ["done", "Verified", IN(["verified"]), "ok", "The tester checked these and confirmed they are fixed."],
];
const TEST_TABS = [
  ["check", "To check", IN(["fixed", "notbug"]), "blue", "The developer says these are fixed (or not a bug). Check each one, then tap Verified, or open it and Reopen."],
  ["work", "Developer working", IN(["progress", "info"]), "amb", "The developer is fixing these, or has asked you for more information."],
  ["new", "Not started yet", IN(["open", "reopened"]), "red", "Sent to the developer, not picked up yet. The label shows if they have opened it."],
  ["done", "Verified", IN(["verified"]), "ok", "Bugs you checked and confirmed as fixed."],
];

// Date filter on the day a bug was raised
const DATES = [["", "All dates"], ["today", "Today"], ["yday", "Yesterday"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"], ["lmonth", "Last month"], ["custom", "Custom dates…"]];
function rangeOf(k, f, t) {
  const T0 = today(), back = (n) => iso(new Date(Date.now() - n * 864e5));
  if (k === "today") return [T0, T0];
  if (k === "yday") return [back(1), back(1)];
  if (k === "7") return [back(6), T0];
  if (k === "30") return [back(29), T0];
  if (k === "month") return [monthStart(), T0];
  if (k === "lmonth") { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; }
  if (k === "custom" && (f || t)) return [f || "0000-00-00", t || "9999-12-31"];
  return null;
}

function Bugs() {
  const P = usePortal();
  const tester = hasRole(P.session.user, ["test"]);
  const TABS = tester ? TEST_TABS : DEV_TABS;
  const [tab, setTab] = useState("list");
  const [st, setSt] = useState(TABS[0][0]);
  const [proj, setProj] = useState("");
  const [sev, setSev] = useState("");
  const [q, setQ] = useState("");
  const [dk, setDk] = useState("");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const B = useGet("/bugs");
  const Act = useGet("/bugs/activity");
  const [viewId, setViewId] = useState(null);
  const all = (B.data || []).slice().sort((a, b) => (SEV[a.meta?.sev] ?? 1) - (SEV[b.meta?.sev] ?? 1) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const view = all.find(b => b._id === viewId) || Act.data?.bugs.find(b => b._id === viewId) || null;
  const reload = B.reload, reloadAct = Act.reload;
  // Keep the open bug and the counts fresh while the page is open
  useEffect(() => { const t = setInterval(() => { reload(); reloadAct(); }, 20000); return () => clearInterval(t); }, [reload, reloadAct]);
  const act = async (id, body, ok) => {
    try { await api(`/bugs/${id}`, { method: "PATCH", body }); toast(ok); B.reload(); Act.reload(); P.refresh(); return true; }
    catch (ex) { toast(ex.message); return false; }
  };
  // filters: project (BUG-121), severity and search; the boxes count what the filters leave
  const projects = [...new Set(all.map(b => b.refName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const ql = q.trim().toLowerCase();
  const rg = rangeOf(dk, dFrom, dTo);
  const base = all.filter(b => (!proj || b.refName === proj) && (!sev || (b.meta?.sev || "Medium") === sev) && (!rg || (b.date >= rg[0] && b.date <= rg[1]))
    && (!ql || `${b.meta?.bug} ${b.title} ${b.meta?.steps} ${b.meta?.mod} ${b.refName}`.toLowerCase().includes(ql)));
  const fnOf = (k) => TABS.find(t => t[0] === k)[2];
  const cnt = (k) => base.filter(b => fnOf(k)(b.meta?.status)).length;
  const cur = TABS.find(t => t[0] === st) || TABS[0];
  const shown = base.filter(b => cur[2](b.meta?.status)).slice(0, st === "done" ? 40 : 300);
  const filtered = !!(proj || sev || ql || rg);

  return (
    <>
      <div className="bg-head">
        <div>
          <h2 className="t">{tester ? "Bugs" : "My bugs"}<span>.</span></h2>
          <p className="lead">{tester ? "Report bugs to a developer and follow them until they are fixed." : "Bugs testers sent you. Open one, fix it, and mark it Fixed."}</p>
        </div>
        {tester && (tab === "list"
          ? <button type="button" className="btn p lg" onClick={() => setTab("send")}><Plus size={17} /> Report bugs</button>
          : <button type="button" className="btn lg" onClick={() => setTab("list")}><ArrowLeft size={16} /> Back to my bugs</button>)}
      </div>
      {B.err && <div className="alert am">{B.err}</div>}

      {tester && tab === "send" ? <SendBugs onSent={() => { setTab("list"); setSt("new"); B.reload(); }} /> : (
        <>
          <div className="bg-tiles" role="tablist" aria-label="Bug status">
            {TABS.map(([k, l, , c]) => (
              <button key={k} type="button" role="tab" aria-selected={st === k} className={`bg-tile c-${c}${st === k ? " on" : ""}`} onClick={() => setSt(k)}>
                <span className="n">{B.data == null ? "-" : cnt(k)}</span><span className="l">{l}</span>
              </button>
            ))}
          </div>

          <div className="bg-filters">
            <select value={proj} onChange={e => setProj(e.target.value)} aria-label="Project">
              <option value="">All projects</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="bg-seg" role="group" aria-label="Severity">
              {[["", "All"], ["High", "High"], ["Medium", "Medium"], ["Low", "Low"]].map(([k, l]) => (
                <button key={l} type="button" className={`${sev === k ? "on" : ""} ${k ? `s-${k.toLowerCase()}` : ""}`} onClick={() => setSev(k)}>{l}</button>
              ))}
            </div>
            <label className="bg-search"><Search size={15} /><input type="search" placeholder="Search bug number, title or steps" value={q} onChange={e => setQ(e.target.value)} aria-label="Search bugs" /></label>
            <select value={dk} onChange={e => setDk(e.target.value)} aria-label="Date raised" className={dk ? "on" : ""}>
              {DATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {dk === "custom" && (
              <span className="bg-dates">
                <label>From <input type="date" value={dFrom} max={dTo || today()} onChange={e => setDFrom(e.target.value)} /></label>
                <label>To <input type="date" value={dTo} min={dFrom || undefined} max={today()} onChange={e => setDTo(e.target.value)} /></label>
              </span>
            )}
            {filtered && <button type="button" className="btn sm" onClick={() => { setProj(""); setSev(""); setQ(""); setDk(""); setDFrom(""); setDTo(""); }}>Clear</button>}
          </div>

          <p className="bg-hint">{cur[4]}{rg && <b className="bg-range"> · Raised {rg[0] === rg[1] ? fd(rg[0]) : `${rg[0] > "0000-00-00" ? fd(rg[0]) : "the start"} to ${rg[1] < "9999-12-31" ? fd(rg[1]) : "today"}`}</b>}</p>
          <section className="bg-list">
            {B.data == null ? <div className="card"><div className="empty">Loading…</div></div>
              : shown.length ? shown.map(b => <BugCard key={b._id} b={b} tester={tester} onOpen={(x) => setViewId(x._id)} onVerify={tester ? (x) => act(x._id, { action: "verify" }, "Bug verified") : null} />)
                : <div className="card bg-empty"><CheckCircle2 size={28} /><b>{filtered ? "No bugs match these filters" : "Nothing here"}</b>
                  <span className="sub">{filtered ? "Change or clear the filters above." : tester && st === "new" ? "Use Report bugs to send one." : "All clear in this box."}</span></div>}
          </section>

          <details className="card bg-more">
            <summary>{tester ? "My test runs" : "Test runs on my projects"} <small>{Act.data?.tests.length || 0}</small></summary>
            {Act.data?.tests.length ? Act.data.tests.map(t => <TestLi key={t._id} t={t} />)
              : <div className="empty">{Act.loading ? "Loading…" : tester ? "Log a test run from Log work." : "No test runs on your projects yet."}</div>}
          </details>
          {!tester && (
            <details className="card bg-more">
              <summary>Bugs for my teammates on these projects <small>{Act.data?.bugs.length || 0}</small></summary>
              <div className="bg-list in">{Act.data?.bugs.length ? Act.data.bugs.map(b => <BugCard key={b._id} b={b} tester={false} />)
                : <div className="empty">{Act.loading ? "Loading…" : "No bugs raised for your teammates on these projects."}</div>}</div>
            </details>
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
