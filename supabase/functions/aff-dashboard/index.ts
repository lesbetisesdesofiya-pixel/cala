// supabase/functions/aff-dashboard/index.ts
// Tableau de bord affilié : code promo, stats, filleuls, retraits.
// GET/POST {} (JWT) -> { code, payout_phone, payout_mode, stats, filleuls, payouts }
// Numéros des filleuls JAMAIS exposés (nom + prénom + date + montant uniquement).
//
// Deploy: supabase functions deploy aff-dashboard --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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

  const { data: aff } = await admin.from("affiliates").select("code_promo,payout_phone,payout_mode").eq("id", user.id).single();
  if (!aff) return ok({ error: "not_affiliate" }, 403);

  const { data: gains } = await admin.from("affiliate_earnings")
    .select("amount,filleul_user_id,subscription_id,created_at").eq("affiliate_id", user.id);
  const { data: subs } = await admin.from("subscriptions").select("id,amount,created_at")
    .in("id", (gains || []).map((g) => g.subscription_id));
  const subById = Object.fromEntries((subs || []).map((s) => [s.id, s]));
  const filleulIds = [...new Set((gains || []).map((g) => g.filleul_user_id))];
  const { data: profs } = filleulIds.length
    ? await admin.from("profiles").select("id,prenom,nom").in("id", filleulIds)
    : { data: [] };
  const profById = Object.fromEntries(((profs as unknown[]) || []).map((p) => [(p as { id: string }).id, p]));
  const { data: outs } = await admin.from("payouts").select("id,amount,frais,net,phone,mode,status,created_at")
    .eq("affiliate_id", user.id).order("created_at", { ascending: false }).limit(50);

  const revenus = (gains || []).reduce((s, g) => s + Number(g.amount), 0);
  const bloque = (outs || []).filter((o) => ["pending", "submitted", "completed"].includes(o.status))
    .reduce((s, o) => s + Number(o.amount), 0);
  const enAttente = (outs || []).filter((o) => ["pending", "submitted"].includes(o.status))
    .reduce((s, o) => s + Number(o.amount), 0);
  return ok({
    code: aff.code_promo,
    payout_phone: aff.payout_phone || null,
    payout_mode: aff.payout_mode || null,
    stats: { revenus, abonnes: filleulIds.length, solde: revenus - bloque, en_attente: enAttente },
    filleuls: (gains || []).map((g) => {
      const pf = profById[g.filleul_user_id] as { prenom?: string; nom?: string } | undefined;
      const sub = subById[g.subscription_id];
      return {
        prenom: pf?.prenom || "Filleul", nom: pf?.nom || "",
        date: (sub?.created_at || g.created_at || "").slice(0, 10),
        montant: sub ? Number(sub.amount) : Number(g.amount),
      };
    }),
    payouts: outs || [],
  });
});
