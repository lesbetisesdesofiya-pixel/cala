import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/store";
import { diffLabel } from "../lib/engine";

const ICONS = [
  "calculate", "functions", "science", "biotech", "menu_book", "auto_stories",
  "language", "translate", "public", "globe", "history_edu", "school",
  "book", "library_books", "psychology", "sports_soccer", "account_balance", "gavel",
  "terminal", "computer", "code", "palette", "brush", "music_note",
  "draw", "edit_note", "lightbulb", "rocket_launch", "star", "bolt",
];

export default function Matiere() {
  const { db, persistOp, reload, recalcServer, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const edited = params.get("edit") ? db.onboarding.options.find((o) => o.id === params.get("edit")) : null;

  const [nom, setNom] = useState(edited ? edited.nom : "");
  const [icon, setIcon] = useState(edited ? edited.icon : "calculate");
  const [coef, setCoef] = useState(edited ? edited.coef : 4);
  const [diff, setDiff] = useState(edited ? edited.difficulte : 3);
  const [groupe] = useState(edited ? edited.groupe : "Tronc commun");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const name = nom.trim();
    if (!name) { setBusy(false); return toast("Nom requis"); }
    // Matières = setup : pas de paywall (les notes restent payantes).
    try {
      const fields = {
        nom: name, coef, icon, groupe, difficulte: diff,
        date_ds: null, date_compo: null,
      };
      if (edited) {
        const r = await persistOp({ table: "matieres", method: "update", payload: fields, match: { id: edited.id }, touchMoy: true }, (d) => {
          const m = d.matieres.find((x) => x.id === edited.id);
          if (m) Object.assign(m, fields);
          const o = d.onboarding.options.find((x) => x.id === edited.id);
          if (o) Object.assign(o, fields);
        });
        if (!r.queued) { await recalcServer(); await reload(); }
        toast("Matière modifiée");
      } else {
        const r = await persistOp({
          table: "matieres", method: "insert",
          payload: { user_id: db._uid, ...fields, moyenne: 10, nb_devoirs: 0, checked: true },
          touchMoy: true,
        }, (d) => {
          const tmpId = `tmp-${Date.now()}`;
          d.matieres.push({ id: tmpId, user_id: db._uid, ...fields, moyenne: 10, nbDevoirs: 0, checked: true, sansNotes: true, provisoire: false, badge: "En attente", type: "moyen" });
          d.onboarding.options.push({ id: tmpId, nom: fields.nom, coef: fields.coef, icon: fields.icon, groupe: fields.groupe, checked: true, difficulte: fields.difficulte, date_ds: fields.date_ds, date_compo: fields.date_compo });
        });
        if (!r.queued) { await reload(); }
        toast("Matière ajoutée");
      }
      nav("/assistant");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 fade">
      <div className="bg-primary-container text-white rounded-2xl p-5">
        <span className="text-[11px] uppercase text-slate-300">Aperçu en direct {edited ? "— modification" : ""}</span>
        <div className="flex items-center gap-4 mt-2">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container text-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">{icon}</span>
          </div>
          <div>
            <h2 className="font-bold text-lg">{nom || "Nouvelle matière"}</h2>
            <span className="text-xs bg-white/15 px-2 py-0.5 rounded">Coefficient {coef} • {groupe}</span>
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-bold">Nom de la matière</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Mathématiques"
            className="mt-1 w-full h-12 rounded-xl border px-4" />
        </div>
        <div>
          <label className="text-sm font-bold">Icône ({ICONS.length} choix)</label>
          <div className="grid grid-cols-6 gap-2 mt-1 max-h-44 overflow-y-auto p-1">
            {ICONS.map((ic) => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                className={`p-2.5 rounded-xl border-2 ${icon === ic ? "border-primary-container bg-white" : "border-transparent bg-slate-100"}`}>
                <span className="material-symbols-outlined">{ic}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Coefficient</span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => setCoef((c) => Math.max(1, c - 1))} className="w-10 h-10 rounded-lg bg-white border font-bold">−</button>
              <strong>{coef}</strong>
              <button type="button" onClick={() => setCoef((c) => Math.min(12, c + 1))} className="w-10 h-10 rounded-lg bg-white border font-bold">+</button>
            </span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-secondary">bolt</span>Difficulté ressentie
            </span>
            <span className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} type="button" onClick={() => setDiff(d)}
                  className={`w-8 h-8 rounded-full font-bold text-xs ${diff === d ? "bg-primary-container text-secondary-container ring-2 ring-secondary-container" : "bg-white border text-slate-500"}`}>{d}</button>
              ))}
              <span className="text-[11px] font-semibold text-secondary ml-1">{diffLabel(diff)}</span>
            </span>
          </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
        <p className="col-span-2 text-[11px] text-slate-500">Tant qu'il manque des notes, la moyenne reste indicative.</p>
      </div>
        </div>
        <button disabled={busy} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 ${busy ? "opacity-70" : ""}`}>
          {busy ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (edited ? "Enregistrer les modifications" : "Enregistrer la matière")}
        </button>
      </form>
    </div>
  );
}
