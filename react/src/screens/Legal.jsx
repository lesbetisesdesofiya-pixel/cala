import { Link } from "react-router-dom";

export default function Legal() {
  const hash = window.location.hash;
  const anchor = hash.includes("#") ? hash.split("#").pop() : "mentions";
  return (
    <div className="px-4 py-5 space-y-4 text-sm leading-relaxed fade">
      <nav className="flex gap-2">
        <a href="#/legal" className="px-3 py-2 rounded-xl bg-white border text-xs font-bold">Mentions</a>
      </nav>
      <section className="bg-white rounded-2xl border p-5 space-y-2">
        <h2 className="font-extrabold text-lg text-primary">Mentions légales</h2>
        <p><strong>Service :</strong> ClassiNote — assistant scolaire et budget.</p>
        <p><strong>Éditeur :</strong> ANANI Kokou Mensah, entrepreneur individuel, Lomé, Togo — WhatsApp : +228 70 07 75 39, e-mail : hello@sofiya.cc.</p>
        <p><strong>Hébergement :</strong> Supabase (données), serveur WhatsApp : TheVHost (API Evolution).</p>
      </section>
      <section id="cgu" className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-extrabold text-lg text-primary">Conditions Générales d'Utilisation</h2>
        <p><strong>1. Objet.</strong> Suivi notes, devoirs, objectifs et budget ; prévisions purement <strong>indicatives</strong>.</p>
        <p><strong>2. Compte.</strong> Numéro WhatsApp vérifié + PIN à 4 chiffres. Les <strong>mineurs</strong> s'inscrivent avec l'accord d'un parent ou tuteur.</p>
        <p><strong>3. Abonnement.</strong> Premier mois à 500 F, puis 1000 F/mois. Sans abonnement actif, les écritures sont bloquées. Sans engagement, <strong>sans remboursement au prorata</strong>.</p>
        <p><strong>4. Paiement.</strong> Mobile Money (Yas, Moov). Activation à confirmation de l'opérateur.</p>
        <p><strong>5. Exactitude.</strong> Estimations pédagogiques <strong>sans garantie</strong> de mention ni de résultat.</p>
        <p><strong>6. Bon usage.</strong> Interdits : partage massif, contournement du paywall, attaques. Sanction : suspension puis suppression, sans remboursement.</p>
        <p><strong>7. Droit applicable.</strong> Droit togolais, accord amiable d'abord, tribunaux de Lomé à défaut.</p>
      </section>
      <section id="confidentialite" className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-extrabold text-lg text-primary">Politique de confidentialité</h2>
        <p><strong>Données :</strong> identité, téléphone, notes, devoirs, transactions, objectifs. <strong>Jamais revendues.</strong></p>
        <p><strong>Mineurs :</strong> accord parental ; accès/suppression sur demande.</p>
        <p><strong>Durée :</strong> vie du compte, suppression sous 30 jours sur demande.</p>
        <p><strong>Droits :</strong> accès, correction, suppression via hello@sofiya.cc / WhatsApp +228 70 07 75 39, sous 15 jours.</p>
      </section>
      <p className="text-center text-xs text-slate-500">Ancre demandée : {anchor} — <Link to="/notes" className="underline font-bold">Retour</Link></p>
    </div>
  );
}
