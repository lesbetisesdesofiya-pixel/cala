#!/bin/sh
# Lance le worker retraits avec les secrets (fichier hors repo, chmod 600).
set -a
. /home/ubuntu/payout-worker.env
set +a
/usr/bin/node /home/ubuntu/cala/worker/payout-worker.mjs >> /var/log/payout-worker.log 2>&1
