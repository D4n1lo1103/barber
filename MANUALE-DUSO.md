# Manuale d'uso

Guida all'uso del gestionale per il **titolare**, per i **dipendenti** e per i **clienti**
del salone.
L'interfaccia è in italiano, gli importi in euro e gli orari sempre quelli del salone
(fuso `Europe/Rome`).

Il manuale segue lo stato attuale del software: sono descritte le funzioni delle fasi
già completate. Le parti ancora da sviluppare sono elencate in fondo, in
«[Non ancora disponibile](#non-ancora-disponibile)».

## Indice

- [Glossario](#glossario)
- [Primo avvio dell'installazione](#primo-avvio-dellinstallazione)
- [Accesso e account](#accesso-e-account)
- [Impostazioni del salone (solo titolare)](#impostazioni-del-salone-solo-titolare)
  - [Servizi](#servizi)
  - [Personale](#personale)
  - [Orari e assenze](#orari-e-assenze)
  - [Chiusure del salone](#chiusure-del-salone)
  - [Regole del salone](#regole-del-salone)
  - [Caparra](#caparra)
  - [Messaggi WhatsApp](#messaggi-whatsapp)
  - [Prodotti e magazzino](#prodotti-e-magazzino)
  - [Richieste di cancellazione dei dati](#richieste-di-cancellazione-dei-dati)
- [Clienti](#clienti)
- [Vendite in negozio](#vendite-in-negozio)
- [Agenda](#agenda)
  - [Inserire un appuntamento](#inserire-un-appuntamento)
  - [Spostare un appuntamento](#spostare-un-appuntamento)
  - [Annullare un appuntamento](#annullare-un-appuntamento)
  - [Mancata presentazione](#mancata-presentazione)
  - [Completare un appuntamento](#completare-un-appuntamento)
- [Area del cliente](#area-del-cliente)
  - [Creare l'account](#creare-laccount)
  - [Password dimenticata](#password-dimenticata)
  - [Prenotare online](#prenotare-online)
  - [Spostare o annullare dall'app](#spostare-o-annullare-dallapp)
  - [Pagare la caparra](#pagare-la-caparra)
  - [Verificare il numero di telefono](#verificare-il-numero-di-telefono)
  - [Profilo, consensi e dati personali](#profilo-consensi-e-dati-personali)
- [Aspetto e accessibilità](#aspetto-e-accessibilità)
- [Domande frequenti](#domande-frequenti)
- [Non ancora disponibile](#non-ancora-disponibile)

## Glossario

| Termine               | Significato                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| Installazione         | La copia del software dedicata a questo salone.                            |
| Profilo               | Tipo di attività scelto al primo avvio: barbiere o parrucchiere.           |
| Titolare              | Amministratore del salone. È anche un operatore e riceve appuntamenti.     |
| Dipendente            | Membro del personale con accesso limitato (nessuna impostazione).          |
| Operatore             | Chi eroga i servizi e ha un'agenda: titolare o dipendente.                 |
| Scheda cliente        | Il record del cliente. Esiste anche prima che il cliente attivi l'account. |
| Servizio              | Prestazione con nome, prezzo e durata fissa.                               |
| Appuntamento          | Prenotazione di uno o più servizi con un operatore, in data e ora.         |
| Slot                  | Unità minima di tempo dell'agenda (es. 15 minuti).                         |
| Caparra               | Anticipo pagato online alla prenotazione, se il salone la richiede.        |
| Credito               | Importo a favore del cliente, usabile per una prenotazione futura.         |
| Giacenza              | Pezzi di un prodotto presenti in magazzino.                                |
| Scorta minima         | Soglia sotto cui il personale viene avvisato di riordinare.                |
| Limite di preavviso   | Ore entro cui un annullamento è considerato tempestivo.                    |
| Mancata presentazione | Il cliente non si è presentato.                                            |

## Primo avvio dell'installazione

Alla prima apertura dell'indirizzo del salone compare la **procedura guidata**, in sei
passi. Serve la **chiave di installazione** consegnata da chi ha predisposto il server.

1. **Profilo**: barbiere o parrucchiere. Determina il catalogo iniziale, le durate tipiche e
   il colore dell'interfaccia.
2. **Dati del salone**: nome, indirizzo, città, telefono, e-mail.
3. **Agenda**: granularità degli slot e tempo di blocco dello slot durante il pagamento
   della caparra; attivazione della vendita online dei prodotti.
4. **Messaggi**: attivazione dei messaggi WhatsApp e identificativo del numero mittente. È
   facoltativo e si può fare dopo, dalle impostazioni. Il token di WhatsApp non si imposta
   qui: è un segreto e va nel file di configurazione del server.
5. **Catalogo iniziale**: i servizi proposti per il profilo, modificabili subito o più tardi.
6. **Account del titolare** e chiave di installazione.

La procedura si completa **una sola volta**. Finché non è completata nessun'altra pagina è
raggiungibile.

## Accesso e account

- Si accede con **e-mail e password** dalla pagina di accesso.
- Dopo troppi tentativi errati l'accesso viene bloccato per qualche minuto.
- Il **cambio password** disconnette tutte le sessioni aperte, su ogni dispositivo.
- Il pulsante **Esci** chiude la sessione.

Il titolare non conosce mai le password degli altri: dipendenti e clienti ricevono un **link
di attivazione** e scelgono la propria.

## Impostazioni del salone (solo titolare)

Dal pannello iniziale, pulsante **Impostazioni del salone**. Sei schede: Servizi, Prodotti,
Personale, Orari, Regole e Messaggi. I dipendenti non vedono questa pagina.

### Servizi

- **Aggiungere un servizio**: nome, prezzo (IVA inclusa), durata in minuti, descrizione.
  La durata deve essere un multiplo della granularità degli slot.
- **Abilitare gli operatori**: per ogni servizio si indica chi lo esegue. In prenotazione
  vengono proposti solo gli operatori abilitati a **tutti** i servizi scelti.
- **Modificare prezzo o durata**: i cambiamenti valgono per le prenotazioni future. Gli
  appuntamenti già fissati e lo storico dei clienti conservano prezzo e durata del momento.
- **Disattivare un servizio**: resta nello storico ma non è più prenotabile. I servizi non
  vengono mai cancellati.
- **Riordinare**: l'ordine del catalogo è quello in cui i servizi appaiono in prenotazione.

### Personale

- **Creare un dipendente**: nome, cognome, e-mail, numero WhatsApp facoltativo. Il sistema
  mostra **una sola volta** un link di attivazione valido sette giorni: va consegnato alla
  persona, che sceglie la propria password.
- **Rigenerare l'invito**: se il link scade o non arriva, si genera un nuovo link; il
  precedente non funziona più.
- **Disattivare un account**: l'accesso viene revocato subito, anche se la persona è
  collegata. Lo storico resta. Il titolare non può disattivare sé stesso.
- **Riattivare**: riporta l'account in servizio.

### Orari e assenze

- **Orari di apertura**: per ogni giorno della settimana si indicano una o più fasce
  (es. 9:00–13:00 e 15:00–19:00). Un giorno senza fasce è un giorno di chiusura.
  Un'installazione nuova parte aperta **da martedì a sabato**: domenica e lunedì sono chiusi.
  Per cambiare i giorni di chiusura abituali basta aggiungere o togliere le fasce di quel
  giorno.
- **Orari di lavoro**: per ciascun operatore, dentro le fasce di apertura. Il sistema
  rifiuta un orario di lavoro quando il salone è chiuso.
- **Restringere gli orari di apertura** è rifiutato se lascerebbe un operatore al lavoro
  fuori orario: prima si aggiornano gli orari di lavoro.
- **Assenze**: ferie, giorno di riposo o altra indisponibilità, indicando inizio e fine.
  Durante un'assenza l'operatore non è prenotabile.
- Orari e assenze non possono lasciare fuori appuntamenti già in agenda: in quel caso il
  salvataggio viene rifiutato e indica l'appuntamento da spostare o annullare.

### Chiusure del salone

Per le **festività** e le chiusure dell'intera attività, nella scheda _Orari_ c'è il
riquadro **Chiusure del salone**: un solo flusso, valido per tutti.

1. Si indicano **primo giorno**, **ultimo giorno** (compreso) e il **motivo** (es. «Natale»).
2. Premendo **Registra chiusura** tutti gli operatori risultano occupati in quei giorni:
   nessuno è prenotabile, né dal personale né dall'area clienti.
3. La chiusura appare nell'elenco con il periodo, il motivo e il numero di operatori
   coinvolti. **Rimuovi** la cancella per tutti e riapre il salone.

Dettagli utili:

- La chiusura non si può registrare se in quei giorni ci sono **appuntamenti in agenda**:
  il messaggio indica l'operatore da sistemare, così si spostano o si annullano prima.
- Non si può registrare una chiusura sovrapposta a un'altra chiusura o a un'assenza già
  presente.
- Un dipendente **assunto dopo** eredita automaticamente le chiusure future.
- Le chiusure non si smontano una persona alla volta: la singola assenza che le compone non
  è rimovibile, si rimuove la chiusura.

### Regole del salone

Scheda _Regole_. Sono le regole che l'area clienti applica da sola, senza che il personale
debba intervenire.

- **Limite di preavviso (ore)**: entro questo limite il cliente annulla o sposta da solo
  dall'app, e l'annullamento è **tempestivo**. Oltre il limite i pulsanti scompaiono dalla
  sua area: deve chiamare il salone e l'annullamento lo registra il personale, scegliendo
  tempestivo o tardivo. Valore iniziale 24 ore.
- **Spostamento di un appuntamento**: due possibilità.
  - _Libero entro il limite di preavviso_: il cliente sposta senza conseguenze.
  - _Trattato come un annullamento_: seguirà le regole della caparra, quando sarà attiva.
- **Anticipo del promemoria (ore)**: quanto tempo prima dell'appuntamento parte il
  promemoria. Serve ai messaggi automatici (e-mail ora, WhatsApp dalla fase 7).

Si salva con **Salva le regole**. Le modifiche valgono subito, anche per gli appuntamenti
già presi.

I due limiti della prenotazione online — almeno **2 ore** di preavviso e non oltre
**60 giorni** — sono fissi e non si modificano.

### Caparra

Scheda _Regole_, riquadro **Caparra**. Riguarda solo le prenotazioni che il cliente fa da sé
online: un appuntamento inserito dal personale non prevede caparra, perché al telefono il
cliente non può pagare.

- **Richiedi la caparra per le prenotazioni online**: la spunta che attiva tutto. Gli
  appuntamenti già fissati non cambiano.
- **Percentuale della caparra**: calcolata sul prezzo dei servizi scelti. Con il 50% su un
  taglio da 20,00 € il cliente paga 10,00 € alla prenotazione e 10,00 € in negozio.
- **Restituzione per un annullamento tempestivo**: rimborso sul metodo di pagamento oppure
  credito a favore del cliente.

Le altre regole non si impostano, perché le fissano i requisiti:

| Cosa accade                                  | Fine della caparra                  |
| -------------------------------------------- | ----------------------------------- |
| Annullamento tempestivo (entro il preavviso) | restituita nella forma scelta sopra |
| Annullamento tardivo (oltre il preavviso)    | trattenuta                          |
| Mancata presentazione                        | trattenuta                          |
| Annullamento deciso dal salone               | rimborsata per intero, sempre       |
| Appuntamento completato                      | scalata dal totale da pagare        |
| Pagamento non completato in tempo            | slot liberato, niente da restituire |

**Restituire una caparra trattenuta** (solo titolare): si apre l'appuntamento in agenda e si
preme **Restituisci la caparra**, scegliendo fra rimborso e credito e indicando il **motivo**,
che è obbligatorio. L'operazione resta nei movimenti con data e autore.

**Dove si vedono i movimenti**: nella scheda del cliente, riquadro **Caparre e credito**, con
il credito disponibile e tutti i movimenti (pagata, rimborsata, convertita in credito,
trattenuta, scalata, restituita). Sono dati economici: li vede solo il titolare.

### Messaggi WhatsApp

Scheda _Messaggi_. Conferme, promemoria e inviti ad attivare l'account possono arrivare al
cliente su WhatsApp invece che per e-mail.

Cosa serve, in ordine:

1. Un account **WhatsApp Business** presso Meta con un numero mittente dedicato.
2. I **modelli approvati** da Meta: WhatsApp non consente messaggi liberi, solo modelli
   approvati in anticipo. Ne servono quattro (conferma, promemoria, invito, codice di
   verifica) e i loro nomi vanno scritti in questa scheda.
3. L'**identificativo del numero mittente** (nella console di Meta è il «Phone number ID»):
   si incolla qui e non è un segreto.
4. Il **token di accesso**: è un segreto e **non** si imposta da questa pagina. Va messo nel
   file di configurazione del server, nella variabile `WHATSAPP_TOKEN`. Se manca, la scheda
   lo dice in cima e tutti i messaggi partono via e-mail.

Il pulsante **Invia la prova** manda il modello del codice di verifica a un numero che
indichi tu, per accertarti che la configurazione funzioni prima di contare sui messaggi.

Come viene scelto il canale, per ogni messaggio:

| Situazione                                              | Dove arriva il messaggio |
| ------------------------------------------------------- | ------------------------ |
| WhatsApp attivo, consenso del cliente e numero presente | WhatsApp                 |
| Consenso mancante o revocato                            | e-mail                   |
| Nessun numero, o WhatsApp non attivo                    | e-mail                   |
| Invio WhatsApp non riuscito                             | e-mail, subito           |
| Nessun recapito                                         | nessun messaggio         |

Il **consenso** lo dà il cliente registrandosi, oppure lo dichiara al telefono e il
dipendente lo registra creando la scheda. Il cliente può revocarlo quando vuole dalla propria
area: è un obbligo di legge, non una cortesia.

L'anticipo del **promemoria** si imposta nella scheda _Regole_. Il promemoria parte una volta
sola per appuntamento e non viene inviato per gli appuntamenti annullati.

### Prodotti e magazzino

Scheda _Prodotti_. Il catalogo e le giacenze li governa **solo il titolare**: il personale
vende, e vendendo scarica il magazzino, ma non modifica le quantità né i prezzi.

**Aggiungere un prodotto**: nome, prezzo, giacenza iniziale e scorta minima (zero disattiva
l'avviso). La descrizione è facoltativa.

**Correggere la giacenza**: pulsante **Giacenza** sul prodotto. Non esiste un campo da
riscrivere: si registra un movimento, indicando

- il **tipo**: _carico_ di merce ricevuta oppure _correzione_ dell'inventario;
- la **variazione** in pezzi, positiva o negativa;
- il **motivo**, obbligatorio.

Ogni movimento resta con data, autore e giacenza risultante, e gli ultimi cinque si vedono
nella stessa finestra. **La giacenza non può andare sotto zero**: un movimento che la
porterebbe in negativo viene rifiutato.

**Ritirare un prodotto**: pulsante **Ritira**. Esce dal listino del personale ma resta nelle
vendite già registrate; si rimette in vendita quando si vuole.

**Scorte**: i prodotti arrivati alla scorta minima sono segnalati in cima a questa scheda e
nella pagina delle vendite. L'avviso non blocca la vendita: finché ci sono pezzi, si vende.

### Richieste di cancellazione dei dati

Nella stessa scheda _Regole_, riquadro **Richieste di cancellazione dei dati**: l'elenco
delle richieste inviate dai clienti dalla propria area, con la data, il motivo (se indicato)
e il numero di appuntamenti ancora in agenda. Solo il titolare le vede e le evade.

- **Cancella i dati**: rimuove nome, cognome, contatti e note dalla scheda, disattiva
  l'account e chiude tutte le sue sessioni. Gli appuntamenti già svolti **restano** nei
  registri, senza riferimenti personali, come richiedono gli obblighi contabili.
  **L'operazione non è reversibile.**
- **Rifiuta**: chiude la richiesta senza toccare i dati.

Se il cliente ha **appuntamenti ancora in agenda** la cancellazione viene rifiutata: vanno
prima annullati o completati.

## Clienti

Dal pannello, pulsante **Clienti**: tutto il personale consulta e inserisce le schede.

- **Cercare**: per nome, cognome, numero WhatsApp o e-mail. L'elenco è paginato.
- **Creare una scheda** (pulsante _Nuova scheda_): bastano **nome, cognome e numero
  WhatsApp**; l'e-mail è facoltativa. Al salvataggio compare un **link di attivazione** da
  consegnare al cliente: sarà lui a scegliere la password.
- **Nessun duplicato**: se il numero è già collegato a una scheda, il sistema lo segnala con
  il nome del cliente esistente invece di creare un doppione.
- **Scheda del cliente**: contatti, stato dell'account, **note interne** modificabili e
  **storico degli appuntamenti** con servizi, operatore, importo e stato.
- **Nuovo link di attivazione**: disponibile finché il cliente non ha attivato l'account.

## Vendite in negozio

Dal pannello, pulsante **Vendite**. La usa tutto il personale.

1. **Prodotti**: per ogni prodotto si indicano i pezzi. Il campo non accetta più pezzi di
   quelli in magazzino, e un prodotto esaurito non è selezionabile.
2. **Cliente** (facoltativo): collegando la vendita a un cliente, questa compare nel suo
   storico, nella scheda cliente.
3. **Note** (facoltative): un promemoria interno, per esempio «pagato in contanti».
4. **Registra la vendita**: il totale è la somma dei prodotti scelti e il magazzino si scarica
   subito.

La vendita **non produce documenti** per il cliente: è una registrazione interna del salone.
Scontrini e fatture dipendono dalla gestione della cassa, non ancora disponibile.

**Vendita sbagliata**: si annulla dall'elenco delle ultime vendite, con il pulsante
**Annulla** e un motivo obbligatorio. I pezzi tornano in magazzino e la vendita resta
registrata come annullata: non si cancella, così i conti del magazzino restano ricostruibili.

**Se un prodotto finisce** mentre si registra la vendita (per esempio perché un collega l'ha
venduto nello stesso momento), la vendita viene rifiutata con un messaggio chiaro e **nulla**
viene scaricato: si corregge la quantità e si registra di nuovo.

## Agenda

Dal pannello, pulsante **Agenda**.

- **Viste**: _Giorno_, con una colonna per operatore, e _Settimana_.
- **Spostarsi nel tempo**: frecce avanti e indietro, pulsante **Oggi**. Il giorno mostrato è
  nell'indirizzo della pagina, quindi l'agenda di una data precisa si può salvare nei
  preferiti o condividere.
- **Filtro per operatore**: _Tutti_ oppure un singolo operatore.
- **Colori**: ogni stato ha il suo colore e la sua etichetta — confermato, in attesa di
  pagamento, completato, annullato, mancata presentazione.
- Ogni membro del personale vede e gestisce **tutte** le agende.

### Inserire un appuntamento

1. Pulsante **Nuovo appuntamento**, oppure un clic (o un tocco prolungato) sulla fascia
   libera dell'agenda: operatore e orario vengono già proposti.
2. **Cliente**: si cerca per nome, cognome o numero. Se non esiste, si crea prima la scheda
   dalla pagina Clienti.
3. **Operatore** e **servizi**: vengono mostrati solo i servizi che quell'operatore esegue.
   Si possono scegliere più servizi: la durata e il prezzo sono la somma dei servizi scelti e
   i servizi vengono erogati uno dopo l'altro, dallo stesso operatore.
4. **Giorno e orario**: il sistema propone **solo gli orari realmente liberi**, calcolati su
   orari di lavoro, assenze e appuntamenti esistenti.
5. **Note**: indicazioni interne sull'appuntamento.
6. **Salva appuntamento**.

Un appuntamento inserito dal personale **non prevede caparra** e nasce già confermato: la
caparra si paga online e riguarda solo le prenotazioni che il cliente fa da sé.

Regole dell'inserimento dal personale:

- nessun preavviso minimo: si può prenotare anche per fra dieci minuti;
- si può registrare un appuntamento già avvenuto fino a **7 giorni** nel passato, per
  regolarizzare l'agenda;
- in avanti il limite è **60 giorni**;
- non si può inserire un appuntamento fuori dagli orari di lavoro dell'operatore, a salone
  chiuso o durante un'assenza;
- se nel frattempo qualcun altro ha occupato lo stesso orario, il salvataggio viene
  rifiutato con l'invito a scegliere un altro orario: le doppie prenotazioni sono impedite
  anche quando due persone salvano nello stesso istante.

### Spostare un appuntamento

1. Si apre l'appuntamento in agenda e si preme **Sposta**.
2. Si scelgono il nuovo giorno e il nuovo orario fra quelli liberi (l'orario attuale
   dell'appuntamento resta disponibile).
3. **Conferma spostamento**.

I servizi non cambiano: per cambiarli si annulla l'appuntamento e se ne inserisce un altro.
Si spostano solo gli appuntamenti confermati o in attesa di pagamento. Lo spostamento fatto
dal personale non muove la caparra: resta sull'appuntamento spostato.

### Annullare un appuntamento

1. Si apre l'appuntamento e si preme **Annulla appuntamento**.
2. Si indica il **motivo**:
   - **Annullamento tempestivo**: il cliente ha avvisato entro il limite di preavviso;
   - **Annullamento tardivo**: ha avvisato dopo il limite;
   - **Annullato dal salone**: la decisione è del salone.
3. Si può aggiungere una nota e si registra.

Lo slot torna disponibile e l'annullamento resta registrato con autore e momento. Il motivo
decide la fine della caparra: restituita se tempestivo, trattenuta se tardivo, sempre
rimborsata se la decisione è del salone. Vedi [Caparra](#caparra).

### Mancata presentazione

Se il cliente non si presenta, si apre l'appuntamento e si preme **Mancata presentazione**.
Lo slot resta occupato, perché quel tempo è stato comunque impegnato, e l'eventuale caparra
viene trattenuta.

### Completare un appuntamento

A servizio concluso si apre l'appuntamento e si preme **Segna completato**: l'eventuale
caparra viene scalata dal totale, e il dettaglio indica quanto resta da saldare. Non ci sono
automatismi: un appuntamento diventa completato solo quando lo segna il personale.
Da completato, annullato o mancata presentazione non si torna indietro.

## Area del cliente

Questa parte è scritta per il **cliente**: è ciò che vede chi apre l'indirizzo del salone
dal proprio telefono. Al personale serve per spiegarlo al telefono o in negozio.

Dopo l'accesso il cliente arriva nella propria area, con tre sezioni: **I miei
appuntamenti**, **Prenota**, **Profilo e dati**. Il pannello e l'agenda del personale non
gli sono raggiungibili.

### Creare l'account

Servono un account e un indirizzo e-mail confermato: senza, non si prenota.

1. Dalla pagina di accesso, **Crea il tuo account**.
2. Si indicano nome, cognome, e-mail, numero WhatsApp e una password.
3. **Consensi**: il trattamento dei dati è obbligatorio, quello ai messaggi WhatsApp è
   facoltativo e si può cambiare dopo.
4. Arriva un'e-mail con un link di **conferma dell'indirizzo**, valido 48 ore. Finché non si
   conferma, l'accesso non funziona. Dalla pagina di verifica si può chiedere un nuovo invio.
5. Il **numero di telefono** si verifica dopo, quando si vuole, dalla propria area: vedi
   [Verificare il numero di telefono](#verificare-il-numero-di-telefono).

Casi particolari:

- **Il salone ha già una scheda con quel numero** (es. cliente che prenotava per telefono):
  la registrazione **riprende quella scheda**, con tutto lo storico. Non nasce un doppione.
- **Quel numero o quell'indirizzo hanno già un account attivo**: la registrazione si ferma e
  invita ad accedere o a reimpostare la password.
- **Invito ricevuto dal salone**: il link di attivazione porta alla pagina _Attiva il tuo
  account_, dove si sceglie la password. Se il salone non aveva registrato l'e-mail, la si
  indica lì: servirà per accedere e per recuperare la password. Il salone non conosce mai la
  password.

### Password dimenticata

Dalla pagina di accesso, **Password dimenticata?**: si indica l'indirizzo e arriva un link
valido **2 ore**. Reimpostando la password tutte le sessioni aperte vengono chiuse. Per
sicurezza la pagina risponde allo stesso modo anche se quell'indirizzo non esiste.

### Prenotare online

Sezione **Prenota**, in tre passi.

1. **Scegli i servizi**: uno o più. La durata e il prezzo totali sono la somma dei servizi
   scelti.
2. **Scegli con chi**: compaiono solo gli operatori abilitati a **tutti** i servizi scelti.
   L'operatore si indica sempre: non esiste l'opzione «operatore indifferente».
3. **Scegli quando**: giorno e orario fra quelli liberi, calcolati sugli orari
   dell'operatore e sugli appuntamenti già presenti.

Limiti della prenotazione online: almeno **2 ore** di preavviso e non oltre **60 giorni**.
Un orario che risultasse occupato nel frattempo viene rifiutato con un messaggio chiaro: si
sceglie un altro slot.

### Spostare o annullare dall'app

Nella sezione **I miei appuntamenti**, sotto ogni appuntamento futuro:

- **Sposta**: si sceglie il nuovo orario fra quelli liberi, con gli stessi servizi e lo
  stesso operatore.
- **Annulla**: libera subito lo slot. Un annullamento fatto dall'app è sempre
  **tempestivo**, quindi la caparra viene restituita nella forma scelta dal salone.

Se il titolare ha scelto che lo spostamento sia **trattato come un annullamento** e c'è una
caparra pagata, spostare equivale ad annullare e riprenotare: la caparra viene restituita e il
nuovo orario richiede una nuova caparra (che il credito appena restituito può coprire). Con la
regola dello spostamento libero la caparra resta sull'appuntamento spostato.

I due pulsanti compaiono solo **entro il limite di preavviso** deciso dal salone (24 ore
all'inizio). Passato il limite al loro posto si legge che il termine è scaduto: per
modificare o annullare si chiama il salone, e il personale registra l'operazione.

Lo **Storico** in fondo elenca gli appuntamenti passati, con servizi, operatore, importo e
stato.

### Pagare la caparra

Compare solo se il salone richiede la caparra.

1. Al passo **Scegli quando** appare il riquadro **Caparra** con l'importo: quanto si paga
   adesso e quanto resta da saldare in negozio.
2. Premendo **Prenota e paga la caparra** si viene portati sulla pagina di pagamento. Lo slot
   resta tenuto per i minuti indicati: se il pagamento non arriva, torna libero e si deve
   prenotare di nuovo.
3. L'appuntamento è **confermato solo a pagamento avvenuto**. Finché si attende, nella
   sezione _I miei appuntamenti_ si legge «In attesa di pagamento» con l'ora entro cui pagare
   e un pulsante **Paga** per riprendere il pagamento (per esempio se si è chiusa la pagina).
4. A servizio concluso la caparra viene scalata dal conto: in negozio si paga la differenza.

**Se si ha del credito** (per esempio da un annullamento restituito in credito) viene usato
subito: copre la caparra in tutto o in parte, e si paga solo la differenza. Il credito non ha
scadenza e si vede nella sezione _Profilo e dati_. Se la differenza non viene pagata e lo slot
si libera, il credito usato torna indietro.

### Verificare il numero di telefono

Nella sezione **Profilo e dati**, sotto il numero: **Invia il codice**. Arriva un codice di
sei cifre su WhatsApp — o per e-mail, se il salone non ha ancora attivato i messaggi — valido
pochi minuti. Inserendolo, il numero risulta verificato.

Non è obbligatorio per prenotare: serve al salone per essere sicuro di poterti raggiungere.
Un numero già verificato su un altro account viene rifiutato: in quel caso va contattato il
salone.

### Profilo, consensi e dati personali

Sezione **Profilo e dati**.

- **Credito**: se il salone ha restituito una caparra in credito, l'importo è indicato qui e
  viene usato alla prossima prenotazione. Non scade.
- **I tuoi dati**: e-mail e numero WhatsApp si possono correggere. Un numero già collegato a
  un altro account viene rifiutato.
- **Consensi**: il consenso ai messaggi WhatsApp si concede e si revoca quando si vuole.
- **I tuoi diritti**:
  - **Scarica i miei dati**: una copia dei propri dati, appuntamenti compresi.
  - **Chiedi la cancellazione**: si può aggiungere un motivo. La richiesta la valuta il
    salone. I dati personali verranno rimossi e l'account disattivato, mentre gli
    appuntamenti già svolti restano in forma anonima per gli obblighi contabili. Gli
    appuntamenti futuri vanno annullati prima. Lo stato della richiesta resta visibile in
    questa sezione.

## Aspetto e accessibilità

- **Tema scuro** predefinito, tema chiaro disponibile dal pannello. La scelta resta
  memorizzata sul dispositivo.
- Il colore di accento dipende dal profilo: rosso "lama" per il barbiere, lavanda per il
  parrucchiere.
- L'interfaccia si usa da computer, tablet e smartphone, anche solo col tocco.
- Le animazioni sono brevi e si disattivano se il dispositivo chiede di ridurre il
  movimento. I messaggi di errore e conferma non si affidano al solo colore.

## Domande frequenti

**Un dipendente può modificare l'agenda di un collega?**
Sì: chi è in negozio o al telefono gestisce qualsiasi agenda. Le impostazioni del salone e i
dati economici restano riservati al titolare.

**Perché non riesco a inserire un appuntamento alle 14:00?**
Perché in quella fascia l'operatore non lavora (pausa, giorno di riposo, assenza, chiusura
del salone o giorno di chiusura). Il messaggio indica gli orari di lavoro di quel giorno.

**Come chiudo il salone per una festività?**
Dalle impostazioni, scheda _Orari_, riquadro **Chiusure del salone**: un'unica registrazione
rende occupati tutti gli operatori. Vedi [Chiusure del salone](#chiusure-del-salone).

**Perché un orario non appare fra quelli disponibili?**
Non c'è spazio sufficiente per la durata totale dei servizi scelti, oppure l'orario è
occupato, cade fuori dagli orari di lavoro o oltre i limiti di data.

**Ho cambiato il prezzo di un servizio: cosa accade agli appuntamenti già presi?**
Nulla. Conservano prezzo e durata del momento della prenotazione, così lo storico resta
fedele.

**Ho sbagliato a creare una scheda cliente: posso cancellarla?**
La scheda si corregge, non si cancella: lo storico degli appuntamenti deve restare. Su
richiesta del cliente il titolare può invece rimuoverne i dati personali, dalla scheda
_Regole_ delle impostazioni. Vedi
[Richieste di cancellazione dei dati](#richieste-di-cancellazione-dei-dati).

**Il cliente non ha ricevuto il link di attivazione.**
Se ha dato il consenso l'invito è andato su WhatsApp; altrimenti all'indirizzo e-mail, dove
conviene controllare la posta indesiderata. Se non ha né consenso né e-mail, il link resta a
schermo al momento della creazione e si può dettare. Dalla sua scheda si genera comunque un
nuovo link; il precedente smette di funzionare.

**Perché un cliente riceve le e-mail invece dei messaggi WhatsApp?**
Perché manca una delle tre condizioni: i messaggi WhatsApp attivi nelle impostazioni, il
consenso del cliente, un numero nella sua scheda. Vedi
[Messaggi WhatsApp](#messaggi-whatsapp).

**Il cliente ha pagato ma l'appuntamento risulta ancora in attesa.**
La conferma arriva dal fornitore di pagamenti, non dal browser del cliente: di solito è
questione di secondi. Basta ricaricare la pagina. Se dopo qualche minuto risulta ancora in
attesa, lo slot viene liberato e l'eventuale importo incassato appare fra i movimenti della
caparra, da restituire.

**Un cliente dice di non poter annullare dall'app.**
È passato il limite di preavviso: oltre quel termine i pulsanti scompaiono. L'annullamento lo
registra il personale dall'agenda, indicando se l'avviso è tempestivo o tardivo.

**Perché un cliente non riesce ad accedere subito dopo la registrazione?**
Perché non ha ancora confermato l'indirizzo e-mail. Il link di conferma vale 48 ore e si può
farsi rinviare dalla pagina di verifica.

## Non ancora disponibile

Queste funzioni sono previste dalle fasi successive dello sviluppo:

- **Vendita online dei prodotti** (fase 9): acquisto dalla web app, ritiro in negozio o
  spedizione.
- **Gestione della cassa e pagamenti in negozio** (registratore telematico, POS): da valutare,
  non ancora specificata.
- **Statistiche e KPI** (fase 10), riservati al titolare.
