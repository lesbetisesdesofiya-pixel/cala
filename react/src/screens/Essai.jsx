import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { CLASSES_PAR_CYCLE } from "../lib/store";
import { matieresDe } from "../lib/referentiel";
import { buildLocalDb, writeEssai } from "../lib/essai";
import { fmtPlan, genererFeuille } from "../lib/engine";
import { track } from "../lib/analytics";

const CYCLES_ESSAI = ["Collège", "Lycée"];

function mentionDe(v) {
  if (v < 12) return "Passable";
  if (v < 14) return "Assez Bien";
  if (v < 16) return "Bien";
  if (v < 18) return "Très Bien";
  return "Félicitations du Jury";
}

// Essai anonyme : découvrir son plan AVANT de créer un compte.
// Aucune session requise : tout est calculé en local via le moteur.
export default function Essai() {
  const ctx = useApp();
  const nav = useNavigate();
  const [cycle, setCycle] = useState("Collège");
  const [classe, setClasse] = useState("6ème");
  const [off, setOff] = useState({});
  const [dial, setDial] = useState(15);
  const [plan, setPlan] = useState(null);

  const classes = (CLASSES_PAR_CYCLE[cycle] || []).filter((c) => matieresDe(c));
  const ref = useMemo(() => matieresDe(classe) || [], [classe]);
  const actives = ref.filter((m) => !off[m.nom]);

  const voir = () => {
    if (!actives.length) return;
    const db = buildLocalDb(classe, actives, dial);
    const g = genererFeuille(db, dial);
    const rows = Object.keys(g.targets).map((id) => {
      const i = Number(id.replace("local-", ""));
      const m = actives[i] || { nom: "?", coef: 1 };
      return { id, nom: m.nom, coef: m.coef, ...g.targets[id] };
    });
    writeEssai({ classe, cible: dial, matieres: actives.map((m) => ({ nom: m.nom, coef: m.coef, icon: m.icon })) });
    track("plan_anonymous_generated", { classe, cible: dial, nb_matieres: actives.length });
    setPlan({ rows, projete: g.projete });
    window.scrollTo({ top: 0 });
  };

  if (plan) {
    return (
      <div className="space-y-4 fade">
        <section className="rounded-2xl bg-primary-container text-white p-5 text-center">
          <p className="text-[11px] uppercase font-bold text-slate-300">Ton plan {classe}</p>
          <p className="text-3xl font-extrabold mt-1">Objectif {fmtPlan(dial)}<span className="text-base text-slate-300">/20</span></p>
          <p className="text-xs text-slate-300 mt-1">{mentionDe(dial)} • {plan.rows.length} matières • projeté {fmtPlan(plan.projete)}</p>
        </section>
        <section className="space-y-2">
          {plan.rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border p-3.5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-primary">{r.nom}</h3>
                <span className="text-[11px] font-bold text-slate-500">Coef. {r.coef}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2 text-center">
                {[["Interro", r.IE], ["Devoir", r.DS], ["Compo", r.COMPO]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-slate-50 border py-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{l}</p>
                    <p className="font-extrabold text-primary">{fmtPlan(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
        <p className="text-xs text-center text-slate-500">Crée ton compte pour enregistrer ce plan et suivre tes vraies notes.</p>
        <button onClick={() => nav(ctx?.uid ? "/assistant" : "/register")}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container font-extrabold text-primary flex items-center justify-center gap-2 shadow-xl">
          Enregistrer mon plan<span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <button onClick={() => setPlan(null)} className="w-full text-xs text-slate-500 underline">Modifier ma classe ou mon objectif</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 fade">
      <section className="space-y-1">
        <h1 className="text-[26px] leading-[34px] font-bold text-primary tracking-tight">Ton plan, sans compte</h1>
        <p className="text-sm text-slate-500">Classe, matières, moyenne visée — vois les notes exactes à viser. Gratuit, sans inscription.</p>
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card space-y-3">
        <h2 className="font-bold text-primary">1. Ta classe</h2>
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
          {CYCLES_ESSAI.map((c) => (
            <button key={c} onClick={() => {
              setCycle(c);
              const list = (CLASSES_PAR_CYCLE[c] || []).filter((x) => matieresDe(x));
              if (!list.includes(classe)) { setClasse(list[0]); setOff({}); }
            }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold ${cycle === c ? "bg-white shadow text-primary" : "text-slate-500"}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <button key={c} onClick={() => { setClasse(c); setOff({}); }}
              className={`px-3.5 py-2 rounded-xl border text-sm font-semibold ${c === classe ? "border-2 border-secondary-container bg-primary-container text-white font-bold" : "bg-white"}`}>{c}</button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card space-y-2">
        <h2 className="font-bold text-primary">2. Tes matières <span className="text-xs font-medium text-slate-500">(décoche si besoin)</span></h2>
        {ref.map((m) => (
          <label key={m.nom} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border cursor-pointer">
            <input type="checkbox" checked={!off[m.nom]} onChange={() => setOff((o) => ({ ...o, [m.nom]: !o[m.nom] }))}
              className="w-5 h-5 rounded-md accent-[#0f2942]" />
            <span className="text-sm font-semibold text-primary flex-1">{m.nom}</span>
            <span className="text-[11px] font-bold text-slate-500">Coef. {m.coef}</span>
          </label>
        ))}
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card text-center space-y-3">
        <h2 className="font-bold text-primary">3. Ta moyenne visée</h2>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setDial((v) => Math.max(10, v - 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">−</button>
          <div className="px-4 py-2 bg-slate-50 rounded-2xl border min-w-[150px]">
            <span className="text-4xl font-extrabold text-primary">{fmtPlan(dial)}</span>
            <span className="font-bold text-slate-500 ml-1.5">/ 20</span>
          </div>
          <button onClick={() => setDial((v) => Math.min(20, v + 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">+</button>
        </div>
        <input type="range" min="10" max="20" step="1" value={dial} onChange={(e) => setDial(Number(e.target.value))} className="w-full" />
        <p className="text-xs font-bold text-secondary">{mentionDe(dial)}</p>
      </section>

      <div className="h-24" />
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-white/95 backdrop-blur border-t z-40">
        <button onClick={voir} disabled={!actives.length}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container font-extrabold text-primary flex items-center justify-center gap-2 disabled:opacity-50">
          Voir mon plan<span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
        <Link to="/register" className="block w-full py-1 text-center text-xs text-slate-500">J'ai déjà un compte — me connecter</Link>
      </div>
    </div>
  );
}
