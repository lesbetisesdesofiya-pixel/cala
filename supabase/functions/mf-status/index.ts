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
  // Affiliation : commission une seule fois (contrainte unique par abo).
  if (promoCodeId) await creditAffiliate(admin, promoCodeId, subId, userId);
  // Manager : 50 F par filleul + bonus 500 F aux 10 filleuls d'un affilié.
  if (promoCodeId) await creditManager(admin, promoCodeId, subId, userId);
}

// Commission affilié : pct % du montant payé, une seule fois par abonnement
// (idempotent via contrainte unique sur subscription_id).
async function creditAffiliate(admin: ReturnType<typeof createClient>, codeId: string, subId: string, userId: string) {
  const { data: pc } = await admin.from("promo_codes").select("affiliate_id,commission_pct").eq("id", codeId).single();
  if (!pc?.affiliate_id) return;
  const { data: s } = await admin.from("subscriptions").select("amount").eq("id", subId).single();
  const pct = Number(pc.commission_pct ?? 20);
  const gain = Math.max(0, Math.round(Number(s?.amount || 0) * pct / 100));
  if (!gain) return;
  await admin.from("affiliate_earnings").upsert(
    { affiliate_id: pc.affiliate_id, subscription_id: subId, filleul_user_id: userId, amount: gain, pct },
    { onConflict: "subscription_id", ignoreDuplicates: true }
  );
}

// Manager : 50 F par filleul payé (idempotent) + bonus 500 F quand un affilié
// de son équipe atteint 10 filleuls payés distincts (bonus unique, garde applicative).
async function creditManager(admin: ReturnType<typeof createClient>, codeId: string, subId: string, userId: string) {
  const { data: pc } = await admin.from("promo_codes").select("affiliate_id").eq("id", codeId).single();
  if (!pc?.affiliate_id) return;
  const { data: affRow } = await admin.from("affiliates").select("manager_id").eq("id", pc.affiliate_id).single();
  const managerId = affRow?.manager_id;
  if (!managerId) return;
  await admin.from("manager_earnings").upsert(
    { manager_id: managerId, affiliate_id: pc.affiliate_id, subscription_id: subId, filleul_user_id: userId, amount: 50, kind: "filleul" },
    { onConflict: "subscription_id", ignoreDuplicates: true }
  );
  const { data: rows } = await admin.from("manager_earnings").select("filleul_user_id")
    .eq("manager_id", managerId).eq("affiliate_id", pc.affiliate_id).eq("kind", "filleul");
  if (new Set((rows || []).map((r) => r.filleul_user_id)).size >= 10) {
    const { data: deja } = await admin.from("manager_earnings").select("id")
      .eq("manager_id", managerId).eq("affiliate_id", pc.affiliate_id).eq("kind", "bonus").limit(1);
    if (!deja || !deja.length) {
      await admin.from("manager_earnings").insert({
        manager_id: managerId, affiliate_id: pc.affiliate_id, subscription_id: null,
        filleul_user_id: userId, amount: 500, kind: "bonus",
      });
    }
  }
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
