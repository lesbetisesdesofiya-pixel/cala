import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb } from "../lib/supabase";
import { stashFeuille } from "../lib/feuille";
import {
  fmtPlan, r1, TYPES_EVAL, typeLabel, moyennesParType, moyenneMatiere3Niveaux,
  recommandations, phraseConseil, simuleMatiere, genererFeuille,
  ciblePeriodeActuelle, ciblesDePeriode, situationSuivi,
} from "../lib/engine";

function simGeneralFor(db, sim) {
  const valides = db.matieres.filter((m) => (m.moyenne != null && !m.sansNotes) || (sim[m.id] && sim[m.id].note !== "" && sim[m.id].note != null));
  let pts = 0;
  const perMat = {};
  valides.forEach((m) => {
    const base = moyennesParType(db, m.id);
    const s = sim[m.id];
    let r = s && s.note !== "" && s.note != null
      ? simuleMatiere(base, s.type || "DS", Math.min(20, Math.max(0, Number(s.note))))
      : moyenneMatiere3Niveaux(base);
    if (r.moy == null) r = { moy: m.sansNotes ? null : m.moyenne, provisoire: m.provisoire };
    if (r.moy == null) return;
    perMat[m.id] = r1(r.moy);
    pts += r.moy * m.coef;
  });
  const tot2 = Object.keys(perMat).reduce((sum, id) => sum + db.matieres.find((m) => m.id === id).coef, 0);
  return { gen: tot2 ? r1(pts / tot2) : null, perMat };
}

export default function Objectifs() {
  const { db, persistOp, patchDb, reload, needSub, toast } = useApp();
  const nav = useNavigate();
  const o = db.objectifs;
  const [cible, setCible] = useState(Math.round(o.cible));
  const [sim, setSim] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [fMat, setFMat] = useState("");
  const [fType, setFType] = useState("DS");
  const [fNote, setFNote] = useState("");
  const [busySave, setBusySave] = useState(false);

  const recos = useMemo(() => recommandations(db), [db]);
  const simR = useMemo(() => simGeneralFor(db, sim), [db, sim]);
  const simDelta = simR.gen == null ? 0 : r1(simR.gen - db.user.moyenneActuelle);
  const nbSc = Object.values(sim).filter((s) => s.note !== "" && s.note != null).length;
  const pctObj = simR.gen == null ? 0
    : cible > o.actuel
      ? Math.max(0, Math.min(100, Math.round(((simR.gen - o.actuel) / (cible - o.actuel)) * 100)))
      : simR.gen >= cible ? 100 : 0;
  const showForm = formOpen || nbSc === 0;
  const ecartNum = r1(cible - o.actuel);

  // Référence plan figé DE LA PÉRIODE pour comparer la simulation.
  const simRefObj = ciblesDePeriode(db);
  const simRef = simRefObj.hasRef ? simRefObj.targets : genererFeuille(db, o.cible).targets;
  const simPlan = situationSuivi(db, simRef, o.cible);
  const simEcartPlan = simR.gen == null ? null : r1(simR.gen - o.cible);

  // "Modifier" ne fige rien : prépare le brouillon (cible effective du moment)
  // et envoie vers la feuille, seul Enregistrer là-bas modifie le Plan.
  // L'objectif local suit pour que la feuille reconnaisse le brouillon.
  const modifierPlan = () => {
    if (simR.gen == null) return;
    const nouvelleCible = Math.round(simR.gen);
    const porteeSim = db.user.objectifPortee === "trimestre" ? "trimestre" : "annuel";
    const eff = porteeSim === "annuel" ? ciblePeriodeActuelle(db, nouvelleCible).cibleEffective : nouvelleCible;
    const g = genererFeuille(db, eff);
    const draft = {};
    Object.keys(g.targets).forEach((id) => {
      const m = db.matieres.find((x) => x.id === id);
      draft[id] = { ...g.targets[id], base: m && !m.sansNotes ? m.moyenne : null };
    });
    patchDb((d) => { d.user.moyenneCible = nouvelleCible; });
    stashFeuille(draft, nouvelleCible, db.objectifs.echeance, { uid: db._uid, periode: db.user.periode, portee: porteeSim });
    toast("Brouillon préparé — vérifie puis Enregistre dans ta feuille");
    nav("/feuille-route");
  };

  const gainOf = (id) => {
    const s = sim[id];
    if (!s || s.note === "" || s.note == null) return 0;
    const r = simGeneralFor(db, { [id]: s });
    return r.gen == null ? 0 : r1(r.gen - db.user.moyenneActuelle);
  };

  const addScenario = (e) => {
    e.preventDefault();
    if (fNote === "" || fNote == null) return toast("Saisis une note");
    const id = fMat || db.matieres.filter((m) => m.moyenne != null)[0]?.id;
    if (!id) return toast("Ajoute d'abord une matière");
    setSim((s) => ({ ...s, [id]: { type: fType, note: Math.min(20, Math.max(0, Math.round(Number(fNote)))) } }));
    setFNote("");
  };

  const save = async () => {
    if (busySave) return;
    setBusySave(true);
    if (!(await needSub())) { setBusySave(false); return; }
    try {
      const oid = crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}`;
      const r0 = await persistOp({
        table: "objectifs", method: "insert",
        payload: { id: oid, user_id: db._uid, actuel: db.user.moyenneActuelle, cible, faisabilite: 85 },
      }, (d) => { d.user.moyenneCible = cible; d.objectifs.cible = cible; });
      for (const p of db.objectifs.plan) {
        await persistOp({ table: "objectif_items", method: "insert", payload: { objectif_id: oid, matiere_nom: p.matiere, action: p.action, gain: p.gain } }, null);
      }
      const r3 = await persistOp({ table: "profiles", method: "update", payload: { moyenne_cible: cible }, match: { id: db._uid } }, (d) => {
        d.user.moyenneCible = cible; d.objectifs.cible = cible;
      });
      if (!r0.queued && !r3.queued) await reload();
      toast("Objectif enregistré");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusySave(false); }
  };

  return (
    <div className="space-y-4 fade">
      <div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-low text-primary">SIMULATEUR PRÉDICTIF</span>
        <h1 className="text-2xl font-bold text-primary mt-1">Simulateur d'Objectif</h1>
        <p className="text-sm text-slate-500">Calcule ce qu'il te faut pour atteindre ta mention</p>
        <Link to="/feuille-route" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-secondary-container/20 border border-secondary-container/40 px-3 py-1.5 rounded-xl">
          Voir ma feuille de route <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <section className="bg-white rounded-2xl p-5 border shadow-card">
        <div className="grid grid-cols-2 gap-3 pb-5 border-b">
          <div className="bg-surface-container-low p-3.5 rounded-xl">
            <span className="text-[11px] uppercase text-slate-500 font-bold">Note actuelle</span>
            <div className="text-3xl font-extrabold text-primary">{fmtPlan(o.actuel)}<span className="text-sm font-normal text-slate-500">/20</span></div>
          </div>
          <div className="bg-primary-container text-white p-3.5 rounded-xl">
            <span className="text-[11px] uppercase text-slate-300 font-bold">Cible</span>
            <div className="text-3xl font-extrabold text-secondary-container">{fmtPlan(cible)}<span className="text-sm text-slate-300">/20</span></div>
            <span className="text-[11px]">Écart : {ecartNum > 0 ? "+" : ""}{fmtPlan(ecartNum)} pt</span>
          </div>
        </div>
        <div className="pt-5">
          <label className="text-xs font-bold text-primary">Ajuster la note cible (10 → 18)</label>
          <input type="range" min="10" max="18" step="1" value={cible} onChange={(e) => setCible(Number(e.target.value))} className="mt-2" />
        </div>
      </section>

      <section className="bg-white rounded-2xl p-5 border shadow-card space-y-2.5">
        <h2 className="font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">lightbulb</span>Recommandations ClassiNote
        </h2>
        <p className="text-xs text-slate-500">Calculées sur ton historique : impact × facilité. Suis l'ordre pour le chemin le plus facile vers {fmtPlan(cible)}.</p>
        {!recos.length && <p className="text-xs text-slate-500">Ajoute des notes pour recevoir des recommandations.</p>}
        {recos.map((r) => (
          <div key={r.m.id} className={`p-3.5 rounded-xl ${r.rang === "Priorité absolue" ? "bg-primary-container/5 border border-primary-container/10" : "bg-surface-container-low"} flex items-start justify-between gap-3`}>
            <div className="flex gap-3">
              <div className={`w-9 h-9 rounded-full ${r.rang === "Priorité absolue" ? "bg-secondary-container" : "bg-surface-container-highest"} flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined">{r.m.icon}</span>
              </div>
              <div>
                <div className="font-bold text-sm text-primary">{r.rang} — {r.m.nom}</div>
                <p className="text-sm">{phraseConseil(r)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Levier : {r.meilleur.label} • Tendance {r.pente >= 0 ? "+" : ""}{fmtPlan(r.pente)}/éval • Facilité {fmtPlan(r.facilite)}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${r.rang === "Priorité absolue" ? "bg-primary-container text-white" : "bg-secondary-fixed"}`}>+{fmtPlan(r.meilleur.gainGen)} pt</span>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl p-5 border shadow-card space-y-4 relative overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/20 text-[11px] font-bold w-fit">
            <span className="material-symbols-outlined text-[14px] fill">auto_awesome</span>SIMULATION HYPOTHÉTIQUE « ET SI... ? »
          </div>
          <div className="flex items-center justify-between mt-1">
            <h2 className="font-bold text-primary">Calculateur d'hypothèses</h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{nbSc} active{nbSc > 1 ? "s" : ""}</span>
          </div>
          <p className="text-xs text-slate-500">Teste l'impact de tes prochaines notes sur ta moyenne générale en temps réel.</p>
        </div>
        <div className="space-y-2.5">
          {!Object.entries(sim).length && (
            <p className="text-xs text-slate-500 text-center">Aucune hypothèse — ajoute ta première ci-dessous.</p>
          )}
          {Object.entries(sim).map(([id, sc]) => {
            const m = db.matieres.find((x) => x.id === id);
            if (!m || sc.note == null || sc.note === "") return null;
            const res = simR.perMat[id];
            const g = gainOf(id);
            const base = moyennesParType(db, m.id);
            const ref = base[sc.type] == null ? m.moyenne : base[sc.type];
            const auEpreuve = sc.type === "IE" ? "à l'interro" : sc.type === "COMPO" ? "à la compo" : "au devoir";
            const refLbl = ref != null && Number(sc.note) === r1(ref) ? "(maintien)" : `(au lieu de ${ref == null ? "—" : fmtPlan(ref)})`;
            return (
              <div key={id} className="p-3 rounded-xl bg-surface-container-low border flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[15px]">{m.icon}</span>
                    </span>
                    <div>
                      <span className="text-sm font-bold text-primary">{m.nom}</span>
                      <span className="text-[10px] ml-1.5 px-1.5 py-0.5 bg-white rounded">Coef {m.coef} • {typeLabel(sc.type)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full ${g >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"} text-xs font-bold`}>
                      {g >= 0 ? "+" : ""}{fmtPlan(g)} pt
                    </span>
                    <button onClick={() => setSim((s) => { const n = { ...s }; delete n[id]; return n; })} className="w-7 h-7 rounded-lg bg-white border text-error font-bold text-sm">x</button>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs">
                  <span className="text-[11px] text-slate-500">Si j'obtiens {auEpreuve} :</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm px-2 py-0.5 rounded border">{fmtPlan(sc.note)} / 20</span>
                    <span className="text-[10px] text-slate-500">{refLbl}</span>
                  </div>
                </div>
                {(() => {
                  const pt = simPlan.perMat[id]?.planT;
                  const sv = simR.perMat[id];
                  if (pt == null || sv == null) return null;
                  const e = r1(sv - pt);
                  return (
                    <div className="text-[11px] text-slate-500">
                      Plan : <strong className="text-primary">{fmtPlan(pt)}</strong> → écart{" "}
                      <strong className={e < 0 ? "text-rose-600" : "text-emerald-700"}>{e > 0 ? "+" : ""}{fmtPlan(e)}</strong>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {!db.matieres.filter((m) => m.moyenne != null).length ? (
            <div className="p-4 rounded-xl bg-surface-container-low text-center text-sm">
              <p className="font-bold text-primary">Aucune matière pour simuler</p>
              <Link to="/matiere" className="mt-2 inline-block px-4 h-10 leading-[40px] rounded-xl bg-primary-container text-white text-xs font-bold">+ Ajouter une matière</Link>
            </div>
          ) : showForm ? (
            <form onSubmit={addScenario} className="grid grid-cols-12 gap-2 items-end bg-surface-container-low p-3 rounded-xl">
              <div className="col-span-5">
                <label className="text-[11px] font-bold text-primary">Matière</label>
                <select value={fMat} onChange={(e) => setFMat(e.target.value)} className="mt-1 w-full h-10 rounded-lg border px-2 text-xs font-bold">
                  {db.matieres.filter((m) => m.moyenne != null).map((m) => <option key={m.id} value={m.id}>{m.nom} ({fmtPlan(m.moyenne)})</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-[11px] font-bold text-primary">Épreuve</label>
                <select value={fType} onChange={(e) => setFType(e.target.value)} className="mt-1 w-full h-10 rounded-lg border px-2 text-xs font-bold">
                  {TYPES_EVAL.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-primary">Note</label>
                <input type="number" min="0" max="20" step="1" placeholder="15" value={fNote} onChange={(e) => setFNote(e.target.value)} className="mt-1 w-full h-10 rounded-lg border px-2 text-sm font-bold text-center" />
              </div>
              <button className="col-span-2 h-10 rounded-lg bg-primary-container text-white text-xs font-bold">+ Ajouter</button>
            </form>
          ) : (
            <button onClick={() => setFormOpen(true)} className="w-full py-2 border border-dashed border-primary-container/20 rounded-xl text-primary text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99]">
              <span className="material-symbols-outlined text-base">add_circle</span>Ajouter une note hypothétique
            </button>
          )}
        </div>
        <div className="bg-primary-container text-white p-3.5 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <span className="text-[10px] uppercase text-slate-300 block font-semibold">Impact total projeté</span>
              <div className="flex items-center gap-1 text-emerald-400 font-extrabold">+ <span>{simDelta >= 0 ? "+" : ""}{fmtPlan(simDelta)} pt</span></div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-300 block font-semibold">Nouvelle moyenne estimée</span>
              <div className="flex items-baseline justify-end gap-1">
                <span className="font-extrabold text-xl">{simR.gen == null ? "—" : fmtPlan(simR.gen)}</span>
                <span className="text-xs text-slate-300">/ 20</span>
                <span className="text-[10px] text-slate-400 line-through ml-1">{fmtPlan(db.user.moyenneActuelle)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 pt-0.5">
            <span className="material-symbols-outlined text-secondary-container text-base shrink-0 mt-0.5">tips_and_updates</span>
            <p className="text-xs leading-tight font-medium">
              En validant ces {nbSc} note{nbSc > 1 ? "s" : ""}, tu atteins <strong className="text-secondary-container">{pctObj}%</strong> de ton objectif ({fmtPlan(cible)}).
            </p>
          </div>
        </div>
        {simR.gen != null && nbSc > 0 && (
          <div className="p-3.5 rounded-xl bg-white border border-secondary-container/40 space-y-2">
            <p className="text-xs text-slate-600">
              Ton objectif dans le Plan est de <strong className="text-primary">{fmtPlan(o.cible)}</strong>.
              Cette simulation correspond à <strong className="text-primary">{fmtPlan(simR.gen)}</strong> → écart{" "}
              <strong className={simEcartPlan < 0 ? "text-rose-600" : "text-emerald-700"}>
                {simEcartPlan > 0 ? "+" : ""}{fmtPlan(simEcartPlan)}
              </strong>
              {simR.gen !== o.cible ? ` (impact ${simEcartPlan > 0 ? "+" : ""}${fmtPlan(simEcartPlan)} pt sur ta cible).` : " (identique au plan)."}
            </p>
            {simR.gen !== o.cible && (
              <div className="flex gap-2">
                <button onClick={() => { setSim({}); toast(`Objectif ${fmtPlan(o.cible)} conservé`); }} className="flex-1 h-10 rounded-xl border text-xs font-bold text-primary">
                  Garder {fmtPlan(o.cible)}
                </button>
                <button onClick={modifierPlan} className="flex-1 h-10 rounded-xl bg-secondary-container text-xs font-bold text-primary">
                  Modifier à {fmtPlan(simR.gen)}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={() => setSim({})} className="text-[11px] font-bold text-slate-500 underline">Réinitialiser tous les scénarios</button>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4 border shadow-card">
        <p className="text-sm font-bold text-primary">Tes chances : {o.faisabilite}% — {o.faisabiliteLabel}</p>
        <div className="w-full bg-surface-container rounded-full h-2.5 overflow-hidden">
          <div className="bg-secondary-container h-full rounded-full" style={{ width: `${o.faisabilite}%` }} />
        </div>
      </section>
      <button onClick={save} disabled={busySave} className={`w-full h-12 bg-primary-container text-white rounded-xl font-semibold flex items-center justify-center gap-2 ${busySave ? "opacity-70" : ""}`}>
        {busySave ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Enregistrer cet objectif"}
      </button>
    </div>
  );
}
