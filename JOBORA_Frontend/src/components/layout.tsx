import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen, BriefcaseBusiness, ChevronDown, FileCheck2, FilePenLine,
  GraduationCap, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose,
  Settings, Sparkles, Sun, Webhook, X,
} from "lucide-react";
import { Progress } from "./ui";
import { authService, readSession } from "../services/api";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/cv", label: "Mon CV", icon: FilePenLine },
  { to: "/app/entretien", label: "Préparation entretien", icon: BookOpen },
  { to: "/app/matching", label: "Matching", icon: FileCheck2 },
  { to: "/app/lettre", label: "Lettre de motivation", icon: BriefcaseBusiness },
  { to: "/app/formations", label: "Formations", icon: GraduationCap },
  { to: "/app/portfolio", label: "Portfolio", icon: Webhook },
  { to: "/app/parametres", label: "Paramètres", icon: Settings },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [dark, setDark] = useState(false);
  const location = useLocation();
  const [journeyProgress, setJourneyProgress] = useState(() => {
    const saved = Number(sessionStorage.getItem("jobora.interview.progress"));
    return Number.isFinite(saved) ? saved : 0;
  });
  const navigate = useNavigate();
  const session = readSession();
  const current = nav.find((item) => item.to === location.pathname)?.label || "Espace candidat";
  const initials = (session?.user.name || "Utilisateur").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  useEffect(() => {
    const updateProgress = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (typeof value === "number") setJourneyProgress(value);
    };
    window.addEventListener("jobora:interview-progress", updateProgress);
    return () => window.removeEventListener("jobora:interview-progress", updateProgress);
  }, []);
  function toggleTheme() {
    setDark((value) => {
      document.documentElement.dataset.theme = value ? "light" : "dark";
      return !value;
    });
  }

  function logout() {
    authService.logout();
    window.location.replace("/");
  }

  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`sidebar ${drawer ? "drawer-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <span>AI Recruiter</span>
          <button className="icon-btn sidebar-close" onClick={() => setDrawer(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>
        <nav className="side-nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink to={to} end={end} key={to} onClick={() => setDrawer(false)} title={collapsed ? label : undefined}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="journey-card">
            <div><span>Module actif</span><strong>CV</strong></div>
            <Progress value={100} />
            <small>Créer, améliorer et valider des CV.</small>
          </div>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>
            <PanelLeftClose size={18} /><span>Réduire le menu</span>
          </button>
        </div>
      </aside>
      {drawer && <button className="drawer-scrim" onClick={() => setDrawer(false)} aria-label="Fermer le menu" />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setDrawer(true)} aria-label="Ouvrir le menu"><Menu size={21} /></button>
          <button className="offer-select" onClick={() => navigate("/app/matching")}>
            <span className="status-dot" /><span><small>Offre active</small>Développeur Full-Stack Junior</span><ChevronDown size={16} />
          </button>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Changer de thème">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <NavLink className="profile" to="/app/parametres"><span>{initials}</span><span><strong>{session?.user.name || "Utilisateur"}</strong><small>{session?.user.email || "Compte candidat"}</small></span></NavLink>
            <button className="btn btn-secondary topbar-logout" onClick={logout} title="Se déconnecter"><LogOut size={16} /><span>Déconnexion</span></button>
          </div>
        </header>
        <div className="context-bar">
          <span>Mon espace</span><span>/</span><strong>{current}</strong>
          <div className="global-progress"><span>Parcours</span><Progress value={location.pathname === "/app/entretien" ? journeyProgress : 0} label={`${location.pathname === "/app/entretien" ? journeyProgress : 0} %`} /></div>
        </div>
        <main className="main-content"><Outlet /></main>
      </div>
      <nav className="bottom-nav">
        {nav.slice(0, 4).map(({ to, label, icon: Icon, end }) => (
          <NavLink to={to} end={end} key={to}><Icon size={20} /><span>{label === "Préparation entretien" ? "Entretien" : label}</span></NavLink>
        ))}
        <button onClick={() => setDrawer(true)}><Menu size={20} /><span>Plus</span></button>
      </nav>
    </div>
  );
}
