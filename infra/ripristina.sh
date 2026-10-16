#!/usr/bin/env bash
# Ripristina un backup cifrato nel database dell'installazione.
# Uso: ./infra/ripristina.sh backup/barber-2026-10-16T030000.sql.gz.enc
# ATTENZIONE: sovrascrive i dati esistenti. Richiede conferma esplicita.
set -euo pipefail

FILE_BACKUP="${1:?Indica il file di backup da ripristinare}"
CARTELLA_PROGETTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $CARTELLA_PROGETTO/infra/docker-compose.produzione.yml"

if [[ -f "$CARTELLA_PROGETTO/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$CARTELLA_PROGETTO/.env"
  set +a
fi

: "${CHIAVE_BACKUP:?CHIAVE_BACKUP non impostata}"
: "${POSTGRES_USER:?POSTGRES_USER non impostata}"
: "${POSTGRES_DB:?POSTGRES_DB non impostata}"

echo "Il ripristino sovrascrive il contenuto del database \"$POSTGRES_DB\"."
read -r -p 'Scrivi RIPRISTINA per confermare: ' conferma
[[ "$conferma" == 'RIPRISTINA' ]] || { echo 'Operazione annullata.'; exit 1; }

echo 'Arresto dell API per evitare scritture durante il ripristino.'
$COMPOSE stop api

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:CHIAVE_BACKUP -in "$FILE_BACKUP" \
  | gunzip \
  | $COMPOSE exec -T database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

$COMPOSE start api
echo 'Ripristino completato.'
