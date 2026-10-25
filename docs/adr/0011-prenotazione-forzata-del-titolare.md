# ADR 0011 — Prenotazione forzata del titolare

- **Stato**: accettata
- **Data**: 2026-10-25
- **Fase**: trasversale (modifica alla fase 3)

## Contesto

L'[ADR 0005](0005-appuntamenti-e-doppie-prenotazioni.md) stabilisce che il personale **non**
può inserire appuntamenti fuori dagli orari di lavoro dell'operatore, a salone chiuso o
durante un'assenza, e che le sovrapposizioni sono impedite da un vincolo di esclusione
PostgreSQL.

All'uso reale questa rigidità si è rivelata eccessiva per il titolare, che risponde al
telefono anche nei giorni di chiusura e prende appuntamenti di persona fuori dall'orario di
apertura. Il titolare ha chiesto (25/10/2026) di poter fissare un appuntamento «quando
vuole». Il caso che ha fatto emergere il problema: di domenica il modale non proponeva
alcun orario e il salvataggio veniva rifiutato.

La richiesta tocca un requisito tecnico esplicito del capitolato — il vincolo di esclusione
come difesa dalle doppie prenotazioni — quindi la deroga è stata concordata punto per punto
prima di implementarla.

## Decisione

1. **Solo il titolare** può derogare, anche sull'agenda dei colleghi. Il dipendente resta
   vincolato come prima; la richiesta di un dipendente viene respinta dal backend con
   `403`. Il cliente che prenota dall'area clienti non ha mai questa facoltà.
2. **Colonna `forzato`** sugli appuntamenti: traccia in modo permanente quali appuntamenti
   sono stati inseriti in deroga, e serve sia all'interfaccia sia al vincolo del database.
3. **Vincoli derogati**: orari di lavoro dell'operatore, giorni di chiusura del salone,
   ferie e assenze, allineamento alla granularità degli slot e sovrapposizione con un altro
   appuntamento dello stesso operatore.
4. **Vincoli mantenuti**, perché proteggono da errori e non da rigidità organizzative: i
   limiti di data (7 giorni nel passato, 60 in avanti), la scheda cliente disattivata,
   l'abilitazione dell'operatore ai servizi scelti e l'operatore non più in servizio.
5. **Il vincolo di esclusione viene ricostruito** aggiungendo `AND NOT "forzato"` alla sua
   condizione. Le righe forzate escono dal vincolo in entrambe le direzioni: non lo
   violano e non lo fanno violare agli altri.
6. **Interfaccia**: interruttore «Fuori orario» nel modale di inserimento, visibile al solo
   titolare. Acceso, sostituisce la griglia degli slot liberi con due campi liberi, giorno
   e ora, e mostra un avviso. Il dettaglio di un appuntamento forzato riporta lo stesso
   avviso.
7. **Tracciamento**: ogni inserimento in deroga viene registrato nei log del server con
   l'identificativo dell'autore.

## Conseguenze

- Il titolare può fissare un appuntamento in qualunque momento, senza passare dal database.
- **Si perde la protezione del database contro gli inserimenti simultanei** sulle sole
  righe forzate: due inserimenti forzati contemporanei sullo stesso slot vanno entrambi a
  buon fine. Il rischio è accettato perché a forzare è una sola persona, il titolare, e
  perché il risultato è comunque visibile e correggibile in agenda. Per tutte le altre
  prenotazioni — personale e clienti — la difesa resta invariata.
- Un appuntamento forzato **occupa lo slot** per il calcolo della disponibilità: non viene
  proposto ai clienti che prenotano online né al personale che prenota normalmente. La
  deroga vale solo per chi la chiede esplicitamente.
- L'agenda può mostrare appuntamenti sovrapposti sulla stessa colonna e appuntamenti fuori
  dalla fascia oraria disegnata. È una conseguenza voluta: nasconderli sarebbe peggio.
- Resta fuori da questa decisione lo **spostamento** di un appuntamento, che continua a
  seguire i vincoli ordinari anche per il titolare. Se servirà, andrà deciso a parte.
