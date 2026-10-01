// Moteur ClassiNote — fonctions pures (testables), sans dépendance au store.
export const r1 = (n) => Math.round(Number(n) * 10) / 10;
export const avg = (a) => (a && a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export const fmtNote = (n) => String(Number(n).toFixed(1)).replace(".", ",");
export const fmtN = (n) => Number(n).toLocaleString("fr-FR").replace(/ /g, " ");

export const TYPES_EVAL = [
  { id: "IE", label: "Interrogation", court: "interro", poids: 0.25 },
  { id: "DS", label: "Devoir Surveillé", court: "devoir", poids: 0.25 },
  { id: "COMPO", label: "Composition", court: "compo", poids: 0.5 },
];
export const typeLabel = (t) => (TYPES_EVAL.find((x) => x.id === t) || { label: t }).label;
export const typeCourt = (t) => (TYPES_EVAL.find((x) => x.id === t) || { court: t }).court;

export const ICON_GROUPE_FALLBACK = {
  functions: "Enseignement de spécialité", science: "Enseignement de spécialité",
  psychology: "Sciences & Vivant", biotech: "Sciences & Vivant",
  auto_stories: "Tronc commun", menu_book: "Tronc commun",
  language: "Langues vivantes", translate: "Option facultative",
  public: "Sciences humaines", account_balance: "Sciences humaines",
  sports_soccer: "Sport & Santé",
};
export const mentionDe = (c) =>
  c >= 16 ? "Très Bien" : c >= 14 ? "Bien" : c >= 12 ? "Assez Bien" : c >= 10 ? "Passable" : "—";
export const badgeDe = (m) =>
  m >= 16 ? { badge: "Excellent", type: "ok" }
  : m >= 14 ? { badge: "Très bien", type: "ok" }
  : m >= 10 ? { badge: "Passable", type: "moyen" }
  : { badge: "À booster", type: "alerte" };

export const DIFF_LABELS = ["", "Facile", "Abordable", "Moyenne", "Difficile", "Très difficile"];
export const diffLabel = (d) => {
  const v = Math.min(5, Math.max(1, Math.round(d) || 3));
  return `${DIFF_LABELS[v]} (${v}/5)`;
};
// Cap unique des notes CIBLES (plan) : 18 pour tous les leviers.
// Les vraies notes saisies restent 0-20 (décimales possibles côté réel).
export const PLAFOND_CIBLE = 18;
// Affichage plan : entier sans ",0" ("16"), décimal sinon ("16,5"), "—" si vide.
export const fmtPlan = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : fmtNote(v);
};
export const diffImpliquee = (moy) =>
  moy == null ? 3 : moy >= 15 ? 1 : moy >= 13 ? 2 : moy >= 11 ? 3 : moy >= 9 ? 4 : 5;

export function moyennesParType(db, matiereId) {
  const g = { IE: [], DS: [], COMPO: [] };
  (db.notesRaw || []).filter((n) => n.matiere_id === matiereId).forEach((n) => {
    if (g[n.type]) g[n.type].push(Number(n.note));
  });
  const m = (db.matieres || []).find((x) => x.id === matiereId) || {};
  return {
    IE: avg(g.IE), DS: avg(g.DS), COMPO: avg(g.COMPO),
    nIE: g.IE.length, nDS: g.DS.length, nCOMPO: g.COMPO.length,
    dateDS: m.date_ds || null, dateCompo: m.date_compo || null,
  };
}

// Niveau 1 : hybride — levier manquant ignoré (provisoire) AVANT sa date, = 0 APRÈS.
export function moyenneMatiere3Niveaux({ IE, DS, COMPO, dateDS, dateCompo }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const passe = (d) => {
    if (!d) return false;
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    return x < today;
  };
  const vDS = DS != null ? DS : passe(dateDS) ? 0 : null;
  const vC = COMPO != null ? COMPO : passe(dateCompo) ? 0 : null;
  const vI = IE;
  let sous = null;
  if (vI != null && vDS != null) sous = (vI + vDS) / 2;
  else sous = vI != null ? vI : vDS;
  if (sous == null && vC == null) return { moy: null, provisoire: false };
  const skip = vI == null || (DS == null && !passe(dateDS)) || (COMPO == null && !passe(dateCompo));
  if (sous == null) return { moy: r1(vC), provisoire: true };
  if (vC == null) return { moy: r1(sous), provisoire: skip };
  return { moy: r1((sous + vC) / 2), provisoire: skip };
}

export function moyenneGenerale(liste) {
  const valides = liste.filter((m) => m.moyenne != null);
  const tot = valides.reduce((s, m) => s + m.coef, 0);
  if (!tot) return null;
  return r1(valides.reduce((s, m) => s + m.moyenne * m.coef, 0) / tot);
}

export function impactGeneral(deltaMat, coefJ, totCoef) {
  return totCoef ? r1((deltaMat * coefJ) / totCoef) : 0;
}

export function simuleMatiere(base, type, note) {
  const b = { ...base };
  if (type === "COMPO") b.COMPO = note;
  else if (type === "DS") b.DS = note;
  else {
    const s = (b.IE == null ? 0 : b.IE * b.nIE) + note;
    b.nIE = b.nIE + 1;
    b.IE = r1(s / b.nIE);
  }
  return moyenneMatiere3Niveaux(b);
}

export function tendanceStats(notes) {
  const y = notes.slice(-4).map(Number);
  if (y.length < 2) return { pente: 0, sigma: 0 };
  const n = y.length, xm = (n - 1) / 2, ym = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  y.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) * (i - xm); });
  const pente = den ? num / den : 0;
  const sigma = Math.sqrt(y.reduce((s, v) => s + (v - ym) * (v - ym), 0) / n);
  return { pente: r1(pente), sigma: r1(sigma) };
}

export function gainLevier(m, base, type, totCoef, cible) {
  const avant = moyenneMatiere3Niveaux(base);
  if (avant.moy == null) return { gainMat: 0, gainGen: 0, cible };
  const apres = simuleMatiere(base, type, cible);
  const gainMat = r1(apres.moy - avant.moy);
  return { gainMat, gainGen: impactGeneral(gainMat, m.coef, totCoef) };
}

export function recommandations(db) {
  const valides = db.matieres.filter((m) => m.moyenne != null && !m.sansNotes);
  const totCoef = valides.reduce((s, m) => s + m.coef, 0);
  if (!valides.length || !totCoef) return [];
  const feats = valides.map((m) => {
    const base = moyennesParType(db, m.id);
    const ns = (db.notesRaw || []).filter((n) => n.matiere_id === m.id).map((n) => Number(n.note));
    const { pente, sigma } = tendanceStats(ns);
    const marge = (20 - m.moyenne) / 20;
    const leviers = TYPES_EVAL.map((t) => {
      const ref = base[t.id] == null ? m.moyenne : base[t.id];
      const cible = Math.min(20, r1(Math.round((ref + 2) * 2) / 2));
      const { gainMat, gainGen } = gainLevier(m, base, t.id, totCoef, cible);
      return { type: t.id, label: t.label, court: t.court, ref: r1(ref), cible, gainMat, gainGen };
    }).sort((a, b) => b.gainGen - a.gainGen);
    return { m, base, pente, sigma, marge, meilleur: leviers[0] };
  });
  const norm = (vals) => {
    const mn = Math.min(...vals), mx = Math.max(...vals);
    return mx === mn ? vals.map(() => 0.5) : vals.map((v) => (v - mn) / (mx - mn));
  };
  const nT = norm(feats.map((f) => f.pente));
  const nV = norm(feats.map((f) => 1 / (1 + f.sigma)));
  const ranges = [...feats].sort((a, b) => a.m.moyenne - b.m.moyenne);
  const labels = ["Priorité absolue", "À renforcer", "Sécurisation"];
  return feats
    .map((f, i) => {
      const pct = valides.length > 1 ? ranges.indexOf(f) / (valides.length - 1) : 0.5;
      const diffF = (6 - (f.m.difficulte || 3)) / 5;
      const facilite = r1((0.3 * nT[i] + 0.2 * nV[i] + 0.3 * f.marge + 0.2 * pct) * (0.5 + 0.5 * diffF));
      return { ...f, percentile: r1(pct), facilite, score: r1(f.meilleur.gainGen * facilite) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r, i) => ({ ...r, rang: labels[i] || `Piste ${i + 1}` }));
}

export function phraseConseil(r) {
  const auLevier =
    r.meilleur.type === "IE" ? "à ta prochaine interro"
    : r.meilleur.type === "DS" ? "au prochain DS"
    : "à la composition";
  const constat = `En ${r.m.nom} (${fmtNote(r.m.moyenne)}/20)`;
  const action = `vise ${fmtNote(r.meilleur.cible)}/20 ${auLevier} de ${r.meilleur.label.toLowerCase()} (actuellement ${fmtNote(r.meilleur.ref)})`;
  const benefice =
    r.meilleur.gainGen > 0
      ? `ta matière prend +${fmtNote(r.meilleur.gainMat)} et ta moyenne générale +${fmtNote(r.meilleur.gainGen)}.`
      : "pour consolider ta moyenne.";
  const ton =
    r.m.moyenne < 10 ? "Quelques révisions ciblées et ça remonte vite. "
    : r.m.moyenne >= 14 ? "Excellent travail, on sécurise. "
    : "";
  return `${ton}${constat}, ${action} — ${benefice}`;
}

// ---------- Plan : objectifs matière puis répartition ENTIÈRE ----------
// Règle stricte : cibles ENTIÈRES, et les 3 d'une matière TOUJOURS différentes.
// Split : IE = T-1 < COMPO = T < DS = T+1 (montée IE -> compo -> pic DS),
// clampé à 18, compensation si un plafond mord (cas T=18 : repli 18/18/18).
export function repartirEntier(T) {
  T = Math.round(T);
  const clamp = (v) => Math.min(PLAFOND_CIBLE, Math.max(0, Math.round(v)));
  const t = { IE: clamp(T - 1), DS: clamp(T + 1), COMPO: clamp(T) };
  const order = ["IE", "DS", "COMPO"];
  let guard = 0;
  while (moyenneMatiere3Niveaux(t).moy < T && guard++ < 40) {
    const low = order.filter((k) => t[k] < PLAFOND_CIBLE).sort((a, b) => t[a] - t[b])[0];
    if (!low) break;
    t[low] = clamp(t[low] + 1);
  }
  return t;
}

// Phase 1 : objectifs ENTIERS par matière depuis la cible globale.
// Départ base = moyenne réelle arrondie, sinon 10. Glouton +1 sur le score
// coef x facilité x marge restante (rendements décroissants).
export function objectifsParMatiere(matieres, cible) {
  const mats = matieres || [];
  const tot = mats.reduce((s, m) => s + (m.coef || 0), 0);
  const cap = PLAFOND_CIBLE;
  const T = {}; const base = {};
  mats.forEach((m) => { base[m.id] = Math.round(m.moyenne ?? 10); T[m.id] = base[m.id]; });
  const proj = () => {
    let pts = 0;
    mats.forEach((m) => { pts += T[m.id] * m.coef; });
    return tot ? pts / tot : 0;
  };
  let iter = 0;
  while (proj() < cible && iter++ < 200) {
    let best = null;
    mats.forEach((m) => {
      if (T[m.id] >= cap) return;
      const ease = (6 - (m.difficulte || 3)) / 5;
      const span = Math.max(1, cap - base[m.id]);
      const head = (cap - T[m.id]) / span;
      if (head <= 0) return;
      const score = ((1 * m.coef) / tot) * ease * head;
      if (!best || score > best.score) best = { id: m.id, score };
    });
    if (!best) break;
    T[best.id] = Math.min(cap, T[best.id] + 1);
  }
  const projete = r1(proj());
  return { objectifs: T, projete, atteignable: projete >= cible };
}
export const PERIODES = {
  Trimestre: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
  Semestre: ["Semestre 1", "Semestre 2"],
};

// Moyenne générale sur les seules notes taguées d'une période (null si aucune).
// Cibles figées de la période en cours (lignes sans période = héritage : comptent
// pour la période actuelle). Les plans d'autres périodes ne fuient jamais ici.
export function ciblesDePeriode(db) {
  const all = db.cibles || {};
  const per = db.user.periode;
  const targets = {};
  Object.keys(all).forEach((id) => {
    if ((all[id].periode || per) === per) targets[id] = all[id];
  });
  return { targets, hasRef: Object.keys(targets).length > 0 };
};

export function moyennePeriode(db, periode) {
  const notes = (db.notesRaw || []).filter((n) => n.trimestre === periode);
  if (!notes.length) return null;
  const byMat = {};
  notes.forEach((n) => { (byMat[n.matiere_id] ||= []).push(n); });
  let pts = 0, tot = 0;
  (db.matieres || []).forEach((m) => {
    const ns = byMat[m.id] || [];
    if (!ns.length) return;
    const g = { IE: [], DS: [], COMPO: [] };
    ns.forEach((n) => { if (g[n.type]) g[n.type].push(Number(n.note)); });
    const moy = moyenneMatiere3Niveaux({
      IE: avg(g.IE), DS: avg(g.DS), COMPO: avg(g.COMPO), dateDS: null, dateCompo: null,
    }).moy;
    if (moy == null) return;
    pts += moy * m.coef; tot += m.coef;
  });
  return tot ? r1(pts / tot) : null;
}

// Cible de travail de la période actuelle pour un objectif ANNUEL :
// on compense les périodes passées. Ex : annuel 14, T1 réel 12 ->
// reste (3x14-12)/2 = 15 à viser sur T2+T3.
// Sans passé noté : cible = objectif. Toujours entière, clampée à 20.
export function ciblePeriodeActuelle(db, objectifAnnuel) {
  const regime = db.user.regime === "Semestre" ? "Semestre" : "Trimestre";
  const liste = PERIODES[regime];
  const idx = Math.max(0, liste.indexOf(db.user.periode));
  const finals = liste.slice(0, idx)
    .map((p) => moyennePeriode(db, p))
    .filter((v) => v != null);
  if (!finals.length) return { cibleEffective: Math.round(objectifAnnuel), rattrapage: 0 };
  const rest = Math.max(1, liste.length - finals.length);
  const R = (liste.length * objectifAnnuel - finals.reduce((s, v) => s + v, 0)) / rest;
  return {
    cibleEffective: Math.max(0, Math.min(20, Math.round(R))),
    rattrapage: Math.round(R - objectifAnnuel),
  };
}

export function genererFeuille(db, cible) {
  // Deux phases : objectifs matière entiers (phase 1) puis split entier distinct
  // (phase 2). Toutes les matières participent, y compris sans notes.
  const mats = db.matieres || [];
  const tot = mats.reduce((s, m) => s + (m.coef || 0), 0);
  if (!mats.length || !tot) return { targets: {}, objectifs: {}, projete: null, atteignable: false };
  const { objectifs } = objectifsParMatiere(mats, cible);
  const targets = {};
  mats.forEach((m) => { targets[m.id] = repartirEntier(objectifs[m.id]); });
  let pts = 0;
  mats.forEach((m) => { pts += moyenneMatiere3Niveaux(targets[m.id]).moy * m.coef; });
  const projete = r1(pts / tot);
  return { targets, objectifs, projete, atteignable: projete >= cible };
}

// ---------- Suivi : requis sur ce qui reste, passé figé ----------
// reels : moyennes réelles par levier (ou null si pas encore passé).
// Résout la valeur commune X à viser sur les leviers manquants pour atteindre T.
// Le passé ne bouge jamais : on ne "refait" pas les notes obtenues.
export function requisRestant(reels, T) {
  const order = ["IE", "DS", "COMPO"];
  const missing = order.filter((k) => reels[k] == null);
  const capEff = PLAFOND_CIBLE;
  if (!missing.length) return { valeur: null, missing, impossible: false, horsPlafond: false, cap: capEff };
  if (T == null) return { valeur: null, missing, impossible: false, horsPlafond: false, cap: capEff };
  // Résolution exacte (formule affine en X), puis arrondi à l'ENTIER supérieur :
  // un requis est toujours une note entière, jamais de virgule.
  const exactOf = (x) => {
    const ie = reels.IE ?? x, ds = reels.DS ?? x, co = reels.COMPO ?? x;
    return ((ie + ds) / 2 + co) / 2;
  };
  const m0 = exactOf(0), m20 = exactOf(20);
  const slope = (m20 - m0) / 20;
  if (!(slope > 0)) return { valeur: null, missing, impossible: false, horsPlafond: false, cap: capEff };
  const exact = r1((T - m0) / slope);
  if (exact > 20) return { valeur: Math.ceil(exact - 1e-9), missing, impossible: true, horsPlafond: false, cap: capEff };
  const valeur = Math.max(0, Math.ceil(exact - 1e-9));
  return { valeur, missing, impossible: false, horsPlafond: valeur > capEff, cap: capEff };
}

const LEV_LABEL = { IE: "Interros", DS: "DS", COMPO: "Composition" };

// Situation par matière + globale : plan (référence) vs réel vs projection.
// projection = formule(réel dispo + requis clampé à 20 sur les manquants).
// targets : {matiereId: {IE, DS, COMPO}} = plan de référence (ou brouillon).
export function situationSuivi(db, targets, cible) {
  const perMat = {};
  let ptsP = 0, tot = 0;
  (db.matieres || []).forEach((m) => {
    const t = (targets || {})[m.id];
    const planT = t ? moyenneMatiere3Niveaux(t).moy : null;
    if (planT == null) return;
    const b = moyennesParType(db, m.id);
    const reels = { IE: b.IE, DS: b.DS, COMPO: b.COMPO };
    const reel = moyenneMatiere3Niveaux({ ...reels, dateDS: null, dateCompo: null }).moy;
    const req = requisRestant(reels, planT);
    const fill = req.valeur == null ? null : Math.min(20, req.valeur);
    const projection = moyenneMatiere3Niveaux({
      IE: reels.IE ?? fill, DS: reels.DS ?? fill, COMPO: reels.COMPO ?? fill,
      dateDS: null, dateCompo: null,
    }).moy;
    const ecart = projection == null ? null : r1(projection - planT);
    perMat[m.id] = { planT: r1(planT), reel, req, projection, ecart };
    ptsP += projection * m.coef; tot += m.coef;
  });
  const projection = tot ? r1(ptsP / tot) : null;
  return { perMat, projection, ecart: projection == null ? null : r1(projection - cible) };
}

// Régénération réaliste ENTIÈRE : le réel est gelé (on ne réécrit jamais
// l'historique), on recalcule ce qui est encore possible sur la suite.
// Ne remonte jamais T. Leviers manquants : valeurs ENTIÈRES distinctes.
const OFFSETS_2 = { "IE,DS": [-1, 1], "IE,COMPO": [2, -1], "DS,COMPO": [2, -1] };
export function regenRealiste(db, planRef) {
  const clamp18 = (v) => Math.min(PLAFOND_CIBLE, Math.max(0, Math.round(v)));
  const draft = {}; const objectifs = {}; let tientToujours = true;
  (db.matieres || []).forEach((m) => {
    const t = (planRef.targets || {})[m.id];
    const Told = t ? moyenneMatiere3Niveaux(t).moy : (m.moyenne ?? 10);
    const b = moyennesParType(db, m.id);
    const reels = { IE: b.IE, DS: b.DS, COMPO: b.COMPO };
    const missing = ["IE", "DS", "COMPO"].filter((k) => reels[k] == null);
    if (!missing.length) {
      draft[m.id] = { ...t }; objectifs[m.id] = r1(Told);
      return;
    }
    let nt;
    if (missing.length === 3) {
      nt = repartirEntier(Told); // rien de passé : split entier distinct
    } else {
      const req = requisRestant(reels, Told);
      const X = req.valeur == null ? Math.round(Told) : req.valeur; // entier
      const off = missing.length === 2 ? OFFSETS_2[missing.join(",")] : [0];
      let cand = { ...reels };
      missing.forEach((k, i) => { cand[k] = clamp18(X + (off ? off[i] : 0)); });
      // Vérifie que l'équation tient toujours après clamp, sinon repli uniforme.
      if (moyenneMatiere3Niveaux(cand).moy < Told - 1e-9) {
        cand = { ...reels };
        missing.forEach((k) => { cand[k] = clamp18(X); });
      }
      nt = cand;
    }
    draft[m.id] = nt;
    objectifs[m.id] = moyenneMatiere3Niveaux(nt).moy;
    if (objectifs[m.id] < Told) tientToujours = false;
  });
  return { draft, objectifs, tientToujours };
}

// Phrases prêtes pour l'UI (moteur pur, testable). Nombres entiers affichés
// sans virgule (fmtPlan).
export function phraseReste(req, planT) {
  if (!req || req.valeur == null) return "";
  const ou = req.missing.map((k) => LEV_LABEL[k]).join(" et ");
  if (req.impossible) return `Objectif ${fmtPlan(planT)} désormais impossible : il faudrait ${fmtPlan(req.valeur)}/20 en ${ou}.`;
  if (req.valeur === 0) return `Objectif ${fmtPlan(planT)} déjà en poche, maintiens le cap.`;
  if (req.horsPlafond) return `Pour atteindre ${fmtPlan(planT)}, vise ${fmtPlan(req.valeur)} en ${ou} (au-dessus du plafond ${req.cap} du plan).`;
  return `Pour atteindre ${fmtPlan(planT)}, vise ${fmtPlan(req.valeur)} en ${ou}.`;
}

export function phraseRationale(difficulte) {
  const d = difficulte || 3;
  if (d <= 2) return "Objectif élevé : matière où tu peux sécuriser des points.";
  if (d >= 4) return "Objectif progressif : priorité à la régularité.";
  return "Objectif équilibré : régularité et consolidation.";
}

export function progressionDe(notes) {
  if (notes.length < 2) return 0;
  const avgL = (a) => a.reduce((s, n) => s + Number(n.note), 0) / a.length;
  return +((avgL(notes.slice(-3)) - avgL(notes.slice(0, 3))).toFixed(1));
}

// Année scolaire d'une date : sept.→déc. = Y-(Y+1), janv.→août = (Y-1)-Y.
// Retourne "2025-2026" (chaîne, triable), null si date absente/invalide.
export function anneeScolaireDe(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getFullYear();
  return x.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Année scolaire en cours (aujourd'hui).
export function anneeScolaireCourante() {
  return anneeScolaireDe(new Date());
}

export function evolutionDe(notes, moyenne) {
  const groups = {};
  notes.forEach((n) => {
    const k = n.evalue_le
      ? new Date(n.evalue_le).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : "Sans date";
    (groups[k] ||= []).push(n);
  });
  const keys = Object.keys(groups);
  const first = keys.length ? +fmtNote(groups[keys[0]][0].note).replace(",", ".") : moyenne;
  const last = notes.length ? Number(notes[notes.length - 1].note) : moyenne;
  const top = notes.length ? [...notes].sort((a, b) => b.note - a.note)[0] : null;
  const parMatiere = {};
  notes.forEach((n) => { (parMatiere[n.matiere_nom] ||= []).push(Number(n.note)); });
  let bestProg = null;
  Object.entries(parMatiere).forEach(([m, arr]) => {
    if (arr.length > 1) {
      const d = +(arr[arr.length - 1] - arr[0]).toFixed(1);
      if (!bestProg || d > bestProg.d) bestProg = { m, d };
    }
  });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    progressionAns: `${last - first >= 0 ? "+" : ""}${((last - first).toFixed(1).replace(".", ","))} pts / période`,
    parcours: keys.length
      ? keys.map((k, i) => {
          const a = groups[k].reduce((s, n) => s + Number(n.note), 0) / groups[k].length;
          const lbl = k.split(" ")[0].slice(0, 3) + " (" + a.toFixed(1).replace(".", ",") + ")";
          return i === keys.length - 1 ? { label: lbl, actif: true } : { label: lbl };
        })
      : [{ label: "Tle D (" + fmtNote(moyenne) + ")", actif: true }],
    periodes: ["Année entière", "Semestre 1", "Semestre 2"],
    periodeActive: "Année entière",
    filtreMatiere: "Toutes les matières",
    matieresChips: Object.keys(parMatiere).map((nom, i) => ({
      nom,
      couleur: ["bg-blue-600", "bg-amber-500", "bg-emerald-600", "bg-purple-600", "bg-sky-500"][i % 5],
    })),
    typesEpreuve: [
      { id: "Tous", label: "Tous" },
      { id: "IE", label: "Interrogations" },
      { id: "DS", label: "Devoirs Surveillés" },
      { id: "COMPO", label: "Compositions" },
    ],
    typeActif: "Tous",
    moyenneDynamique: moyenne,
    delta: `${last - moyenne >= 0 ? "+" : ""}${((last - moyenne).toFixed(1).replace(".", ","))} pt`,
    moisActuel: new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) + " (Actuel)",
    mois: keys.length ? keys.map((k) => cap(k.split(" ")[0].slice(0, 3))) : ["Fév"],
    metriques: [
      { label: "Moyenne", valeur: fmtNote(moyenne), badge: "Stable", icon: "analytics", style: "slate" },
      top
        ? { label: "Top Note", valeur: fmtNote(top.note), badge: `${top.matiere_nom} (${top.type})`, icon: "emoji_events", style: "amber" }
        : { label: "Top Note", valeur: "—", badge: "Aucune note", icon: "emoji_events", style: "amber" },
      bestProg
        ? { label: "Progression", valeur: `+${String(bestProg.d).replace(".", ",")}`, unite: "pts", badge: bestProg.m, icon: "rocket_launch", style: "green" }
        : { label: "Progression", valeur: "—", badge: "Ajoute des notes", icon: "rocket_launch", style: "green" },
    ],
    projection: `En maintenant ta cadence, ta projection au Baccalauréat atteint ${fmtNote(Math.min(20, moyenne + 0.6))} / 20.`,
    projectionNote: fmtNote(Math.min(20, moyenne + 0.6)) + " / 20",
    totalNotes: notes.length,
    historique: keys.slice().reverse().map((k) => ({
      mois: cap(k),
      items: groups[k].slice().reverse().map((n) => ({
        id: n.id,
        type: ({ IE: "IE", DS: "DS", COMPO: "Compo" })[n.type] || n.type,
        typeRaw: n.type,
        coef: Number(n.coef),
        matiere: n.matiere_nom,
        date: new Date(n.evalue_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        titre: n.titre,
        note: Number(n.note),
        delta: "—",
        trend: "flat",
      })),
    })),
  };
}
