#!/usr/bin/env bash
# Scarica sul computer dello sviluppatore i backup nuovi dell'installazione
# e conserva localmente gli ultimi 30 giorni.
# Uso: SERVER=utente@indirizzo ./infra/scarica-backup.sh
set -euo pipefail

: "${SERVER:?Imposta SERVER, es. utente@salone.example}"
CARTELLA_REMOTA="${CARTELLA_REMOTA:-/opt/barber/backup}"
CARTELLA_LOCALE="${CARTELLA_LOCALE:-$HOME/Backup/barber}"
GIORNI_DA_CONSERVARE="${GIORNI_DA_CONSERVARE:-30}"

mkdir -p "$CARTELLA_LOCALE"

echo "Scaricamento dei backup da $SERVER:$CARTELLA_REMOTA"
rsync -av --ignore-existing "$SERVER:$CARTELLA_REMOTA/barber-*.sql.gz.enc" "$CARTELLA_LOCALE/"

echo "Rimozione dei backup locali più vecchi di $GIORNI_DA_CONSERVARE giorni"
find "$CARTELLA_LOCALE" -name 'barber-*.sql.gz.enc' -type f -mtime "+$GIORNI_DA_CONSERVARE" -delete

echo 'Sincronizzazione completata.'
