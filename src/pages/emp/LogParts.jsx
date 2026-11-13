import { MoreHorizontal, CheckCircle2, Circle, Clock, Trash2, ExternalLink, Lock, Lightbulb } from "lucide-react";
import { TY, GROUPS, metaTxt } from "../../roles";
import { fileUrl } from "../../api";
import { TY_IC } from "./workIcons";
import { h1, pct, ampm } from "../../util";

// Pieces of the Log work page: how a day is completed, work types, today's timesheet, tips
const TARGET = 8, MIN = 7;

const TIPS = {
  tracking: ["Tick each tool you set up: GSC, GA4 or GTM.", "Add the link for each one so the admin can open it.", "A screenshot of the verified property or the published tag helps."],
  kwresearch: ["Say what the research was for: a page, a blog or an ad campaign.", "Attach the keyword sheet or add its link."],
  campaign: ["Pick the campaign type and the daily budget.", "Attach a screenshot of the campaign if there is no link."],
  optimise: ["Say what changed and why: bids, budget, ads or targeting.", "A before and after screenshot helps."],
  metaads: ["Pick what was done: new campaign, creative, audience or budget.", "Attach a screenshot from Ads Manager."],
  social: ["Say how many posts and for which platform.", "Add the planner link, or attach the creatives or a screen recording."],
  position: ["Say how many keywords you checked.", "Attach the rank sheet or add its link."],
  monthly: ["Pick the month the report is for.", "Attach the report or add its link."],
  backlink: ["Paste only live links you can open now.", "One line per link. Time is for all links together.", "Add the target keyword so the SEO report can match it."],
  blog: ["Log after the blog is published, with the live link.", "Add the main keyword and word count."],
  gmb: ["Paste the post link from Google Business Profile.", "One entry per post."],
  feature: ["One entry per feature or module you finished or moved forward.", "Add the commit or pull request link so the work can be checked.", "Write the module name, eg. Checkout, Login."],
  page: ["Log each page once it is on staging.", "Add the staging link."],
  build: ["Add the APK or TestFlight link and the version number."],
  deploy: ["Say what went out and where: staging or live.", "Add the link that was deployed."],
  bugfix: ["Bugs assigned by testers are fixed from My bugs, which also tells the tester.", "Use this for fixes you found yourself."],
  screen: ["Add the Figma link and the number of screens.", "Tick “Sent to the client” if it went for approval."],
  test: ["Enter how many cases passed and failed.", "Raise each failed case as a bug so a developer gets it."],
  bug: ["Pick the developer: they get a notification.", "Write clear steps to reproduce and add a screenshot or video link."],
  indexing: ["Pick the status: indexing requested, indexed or not indexed yet.", "Add each page link with the +, or attach a Search Console screenshot."],
  logo: ["Pick the stage: first concepts, revision or final files.", "Add the Drive link or attach the logo files."],
  vcard: ["Add the Drive link or attach the card design, front and back."],
  brochure: ["Say how many pages and whether it is for print or digital.", "Add the Drive or PDF link, or attach the file."],
  corpvideo: ["Add the Drive or video link, or attach the video.", "Enter the length in seconds."],
  instavideo: ["Pick the format: reel, story or feed ad.", "Add the Drive link or attach the video."],
  motion: ["Pick the kind: motion graphics, explainer video or animation.", "Add the Drive link or attach the video."],
  other: ["Use this for anything that does not fit the other types: research, calls, internal work."],
};

export function DayPanel({ hrs, items, submitted, onSubmit, onLog, extra = 0 }) {
  const steps = [
    { done: items > 0, t: "Log each piece of work", s: items ? `${items} item${items > 1 ? "s" : ""} logged` : "As you finish it, with its link" },
    { done: hrs >= MIN, t: `Reach ${MIN} to ${TARGET} hours`, s: `${h1(hrs)} of ${TARGET} hours` },
    { done: submitted, t: "Submit your day", s: submitted ? `Sent at ${ampm(submitted.at)}` : "Before you leave. It locks the day" },
  ];
  const left = Math.max(0, TARGET - hrs);
  return (
    <section className="lw-day">
      <div className="lw-day-l">
        <span className="lw-eyebrow">Today's timesheet</span>
        <div className="lw-hrs"><b>{h1(hrs - extra)}</b><span>/ {TARGET} hours{extra > 0 ? ` + ${h1(extra)} h extra` : ""}</span>
          {submitted ? <span className="pill p-ok"><Lock size={11} /> Submitted</span> : hrs >= MIN ? <span className="pill p-ok">Ready to submit</span> : <span className="pill p-amb">{h1(left)} h to go</span>}</div>
        <div className={`lw-bar ${hrs >= MIN ? "ok" : ""}`}><i style={{ width: `${pct(hrs, TARGET)}%` }} /><em style={{ left: `${(MIN / TARGET) * 100}%` }} /></div>
        <div className="row" style={{ marginTop: 14 }}>
          {!submitted && <button type="button" className="btn p" onClick={onLog}>+ Log work</button>}
          {!submitted && <button type="button" className="btn" disabled={!items} onClick={onSubmit}>Submit my day</button>}
          {submitted && <button type="button" className="btn p" onClick={onLog}>+ Log extra work</button>}
        </div>
      </div>
      <ol className="lw-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "done" : ""}>
            {s.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            <span><b>{i + 1}. {s.t}</b><small>{s.s}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TypeTiles({ types, onPick, disabled }) {
  const groups = GROUPS.map(([g, l]) => [g, l, types.filter(([, t]) => (t.g || "gen") === g)]).filter(x => x[2].length);
  return (
    <div className="lw-groups">
      {groups.map(([g, l, L]) => (
        <div key={g} className={`lw-group g-${g}`}>
          <h4 className="lw-gh"><span>{l}</span><small>{L.length}</small></h4>
          <div className="lw-types">
            {L.map(([k, t]) => {
              const Ic = TY_IC[k] || MoreHorizontal;
              return (
                <button key={k} type="button" className="lw-type" disabled={disabled && !t.go} onClick={() => onPick(k)}>
                  <span className={`lw-ti t-${k}`}><Ic size={18} /></span>
                  <span><b>{t.l}</b><small>{t.h}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const at = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");
export function TodaySheet({ list, onDelete, locked }) {
  const total = list.reduce((a, e) => a + (e.hrs || 0), 0);
  const extra = list.filter(e => e.meta?.extra).reduce((a, e) => a + (e.hrs || 0), 0);
  const canDel = (e) => !locked || e.meta?.extra;            // extra work stays editable after the day is submitted
  if (!list.length) return <div className="empty">Nothing logged yet today. Pick what you did above and save it with the link and the time it took.</div>;
  return (
    <div className="tw"><table className="lw-sheet">
      <thead><tr><th>Logged</th><th>Work</th><th>Client or project</th><th>Link</th><th style={{ textAlign: "right" }}>Hours</th><th /></tr></thead>
      <tbody>
        {list.map(e => {
          const Ic = TY_IC[e.type] || Clock;
          return (
            <tr key={e._id}>
              <td className="lw-at">{at(e.createdAt)}</td>
              <td><div className="lw-w"><span className={`lw-ti sm t-${e.type}`}><Ic size={14} /></span>
                <span><b>{e.title}</b>{e.meta?.extra && <> <span className="pill p-extra">Extra work</span></>}<small>{[TY[e.type]?.l || (e.type === "adsreport" ? "Daily ads report" : e.type), metaTxt(e)].filter(Boolean).join(" · ")}</small></span></div></td>
              <td>{e.refName || <span className="sub">Internal</span>}</td>
              <td>{e.url ? <a className="lw-link" href={e.url} target="_blank" rel="noopener noreferrer">{e.url.replace(/^https?:\/\//, "").slice(0, 34)} <ExternalLink size={11} /></a> : !e.meta?.files?.length && <span className="sub">-</span>}
                {e.meta?.files?.map(f => <a key={f.url} className="lw-link lw-file" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title={f.name}>{f.name.slice(0, 30)}</a>)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{h1(e.hrs)}</td>
              <td style={{ textAlign: "right" }}>{canDel(e) && <button type="button" className="iconbtn sm" aria-label="Delete entry" onClick={() => onDelete(e._id)}><Trash2 size={14} /></button>}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot><tr><td colSpan={4}>Total today{extra > 0 ? ` (${h1(total - extra)} h day + ${h1(extra)} h extra)` : ""}</td><td style={{ textAlign: "right" }}>{h1(total)} h</td><td /></tr></tfoot>
    </table></div>
  );
}

export function Tips({ type }) {
  const L = TIPS[type] || TIPS.other;
  return (
    <section className="card"><h3><Lightbulb size={16} color="#D97706" /> Good to know</h3>
      <ul className="lw-tips">{L.map(t => <li key={t}>{t}</li>)}
        <li>You can log work for today or any past day. Future dates cannot be picked. Work added to a day that is already submitted counts as extra work.</li></ul>
    </section>
  );
}
