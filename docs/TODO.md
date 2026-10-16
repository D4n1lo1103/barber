# TODO

Stato dello sviluppo per fasi (vedi la roadmap in `CLAUDE.md`).

## In corso

Nessuna attività in corso: le fasi 0 e 1 sono completate, la fase 2 non è ancora iniziata.

## Da fare — Fase 2: Personale, servizi e orari

- [ ] `TODO` Gestione del personale dal titolare: creazione e disattivazione degli account
      dei dipendenti, invito ad attivare l'account (l'invio e-mail arriva nella fase 5).
- [ ] `TODO` Gestione del catalogo servizi dall'interfaccia: nome, descrizione, prezzo,
      durata, operatori abilitati.
- [ ] `TODO` Orari di apertura del salone, orari di lavoro per operatore, giorni di riposo,
      ferie e assenze.
- [ ] `TODO` Test: permessi (solo il titolare modifica servizi e personale), validazione
      delle durate rispetto alla granularità, sovrapposizione di ferie e orari.

## Da fare — attività trasversali già individuate

- [ ] `TODO` Collegare `SessioniServizio.rimuoviScadute()` a un'attività periodica pg-boss
      quando verranno introdotte le attività in background (fase 5).
- [ ] `TODO` Integrare Sentry su frontend e backend con `IDENTIFICATIVO_INSTALLAZIONE`
      su ogni evento e senza dati personali dei clienti.
- [ ] `TODO` Registro di audit per le operazioni sensibili (movimenti della caparra,
      restituzioni discrezionali, disattivazione di account): da progettare nella fase 6.

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
