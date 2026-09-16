import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Lightbulb,
  Plus,
  Aperture,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Projects" },
  { to: "/ideas", label: "Ideas", icon: Lightbulb, hint: "Topic library" },
];

export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-700/80 bg-ink-900/60 px-4 py-7 backdrop-blur-md">
        <NavLink to="/" className="group mb-10 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30 transition group-hover:bg-amber-film/15">
            <Aperture className="h-4 w-4 text-amber-film" strokeWidth={1.75} />
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-bold tracking-[0.16em] text-bone-50">
              DOCUMENTARY
            </span>
            <span className="block text-[13px] font-bold tracking-[0.16em] text-amber-film">
              STUDIO
            </span>
          </span>
        </NavLink>

        <p className="label-xs mb-2 px-3">Workspace</p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, hint }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-ink-700/70 font-medium text-bone-50"
                    : "text-bone-300 hover:bg-ink-800/70 hover:text-bone-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-amber-film" />
                  )}
                  <Icon
                    className={`h-4 w-4 ${isActive ? "text-amber-film" : "text-bone-400 group-hover:text-bone-200"}`}
                    strokeWidth={1.75}
                  />
                  <span className="flex-1">{label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-bone-400/0 transition group-hover:text-bone-400/70">
                    {hint}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="divider-fade" />
          <div className="rounded-xl border border-ink-700/80 bg-ink-850/60 p-3.5">
            <p className="label-xs mb-1">Visual Style</p>
            <p className="text-xs font-medium text-bone-200">
              Premium Editorial Explainer
            </p>
          </div>
          <NavLink to="/new" className="btn-primary w-full">
            <Plus className="h-4 w-4" /> New Documentary
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
