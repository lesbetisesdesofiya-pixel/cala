import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { fmtN } from "../lib/engine";
import { track } from "../lib/analytics";

export default function AddTransaction() {
  const { db, persistOp, reload, needSub, toast } = useApp();
  const nav = useNavigate();
  const [txType, setTxType] = useState("depense");
  const [cat, setCat] = useState("bus");
  const [montant, setMontant] = useState(3500);
  const [titre, setTitre] = useState("Dépense campus");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (!(await needSub())) { setBusy(false); return; }
    try {
      const c = db.categoriesTransaction.find((x) => x.id === cat);
      const signed = txType === "depense" ? -Math.abs(montant) : Math.abs(montant);
      const row = {
        user_id: db._uid, titre, categorie: c.nom, detail: "Ajouté via SPA",
        montant: signed, icon: c.icon, recurrent: false,
        effectue_le: new Date().toISOString().slice(0, 10),
      };
      const r = await persistOp({ table: "transactions", method: "insert", payload: row }, (d) => {
        d.transactions.unshift({
          id: `tmp-${Date.now()}`, titre: row.titre, categorie: row.categorie,
          detail: row.detail, montant: signed, icon: row.icon, style: signed > 0 ? "green" : "slate",
        });
      });
      if (!r.queued) await reload();
      // Ni le montant ni le titre : on garde juste la catégorie pour le funnel.
      track("transaction_added", { type: txType, categorie: c.nom });
      toast("Transaction enregistrée");
      nav("/budget");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 fade">
      <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-100 rounded-2xl">
        <button type="button" onClick={() => setTxType("depense")}
          className={`py-3 rounded-xl font-bold ${txType === "depense" ? "bg-white shadow text-red-700" : "text-slate-500"}`}>Dépense</button>
        <button type="button" onClick={() => setTxType("entree")}
          className={`py-3 rounded-xl font-bold ${txType === "entree" ? "bg-white shadow text-emerald-700" : "text-slate-500"}`}>Entrée</button>
      </div>
      <div className="bg-white p-5 rounded-2xl border text-center">
        <span className="text-[11px] uppercase text-slate-500 font-bold">Montant</span>
        <div className="text-4xl font-extrabold text-primary">
          <input type="number" value={montant} min="0" step="100" onChange={(e) => setMontant(Number(e.target.value))} className="w-40 text-center bg-transparent" />
          <span className="text-lg">FCFA</span>
        </div>
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
          {[500, 1000, 2000, 5000].map((s) => (
            <button key={s} type="button" onClick={() => setMontant((v) => v + s)} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-bold">+{fmtN(s)}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {db.categoriesTransaction.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)}
            className={`text-left p-3 rounded-xl border-2 flex items-center gap-3 ${cat === c.id ? "border-primary-container bg-surface-container-low" : "border-slate-200 bg-white"}`}>
            <span className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
              <span className="material-symbols-outlined">{c.icon}</span>
            </span>
            <span>
              <span className="block text-sm font-bold">{c.nom}</span>
              <span className="block text-xs text-slate-500">{c.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div>
        <label className="text-sm font-bold">Intitulé</label>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} className="mt-1 w-full h-12 rounded-xl border px-4" />
      </div>
      <button disabled={busy} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 ${busy ? "opacity-70" : ""}`}>
        {busy ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Enregistrer la transaction"}
      </button>
    </form>
  );
}
