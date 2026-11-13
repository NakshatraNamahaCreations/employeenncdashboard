import { createContext, useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { ROLES, TY, typesFor, metaTxt, roleInfo, rolesOf, hasRole } from "../../roles";
import { api, fileUrl } from "../../api";
import { FilePick } from "../../FilePick";
import { toast } from "../../toast";
import { confirmBox } from "../../confirm";
import Modal from "../../Modal";
import PwInput from "../../PwInput";
import DevDay from "./DevDay";
import TodayPlan from "./TodayPlan";
import { ArrowLeft, Plus, X } from "lucide-react";
import { DayPanel, TypeTiles, TodaySheet, Tips } from "./LogParts";
import { TY_IC } from "./workIcons";
import { today, T, fd, fdw, h1, pct, weekStart, monthStart, greet, parse, iso, DOW, ampm } from "../../util";

/* ───────── shared bits ───────── */

export function EntryLi({ e, onDelete }) {
  return (
    <div className="li">
      <div className="x">
        <span className="tag">{TY[e.type]?.l || (e.type === "adsreport" ? "Daily ads report" : e.type)}</span><b>{e.title}</b>
        <span className="sub">{[e.refName, metaTxt(e)].filter(Boolean).join(" · ")}</span>
        {e.url && <a className="url" href={e.url} target="_blank" rel="noopener noreferrer">{e.url.replace(/^https?:\/\//, "")}</a>}
        {e.meta?.links?.length > 1 && <span className="lw-files">{e.meta.links.map(x => <a key={x.url} className="lw-file" href={x.url} target="_blank" rel="noopener noreferrer">{x.l} link</a>)}</span>}
        {e.meta?.files?.length > 0 && <span className="lw-files">{e.meta.files.map(f => <a key={f.url} className="lw-file" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer">{f.name}</a>)}</span>}
      </div>
      <span className="sub" style={{ whiteSpace: "nowrap" }}>{h1(e.hrs)} h</span>
      {onDelete && <button type="button" className="btn sm" onClick={() => onDelete(e._id)}>Delete</button>}
    </div>
  );
}

// The task's project, as a link to its project page when it is one of mine
export function TaskRef({ t, empty }) {
  const P = usePortal();
  if (!t.refName) return empty;
  const mine = t.refId && P.assigned.projects.some(p => p.id === String(t.refId)) && roleInfo(P.session.user).picks.has("projects");
  return mine ? <Link to={`/projects/${t.refId}`}>{t.refName}</Link> : t.refName;
}

function TaskLi({ t, onStatus }) {
  const late = t.status !== "done" && t.due < today();
  return (
    <div className="li">
      <div className="x"><b style={t.status === "done" ? { color: "var(--mut)" } : undefined}>{t.title}</b>
        <span className="sub"><TaskRef t={t} empty="No client or project" /> · {t.from === "me" ? "my task" : `from ${t.from}`} · due {t.due === today() ? "today" : fd(t.due)}</span></div>
      {t.status === "done" ? <span className="pill p-ok">Done</span> : (
        <>
          {late && <span className="pill p-red">Overdue</span>}
          {t.status === "doing" && <span className="pill p-blue">Doing</span>}
          {t.status === "todo" && <button type="button" className="btn sm" onClick={() => onStatus(t._id, "doing")}>Start</button>}
          <button type="button" className="btn sm p" onClick={() => onStatus(t._id, "done")}>Done</button>
        </>
      )}
    </div>
  );
}

const hoursOn = (entries, d) => entries.filter(e => e.date === d).reduce((a, e) => a + (e.hrs || 0), 0);

function WeekStrip({ entries, days }) {
  const ws = weekStart();
  return (
    <div className="week">
      {Array.from({ length: 6 }, (_, i) => {
        const x = parse(ws); x.setDate(x.getDate() + i);
        const d = iso(x), h = hoursOn(entries, d), sub = days.some(s => s.date === d), fut = d > today();
        return (
          <div key={d} className={d === today() ? "td" : ""}>
            <div className="sub">{DOW[x.getDay()]}</div>
            <div className="pos">{fut ? "-" : `${h1(h)}h`}</div>
            <div style={{ fontSize: 10.5, color: sub ? "var(--ok)" : fut ? "var(--mut)" : d === today() ? "var(--amb)" : "var(--red)" }}>
              {sub ? "Submitted" : fut ? "" : d === today() ? "Open" : "Missing"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── My day ───────── */
// Developers get their own dashboard (projects, fixes, meetings, calendar)
const DEV_ROLES = ["full", "web", "back", "app", "other"];
export function MyDay() {
  const { session } = usePortal();
  return hasRole(session.user, DEV_ROLES) ? <DevDay /> : <StdDay />;
}

function StdDay() {
  const P = usePortal();
  const u = P.session.user, R = roleInfo(u);
  const L = P.entries.filter(e => e.date === today());
  const h = hoursOn(P.entries, today());
  const rec = P.days.find(d => d.date === today());
  const last = [...P.days].sort((a, b) => b.date.localeCompare(a.date))[0];
  const due = P.tasks.filter(t => t.status !== "done" && t.due <= today());
  const bl = P.blockers.filter(b => !b.resolved);
  const mine = [...(R.picks.has("clients") ? P.assigned.clients : []), ...(R.picks.has("projects") || !R.picks.size ? P.assigned.projects : [])];
  const [modal, setModal] = useState(null);
  const nav = useNavigate();
  return (
    <>
      <h2 className="t">{greet()}, {u.name.split(" ")[0]}<span>.</span></h2>
      <p className="lead">{fdw(today())} · {R.l}{P.loading ? " · loading…" : ""}</p>
      {rec && <div className="alert ok"><b>Day submitted at {ampm(rec.at)}.</b> {h1(h)} hours and {L.length} items sent to Harish. Today's entries are now locked.</div>}
      {bl.map(b => (
        <div key={b._id} className="alert am"><b>You flagged a blocker:</b> {b.text}{b.refName ? ` (${b.refName})` : ""}
          <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => P.resolveBlocker(b._id)}>It's sorted now</button></div>
      ))}
      <div className="kpis">
        <div className="kpi"><span className="l">Hours logged today</span><span className="v">{h1(h)} <small style={{ fontSize: 14, color: "var(--mut)", fontWeight: 400 }}>of 8</small></span>
          <div className={`bar7 ${h >= 7 ? "ok" : ""}`} style={{ marginTop: 6 }}><i style={{ width: `${pct(h, 8)}%` }} /></div></div>
        <div className="kpi"><span className="l">Items logged today</span><span className="v">{L.length}</span><span className="s">{L.length ? `last: ${L[0].title.slice(0, 34)}` : "nothing yet"}</span></div>
        <div className="kpi"><span className="l">Tasks due today</span><span className="v" style={{ color: due.some(t => t.due < today()) ? "var(--red)" : "var(--navy)" }}>{due.length}</span>
          <span className="s">{due.filter(t => t.due < today()).length ? `${due.filter(t => t.due < today()).length} overdue` : "none overdue"}</span></div>
        <div className="kpi"><span className="l">{R.pick === "clients" ? "My projects" : R.pick === "projects" ? "My projects" : "Projects"}</span><span className="v">{mine.length}</span><span className="s">assigned in the CRM</span></div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <button type="button" className="btn p lg" onClick={() => nav("/log")}>+ Log work</button>
        {!rec && <button type="button" className="btn lg" onClick={() => setModal("submit")}>Submit my day</button>}
        <button type="button" className="btn w lg" onClick={() => setModal("block")}>I'm blocked</button>
      </div>
      <div className="grid2">
        <div>
          <section className="card"><h3>{R.pick === "clients" ? "My projects" : R.pick === "projects" ? "My projects" : "Projects"} <Link className="btn sm r" to={`/${R.page[0]}`}>{R.page[1]}</Link></h3>
            {mine.length ? mine.slice(0, 8).map(x => (
              <div key={x.id} className="li"><div className="x"><b>{x.name}</b><span className="sub">{x.site || x.stage || ""}</span></div></div>
            )) : <div className="empty">Nothing assigned to you yet. Your manager assigns {R.pick || "work"} in the CRM.</div>}
          </section>
          <section className="card"><h3>Logged today <small>{h1(h)} hours</small></h3>
            {L.length ? L.map(e => <EntryLi key={e._id} e={e} onDelete={rec ? null : P.removeEntry} />)
              : <div className="empty">Nothing logged yet today. Tap <b>+ Log work</b> after each piece of work.</div>}
          </section>
        </div>
        <div>
          <TodayPlan refs={mine} yesterday={last && last.date < today() ? last.plan : ""} />
          <section className="card"><h3>Tasks for today <Link className="btn sm r" to="/tasks">All tasks</Link></h3>
            {due.length ? due.map(t => <TaskLi key={t._id} t={t} onStatus={P.setTaskStatus} />) : <div className="empty">No tasks due today.</div>}</section>
          <section className="card"><h3>This week</h3><div className="pad"><WeekStrip entries={P.entries} days={P.days} /></div></section>
        </div>
      </div>
      {modal === "submit" && <SubmitDay h={h} n={L.length} due={due} onClose={() => setModal(null)} onSubmit={async (d) => { await P.submitDay(d); setModal(null); }} />}
      {modal === "block" && <Blocked refs={mine} onClose={() => setModal(null)} onSubmit={async (b) => { await P.addBlocker(b); setModal(null); }} />}
    </>
  );
}

export function SubmitDay({ h, n, due, onClose, onSubmit }) {
  const submit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); onSubmit({ note: [f.reason, f.note].filter(Boolean).join(". "), plan: f.plan || "" }); };
  return (
    <Modal title="Submit my day" onClose={onClose}>
      <p style={{ marginTop: 0 }}>{fdw(today())} · <b>{h1(h)} hours</b> · {n} items</p>
      {!n && <div className="alert am">You have not logged anything today.</div>}
      <form onSubmit={submit}>
        {h < 7 && (
          <div className="f"><label htmlFor="sr">Less than 7 hours. Reason</label>
            <select id="sr" name="reason" required><option value="">Choose</option><option>Half day leave</option><option>Client visit or meeting outside</option><option>Waiting on client or blocked</option><option>Will log more hours tomorrow</option><option>Other</option></select></div>
        )}
        {due.length > 0 && <p className="sub">{due.length} task{due.length > 1 ? "s" : ""} due today still open: {due.map(t => t.title).join("; ")}</p>}
        <div className="f"><label htmlFor="sn">Note for Harish (optional)</label><textarea id="sn" name="note" rows={2} /></div>
        <div className="f"><label htmlFor="sp">Plan for tomorrow (optional)</label><textarea id="sp" name="plan" rows={2} /></div>
        <button className="btn p lg">Submit</button> <span className="sub" style={{ display: "inline" }}>After submitting, today's entries are locked.</span>
      </form>
    </Modal>
  );
}

export function Blocked({ refs, onClose, onSubmit }) {
  const submit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); onSubmit({ refName: f.ref, text: f.text.trim() }); };
  return (
    <Modal title="I'm blocked" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sub" style={{ marginTop: 0 }}>Harish sees this straight away on his dashboard.</p>
        <div className="f"><label htmlFor="br">Client or project</label>
          <select id="br" name="ref"><option value="">Internal / none</option>{refs.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
        <div className="f"><label htmlFor="bt">What are you waiting for?</label><textarea id="bt" name="text" rows={3} required placeholder="Client has not shared the hosting login" /></div>
        <button className="btn w lg">Send to Harish</button>
      </form>
    </Modal>
  );
}

/* ───────── Log work ───────── */
const Pfx = createContext("");
function Inp({ name, label, type = "text", ...rest }) {
  const n = useContext(Pfx) + name;
  return (
    <div className="f"><label htmlFor={`i-${n}`}>{label}</label>
      {type === "password" ? <PwInput id={`i-${n}`} name={n} {...rest} /> : <input id={`i-${n}`} name={n} type={type} {...rest} />}</div>
  );
}
function Sel({ name, label, opts, ...rest }) {
  const n = useContext(Pfx) + name;
  return (
    <div className="f"><label htmlFor={`i-${n}`}>{label}</label>
      <select id={`i-${n}`} name={n} {...rest}>{opts.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}</select></div>
  );
}
function Area({ name, label, ...rest }) {
  const n = useContext(Pfx) + name;
  return <div className="f"><label htmlFor={`i-${n}`}>{label}</label><textarea id={`i-${n}`} name={n} {...rest} /></div>;
}

// GSC / GA4 / GTM setup: pick what was set up, with a link for each
const TRACK = [["gsc", "Google Search Console", "https://search.google.com/search-console?resource_id=…"], ["ga4", "Google Analytics 4", "https://analytics.google.com/analytics/web/#/p…"], ["gtm", "Google Tag Manager", "https://tagmanager.google.com/#/container/…"]];
function TrackingFields() {
  const px = useContext(Pfx);
  const [on, setOn] = useState(["gsc"]);
  const flip = (k) => setOn(L => (L.includes(k) ? L.filter(x => x !== k) : [...L, k]));
  return (
    <>
      <div className="f"><label>What did you set up?</label>
        <div className="lw-pick">
          {TRACK.map(([k, l]) => (
            <label key={k} className={`lw-chk${on.includes(k) ? " on" : ""}`}>
              <input type="checkbox" name={`${px}tools`} value={k} checked={on.includes(k)} onChange={() => flip(k)} />
              <b>{k.toUpperCase()}</b><small>{l}</small>
            </label>
          ))}
        </div></div>
      {TRACK.filter(([k]) => on.includes(k)).map(([k, l, ph]) => (
        <Inp key={k} name={`link_${k}`} label={`${l} link`} placeholder={ph} />
      ))}
      <Inp name="title" label="Details" required placeholder="GA4 property created, GTM installed on all pages, site verified in GSC" />
    </>
  );
}

function Fields({ type, devs }) {
  const mod = <Inp name="mod" label="Module or screen" placeholder="Eg. Checkout, Home page" />;
  switch (type) {
    case "backlink": return (<>
      <Area name="urls" label="Backlink URLs, one per line" rows={5} required placeholder="https://medium.com/@nnc/destination-wedding-guide" />
      <div className="g3"><Inp name="kw" label="Keyword targeted" /><Sel name="btype" label="Type" opts={["Guest post", "Directory listing", "Business profile", "Article submission", "Social bookmark", "Image submission", "Press release"]} /><Inp name="da" label="Domain authority (DA)" type="number" min="0" max="100" placeholder="45" /></div>
    </>);
    case "blog": return (<><Inp name="title" label="Blog title" required /><Inp name="url" label="Live blog link" type="url" placeholder="https://" /><div className="g2"><Inp name="kw" label="Keyword targeted" /><Inp name="words" label="Word count" type="number" min="100" placeholder="1200" /></div></>);
    case "gmb": return (<><Inp name="title" label="Post headline" required /><Inp name="url" label="Post link" placeholder="g.page/..." /><div className="g2"><Sel name="gtype" label="Post type" opts={["Update", "Offer", "Event", "Photo"]} /><Inp name="kw" label="Keyword" /></div></>);
    case "onpage": return (<><Inp name="title" label="What was changed" required placeholder="Meta titles updated on 6 service pages" /><Inp name="url" label="Page link" /></>);
    case "optimise": case "newad": return (<><Inp name="camp" label="Campaign" required /><Inp name="title" label={type === "newad" ? "What was added" : "What did you change"} required placeholder={type === "newad" ? "2 new responsive search ads in Implants ad group" : "Raised budget to ₹1,500, paused 3 low-CTR ads"} /></>);
    case "negative": return (<><Inp name="camp" label="Campaign" required /><Area name="terms" label="Negative keywords added" required placeholder="free, jobs, salary" /></>);
    case "feature": case "page": case "deploy": case "build": case "bugfix": return (<>
      {mod}<Inp name="title" label="What was done" required />
      <Inp name="url" label={{ feature: "Commit or pull request link", page: "Staging page link", deploy: "Staging or live link", build: "APK or TestFlight link", bugfix: "Commit link for the fix" }[type]} />
      {type === "build" && <Inp name="ver" label="Version" placeholder="1.2.0" />}
    </>);
    case "screen": case "revision": return (<>
      {mod}<Inp name="title" label={type === "screen" ? "Screens designed" : "What was revised"} required />
      <div className="g2"><Inp name="url" label="Figma link" /><Inp name="screens" label="Number of screens" type="number" min="1" defaultValue="1" /></div>
      <SendBox />
    </>);
    case "poster": return (<><Inp name="title" label="What was designed" required placeholder="Diwali offer post" /><div className="g2"><Inp name="url" label="Image or Drive link" /><Sel name="platform" label="For" opts={["Instagram", "Facebook", "GMB", "LinkedIn", "Print"]} /></div></>);
    case "test": return (<>{mod}<Inp name="title" label="What was tested" required /><div className="g3"><Inp name="pass" label="Cases passed" type="number" min="0" required /><Inp name="fail" label="Cases failed" type="number" min="0" defaultValue="0" required /><Inp name="url" label="Test sheet link" /></div></>);
    case "bug": return (<>
      {mod}<Inp name="title" label="What is wrong" required placeholder="Checkout total wrong when coupon applied" />
      <div className="g2"><Sel name="sev" label="Severity" opts={["High", "Medium", "Low"]} defaultValue="Medium" />
        <Sel name="assign" label="Assign to" required opts={[["", devs.length ? "Choose a developer" : "No developers have an account yet"], ...devs.map(d => [d.id, `${d.name} · ${ROLES[d.role]?.l || ""}`])]} /></div>
      <Area name="steps" label="Steps to reproduce" rows={3} /><Inp name="url" label="Video or screenshot link (optional)" />
    </>);
    case "webcontent": return (<><Inp name="title" label="Pages or sections written" required placeholder="Home, About and Services pages" />
      <Inp name="url" label="Document or page link" placeholder="Google Doc or website link" />
      <div className="g3"><Inp name="pages" label="Pages" type="number" min="1" defaultValue="1" /><Inp name="words" label="Word count" type="number" min="0" /><Inp name="kw" label="Main keyword" /></div></>);
    case "blogcontent": return (<><Inp name="title" label="Blog title" required />
      <Inp name="url" label="Document link" placeholder="Google Doc link" />
      <div className="g2"><Inp name="kw" label="Keyword targeted" /><Inp name="words" label="Word count" type="number" min="100" placeholder="1200" /></div></>);
    case "landing": return (<><Inp name="title" label="Landing page" required placeholder="Diwali offer page, Ads campaign" />
      <Inp name="url" label="Document or page link" />
      <div className="g2"><Inp name="kw" label="Main keyword or offer" /><Inp name="words" label="Word count" type="number" min="0" /></div></>);
    case "campaign": return (<><div className="g2"><Inp name="camp" label="Campaign name" required /><Sel name="platform" label="Campaign type" opts={["Google Ads · Search", "Google Ads · Performance Max", "Google Ads · Display", "Google Ads · YouTube", "Google Ads · Demand Gen", "Google Ads · Shopping", "Google Ads · Call"]} /></div>
      <Inp name="title" label="What was set up" required placeholder="3 ad groups, 12 ads, call and sitelink extensions" />
      <div className="g2"><Inp name="amt" label="Daily budget (₹)" type="number" min="0" /><Inp name="kw" label="Main keywords or audience" /></div>
      <Inp name="url" label="Link (optional)" /></>);
    case "tracking": return <TrackingFields />;
    case "kwresearch": return (<><Inp name="title" label="Research for" required placeholder="Dental implant pages / Diwali Google Ads campaign" />
      <div className="g2"><Inp name="kws" label="Keywords found" type="number" min="1" /><Inp name="kw" label="Main keyword" /></div>
      <Inp name="url" label="Keyword sheet link" placeholder="Google Sheet link" /></>);
    case "metaads": return (<><div className="g2"><Inp name="camp" label="Campaign name" required /><Sel name="platform" label="What was done" opts={["Meta · New campaign", "Meta · Ad or creative change", "Meta · Audience change", "Meta · Budget change", "Meta · Lead form", "Meta · Boosted post"]} /></div>
      <Inp name="title" label="Details" required placeholder="Lead campaign for Bangalore, 2 ad sets, 4 creatives" />
      <div className="g2"><Inp name="amt" label="Daily budget (₹)" type="number" min="0" /><Inp name="url" label="Ads Manager link (optional)" /></div></>);
    case "social": return (<><Inp name="title" label="Posts scheduled" required placeholder="November festive posts" />
      <div className="g3"><Sel name="platform" label="Platform" opts={["Instagram", "Facebook", "Instagram and Facebook", "LinkedIn", "YouTube", "X (Twitter)", "GMB"]} /><Inp name="posts" label="Number of posts" type="number" min="1" defaultValue="1" /><Inp name="url" label="Planner or Drive link" /></div></>);
    case "position": return (<><Inp name="title" label="What was tracked" required placeholder="Weekly rank check, top 20 keywords" />
      <div className="g2"><Inp name="kws" label="Keywords checked" type="number" min="1" /><Inp name="url" label="Sheet or tool link" /></div></>);
    case "monthly": return (<><div className="g2"><Inp name="month" label="Report for" type="month" required /><Inp name="url" label="Report link" placeholder="PDF, Doc or Looker Studio link" /></div>
      <Inp name="title" label="What the report covers" required placeholder="SEO and Ads results, leads, rankings" /></>);
    case "docs": return (<><Inp name="title" label="Document or report" required placeholder="Keyword research sheet / Weekly status report" /><Inp name="url" label="Link (optional)" /></>);
    case "invoice": return (<><Inp name="title" label="Invoice or payment" required placeholder="Invoice NNC-104 sent / ₹50,000 received" /><div className="g2"><Inp name="amt" label="Amount (₹)" type="number" min="0" /><Inp name="url" label="Invoice link (optional)" /></div></>);
    default: return (<><Inp name="title" label="What did you work on" required /><Inp name="url" label="Link (optional)" /></>);
  }
}

function SendBox() {
  const px = useContext(Pfx);
  return <label className="row sub" style={{ marginBottom: 14 }}><input type="checkbox" name={`${px}send`} defaultChecked /> Sent to the client for approval</label>;
}

const META_KEYS = ["kw", "da", "words", "camp", "platform", "screens", "ver", "pass", "fail", "sev", "assign", "steps", "amt", "mod", "terms", "gtype", "pages", "posts", "kws", "month"];

export function LogWork() {
  const P = usePortal();
  const roles = rolesOf(P.session.user), picks = roleInfo(P.session.user).picks;
  const [type, setType] = useState("");
  const [devs, setDevs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blocks, setBlocks] = useState([{ id: 1, proof: [] }]);   // each piece of work, with its own screenshots or files
  const addBlock = () => setBlocks(L => [...L, { id: Math.max(...L.map(b => b.id)) + 1, proof: [] }]);
  // FilePick passes either the new list or a function of the old one
  const setProof = (id, files) => setBlocks(L => L.map(b => (b.id === id ? { ...b, proof: typeof files === "function" ? files(b.proof) : files } : b)));
  const nav = useNavigate();
  const locked = P.days.some(d => d.date === today());
  const todayL = P.entries.filter(e => e.date === today());
  const pickType = (k) => {
    if (TY[k].go) { nav(TY[k].go); return; }
    if (k === "bug") api("/developers").then(j => setDevs(j.data)).catch(() => setDevs([]));
    setBlocks([{ id: 1, proof: [] }]);
    setType(k);
  };
  const onClients = !!TY[type]?.c && picks.has("clients");
  const refs = onClients ? P.assigned.clients.map(c => ["client", c]) : P.assigned.projects.map(p => ["project", p]);
  const both = ["meeting", "other"].includes(type) ? [...P.assigned.clients.map(c => ["client", c]), ...P.assigned.projects.map(p => ["project", p])] : refs;

  // one piece of work (fields named with the block's prefix) → { items, hrs } or an error message
  const build = (fd, px, proof) => {
    const d = {};
    for (const [k, v] of fd.entries()) if (k.startsWith(px)) d[k.slice(px.length)] = v;
    const meta = {};
    META_KEYS.forEach(k => { if (d[k] !== undefined && d[k] !== "") meta[k] = ["da", "words", "screens", "pass", "fail", "amt", "pages", "posts", "kws"].includes(k) ? +d[k] : d[k]; });
    if (meta.month) meta.month = new Date(`${meta.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (type === "bug" && d.assign) meta.assignName = devs.find(x => x.id === d.assign)?.name || "";
    if (type === "screen" || type === "revision") meta.send = !!d.send;
    if (proof.length) meta.files = proof;
    if (type === "tracking") {
      const tools = fd.getAll(`${px}tools`);
      if (!tools.length) return { err: "Tick at least one: GSC, GA4 or GTM" };
      meta.tools = tools.map(t => t.toUpperCase()).join(", ");
      const links = tools.map(t => ({ l: t.toUpperCase(), url: String(d[`link_${t}`] || "").trim() })).filter(x => x.url).map(x => ({ ...x, url: /^https?:/.test(x.url) ? x.url : `https://${x.url}` }));
      if (links.length) meta.links = links;
      d.url = links[0]?.url || "";
      d.title = `${meta.tools} setup: ${d.title}`;
    }
    // work that needs proof: a link, or a screenshot or video
    if (["blog", "poster"].includes(type) && !String(d.url || "").trim() && !proof.length) return { err: "Add the link, or attach a screenshot or video" };
    const url = (u) => (u ? (/^https?:/.test(u) ? u : `https://${u}`) : "");
    let items;
    if (type === "backlink") {
      items = d.urls.split(/\s*\n\s*/).map(x => x.trim()).filter(Boolean).map(u => ({ title: `${d.btype} on ${u.replace(/^https?:\/\//, "").split("/")[0]}`, url: url(u), meta }));
    } else {
      const title = type === "negative" ? "Added negative keywords" : type === "gmb" ? `${d.gtype} post: ${d.title}` : ["campaign", "metaads"].includes(type) ? `${d.camp}: ${d.title}` : d.title;
      items = [{ title, url: url(d.url), meta }];
    }
    const hrs = Math.max(0, +d.hh || 0) + (+d.mm || 0) / 60;
    if (hrs <= 0) return { err: "Enter the time spent, in hours and minutes" };
    return { items, hrs: Math.round(hrs * 100) / 100 };
  };

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const [refType, refId] = String(fd.get("ref") || "").split(":");
    const date = fd.get("date") || today();
    const W = blocks.map((b, i) => ({ i, ...build(fd, `w${b.id}_`, b.proof) }));
    const bad = W.find(w => w.err);
    if (bad) { toast(W.length > 1 ? `Work ${bad.i + 1}: ${bad.err}` : bad.err); return; }
    setBusy(true);
    let saved = 0;
    try {
      for (const w of W) { await api("/work", { method: "POST", body: { type, date, refType: refType || "", refId: refId || "", hrs: w.hrs, items: w.items } }); saved++; }
      const n = W.reduce((a, w) => a + w.items.length, 0);
      toast(type === "backlink" ? `${n} backlink${n > 1 ? "s" : ""} saved` : type === "bug" ? (saved > 1 ? `${saved} bugs sent to the developers` : "Bug sent to the developer") : saved > 1 ? `${saved} pieces of work saved` : `${TY[type].l} saved`);
      setType(""); setBlocks([{ id: 1, proof: [] }]);
    } catch (ex) {
      toast(saved ? `${saved} saved. Work ${saved + 1}: ${ex.message}` : ex.message);
      if (saved) setBlocks(L => L.slice(saved));   // keep only the ones not saved yet
    } finally { setBusy(false); P.refresh(); }
  };

  const hToday = hoursOn(P.entries, today());
  const rec = P.days.find(d => d.date === today());
  const dueToday = P.tasks.filter(t => t.status !== "done" && t.due <= today());
  const submitModal = submitting && (
    <SubmitDay h={hToday} n={todayL.length} due={dueToday} onClose={() => setSubmitting(false)}
      onSubmit={async (d) => { await P.submitDay(d); setSubmitting(false); }} />
  );

  if (!type) return (
    <>
      <div className="lw-head">
        <div><h2 className="t">Log work<span>.</span></h2>
          <p className="lead" style={{ margin: 0 }}>Your timesheet for {fdw(today())}. Log each piece of work when you finish it, then submit the day before you leave.</p></div>
      </div>
      <DayPanel hrs={hToday} extra={todayL.filter(e => e.meta?.extra).reduce((a, e) => a + (e.hrs || 0), 0)} items={todayL.length} submitted={rec} onSubmit={() => setSubmitting(true)} onLog={() => document.getElementById("lw-types")?.scrollIntoView({ behavior: "smooth" })} />
      {locked && <div className="alert ok">Today is submitted. Anything you log for today now is saved as <b>extra work</b>, on top of your day.</div>}
      <section className="card" id="lw-types"><h3>What did you work on? <small>pick one to log it</small></h3>
        <div className="pad"><TypeTiles types={typesFor(roles)} onPick={pickType} /></div>
      </section>
      <section className="card"><h3>Today's entries <small>{todayL.length} items · {h1(hToday)} hours</small>
        {!locked && todayL.length > 0 && <button type="button" className="btn sm p r" onClick={() => setSubmitting(true)}>Submit my day</button>}</h3>
        <TodaySheet list={todayL} locked={locked} onDelete={async (id) => { if (await confirmBox({ title: "Delete this entry?", text: "It is removed from your timesheet.", ok: "Delete", danger: true })) P.removeEntry(id); }} />
      </section>
      {submitModal}
    </>
  );

  const hrsDef = { backlink: 0.5, gmb: 0.5, blog: 3, build: 1, deploy: 1, bug: 0.5 }[type] || 2;
  const optional = ["meeting", "other", "invoice"].includes(type);
  const Ic = TY_IC[type];
  return (
    <>
      <div className="lw-formhead">
        <button type="button" className="btn sm" onClick={() => setType("")}><ArrowLeft size={14} /> Back</button>
        <span className={`lw-ti t-${type}`}>{Ic && <Ic size={18} />}</span>
        <div><h2 className="t" style={{ margin: 0 }}>{TY[type].l}<span>.</span></h2><span className="sub">{TY[type].h}</span></div>
        <span className="lw-today-chip">Today so far: <b>{h1(hToday)} h</b></span>
      </div>
      <div className="lw-formgrid">
        <section className="card">
          {!both.length && !optional ? (
            <div className="empty">No {onClients ? "clients" : "projects"} are assigned to you yet. Ask your manager to assign you in the CRM.</div>
          ) : (
            <form className="lw-form" onSubmit={submit} key={type}>
              <div className="lw-sec"><span className="lw-n">1</span><b>Where</b></div>
              <Sel name="ref" label={onClients ? "Client" : ["meeting", "other"].includes(type) ? "Client or project" : "Project"} required={!optional}
                opts={[...(optional ? [["", "Internal / none"]] : []), ...both.map(([k, x]) => [`${k}:${x.id}`, x.name])]} />
              <div className="lw-sec"><span className="lw-n">2</span><b>What you did</b>{blocks.length > 1 && <small className="sub" style={{ display: "inline", marginLeft: 6 }}>{blocks.length} pieces of work</small>}</div>
              {blocks.map((b, i) => (
                <Pfx.Provider key={b.id} value={`w${b.id}_`}>
                  <div className={blocks.length > 1 ? "lw-block" : ""}>
                    {blocks.length > 1 && (
                      <div className="lw-block-h"><b>Work {i + 1}</b>
                        <button type="button" className="btn sm" onClick={() => setBlocks(L => L.filter(x => x.id !== b.id))} aria-label={`Remove work ${i + 1}`}><X size={13} /> Remove</button></div>
                    )}
                    <Fields type={type} devs={devs} />
                    {type !== "bug" && (
                      <div className="f"><label>Screenshots, video or files {["blog", "poster"].includes(type) ? "(or add the link above)" : "(optional)"}</label>
                        <FilePick id={`lw-proof-${b.id}`} files={b.proof} onChange={(f) => setProof(b.id, f)} hint="No link? Paste a screenshot (Ctrl+V), drop a screen recording, or attach the file." /></div>
                    )}
                    <div className="f" style={{ maxWidth: 320 }}><label htmlFor={`i-w${b.id}_hh`}>Time spent{type === "backlink" ? " (for all these links)" : ""}</label>
                      <div className="lw-time">
                        <input id={`i-w${b.id}_hh`} name={`w${b.id}_hh`} type="number" min="0" max="16" step="1" defaultValue={Math.floor(hrsDef)} aria-label="Hours" /><span>h</span>
                        <select name={`w${b.id}_mm`} defaultValue={Math.round((hrsDef % 1) * 60)} aria-label="Minutes">{Array.from({ length: 12 }, (_, k) => k * 5).map(m => <option key={m} value={m}>{m}</option>)}</select><span>min</span>
                      </div></div>
                  </div>
                </Pfx.Provider>
              ))}
              <button type="button" className="lw-addmore" onClick={addBlock} disabled={blocks.length >= 15}><Plus size={16} /> Add another {type === "bug" ? "bug" : "piece of work"} {both.length ? "for the same " + (onClients ? "client" : "project") : ""}</button>
              <div className="lw-sec"><span className="lw-n">3</span><b>Date</b></div>
              <div className="g2"><Inp name="date" label="Date" type="date" defaultValue={today()} max={today()} /></div>
              <div className="lw-actions"><button type="button" className="btn lg" onClick={() => setType("")}>Cancel</button><button className="btn p lg" disabled={busy}>{busy ? "Saving…" : `${locked ? "Save as extra work" : "Save to timesheet"}${blocks.length > 1 ? ` (${blocks.length})` : ""}`}</button></div>
            </form>
          )}
        </section>
        <div>
          <Tips type={type} />
          <section className="card"><h3>Today's entries <small>{h1(hToday)} h</small></h3>
            {todayL.length ? todayL.slice(0, 6).map(e => <EntryLi key={e._id} e={e} />) : <div className="empty">Nothing logged yet today.</div>}
          </section>
        </div>
      </div>
      {submitModal}
    </>
  );
}

/* ───────── My tasks ───────── */
export function MyTasks() {
  const P = usePortal();
  const [tf, setTf] = useState("open");
  const open = P.tasks.filter(t => t.status !== "done");
  const L = P.tasks.filter(t => (tf === "open" ? t.status !== "done" : t.status === "done"));
  const refs = [...P.assigned.clients, ...P.assigned.projects];
  const add = async (e) => {
    e.preventDefault();
    const form = e.target, d = Object.fromEntries(new FormData(form));
    await P.addTask({ title: d.title.trim(), refName: d.ref, due: d.due || today() });
    form.reset();
  };
  return (
    <>
      <h2 className="t">My tasks<span>.</span></h2>
      <p className="lead">Tasks Harish assigns to you, and your own to-dos.</p>
      <div className="chips">
        <button type="button" className={`chip ${tf === "open" ? "on" : ""}`} onClick={() => setTf("open")}>Open ({open.length})</button>
        <button type="button" className={`chip ${tf === "done" ? "on" : ""}`} onClick={() => setTf("done")}>Done</button>
      </div>
      <div className="grid2">
        <section className="card"><h3>{tf === "open" ? "Open tasks" : "Completed"}</h3>
          {L.length ? L.map(t => <TaskLi key={t._id} t={t} onStatus={P.setTaskStatus} />) : <div className="empty">Nothing here.</div>}</section>
        <section className="card"><h3>Add my own task</h3>
          <form className="pad" onSubmit={add}>
            <Inp name="title" label="Task" required />
            <Sel name="ref" label="Client or project" opts={[["", "Internal / none"], ...refs.map(r => [r.name, r.name])]} />
            <Inp name="due" label="Due" type="date" defaultValue={today()} min={today()} />
            <button className="btn p">Add task</button>
          </form></section>
      </div>
    </>
  );
}

/* ───────── My history ───────── */
function hPeriod(k) {
  const ws = weekStart(), ms = monthStart();
  if (k === "week") return [ws, today()];
  if (k === "lweek") { const a = parse(ws); a.setDate(a.getDate() - 7); const b = parse(ws); b.setDate(b.getDate() - 1); return [iso(a), iso(b)]; }
  if (k === "month") return [ms, today()];
  const d = parse(today()); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
}
const workdays = (a, b) => { let n = 0; const x = parse(a); while (iso(x) <= b) { if (x.getDay()) n++; x.setDate(x.getDate() + 1); } return Math.max(1, n); };

export function MyHistory() {
  const P = usePortal();
  const [hp, setHp] = useState("week");
  const [a, b] = hPeriod(hp);
  const L = P.entries.filter(e => e.date >= a && e.date <= b);
  const hrs = L.reduce((s, e) => s + (e.hrs || 0), 0), wd = workdays(a, b > today() ? today() : b);
  const sub = P.days.filter(d => d.date >= a && d.date <= b).length;
  const byT = {}; L.forEach(e => { byT[e.type] = (byT[e.type] || 0) + 1; });
  const dates = [...new Set(L.map(e => e.date))].sort().reverse();
  return (
    <>
      <h2 className="t">My history<span>.</span></h2>
      <p className="lead">Everything you logged, day by day.</p>
      <div className="chips">{[["week", "This week"], ["lweek", "Last week"], ["month", "This month"], ["lmonth", "Last month"]].map(([k, l]) => (
        <button key={k} type="button" className={`chip ${hp === k ? "on" : ""}`} onClick={() => setHp(k)}>{l}</button>
      ))}</div>
      <div className="kpis">
        <div className="kpi"><span className="l">Hours</span><span className="v">{h1(hrs)}</span><span className="s">{h1(hrs / wd)} h a working day</span></div>
        <div className="kpi"><span className="l">Items logged</span><span className="v">{L.length}</span></div>
        <div className="kpi"><span className="l">Days submitted</span><span className="v">{sub} / {wd}</span><span className="s">{fd(a)} to {fd(b)}</span></div>
        <div className="kpi"><span className="l">Breakdown</span><span className="s" style={{ display: "block", marginTop: 4 }}>
          {Object.entries(byT).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${TY[k]?.l || k}: ${v}`).join(" · ") || "-"}</span></div>
      </div>
      <section className="card">
        {dates.length ? dates.map(d => {
          const D = L.filter(e => e.date === d), r = P.days.find(x => x.date === d);
          return (
            <div key={d}>
              <div className="li" style={{ background: "#FAFBFD", fontSize: 12, fontWeight: 600, color: "var(--mut)" }}>
                <span className="x">{fdw(d)}</span><span>{h1(D.reduce((s, e) => s + (e.hrs || 0), 0))} h</span>
                {r ? <span className="pill p-ok">Submitted {ampm(r.at)}</span> : d === today() ? <span className="pill p-amb">Open</span> : <span className="pill p-red">Not submitted</span>}
              </div>
              {D.map(e => <EntryLi key={e._id} e={e} />)}
              {r && (r.note || r.plan) && <div className="li"><div className="x sub">{r.note ? `Note: ${r.note}` : ""}{r.plan ? ` · Tomorrow: ${r.plan}` : ""}</div></div>}
            </div>
          );
        }) : <div className="empty">Nothing logged in this period.</div>}
      </section>
    </>
  );
}

/* ───────── My profile ───────── */
export function Profile() {
  const P = usePortal();
  const u = P.session.user, R = roleInfo(u);
  const save = (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); P.updateMe({ name: d.name.trim(), phone: d.phone.trim() }); };
  const pw = async (e) => {
    e.preventDefault();
    const form = e.target, d = Object.fromEntries(new FormData(form));
    if (d.pw !== d.pw2) { toast("New passwords do not match"); return; }
    if (!(await confirmBox({ title: "Change your password?", text: "You will use the new password from your next sign in.", ok: "Change password" }))) return;
    try { await api("/me/password", { method: "PUT", body: { current: d.cur, password: d.pw } }); toast("Password changed"); form.reset(); }
    catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <h2 className="t">My profile<span>.</span></h2>
      <p className="lead">{R.l} · {R.dept}{u.created ? ` · member since ${fd(String(u.created).slice(0, 10))}` : ""}</p>
      <div className="card"><h3>Your details</h3>
        <form className="pad" style={{ maxWidth: 560 }} onSubmit={save} key={u.name + u.phone}>
          <div className="g2"><Inp name="name" label="Full name" required defaultValue={u.name} /><Inp name="phone" label="Mobile number" type="tel" required defaultValue={u.phone} /></div>
          <div className="f"><label htmlFor="pr3">Work email</label><input id="pr3" type="email" value={u.email} disabled /></div>
          <button className="btn p">Save details</button>
        </form></div>
      <div className="card"><h3>Change password</h3>
        <form className="pad" style={{ maxWidth: 560 }} onSubmit={pw}>
          <Inp name="cur" label="Current password" type="password" required />
          <div className="g2"><Inp name="pw" label="New password" type="password" required minLength={8} /><Inp name="pw2" label="Confirm new password" type="password" required /></div>
          <button className="btn p">Change password</button>
        </form></div>
      <div className="card"><h3>Sign-in activity</h3><div className="pad"><span className="sub">Last sign in: {u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-IN") : "-"} · {u.logins || 0} sign ins in total</span></div></div>
    </>
  );
}
