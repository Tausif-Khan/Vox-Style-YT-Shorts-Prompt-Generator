import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import Ideas from "./pages/Ideas";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import AppShell from "./components/AppShell";

export default function App() {
  return (
    <div className="film-grain min-h-screen">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/project/:id" element={<ProjectWorkspace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
