import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/auth";
import { Button } from "./ui";

const LINKS = [
  { to: "/", label: "Home", end: true, adminOnly: false },
  { to: "/new", label: "New game", end: false, adminOnly: false },
  { to: "/scoreboard", label: "Scoreboard", end: false, adminOnly: false },
  { to: "/stats", label: "Stats", end: false, adminOnly: false },
  { to: "/admin", label: "Admin", end: false, adminOnly: true },
];

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? "light",
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — theme just won't persist */
    }
    setTheme(next);
  }
  return (
    <button className="btn btn-ghost icon-btn" onClick={toggle} title="Toggle theme">
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export function Shell() {
  const { user, isAdmin, logout } = useAuth();
  const links = LINKS.filter((l) => !l.adminOnly || isAdmin);
  return (
    <div className="app">
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <span className="brand-mark">♣</span>
            <span>Tarot</span>
          </div>
          <nav className="nav-links">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="nav-spacer" />
          <ThemeToggle />
          {user && <span className="badge">{user.name}</span>}
          <Button variant="ghost" className="btn-sm" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
