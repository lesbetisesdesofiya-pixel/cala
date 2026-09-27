import { useState } from "react";import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { diffLabel } from "../lib/engine";
import { sb } from "../lib/supabase";
import { track } from "../lib/analytics";

export default function Onboarding() {
  const { db, persistOp, reload, recalcServer, toast } = useApp();
  const nav = useNavigate();
  const [cycle, setCycle] = useState(db.onboarding.cycleActif);
  const [classe, setClasse] = useState(db.onboarding.classeActive);
  const [confirmDel, setConfirmDel] = useState(null);
  const [busyDel, setBusyDel] = useState(null);
  const [busyTerm, setBusyTerm] = useState(false);

  const classes = db.onboarding.classesByCycle[cycle] || [];
  const nb = db.onboarding.options.filter((o) => o.checked).length;

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
      if (!r.queued) { await recalcServer(); await reload(); }
      toast(`${opt.nom} supprimée`);
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyDel(null); }
  };

  const terminer = async () => {
    if (!db.onboarding.options.length) return toast("Ajoute au moins 1 matière pour continuer");
    if (busyTerm) return;
    setBusyTerm(true);
    try {
      const r = await persistOp(
        { table: "profiles", method: "update", payload: { classe, serie: classe, onboarding_termine: true }, match: { id: db._uid } },
        (d) => { d.user.classe = classe; d.user.serie = classe; d.user.onboardingTermine = true; }
      );
      if (!r.queued) await reload();
      toast("Année personnalisée");
      track("onboarding_completed", { classe, nb_matieres: db.onboarding.options.length });
      nav("/objectif");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyTerm(false); }
  };

  return (
    <div className="space-y-6 fade">
      <div className="pb-3 pt-1 px-4 bg-surface-container-lowest shadow-sm -mx-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-on-surface-variant font-medium">Profil scolaire & matières</span>
          <span className="text-xs text-primary font-bold">60%</span>
        </div>
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-secondary-container rounded-full" style={{ width: "60%" }} />
        </div>
      </div>

      <section className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-[11px] font-semibold">
          <span className="material-symbols-outlined text-sm fill">auto_awesome</span>Personnalisation automatique
        </div>
        <h1 className="text-[26px] leading-[34px] font-bold text-primary tracking-tight">Personnalise ton année</h1>
        <p className="text-sm text-on-surface-variant">Choisis ton niveau et sélectionne les matières que tu suis pour adapter ton emploi du temps et tes calculs de moyenne.</p>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-variant/40 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-container text-white flex items-center justify-center font-bold text-xs">1</span>
            <h2 className="font-bold text-primary">Cycle & Classe</h2>
          </div>
          <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Obligatoire</span>
        </div>
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
        <div>
          <label className="block text-xs text-on-surface-variant mb-2">Sélectionne ta section exacte</label>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => c === classe ? (
              <button key={c} className="px-3.5 py-2 rounded-xl border-2 border-secondary-container bg-primary-container text-white text-sm font-bold shadow-sm flex items-center gap-1.5">
                <span>{c}</span>
                <span className="material-symbols-outlined text-secondary-container text-base font-bold fill">check_circle</span>
              </button>
            ) : (
              <button key={c} onClick={() => setClasse(c)} className="px-3.5 py-2 rounded-xl border border-surface-variant/60 text-sm font-semibold bg-white hover:border-primary active:scale-95">{c}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-container text-white flex items-center justify-center font-bold text-xs">2</span>
            <h2 className="font-bold text-primary">Sélectionne tes matières</h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary-fixed">{nb} matière{nb > 1 ? "s" : ""} sélectionnée{nb > 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-on-surface-variant">Ajoute tes matières avec le bouton + ci-dessous — <strong>au moins 1 pour continuer</strong>.</p>
        <div className="p-3.5 rounded-2xl bg-secondary-fixed/40 border border-secondary-container/50 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary font-bold text-lg fill">warning</span>
            <h4 className="text-sm font-bold text-primary">Très important pour tes résultats</h4>
          </div>
          <p className="text-xs leading-relaxed">Ajoute bien <strong>TOUTES tes matières</strong> avec leur coefficient et ta <strong>difficulté ressentie (1 à 5)</strong> : Facile, Abordable, Moyenne, Difficile, Très difficile.</p>
        </div>
        <div className="space-y-2.5">
          {!db.onboarding.options.length && (
            <p className="text-xs text-on-surface-variant text-center py-4">Aucune matière pour l'instant.</p>
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
                    <span className="text-[11px] text-on-surface-variant">Coef. {o.coef} • {o.groupe}</span>
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
                  <span className="material-symbols-outlined text-sm text-secondary">bolt</span>Difficulté ressentie :
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
        <Link to="/matiere" className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
          <span className="material-symbols-outlined">add_circle</span>Ajouter une matière
        </Link>
      </section>

      <aside className="p-4 rounded-2xl bg-secondary-fixed/35 border border-secondary-container/40 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">lightbulb</span>
        </span>
        <p className="text-xs leading-relaxed"><strong>Astuce calcul :</strong> Ton coefficient servira à calculer automatiquement ta moyenne semestrielle pondérée en direct à chaque nouvelle note ajoutée.</p>
      </aside>

      <div className="pb-4">
        <button onClick={terminer} disabled={busyTerm} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 shadow ${busyTerm ? "opacity-70" : ""}`}>
          {busyTerm ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <>Terminer et accéder à mon tableau de bord<span className="material-symbols-outlined font-bold">arrow_forward</span></>}
        </button>
        <p className="text-center text-[11px] text-on-surface-variant mt-2">Tu pourras modifier ces paramètres à tout moment dans ton profil.</p>
      </div>
    </div>
  );
}
