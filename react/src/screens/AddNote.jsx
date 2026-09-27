import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { fmtNote, r1, TYPES_EVAL, typeLabel, typeCourt, moyennesParType, simuleMatiere, moyenneMatiere3Niveaux, impactGeneral, anneeScolaireDe, anneeScolaireCourante } from "../lib/engine";
import { track } from "../lib/analytics";

export default function AddNote() {
  const { db, persistOp, reload, recalcServer, needSub, toast } = useApp();
  const nav = useNavigate();
  const [matId, setMatId] = useState(db.matieres[0]?.id || "");
  const [type, setType] = useState("DS");
  const [val, setVal] = useState(14.5);
  const [busy, setBusy] = useState(false);

  const sim = useMemo(() => {
    const m = db.matieres.find((x) => x.id === matId) || db.matieres[0];
    if (!m) return { ng: db.user.moyenneActuelle, delta: 0, poids: 0.25 };
    const base = moyennesParType(db, m.id);
    const poids = (TYPES_EVAL.find((t) => t.id === type) || { poids: 0.25 }).poids;
    const tot = db.matieres.filter((x) => x.moyenne != null).reduce((s, x) => s + x.coef, 0) || 1;
    const ap = simuleMatiere(base, type, val);
    const avant = moyenneMatiere3Niveaux(base);
    const dm = ap.moy == null || avant.moy == null ? 0 : r1(ap.moy - avant.moy);
    const ng = r1(db.user.moyenneActuelle + impactGeneral(dm, m.coef, tot));
    return { ng, delta: r1(ng - db.user.moyenneActuelle), poids, matiere: m };
  }, [db, matId, type, val]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (!(await needSub())) { setBusy(false); return; }
    const m = sim.matiere;
    if (!m) { setBusy(false); return toast("Ajoute d'abord une matière"); }
    try {
      const row = {
        user_id: db._uid, matiere_id: m.id, matiere_nom: m.nom, type,
        titre: `${typeLabel(type)} — ${new Date().toLocaleDateString("fr-FR")}`,
        note: val, coef: 1, evalue_le: new Date().toISOString().slice(0, 10),
        trimestre: db.user.periode,
      };
      const r = await persistOp({ table: "notes", method: "insert", payload: row, touchMoy: true }, (d) => {
        const n = { id: `tmp-${Date.now()}`, matiere_id: row.matiere_id, matiere_nom: row.matiere_nom, titre: row.titre, type: row.type, note: row.note, coef: 1, evalue_le: row.evalue_le, trimestre: row.trimestre };
        n.annee = anneeScolaireDe(n.evalue_le) || d.anneeCourante || anneeScolaireCourante();
        if (n.annee === (d.anneeCourante || anneeScolaireCourante())) d.notesRaw.push(n);
        (d.notesToutes ||= []).push(n);
      });
      if (!r.queued) { await recalcServer(); await reload(); }
      // Jamais la valeur de la note en analytics (donnée scolaire sensible).
      track("note_added", { type, trimestre: row.trimestre });
      toast(`Note ${fmtNote(val)} ajoutée en ${m.nom} — pense à régénérer ta feuille`);
      nav("/notes");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 fade">
      <p className="text-xs bg-surface-container-low p-3 rounded-xl border">Renseigne ton évaluation, l'assistant calcule l'impact en direct. Elle sera rattachée à : <strong>{db.user.periode}</strong> (modifiable dans ton profil).</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-bold text-primary">Matière</label>
          <select value={matId} onChange={(e) => setMatId(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-3 font-bold text-primary">
            {db.matieres.map((m) => <option key={m.id} value={m.id}>{m.nom} — Coef. {m.coef}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-primary">Type d'évaluation</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {TYPES_EVAL.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)}
                className={`py-2.5 rounded-xl text-xs font-bold ${type === t.id ? "bg-primary-container text-white" : "bg-slate-100 text-slate-500"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Interro et DS comptent ×0.25, composition ×0.5. Sans note sur un levier, la moyenne est provisoire.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border text-center">
          <span className="text-[11px] uppercase font-bold text-slate-500">Note sur 20</span>
          <div className="flex items-center justify-center gap-4 mt-1">
            <button type="button" onClick={() => setVal((v) => Math.max(0, r1(v - 0.5)))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold">−</button>
            <span className="text-4xl font-extrabold text-primary">{fmtNote(val)}</span>
            <span className="text-slate-400 font-bold">/20</span>
            <button type="button" onClick={() => setVal((v) => Math.min(20, r1(v + 0.5)))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold">+</button>
          </div>
          <input type="range" min="0" max="20" step="0.5" value={val} onChange={(e) => setVal(Number(e.target.value))} className="mt-3" />
        </div>
        <div className="bg-primary-container text-white rounded-2xl p-4">
          <p className="text-xs text-slate-300">Nouvelle moyenne estimée</p>
          <p className="text-2xl font-extrabold">{fmtNote(sim.ng)} <span className="text-sm font-normal">/ 20</span></p>
          <p className="text-xs text-secondary-container">{sim.delta >= 0 ? "+" : ""}{fmtNote(sim.delta)} pt sur la générale (levier {typeCourt(type)} ×{String(sim.poids).replace(".", ",")})</p>
        </div>
        <button disabled={busy} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 ${busy ? "opacity-70" : ""}`}>
          {busy ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Enregistrer la note"}
        </button>
      </form>
    </div>
  );
}
