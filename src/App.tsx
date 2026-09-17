import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import AppShell from "./components/AppShell";

export default function App() {
  return (
    <div className="film-grain min-h-screen">
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Legacy routes → single page */}
        <Route path="/new" element={<Navigate to="/" replace />} />
        <Route path="/ideas" element={<Navigate to="/" replace />} />
        {/* Deep links still work, rendered inside the old shell */}
        <Route element={<AppShell />}>
          <Route path="/project/:id" element={<ProjectWorkspace />} />
        </Route>
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
