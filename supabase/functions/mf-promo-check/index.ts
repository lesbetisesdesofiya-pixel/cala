// supabase/functions/mf-promo-check/index.ts
// Valide un code promo SANS le consommer (la consommation a lieu à
// l'activation, argent confirmé). Utilisé par le paywall pour afficher
// le tarif réduit avant d'initier le paiement.
// POST { promo } -> { valide: true, montant } | { valide: false, motif }
// motifs : vide | inconnu | desactive | expire | epuise | deja_utilise
//
// Deploy: supabase functions deploy mf-promo-check --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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
  const { promo } = await req.json().catch(() => ({}));
  const chk = await checkPromo(
    createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    promo, user.id
  );
  if (!chk.valide) return ok({ valide: false, motif: chk.motif });
  return ok({ valide: true, montant: Number(chk.promo.montant) || 500 });
});
