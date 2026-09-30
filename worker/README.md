# Worker retraits affiliés (VPS)

Initie les versements MoneyFusion pour les retraits `pending`. Tourne toutes
les 5 min. Les secrets ne sont JAMAIS dans le repo.

## 1. Prérequis MoneyFusion (dashboard)

- **Paramètres → générer une clé API** (en-tête `moneyfusion-private-key`).
- **Whitelister l'IP du VPS** : `curl -s ifconfig.me` sur le VPS, puis
  l'ajouter dans le dashboard MoneyFusion.

## 2. Secrets sur le VPS (hors repo)

Créer `/home/ubuntu/payout-worker.env` (chmod 600) :

```
SUPABASE_URL=https://ylhsvilpmnjarfvlspko.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase Dashboard > Settings > API > service_role
MF_PRIVATE_KEY=...              # dashboard MoneyFusion > Paramètres
```

```bash
chmod 600 /home/ubuntu/payout-worker.env
chmod +x /home/ubuntu/cala/worker/run.sh
```

## 3. Cron (toutes les 5 min)

```bash
crontab -e
# ajouter :
*/5 * * * * /home/ubuntu/cala/worker/run.sh
```

## 4. Logs

```bash
tail -f /var/log/payout-worker.log
```

## Cycle de vie d'un retrait

`pending` (affilié demande) → worker → `submitted` (tokenPay MoneyFusion) →
webhook `mf-payout-webhook` → `completed` (payé) ou `cancelled` (solde restauré).
Montant envoyé = **net après frais 2,5 %**.
