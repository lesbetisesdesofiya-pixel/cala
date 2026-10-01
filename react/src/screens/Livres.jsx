import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb } from "../lib/supabase";

const CACHE_LISTE = "kp_livres";

export function readLivresCache(classe) {
  try {
    const s = JSON.parse(localStorage.getItem(CACHE_LISTE) || "null");
    if (s && (!classe || s.classe === classe) && Array.isArray(s.rows)) return s.rows;
  } catch {}
  return null;
}

export function writeLivresCache(classe, rows) {
  try { localStorage.setItem(CACHE_LISTE, JSON.stringify({ classe, rows, at: Date.now() })); } catch {}
}

// Badge "Dispo hors ligne" : la couverture est-elle dans le cache SW ?
function useHorsLigne(url) {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        if (!("caches" in window) || !url) { if (!stop) setOk(false); return; }
        const hit = await caches.match(url);
        if (!stop) setOk(!!hit);
      } catch { if (!stop) setOk(false); }
    })();
    return () => { stop = true; };
  }, [url]);
  return ok;
}

function CarteLivre({ livre }) {
  const cover = livre.couverture || `/livres/${livre.dossier}/cover.jpg`;
  const hl = useHorsLigne(cover);
  return (
    <Link to={`/livres/${livre.id}`} className="flex gap-3 p-3 rounded-2xl bg-white border shadow-card">
      <img src={cover} alt="" loading="lazy"
        className="w-14 h-[4.5rem] rounded-xl object-cover bg-slate-100 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-sm text-primary truncate">{livre.titre}</h3>
        <p className="text-[11px] text-slate-500">{livre.matiere} • {livre.nb_pages} pages</p>
        {hl && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-xs">offline_pin</span>Dispo hors ligne
          </span>
        )}
      </div>
      <span className="material-symbols-outlined text-slate-300 self-center">chevron_right</span>
    </Link>
  );
}

export default function Livres() {
  const { db } = useApp();
  const classe = db.user.classe;
  const [rows, setRows] = useState(() => readLivresCache(classe) || []);
  const [charge, setCharge] = useState(false);
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const { data, error } = await sb.from("livres").select("*")
          .eq("classe", classe).order("ordre").order("titre");
        if (error) throw error;
        if (!stop) {
          setRows(data || []);
          setCharge(true);
          writeLivresCache(classe, data || []);
        }
      } catch {
        // Hors ligne : on garde le cache local (vu précédemment).
        if (!stop) setCharge(true);
      }
    })();
    return () => { stop = true; };
  }, [classe]);
  const groupes = rows.reduce((acc, l) => { (acc[l.matiere] ||= []).push(l); return acc; }, {});
  const mats = Object.keys(groupes).sort();
  return (
    <div className="space-y-4 fade">
      <section>
        <h1 className="text-2xl font-bold text-primary">Mes livres</h1>
        <p className="text-sm text-slate-500 font-medium">{classe} • à lire même sans connexion</p>
      </section>
      {charge && !rows.length && (
        <div className="rounded-2xl bg-white p-6 border text-center text-sm text-slate-500">
          Aucun livre pour ta classe pour l'instant.<br />Reviens après la mise à jour.
        </div>
      )}
      {mats.map((m) => (
        <section key={m} className="space-y-2.5">
          <h2 className="font-bold text-primary px-1">{m}</h2>
          {groupes[m].map((l) => <CarteLivre key={l.id} livre={l} />)}
        </section>
      ))}
    </div>
  );
}
