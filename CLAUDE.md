# AGENTS.md

## Scopo del progetto

Stai sviluppando un software gestionale per saloni di **barbiere e parrucchiere** con un'unica sede e almeno due dipendenti. Il software gestisce clienti, appuntamenti, personale, servizi e prodotti. I clienti possono prenotare in autonomia e, se il salone lo attiva, acquistare prodotti online.

Il software viene distribuito con **un'installazione separata per ogni salone**: ogni salone ha il proprio server, il proprio database e le proprie credenziali per i servizi esterni. Non è una piattaforma multi-tenant.

### Glossario

Usa sempre questi termini, in modo coerente, nel codice, nel database, nell'interfaccia e nella documentazione.

- **Installazione**: un'istanza del software dedicata a un singolo salone.
- **Profilo**: tipologia dell'attività, `barbiere` o `parrucchiere`, scelta in fase di installazione.
- **Titolare**: amministratore del salone. È anche un operatore.
- **Dipendente**: membro del personale con accesso limitato.
- **Operatore**: chi eroga i servizi e ha un'agenda (titolare o dipendente).
- **Cliente**: persona che riceve i servizi o acquista prodotti.
- **Scheda cliente**: record del cliente nel database. Può esistere anche prima che il cliente attivi il proprio account.
- **Servizio**: prestazione erogata (es. taglio, barba, piega, colore), con prezzo e durata.
- **Appuntamento**: prenotazione di uno o più servizi con un operatore, in una data e un orario.
- **Slot**: unità minima di tempo dell'agenda.
- **Caparra**: anticipo pagato online alla prenotazione, pari a una percentuale del prezzo dei servizi.
- **Credito**: importo a favore del cliente, utilizzabile per una prenotazione futura.
- **Limite di preavviso**: numero di ore prima dell'appuntamento entro cui un annullamento è considerato tempestivo.
- **Annullamento tempestivo / tardivo**: annullamento effettuato prima / dopo il limite di preavviso.
- **Mancata presentazione**: il cliente non si presenta all'appuntamento.

### Principio architetturale: codebase universale + personalizzazioni

- Esiste **una sola codebase** valida sia per barbieri sia per parrucchieri.
- Le differenze tra i due profili (catalogo servizi predefinito, durate tipiche, granularità degli slot, terminologia, palette di accento, impostazioni di default) vanno gestite tramite **configurazione del profilo**. Non usare fork, branch separati o logica cablata nel codice (niente `if (profilo === "barbiere")` sparsi).
- Tutte le regole che questo documento definisce "configurabili" sono impostazioni salvate nel database, mai valori fissi nel codice.

### Configurazione di installazione e impostazioni

- **Procedura guidata al primo avvio** (salvata nel database). Imposta:
  - profilo (`barbiere` o `parrucchiere`) e catalogo servizi iniziale;
  - granularità degli slot dell'agenda;
  - tempo di blocco dello slot durante il pagamento della caparra;
  - attivazione o meno della vendita online dei prodotti;
  - dati del salone e account del titolare.
- **Credenziali e segreti** (Stripe, WhatsApp, email, Sentry, database): solo in variabili d'ambiente (`.env`), mai nel database o nel codice.
- **Impostazioni modificabili dal titolare dall'interfaccia**: servizi, prezzi, durate, personale, orari, caparra (attiva/disattiva e percentuale), limite di preavviso, regola di spostamento, forma di restituzione della caparra (rimborso o credito), anticipo dei promemoria, prodotti e magazzino.

### Piattaforma

- **Web app** utilizzabile da browser su computer, tablet e smartphone.
- Interfaccia responsive e pienamente utilizzabile da touch.
- Lingua dell'interfaccia: **solo italiano**.
- Valuta EUR, formati di data e numero italiani, prezzi IVA inclusa.

### Ruoli e permessi

1. **Titolare (amministratore)**: accesso completo. È anche un operatore e riceve appuntamenti. Crea e disattiva gli account dei dipendenti. Configura servizi, prezzi, personale, orari, regole di caparra, annullamento e spostamento, prodotti e magazzino. È l'unico ruolo che vede i **dati economici e i KPI complessivi** ed è l'unico che può restituire una caparra in via discrezionale.
2. **Dipendente**: gestisce gli appuntamenti, vede **la propria agenda e quella dei colleghi**, crea e consulta le schede clienti, registra annullamenti e mancate presentazioni, registra le vendite di prodotti in negozio. Non accede alle impostazioni dell'attività né ai dati economici e ai KPI.
3. **Cliente**: **deve avere un account** per prenotare e acquistare online. Può prenotare, spostare e annullare i propri appuntamenti secondo le regole del salone, pagare la caparra e acquistare prodotti.

L'autorizzazione va verificata sempre lato backend, per ogni endpoint e ogni risorsa.

### Funzionalità richieste

**Account e anagrafica clienti**

- Scheda cliente con dati di contatto (nome, cognome, numero WhatsApp, e-mail), storico appuntamenti, servizi ricevuti, acquisti, crediti e movimenti della caparra.
- **Registrazione autonoma**: il cliente crea l'account, verifica e-mail e numero di telefono e fornisce i consensi GDPR.
- **Scheda creata dal personale** (es. cliente al telefono non ancora registrato): il dipendente chiede i dati e crea la scheda. Il sistema invia automaticamente al cliente un invito (WhatsApp o e-mail) per attivare l'account e scegliere la password. Il personale non conosce né imposta mai la password del cliente.
- **Nessun duplicato**: se un cliente si registra con un numero di telefono già presente in una scheda, il sistema lo collega alla scheda esistente dopo la verifica del numero.

**Catalogo servizi**

- Servizi con nome, descrizione, prezzo, **durata fissa per servizio** e operatori abilitati a svolgerli.
- Catalogo iniziale precaricato in base al profilo, poi modificabile dal titolare.

**Personale e orari**

- Orari di apertura del salone, orari di lavoro di ciascun operatore (titolare incluso), giorni di riposo, ferie e assenze.

**Agenda**

- Agenda per operatore, con vista giornaliera e settimanale. Ogni utente del personale vede tutte le agende.
- Granularità degli slot definita in installazione.
- Nessuna pausa automatica tra un appuntamento e l'altro.
- Il sistema impedisce sovrapposizioni e calcola la disponibilità in base alla durata dei servizi, agli orari dell'operatore e agli appuntamenti esistenti.

**Stati dell'appuntamento**

- `in_attesa_pagamento`: slot bloccato in attesa del pagamento della caparra.
- `confermato`
- `completato`
- `annullato`, con motivo: tempestivo, tardivo, dal salone, pagamento non completato.
- `mancata_presentazione`

**Prenotazione**

- **Più servizi nello stesso appuntamento**, tutti con lo **stesso operatore**, uno dopo l'altro. La durata dell'appuntamento è la somma delle durate dei servizi scelti. Vengono proposti solo gli operatori abilitati a tutti i servizi selezionati.
- Il cliente sceglie servizi, **operatore specifico**, giorno e orario tra quelli realmente disponibili. Non esiste l'opzione "operatore indifferente".
- **Prenotazione online del cliente**: almeno **2 ore** prima e non oltre **60 giorni** dalla data corrente.
- **Prenotazione inserita dal personale** (telefono o in negozio): nessun anticipo minimo. Il personale può selezionare l'opzione **"senza caparra"** tramite un flag; questa opzione non è mai disponibile al cliente.

**Spostamento di un appuntamento**

- La regola è configurabile dal titolare, che sceglie tra:
  - lo spostamento è trattato come un annullamento e segue le regole della caparra;
  - lo spostamento è libero se fatto entro il limite di preavviso.
- Dopo il limite di preavviso il cliente non può spostare l'appuntamento dall'app.

**Caparra (opzionale)**

- Il titolare può attivare o disattivare la caparra e ne **definisce la percentuale** sul prezzo dei servizi (es. 50%).
- La caparra si paga **online al momento della prenotazione**. Durante il pagamento lo slot resta in stato `in_attesa_pagamento` per il tempo definito in installazione. Se il pagamento non va a buon fine entro quel tempo, l'appuntamento viene annullato e lo slot torna disponibile. L'appuntamento è confermato solo a pagamento avvenuto.
- Al termine del servizio la caparra viene **scalata dal totale**.
- Il credito non ha scadenza.
- Ogni movimento della caparra (pagata, rimborsata, convertita in credito, trattenuta, scalata dal saldo, restituita in via discrezionale) deve essere tracciato con data, importo, autore e motivo.

**Annullamenti e mancate presentazioni**

- **Limite di preavviso** configurabile dal titolare (es. 24 ore).
- **Annullamento tempestivo da parte del cliente** (entro il limite): il cliente può annullare dall'app. La caparra viene restituita nella forma scelta dal titolare nelle impostazioni: **rimborso** sul metodo di pagamento oppure **credito**.
- **Dopo il limite di preavviso**: il pulsante di annullamento **non è più disponibile** nell'app. Il cliente deve contattare il salone; il dipendente registra l'annullamento e libera lo slot. La caparra viene trattenuta.
- **Annullamento comunicato fuori dall'app** (telefono, di persona): il personale registra l'annullamento e **indica il dipendente** se l'avviso è tempestivo o tardivo. Il sistema applica di conseguenza la regola corrispondente sulla caparra.
- **Mancata presentazione**: la segna il dipendente o il titolare. La caparra viene trattenuta.
- **Annullamento da parte del salone**: la caparra viene sempre **rimborsata per intero**.
- **Restituzione discrezionale**: solo il titolare può restituire una caparra trattenuta (es. a un cliente abituale), indicando una motivazione obbligatoria. L'operazione viene tracciata.

**Messaggi WhatsApp**

- Invio automatico di:
  - conferma della prenotazione;
  - promemoria prima dell'appuntamento, con anticipo configurabile dal titolare;
  - invito ad attivare l'account per le schede create dal personale.
- I messaggi sono solo di servizio e usano modelli approvati da Meta.
- Il cliente deve dare il **consenso** a ricevere messaggi WhatsApp. Se il consenso manca o l'invio fallisce, il messaggio viene inviato **via e-mail**.

**E-mail**

- Verifica dell'account, reset della password, invito ad attivare l'account, conferme di prenotazione e di ordine.
- Fallback dei messaggi WhatsApp.

**Prodotti, vendita in negozio e magazzino**

- Catalogo prodotti con descrizione, prezzo e giacenza.
- Il personale può registrare vendite in negozio, anche associate a un cliente o a un appuntamento.
- Scarico automatico del magazzino a ogni vendita (online e in negozio) e avviso di scorta minima.

**Vendita online (opzionale, attivata in installazione)**

- I clienti possono vedere e acquistare i prodotti dalla web app, pagando online e scegliendo tra:
  - **ritiro in negozio**;
  - **spedizione a domicilio**.
- Stati dell'ordine: `in_attesa_pagamento`, `pagato`, `in_preparazione`, `pronto_per_ritiro` / `spedito`, `consegnato`, `annullato`, `rimborsato`.
- Gestione di resi e rimborsi, tenendo conto del diritto di recesso di 14 giorni per gli acquisti online dei consumatori.
- Gli obblighi fiscali per la vendita online verranno comunicati dal titolare dopo il confronto con il commercialista. Non implementare logiche fiscali non specificate.

**Statistiche e KPI** (visibili solo al titolare)

- Appuntamenti, servizi più richiesti, rendimento per operatore, vendite prodotti, incassi, caparre trattenute, annullamenti e mancate presentazioni.

**Privacy (GDPR)**

- Raccolta dei consensi in fase di registrazione: trattamento dei dati e messaggi WhatsApp, separati.
- Il cliente deve poter consultare i propri dati e richiederne la cancellazione.
- Minimizzazione dei dati: raccogli solo quelli necessari alle funzionalità descritte.

### Fuori ambito

- Recensioni.
- Programmi fedeltà, gift card, abbonamenti e pacchetti prepagati.
- Schede tecniche del cliente (formule colore, foto prima/dopo, allergie).
- Più sedi o più saloni nella stessa installazione.
- Lingue diverse dall'italiano.

### Da definire

- **Gestione cassa e pagamenti in negozio** (registratore telematico, POS, ecc.): la fattibilità verrà valutata in seguito. Non implementare nulla in merito finché non viene specificato, ma struttura il codice in modo che possa essere aggiunta senza riscritture.
- Obblighi fiscali per la vendita online.
- Costi, corriere e zone di spedizione dei prodotti acquistati online.

---

## Stack tecnologico

Lo stack è deciso. Non sostituire nessuno di questi elementi senza approvazione esplicita. Per aggiungere librerie non elencate, motiva la scelta e chiedi conferma.

- **Linguaggio**: TypeScript ovunque.
- **Frontend** (`apps/web`): React con Vite, Tailwind CSS, shadcn/ui, Motion per le animazioni, react-big-calendar per l'agenda.
- **Backend** (`apps/api`): NestJS.
- **Database**: PostgreSQL.
- **ORM**: Prisma.
- **Validazione**: schemi Zod condivisi tra frontend e backend (`packages/shared`).
- **Attività in background**: pg-boss (promemoria, scadenza del blocco slot, invio e-mail e WhatsApp, inviti). Non introdurre Redis.
- **Autenticazione**: sessione con cookie `httpOnly`, `Secure`, `SameSite`, con protezione CSRF.
- **Pagamenti**: Stripe.
- **WhatsApp**: WhatsApp Cloud API ufficiale di Meta.
- **E-mail**: invio tramite SMTP configurabile; provider consigliato di default: Brevo.
- **Monitoraggio errori**: Sentry.
- **Test**: Jest (backend), Vitest (frontend), Playwright (end-to-end).
- **Gestione pacchetti**: pnpm workspaces.

## Struttura del repository

Monorepo:

```
apps/
  web/        # frontend React
  api/        # backend NestJS
packages/
  shared/     # schemi Zod, tipi e costanti condivisi
docs/
  TODO.md
  adr/
infra/        # Docker, Caddy, script di deploy e backup
```

## Convenzioni di codice e lingua

- **Tutto in italiano**: nomi di entità, tabelle, campi, variabili, funzioni, file di dominio, commenti, messaggi di commit, documentazione e testi dell'interfaccia.
- Le parole chiave del linguaggio e le API di framework e librerie restano naturalmente in inglese.
- Usa i termini del glossario.

## Direzione visiva

L'interfaccia deve essere **innovativa e "futuristica"**, non un gestionale standard, restando veloce e leggibile nell'uso quotidiano in negozio.

- Tema **scuro di default**, con tema chiaro disponibile.
- Superfici traslucide con sfocatura dello sfondo, accenti luminosi e sfumature sui colori principali.
- Tipografia moderna e ben gerarchizzata.
- Animazioni fluide con Motion: transizioni tra le pagine, spostamento animato degli appuntamenti in agenda, conferme e feedback animati. Le animazioni devono essere brevi e non rallentare le operazioni.
- Palette di accento **diversa per profilo** (più calda per parrucchiere, più decisa per barbiere), definita come token di tema. Proponi i valori e chiedi conferma prima di fissarli.
- Tutto definito in un **design system** documentato (token di colore, spaziature, raggi, ombre, animazioni) e riutilizzato in ogni componente.
- Rispetta `prefers-reduced-motion` e mantieni contrasti conformi WCAG 2.1 AA anche sulle superfici traslucide.

## Requisiti tecnici specifici

- **Doppie prenotazioni**: impedisci le sovrapposizioni per lo stesso operatore con un **vincolo di esclusione PostgreSQL** (migrazione SQL manuale in Prisma), oltre al controllo applicativo che restituisce un messaggio chiaro all'utente. Includi test di concorrenza.
- **Pagamenti**:
  - mai gestire direttamente dati di carta, solo tramite Stripe;
  - webhook Stripe sempre verificati tramite firma e gestiti in modo **idempotente**;
  - lo stato di un pagamento si considera definitivo solo dopo la conferma via webhook.
- **Date e orari**: salva tutto in UTC e mostra in fuso `Europe/Rome`. Aggiungi test sui giorni di cambio dell'ora legale.
- **Integrazioni intercambiabili**: WhatsApp, e-mail e pagamenti vanno implementati dietro interfacce, così da poter cambiare provider senza modificare la logica di business.
- **Browser supportati**: ultime due versioni di Chrome, Safari (iOS incluso), Firefox ed Edge.
- **Accessibilità**: WCAG 2.1 livello AA.

## Installazione, deploy e operatività

- **Hosting**: un VPS europeo per ogni salone (Seeweb o Aruba), con Docker Compose.
- **HTTPS**: Caddy come reverse proxy, con certificati ottenuti e rinnovati automaticamente.
- **Registro immagini**: GitHub Container Registry. Non usare Docker Hub.
- **CI/CD con GitHub Actions**:
  - push su un **feature branch**: lint, formattazione, type-check, test e build;
  - merge su **main**: costruzione delle immagini Docker, pubblicazione su GitHub Container Registry e aggiornamento automatico dell'**installazione di staging**;
  - creazione di una **versione** (tag `vX.Y.Z`, versionamento semantico): aggiornamento delle installazioni dei saloni.
- **Aggiornamenti**: ogni aggiornamento esegue un backup del database e poi applica le migrazioni (`prisma migrate deploy`). Documenta la procedura di rollback.
- **Backup**:
  - il server crea ogni notte un dump **cifrato** del database e conserva gli ultimi 7 giorni;
  - il PC dello sviluppatore scarica automaticamente i nuovi backup quando è acceso e li conserva per 30 giorni;
  - documenta e testa la procedura di ripristino.
- **Monitoraggio**: Sentry su frontend e backend, con identificativo dell'installazione su ogni evento. Non inviare a Sentry dati personali dei clienti.
- **Dati demo**: script di seed parametrizzato per profilo (`barbiere` o `parrucchiere`) con titolare, dipendenti, servizi, orari, clienti, appuntamenti e prodotti finti, da usare in sviluppo, test e staging.

## Roadmap

Sviluppa per fasi, in quest'ordine. Non iniziare una fase prima che la precedente sia completata secondo la "Definizione di completamento".

0. **Fondamenta**: monorepo, Docker, CI, database, autenticazione, ruoli e permessi.
1. **Configurazione salone**: procedura guidata al primo avvio, profili barbiere e parrucchiere, design system, dati demo.
2. **Personale, servizi e orari.**
3. **Agenda lato personale**: prenotazioni inserite dal personale (con flag "senza caparra"), schede clienti, annullamenti, mancate presentazioni.
4. **Area cliente**: registrazione con consensi GDPR, collegamento alle schede esistenti, prenotazione online, spostamento e annullamento.
5. **E-mail**: verifica account, reset password, inviti, conferme.
6. **Caparra e pagamenti Stripe**: tutte le regole di annullamento, rimborso, credito e restituzione discrezionale.
7. **WhatsApp**: conferme, promemoria, inviti, fallback via e-mail.

Al termine della fase 7 il software è utilizzabile da un salone reale (**MVP**).

8. **Prodotti e magazzino** con vendita in negozio.
9. **Vendita online**: ordini, ritiro in negozio e spedizione.
10. **Statistiche e KPI.**

---

## Principi generali

- Lavora in modo autonomo, ordinato e iterativo: analizza, pianifica, implementa, testa, documenta e verifica il risultato.
- Prima di introdurre nuove soluzioni, esamina sempre il codice, la configurazione, la documentazione e le convenzioni già presenti nel repository.
- Privilegia sempre la soluzione più semplice, leggibile e manutenibile che soddisfi i requisiti. Evita over-engineering, astrazioni premature e dipendenze non necessarie.
- Mantieni la coerenza con lo stack, le librerie, i pattern architetturali e le convenzioni definiti in questo documento.
- Non cambiare linguaggi, framework, database, architettura, librerie principali o strumenti di build senza una motivazione concreta e senza approvazione esplicita.
- Non modificare o eliminare funzionalità esistenti senza prima verificarne impatti, dipendenze e compatibilità.
- Non dichiarare completato un lavoro finché i task pianificati e i test applicabili non risultano completati con successo.

---

## Analisi dei requisiti

- Prima di iniziare una modifica significativa, identifica lo scopo, i requisiti funzionali, i requisiti non funzionali, i vincoli tecnici e i possibili impatti sul sistema.
- Se i requisiti sono ambigui, incompleti, contraddittori o potenzialmente rischiosi, fermati e chiedi chiarimenti prima di implementare.
- Non inventare regole di business, permessi, formati dati, comportamenti utente o integrazioni esterne non specificati.
- Se individui aspetti importanti non considerati, come sicurezza, migrazioni dati, autorizzazioni, performance, compatibilità, backup, audit trail o gestione errori, segnalali chiaramente e proponi una soluzione concreta.
- Quando una decisione può avere impatto su sicurezza, dati personali, costi, architettura, compatibilità o produzione, richiedi conferma prima di procedere.

---

## Pianificazione e TODO list

- Mantieni una lista di attività persistente nel file `docs/TODO.md`.
- Se il file non esiste, crealo prima di iniziare un'attività significativa.
- Aggiorna la TODO list durante il lavoro, non solo al termine.
- Inserisci task distinti per analisi, implementazione, test, documentazione, migrazioni e verifiche manuali quando pertinenti.
- Ogni task deve avere uno stato chiaro: `TODO`, `IN CORSO`, `BLOCCATO`, `COMPLETATO`.
- Per ogni elemento bloccato, indica il motivo del blocco e quale informazione, accesso o decisione è necessaria per proseguire.
- Prima di chiudere il lavoro, verifica che non rimangano task aperti. Gli eventuali task non completati devono essere esplicitamente documentati e motivati.

Esempio di struttura per `docs/TODO.md`:

```md
# TODO

## In corso

- [ ] Analizzare il flusso di autenticazione esistente.
- [ ] Implementare la validazione lato backend.

## Da fare

- [ ] Aggiungere i test unitari.
- [ ] Eseguire lint, type-check e build.
- [ ] Aggiornare il README.

## Bloccato

- [ ] Definire la policy di conservazione dei dati.
  - Blocco: serve conferma del requisito di business.

## Completato

- [x] Analizzata la struttura del modulo utenti.
```

---

## Sicurezza

- Considera la sicurezza un requisito essenziale in ogni modifica.
- Non inserire mai password, token, chiavi API, certificati, dati personali reali o altri segreti nel codice, nei file di configurazione versionati, nei log, nei test o nella documentazione.
- Usa variabili d'ambiente per tutte le credenziali e la configurazione sensibile.
- Quando aggiungi una nuova variabile d'ambiente, aggiorna `.env.example` e documentane scopo, formato e obbligatorietà nel `README.md`.
- Valida sempre gli input ricevuti da utenti, API, file, query string, form e servizi esterni.
- Applica validazione sia lato frontend, per migliorare l'esperienza utente, sia lato backend, per garantire la sicurezza effettiva.
- Usa query parametrizzate, ORM o meccanismi equivalenti. Non concatenare mai input utente nelle query SQL.
- Verifica autorizzazione e autenticazione prima di consentire accessi a risorse, azioni o dati sensibili.
- Applica il principio del privilegio minimo: utenti, ruoli, servizi e processi devono avere solo i permessi strettamente necessari.
- Non esporre dettagli tecnici sensibili nei messaggi di errore restituiti all'utente.
- Registra nei log gli eventi utili al troubleshooting e all'audit, evitando di memorizzare password, token, dati sanitari, documenti sensibili o altri dati personali non necessari.
- Valuta esplicitamente rischi relativi a OWASP, SQL injection, XSS, CSRF, SSRF, upload di file, accessi non autorizzati, escalation dei privilegi e gestione insicura delle sessioni.
- Applica limiti di frequenza (rate limiting) a login, registrazione, reset password, verifica del telefono e prenotazione.
- Il progetto tratta dati personali e pagamenti: adotta particolare attenzione a minimizzazione dei dati, controllo accessi, audit trail, cifratura e conservazione.

---

## Qualità del codice

- Scrivi codice semplice, leggibile, modulare e facilmente modificabile.
- Usa nomi chiari e descrittivi per file, classi, funzioni, variabili, endpoint, tabelle e campi.
- Mantieni funzioni e componenti focalizzati su una singola responsabilità.
- Evita duplicazioni: riusa codice esistente quando appropriato, senza introdurre astrazioni inutili.
- Gestisci in modo esplicito errori, casi limite, valori nulli, dati mancanti e fallimenti di servizi esterni.
- Non nascondere gli errori: intercettali, registrali in modo sicuro e restituisci messaggi appropriati.
- Rispetta formatter, linter, type-checker e convenzioni di stile già configurati nel progetto.
- Mantieni le modifiche circoscritte al requisito richiesto. Non effettuare refactoring estesi non necessari senza averne discusso l'impatto.
- Commenta esclusivamente la logica complessa, le decisioni architetturali e i motivi di scelte non ovvie. Il codice deve rimanere il più possibile autoesplicativo.
- Mantieni separati i livelli di presentazione, logica applicativa, accesso ai dati e integrazioni esterne, secondo l'architettura del progetto.

---

## Database e migrazioni

- Non modificare direttamente dati o schema in produzione.
- Per ogni modifica strutturale al database, crea una migrazione versionata e reversibile quando tecnicamente possibile.
- Verifica chiavi primarie, chiavi esterne, indici, vincoli di unicità, valori predefiniti e gestione dei valori nulli.
- Valuta l'impatto prestazionale delle query, soprattutto su tabelle di grandi dimensioni o endpoint frequentemente utilizzati.
- Evita query N+1, caricamenti non necessari e operazioni massive non paginate.
- Prima di modificare dati esistenti, valuta backup, rollback, integrità referenziale e compatibilità con le versioni precedenti dell'applicazione.
- Documenta eventuali passaggi manuali necessari per applicare migrazioni o aggiornamenti dati.

---

## API e integrazioni esterne

- Mantieni compatibilità con gli endpoint e i contratti API esistenti, salvo modifica esplicitamente approvata.
- Valida sempre input, autenticazione, autorizzazione e payload delle API.
- Gestisci timeout, errori temporanei, risposte non valide e indisponibilità delle integrazioni esterne.
- Non fidarti ciecamente dei dati ricevuti da servizi esterni: validali e gestiscili in modo difensivo.
- Evita di loggare payload completi se contengono dati personali o segreti.
- Documenta endpoint, parametri, payload, codici di risposta, errori e requisiti di autenticazione quando vengono aggiunti o modificati.

---

## Test e verifiche

- Pianifica i test insieme allo sviluppo della funzionalità, non solo al termine dell'implementazione.
- Inserisci nella TODO list i test da creare e i comandi di verifica da eseguire.
- Aggiungi o aggiorna test unitari per la logica applicativa modificata.
- Aggiungi test di integrazione quando una modifica coinvolge database, API, autenticazione, code, filesystem o servizi esterni.
- Aggiungi test end-to-end per i flussi utente critici: prenotazione, pagamento della caparra, annullamento, spostamento, mancata presentazione, acquisto online.
- Copri almeno il caso positivo, i principali casi di errore, i controlli autorizzativi e i casi limite rilevanti.
- Esegui tutti i controlli applicabili al progetto prima di considerare completato il lavoro:
  - Lint.
  - Formattazione.
  - Type-check.
  - Test unitari.
  - Test di integrazione.
  - Test end-to-end, quando disponibili.
  - Build dell'applicazione.
  - Verifica manuale dei flussi principali, quando necessaria.
- Se un test fallisce, analizza la causa e correggi il problema. Non aggirare, disabilitare o rimuovere test per far risultare la pipeline verde senza una motivazione esplicita.
- Documenta nella TODO list i controlli eseguiti e il loro esito.

---

## Docker e configurazione ambiente

- Il progetto deve rimanere eseguibile tramite Docker e Docker Compose, salvo diversa decisione esplicita.
- Mantieni aggiornati `Dockerfile`, `docker-compose.yml`, `.dockerignore` e i file di configurazione correlati quando necessario.
- Non includere segreti nelle immagini Docker.
- Usa file `.env` locali non versionati e mantieni aggiornato `.env.example`.
- Verifica che build e avvio funzionino in un ambiente pulito, senza dipendenze implicite installate solo sulla macchina dello sviluppatore.
- Documenta nel `README.md` i comandi necessari per avvio, arresto, build, migrazioni, test e troubleshooting del progetto.
- Riduci la superficie delle immagini di produzione: usa immagini base affidabili, dipendenze minime e utenti non root quando possibile.

---

## Documentazione

- Mantieni aggiornato `README.md` quando cambiano requisiti, installazione, configurazione, variabili d'ambiente, comandi, API, deploy, funzionalità o modalità d'uso.
- Il README deve spiegare almeno:
  - Scopo del progetto.
  - Prerequisiti.
  - Configurazione dell'ambiente.
  - Variabili d'ambiente.
  - Avvio tramite Docker Compose.
  - Comandi per test, lint, build e migrazioni.
  - Procedura di installazione di un nuovo salone.
  - Procedura di deploy, aggiornamento e rollback.
  - Procedura di backup e ripristino.
  - Principali flussi di utilizzo.
- Documenta decisioni architetturali rilevanti in `docs/adr/`.
- Crea nuove skill, script o guide riutilizzabili solo quando risolvono una necessità concreta e ricorrente.
- Ogni nuova skill o script deve essere documentato: scopo, input, output, dipendenze, modalità d'uso e metodo di verifica.
- Scrivi anche un documento rinominato MANUALE-DUSO.md in cui ci scrivi tutti i flussi e le funzionalità e inoltre come fare determinate operazioni.

---

## Gestione delle modifiche

- **REGOLA DI BASE — branch separato per ogni modifica.** Ogni sviluppo,
  bugfix, refactoring o modifica di configurazione/documentazione che tocca il
  codice o i file del repo deve avvenire su un **feature branch dedicato**
  (es. `feat/<descrizione>`, `fix/<descrizione>`, `docs/<descrizione>`),
  mai direttamente su `main`. Il merge su `main` avviene sempre tramite Pull
  Request. Questa regola si applica a qualsiasi sviluppo, **a meno che l'utente
  chieda esplicitamente di non farlo** (es. "committa su main").
- Prima di iniziare una modifica significativa, crea il branch di lavoro e
  segnala il nome del branch all'utente.
- Prima di modificare un file, comprendi il suo ruolo nel sistema e le sue dipendenze.
- Mantieni le modifiche piccole, coerenti e facilmente revisionabili.
- Non sovrascrivere modifiche esistenti senza verificarne origine e finalità.
- Evita modifiche non correlate al requisito corrente.
- Se è necessario un refactoring, separalo logicamente dall'implementazione funzionale e documentane lo scopo.
- Aggiorna test e documentazione nello stesso intervento in cui modifichi comportamento, configurazione o contratti pubblici.

---

## Definizione di completamento

Un'attività può essere considerata completata solo quando:

- I requisiti sono stati compresi o confermati.
- L'implementazione è coerente con il codice e l'architettura esistente.
- Gli aspetti di sicurezza pertinenti sono stati valutati e gestiti.
- I test applicabili sono stati creati o aggiornati.
- Tutti i controlli applicabili sono stati eseguiti con successo.
- La TODO list è aggiornata e non contiene attività aperte non giustificate.
- README, `.env.example` e documentazione tecnica sono aggiornati quando necessario.
- Eventuali limiti, decisioni rinviate, rischi residui o attività bloccate sono esplicitamente documentati.

Se non è possibile procedere per mancanza di requisiti, accessi, credenziali, decisioni di business o informazioni tecniche, non fare assunzioni rischiose: documenta il blocco nella TODO list e chiedi chiarimenti.

## Cose da definire

Se qualcosa non è definito, è da definire oppure non è ancora specificato, decidiamolo assieme e fammi le domande su cosa manca e come implementarlo.
