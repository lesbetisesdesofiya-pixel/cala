import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resetIdentity } from "./analytics";
import { sb } from "./supabase";
import { idb, execOp, recalcLocalDraft, notifyOutbox } from "./offline";
import {
  r1, avg, mentionDe, badgeDe, moyennesParType, moyenneMatiere3Niveaux,
  progressionDe, evolutionDe, ICON_GROUPE_FALLBACK,
  anneeScolaireDe, anneeScolaireCourante,
} from "./engine";
export const APP = { name: "ClassiNote", version: "v2.7.1 (Build 419)", annee: "2024-2025" };
export const CYCLES = ["Collège", "Lycée", "Supérieur"];
export const CLASSES_PAR_CYCLE = {
  Collège: ["6ème", "5ème", "4ème", "3ème"],
  Lycée: ["Seconde A", "Seconde C/D", "Première A", "Première C", "Première D", "Terminale A", "Terminale C", "Terminale D"],
  Supérieur: ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2", "BTS 1", "BTS 2"],
};
export const CATEGORIES = [
  { id: "net", nom: "Forfait Internet", desc: "Pass data & box", icon: "wifi" },
  { id: "bus", nom: "Transports", desc: "Bus, Woro, Gbaka", icon: "directions_bus" },
  { id: "print", nom: "Photocopies", desc: "Polys & fournitures", icon: "print" },
  { id: "food", nom: "Repas CROU", desc: "Resto U & cafétéria", icon: "restaurant" },
  { id: "bourse", nom: "Aide & Bourse", desc: "Soutien familial", icon: "family_restroom" },
  { id: "job", nom: "Petits boulots", desc: "Répétitions & cours", icon: "work_outline" },
];
export const PREMIUM = {
  prix: 1000, devise: "FCFA", periode: "/ mois",
  titre: "Passe au niveau supérieur avec l'Assistant Illimité",
  soustitre: "Toutes les prévisions d'objectifs, conseils personnalisés et gestion de budget à portée de main.",
  avantages: [
    { titre: "Calculs illimités des devoirs", desc: "Cible les notes exactes pour décrocher ta mention.", icon: "check" },
    { titre: "Alertes intelligentes de matières", desc: "Détection automatique sous le seuil critique.", icon: "notifications_active" },
    { titre: "Programmation budget mensuel", desc: "Prévisions des dépenses automatisées.", icon: "account_balance_wallet" },
    { titre: "Rappels prioritaires", desc: "Planification optimisée des dates limites.", icon: "event_upcoming" },
  ],
  operateurs: [
    { nom: "Yas", code: "Yas", couleur: "#0f2942" },
    { nom: "Moov", code: "Moov", couleur: "#005CA9" },
  ],
};
export const BUDGET_CONSEIL =
  "Garde toujours 5 000 FCFA d'urgence pour les impressions de dernière minute et les trajets d'examen.";

const cycleDe = (classe = "") => {
  for (const [cy, list] of Object.entries(CLASSES_PAR_CYCLE)) if (list.includes(classe)) return cy;
  return "Lycée";
};

async function buildDB(uid) {
  const [prof, mat, notes, devs, txs, objs, cib] = await Promise.all([
    sb.from("profiles").select("*").eq("id", uid).single(),
    sb.from("matieres").select("*").eq("user_id", uid).order("nom"),
    sb.from("notes").select("*").eq("user_id", uid).order("evalue_le", { ascending: true }),
    sb.from("devoirs").select("*").eq("user_id", uid).order("date_limite", { ascending: true }),
    sb.from("transactions").select("*").eq("user_id", uid).order("effectue_le", { ascending: false }),
    sb.from("objectifs").select("*, objectif_items(*)").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
    sb.from("cibles_matieres").select("*").eq("user_id", uid),
  ]);
  for (const r of [prof, mat, notes, devs, txs, objs, cib]) {
    if (r.error && r.error.code !== "PGRST116") throw new Error(r.error.message);
  }
  let p = prof.data;
  if (!p) {
    const { data, error } = await sb.from("profiles").insert({ id: uid, prenom: "Élève" }).select().single();
    if (error) throw new Error(error.message);
    p = data;
  }
  const notesToutes = (notes.data || []).map((n) => ({
    id: n.id, matiere_id: n.matiere_id, matiere_nom: n.matiere_nom, titre: n.titre || n.type,
    type: n.type, note: Number(n.note), coef: Number(n.coef), evalue_le: n.evalue_le,
    trimestre: n.trimestre || null,
  }));
  // Année scolaire courante : le calcul (moyennes, plan, progression) ne voit
  // QUE cette année ; l'historique complet reste consultable dans Évolution.
  const anneeCourante = anneeScolaireCourante();
  notesToutes.forEach((n) => { n.annee = anneeScolaireDe(n.evalue_le) || anneeCourante; });
  const notesRaw = notesToutes.filter((n) => n.annee === anneeCourante);
  const db = { _uid: uid, app: APP, notesRaw, notesToutes, anneeCourante };
  const matieres = (mat.data || []).map((m) => {
    const g = { IE: [], DS: [], COMPO: [] };
    notesRaw.filter((n) => n.matiere_id === m.id).forEach((n) => { if (g[n.type]) g[n.type].push(n.note); });
    const a = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
    const calc = moyenneMatiere3Niveaux({
      IE: a(g.IE), DS: a(g.DS), COMPO: a(g.COMPO),
      dateDS: m.date_ds || null, dateCompo: m.date_compo || null,
    });
    const moy = calc.moy;
    return {
      ...m, moyenne: moy,
      ...(moy == null ? { badge: "En attente", type: "" } : badgeDe(moy)),
      nbDevoirs: g.IE.length + g.DS.length + g.COMPO.length,
      groupe: m.groupe || ICON_GROUPE_FALLBACK[m.icon] || "Tronc commun",
      provisoire: calc.moy == null ? false : calc.provisoire,
      sansNotes: calc.moy == null,
      difficulte: Math.min(5, Math.max(1, Number(m.difficulte) || 3)),
    };
  });
  db.matieres = matieres;
  const avecNotes = matieres.filter((m) => !m.sansNotes);
  const faible = [...(avecNotes.length ? avecNotes : matieres)].sort((a, b) => a.moyenne - b.moyenne)[0];
  const entrees = (txs.data || []).filter((t) => t.montant > 0).reduce((s, t) => s + t.montant, 0);
  const sorties = (txs.data || []).filter((t) => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0);
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const joursRestants = Math.max(0, lastDay - now.getDate());
  const mois = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const obj = (objs.data || [])[0] || null;
  const cible = Number(obj?.cible ?? 14.0);
  const prog = progressionDe(notesRaw);
  db.user = {
    prenom: p.prenom, nom: p.nom || "", classe: p.classe, serie: p.serie || p.classe,
    lycee: p.lycee || "", ecole: p.ecole || "", campus: "Campus Abidjan", semestre: p.semestre,
    email: p.email || "", phone: p.phone || "", formule: p.formule,
    moyenneActuelle: Number(p.moyenne_actuelle), moyenneCible: cible,
    progression: prog,     mentionVisee: mentionDe(cible),
    hasPin: !!p.pin_hash, pinHash: p.pin_hash || null,
    // Période scolaire (défauts sûrs si colonnes pas encore migrées).
    regime: p.regime === "Semestre" ? "Semestre" : "Trimestre",
    periode: p.periode || "Trimestre 1",
    objectifPortee: p.objectif_portee === "trimestre" ? "trimestre" : "annuel",
    // ?? true : base pas encore migrée (colonne absente) ou snapshot local ancien
    // -> on ne bloque personne ; après migration, false = onboarding inachevé.
    onboardingTermine: p.onboarding_termine ?? true,
  };
  db.conseilIA = faible ? {
    titre: "Conseil IA personnalisé", priorite: "Priorité 1",
    matiereFaible: `${faible.nom} (${String(faible.moyenne).replace(".", ",")}/20)`, coef: faible.coef,
  } : null;
  db.objectifs = {
    actuel: Number(p.moyenne_actuelle), cible,
    echeance: obj?.echeance || null,
    ecart: +(cible - Number(p.moyenne_actuelle)).toFixed(1),
    mention: "Mention " + mentionDe(cible),
    faisabilite: obj?.faisabilite ?? 85, faisabiliteLabel: "Basé sur tes coefficients réels",
    plan: (obj?.objectif_items || []).map((it) => ({
      matiere: it.matiere_nom, action: it.action, gain: it.gain, icon: "functions", style: "normal",
    })),
  };
  db.devoirs = (devs.data || []).map((d) => ({
    id: d.id, matiere: d.matiere_nom, titre: d.titre, description: d.description || "",
    date: d.date_limite
      ? new Date(d.date_limite).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
      : "Sans date",
    delai: d.statut === "done" ? "Terminé" : "à venir",
    priorite: d.priorite, coef: "",
    type: d.statut === "done" ? "termine" : d.type, statut: d.statut,
  }));
  db.budget = {
    mois: mois.charAt(0).toUpperCase() + mois.slice(1),
    solde: entrees - sorties, entrees, sorties,
    previsionEpargne: Math.max(0, Math.round(entrees - sorties - (sorties / Math.max(1, now.getDate())) * joursRestants)),
    joursRestants, pctDepenses: entrees ? Math.round((sorties / entrees) * 100) : 0,
    conseil: BUDGET_CONSEIL,
  };
  db.transactions = (txs.data || []).map((t) => ({
    id: t.id, titre: t.titre, categorie: t.categorie || "",
    detail: (t.recurrent ? "Récurrent • " : "") + (t.effectue_le
      ? new Date(t.effectue_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""),
    montant: t.montant, icon: t.icon || "payments", style: t.montant > 0 ? "green" : "slate",
  }));
  db.categoriesTransaction = CATEGORIES;
  db.premium = PREMIUM;
  db.onboarding = {
    cycles: CYCLES, cycleActif: cycleDe(p.classe), classesByCycle: CLASSES_PAR_CYCLE, classeActive: p.classe,
    options: matieres.map((m) => ({
      id: m.id, nom: m.nom, coef: m.coef, icon: m.icon, groupe: m.groupe,
      checked: m.checked, difficulte: m.difficulte,
      date_ds: m.date_ds || null, date_compo: m.date_compo || null,
    })),
  };
  db.cibles = Object.fromEntries(
    (cib.data || []).map((c) => [c.matiere_id, {
      IE: c.cible_ie, DS: c.cible_ds, COMPO: c.cible_compo,
      base: c.base_moy == null ? null : Number(c.base_moy),
      periode: c.periode || null, // absent pré-migration : traité comme période en cours
    }])
  );
  db.profil = {
    langue: p.langue,
    devise: p.devise === "XOF" ? "Côte d'Ivoire (FCFA - XOF)" : p.devise,
    notifications: true, theme: "Clair",
  };
  db.evolution = evolutionDe(notesRaw, Number(p.moyenne_actuelle));
  try { localStorage.setItem("kp_db", JSON.stringify(db)); } catch {}
  return db;
}

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);
  const [uid, setUid] = useState(null);
  const [unlockedUid, setUnlockedUid] = useState(null);
  const [sub, setSub] = useState(null);
  const [toast, setToastMsg] = useState(null);

  const showToast = useCallback((m) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const reload = useCallback(async (forceUid) => {
    try {
      const id = forceUid || (await sb.auth.getSession()).data.session?.user?.id;
      if (!id) { setDb(null); setUid(null); setLoading(false); return null; }
      setUid(id);
      const fresh = await buildDB(id);
      setDb(fresh);
      setSub(null);
      setLoading(false);
      return fresh;
    } catch (e) {
      setDb(null); setUid(null); setLoading(false);
      throw e;
    }
  }, []);

  // Applique une mutation optimiste locale (puis recalcul local).
  const patchDb = useCallback((mutator) => {
    setDb((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mutator(next);
      recalcLocalDraft(next);
      return next;
    });
  }, []);

  // Écriture : en ligne -> direct ; hors ligne -> file + optimiste + Background Sync.
  const persistOp = useCallback(async (op, apply) => {
    if (navigator.onLine) {
      await execOp(op);
      return { queued: false };
    }
    await idb.add(op);
    if (apply) patchDb(apply);
    showToast("Hors ligne : enregistré, synchro auto au retour internet");
    notifyOutbox();
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("classinote-sync");
    } catch {}
    return { queued: true };
  }, [patchDb, showToast]);

  const recalcServer = useCallback(async () => {
    const uid = (await sb.auth.getSession()).data.session?.user?.id;
    if (!uid) return;
    const [{ data: notes }, { data: mats }] = await Promise.all([
      sb.from("notes").select("matiere_id,note,coef,type").eq("user_id", uid),
      sb.from("matieres").select("id,coef,date_ds,date_compo").eq("user_id", uid),
    ]);
    const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
    const jobs = [];
    let totPts = 0, totCoef = 0;
    for (const m of mats || []) {
      const g = { IE: [], DS: [], COMPO: [] };
      (notes || []).filter((n) => n.matiere_id === m.id).forEach((n) => {
        if (g[n.type]) g[n.type].push(Number(n.note));
      });
      const r = moyenneMatiere3Niveaux({
        IE: avg(g.IE), DS: avg(g.DS), COMPO: avg(g.COMPO),
        dateDS: m.date_ds || null, dateCompo: m.date_compo || null,
      });
      const nb = g.IE.length + g.DS.length + g.COMPO.length;
      if (r.moy == null) {
        jobs.push(sb.from("matieres").update({ moyenne: null, nb_devoirs: 0 }).eq("id", m.id));
        continue;
      }
      totPts += r.moy * m.coef; totCoef += m.coef;
      jobs.push(sb.from("matieres").update({ moyenne: r.moy, nb_devoirs: nb }).eq("id", m.id));
    }
    await Promise.all(jobs);
    if (totCoef) await sb.from("profiles").update({ moyenne_actuelle: +(totPts / totCoef).toFixed(1) }).eq("id", uid);
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        await Promise.race([
          reload(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout (12 s) — réseau lent ou Supabase injoignable")), 12000)),
        ]);
      } catch (e) {
        if (stop) return;
        // Repli : dernier snapshot local si la session correspond
        try {
          const raw = localStorage.getItem("kp_db");
          const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: {} }));
          if (raw && session) {
            const snap = JSON.parse(raw);
            if (snap._uid === session.user.id) {
              setDb(snap); setUid(session.user.id); setLoading(false);
              return;
            }
          }
        } catch {}
        setBootError(e.message || "Chargement impossible");
        setLoading(false);
      }
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!session) { setDb(null); setUid(null); setUnlockedUid(null); }
    });
    return () => { stop = true; sub.subscription.unsubscribe(); };
  }, [reload]);

  const value = useMemo(() => {
    let flushing = false;
    const flushQueue = async () => {
      if (flushing || !navigator.onLine) return;
      flushing = true;
      try {
        const ops = await idb.all().catch(() => []);
        if (!ops.length) return;
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        // abonnement re-vérifié avant d'exécuter la file
        const { data, error } = await sb.rpc("has_active_subscription", { p_user: session.user.id });
        if (error || !data) {
          showToast("Abonnement requis pour synchroniser");
          return;
        }
        let touchMoy = false;
        for (const op of ops) {
          try {
            await execOp(op);
            if (op.touchMoy) touchMoy = true;
            await idb.del(op.id);
          } catch (e) {
            showToast("Échec synchro, on réessaiera : " + e.message);
            break;
          }
        }
        if (touchMoy) await recalcServer().catch(() => {});
        await reload().catch(() => {});
        notifyOutbox();
        const left = await idb.all().catch(() => []);
        if (!left.length) showToast("Synchronisé");
      } finally {
        flushing = false;
      }
    };
    window.__kpFlush = flushQueue;
    const needSub = async () => {
      if (!navigator.onLine) return true;
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return false;
      const { data, error } = await sb.rpc("has_active_subscription", { p_user: session.user.id });
      if (error || !data) {
        showToast("Abonnement requis");
        window.location.hash = "#/paywall";
        return false;
      }
      return true;
    };
    return {
      db, loading, bootError, uid, reload, toast: showToast, toastMsg: toast,
      patchDb, persistOp, flushQueue, needSub, recalcServer,
      isUnlocked: !!db && unlockedUid === db._uid,
      unlock: () => db && setUnlockedUid(db._uid),
      signOut: async () => {
        await sb.auth.signOut();
        setDb(null); setUid(null); setUnlockedUid(null); setSub(null);
        resetIdentity();
      },
      abonnementActif: async (force = false) => {
        if (sub && !force && Date.now() - sub.at < 60000) return sub.active;
        const { data, error } = await sb.rpc("has_active_subscription", { p_user: db._uid });
        const active = !error && !!data;
        setSub({ active, at: Date.now() });
        return active;
      },
    };
  }, [db, loading, bootError, uid, unlockedUid, sub, reload, showToast, toast, patchDb, persistOp, recalcServer]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
