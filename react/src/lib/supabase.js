import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://ylhsvilpmnjarfvlspko.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_ewQIbVPiyAl9rH3u60eCJA_xLaFy04X";
export const WHATSAPP_NUMBER = "22870077539"; // contact support uniquement (plus de login WhatsApp)

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function sha256Hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function edgeFn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Non connecté");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}
