import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { track } from "../lib/analytics";

export default function AddDevoir() {
  const { db, persistOp, reload, needSub, toast } = useApp();
  const nav = useNavigate();
  const [titre, setTitre] = useState("");
  const [mat, setMat] = useState(db.matieres[0]?.nom || "");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("08:00");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (!(await needSub())) { setBusy(false); return; }
    try {
      const iso = date ? new Date(`${date}T${heure || "08:00"}`).toISOString() : null;
      const row = { user_id: db._uid, matiere_nom: mat, titre, description: "Ajouté via SPA", date_limite: iso, priorite: "Normale", type: "maison", statut: "todo" };
      const r = await persistOp({ table: "devoirs", method: "insert", payload: row }, (d) => {
        d.devoirs.unshift({
          id: `tmp-${Date.now()}`, matiere: row.matiere_nom, titre: row.titre, description: row.description,
          date: row.date_limite ? new Date(row.date_limite).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sans date",
          delai: "à venir", priorite: "Normale", coef: "", type: "maison", statut: "todo",
        });
      });
      if (!r.queued) await reload();
      track("devoir_added", { avec_date: !!iso });
      toast("Devoir ajouté");
      nav("/devoirs");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 fade">
      <div>
        <label className="text-sm font-bold">Intitulé</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : DS Chapitre Probabilités"
          className="mt-1 w-full h-12 rounded-xl border px-4" />
      </div>
      <div>
        <label className="text-sm font-bold">Matière</label>
        <select value={mat} onChange={(e) => setMat(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-3">
          {db.matieres.map((m) => <option key={m.id}>{m.nom}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold">Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-3" />
        </div>
        <div>
          <label className="text-sm font-bold">Heure</label>
          <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-3" />
        </div>
      </div>
      <button disabled={busy} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 ${busy ? "opacity-70" : ""}`}>
        {busy ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Valider et ajouter à mon agenda"}
      </button>
    </form>
  );
}
