import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { diffLabel, fmtPlan, genererFeuille, ciblePeriodeActuelle } from "../lib/engine";
import { stashFeuille } from "../lib/feuille";
import { matieresDe } from "../lib/referentiel";
import { track } from "../lib/analytics";

function bandeMention(db, v) {
  const top3 = [...db.matieres].sort((a, b) => b.coef - a.coef).slice(0, 3).map((m) => `${m.nom} coeff ${m.coef}`).join(", ");
  if (v < 12) return { label: "Mention Passable / Admis", pct: 96, tag: "Hautement Accessible", strat: "Une régularité minimale dans les matières de base suffira à consolider ce palier." };
  if (v < 14) return { label: "Mention Assez Bien visée", pct: 92, tag: "Facilement Atteignable", strat: "Un travail régulier sur les exercices hebdomadaires garantira cette mention." };
  if (v < 16) return { label: "Mention Bien assurée", pct: 88, tag: "Très Réalisable", strat: `Accessible avec une stratégie ciblée sur les gros coefficients (${top3}).` };
  if (v < 18) return { label: "Mention Très Bien à portée", pct: 76, tag: "Ambitieux et Stimulant", strat: "Excellence demandée : sécurise au moins 15/20 dans les matières scientifiques." };
  return { label: "Félicitations du Jury", pct: 64, tag: "Défi d'Élite", strat: "Palier d'exception : vise l'excellence sur l'ensemble des matières." };
}

function iconPour(nom) {
  const n = (nom || "").toLowerCase();
  if (/math/.test(n)) return "calculate";
  if (/fran|dict/.test(n)) return "menu_book";
  if (/angl|lv2|langue|espagnol|allemand/.test(n)) return "language";
  if (/phys|chim/.test(n)) return "science";
  if (/svt|bio|vie|terre/.test(n)) return "biotech";
  if (/hist|géo|geo/.test(n)) return "public";
  if (/philo/.test(n)) return "psychology";
  if (/eps|sport/.test(n)) return "sports_soccer";
  if (/ecm|civique|morale/.test(n)) return "gavel";
  return "menu_book";
}

// Assistant en 3 étapes : 1 Classe → 2 Matières (+ ajout inline) → 3 Objectif.
// Une seule question par étape, ajout de matière sans quitter le parcours.
export default function Assistant() {
  const { db, persistOp, patchDb, reload, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [cycle, setCycle] = useState(db.onboarding.cycleActif);
  const [classe, setClasse] = useState(db.onboarding.classeActive);
  const [confirmDel, setConfirmDel] = useState(null);
  const [busyDel, setBusyDel] = useState(null);
  const [dial, setDial] = useState(() => Math.max(15, Math.round(db.user.moyenneActuelle)));
  const [busyGo, setBusyGo] = useState(false);
  const [busyAdd, setBusyAdd] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newCoef, setNewCoef] = useState(4);
  const runningRef = useRef(false);
  const b = bandeMention(db, dial);

  const classes = db.onboarding.classesByCycle[cycle] || [];
  const nb = db.onboarding.options.filter((o) => o.checked).length;
  const ETAPES = ["Classe", "Matières", "Objectif"];

  const goto = (s) => {
    if (s === 2 && !classe) return toast("Choisis ta classe d'abord");
    if (s === 3 && !db.onboarding.options.length) return toast("Ajoute au moins 1 matière pour continuer");
    track("assistant_step", { etape: s });
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  // Matières officielles : chargement automatique au choix de la classe.
  const chargerAuto = async (cible) => {
    if (!cible || runningRef.current) return;
    const ref = matieresDe(cible) || [];
    const manque = ref.filter(
      (r) => !db.onboarding.options.some((o) => (o.nom || "").toLowerCase() === r.nom.toLowerCase())
    );
    if (!manque.length) return;
    runningRef.current = true;
    try {
      for (const r of manque) {
        const fields = {
          nom: r.nom, coef: r.coef, icon: r.icon, groupe: "Tronc commun",
          difficulte: 3, moyenne: 10, nb_devoirs: 0, checked: true,
        };
        await persistOp(
          { table: "matieres", method: "insert", payload: { user_id: db._uid, ...fields }, touchMoy: true },
          (d) => {
            const tmpId = `tmp-${Date.now()}-${r.nom}`;
            d.matieres.push({ id: tmpId, user_id: db._uid, ...fields, moyenne: 10, nbDevoirs: 0, checked: true, sansNotes: true, provisoire: false, badge: "En attente", type: "moyen" });
            d.onboarding.options.push({ id: tmpId, nom: fields.nom, coef: fields.coef, icon: fields.icon, groupe: fields.groupe, checked: true, difficulte: fields.difficulte, date_ds: null, date_compo: null });
          }
        );
      }
      await reload();
      track("referentiel_loaded", { classe: cible, nb: manque.length, auto: true });
      toast(`${manque.length} matières de ${cible} ajoutées`);
    } catch (err) { toast("Erreur : " + err.message); } finally { runningRef.current = false; }
  };
  useEffect(() => {
    if (!classe) return;
    const t = setTimeout(() => chargerAuto(classe), 600);
    return () => clearTimeout(t);
  }, [classe]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCheck = async (idx, checked) => {
    const opt = db.onboarding.options[idx];
    const r = await persistOp(
      { table: "matieres", method: "update", payload: { checked }, match: { id: opt.id } },
      (d) => {
        const o = d.onboarding.options[idx];
        if (o) o.checked = checked;
        const m = d.matieres.find((x) => x.id === opt.id);
        if (m) m.checked = checked;
      }
    ).catch((e) => { toast("Erreur : " + e.message); return null; });
    if (!r) return;
    if (!r.queued) await reload();
  };

  const setDiff = async (idx, d) => {
    const opt = db.onboarding.options[idx];
    const r = await persistOp(
      { table: "matieres", method: "update", payload: { difficulte: d }, match: { id: opt.id } },
      (dd) => {
        const o = dd.onboarding.options[idx];
        if (o) o.difficulte = d;
        const m = dd.matieres.find((x) => x.id === opt.id);
        if (m) m.difficulte = d;
      }
    ).catch((e) => { toast("Erreur : " + e.message); return null; });
    if (!r) return;
    if (!r.queued) await reload();
  };

  const del = async (idx) => {
    const opt = db.onboarding.options[idx];
    if (confirmDel !== opt.id) { setConfirmDel(opt.id); toast("Re-clique pour confirmer la suppression"); return; }
    if (busyDel) return;
    setBusyDel(opt.id);
    try {
      const r = await persistOp({ table: "matieres", method: "delete", match: { id: opt.id }, touchMoy: true }, (d) => {
        d.onboarding.options = d.onboarding.options.filter((o) => o.id !== opt.id);
        d.matieres = d.matieres.filter((m) => m.id !== opt.id);
        d.notesRaw = d.notesRaw.filter((n) => n.matiere_id !== opt.id);
        if (d.notesToutes) d.notesToutes = d.notesToutes.filter((n) => n.matiere_id !== opt.id);
      });
      setConfirmDel(null);
      if (!r.queued) { await reload(); }
      toast(`${opt.nom} supprimée`);
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyDel(null); }
  };

  // Ajout inline : sans quitter le parcours (l'écran /matiere reste pour l'édition fine).
  const ajouterRapide = async (e) => {
    e?.preventDefault?.();
    const name = newNom.trim();
    if (busyAdd) return;
    if (!name) return toast("Nom requis");
    setBusyAdd(true);
    try {
      const fields = {
        nom: name, coef: newCoef, icon: iconPour(name), groupe: "Tronc commun",
        difficulte: 3, moyenne: 10, nb_devoirs: 0, checked: true,
      };
      const r = await persistOp(
        { table: "matieres", method: "insert", payload: { user_id: db._uid, ...fields }, touchMoy: true },
        (d) => {
          const tmpId = `tmp-${Date.now()}-${name}`;
          d.matieres.push({ id: tmpId, user_id: db._uid, ...fields, moyenne: 10, nbDevoirs: 0, checked: true, sansNotes: true, provisoire: false, badge: "En attente", type: "moyen" });
          d.onboarding.options.push({ id: tmpId, nom: fields.nom, coef: fields.coef, icon: fields.icon, groupe: fields.groupe, checked: true, difficulte: fields.difficulte, date_ds: null, date_compo: null });
        }
      );
      if (!r.queued) await reload();
      setNewNom("");
      setNewCoef(4);
      setShowAdd(false);
      toast("Matière ajoutée");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyAdd(false); }
  };

  const go = async () => {
    if (busyGo) return;
    if (!db.onboarding.options.length) return toast("Ajoute au moins 1 matière pour continuer");
    setBusyGo(true);
    try {
      // 1. Classe + fin d'installation.
      const r1 = await persistOp(
        { table: "profiles", method: "update", payload: { classe, serie: classe, onboarding_termine: true }, match: { id: db._uid } },
        (d) => { d.user.classe = classe; d.user.serie = classe; d.user.onboardingTermine = true; }
      );
      if (!r1.queued) await reload();
      // 2. Objectif : le plan se calcule TOUJOURS (local si besoin).
      const apply = (d) => { d.user.moyenneCible = dial; d.objectifs.cible = dial; d.objectifs.echeance = null; };
      try {
        const r2 = await persistOp({
          table: "objectifs", method: "insert",
          payload: { user_id: db._uid, actuel: db.user.moyenneActuelle, cible: dial, faisabilite: b.pct, echeance: null },
        }, apply);
        if (!r2.queued) await reload();
        toast("Objectif enregistré");
      } catch {
        patchDb(apply);
        toast("Plan calculé (sauvegarde après abonnement)");
      }
      track("onboarding_completed", { classe, nb_matieres: db.onboarding.options.length });
      // 3. Brouillon frais stashe + en route.
      const porteeGo = db.user.objectifPortee === "trimestre" ? "trimestre" : "annuel";
      try {
        const eff = porteeGo === "annuel" ? ciblePeriodeActuelle(db, dial).cibleEffective : dial;
        const g = genererFeuille(db, eff);
        const draft = {};
        Object.keys(g.targets).forEach((id) => {
          const m = db.matieres.find((x) => x.id === id);
          draft[id] = { ...g.targets[id], base: m && !m.sansNotes ? m.moyenne : null };
        });
        stashFeuille(draft, dial, null, { uid: db._uid, periode: db.user.periode, portee: porteeGo });
      } catch {}
      track("objectif_set", { cible: dial, portee: porteeGo, regime: db.user.regime });
      nav("/feuille-route");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyGo(false); }
  };

  return (
    <div className="space-y-5 fade">
      <section className="space-y-2">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
          <span>Étape {step} sur 3</span>
          <span>{ETAPES[step - 1]}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-secondary-container rounded-full transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
        <h1 className="text-[26px] leading-[34px] font-bold text-primary tracking-tight pt-1">Ton plan en 1 minute</h1>
      </section>

      {step === 1 && (
        <section className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-variant/40 shadow-card space-y-4 fade">
          <h2 className="font-bold text-primary">Quelle est ta classe ?</h2>
          <div className="bg-surface-container-low p-1 rounded-xl flex items-center gap-1 border border-surface-variant/30">
            {db.onboarding.cycles.map((c) => (
              <button key={c} onClick={() => {
                setCycle(c);
                const list = db.onboarding.classesByCycle[c] || [];
                if (!list.includes(classe)) setClasse(list[0]);
              }}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-bold ${cycle === c ? "bg-white text-primary shadow-sm border border-surface-variant/20" : "text-on-surface-variant"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <button key={c} onClick={() => {
                setClasse(c);
                track("assistant_step", { etape: 2 });
                setStep(2);
                window.scrollTo({ top: 0 });
              }}
                className={`px-3.5 py-2 rounded-xl border text-sm font-semibold active:scale-95 ${c === classe ? "border-2 border-secondary-container bg-primary-container text-white font-bold shadow-sm" : "border-surface-variant/60 bg-white hover:border-primary"}`}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => goto(2)} disabled={!classe}
            className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-sm disabled:opacity-40">
            Continuer
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3 fade">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-primary">Tes matières de {classe || "…"} <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary-fixed ml-1">{nb}</span></h2>
          </div>
          <p className="text-xs text-on-surface-variant">Elles se chargent toutes seules — décoche celles que tu ne suis pas, ou ajoute-en.</p>
          <div className="space-y-2.5">
            {!db.onboarding.options.length && (
              <p className="text-xs text-on-surface-variant text-center py-4">Chargement des matières…</p>
            )}
            {db.onboarding.options.map((o, i) => (
              <div key={o.id} className={`p-3.5 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-card space-y-2.5 ${o.checked ? "" : "opacity-75"}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-3.5 flex-1 cursor-pointer min-w-0">
                    <input type="checkbox" checked={!!o.checked} onChange={(e) => toggleCheck(i, e.target.checked)}
                      className="w-5 h-5 rounded-md accent-[#0f2942] cursor-pointer shrink-0" />
                    <div className={`w-10 h-10 rounded-xl ${o.checked ? "bg-surface-container text-primary" : "bg-surface-container-low text-on-surface-variant"} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[20px]">{o.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-sm truncate ${o.checked ? "font-semibold text-primary" : "font-medium"}`}>{o.nom}</h3>
                      <span className="text-[11px] text-on-surface-variant">Coef. {o.coef}</span>
                    </div>
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/matiere?edit=${o.id}`} title="Modifier"
                      className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-primary flex items-center justify-center active:scale-95">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </Link>
                    <button onClick={() => del(i)} title="Supprimer" disabled={busyDel === o.id}
                      className={`rounded-xl flex items-center justify-center active:scale-95 ${confirmDel === o.id ? "bg-error text-white px-2 w-auto h-9 text-[11px] font-bold" : "w-9 h-9 bg-error-container/40 text-error"} ${busyDel === o.id ? "opacity-70" : ""}`}>
                      {busyDel === o.id ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : confirmDel === o.id ? "Sûr ?" : <span className="material-symbols-outlined text-[20px]">delete</span>}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-variant/30">
                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-secondary">bolt</span>Difficulté :
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button key={d} onClick={() => setDiff(i, d)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${o.difficulte === d ? "bg-primary-container text-secondary-container ring-2 ring-secondary-container" : "bg-surface-container text-on-surface-variant"}`}>{d}</button>
                    ))}
                    <span className="text-[11px] font-semibold text-secondary ml-1">{diffLabel(o.difficulte)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
              <span className="material-symbols-outlined">add_circle</span>Ajouter une matière
            </button>
          ) : (
            <form onSubmit={ajouterRapide} className="p-3.5 bg-white rounded-2xl border-2 border-secondary-container/60 space-y-2.5">
              <input autoFocus placeholder="Nom (ex : Informatique)" value={newNom} onChange={(e) => setNewNom(e.target.value)}
                className="w-full h-12 rounded-xl border px-4 text-sm font-semibold" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">Coefficient</span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setNewCoef((c) => Math.max(1, c - 1))} className="w-10 h-10 rounded-lg bg-slate-100 font-bold">−</button>
                  <strong className="w-6 text-center">{newCoef}</strong>
                  <button type="button" onClick={() => setNewCoef((c) => Math.min(12, c + 1))} className="w-10 h-10 rounded-lg bg-slate-100 font-bold">+</button>
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowAdd(false); setNewNom(""); }}
                  className="h-11 px-4 rounded-xl border font-bold text-sm">Annuler</button>
                <button disabled={busyAdd} className={`flex-1 h-11 rounded-xl bg-secondary-container font-bold text-primary text-sm ${busyAdd ? "opacity-70" : ""}`}>
                  {busyAdd ? "…" : "Ajouter"}
                </button>
              </div>
            </form>
          )}
          <div className="flex gap-2">
            <button onClick={() => goto(1)} className="h-12 px-5 rounded-xl border font-bold text-sm">← Retour</button>
            <button onClick={() => goto(3)} className="flex-1 h-12 rounded-xl bg-primary-container text-white font-bold text-sm">
              Continuer ({nb} matière{nb > 1 ? "s" : ""})
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-white rounded-2xl p-4 border shadow-card text-center space-y-3 fade">
          <h2 className="font-bold text-primary">Quelle moyenne vises-tu ?</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-xs font-bold">
            <span className="material-symbols-outlined text-sm fill">flag</span><span>{b.label}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setDial((v) => Math.max(10, v - 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">−</button>
            <div className="px-4 py-2 bg-slate-50 rounded-2xl border min-w-[150px]">
              <span className="text-4xl font-extrabold text-primary">{fmtPlan(dial)}</span>
              <span className="font-bold text-slate-500 ml-1.5">/ 20</span>
            </div>
            <button onClick={() => setDial((v) => Math.min(20, v + 1))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-2xl">+</button>
          </div>
          <input type="range" min="10" max="20" step="1" value={dial} onChange={(e) => setDial(Number(e.target.value))} className="w-full" />
          <p className="text-xs text-slate-500">{b.pct}% de chances — {b.strat}</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => goto(1)} className="h-12 px-5 rounded-xl border font-bold text-sm">← Retour</button>
            <button onClick={go} disabled={busyGo} className={`flex-1 h-12 rounded-xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container font-extrabold text-primary flex items-center justify-center gap-2 ${busyGo ? "opacity-70" : ""}`}>
              {busyGo ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (<>
                <span>Calculer mon plan</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </>)}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
