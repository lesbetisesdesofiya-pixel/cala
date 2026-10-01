import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { stashFeuille, readStashedFeuille } from "../lib/feuille";
import { sb } from "../lib/supabase";
import {
  fmtPlan, r1, moyennesParType, moyenneMatiere3Niveaux, genererFeuille, ciblePeriodeActuelle,
  ciblesDePeriode, situationSuivi, regenRealiste, phraseReste, phraseRationale,
  diffLabel, diffImpliquee, PLAFOND_CIBLE,
} from "../lib/engine";
import { track } from "../lib/analytics";
export default function Feuille() {
  const { db, persistOp, reload, needSub, abonnementActif, toast } = useApp();
  const nav = useNavigate();
  // Abonné ou pas ? Le CTA s'adapte : un abonné n'a jamais à voir "Débloquer".
  // null = inconnu (ex. hors-ligne) -> on affiche la version Enregistrer,
  // le serveur (RLS) et save() gardent de toute façon le paywall.
  const [isSub, setIsSub] = useState(null);
  useEffect(() => {
    let stop = false;
    abonnementActif().then((v) => { if (!stop) setIsSub(v); }).catch(() => { if (!stop) setIsSub(null); });
    return () => { stop = true; };
  }, [abonnementActif]);
  // Tarif paywall : 1000 F/mois, 500 F le 1er mois avec un code promo.
  // Objectif de l'utilisateur (annuel ou de période selon réglage), toujours entier.
  // Le brouillon n'est repris que s'il correspond au contexte actuel
  // (même période, même portée, même objectif) : sinon, un vieux stash
  // ignorait silencieusement les nouveaux réglages de l'écran Objectif.
  const G = Math.round(db.user.moyenneCible);
  const portee = db.user.objectifPortee === "trimestre" ? "trimestre" : "annuel";
  // Le brouillon fait foi dès qu'il est au bon contexte (compte, période, portée).
  // On NE le compare plus à l'objectif serveur : sans abonnement, le serveur
  // garde l'ancienne valeur (insert refusée) alors que le stash a le vrai réglage.
  // Chaque changement d'objectif (go, simulateur) réécrit un stash frais.
  const rawStash = readStashedFeuille();
  const stashOk = !!rawStash && rawStash.uid === db._uid
    && rawStash.periode === db.user.periode
    && (rawStash.portee || "annuel") === portee;
  const [cibleObjectif] = useState(() => stashOk ? Math.round(rawStash.cibleDial ?? G) : G);
  // Portée annuel : la cible de TRAVAIL compense les périodes passées.
  // Portée trimestre : on vise l'objectif tel quel sur la période en cours.
  // Base = cibleObjectif (réglage local/brouillon), PAS la valeur serveur :
  // sans abonnement le serveur garde 14 (défaut) alors que l'élève a choisi 16.
  const per = portee === "annuel"
    ? ciblePeriodeActuelle(db, cibleObjectif)
    : { cibleEffective: cibleObjectif, rattrapage: 0 };
  const cible = per.cibleEffective;
  const [feuille, setFeuille] = useState(() => {
    if (stashOk) return rawStash.feuille;
    const ref = ciblesDePeriode(db);
    if (ref.hasRef) return JSON.parse(JSON.stringify(ref.targets));
    const g = genererFeuille(db, per.cibleEffective);
    const t = g.targets;
    Object.keys(t).forEach((id) => {
      const m = db.matieres.find((x) => x.id === id);
      t[id].base = m && !m.sansNotes ? m.moyenne : null;
    });
    return t;
  });

  // Référence du suivi = plan figé de LA PÉRIODE, sinon le brouillon affiché.
  const refPer = ciblesDePeriode(db);
  const refTargets = refPer.hasRef ? refPer.targets : feuille;
  const suivi = situationSuivi(db, refTargets, cible);
  const reelsParMat = {};
  db.matieres.forEach((m) => { reelsParMat[m.id] = moyennesParType(db, m.id); });
  useEffect(() => {
    // Réécrit le brouillon AVEC son contexte (sinon la période/portée/uid étaient
    // effacées et le prochain affichage retombait sur l'objectif serveur).
    stashFeuille(feuille, cibleObjectif, db.objectifs.echeance,
      { uid: db._uid, periode: db.user.periode, portee });
  }, [feuille]);
  const mats = db.matieres; // toutes : même sans notes, le plan se calcule (base neutre)
  const hasNotes = (db.notesRaw || []).length > 0;
  const ech = db.objectifs.echeance;
  const jRestants = ech ? Math.max(0, Math.ceil((new Date(ech) - new Date()) / 86400000)) : null;
  const rythme = jRestants != null && jRestants > 0
    ? r1((cible - db.user.moyenneActuelle) / Math.max(1, Math.ceil(jRestants / 7)))
    : null;

  const decalages = mats
    .filter((m) => !m.sansNotes) // alerte seulement si de vraies notes existent
    .map((m) => ({ m, imp: diffImpliquee(m.moyenne) }))
    .filter((x) => Math.abs((x.m.difficulte || 3) - x.imp) >= 2);

  const step = (id, ty, dir) => {
    setFeuille((f) => {
      if (!f[id]) return f;
      return { ...f, [id]: { ...f[id], [ty]: Math.min(PLAFOND_CIBLE, Math.max(0, Math.round(f[id][ty] + dir * 1))) } };
    });
  };

  // Régénérer = recalculer ce qui est encore possible à partir de la situation
  // actuelle (le réel est gelé, jamais réécrit). Ne touche que le brouillon :
  // la référence ne change qu'au clic Enregistrer.
  // Nouveau plan : recalcule TOUT depuis zéro (nouveaux objectifs matière +
  // nouvelle répartition) en brouillon. Sert après un changement de moteur
  // ou pour repartir à zéro. La référence ne change qu'au clic Enregistrer.
  const fresh = () => {
    const g = genererFeuille(db, cible);
    const t = { ...g.targets };
    Object.keys(t).forEach((id) => {
      const m = db.matieres.find((x) => x.id === id);
      t[id] = { ...t[id], base: m && !m.sansNotes ? m.moyenne : null };
    });
    setFeuille(t);
    toast("Nouveau plan généré — Enregistre pour le figer");
  };

  // Un seul bouton côté UI : s'il y a des notes réelles, on ajuste la suite
  // en gardant les objectifs (regen) ; sinon on régénère tout (fresh).
  const recalculer = () => {
    const avecNotes = (db.notesRaw || []).length > 0;
    track("plan_recalculated", { mode: avecNotes ? "regen" : "fresh" });
    if (avecNotes) regen();
    else fresh();
  };

  // Régénérer = recalculer ce qui est encore possible à partir de la situation
  // actuelle (le réel est gelé, jamais réécrit). Ne touche que le brouillon :
  // la référence ne change qu'au clic Enregistrer.
  const regen = () => {
    const r = regenRealiste(db, { targets: refTargets });
    const t = { ...r.draft };
    Object.keys(t).forEach((id) => {
      const m = db.matieres.find((x) => x.id === id);
      t[id] = { ...t[id], base: m && !m.sansNotes ? m.moyenne : null };
    });
    setFeuille(t);
    toast(r.tientToujours
      ? "Ton plan tient toujours — recalculé"
      : "Nouveau plan réaliste calculé — Enregistre pour le figer");
  };

  const adjustDiff = async (id, d) => {
    try {
      const r = await persistOp({ table: "matieres", method: "update", payload: { difficulte: d }, match: { id } }, null);
      if (!r.queued) await reload();
      toast("Difficulté ajustée");
    } catch (err) { toast("Erreur : " + err.message); }
  };

  const [busySave, setBusySave] = useState(false);
  const save = async () => {
    if (busySave) return;
    setBusySave(true);
    try {
      const rows = Object.entries(feuille).map(([matiere_id, t]) => {
        const m = db.matieres.find((x) => x.id === matiere_id);
        return {
          user_id: db._uid, matiere_id, matiere_nom: m ? m.nom : "",
          cible_ie: t.IE, cible_ds: t.DS, cible_compo: t.COMPO,
          base_moy: t.base == null ? (m && !m.sansNotes ? m.moyenne : null) : t.base,
          periode: db.user.periode, // ignorée pré-migration (retry auto)
        };
      });
      // Contrainte live : (user_id, matiere_id, periode) — retenté en 2 colonnes
      // en secours si la base cible n'est pas migrée.
      const oc = "user_id,matiere_id,periode";
      if (!navigator.onLine) {
        await persistOp({ table: "objectifs", method: "insert", payload: {
          user_id: db._uid, actuel: db.user.moyenneActuelle, cible: cibleObjectif, faisabilite: 85, echeance: db.objectifs.echeance,
        } }, null);
        for (const row of rows) {
          await persistOp({ table: "cibles_matieres", method: "upsert", payload: row, onConflict: oc }, null);
        }
        await persistOp({ table: "profiles", method: "update", payload: { moyenne_cible: cibleObjectif }, match: { id: db._uid } }, (d) => {
          d.user.moyenneCible = cibleObjectif;
        });
        toast("Hors ligne : plan en file, synchro auto");
        return;
      }
      if (!(await needSub())) { toast("Enregistre ton plan : abonnement requis"); nav("/paywall"); return; }
      const { error: e0 } = await sb.from("objectifs").insert({
        user_id: db._uid, actuel: db.user.moyenneActuelle, cible: cibleObjectif, faisabilite: 85, echeance: db.objectifs.echeance,
      });
      if (e0) throw e0;
      if (rows.length) {
        let { error } = await sb.from("cibles_matieres").upsert(rows, { onConflict: oc });
        if (error && /on conflict|constraint/i.test(error.message || "")) {
          ({ error } = await sb.from("cibles_matieres").upsert(rows, { onConflict: "user_id,matiere_id" }));
        }
        if (error) throw error;
      }
      const { error: e3 } = await sb.from("profiles").update({ moyenne_cible: cibleObjectif }).eq("id", db._uid);
      if (e3) throw e3;
      try { localStorage.removeItem("kp_feuille"); } catch {}
      await reload();
      toast("Plan enregistré");
      track("plan_saved", { cible: cibleObjectif, nb_matieres: rows.length });
      nav("/notes");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusySave(false); }
  };

  return (
    <div className="space-y-4 fade">
      <div className="text-center flex flex-col items-center">
        <h1 className="font-bold text-primary">Ton Plan de Réussite</h1>
        <span className="inline-flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full bg-secondary-container/20 text-xs font-bold border border-secondary-container/30">
          <span className="material-symbols-outlined text-[13px] text-secondary">flag</span>
          Objectif {fmtPlan(cibleObjectif)} / 20 • {db.user.periode}
        </span>
        {jRestants != null && (
          <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold">
            J-{jRestants}{rythme != null && rythme > 0 ? ` • +${fmtPlan(rythme)} pt/semaine requis` : ""}
          </span>
        )}
        <div className="mt-2 flex items-center justify-center gap-2 text-xs font-bold flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100">Projection : {suivi.projection == null ? "—" : fmtPlan(suivi.projection)}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100">Objectif : {fmtPlan(cible)}</span>
          {per.rattrapage !== 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">Annuel {fmtPlan(cibleObjectif)} → visé : {fmtPlan(cible)}</span>
          )}          <span className={`px-2.5 py-1 rounded-lg ${suivi.ecart == null ? "bg-slate-100" : suivi.ecart < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            Écart : {suivi.ecart == null ? "—" : `${suivi.ecart > 0 ? "+" : ""}${fmtPlan(suivi.ecart)}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">tune</span>
            <h2 className="font-bold text-primary">Barème par matière</h2>
          </div>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">{mats.length} matières auditées</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary-container/15 rounded-xl border border-secondary-container/30">
          <span className="material-symbols-outlined text-base text-secondary shrink-0">edit_note</span>
          <span className="text-xs font-semibold">Personnalise tes notes cibles avec les boutons + / −.</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-semibold">Tes notes réelles font évoluer le plan :</span>
          <button onClick={recalculer} title="Recalcule tes cibles selon tes notes réelles" className="text-[11px] font-bold text-primary underline">Recalculer mon plan</button>
        </div>
        {decalages.map(({ m, imp }) => (
          <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-xs">
            <span>Tu sens <strong>{m.nom}</strong> « {diffLabel(m.difficulte)} » mais tes notes disent « {diffLabel(imp)} ».</span>
            <button onClick={() => adjustDiff(m.id, imp)} className="px-2.5 h-8 rounded-lg bg-primary-container text-white text-[11px] font-bold shrink-0">Ajuster</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {!mats.length && <p className="text-sm text-slate-500 text-center">Ajoute des matières pour générer ton plan.</p>}
        {mats.map((m) => {
          const t = feuille[m.id] || { IE: m.moyenne, DS: m.moyenne, COMPO: m.moyenne };
          const visee = moyenneMatiere3Niveaux(t).moy;
          const s = suivi.perMat[m.id];
          const b0 = t.base;
          const pct = b0 == null || m.sansNotes ? null
            : visee == null ? null
            : visee <= b0 ? 100
            : Math.max(0, Math.min(100, Math.round(((m.moyenne - b0) / (visee - b0)) * 100)));
          const box = (ty, label, poids) => {
            const r = (reelsParMat[m.id] || {})[ty];
            return (
            <div className={`bg-slate-100/70 rounded-xl p-2 text-center border flex flex-col items-center ${ty === "COMPO" ? "bg-secondary-container/15 border-secondary-container/40" : ""}`}>
              <span className={`text-[11px] ${ty === "COMPO" ? "text-secondary font-bold" : "text-slate-500 font-semibold"}`}>{label}</span>
              <div className="flex items-center gap-1.5 my-0.5">
                <button onClick={() => step(m.id, ty, -1)} className="w-6 h-6 rounded-lg bg-white font-bold flex items-center justify-center text-xs shadow-sm active:scale-95">−</button>
                <span className={`text-sm font-bold ${ty === "COMPO" ? "text-secondary" : "text-primary"}`}>{fmtPlan(t[ty])}</span>
                <button onClick={() => step(m.id, ty, 1)} className="w-6 h-6 rounded-lg bg-white font-bold flex items-center justify-center text-xs shadow-sm active:scale-95">+</button>
              </div>
              <span className="text-[10px] text-slate-500">{poids}</span>
              <span className={`text-[10px] font-bold ${r == null ? "text-slate-400" : "text-primary"}`}>{r == null ? "À venir" : `Réel : ${fmtPlan(r)}`}</span>
            </div>
            );
          };
          return (
            <article key={m.id} className="bg-white rounded-2xl p-4 border shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">{m.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">{m.nom}</h3>
                    <p className="text-xs text-slate-500">Coeff {m.coef} • <span className="font-semibold text-secondary">{diffLabel(m.difficulte)}</span></p>
                    <p className="text-[11px] text-slate-500 italic">{phraseRationale(m.difficulte)}</p>
                  </div>
                </div>
                <div className="text-right bg-slate-100 px-2.5 py-1 rounded-xl border">
                  <span className="block text-[11px] text-slate-500 font-semibold">Moyenne visée</span>
                  <span className="font-bold text-primary">{visee == null ? "—" : fmtPlan(visee)}<span className="text-xs font-normal text-slate-500">/20</span></span>
                </div>
              </div>
              {s && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-slate-50 border text-xs space-y-1">
                  <p className="font-bold text-primary">
                    Plan : {fmtPlan(s.planT)} • Réel : {s.reel == null ? "—" : fmtPlan(s.reel)} • Écart : {s.ecart == null ? "—" : `${s.ecart > 0 ? "+" : ""}${fmtPlan(s.ecart)}`}
                  </p>
                  {s.req.valeur != null && s.reel != null && (
                    <p className={s.req.impossible ? "text-rose-600 font-semibold" : "text-slate-600"}>
                      {s.reel < s.planT ? "En retard. " : s.reel > s.planT ? "En avance. " : ""}{phraseReste(s.req, s.planT)}
                    </p>
                  )}
                  {s.req.valeur == null && s.reel != null && (
                    <p className="text-slate-600">{s.ecart >= 0 ? "Objectif atteint !" : `Épreuves terminées : écart ${fmtPlan(s.ecart)}`}</p>
                  )}
                </div>
              )}
              {pct != null && (
                <div className="space-y-1 mb-3">
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[11px] font-bold ${pct >= 100 ? "text-emerald-700" : "text-slate-500"}`}>
                    {pct} %{pct >= 100 ? " : objectif atteint" : ` : encore +${fmtPlan(Math.max(0, visee - m.moyenne))}`}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {box("IE", "Interrogations", "25 %")}
                {box("DS", "Devoirs / DS", "25 %")}
                {box("COMPO", "Composition", "50 %")}
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-secondary-container/40 bg-gradient-to-br from-white to-slate-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl fill">auto_awesome</span>
          </div>
          <div>
            <h4 className="font-bold text-primary">Garde ta stratégie active tout le semestre</h4>
            <p className="text-xs text-slate-500 mt-1">Enregistre tes notes cibles pour le suivi sur mesure et le recalcul automatique.</p>
          </div>
        </div>
      </section>

      <div className="h-64" />
      {/* CTA au-dessus du bottom nav (bottom-16 = hauteur h-16 du nav) */}
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-5 flex flex-col items-center">
          {isSub === false && !hasNotes ? (
          <div className="w-full rounded-2xl border border-secondary-container/50 bg-gradient-to-br from-white to-slate-100 p-4 space-y-2">
            <p className="font-extrabold text-primary">Ton plan est prêt. Ne perds pas le fil.</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dès ta première note, ClassiNote comparera tes résultats à ton plan et calculera ce qu'il te reste à viser pour atteindre ton objectif de {fmtPlan(cible)}/20.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Active ton suivi maintenant pour commencer à suivre ta trajectoire dès ta première évaluation.
            </p>
            <button onClick={save} disabled={busySave} className={`w-full h-14 rounded-2xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container font-extrabold flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] ${busySave ? "opacity-70" : ""}`}>
              {busySave ? <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span> : (<>
              <span className="material-symbols-outlined text-2xl">lock_open</span>
              <span>Activer mon suivi</span>
              <span className="px-2 py-0.5 rounded-lg bg-primary text-white text-xs font-bold">1000 F</span>
              </>)}
            </button>
            <Link to="/notes" className="block text-center text-xs text-slate-500 underline">Continuer sans sauvegarder</Link>
          </div>
          ) : (<>
          {isSub === false && (
            jRestants != null
              ? <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-600">
                  <span className="material-symbols-outlined text-base">timer</span>
                  J-{jRestants} avant l'échéance — fige ton plan maintenant, chaque semaine compte.
                </p>
              : <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Ton plan n'est pas sauvegardé : sans abonnement, il sera perdu.
                </p>
          )}
          <button onClick={save} disabled={busySave} className={`w-full h-14 rounded-2xl bg-gradient-to-r from-secondary-container via-[#ffc633] to-secondary-container font-extrabold flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] ${busySave ? "opacity-70" : ""}`}>
            {busySave ? <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span> : isSub === false ? (<>
            <span className="material-symbols-outlined text-2xl">lock_open</span>
            <span>Activer mon suivi</span>
            <span className="px-2 py-0.5 rounded-lg bg-primary text-white text-xs font-bold">1000 F/mois</span>
            </>) : (<>
            <span className="material-symbols-outlined text-2xl">save</span>
            <span>Activer mon suivi</span>
            </>)}
          </button>
          {isSub === false ? (<>
          <div className="flex items-center justify-center gap-3 mt-2 text-[11px] font-bold text-primary">
            <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>Suivi réel vs plan</span>
            <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>Recalcul auto</span>
            <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>Reste à viser</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px] text-slate-500 font-medium">
            <span>Soit ~33 F/jour, moins cher qu'un répétiteur</span><span>•</span>
            <span className="font-bold flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">security</span>Sans engagement</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {["Yas", "Moov"].map((o) => <span key={o} className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-primary border">{o}</span>)}
          </div>
          <Link to="/notes" className="mt-2 text-xs text-slate-500 underline">Continuer sans sauvegarder</Link>
          </>          ) : (
          <p className="mt-2 text-[11px] text-slate-500 font-medium">Inclus dans ton abonnement</p>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
