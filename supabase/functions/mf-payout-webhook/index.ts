// supabase/functions/mf-payout-webhook/index.ts
// Webhook MoneyFusion retraits -> finalise la ligne payouts.
// POST { event, tokenPay, ... } (sans JWT : MoneyFusion appelle)
// payout.session.completed -> completed ; payout.session.cancelled -> cancelled
// (annulé = solde automatiquement restauré, le solde excluant les annulés).
// Un appel forgé ne peut que finaliser un retrait existant vers le numéro
// déjà enregistré : aucun vol possible par ce vecteur.
//
// Deploy: supabase functions deploy mf-payout-webhook --no-verify-jwt
// Déclarer comme webhook_url : https://<projet>.supabase.co/functions/v1/mf-payout-webhook
// (ou passé par le worker à chaque retrait).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.json().catch(() => ({}));
  const event = body.event || "";
  const tokenPay = body.tokenPay || "";
  if (!tokenPay) return new Response("missing tokenPay");
  if (event !== "payout.session.completed" && event !== "payout.session.cancelled") {
    return new Response("ignored");
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await sb.from("payouts").select("id,status").eq("tokenpay", tokenPay).single();
  if (!row) return new Response("unknown tokenPay", { status: 404 });
  if (row.status === "completed" || row.status === "cancelled") return new Response("ok");
  const status = event === "payout.session.completed" ? "completed" : "cancelled";
  await sb.from("payouts").update({ status, updated_at: new Date().toISOString() }).eq("id", row.id);
  return new Response("ok");
});
