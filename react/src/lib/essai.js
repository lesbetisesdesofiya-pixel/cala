import { sb } from "./supabase";
import { genererFeuille, ciblePeriodeActuelle } from "./engine";
import { stashFeuille } from "./feuille";

// Mode essai anonyme : découvrir son plan AVANT de créer un compte.
// kp_essai = { classe, cible, matieres: [{nom, coef, icon}], at }
const CLE = "kp_essai";

export function buildLocalDb(classe, matieres, cible) {
  return {
    user: {
      moyenneActuelle: 10, moyenneCible: cible,
      regime: "Trimestre", periode: "Trimestre 1", objectifPortee: "annuel",
      classe: classe || "",
    },
    matieres: (matieres || []).map((m, i) => ({
      id: `local-${i}`, nom: m.nom, coef: m.coef, moyenne: null, sansNotes: true,
    })),
    notesRaw: [],
    notesToutes: [],
    objectifs: { cible, echeance: null },
  };
}

export function readEssai() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE) || "null");
    if (s && s.classe && s.cible && Array.isArray(s.matieres) && s.matieres.length) return s;
  } catch {}
  return null;
}

export function writeEssai(essai) {
  try { localStorage.setItem(CLE, JSON.stringify({ ...essai, at: Date.now() })); } catch {}
}

export function clearEssai() {
  try { localStorage.removeItem(CLE); } catch {}
}

// Après inscription : recrée matières + profil + brouillon depuis l'essai.
// (objectifs : RLS exige un abo — la ligne est créée au paywall via savePendingFeuille.)
export async function migrateEssai(uid, essai, reload) {
  for (const m of essai.matieres) {
    const { error } = await sb.from("matieres").insert({
      user_id: uid, nom: m.nom, coef: m.coef, icon: m.icon || "menu_book",
      groupe: "Tronc commun", difficulte: 3, moyenne: 10, nb_devoirs: 0, checked: true,
    });
    if (error) throw error;
  }
  const { error: e2 } = await sb.from("profiles").update({
    classe: essai.classe, serie: essai.classe,
    onboarding_termine: true, moyenne_cible: essai.cible,
  }).eq("id", uid);
  if (e2) throw e2;
  const db = await reload(uid);
  if (!db) throw new Error("reload");
  const eff = ciblePeriodeActuelle(db, essai.cible).cibleEffective;
  const g = genererFeuille(db, eff);
  const draft = {};
  Object.keys(g.targets).forEach((id) => {
    const m = db.matieres.find((x) => x.id === id);
    draft[id] = { ...g.targets[id], base: m && !m.sansNotes ? m.moyenne : null };
  });
  stashFeuille(draft, essai.cible, null, { uid, periode: db.user.periode, portee: "annuel" });
  return db;
}
