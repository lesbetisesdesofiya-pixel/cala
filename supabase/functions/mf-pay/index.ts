// supabase/functions/mf-pay/index.ts
// Initie un paiement MoneyFusion pour l'utilisateur CONNECTÉ (JWT vérifié).
// Tarif dégressif d'appel : 1er mois payé = 500 F, renouvellements = 1000 F.
// (Un abo n'ayant jamais été payé — y compris essai TEST à 0 F — garde le tarif 500.)
// POST { phone, name, return_url } -> { url, token, amount }
// Crée la subscription en 'pending' (ref = token MoneyFusion), puis la SPA
// redirige vers `url` (page de paiement). Activation via mf-webhook / mf-status.
//
// Deploy: supabase functions deploy mf-pay --no-verify-jwt
// Secrets: supabase secrets set MONEYFUSION_PAY_URL=https://pay.moneyfusion.net/.../pay/

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

  const { phone, name, return_url } = await req.json().catch(() => ({}));
  const to = "+" + digits(phone);
  if (digits(phone).length < 9 || !String(name || "").trim()) {
    return ok({ error: "phone_name_required" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Déjà payé un vrai mois (montant > 0, statut finalisé) ? Sinon : tarif découverte 500.
  const { data: passe } = await admin.from("subscriptions").select("id")
    .eq("user_id", user.id).gt("amount", 0).in("status", ["active", "expired"]).limit(1);
  const amount = passe && passe.length ? 1000 : 500;
  const payRes = await fetch(Deno.env.get("MONEYFUSION_PAY_URL")!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalPrice: amount,
      article: [{ abonnement_mensuel_classinote: amount }],
      personal_Info: [{ userId: user.id }],
      numeroSend: to,
      nomclient: String(name).trim(),
      return_url: return_url || undefined,
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mf-webhook`,
    }),
  }).then((r) => r.json()).catch(() => null);
  if (!payRes?.statut || !payRes?.token || !payRes?.url) {
    return ok({ error: "moneyfusion_unavailable" }, 502);
  }
  const { error } = await admin.from("subscriptions").insert({
    user_id: user.id, plan: "mensuel", amount, operator: "MoneyFusion",
    phone: to, ref: payRes.token, status: "pending",
  });
  if (error) return ok({ error: "db" }, 500);
  return ok({ url: payRes.url, token: payRes.token, amount });
});
