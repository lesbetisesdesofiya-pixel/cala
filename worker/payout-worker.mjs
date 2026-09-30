// Worker retraits affiliés — tourne sur le VPS (IP fixe whitelistée chez MoneyFusion).
// Initie les versements en attente via l'API MoneyFusion. Clés UNIQUEMENT en
// variables d'environnement (jamais dans ce fichier ni dans le repo).
// Cron : */5 * * * * /home/ubuntu/cala/worker/run.sh
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MF_KEY = process.env.MF_PRIVATE_KEY;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/mf-payout-webhook`;

if (!SUPABASE_URL || !SERVICE_KEY || !MF_KEY) {
  console.error("Variables manquantes : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MF_PRIVATE_KEY");
  process.exit(1);
}

async function sb(path, method = "GET", body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const pending = await sb("payouts?status=eq.pending&select=id,amount,net,phone,mode,country");
console.log(`[${new Date().toISOString()}] ${pending.length} retrait(s) en attente`);
for (const p of pending) {
  try {
    const r = await fetch("https://pay.moneyfusion.net/api/v1/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", "moneyfusion-private-key": MF_KEY },
      body: JSON.stringify({
        countryCode: p.country || "tg",
        phone: p.phone,
        amount: p.net, // net après frais 2,5 % : ce que l'affilié doit recevoir
        withdraw_mode: p.mode,
        webhook_url: WEBHOOK_URL,
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (out.statut && out.tokenPay) {
      await sb(`payouts?id=eq.${p.id}`, "PATCH", {
        tokenpay: out.tokenPay, status: "submitted", updated_at: new Date().toISOString(),
      });
      console.log(` - ${p.id}: soumis (${out.tokenPay})`);
    } else {
      console.log(` - ${p.id}: REFUSE (${out.message || r.status}) — retry au prochain passage`);
    }
  } catch (e) {
    console.log(` - ${p.id}: ERREUR ${String(e.message).slice(0, 200)} — retry au prochain passage`);
  }
}
