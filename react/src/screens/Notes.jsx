import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/store";
import { fmtNote, fmtPlan, genererFeuille, ciblesDePeriode, situationSuivi, phraseReste } from "../lib/engine";

function GpaRing({ moyenne }) {
  const pct = Math.round((moyenne / 20) * 100);
  const circ = 188.5;
  const off = (circ * (1 - moyenne / 20)).toFixed(1);
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-primary-container text-white p-5 shadow-navy">
      <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-secondary-container opacity-15 blur-2xl" />
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold">Moyenne Générale</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extrabold">{fmtNote(moyenne)}</span>
            <span className="text-slate-300">/ 20</span>
          </div>
        </div>
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" stroke="rgba(255,255,255,.15)" strokeWidth="6" fill="none" />
            <circle cx="36" cy="36" r="30" stroke="#ffb702" strokeWidth="6.5" fill="none"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-extrabold">{pct}%</span>
            <span className="text-[10px] text-slate-300">cible</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const TYPE_BADGE = { IE: "Interro", DS: "Devoir", COMPO: "Compo" };

export default function Notes() {
  const { db } = useApp();
  const u = db.user;
  const dernieres = [...(db.notesRaw || [])].reverse().slice(0, 4);
  const aFaire = (db.devoirs || []).filter((d) => d.statut !== "done").slice(0, 3);

  // Trajectoire : même moteur que la feuille (plan figé DE LA PÉRIODE vs réel).
  const dashRef = ciblesDePeriode(db);
  const hasPlan = dashRef.hasRef;
  const dashTargets = hasPlan ? dashRef.targets : genererFeuille(db, u.moyenneCible).targets;
  const dash = situationSuivi(db, dashTargets, u.moyenneCible);
  const pire = Object.entries(dash.perMat)
    .filter(([, s]) => s.reel != null && s.ecart != null && s.ecart < 0)
    .sort((a, b) => a[1].ecart - b[1].ecart)[0];
  const pireNom = pire ? db.matieres.find((m) => m.id === pire[0])?.nom : null;
  const [pinOk, setPinOk] = useState(() => {
    try { return !!localStorage.getItem("kp_pin_ok"); } catch { return true; }
  });

  return (
    <div className="space-y-4 fade">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Salut {u.prenom}</h1>
          <p className="text-sm text-slate-500 font-medium">{u.classe} • {db.app.annee}</p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-surface-container-low border text-xs font-bold text-primary">{u.periode}</span>
      </section>

      <GpaRing moyenne={u.moyenneActuelle} />

      {!db.user.hasPin && !pinOk && (
        <section className="rounded-[20px] bg-primary-container text-white p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary-container text-2xl shrink-0">shield_lock</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Protège ton app avec un code PIN ?</p>
            <p className="text-[11px] text-slate-300">Optionnel — fais-le quand tu veux.</p>
          </div>
          <Link to="/pin" className="px-4 h-10 rounded-xl bg-secondary-container text-primary text-xs font-bold flex items-center shrink-0">OK</Link>
          <button onClick={() => { try { localStorage.setItem("kp_pin_ok", "1"); } catch {} setPinOk(true); }} className="text-slate-300 text-[11px] underline shrink-0">Plus tard</button>
        </section>
      )}

      {(db.notesRaw || []).length === 0 && (
        <section className="rounded-[20px] bg-white border p-4 shadow-card space-y-2">
          <h2 className="font-bold text-primary">Tes 3 premiers pas</h2>
          {[
            ["add", "Ajoute ta première note", "/add-note"],
            ["route", "Vois ton plan", "/feuille-route"],
            ["lock_open", "Active ton suivi", "/paywall"],
          ].map(([ic, lb, to]) => (
            <Link key={to} to={to} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border">
              <span className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">{ic}</span>
              </span>
              <span className="text-sm font-bold text-primary">{lb}</span>
              <span className="material-symbols-outlined text-slate-300 ml-auto">chevron_right</span>
            </Link>
          ))}
        </section>
      )}

      <section className="rounded-[20px] bg-white border p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">explore</span>Trajectoire
          </h2>
          <Link to="/feuille-route" className="text-xs font-bold text-primary">Feuille de route ›</Link>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100">Plan : {fmtPlan(u.moyenneCible)}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100">Réel : {fmtPlan(u.moyenneActuelle)}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100">Proj : {dash.projection == null ? "—" : fmtPlan(dash.projection)}</span>
          <span className={`px-2.5 py-1 rounded-lg ${dash.ecart == null ? "bg-slate-100" : dash.ecart < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            {dash.ecart == null ? "Écart : —" : `Écart : ${dash.ecart > 0 ? "+" : ""}${fmtPlan(dash.ecart)}`}
          </span>
        </div>
        {!hasPlan && (
          <p className="mt-2 text-[11px] text-slate-500">Plan non enregistré — <Link to="/feuille-route" className="font-bold text-primary underline">enregistre-le pour figer ta référence</Link>.</p>
        )}
        {pire && pireNom ? (
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-bold text-rose-600">{pireNom} : {fmtPlan(pire[1].ecart)} sur le plan.</span>{" "}
            {pire[1].req.valeur != null && phraseReste(pire[1].req, pire[1].planT)}
          </p>
        ) : (
          dash.ecart != null && dash.ecart >= 0 && (
            <p className="mt-2 text-xs font-bold text-emerald-700">En avance ou à l'heure sur ton plan, continue.</p>
          )
        )}
      </section>

      {db.conseilIA && (
        <section className="rounded-[20px] bg-secondary-fixed/50 border border-secondary-container/40 p-4 flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined fill">lightbulb</span>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm">{db.conseilIA.titre}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary-container font-bold">{db.conseilIA.priorite}</span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Renforce les <strong className="text-primary">{db.conseilIA.matiereFaible}</strong> pour sécuriser ta mention ! Coef {db.conseilIA.coef}.
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/objectifs" className="rounded-2xl bg-white border p-3.5 shadow-card flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">calculate</span>
          </span>
          <span>
            <span className="block text-sm font-bold text-primary">Simulateur</span>
            <span className="text-[11px] text-slate-500">Et si j'ai… ?</span>
          </span>
        </Link>
        <Link to="/livres" className="rounded-2xl bg-white border p-3.5 shadow-card flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">menu_book</span>
          </span>
          <span>
            <span className="block text-sm font-bold text-primary">Livres</span>
            <span className="text-[11px] text-slate-500">Par matière</span>
          </span>
        </Link>
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-primary text-lg">Notes récentes</h2>
          <Link to="/evolution" className="text-xs font-bold text-primary">Historique ›</Link>
        </div>
        {dernieres.length ? dernieres.map((n) => (
          <div key={n.id} className="rounded-2xl bg-white p-3.5 border border-slate-100 shadow-card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2 py-1 rounded-lg bg-surface-container-low text-primary text-[11px] font-bold shrink-0">
                {TYPE_BADGE[n.type] || n.type}
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-primary truncate">{n.matiere_nom}</h3>
                <p className="text-xs text-slate-500 truncate">{n.titre} • {n.evalue_le ? new Date(n.evalue_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}</p>
              </div>
            </div>
            <span className="font-extrabold text-primary shrink-0">{fmtNote(n.note)}<span className="text-xs font-normal text-slate-500">/20</span></span>
          </div>
        )) : (
          <div className="rounded-2xl bg-white p-4 border text-center text-sm text-slate-500">
            Aucune note pour l'instant.<br />
            <Link to="/add-note" className="font-bold text-primary underline">Ajoute ta première note</Link>
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-primary text-lg">Devoirs à faire</h2>
          <Link to="/devoirs" className="text-xs font-bold text-primary">Tout voir ›</Link>
        </div>
        {aFaire.length ? aFaire.map((d) => (
          <Link key={d.id} to="/devoirs" className={`rounded-2xl bg-white p-3.5 border ${d.type === "urgent" ? "border-2 border-secondary-container/60" : "border-slate-100"} shadow-card flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-primary truncate">{d.titre}</h3>
              <p className="text-xs text-slate-500 truncate">{d.matiere} • {d.date}</p>
            </div>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${d.type === "urgent" ? "bg-secondary-container" : "bg-slate-100"}`}>{d.delai || "à faire"}</span>
          </Link>
        )) : (
          <div className="rounded-2xl bg-white p-4 border text-center text-sm text-slate-500">Rien à faire.</div>
        )}
      </section>

      <Link to="/add-note" className="w-full h-12 rounded-xl bg-secondary-container text-primary font-bold flex items-center justify-center gap-2 shadow">
        <span className="material-symbols-outlined">add</span>Ajouter une note
      </Link>
      <Link to="/evolution" className="w-full h-12 rounded-xl bg-white border font-bold text-primary text-sm flex items-center justify-center gap-2">
        <span className="material-symbols-outlined">show_chart</span>Voir mon évolution
      </Link>
    </div>
  );
}
