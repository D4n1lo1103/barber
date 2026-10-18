# ADR 0007 — Area cliente, e-mail di servizio e cancellazione dei dati

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fasi**: 4 — Area cliente e 5 — E-mail, sviluppate in un unico passaggio

## Contesto

La fase 4 apre il software ai clienti: registrazione autonoma, prenotazione online,
spostamento, annullamento e diritti sui dati. Nessuno di questi flussi è utilizzabile senza
e-mail: la verifica dell'indirizzo, la reimpostazione della password e l'invito ad attivare
l'account sono messaggi, non pagine. Separare le due fasi avrebbe prodotto una fase 4
verificabile solo a mano, con i link stampati nei log. Le due fasi sono quindi state unite.

Restavano aperte quattro decisioni: come consegnare le e-mail, cosa significa «verifica del
numero di telefono» senza WhatsApp, chi decide le regole di annullamento e spostamento, e
come si cancella un cliente che ha uno storico contabile.

## Decisione

1. **E-mail dietro un'interfaccia, sulla coda.** `MittenteEmail` (`MITTENTE_EMAIL` come token
   di iniezione) ha due realizzazioni: SMTP per la produzione e registro nei log quando
   `SMTP_HOST` non è configurato, così lo sviluppo e i test non inviano nulla. L'invio passa
   sempre dalla coda pg-boss (`invio-email`) nello stesso PostgreSQL: un messaggio che non
   parte viene ritentato e non fa fallire l'operazione che l'ha generato. Con
   `CODA_ATTIVA=false` le attività vengono eseguite in linea, perché i test automatici
   restino deterministici. Nessun Redis, come da stack.
2. **Token a uso singolo, in chiaro solo nel link.** Una sola tabella `token_utente` per i
   tre scopi (`attivazione`, `verifica_email`, `reset_password`), con il solo hash SHA-256 nel
   database e validità per tipo: 7 giorni per l'attivazione, 48 ore per la verifica
   dell'indirizzo, 2 ore per la reimpostazione della password. Un nuovo token dello stesso
   tipo invalida il precedente. Le rotte pubbliche di token hanno un limite di frequenza
   proprio e rispondono `204` anche per un indirizzo inesistente: non confermano mai se un
   account esiste.
3. **Verifica del numero rinviata alla fase 7.** Il requisito chiede di verificare e-mail e
   numero di telefono. Verificare il numero richiede un canale: l'unico previsto dallo stack
   è WhatsApp Cloud API, che arriva nella fase 7. Fino ad allora `numeroVerificato` resta
   falso e l'account è utilizzabile dopo la sola verifica dell'indirizzo e-mail. Il
   collegamento alla scheda esistente avviene quindi **sul numero indicato in registrazione,
   confermato dalla verifica della casella**: la registrazione prende la scheda creata dal
   personale solo se non ha ancora un account attivo, altrimenti chiede di accedere o di
   reimpostare la password. Un'e-mail già usata è sempre un conflitto.
4. **Le regole del salone sono impostazioni, non costanti.** Limite di preavviso, regola di
   spostamento (libero entro il limite, oppure trattato come un annullamento) e anticipo del
   promemoria vivono sulla riga `installazione` e si modificano dalla scheda _Regole_ delle
   impostazioni, riservata al titolare. Restano invece costanti condivise i due limiti che il
   requisito fissa per la prenotazione online del cliente: almeno 2 ore di preavviso e non
   oltre 60 giorni.
5. **Le azioni consentite le calcola il backend.** `azioniDelCliente` (in `packages/shared`)
   decide da stato, inizio, limite di preavviso e regola di spostamento se l'appuntamento è
   ancora spostabile o annullabile; la risposta dell'API porta `puoSpostare` e `puoAnnullare`
   e l'interfaccia si limita a mostrare o nascondere i pulsanti. Oltre il limite il tentativo
   viene rifiutato anche se la richiesta arriva fuori dall'interfaccia. L'annullamento dal
   cliente è possibile solo entro il limite, quindi è **sempre tempestivo**: il motivo
   `tardivo` lo registra solo il personale.
6. **Cancellazione per anonimizzazione, evasa dal titolare.** Il cliente invia la richiesta
   dalla propria area; il titolare la vede nelle impostazioni e sceglie fra «Cancella i dati» e
   «Rifiuta». La cancellazione rimuove i riferimenti personali dalla scheda (nome, cognome,
   contatti, note), disattiva l'account, revoca le sessioni e segna `anonimizzataIl`, mentre
   gli appuntamenti già svolti restano, privi di riferimenti personali, per gli obblighi
   contabili. La richiesta viene rifiutata se il cliente ha appuntamenti ancora in agenda: va
   prima liberata l'agenda. L'operazione non è reversibile.

## Conseguenze

- Il cliente può usare il software senza che il salone conosca la sua password: il personale
  crea la scheda, il sistema invia l'invito, il cliente sceglie la password.
- Finché non arriva la fase 7 l'invito e la conferma di prenotazione viaggiano solo via
  e-mail. Una scheda creata dal personale senza indirizzo riceve l'invito solo quando il
  cliente indica la propria e-mail in fase di attivazione, che la rotta di attivazione ora
  accetta.
- La cancellazione dei dati non è automatica: è un'operazione del titolare. È una scelta
  consapevole, perché va verificato che non restino appuntamenti aperti e perché l'operazione
  non si può annullare. Quando arriverà il registro di audit della fase 6, questa operazione
  sarà fra le prime da registrare.
- L'anonimizzazione svuota i campi personali ma non cancella la riga: i futuri KPI continuano
  a contare quegli appuntamenti senza poter risalire alla persona.
