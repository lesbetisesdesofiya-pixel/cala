import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb } from "../lib/supabase";
import { CLASSES_PAR_CYCLE } from "../lib/store";
import { matieresDe } from "../lib/referentiel";

// Accès réservé : compte email + flag is_admin (posé en SQL).
// Aucune entrée dans la nav : URL directe /admin.
function useIsAdmin(uid) {
  const [state, setState] = useState("checking"); // checking | ok | no
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!uid) { if (!stop) setState("no"); return; }
      try {
        const { data } = await sb.from("profiles").select("is_admin").eq("id", uid).single();
        if (!stop) setState(data?.is_admin ? "ok" : "no");
      } catch { if (!stop) setState("no"); }
    })();
    return () => { stop = true; };
  }, [uid]);
  return state;
}

export function AdminLogin() {
  const { reload, toast } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const uid = (await sb.auth.getUser()).data.user.id;
      await reload(uid);
      const { data } = await sb.from("profiles").select("is_admin").eq("id", uid).single();
      if (!data?.is_admin) {
        await sb.auth.signOut();
        return toast("Compte non administrateur");
      }
      nav("/admin");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 fade">
      <h1 className="text-[22px] font-bold text-primary text-center">Administration</h1>
      <p className="text-xs text-center text-slate-500">Accès réservé — email + mot de passe.</p>
      <form onSubmit={submit} className="space-y-3">
        <input required type="email" placeholder="Email admin" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <input required type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <button disabled={busy} className="w-full h-12 rounded-xl bg-primary-container text-white font-bold">
          {busy ? "…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function AdminGuard({ children }) {
  const { uid, signOut } = useApp();
  const nav = useNavigate();
  const state = useIsAdmin(uid);
  if (!uid) return <Navigate to="/admin/login" replace />;
  if (state === "checking") return <p className="py-10 text-center text-sm text-slate-500">Vérification…</p>;
  if (state !== "ok") {
    return (
      <div className="text-center mt-10 space-y-3 fade">
        <p className="font-bold text-primary">Accès réservé à l'administrateur.</p>
        <button onClick={async () => { await signOut(); nav("/admin/login"); }} className="px-6 h-11 rounded-xl bg-primary-container text-white text-sm font-bold">
          Changer de compte
        </button>
      </div>
    );
  }
  return children;
}

function fmtD(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function AbosTab() {
  const { toast } = useApp();
  const [rows, setRows] = useState([]);
  const [noms, setNoms] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const load = async () => {
    const { data, error } = await sb.from("subscriptions")
      .select("id,user_id,plan,amount,phone,status,started_at,expires_at,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { toast("Erreur : " + error.message); return; }
    setRows(data || []);
    const ids = [...new Set((data || []).map((r) => r.user_id))];
    if (ids.length) {
      const { data: pf } = await sb.from("profiles").select("id,prenom,nom,phone").in("id", ids);
      setNoms(Object.fromEntries((pf || []).map((p) => [p.id, p])));
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const actifs = rows.filter((r) => r.status === "active" && r.expires_at && new Date(r.expires_at) > new Date());
  const mrr = actifs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const prolonger = async (r) => {
    if (busy) return;
    setBusy(r.id);
    try {
      const base = Math.max(Date.now(), new Date(r.expires_at || 0).getTime());
      const next = new Date(base + 30 * 86400000).toISOString();
      const payload = { status: "active", expires_at: next };
      if (!r.started_at) payload.started_at = new Date().toISOString();
      const { error } = await sb.from("subscriptions").update(payload).eq("id", r.id);
      if (error) throw error;
      toast("Prolongé de 30 jours");
      load();
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(null); }
  };
  const resilier = async (r) => {
    if (busy) return;
    if (!window.confirm(`Résilier l'abonnement de ${noms[r.user_id]?.prenom || r.phone} ?`)) return;
    setBusy(r.id);
    try {
      const { error } = await sb.from("subscriptions").update({ status: "expired" }).eq("id", r.id);
      if (error) throw error;
      toast("Résilié");
      load();
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(null); }
  };
  const filtre = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const p = noms[r.user_id];
    return (r.phone || "").includes(s) || `${p?.prenom || ""} ${p?.nom || ""}`.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white rounded-2xl border p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Actifs</p><p className="text-lg font-extrabold text-emerald-700">{actifs.length}</p></div>
        <div className="bg-white rounded-2xl border p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">MRR</p><p className="text-lg font-extrabold text-primary">{mrr.toLocaleString("fr-FR")} F</p></div>
        <div className="bg-white rounded-2xl border p-3"><p className="text-[10px] font-bold text-slate-500 uppercase">Total (100)</p><p className="text-lg font-extrabold text-primary">{rows.length}</p></div>
      </div>
      <input placeholder="Rechercher (nom ou numéro)…" value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full h-11 rounded-xl border px-4 text-sm" />
      {filtre.map((r) => {
        const p = noms[r.user_id];
        const actif = r.status === "active" && r.expires_at && new Date(r.expires_at) > new Date();
        return (
          <div key={r.id} className="bg-white rounded-2xl border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary">{p ? `${p.prenom} ${p.nom}` : "?"} <span className="font-medium text-slate-500">• {r.phone}</span></p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${actif ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                {r.status} • {Number(r.amount)} F
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Expire : {fmtD(r.expires_at)} • depuis le {fmtD(r.created_at)}</p>
            <div className="flex gap-2">
              <button onClick={() => prolonger(r)} disabled={busy === r.id} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                {busy === r.id ? "…" : "+30 jours"}
              </button>
              {actif && (
                <button onClick={() => resilier(r)} disabled={busy === r.id} className="flex-1 h-10 rounded-xl border text-xs font-bold text-rose-700">
                  Résilier
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CLASSES_REF = Object.values(CLASSES_PAR_CYCLE).flat();

function LivresTab() {
  const { toast } = useApp();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ id: null, titre: "", classe: "6ème", matiere: "", dossier: "", nb_pages: "", ordre: 0 });
  const [verif, setVerif] = useState(null);
  const [busy, setBusy] = useState(false);
  const mats = matieresDe(form.classe) || [];
  const load = async () => {
    const { data, error } = await sb.from("livres").select("*").order("classe").order("ordre");
    if (error) { toast("Erreur : " + error.message); return; }
    setRows(data || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const verifier = async () => {
    if (!form.dossier || !form.nb_pages) return toast("Dossier + nb de pages requis");
    setVerif({ check: true });
    const n = Math.max(1, parseInt(form.nb_pages, 10) || 0);
    let okPages = 0;
    for (let i = 1; i <= n; i++) {
      try {
        const r = await fetch(`/livres/${form.dossier}/p${String(i).padStart(2, "0")}.jpg`, { method: "HEAD" });
        if (r.ok) okPages++;
      } catch {}
    }
    let coverOk = false;
    try {
      const r = await fetch(`/livres/${form.dossier}/cover.jpg`, { method: "HEAD" });
      coverOk = r.ok;
    } catch {}
    setVerif({ okPages, n, coverOk });
  };
  const sauver = async () => {
    if (busy) return;
    if (!form.titre.trim() || !form.dossier.trim() || !form.matiere.trim()) return toast("Titre, matière et dossier requis");
    setBusy(true);
    try {
      const payload = {
        titre: form.titre.trim(), classe: form.classe, matiere: form.matiere.trim(),
        dossier: form.dossier.trim().replace(/^\/+|\/+$/g, ""),
        couverture: `/livres/${form.dossier.trim().replace(/^\/+|\/+$/g, "")}/cover.jpg`,
        nb_pages: Math.max(0, parseInt(form.nb_pages, 10) || 0),
        ordre: Number(form.ordre) || 0,
      };
      const { error } = form.id
        ? await sb.from("livres").update(payload).eq("id", form.id)
        : await sb.from("livres").insert(payload);
      if (error) throw error;
      toast(form.id ? "Livre modifié" : "Livre ajouté");
      setForm({ id: null, titre: "", classe: "6ème", matiere: "", dossier: "", nb_pages: "", ordre: 0 });
      setVerif(null);
      load();
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };
  const suppr = async (id, titre) => {
    if (!window.confirm(`Supprimer « ${titre} » ? (les images restent en git)`)) return;
    const { error } = await sb.from("livres").delete().eq("id", id);
    if (error) return toast("Erreur : " + error.message);
    toast("Supprimé");
    load();
  };
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border p-4 space-y-2.5">
        <h2 className="font-bold text-primary">{form.id ? "Modifier le livre" : "Nouveau livre"}</h2>
        <input placeholder="Titre (ex : Maths 6ème — Tome 1)" value={form.titre} onChange={(e) => set("titre", e.target.value)}
          className="w-full h-11 rounded-xl border px-3 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.classe} onChange={(e) => set("classe", e.target.value)} className="h-11 rounded-xl border px-2 text-sm font-bold">
            {CLASSES_REF.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Matière" list="mats-ref" value={form.matiere} onChange={(e) => set("matiere", e.target.value)}
            className="h-11 rounded-xl border px-3 text-sm" />
          <datalist id="mats-ref">{mats.map((m) => <option key={m.nom} value={m.nom} />)}</datalist>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Dossier (ex : 6eme/maths-t1)" value={form.dossier} onChange={(e) => set("dossier", e.target.value)}
            className="h-11 rounded-xl border px-3 text-sm" />
          <input inputMode="numeric" placeholder="Nb pages" value={form.nb_pages} onChange={(e) => set("nb_pages", e.target.value)}
            className="h-11 rounded-xl border px-3 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={verifier} className="flex-1 h-11 rounded-xl border font-bold text-sm text-primary">Vérifier les images</button>
          <button onClick={sauver} disabled={busy} className="flex-1 h-11 rounded-xl bg-primary-container text-white font-bold text-sm">
            {busy ? "…" : form.id ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
        {verif?.check && !verif.n && <p className="text-xs text-slate-500">Vérification…</p>}
        {verif?.n != null && (
          <p className={`text-xs font-bold ${verif.okPages === verif.n && verif.coverOk ? "text-emerald-700" : "text-amber-700"}`}>
            Pages : {verif.okPages}/{verif.n} trouvées • Couverture : {verif.coverOk ? "ok" : "manquante"}
          </p>
        )}
        {form.id && (
          <button onClick={() => { setForm({ id: null, titre: "", classe: "6ème", matiere: "", dossier: "", nb_pages: "", ordre: 0 }); setVerif(null); }}
            className="text-xs text-slate-500 underline">Annuler la modification</button>
        )}
      </div>
      {rows.map((l) => (
        <div key={l.id} className="bg-white rounded-2xl border p-3 flex items-center gap-3">
          {l.couverture && <img src={l.couverture} alt="" className="w-11 h-14 rounded-lg object-cover bg-slate-100 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary truncate">{l.titre}</p>
            <p className="text-[11px] text-slate-500">{l.classe} • {l.matiere} • {l.nb_pages} p. • /{l.dossier}</p>
          </div>
          <button onClick={() => { setForm({ id: l.id, titre: l.titre, classe: l.classe, matiere: l.matiere, dossier: l.dossier, nb_pages: String(l.nb_pages), ordre: l.ordre || 0 }); setVerif(null); window.scrollTo({ top: 0 }); }}
            className="w-9 h-9 rounded-xl bg-slate-100 font-bold text-primary">✎</button>
          <button onClick={() => suppr(l.id, l.titre)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 font-bold">×</button>
        </div>
      ))}
    </div>
  );
}

export function Admin() {
  const { signOut } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("abos");
  return (
    <AdminGuard>
      <div className="space-y-4 fade">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Administration</h1>
          <button onClick={async () => { await signOut(); nav("/admin/login"); }} className="text-xs text-slate-500 underline">Déconnexion</button>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-100 rounded-2xl">
          {[["abos", "Abonnements"], ["livres", "Livres"]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`py-2.5 rounded-xl text-xs font-bold ${tab === v ? "bg-white shadow text-primary" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        {tab === "abos" ? <AbosTab /> : <LivresTab />}
        <p className="text-center text-[11px] text-slate-400">Accès réservé — ClassiNote</p>
      </div>
    </AdminGuard>
  );
}
