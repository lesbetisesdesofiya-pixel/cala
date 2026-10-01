import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { track } from "../lib/analytics";

// Landing publique ClassiNote (mobile-first). CTA -> inscription de l'app.
function Tick() {
  return (
    <span className="ld-tick"><svg viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg></span>
  );
}

function Phone({ src, alt, cls }) {
  return (
    <div className={`ld-phone ${cls || ""}`}><span className="ld-notch" /><div className="ld-scr"><img loading="lazy" src={src} alt={alt} /></div></div>
  );
}

const FAQ = [
  { q: "Dois-je payer pour voir mon plan ?", a: "Non : ton plan se calcule et s'affiche gratuitement. L'abonnement sert à le sauvegarder et à activer le suivi (comparaison réel vs plan, recalcul automatique)." },
  { q: "Comment je paie ?", a: "Par Mobile Money (Yas et Moov) directement dans l'app. 500 F par mois, sans engagement." },
  { q: "Je n'ai pas encore de notes, ça marche ?", a: "Oui. Le plan se construit à partir de tes matières, coefficients et difficultés, avec une base neutre. Dès ta première note, le suivi démarre." },
  { q: "Puis-je arrêter quand je veux ?", a: "Oui, sans engagement : à la fin de ta période payée, le service s'arrête simplement. Tes données restent consultables." },
  { q: "Mes données sont-elles en sécurité ?", a: "Tes notes et infos ne sont visibles que par toi, ne sont jamais revendues, et tu peux demander leur suppression à tout moment." },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const refs = useRef({});
  const go = (k) => refs.current[k]?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-ldhero]", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power3.out", delay: 0.1 });
      gsap.utils.toArray(".ld-reveal").forEach((el) => {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });
      gsap.to(".ld-float-main", { y: -14, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".ld-float-a", { y: -12, duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.4 });
      gsap.to(".ld-float-b", { y: -12, duration: 3.4, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.8 });
      gsap.to(".ld-chip-1", { y: -10, duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".ld-chip-2", { y: 10, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.5 });
      gsap.to(".ld-chip-3", { y: -8, duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1 });
      gsap.to(".ld-blob-1", { y: 80, scrollTrigger: { trigger: ".ld-hero", start: "top top", end: "bottom top", scrub: 1 } });
      gsap.to(".ld-blob-2", { y: -60, scrollTrigger: { trigger: ".ld-hero", start: "top top", end: "bottom top", scrub: 1 } });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="ld-root">
      <style>{`
        .ld-root{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#f8f9ff;color:#0b1c30;overflow-x:hidden}
        .ld-wrap{max-width:1120px;margin:0 auto;padding:0 1.25rem}
        .ld-nav{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .3s,box-shadow .3s}
        .ld-nav.scrolled{background:rgba(255,255,255,.92);backdrop-filter:blur(12px);box-shadow:0 2px 20px rgba(15,41,66,.08)}
        .ld-nav-in{max-width:1120px;margin:0 auto;padding:.9rem 1.25rem;display:flex;align-items:center;justify-content:space-between}
        .ld-brand{display:flex;align-items:center;gap:.55rem;font-weight:800;color:#0f2942;font-size:1.05rem}
        .ld-brand-mark{width:2.1rem;height:2.1rem;border-radius:.7rem;background:#0f2942;color:#ffb702;display:flex;align-items:center;justify-content:center;font-weight:800}
        .ld-nav-links{display:none;gap:1.6rem;font-size:.9rem;font-weight:600;color:#5b6472}
        .ld-nav-links button{background:none;border:none;font:inherit;color:inherit;cursor:pointer;font-weight:600}
        .ld-nav-links button:hover{color:#0f2942}
        .ld-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font-weight:800;border-radius:1rem;cursor:pointer;border:none;transition:transform .15s}
        .ld-btn:active{transform:scale(.97)}
        .ld-btn-gold{background:linear-gradient(135deg,#ffc633,#ffb702);color:#271900;box-shadow:0 10px 25px rgba(255,183,2,.35)}
        .ld-btn-ghost{background:#fff;border:2px solid #e5e9f2;color:#0f2942}
        .ld-btn-sm{padding:.65rem 1.2rem;font-size:.85rem}
        .ld-btn-lg{padding:1rem 1.8rem;font-size:1rem}
        .ld-hero{position:relative;padding:7.5rem 1.25rem 4rem;overflow:hidden}
        .ld-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;pointer-events:none}
        .ld-blob-1{width:420px;height:420px;background:#ffe9a8;top:-120px;right:-120px}
        .ld-blob-2{width:340px;height:340px;background:#d7e6ff;bottom:-140px;left:-140px}
        .ld-hero-grid{display:grid;gap:3rem;align-items:center;position:relative;max-width:1120px;margin:0 auto}
        .ld-pill{display:inline-flex;align-items:center;gap:.45rem;background:#fff;border:1.5px solid #ffe1a1;color:#7d5800;font-weight:800;font-size:.78rem;padding:.45rem .95rem;border-radius:999px;box-shadow:0 4px 14px rgba(255,183,2,.18)}
        .ld-dot{width:.5rem;height:.5rem;border-radius:50%;background:#22c55e;animation:ldpulse 1.6s infinite}
        @keyframes ldpulse{0%,100%{opacity:1}50%{opacity:.35}}
        .ld-h1{font-size:2.35rem;line-height:1.12;font-weight:800;color:#0f2942;margin:1.1rem 0 .8rem;letter-spacing:-.02em}
        .ld-hl{position:relative;white-space:nowrap}
        .ld-hl svg{position:absolute;left:0;right:0;bottom:-.35rem;width:100%;height:.6rem}
        .ld-lead{color:#5b6472;font-size:1.02rem;line-height:1.65;max-width:34rem}
        .ld-hero-cta{display:flex;gap:.8rem;margin-top:1.5rem;flex-wrap:wrap}
        .ld-hero-proof{display:flex;gap:1.2rem;margin-top:1.4rem;flex-wrap:wrap;font-size:.82rem;font-weight:700;color:#5b6472}
        .ld-hero-proof span{display:flex;align-items:center;gap:.35rem}
        .ld-tick{width:1.1rem;height:1.1rem;border-radius:50%;background:#22c55e;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}
        .ld-tick svg{width:.65rem;height:.65rem}
        .ld-hero-visual{position:relative;display:flex;justify-content:center;padding-bottom:1rem}
        .ld-phone{width:min(270px,68vw);aspect-ratio:9/18.6;background:#0f2942;border-radius:2.6rem;padding:.65rem;box-shadow:0 30px 60px rgba(15,41,66,.35);position:relative;z-index:2}
        .ld-scr{border-radius:2rem;overflow:hidden;height:100%;background:#fff}
        .ld-scr img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
        .ld-notch{position:absolute;top:1.25rem;left:50%;transform:translateX(-50%);width:5.5rem;height:1.3rem;background:#0f2942;border-radius:999px;z-index:3}
        .ld-chip-float{position:absolute;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-radius:1rem;padding:.6rem .9rem;box-shadow:0 12px 30px rgba(15,41,66,.18);font-size:.75rem;font-weight:800;color:#0f2942;z-index:3;white-space:nowrap}
        .ld-chip-float small{display:block;font-weight:600;color:#5b6472;font-size:.68rem}
        .ld-chip-1{top:12%;left:0}
        .ld-chip-2{bottom:14%;right:0}
        .ld-chip-3{top:48%;right:-2%}
        .ld-marquee{background:#0f2942;color:#fff;overflow:hidden;padding:.85rem 0;transform:rotate(-1deg) scale(1.02)}
        .ld-marquee-track{display:flex;gap:2.5rem;width:max-content;animation:ldscroll 22s linear infinite;font-weight:700;font-size:.9rem}
        .ld-marquee-track span{display:flex;align-items:center;gap:2.5rem}
        .ld-marquee-track b{color:#ffb702}
        @keyframes ldscroll{to{transform:translateX(-50%)}}
        .ld-sec{padding:4rem 1.25rem}
        .ld-eyebrow{display:inline-block;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7d5800;background:#fff3d6;padding:.4rem .9rem;border-radius:999px;margin-bottom:.9rem}
        .ld-h2{font-size:1.8rem;font-weight:800;color:#0f2942;letter-spacing:-.02em;line-height:1.2}
        .ld-sub{color:#5b6472;margin-top:.6rem;max-width:36rem;line-height:1.65}
        .ld-steps{display:grid;gap:1rem;margin-top:2rem}
        .ld-step{background:#fff;border-radius:1.4rem;padding:1.4rem;border:1px solid #e8edf5;position:relative;overflow:hidden}
        .ld-step .ld-num{font-size:2.6rem;font-weight:800;color:#f0e3c0;line-height:1}
        .ld-step h3{color:#0f2942;margin:.4rem 0 .3rem;font-size:1.05rem}
        .ld-step p{color:#5b6472;font-size:.9rem;line-height:1.6}
        .ld-feat{display:grid;gap:1.6rem;align-items:center;margin-top:3rem}
        .ld-feat .ld-txt h3{font-size:1.4rem;color:#0f2942;margin:.6rem 0 .5rem}
        .ld-feat .ld-txt p{color:#5b6472;line-height:1.7;font-size:.95rem}
        .ld-feat ul{list-style:none;margin-top:1rem;display:grid;gap:.55rem}
        .ld-feat ul li{display:flex;gap:.6rem;align-items:flex-start;font-size:.9rem;font-weight:600;color:#0f2942}
        .ld-shot{display:flex;justify-content:center;position:relative;padding:0 .5rem}
        .ld-evo{background:#f8f9ff;padding:1rem .9rem;display:flex;flex-direction:column;gap:.7rem;justify-content:flex-start}
        .ld-evo-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
        .ld-evo-head span:first-child{font-weight:800;color:#0f2942;font-size:.92rem}
        .ld-evo-badge{background:#eafaf0;color:#0d7a3f;border:1px solid #c4ecd5;font-size:.62rem;font-weight:800;padding:.28rem .55rem;border-radius:999px;white-space:nowrap}
        .ld-evo-years{display:flex;gap:.4rem}
        .ld-evo-years span{flex:1;text-align:center;font-size:.6rem;font-weight:700;color:#5b6472;background:#fff;border:1px solid #e5e9f2;padding:.35rem 0;border-radius:.6rem}
        .ld-evo-years span.on{background:#0f2942;color:#fff;border-color:#0f2942}
        .ld-evo-svg{width:100%;height:auto;background:#fff;border:1px solid #e8edf5;border-radius:.9rem;padding:.35rem}
        .ld-evo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem}
        .ld-evo-stats div{background:#fff;border:1px solid #e8edf5;border-radius:.7rem;padding:.5rem .3rem;text-align:center}
        .ld-evo-stats b{display:block;font-size:.95rem;color:#0f2942}
        .ld-evo-stats small{font-size:.55rem;color:#5b6472;font-weight:600}
        .ld-price-card{background:#0f2942;color:#fff;border-radius:1.8rem;padding:2.2rem 1.6rem;max-width:26rem;margin:2rem auto 0;position:relative;overflow:hidden;box-shadow:0 25px 60px rgba(15,41,66,.35)}
        .ld-price-card::before{content:"";position:absolute;width:300px;height:300px;border-radius:50%;background:rgba(255,183,2,.16);filter:blur(60px);top:-100px;right:-100px}
        .ld-price-tag{display:inline-block;background:#ffb702;color:#271900;font-weight:800;font-size:.78rem;padding:.4rem 1rem;border-radius:999px;margin-bottom:1rem}
        .ld-price-big{font-size:3rem;font-weight:800}
        .ld-price-big small{font-size:1rem;font-weight:600;color:#c6cfdd}
        .ld-price-list{list-style:none;margin:1.4rem 0;display:grid;gap:.7rem;font-size:.92rem;position:relative}
        .ld-price-list li{display:flex;gap:.6rem;align-items:center}
        .ld-price-note{text-align:center;color:#c6cfdd;font-size:.8rem;margin-top:1rem}
        .ld-faq{max-width:40rem;margin:2rem auto 0;display:grid;gap:.7rem}
        .ld-faq-item{background:#fff;border:1px solid #e8edf5;border-radius:1.1rem;overflow:hidden}
        .ld-faq-item button{width:100%;background:none;border:none;text-align:left;padding:1.1rem 1.2rem;font-family:inherit;font-weight:700;color:#0f2942;font-size:.95rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;cursor:pointer}
        .ld-faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease;color:#5b6472;font-size:.9rem;line-height:1.65}
        .ld-faq-a p{padding:0 1.2rem 1.2rem}
        .ld-faq-item.open .ld-plus{transform:rotate(45deg)}
        .ld-plus{font-size:1.4rem;font-weight:400;color:#ffb702;flex:none;transition:transform .3s;line-height:1}
        .ld-final{background:linear-gradient(135deg,#0f2942,#1b3a5c);border-radius:2rem;padding:3rem 1.6rem;text-align:center;color:#fff;position:relative;overflow:hidden}
        .ld-final h2{color:#fff}
        .ld-final p{color:#c6cfdd;margin:.8rem auto 1.6rem;max-width:30rem;line-height:1.65}
        .ld-foot{padding:2.5rem 1.25rem 3rem;text-align:center;color:#5b6472;font-size:.82rem}
        .ld-foot .ld-links{display:flex;gap:1.4rem;justify-content:center;margin-bottom:1rem;font-weight:700}
        .ld-reveal{opacity:0;transform:translateY(36px)}
        @media (min-width:860px){
          .ld-h1{font-size:3.4rem}
          .ld-h2{font-size:2.4rem}
          .ld-hero-grid{grid-template-columns:1.05fr .95fr}
          .ld-nav-links{display:flex}
          .ld-steps{grid-template-columns:repeat(3,1fr)}
          .ld-feat{grid-template-columns:1fr 1fr}
          .ld-feat.flip .ld-txt{order:2}
          .ld-feat.flip .ld-shot{order:1}
          .ld-chip-1{left:6%}
          .ld-chip-2{right:4%}
          .ld-chip-3{right:0}
        }
        @media (prefers-reduced-motion:reduce){
          .ld-marquee-track{animation:none}
          .ld-reveal{opacity:1;transform:none}
        }
      `}</style>

      <nav className={`ld-nav${scrolled ? " scrolled" : ""}`}><div className="ld-nav-in">
        <span className="ld-brand"><span className="ld-brand-mark"><img src="./logo.png" alt="" className="w-full h-full object-cover rounded-[0.7rem]" /></span>ClassiNote</span>
        <div className="ld-nav-links">
          <button onClick={() => go("methode")}>Méthode</button>
          <button onClick={() => go("fonctions")}>Fonctions</button>
          <button onClick={() => go("prix")}>Prix</button>
          <button onClick={() => go("faq")}>FAQ</button>
        </div>
        <Link className="ld-btn ld-btn-gold ld-btn-sm" to="/register" onClick={() => track("landing_cta_clicked", { cta: "nav" })}>Commencer</Link>
      </div></nav>

      <header className="ld-hero ld-hero-grid-wrap">
        <div className="ld-blob ld-blob-1" /><div className="ld-blob ld-blob-2" />
        <div className="ld-hero-grid">
          <div>
            <span className="ld-pill" data-ldhero><span className="ld-dot" />500 F/mois — sans engagement</span>
            <h1 className="ld-h1" data-ldhero>Ton plan pour décrocher <span className="ld-hl">ta mention<svg viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M2 9 Q 50 2 100 7 T 198 5" stroke="#ffb702" strokeWidth="5" fill="none" strokeLinecap="round" /></svg></span></h1>
            <p className="ld-lead" data-ldhero>ClassiNote calcule la note exacte à viser dans chaque matière, suit tes résultats et te dit quoi faire avant chaque épreuve. Fini les approximations.</p>
            <div className="ld-hero-cta" data-ldhero>
              <Link className="ld-btn ld-btn-gold ld-btn-lg" to="/essai" onClick={() => track("landing_cta_clicked", { cta: "hero_essai" })}>Voir mon plan</Link>
              <button className="ld-btn ld-btn-ghost ld-btn-lg" onClick={() => go("demo")}>Voir comment ça marche</button>
            </div>
            <div className="ld-hero-proof" data-ldhero>
              <span><Tick />Sans engagement</span>
              <span><Tick />Yas &amp; Moov</span>
              <span><Tick />100 % mobile</span>
            </div>
          </div>
          <div className="ld-hero-visual" data-ldhero>
            <div className="ld-chip-float ld-chip-1">Anglais : vise 17<small>en composition</small></div>
            <div className="ld-chip-float ld-chip-2">Projection 14<small>objectif atteint</small></div>
            <div className="ld-chip-float ld-chip-3">+2 pts<small>ce trimestre</small></div>
            <Phone src="shots/dashboard.png" alt="Bilan ClassiNote" cls="ld-float-main" />
          </div>
        </div>
      </header>

      <div className="ld-marquee"><div className="ld-marquee-track">
        <span>Maths <b>•</b> Physiques <b>•</b> SVT <b>•</b> Français <b>•</b> Anglais <b>•</b> Histoire-Géo <b>•</b> Philo <b>•</b>&nbsp;</span>
        <span>Maths <b>•</b> Physiques <b>•</b> SVT <b>•</b> Français <b>•</b> Anglais <b>•</b> Histoire-Géo <b>•</b> Philo <b>•</b>&nbsp;</span>
      </div></div>

      <section className="ld-sec ld-wrap" ref={(el) => (refs.current.methode = el)}>
        <span className="ld-eyebrow ld-reveal">La méthode</span>
        <h2 className="ld-h2 ld-reveal">Trois étapes, zéro devinette</h2>
        <p className="ld-sub ld-reveal">Pas de conseils vagues. Des chiffres, matière par matière, recalculés à chaque note.</p>
        <div className="ld-steps">
          <div className="ld-step ld-reveal"><div className="ld-num">01</div><h3>Fixe ton objectif</h3><p>Choisis ta moyenne visée et ta difficulté par matière. ClassiNote répartit l'effort : où sécuriser, où attaquer.</p></div>
          <div className="ld-step ld-reveal"><div className="ld-num">02</div><h3>Reçois ton plan</h3><p>La note exacte à viser en interros, DS et composition, pour chaque matière. Projection et écart affichés en permanence.</p></div>
          <div className="ld-step ld-reveal"><div className="ld-num">03</div><h3>Suis ta trajectoire</h3><p>Chaque note entrée compare réel vs plan et recalcule ce qu'il te reste à viser avant la prochaine épreuve.</p></div>
        </div>
      </section>

      <section className="ld-sec ld-wrap" ref={(el) => (refs.current.fonctions = el)}>
        <span className="ld-eyebrow ld-reveal">Dans l'app</span>
        <h2 className="ld-h2 ld-reveal">Tout ton scolaire, année après année</h2>

        <div className="ld-feat" ref={(el) => (refs.current.demo = el)}>
          <div className="ld-txt ld-reveal">
            <span className="ld-eyebrow">Simulateur</span>
            <h3>Et si je fais 15 à la compo ?</h3>
            <p>Teste tes hypothèses avant les épreuves : l'app calcule l'impact sur ta moyenne et te dit si ton objectif tient toujours.</p>
            <ul>
              <li><Tick />Scénarios par matière et par épreuve</li>
              <li><Tick />Comparaison directe avec ton plan</li>
            </ul>
          </div>
          <div className="ld-shot ld-reveal"><Phone src="shots/simu.png" alt="Simulateur d'objectif" cls="ld-float-b" /></div>
        </div>

        <div className="ld-feat flip">
          <div className="ld-txt ld-reveal">
            <span className="ld-eyebrow">Évolution</span>
            <h3>Suis ton évolution… même sur plusieurs années</h3>
            <p>Chaque année scolaire est conservée : compare ta moyenne d'une année sur l'autre, regarde ta courbe sur 3 ans et vérifie que la progression tient dans la durée.</p>
            <ul>
              <li><Tick />Historique complet, année par année</li>
              <li><Tick />Écart affiché vs l'année précédente</li>
              <li><Tick />Notes gardées même après le passage de classe</li>
            </ul>
          </div>
          <div className="ld-shot ld-reveal"><div className="ld-phone ld-float-a"><span className="ld-notch" />
            <div className="ld-scr ld-evo">
              <div className="ld-evo-head">
                <span>Mon Évolution</span>
                <span className="ld-evo-badge">+1,3 pt vs 2024–2025</span>
              </div>
              <div className="ld-evo-years">
                <span>2023–2024</span><span>2024–2025</span><span className="on">2025–2026</span>
              </div>
              <svg className="ld-evo-svg" viewBox="0 0 240 120">
                <defs>
                  <linearGradient id="ldEvoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffb702" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#ffb702" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points="15,104 60,101 105,99 150,97 195,100 230,95" fill="none" stroke="#c9d3e4" strokeWidth="2.5" strokeLinecap="round" />
                <polyline points="15,94 60,90 105,87 150,83 195,85 230,78" fill="none" stroke="#8fb6f0" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 15,84 L 60,74 L 105,70 L 150,57 L 195,61 L 230,44 L 230,112 L 15,112 Z" fill="url(#ldEvoGrad)" />
                <polyline points="15,84 60,74 105,70 150,57 195,61 230,44" fill="none" stroke="#0f2942" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="230" cy="44" r="6" fill="#ffb702" stroke="#0f2942" strokeWidth="3" />
              </svg>
              <div className="ld-evo-stats">
                <div><b>14,6</b><small>Moy. année</small></div>
                <div><b>3</b><small>années suivies</small></div>
                <div><b>+2,1</b><small>pts en 3 ans</small></div>
              </div>
            </div>
          </div></div>
        </div>

        <div className="ld-feat">
          <div className="ld-txt ld-reveal">
            <span className="ld-eyebrow">Agenda</span>
            <h3>Devoirs et exposés sous contrôle</h3>
            <p>Programme tes devoirs et exposés avec alertes, priorités et coefficients — plus rien ne te prend au dépourvu la veille.</p>
            <ul>
              <li><Tick />Alertes « à rendre bientôt »</li>
              <li><Tick />Devoirs, exposés et dates au même endroit</li>
            </ul>
          </div>
          <div className="ld-shot ld-reveal"><Phone src="shots/devoirs.png" alt="Devoirs et exposés" cls="ld-float-a" /></div>
        </div>

        <div className="ld-feat flip">
          <div className="ld-txt ld-reveal">
            <span className="ld-eyebrow">Budget étudiant</span>
            <h3>Ton argent sous contrôle</h3>
            <p>Entrées, sorties, prévisions d'épargne : garde toujours de quoi imprimer tes polys la veille des compos.</p>
            <ul>
              <li><Tick />Transactions en 10 secondes</li>
              <li><Tick />Prévision d'épargne automatique</li>
            </ul>
          </div>
          <div className="ld-shot ld-reveal"><Phone src="shots/budget.png" alt="Budget étudiant" cls="ld-float-b" /></div>
        </div>
      </section>

      <section className="ld-sec ld-wrap" ref={(el) => (refs.current.prix = el)}>
        <div style={{ textAlign: "center" }}>
          <span className="ld-eyebrow ld-reveal">Tarif unique</span>
          <h2 className="ld-h2 ld-reveal">Moins cher qu'un répétiteur</h2>
          <p className="ld-sub ld-reveal" style={{ marginLeft: "auto", marginRight: "auto" }}>Un répétiteur coûte 5 000 à 15 000 F par mois. ClassiNote, c'est ton plan de réussite pour le prix d'un goûter.</p>
        </div>
        <div className="ld-price-card ld-reveal">
          <span className="ld-price-tag">Sans engagement</span>
          <div className="ld-price-big">500 F <small>/mois, sans engagement</small></div>
          <ul className="ld-price-list">
            <li><Tick />Plan de réussite illimité</li>
            <li><Tick />Suivi réel vs plan + recalcul auto</li>
            <li><Tick />Simulateur, devoirs et budget inclus</li>
            <li><Tick />Paiement Yas &amp; Moov, sans engagement</li>
          </ul>
          <Link className="ld-btn ld-btn-gold ld-btn-lg" to="/register" style={{ width: "100%" }} onClick={() => track("landing_cta_clicked", { cta: "prix" })}>Activer mon suivi</Link>
          <p className="ld-price-note">Sans engagement — le service s'arrête à la fin de la période payée.</p>
        </div>
      </section>

      <section className="ld-sec ld-wrap" ref={(el) => (refs.current.faq = el)}>
        <div style={{ textAlign: "center" }}>
          <span className="ld-eyebrow ld-reveal">FAQ</span>
          <h2 className="ld-h2 ld-reveal">Questions fréquentes</h2>
        </div>
        <div className="ld-faq">
          {FAQ.map((f, i) => (
            <div key={i} className={`ld-faq-item ld-reveal${openFaq === i ? " open" : ""}`}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}>{f.q}<span className="ld-plus">+</span></button>
              <div className="ld-faq-a" style={openFaq === i ? { maxHeight: "12rem" } : null}><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="ld-sec ld-wrap">
        <div className="ld-final ld-reveal">
          <h2 className="ld-h2">Prêt à viser ta mention ?</h2>
          <p>Crée ton compte en 2 minutes, fixe ton objectif, reçois ton plan. 500 F/mois, sans engagement.</p>
          <Link className="ld-btn ld-btn-gold ld-btn-lg" to="/register" onClick={() => track("landing_cta_clicked", { cta: "final" })}>Créer mon plan maintenant</Link>
        </div>
      </section>

      <footer className="ld-foot ld-wrap">
        <div className="ld-links"><Link to="/register">L'app</Link><Link to="/affiliation">Parrainage</Link><Link to="/legal">Mentions légales</Link><a href="mailto:hello@sofiya.cc">Contact</a></div>
        <p>© ClassiNote — ANANI Kokou Mensah, Lomé, Togo. Fait avec rigueur pour les élèves qui visent haut.</p>
      </footer>
    </div>
  );
}
