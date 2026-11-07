import Linkify from "./Linkify";
import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Send, Users, Search, Hash } from "lucide-react";
import { usePortal } from "./auth/store";
import Mascot from "./Mascot";
import { api } from "./api";
import { ROLES, initials } from "./roles";
import { toast } from "./toast";
import { useRise, useNewMessage } from "./ding";
import { useLive, every, useTyping, sayTyping, typingText } from "./live";
import { Tick } from "./Tick";
import { noEmoji } from "./noEmoji";

const mine = (m) => m.mine;

// Floating team chat (bottom left): group channels for everyone and direct messages between employees.
// The admin joins the group channels from the CRM.
const roleL = (r) => (r === "admin" ? "Admin" : ROLES[r]?.l || r);
const roleC = (r) => (r === "admin" ? "#0F172A" : ROLES[r]?.c || "#64748B");
const tm = (d) => {
  const x = new Date(d), now = new Date();
  return x.toDateString() === now.toDateString() ? x.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function TeamChat() {
  const [open, setOpen] = useState(false);
  const [chans, setChans] = useState([]);
  const [unread, setUnread] = useState(0);
  const [cur, setCur] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const end = useRef(null);
  useRise(unread, "msg");
  useNewMessage(msgs, cur?.id, mine);
  const { session } = usePortal();
  const first = String(session?.user?.name || "").split(" ")[0];
  const meWho = `emp:${session?.user?.id || ""}`;
  const typingIn = useTyping((d) => (d.chat === "team" && d.who !== meWho ? { chat: d.channel, person: d.who } : null));
  const tp = cur ? typingIn(cur.id) : [];
  // Short greeting once per browser session
  const [hello, setHello] = useState(() => { try { return !sessionStorage.getItem("nnc-tc-hello"); } catch { return false; } });
  useEffect(() => {
    if (!hello) return undefined;
    try { sessionStorage.setItem("nnc-tc-hello", "1"); } catch { /* storage blocked */ }
    const t = setTimeout(() => setHello(false), 7000);
    return () => clearTimeout(t);
  }, [hello]);

  useEffect(() => {
    let live = true;
    const load = () => api("/team/channels").then(j => { if (live) { setChans(j.data); setUnread(j.unread); } }, () => {});
    load();
    const stop = every(open ? 3000 : 8000, load);
    return () => { live = false; stop(); };
  }, [open, tick]);
  useEffect(() => {
    if (!cur) return undefined;
    let live = true;
    const load = () => api(`/team/messages?channel=${encodeURIComponent(cur.id)}`).then(j => live && setMsgs(j.data), () => {});
    load();
    const stop = every(2000, load);
    return () => { live = false; stop(); };
  }, [cur, tick]);
  // a new team message anywhere I can read: reload straight away
  useLive("team", () => setTick(x => x + 1));
  useEffect(() => { const b = end.current?.parentElement; if (b) b.scrollTop = b.scrollHeight; }, [msgs.length, cur]);

  // The message shows straight away; it is swapped for the saved one when the server answers
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !cur) return;
    const tmp = { _id: `tmp-${Date.now()}`, mine: true, who: "me", name: session?.user?.name, text: t, createdAt: new Date().toISOString(), pending: true };
    setMsgs(L => [...L, tmp]); setText(""); setBusy(true);
    try {
      const j = await api("/team/messages", { method: "POST", body: { channel: cur.id, text: t } });
      setMsgs(L => L.map(m => (m._id === tmp._id ? j.data : m)));
    } catch (ex) { setMsgs(L => L.filter(m => m._id !== tmp._id)); setText(t); toast(ex.message); }
    finally { setBusy(false); }
  };
  const pick = (c) => { setMsgs([]); setCur(c); };
  const shownMsgs = msgs.filter(m => noEmoji(m.text).trim());
  // Closing always goes back to the chat list, so the chat opens fresh next time.
  // A click anywhere outside the chat closes it; Esc goes back to the list, then closes.
  const root = useRef(null);
  const close = () => { setOpen(false); setCur(null); setMsgs([]); setText(""); };
  const back = () => { setCur(null); setTick(x => x + 1); };
  const closeRef = useRef(close), backRef = useRef(back);
  useEffect(() => { closeRef.current = close; backRef.current = back; });
  const hasCur = !!cur;
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (root.current && !root.current.contains(e.target)) closeRef.current(); };
    const key = (e) => { if (e.key === "Escape") (hasCur ? backRef.current : closeRef.current)(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open, hasCur]);

  if (open && hello) setHello(false);
  const groups = chans.filter(c => c.kind === "group");
  const dms = chans.filter(c => c.kind === "dm" && (!q || `${c.name} ${roleL(c.role)}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.unread - a.unread) || (new Date(b.last?.at || 0) - new Date(a.last?.at || 0)) || a.name.localeCompare(b.name));

  return (
    <div className={`tc ${open ? "open" : ""}`} ref={root}>
      {open && (
        <div className="tc-panel" role="dialog" aria-label="Team chat">
          <div className="tc-h">
            {cur ? <button type="button" className="tc-back" onClick={back} aria-label="Back to all chats" title="Back to all chats (Esc)"><ArrowLeft size={16} /><span>All chats</span></button> : <span className="tc-hm"><Mascot size={40} /></span>}
            <div className="tc-ht">
              <b>{cur ? cur.name : "Team chat"}</b>
              <span>{cur ? (cur.kind === "group" ? "Group · everyone in it can read" : roleL(cur.role)) : "Developers, testers, designers, SEO, Ads and admin"}</span>
            </div>
            <button type="button" className="tc-ib" onClick={close} aria-label="Close chat" title="Close (click outside or Esc)"><X size={17} /></button>
          </div>

          {!cur ? (
            <div className="tc-list">
              <div className="tc-hero">
                <b>Hi {first}, what's up today?</b>
                <span>Ask a question, share an update or ping a colleague. Your admin is in the groups too.</span>
                <div className="tc-hero-n"><span><Users size={13} /> {chans.filter(c => c.kind === "dm").length + 1} people</span><span><Hash size={13} /> {groups.length} groups</span>{unread > 0 && <span className="hot">{unread} unread</span>}</div>
              </div>
              <div className="tc-sec">Groups</div>
              {groups.map(c => <ChanRow key={c.id} c={c} typing={typingText(typingIn(c.id))} onClick={() => pick(c)} />)}
              <div className="tc-sec">Direct messages</div>
              <label className="tc-search"><Search size={14} /><input type="search" placeholder="Find a colleague" value={q} onChange={e => setQ(e.target.value)} /></label>
              {dms.length ? dms.map(c => <ChanRow key={c.id} c={c} typing={typingIn(c.id).length ? "typing…" : ""} onClick={() => pick(c)} />) : <div className="tc-empty">{q ? "Nobody matches." : "No colleagues have an account yet."}</div>}
            </div>
          ) : (
            <>
              <div className="tc-body">
                {!shownMsgs.length ? <div className="tc-empty">No messages yet. Say hello.</div> : shownMsgs.map((m, i, msgs) => {
                  const first = i === 0 || msgs[i - 1].who !== m.who || new Date(m.createdAt) - new Date(msgs[i - 1].createdAt) > 600000;
                  return (
                    <div key={m._id} className={`tc-m ${m.mine ? "me" : ""} ${first ? "first" : ""}`}>
                      {!m.mine && <span className="tc-av" style={{ background: roleC(m.role), visibility: first ? "visible" : "hidden" }}>{initials(m.name)}</span>}
                      <div className="tc-bub">
                        {first && !m.mine && cur.kind === "group" && <b className="tc-who">{m.name} <span>{roleL(m.role)}</span></b>}
                        <span className="tc-txt"><Linkify text={noEmoji(m.text)} /></span>
                        <small>{tm(m.createdAt)}{m.mine && <Tick pending={m.pending} seen={m.seenBy > 0} title={m.seenBy > 0 ? (cur.kind === "group" ? `Seen by ${m.seenBy}` : "Seen") : "Sent"} />}{m.mine && cur.kind === "group" && m.seenBy > 0 && <span className="tick-n">{m.seenBy}</span>}</small>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              {tp.length > 0 && <div className="typing" aria-live="polite"><i><b /><b /><b /></i>{typingText(tp)}</div>}
              <form className="tc-f" onSubmit={send}>
                <textarea rows={1} value={text} onChange={e => { const v = noEmoji(e.target.value); setText(v); if (v) sayTyping({ chat: "team", channel: cur.id }); }} placeholder={`Message ${cur.kind === "group" ? cur.name : cur.name.split(" ")[0]}…`}
                  aria-label="Message" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
                <button className="tc-send" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}
      {!open && (hello || unread > 0) && (
        <button type="button" className="tc-say" onClick={() => setOpen(true)}>
          {unread > 0 ? <><b>{unread} new message{unread > 1 ? "s" : ""}</b><span>Tap to read</span></> : <><b>Hi {first}!</b><span>Need help? Chat with your team</span></>}
        </button>
      )}
      <button type="button" className={`tc-buddy ${open ? "on" : ""}`} onClick={() => (open ? close() : setOpen(true))} aria-label={`Team chat${unread ? `, ${unread} unread` : ""}`}>
        {open ? <span className="tc-x"><X size={22} /></span> : <Mascot size={70} happy={unread > 0} />}
        {unread > 0 && !open && <em>{unread > 99 ? "99+" : unread}</em>}
      </button>
    </div>
  );
}

function ChanRow({ c, typing, onClick }) {
  return (
    <button type="button" className={`tc-row ${c.unread ? "un" : ""}`} onClick={onClick}>
      {c.kind === "group" ? <span className="tc-av grp"><Hash size={15} /></span> : <span className="tc-av" style={{ background: roleC(c.role) }}>{initials(c.name)}</span>}
      <span className="tc-rx">
        <b>{c.name}</b>
        {typing ? <span className="row-typing">{typing}</span> : <span>{c.last ? `${c.last.name}: ${noEmoji(c.last.text)}` : c.kind === "dm" ? roleL(c.role) : "No messages yet"}</span>}
      </span>
      <span className="tc-rm">{c.last && <small>{tm(c.last.at)}</small>}{c.unread > 0 && <em>{c.unread}</em>}</span>
    </button>
  );
}
