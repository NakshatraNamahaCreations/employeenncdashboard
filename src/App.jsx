import { Navigate, Route, Routes } from "react-router-dom";
import { usePortal } from "./auth/store";
import { Login, Signup, ForceChange } from "./pages/auth/AuthPages";
import { EmpLayout } from "./layout/Shell";
import { MyDay, LogWork, MyTasks, MyHistory, Profile } from "./pages/emp/EmpPages";
import { RolePage } from "./pages/emp/RolePages";
import Meetings from "./pages/emp/Meetings";
import { ProjectsPage, ProjectDetail } from "./pages/emp/Projects";
import Calendar from "./pages/emp/Calendar";
import Messages from "./pages/emp/Messages";
import Documents from "./pages/emp/Documents";
import MyClients from "./pages/emp/MyClients";

export default function App() {
  const { session } = usePortal();

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
        <Route path="meetings" element={<Meetings />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="messages" element={<Messages />} />
        <Route path="documents" element={<Documents />} />
        <Route path="clients" element={<MyClients />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="history" element={<MyHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path=":rolePage" element={<RolePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
