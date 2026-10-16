# ADR 0001 — Sessioni con cookie opachi e protezione CSRF

- **Stato**: accettata
- **Data**: 2026-10-16
- **Fase**: 0 — Fondamenta

## Contesto

Il gestionale è usato ogni giorno in negozio da titolare e dipendenti e, dall'esterno, dai
clienti. Lo stack prevede autenticazione "a sessione con cookie `httpOnly`, `Secure`,
`SameSite`, con protezione CSRF". Serve decidere come rappresentare la sessione e come
realizzare concretamente la protezione CSRF.

## Decisione

1. **Token di sessione opaco in un cookie `httpOnly`.** Il token è generato con 32 byte
   casuali; nel database viene salvato solo il suo hash SHA-256 (tabella `sessioni`).
   Il cookie è `httpOnly`, `SameSite=Strict`, `Secure` in produzione, con scadenza
   allineata a quella della sessione.
2. **Sessioni revocabili.** Ogni sessione ha scadenza e campo `revocataIl`. L'uscita revoca
   la sessione corrente; il cambio password revoca tutte le sessioni dell'utente.
3. **Protezione CSRF a doppio invio, legata alla sessione.** Alla creazione della sessione
   viene emesso un secondo token in un cookie leggibile (`csrf`); il frontend lo rispedisce
   nell'intestazione `x-csrf-token`. Il backend verifica che cookie e intestazione
   coincidano **e** che corrispondano all'hash memorizzato nella sessione, così che un
   cookie iniettato da un sottodominio non sia sufficiente. Il controllo si applica ai soli
   metodi che modificano dati e include la verifica dell'intestazione `Origin`.

## Alternative valutate

- **JWT senza stato**: scartato. La revoca immediata (dipendente disattivato, cambio
  password, dispositivo smarrito) richiederebbe comunque una lista di revoca lato server.
- **`express-session` con store PostgreSQL**: funzionalmente equivalente, aggiunge due
  dipendenze e nasconde la gestione della revoca. La tabella propria serve anche all'audit.
- **Libreria `csrf-csrf`**: valutata, non adottata. Il doppio invio legato alla sessione è
  poche righe di codice, verificabile con test espliciti, senza dipendenze aggiuntive.

## Conseguenze

- Ogni richiesta autenticata esegue una lettura indicizzata della tabella `sessioni`.
- Le sessioni scadute vanno ripulite periodicamente: `SessioniServizio.rimuoviScadute()`
  verrà collegato a un'attività pianificata pg-boss nella fase delle attività in background.
- Il frontend deve inviare `credentials: 'include'` e l'intestazione CSRF: è incapsulato
  nel client API condiviso.
