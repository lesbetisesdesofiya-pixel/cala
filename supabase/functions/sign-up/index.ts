// supabase/functions/sign-up/index.ts
// Inscription téléphone + mot de passe (sans OTP, sans WhatsApp).
// Le téléphone sert de preuve d'unicité ; l'identifiant technique est un
// pseudo-email interne (le provider Phone de Supabase reste désactivé).
// POST { phone, password, prenom, nom, ecole } -> { email, password }
// La SPA enchaîne avec signInWithPassword.
//
// Deploy: supabase functions deploy sign-up --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (s: string) => String(s || "").replace(/\D/g, "");

serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    return ok({ error: "internal:" + String(e?.message || e).slice(0, 200) }, 500);
  }
});

async function handle(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { phone, password, prenom, nom, ecole, ref } = await req.json().catch(() => ({}));
  const to = "+" + digits(phone);
  if (digits(phone).length < 9) return ok({ error: "invalid_phone" }, 400);
  if (!password || String(password).length < 8) return ok({ error: "password_required" }, 400);

  // Unicité du numéro : un seul compte par téléphone.
  const { data: existing } = await sb.from("profiles").select("id").eq("phone", to).single();
  if (existing) return ok({ error: "already_registered" }, 409);

  const pseudo = "u" + digits(to) + "@whatsapp.classinote.app";
  const { data: created, error } = await sb.auth.admin.createUser({
    email: pseudo, email_confirm: true, phone: to, password: String(password),
    phone_confirm: true, user_metadata: { via: "signup" },
  });
  if (error || !created.user) return ok({ error: "auth_create:" + (error?.message || "no-user") }, 500);
  const { error: e2 } = await sb.from("profiles").insert({
    id: created.user.id, prenom: String(prenom || "Élève"), nom: String(nom || ""),
    ecole: String(ecole || ""), lycee: String(ecole || ""), phone: to,
    ref_code: String(ref || "").trim().toUpperCase() || null,
  });
  if (e2) return ok({ error: "profile:" + e2.message }, 500);
  return ok({ email: pseudo, password: String(password) });
}
