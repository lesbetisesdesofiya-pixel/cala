// supabase/functions/wa-inbound/index.ts
// Webhook Evolution API (évènement messages.upsert) -> matche le code WhatsApp.
// Config côté Evolution (manager ou API) :
//   URL = https://<projet>.supabase.co/functions/v1/wa-inbound
//   évènement = messages.upsert, en-tête x-webhook-secret = WA_INBOUND_SECRET
//
// Deploy: supabase functions deploy wa-inbound --no-verify-jwt
// Secrets: supabase secrets set WA_INBOUND_SECRET=<secret-long-aleatoire>
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const digits = (s: string) => String(s || "").replace(/\D/g, "");
// Comparaison tolérante (formats E.164 / JID / LID) : égalité sur les 9 derniers chiffres.
const sameNumber = (a: string, b: string) => {
  const x = digits(a), y = digits(b);
  if (x.length < 9 || y.length < 9) return false;
  return x.slice(-9) === y.slice(-9);
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WA_INBOUND_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.event && body.event !== "messages.upsert") return new Response("ignored");

  const d = body.data || body;
  const key = d.key || {};
  if (key.fromMe) return new Response("ignored"); // on ne traite que les messages reçus
  // Candidats expéditeur : top-level `sender`, participant (groupes), remoteJid du chat.
  // Le match réussit si L'UN d'eux correspond au numéro en attente.
  const candidates = [body.sender, key.participant, key.remoteJid]
    .map((j) => String(j || "").split("@")[0]).filter(Boolean);
  const msg = d.message || {};
  const text = String(
    msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || "",
  ).toUpperCase();
  const found = text.match(/CLASSI[\s\-_]*([A-Z0-9]{6})/);
  const code = found ? `CLASSI ${found[1]}` : null; // normalisé au format stocké
  if (!candidates.length || !code) return new Response("no-code");

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date().toISOString();
  const { data: rows } = await sb.from("verifications").select("id,phone")
    .eq("code", code).eq("status", "pending").gt("expires_at", now)
    .order("created_at", { ascending: false }).limit(20);
  const hit = (rows || []).find((r) => candidates.some((c) => sameNumber(r.phone, c)));
  if (!hit) return new Response("no-match");
  const sender = candidates.find((c) => sameNumber(hit.phone, c)) || candidates[0] || "";
  await sb.from("verifications").update({ status: "verified", sender }).eq("id", hit.id);
  return new Response("ok");
});
