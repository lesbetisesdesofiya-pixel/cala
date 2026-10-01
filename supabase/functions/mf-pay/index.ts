// supabase/functions/mf-pay/index.ts
// Initie un paiement MoneyFusion pour l'utilisateur CONNECTÉ (JWT vérifié).
// Tarif unique : 1000 F/mois, sans promo ni remise.
// Attribution parrainage (best-effort, jamais bloquante) : code passé en
// param OU code ref stocké au register (?ref=) -> promo_code_id sur la
// souscription -> commissions affilié/manager à l'activation.
// POST { phone, name, return_url, promo? } -> { url, token, amount }
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

// Validation d'un code promo SANS le consommer (consommation à l'activation).
async function checkPromo(admin: ReturnType<typeof createClient>, raw: string, userId: string) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return { valide: false as const, motif: "vide" };
  const { data: pc } = await admin.from("promo_codes")
    .select("id,montant,max_uses,used_count,expires_at,actif").eq("code", code).single();
  if (!pc) return { valide: false as const, motif: "inconnu" };
  if (!pc.actif) return { valide: false as const, motif: "desactive" };
  if (pc.expires_at && new Date(pc.expires_at).getTime() < Date.now()) return { valide: false as const, motif: "expire" };
  if (pc.max_uses != null && Number(pc.used_count) >= Number(pc.max_uses)) return { valide: false as const, motif: "epuise" };
  const { data: used } = await admin.from("promo_uses").select("id").eq("code_id", pc.id).eq("user_id", userId).limit(1);
  if (used && used.length) return { valide: false as const, motif: "deja_utilise" };
  return { valide: true as const, promo: pc };
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

  const { phone, name, return_url, promo } = await req.json().catch(() => ({}));
  const to = "+" + digits(phone);
  if (digits(phone).length < 9 || !String(name || "").trim()) {
    return ok({ error: "phone_name_required" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Tarif unique 1000 F, sans promo ni remise.
  // Attribution parrainage conservée (best-effort, jamais bloquante) : param
  // promo explicite, sinon code ref du profil (?ref= au register).
  // Invalide/déjà utilisé -> on paie 1000 plein SANS attribution.
  let amount = 1000;
  let promoCodeId: string | null = null;
  let refCode: string | null = null;
  try {
    const { data: prof } = await admin.from("profiles").select("ref_code").eq("id", user.id).single();
    refCode = prof?.ref_code || null;
  } catch {}
  const codeIn = (promo && String(promo).trim()) || refCode;
  if (codeIn) {
    const chk = await checkPromo(admin, codeIn, user.id);
    // Valide -> attribution seule (le prix reste 1000 dans tous les cas).
    if (chk.valide) promoCodeId = chk.promo.id;
  }
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
    phone: to, ref: payRes.token, status: "pending", promo_code_id: promoCodeId,
  });
  if (error) return ok({ error: "db" }, 500);
  return ok({ url: payRes.url, token: payRes.token, amount });
});
