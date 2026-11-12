import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, Globe, CalendarDays, PlusCircle } from "lucide-react";
import { initials } from "../../roles";
import { api } from "../../api";
import { toast } from "../../toast";
import { fd } from "../../util";

// My projects (SEO and ads): every client the admin gave me in SEO & Ads Team, with the team on it,
// this month's targets, what is done so far and what is left today.

const JOB = { seo: ["SEO", "p-blue"], ads: ["Google Ads", "p-amb"], design: ["Design", "p-pur"] };
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

// One target as a small tile: done of target with a thin bar
function Tile({ label, done, target, note, fmt = (n) => n }) {
  const ok = target > 0 && done >= target;
  return (
    <div className={`mc-tile ${ok ? "ok" : ""}`}>
      <span className="mc-tl">{label}</span>
      <b>{fmt(done)}<small> / {fmt(target)}</small></b>
      <div className="mc-track"><i className={ok ? "ok" : ""} style={{ width: `${pct(done, target)}%` }} /></div>
      {note && <span className="mc-tn">{note}</span>}
    </div>
  );
}

export default function MyClients() {
  const [L, setL] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { api("/my-clients").then(j => setL(j.data), e => { toast(e.message); setL([]); }); }, []);
  const shown = (L || []).filter(c => !q || `${c.name} ${c.contact} ${c.site}`.toLowerCase().includes(q.toLowerCase()));
  const hr = new Date().getHours();

  return (
    <>
      <h2 className="t">My projects<span>.</span></h2>
      <p className="lead">The projects your admin has given you, with this month's targets and what is done so far. Log every piece of work so it counts here and in the client's report.</p>
      {L && L.length > 3 && <input type="search" className="mt-q" style={{ marginBottom: 12 }} placeholder="Search projects" value={q} onChange={e => setQ(e.target.value)} aria-label="Search projects" />}
      {L == null ? <section className="card"><div className="empty">Loading your clients…</div></section>
        : !L.length ? <section className="card"><div className="empty">No projects are assigned to you yet. Your admin assigns them in the CRM under SEO &amp; Ads Team.</div></section>
        : <div className="mc-grid">{shown.map(c => {
          const t = c.targets, d = c.done, seo = c.myJobs.includes("seo"), ads = c.myJobs.includes("ads"), des = c.myJobs.includes("design");
          return (
            <section key={c.id} className="card mc">
              <div className="mc-h">
                <div style={{ minWidth: 0 }}><b title={c.name}>{c.name}</b>
                  <span className="sub">{c.start ? `Since ${fd(c.start)}` : ""}</span></div>
                <span className="mc-jobs">{c.myJobs.map(j => <span key={j} className={`pill ${JOB[j][1]}`}>{JOB[j][0]}</span>)}</span>
              </div>
              <div className="mc-info">
                {c.contact && <span className="mc-contact">{c.contact}</span>}
                {c.phone && <a href={`tel:${c.phone}`}><Phone size={13} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} title={c.email}><Mail size={13} /> <span>{c.email}</span></a>}
                {c.site && <a href={/^https?:/.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noopener noreferrer" title={c.site}><Globe size={13} /> <span>{c.site.replace(/^https?:\/\//, "")}</span></a>}
              </div>

              {(seo || des || (ads && c.ads)) && (
                <div className="mc-tiles">
                  {seo && <Tile label="Backlinks" done={d.backlinkMonth} target={t.backlink} note={d.backlinkToday ? `${d.backlinkToday} today` : ""} />}
                  {seo && <Tile label="GMB posts" done={d.gmbMonth} target={t.gmb} />}
                  {seo && <Tile label="Blogs" done={d.blogMonth} target={t.blog} />}
                  {des && <Tile label="Posters" done={d.posterMonth} target={t.poster} />}
                  {ads && c.ads && <Tile label="Ads spend" done={Math.round(c.ads.spendMonth || 0)} target={c.budget || 0} fmt={inr} note={`${c.ads.leadsMonth} leads`} />}
                </div>
              )}
              <div className="mc-lines">
                {seo && <div className="mc-row"><span>Keywords</span><span className="sub">{c.keywords.count} agreed · {c.keywords.lastCheck ? `checked ${fd(c.keywords.lastCheck)}` : "not checked yet"}</span></div>}
                {ads && c.ads && (
                  <div className="mc-row"><span>Today's ads report</span>
                    {c.ads.today?.sent ? <span className="pill p-ok">Sent</span> : c.ads.today ? <span className="pill p-blue">Saved, not sent</span> : <span className={`pill ${hr >= 18 ? "p-red" : "p-amb"}`}>{hr >= 18 ? "Late, send by 7 pm" : "Not done yet"}</span>}
                  </div>
                )}
                {ads && c.metaBudget > 0 && <div className="mc-row"><span>Meta Ads budget</span><b>{inr(c.metaBudget)}</b></div>}
                <div className="mc-row"><span>Team</span>
                  <span className="mc-avs">{c.people?.length ? c.people.map(p => <span key={p.name} className="mc-av" title={`${p.name} · ${p.roles.map(r => ({ seo: "SEO", ads: "Ads", design: "Design" }[r] || r)).join(", ")}`}>{initials(p.name)}</span>) : <span className="sub">Only you</span>}</span>
                </div>
              </div>

              <div className="mc-act">
                <Link className="btn sm p" to="/log"><PlusCircle size={14} /> Log work</Link>
                {ads && <Link className="btn sm" to="/ads">Ads report</Link>}
                {seo && <Link className="btn sm" to="/ranks">Rank check</Link>}
                {des && <Link className="btn sm" to="/designs">My designs</Link>}
                <Link className="btn sm" to="/meetings" aria-label="Meeting" title="Meeting"><CalendarDays size={14} /></Link>
              </div>
            </section>
          );
        })}</div>}
    </>
  );
}
