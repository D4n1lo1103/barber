# Manuale d'uso

Guida all'uso del gestionale per il **titolare** e per i **dipendenti** del salone.
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
- [Clienti](#clienti)
- [Agenda](#agenda)
  - [Inserire un appuntamento](#inserire-un-appuntamento)
  - [Spostare un appuntamento](#spostare-un-appuntamento)
  - [Annullare un appuntamento](#annullare-un-appuntamento)
  - [Mancata presentazione](#mancata-presentazione)
  - [Completare un appuntamento](#completare-un-appuntamento)
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

Dal pannello iniziale, pulsante **Impostazioni del salone**. Tre schede: Servizi, Personale,
Orari. I dipendenti non vedono questa pagina.

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
- **Orari di lavoro**: per ciascun operatore, dentro le fasce di apertura. Il sistema
  rifiuta un orario di lavoro quando il salone è chiuso.
- **Restringere gli orari di apertura** è rifiutato se lascerebbe un operatore al lavoro
  fuori orario: prima si aggiornano gli orari di lavoro.
- **Assenze**: ferie, giorno di riposo o altra indisponibilità, indicando inizio e fine.
  Durante un'assenza l'operatore non è prenotabile.
- Orari e assenze non possono lasciare fuori appuntamenti già in agenda: in quel caso il
  salvataggio viene rifiutato e indica l'appuntamento da spostare o annullare.

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
Perché in quella fascia l'operatore non lavora (pausa, giorno di riposo, assenza o salone
chiuso). Il messaggio indica gli orari di lavoro di quel giorno.

**Perché un orario non appare fra quelli disponibili?**
Non c'è spazio sufficiente per la durata totale dei servizi scelti, oppure l'orario è
occupato, cade fuori dagli orari di lavoro o oltre i limiti di data.

**Ho cambiato il prezzo di un servizio: cosa accade agli appuntamenti già presi?**
Nulla. Conservano prezzo e durata del momento della prenotazione, così lo storico resta
fedele.

**Ho sbagliato a creare una scheda cliente: posso cancellarla?**
Al momento la scheda si corregge, non si cancella: lo storico degli appuntamenti deve
restare. La cancellazione su richiesta del cliente (GDPR) arriva con l'area clienti.

**Il cliente non ha ricevuto il link di attivazione.**
Dalla sua scheda si genera un nuovo link; il precedente smette di funzionare. Dalla fase 7
l'invito viene inviato automaticamente via WhatsApp o e-mail.

## Non ancora disponibile

Queste funzioni sono previste dalle fasi successive dello sviluppo:

- **Area cliente** (fase 4): registrazione con consensi GDPR, prenotazione online con
  preavviso minimo di 2 ore, spostamento e annullamento dall'app, consultazione e
  cancellazione dei propri dati.
- **E-mail automatiche** (fase 5): verifica dell'account, reset della password, inviti,
  conferme di prenotazione.
- **Caparra e pagamenti** (fase 6): pagamento online alla prenotazione, blocco temporaneo
  dello slot, rimborsi, credito, restituzione discrezionale da parte del titolare.
- **WhatsApp** (fase 7): conferme, promemoria e inviti, con ripiego sull'e-mail.
- **Prodotti e magazzino** (fase 8) e **vendita online** (fase 9).
- **Statistiche e KPI** (fase 10), riservati al titolare.
