import { useEffect, useState } from "react";
import { usePortal } from "../../auth/store";
import { api } from "../../api";

// Projects assigned to the employee, reloaded when they log work
export function useProjects() {
  const [st, setSt] = useState({ data: null, err: "" });
  const { entries } = usePortal();
  useEffect(() => {
    let live = true;
    api("/projects").then(j => live && setSt({ data: j.data, err: "" }), e => live && setSt({ data: [], err: e.message }));
    return () => { live = false; };
  }, [entries.length]);
  return st;
}

export const isDone = (p) => p.completed || p.stage === "Project Completed";
// Active projects first, completed ones after
export const byLive = (L) => [...L].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
