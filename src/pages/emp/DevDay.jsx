import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortal } from "../../auth/store";
import { roleInfo, TY } from "../../roles";
import { api } from "../../api";
import { EntryLi, SubmitDay, Blocked, TaskRef } from "./EmpPages";
import { ProjectCard } from "./Projects";
import { useProjects, byLive } from "./useProjects";
import { today, T, fd, fdw, h1, pct, weekStart, greet, parse, iso, ampm } from "../../util";

// Dashboard for developers (full stack, website, backend, app): projects, fixes, meetings, calendar
const hrsOf = (L) => L.reduce((a, e) => a + (e.hrs || 0), 0);
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthGrid(ym) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, m, 0).getDate();
  return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => iso(new Date(y, m - 1, i + 1)))];
}
const shiftMonth = (ym, k) => { const [y, m] = ym.split("-").map(Number); return iso(new Date(y, m - 1 + k, 1)).slice(0, 7); };
const monthName = (ym) => parse(`${ym}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function DevDay() {
  const P = usePortal();
  const u = P.session.user, R = roleInfo(u);
  const nav = useNavigate();
  const [modal, setModal] = useState(null);
  const [ym, setYm] = useState(today().slice(0, 7));
  const [pick, setPick] = useState(today());
  const [cal, setCal] = useState({ key: "", list: [] });
  const [bugs, setBugs] = useState([]);
  const pj = useProjects();

  const calFrom = `${ym}-01`, calTo = iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0));
  const calKey = `${calFrom}:${calTo}:${P.meetings.length}`;
  useEffect(() => {
    let live = true;
    api(`/calendar?from=${calFrom}&to=${calTo}`).then(j => live && setCal({ key: calKey, list: j.data }), () => live && setCal({ key: calKey, list: [] }));
    return () => { live = false; };
  }, [calFrom, calTo, calKey]);
  useEffect(() => {
    let live = true;
    api("/bugs").then(j => live && setBugs(j.data), () => {});
    return () => { live = false; };
  }, [P.entries.length]);

  const ev = cal.key === calKey ? cal.list : [];
  const todayL = P.entries.filter(e => e.date === today());
  const h = hrsOf(todayL);
  const rec = P.days.find(d => d.date === today());
  const last = [...P.days].sort((a, b) => b.date.localeCompare(a.date))[0];
  const ws = weekStart();
  const fixes = P.entries.filter(e => e.type === "bugfix");
  const fixedToday = fixes.filter(e => e.date === today());
  const fixedWeek = fixes.filter(e => e.date >= ws);
  const openBugs = bugs.filter(b => ["open", "reopened", "progress", "info"].includes(b.meta?.status));
  const projects = P.assigned.projects;
  const live = projects.filter(p => !p.completed && p.stage !== "Project Completed");
  const meetToday = ev.filter(e => e.date === today());
  const due = P.tasks.filter(t => t.status !== "done" && t.due <= today());
  const bl = P.blockers.filter(b => !b.resolved);

  const pickL = P.entries.filter(e => e.date === pick);
  const pickEv = ev.filter(e => e.date === pick);
  const pickRec = P.days.find(d => d.date === pick);

  return (
    <>
      <h2 className="t">{greet()}, {u.name.split(" ")[0]}<span>.</span></h2>
      <p className="lead">{fdw(today())} · {R.l}{P.loading ? " · loading…" : ""}</p>
      {rec && <div className="alert ok"><b>Day submitted at {rec.at}.</b> {h1(h)} hours and {todayL.length} items sent to Harish. Today's entries are now locked.</div>}
      {bl.map(b => (
        <div key={b._id} className="alert am"><b>You flagged a blocker:</b> {b.text}{b.refName ? ` (${b.refName})` : ""}
          <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => P.resolveBlocker(b._id)}>It's sorted now</button></div>
      ))}

      <div className="kpis">
        <div className="kpi"><span className="l">Hours today</span><span className="v">{h1(h)} <small style={{ fontSize: 14, color: "var(--mut)", fontWeight: 400 }}>of 8</small></span>
          <div className={`bar7 ${h >= 7 ? "ok" : ""}`} style={{ marginTop: 6 }}><i style={{ width: `${pct(h, 8)}%` }} /></div></div>
        <div className="kpi"><span className="l">Issues fixed</span><span className="v" style={{ color: "var(--ok)" }}>{fixedToday.length}</span><span className="s">today · {fixedWeek.length} this week</span></div>
        <div className="kpi"><span className="l">Open bugs on me</span><span className="v" style={{ color: openBugs.length ? "var(--red)" : undefined }}>{openBugs.length}</span><span className="s">{openBugs.filter(b => b.meta?.sev === "High").length} high priority</span></div>
        <div className="kpi"><span className="l">Active projects</span><span className="v">{live.length}</span><span className="s">{projects.length} assigned in the CRM</span></div>
        <div className="kpi"><span className="l">Last submission</span><span className="v" style={{ fontSize: 18 }}>{last ? (last.date === today() ? "Today" : fd(last.date)) : "-"}</span>
          <span className="s">{last ? `at ${last.at}` : "no day submitted yet"}</span></div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button type="button" className="btn p lg" onClick={() => nav("/log")}>+ Log work</button>
        {!rec && <button type="button" className="btn lg" onClick={() => setModal("submit")}>Submit my day</button>}
        <button type="button" className="btn w lg" onClick={() => setModal("block")}>I'm blocked</button>
        <Link className="btn lg" to="/meetings">+ Meeting notes</Link>
      </div>

      <div className="pj-headrow"><h3>My projects</h3><span className="sub">{live.length} active · status from the CRM</span><Link className="btn sm" to="/projects">All projects</Link></div>
      {pj.data == null ? <div className="card"><div className="empty">Loading…</div></div> : pj.data.length ? (
        <div className="pj-grid" style={{ marginBottom: 16 }}>{byLive(pj.data).slice(0, 6).map(p => <ProjectCard key={p.id} p={p} />)}</div>
      ) : <div className="card"><div className="empty">No projects assigned yet. Your manager adds you to a project's developers in the CRM.</div></div>}

      <div className="grid2">
        <div>
          <section className="card"><h3>Today's work <small>{h1(h)} hours · {todayL.length} items</small></h3>
            {todayL.length ? todayL.map(e => <EntryLi key={e._id} e={e} onDelete={rec ? null : P.removeEntry} />)
              : <div className="empty">Nothing logged yet today. Tap <b>+ Log work</b> after each piece of work.</div>}
          </section>
          <section className="card"><h3>Issues fixed <small>this week</small> <Link className="btn sm r" to="/bugs">My bugs</Link></h3>
            {fixedWeek.length ? fixedWeek.map(e => <EntryLi key={e._id} e={e} />) : <div className="empty">No fixes logged this week.</div>}
            {openBugs.length > 0 && (
              <>
                <div className="li dv-subhead"><span className="x">Still open, assigned to you</span></div>
                {openBugs.slice(0, 6).map(b => (
                  <div key={b._id} className="li"><div className="x"><span className="tag">{b.meta?.bug}</span><b>{b.title}</b>
                    <span className="sub">{[b.refName, b.meta?.sev, b.account?.name ? `from ${b.account.name}` : ""].filter(Boolean).join(" · ")}</span></div>
                    {b.meta?.status === "reopened" ? <span className="pill p-red">Reopened</span> : b.meta?.status === "progress" ? <span className="pill p-amb">In progress</span> : b.meta?.status === "info" ? <span className="pill p-amb">Needs info</span> : <span className="pill p-amb">Open</span>}</div>
                ))}
              </>
            )}
          </section>
        </div>
        <div>
          <section className="card"><h3>Meetings today <small>{meetToday.length}</small></h3>
            {meetToday.length ? meetToday.map(m => <MeetLi key={`${m.src}${m.id}`} m={m} />) : <div className="empty">No meetings today.</div>}
          </section>
          <section className="card"><h3>Tasks due <Link className="btn sm r" to="/tasks">All tasks</Link></h3>
            {due.length ? due.map(t => (
              <div key={t._id} className="li"><div className="x"><b>{t.title}</b><span className="sub"><TaskRef t={t} empty="No project" /> · due {t.due === today() ? "today" : fd(t.due)}</span></div>
                {t.due < today() && <span className="pill p-red">Overdue</span>}
                <button type="button" className="btn sm p" onClick={() => P.setTaskStatus(t._id, "done")}>Done</button></div>
            )) : <div className="empty">No tasks due.</div>}
          </section>
          <section className="card"><h3>Last submission</h3>
            {last ? (
              <div className="pad">
                <b style={{ color: "var(--navy)" }}>{fdw(last.date)} at {last.at}</b>
                <span className="sub">{h1(hrsOf(P.entries.filter(e => e.date === last.date)))} hours · {P.entries.filter(e => e.date === last.date).length} items</span>
                {last.note && <p className="sub" style={{ marginBottom: 0 }}>Note: {last.note}</p>}
                {last.plan && <p className="sub" style={{ marginBottom: 0 }}>Plan: {last.plan}</p>}
              </div>
            ) : <div className="empty">You have not submitted a day yet.</div>}
          </section>
        </div>
      </div>

      <section className="card"><h3>Calendar
        <span className="row r" style={{ gap: 6 }}>
          <button type="button" className="btn sm" onClick={() => setYm(k => shiftMonth(k, -1))} aria-label="Previous month">‹</button>
          <b style={{ minWidth: 130, textAlign: "center" }}>{monthName(ym)}</b>
          <button type="button" className="btn sm" onClick={() => setYm(k => shiftMonth(k, 1))} aria-label="Next month">›</button>
          <button type="button" className="btn sm" onClick={() => { setYm(today().slice(0, 7)); setPick(today()); }}>Today</button>
        </span></h3>
        <div className="dv-cal">
          <div className="dv-grid">
            {DOW.map(d => <div key={d} className="dv-dow">{d}</div>)}
            {monthGrid(ym).map((d, i) => {
              if (!d) return <div key={`x${i}`} />;
              const L = P.entries.filter(e => e.date === d), hh = hrsOf(L), m = ev.filter(e => e.date === d).length;
              const sub = P.days.some(x => x.date === d), fut = d > today(), sun = parse(d).getDay() === 0;
              const st = sub ? "ok" : fut || sun ? "" : d === today() ? "open" : d >= T(-70) ? "miss" : "";
              return (
                <button key={d} type="button" className={`dv-day ${st} ${d === today() ? "td" : ""} ${d === pick ? "on" : ""}`} onClick={() => setPick(d)}>
                  <span className="n">{+d.slice(8)}</span>
                  {hh > 0 && <span className="h">{h1(hh)}h</span>}
                  {m > 0 && <span className="m">{m} meeting{m > 1 ? "s" : ""}</span>}
                </button>
              );
            })}
          </div>
          <div className="dv-legend"><span><i className="ok" /> Submitted</span><span><i className="miss" /> Not submitted</span><span><i className="open" /> Today</span></div>
          <div className="dv-pick">
            <h4>{fdw(pick)} {pickRec ? <span className="pill p-ok">Submitted {pickRec.at}</span> : pick < today() && parse(pick).getDay() !== 0 ? <span className="pill p-red">Not submitted</span> : null}</h4>
            {pickEv.map(m => <MeetLi key={`${m.src}${m.id}`} m={m} />)}
            {pickL.map(e => <EntryLi key={e._id} e={e} />)}
            {!pickEv.length && !pickL.length && <div className="empty" style={{ padding: 18 }}>Nothing on this day.</div>}
            {pickRec && (pickRec.note || pickRec.plan) && <div className="li"><div className="x sub">{pickRec.note ? `Note: ${pickRec.note}` : ""}{pickRec.plan ? ` · Plan: ${pickRec.plan}` : ""}</div></div>}
          </div>
        </div>
      </section>

      {modal === "submit" && <SubmitDay h={h} n={todayL.length} due={due} onClose={() => setModal(null)} onSubmit={async (d) => { await P.submitDay(d); setModal(null); }} />}
      {modal === "block" && <Blocked refs={projects} onClose={() => setModal(null)} onSubmit={async (b) => { await P.addBlocker(b); setModal(null); }} />}
    </>
  );
}

function MeetLi({ m }) {
  return (
    <div className="li">
      <div className="x"><span className="tag">{m.src === "crm" ? "Client meeting" : TY.meeting.l.split(" ")[0]}</span><b>{m.title}</b>
        <span className="sub">{[m.time ? ampm(m.time) : "All day", m.refName, m.mode].filter(Boolean).join(" · ")}</span>
        {m.link && <a className="url" href={m.link} target="_blank" rel="noopener noreferrer">{m.link.replace(/^https?:\/\//, "")}</a>}</div>
      {m.src === "portal" && (m.mom ? <span className="pill p-ok">MOM written</span> : <Link className="btn sm" to="/meetings">Write MOM</Link>)}
    </div>
  );
}
