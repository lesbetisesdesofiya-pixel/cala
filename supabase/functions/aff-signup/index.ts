// supabase/functions/aff-signup/index.ts
// Inscription affilié (ou activation pour un compte existant connecté).
// Crée : compte auth (même schéma email que les élèves, donc login commun),
// ligne affiliates, code promo à 6 chiffres (montant 500 F, commission 50 %
// = 250 F fixes sur le 1er mois à 500 F, une seule fois).
// Sans JWT : POST { phone, password, prenom, nom } -> { email, password, code }
// Avec JWT (compte existant) : POST {} -> { code } (active l'espace affilié).
//
// Deploy: supabase functions deploy aff-signup --no-verify-jwt

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

// Code à 6 chiffres unique (collision relancée, espace large : 900k).
async function newCode(admin: ReturnType<typeof createClient>): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data } = await admin.from("promo_codes").select("id").eq("code", code).limit(1);
    if (!data || !data.length) return code;
  }
  throw new Error("code_gen_failed");
}

async function activateSpace(admin: ReturnType<typeof createClient>, userId: string, prenom: string, nom: string) {
  const { data: existing } = await admin.from("affiliates").select("code_promo").eq("id", userId).single();
  if (existing) return { code: existing.code_promo };
  const code = await newCode(admin);
  const { error: e1 } = await admin.from("affiliates").insert({
    id: userId, code_promo: code,
    prenom: String(prenom || "Affilié"), nom: String(nom || ""),
  });
  if (e1) throw new Error("affiliate:" + e1.message);
  const { error: e2 } = await admin.from("promo_codes").insert({
    code, montant: 500, affiliate_id: userId, commission_pct: 50, actif: true,
  });
  if (e2) throw new Error("promocode:" + e2.message);
  return { code };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  // Compte existant connecté : activation de l'espace affilié.
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (jwt) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return ok({ error: "unauthorized" }, 401);
    try {
      const { code } = await activateSpace(admin, user.id, body.prenom, body.nom);
      return ok({ code });
    } catch (e) {
      return ok({ error: "internal:" + String(e?.message || e).slice(0, 200) }, 500);
    }
  }

  // Nouveau compte affilié.
  const to = "+" + digits(body.phone);
  if (digits(body.phone).length < 9) return ok({ error: "invalid_phone" }, 400);
  if (!body.password || String(body.password).length < 8) return ok({ error: "password_required" }, 400);
  const { data: taken } = await admin.from("affiliates").select("id").eq("phone", to).limit(1);
  if (taken && taken.length) return ok({ error: "already_registered" }, 409);

  const pseudo = "u" + digits(to) + "@whatsapp.classinote.app";
  const { data: created, error } = await admin.auth.admin.createUser({
    email: pseudo, email_confirm: true, phone: to, password: String(body.password),
    phone_confirm: true, user_metadata: { via: "aff-signup" },
  });
  if (error || !created.user) {
    if (/already (exists|registered)|duplicate/i.test(error?.message || "")) return ok({ error: "already_registered" }, 409);
    return ok({ error: "auth_create:" + (error?.message || "no-user") }, 500);
  }
  try {
    const { code } = await activateSpace(admin, created.user.id, body.prenom, body.nom);
    await admin.from("affiliates").update({ phone: to }).eq("id", created.user.id);
    return ok({ email: pseudo, password: String(body.password), code });
  } catch (e) {
    return ok({ error: "internal:" + String(e?.message || e).slice(0, 200) }, 500);
  }
});
