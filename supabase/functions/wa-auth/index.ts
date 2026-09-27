// supabase/functions/wa-auth/index.ts
// Auth WhatsApp challenge-response : l'élève PROUVE son numéro en nous écrivant.
//   POST { action: "request", phone } -> { code }            (toujours 200 même si inconnu : ne fuit rien)
//   POST { action: "check", phone, code } -> { verified, phone, password? }
//     si vérifié : crée/trouve l'utilisateur, RÉGÉNÈRE un mot de passe à usage
//     unique et le renvoie UNE fois au seul client qui présente le code.
//     La SPA fait ensuite signInWithPassword({ phone, password }).
//
// Deploy: supabase functions deploy wa-auth --no-verify-jwt
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)

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
const norm = (p: string) => "+" + digits(p);
const randCode = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return "CLASSI " + [...a].map((b) => c[b % c.length]).join(""); // "CLASSI" = mot séparé, déclencheur auto-réponse Business
};

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
  const { action, phone, code } = await req.json().catch(() => ({}));

  if (action === "request") {
    const to = norm(phone);
    if (to.replace(/\D/g, "").length < 9) return ok({ error: "invalid_phone" }, 400);
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await sb.from("verifications")
      .select("id", { count: "exact", head: true }).eq("phone", to).gte("created_at", since);
    if ((count || 0) >= 5) return ok({ error: "rate_limited" }, 429);
    const c = randCode();
    const { error } = await sb.from("verifications").insert({
      phone: to, code: c, purpose: "login", status: "pending",
      expires_at: new Date(Date.now() + 10 * 60e3).toISOString(),
    });
    if (error) return ok({ error: "db" }, 500);
    return ok({ code: c, expires_in: 600 });
  }

  if (action === "check") {
    const to = norm(phone);
    const c = String(code || "").trim().toUpperCase();
    const now = new Date().toISOString();
    const { data: v } = await sb.from("verifications").select("*")
      .eq("phone", to).eq("code", c).eq("status", "verified")
      .gt("expires_at", now).order("created_at", { ascending: false }).limit(1).single();
    if (!v) return ok({ verified: false });

    const pwd = crypto.randomUUID(); // 36 car. < limite bcrypt 72
    // Identifiant de connexion = email technique (le provider Phone/SMS de Supabase
    // est désactivé ; le téléphone reste la preuve via WhatsApp + colonne profiles.phone).
    const pseudo = "u" + digits(to) + "@whatsapp.kalanpath.app";
    const { data: prof } = await sb.from("profiles").select("id").eq("phone", to).single();
    let userId: string | undefined = prof?.id;
    if (!userId) {
      const { data: created, error } = await sb.auth.admin.createUser({
        email: pseudo, email_confirm: true, phone: to, password: pwd, phone_confirm: true, user_metadata: { via: "whatsapp" },
      });
      if (error && error.message.includes("already been registered")) {
        // Compte orphelin (créé par un essai précédent, sans profil) : on le récupère.
        let page = 1;
        while (!userId && page <= 20) {
          const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 100 });
          userId = list.users.find((u) => u.email === pseudo)?.id;
          if (list.users.length < 100) break;
          page++;
        }
        if (!userId) return ok({ error: "auth_create: compte introuvable" }, 500);
        const { data: p2 } = await sb.from("profiles").select("id").eq("id", userId).single();
        if (!p2) {
          const { error: e3 } = await sb.from("profiles").insert({ id: userId, prenom: "Élève", phone: to });
          if (e3) return ok({ error: "profile:" + e3.message }, 500);
        }
        const { error: e4 } = await sb.auth.admin.updateUserById(userId, { password: pwd, email_confirm: true, phone_confirm: true });
        if (e4) return ok({ error: "auth_update:" + e4.message }, 500);
      } else {
        if (error || !created.user) return ok({ error: "auth_create:" + (error?.message || "no-user") }, 500);
        userId = created.user.id;
        const { error: e2 } = await sb.from("profiles").insert({ id: userId, prenom: "Élève", phone: to });
        if (e2) return ok({ error: "profile:" + e2.message }, 500);
      }
    } else {
      const { error } = await sb.auth.admin.updateUserById(userId, { email: pseudo, email_confirm: true, password: pwd, phone_confirm: true });
      if (error) return ok({ error: "auth_update:" + error.message }, 500);
    }
    // Consommé SEULEMENT après succès : un échec reste réessayable.
    await sb.from("verifications").update({ status: "consumed" }).eq("id", v.id);
    return ok({ verified: true, email: pseudo, password: pwd });
  }

  return ok({ error: "action" }, 400);
}
