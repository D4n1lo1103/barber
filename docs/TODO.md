# TODO

Stato dello sviluppo per fasi (vedi la roadmap in `CLAUDE.md`).

## In corso

Nessuna attività in corso: la fase 0 è completata, la fase 1 non è ancora iniziata.

## Da fare — Fase 1: Configurazione salone

- [ ] `TODO` Proporre al titolare le due palette di accento (barbiere e parrucchiere) e
      **chiedere conferma dei valori** prima di fissarli come token di tema.
- [ ] `TODO` Design system documentato: token di colore, spaziature, raggi, ombre, animazioni.
- [ ] `TODO` Procedura guidata al primo avvio: profilo, catalogo servizi iniziale,
      granularità degli slot, tempo di blocco dello slot, vendita online, dati del salone,
      account del titolare.
- [ ] `TODO` Vincolo di riga unica sulla tabella `installazione` (migrazione SQL manuale):
      l'installazione serve un solo salone.
- [ ] `TODO` Seed parametrizzato per profilo (`barbiere` / `parrucchiere`) con titolare,
      dipendenti, servizi, orari, clienti, appuntamenti e prodotti finti.
- [ ] `TODO` Test: procedura guidata completata una sola volta, permessi della procedura,
      valori predefiniti per profilo.

## Da fare — attività trasversali già individuate

- [ ] `TODO` Test end-to-end Playwright del flusso di accesso e dell'uscita
      (configurazione presente, suite da scrivere con la prima interfaccia di fase 1).
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
