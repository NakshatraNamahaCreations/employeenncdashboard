/* eslint-disable react-refresh/only-export-components */
// Signed-in session and the employee's data, loaded from the backend (/api/portal).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, readAuth, writeAuth, setOnExpired } from "../api";
import { toast } from "../toast";
import { T, today, nowHM } from "../util";
import { useRise } from "../ding";

const Ctx = createContext(null);
export const usePortal = () => useContext(Ctx);

const NO_NOTIF = { list: [], unread: 0, unreadMessages: 0 };
const EMPTY = { entries: [], days: [], tasks: [], blockers: [], meetings: [], assigned: { clients: [], projects: [] } };

export function PortalProvider({ children }) {
  const [session, setSession] = useState(readAuth);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState(null);   // today's check in / check out

  const signIn = useCallback((s, remember = true) => { writeAuth(s, remember); setData(EMPTY); setSession(s); }, []);
  const [notif, setNotif] = useState(NO_NOTIF);
  useRise(notif.unread, "notif");             // sound for a new notification
  useRise(notif.unreadMessages, "msg");       // and for a new message from the admin
  const signOut = useCallback(() => { writeAuth(null); setData(EMPTY); setNotif(NO_NOTIF); setAttendance(null); setSession(null); }, []);
  useEffect(() => { setOnExpired(() => { signOut(); toast("Your session has ended. Please sign in again."); }); }, [signOut]);

  const isEmp = session?.type === "emp";

  // Load everything the employee pages show (last 70 days of work)
  const refresh = useCallback(async () => {
    if (!isEmp) return;
    setLoading(true);
    try {
      const [me, work, tasks, blockers, meetings, assigned, att] = await Promise.all([
        api("/me"), api(`/work?from=${T(-70)}&to=${today()}`), api("/tasks"), api("/blockers"), api("/meetings"), api("/assigned"),
        api(`/attendance?date=${today()}`).catch(() => null),
      ]);
      if (att) setAttendance(att.data);
      setSession(s => { const n = { ...s, user: me.data }; writeAuth(n, !!localStorage.getItem("nnc-portal-auth")); return n; });
      setData({
        entries: work.data.work, days: work.data.days, tasks: tasks.data, blockers: blockers.data,
        meetings: meetings.data, assigned: assigned.data,
      });
    } catch (err) { if (err.status !== 401) toast(err.message); }
    finally { setLoading(false); }
  }, [isEmp]);
  useEffect(() => { queueMicrotask(refresh); }, [refresh, session?.token]);

  // Bell notifications and unread admin messages, checked every 15 seconds
  const loadNotifs = useCallback(() => {
    if (!isEmp) return;
    api("/notifications").then(j => setNotif(j.data), () => {});
  }, [isEmp]);
  useEffect(() => {
    queueMicrotask(loadNotifs);
    const t = setInterval(loadNotifs, 15000);
    return () => clearInterval(t);
  }, [loadNotifs, session?.token]);
  const readNotifs = useCallback(async (ids) => {
    setNotif(n => {
      const list = ids ? n.list.filter(x => !ids.includes(x._id)) : [];
      return { ...n, list, unread: list.filter(x => !x.read).length };
    });
    try { await api("/notifications/read", { method: "PUT", body: { ids } }); } catch { /* the next check retries */ }
    loadNotifs();
  }, [loadNotifs]);

  // Run a change on the server, then reload in the background (the screen does not wait for it)
  const run = useCallback(async (fn, ok) => {
    try { const r = await fn(); if (ok) toast(ok); refresh(); return r; }
    catch (err) { toast(err.message); return null; }
  }, [refresh]);

  const value = useMemo(() => ({
    session, signIn, signOut, refresh, loading, run, ...data, notif, loadNotifs, readNotifs,
    addWork: (body, ok) => run(() => api("/work", { method: "POST", body }), ok),
    removeEntry: (id) => run(() => api(`/work/${id}`, { method: "DELETE" }), "Entry deleted"),
    addTask: (t) => run(() => api("/tasks", { method: "POST", body: t }), "Task added"),
    setTaskStatus: (id, status) => run(() => api(`/tasks/${id}`, { method: "PATCH", body: { status } }), status === "done" ? "Task done" : "Task started"),
    addBlocker: (b) => run(() => api("/blockers", { method: "POST", body: { ...b, date: today() } }), "Sent to Harish"),
    resolveBlocker: (id) => run(() => api(`/blockers/${id}/resolve`, { method: "PATCH" }), "Marked as sorted"),
    submitDay: (d) => run(() => api("/days", { method: "POST", body: { ...d, date: today(), at: nowHM() } }), "Day submitted to Harish"),
    saveMeeting: async (m) => {
      try {
        const r = await api(m._id ? `/meetings/${m._id}` : "/meetings", { method: m._id ? "PUT" : "POST", body: m });
        // show the saved meeting straight away; the rest (its timesheet entry) reloads in the background
        const { images, ...slim } = r.data;
        const row = { ...slim, imgCount: (images || []).length };
        setData(d => ({ ...d, meetings: [row, ...d.meetings.filter(x => x._id !== row._id)] }));
        refresh();
        return row;
      } catch (err) { toast(err.message); return null; }
    },
    removeMeeting: (id) => run(() => api(`/meetings/${id}`, { method: "DELETE" }), "Meeting deleted"),
    updateMe: (patch) => run(() => api("/me", { method: "PUT", body: patch }), "Details saved"),
    attendance,
    // Check in / check out; the server records the time
    mark: async (action) => {
      try {
        const j = await api("/attendance", { method: "POST", body: { action, date: today() } });
        setAttendance(j.data);
        toast(action === "in" ? `Checked in at ${nowHM()}` : `Checked out at ${nowHM()}`);
        return true;
      } catch (err) { toast(err.message); return false; }
    },
  }), [session, signIn, signOut, refresh, loading, run, data, notif, loadNotifs, readNotifs, attendance]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
