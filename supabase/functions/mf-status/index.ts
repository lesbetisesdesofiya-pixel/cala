// supabase/functions/mf-status/index.ts
// Vérifie un paiement MoneyFusion pour l'utilisateur CONNECTÉ et active si payé.
// POST { token } -> { status: 'paid'|'pending'|'failure'|'no paid'|'unknown' }
// Utilisé par la route /callback et le bouton "J'ai payé — vérifier".
//
// Deploy: supabase functions deploy mf-status --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function activate(admin: ReturnType<typeof createClient>, subId: string, userId: string, promoCodeId: string | null) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  await admin.from("subscriptions").update({
    status: "active", started_at: start.toISOString(), expires_at: end.toISOString(),
  }).eq("id", subId);
  await admin.from("profiles").update({ formule: "Premium" }).eq("id", userId);
  // Code promo : consommation à l'activation (argent confirmé), idempotente.
  if (promoCodeId) await consumePromo(admin, promoCodeId, userId, subId);
}

// Enregistre l'usage d'un code (unique par élève, contrainte DB) et incrémente
// le compteur une seule fois, même si webhook + vérif client se chevauchent.
async function consumePromo(admin: ReturnType<typeof createClient>, codeId: string, userId: string, subId: string) {
  const { data } = await admin.from("promo_uses").upsert(
    { code_id: codeId, user_id: userId, subscription_id: subId },
    { onConflict: "code_id,user_id", ignoreDuplicates: true }
  ).select("id");
  if (data && data.length) {
    await admin.rpc("promo_consume", { p_code: codeId });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return ok({ error: "unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return ok({ error: "unauthorized" }, 401);
  const { token } = await req.json().catch(() => ({}));
  if (!token) return ok({ error: "token_required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscriptions").select("id,user_id,status,amount,promo_code_id")
    .eq("ref", token).eq("user_id", user.id).single();
  if (!sub) return ok({ status: "unknown" });
  if (sub.status === "active") return ok({ status: "paid" });

  const notif = await fetch(`https://pay.moneyfusion.net/paiementNotif/${token}`)
    .then((r) => r.json()).catch(() => null);
  const st = notif?.data?.statut;
  if (st === "paid" && Number(notif.data.Montant || 0) >= Number(sub.amount || 500) * 0.9) {
    await activate(admin, sub.id, sub.user_id, sub.promo_code_id || null);
    return ok({ status: "paid" });
  }
  return ok({ status: st || "pending" });
});
