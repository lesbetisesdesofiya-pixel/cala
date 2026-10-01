import { useCallback, useEffect, useState } from "react";
import { idb } from "../lib/offline";
import { useApp } from "../lib/store";
import { isTikTok, isAndroid, openExternal } from "../lib/webview";

export function NetBar() {
  const [state, setState] = useState({ off: !navigator.onLine, n: 0 });
  const refresh = useCallback(async () => {
    let n = 0;
    try { n = (await idb.all()).length; } catch {}
    setState({ off: !navigator.onLine, n });
  }, []);
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("kp-outbox", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("kp-outbox", on);
    };
  }, [refresh]);
  const { off, n } = state;
  if (!off && !n) return null;
  return (
    <div className={`mx-4 mt-2 px-3 py-2 rounded-xl text-xs font-bold text-center ${off ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
      {off ? `Hors ligne${n ? ` — ${n} action${n > 1 ? "s" : ""} en attente de synchro` : ""}` : `${n} action${n > 1 ? "s" : ""} à synchroniser…`}
    </div>
  );
}

// Webview TikTok : pas d'installation PWA possible + risque de perdre le
// contexte au retour paiement. Bannière de sortie vers le vrai navigateur
// (renvoyée une fois dismissée).
export function TikTokBar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (isTikTok() && !localStorage.getItem("kp_webview_ok")) setVisible(true);
    } catch {
      if (isTikTok()) setVisible(true);
    }
  }, []);
  if (!visible) return null;
  const close = () => {
    try { localStorage.setItem("kp_webview_ok", "1"); } catch {}
    setVisible(false);
  };
  const android = isAndroid();
  return (
    <div className="mx-4 mt-2 px-3 py-2.5 rounded-xl bg-primary-container text-white flex items-center gap-2.5">
      <span className="material-symbols-outlined text-secondary-container shrink-0">open_in_new</span>
      <p className="flex-1 text-[11px] font-semibold leading-snug">
        Tu es dans TikTok : ouvre dans {android ? "Chrome" : "Safari (menu ···)"} pour payer et installer l'app.
      </p>
      {android && (
        <button onClick={openExternal} className="px-3 h-9 rounded-xl bg-secondary-container text-[#271900] text-[11px] font-extrabold shrink-0">
          Ouvrir
        </button>
      )}
      <button onClick={close} aria-label="Fermer" className="text-slate-300 font-bold shrink-0">x</button>
    </div>
  );
}

export function PwaBanner() {
  const [visible, setVisible] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const { toast } = useApp();

  useEffect(() => {
    const installed = () => {
      try { if (localStorage.getItem("kp_pwa") === "1") return true; } catch {}
      if (window.matchMedia && matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator.standalone) return true;
      return false;
    };
    const check = () => {
      if (installed()) { setVisible(false); return; }
      let snooze = 0;
      try { snooze = Number(localStorage.getItem("kp_pwa_snooze") || 0); } catch {}
      setVisible(!(snooze && Date.now() - snooze < 24 * 3600e3));
    };
    check();
    const onPrompt = (e) => { e.preventDefault(); window.__pwaDeferred = e; setCanInstall(true); check(); };
    const onInstalled = () => { try { localStorage.setItem("kp_pwa", "1"); } catch {} setVisible(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;
  const install = async () => {
    const d = window.__pwaDeferred;
    if (d) {
      d.prompt();
      try { await d.userChoice; } catch {}
      window.__pwaDeferred = null;
      setCanInstall(false);
    } else if (isTikTok()) {
      toast("Ouvre cette page dans Chrome (Android) ou Safari (iPhone) via ··· puis installe l'app");
    } else toast("Menu du navigateur > Installer l'application (ou Ajouter à l'écran d'accueil)");
  };
  const close = () => {
    try { localStorage.setItem("kp_pwa_snooze", String(Date.now())); } catch {}
    setVisible(false);
  };
  return (
    <div className="fixed left-0 right-0 bottom-20 z-[100] max-w-lg mx-auto px-4">
      <div className="rounded-2xl bg-gradient-to-r from-primary-container to-tertiary-container text-white p-4 shadow-navy flex items-center gap-3 border border-white/10">
        <img src="./icon-192.png" alt="ClassiNote" className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm">Installe ClassiNote</p>
          <p className="text-[11px] text-slate-300">Accès direct, rapide, même hors ligne.</p>
        </div>
        <button onClick={install} className="px-4 h-10 rounded-xl bg-secondary-container text-[#271900] text-xs font-extrabold shrink-0">Installer</button>
        <button onClick={close} aria-label="Fermer" className="w-8 h-8 rounded-lg text-slate-300 font-bold shrink-0">x</button>
      </div>
    </div>
  );
}
