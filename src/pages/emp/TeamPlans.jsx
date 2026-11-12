import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, Circle, Send, Users2, ListChecks, UserX, FileText } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api, fileUrl } from "../../api";
import { ROLES, initials } from "../../roles";
import { toast } from "../../toast";
import Linkify from "../../Linkify";
import { FilePick } from "../../FilePick";
import { today, fdw } from "../../util";

// Team plans: for the plans lead the admin picked in the CRM. Everyone's plans for the day,
// who has not added one, and the report sent to the admin (the admin sees it in the CRM).
const tm = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const roleL = (r) => ROLES[r]?.l || r || "";

export default function TeamPlans() {
  const P = usePortal();
  const lead = !!P.session.user.planLead;
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/plans/team?date=${date}`).then(j => setData(j.data), e => { toast(e.message); setData({ plans: [], missing: [], sent: [] }); }), [date]);
  useEffect(() => {
    if (!lead) return undefined;
    queueMicrotask(load);
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, lead]);
  if (!lead) return <Navigate to="/" replace />;

  const plans = data?.plans || [], missing = data?.missing || [], sent = data?.sent || [];
  const items = plans.flatMap(p => p.items), done = items.filter(i => i.done).length;
  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/plans/report", { method: "POST", body: { date, note, files } });
      toast("Report sent to the admin");
      setNote(""); setFiles([]); load();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="tpl-head">
        <div>
          <h2 className="t">Team plans<span>.</span></h2>
          <p className="lead">Everyone's plans for {date === today() ? "today" : fdw(date)}. Check them, then send the report to the admin.</p>
        </div>
        <label className="tpl-date">Day <input type="date" value={date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} /></label>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="l"><Users2 size={14} /> With a plan</span><span className="v">{plans.length}</span></div>
        <div className="kpi"><span className="l"><ListChecks size={14} /> Plans</span><span className="v">{items.length}</span><span className="s">{done} done</span></div>
        <div className="kpi"><span className="l"><UserX size={14} /> No plan yet</span><span className="v" style={{ color: missing.length ? "var(--amb)" : undefined }}>{missing.length}</span></div>
        <div className="kpi"><span className="l"><Send size={14} /> Reports sent</span><span className="v">{sent.length}</span><span className="s">{sent[0] ? `last at ${tm(sent[0].createdAt)}` : "none yet"}</span></div>
      </div>

      <div className="tpl-grid">
        <div>
          {data == null ? <section className="card"><div className="empty">Loading…</div></section> : plans.length ? (
            <div className="tpl-cards">
              {plans.map(p => {
                const n = p.items.filter(i => i.done).length;
                return (
                  <section key={p.id} className="card tpl-card">
                    <div className="tpl-card-h">
                      <span className="av" style={{ background: ROLES[p.role]?.c || "#64748B" }}>{initials(p.name)}</span>
                      <span className="tpl-who"><b>{p.name}</b><small>{roleL(p.role)}{p.branch ? ` · ${p.branch}` : ""}</small></span>
                      <span className={`pill ${n === p.items.length ? "p-ok" : "p-other"}`}>{n} of {p.items.length}</span>
                    </div>
                    <div className="tpl-bar"><i style={{ width: `${Math.round((n / p.items.length) * 100)}%` }} /></div>
                    <ul>
                      {p.items.map((i, k) => (
                        <li key={k} className={i.done ? "done" : ""}>
                          {i.done ? <CheckCircle2 size={16} color="#16a34a" /> : <Circle size={16} color="#94a3b8" />}
                          <span><Linkify text={i.text} />{i.refName && <small>{i.refName}</small>}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : <section className="card"><div className="empty">Nobody has added a plan for this day yet.</div></section>}
          {missing.length > 0 && (
            <section className="card"><h3>No plan yet <small>{missing.length}</small></h3>
              <div className="tpl-miss">{missing.map(m => <span key={m.id} title={roleL(m.role)}>{m.name}</span>)}</div></section>
          )}
        </div>

        <aside className="tpl-side">
          <section className="card tpl-send">
            <h3><Send size={16} /> Send to the admin</h3>
            <div className="pad">
              <p className="sub" style={{ marginTop: 0 }}>The report has everyone's plans as they are right now ({plans.length} people, {items.length} plans{missing.length ? `, ${missing.length} without a plan` : ""}), with your note and files.</p>
              <div className="f"><label htmlFor="tpl-n">Note for the admin</label>
                <textarea id="tpl-n" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the admin should know about today's plans" /></div>
              <div className="f"><label>Overall document (optional)</label>
                <FilePick id="tpl-f" files={files} onChange={setFiles} hint="Attach the overall plan sheet or document, or paste a screenshot" /></div>
              <button type="button" className="btn p lg tpl-btn" disabled={busy} onClick={send}><Send size={15} /> {busy ? "Sending…" : "Send report to the admin"}</button>
            </div>
          </section>
          <section className="card"><h3>Sent {date === today() ? "today" : "that day"} <small>{sent.length}</small></h3>
            {sent.length ? sent.map(r => (
              <div key={r._id} className="li"><div className="x">
                <b>{tm(r.createdAt)} · {r.plans.length} people, {r.plans.reduce((a, p) => a + p.items.length, 0)} plans</b>
                {r.note && <span className="sub">{r.note}</span>}
                {r.files?.length > 0 && <span className="lw-files">{r.files.map(f => <a key={f.url} className="lw-file" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"><FileText size={11} /> {f.name}</a>)}</span>}
              </div></div>
            )) : <div className="empty">Nothing sent yet.</div>}
          </section>
        </aside>
      </div>
    </>
  );
}
