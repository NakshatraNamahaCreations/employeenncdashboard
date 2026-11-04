import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api } from "../../api";
import { today, fdw, h1, parse, iso, ampm } from "../../util";

// Everything dated for the employee: meetings, client calls, deliveries, project stages, testing, bugs, tasks
const KINDS = {
  meeting: ["My meeting", "#2563EB"], client: ["Client meeting", "#4F46E5"], delivery: ["Delivery", "#DC2626"], start: ["Project start", "#0D9488"],
  stage: ["Status change", "#7C3AED"], test: ["Testing", "#9333EA"], bug: ["Bug raised", "#E11D48"], fix: ["Bug fixed", "#059669"],
  release: ["Build or deploy", "#0891B2"], task: ["Task due", "#D97706"], work: ["My work", "#64748B"], submitted: ["Day submitted", "#16A34A"],
};
const GROUPS = [["all", "Everything"], ["meet", "Meetings", ["meeting", "client"]], ["proj", "Project status", ["delivery", "start", "stage", "release"]],
  ["qa", "Testing and bugs", ["test", "bug", "fix"]], ["task", "Tasks", ["task"]], ["mine", "My work", ["work", "submitted"]]];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const add = (d, n) => { const x = parse(d); x.setDate(x.getDate() + n); return iso(x); };
const monday = (d) => add(d, -((parse(d).getDay() + 6) % 7));

function range(view, anchor) {
  if (view === "week") { const a = monday(anchor); return [a, add(a, 6)]; }
  if (view === "list") return [anchor, add(anchor, 29)];
  const [y, m] = anchor.split("-").map(Number);
  const a = monday(iso(new Date(y, m - 1, 1))), b = iso(new Date(y, m, 0));
  return [a, add(b, 6 - ((parse(b).getDay() + 6) % 7))];
}

export default function Calendar() {
  const P = usePortal();
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(today());
  const [pick, setPick] = useState(today());
  const [grp, setGrp] = useState("all");
  const [st, setSt] = useState({ key: "", list: [], err: "" });
  const [from, to] = range(view, anchor);
  const key = `${from}:${to}:${P.entries.length}:${P.meetings.length}:${P.tasks.length}`;
  useEffect(() => {
    let live = true;
    api(`/calendar?from=${from}&to=${to}`).then(j => live && setSt({ key, list: j.data, err: "" }), e => live && setSt({ key, list: [], err: e.message }));
    return () => { live = false; };
  }, [from, to, key]);

  const kinds = GROUPS.find(g => g[0] === grp)[2];
  const ev = useMemo(() => (st.key === key ? st.list : []).filter(e => !kinds || kinds.includes(e.kind)), [st, key, kinds]);
  const byDay = useMemo(() => { const m = {}; ev.forEach(e => { (m[e.date] = m[e.date] || []).push(e); }); return m; }, [ev]);
  const hrs = (d) => P.entries.filter(e => e.date === d).reduce((a, e) => a + (e.hrs || 0), 0);
  const move = (k) => {
    if (view === "week") setAnchor(a => add(a, 7 * k));
    else if (view === "list") setAnchor(a => add(a, 30 * k));
    else setAnchor(a => { const [y, m] = a.split("-").map(Number); return iso(new Date(y, m - 1 + k, 1)); });
  };
  const title = view === "month" ? parse(anchor).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : `${parse(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${parse(to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  const cm = anchor.slice(0, 7);
  const days = [];
  for (let d = from; d <= to; d = add(d, 1)) days.push(d);
  const upcoming = (st.key === key ? st.list : []).filter(e => e.date >= today() && ["delivery", "meeting", "client", "task"].includes(e.kind) && !e.done).slice(0, 6);

  return (
    <>
      <div className="cal-head">
        <div><h2 className="t">Calendar<span>.</span></h2><p className="lead" style={{ margin: 0 }}>Meetings, deliveries, project status, testing and your tasks, by date.</p></div>
        <div className="cal-ctl">
          <div className="seg">{[["month", "Month"], ["week", "Week"], ["list", "List"]].map(([k, l]) => <button key={k} type="button" className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
          <button type="button" className="iconbtn" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <b className="cal-title">{title}</b>
          <button type="button" className="iconbtn" onClick={() => move(1)} aria-label="Next"><ChevronRight size={18} /></button>
          <button type="button" className="btn sm" onClick={() => { setAnchor(today()); setPick(today()); }}>Today</button>
        </div>
      </div>
      <div className="chips">{GROUPS.map(([k, l]) => <button key={k} type="button" className={`chip ${grp === k ? "on" : ""}`} onClick={() => setGrp(k)}>{l}</button>)}</div>
      {st.err && <div className="alert am">{st.err}</div>}

      <div className="cal-wrap">
        <section className="card cal-main">
          {view === "list" ? (
            <div>{days.filter(d => byDay[d]).length ? days.filter(d => byDay[d]).map(d => (
              <div key={d} className="cal-agday">
                <div className={`cal-agd ${d === today() ? "td" : ""}`}><b>{parse(d).getDate()}</b><span>{DOW[(parse(d).getDay() + 6) % 7]}</span></div>
                <div className="cal-agl">{byDay[d].map(e => <EvRow key={e.id} e={e} />)}</div>
              </div>
            )) : <div className="empty">Nothing in the next 30 days.</div>}</div>
          ) : (
            <div className={`cal-grid ${view}`}>
              {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
              {days.map(d => {
                const L = byDay[d] || [], out = view === "month" && d.slice(0, 7) !== cm, hh = hrs(d);
                const sub = (st.key === key ? st.list : []).some(e => e.kind === "submitted" && e.date === d);
                const show = view === "week" ? L.filter(e => e.kind !== "submitted") : L.filter(e => e.kind !== "submitted").slice(0, 3);
                return (
                  <button key={d} type="button" className={`cal-cell ${out ? "out" : ""} ${d === today() ? "td" : ""} ${d === pick ? "on" : ""}`} onClick={() => setPick(d)}>
                    <span className="cal-n"><b>{parse(d).getDate()}</b>{hh > 0 && <small>{h1(hh)}h</small>}{sub && <i className="cal-sub" title="Day submitted" />}</span>
                    {show.map(e => <span key={e.id} className={`cal-ev ${e.bad ? "bad" : ""}`} style={{ "--c": KINDS[e.kind]?.[1] }}>{e.time && view === "week" ? `${ampm(e.time)} ` : ""}{e.title}</span>)}
                    {view === "month" && L.filter(e => e.kind !== "submitted").length > 3 && <span className="cal-more">+{L.filter(e => e.kind !== "submitted").length - 3} more</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="cal-legend">{Object.entries(KINDS).filter(([k]) => !kinds || kinds.includes(k)).map(([k, [l, c]]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</div>
        </section>

        <div className="cal-side">
          {view !== "list" && (
            <section className="card"><h3><CalendarDays size={16} /> {fdw(pick)}{pick === today() ? <span className="pill p-blue">Today</span> : null}</h3>
              {(byDay[pick] || []).length ? byDay[pick].map(e => <EvRow key={e.id} e={e} />) : <div className="empty">Nothing on this day.</div>}
              {hrs(pick) > 0 && <div className="li"><div className="x sub">{h1(hrs(pick))} hours logged by you</div><Link className="btn sm" to="/history">History</Link></div>}
            </section>
          )}
          <section className="card"><h3>Coming up</h3>
            {upcoming.length ? upcoming.map(e => <EvRow key={e.id} e={e} withDate />) : <div className="empty">Nothing coming up in this view.</div>}
          </section>
        </div>
      </div>
    </>
  );
}

function EvRow({ e, withDate }) {
  const [l, c] = KINDS[e.kind] || ["", "#64748B"];
  return (
    <div className="li cal-row">
      <i className="cal-dot" style={{ background: c }} />
      <div className="x">
        <span className="cal-k" style={{ color: c }}>{l}{e.bad ? " · needs attention" : ""}</span>
        <b>{e.title}</b>
        <span className="sub">{[withDate && fdw(e.date), e.time && ampm(e.time), e.refName, e.text, e.by && `by ${e.by}`, e.kind === "meeting" && (e.sent ? `MOM sent ${e.sent}×` : e.mom ? "MOM not sent" : "no MOM yet")].filter(Boolean).join(" · ")}</span>
      </div>
      {e.link && <a className="btn sm" href={e.link} target="_blank" rel="noopener noreferrer">Join <ExternalLink size={12} /></a>}
      {e.kind === "meeting" && <Link className="btn sm" to="/meetings">Open</Link>}
    </div>
  );
}
