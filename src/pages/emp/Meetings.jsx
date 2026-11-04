import { useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { usePortal } from "../../auth/store";
import { api } from "../../api";
import { ROLES } from "../../roles";
import { toast } from "../../toast";
import { confirmBox } from "../../confirm";
import { today, fd, fdw, ampm, greet } from "../../util";

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
const mailTpl = (m, txt, me, role) => `Dear Sir/Madam,\n\nThank you for meeting with us on ${fdw(m.date)}. Please find the minutes of the meeting below.\n\n${txt}\n\nKindly review and reply to this email if anything needs to be corrected or added. We will go ahead with the action items as listed.\n\nWarm regards,\n${me}\n${role}, Nakshatra Namaha Creations Pvt Ltd\ninfo@nakshatranamahacreations.com | nakshatranamahacreations.com`;

const status = (m) => (!m.momTxt ? <span className="pill p-amb">Notes only, MOM not written</span>
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
  const u = P.session.user, roleL = ROLES[u.role].l;
  const [mid, setMid] = useState("");
  const [shots, setShots] = useState([]);
  const m = mid && mid !== "new" ? P.meetings.find(x => x._id === mid) : null;
  const [mom, setMom] = useState("");
  const [wa, setWa] = useState("");
  const [mail, setMail] = useState("");
  const [to, setTo] = useState("");
  const [waTo, setWaTo] = useState("");
  const [q, setQ] = useState("");
  const L = [...P.meetings].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const openM = (id) => {
    const x = P.meetings.find(y => y._id === id);
    setMid(id); setShots(x?.images || []); setMom(x?.momTxt || "");
    setWa(x?.momTxt ? waTpl(x, x.momTxt, u.name) : ""); setMail(x?.momTxt ? mailTpl(x, x.momTxt, u.name, roleL) : "");
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
  const save = async (e, withMom) => {
    e.preventDefault();
    const form = e.target.form || e.target;
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form));
    if (!d.notes.trim() && !shots.length) { toast("Write some notes or attach a photo of the notes"); return; }
    const rec = { ...(m || {}), refName: d.ref.trim(), title: d.title.trim(), date: d.date || today(), time: d.time || "", dur: +d.dur || 1, mode: d.mode, theirs: d.theirs, ours: d.ours, notes: d.notes, images: shots };
    if (withMom) rec.momTxt = momText(rec, { name: u.name, role: roleL });
    const doc = await P.saveMeeting(rec);
    if (!doc) return;
    setMid(doc._id);
    if (withMom) { setMom(rec.momTxt); setWa(waTpl(rec, rec.momTxt, u.name)); setMail(mailTpl(rec, rec.momTxt, u.name, roleL)); toast("Minutes written from your notes. Check them before sending."); }
    else toast("Notes saved");
  };
  // Record each send (WhatsApp or email, and to whom) in the meeting's send history
  const mark = async (via) => {
    try {
      if (mom !== m.momTxt) await api(`/meetings/${m._id}`, { method: "PUT", body: { ...m, momTxt: mom } });
      await api(`/meetings/${m._id}/sent`, { method: "POST", body: { via, to: via === "email" ? to : waTo } });
      P.refresh();
    } catch (ex) { toast(ex.message); }
  };
  const waNum = (() => { const d = waTo.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; })();
  const allSends = P.meetings.flatMap(x => (x.sendLog || []).map(l => ({ ...l, m: x }))).sort((a, b) => new Date(b.at) - new Date(a.at));
  const ms = today().slice(0, 7);

  const shown = L.filter(x => !q || `${x.title} ${x.refName}`.toLowerCase().includes(q.toLowerCase()));
  const list = (
    <section className="card"><h3>My meetings <small>{L.length}</small>
      <input className="r mt-q" type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search meetings" />
      <button type="button" className="btn sm p" onClick={() => { setMid("new"); setShots([]); setMom(""); }}>+ New meeting</button></h3>
      {shown.length ? shown.map(x => (
        <button key={x._id} type="button" className={`mcard ${mid === x._id ? "on" : ""}`} onClick={() => openM(x._id)}>
          <b style={{ display: "block", color: "var(--navy)", fontWeight: 600 }}>{x.title}</b>
          <span className="sub">{x.refName || "Internal"} · {fd(x.date)}{x.time ? `, ${ampm(x.time)}` : ""} · {x.mode}{(x.sendLog || []).length ? ` · sent ${x.sendLog.length}×` : ""}</span>{status(x)}
        </button>
      )) : <div className="empty">{L.length ? "No meeting matches." : <>No meetings yet. Tap <b>+ New meeting</b>.</>}</div>}
    </section>
  );

  const head = (
    <>
      <h2 className="t">Meetings<span>.</span></h2>
      <p className="lead">Write your notes during or after the meeting, attach photos of written notes, the whiteboard or screenshots, and get the minutes of meeting (MOM) ready to send on WhatsApp and email.</p>
    </>
  );

  if (!mid) return (
    <>{head}
      <div className="kpis">
        <div className="kpi"><span className="l">Meetings this month</span><span className="v">{L.filter(x => x.date.startsWith(ms)).length}</span><span className="s">{L.length} in total</span></div>
        <div className="kpi"><span className="l">MOM sent</span><span className="v" style={{ color: "var(--ok)" }}>{L.filter(x => x.sentWa || x.sentMail).length}</span><span className="s">{allSends.length} sends recorded</span></div>
        <div className="kpi"><span className="l">MOM ready, not sent</span><span className="v" style={{ color: "var(--pri)" }}>{L.filter(x => x.momTxt && !x.sentWa && !x.sentMail).length}</span></div>
        <div className="kpi"><span className="l">Notes only</span><span className="v" style={{ color: "var(--amb)" }}>{L.filter(x => !x.momTxt).length}</span><span className="s">write the MOM</span></div>
      </div>
      <div className="grid2">
        <div>{list}</div>
        <div>
        <section className="card"><h3>Send history <small>WhatsApp and email</small></h3>
          {allSends.length ? allSends.slice(0, 12).map((l, i) => <SendLi key={i} l={l} m={l.m} onOpen={() => openM(l.m._id)} />) : <div className="empty">Nothing sent yet. Minutes you send on WhatsApp or email are recorded here.</div>}
        </section>
        <section className="card"><h3>How it works</h3><div className="pad">
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>Write the points as you heard them. Short lines are fine.</li>
            <li>Attach photos of handwritten notes, the whiteboard or screen captures.</li>
            <li>Tap <b>Save and write the MOM</b> to get the summary, points, decisions and action items.</li>
            <li>Check and edit, then send on WhatsApp or email with the ready template.</li>
          </ol>
          <p className="sub">Minutes are laid out from your typed notes. Photos are saved with the meeting for reference.</p>
        </div></section>
        </div>
      </div>
    </>
  );

  return (
    <>{head}
      <div className="row" style={{ marginBottom: 12 }}><button type="button" className="btn sm" onClick={() => setMid("")}>All meetings</button></div>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card"><h3>{m ? "Meeting notes" : "New meeting"}</h3>
          <form className="pad" onSubmit={(e) => save(e, true)} key={mid}>
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
            <div className="f"><label htmlFor="m9">Meeting notes</label><textarea id="m9" name="notes" rows={11} defaultValue={m?.notes || ""} placeholder="Write each point on a new line. Who said what, what was decided, who will do what and by when." /></div>
            <div className="f"><label htmlFor="m10">Photos of written notes, whiteboard or screenshots{shots.length ? ` · ${shots.length} attached` : ""}</label>
              <div className="drop">
                <input id="m10" type="file" accept="image/*" multiple onChange={e => { addShots(e.target.files); e.target.value = ""; }} />
                <div className="thumbs">{shots.map((s, i) => (
                  <span key={i} className="thumb"><img src={s} alt={`Attachment ${i + 1}`} /><button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => setShots(L2 => L2.filter((_, j) => j !== i))}>×</button></span>
                ))}</div>
              </div>
            </div>
            <div className="row">
              <button className="btn p lg">{m?.momTxt ? "Save and rewrite the MOM" : "Save and write the MOM"}</button>
              <button type="button" className="btn lg" onClick={(e) => save(e, false)}>Save notes only</button>
              {m && <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={async () => { if (await confirmBox({ title: "Delete this meeting?", text: "Its notes and minutes are deleted too.", ok: "Delete", danger: true })) { P.removeMeeting(m._id); setMid(""); } }}>Delete</button>}
            </div>
          </form>
        </section>
        <div>
          {m && mom ? (
            <>
              <section className="card"><h3>Minutes of meeting {status(m)}</h3>
                <div className="pad">
                  <div className="alert am">Laid out from your typed notes. Check names, dates and amounts before sending.</div>
                  <textarea className="mom" value={mom} onChange={e => { setMom(e.target.value); setWa(waTpl(m, e.target.value, u.name)); setMail(mailTpl(m, e.target.value, u.name, roleL)); }} aria-label="Minutes of meeting" />
                  <div className="row" style={{ marginTop: 10 }}><button type="button" className="btn p" onClick={async () => { if (await P.saveMeeting({ ...m, momTxt: mom })) toast("Minutes saved"); }}>Save changes</button></div>
                </div></section>
              <section className="card"><h3>Send the MOM</h3>
                <div className="pad">
                  <div className="f"><label htmlFor="wa">WhatsApp message{m.sentWa ? ` · sent ${fd(m.sentWa)}` : ""}</label><textarea id="wa" className="msg" style={{ minHeight: 200 }} value={wa} onChange={e => setWa(e.target.value)} /></div>
                  <div className="row" style={{ marginBottom: 18 }}>
                    <input type="tel" className="mt-wa" value={waTo} onChange={e => setWaTo(e.target.value)} placeholder="Client WhatsApp number (optional)" aria-label="WhatsApp number" />
                    <a className="btn g" href={`https://wa.me/${waNum}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noopener noreferrer" onClick={() => mark("whatsapp")}>Send on WhatsApp</a>
                  </div>
                  <div className="f"><label htmlFor="mto">To (client email)</label><input id="mto" type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com" /></div>
                  <div className="f"><label htmlFor="mb">Email{m.sentMail ? ` · emailed ${fd(m.sentMail)}` : ""}</label><textarea id="mb" rows={12} value={mail} onChange={e => setMail(e.target.value)} /></div>
                  <a className="btn p" href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Minutes of meeting: ${m.title}, ${fd(m.date)}`)}&body=${encodeURIComponent(mail)}`} onClick={() => mark("email")}>Send email</a>
                </div></section>
              <section className="card"><h3>Send history <small>{(m.sendLog || []).length}</small></h3>
                {(m.sendLog || []).length ? [...m.sendLog].reverse().map((l, i) => <SendLi key={i} l={l} />) : <div className="empty">Not sent yet.</div>}
              </section>
            </>
          ) : (
            <section className="card"><h3>Minutes of meeting</h3>
              <div className="empty">{m ? <>Notes saved. Tap <b>Save and write the MOM</b> to get the minutes.</> : "The minutes appear here after you save your notes."}</div></section>
          )}
        </div>
      </div>
    </>
  );
}
