import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/store";

const FILTERS = ["Tous", "Urgents", "Exposés", "Terminés"];

export default function Devoirs() {
  const { db } = useApp();
  const [f, setF] = useState("Tous");
  const list = db.devoirs.filter((d) =>
    f === "Tous" ? true
    : f === "Urgents" ? d.type === "urgent"
    : f === "Exposés" ? d.type === "expose"
    : d.statut === "done"
  );

  return (
    <div className="space-y-4 fade">
      <div>
        <span className="text-[11px] font-bold uppercase text-secondary">Agenda Académique</span>
        <h1 className="text-2xl font-bold text-primary">Mes Devoirs & Exposés</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {FILTERS.map((x) => (
          <button key={x} onClick={() => setF(x)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${f === x ? "bg-primary-container text-white" : "bg-white border"}`}>
            {x}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {!list.length && <p className="text-sm text-slate-500">Aucun devoir dans ce filtre.</p>}
        {list.map((d) => d.statut === "done" ? (
          <article key={d.id} className="bg-slate-100/70 rounded-2xl border p-4 opacity-75">
            <span className="text-xs bg-white px-2 py-1 rounded-lg text-slate-500 line-through">{d.matiere}</span>
            <h2 className="font-semibold text-slate-500 line-through mt-2">{d.titre}</h2>
            <p className="text-xs text-slate-500">{d.description}</p>
          </article>
        ) : (
          <article key={d.id} className={`bg-white rounded-2xl ${d.type === "urgent" ? "border-2 border-secondary-container" : "border"} overflow-hidden shadow-card`}>
            {d.type === "urgent" && (
              <div className="bg-secondary-container px-4 py-2 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base fill">warning</span>
                <span>{d.badgeTop || "À rendre très bientôt"}</span>
                <span className="ml-auto">{d.badgeDate}</span>
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <span className="bg-primary-container text-white text-[11px] px-2.5 py-1 rounded-lg font-semibold">{d.matiere}</span>
                {d.priorite && <span className="bg-secondary-fixed text-[11px] px-2.5 py-1 rounded-lg font-bold">{d.priorite}</span>}
                {d.coef && <span className="bg-surface-container-high text-[11px] px-2 py-1 rounded-lg font-bold">{d.coef}</span>}
              </div>
              <h2 className="font-bold text-primary">{d.titre}</h2>
              <p className="text-xs text-slate-500">{d.description}</p>
              <div className="pt-2 border-t flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>{d.date}
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded">{d.delai}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Link to="/add-devoir" className="inline-flex items-center gap-2 bg-secondary-container font-bold px-5 h-14 rounded-2xl">
        <span className="material-symbols-outlined">add</span>Nouveau devoir
      </Link>
    </div>
  );
}
