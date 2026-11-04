import { useEffect, useState } from "react";
import { useProjects } from "./useProjects";
import { Link, useParams } from "react-router-dom";
import {
  FolderKanban, FileText, Plug, Users, Bug, Clock, CalendarDays, ExternalLink, Eye, EyeOff, Copy, ArrowLeft, MapPin, ListChecks, Download, AlertTriangle,
} from "lucide-react";
import { usePortal } from "../../auth/store";
import { api, API } from "../../api";
import { TY, metaTxt } from "../../roles";
import { toast } from "../../toast";
import { today, fd, fdw, h1, parse } from "../../util";

// Projects the employee is assigned to in the CRM, with documents, integrations and team
const STAGES = ["Onboarded", "Requirement Gathering", "Design", "Development in Progress", "Testing / Review", "Deployed / Live", "Project Completed"];
const SHORT = ["Onboarded", "Requirements", "Design", "Development", "Testing", "Live", "Completed"];
const INT_ST = { pending: ["Pending", "p-gr"], in_progress: ["In progress", "p-blue"], live: ["Live", "p-ok"], issue: ["Issue", "p-red"], inactive: ["Inactive", "p-gr"] };
const EX_ST = { quoted: ["Quoted", "p-gr"], approved: ["Approved, to start", "p-amb"], in_progress: ["In progress", "p-blue"], done: ["Done", "p-ok"] };
const daysTo = (d) => Math.round((parse(d) - parse(today())) / 864e5);
const fileUrl = (u) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u.startsWith("/") ? "" : "/"}${u}`);
const kb = (n) => (!n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function Stepper({ stage, completed }) {
  const at = completed ? STAGES.length - 1 : STAGES.indexOf(stage);
  if (stage === "On Hold") return <div className="pj-hold"><AlertTriangle size={14} /> On hold</div>;
  return (
    <div className="pj-steps" aria-label={`Status: ${stage || "Not started"}`}>
      {SHORT.map((s, i) => <div key={s} className={i < at ? "done" : i === at ? "now" : ""}><i /><span>{s}</span></div>)}
    </div>
  );
}

export function DueChip({ due, completed }) {
  if (completed) return <span className="pill p-ok">Delivered</span>;
  if (!due) return <span className="pill p-gr">No delivery date</span>;
  const n = daysTo(due);
  return <span className={`pill ${n < 0 ? "p-red" : n <= 7 ? "p-amb" : "p-blue"}`}>{n < 0 ? `${-n} days overdue` : n === 0 ? "Due today" : `${n} days left`} · {fd(due)}</span>;
}


export function ProjectCard({ p }) {
  return (
    <Link to={`/projects/${p.id}`} className="pj-card">
      <div className="pj-top">
        <span className="pj-ic"><FolderKanban size={18} /></span>
        <span className="pj-tt"><b>{p.name}</b><span className="sub">{[p.industry, p.location].filter(Boolean).join(" · ") || p.client}</span></span>
        <DueChip due={p.due} completed={p.completed} />
      </div>
      <Stepper stage={p.stage} completed={p.completed} />
      {p.req && <p className="pj-req">{p.req}</p>}
      <div className="pj-stats">
        <span title="Documents and minutes"><FileText size={14} /> {p.docs}</span>
        <span title="Third-party integrations" className={p.intIssues ? "bad" : ""}><Plug size={14} /> {p.integrations}{p.intIssues ? ` · ${p.intIssues} issue` : ""}</span>
        <span title="Open bugs" className={p.openBugs ? "bad" : ""}><Bug size={14} /> {p.openBugs}</span>
        <span title="Your hours this week"><Clock size={14} /> {h1(p.myWeek)}h you · {h1(p.teamWeek)}h team</span>
      </div>
      <div className="pj-foot">
        <span className="pj-team">{p.team.slice(0, 5).map(t => <i key={t.name} title={`${t.name} · ${t.role}`}>{t.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}</i>)}</span>
        <span className="sub">{p.last ? `Last: ${p.last.title.slice(0, 40)} · ${fd(p.last.date)}` : "No work logged yet"}</span>
      </div>
    </Link>
  );
}

/* ───────── list ───────── */
export function ProjectsPage() {
  const { data, err } = useProjects();
  const [f, setF] = useState("active");
  const L = (data || []).filter(p => (f === "all" ? true : f === "done" ? p.completed || p.stage === "Project Completed" : !p.completed && p.stage !== "Project Completed"));
  return (
    <>
      <h2 className="t">My projects<span>.</span></h2>
      <p className="lead">Every project you are on, with its status, documents, integrations and team. Assigned by your manager in the CRM.</p>
      {err && <div className="alert am">{err}</div>}
      <div className="chips">{[["active", "Active"], ["done", "Completed"], ["all", "All"]].map(([k, l]) => (
        <button key={k} type="button" className={`chip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l}</button>
      ))}</div>
      {!data ? <div className="card"><div className="empty">Loading…</div></div> : L.length ? (
        <div className="pj-grid">{L.map(p => <ProjectCard key={p.id} p={p} />)}</div>
      ) : <div className="card"><div className="empty">{data.length ? "Nothing in this list." : "No projects assigned to you yet. Your manager adds you to a project's developers in the CRM."}</div></div>}
    </>
  );
}

/* ───────── one project ───────── */
const TABS = [["over", "Overview", <ListChecks size={15} />], ["docs", "Documents", <FileText size={15} />], ["int", "Integrations", <Plug size={15} />], ["work", "Work and bugs", <Bug size={15} />], ["cr", "Change requests", <CalendarDays size={15} />], ["team", "Team", <Users size={15} />]];

export function ProjectDetail() {
  const { id } = useParams();
  const [st, setSt] = useState({ id: "", data: null, err: "" });
  const [tab, setTab] = useState("over");
  useEffect(() => {
    let live = true;
    api(`/projects/${id}`).then(j => live && setSt({ id, data: j.data, err: "" }), e => live && setSt({ id, data: null, err: e.message }));
    return () => { live = false; };
  }, [id]);
  const p = st.id === id ? st.data : null;
  if (st.id === id && st.err) return <><Back /><div className="alert am">{st.err}</div></>;
  if (!p) return <><Back /><div className="card"><div className="empty">Loading…</div></div></>;
  const count = { docs: p.files.length + p.moms.length, int: p.integrations.length, work: p.work.length, cr: p.extras.length, team: p.team.length };
  return (
    <>
      <Back />
      <section className="pj-hero">
        <div className="pj-hero-top">
          <span className="pj-ic lg"><FolderKanban size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{p.name}</h2>
            <span className="sub">{[p.client, p.industry, p.location && <span key="l"><MapPin size={12} /> {p.location}</span>].filter(Boolean).map((x, i) => <span key={i}>{i ? " · " : ""}{x}</span>)}</span>
          </div>
          <DueChip due={p.due} completed={p.completed} />
        </div>
        <Stepper stage={p.stage} completed={p.completed} />
        <div className="pj-facts">
          <div><span>Status</span><b>{p.stage || "Not started"}</b></div>
          <div><span>Started</span><b>{p.start ? fd(p.start) : p.onboarded ? fd(p.onboarded) : "-"}</b></div>
          <div><span>Delivery</span><b>{p.due ? fd(p.due) : "-"}</b></div>
          <div><span>Agreed timeline</span><b>{p.timeline ? `${p.timeline} days` : "-"}</b></div>
          <div><span>Team</span><b>{p.team.length} people</b></div>
        </div>
      </section>
      <nav className="pj-tabs" aria-label="Project sections">
        {TABS.map(([k, l, ic]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{ic} {l}{count[k] ? <em>{count[k]}</em> : null}</button>
        ))}
      </nav>
      {tab === "over" && <Overview p={p} go={setTab} />}
      {tab === "docs" && <Docs p={p} />}
      {tab === "int" && <Integrations p={p} />}
      {tab === "work" && <WorkTab p={p} />}
      {tab === "cr" && <Extras p={p} />}
      {tab === "team" && <Team p={p} />}
    </>
  );
}
const Back = () => <div style={{ marginBottom: 12 }}><Link className="btn sm" to="/projects"><ArrowLeft size={14} /> All projects</Link></div>;

function Overview({ p, go }) {
  const { session } = usePortal();
  const me = session.user.id;
  const ws = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const mine = p.work.filter(w => String(w.account) === me);
  const openBugs = p.work.filter(w => w.type === "bug" && ["open", "reopened"].includes(w.meta?.status));
  const issues = p.integrations.filter(i => i.status === "issue");
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="l">My hours this week</span><span className="v">{h1(mine.filter(w => w.date >= ws).reduce((a, w) => a + (w.hrs || 0), 0))}</span><span className="s">{h1(mine.reduce((a, w) => a + (w.hrs || 0), 0))} h in total</span></div>
        <div className="kpi"><span className="l">Team hours this week</span><span className="v">{h1(p.work.filter(w => w.date >= ws).reduce((a, w) => a + (w.hrs || 0), 0))}</span></div>
        <div className="kpi"><span className="l">Open bugs</span><span className="v" style={{ color: openBugs.length ? "var(--red)" : undefined }}>{openBugs.length}</span></div>
        <div className="kpi"><span className="l">Integrations</span><span className="v">{p.integrations.length}</span><span className="s">{p.integrations.filter(i => i.status === "live").length} live{issues.length ? ` · ${issues.length} with issues` : ""}</span></div>
      </div>
      {issues.length > 0 && <div className="alert am"><b>Integration issue:</b> {issues.map(i => i.service).join(", ")}. <button type="button" className="link" onClick={() => go("int")}>See integrations</button></div>}
      <div className="grid2">
        <section className="card"><h3>Requirements and scope</h3>
          <div className="pad"><div className="pj-pre">{p.req || "No requirements written in the CRM yet."}</div></div></section>
        <div>
          <section className="card"><h3>Latest work <button type="button" className="btn sm r" onClick={() => go("work")}>All work</button></h3>
            {p.work.length ? p.work.slice(0, 6).map(w => <WorkLi key={w._id} w={w} />) : <div className="empty">No work logged on this project yet.</div>}</section>
          <section className="card"><h3>Project history</h3>
            {p.history.length ? p.history.slice(0, 8).map((h, i) => (
              <div key={i} className="li"><div className="x"><b>{h.title}</b><span className="sub">{[h.meta, h.by, h.at && new Date(h.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</span></div></div>
            )) : <div className="empty">No status changes recorded yet.</div>}</section>
        </div>
      </div>
    </>
  );
}

function WorkLi({ w }) {
  return (
    <div className="li">
      <div className="x"><span className="tag">{TY[w.type]?.l || w.type}</span><b>{w.title}</b>
        <span className="sub">{[w.by, metaTxt(w), fd(w.date)].filter(Boolean).join(" · ")}</span>
        {w.url && <a className="url" href={w.url} target="_blank" rel="noopener noreferrer">{w.url.replace(/^https?:\/\//, "")}</a>}</div>
      <span className="sub" style={{ whiteSpace: "nowrap" }}>{h1(w.hrs)} h</span>
    </div>
  );
}

function Docs({ p }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="grid2">
      <section className="card"><h3>Files <small>{p.files.length}</small></h3>
        {p.files.length ? p.files.map(f => (
          <div key={f.id} className="li">
            <span className="pj-file"><FileText size={16} /></span>
            <div className="x"><b>{f.name}</b><span className="sub">{[f.kind, f.date && fd(String(f.date).slice(0, 10)), kb(f.size), f.notes].filter(Boolean).join(" · ")}</span></div>
            {f.url && <a className="btn sm" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"><Download size={13} /> Open</a>}
          </div>
        )) : <div className="empty">No documents uploaded for this project in the CRM.</div>}
      </section>
      <section className="card"><h3>Minutes of meetings <small>{p.moms.length}</small> <Link className="btn sm r" to="/meetings">+ New meeting</Link></h3>
        {p.moms.length ? p.moms.map(m => (
          <div key={m.id}>
            <button type="button" className="li pj-momrow" onClick={() => setOpen(open === m.id ? null : m.id)}>
              <div className="x"><b>{m.title || "Meeting"}</b><span className="sub">{[m.date && fdw(m.date), m.by, m.src === "crm" ? "from the CRM" : "from the portal"].filter(Boolean).join(" · ")}</span></div>
              <span className="sub">{open === m.id ? "Hide" : "Read"}</span>
            </button>
            {open === m.id && <div className="pad"><div className="pj-pre">{m.attendees ? `Attendees: ${m.attendees}\n\n` : ""}{m.text || "No text."}</div></div>}
          </div>
        )) : <div className="empty">No minutes recorded for this project yet.</div>}
      </section>
    </div>
  );
}

function Secret({ p, i, s }) {
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  const show = async () => {
    if (v != null) { setV(null); return; }
    setBusy(true);
    try { const j = await api(`/projects/${p.id}/integrations/${i.id}/secrets/${s.id}/reveal`, { method: "POST" }); setV(j.value); }
    catch (ex) { toast(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="pj-sec">
      <span className="sub">{s.label}</span>
      <code>{v != null ? v || "(empty)" : "••••••••••"}</code>
      <button type="button" className="btn sm" disabled={busy} onClick={show} aria-label={v != null ? "Hide" : "Show"}>{v != null ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      {v != null && <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(v).then(() => toast("Copied"), () => {})} aria-label="Copy"><Copy size={13} /></button>}
    </div>
  );
}

function Integrations({ p }) {
  if (!p.integrations.length) return <div className="card"><div className="empty">No third-party integrations added for this project in the CRM (Credential Vault).</div></div>;
  return (
    <>
      {p.showSecrets && <p className="sub" style={{ marginTop: 0 }}>Passwords and keys are hidden. Each time you show one, it is recorded in the CRM with your name.</p>}
      <div className="pj-ints">{p.integrations.map(i => (
        <section key={i.id} className="card pj-int">
          <div className="pj-int-h">
            <span className="pj-ic"><Plug size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><b>{i.service}</b><span className="sub">{i.category} · {i.owner === "nnc" ? "NNC account" : "Client account"} · {i.mode === "test" ? "Test mode" : "Live mode"}</span></div>
            <span className={`pill ${INT_ST[i.status]?.[1] || "p-gr"}`}>{INT_ST[i.status]?.[0] || i.status}</span>
          </div>
          <div className="pad pj-int-b">
            {i.loginUrl && <div className="pj-sec"><span className="sub">Login</span><a href={/^https?:/.test(i.loginUrl) ? i.loginUrl : `https://${i.loginUrl}`} target="_blank" rel="noopener noreferrer">{i.loginUrl.replace(/^https?:\/\//, "")} <ExternalLink size={12} /></a></div>}
            {i.username && <div className="pj-sec"><span className="sub">Username</span><code>{i.username}</code>
              <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(i.username).then(() => toast("Copied"), () => {})} aria-label="Copy username"><Copy size={13} /></button></div>}
            {i.secrets.map(s => <Secret key={s.id} p={p} i={i} s={s} />)}
            {i.renewal && <div className="pj-sec"><span className="sub">Renews</span><span>{fd(i.renewal)}</span></div>}
            {i.notes && <div className="pj-note">{i.notes}</div>}
          </div>
        </section>
      ))}</div>
    </>
  );
}

function WorkTab({ p }) {
  const [who, setWho] = useState("");
  const bugs = p.work.filter(w => w.type === "bug");
  const people = [...new Map(p.work.map(w => [String(w.account), w.by])).entries()];
  const L = p.work.filter(w => w.type !== "bug" && (!who || String(w.account) === who));
  const bp = { open: ["Open", "p-red"], reopened: ["Reopened", "p-red"], fixed: ["Fixed, to verify", "p-blue"], verified: ["Verified", "p-ok"] };
  return (
    <div className="grid2">
      <section className="card"><h3>Work logged <small>{L.length} items · {h1(L.reduce((a, w) => a + (w.hrs || 0), 0))} h</small>
        {people.length > 1 && <select className="r" value={who} onChange={e => setWho(e.target.value)} aria-label="Person"><option value="">Everyone</option>{people.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}</h3>
        {L.length ? L.slice(0, 150).map(w => <WorkLi key={w._id} w={w} />) : <div className="empty">No work logged yet.</div>}
      </section>
      <section className="card"><h3>Bugs <small>{bugs.filter(b => ["open", "reopened"].includes(b.meta?.status)).length} open</small></h3>
        {bugs.length ? bugs.map(b => (
          <div key={b._id} className="li">
            <div className="x"><span className="tag">{b.meta?.bug}</span><b>{b.title}</b>
              <span className="sub">{[b.meta?.sev, b.meta?.mod, b.by ? `by ${b.by}` : "", b.meta?.assignName ? `to ${b.meta.assignName}` : "", fd(b.date)].filter(Boolean).join(" · ")}</span></div>
            <span className={`pill ${bp[b.meta?.status]?.[1] || "p-gr"}`}>{bp[b.meta?.status]?.[0] || "-"}</span>
          </div>
        )) : <div className="empty">No bugs raised on this project.</div>}
      </section>
    </div>
  );
}

function Extras({ p }) {
  if (!p.extras.length) return <div className="card"><div className="empty">No change requests or extra work on this project.</div></div>;
  return (
    <section className="card"><h3>Change requests and extra work</h3>
      {p.extras.map(x => (
        <div key={x.id} className="li"><div className="x"><b>{x.title}</b><span className="sub">{[x.description, x.date && `asked ${fd(x.date)}`].filter(Boolean).join(" · ")}</span></div>
          <span className={`pill ${EX_ST[x.status]?.[1] || "p-gr"}`}>{EX_ST[x.status]?.[0] || x.status}</span></div>
      ))}
    </section>
  );
}

function Team({ p }) {
  return (
    <div className="pj-teamgrid">{p.team.map(t => (
      <section key={t.id} className="card pj-person">
        <span className="av" style={{ background: "#2563EB" }}>{t.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}><b>{t.name}</b><span className="sub">{t.role}</span>
          {t.email && <a className="sub" href={`mailto:${t.email}`}>{t.email}</a>}
          {t.phone && <a className="sub" href={`https://wa.me/${String(t.phone).replace(/\D/g, "").length === 10 ? "91" : ""}${String(t.phone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{t.phone}</a>}
        </div>
      </section>
    ))}</div>
  );
}
