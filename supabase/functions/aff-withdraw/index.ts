// supabase/functions/aff-withdraw/index.ts
// Demande de retrait affilié : crée une ligne payouts 'pending'.
// Le worker VPS (IP fixe) initie ensuite le versement MoneyFusion.
// Règles : solde suffisant (recalculé serveur), minimum 1000 F,
// numéro + mode de retrait renseignés, frais 2,5 % déduits.
// POST { amount } (JWT) -> { id, amount, frais, net }
//
// Deploy: supabase functions deploy aff-withdraw --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (s: string) => String(s || "").replace(/\D/g, "");
const MIN_RETRAIT = 1000;
const FRAIS_PCT = 2.5;

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
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: aff } = await admin.from("affiliates").select("payout_phone,payout_mode").eq("id", user.id).single();
  if (!aff) return ok({ error: "not_affiliate" }, 403);
  if (!aff.payout_phone || !aff.payout_mode) return ok({ error: "payout_info_required" }, 400);

  const amount = Math.floor(Number((await req.json().catch(() => ({}))).amount) || 0);
  if (!amount || amount < MIN_RETRAIT) return ok({ error: "montant_min", minimum: MIN_RETRAIT }, 400);

  const { data: gains } = await admin.from("affiliate_earnings").select("amount").eq("affiliate_id", user.id);
  const { data: outs } = await admin.from("payouts").select("amount,status").eq("affiliate_id", user.id);
  const revenus = (gains || []).reduce((s, g) => s + Number(g.amount), 0);
  const bloque = (outs || []).filter((o) => ["pending", "submitted", "completed"].includes(o.status))
    .reduce((s, o) => s + Number(o.amount), 0);
  if (amount > revenus - bloque) return ok({ error: "solde_insuffisant", solde: revenus - bloque }, 400);

  const frais = Math.round(amount * FRAIS_PCT / 100);
  const { data: row, error } = await admin.from("payouts").insert({
    affiliate_id: user.id, amount, frais, net: amount - frais,
    phone: aff.payout_phone, mode: aff.payout_mode, country: "tg", status: "pending",
  }).select("id").single();
  if (error || !row) return ok({ error: "db" }, 500);
  return ok({ id: row.id, amount, frais, net: amount - frais });
});
