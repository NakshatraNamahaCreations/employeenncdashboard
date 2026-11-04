import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sun, PlusCircle, FolderKanban, ListTodo, CalendarDays, Bug, LineChart, PenTool, Wallet, MessagesSquare, Users2, History, UserRound,
  Bell, LogOut, Menu, CheckCheck, ClipboardList, Megaphone, MessageCircle, BadgeCheck, RotateCcw, Info,
} from "lucide-react";
import { usePortal } from "../auth/store";
import { ROLES, initials } from "../roles";
import { today } from "../util";
import { confirmBox } from "../confirm";
import TeamChat from "../TeamChat";

const PAGE_IC = { ranks: LineChart, ads: LineChart, designs: PenTool, bugs: Bug, payments: Wallet };
const N_IC = { task: ClipboardList, bug: Bug, bug_fixed: BadgeCheck, bug_verified: CheckCheck, bug_reopened: RotateCcw, message: MessageCircle, announce: Megaphone };
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
  const { session, tasks, meetings, notif, signOut } = usePortal();
  const u = session.user, R = ROLES[u.role];
  const nav = useNavigate();
  const { pathname } = useLocation();
  const dueTasks = tasks.filter(t => t.status !== "done" && t.due <= today()).length;
  const PIc = PAGE_IC[R.page[0]] || Bug;
  const groups = [
    ["Today", [
      { to: "/", end: true, label: "My day", ic: Sun, sub: "Today's work, tasks and timesheet" },
      { to: "/log", label: "Log work", ic: PlusCircle, sub: "Log each piece of work with its link and time" },
      { to: "/calendar", label: "Calendar", ic: CalendarDays, sub: "Meetings, deliveries, testing and tasks by date" },
    ]],
    ["My work", [
      ...(R.pick === "projects" ? [{ to: "/projects", label: "My projects", ic: FolderKanban, sub: "Status, documents, integrations and team for each project" }] : []),
      { to: "/tasks", label: "My tasks", ic: ListTodo, sub: "Tasks assigned to you and your own to-dos", badge: dueTasks },
      { to: `/${R.page[0]}`, label: R.page[1], ic: PIc, sub: ({ ranks: "Weekly Google positions for agreed keywords", ads: "Daily numbers, search terms and the client message", designs: "Screens and creatives sent to clients", bugs: "Raise, fix and verify bugs", payments: "Invoices and payments received" })[R.page[0]] },
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
        <div className="brand"><span className="mk">NNC</span><span>Employee Portal<small>Nakshatra Namaha Creations</small></span></div>
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
            <span className="today">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            <button type="button" className="iconbtn" aria-label="Messages" onClick={() => nav("/messages")}><MessagesSquare size={18} />{notif.unreadMessages > 0 && <em>{notif.unreadMessages}</em>}</button>
            <Bellbox />
            <span className="av sm" style={{ background: R.c }} title={u.email}>{initials(u.name)}</span>
          </span>
        </div>
        <div className="page"><div className="page-in"><Outlet /></div></div>
      </main>
      <TeamChat />
    </div>
  );
}
