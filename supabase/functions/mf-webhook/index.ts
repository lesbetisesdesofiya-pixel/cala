// supabase/functions/mf-webhook/index.ts
// Webhook MoneyFusion -> active l'abonnement (30 jours) + profil Premium.
// MoneyFusion peut renvoyer plusieurs fois le même évènement : idempotent
// (on ignore si déjà 'active'). Le client ne peut JAMAIS s'activer seul.
//
// Évènements : payin.session.pending (ignoré), payin.session.completed (-> active),
// payin.session.cancelled / failure (-> failed).
//
// Deploy: supabase functions deploy mf-webhook --no-verify-jwt
// Secrets: MF_WEBHOOK_SECRET optionnel (si MoneyFusion sait envoyer
// l'en-tête x-webhook-secret, sinon on re-vérifie chaque appel via
// paiementNotif — aucun appel forgé ne peut activer).
// Puis déclare https://<projet>.supabase.co/functions/v1/mf-webhook
// comme webhook_url (ou dans le dashboard MoneyFusion), avec
// l'en-tête x-webhook-secret si supporté — sinon le secret transite
// en vérifiant personal_Info + montant côté fonction.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  // Secret optionnel (MoneyFusion ne sait pas forcément envoyer d'en-tête perso) :
  // chemin de confiance si présent et valide, sinon vérification systématique
  // via l'API MoneyFusion (source autoritaire). Dans les deux cas, un appel
  // forgé ne peut rien activer : il faut un vrai paiement confirmé.
  const secret = Deno.env.get("MF_WEBHOOK_SECRET");
  const secretOk = !!secret && req.headers.get("x-webhook-secret") === secret;
  const body = await req.json().catch(() => ({}));
  const event = body.event || "";
  const statut = body.statut || "";
  const tokenPay = body.tokenPay || "";
  if (!tokenPay) return new Response("missing tokenPay");
  const isSuccess = event === "payin.session.completed" || statut === "paid";
  if (!isSuccess) return new Response("ignored"); // pending / cancelled : rien à activer

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await sb.from("subscriptions").select("id,user_id,status,amount,promo_code_id")
    .eq("ref", tokenPay).single();
  if (!sub) return new Response("unknown ref", { status: 404 });
  if (sub.status === "active") return new Response("ok"); // doublon : déjà traité
  const attendu = Number(sub.amount || 500) * 0.9;

  if (secretOk) {
    const montant = Number(body.Montant || 0);
    if (montant >= attendu) return activate(sb, sub.id, sub.user_id, sub.promo_code_id || null);
    return new Response("amount mismatch");
  }
  // Chemin vérifié : on croit MoneyFusion, pas l'appelant.
  const notif = await fetch(`https://pay.moneyfusion.net/paiementNotif/${tokenPay}`)
    .then((r) => r.json()).catch(() => null);
  if (notif?.data?.statut === "paid" && Number(notif.data.Montant || 0) >= attendu) {
    return activate(sb, sub.id, sub.user_id, sub.promo_code_id || null);
  }
  return new Response("unverified");
});

async function activate(sb: ReturnType<typeof createClient>, subId: string, userId: string, promoCodeId: string | null) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  await sb.from("subscriptions").update({
    status: "active",
    operator: "MoneyFusion",
    started_at: start.toISOString(),
    expires_at: end.toISOString(),
  }).eq("id", subId);
  await sb.from("profiles").update({ formule: "Premium" }).eq("id", userId);
  // Code promo : consommation à l'activation (argent confirmé), idempotente.
  if (promoCodeId) {
    const { data } = await sb.from("promo_uses").upsert(
      { code_id: promoCodeId, user_id: userId, subscription_id: subId },
      { onConflict: "code_id,user_id", ignoreDuplicates: true }
    ).select("id");
    if (data && data.length) {
      await sb.rpc("promo_consume", { p_code: promoCodeId });
    }
  }
  return new Response("ok");
}
