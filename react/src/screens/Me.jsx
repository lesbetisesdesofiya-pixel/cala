import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb } from "../lib/supabase";
import { InitialAvatar } from "../components/chrome";

// Route /me : profil + paramètres + statut abonnement.
export default function Me() {
  const { db, persistOp, reload, toast } = useApp();
  const u = db.user;
  const pf = db.profil;
  const [sub, setSub] = useState("...");
  const [busyParam, setBusyParam] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("subscriptions").select("expires_at")
        .eq("user_id", db._uid).eq("status", "active")
        .order("expires_at", { ascending: false }).limit(1).single();
      if (data?.expires_at && new Date(data.expires_at) > new Date()) {
        setSub(`Actif jusqu'au ${new Date(data.expires_at).toLocaleDateString("fr-FR")}`);
      } else setSub("Expiré ou inactif");
    })();
  }, [db._uid]);

  const setParam = async (payload, apply) => {
    if (busyParam) return;
    setBusyParam(true);
    try {
      const r = await persistOp({ table: "profiles", method: "update", payload, match: { id: db._uid } }, apply);
      if (!r.queued) await reload();
      toast("Paramètres enregistrés");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyParam(false); }
  };
  const [stockage, setStockage] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        if (!("caches" in window)) return;
        const c = await caches.open("classinote-react-v3");
        const keys = await c.keys();
        setStockage(keys.filter((r) => r.url.includes("/livres/")).length);
      } catch {}
    })();
  }, []);
  const liberer = async () => {
    try {
      const c = await caches.open("classinote-react-v3");
      const keys = await c.keys();
      await Promise.all(keys.filter((r) => r.url.includes("/livres/")).map((r) => c.delete(r)));
      setStockage(0);
      toast("Espace livres libéré");
    } catch (err) { toast("Erreur : " + err.message); }
  };
  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} disabled={busyParam}
      className={`px-3 h-9 rounded-xl text-xs font-bold border ${active ? "bg-primary-container text-white border-primary-container" : "bg-white text-primary"} ${busyParam ? "opacity-60" : ""}`}>
      {label}
    </button>
  );
  const periodes = u.regime === "Semestre" ? ["Semestre 1", "Semestre 2"] : ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

  const rows = [
    { to: "/assistant", icon: "school", t: "Classe & Série", d: `${u.serie} • ${u.lycee}` },
    { to: "/matiere", icon: "tune", t: `Mes Matières (${db.matieres.length})`, d: "Gérer les matières et coefficients" },
    { to: "/affiliation", icon: "group_add", t: "Parrainage", d: "Gagne 250 F par filleul" },
    ...(!u.hasPin ? [{ to: "/pin", icon: "lock", t: "Code PIN", d: "Sécuriser l'entrée de l'app" }] : []),
    { icon: "language", t: "Langue", d: pf.langue },
    { icon: "payments", t: "Devise", d: pf.devise },
  ];

  return (
    <div className="space-y-4 fade">
      <h1 className="text-xl font-bold text-primary text-center">Mon Profil</h1>

      <section className="bg-white rounded-2xl p-5 border shadow-card">
        <div className="flex gap-4">
          <InitialAvatar prenom={u.prenom} nom={u.nom} className="w-16 h-16 text-xl" shape="rounded-2xl" />
          <div>
            <h2 className="font-bold text-primary">{u.prenom} {u.nom}</h2>
            <p className="text-xs text-slate-500">{u.email}</p>
            <span className="text-[11px] bg-slate-100 px-2.5 py-1 rounded-full font-semibold">Formule {u.formule}</span>
          </div>
        </div>
        <div className={`mt-3 rounded-2xl p-3 border text-sm font-bold ${sub.startsWith("Actif") ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-800"}`}>
          Abonnement : {sub} — <Link to="/paywall" className="underline">Gérer</Link>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card space-y-3">
        <h2 className="font-bold text-primary">Période scolaire</h2>
        <div>
          <p className="text-[11px] font-bold text-slate-500 mb-1.5">Ton école fonctionne en</p>
          <div className="flex gap-2">
            {["Trimestre", "Semestre"].map((r) => chip(r, u.regime === r, () => setParam(
              { regime: r, periode: r === "Semestre" ? "Semestre 1" : "Trimestre 1" },
              (d) => { d.user.regime = r; d.user.periode = r === "Semestre" ? "Semestre 1" : "Trimestre 1"; }
            )))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-500 mb-1.5">Période en cours</p>
          <div className="flex gap-2 flex-wrap">
            {periodes.map((p) => chip(p, u.periode === p, () => setParam(
              { periode: p },
              (d) => { d.user.periode = p; }
            )))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Tes nouvelles notes seront rattachées à {u.periode}. Changer de période permet de générer un nouveau plan qui tient compte des précédentes.</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-500 mb-1.5">Ton objectif vaut pour</p>
          <div className="flex gap-2">
            {chip("L'année", u.objectifPortee !== "trimestre", () => setParam(
              { objectif_portee: "annuel" }, (d) => { d.user.objectifPortee = "annuel"; }
            ))}
            {chip(u.regime === "Semestre" ? "Ce semestre" : "Ce trimestre", u.objectifPortee === "trimestre", () => setParam(
              { objectif_portee: "trimestre" }, (d) => { d.user.objectifPortee = "trimestre"; }
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border shadow-card divide-y">
        {rows.map((r) => {          const inner = (
            <>
              <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined">{r.icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-primary">{r.t}</p>
                <p className="text-xs text-slate-500">{r.d}</p>
              </div>
              {r.to && <span className="material-symbols-outlined text-slate-400">chevron_right</span>}
            </>
          );
          return r.to ? (
            <Link key={r.t} to={r.to} className="p-4 flex items-center gap-3 hover:bg-slate-50">{inner}</Link>
          ) : (
            <div key={r.t} className="p-4 flex items-center gap-3">{inner}</div>
          );
        })}
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">Livres hors ligne</p>
          <p className="text-xs text-slate-500">{stockage == null ? "Calcul…" : stockage === 0 ? "Aucune page conservée" : `${stockage} page${stockage > 1 ? "s" : ""} conservée${stockage > 1 ? "s" : ""}`}</p>
        </div>
        <button onClick={liberer} className="px-4 h-10 rounded-xl border text-xs font-bold text-primary shrink-0">Libérer</button>
      </section>

      <section className="rounded-2xl bg-primary-container text-white p-5">
        <p className="text-xs text-secondary-container font-bold">PASS PREMIUM ÉTUDIANT — 1000 F/mois, 500 F le 1er mois avec un code promo</p>
        <h4 className="font-bold">Multipliez vos chances de réussite</h4>
        <Link to="/paywall" className="mt-3 block text-center h-12 leading-[48px] rounded-xl bg-secondary-container text-[#271900] font-bold">
          Gérer mon abonnement
        </Link>
      </section>

      <p className="text-center text-[11px] text-slate-400">Application Réussite Étudiante • {db.app.version}</p>
    </div>
  );
}
