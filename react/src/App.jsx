import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./lib/store";
import { sb } from "./lib/supabase";
import { initAnalytics, capturePageview, identify, resetIdentity } from "./lib/analytics";
import { TopBar, TopBack, BottomNav } from "./components/chrome";
import { NetBar, PwaBanner, TikTokBar } from "./components/system";
import Notes from "./screens/Notes";
import Me from "./screens/Me";
import Devoirs from "./screens/Devoirs";
import Budget from "./screens/Budget";
import Evolution from "./screens/Evolution";
import Objectifs from "./screens/Objectifs";
import Assistant from "./screens/Assistant";
import Feuille from "./screens/Feuille";
import { Login, Register, Pin, PinChoice, Lock } from "./screens/Auth";
import { Paywall, Callback, Premium } from "./screens/Paywall";
import Legal from "./screens/Legal";
import Landing from "./screens/Landing";
import AddNote from "./screens/AddNote";
import AddDevoir from "./screens/AddDevoir";
import AddTransaction from "./screens/AddTransaction";
import Matiere from "./screens/Matiere";
import { Affiliation, AffLogin, AffRegister, AffDashboard } from "./screens/Affiliation";
import { Admin, AdminLogin } from "./screens/Admin";
import Essai from "./screens/Essai";
import Livres from "./screens/Livres";
import Lecteur from "./screens/Lecteur";

const PAYANT = new Set([
  "/notes", "/objectifs", "/devoirs", "/budget", "/evolution",
  "/add-note", "/add-devoir", "/add-transaction",
  "/livres",
]);
// Onboarding inachevé : seul le parcours d'installation reste accessible.
// Tout le reste (y compris feuille de route et paywall) renvoie à l'onboarding.
const ONB_ALLOW = new Set([
  "/login", "/register", "/assistant", "/matiere",
  "/legal", "/pin", "/pin-choice", "/lock",
  "/affiliation", "/affiliation/login", "/affiliation/register", "/affiliation/dashboard",
  "/admin", "/admin/login",
  "/essai",
]);
const FREE_SANS_ABO = new Set([
  "/login", "/register", "/assistant", "/feuille-route",
  "/paywall", "/callback", "/legal", "/pin", "/pin-choice", "/lock", "/matiere",
  "/me", "/profil", // profil toujours accessible, abonné ou pas
  "/affiliation", "/affiliation/login", "/affiliation/register", "/affiliation/dashboard",
  "/admin", "/admin/login",
  "/essai",
]);
// Sans abonnement (onboarding terminé) : parcours objectif/feuille locale + paywall.
// Tout le reste renvoie vers la feuille de route.
const BACK_TITLES = {
  "/objectifs": ["Simulateur", "Et si…"],
  "/livres": ["Bibliothèque", "Tes livres"],
  "/devoirs": ["Mes Devoirs", "Agenda"],
  "/budget": ["Mon Budget", "FCFA"],
  "/premium": ["Pass Premium", "Yas & Moov • sans engagement"],
  "/add-note": ["Ajouter une Note", "Saisie"],
  "/add-devoir": ["Programmer un Devoir", "Échéance"],
  "/add-transaction": ["Ajouter une Transaction", "Budget"],
  "/register": ["Créer ton compte", "Inscription"],
  "/assistant": ["Ton plan en 1 minute", "Installation"],
  "/pin": ["Sécurité", "Code PIN"],
  "/pin-choice": ["Sécurité", "Protéger l'entrée"],
  "/evolution": ["Mon Évolution", "Progression"],
  "/login": ["Bienvenue", "Connexion"],
  "/lock": ["Verrouillé", "Code PIN"],
  "/paywall": ["Abonnement", "Yas & Moov • sans engagement"],
  "/matiere": ["Matière", "Configuration"],
  "/feuille-route": ["Ton Plan de Réussite", "Feuille de route"],
  "/callback": ["Paiement", "Confirmation"],
  "/legal": ["Infos légales", "ClassiNote"],
  "/affiliation": ["Affiliation", "Parrainage"],
  "/affiliation/login": ["Affiliation", "Connexion"],
  "/affiliation/register": ["Affiliation", "Inscription"],
  "/affiliation/dashboard": ["Espace affilié", "Tableau de bord"],
  "/admin": ["Administration", "Réservé"],
  "/admin/login": ["Administration", "Connexion"],
  "/essai": ["Essai gratuit", "Ton plan sans compte"],
};

function Guard({ children }) {
  const { db, loading, uid, isUnlocked, abonnementActif } = useApp();
  const loc = useLocation();
  const [lockChecked, setLockChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [onlyFeuille, setOnlyFeuille] = useState(false);
  const path = loc.pathname;

  useEffect(() => {
    let stop = false;
    (async () => {
      setLockChecked(false);
      setAllowed(false);
      setOnlyFeuille(false);
      if (loading) return;
      if (["/login", "/register"].includes(path)) { if (!stop) { setAllowed(true); setLockChecked(true); } return; }
      if (!uid || !db) return; // le shell redirige vers /login
      if (db.user.hasPin && !isUnlocked && path !== "/lock") return; // shell redirige
      if (FREE_SANS_ABO.has(path)) { if (!stop) { setAllowed(true); setLockChecked(true); } return; }
      // Écran payant (ou inconnu) : abonnement requis, sinon feuille de route uniquement.
      if (navigator.onLine && !(await abonnementActif())) {
        if (!stop) { setOnlyFeuille(true); setLockChecked(true); }
        return;
      }
      if (!stop) { setAllowed(true); setLockChecked(true); }
    })();
    return () => { stop = true; };
  }, [path, loading, uid, db, isUnlocked, abonnementActif]);

  if (loading || !lockChecked) {
    return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  }
  if (["/login", "/register"].includes(path)) return allowed ? children : null;
  if (!uid || !db) return <Navigate to="/login" replace />;
  if (db.user.hasPin && !isUnlocked && path !== "/lock") return <Navigate to="/lock" replace />;
  // Onboarding inachevé (=== false strict : les snapshots/lignes pré-migration sans
  // le flag ne bloquent personne) -> retour à l'onboarding, pas à la feuille de route.
  if (db.user.onboardingTermine === false && !ONB_ALLOW.has(path)) return <Navigate to="/assistant" replace />;
  if (onlyFeuille) return <Navigate to="/feuille-route" replace />;
  if (!allowed) return <Navigate to="/feuille-route" replace />;
  return children;
}

// Racine "/" (domaine nu, icône PWA, rafraîchissement) :
// connecté → l'endroit qui correspond au compte (payé → notes, sinon feuille
// de route, onboarding inachevé → onboarding) ; déconnecté → landing.
function RootHome() {
  const { db, abonnementActif } = useApp();
  const [dest, setDest] = useState(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!db) return;
      if (db.user.onboardingTermine === false) { if (!stop) setDest("/assistant"); return; }
      // Hors ligne : optimiste comme le Guard, on ouvre l'app (le contrôle
      // d'abonnement se refait à la remise en réseau).
      if (!navigator.onLine) { if (!stop) setDest("/notes"); return; }
      let paid = false;
      try { paid = await abonnementActif(true); } catch {}
      if (!stop) setDest(paid ? "/notes" : "/feuille-route");
    })();
    return () => { stop = true; };
  }, [db, abonnementActif]);
  if (!dest) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  return <Navigate to={dest} replace />;
}

function Shell() {
  const ctx = useApp();
  const loc = useLocation();
  // Contexte absent (ex. vieux bundle en cache) : écran d'attente au lieu d'un crash blanc.
  if (!ctx) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  const { db, loading, bootError, uid, toastMsg } = ctx;
  const path = loc.pathname;
  const back = BACK_TITLES[path];
  // Lecteur immersif : en-tête propre, pas de TopBar/TopBack.
  const isReader = path.startsWith("/livres/");
  const showTabs = ["/notes", "/devoirs", "/budget", "/me", "/profil", "/feuille-route", "/livres"].includes(path);
  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  // Landing publique : accessible connecté comme déconnecté, pleine largeur,
  // avant toute garde (sinon /landing partait vers /notes puis /feuille-route).
  if (path === "/landing") {
    return (
      <div className="min-h-screen flex flex-col relative">
        <NetBar />
        <TikTokBar />
        <main className="flex-1"><Landing /></main>
        <PwaBanner />
      </div>
    );
  }
  if (bootError && !db) {
    return (
      <div className="max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-4xl text-amber-600">cloud_off</span>
        <h1 className="font-bold text-primary mt-2">Impossible de charger</h1>
        <p className="text-xs text-slate-500 mt-1">{bootError}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 h-11 rounded-xl bg-primary-container text-white text-sm font-bold">Réessayer</button>
      </div>
    );
  }
  if (!uid || !db) {    // Écrans publics sans session
    // La landing est une vitrine pleine largeur : seule la colonne mobile
    // enferme les formulaires (login/register), jamais la vitrine.
    if (path === "/") {
      return (
        <div className="min-h-screen flex flex-col relative">
          <NetBar />
          <TikTokBar />
          <main className="flex-1"><Landing /></main>
          <PwaBanner />
        </div>
      );
    }
    return (
      <div className="max-w-lg mx-auto min-h-screen flex flex-col relative bg-white sm:border-x sm:border-white/10 sm:shadow-[0_0_90px_rgba(0,0,0,0.45)]">
        {back && <TopBack titre={back[0]} sous={back[1]} />}
        <NetBar />
        <TikTokBar />
        <main className="flex-1 px-4 pt-4 pb-16">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/affiliation" element={<Affiliation />} />
            <Route path="/affiliation/login" element={<AffLogin />} />
            <Route path="/affiliation/register" element={<AffRegister />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/essai" element={<Essai />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    );
  }
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col relative bg-white sm:border-x sm:border-white/10 sm:shadow-[0_0_90px_rgba(0,0,0,0.45)]">
      {!isReader && (back ? <TopBack titre={back[0]} sous={back[1]} /> : <TopBar />)}
      <NetBar />
      <TikTokBar />
      <main className="flex-1 px-4 pt-4 pb-36">
        <Routes>
          <Route path="/notes" element={<Guard><Notes /></Guard>} />
          <Route path="/me" element={<Guard><Me /></Guard>} />
          <Route path="/profil" element={<Navigate to="/me" replace />} />
          <Route path="/objectifs" element={<Guard><Objectifs /></Guard>} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/feuille-route" element={<Guard><Feuille /></Guard>} />
          <Route path="/devoirs" element={<Guard><Devoirs /></Guard>} />
          <Route path="/budget" element={<Guard><Budget /></Guard>} />
          <Route path="/evolution" element={<Guard><Evolution /></Guard>} />
          <Route path="/livres" element={<Guard><Livres /></Guard>} />
          <Route path="/livres/:id" element={<Guard><Lecteur /></Guard>} />
          <Route path="/premium" element={<Guard><Premium /></Guard>} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/add-note" element={<Guard><AddNote /></Guard>} />
          <Route path="/add-devoir" element={<Guard><AddDevoir /></Guard>} />
          <Route path="/add-transaction" element={<Guard><AddTransaction /></Guard>} />
          <Route path="/register" element={<Register />} />
          <Route path="/pin" element={<Pin />} />
          <Route path="/pin-choice" element={<PinChoice />} />
          <Route path="/lock" element={<Lock />} />
          <Route path="/matiere" element={<Guard><Matiere /></Guard>} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/affiliation" element={<Affiliation />} />
          <Route path="/affiliation/login" element={<AffLogin />} />
          <Route path="/affiliation/register" element={<AffRegister />} />
          <Route path="/affiliation/dashboard" element={<AffDashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/essai" element={<Essai />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify" element={<Navigate to="/login" replace />} />
          <Route path="/" element={<RootHome />} />
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Routes>
      </main>
      {showTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"><BottomNav /></nav>
      )}
      <PwaBanner />
      {!!toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-primary-container text-white text-sm font-semibold shadow-lg whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initAnalytics();
    document.title = "ClassiNote — Assistant Scolaire & Budget";
    // Taper http://site/landing dans la barre d'adresse : HashRouter ne lit que
    // le #. On réécrit vers #/landing pour atterrir sur la page publique.
    // Idem pour /callback : MoneyFusion déclare l'URL de retour en forme chemin
    // (classinote.app/callback), on la convertit en route hash.
    const clean = window.location.pathname.replace(/\/+$/, "");
    if (clean.endsWith("/landing") && !window.location.hash.startsWith("#/landing")) {
      window.history.replaceState(null, "", clean.replace(/\/?landing$/, "/"));
      window.location.hash = "#/landing";
    }
    if (clean.endsWith("/callback") && !window.location.hash.startsWith("#/callback")) {
      window.history.replaceState(null, "", clean.replace(/\/?callback$/, "/"));
      window.location.hash = "#/callback";
    }
  }, []);
  return (
    <HashRouter>
      <AppProvider>
        <OnlineFlush />
        <Analytics />
        <Shell />
      </AppProvider>
    </HashRouter>
  );
}

// PostHog : pageviews manuels (HashRouter → la route est dans le #, pas dans
// pathname) + identification pseudonyme quand la session existe.
function Analytics() {
  const ctx = useApp();
  const loc = useLocation();
  const uid = ctx?.uid;
  useEffect(() => {
    capturePageview(window.location.href);
  }, [loc.pathname]);
  useEffect(() => {
    if (uid) identify(uid);
    else resetIdentity();
  }, [uid]);
  // PWA affiliation séparée : sur /affiliation*, le manifest installé est
  // celui de l'espace affilié (icône + nom + démarrage dédiés).
  useEffect(() => {
    try {
      const link = document.querySelector('link[rel="manifest"]');
      const aff = loc.pathname.startsWith("/affiliation");
      if (link) link.setAttribute("href", aff ? "./manifest-affiliation.json" : "./manifest.json");
      document.title = aff ? "ClassiNote Affiliation" : "ClassiNote — Assistant Scolaire & Budget";
    } catch {}
  }, [loc.pathname]);
  return null;
}

function OnlineFlush() {
  const ctx = useApp();
  const flushQueue = ctx?.flushQueue;
  useEffect(() => {
    if (!flushQueue) return;
    const on = () => flushQueue().catch(() => {});
    window.addEventListener("online", on);
    flushQueue().catch(() => {});
    return () => window.removeEventListener("online", on);
  }, [flushQueue]);
  return null;
}

export { sb };
