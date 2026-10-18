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
  - [Richieste di cancellazione dei dati](#richieste-di-cancellazione-dei-dati)
- [Clienti](#clienti)
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
| Caparra               | Anticipo pagato online alla prenotazione (dalla fase 6).                   |
| Limite di preavviso   | Ore entro cui un annullamento è considerato tempestivo.                    |
| Mancata presentazione | Il cliente non si è presentato.                                            |

## Primo avvio dell'installazione

Alla prima apertura dell'indirizzo del salone compare la **procedura guidata**, in cinque
passi. Serve la **chiave di installazione** consegnata da chi ha predisposto il server.

1. **Profilo**: barbiere o parrucchiere. Determina il catalogo iniziale, le durate tipiche e
   il colore dell'interfaccia.
2. **Dati del salone**: nome, indirizzo, città, telefono, e-mail.
3. **Agenda**: granularità degli slot e tempo di blocco dello slot durante il pagamento
   della caparra; attivazione della vendita online dei prodotti.
4. **Catalogo iniziale**: i servizi proposti per il profilo, modificabili subito o più tardi.
5. **Account del titolare** e chiave di installazione.

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

Dal pannello iniziale, pulsante **Impostazioni del salone**. Quattro schede: Servizi,
Personale, Orari e Regole. I dipendenti non vedono questa pagina.

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
5. **Senza caparra**: casella disponibile solo al personale, mai al cliente.
6. **Note**: indicazioni interne sull'appuntamento.
7. **Salva appuntamento**.

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
Si spostano solo gli appuntamenti confermati o in attesa di pagamento.

### Annullare un appuntamento

1. Si apre l'appuntamento e si preme **Annulla appuntamento**.
2. Si indica il **motivo**:
   - **Annullamento tempestivo**: il cliente ha avvisato entro il limite di preavviso;
   - **Annullamento tardivo**: ha avvisato dopo il limite;
   - **Annullato dal salone**: la decisione è del salone.
3. Si può aggiungere una nota e si registra.

Lo slot torna disponibile. Il motivo determinerà il trattamento della caparra quando i
pagamenti saranno attivi (fase 6). L'annullamento resta registrato con autore e momento.

### Mancata presentazione

Se il cliente non si presenta, si apre l'appuntamento e si preme **Mancata presentazione**.
Lo slot resta occupato, perché quel tempo è stato comunque impegnato.

### Completare un appuntamento

A servizio concluso si apre l'appuntamento e si preme **Segna completato**. Non ci sono
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
  **tempestivo**.

I due pulsanti compaiono solo **entro il limite di preavviso** deciso dal salone (24 ore
all'inizio). Passato il limite al loro posto si legge che il termine è scaduto: per
modificare o annullare si chiama il salone, e il personale registra l'operazione.

Lo **Storico** in fondo elenca gli appuntamenti passati, con servizi, operatore, importo e
stato.

### Profilo, consensi e dati personali

Sezione **Profilo e dati**.

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
Se la scheda ha un'e-mail, l'invito è stato inviato lì: conviene controllare la posta
indesiderata. Dalla sua scheda si genera comunque un nuovo link, che si può anche dettare al
telefono; il precedente smette di funzionare. Dalla fase 7 l'invito arriverà anche via
WhatsApp.

**Un cliente dice di non poter annullare dall'app.**
È passato il limite di preavviso: oltre quel termine i pulsanti scompaiono. L'annullamento lo
registra il personale dall'agenda, indicando se l'avviso è tempestivo o tardivo.

**Perché un cliente non riesce ad accedere subito dopo la registrazione?**
Perché non ha ancora confermato l'indirizzo e-mail. Il link di conferma vale 48 ore e si può
farsi rinviare dalla pagina di verifica.

## Non ancora disponibile

Queste funzioni sono previste dalle fasi successive dello sviluppo:

- **Verifica del numero di telefono** (fase 7): oggi l'account si conferma con la sola
  e-mail; la verifica del numero arriverà con i messaggi WhatsApp.
- **Caparra e pagamenti** (fase 6): pagamento online alla prenotazione, blocco temporaneo
  dello slot, rimborsi, credito, restituzione discrezionale da parte del titolare.
- **WhatsApp** (fase 7): conferme, promemoria e inviti, con ripiego sull'e-mail.
- **Prodotti e magazzino** (fase 8) e **vendita online** (fase 9).
- **Statistiche e KPI** (fase 10), riservati al titolare.
