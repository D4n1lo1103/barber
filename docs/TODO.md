# TODO

Stato dello sviluppo per fasi (vedi la roadmap in `CLAUDE.md`).

## In corso — Fase 9: Vendita online

Branch: `feat/vendita-online`. Le fasi da 0 a 8 sono completate e in `main`,
insieme alla prenotazione forzata del titolare.

### Decisioni prese con il titolare (19/10/2026)

1. **Solo ritiro in negozio per ora.** La spedizione a domicilio resta fuori dalla fase
   finché corriere, costi e zone non sono definiti. Il modello dati prevede già il tipo di
   consegna, così aggiungerla non richiederà una migrazione distruttiva.
2. **La giacenza si prenota alla creazione dell'ordine**, che resta `in_attesa_pagamento`
   per un tempo limitato come il blocco dello slot. Se il pagamento non arriva, la
   prenotazione decade e i pezzi tornano disponibili: un pezzo pagato online non può essere
   venduto anche al banco.
3. **Il reso lo chiede il cliente** dall'area clienti entro i 14 giorni di recesso; il
   titolare approva o rifiuta con motivazione ed emette il rimborso al rientro della merce.
4. **Il credito del cliente è spendibile anche sugli ordini.** Un ordine coperto
   interamente dal credito non passa dal fornitore di pagamenti.

### Attività

- [ ] `TODO` Modello dati: `Ordine`, `RigaOrdine`, `RichiestaReso`, stati dell'ordine e
      tipo di consegna. `Pagamento` diventa polimorfo (caparra oppure ordine) con un
      vincolo che impone esattamente un collegamento; `MovimentoCredito` acquisisce
      `ordineId`.
- [ ] `TODO` Migrazione SQL manuale: importi e quantità non negativi, esattamente un
      collegamento sul pagamento, coerenza fra stato dell'ordine e date, motivo
      obbligatorio su rifiuto del reso e annullamento.
- [ ] `TODO` Prenotazione della giacenza: nuove cause di movimento per l'ordine
      (`prenotazione_ordine`, `rilascio_ordine`, `reso_ordine`), scarico condizionato
      contro le richieste simultanee.
- [ ] `TODO` Generalizzare `FornitorePagamenti`: al posto di `appuntamentoId` un
      riferimento interno con il suo tipo, così il webhook serve caparre e ordini con un
      solo endpoint e una sola tabella di idempotenza.
- [ ] `TODO` Schemi Zod condivisi degli ordini e del carrello, con il totale calcolato
      nello stesso modo da frontend e backend.
- [ ] `TODO` Catalogo e carrello lato cliente, visibili solo se la vendita online è attiva.
- [ ] `TODO` Creazione dell'ordine con prenotazione della giacenza, credito a scalare e
      pagamento del residuo; conferma solo dall'evento firmato del fornitore.
- [ ] `TODO` Attività pg-boss di scadenza degli ordini non pagati, che rilascia la
      giacenza e restituisce il credito usato.
- [ ] `TODO` Gestione degli ordini dal personale: preparazione, pronto per il ritiro,
      consegnato, annullato con rimborso.
- [ ] `TODO` Resi: richiesta del cliente entro 14 giorni dalla consegna, approvazione o
      rifiuto motivato del titolare, rimborso e ricarico della giacenza.
- [ ] `TODO` Test unitari sul totale dell'ordine, sulla finestra di recesso e sulle
      transizioni di stato.
- [ ] `TODO` Test di integrazione: permessi, prenotazione della giacenza in concorrenza,
      scadenza, webhook idempotente, rimborso, reso.
- [ ] `TODO` Test end-to-end: acquisto con ritiro in negozio, ordine scaduto, reso.
- [ ] `TODO` Dati demo: ordini di esempio negli stati principali.
- [ ] `TODO` ADR 0011, README e `MANUALE-DUSO.md`.
- [ ] `TODO` Controlli finali: formattazione, lint, tipi, test, build.

### Rinviato dentro la fase 9

- [ ] `BLOCCATO` **Spedizione a domicilio**: servono corriere, costi e zone.
- [ ] `BLOCCATO` **Obblighi fiscali della vendita online**: il titolare li comunicherà dopo
      il confronto con il commercialista. Nessuna logica fiscale va inventata, quindi
      l'ordine non produce documenti.

## Da fare — attività trasversali già individuate

- [ ] `TODO` Collegare `SessioniServizio.rimuoviScadute()` e `TokenServizio.rimuoviScaduti()`
      a un'attività ricorrente pg-boss: la pianificazione ricorrente ora esiste (promemoria),
      manca applicarla alla pulizia.
- [ ] `TODO` Integrare Sentry su frontend e backend con `IDENTIFICATIVO_INSTALLAZIONE`
      su ogni evento e senza dati personali dei clienti.
- [ ] `TODO` Registro di audit unico per le operazioni sensibili. I movimenti della caparra
      e le restituzioni discrezionali sono già tracciati (fase 6); mancano cancellazione dei
      dati di un cliente e disattivazione di account.
- [ ] `TODO` Il pacchetto JavaScript del frontend supera i 500 kB: valutare un ulteriore
      taglio in parti ora che l'area cliente è cresciuta.

## Bloccato

- [ ] `BLOCCATO` Aggiornamento automatico dell'installazione di staging al merge su `main`
      e delle installazioni dei saloni alla creazione di un tag `vX.Y.Z`.
  - Blocco: servono il VPS di staging, il dominio e i segreti di deploy
    (host, utente, chiave SSH) da configurare come segreti del repository GitHub.
  - Nel frattempo la pubblicazione delle immagini su GitHub Container Registry è attiva e
    l'aggiornamento si esegue a mano con `infra/aggiorna.sh`.
- [ ] `BLOCCATO` Invio reale delle e-mail: inviti ad attivare l'account, verifiche,
      reset della password e conferme partono già da sé, ma senza `SMTP_HOST` restano
      solo nei log. In sviluppo è il comportamento voluto; all'installazione del salone
      vanno messe in `.env` le credenziali del provider (Brevo) e va provato l'arrivo di
      un invito su una casella vera.
  - Blocco: servono l'account del provider e il dominio del salone verificato come
    mittente. L'avvio in produzione rifiuta già di partire senza `SMTP_HOST`.
- [ ] `TODO` Valutare un raccoglitore di posta locale (es. Mailpit in `docker-compose`)
      per vedere in sviluppo le e-mail come le riceve il cliente, invece di leggerle nei
      log del server.
- [ ] `BLOCCATO` Prova reale della procedura di ripristino dei backup.
  - Blocco: richiede un server di prova con un'installazione attiva. Gli script sono
    pronti e documentati; manca la verifica end-to-end su dati reali.

## Completato

### Navigazione del personale e dati del salone modificabili (25/10/2026)

Il titolare non riusciva a raggiungere le impostazioni: il collegamento esisteva solo
sul pannello iniziale. Sono emerse anche due lacune vicine: i dati del primo avvio non
erano modificabili e il cambio password non aveva nessuna schermata. Decisioni prese
con il titolare in `docs/adr/0012-dati-del-salone-modificabili-e-navigazione.md`.

- [x] `COMPLETATO` Barra di navigazione fissa del personale su ogni pagina, con menu a
      scomparsa su schermo stretto; rimossi i collegamenti estemporanei fra le pagine.
- [x] `COMPLETATO` `GET` e `PUT /impostazioni/salone` (solo titolare) e scheda _Salone_
      nelle impostazioni: recapiti, granularità, blocco dello slot, vendita online.
- [x] `COMPLETATO` Il profilo resta immutabile; la granularità viene rifiutata se le
      durate dei servizi attivi non sono multiple, con l'elenco di quali correggere.
- [x] `COMPLETATO` Riquadro di cambio password per tutti i ruoli, nel pannello e nella
      scheda _Profilo e dati_ del cliente.
- [x] `COMPLETATO` Selettore del tema anche nell'area del cliente.
- [x] `COMPLETATO` Test: 4 di integrazione sui dati del salone (lettura, salvataggio con
      aggiornamento dello stato pubblico, granularità incompatibile, divieto al
      dipendente) e e2e della scheda _Salone_ e della navigazione dalla barra.

### L'invito al cliente dice su quale recapito è partito (25/10/2026)

L'invio automatico c'era già, ma l'interfaccia mostrava solo il link da copiare e
diceva «Consegna al cliente questo link»: sembrava l'unico modo di recapitarlo.

- [x] `COMPLETATO` `POST /clienti` e `POST /clienti/:id/invito` restituiscono il
      `canale` usato (`whatsapp`, `email` o `nessuno`), già noto al servizio notifiche.
- [x] `COMPLETATO` L'interfaccia nomina il recapito su cui l'invito è partito e
      presenta il link come riserva; avvisa quando non c'è nessun recapito.
- [x] `COMPLETATO` Test: due di integrazione (invito via e-mail davvero consegnato al
      mittente, canale `nessuno` senza recapiti) e tre unitari sul messaggio.

### Accesso bloccato dai cookie di una sessione scaduta (25/10/2026)

Con addosso il cookie di sessione di una sessione non più valida — scaduta,
revocata o sparita perché il database è stato ripopolato dal seed — la guardia
CSRF rifiutava anche la richiesta di accesso, con «Token di sicurezza non
valido. Ricarica la pagina.». Ricaricare non serviva: il cookie restava e
l'utente non poteva più rientrare se non cancellando i cookie dal browser.

- [x] `COMPLETATO` La guardia CSRF salta la verifica quando il cookie di sessione
      non corrisponde a nessuna sessione valida: la richiesta non è autenticata e
      non c'è autorità da proteggere.
- [x] `COMPLETATO` Test di integrazione di regressione: accesso riuscito inviando
      i cookie di una sessione chiusa con l'uscita.

### Prenotazione forzata del titolare (25/10/2026)

Deciso con il titolare: può derogare **solo il titolare**, anche sull'agenda dei
colleghi, superando orari di lavoro, giorni di chiusura, ferie e assenze,
allineamento agli slot e sovrapposizioni. Restano i limiti di data e il divieto
di prenotare per una scheda cliente disattivata. Vedi
`docs/adr/0011-prenotazione-forzata-del-titolare.md`.

- [x] `COMPLETATO` Colonna `forzato` e vincolo di esclusione ricostruito con
      `AND NOT "forzato"` (migrazione `20261025120000_appuntamento_forzato`).
- [x] `COMPLETATO` Campo `forzato` negli schemi condivisi di creazione e lettura.
- [x] `COMPLETATO` Backend: deroga applicata in `AppuntamentiServizio.crea`, con
      `403` a chi non è titolare e registrazione nei log di ogni inserimento forzato.
- [x] `COMPLETATO` Interfaccia: interruttore «Fuori orario» con campi giorno e ora
      liberi, avviso nel modale e nel dettaglio dell'appuntamento.
- [x] `COMPLETATO` Messaggi di errore specifici al posto del generico
      «Scegli il cliente, i servizi e l'orario».
- [x] `COMPLETATO` La griglia dell'agenda si allarga per mostrare un appuntamento
      fuori dagli orari di apertura, che altrimenti restava invisibile.
- [x] `COMPLETATO` Test: 9 di integrazione, 3 del frontend e 1 end-to-end.
- [x] `COMPLETATO` Documentazione: ADR 0011, MANUALE-DUSO.md e README.

Verifiche eseguite il 25/10/2026, tutte con esito positivo: `pnpm verifica`
(formattazione, lint, type-check, test unitari, build), 205 test di integrazione
e prova manuale sull'app in esecuzione, come titolare e come dipendente.

**Rischio accettato**: le righe forzate escono dal vincolo di esclusione, quindi
su quelle si perde la protezione contro due inserimenti simultanei. Il controllo
applicativo, l'agenda e il calcolo della disponibilità restano invariati.

### Resta da decidere

- [ ] `TODO` Lo **spostamento** di un appuntamento segue ancora i vincoli
      ordinari, anche per il titolare: se serve la stessa deroga, va decisa a parte.
      — Fase 8: Prodotti e magazzino (18/10/2026)

### Decisioni prese con il titolare (18/10/2026)

1. **La giacenza non può andare sotto zero.**
2. **Le giacenze si correggono a mano solo dal titolare**, con motivazione tracciata.
3. **La vendita in negozio non produce alcun documento** per il cliente.

### Attività

- [x] `COMPLETATO` Modello dati: prodotti con giacenza e scorta minima, vendite con righe
      (nome e prezzo copiati), movimenti di magazzino come registro di audit.
- [x] `COMPLETATO` Migrazione SQL manuale: giacenza e giacenza risultante mai negative,
      quantità mai nulle, correzione sempre motivata e con autore, coerenza fra causa e segno
      del movimento, indice per i prodotti sotto scorta.
- [x] `COMPLETATO` Catalogo prodotti: creazione, modifica, ritiro dalla vendita e riordino dal
      titolare; consultazione per tutto il personale, con i soli prodotti in vendita per i
      dipendenti.
- [x] `COMPLETATO` Vendita in negozio dal personale, con più prodotti, cliente e appuntamento
      facoltativi, e scarico del magazzino nella stessa transazione.
- [x] `COMPLETATO` Rifiuto della vendita oltre la giacenza, con aggiornamento condizionato
      contro le richieste simultanee e vincolo del database come ultima difesa.
- [x] `COMPLETATO` Carico e correzione della giacenza, solo titolare, con motivo obbligatorio;
      anche la giacenza iniziale di un prodotto nuovo è un movimento.
- [x] `COMPLETATO` Avviso di scorta minima per il personale, nella pagina delle vendite e
      nella scheda Prodotti.
- [x] `COMPLETATO` Annullamento di una vendita con motivo obbligatorio e ripristino della
      giacenza, tracciato da un movimento.
- [x] `COMPLETATO` Interfaccia: scheda Prodotti nelle impostazioni, pagina Vendite per il
      personale, acquisti nella scheda cliente; la ricerca del cliente è diventata un
      componente riusabile.
- [x] `COMPLETATO` Dati demo: quattro prodotti, uno sotto la scorta minima e uno esaurito.
- [x] `COMPLETATO` Test: unitari sul totale della vendita e sulla validazione dei movimenti,
      16 di integrazione su catalogo, permessi, giacenza, concorrenza e annullamento,
      end-to-end della vendita, dell'annullamento e della correzione di giacenza.
- [x] `COMPLETATO` ADR 0010, README e `MANUALE-DUSO.md` aggiornati.

### Controlli eseguiti al termine della fase 8

| Controllo            | Comando                                       | Esito                                 |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                           | superato                              |
| Lint                 | `pnpm lint`                                   | superato                              |
| Tipi                 | `pnpm type-check`                             | superato                              |
| Test unitari         | `pnpm test`                                   | 76 condivisi, 34 backend, 38 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione` | 196 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`          | 45 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                  | superato                              |

### Limiti noti

- **Niente fornitori, ordini di acquisto, lotti o scadenze**: non richiesti. I movimenti di
  carico sono il punto da cui partire, se serviranno.
- **La vendita non produce documenti**: scontrini, fatture e registratore telematico
  dipendono dalla gestione della cassa, ancora da definire.

## Completato — Fase 7: WhatsApp (18/10/2026) — MVP raggiunto

### Decisioni prese con il titolare (18/10/2026)

1. **I dati di WhatsApp si impostano in fase di configurazione**: attivazione, identificativo
   del numero mittente e nomi dei modelli stanno nella procedura guidata e nella scheda
   _Messaggi_. Il **token resta in `.env`**, perché i backup del database vengono scaricati sul
   PC dello sviluppatore. L'interfaccia dichiara se il token è presente.
2. **Nessuna credenziale reale disponibile**: tutto è verificabile con un mittente finto e con
   clienti di prova che coprono ogni combinazione di canale.
3. **Il consenso delle schede create dal personale lo registra il personale** (casella nel
   pannello di creazione): il cliente al telefono non può spuntare nulla, e senza consenso
   l'invito va via e-mail.

### Attività

- [x] `COMPLETATO` Interfaccia `MittenteWhatsapp` con due realizzazioni: WhatsApp Cloud API di
      Meta e mittente finto che registra i messaggi, mai costruito in produzione.
- [x] `COMPLETATO` Modelli dei messaggi in un unico posto, con nomi configurabili: conferma,
      promemoria, invito di attivazione, codice di verifica del numero.
- [x] `COMPLETATO` Scelta del canale come funzione pura (WhatsApp attivo + consenso + numero,
      altrimenti e-mail) e ripiego immediato sull'e-mail quando l'invio WhatsApp fallisce,
      senza ritentare: un evento, un messaggio.
- [x] `COMPLETATO` Impostazioni nella procedura guidata (passo «Messaggi») e nella scheda
      _Messaggi_, con invio di prova e vincolo SQL che vieta di attivare WhatsApp senza numero
      mittente e nomi dei modelli.
- [x] `COMPLETATO` Verifica del numero con codice di sei cifre: hash legato all'utente,
      validità di quindici minuti, limite di frequenza, uso singolo, rifiuto se il numero è già
      verificato altrove.
- [x] `COMPLETATO` Promemoria come attività ricorrente ogni cinque minuti, con
      `promemoriaInviatoIl` segnato prima dell'invio: nessun doppio promemoria.
- [x] `COMPLETATO` Dati di prova: quattro clienti che coprono WhatsApp, ripiego via e-mail,
      numero da verificare e scheda senza e-mail.
- [x] `COMPLETATO` Test: unitari sulla scelta del canale, 15 di integrazione su impostazioni,
      canale, ripiego, verifica del numero e promemoria, end-to-end su scheda _Messaggi_,
      invio di prova e verifica del numero dall'area cliente.
- [x] `COMPLETATO` ADR 0009, README, `.env.example` e `MANUALE-DUSO.md` aggiornati.

### Controlli eseguiti al termine della fase 7

| Controllo            | Comando                                       | Esito                                 |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                           | superato                              |
| Lint                 | `pnpm lint`                                   | superato                              |
| Tipi                 | `pnpm type-check`                             | superato                              |
| Test unitari         | `pnpm test`                                   | 70 condivisi, 34 backend, 38 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione` | 180 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`          | 41 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                  | superato                              |

### Limiti noti e rischi residui

- **I testi dei modelli sono una proposta**: vanno registrati e approvati da Meta, e i nomi
  riportati nella scheda _Messaggi_. Se un nome non corrisponde, Meta rifiuta il messaggio e il
  cliente riceve l'e-mail.
- **Verifica con credenziali reali ancora da fare**: serve l'account Meta del salone, con
  numero mittente e modelli approvati. Senza, il flusso è coperto dal mittente finto.
- **L'identificativo del numero mittente si legge all'avvio**: cambiarlo richiede un riavvio
  del servizio.
- **Corretto un difetto della fase 6**: lo script `azzera` non ripuliva movimenti, pagamenti
  ed eventi e, con i vincoli `RESTRICT`, sarebbe fallito.

## Completato — Fase 6: Caparra e pagamenti Stripe (18/10/2026)

### Decisioni prese con il titolare (18/10/2026)

1. **La caparra si governa dalle impostazioni**: il salone decide se applicarla e con quale
   percentuale, dalla scheda _Regole_.
2. **Forma di restituzione** per un annullamento tempestivo: scelta del salone fra rimborso e
   credito. Un'installazione nuova parte da _rimborso_.
3. **Stripe dietro interfaccia**, con un fornitore finto per i test: lo sviluppo non dipende
   dalle chiavi, che servono solo alla verifica manuale nel browser.
4. **Gli appuntamenti inseriti dal personale non hanno caparra**: si paga online al momento
   della prenotazione, e al telefono il cliente non può farlo. La spunta «senza caparra» è
   sparita dal pannello, perché non avrebbe più effetto.
5. **Lo spostamento «trattato come un annullamento»** restituisce la caparra e ne richiede una
   nuova sul nuovo orario.
6. **Il credito copre la caparra per quello che può**, il resto si paga con carta.

### Attività

- [x] `COMPLETATO` Modello dati: impostazioni della caparra, importo e scadenza del blocco
      sull'appuntamento, pagamenti, movimenti della caparra, movimenti del credito, eventi di
      pagamento già elaborati (idempotenza).
- [x] `COMPLETATO` Migrazione SQL manuale con i vincoli scritti a mano: percentuale fra 1 e
      100, caparra non superiore al prezzo, scadenza del blocco solo in attesa di pagamento,
      restituzione discrezionale sempre motivata e con autore, un solo pagamento aperto per
      appuntamento.
- [x] `COMPLETATO` Impostazioni della caparra nella scheda _Regole_, con validazione condivisa.
- [x] `COMPLETATO` Interfaccia `FornitorePagamenti`: Stripe Checkout ospitato e fornitore
      finto per test e sviluppo senza chiavi, mai costruito in produzione.
- [x] `COMPLETATO` Prenotazione online con caparra: appuntamento `in_attesa_pagamento` e slot
      bloccato per i minuti definiti in installazione.
- [x] `COMPLETATO` Webhook verificato per firma e idempotente: la conferma dell'appuntamento
      avviene solo qui, e un importo diverso da quello atteso non conferma nulla.
- [x] `COMPLETATO` Scadenza del blocco su pg-boss, più la chiusura dei blocchi scaduti prima
      di calcolare la disponibilità e prima di occupare uno slot: la correttezza non dipende
      dalla coda.
- [x] `COMPLETATO` Regole di annullamento: tempestivo (rimborso o credito), tardivo e mancata
      presentazione (trattenuta), dal salone (rimborso integrale).
- [x] `COMPLETATO` Caparra scalata dal totale al completamento.
- [x] `COMPLETATO` Restituzione discrezionale: solo titolare, motivazione obbligatoria,
      tracciata con data e autore.
- [x] `COMPLETATO` Credito del cliente: saldo senza scadenza, utilizzo parziale o totale,
      restituzione se la differenza non viene pagata.
- [x] `COMPLETATO` Registro dei movimenti: caparra pagata, trattenuta e saldo del credito si
      calcolano dai movimenti, senza totali da tenere allineati.
- [x] `COMPLETATO` Interfaccia: riepilogo e pagamento nell'area cliente, ripresa del
      pagamento, pagina del fornitore finto, caparra nel dettaglio dell'appuntamento,
      restituzione discrezionale, credito e movimenti nella scheda cliente (solo titolare).
- [x] `COMPLETATO` Test: unitari sul calcolo della caparra, sull'uso del credito e sulle
      regole di restituzione; 19 test di integrazione su conferma, idempotenza, firma non
      valida, scadenza, rimborso, credito e restituzione discrezionale; end-to-end del flusso
      di pagamento, in un progetto a sé perché la caparra è un'impostazione del salone.
- [x] `COMPLETATO` ADR 0008, README, `.env.example` e `MANUALE-DUSO.md` aggiornati.

### Controlli eseguiti al termine della fase 6

| Controllo            | Comando                                       | Esito                                 |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| Formattazione        | `pnpm format:check`                           | superato                              |
| Lint                 | `pnpm lint`                                   | superato                              |
| Tipi                 | `pnpm type-check`                             | superato                              |
| Test unitari         | `pnpm test`                                   | 70 condivisi, 30 backend, 38 frontend |
| Test di integrazione | `pnpm --filter @barber/api test:integrazione` | 165 test superati                     |
| Test end-to-end      | `pnpm --filter @barber/web test:e2e`          | 38 superati, 1 saltato per scelta     |
| Build                | `pnpm build`                                  | superato                              |

### Limiti noti e rischi residui

- **Verifica manuale con Stripe reale ancora da fare**: serve inserire le chiavi di prova in
  `.env` e registrare il webhook. Senza chiavi il flusso è coperto dal fornitore finto, che
  percorre la stessa strada ma non parla con Stripe.
- **Pagamento riuscito su uno slot già liberato**: resta possibile se il cliente paga
  all'ultimo istante. Viene registrato nei log e la caparra risulta pagata su un appuntamento
  annullato, così il titolare la vede fra i movimenti e può restituirla.
- **Registro di audit generale**: i movimenti della caparra sono tracciati, ma le altre
  operazioni sensibili (disattivazione di account, cancellazione dei dati) non hanno ancora un
  registro unico. Resta fra le attività trasversali.

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
