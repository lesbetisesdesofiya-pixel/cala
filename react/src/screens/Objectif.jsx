import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { stashFeuille } from "../lib/feuille";
import { fmtPlan, genererFeuille, ciblePeriodeActuelle } from "../lib/engine";
import { track } from "../lib/analytics";

function bandeMention(db, v) {
  const top3 = [...db.matieres].sort((a, b) => b.coef - a.coef).slice(0, 3).map((m) => `${m.nom} coeff ${m.coef}`).join(", ");
  if (v < 12) return { label: "Mention Passable / Admis", pct: 96, tag: "Hautement Accessible", strat: "Une régularité minimale dans les matières de base suffira à consolider ce palier." };
  if (v < 14) return { label: "Mention Assez Bien visée", pct: 92, tag: "Facilement Atteignable", strat: "Un travail régulier sur les exercices hebdomadaires garantira cette mention." };
  if (v < 16) return { label: "Mention Bien assurée", pct: 88, tag: "Très Réalisable", strat: `Accessible avec une stratégie ciblée sur les gros coefficients (${top3}).` };
  if (v < 18) return { label: "Mention Très Bien à portée", pct: 76, tag: "Ambitieux et Stimulant", strat: "Excellence demandée : sécurise au moins 15/20 dans les matières scientifiques." };
  return { label: "Félicitations du Jury", pct: 64, tag: "Défi d'Élite", strat: "Palier d'exception : vise l'excellence sur l'ensemble des matières." };
}

export default function Objectif() {
  const { db, persistOp, patchDb, reload, toast } = useApp();
  const nav = useNavigate();
  const [dial, setDial] = useState(() => Math.max(15, Math.round(db.user.moyenneActuelle)));
  const [periode, setPeriode] = useState(db.user.regime || "Trimestre");
  const [portee, setPortee] = useState(db.user.objectifPortee === "trimestre" ? "trimestre" : "annuel");
  const [echeance, setEcheance] = useState(db.objectifs.echeance || "");
  const [busyGo, setBusyGo] = useState(false);
  const b = bandeMention(db, dial);

  const setRegime = async (r) => {
    setPeriode(r);
    try {
      const per = r === "Semestre" ? "Semestre 1" : "Trimestre 1";
      const op = await persistOp(
        { table: "profiles", method: "update", payload: { regime: r, periode: per }, match: { id: db._uid } },
        (d) => { d.user.regime = r; d.user.periode = per; }
      );
      if (!op.queued) await reload();
    } catch (err) { toast("Erreur : " + err.message); }
  };

  const setPorteeGo = async (v) => {
    setPortee(v);
    try {
      const op = await persistOp(
        { table: "profiles", method: "update", payload: { objectif_portee: v }, match: { id: db._uid } },
        (d) => { d.user.objectifPortee = v; }
      );
      if (!op.queued) await reload();
    } catch (err) { toast("Erreur : " + err.message); }
  };

  const go = async () => {
    if (busyGo) return;
    setBusyGo(true);
    // Le plan se calcule et s'affiche TOUJOURS (feuille de route locale, sans abo).
    // Seule la sauvegarde serveur exige l'abonnement ; sans abo on reste en local,
    // le paywall proposera "Débloquer et Enregistrer mon Plan" depuis la feuille.
    const apply = (d) => { d.user.moyenneCible = dial; d.objectifs.cible = dial; d.objectifs.echeance = echeance || null; };
    try {
      const r = await persistOp({
        table: "objectifs", method: "insert",
        payload: { user_id: db._uid, actuel: db.user.moyenneActuelle, cible: dial, faisabilite: b.pct, echeance: echeance || null },
      }, apply);
      if (!r.queued) await reload();
      toast("Objectif enregistré");
    } catch (err) {
      patchDb(apply);
      toast("Plan calculé (sauvegarde après abonnement)");
    } finally { setBusyGo(false); }
    // Brouillon frais TOUJOURS stashe (avec la cible effective du moment) :
    // sans ça, la feuille relirait un vieux brouillon et ignorerait ce réglage.
    const porteeGo = db.user.objectifPortee === "trimestre" ? "trimestre" : "annuel";
    try {
      const eff = porteeGo === "annuel" ? ciblePeriodeActuelle(db, dial).cibleEffective : dial;
      const g = genererFeuille(db, eff);
      const draft = {};
      Object.keys(g.targets).forEach((id) => {
        const m = db.matieres.find((x) => x.id === id);
        draft[id] = { ...g.targets[id], base: m && !m.sansNotes ? m.moyenne : null };
      });
      stashFeuille(draft, dial, echeance || null, { uid: db._uid, periode: db.user.periode, portee: porteeGo });
    } catch {}
    track("objectif_set", { cible: dial, portee: porteeGo, regime: periode });
    nav("/feuille-route");
  };

  return (
    <div className="space-y-4 fade">
      <div className="flex flex-col items-center">
        <span className="text-[11px] uppercase tracking-wider font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">Étape 3 sur 4</span>
        <span className="text-xs font-semibold mt-0.5">Ambition Scolaire</span>
      </div>
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div className="bg-secondary-container h-full rounded-full" style={{ width: "75%" }} />
      </div>

      <section className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-xs font-bold">
          <span className="material-symbols-outlined text-sm fill">auto_awesome</span>ClassiNote Intelligence
        </div>
        <h1 className="text-[26px] leading-[34px] font-bold text-primary">Quelle moyenne générale vises-tu cette année ?</h1>
        <p className="text-sm text-slate-500">ClassiNote va calculer le plan de travail exact et les notes nécessaires dans chaque matière.</p>
      </section>

      <div className="bg-slate-100 p-1 rounded-xl flex items-center">
        {["Trimestre", "Semestre"].map((p) => (
          <button key={p} onClick={() => setRegime(p)}
            className={`flex-1 py-2 rounded-lg text-center text-xs ${periode === p ? "bg-white shadow font-bold text-primary" : "text-slate-500 font-medium"}`}>
            {p}
          </button>
        ))}
      </div>
      <div>
        <p className="text-xs font-bold text-primary mb-1">Cet objectif vaut pour</p>
        <div className="bg-slate-100 p-1 rounded-xl flex items-center">
          {[["annuel", "L'année"], ["trimestre", periode === "Semestre" ? "Ce semestre" : "Ce trimestre"]].map(([v, l]) => (
            <button key={v} onClick={() => setPorteeGo(v)}
              className={`flex-1 py-2 rounded-lg text-center text-xs ${portee === v ? "bg-white shadow font-bold text-primary" : "text-slate-500 font-medium"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs font-bold text-primary">Fin du trimestre (compte à rebours)</label>
        <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-3 text-sm" />
      </div>

      <section className="bg-white rounded-2xl p-4 border shadow-card text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-fixed text-xs font-bold mb-3">
          <span className="material-symbols-outlined text-sm fill">flag</span><span>{b.label}</span>
        </div>
        <div className="flex items-center justify-center gap-4 my-2">
          <button onClick={() => setDial((v) => Math.max(10, v - 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">−</button>
          <div className="px-4 py-2 bg-slate-50 rounded-2xl border min-w-[170px]">
            <span className="text-4xl font-extrabold text-primary">{fmtPlan(dial)}</span>
            <span className="font-bold text-slate-500 ml-1.5">/ 20</span>
          </div>
          <button onClick={() => setDial((v) => Math.min(20, v + 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">+</button>
        </div>
        <input type="range" min="10" max="20" step="1" value={dial} onChange={(e) => setDial(Number(e.target.value))} className="w-full mt-4" />
        <div className="flex justify-between text-[11px] font-semibold text-slate-500 px-1">
          <span>10.0</span><span>12.5</span><span>15.0</span><span>17.5</span><span>20.0</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[[12, "Admis"], [14, "Assez Bien"], [16, "Très Bien"], [18, "Félicitations"]].map(([v, l]) => (
            <button key={v} onClick={() => setDial(v)}
              className={`py-2 px-2.5 rounded-xl border text-left flex items-center justify-between ${dial === v ? "border-2 border-secondary-container bg-white shadow" : "bg-slate-50"}`}>
              <span className={`text-sm font-bold ${dial === v ? "text-secondary" : "text-primary"}`}>{fmtPlan(v)}</span>
              <span className="text-[11px] text-slate-500">{l}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-primary-container text-white rounded-2xl p-4 relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/10 text-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-base">analytics</span>
            </span>
            <div>
              <p className="text-[11px] uppercase text-slate-300 font-semibold">Profil Élève</p>
              <p className="text-sm font-bold">{db.user.classe}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary-container/20 border border-secondary-container/40 text-secondary-fixed">{b.pct}%</span>
        </div>
        <div className="space-y-1.5 my-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Faisabilité estimée</span>
            <span className="font-bold text-secondary-container">{b.tag}</span>
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div className="bg-secondary-container h-full rounded-full" style={{ width: `${b.pct}%` }} />
          </div>
        </div>
        <div className="pt-2 border-t border-white/10 flex gap-2.5 text-slate-200">
          <span className="material-symbols-outlined text-secondary-container fill">lightbulb</span>
          <p className="text-xs leading-relaxed">{b.strat}</p>
        </div>
      </section>
      <p className="text-xs text-center text-slate-500">Tu pourras ajuster cet objectif matière par matière à tout instant.</p>

      <div className="h-28" />
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-white/95 backdrop-blur border-t z-40 space-y-2">
        <button onClick={go} disabled={busyGo} className={`w-full h-12 bg-primary-container text-white font-semibold rounded-xl flex items-center justify-center gap-2 ${busyGo ? "opacity-70" : ""}`}>
          {busyGo ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (<>
          <span className="text-secondary-container font-bold">Calculer mon plan de réussite</span>
          <span className="material-symbols-outlined text-xl text-secondary-container">arrow_forward</span>
          </>)}
        </button>
        <Link to="/notes" className="block w-full py-1 text-center text-xs text-slate-500">Passer pour l'instant</Link>
      </div>
    </div>
  );
}
