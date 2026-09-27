import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, sha256Hex } from "../lib/supabase";
import { track } from "../lib/analytics";
const INDICS = [["+228", "Togo"], ["+225", "Côte d'Ivoire"], ["+221", "Sénégal"], ["+223", "Mali"], ["+226", "Burkina"], ["+237", "Cameroun"], ["+33", "France"]];

export function Login() {
  const { reload, unlock, toast } = useApp();
  const nav = useNavigate();
  const [indic, setIndic] = useState("+228");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busyLogin) return;
    setBusyLogin(true);
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length < 8) return toast("Numéro incomplet");
    if (!password) return toast("Saisis ton mot de passe");
    try {
      const email = `u${indic.replace(/\D/g, "")}${digits}@whatsapp.classinote.app`;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          toast("Compte introuvable — inscris-toi");
          nav("/register");
          return;
        }
        throw error;
      }
      const uid = (await sb.auth.getUser()).data.user.id;
      const fresh = await reload(uid);
      if (!fresh) return;
      track("login", { source: "password" });
      if (fresh.user.onboardingTermine === false) { nav("/onboarding"); return; }
      let sub = false;
      try {
        const { data } = await sb.rpc("has_active_subscription", { p_user: uid });
        sub = !!data;
      } catch {}
      if (!sub) { nav("/feuille-route"); return; }
      if (fresh.user.hasPin) { nav("/lock"); return; }
      unlock();
      nav("/notes");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyLogin(false); }
  };
  return (
    <div className="fade">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/30">
          <span className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            <img src="./logo.png" alt="" className="w-full h-full object-cover" />
          </span>
          <span className="text-xs font-bold text-primary">ClassiNote</span>
        </span>
      </div>
      <div className="text-center mt-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto shadow-navy">
          <img src="./logo.png" alt="" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-[26px] font-bold text-primary mt-3">Se connecter</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto">Ton numéro et ton mot de passe choisis à l'inscription.</p>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="flex gap-2">
          <div className="relative w-28 shrink-0">
            <select value={indic} onChange={(e) => setIndic(e.target.value)} className="w-full h-12 pl-2.5 pr-7 rounded-xl bg-surface-container-low border border-outline-variant/50 text-sm font-semibold appearance-none">
              {INDICS.map(([c, f]) => <option key={c} value={c}>{f} {c}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] absolute right-2 top-3 pointer-events-none">expand_more</span>
          </div>
          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3.5 material-symbols-outlined text-[20px] text-on-surface-variant/70">call</span>
            <input required inputMode="tel" placeholder="90 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline-variant/50 text-sm outline-none" />
          </div>
        </div>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 material-symbols-outlined text-[20px] text-on-surface-variant/70">lock</span>
          <input required type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline-variant/50 text-sm outline-none" />
        </div>
        <button disabled={busyLogin} className={`w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 shadow ${busyLogin ? "opacity-70" : ""}`}>
          {busyLogin ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <>Se connecter<span className="material-symbols-outlined">arrow_forward</span></>}
        </button>
        <Link to="/register" className="w-full h-12 rounded-xl border-2 border-primary-container text-primary font-bold text-sm flex items-center justify-center gap-2">
          Créer un compte — s'inscrire
        </Link>
        <p className="text-center text-xs text-on-surface-variant">Nouveau ici ? Crée ton compte avec ton numéro, puis abonne-toi (1000 FCFA/mois).</p>
      </form>
    </div>
  );
}

export function Register() {
  const { reload, unlock, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [indic, setIndic] = useState("+228");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [ecole, setEcole] = useState("");
  const [busyReg, setBusyReg] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busyReg) return;
    setBusyReg(true);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) { setBusyReg(false); return toast("Numéro incomplet"); }
    if (!password || password.length < 8) { setBusyReg(false); return toast("Mot de passe : 8 caractères minimum"); }
    if (!nom.trim() || !prenom.trim() || !ecole.trim()) { setBusyReg(false); return toast("Nom, prénom et école requis"); }
    const fullPhone = indic + digits;
    try {
      track("signup_started", { indicatif: indic });
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ phone: fullPhone, password, prenom: prenom.trim(), nom: nom.trim(), ecole: ecole.trim() }),
      });
      const out = await res.json();
      if (!res.ok) {
        if (out.error === "already_registered") {
          toast("Ce numéro a déjà un compte — connecte-toi");
          nav("/login");
          return;
        }
        throw new Error(out.error || "Inscription impossible");
      }
      const { error } = await sb.auth.signInWithPassword({ email: out.email, password: out.password });
      if (error) throw error;
      const uid = (await sb.auth.getUser()).data.user.id;
      await reload(uid);
      track("signup_completed", { indicatif: indic });
      unlock();
      toast("Compte créé");
      nav("/onboarding");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyReg(false); }
  };

  const field = (label, ph, icon, value, setValue, suffix) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-on-surface-variant">{label}</label>
        {suffix && <span className="text-[11px] text-on-surface-variant/60">{suffix}</span>}
      </div>
      <div className="relative flex items-center">
        <span className={`absolute left-3.5 text-on-surface-variant/70 material-symbols-outlined text-[20px]`}>{icon}</span>
        <input required value={value} onChange={(e) => setValue(e.target.value)} placeholder={ph}
          className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface-container-lowest border border-outline-variant/50 text-sm outline-none" />
      </div>
    </div>
  );

  return (
    <div className="fade">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/30">
          <span className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            <img src="./logo.png" alt="" className="w-full h-full object-cover" />
          </span>
          <span className="text-xs font-bold text-primary">ClassiNote</span>
        </span>
        <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-surface-container-low">1 / 2</span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-[11px] font-bold uppercase">
          <span className="material-symbols-outlined text-[14px] fill">verified</span>Semestre 2024 - 2025
        </div>
        <h1 className="text-[26px] leading-[34px] font-bold text-primary tracking-tight">Créer ton compte</h1>
        <p className="text-sm text-on-surface-variant">Rejoins des milliers d'élèves et réussis ton année scolaire en toute sérénité.</p>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <p className="text-[11px] font-bold text-secondary">Étape {step} sur 2</p>
        {step === 1 ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Numéro de téléphone</label>
              <div className="flex gap-2">
                <div className="relative w-28 shrink-0">
                  <select value={indic} onChange={(e) => setIndic(e.target.value)} className="w-full h-12 pl-2.5 pr-7 rounded-xl bg-surface-container-low border border-outline-variant/50 text-sm font-semibold appearance-none">
                    {INDICS.map(([c, f]) => <option key={c} value={c}>{f} {c}</option>)}
                  </select>
                  <span className="material-symbols-outlined text-[18px] absolute right-2 top-3 pointer-events-none">expand_more</span>
                </div>
                <div className="relative flex-1 flex items-center">
                  <span className="absolute left-3.5 material-symbols-outlined text-[20px] text-on-surface-variant/70">call</span>
                  <input required inputMode="tel" placeholder="90 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline-variant/50 text-sm outline-none" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Mot de passe (8 caractères minimum)</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 material-symbols-outlined text-[20px] text-on-surface-variant/70">lock</span>
                <input required type="password" minLength={8} placeholder="••••" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline-variant/50 text-sm outline-none" />
              </div>
            </div>
            <button type="button" onClick={() => {
              if (phone.replace(/\D/g, "").length < 8) return toast("Numéro incomplet");
              if (!password || password.length < 8) return toast("Mot de passe : 8 caractères minimum");
              setStep(2);
            }} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 shadow">
              Continuer<span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </>
        ) : (
          <>
            {field("Nom", "Ex: Diallo", "badge", nom, setNom, "Requis")}
            {field("Prénom", "Ex: Aminata", "person", prenom, setPrenom, "Requis")}
            {field("Nom de l'École / Établissement", "Ex: Lycée Classique d'Abidjan", "account_balance", ecole, setEcole, "Requis")}
            <label className="flex items-start gap-3 cursor-pointer select-none pt-2">
              <input required type="checkbox" className="mt-1 w-5 h-5 rounded-md accent-[#0f2942]" />
              <span className="text-xs text-on-surface-variant">J'accepte les <Link to="/legal#cgu" className="font-semibold text-primary underline">Conditions d'utilisation</Link> et la <Link to="/legal#confidentialite" className="font-semibold text-primary underline">Politique de confidentialité</Link> de ClassiNote.</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="h-12 px-4 rounded-xl border font-bold text-sm">Retour</button>
              <button disabled={busyReg} className={`flex-1 h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 shadow ${busyReg ? "opacity-70" : ""}`}>
                {busyReg ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <>Créer mon compte<span className="material-symbols-outlined">arrow_forward</span></>}
              </button>
            </div>
          </>
        )}
      </form>
      <p className="text-center text-sm text-on-surface-variant mt-6">Tu as déjà un compte ? <Link to="/login" className="font-semibold text-primary underline ml-1">Se connecter</Link></p>
    </div>
  );
}

const PIN_KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["", ""], ["0", "+"], ["⌫", ""]];

export function PinChoice() {
  const { unlock } = useApp();
  const nav = useNavigate();
  return (
    <div className="fade text-center mt-8 space-y-4">
      <div className="w-20 h-20 rounded-2xl bg-primary-container flex items-center justify-center mx-auto shadow-navy">
        <span className="material-symbols-outlined text-[40px] text-secondary-container fill">shield_lock</span>
      </div>
      <h1 className="text-[26px] font-bold text-primary">Sécuriser ton entrée ?</h1>
      <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
        Un code PIN à 4 chiffres protège tes notes, devoirs et budget.
        Il te sera demandé <strong>à chaque ouverture de l'app</strong>.
      </p>
      <div className="space-y-2 max-w-xs mx-auto">
        <button onClick={() => nav("/pin")} className="w-full h-12 rounded-xl bg-secondary-container font-bold text-primary flex items-center justify-center gap-2 shadow">
          Oui, mettre un code PIN<span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <button onClick={() => { unlock(); nav("/notes"); }} className="w-full h-11 rounded-xl bg-white border font-bold text-primary text-sm">
          Non, passer
        </button>
      </div>
    </div>
  );
}

export function Pin() {
  const { db, persistOp, toast } = useApp();
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [busyPin, setBusyPin] = useState(false);
  const press = (k) => {
    if (k === "⌫") setPin((p) => p.slice(0, -1));
    else if (pin.length < 4) setPin((p) => p + k);
  };
  const confirm = async () => {
    if (pin.length !== 4) return toast("Saisis 4 chiffres");
    if (busyPin) return;
    setBusyPin(true);
    try {
      const r = await persistOp(
        { table: "profiles", method: "update", payload: { pin_hash: await sha256Hex("kalanpath:" + pin) }, match: { id: db._uid } },
        (d) => { d.user.hasPin = true; }
      );
      if (!r.queued) { /* hasPin déjà optimiste */ }
      toast("PIN enregistré");
      nav("/notes");
    } catch (err) { toast("Erreur : " + err.message); } finally { setBusyPin(false); }
  };
  return (
    <div className="fade">
      <div className="flex items-center justify-between bg-surface-container-low px-3 py-1.5 rounded-full border border-surface-variant/40 w-fit mx-auto">
        <div className="flex gap-1">
          <span className="w-2 h-1.5 rounded-full bg-primary-container" /><span className="w-2 h-1.5 rounded-full bg-primary-container" />
          <span className="w-5 h-1.5 rounded-full bg-secondary-container" /><span className="w-2 h-1.5 rounded-full bg-outline-variant/50" />
        </div>
        <span className="text-[11px] text-primary font-bold ml-2">Étape 3 sur 4</span>
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold">
          <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>256-bit
        </span>
      </div>
      <div className="text-center mt-3">
        <div className="relative w-20 h-20 mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-primary-container flex items-center justify-center shadow-navy">
            <span className="material-symbols-outlined text-[40px] text-secondary-container fill">shield_lock</span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-secondary-container rounded-full p-1 border-2 border-white">
            <span className="material-symbols-outlined text-[14px] font-bold block">lock</span>
          </div>
        </div>
        <h1 className="text-[26px] font-bold text-primary mt-3">Définis ton Code PIN</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto">Ce code à 4 chiffres protégera l'accès à tes notes, devoirs et budget.</p>
        <div className="mt-6 flex items-center justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i < pin.length ? "border-primary-container bg-primary-container" : i === pin.length ? "border-secondary-container bg-white dot-pulse" : "border-outline-variant/60 bg-white"}`}>
              {i < pin.length && <span className="w-2 h-2 rounded-full bg-secondary-container" />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-secondary font-bold mt-2">{pin.length} chiffre{pin.length > 1 ? "s" : ""} sur 4 renseigné{pin.length > 1 ? "s" : ""}</p>
        <div className="w-full bg-white/80 rounded-2xl border border-outline-variant/20 p-3 mt-3">
          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
            {PIN_KEYS.map(([k, sub], i) => k === "" ? <div key={i} /> : k === "⌫" ? (
              <button key={i} onClick={() => press(k)} className="h-14 rounded-xl flex items-center justify-center active:scale-95">
                <span className="material-symbols-outlined">backspace</span>
              </button>
            ) : (
              <button key={i} onClick={() => press(k)} className="h-14 rounded-xl bg-surface-container-low text-primary font-bold text-lg flex flex-col items-center justify-center active:scale-95">
                {k}<span className="text-[9px] text-on-surface-variant font-bold -mt-1">{sub}</span>
              </button>
            ))}
          </div>
        </div>
        <button onClick={confirm} disabled={busyPin} className={`mt-3 w-full h-12 rounded-xl bg-primary-container text-white font-semibold flex items-center justify-center gap-2 ${busyPin ? "opacity-70" : ""}`}>
          {busyPin ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <>Confirmer le code PIN<span className="material-symbols-outlined text-secondary-container">arrow_forward</span></>}
        </button>
        <p className="text-xs text-on-surface-variant mt-2 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[16px]">info</span>Ne partage jamais ton code PIN. Il reste strictement confidentiel.
        </p>
      </div>
    </div>
  );
}

export function Lock() {
  const { db, unlock, signOut, toast } = useApp();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busyLock, setBusyLock] = useState(false);
  const u = db.user;
  const initials = ((u.prenom[0] || "") + (u.nom[0] || "")).toUpperCase() || "?";

  const press = async (k) => {
    if (busyLock) return;
    let next = code;
    if (k === "⌫") next = code.slice(0, -1);
    else if (code.length < 4) next = code + k;
    else return;
    setCode(next);
    if (next.length === 4) {
      setBusyLock(true);
      try {
        let row = null;
        try {
          row = (await sb.from("profiles").select("pin_hash,failed_pin_attempts,pin_locked_until").eq("id", db._uid).single()).data;
        } catch { row = null; }
        const ref = row?.pin_hash || db.user.pinHash;
        if (!ref) { toast("Reconnecte-toi pour déverrouiller"); setCode(""); return; }
        if (row?.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
          const mins = Math.ceil((new Date(row.pin_locked_until).getTime() - Date.now()) / 60000);
          toast(`Verrouillé — réessaie dans ${mins} min`);
          setCode("");
          return;
        }
        if ((await sha256Hex("kalanpath:" + next)) !== ref) {
          const fails = (row?.failed_pin_attempts || 0) + 1;
          if (navigator.onLine) {
            try {
              if (fails >= 5) {
                await sb.from("profiles").update({
                  failed_pin_attempts: 0,
                  pin_locked_until: new Date(Date.now() + 15 * 60000).toISOString(),
                }).eq("id", db._uid);
                toast("5 essais ratés — verrouillé 15 min");
              } else {
                await sb.from("profiles").update({ failed_pin_attempts: fails }).eq("id", db._uid);
                toast(`Code incorrect (${5 - fails} essai${5 - fails > 1 ? "s" : ""} restant${5 - fails > 1 ? "s" : ""})`);
              }
            } catch {}
          } else toast("Code incorrect");
          setCode("");
          return;
        }
        if (navigator.onLine) {
          try { await sb.from("profiles").update({ failed_pin_attempts: 0, pin_locked_until: null }).eq("id", db._uid); } catch {}
        }
        setCode("");
        unlock();
        nav("/notes");
      } catch (err) { toast("Erreur : " + err.message); setCode(""); } finally { setBusyLock(false); }
    }
  };

  return (
    <div className="text-center mt-8 fade">
      <div className="flex justify-center">
        <span className="w-16 h-16 text-xl rounded-full bg-primary-container text-white flex items-center justify-center font-bold">{initials}</span>
      </div>
      <h1 className="text-[26px] font-bold text-primary mt-2">Bon retour, {u.prenom}</h1>
      <p className="text-sm text-on-surface-variant">Saisis ton code PIN à 4 chiffres pour déverrouiller.</p>
      {!u.pinHash && (
        <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-sm">
          <p className="font-bold text-amber-800">Déverrouillage impossible hors ligne.</p>
          <button onClick={signOut} className="mt-2 px-4 h-10 rounded-xl bg-primary-container text-white text-xs font-bold">Se reconnecter</button>
        </div>
      )}
      <div className="mt-5 flex items-center justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i < code.length ? "border-primary-container bg-primary-container" : "border-outline-variant/60 bg-white"}`}>
            {i < code.length && <span className="w-2 h-2 rounded-full bg-secondary-container" />}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border p-3 mt-4 grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {PIN_KEYS.map(([k, sub], i) => k === "" ? <span key={i} /> : k === "⌫" ? (
          <button key={i} onClick={() => press(k)} className="h-14 rounded-xl flex items-center justify-center active:scale-95">
            <span className="material-symbols-outlined">backspace</span>
          </button>
        ) : (
          <button key={i} onClick={() => press(k)} className="h-14 rounded-xl bg-surface-container-low text-primary font-bold text-lg flex flex-col items-center justify-center active:scale-95">
            {k}<span className="text-[9px] text-on-surface-variant font-bold -mt-1">{sub}</span>
          </button>
        ))}
      </div>
      <button onClick={signOut} className="mt-3 text-xs font-bold text-on-surface-variant underline">Ce n'est pas moi — changer de compte</button>
    </div>
  );
}
