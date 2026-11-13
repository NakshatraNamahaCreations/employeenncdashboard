import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Globe, CalendarDays, PlusCircle, ChevronDown, ExternalLink } from "lucide-react";
import Modal from "../../Modal";
import { initials } from "../../roles";
import { api } from "../../api";
import { toast } from "../../toast";
import { fd } from "../../util";
import { downloadCsv } from "../../csv";

// My projects (SEO and ads): every client the admin gave me in SEO & Ads Team, one row each with
// this month's numbers. Clicking a row opens the details: contact, targets, keywords, team and actions.

const JOB = { seo: ["SEO", "p-blue"], ads: ["Google Ads", "p-amb"], design: ["Design", "p-pur"] };
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

// One target as a small tile: done of target with a thin bar
function Tile({ label, done, target, note, fmt = (n) => n, onOpen }) {
  const ok = target > 0 && done >= target;
  return (
    <button type="button" className={`mc-tile mc-click ${ok ? "ok" : ""}`} onClick={onOpen} title="See what was added">
      <span className="mc-tl">{label}</span>
      <b>{fmt(done)}<small> / {fmt(target)}</small></b>
      <div className="mc-track"><i className={ok ? "ok" : ""} style={{ width: `${pct(done, target)}%` }} /></div>
      {note && <span className="mc-tn">{note}</span>}
      <span className="mc-see">See details</span>
    </button>
  );
}

const DONE_T = { backlink: "Backlinks", gmb: "GMB posts", blog: "Blogs", poster: "Posters", ads: "Ads reports" };
const link = (u) => (/^https?:/.test(u) ? u : `https://${u}`);

// The entries behind one number: this month, newest first, as a table with export
function DoneList({ c, type, onClose }) {
  const [L, setL] = useState(null);
  useEffect(() => { api(`/my-clients/${c.id}/done?type=${type}`).then(j => setL(j.data), e => { toast(e.message); setL([]); }); }, [c.id, type]);
  const ads = type === "ads";
  const exportCsv = () => {
    const head = ads ? ["Sl no", "Date", "Campaign", "Cost", "Impressions", "Clicks", "Leads", "Sent"] : ["Sl no", "Date", "Title", "Keyword", "Added by", "Link"];
    const rows = L.map((x, i) => ads ? [i + 1, x.date, x.campaign, x.spend, x.impr, x.clicks, x.conv, x.sent ? "Yes" : "No"] : [i + 1, x.date, x.title, x.kw, x.by, x.url ? link(x.url) : ""]);
    downloadCsv(`${DONE_T[type].replace(/\s+/g, "-")}_${c.name.replace(/[^a-z0-9]+/gi, "-")}.csv`, [head, ...rows]);
  };
  return (
    <Modal title={`${DONE_T[type]} this month · ${c.name}`} onClose={onClose}>
      {L == null ? <div className="empty">Loading…</div> : !L.length ? <div className="empty">Nothing added this month yet.</div> : (
        <div className="dl">
          <div className="dl-bar"><span className="sub">{L.length} this month, newest first</span><button type="button" className="btn sm" onClick={exportCsv}>Export</button></div>
          <div className="dl-tw"><table className="dl-t">
            <thead>{ads ? <tr><th>#</th><th>Date</th><th>Campaign</th><th className="r">Cost</th><th className="r">Clicks</th><th className="r">Leads</th><th>Status</th></tr>
              : <tr><th>#</th><th>Date</th><th>Title</th><th>Keyword</th><th>By</th><th>Link</th></tr>}</thead>
            <tbody>{L.map((x, i) => ads ? (
              <tr key={x.id}><td className="dl-n">{i + 1}</td><td className="dl-d">{fd(x.date)}</td><td>{x.campaign || "-"}</td><td className="r"><b>{inr(x.spend)}</b></td><td className="r">{x.clicks}</td><td className="r">{x.conv}</td>
                <td><span className={`pill ${x.sent ? "p-ok" : "p-blue"}`}>{x.sent ? "Sent" : "Saved"}</span></td></tr>
            ) : (
              <tr key={x.id}><td className="dl-n">{i + 1}</td><td className="dl-d">{fd(x.date)}</td><td className="dl-ti">{x.title || "-"}</td><td>{x.kw || "-"}</td><td>{x.by || "-"}</td>
                <td>{x.url ? <a href={link(x.url)} target="_blank" rel="noopener noreferrer" title={x.url}><ExternalLink size={13} /> Open</a> : "-"}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </Modal>
  );
}
// The same number, small, in the row
const Stat = ({ label, done, target, fmt = (n) => n }) => (
  <span className={`ml-stat ${target > 0 && done >= target ? "ok" : ""}`}><small>{label}</small><b>{fmt(done)}<em> / {fmt(target)}</em></b></span>
);

function AdsPill({ c, hr }) {
  if (c.ads.today?.sent) return <span className="pill p-ok">Report sent</span>;
  if (c.ads.today) return <span className="pill p-blue">Saved, not sent</span>;
  return <span className={`pill ${hr >= 18 ? "p-red" : "p-amb"}`}>{hr >= 18 ? "Report late" : "Report not done"}</span>;
}

export default function MyClients() {
  const [L, setL] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [see, setSee] = useState(null);   // { c, type }: the list behind a number
  useEffect(() => { api("/my-clients").then(j => setL(j.data), e => { toast(e.message); setL([]); }); }, []);
  const shown = (L || []).filter(c => !q || `${c.name} ${c.contact} ${c.site}`.toLowerCase().includes(q.toLowerCase()));
  const hr = new Date().getHours();

  return (
    <>
      <h2 className="t">My projects<span>.</span></h2>
      <p className="lead">The projects your admin has given you, with this month's numbers. Click a project to see the details. Log every piece of work so it counts here and in the client's report.</p>
      {L && L.length > 3 && <input type="search" className="mt-q" style={{ marginBottom: 12 }} placeholder="Search projects" value={q} onChange={e => setQ(e.target.value)} aria-label="Search projects" />}
      {L == null ? <section className="card"><div className="empty">Loading your clients…</div></section>
        : !L.length ? <section className="card"><div className="empty">No projects are assigned to you yet. Your admin assigns them in the CRM under SEO &amp; Ads Team.</div></section>
        : (
          <section className="card ml">
            {!shown.length && <div className="empty">No project matches "{q}".</div>}
            {shown.map((c, i) => {
              const t = c.targets, d = c.done, seo = c.myJobs.includes("seo"), ads = c.myJobs.includes("ads"), des = c.myJobs.includes("design");
              const on = open === c.id;
              return (
                <div key={c.id} className={`ml-item ${on ? "on" : ""} ${c.active === false ? "off" : ""}`}>
                  <button type="button" className="ml-row" onClick={() => setOpen(on ? "" : c.id)} aria-expanded={on}>
                    <span className="ml-n">{i + 1}</span>
                    <span className="ml-name"><b title={c.name}>{c.name}</b>
                      <span className="ml-jobs">{c.active === false && <span className="pill p-grey">Inactive</span>}{c.myJobs.map(j => <span key={j} className={`pill ${JOB[j][1]}`}>{JOB[j][0]}</span>)}</span></span>
                    <span className="ml-stats">
                      {seo && <Stat label="Backlinks" done={d.backlinkMonth} target={t.backlink} />}
                      {seo && <Stat label="GMB" done={d.gmbMonth} target={t.gmb} />}
                      {seo && <Stat label="Blogs" done={d.blogMonth} target={t.blog} />}
                      {des && <Stat label="Posters" done={d.posterMonth} target={t.poster} />}
                      {ads && c.ads && <Stat label="Ads spend" done={Math.round(c.ads.spendMonth || 0)} target={c.budget || 0} fmt={inr} />}
                    </span>
                    <span className="ml-st">{c.active === false ? <span className="pill p-grey">Inactive</span> : ads && c.ads ? <AdsPill c={c} hr={hr} /> : null}</span>
                    <ChevronDown size={18} className="ml-chev" />
                  </button>

                  {on && (
                    <div className="ml-detail">
                      <div className="mc-info">
                        <span className="sub">{c.start ? `Since ${fd(c.start)}` : ""}</span>
                        {c.contact && <span className="mc-contact">{c.contact}</span>}
                        {c.email && <a href={`mailto:${c.email}`} title={c.email}><Mail size={13} /> <span>{c.email}</span></a>}
                        {c.site && <a href={/^https?:/.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noopener noreferrer" title={c.site}><Globe size={13} /> <span>{c.site.replace(/^https?:\/\//, "")}</span></a>}
                      </div>
                      {(seo || des || (ads && c.ads)) && (
                        <div className="mc-tiles">
                          {seo && <Tile label="Backlinks this month" done={d.backlinkMonth} target={t.backlink} note={d.backlinkToday ? `${d.backlinkToday} today` : ""} onOpen={() => setSee({ c, type: "backlink" })} />}
                          {seo && <Tile label="GMB posts this month" done={d.gmbMonth} target={t.gmb} onOpen={() => setSee({ c, type: "gmb" })} />}
                          {seo && <Tile label="Blogs this month" done={d.blogMonth} target={t.blog} onOpen={() => setSee({ c, type: "blog" })} />}
                          {des && <Tile label="Posters this month" done={d.posterMonth} target={t.poster} onOpen={() => setSee({ c, type: "poster" })} />}
                          {ads && c.ads && <Tile label="Ads spend this month" done={Math.round(c.ads.spendMonth || 0)} target={c.budget || 0} fmt={inr} note={`${c.ads.leadsMonth} leads · ${c.ads.days} reports`} onOpen={() => setSee({ c, type: "ads" })} />}
                        </div>
                      )}
                      <div className="mc-lines">
                        {seo && <div className="mc-row"><span>Keywords</span><span className="sub">{c.keywords.count} agreed · {c.keywords.lastCheck ? `checked ${fd(c.keywords.lastCheck)}` : "not checked yet"}</span></div>}
                        {ads && c.ads && <div className="mc-row"><span>Today's ads report</span><AdsPill c={c} hr={hr} /></div>}
                        {ads && c.metaBudget > 0 && <div className="mc-row"><span>Meta Ads budget</span><b>{inr(c.metaBudget)}</b></div>}
                        <div className="mc-row"><span>Team</span>
                          <span className="ml-team">{c.people?.length ? c.people.map(p => (
                            <span key={p.name} className="ml-person"><span className="mc-av">{initials(p.name)}</span>{p.name}<em>{p.roles.map(r => ({ seo: "SEO", ads: "Ads", design: "Design" }[r] || r)).join(", ")}</em></span>
                          )) : <span className="sub">Only you</span>}</span>
                        </div>
                      </div>
                      <div className="mc-act">
                        <Link className="btn sm p" to="/log"><PlusCircle size={14} /> Log work</Link>
                        {ads && <Link className="btn sm" to="/ads">Ads report</Link>}
                        {seo && <Link className="btn sm" to="/ranks">Rank check</Link>}
                        {des && <Link className="btn sm" to="/designs">My designs</Link>}
                        <Link className="btn sm" to="/meetings"><CalendarDays size={14} /> Meeting</Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      {see && <DoneList c={see.c} type={see.type} onClose={() => setSee(null)} />}
    </>
  );
}
