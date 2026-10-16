#!/usr/bin/env bash
# Aggiorna un'installazione a una versione pubblicata: backup, nuove immagini,
# migrazioni e riavvio. Uso: ./infra/aggiorna.sh v1.2.3
set -euo pipefail

VERSIONE_RICHIESTA="${1:?Indica la versione, es. v1.2.3}"
CARTELLA_PROGETTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $CARTELLA_PROGETTO/infra/docker-compose.produzione.yml"

echo '1/4 Backup del database'
"$CARTELLA_PROGETTO/infra/backup.sh"

echo "2/4 Scaricamento delle immagini $VERSIONE_RICHIESTA"
VERSIONE="$VERSIONE_RICHIESTA" $COMPOSE pull api web

echo '3/4 Avvio dei servizi aggiornati'
VERSIONE="$VERSIONE_RICHIESTA" $COMPOSE up -d

echo '4/4 Applicazione delle migrazioni'
VERSIONE="$VERSIONE_RICHIESTA" $COMPOSE exec -T api pnpm prisma:deploy

echo "Aggiornamento a $VERSIONE_RICHIESTA completato."
echo "Per tornare indietro: VERSIONE=<versione precedente> $COMPOSE up -d"
