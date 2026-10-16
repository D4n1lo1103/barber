# Gestionale per saloni di barbiere e parrucchiere

Software gestionale per un singolo salone: clienti, appuntamenti, personale, servizi e
prodotti. I clienti prenotano in autonomia e, se il salone lo attiva, acquistano prodotti
online. Ogni salone ha la **propria installazione**: server, database e credenziali dedicati.

Lingua dell'interfaccia: solo italiano. Valuta EUR, fuso orario `Europe/Rome`.

## Stato dello sviluppo

Lo sviluppo procede per fasi (vedi `docs/TODO.md`).

- **Fase 0 — Fondamenta: completata.** Monorepo, Docker, CI, database, autenticazione,
  ruoli e permessi.
- **Fase 1 — Configurazione salone: completata.** Procedura guidata al primo avvio,
  profili barbiere e parrucchiere, design system, dati demo parametrizzati.
- **Fase 2 — Personale, servizi e orari: completata.** Catalogo servizi, gestione dei
  dipendenti con attivazione dell'account, orari di apertura e di lavoro, assenze.
- Fase 3 — Agenda lato personale: da iniziare.

## Prerequisiti

- Node.js 24 o superiore
- pnpm 12 (`corepack enable && corepack prepare pnpm@12.14.0 --activate`)
- Docker e Docker Compose

## Struttura del repository

```
apps/web/        frontend React (Vite, Tailwind, Motion)
apps/api/        backend NestJS (Prisma, PostgreSQL)
packages/shared/ schemi Zod, tipi e costanti condivisi
infra/           Caddy, compose di produzione, script operativi
docs/            TODO.md e decisioni architetturali (adr/)
```

## Configurazione dell'ambiente

1. Copia il file di esempio e genera un segreto:

   ```bash
   cp .env.example .env
   openssl rand -hex 32   # valore da scrivere in SEGRETO_SESSIONE
   ```

2. Installa le dipendenze:

   ```bash
   pnpm install
   ```

### Variabili d'ambiente

| Variabile                      | Obbligatoria     | Formato                                 | Scopo                                                           |
| ------------------------------ | ---------------- | --------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                 | sì               | URL PostgreSQL                          | Connessione al database dell'installazione                      |
| `NODE_ENV`                     | sì               | `development` \| `test` \| `production` | Modalità di esecuzione                                          |
| `PORTA`                        | sì               | intero                                  | Porta di ascolto dell'API                                       |
| `SEGRETO_SESSIONE`             | sì               | almeno 32 caratteri casuali             | Segreto dei cookie e dei token                                  |
| `ORIGINE_WEB`                  | sì               | URL                                     | Origine del frontend: CORS e controllo anti-CSRF                |
| `DURATA_SESSIONE_ORE`          | no (12)          | intero, max 720                         | Durata della sessione di accesso                                |
| `IDENTIFICATIVO_INSTALLAZIONE` | no (`locale`)    | testo                                   | Identifica il salone negli eventi di Sentry                     |
| `CHIAVE_INSTALLAZIONE`         | sì               | almeno 16 caratteri casuali             | Richiesta per completare la procedura guidata al primo avvio    |
| `DATABASE_URL_OMBRA`           | solo in sviluppo | URL PostgreSQL                          | Database temporaneo usato da Prisma per calcolare le migrazioni |

| `LIMITI_FREQUENZA_DISATTIVI` | no (`false`) | `true` \| `false` | Disattiva i limiti di frequenza nei test; ignorata in produzione |
| `SENTRY_DSN` | no | URL | Monitoraggio errori |
| `VITE_URL_API` | sì (frontend) | URL | Indirizzo dell'API usato dal browser |
| `PASSWORD_DEMO` | no | testo | Password degli account dei dati demo |
| `PROFILO_DEMO` | no (`barbiere`) | `barbiere` \| `parrucchiere` | Profilo usato dai dati demo |

I segreti stanno **solo** nel file `.env`, mai nel database, nel codice o nelle immagini Docker.

## Avvio in sviluppo

```bash
docker compose up -d database          # PostgreSQL in Docker
pnpm --filter @barber/shared build     # pacchetto condiviso
pnpm --filter @barber/api prisma:migrate   # migrazioni
pnpm --filter @barber/api seed         # dati demo barbiere (mai in produzione)
# oppure: pnpm --filter @barber/api seed parrucchiere
pnpm dev                               # API su :3000, frontend su :5180
```

Account dei dati demo (password: `password-demo-salone`, modificabile con `PASSWORD_DEMO`):

- `titolare@salone.test` — ruolo titolare
- `dipendente@salone.test`, `dipendente2@salone.test` — ruolo dipendente
- `giulia.rossi@cliente.test`, `andrea.conti@cliente.test`, `elena.moretti@cliente.test` — clienti

Per provare la procedura guidata da zero: `pnpm --filter @barber/api azzera`.

Arresto dell'ambiente: `docker compose down` (con `-v` per cancellare anche i dati).

## Comandi principali

| Comando                                       | Effetto                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                                    | Avvia API e frontend con ricaricamento a caldo                           |
| `pnpm build`                                  | Costruisce pacchetto condiviso, API e frontend                           |
| `pnpm lint`                                   | ESLint su tutto il monorepo                                              |
| `pnpm format` / `pnpm format:check`           | Formattazione Prettier                                                   |
| `pnpm type-check`                             | Controllo dei tipi di tutti i progetti                                   |
| `pnpm test`                                   | Test unitari (Jest sul backend, Vitest sul frontend)                     |
| `pnpm --filter @barber/api test:integrazione` | Test di integrazione (richiede il database)                              |
| `pnpm verifica`                               | Esegue in sequenza tutti i controlli                                     |
| `pnpm --filter @barber/api prisma:migrate`    | Crea e applica una migrazione in sviluppo                                |
| `pnpm --filter @barber/api prisma:deploy`     | Applica le migrazioni (test e produzione)                                |
| `pnpm --filter @barber/api seed [profilo]`    | Inserisce i dati demo del profilo indicato (`barbiere` o `parrucchiere`) |
| `pnpm --filter @barber/api azzera`            | Svuota il database e riporta l'installazione al primo avvio              |
| `pnpm --filter @barber/web test:e2e`          | Test end-to-end Playwright                                               |

## API disponibili

Tutte le rotte hanno prefisso `/api`. L'autorizzazione è sempre verificata lato backend.

| Metodo   | Percorso                           | Autenticazione                                                                                                         | Risposte                                                                                               |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`    | `/stato`                           | pubblica                                                                                                               | `200` stato del servizio e del database                                                                |
| `GET`    | `/installazione`                   | pubblica                                                                                                               | `200` stato dell'installazione (configurata, profilo, nome del salone, vendita online)                 |
| `GET`    | `/installazione/profili/:profilo`  | pubblica                                                                                                               | `200` impostazioni e catalogo proposti, `400` profilo non riconosciuto                                 |
| `POST`   | `/installazione/procedura-guidata` | pubblica, con chiave di installazione nell'intestazione `x-chiave-installazione`; max 5 richieste ogni 5 minuti per IP | `204`, `400` dati non validi, `403` chiave errata, `409` già configurata                               |
| `POST`   | `/autenticazione/accesso`          | pubblica, max 5 richieste al minuto per IP                                                                             | `200` utente, `400` dati non validi, `401` credenziali errate, `429` troppi tentativi                  |
| `POST`   | `/autenticazione/uscita`           | sessione + token CSRF                                                                                                  | `204`, `403` token CSRF mancante o non valido                                                          |
| `GET`    | `/autenticazione/io`               | sessione                                                                                                               | `200` utente corrente, `401`                                                                           |
| `POST`   | `/autenticazione/cambio-password`  | sessione + token CSRF                                                                                                  | `204` (revoca tutte le sessioni), `400`, `401`                                                         |
| `GET`    | `/utenti/personale`                | sessione, solo titolare                                                                                                | `200` elenco, `401`, `403`                                                                             |
| `GET`    | `/servizi`                         | sessione (personale)                                                                                                   | `200` catalogo con operatori abilitati                                                                 |
| `POST`   | `/servizi`                         | solo titolare                                                                                                          | `201` servizio creato, `400` dati non validi o durata incompatibile con gli slot, `409` nome già usato |
| `PATCH`  | `/servizi/:id`                     | solo titolare                                                                                                          | `200` servizio aggiornato, `404`                                                                       |
| `DELETE` | `/servizi/:id`                     | solo titolare                                                                                                          | `200` servizio disattivato (mai cancellato)                                                            |
| `PUT`    | `/servizi/ordine`                  | solo titolare                                                                                                          | `200` catalogo riordinato, `400` elenco incompleto                                                     |
| `GET`    | `/personale`                       | sessione (personale)                                                                                                   | `200` elenco degli operatori                                                                           |
| `POST`   | `/personale`                       | solo titolare                                                                                                          | `201` operatore e link di attivazione, `409` e-mail già usata                                          |
| `PATCH`  | `/personale/:id`                   | solo titolare                                                                                                          | `200` dati aggiornati                                                                                  |
| `DELETE` | `/personale/:id`                   | solo titolare                                                                                                          | `200` disattivato e sessioni revocate, `400` sul titolare o su sé stessi                               |
| `POST`   | `/personale/:id/riattivazione`     | solo titolare                                                                                                          | `201` operatore riattivato                                                                             |
| `POST`   | `/personale/:id/invito`            | solo titolare                                                                                                          | `201` nuovo link di attivazione, che invalida il precedente                                            |
| `POST`   | `/personale/attivazione`           | pubblica, max 5 richieste ogni 5 minuti per IP                                                                         | `204` password impostata, `400` link non valido o scaduto                                              |
| `GET`    | `/orari/apertura`                  | sessione (personale)                                                                                                   | `200` fasce di apertura                                                                                |
| `PUT`    | `/orari/apertura`                  | solo titolare                                                                                                          | `200` orari sostituiti, `400` fasce sovrapposte o operatori lasciati fuori orario                      |
| `GET`    | `/orari/operatori/:id`             | sessione (personale)                                                                                                   | `200` fasce di lavoro, `404`                                                                           |
| `PUT`    | `/orari/operatori/:id`             | solo titolare                                                                                                          | `200` orari sostituiti, `400` fuori dagli orari di apertura                                            |
| `GET`    | `/orari/assenze`                   | sessione (personale)                                                                                                   | `200` assenze, filtrabili per operatore e periodo                                                      |
| `POST`   | `/orari/assenze`                   | solo titolare                                                                                                          | `201` assenza registrata, `400` intervallo non valido o sovrapposto                                    |
| `DELETE` | `/orari/assenze/:id`               | solo titolare                                                                                                          | `204`, `404`                                                                                           |

Le richieste che modificano dati devono inviare il valore del cookie `csrf`
nell'intestazione `x-csrf-token`.

## Installazione di un nuovo salone

1. Predisponi un VPS europeo con Docker e Docker Compose e un dominio che punta al server.
2. Copia sul server `infra/docker-compose.produzione.yml`, `infra/caddy/Caddyfile` e un file
   `.env` con: `REPOSITORY_GITHUB`, `VERSIONE`, `DOMINIO_SALONE`, `EMAIL_AMMINISTRATORE`,
   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `SEGRETO_SESSIONE`,
   `ORIGINE_WEB`, `IDENTIFICATIVO_INSTALLAZIONE`.
3. Avvia i servizi e applica le migrazioni:

   ```bash
   docker compose -f docker-compose.produzione.yml up -d
   docker compose -f docker-compose.produzione.yml exec api pnpm prisma:deploy
   ```

4. Genera la chiave di installazione (`openssl rand -hex 24`), scrivila nel file `.env`
   come `CHIAVE_INSTALLAZIONE` e consegnala al titolare.
5. Apri il dominio del salone: l'applicazione mostra la **procedura guidata al primo
   avvio**, che chiede profilo (barbiere o parrucchiere), dati del salone, granularità
   degli slot, tempo di blocco dello slot, vendita online, catalogo iniziale e account del
   titolare. La chiave di installazione va inserita nell'ultimo passo.
   La procedura può essere completata una sola volta.

## Deploy, aggiornamento e rollback

- **Pubblicazione immagini**: ogni push su `main` e ogni tag `vX.Y.Z` costruisce le immagini
  `barber-api` e `barber-web` e le pubblica su GitHub Container Registry.
- **Aggiornamento di un'installazione**:

  ```bash
  ./infra/aggiorna.sh v1.2.3        # backup, nuove immagini, migrazioni, riavvio
  ```

- **Rollback**: riporta `VERSIONE` alla versione precedente e riavvia. Se l'aggiornamento
  comprendeva migrazioni non compatibili, ripristina prima il backup creato dallo script:

  ```bash
  ./infra/ripristina.sh backup/barber-2026-10-16.sql.gz.enc
  VERSIONE=v1.2.2 docker compose -f docker-compose.produzione.yml up -d
  ```

## Backup e ripristino

- `infra/backup.sh` crea un dump cifrato del database e conserva gli ultimi 7 giorni.
  Va programmato ogni notte sul server (cron).
- `infra/scarica-backup.sh` scarica sul computer dello sviluppatore i backup nuovi e
  conserva gli ultimi 30 giorni.
- `infra/ripristina.sh` ripristina un backup cifrato. **Da provare periodicamente.**

La chiave di cifratura dei backup (`CHIAVE_BACKUP`) non va mai salvata sul server
assieme ai dump.

## Flussi principali

1. **Accesso del personale**: e-mail e password, sessione con cookie `httpOnly` e token CSRF.
2. **Permessi**: il titolare accede a tutto, compresi dati economici e impostazioni; il
   dipendente gestisce appuntamenti e clienti; il cliente vede solo la propria area.
3. **Cambio password**: invalida tutte le sessioni attive dell'utente.
4. **Primo avvio**: finché l'installazione non è configurata, l'unica pagina raggiungibile
   è la procedura guidata.
5. **Nuovo dipendente**: il titolare crea l'account dalle impostazioni; il sistema genera un
   link di attivazione valido sette giorni, che il titolare consegna alla persona. Il
   dipendente sceglie la propria password: il titolare non la conosce mai. Dalla fase 5 il
   link verrà inviato automaticamente per e-mail.
6. **Orari**: il titolare definisce le fasce di apertura del salone e, dentro quelle, gli
   orari di lavoro di ciascun operatore; ferie e assenze si registrano per periodo.

I flussi di agenda, prenotazione, caparra, annullamento e vendita arrivano nelle fasi successive.

## Design system

Token, componenti di base e regole di accessibilità sono documentati in
`docs/design-system.md`. L'accento cambia con il profilo dell'installazione:
rosso "lama" per il barbiere, lavanda per il parrucchiere.

## Decisioni architetturali

Sono documentate in `docs/adr/`.
