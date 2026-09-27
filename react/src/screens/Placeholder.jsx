import { Link } from "react-router-dom";

// Écran temporaire : les autres écrans sont portés un par un depuis la version vanilla.
export default function Placeholder({ title }) {
  return (
    <div className="fade bg-white rounded-2xl border p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-primary">construction</span>
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <p className="text-sm text-slate-500">Écran en cours de portage vers React.</p>
      <Link to="/notes" className="inline-block px-5 h-11 leading-[44px] rounded-xl bg-primary-container text-white text-sm font-bold">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
