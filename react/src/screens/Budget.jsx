import { Link } from "react-router-dom";
import { useApp } from "../lib/store";
import { fmtN } from "../lib/engine";

export default function Budget() {
  const { db, toast } = useApp();
  const b = db.budget;

  return (
    <div className="space-y-4 fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mon Budget Étudiant</h1>
          <p className="text-xs text-slate-500">Bourses & frais gérés sereinement</p>
        </div>
        <span className="text-xs font-bold bg-white border px-3 py-1.5 rounded-xl flex items-center gap-1">
          <span className="material-symbols-outlined text-base">calendar_month</span>{b.mois}
        </span>
      </div>

      <div className="bg-primary-container text-white rounded-2xl p-5 shadow-navy">
        <span className="text-[11px] uppercase text-slate-300 font-semibold">Solde disponible</span>
        <div className="text-4xl font-extrabold my-1">{fmtN(b.solde)} <span className="text-base text-secondary-container">FCFA</span></div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
          <div className="bg-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-300">Entrées</span>
            <div className="font-bold text-emerald-300">{fmtN(b.entrees)} F</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-300">Sorties</span>
            <div className="font-bold text-secondary-fixed">{fmtN(b.sorties)} F</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border shadow-card">
        <p className="text-sm font-bold text-primary">Prévision fin de mois</p>
        <p className="text-sm text-slate-500">
          Épargne estimée : <strong className="text-primary">{fmtN(b.previsionEpargne)} FCFA</strong> • {b.joursRestants} jours restants
        </p>
        <div className="h-2.5 bg-slate-100 rounded-full mt-2 flex overflow-hidden">
          <div className="bg-primary-container h-full" style={{ width: `${100 - b.pctDepenses}%` }} />
          <div className="bg-secondary-container h-full" style={{ width: `${b.pctDepenses}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => toast("Entrée — utilise le formulaire")} className="h-12 rounded-xl bg-emerald-700 text-white font-semibold">+ Entrée</button>
        <Link to="/add-transaction" className="h-12 rounded-xl bg-primary-container text-white font-semibold flex items-center justify-center">- Dépense</Link>
      </div>

      <h2 className="font-bold text-primary">Transactions récentes</h2>
      <div className="space-y-2.5">
        {db.transactions.map((t) => (
          <div key={t.id} className="bg-white rounded-xl p-3.5 border flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${t.montant > 0 ? "bg-emerald-100 text-emerald-800" : "bg-surface-container-low text-primary"} flex items-center justify-center`}>
                <span className="material-symbols-outlined">{t.icon}</span>
              </div>
              <div>
                <div className="font-bold text-sm text-primary">
                  {t.titre} {t.categorie && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full ml-1">{t.categorie}</span>}
                </div>
                <span className="text-xs text-slate-500">{t.detail}</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`font-bold ${t.montant > 0 ? "text-emerald-700" : "text-primary"}`}>{t.montant > 0 ? "+" : ""}{fmtN(t.montant)}</span>
              <span className="block text-[11px] text-slate-400">FCFA</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-low border rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-2">
        <span className="material-symbols-outlined text-secondary text-lg">lightbulb</span>
        <span><strong>Conseil :</strong> {b.conseil}</span>
      </div>
    </div>
  );
}
