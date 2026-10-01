import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../lib/store";
import { sb } from "../lib/supabase";
import { readLivresCache, writeLivresCache } from "./Livres";

const CACHE_SW = "classinote-react-v3";
const pad2 = (n) => String(n).padStart(2, "0");

// Lecteur page-par-page (1 image = 1 page). En-tête propre (pas de TopBar) :
// retour, titre, compteur. Précharge toutes les pages à l'ouverture pour le
// hors-ligne. Aucun bouton ni lien de téléchargement.
export default function Lecteur() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [livre, setLivre] = useState(null);
  const [page, setPage] = useState(1);
  const [pretes, setPretes] = useState(0);
  const [introuvable, setIntrouvable] = useState(false);
  const vivant = useRef(true);
  const toucher = useRef(null);
  useEffect(() => { vivant.current = true; return () => { vivant.current = false; }; }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      let row = null;
      try {
        const { data, error } = await sb.from("livres").select("*").eq("id", id).single();
        if (error) throw error;
        row = data;
      } catch {
        row = (readLivresCache() || []).find((r) => r.id === id) || null;
      }
      if (stop || !vivant.current) return;
      if (!row) { setIntrouvable(true); return; }
      setLivre(row);
      // Rafraîchit le cache local de la liste avec les métadonnées à jour.
      try {
        const cache = readLivresCache() || [];
        const maj = cache.some((r) => r.id === id)
          ? cache.map((r) => (r.id === id ? row : r))
          : [...cache, row];
        writeLivresCache(row.classe, maj);
      } catch {}
      // Préchargement : chaque page vue/cachée = lisible hors ligne.
      try {
        if ("caches" in window && row.nb_pages > 0) {
          const cache = await caches.open(CACHE_SW);
          for (let i = 1; i <= row.nb_pages; i++) {
            const url = `/livres/${row.dossier}/p${pad2(i)}.jpg`;
            try {
              if (!(await cache.match(url))) await cache.add(url);
            } catch {}
            if (vivant.current) setPretes(i);
          }
        } else if (vivant.current) setPretes(row.nb_pages || 0);
      } catch {}
    })();
    return () => { stop = true; };
  }, [id]);

  if (introuvable) {
    return (
      <div className="text-center mt-10 space-y-3 fade">
        <p className="font-bold text-primary">Livre introuvable hors ligne.</p>
        <p className="text-xs text-slate-500">Ouvre-le une fois connecté pour le lire sans connexion.</p>
        <button onClick={() => nav("/livres")} className="px-6 h-11 rounded-xl bg-primary-container text-white text-sm font-bold">
          Retour aux livres
        </button>
      </div>
    );
  }
  if (!livre) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  const n = Math.max(1, livre.nb_pages || 1);
  const p = Math.min(Math.max(1, page), n);
  const url = `/livres/${livre.dossier}/p${pad2(p)}.jpg`;
  const go = (d) => setPage((v) => Math.min(n, Math.max(1, v + d)));
  return (
    <div className="fade -mx-4 -mt-4">
      <div className="sticky top-0 z-40 bg-primary-container text-white px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <button onClick={() => nav("/livres")} aria-label="Retour"
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{livre.titre}</p>
            <p className="text-[11px] text-slate-300">Page {p} / {n}{pretes < n ? ` • hors ligne ${pretes}/${n}` : ""}</p>
          </div>
        </div>
        <div className="h-1 mt-2 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-secondary-container rounded-full" style={{ width: `${(p / n) * 100}%` }} />
        </div>
      </div>
      <div
        className="select-none bg-[#0b1c30] flex items-center justify-center min-h-[60vh] px-2 py-4"
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={(e) => { toucher.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toucher.current == null) return;
          const dx = e.changedTouches[0].clientX - toucher.current;
          toucher.current = null;
          if (dx < -40) go(1);
          else if (dx > 40) go(-1);
        }}
      >
        <img key={url} src={url} alt={`Page ${p}`} draggable={false}
          className="max-h-[68vh] w-auto max-w-full rounded-lg shadow-2xl object-contain bg-white"
          onError={() => toast("Page introuvable — vérifie ta connexion")} />
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t sticky bottom-0">
        <button onClick={() => go(-1)} disabled={p <= 1}
          className="h-11 px-5 rounded-xl border font-bold text-primary text-sm disabled:opacity-40">‹ Précédent</button>
        <span className="text-xs font-bold text-slate-500">{p} / {n}</span>
        <button onClick={() => go(1)} disabled={p >= n}
          className="h-11 px-5 rounded-xl bg-secondary-container font-bold text-primary text-sm disabled:opacity-40">Suivant ›</button>
      </div>
    </div>
  );
}
