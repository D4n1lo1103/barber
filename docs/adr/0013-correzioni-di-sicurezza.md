# ADR 0013 — Correzioni di sicurezza dalla revisione del backend

- **Stato**: accettata
- **Data**: 2026-10-27
- **Fase**: trasversale (modifica alle fasi 4, 6, 7 e 9)

## Contesto

Una revisione di sicurezza di `apps/api` (131 file) ha prodotto 22 ipotesi, di cui 9
confermate leggendo il codice. Cinque hanno effetti concreti su dati dei clienti o su
denaro e vengono corrette qui; le minori sono in `docs/TODO.md`.

Tre riguardano la stessa radice — **si legge uno stato, si decide, si scrive, senza
garantire che nel frattempo non sia cambiato** — e due riguardano **dati che escono da
dove dovrebbero restare**.

### 1. La registrazione si impossessava di una scheda altrui

`RegistrazioneServizio.registraCliente` cercava una scheda con lo stesso
`numeroWhatsapp` e, se non aveva password, la **sovrascriveva** con nome, e-mail e
password di chi si stava registrando. Il numero arrivava dal corpo di una richiesta non
autenticata e non veniva verificato in alcun modo.

Chiunque conoscesse il numero di un cliente la cui scheda era stata creata dal personale
— una prenotazione al telefono — poteva registrarsi con quel numero e una propria
e-mail, verificare la casella che controllava ed entrare nella scheda della vittima:
storico, acquisti, credito spendibile, movimenti della caparra, esportazione GDPR. Il
nome e l'e-mail della vittima venivano sovrascritti senza alcuna traccia visibile.

`CLAUDE.md` prescriveva già il controllo mancante: «se un cliente si registra con un
numero di telefono già presente in una scheda, il sistema lo collega alla scheda
esistente **dopo la verifica del numero**». Il codice collegava dopo la verifica
dell'e-mail dell'attaccante.

### 2. La verifica del numero si poteva ottenere via e-mail

`VerificaNumeroServizio.inviaCodice` ripiegava sull'e-mail quando il salone non aveva
attivato WhatsApp. Un codice recapitato via e-mail dimostra che chi lo riceve possiede
quella casella, non quel numero: usarlo come prova per unire la scheda di qualcun altro
avrebbe riaperto il problema 1 da un'altra porta.

### 3. Il credito si poteva spendere due volte

Il saldo è la somma dei movimenti (`MovimentoCredito`), letta **fuori** dalla transazione
che poi inseriva il movimento negativo, senza ricontrollo. Due richieste simultanee dello
stesso cliente — due prenotazioni, due ordini — leggevano lo stesso saldo e lo
spendevano entrambe, portandolo sotto zero. La giacenza dei prodotti era già protetta
nello stesso punto con un aggiornamento condizionato; il credito no.

### 4. La caparra si poteva far restituire due volte

`AppuntamentiServizio.cambiaStato` leggeva lo stato, controllava la transizione con
`transizioneAmmessa` e poi scriveva, senza transazione né condizione sullo stato
precedente. Due annullamenti simultanei passavano entrambi il controllo e chiamavano
entrambi `applicaTrattamentoAnnullamento`: la caparra veniva rimborsata o convertita in
credito due volte.

### 5. Dati personali del personale e credenziali nei log

`GET /area-cliente/catalogo` restituiva l'oggetto `Operatore` completo a ogni cliente
autenticato: e-mail personale, numero WhatsApp personale e `accountAttivato`, che rivela
quali account del personale non hanno ancora una password. Per scegliere l'operatore
servono identificativo e nome.

`MittenteWhatsappRegistro` scriveva nei log l'anteprima del messaggio, che contiene il
link di attivazione e il codice di verifica. Il suo commento affermava di non essere mai
costruito in produzione, ma nulla lo impediva: a differenza di SMTP e Stripe, che
interrompono l'avvio se non configurati, il modulo ripiegava sul registro ogni volta che
mancava `WHATSAPP_TOKEN` — cioè per impostazione predefinita, finché il titolare non
configura WhatsApp. `salvaWhatsapp` permette inoltre di attivare i messaggi senza che il
mittente sia reale.

## Decisione

1. **La registrazione non scrive mai su una scheda esistente.** Nasce sempre un account
   nuovo, con `numeroVerificato: false`. Viene rifiutato soltanto un numero già
   _rivendicato_: del personale, di un account con password, o già verificato.
2. **L'unione si fa dopo la verifica del numero**, come prescrive il capitolato. In
   `confermaCodice`, dimostrato il possesso, le schede non rivendicate con quel numero
   (cliente, senza password, numero non verificato, non anonimizzate) vengono unite:
   appuntamenti, pagamenti, movimenti di caparra e credito, vendite, ordini, resi e
   richieste di cancellazione passano all'account, le note del personale vengono
   accodate, la scheda vuota viene eliminata. Tutto in una transazione.
3. **Il codice di verifica viaggia solo su WhatsApp** (`consegna(..., { soloWhatsapp: true })`).
   Senza WhatsApp attivo la verifica non è disponibile e l'interfaccia lo dice. Il modello
   e-mail del codice è stato rimosso.
4. **La risposta alla registrazione non distingue più i casi**: `collegataASchedaEsistente`
   è stato rimosso dallo schema condiviso, perché diceva a un anonimo se un numero
   appartiene a un cliente del salone.
5. **Il credito si spende solo da `CaparraServizio.spendiCredito`**, che dentro la
   transazione del chiamante blocca la riga del cliente (`SELECT … FOR UPDATE`), rilegge
   il saldo e rifiuta con `409` se non copre più l'importo. Prenotazione e credito stanno
   ora nella stessa transazione, così un credito esaurito non lascia uno slot occupato da
   una prenotazione mai pagata.
6. **`cambiaStato` scrive in modo condizionato** (`updateMany` con lo stato letto nella
   `where`) e risponde `409` se nessuna riga è stata toccata.
7. **Il catalogo del cliente espone `schemaOperatorePubblico`**: identificativo, nome,
   cognome.
8. **In produzione il mittente WhatsApp di sviluppo non viene mai costruito**: al suo
   posto `MittenteWhatsappNonConfigurato`, che non registra nulla e rifiuta l'invio,
   lasciando intervenire il ripiego via e-mail già previsto. Il mittente di sviluppo
   registra ora solo il nome del modello, non l'anteprima.

## Conseguenze

- **Il «nessun duplicato» ora dipende da WhatsApp.** Finché il salone non ha configurato
  i messaggi, un cliente che si registra con il numero di una scheda esistente avrà due
  schede, unite quando verificherà il numero. È il prezzo di non regalare le schede a chi
  ne indovina il numero, e il capitolato colloca l'unione proprio dopo quella verifica.
  In quel periodo il personale vedrà una scheda doppia in elenco.
- **Un blocco di riga per cliente serializza le spese di credito** dello stesso cliente.
  Non ha effetto sugli altri e non introduce cicli di attesa: la riga del cliente è
  l'ultimo blocco acquisito in entrambi i percorsi (prenotazione e ordine).
- **Due nuove risposte `409`** sulle operazioni simultanee (annullamento, spesa del
  credito), con messaggi che invitano a ricaricare.
- **La verifica del numero non è disponibile senza WhatsApp**: un messaggio esplicito
  invita a contattare il salone.
- **L'unione elimina la scheda vuota.** Ogni relazione verso il cliente ha
  `onDelete: Restrict`: se in futuro ne venisse aggiunta una che `unisciSchedeNonRivendicate`
  non sposta, l'eliminazione fallirebbe e la transazione verrebbe annullata, invece di
  perdere dati in silenzio. Chi aggiunge una tabella con `clienteId` deve aggiornare quel
  metodo.
- Nessuna migrazione: lo schema non cambia.

## Alternative scartate

- **Lasciare l'unione alla registrazione, chiedendo il consenso del personale.** Rimanda a
  una persona una decisione che il sistema può prendere con certezza una volta verificato
  il numero, e intanto lascia aperta la finestra di furto.
- **Registrare il canale di consegna del codice su `TokenUtente`** per permettere la
  verifica via e-mail senza concedere l'unione. Richiede una migrazione e conserva un
  `numeroVerificato` che non prova il possesso del numero: un valore che significa due
  cose diverse è una trappola per chi leggerà il codice dopo.
- **Un vincolo di database sul saldo del credito.** Il saldo è una somma di righe: un
  `CHECK` non lo può esprimere e servirebbe un trigger, molto più oscuro del blocco di
  riga nel punto in cui il credito si spende.
- **Interrompere l'avvio in produzione senza `WHATSAPP_TOKEN`**, come per SMTP e Stripe.
  WhatsApp è opzionale per scelta: un salone che non lo usa non deve vedere il servizio
  rifiutare l'avvio.
