import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb, edgeFn } from "../lib/supabase";
import { savePendingFeuille } from "../lib/feuille";
import { track } from "../lib/analytics";

export function Paywall() {
  const { db, reload, unlock, toast } = useApp();
  const nav = useNavigate();
  const p = db.premium;
  const [busy, setBusy] = useState(null); // 'pay' | 'check' | 'test' | null
  // Tarif unique : 500 F/mois, sans promo.
  const prixAffiche = p.prix;
  useEffect(() => { track("paywall_viewed", {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy("pay");
    if (!navigator.onLine) { setBusy(null); return toast("Paiement impossible hors ligne — reconnecte-toi"); }
    const phone = document.getElementById("payPhone").value.trim();
    const name = document.getElementById("payName").value.trim();
    try {
      track("payment_started", { montant: prixAffiche });
      // Forme chemin (compatible la déclaration dashboard classinote.app/callback) :
      // App.jsx réécrit /callback → #/callback à l'arrivée (HashRouter).
      const return_url = window.location.origin + "/callback";
      const out = await edgeFn("mf-pay", { phone, name, return_url });
      try { localStorage.setItem("kp_paytoken", out.token); } catch {}
      window.location.href = out.url;
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(null); }
  };

  const afterPaid = async () => {
    const fresh = await reload();
    if (!fresh) return;
    try {
      if (await savePendingFeuille(fresh)) {
        await reload();
        toast("Plan enregistré");
      }
    } catch (e) { toast("Abonnement actif (plan non sauvé : " + e.message + ")"); return; }
    const u = (await reload()) || fresh;
    unlock();
    nav("/notes");
  };

  const check = async () => {
    if (busy) return;
    setBusy("check");
    if (!navigator.onLine) { setBusy(null); return toast("Vérification impossible hors ligne"); }
    try {
      let token = (() => { try { return localStorage.getItem("kp_paytoken"); } catch { return null; } })();
      if (!token) {
        // Storage perdue (retour MoneyFusion, autre onglet/origine) : on
        // retrouve notre dernier paiement côté serveur (RLS = les miens).
        const { data } = await sb.from("subscriptions").select("ref")
          .eq("user_id", db._uid).not("ref", "is", null)
          .order("created_at", { ascending: false }).limit(1);
        token = data && data[0] && data[0].ref ? data[0].ref : null;
      }
      if (!token) { setBusy(null); return toast("Aucun paiement en cours — paie d'abord"); }
      const out = await edgeFn("mf-status", { token });
      if (out.status === "paid") {
        try { localStorage.removeItem("kp_paytoken"); } catch {}
        track("payment_succeeded", { montant: prixAffiche, source: "paywall" });
        toast("Abonnement actif");
        await afterPaid();
      } else toast("Paiement non reçu pour le moment (" + out.status + ")");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(null); }
  };

  const testSub = async () => {
    if (busy) return;
    setBusy("test");
    try {
      const out = await edgeFn("mf-test-sub", {});
      if (out.status !== "active") throw new Error(out.error || "refusé");
      track("trial_started", { source: "paywall" });
      toast("Essai 30 jours activé");
      await afterPaid();
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4 fade">
      <div className="rounded-2xl bg-gradient-to-br from-secondary-container to-secondary-fixed-dim p-5 text-on-secondary-fixed">
        <span className="text-[11px] uppercase font-bold">Abonnement mensuel</span>
        <div className="text-4xl font-extrabold">{prixAffiche} <span className="text-lg">{p.devise}{p.periode}</span></div>
        <p className="text-xs font-semibold mt-1">
          Paiement Mobile Money via MoneyFusion (Yas, Moov). Sans engagement.
        </p>
      </div>
      <Link to="/premium" className="block text-center text-xs font-bold text-primary underline">Voir le détail de l'offre →</Link>
      <form onSubmit={submit} className="bg-white rounded-2xl border p-4 space-y-3">
        <div>
          <label className="text-sm font-bold">Ton nom (reçu de paiement)</label>
          <input id="payName" required defaultValue={`${db.user.prenom} ${db.user.nom}`.trim()} className="mt-1 w-full h-12 rounded-xl border px-4" />
        </div>
        <div>
          <label className="text-sm font-bold">Numéro Mobile Money à débiter</label>
          <input id="payPhone" required inputMode="tel" defaultValue={db.user.phone || ""} placeholder="90 00 00 00" className="mt-1 w-full h-12 rounded-xl border px-4" />
        </div>
        <button disabled={busy === "pay"} className={`w-full h-14 rounded-2xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container text-primary font-extrabold flex items-center justify-center gap-2 shadow-xl ${busy === "pay" ? "opacity-70" : ""}`}>
          {busy === "pay" ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Activer 500 F"}
        </button>
        <button type="button" onClick={check} disabled={busy === "check"} className={`w-full h-11 rounded-xl bg-secondary-container font-bold text-primary text-sm flex items-center justify-center gap-2 ${busy === "check" ? "opacity-70" : ""}`}>
          {busy === "check" ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "J'ai payé — vérifier mon abonnement"}
        </button>
        {import.meta.env.DEV && (
          <button type="button" onClick={testSub} disabled={busy === "test"} className={`w-full h-11 rounded-xl border-2 border-dashed border-outline-variant font-bold text-on-surface-variant text-sm flex items-center justify-center gap-2 ${busy === "test" ? "opacity-70" : ""}`}>
            {busy === "test" ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Mode test : activer 30 jours gratuits"}
          </button>
        )}
      </form>
      <SignOut />    </div>
  );
}

function SignOut() {
  const { signOut } = useApp();
  const nav = useNavigate();
  return (
    <button onClick={async () => { await signOut(); nav("/login"); }} className="w-full text-xs text-slate-500 underline">
      Se déconnecter
    </button>
  );
}

export function Callback() {
  const { db, reload, unlock, toast } = useApp();
  const nav = useNavigate();

  const check = async (go) => {
    try {
      let token = (() => { try { return localStorage.getItem("kp_paytoken"); } catch { return null; } })();
      if (!token) {
        // Même secours que le paywall : dernier paiement connu du serveur.
        const { data } = await sb.from("subscriptions").select("ref")
          .eq("user_id", db._uid).not("ref", "is", null)
          .order("created_at", { ascending: false }).limit(1);
        token = data && data[0] && data[0].ref ? data[0].ref : null;
      }
      if (!token) { toast("Aucun paiement en cours trouvé."); return; }
      const out = await edgeFn("mf-status", { token });
      if (out.status === "paid") {
        try { localStorage.removeItem("kp_paytoken"); } catch {}
        track("payment_succeeded", { source: "callback" });
        const fresh = await reload();
        if (fresh) {
          try {
            if (await savePendingFeuille(fresh)) {
              await reload();
              toast("Plan enregistré");
            }
          } catch (e) { toast("Abonnement actif (plan non sauvé : " + e.message + ")"); }
        } else toast("Paiement confirmé — abonnement actif.");
        if (go) {
          const u = await reload().catch(() => null);
          if (!u) { nav("/notes"); return; }
          unlock();
          nav("/notes");
        }
      } else toast("Paiement " + out.status + " — finalise sur la page MoneyFusion puis reviens.");
    } catch (err) { toast("Erreur : " + err.message); }
  };

  useEffect(() => {
    let stop = false;
    (async () => { if (!stop) await check(false); })();
    return () => { stop = true; };
  }, []);
  return (
    <div className="text-center mt-10 fade">
      <div className="w-20 h-20 rounded-2xl bg-primary-container text-secondary-container flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-4xl fill">payments</span>
      </div>
      <h1 className="text-[22px] font-bold text-primary mt-3">Vérification du paiement…</h1>
      <p className="text-sm text-on-surface-variant mt-1">On interroge MoneyFusion.</p>
      <button onClick={() => check(true)} className="mt-4 px-6 h-12 rounded-xl bg-secondary-container font-bold text-primary">Ouvrir ClassiNote</button>
    </div>
  );
}

export function Premium() {
  const { db } = useApp();
  const p = db.premium;
  // Tarif unique : 500 F/mois, sans promo.
  const prix = p.prix;
  return (
    <div className="space-y-4 fade">
      <div className="rounded-2xl bg-gradient-to-b from-surface-container-high to-white p-6 text-center border">
        <div className="w-20 h-20 rounded-2xl bg-primary-container text-secondary-container flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl fill">rocket_launch</span>
        </div>
        <h1 className="text-2xl font-bold text-primary mt-3">{p.titre}</h1>
        <p className="text-sm text-slate-500 mt-1">{p.soustitre}</p>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-secondary-container to-secondary-fixed-dim p-5 text-[#271900]">
        <span className="text-[11px] uppercase font-bold">Accès intégral mensuel</span>
        <div className="text-4xl font-extrabold">{prix} <span className="text-lg">{p.devise}</span><span className="text-sm font-semibold">{p.periode}</span></div>
        <p className="text-xs font-semibold mt-2 border-t border-black/10 pt-2">Sans engagement, annulable à tout moment</p>
      </div>
      <div className="space-y-2.5">
        {p.avantages.map((a) => (
          <div key={a.titre} className="flex gap-3 p-3.5 rounded-xl bg-white border shadow-card">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">{a.icon}</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-primary">{a.titre}</p>
              <p className="text-xs text-slate-500">{a.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border p-4">
        <p className="text-sm font-bold text-primary">Paiement Mobile Money</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {p.operateurs.map((o) => (
            <div key={o.nom} className="border rounded-xl p-2 text-center text-[11px] font-bold">
              <div className="w-9 h-9 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-[10px]" style={{ background: o.couleur }}>{o.code}</div>
              {o.nom}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
