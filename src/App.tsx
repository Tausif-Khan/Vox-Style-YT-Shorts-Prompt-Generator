import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import Legal from "./pages/Legal";
import Contact from "./pages/Contact";
import AppShell from "./components/AppShell";
import PaperBackdrop from "./components/PaperBackdrop";

export default function App() {
  return (
    <div className="film-grain min-h-screen">
      <PaperBackdrop />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Legacy routes → single page */}
        <Route path="/new" element={<Navigate to="/" replace />} />
        <Route path="/ideas" element={<Navigate to="/" replace />} />
        {/* Legal + contact */}
        <Route path="/legal" element={<Legal />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/dmca" element={<Legal />} />
        <Route path="/contact" element={<Contact />} />
        {/* Deep links still work, rendered inside the old shell */}
        <Route element={<AppShell />}>
          <Route path="/project/:id" element={<ProjectWorkspace />} />
        </Route>
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
