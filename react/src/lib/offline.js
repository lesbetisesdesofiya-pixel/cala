// Couche hors ligne : file IndexedDB + exécution optimiste + synchro arrière-plan.
// Toute écriture passe par persistOp(op, apply, ctx) :
//   en ligne -> exécution directe ; hors ligne -> file + apply(draft) + toast + Background Sync.
import { sb } from "./supabase";
import { moyenneMatiere3Niveaux, badgeDe, evolutionDe } from "./engine";

const r1 = (n) => Math.round(Number(n) * 10) / 10;

export const idb = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (idb.db) return resolve(idb.db);
      if (!("indexedDB" in window)) return reject(new Error("no-idb"));
      const rq = indexedDB.open("classinote_offline", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("ops", { keyPath: "id", autoIncrement: true });
      rq.onsuccess = () => { idb.db = rq.result; resolve(idb.db); };
      rq.onerror = () => reject(rq.error);
    });
  },
  async all() {
    const db = await idb.open();
    return new Promise((res, rej) => {
      const t = db.transaction("ops").objectStore("ops").getAll();
      t.onsuccess = () => res(t.result || []);
      t.onerror = () => rej(t.error);
    });
  },
  async add(op) {
    const db = await idb.open();
    return new Promise((res, rej) => {
      const t = db.transaction("ops", "readwrite").objectStore("ops").add({ ...op, ts: Date.now() });
      t.onsuccess = () => res(t.result);
      t.onerror = () => rej(t.error);
    });
  },
  async del(id) {
    const db = await idb.open();
    return new Promise((res, rej) => {
      const t = db.transaction("ops", "readwrite").objectStore("ops").delete(id);
      t.onsuccess = () => res();
      t.onerror = () => rej(t.error);
    });
  },
};

export async function execOp(op) {
  try {
    await runOnce(op);
  } catch (e) {
    // Colonne pas encore créée côté base (ex. onboarding_termine avant migration SQL) :
    // on retire la colonne inconnue du payload et on rejoue une fois,
    // au lieu de bloquer l'utilisateur (bouton Terminer, synchro file, ...).
    const col = /Could not find the '(\w+)' column/i.exec(e?.message || "")?.[1];
    if (!col || !op.payload || typeof op.payload !== "object" || !(col in op.payload)) throw e;
    const retry = { ...op, payload: { ...op.payload } };
    delete retry.payload[col];
    await runOnce(retry);
  }
}

async function runOnce(op) {
  const q = sb.from(op.table);
  if (op.method === "insert") {
    const { error } = await q.insert(op.payload);
    if (error) throw error;
  } else if (op.method === "upsert") {
    const { error } = await q.upsert(op.payload, { onConflict: op.onConflict });
    if (error) throw error;
  } else if (op.method === "update") {
    let b = q.update(op.payload);
    Object.entries(op.match || {}).forEach(([k, v]) => { b = b.eq(k, v); });
    const { error } = await b;
    if (error) throw error;
  } else if (op.method === "delete") {
    let b = q.delete();
    Object.entries(op.match || {}).forEach(([k, v]) => { b = b.eq(k, v); });
    const { error } = await b;
    if (error) throw error;
  }
}

// Recalcule moyennes + budget + évolution sur un brouillon local (après écriture optimiste).
export function recalcLocalDraft(d) {
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  let totPts = 0, totCoef = 0;
  d.matieres.forEach((m) => {
    const g = { IE: [], DS: [], COMPO: [] };
    (d.notesRaw || []).filter((n) => n.matiere_id === m.id).forEach((n) => {
      if (g[n.type]) g[n.type].push(Number(n.note));
    });
    const nb = g.IE.length + g.DS.length + g.COMPO.length;
    const r = moyenneMatiere3Niveaux({
      IE: avg(g.IE), DS: avg(g.DS), COMPO: avg(g.COMPO),
      dateDS: m.date_ds || null, dateCompo: m.date_compo || null,
    });
    if (r.moy == null) {
      m.moyenne = null; m.sansNotes = true; m.nbDevoirs = 0;
      m.badge = "En attente"; m.type = "";
      return;
    }
    Object.assign(m, { moyenne: r.moy, nbDevoirs: nb, provisoire: r.provisoire, sansNotes: false }, badgeDe(r.moy));
    totPts += r.moy * m.coef; totCoef += m.coef;
  });
  if (totCoef) d.user.moyenneActuelle = +(totPts / totCoef).toFixed(1);
  const entrees = d.transactions.filter((t) => t.montant > 0).reduce((s, t) => s + t.montant, 0);
  const sorties = d.transactions.filter((t) => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0);
  Object.assign(d.budget, { entrees, sorties, solde: entrees - sorties });
  d.onboarding.options = d.matieres.map((m) => ({
    id: m.id, nom: m.nom, coef: m.coef, icon: m.icon, groupe: m.groupe,
    checked: m.checked, difficulte: m.difficulte,
    date_ds: m.date_ds || null, date_compo: m.date_compo || null,
  }));
  d.evolution = evolutionDe(d.notesRaw, d.user.moyenneActuelle);
}

export function notifyOutbox() {
  window.dispatchEvent(new Event("kp-outbox"));
}
