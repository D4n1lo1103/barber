# TODO

Stato dello sviluppo per fasi (vedi la roadmap in `CLAUDE.md`).

## In corso

Nessuna attività in corso: le fasi da 0 a 5 sono completate. Prossima: fase 6 — caparra e
pagamenti Stripe.

## Da fare — Fase 6: Caparra e pagamenti Stripe

- [ ] `TODO` Analisi: movimenti della caparra (pagata, rimborsata, convertita in credito,
      trattenuta, scalata dal saldo, restituita in via discrezionale) e registro di audit.
- [x] `COMPLETATO` Decisione del titolare (18/10/2026): **la caparra si governa dalle
      impostazioni dell'applicativo**, non dalla procedura guidata. Il singolo salone
      stabilisce sia **se applicarla** (attiva/disattiva) sia la **percentuale**, nella
      scheda _Regole_ accanto al limite di preavviso e alla regola di spostamento.
      Nessun valore cablato nel codice: solo un valore iniziale nel database.
- [ ] `TODO` Attivazione e percentuale della caparra nella scheda _Regole_, con il rifiuto
      delle prenotazioni online senza pagamento quando la caparra è attiva.
- [ ] `TODO` Decisione ancora aperta: **forma di restituzione predefinita** per un
      annullamento tempestivo (rimborso sul metodo di pagamento oppure credito). È
      un'impostazione del titolare: serve solo il valore con cui parte un'installazione
      nuova.

## Da fare — attività trasversali già individuate

- [ ] `TODO` Collegare `SessioniServizio.rimuoviScadute()` e la scadenza dei token a
      un'attività periodica pg-boss: la coda ora esiste, manca la pianificazione ricorrente.
- [ ] `TODO` Integrare Sentry su frontend e backend con `IDENTIFICATIVO_INSTALLAZIONE`
      su ogni evento e senza dati personali dei clienti.
- [ ] `TODO` Registro di audit per le operazioni sensibili (movimenti della caparra,
      restituzioni discrezionali, cancellazione dei dati di un cliente, disattivazione di
      account): da progettare nella fase 6.
- [ ] `TODO` Il pacchetto JavaScript del frontend supera i 500 kB: valutare un ulteriore
      taglio in parti ora che l'area cliente è cresciuta.

## Bloccato

- [ ] `BLOCCATO` Aggiornamento automatico dell'installazione di staging al merge su `main`
      e delle installazioni dei saloni alla creazione di un tag `vX.Y.Z`.
  - Blocco: servono il VPS di staging, il dominio e i segreti di deploy
    (host, utente, chiave SSH) da configurare come segreti del repository GitHub.
  - Nel frattempo la pubblicazione delle immagini su GitHub Container Registry è attiva e
    l'aggiornamento si esegue a mano con `infra/aggiorna.sh`.
- [ ] `BLOCCATO` Prova reale della procedura di ripristino dei backup.
  - Blocco: richiede un server di prova con un'installazione attiva. Gli script sono
    pronti e documentati; manca la verifica end-to-end su dati reali.

## Completato — Fasi 4 e 5: Area cliente ed e-mail (18/10/2026)

Le due fasi sono state sviluppate in un unico passaggio: nessun flusso dell'area cliente è
verificabile senza le e-mail di verifica, invito e reimpostazione della password (ADR 0007).

- [x] `COMPLETATO` Invio e-mail dietro l'interfaccia `MittenteEmail`: SMTP in produzione,
      registro nei log senza `SMTP_HOST`. Nuove variabili d'ambiente documentate.
- [x] `COMPLETATO` Coda pg-boss (`invio-email`) nello stesso PostgreSQL, con esecuzione in
      linea quando `CODA_ATTIVA=false` per rendere deterministici i test.
- [x] `COMPLETATO` Token a uso singolo con solo l'hash nel database, validità per tipo e
      sostituzione del token precedente: attivazione, verifica e-mail, reset password.
- [x] `COMPLETATO` Registrazione autonoma del cliente con consensi GDPR separati, verifica
      dell'indirizzo e rinvio del messaggio di verifica.
- [x] `COMPLETATO` Collegamento alla scheda esistente sul numero WhatsApp, senza duplicati;
      conflitto esplicito se numero o e-mail hanno già un account attivo.
- [x] `COMPLETATO` Attivazione delle schede create dal personale: se la scheda non ha
      e-mail, il cliente la indica in fase di attivazione.
- [x] `COMPLETATO` Reimpostazione della password con risposta uniforme su indirizzi
      inesistenti e revoca di tutte le sessioni.
- [x] `COMPLETATO` Prenotazione online: almeno 2 ore di preavviso, non oltre 60 giorni,
      operatore sempre esplicito, nessuna opzione "senza caparra".
- [x] `COMPLETATO` Spostamento e annullamento dall'app secondo la regola del titolare, con
      `puoSpostare`/`puoAnnullare` calcolati dal backend (`azioniDelCliente`): oltre il
      limite i pulsanti scompaiono e la richiesta viene comunque rifiutata.
- [x] `COMPLETATO` Profilo del cliente: contatti, consenso WhatsApp, copia dei propri dati.
- [x] `COMPLETATO` Richiesta di cancellazione dei dati e evasione da parte del titolare per
      anonimizzazione, con rifiuto se restano appuntamenti in agenda.
- [x] `COMPLETATO` Impostazioni esposte nell'interfaccia (scheda _Regole_): limite di
      preavviso, regola di spostamento, anticipo del promemoria.
- [x] `COMPLETATO` Limiti di frequenza su registrazione, verifica, reset, attivazione,
      prenotazione online e richiesta di cancellazione.
- [x] `COMPLETATO` Test: unitari su `azioniDelCliente`, 32 test di integrazione su area
      cliente e registrazione, test end-to-end dei tre flussi del cliente.
- [x] `COMPLETATO` ADR 0007, README, `.env.example` e `MANUALE-DUSO.md` aggiornati.

### Controlli eseguiti al termine delle fasi 4 e 5

| Controllo            | Comando                                       | Esito                                 |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                           | superato                              |
| Lint                 | `pnpm lint`                                   | superato                              |
| Tipi                 | `pnpm type-check`                             | superato                              |
| Test unitari         | `pnpm test`                                   | 57 condivisi, 30 backend, 38 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione` | 146 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`          | 34 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                  | superato                              |

### Rinviato con motivazione

- **Verifica del numero di telefono**: richiede un canale di invio, che lo stack prevede solo
  con WhatsApp Cloud API (fase 7). Fino ad allora `numeroVerificato` resta falso e l'account
  si conferma con la sola e-mail. Il collegamento alla scheda esistente avviene sul numero
  indicato in registrazione, confermato dalla verifica della casella (ADR 0007).
- **Conferme di prenotazione via WhatsApp e promemoria**: fase 7. L'anticipo del promemoria è
  già configurabile e la conferma di prenotazione parte già via e-mail.

## Completato — Chiusure del salone (18/10/2026)

Decisione del titolare: le chiusure abituali sono **domenica e lunedì**; per le festività si
registra un periodo che rende occupati tutti gli operatori, con **un unico flusso**.

- [x] `COMPLETATO` Apertura predefinita nella configurazione del profilo (da martedì a
      sabato) applicata dalla procedura guidata, con gli orari di lavoro del titolare.
- [x] `COMPLETATO` Nuovo tipo di assenza `chiusura` (migrazione dell'enum) e flusso unico
      `GET`/`POST`/`DELETE /orari/chiusure`, riservato al titolare per le modifiche.
- [x] `COMPLETATO` Rifiuto delle chiusure sopra appuntamenti o assenze, e delle rimozioni
      della singola assenza che compone una chiusura.
- [x] `COMPLETATO` Gli operatori aggiunti dopo ereditano le chiusure future.
- [x] `COMPLETATO` Interfaccia: riquadro «Chiusure del salone» nella scheda Orari.
- [x] `COMPLETATO` Test di integrazione (chiusure, permessi, conflitti, eredità) e test
      end-to-end della registrazione e rimozione; `azzera` ripulisce anche orari e assenze.
- [x] `COMPLETATO` ADR 0006, README e `MANUALE-DUSO.md` aggiornati.

## Completato — Fase 3: Agenda lato personale

### Decisioni prese con il titolare (18/10/2026)

1. **Fuori orario**: il personale **non** può inserire appuntamenti fuori dagli orari di
   lavoro dell'operatore, a salone chiuso o durante un'assenza.
2. **Agende dei colleghi**: ogni membro del personale gestisce tutte le agende.
3. **Nel passato**: inserimento consentito fino a 7 giorni indietro, 60 giorni in avanti.
4. **Completamento**: sempre manuale, nessun automatismo.
5. **Scheda cliente dal personale**: bastano nome, cognome e numero WhatsApp; l'e-mail
   dell'utente è diventata facoltativa (unica quando presente).
6. **Agenda**: `react-big-calendar` con localizzatore `date-fns` (dipendenza approvata).

### Attività

- [x] `COMPLETATO` Dominio condiviso: conversioni fra UTC e ora locale del salone
      (`dominio/fuso.ts`) e calcolo della disponibilità (`dominio/disponibilita.ts`),
      con test sui giorni di cambio dell'ora legale.
- [x] `COMPLETATO` Schemi Zod condivisi per appuntamenti e schede clienti.
- [x] `COMPLETATO` Modello dati `appuntamenti` e `appuntamenti_servizi`, con copia di nome,
      prezzo e durata dei servizi al momento della prenotazione.
- [x] `COMPLETATO` Migrazione SQL manuale con vincolo di esclusione contro le doppie
      prenotazioni, `CHECK` di coerenza fra stato e motivo dell'annullamento, indici.
- [x] `COMPLETATO` Backend disponibilità: slot liberi per operatore, giorno e servizi.
- [x] `COMPLETATO` Backend appuntamenti: creazione dal personale con flag "senza caparra",
      spostamento, annullamento con motivo, mancata presentazione, completamento manuale.
- [x] `COMPLETATO` Backend clienti: creazione della scheda senza password, invito di
      attivazione, nessun duplicato sul numero, ricerca paginata, note interne, storico.
- [x] `COMPLETATO` Orari e assenze: rifiuto delle modifiche che lascerebbero fuori orario
      appuntamenti ancora in agenda.
- [x] `COMPLETATO` Frontend: agenda (giorno con una colonna per operatore e settimana),
      pannello nuovo appuntamento, azioni di stato, pagine clienti e scheda cliente.
      Il giorno mostrato è nell'indirizzo, quindi condivisibile.
- [x] `COMPLETATO` Granularità degli slot esposta nello stato pubblico dell'installazione:
      serve alla griglia dell'agenda.
- [x] `COMPLETATO` Agenda caricata a richiesta (`lazy`): il calendario e `date-fns` non
      appesantiscono l'accesso e la procedura guidata.
- [x] `COMPLETATO` Seed esteso con appuntamenti demo in stati diversi; `azzera` aggiornato.
- [x] `COMPLETATO` Test di integrazione su permessi, orari, stati, limiti di data e
      concorrenza (due prenotazioni simultanee sullo stesso slot).
- [x] `COMPLETATO` Test end-to-end del flusso critico: scheda cliente, prenotazione,
      completamento, storico.
- [x] `COMPLETATO` ADR 0005 sul modello degli appuntamenti e sul vincolo di esclusione.
- [x] `COMPLETATO` `MANUALE-DUSO.md` (nuovo) e aggiornamento del `README.md`.

### Controlli eseguiti al termine della fase 3

| Controllo            | Comando                                       | Esito                                 |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                           | superato                              |
| Lint                 | `pnpm lint`                                   | superato                              |
| Tipi                 | `pnpm type-check`                             | superato                              |
| Test unitari         | `pnpm test`                                   | 50 condivisi, 21 backend, 35 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione` | 104 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`          | 27 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                  | superato                              |
| Verifica manuale     | flusso completo coperto dai test end-to-end   | superata                              |

## Completato — Fase 2: Personale, servizi e orari

- [x] `COMPLETATO` Modello dati: abilitazioni servizio-operatore, orari di apertura,
      orari di lavoro per operatore, assenze, inviti di attivazione.
- [x] `COMPLETATO` Vincoli SQL: giorni e fasce valide, nessuna sovrapposizione fra fasce
      dello stesso giorno né fra assenze dello stesso operatore (ADR 0004).
- [x] `COMPLETATO` Catalogo servizi: creazione, modifica, disattivazione e riordino dal
      titolare; consultazione per tutto il personale; durata vincolata alla granularità.
- [x] `COMPLETATO` Personale: creazione dei dipendenti senza che il titolare conosca la
      password, link di attivazione a scadenza, rigenerazione dell'invito, disattivazione
      con revoca immediata delle sessioni, riattivazione.
- [x] `COMPLETATO` Orari: apertura del salone e orari di lavoro, con il vincolo che
      l'operatore lavori solo quando il salone è aperto; assenze per ferie, riposo e altro.
- [x] `COMPLETATO` Frontend: area impostazioni del titolare con schede Servizi, Personale
      e Orari; pagina pubblica di attivazione dell'account.
- [x] `COMPLETATO` Seed esteso con orari di apertura, orari di lavoro e abilitazioni.
- [x] `COMPLETATO` ADR 0004 sulla rappresentazione di orari e assenze.
- [x] `COMPLETATO` Frontend spostato sulla porta 5180: la 5173 è occupata da un altro
      progetto sulla macchina di sviluppo.

### Controlli eseguiti al termine della fase 2

| Controllo            | Comando                                                       | Esito                                 |
| -------------------- | ------------------------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                                           | superato                              |
| Lint                 | `pnpm lint`                                                   | superato                              |
| Tipi                 | `pnpm type-check`                                             | superato                              |
| Test unitari         | `pnpm test`                                                   | 28 condivisi, 21 backend, 30 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione`                 | 60 test superati                      |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`                          | 21 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                                  | superato                              |
| Verifica manuale     | catalogo, creazione dipendente con link di attivazione, orari | superata                              |

## Completato — Fase 1: Configurazione salone

- [x] `COMPLETATO` Palette di accento confermate dal titolare: barbiere "Rosso lama"
      (`oklch(0.64 0.2 25)`), parrucchiere "Lavanda" (`oklch(0.74 0.13 310)`).
- [x] `COMPLETATO` Design system documentato in `docs/design-system.md`: token di colore
      per profilo e per tema, raggi, ombre, durate; componenti `Superficie`, `Pulsante`,
      `Campo`, `Avviso`, `Caricamento`.
- [x] `COMPLETATO` Tema chiaro disponibile oltre a quello scuro, ricordato sul dispositivo.
- [x] `COMPLETATO` Configurazione dei profili in `packages/shared`: cataloghi iniziali,
      granularità, blocco slot, etichette e accenti (ADR 0003).
- [x] `COMPLETATO` Modello dati: estensione di `installazione`, modello `servizi`,
      vincolo SQL `CHECK (riga = 1)` che impedisce più di un'installazione.
- [x] `COMPLETATO` Backend della procedura guidata: stato pubblico, catalogo proposto per
      profilo, completamento transazionale protetto da `CHIAVE_INSTALLAZIONE`,
      ripetibile una sola volta.
- [x] `COMPLETATO` Frontend della procedura guidata in cinque passi, con validazione per
      passo e accento che segue il profilo scelto.
- [x] `COMPLETATO` Instradamento: finché l'installazione non è configurata l'unica pagina
      raggiungibile è la procedura guidata.
- [x] `COMPLETATO` Seed parametrizzato per profilo con titolare, due dipendenti, clienti,
      servizi e dati del salone; script `azzera` per ripartire dal primo avvio.
- [x] `COMPLETATO` ADR 0003 (profili e procedura guidata) e aggiornamento del README.
- [x] `COMPLETATO` Test end-to-end aggiunti alla pipeline di verifica in CI.
- [x] `COMPLETATO` Limiti di frequenza disattivabili solo fuori dalla produzione, per
      rendere ripetibili i test end-to-end (verificato da un test dedicato).

### Controlli eseguiti al termine della fase 1

| Controllo            | Comando                                                                 | Esito                                |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| Formattazione        | `pnpm format:check`                                                     | superato                             |
| Lint                 | `pnpm lint`                                                             | superato                             |
| Tipi                 | `pnpm type-check`                                                       | superato                             |
| Test unitari         | `pnpm test`                                                             | 6 condivisi, 18 backend, 16 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione`                           | 21 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`                                    | 14 superati, 1 saltato per scelta    |
| Build                | `pnpm build`                                                            | superato                             |
| Verifica manuale     | procedura guidata completata nel browser, accento del profilo applicato | superata                             |

## Completato — Fase 0: Fondamenta

- [x] `COMPLETATO` Monorepo pnpm: `apps/web`, `apps/api`, `packages/shared`, `docs/`, `infra/`.
- [x] `COMPLETATO` TypeScript condiviso, ESLint, Prettier e comando `pnpm verifica`.
- [x] `COMPLETATO` PostgreSQL 18 in Docker Compose per lo sviluppo.
- [x] `COMPLETATO` Prisma 7 con `prisma.config.ts` e adattatore PostgreSQL;
      schema iniziale (`utenti`, `sessioni`, `installazione`) e prima migrazione.
- [x] `COMPLETATO` Validazione delle variabili d'ambiente con Zod all'avvio dell'API.
- [x] `COMPLETATO` Autenticazione: hashing Argon2id, accesso, uscita, utente corrente,
      cambio password con revoca di tutte le sessioni.
- [x] `COMPLETATO` Sessioni opache con hash nel database, scadenza e revoca (ADR 0001).
- [x] `COMPLETATO` Protezione CSRF a doppio invio legata alla sessione, con controllo
      dell'intestazione `Origin` (ADR 0001).
- [x] `COMPLETATO` Ruoli e permessi: guardia globale di sessione, guardia dei ruoli,
      decoratori `@Pubblico`, `@Ruoli`, `@UtenteCorrente`.
- [x] `COMPLETATO` Limite di frequenza proprio su accesso e cambio password (ADR 0002).
- [x] `COMPLETATO` Validazione delle richieste con schemi Zod condivisi e messaggi per campo.
- [x] `COMPLETATO` Frontend: contesto di sessione, client API con token CSRF, pagina di
      accesso accessibile, rotte protette per ruolo, tema scuro provvisorio con token.
- [x] `COMPLETATO` Dati demo di sviluppo (titolare e dipendente), bloccati in produzione.
- [x] `COMPLETATO` Immagini Docker di produzione per API e frontend, Caddy con HTTPS
      automatico, compose di produzione.
- [x] `COMPLETATO` Script operativi: backup cifrato, scaricamento dei backup,
      ripristino, aggiornamento con rollback documentato.
- [x] `COMPLETATO` CI GitHub Actions: verifica sui feature branch, pubblicazione delle
      immagini su GitHub Container Registry su `main` e sui tag.
- [x] `COMPLETATO` README con prerequisiti, variabili d'ambiente, comandi, API, installazione,
      deploy, rollback, backup e flussi principali.
- [x] `COMPLETATO` ADR 0001 (sessioni e CSRF) e ADR 0002 (backend ESM e limite di frequenza).

### Controlli eseguiti al termine della fase 0

| Controllo             | Comando                                       | Esito            |
| --------------------- | --------------------------------------------- | ---------------- |
| Formattazione         | `pnpm format:check`                           | superato         |
| Lint                  | `pnpm lint`                                   | superato         |
| Tipi                  | `pnpm type-check`                             | superato         |
| Test unitari backend  | `pnpm --filter @barber/api test`              | 18 test superati |
| Test unitari frontend | `pnpm --filter @barber/web test`              | 9 test superati  |
| Test di integrazione  | `pnpm --filter @barber/api test:integrazione` | 11 test superati |
| Build                 | `pnpm build`                                  | superato         |
| Verifica manuale      | accesso, uscita, CSRF, permessi via HTTP      | superata         |

Test end-to-end: non ancora presenti, vedi "attività trasversali".
