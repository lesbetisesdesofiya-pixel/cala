import { sb } from "./supabase";

// Version du moteur de plan : incr quand genererFeuille change, pour invalider
// les vieux brouillons (stash) calculés par un ancien moteur.
export const PLAN_MOTEUR_V = 2;

// Sauvegarde une feuille mise en attente (kp_feuille) après paiement :
// ligne objectif + cible profil + cibles par matière. Retourne true si fait.
export async function savePendingFeuille(db) {
  const saved = readStashedFeuille();
  if (!saved) return false;
  // Brouillon d'un autre compte (même navigateur) : jamais appliqué.
  if (saved.uid && saved.uid !== db._uid) return false;
  const cible = saved.cibleDial ?? db.user.moyenneCible;
  const { error: e0 } = await sb.from("objectifs").insert({
    user_id: db._uid, actuel: db.user.moyenneActuelle, cible,
    faisabilite: 85, echeance: saved.echeance || db.objectifs.echeance,
  });
  if (e0) throw e0;
  const rows = Object.entries(saved.feuille).map(([matiere_id, t]) => {
    const m = db.matieres.find((x) => x.id === matiere_id);
    return {
      user_id: db._uid, matiere_id, matiere_nom: m ? m.nom : "",
      cible_ie: t.IE, cible_ds: t.DS, cible_compo: t.COMPO,
      base_moy: t.base == null ? (m && !m.sansNotes ? m.moyenne : null) : t.base,
      periode: db.user.periode,
    };
  });
  // Contrainte live : (user_id, matiere_id, periode). Si la base n'est pas
  // migrée (ancien couple 2 colonnes), on retente une fois avec l'ancien.
  if (rows.length) {
    let { error } = await sb.from("cibles_matieres").upsert(rows, { onConflict: "user_id,matiere_id,periode" });
    if (error && /on conflict|constraint/i.test(error.message || "")) {
      ({ error } = await sb.from("cibles_matieres").upsert(rows, { onConflict: "user_id,matiere_id" }));
    }
    if (error) throw error;
  }
  const { error: e3 } = await sb.from("profiles").update({ moyenne_cible: cible }).eq("id", db._uid);
  if (e3) throw e3;
  try { localStorage.removeItem("kp_feuille"); } catch {}
  return true;
}

export function stashFeuille(feuille, cibleDial, echeance, meta) {
  try {
    localStorage.setItem("kp_feuille", JSON.stringify({
      v: PLAN_MOTEUR_V, feuille, cibleDial, echeance,
      uid: meta?.uid || null,
      periode: meta?.periode || null, portee: meta?.portee || null,
    }));
  } catch {}
}

export function readStashedFeuille() {
  try {
    const s = JSON.parse(localStorage.getItem("kp_feuille") || "null");
    if (!s || s.v !== PLAN_MOTEUR_V) return null; // vieux moteur : brouillon ignoré, régénéré
    if (s?.feuille && Object.keys(s.feuille).length) return s;
  } catch {}
  return null;
}
