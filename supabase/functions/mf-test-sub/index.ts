// supabase/functions/mf-test-sub/index.ts
// TEST UNIQUEMENT (phase bêta) : offre 30 jours d'essai, 1 seule fois par compte.
// À SUPPRIMER avant le lancement public (ou à protéger par allowlist).
// Le JWT prouve l'identité ; le garde-fou "1 essai par user" est en base.
//
// Deploy: supabase functions deploy mf-test-sub --no-verify-jwt

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
  const { data: deja } = await admin.from("subscriptions").select("id")
    .eq("user_id", user.id).like("ref", "TEST-%").limit(1);
  if (deja && deja.length) return ok({ error: "already_used" }, 403);

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const ref = `TEST-${user.id.slice(0, 8)}-${Date.now()}`;
  const { error } = await admin.from("subscriptions").insert({
    user_id: user.id, plan: "mensuel", amount: 0, operator: "TEST",
    phone: "", ref, status: "active",
    started_at: start.toISOString(), expires_at: end.toISOString(),
  });
  if (error) return ok({ error: "db" }, 500);
  await admin.from("profiles").update({ formule: "Premium" }).eq("id", user.id);
  return ok({ status: "active", ref });
});
