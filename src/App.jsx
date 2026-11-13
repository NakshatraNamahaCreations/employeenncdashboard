import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { usePortal } from "./auth/store";
import { isMobileDevice } from "./device";
import { Login, Signup, ForceChange } from "./pages/auth/AuthPages";
import { EmpLayout } from "./layout/Shell";
import { MyDay, LogWork, MyTasks, MyHistory, Profile } from "./pages/emp/EmpPages";
// the less used pages load when they are first opened, so the portal starts faster
const RolePage = lazy(() => import("./pages/emp/RolePages").then(m => ({ default: m.RolePage })));
const Meetings = lazy(() => import("./pages/emp/Meetings"));
const ProjectsPage = lazy(() => import("./pages/emp/Projects").then(m => ({ default: m.ProjectsPage })));
const ProjectDetail = lazy(() => import("./pages/emp/Projects").then(m => ({ default: m.ProjectDetail })));
const Calendar = lazy(() => import("./pages/emp/Calendar"));
const Messages = lazy(() => import("./pages/emp/Messages"));
const Documents = lazy(() => import("./pages/emp/Documents"));
const MyClients = lazy(() => import("./pages/emp/MyClients"));
const TeamPlans = lazy(() => import("./pages/emp/TeamPlans"));
const Wait = ({ children }) => <Suspense fallback={<div className="empty">Loading…</div>}>{children}</Suspense>;

// Phones and tablets: the portal is only for computers
function OnlyComputer() {
  return (
    <div className="nomob">
      <div className="nomob-card">
        <img src="/nnclogo.png" alt="NNC" />
        <h1>Please use a computer</h1>
        <p>The NNC Employee Portal works only on a laptop or desktop computer. Signing in from a mobile phone or tablet is not allowed, including with "Desktop site" turned on.</p>
        <p className="nomob-s">Open <b>employee.nakshatranamahacreations.com</b> on your office computer to sign in.</p>
      </div>
    </div>
  );
}
const MOBILE = isMobileDevice();

export default function App() {
  const { session } = usePortal();
  if (MOBILE) return <OnlyComputer />;

  // Only employees sign in here; admins approve and review in the NNC CRM (Employee Portal module)
  if (!session || session.type !== "emp") {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (session.user?.mustChange) return <ForceChange />;

  return (
    <Routes>
      <Route path="/" element={<EmpLayout />}>
        <Route index element={<MyDay />} />
        <Route path="log" element={<LogWork />} />
        <Route path="tasks" element={<MyTasks />} />
        <Route path="meetings" element={<Wait><Meetings /></Wait>} />
        <Route path="calendar" element={<Wait><Calendar /></Wait>} />
        <Route path="messages" element={<Wait><Messages /></Wait>} />
        <Route path="documents" element={<Wait><Documents /></Wait>} />
        <Route path="clients" element={<Wait><MyClients /></Wait>} />
        <Route path="projects" element={<Wait><ProjectsPage /></Wait>} />
        <Route path="projects/:id" element={<Wait><ProjectDetail /></Wait>} />
        <Route path="history" element={<MyHistory />} />
        <Route path="team-plans" element={<Wait><TeamPlans /></Wait>} />
        <Route path="profile" element={<Profile />} />
        <Route path=":rolePage" element={<Wait><RolePage /></Wait>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
