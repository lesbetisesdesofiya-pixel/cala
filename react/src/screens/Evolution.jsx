import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { fmtNote, r1, TYPES_EVAL, evolutionDe, anneeScolaireDe, anneeScolaireCourante } from "../lib/engine";
import { track } from "../lib/analytics";

export default function Evolution() {
  const { db, persistOp, reload, recalcServer, needSub, toast } = useApp();
  // Historique complet (toutes années scolaire) ; le filtre "année" décide de
  // ce qu'on affiche. L'année courante est celle d'aujourd'hui.
  const toutes = db.notesToutes || db.notesRaw || [];
  const anneeCourante = db.anneeCourante || anneeScolaireCourante();
  const anneeDe = (n) => n.annee || anneeScolaireDe(n.evalue_le) || anneeCourante;
  const [annee, setAnnee] = useState(anneeCourante);
  const [periode, setPeriode] = useState("Année entière");
  const [matiere, setMatiere] = useState("Toutes les matières");
  const [type, setType] = useState("Tous");
  const [confirmDel, setConfirmDel] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editType, setEditType] = useState(null);
  const [editVal, setEditVal] = useState(null);

  const annees = useMemo(
    () => [...new Set(toutes.map(anneeDe))].sort().reverse(),
    [toutes] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const notesVue = useMemo(
    () => toutes.filter((n) => anneeDe(n) === annee),
    [toutes, annee] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const moyVue = notesVue.length
    ? notesVue.reduce((s, n) => s + Number(n.note), 0) / notesVue.length
    : null;
  const ev = useMemo(
    () => evolutionDe(notesVue, annee === anneeCourante ? Number(db.user.moyenneActuelle) : (moyVue ?? 0)),
    [notesVue, annee, anneeCourante, db.user.moyenneActuelle, moyVue]
  );
  // Comparaison inter-années : l'année sélectionnée vs la précédente.
  const idxA = annees.indexOf(annee);
  const prevAnnee = idxA >= 0 && idxA < annees.length - 1 ? annees[idxA + 1] : null;
  const moyPrev = useMemo(() => {
    if (!prevAnnee) return null;
    const ns = toutes.filter((n) => anneeDe(n) === prevAnnee);
    return ns.length ? ns.reduce((s, n) => s + Number(n.note), 0) / ns.length : null;
  }, [toutes, prevAnnee]); // eslint-disable-line react-hooks/exhaustive-deps
  const deltaAnnee = moyPrev != null && moyVue != null ? r1(moyVue - moyPrev) : null;
  // Filtre matière : si la matière n'existe pas dans l'année choisie, on retombe
  // sur "Toutes" plutôt que d'afficher une liste vide.
  const matActive = ev.matieresChips.some((c) => c.nom === matiere) ? matiere : "Toutes les matières";

  const gm = {};
  notesVue.filter((n) => n.evalue_le).forEach((n) => {
    const k = new Date(n.evalue_le).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    (gm[k] ||= []).push(Number(n.note));
  });
  const gk = Object.keys(gm);
  const ga = gk.map((k) => r1(gm[k].reduce((s, v) => s + v, 0) / gm[k].length));
  const X = (i) => (gk.length <= 1 ? 175 : Math.round(30 + (i * 290) / (gk.length - 1)));
  const Y = (v) => Math.max(12, Math.min(148, Math.round(265 - 15 * v)));
  const dLine = ga.map((v, i) => `${i ? "L" : "M"} ${X(i)},${Y(v)}`).join(" ");
  const dArea = ga.length ? `${dLine} L ${X(ga.length - 1)},150 L ${X(0)},150 Z` : "";
  const last = ga.length ? ga[ga.length - 1] : null;
  const prev = ga.length > 1 ? ga[ga.length - 2] : null;
  const dMonth = prev == null || last == null ? 0 : r1(last - prev);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const hist = ev.historique.map((g) => {
    const items = g.items
      .filter((it) => matActive === "Toutes les matières" || it.matiere === matActive)
      .filter((it) => type === "Tous" || it.typeRaw === type);
    if (!items.length) return null;
    return (
      <div key={g.mois} className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{g.mois}</span>
          <div className="flex-1 h-px bg-surface-variant/50" />
        </div>
        {items.map((it) => (
          <div key={it.id} className="bg-surface-container-lowest p-3.5 rounded-2xl border border-primary/5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex flex-col items-center justify-center font-bold text-xs">
                <span>{it.type}</span>
                <span className="text-[9px] font-normal">Coeff {it.coef}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-primary">{it.matiere}</h4>
                  <span className="text-[10px] text-on-surface-variant">• {it.date}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{it.titre}</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`px-2.5 py-1 rounded-full text-sm font-bold ${it.note >= 16 ? "bg-amber-100 text-secondary" : "bg-slate-100 text-primary"}`}>
                {fmtNote(it.note)} <span className="text-[10px] font-normal">/20</span>
              </div>
              <div className="flex gap-1 justify-end mt-1.5">
                <button title="Modifier" onClick={() => { setEditId(it.id); setEditType(null); setEditVal(null); setConfirmDel(null); }}
                  className="w-8 h-8 rounded-lg bg-slate-100 text-primary flex items-center justify-center active:scale-95">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button title="Supprimer"
                  onClick={async () => {
                    if (confirmDel !== it.id) { setConfirmDel(it.id); toast("Re-clique pour confirmer la suppression"); return; }
                    if (!(await needSub())) return;
                    try {
                      const r = await persistOp({ table: "notes", method: "delete", match: { id: it.id }, touchMoy: true }, () => {});
                      setConfirmDel(null);
                      if (!r.queued) { await recalcServer(); await reload(); }
                      else await reload();
                      toast("Note supprimée");
                    } catch (err) { toast("Erreur : " + err.message); }
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 ${confirmDel === it.id ? "bg-error text-white px-2 w-auto text-[11px] font-bold" : "bg-slate-100 text-error"}`}>
                  {confirmDel === it.id ? "Sûr ?" : <span className="material-symbols-outlined text-[18px]">delete</span>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  });

  const editNote = toutes.find((x) => x.id === editId);
  const eType = editType ?? editNote?.type ?? "DS";
  const eVal = editVal ?? editNote?.note ?? 10;

  const saveEdit = async () => {
    if (!(await needSub())) return;
    try {
      const r = await persistOp(
        { table: "notes", method: "update", payload: { note: Number(eVal), type: eType }, match: { id: editId }, touchMoy: true },
        () => {}
      );
      setEditId(null); setEditType(null); setEditVal(null);
      if (!r.queued) { await recalcServer(); await reload(); }
      else await reload();
      toast("Note modifiée");
    } catch (err) { toast("Erreur : " + err.message); }
  };

  return (
    <div className="space-y-5 fade">
      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">school</span>
            <span className="text-sm font-bold text-primary">Parcours Scolaire</span>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-full border border-secondary-container/20">
            <span className="material-symbols-outlined text-secondary text-sm">trending_up</span>
            <span className="text-[11px] font-bold text-secondary">{ev.progressionAns}</span>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center space-x-2 min-w-max">
            {ev.parcours.map((p, i) => (
              <span key={i} className="flex items-center space-x-2">
                {i > 0 && <span className="text-outline-variant text-xs font-bold">›</span>}
                {p.actif ? (
                  <button className="px-3.5 py-1.5 rounded-xl bg-primary text-surface-container-lowest text-[11px] font-bold shadow-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                    <span>{p.label}</span>
                  </button>
                ) : (
                  <button className="px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface-variant text-[11px] font-semibold hover:bg-surface-container">{p.label}</button>
                )}
              </span>
            ))}
          </div>
        </div>
        {annees.length > 1 && (
          <div className="mt-3 pt-3 border-t border-surface-variant/40 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {annees.map((a) => (
                <button key={a} onClick={() => { setAnnee(a); track("evolution_year_viewed", { annee: a }); }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 ${annee === a ? "bg-primary text-surface-container-lowest shadow-md" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"}`}>
                  {a === anneeCourante && <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />}
                  <span>{a}</span>
                  {a === anneeCourante && <span className="font-semibold opacity-75">en cours</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary text-[11px] font-bold">
                Moy. {moyVue == null ? "—" : fmtNote(moyVue)}/20
              </span>
              {deltaAnnee != null && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${deltaAnnee >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"}`}>
                  {deltaAnnee >= 0 ? "+" : ""}{fmtNote(deltaAnnee)} pt vs {prevAnnee}
                </span>
              )}
              <span className="text-[11px] text-on-surface-variant">{ev.totalNotes} note{ev.totalNotes > 1 ? "s" : ""} cette année</span>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="bg-surface-container-low p-1 rounded-2xl flex items-center text-center border border-surface-variant/30">
          {ev.periodes.map((p) => (
            <button key={p} onClick={() => setPeriode(p)}
              className={`flex-1 py-1.5 rounded-xl text-xs ${periode === p ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "text-on-surface-variant font-medium"}`}>
              {p}
            </button>
          ))}
          <span className="px-2 text-on-surface-variant"><span className="material-symbols-outlined text-lg">date_range</span></span>
        </div>
        <div className="overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center space-x-2 min-w-max">
            <button onClick={() => setMatiere("Toutes les matières")}
              className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold shadow-sm ${matActive === "Toutes les matières" ? "bg-primary text-surface-container-lowest" : "bg-surface-container-lowest border border-surface-variant/40"}`}>
              Toutes les matières
            </button>
            {ev.matieresChips.map((c) => (
              <button key={c.nom} onClick={() => setMatiere(c.nom)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-variant/40 text-[11px] font-medium hover:bg-surface-container-low ${matActive === c.nom ? "ring-2 ring-primary" : ""}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${c.couleur}`} />
                <span>{c.nom}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-on-surface-variant whitespace-nowrap mr-1">Types :</span>
          {ev.typesEpreuve.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] ${type === t.id ? "bg-secondary-container font-bold" : "bg-surface-container-lowest border border-surface-variant/40 text-on-surface-variant font-medium"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-primary/5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant uppercase font-bold">Dynamique Générale</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 className="text-[22px] font-extrabold text-primary">{last == null ? "—" : fmtNote(last)} <span className="text-sm font-semibold text-on-surface-variant">/ 20</span></h2>
              {last != null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dMonth >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"}`}>
                  {dMonth >= 0 ? "+" : ""}{fmtNote(dMonth)} pt
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div className="flex items-center justify-end gap-1.5"><span className="w-2.5 h-0.5 bg-secondary-container" /><span className="text-[10px] text-on-surface-variant">Bien (14.0)</span></div>
            <div className="flex items-center justify-end gap-1.5"><span className="w-2.5 h-0.5 bg-outline-variant" /><span className="text-[10px] text-on-surface-variant">Admis (10.0)</span></div>
          </div>
        </div>
        <div className="relative w-full h-52 pt-2">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 340 180">
            <defs>
              <linearGradient id="academicGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#ffb702" stopOpacity="0.32" />
                <stop offset="65%" stopColor="#ffb702" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#ffb702" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="20" x2="330" y1="25" y2="25" stroke="#e5eeff" strokeDasharray="3 3" /><text x="14" y="28" fontSize="8" fill="#74777e" textAnchor="end">16</text>
            <line x1="20" x2="330" y1="55" y2="55" stroke="#ffdea9" strokeDasharray="4 4" /><text x="14" y="58" fontSize="8" fill="#6b4b00" fontWeight="600" textAnchor="end">14</text>
            <line x1="20" x2="330" y1="85" y2="85" stroke="#e5eeff" strokeDasharray="3 3" /><text x="14" y="88" fontSize="8" fill="#74777e" textAnchor="end">12</text>
            <line x1="20" x2="330" y1="115" y2="115" stroke="#d3e4fe" strokeDasharray="2 2" /><text x="14" y="118" fontSize="8" fill="#314863" fontWeight="600" textAnchor="end">10</text>
            <path d={dArea} fill="url(#academicGradient)" />
            <path d={dLine} fill="none" stroke="#0f2942" strokeLinecap="round" strokeWidth="3" />
            {ga.map((v, i) => (
              <circle key={i} cx={X(i)} cy={Y(v)} r="3.5" fill="#fff" stroke="#0f2942" strokeWidth="2.5" />
            ))}
            {last != null && (
              <>
                <circle cx={X(ga.length - 1)} cy={Y(last)} r="7" fill="#ffb702" fillOpacity="0.25" />
                <circle cx={X(ga.length - 1)} cy={Y(last)} r="4.5" fill="#ffb702" stroke="#0f2942" strokeWidth="2.5" />
              </>
            )}
            {!ga.length && <text x="175" y="90" fontSize="11" fill="#74777e" textAnchor="middle">Ajoute ta première note pour voir ta courbe</text>}
          </svg>
          {last != null && (
            <div className="absolute -top-3 right-0 bg-primary text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary-container" />
              <div>
                <p className="text-[10px] text-surface-container-high">{cap(gk[gk.length - 1])} (actuel)</p>
                <p className="text-xs font-bold">{fmtNote(last)}/20 <span className="text-secondary-fixed text-[11px]">({dMonth >= 0 ? "+" : ""}{fmtNote(dMonth)})</span></p>
              </div>
            </div>
          )}
          <div className="flex justify-between text-[10px] text-on-surface-variant px-2 pt-2">
            {gk.length ? gk.map((k, i) => (
              <span key={k} className={i === gk.length - 1 ? "font-bold text-primary" : ""}>{cap(k.split(" ")[0].slice(0, 3))}</span>
            )) : <span>Aucune donnée</span>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        {ev.metriques.map((m) => (
          <div key={m.label} className="bg-surface-container-lowest p-3 rounded-2xl border border-primary/5 shadow-sm text-center">
            <div className={`w-7 h-7 mx-auto mb-1.5 rounded-full ${m.style === "amber" ? "bg-amber-50 text-secondary" : m.style === "green" ? "bg-emerald-50 text-emerald-600" : "bg-surface-container text-primary"} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-base">{m.icon}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">{m.label}</p>
            <p className={`text-base font-extrabold ${m.style === "green" ? "text-emerald-700" : m.style === "amber" ? "text-secondary" : "text-primary"} mt-0.5`}>
              {m.valeur}<span className="text-xs font-normal text-on-surface-variant">{m.unite ? " " + m.unite : "/20"}</span>
            </p>
            <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded text-secondary-container bg-surface-container-highest">{m.badge}</span>
          </div>
        ))}
      </section>

      <section className="bg-gradient-to-r from-tertiary-container to-tertiary rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined font-bold text-xl">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Projection ClassiNote</h3>
              <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full text-secondary-fixed font-bold">Bac {annee.split("-")[1]}</span>
            </div>
            <p className="text-xs mt-1 text-white/85">{ev.projection}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 pb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-primary">Historique des Évaluations</h3>
          <span className="text-[11px] text-on-surface-variant">{ev.totalNotes} notes enregistrées</span>
        </div>
        {hist.every((h) => !h) && <p className="text-xs text-on-surface-variant">Aucune note pour ce filtre.</p>}
        {hist}
      </section>

      {editNote && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4" style={{ background: "rgba(0,20,40,.45)" }}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-primary">Modifier la note</h3>
              <button onClick={() => { setEditId(null); setEditType(null); setEditVal(null); }} className="w-9 h-9 rounded-xl bg-slate-100 font-bold">x</button>
            </div>
            <p className="text-xs text-slate-500">{editNote.matiere_nom} • {editNote.titre}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPES_EVAL.map((t) => (
                <button key={t.id} onClick={() => setEditType(t.id)}
                  className={`py-2 rounded-xl text-xs font-bold ${eType === t.id ? "bg-primary-container text-white" : "bg-slate-100 text-slate-500"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setEditVal((v) => Math.max(0, ((v ?? editNote.note)) - 0.5))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-xl">-</button>
              <span className="text-4xl font-extrabold text-primary">{fmtNote(eVal)}</span>
              <span className="font-bold text-slate-400">/20</span>
              <button onClick={() => setEditVal((v) => Math.min(20, ((v ?? editNote.note)) + 0.5))} className="w-12 h-12 rounded-xl bg-slate-100 font-bold text-xl">+</button>
            </div>
            <button onClick={saveEdit} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary">Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}
