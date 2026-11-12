import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sun, PlusCircle, FolderKanban, ListTodo, CalendarDays, Bug, LineChart, PenTool, Wallet, MessagesSquare, Users2, History, UserRound,
  Bell, LogOut, Menu, CheckCheck, ClipboardList, Megaphone, MessageCircle, BadgeCheck, RotateCcw, Info, LogIn, FileText,
} from "lucide-react";
import { usePortal } from "../auth/store";
import { roleInfo, initials } from "../roles";
import { today } from "../util";
import { confirmBox } from "../confirm";
import TeamChat from "../TeamChat";
import Modal from "../Modal";

const hm = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");
const mins = (L) => L.reduce((a, s) => a + ((s.out ? new Date(s.out) : new Date()) - new Date(s.in)) / 60000, 0);
const dur = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

// Check in / check out in the top bar; asks once when the portal is opened and they have not checked in today
function CheckInOut() {
  const { attendance, mark, days } = usePortal();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const L = attendance?.sessions || [];
  const open = L.find(s => !s.out);
  useEffect(() => {
    if (!attendance || L.length) return;
    const k = `nnc-asked-checkin-${today()}`;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* storage blocked */ }
    queueMicrotask(() => setAsk(true));
  }, [attendance, L.length]);
  if (!attendance) return null;
  const go = async (action) => {
    if (action === "out") {
      const sub = days.some(d => d.date === today());
      const ok = await confirmBox(sub
        ? { title: "Are you sure you want to check out?", text: "The portal closes for today after you check out. Nothing more can be logged or sent until tomorrow morning.", ok: "Yes, check out" }
        : { title: "Check out without submitting your day?", text: "You have not submitted your day yet. You can submit it from Log work before you leave. After you check out, the portal closes until tomorrow morning.", ok: "Yes, check out", danger: true });
      if (!ok) return;
    }
    setBusy(true); await mark(action); setBusy(false); setAsk(false);
  };
  const first = L[0]?.in, last = [...L].reverse().find(s => s.out)?.out;
  return (
    <>
      <span className={`cio ${open ? "on" : ""}`} title={L.length ? `Worked ${dur(mins(L))} today` : "Not checked in yet"}>
        {L.length > 0 && <span className="cio-t">In <b>{hm(first)}</b>{!open && last ? <> · Out <b>{hm(last)}</b></> : null}</span>}
        {/* one check in and one check out per day; after check out the day is closed */}
        {open
          ? <button type="button" className="btn sm" disabled={busy} onClick={() => go("out")}><LogOut size={14} /> Check out</button>
          : L.length
            ? <span className="pill p-gr">Day closed</span>
            : <button type="button" className="btn sm p" disabled={busy} onClick={() => go("in")}><LogIn size={14} /> Check in</button>}
      </span>
      {ask && (
        <Modal title="Good to see you" onClose={() => setAsk(false)}>
          <p style={{ marginTop: 0 }}>You have not checked in today. Check in now to record your start time ({hm(new Date())}).</p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn p" disabled={busy} onClick={() => go("in")}><LogIn size={15} /> Check in now</button>
            <button type="button" className="btn" onClick={() => setAsk(false)}>Later</button>
          </div>
        </Modal>
      )}
    </>
  );
}

const PAGE_IC = { ranks: LineChart, ads: LineChart, designs: PenTool, bugs: Bug, payments: Wallet };
const N_IC = { task: ClipboardList, bug: Bug, bug_fixed: BadgeCheck, bug_verified: CheckCheck, bug_reopened: RotateCcw, message: MessageCircle, announce: Megaphone, doc: FileText };
const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function Bellbox() {
  const { notif, readNotifs, loadNotifs } = usePortal();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", k);
    return () => document.removeEventListener("mousedown", k);
  }, [open]);
  // opening a notification takes you to its page and removes it from the list
  const go = (n) => { setOpen(false); readNotifs([n._id]); if (n.link) nav(n.link); };
  return (
    <div className="bell" ref={box}>
      <button type="button" className={`iconbtn ${notif.unread ? "has" : ""}`} aria-label={`Notifications${notif.unread ? `, ${notif.unread} new` : ""}`}
        onClick={() => { setOpen(o => !o); loadNotifs(); }}>
        <Bell size={18} />{notif.unread > 0 && <em>{notif.unread > 9 ? "9+" : notif.unread}</em>}
      </button>
      {open && (
        <div className="bellpop" role="dialog" aria-label="Notifications">
          <div className="bp-h"><b>Notifications</b>{notif.list.length > 0 && <button type="button" className="link" onClick={() => readNotifs()}>Clear all</button>}</div>
          <div className="bp-l">
            {notif.list.length ? notif.list.map(n => {
              const Ic = N_IC[n.kind] || Info;
              return (
                <button key={n._id} type="button" className={`bp-i ${n.read ? "" : "new"} k-${n.kind}`} onClick={() => go(n)}>
                  <span className="bp-ic"><Ic size={15} /></span>
                  <span className="bp-x"><b>{n.title}</b>{n.text && <span>{n.text}</span>}<small>{ago(n.createdAt)}</small></span>
                </button>
              );
            }) : <div className="empty">No notifications yet. Tasks, bugs and messages from the admin show here.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmpLayout() {
  const { session, tasks, meetings, notif, signOut, attendance } = usePortal();
  // checked out today: the portal is closed until tomorrow morning
  const S = attendance?.date === today() ? attendance.sessions || [] : [];
  const closedAt = S.length && !S.some(s => !s.out) ? S[S.length - 1].out : null;
  const u = session.user, R = roleInfo(u);   // all of this person's roles
  const nav = useNavigate();
  const { pathname } = useLocation();
  const dueTasks = tasks.filter(t => t.status !== "done" && t.due <= today()).length;
  const groups = [
    ["Today", [
      { to: "/", end: true, label: "My day", ic: Sun, sub: "Today's work, tasks and timesheet" },
      { to: "/log", label: "Log work", ic: PlusCircle, sub: "Log each piece of work with its link and time" },
      { to: "/calendar", label: "Calendar", ic: CalendarDays, sub: "Meetings, deliveries, testing and tasks by date" },
    ]],
    ["My work", [
      ...(R.picks.has("clients") ? [{ to: "/clients", label: R.picks.has("projects") ? "SEO & ads projects" : "My projects", ic: Users2, sub: "Your projects, this month's targets and what is done so far" }] : []),
      ...(R.picks.has("projects") ? [{ to: "/projects", label: "My projects", ic: FolderKanban, sub: "Status, documents, integrations and team for each project" }] : []),
      { to: "/tasks", label: "My tasks", ic: ListTodo, sub: "Tasks assigned to you and your own to-dos", badge: dueTasks },
      // one page for each of their roles (an SEO analyst who also runs Google Ads gets both)
      ...R.pages.map(pg => ({ to: `/${pg[0]}`, label: pg[1], ic: PAGE_IC[pg[0]] || Bug, sub: ({ ranks: "Weekly Google positions for agreed keywords", ads: "Daily numbers, search terms and the client message", designs: "Screens and creatives sent to clients", bugs: "Raise, fix and verify bugs", payments: "Invoices and payments received" })[pg[0]] })),
      { to: "/documents", label: "Documents", ic: FileText, sub: "Send and receive files with a message, like test reports for a developer" },
      { to: "/meetings", label: "Meetings and MOM", ic: Users2, sub: "Meeting notes, minutes and what was sent", badge: meetings.filter(m => !m.momTxt).length },
      { to: "/history", label: "My history", ic: History, sub: "Everything you logged, day by day" },
    ]],
    ["Team", [{ to: "/messages", label: "Messages", ic: MessagesSquare, sub: "Chat with your admin", badge: notif.unreadMessages }]],
    ["Account", [{ to: "/profile", label: "My profile", ic: UserRound, sub: "Your details and password" }]],
  ];
  const all = groups.flatMap(g => g[1]);
  const cur = all.find(t => (t.end ? pathname === t.to : pathname.startsWith(t.to))) || all[0];
  const close = () => document.body.classList.remove("navopen");
  const out = async () => {
    if (await confirmBox({ title: "Sign out?", text: "You will need your email and password to sign in again.", ok: "Sign out", danger: true })) { signOut(); nav("/login"); }
  };
  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand"><span className="mk logo"><img src="/nnclogo.png" alt="NNC" /></span><span>Employee Portal<small>Nakshatra Namaha Creations</small></span></div>
        <NavLink to="/profile" className="me" onClick={close}><span className="av" style={{ background: R.c }}>{initials(u.name)}</span><span><b>{u.name}</b><small>{R.l}</small></span></NavLink>
        {groups.map(([g, items]) => (
          <div key={g}>
            <div className="grp">{g}</div>
            <nav>{items.map(it => {
              const Ic = it.ic;
              return (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={close}>
                  <Ic size={17} /> <span>{it.label}</span>{it.badge ? <span className="bd">{it.badge}</span> : null}
                </NavLink>
              );
            })}</nav>
          </div>
        ))}
        <div className="out"><button type="button" onClick={out}><LogOut size={15} /> Sign out</button></div>
      </aside>
      <div className="navscrim" onClick={close} />
      <main className="app">
        <div className="bar">
          <button type="button" className="iconbtn menu" aria-label="Menu" onClick={() => document.body.classList.toggle("navopen")}><Menu size={18} /></button>
          <div className="bar-t"><b>{cur.label}</b><span className="s">{cur.sub}</span></div>
          <span className="r">
            <CheckInOut />
            <span className="today">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            <button type="button" className="iconbtn" aria-label="Messages" onClick={() => nav("/messages")}><MessagesSquare size={18} />{notif.unreadMessages > 0 && <em>{notif.unreadMessages}</em>}</button>
            <Bellbox />
            <NavLink to="/profile" className="av sm av-link" style={{ background: R.c }} title={`My profile · ${u.email}`} aria-label="My profile">{initials(u.name)}</NavLink>
          </span>
        </div>
        <div className="page"><div className="page-in">{closedAt ? (
          <section className="card day-closed">
            <h2 className="t">See you tomorrow<span>.</span></h2>
            <p className="lead">You checked out at <b>{hm(closedAt)}</b>. Your day is closed, so nothing can be logged or changed now. The portal opens again tomorrow morning when you check in.</p>
            <button type="button" className="btn" onClick={out}><LogOut size={15} /> Sign out</button>
          </section>
        ) : <Outlet />}</div></div>
      </main>
      {!closedAt && <TeamChat />}
    </div>
  );
}
