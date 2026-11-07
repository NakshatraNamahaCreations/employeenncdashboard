import { useRef, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api, upload, fileUrl } from "../../api";
import { roleInfo } from "../../roles";
import { toast } from "../../toast";
import { confirmBox } from "../../confirm";
import { today, fd, fdw, ampm, greet, nowHM } from "../../util";

// The meeting's time has come (today with no time, or the time has passed): its MOM points can be added
const isOver = (m) => !!m && (m.date < today() || (m.date === today() && (!m.time || m.time <= nowHM())));
const hasPoints = (m) => !!(String(m.notes || "").trim() || m.files?.length || m.imgCount);

/* Basic minutes from typed notes: sorts lines into points, decisions, actions and questions. */
function quickMom(notes) {
  const lines = String(notes || "").split(/\r?\n/).map(l => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  const dec = /\b(decided|agreed|approved|confirmed|finali[sz]ed|go ahead|ok to|okay to|final)\b/i;
  const act = /\b(will|to send|to share|to fix|to provide|to check|to retest|to call|action|todo|to do|pending from|by (mon|tues|wednes|thurs|fri|satur|sun)day|by \d)/i;
  const nxt = /\bnext (meeting|review|call)\b/i;
  const R = { discussed: [], decisions: [], actions: [], open: [], next: "" };
  lines.forEach(l => {
    if (nxt.test(l)) { R.next = l.replace(/^next (meeting|review|call)\s*(on|is)?\s*:?\s*/i, ""); return; }
    if (l.includes("?")) { R.open.push(l); return; }
    if (dec.test(l) && !/\bwill\b/i.test(l)) { R.decisions.push(l); return; }
    if (act.test(l)) { R.actions.push(l); return; }
    R.discussed.push(l);
  });
  return R;
}
function momText(m, by) {
  const R = quickMom(m.notes), o = [];
  const sec = (h, L, num) => { if (L.length) o.push("", h, ...L.map((x, i) => (num ? `${i + 1}. ` : "• ") + x)); };
  o.push("MINUTES OF MEETING", m.title, `Date: ${fdw(m.date)}${m.time ? `, ${ampm(m.time)}` : ""} (${m.mode})`);
  if (m.refName) o.push(`Client: ${m.refName}`);
  if (m.theirs || m.ours) o.push(`Attendees: ${[m.theirs, m.ours ? `NNC: ${m.ours}` : ""].filter(Boolean).join(" | ")}`);
  sec("Points discussed", R.discussed, true); sec("Decisions", R.decisions); sec("Action items", R.actions, true); sec("To be confirmed", R.open);
  if (R.next) o.push("", `Next meeting: ${R.next}`);
  o.push("", `Prepared by ${by.name}, ${by.role}, Nakshatra Namaha Creations`);
  return o.join("\n");
}
const waTpl = (m, txt, me) => `${greet()},\n\nThank you for your time today. Here are the minutes of our meeting on ${fdw(m.date)}:\n\n${txt}\n\nPlease let us know if we have missed or misunderstood anything.\n\nRegards,\n${me}\nNakshatra Namaha Creations`;

/* Ready messages to the client: email (sent from the server with the meeting card on top) and WhatsApp */
const first = (m) => (String(m.theirs || "").split(/[,&]/)[0].trim() || "Sir/Madam");
const when = (m) => `${fdw(m.date)}${m.time ? `, ${ampm(m.time)}` : ""}`;
// the lines under "Action items" in the minutes
const actionsOf = (mom) => {
  const L = String(mom || "").split(/\r?\n/);
  const i = L.findIndex(l => /^action items$/i.test(l.trim()));
  if (i < 0) return [];
  const out = [];
  for (const l of L.slice(i + 1)) { if (!/^\s*(\d+[.)]|•)/.test(l)) break; out.push(l.trim()); }
  return out;
};
const TEMPLATES = [
  { k: "invite", l: "Meeting invite",
    sub: (m) => `Meeting invite: ${m.title}, ${when(m)}`,
    mail: (m, me) => `Dear ${first(m)},\n\nThank you for your time. This is to confirm our meeting on ${when(m)} (${m.mode}).\n\nAgenda\n• ${m.title}${m.notes ? `\n${m.notes.split(/\r?\n/).filter(Boolean).slice(0, 6).map(x => `• ${x}`).join("\n")}` : ""}\n\n${m.link ? `Please join using the button above, or this link: ${m.link}\n\n` : ""}If this time does not work for you, just reply to this email and we will find another slot.\n\nWarm regards,\n${me.name}\n${me.role}, Nakshatra Namaha Creations`,
    wa: (m, me) => `${greet()} ${first(m)},\n\nConfirming our meeting on *${when(m)}* (${m.mode}) about *${m.title}*.${m.link ? `\n\nJoin here: ${m.link}` : ""}\n\nPlease let me know if the time needs to change.\n\n${me.name}, Nakshatra Namaha Creations` },
  { k: "reminder", l: "Reminder",
    sub: (m) => `Reminder: ${m.title}, ${when(m)}`,
    mail: (m, me) => `Dear ${first(m)},\n\nA gentle reminder of our meeting on ${when(m)} (${m.mode}) about ${m.title}.\n\n${m.link ? `You can join using the button above or this link: ${m.link}\n\n` : ""}Looking forward to speaking with you.\n\nWarm regards,\n${me.name}\n${me.role}, Nakshatra Namaha Creations`,
    wa: (m, me) => `${greet()} ${first(m)}, a gentle reminder of our meeting on *${when(m)}* about *${m.title}*.${m.link ? `\nJoin: ${m.link}` : ""}\n\n${me.name}, NNC` },
  { k: "reschedule", l: "Rescheduled",
    sub: (m) => `Rescheduled: ${m.title}, now ${when(m)}`,
    mail: (m, me) => `Dear ${first(m)},\n\nOur meeting about ${m.title} has been moved to ${when(m)} (${m.mode}). The details above show the new time.\n\nSorry for any inconvenience. If the new time does not suit you, please reply and we will adjust.\n\nWarm regards,\n${me.name}\n${me.role}, Nakshatra Namaha Creations`,
    wa: (m, me) => `${greet()} ${first(m)}, our meeting about *${m.title}* is moved to *${when(m)}*.${m.link ? `\nJoin: ${m.link}` : ""}\nPlease let me know if this works for you.\n\n${me.name}, NNC` },
  { k: "mom", l: "Minutes of meeting", needMom: true,
    sub: (m) => `Minutes of meeting: ${m.title}, ${fd(m.date)}`,
    mail: (m, me, mom) => `Dear ${first(m)},\n\nThank you for meeting with us on ${fdw(m.date)}. Please find the minutes of the meeting below.\n\n${mom}\n\nKindly review and reply to this email if anything needs to be corrected or added. We will go ahead with the action items as listed.\n\nWarm regards,\n${me.name}\n${me.role}, Nakshatra Namaha Creations`,
    wa: (m, me, mom) => waTpl(m, mom, me.name) },
  { k: "followup", l: "Follow-up on action items", needMom: true,
    sub: (m) => `Follow-up: ${m.title}`,
    mail: (m, me, mom) => { const A = actionsOf(mom); return `Dear ${first(m)},\n\nFollowing up on our meeting on ${fdw(m.date)} about ${m.title}.\n\n${A.length ? `Action items\n${A.join("\n")}\n\n` : ""}Could you please share an update on the items from your side? Let us know if you need anything from us.\n\nWarm regards,\n${me.name}\n${me.role}, Nakshatra Namaha Creations`; },
    wa: (m, me, mom) => { const A = actionsOf(mom); return `${greet()} ${first(m)}, following up on our meeting on ${fdw(m.date)} about *${m.title}*.${A.length ? `\n\n${A.join("\n")}` : ""}\n\nCould you share an update from your side?\n\n${me.name}, NNC`; } },
];

const status = (m) => (!m.momTxt ? (!isOver(m) ? <span className="pill p-blue">Scheduled</span>
  : hasPoints(m) ? <span className="pill p-amb">Points added, MOM not written</span> : <span className="pill p-red">Add the MOM points</span>)
  : m.sentWa || m.sentMail ? <span className="pill p-ok">MOM sent{m.sentWa ? " · WhatsApp" : ""}{m.sentMail ? " · Email" : ""}</span>
    : <span className="pill p-blue">MOM ready, not sent</span>);

function SendLi({ l, m, onOpen }) {
  return (
    <div className="li">
      <span className={`mt-via ${l.via}`}>{l.via === "email" ? <Mail size={14} /> : <MessageCircle size={14} />}</span>
      <div className="x"><b>{m ? m.title : l.via === "email" ? "Emailed" : "Sent on WhatsApp"}</b>
        <span className="sub">{[m && (l.via === "email" ? "Email" : "WhatsApp"), l.to ? `to ${l.to}` : "", new Date(l.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })].filter(Boolean).join(" · ")}</span></div>
      {onOpen && <button type="button" className="btn sm" onClick={onOpen}>Open</button>}
    </div>
  );
}

export default function Meetings() {
  const P = usePortal();
  const u = P.session.user, roleL = roleInfo(u).l;
  const [mid, setMid] = useState("");
  const [shots, setShots] = useState([]);
  const [files, setFiles] = useState([]);          // MOM and other documents
  const [full, setFull] = useState("");            // id whose photos are loaded; only then are photos sent on save
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(0);
  const savedId = useRef("");                       // a new meeting, once saved, is updated, never created twice
  const m = mid && mid !== "new" ? P.meetings.find(x => x._id === mid) : null;
  const [mom, setMom] = useState("");
  const [wa, setWa] = useState("");
  const [mail, setMail] = useState("");
  const [to, setTo] = useState("");
  const [waTo, setWaTo] = useState("");
  const [q, setQ] = useState("");
  const [tk, setTk] = useState("invite");          // which ready message is filled in
  const [sub, setSub] = useState("");
  const [sending, setSending] = useState(false);
  const [early, setEarly] = useState("");         // meeting id opened for its MOM before its time
  const meInfo = { name: u.name, role: roleL };
  const fillT = (x, k, momT) => {
    const t = TEMPLATES.find(y => y.k === k) || TEMPLATES[0];
    setTk(t.k); setSub(t.sub(x)); setMail(t.mail(x, meInfo, momT || "")); setWa(t.wa(x, meInfo, momT || ""));
  };
  const L = [...P.meetings].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const openM = (id) => {
    const x = P.meetings.find(y => y._id === id);
    savedId.current = id; setFull("");
    setMid(id); setShots([]); setFiles(x?.files || []); setMom(x?.momTxt || "");
    // the list leaves photos out to stay fast; load them for this meeting
    api(`/meetings/${id}`).then(j => { if (savedId.current === id) { setShots(j.data.images || []); setFiles(j.data.files || []); setFull(id); } }, (e) => toast(e.message));
    setTo(x?.clientEmail || ""); setWaTo(x?.clientPhone || "");
    if (x) fillT(x, x.momTxt ? (x.sentMail ? "followup" : "mom") : x.date >= today() ? "reminder" : "invite", x.momTxt);
    window.scrollTo(0, 0);
  };
  // Photos are shrunk to fit the server limit (8 images, under 900 KB each)
  const addShots = (files) => {
    [...files].filter(f => f.type.startsWith("image/")).slice(0, 8).forEach(f => {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        setShots(s => (s.length >= 8 ? s : [...s, c.toDataURL("image/jpeg", 0.72)]));
      };
      img.src = url;
    });
  };
  const addDocs = async (list) => {
    const L = [...list];
    setUpBusy(n => n + L.length);
    for (const f of L) {
      if (f.size > 25 * 1024 * 1024) toast(`${f.name} is over 25 MB`);
      else { try { const d = await upload(f); setFiles(s => [...s, d]); } catch (ex) { toast(ex.message); } }
      setUpBusy(n => n - 1);
    }
  };
  const save = async (e, kind) => {
    e.preventDefault();
    if (busy) return;
    const form = e.target.form || e.target;
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form));
    const withMom = kind === "mom", invite = kind === "invite", points = kind === "mom" || kind === "points";
    const notes = d.notes !== undefined ? d.notes : m?.notes || "";
    if (points && !notes.trim() && !shots.length && !files.length) { toast("Write the MOM points or attach a document or photo"); return; }
    if (invite && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.cemail.trim())) { toast("Add the client's email to send the invite"); return; }
    const id = m?._id || savedId.current;
    const rec = { ...(m || {}), ...(id ? { _id: id } : {}), refName: d.ref.trim(), title: d.title.trim(), date: d.date || today(), time: d.time || "", dur: +d.dur || 1, mode: d.mode, theirs: d.theirs, ours: d.ours, notes, files, clientEmail: d.cemail.trim(), clientPhone: d.cphone.trim(), link: d.link.trim(), planned: true };
    if (!id || full === id) rec.images = shots;
    if (withMom) rec.momTxt = momText(rec, { name: u.name, role: roleL });
    setBusy(true);
    const doc = await P.saveMeeting(rec);
    setBusy(false);
    if (!doc) return;
    savedId.current = doc._id; setFull(doc._id);
    setMid(doc._id);
    setTo(rec.clientEmail); setWaTo(rec.clientPhone);
    if (invite) {
      const t = TEMPLATES[0];
      try {
        const j = await api(`/meetings/${doc._id}/email`, { method: "POST", body: { kind: "invite", to: rec.clientEmail, subject: t.sub(rec), text: t.mail(rec, meInfo) } });
        toast(j.message || "Invite emailed"); P.refresh();
      } catch (ex) { toast(`Meeting saved, but the invite was not sent: ${ex.message}`); }
      fillT(rec, "reminder");
      return;
    }
    if (withMom) { setMom(rec.momTxt); fillT(rec, "mom", rec.momTxt); toast("Minutes written from your points. Check them before sending."); }
    else if (kind === "schedule") { fillT(rec, "invite"); toast("Meeting scheduled. After the meeting, open it here and add the MOM points."); }
    else { fillT(rec, mom ? "mom" : isOver(rec) ? "invite" : "reminder", mom); toast(points ? "MOM points saved" : "Meeting details saved"); }
  };
  // Record each send (WhatsApp or email, and to whom) in the meeting's send history
  const mark = async (via) => {
    try {
      if (mom !== m.momTxt) await api(`/meetings/${m._id}`, { method: "PUT", body: { ...m, momTxt: mom } });
      await api(`/meetings/${m._id}/sent`, { method: "POST", body: { via, to: via === "email" ? to : waTo } });
      P.refresh();
    } catch (ex) { toast(ex.message); }
  };
  // the email goes from the server: to the client, a copy to the employee
  const sendMail = async () => {
    if (!m || sending) return;
    if (!to.trim()) { toast("Enter the client's email"); return; }
    setSending(true);
    try {
      if (mom !== m.momTxt) await api(`/meetings/${m._id}`, { method: "PUT", body: { ...m, momTxt: mom } });
      const j = await api(`/meetings/${m._id}/email`, { method: "POST", body: { kind: tk, to, subject: sub, text: mail } });
      toast(j.message || "Email sent"); P.refresh();
    } catch (ex) { toast(ex.message); }
    finally { setSending(false); }
  };
  const momOpen = !!m && (isOver(m) || early === m._id || !!m.momTxt || hasPoints(m));
  const del = async () => { if (await confirmBox({ title: "Delete this meeting?", text: "Its MOM points and minutes are deleted too.", ok: "Delete", danger: true })) { P.removeMeeting(m._id); setMid(""); } };
  const waNum = (() => { const d = waTo.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; })();
  const allSends = P.meetings.flatMap(x => (x.sendLog || []).map(l => ({ ...l, m: x }))).sort((a, b) => new Date(b.at) - new Date(a.at));
  const ms = today().slice(0, 7);

  const shown = L.filter(x => !q || `${x.title} ${x.refName}`.toLowerCase().includes(q.toLowerCase()));
  const list = (
    <section className="card"><h3>My meetings <small>{L.length}</small>
      <input className="r mt-q" type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search meetings" />
      <button type="button" className="btn sm p" onClick={() => { savedId.current = ""; setFull(""); setMid("new"); setShots([]); setFiles([]); setMom(""); }}>+ Schedule a meeting</button></h3>
      {shown.length ? shown.map(x => (
        <button key={x._id} type="button" className={`mcard ${mid === x._id ? "on" : ""}`} onClick={() => openM(x._id)}>
          <b style={{ display: "block", color: "var(--navy)", fontWeight: 600 }}>{x.title}</b>
          <span className="sub">{x.refName || "Internal"} · {fd(x.date)}{x.time ? `, ${ampm(x.time)}` : ""} · {x.mode}{(x.sendLog || []).length ? ` · sent ${x.sendLog.length}×` : ""}{x.files?.length ? ` · ${x.files.length} document${x.files.length > 1 ? "s" : ""}` : ""}</span>{status(x)}
        </button>
      )) : <div className="empty">{L.length ? "No meeting matches." : <>No meetings yet. Tap <b>+ Schedule a meeting</b>.</>}</div>}
    </section>
  );

  const head = (
    <>
      <h2 className="t">Meetings<span>.</span></h2>
      <p className="lead">First schedule the meeting and send the invite. After the meeting, open it and add the MOM points, documents and photos, then send the minutes of meeting (MOM) on WhatsApp and email.</p>
    </>
  );

  if (!mid) return (
    <>{head}
      <div className="kpis">
        <div className="kpi"><span className="l">Meetings this month</span><span className="v">{L.filter(x => x.date.startsWith(ms)).length}</span><span className="s">{L.length} in total</span></div>
        <div className="kpi"><span className="l">Upcoming</span><span className="v" style={{ color: "var(--pri)" }}>{L.filter(x => !isOver(x)).length}</span><span className="s">scheduled</span></div>
        <div className="kpi"><span className="l">MOM points pending</span><span className="v" style={{ color: "var(--red)" }}>{L.filter(x => isOver(x) && !x.momTxt && !hasPoints(x)).length}</span><span className="s">meeting done, add the points</span></div>
        <div className="kpi"><span className="l">MOM sent</span><span className="v" style={{ color: "var(--ok)" }}>{L.filter(x => x.sentWa || x.sentMail).length}</span><span className="s">{allSends.length} sends recorded</span></div>
      </div>
      <div className="grid2">
        <div>{list}</div>
        <div>
        <section className="card"><h3>Send history <small>WhatsApp and email</small></h3>
          {allSends.length ? allSends.slice(0, 12).map((l, i) => <SendLi key={i} l={l} m={l.m} onOpen={() => openM(l.m._id)} />) : <div className="empty">Nothing sent yet. Minutes you send on WhatsApp or email are recorded here.</div>}
        </section>
        <section className="card"><h3>How it works</h3><div className="pad">
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li><b>Schedule the meeting</b>: client, topic, date, time and link. Add the client's email to send the invite.</li>
            <li>After the meeting, open it from <b>My meetings</b> and add the <b>MOM points</b>. Short lines are fine.</li>
            <li>Attach the MOM document, photos of handwritten notes, the whiteboard or screen captures.</li>
            <li>Tap <b>Save and write the MOM</b>, check it, then send it on WhatsApp or email with the ready template.</li>
          </ol>
          <p className="sub">The meeting is added to your timesheet once its MOM points are in. Photos are saved with the meeting for reference.</p>
        </div></section>
        </div>
      </div>
    </>
  );

  return (
    <>{head}
      <div className="row" style={{ marginBottom: 12 }}><button type="button" className="btn sm" onClick={() => setMid("")}>All meetings</button></div>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card"><h3>{m ? "Meeting" : "Schedule a meeting"} {m && status(m)}</h3>
          <form className="pad" onSubmit={(e) => save(e, !m ? "schedule" : momOpen ? "mom" : "details")} key={mid}>
            <div className="mt-step"><span>1</span> Meeting details</div>
            <div className="f"><label htmlFor="m1">Client or project</label><input id="m1" name="ref" type="text" list="m1l" defaultValue={m?.refName || ""} placeholder="Internal if empty" />
              <datalist id="m1l">{[...P.assigned.clients, ...P.assigned.projects].map(r => <option key={r.id} value={r.name} />)}</datalist></div>
            <div className="f"><label htmlFor="m2">Meeting about</label><input id="m2" name="title" type="text" required defaultValue={m?.title || ""} placeholder="UAT walkthrough, design review, monthly report..." /></div>
            <div className="g3">
              <div className="f"><label htmlFor="m3">Date</label><input id="m3" name="date" type="date" required defaultValue={m?.date || today()} /></div>
              <div className="f"><label htmlFor="m4">Time</label><input id="m4" name="time" type="time" defaultValue={m?.time || ""} /></div>
              <div className="f"><label htmlFor="m5">Hours</label><input id="m5" name="dur" type="number" min="0.25" step="0.25" defaultValue={m?.dur || 1} /></div>
            </div>
            <div className="g2">
              <div className="f"><label htmlFor="m6">How</label><select id="m6" name="mode" defaultValue={m?.mode || "Google Meet"}>{["Google Meet", "In person", "Phone call", "Zoom"].map(x => <option key={x}>{x}</option>)}</select></div>
              <div className="f"><label htmlFor="m7">From the client side</label><input id="m7" name="theirs" type="text" defaultValue={m?.theirs || ""} placeholder="Names" /></div>
            </div>
            <div className="f"><label htmlFor="m8">From NNC</label><input id="m8" name="ours" type="text" defaultValue={m?.ours || u.name} /></div>
            <div className="g2">
              <div className="f"><label htmlFor="m12">Client email (invite and minutes)</label><input id="m12" name="cemail" type="email" defaultValue={m?.clientEmail || ""} placeholder="client@company.com" /></div>
              <div className="f"><label htmlFor="m13">Client WhatsApp</label><input id="m13" name="cphone" type="tel" defaultValue={m?.clientPhone || ""} placeholder="98450 12345" /></div>
            </div>
            <div className="f"><label htmlFor="m14">Meeting link</label><input id="m14" name="link" type="url" defaultValue={m?.link || ""} placeholder="https://meet.google.com/..." /></div>

            {!m && (
              <div className="row">
                <button className="btn p lg" disabled={busy}>{busy ? "Saving…" : "Schedule meeting"}</button>
                <button type="button" className="btn lg" disabled={busy} onClick={(e) => save(e, "invite")}>Schedule and email the invite</button>
              </div>
            )}

            {m && !momOpen && (
              <>
                <div className="mt-step off"><span>2</span> MOM points, after the meeting</div>
                <div className="alert am" style={{ marginBottom: 12 }}>
                  This meeting is on <b>{fdw(m.date)}{m.time ? `, ${ampm(m.time)}` : ""}</b>. Open it here after the meeting to add the MOM points and documents.
                  <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setEarly(m._id)}>The meeting is done</button>
                </div>
                <div className="row">
                  <button className="btn p lg" disabled={busy}>{busy ? "Saving…" : "Save meeting details"}</button>
                  <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={del}>Delete</button>
                </div>
              </>
            )}

            {m && momOpen && (
              <>
                <div className="mt-step"><span>2</span> MOM points, after the meeting</div>
                <div className="f"><label htmlFor="m9">MOM points</label><textarea id="m9" name="notes" rows={11} defaultValue={m?.notes || ""} placeholder="Write each point on a new line. Who said what, what was decided, who will do what and by when." /></div>
                <div className="f"><label htmlFor="m11">MOM and documents (PDF, Word, Excel, images){files.length ? ` · ${files.length} attached` : ""}</label>
                  <div className="drop">
                    <input id="m11" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={e => { addDocs(e.target.files); e.target.value = ""; }} />
                    {upBusy > 0 && <span className="sub">Uploading {upBusy}…</span>}
                    <div className="mt-docs">{files.map((f, i) => (
                      <span key={f.url} className="mt-doc"><a href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer">{f.name}</a>
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(L2 => L2.filter((_, j) => j !== i))}>×</button></span>
                    ))}</div>
                  </div>
                </div>
                <div className="f"><label htmlFor="m10">Photos of written notes, whiteboard or screenshots{shots.length ? ` · ${shots.length} attached` : m?.imgCount && full !== m._id ? ` · loading ${m.imgCount}…` : ""}</label>
                  <div className="drop">
                    <input id="m10" type="file" accept="image/*" multiple onChange={e => { addShots(e.target.files); e.target.value = ""; }} />
                    <div className="thumbs">{shots.map((s, i) => (
                      <span key={i} className="thumb"><img src={s} alt={`Attachment ${i + 1}`} /><button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => setShots(L2 => L2.filter((_, j) => j !== i))}>×</button></span>
                    ))}</div>
                  </div>
                </div>
                <div className="row">
                  <button className="btn p lg" disabled={busy || upBusy > 0}>{busy ? "Saving…" : m.momTxt ? "Save and rewrite the MOM" : "Save and write the MOM"}</button>
                  <button type="button" className="btn lg" disabled={busy || upBusy > 0} onClick={(e) => save(e, "points")}>Save points only</button>
                  <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={del}>Delete</button>
                </div>
              </>
            )}
          </form>
        </section>
        <div>
          {m && mom && (
              <section className="card"><h3>Minutes of meeting {status(m)}</h3>
                <div className="pad">
                  <div className="alert am">Laid out from your typed notes. Check names, dates and amounts before sending.</div>
                  <textarea className="mom" value={mom} onChange={e => { setMom(e.target.value); if (tk === "mom" || tk === "followup") fillT(m, tk, e.target.value); }} aria-label="Minutes of meeting" />
                  <div className="row" style={{ marginTop: 10 }}><button type="button" className="btn p" disabled={busy} onClick={async () => { setBusy(true); const r = await P.saveMeeting({ ...m, files, momTxt: mom }); setBusy(false); if (r) toast("Minutes saved"); }}>Save changes</button></div>
                </div></section>
          )}
          {m && !mom && (
            <section className="card"><h3>Minutes of meeting</h3>
              <div className="empty">{momOpen ? <>Add the MOM points on the left and tap <b>Save and write the MOM</b>. Then send the minutes with the ready email below.</> : <>After the meeting, add the MOM points here. Until then you can send the invite or a reminder below.</>}</div></section>
          )}
          {m ? (
            <>
              <section className="card"><h3>Send to the client</h3>
                <div className="pad">
                  <div className="mt-tpls" role="group" aria-label="Ready messages">
                    {TEMPLATES.map(t => <button type="button" key={t.k} className={`chip ${tk === t.k ? "on" : ""}`} disabled={t.needMom && !mom} title={t.needMom && !mom ? "Write the minutes first" : ""} onClick={() => fillT(m, t.k, mom)}>{t.l}</button>)}
                  </div>
                  <div className="f"><label htmlFor="mto">To (client email, more than one with commas)</label><input id="mto" type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="client@company.com" /></div>
                  <div className="f"><label htmlFor="msub">Subject</label><input id="msub" type="text" value={sub} onChange={e => setSub(e.target.value)} /></div>
                  <div className="f"><label htmlFor="mb">Email{m.sentMail ? ` · minutes emailed ${fd(m.sentMail)}` : ""}</label><textarea id="mb" rows={12} value={mail} onChange={e => setMail(e.target.value)} /></div>
                  <div className="row" style={{ marginBottom: 6 }}><button type="button" className="btn p" disabled={sending || !mail.trim()} onClick={sendMail}><Mail size={15} /> {sending ? "Sending…" : "Send email"}</button></div>
                  <p className="sub" style={{ marginTop: 0 }}>Sent from NNC's email with the meeting details on top{tk === "mom" || tk === "followup" ? " and your documents as links" : ""}. A copy comes to you{u.email ? ` (${u.email})` : ""}, and the client's reply comes to you.</p>
                  <div className="f" style={{ marginTop: 14 }}><label htmlFor="wa">WhatsApp message{m.sentWa ? ` · sent ${fd(m.sentWa)}` : ""}</label><textarea id="wa" className="msg" style={{ minHeight: 170 }} value={wa} onChange={e => setWa(e.target.value)} /></div>
                  <div className="row">
                    <input type="tel" className="mt-wa" value={waTo} onChange={e => setWaTo(e.target.value)} placeholder="Client WhatsApp number" aria-label="WhatsApp number" />
                    <a className="btn g" href={`https://wa.me/${waNum}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noopener noreferrer" onClick={() => mark("whatsapp")}><MessageCircle size={15} /> Send on WhatsApp</a>
                  </div>
                </div></section>
              <section className="card"><h3>Send history <small>{(m.sendLog || []).length}</small></h3>
                {(m.sendLog || []).length ? [...m.sendLog].reverse().map((l, i) => <SendLi key={i} l={l} />) : <div className="empty">Not sent yet.</div>}
              </section>
            </>
          ) : (
            <section className="card"><h3>Send to the client</h3>
              <div className="empty"><b>Step 1:</b> fill in the meeting details and tap <b>Schedule meeting</b>, or <b>Schedule and email the invite</b> to send it to the client.<br /><b>Step 2:</b> after the meeting, open it from My meetings and add the MOM points.</div></section>
          )}
        </div>
      </div>
    </>
  );
}
