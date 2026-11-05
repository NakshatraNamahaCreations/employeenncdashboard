import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, Globe, CalendarDays, LineChart, PenTool, Search, PlusCircle } from "lucide-react";
import { api } from "../../api";
import { toast } from "../../toast";
import { fd } from "../../util";

// My projects (SEO and ads): every client the admin gave me in SEO & Ads Team, with the team on it,
// this month's targets, what is done so far and what is left today.

const JOB = { seo: ["SEO", "p-blue"], ads: ["Google Ads", "p-amb"], design: ["Design", "p-pur"] };
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

function Bar({ label, done, target, note }) {
  const ok = target > 0 && done >= target;
  return (
    <div className="mc-bar">
      <div className="mc-bl"><span>{label}</span><b className={ok ? "ok" : ""}>{done} of {target}</b></div>
      <div className="mc-track"><i className={ok ? "ok" : ""} style={{ width: `${pct(done, target)}%` }} /></div>
      {note && <span className="sub">{note}</span>}
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
                <div style={{ minWidth: 0 }}><b>{c.name}</b>
                  <span className="sub">{c.start ? `Since ${fd(c.start)}` : ""}</span></div>
                <span className="mc-jobs">{c.myJobs.map(j => <span key={j} className={`pill ${JOB[j][1]}`}>{JOB[j][0]}</span>)}</span>
              </div>
              <div className="mc-info">
                {c.contact && <span><b>{c.contact}</b></span>}
                {c.phone && <a href={`tel:${c.phone}`}><Phone size={13} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`}><Mail size={13} /> {c.email}</a>}
                {c.site && <a href={/^https?:/.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noopener noreferrer"><Globe size={13} /> {c.site}</a>}
              </div>

              <div className="mc-people"><small>Team on this project</small>
                {c.people?.length ? c.people.map(p => <span key={p.name} className="mc-person"><b>{p.name}</b><em>{p.roles.map(r => ({ seo: "SEO", ads: "Ads", design: "Design" }[r] || r)).join(", ")}</em></span>) : <em>Only you</em>}
              </div>

              {seo && (
                <div className="mc-sec"><h4><Search size={14} /> SEO this month</h4>
                  <Bar label="Backlinks this month" done={d.backlinkMonth} target={t.backlink} note={d.backlinkToday ? `${d.backlinkToday} added today` : ""} />
                  <Bar label="GMB posts this month" done={d.gmbMonth} target={t.gmb} />
                  <Bar label="Blogs this month" done={d.blogMonth} target={t.blog} />
                  <div className="mc-kw"><span>{c.keywords.count} agreed keyword{c.keywords.count === 1 ? "" : "s"}</span><span className="sub">{c.keywords.lastCheck ? `Last rank check ${fd(c.keywords.lastCheck)}` : "Ranks not checked yet"}</span></div>
                </div>
              )}
              {ads && c.ads && (
                <div className="mc-sec"><h4><LineChart size={14} /> Google Ads</h4>
                  <div className="mc-row">
                    <span>Today's report</span>
                    {c.ads.today?.sent ? <span className="pill p-ok">Sent</span> : c.ads.today ? <span className="pill p-blue">Saved, not sent</span> : <span className={`pill ${hr >= 18 ? "p-red" : "p-amb"}`}>{hr >= 18 ? "Late, send by 7 pm" : "Not done yet"}</span>}
                  </div>
                  <Bar label="Spend this month" done={Math.round(c.ads.spendMonth)} target={c.budget} note={`${inr(c.ads.spendMonth)} of ${inr(c.budget)} budget · ${c.ads.leadsMonth} leads · ${c.ads.days} reports`} />
                </div>
              )}
              {ads && c.metaBudget > 0 && (
                <div className="mc-sec"><h4><LineChart size={14} /> Meta Ads</h4>
                  <div className="mc-row"><span>Budget this month</span><b>{inr(c.metaBudget)}</b></div>
                  <span className="sub">Facebook and Instagram ads for this client</span>
                </div>
              )}
              {des && (
                <div className="mc-sec"><h4><PenTool size={14} /> Design</h4>
                  <Bar label="Posters this month" done={d.posterMonth} target={t.poster} />
                </div>
              )}

              <div className="mc-act">
                <Link className="btn sm p" to="/log"><PlusCircle size={14} /> Log work</Link>
                {ads && <Link className="btn sm" to="/ads">Daily ads report</Link>}
                {seo && <Link className="btn sm" to="/ranks">Rank check</Link>}
                {des && <Link className="btn sm" to="/designs">My designs</Link>}
                <Link className="btn sm" to="/meetings"><CalendarDays size={14} /> Meeting</Link>
              </div>
            </section>
          );
        })}</div>}
    </>
  );
}
