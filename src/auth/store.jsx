/* eslint-disable react-refresh/only-export-components */
// Signed-in session and the employee's data, loaded from the backend (/api/portal).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, readAuth, writeAuth, setOnExpired } from "../api";
import { toast } from "../toast";
import { T, today, nowHM } from "../util";
import { useRise } from "../ding";
import { useLive } from "../live";

const Ctx = createContext(null);
export const usePortal = () => useContext(Ctx);

const NO_NOTIF = { list: [], unread: 0, unreadMessages: 0 };
const EMPTY = { entries: [], days: [], tasks: [], blockers: [], meetings: [], assigned: { clients: [], projects: [] } };
// The last data loaded is kept in this browser, so the portal shows it straight away and updates it in the background
const cacheKey = (s) => (s?.user?.id ? `nnc-portal-cache-${s.user.id}` : "");
const readCache = (s) => { try { const k = cacheKey(s); const j = k && JSON.parse(localStorage.getItem(k) || "null"); return j?.entries ? { ...EMPTY, ...j } : EMPTY; } catch { return EMPTY; } };
const writeCache = (s, d) => { try { const k = cacheKey(s); if (k) localStorage.setItem(k, JSON.stringify(d)); } catch { /* storage full or blocked */ } };

export function PortalProvider({ children }) {
  const [session, setSession] = useState(readAuth);
  const [data, setData] = useState(() => readCache(readAuth()));
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState(null);   // today's check in / check out

  const signIn = useCallback((s, remember = true) => { writeAuth(s, remember); setData(readCache(s)); setSession(s); }, []);
  const [notif, setNotif] = useState(NO_NOTIF);
  useRise(notif.unread, "notif");             // sound for a new notification
  useRise(notif.unreadMessages, "msg");       // and for a new message from the admin
  const signOut = useCallback(() => { writeCache(readAuth(), null); writeAuth(null); setData(EMPTY); setNotif(NO_NOTIF); setAttendance(null); setSession(null); }, []);
  useEffect(() => { setOnExpired(() => { signOut(); toast("Your session has ended. Please sign in again."); }); }, [signOut]);

  const isEmp = session?.type === "emp";

  // Load everything the employee pages show (last 70 days of work). After a change only the parts
  // that change are reloaded: the profile and the assigned projects stay as they are.
  const refresh = useCallback(async (full = false) => {
    if (!isEmp) return;
    setLoading(true);
    try {
      const [work, tasks, blockers, meetings, att, me, assigned] = await Promise.all([
        api(`/work?from=${T(-70)}&to=${today()}`), api("/tasks"), api("/blockers"), api("/meetings"),
        api(`/attendance?date=${today()}`).catch(() => null),
        full ? api("/me") : null, full ? api("/assigned") : null,
      ]);
      if (att) setAttendance(att.data);
      if (me) setSession(s => { const n = { ...s, user: me.data }; writeAuth(n, !!localStorage.getItem("nnc-portal-auth")); return n; });
      setData(d => {
        const n = { entries: work.data.work, days: work.data.days, tasks: tasks.data, blockers: blockers.data, meetings: meetings.data, assigned: assigned ? assigned.data : d.assigned };
        writeCache(readAuth(), n);
        return n;
      });
    } catch (err) { if (err.status !== 401) toast(err.message); }
    finally { setLoading(false); }
  }, [isEmp]);
  useEffect(() => { queueMicrotask(() => refresh(true)); }, [refresh, session?.token]);

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
  useLive("pm", loadNotifs);                  // a message from the admin: update the bell and badge straight away
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
    // Submitting the day also checks the employee out (the server closes today's check in)
    submitDay: (d) => run(async () => {
      const j = await api("/days", { method: "POST", body: { ...d, date: today(), at: nowHM() } });
      if (j.attendance) setAttendance(j.attendance);
      return j;
    }, "Day submitted to Harish"),
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
