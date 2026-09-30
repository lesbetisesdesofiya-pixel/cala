import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb, edgeFn, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { track } from "../lib/analytics";

const MODES = [
  { key: "t-money-togo", nom: "Yas (T-Money)" },
  { key: "moov-togo", nom: "Moov Money" },
];
const STATUT_LABEL = { pending: "En cours", submitted: "Envoyé", completed: "Payé", cancelled: "Annulé", failed: "Échoué" };
const STATUT_STYLE = {
  pending: "bg-amber-100 text-amber-800", submitted: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800", cancelled: "bg-slate-100 text-slate-500", failed: "bg-rose-100 text-rose-700",
};

// Page publique : pitch affiliation + entrée.
export function Affiliation() {
  useEffect(() => { track("affiliation_viewed", {}); }, []);
  const share = "Je gagne 250 F par élève parrainé sur ClassiNote. Rejoins avec mon lien : https://classinote.app/#/affiliation";
  return (
    <div className="space-y-5 fade">
      <div className="rounded-2xl bg-primary-container text-white p-6 text-center relative overflow-hidden">
        <img src="./logo.png" alt="" className="w-16 h-16 rounded-2xl mx-auto object-cover" />
        <h1 className="text-2xl font-extrabold mt-3">Parraine. Gagne. Retire.</h1>
        <p className="text-sm text-slate-300 mt-1">Ton code à 6 chiffres te rapporte <strong className="text-secondary-container">250 F par abonnement payé</strong> avec. Retraits Mobile Money dès 1000 F.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["1", "Reçois ton code"], ["2", "Partage-le"], ["3", "Retire tes gains"]].map(([n, t]) => (
          <div key={n} className="bg-white rounded-2xl border p-3">
            <span className="w-7 h-7 rounded-full bg-secondary-container text-primary font-extrabold inline-flex items-center justify-center text-sm">{n}</span>
            <p className="text-[11px] font-bold text-primary mt-1.5">{t}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border p-4 space-y-2">
        <Link to="/affiliation/register" onClick={() => track("affiliation_cta_clicked", { cta: "register" })}
          className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2">
          Devenir affilié<span className="material-symbols-outlined">arrow_forward</span>
        </Link>
        <Link to="/affiliation/login" onClick={() => track("affiliation_cta_clicked", { cta: "login" })}
          className="w-full h-12 rounded-xl border-2 border-primary-container text-primary font-bold text-sm flex items-center justify-center">
          J'ai déjà un compte affilié
        </Link>
        <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"
          className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2">
          Partager sur WhatsApp
        </a>
        <p className="text-[11px] text-slate-500 text-center">Installe cette page comme une app à part : menu du navigateur → « Ajouter à l'écran d'accueil ».</p>
      </div>
      <Link to="/" className="block text-center text-xs text-slate-500 underline">← Retour à ClassiNote</Link>
    </div>
  );
}

// Connexion affilié (même identifiants téléphone + mot de passe).
export function AffLogin() {
  const { reload, toast } = useApp();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return toast("Numéro incomplet");
      const email = `u${digits}@whatsapp.classinote.app`;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = (await sb.auth.getUser()).data.user.id;
      await reload(uid);
      track("aff_login", {});
      nav("/affiliation/dashboard");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 fade">
      <h1 className="text-[22px] font-bold text-primary text-center">Espace affilié — connexion</h1>
      <form onSubmit={submit} className="space-y-3">
        <input required inputMode="tel" placeholder="Numéro (ex : 90 00 00 00)" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <input required type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <button disabled={busy} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary">
          {busy ? "…" : "Se connecter"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">Pas encore affilié ? <Link to="/affiliation/register" className="font-bold text-primary underline">S'inscrire</Link></p>
    </div>
  );
}

// Inscription affilié : téléphone + mot de passe + identité.
export function AffRegister() {
  const { reload, toast } = useApp();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      track("aff_signup_started", {});
      const res = await fetch(`${SUPABASE_URL}/functions/v1/aff-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ phone, password, prenom: prenom.trim(), nom: nom.trim() }),
      });
      const out = await res.json();
      if (!res.ok) {
        if (out.error === "already_registered") {
          toast("Ce numéro a déjà un compte — connecte-toi");
          nav("/affiliation/login");
          return;
        }
        throw new Error(out.error || "Inscription impossible");
      }
      const { error } = await sb.auth.signInWithPassword({ email: out.email, password: out.password });
      if (error) throw error;
      const uid = (await sb.auth.getUser()).data.user.id;
      await reload(uid);
      track("aff_signup_completed", { code: out.code });
      toast(`Code affilié : ${out.code}`);
      nav("/affiliation/dashboard");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 fade">
      <h1 className="text-[22px] font-bold text-primary text-center">Devenir affilié</h1>
      <p className="text-xs text-center text-slate-500">Gratuit. Ton code à 6 chiffres est créé instantanément.</p>
      <form onSubmit={submit} className="space-y-3">
        <input required inputMode="tel" placeholder="Numéro Mobile Money" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <input required type="password" minLength={8} placeholder="Mot de passe (8 min)" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 rounded-xl border px-4" />
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)}
            className="h-12 rounded-xl border px-4" />
          <input required placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)}
            className="h-12 rounded-xl border px-4" />
        </div>
        <button disabled={busy} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary">
          {busy ? "…" : "Créer mon espace affilié"}
        </button>
      </form>
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR").replace(/,/g, " ").replace(/\u202f/g, " ") + " F";
}

// Tableau de bord affilié.
export function AffDashboard() {
  const { db, signOut, toast } = useApp();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [montant, setMontant] = useState("");
  const [busyW, setBusyW] = useState(false);
  const [payPhone, setPayPhone] = useState("");
  const [payMode, setPayMode] = useState("t-money-togo");
  const [busyInfo, setBusyInfo] = useState(false);

  const load = async () => {
    try {
      const out = await edgeFn("aff-dashboard", {});
      setData(out);
      if (out.payout_phone) setPayPhone(out.payout_phone.replace(/^\+228/, ""));
    } catch (err) {
      if (err.message === "not_affiliate") setData({ notAffiliate: true });
      else toast("Erreur : " + err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activer = async () => {
    try {
      const out = await edgeFn("aff-signup", {});
      toast(`Code affilié : ${out.code}`);
      track("aff_signup_completed", { code: out.code, existing: true });
      load();
    } catch (err) { toast("Erreur : " + err.message); }
  };

  const saveInfo = async () => {
    if (busyInfo) return;
    setBusyInfo(true);
    try {
      await edgeFn("aff-payout-info", { phone: "+228" + payPhone.replace(/\D/g, ""), mode: payMode });
      toast("Numéro de retrait enregistré");
      track("payout_info_saved", { mode: payMode });
      load();
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyInfo(false); }
  };

  const retirer = async () => {
    const m = Math.floor(Number(montant) || 0);
    if (!m || m < 1000) return toast("Minimum 1000 F");
    if (busyW) return;
    setBusyW(true);
    try {
      const out = await edgeFn("aff-withdraw", { amount: m });
      track("withdraw_requested", { amount: m, net: out.net });
      toast(`Retrait demandé : tu recevras ${fmt(out.net)} (frais ${fmt(out.frais)})`);
      setMontant("");
      load();
    } catch (err) {
      if (err.message === "solde_insuffisant") toast(`Solde insuffisant (${fmt(err.solde ?? 0)})`);
      else if (err.message === "payout_info_required") toast("Renseigne d'abord ton numéro de retrait");
      else if (err.message === "montant_min") toast("Minimum 1000 F");
      else toast("Erreur : " + err.message);
    } finally { setBusyW(false); }
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  if (data?.notAffiliate) {
    return (
      <div className="space-y-4 fade text-center mt-6">
        <h1 className="text-xl font-bold text-primary">Pas encore affilié</h1>
        <p className="text-sm text-slate-500">Active ton espace : ton code à 6 chiffres est créé aussitôt.</p>
        <button onClick={activer} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary">
          Activer mon espace affilié
        </button>
      </div>
    );
  }
  const s = data.stats;
  return (
    <div className="space-y-4 fade">
      <div className="rounded-2xl bg-primary-container text-white p-5 text-center">
        <p className="text-[11px] uppercase font-bold text-slate-300">Ton code promo à 6 chiffres</p>
        <p className="text-4xl font-extrabold tracking-[0.2em] text-secondary-container">{data.code}</p>
        <div className="flex gap-2 justify-center mt-3">
          <button onClick={() => { try { navigator.clipboard.writeText(data.code); toast("Code copié"); } catch {} }}
            className="px-4 h-10 rounded-xl bg-white/10 border border-white/20 text-xs font-bold">Copier</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Utilise mon code ${data.code} sur ClassiNote et paie ton 1er mois 500 F au lieu de 1000 F : https://classinote.app`)}`}
            target="_blank" rel="noreferrer" className="px-4 h-10 rounded-xl bg-emerald-600 text-xs font-bold flex items-center">
            Partager sur WhatsApp
          </a>
        </div>
        <p className="text-[11px] text-slate-300 mt-2">250 F par abonnement payé avec ton code, dès 1000 F retirables.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Solde retirable</p>
          <p className="text-xl font-extrabold text-primary">{fmt(s.solde)}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Revenus totaux</p>
          <p className="text-xl font-extrabold text-primary">{fmt(s.revenus)}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Abonnés parrainés</p>
          <p className="text-xl font-extrabold text-primary">{s.abonnes}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">En cours de versement</p>
          <p className="text-xl font-extrabold text-primary">{fmt(s.en_attente)}</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border p-4 space-y-3">
        <h2 className="font-bold text-primary">Retirer mes gains</h2>
        {!data.payout_phone ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">D'abord, ton numéro Mobile Money de retrait (Togo).</p>
            <input inputMode="tel" placeholder="90 00 00 00" value={payPhone} onChange={(e) => setPayPhone(e.target.value)}
              className="w-full h-12 rounded-xl border px-4" />
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button key={m.key} type="button" onClick={() => setPayMode(m.key)}
                  className={`h-11 rounded-xl border text-xs font-bold ${payMode === m.key ? "border-primary-container bg-slate-50 text-primary" : "text-slate-500"}`}>
                  {m.nom}
                </button>
              ))}
            </div>
            <button onClick={saveInfo} disabled={busyInfo} className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-sm">
              {busyInfo ? "…" : "Enregistrer"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Vers <strong>{data.payout_phone}</strong> ({MODES.find((m) => m.key === data.payout_mode)?.nom})</p>
            <div className="flex gap-2">
              <input inputMode="numeric" placeholder="Montant (min 1000 F)" value={montant} onChange={(e) => setMontant(e.target.value)}
                className="flex-1 h-12 rounded-xl border px-4 font-bold" />
              <button onClick={retirer} disabled={busyW} className="px-5 h-12 rounded-xl bg-secondary-container font-bold text-primary text-sm">
                {busyW ? "…" : "Retirer"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Frais 2,5 % déduits — ex : 10 000 F demandés → 9 750 F reçus.</p>
            <button onClick={() => { setPayPhone((data.payout_phone || "").replace(/^\+228/, "")); setPayMode(data.payout_mode); }}
              className="text-xs text-slate-500 underline">Modifier le numéro (ci-dessous)</button>
            <div className="space-y-2 pt-1">
              <input inputMode="tel" placeholder="90 00 00 00" value={payPhone} onChange={(e) => setPayPhone(e.target.value)}
                className="w-full h-12 rounded-xl border px-4" />
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button key={m.key} type="button" onClick={() => setPayMode(m.key)}
                    className={`h-11 rounded-xl border text-xs font-bold ${payMode === m.key ? "border-primary-container bg-slate-50 text-primary" : "text-slate-500"}`}>
                    {m.nom}
                  </button>
                ))}
              </div>
              <button onClick={saveInfo} disabled={busyInfo} className="w-full h-11 rounded-xl border font-bold text-sm text-primary">
                {busyInfo ? "…" : "Mettre à jour"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border p-4 space-y-2">
        <h2 className="font-bold text-primary">Mes retraits</h2>
        {!data.payouts.length && <p className="text-xs text-slate-500">Aucun retrait pour l'instant.</p>}
        {data.payouts.map((w) => (
          <div key={w.id} className="flex items-center justify-between border-b last:border-0 py-2">
            <div>
              <p className="text-sm font-bold text-primary">{fmt(w.amount)} <span className="font-medium text-slate-500">→ {fmt(w.net)} reçus</span></p>
              <p className="text-[11px] text-slate-500">{String(w.created_at).slice(0, 10)} • {w.phone}</p>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUT_STYLE[w.status] || "bg-slate-100"}`}>
              {STATUT_LABEL[w.status] || w.status}
            </span>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border p-4 space-y-2">
        <h2 className="font-bold text-primary">Mes abonnés ({data.filleuls.length})</h2>
        {!data.filleuls.length && <p className="text-xs text-slate-500">Partage ton code : tes filleuls apparaîtront ici.</p>}
        {data.filleuls.map((f, i) => (
          <div key={i} className="flex items-center justify-between border-b last:border-0 py-2">
            <p className="text-sm font-bold text-primary">{f.prenom} {f.nom}</p>
            <p className="text-[11px] text-slate-500">{f.date} • {fmt(f.montant)} payés</p>
          </div>
        ))}
      </section>

      <button onClick={async () => { await signOut(); nav("/affiliation"); }} className="w-full text-xs text-slate-500 underline">
        Se déconnecter
      </button>
      <p className="text-center text-[11px] text-slate-400">Espace affilié • {db.app.version}</p>
    </div>
  );
}
