#!/usr/bin/env bash
# Backup cifrato del database dell'installazione.
# Da programmare ogni notte sul server, es.: 0 3 * * * /opt/barber/infra/backup.sh
# Richiede: CHIAVE_BACKUP (passphrase di cifratura), POSTGRES_USER, POSTGRES_DB.
set -euo pipefail

CARTELLA_PROGETTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CARTELLA_BACKUP="${CARTELLA_BACKUP:-$CARTELLA_PROGETTO/backup}"
GIORNI_DA_CONSERVARE="${GIORNI_DA_CONSERVARE:-7}"
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

mkdir -p "$CARTELLA_BACKUP"
NOME_FILE="$CARTELLA_BACKUP/barber-$(date +%Y-%m-%dT%H%M%S).sql.gz.enc"

echo "Creazione del backup: $NOME_FILE"
$COMPOSE exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:CHIAVE_BACKUP \
  > "$NOME_FILE"

chmod 600 "$NOME_FILE"

echo "Rimozione dei backup più vecchi di $GIORNI_DA_CONSERVARE giorni"
find "$CARTELLA_BACKUP" -name 'barber-*.sql.gz.enc' -type f -mtime "+$GIORNI_DA_CONSERVARE" -delete

echo "Backup completato."
