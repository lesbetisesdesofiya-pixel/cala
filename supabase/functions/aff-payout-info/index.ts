// supabase/functions/aff-payout-info/index.ts
// Renseigne / modifie le numéro + mode de retrait de l'affilié (Togo).
// POST { phone, mode } (JWT) -> { ok: true }
// modes : t-money-togo (Yas), moov-togo (Moov)
//
// Deploy: supabase functions deploy aff-payout-info --no-verify-jwt

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
const MODES = ["t-money-togo", "moov-togo"];

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
  const { phone, mode } = await req.json().catch(() => ({}));
  if (digits(phone).length < 8) return ok({ error: "invalid_phone" }, 400);
  if (!MODES.includes(String(mode))) return ok({ error: "invalid_mode" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("affiliates")
    .update({ payout_phone: "+" + digits(phone), payout_mode: String(mode) }).eq("id", user.id);
  if (error) return ok({ error: "db" }, 500);
  return ok({ ok: true });
});
