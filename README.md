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
- **Fase 3 — Agenda lato personale: completata.** Calcolo della disponibilità, agenda per
  operatore con viste giornaliera e settimanale, inserimento dal personale con flag "senza
  caparra", spostamenti, annullamenti con motivo, mancate presentazioni, completamento,
  schede clienti con invito di attivazione.
- **Fasi 4 e 5 — Area cliente ed e-mail: completate** (unite in un unico passaggio).
  Registrazione autonoma con consensi GDPR, verifica dell'indirizzo, reimpostazione della
  password, prenotazione online, spostamento e annullamento secondo le regole del salone,
  copia e cancellazione dei propri dati; invio e-mail via SMTP con coda pg-boss.
- **Fase 6 — Caparra e pagamenti Stripe: completata.** Caparra configurabile dal titolare
  (attivazione, percentuale, forma di restituzione), pagamento online con Stripe Checkout
  ospitato, conferma solo dopo l'evento firmato e idempotente, scadenza del blocco dello
  slot, rimborsi, credito senza scadenza, restituzione discrezionale del titolare e registro
  dei movimenti. Senza le chiavi di Stripe i pagamenti non sono reali: viene usato un
  fornitore finto (vedi ADR 0008).
- **Fase 7 — WhatsApp: completata.** Conferme, promemoria e inviti su WhatsApp con ripiego
  via e-mail, verifica del numero con un codice, impostazioni nella procedura guidata e nella
  scheda _Messaggi_. Senza il token di Meta i messaggi non partono: vengono registrati nei log
  e tutto arriva via e-mail (vedi ADR 0009).

- **Fase 8 — Prodotti e magazzino: completata.** Catalogo prodotti del titolare, vendite in
  negozio registrate dal personale con scarico del magazzino, giacenza che non va sotto zero,
  correzioni solo del titolare sempre motivate, annullamento che ripristina i pezzi e avviso
  di scorta minima. La vendita non produce documenti per il cliente (vedi ADR 0010).

**Dalla fase 7 il software è utilizzabile da un salone reale (MVP).** Restano la fase 9
(vendita online) e la fase 10 (statistiche e KPI).

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

| `SMTP_HOST` | sì in produzione | host | Server SMTP per l'invio delle e-mail (provider consigliato: Brevo). Senza, i messaggi restano nei log |
| `SMTP_PORTA` | no (587) | intero | Porta SMTP |
| `SMTP_UTENTE` / `SMTP_PASSWORD` | no | testo | Credenziali SMTP, se il server le richiede |
| `SMTP_MITTENTE` | no | `Nome <indirizzo>` | Mittente dei messaggi di servizio |
| `SMTP_TLS_IMPLICITO` | no (`false`) | `true` \| `false` | `true` solo con TLS implicito (porta 465) |
| `CODA_ATTIVA` | no (`true`) | `true` \| `false` | Coda pg-boss delle attività in background; con `false` vengono eseguite in linea |
| `STRIPE_CHIAVE_SEGRETA` | sì in produzione | `sk_…` | Chiave segreta Stripe. Senza, i pagamenti sono finti (solo sviluppo e test) |
| `STRIPE_SEGRETO_WEBHOOK` | sì in produzione | `whsec_…` | Segreto con cui si verifica la firma degli eventi Stripe |
| `STRIPE_CHIAVE_PUBBLICABILE` | no | `pk_…` | Chiave pubblicabile; non è un segreto |
| `WHATSAPP_TOKEN` | no | testo | Token dell'app di Meta. Senza, i messaggi WhatsApp non partono e tutto va via e-mail |
| `WHATSAPP_VERSIONE_API` | no (`v23.0`) | `vXX.Y` | Versione delle API di Meta |
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

| Metodo   | Percorso                                  | Autenticazione                                                                                                         | Risposte                                                                                               |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`    | `/stato`                                  | pubblica                                                                                                               | `200` stato del servizio e del database                                                                |
| `GET`    | `/installazione`                          | pubblica                                                                                                               | `200` stato dell'installazione (configurata, profilo, nome del salone, vendita online, granularità)    |
| `GET`    | `/installazione/profili/:profilo`         | pubblica                                                                                                               | `200` impostazioni e catalogo proposti, `400` profilo non riconosciuto                                 |
| `POST`   | `/installazione/procedura-guidata`        | pubblica, con chiave di installazione nell'intestazione `x-chiave-installazione`; max 5 richieste ogni 5 minuti per IP | `204`, `400` dati non validi, `403` chiave errata, `409` già configurata                               |
| `POST`   | `/autenticazione/accesso`                 | pubblica, max 5 richieste al minuto per IP                                                                             | `200` utente, `400` dati non validi, `401` credenziali errate, `429` troppi tentativi                  |
| `POST`   | `/autenticazione/uscita`                  | sessione + token CSRF                                                                                                  | `204`, `403` token CSRF mancante o non valido                                                          |
| `GET`    | `/autenticazione/io`                      | sessione                                                                                                               | `200` utente corrente, `401`                                                                           |
| `POST`   | `/autenticazione/cambio-password`         | sessione + token CSRF                                                                                                  | `204` (revoca tutte le sessioni), `400`, `401`                                                         |
| `GET`    | `/utenti/personale`                       | sessione, solo titolare                                                                                                | `200` elenco, `401`, `403`                                                                             |
| `GET`    | `/servizi`                                | sessione (personale)                                                                                                   | `200` catalogo con operatori abilitati                                                                 |
| `POST`   | `/servizi`                                | solo titolare                                                                                                          | `201` servizio creato, `400` dati non validi o durata incompatibile con gli slot, `409` nome già usato |
| `PATCH`  | `/servizi/:id`                            | solo titolare                                                                                                          | `200` servizio aggiornato, `404`                                                                       |
| `DELETE` | `/servizi/:id`                            | solo titolare                                                                                                          | `200` servizio disattivato (mai cancellato)                                                            |
| `PUT`    | `/servizi/ordine`                         | solo titolare                                                                                                          | `200` catalogo riordinato, `400` elenco incompleto                                                     |
| `GET`    | `/personale`                              | sessione (personale)                                                                                                   | `200` elenco degli operatori                                                                           |
| `POST`   | `/personale`                              | solo titolare                                                                                                          | `201` operatore e link di attivazione, `409` e-mail già usata                                          |
| `PATCH`  | `/personale/:id`                          | solo titolare                                                                                                          | `200` dati aggiornati                                                                                  |
| `DELETE` | `/personale/:id`                          | solo titolare                                                                                                          | `200` disattivato e sessioni revocate, `400` sul titolare o su sé stessi                               |
| `POST`   | `/personale/:id/riattivazione`            | solo titolare                                                                                                          | `201` operatore riattivato                                                                             |
| `POST`   | `/personale/:id/invito`                   | solo titolare                                                                                                          | `201` nuovo link di attivazione, che invalida il precedente                                            |
| `POST`   | `/autenticazione/registrazione`           | pubblica, max 5 richieste ogni 5 minuti per IP                                                                         | `201` verifica inviata, `400` dati o consenso mancanti, `409` e-mail o numero già usati                |
| `POST`   | `/autenticazione/verifica-email`          | pubblica, max 10 richieste ogni 5 minuti per IP                                                                        | `204` indirizzo confermato, `400` link non valido o scaduto                                            |
| `POST`   | `/autenticazione/verifica-email/rinvio`   | pubblica, max 3 richieste ogni 5 minuti per IP                                                                         | `204` sempre, anche se l'indirizzo non esiste                                                          |
| `POST`   | `/autenticazione/reset-password`          | pubblica, max 3 richieste ogni 5 minuti per IP                                                                         | `204` sempre, anche se l'indirizzo non esiste                                                          |
| `POST`   | `/autenticazione/reset-password/conferma` | pubblica, max 5 richieste ogni 5 minuti per IP                                                                         | `204` password cambiata e sessioni revocate, `400` link non valido                                     |
| `POST`   | `/autenticazione/attivazione`             | pubblica, max 5 richieste ogni 5 minuti per IP                                                                         | `204` account attivato, `400` link non valido o e-mail mancante, `409` e-mail già usata                |
| `GET`    | `/orari/apertura`                         | sessione (personale)                                                                                                   | `200` fasce di apertura                                                                                |
| `PUT`    | `/orari/apertura`                         | solo titolare                                                                                                          | `200` orari sostituiti, `400` fasce sovrapposte o operatori lasciati fuori orario                      |
| `GET`    | `/orari/operatori/:id`                    | sessione (personale)                                                                                                   | `200` fasce di lavoro, `404`                                                                           |
| `PUT`    | `/orari/operatori/:id`                    | solo titolare                                                                                                          | `200` orari sostituiti, `400` fuori dagli orari di apertura                                            |
| `GET`    | `/orari/assenze`                          | sessione (personale)                                                                                                   | `200` assenze, filtrabili per operatore e periodo                                                      |
| `POST`   | `/orari/assenze`                          | solo titolare                                                                                                          | `201` assenza registrata, `400` intervallo non valido o sovrapposto                                    |
| `DELETE` | `/orari/assenze/:id`                      | solo titolare                                                                                                          | `204`, `404`, `400` se la riga fa parte di una chiusura                                                |
| `GET`    | `/orari/chiusure`                         | sessione (personale)                                                                                                   | `200` chiusure raggruppate per periodo e motivo                                                        |
| `POST`   | `/orari/chiusure`                         | solo titolare                                                                                                          | `201` chiusura registrata per tutti gli operatori, `400` periodo non valido o già occupato             |
| `DELETE` | `/orari/chiusure`                         | solo titolare                                                                                                          | `204` chiusura rimossa per tutti, `404`                                                                |
| `GET`    | `/prodotti`                               | sessione (personale)                                                                                                   | `200` catalogo; il dipendente vede solo i prodotti in vendita                                          |
| `GET`    | `/prodotti/sotto-scorta`                  | sessione (personale)                                                                                                   | `200` prodotti arrivati alla scorta minima                                                             |
| `POST`   | `/prodotti`                               | solo titolare                                                                                                          | `201` prodotto creato, `409` nome già usato                                                            |
| `PATCH`  | `/prodotti/:id`                           | solo titolare                                                                                                          | `200` aggiornato; la giacenza non si cambia da qui                                                     |
| `DELETE` | `/prodotti/:id`                           | solo titolare                                                                                                          | `200` ritirato dalla vendita (mai cancellato)                                                          |
| `PUT`    | `/prodotti/ordine`                        | solo titolare                                                                                                          | `200` catalogo riordinato                                                                              |
| `POST`   | `/prodotti/:id/movimenti`                 | solo titolare                                                                                                          | `201` giacenza aggiornata, `400` motivo mancante, `409` giacenza sotto zero                            |
| `GET`    | `/prodotti/:id/movimenti`                 | solo titolare                                                                                                          | `200` movimenti di magazzino                                                                           |
| `GET`    | `/vendite`                                | sessione (personale)                                                                                                   | `200` vendite paginate, filtrabili per cliente                                                         |
| `POST`   | `/vendite`                                | sessione (personale)                                                                                                   | `201` vendita registrata e magazzino scaricato, `409` pezzi insufficienti                              |
| `POST`   | `/vendite/:id/annullamento`               | sessione (personale)                                                                                                   | `201` annullata e giacenza ripristinata, `409` già annullata                                           |
| `GET`    | `/impostazioni/whatsapp`                  | solo titolare                                                                                                          | `200` attivazione, numero mittente, modelli, presenza del token                                        |
| `PUT`    | `/impostazioni/whatsapp`                  | solo titolare                                                                                                          | `200` salvate, `400` attivo senza numero mittente o nomi di modello non validi                         |
| `POST`   | `/impostazioni/whatsapp/prova`            | solo titolare                                                                                                          | `201` esito dell'invio di prova                                                                        |
| `GET`    | `/impostazioni/regole`                    | sessione (personale)                                                                                                   | `200` preavviso, regola di spostamento, promemoria, caparra (attiva, percentuale, restituzione)        |
| `PUT`    | `/impostazioni/regole`                    | solo titolare                                                                                                          | `200` regole salvate, `400` valori fuori intervallo                                                    |
| `GET`    | `/cancellazioni`                          | solo titolare                                                                                                          | `200` richieste di cancellazione con gli appuntamenti futuri di ciascun cliente                        |
| `POST`   | `/cancellazioni/:id/evasione`             | solo titolare                                                                                                          | `201` richiesta chiusa, `400` appuntamenti ancora in agenda, `409` già chiusa                          |

### Clienti e agenda (fase 3)

Tutte queste rotte richiedono una sessione del personale (titolare o dipendente): ogni
membro del personale vede e gestisce tutte le agende. L'area clienti avrà rotte proprie,
con le regole di preavviso previste per i clienti (fase 4).

| Metodo  | Percorso                                  | Note                                                                                                                  | Risposte                                                                                                                    |
| ------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/clienti`                                | `cerca`, `pagina`, `perPagina`                                                                                        | `200` elenco paginato                                                                                                       |
| `GET`   | `/clienti/:id`                            |                                                                                                                       | `200` scheda, `404`                                                                                                         |
| `POST`  | `/clienti`                                | nome, cognome, numero WhatsApp (e-mail facoltativa); max 30 richieste ogni 5 minuti per IP                            | `201` scheda e link di attivazione, `400` dati non validi, `409` numero o e-mail già presenti                               |
| `PATCH` | `/clienti/:id`                            |                                                                                                                       | `200` scheda aggiornata, `409` numero o e-mail di un altro cliente                                                          |
| `POST`  | `/clienti/:id/invito`                     |                                                                                                                       | `201` nuovo link di attivazione, `409` account già attivato                                                                 |
| `GET`   | `/appuntamenti`                           | `dal` (data locale), `giorni`, `operatoreId`, `clienteId`                                                             | `200` appuntamenti del periodo, `400` data non valida                                                                       |
| `GET`   | `/appuntamenti/disponibilita`             | `operatoreId`, `servizioIds` separati da virgola, `dal`, `giorni`, `escludiAppuntamentoId`                            | `200` slot liberi per giorno, `400` servizi o operatore non compatibili                                                     |
| `GET`   | `/appuntamenti/cliente/:clienteId`        | storico, dal più recente                                                                                              | `200` appuntamenti, `404` cliente inesistente                                                                               |
| `GET`   | `/appuntamenti/:id`                       |                                                                                                                       | `200`, `404`                                                                                                                |
| `POST`  | `/appuntamenti`                           | cliente, operatore, servizi, inizio, `senzaCaparra`, `forzato` (solo titolare); max 60 richieste ogni 5 minuti per IP | `201` appuntamento, `400` fuori orario o oltre i limiti di data, `403` deroga chiesta da un dipendente, `409` slot occupato |
| `POST`  | `/appuntamenti/:id/spostamento`           | nuovo orario e, se serve, nuovo operatore                                                                             | `201` appuntamento aggiornato, `400`, `409` slot occupato                                                                   |
| `POST`  | `/appuntamenti/:id/annullamento`          | motivo (`tempestivo`, `tardivo`, `dal_salone`) e nota                                                                 | `201` appuntamento annullato, `400` motivo mancante o stato non compatibile                                                 |
| `POST`  | `/appuntamenti/:id/mancata-presentazione` |                                                                                                                       | `201` appuntamento segnato, `400` stato non compatibile                                                                     |
| `POST`  | `/appuntamenti/:id/completamento`         | sempre manuale                                                                                                        | `201` appuntamento completato, `400` stato non compatibile                                                                  |

### Area cliente (fasi 4 e 5)

Rotte riservate al ruolo `cliente`: agiscono sempre e solo sui propri dati, letti dalla
sessione.

| Metodo  | Percorso                                      | Note                                                            | Risposte                                                                      |
| ------- | --------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET`   | `/area-cliente/catalogo`                      | servizi attivi e operatori in servizio                          | `200`                                                                         |
| `GET`   | `/area-cliente/appuntamenti`                  | con le azioni ancora consentite                                 | `200`                                                                         |
| `GET`   | `/area-cliente/disponibilita`                 | come la rotta del personale, ma con due ore di preavviso minimo | `200`, `400`                                                                  |
| `POST`  | `/area-cliente/appuntamenti`                  | max 10 richieste ogni 5 minuti per IP                           | `201` appuntamento, `400` meno di due ore o fuori orario, `409` slot occupato |
| `POST`  | `/area-cliente/appuntamenti/:id/spostamento`  | solo entro il limite di preavviso                               | `201`, `400` oltre il limite, `404` non è un proprio appuntamento             |
| `POST`  | `/area-cliente/appuntamenti/:id/annullamento` | solo entro il limite: è sempre tempestivo                       | `201`, `400` oltre il limite, `404`                                           |
| `POST`  | `/area-cliente/numero/codice`                 | max 3 richieste ogni 15 minuti per IP                           | `201` canale e scadenza del codice, `409` numero già verificato               |
| `POST`  | `/area-cliente/numero/verifica`               | max 10 ogni 15 minuti per IP                                    | `204` verificato, `400` codice errato, `409` numero di un altro account       |
| `GET`   | `/area-cliente/profilo`                       |                                                                 | `200`                                                                         |
| `PATCH` | `/area-cliente/profilo`                       | contatti e consenso WhatsApp                                    | `200`, `409` numero di un altro account                                       |
| `GET`   | `/area-cliente/dati`                          | copia dei propri dati (diritto di accesso)                      | `200`                                                                         |
| `GET`   | `/area-cliente/cancellazione`                 | stato dell'ultima richiesta                                     | `200`                                                                         |
| `POST`  | `/area-cliente/cancellazione`                 | max 3 richieste all'ora per IP                                  | `201` richiesta registrata, `409` richiesta già in attesa                     |

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
   orari di lavoro di ciascun operatore; ferie e assenze si registrano per periodo. Una nuova
   installazione parte con apertura da martedì a sabato: **domenica e lunedì sono chiusi**
   (un giorno è chiuso quando non ha fasce), e il titolare può cambiarlo subito.
7. **Chiusure del salone**: per festività e chiusure dell'intera attività un unico flusso
   rende occupati tutti gli operatori nel periodo indicato. Chi viene assunto dopo eredita le
   chiusure future.
8. **Scheda cliente dal personale**: bastano nome, cognome e numero WhatsApp. Il sistema
   genera un link di attivazione: è il cliente a scegliere la propria password, che il personale
   non conosce mai. Un numero già presente non crea un duplicato: la scheda esistente viene
   segnalata.
9. **Prenotazione dal personale**: si scelgono cliente, operatore e servizi; il sistema
   propone solo gli orari realmente liberi, calcolati su orari di lavoro, assenze e
   appuntamenti esistenti. Nessun preavviso minimo, flag "senza caparra" disponibile solo al
   personale, registrazione possibile fino a 7 giorni nel passato e 60 giorni in avanti.
10. **Agenda**: viste giornaliera (una colonna per operatore) e settimanale; il giorno
    mostrato è nell'indirizzo, quindi l'agenda di una data è condivisibile.
11. **Chiusura dell'appuntamento**: il personale lo sposta, lo annulla indicando se l'avviso
    del cliente è stato tempestivo o tardivo, segna la mancata presentazione oppure lo
    completa a mano. Ogni passaggio è tracciato con autore e momento.

12. **Registrazione del cliente**: il cliente crea l'account indicando nome, cognome,
    e-mail, numero WhatsApp e i consensi (trattamento obbligatorio, WhatsApp facoltativo).
    Riceve un'e-mail di verifica e può accedere solo dopo la conferma. Se il numero è già in
    una scheda creata dal personale, la registrazione riprende quella scheda con il suo
    storico, senza creare duplicati.
13. **Prenotazione online**: almeno due ore di preavviso, non oltre 60 giorni, operatore
    sempre esplicito e nessuna opzione "senza caparra".
14. **Spostamento e annullamento dall'app**: possibili solo entro il limite di preavviso
    (24 ore come valore iniziale, modificabile dal titolare). Dopo il limite i pulsanti
    scompaiono e il cliente contatta il salone.
15. **Diritti sui dati**: il cliente scarica una copia dei propri dati e può chiederne la
    cancellazione. La richiesta la evade il titolare: i dati personali vengono rimossi,
    l'account disattivato e lo storico resta in forma anonima.
16. **Caparra**: se il titolare l'attiva, chi prenota online paga una percentuale del prezzo
    al momento della prenotazione. Lo slot resta bloccato per i minuti scelti in
    installazione; scaduti, torna libero. La caparra viene scalata dal totale a servizio
    concluso, restituita (rimborso o credito) per un annullamento tempestivo, trattenuta per
    un annullamento tardivo o una mancata presentazione, e sempre rimborsata se annulla il
    salone. Solo il titolare può restituire una caparra trattenuta, con motivazione
    obbligatoria. Gli appuntamenti inseriti dal personale non prevedono caparra.
17. **Messaggi WhatsApp**: conferme, promemoria (con l'anticipo scelto dal titolare) e inviti
    ad attivare l'account vanno su WhatsApp ai clienti che hanno dato il consenso, con modelli
    approvati da Meta. Senza consenso, senza numero o se l'invio non riesce, il messaggio
    parte via e-mail. Il cliente può verificare il proprio numero con un codice di sei cifre.
    Il token di Meta sta nell'ambiente; il resto si imposta in configurazione.
18. **Vendita di prodotti in negozio**: il personale registra la vendita dalla pagina
    _Vendite_, scegliendo i prodotti e, se vuole, il cliente. Il magazzino si scarica da sé e
    la giacenza non può andare sotto zero. Una vendita sbagliata si annulla con un motivo e i
    pezzi tornano in magazzino. Catalogo e correzioni delle giacenze sono del titolare, e la
    vendita non produce alcun documento per il cliente.
19. **E-mail di servizio**: verifica dell'indirizzo, reimpostazione della password, inviti
    ad attivare l'account e conferme di prenotazione, inviate via SMTP attraverso la coda
    pg-boss, così un invio fallito viene ritentato.

### Pagamenti della caparra (fase 6)

| Metodo | Percorso                                   | Autenticazione                            | Risposte                                                                      |
| ------ | ------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `GET`  | `/pagamenti/configurazione`                | pubblica                                  | `200` dichiara se i pagamenti sono finti                                      |
| `POST` | `/pagamenti/webhook`                       | firma del fornitore, nessuna sessione     | `204` evento accettato, `400` firma non verificabile                          |
| `POST` | `/pagamenti/appuntamenti/:id`              | solo cliente, max 10 ogni 5 minuti per IP | `201` indirizzo di pagamento e scadenza, `400` non in attesa o blocco scaduto |
| `POST` | `/pagamenti/appuntamenti/:id/restituzione` | solo titolare                             | `204` caparra restituita, `400` nulla di trattenuto o motivo mancante         |
| `GET`  | `/pagamenti/clienti/:id/situazione`        | solo titolare                             | `200` credito e movimenti della caparra                                       |
| `POST` | `/pagamenti/finto/esito`                   | pubblica, solo senza chiavi Stripe        | `204` esito registrato, `404` con Stripe configurato                          |

Lo stato di un pagamento si considera definitivo **solo** dopo l'evento del webhook: il
ritorno del browser non conferma nulla. Gli eventi sono verificati per firma e registrati per
identificativo, quindi un reinvio non produce doppi movimenti.

Il manuale d'uso completo, pensato per il titolare, per i dipendenti e per i clienti, è in
`MANUALE-DUSO.md`. I flussi di prodotti, magazzino e vendita online arrivano nelle fasi
successive.

## Design system

Token, componenti di base e regole di accessibilità sono documentati in
`docs/design-system.md`. L'accento cambia con il profilo dell'installazione:
rosso "lama" per il barbiere, lavanda per il parrucchiere.

## Decisioni architetturali

Sono documentate in `docs/adr/`.
