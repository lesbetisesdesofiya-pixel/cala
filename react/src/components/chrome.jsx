import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";

// Bouton anti-double-clic : spinner + verrou pendant l'opération async.
export function BusyButton({ onAsyncClick, children, className, title }) {
  const [busy, setBusy] = useState(false);
  return (
    <button title={title} disabled={busy} onClick={async (e) => {
      if (busy) return;
      setBusy(true);
      try { await onAsyncClick(e); } finally { setBusy(false); }
    }} className={`${className || ""} ${busy ? "opacity-70" : ""}`}>
      {busy ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : children}
    </button>
  );
}

export function InitialAvatar({ prenom = "", nom = "", className = "w-10 h-10 text-sm", shape = "rounded-full" }) {
  const t = ((prenom[0] || "") + (nom[0] || "")).toUpperCase() || "?";
  return (
    <span className={`${className} ${shape} bg-primary-container text-white flex items-center justify-center font-bold shrink-0`}>
      {t}
    </span>
  );
}

export function GradeBadge({ m }) {
  if (m.sansNotes)
    return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">En attente</span>;
  if (m.type === "alerte")
    return <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-[#271900] text-[11px] font-bold">À booster</span>;
  if (m.moyenne >= 14)
    return <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-bold">{m.badge}</span>;
  return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-primary text-[11px] font-bold">{m.badge}</span>;
}

export function TopBar() {
  const { db } = useApp();
  const u = db.user;
  return (
    <div className="bg-white border-b px-4 h-16 flex items-center justify-between max-w-lg mx-auto">
      <Link to="/me" className="flex items-center gap-3">
        <InitialAvatar prenom={u.prenom} nom={u.nom} />
        <span>
          <span className="block font-bold text-primary leading-none">{u.periode}</span>
          <span className="text-xs text-slate-500">{u.lycee}</span>
        </span>
      </Link>
      <span className="w-10" />
    </div>
  );
}

export function TopBack({ titre, sous = "" }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { db, uid } = useApp();
  // Retour déterministe (pas l'historique du navigateur) :
  // feuille de route -> étape d'avant (objectif), connecté -> le dashboard,
  // déconnecté -> la landing, pendant l'installation -> l'étape précédente.
  const goBack = () => {
    if (loc.pathname === "/feuille-route") return nav("/assistant");
    if (!uid || !db) return nav("/");
    if (db.user.onboardingTermine === false) return window.history.back();
    return nav("/notes");
  };
  return (
    <div className="bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
      <button onClick={goBack} className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-low text-primary">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{sous}</div>
        <div className="font-bold text-primary">{titre}</div>
      </div>
      <span className="w-10" />
    </div>
  );
}

const TABS = [
  ["/notes", "school", "Notes"],
  ["/devoirs", "assignment", "Devoirs"],
  ["/feuille-route", "route", "Plan", true], // action centrale surélevée
  ["/livres", "menu_book", "Livres"],
  ["/budget", "account_balance_wallet", "Budget"],
  ["/me", "person", "Profil"],
];

export function BottomNav() {
  return (
    <div className="bg-white border-t flex justify-around items-stretch h-16 px-2 max-w-lg mx-auto">
      {TABS.map(([to, ic, lb, fab]) => fab ? (
        <NavLink key={to} to={to} className="relative -top-5 flex flex-col items-center shrink-0">
          {({ isActive }) => (<>
            <span className={`w-14 h-14 rounded-full bg-secondary-container text-primary flex items-center justify-center shadow-xl border-4 ${isActive ? "border-primary-container" : "border-white"}`}>
              <span className="material-symbols-outlined text-2xl fill">{ic}</span>
            </span>
            <span className="text-[11px] font-bold text-primary -mt-0.5">{lb}</span>
          </>)}
        </NavLink>
      ) : (
        <NavLink key={to} to={to} end={to === "/notes"} className={({ isActive }) => `navbtn${isActive ? " active" : ""}`}>
          <span className="material-symbols-outlined">{ic}</span>
          {lb}
        </NavLink>
      ))}
    </div>
  );
}
