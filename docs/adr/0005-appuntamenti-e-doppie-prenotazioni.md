# ADR 0005 — Modello degli appuntamenti e difesa dalle doppie prenotazioni

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fase**: 3 — Agenda lato personale

## Contesto

Un appuntamento è una prenotazione di uno o più servizi con un solo operatore, in una data e
un orario. La durata è la somma delle durate dei servizi scelti. Il requisito tecnico chiede
di impedire le sovrapposizioni per lo stesso operatore con un **vincolo di esclusione
PostgreSQL**, oltre al controllo applicativo, e di salvare tutto in UTC mostrando in
`Europe/Rome`.

Restavano aperte alcune scelte, concordate con il titolare il 18/10/2026:

- il personale **non** può inserire appuntamenti fuori dagli orari di lavoro dell'operatore,
  a salone chiuso o durante un'assenza;
- ogni membro del personale gestisce **tutte** le agende, non solo la propria;
- il personale può registrare un appuntamento fino a **7 giorni** nel passato, per
  regolarizzare l'agenda; in avanti resta il limite di **60 giorni**;
- il passaggio a `completato` è **manuale**.

## Decisione

1. **Due tabelle.** `appuntamenti` contiene cliente, operatore, `inizio` e `fine` in UTC,
   durata, prezzo totale, stato, motivo dell'annullamento, flag `senzaCaparra`, note e
   tracciamento (chi ha creato, chi ha annullato, quando è stato completato).
   `appuntamenti_servizi` contiene una riga per servizio.
2. **Copia dei dati del servizio.** Nome, prezzo e durata vengono copiati al momento della
   prenotazione. Un cambio di listino non altera gli appuntamenti già fissati né lo storico
   del cliente; se un servizio viene eliminato dal catalogo, `servizioId` diventa nullo ma la
   riga resta.
3. **Vincolo di esclusione sugli stati che occupano lo slot.**

   ```sql
   EXCLUDE USING gist ("operatoreId" WITH =, tsrange("inizio", "fine", '[)') WITH &&)
     WHERE ("stato" <> 'annullato')
   ```

   L'intervallo è chiuso a sinistra e aperto a destra: un appuntamento può iniziare
   nell'istante in cui finisce il precedente. Gli appuntamenti annullati liberano lo slot;
   la mancata presentazione no, perché quel tempo è stato comunque occupato.

4. **Controllo applicativo prima del database.** Il servizio verifica orari di lavoro,
   assenze, allineamento alla granularità e sovrapposizioni, così l'utente riceve un
   messaggio chiaro. Su richieste simultanee il database rifiuta la seconda scrittura: la
   violazione del vincolo (`23P01`) e il conflitto di scrittura (`P2034`), che su questa
   tabella ha la stessa unica causa, vengono tradotti in un `409` con invito a scegliere un
   altro orario. Un test di integrazione lancia due prenotazioni contemporanee sullo stesso
   slot e verifica che ne passi una sola.
5. **Coerenza dello stato nel database.** Un vincolo `CHECK` impone che il motivo
   dell'annullamento esista se e solo se lo stato è `annullato`. Le transizioni ammesse sono
   dichiarate una sola volta in `packages/shared` e usate dal backend.
6. **Conversioni di fuso in un unico punto.** `dominio/fuso.ts` converte fra istanti UTC e
   ora locale del salone; `dominio/disponibilita.ts` calcola gli slot liberi partendo dalle
   fasce in minuti locali. Entrambi hanno test sui giorni di cambio dell'ora legale.
   Nel frontend `utilita/fuso-vista.ts` trasforma gli istanti in "date di vista", la cui ora
   locale del dispositivo coincide con quella di Roma: l'agenda mostra gli orari del salone
   anche da un computer con fuso diverso.
7. **Tutela degli appuntamenti già fissati.** Poiché un appuntamento non può stare fuori
   dagli orari di lavoro, la modifica degli orari di un operatore e la registrazione di
   un'assenza vengono rifiutate se lascerebbero fuori appuntamenti ancora in agenda.

## Conseguenze

- La fase 6 aggiungerà i movimenti della caparra senza toccare questo modello: lo stato
  `in_attesa_pagamento` e il flag `senzaCaparra` esistono già, e la creazione passerà da
  `confermato` a `in_attesa_pagamento` quando la caparra sarà attiva.
- Le modifiche al listino sono sicure, ma i prezzi storici vanno letti dalle righe copiate:
  i futuri KPI (fase 10) useranno `appuntamenti_servizi`, non il catalogo.
- Il vincolo di esclusione richiede `btree_gist`, già abilitata dalla migrazione della fase 2.
- Spostare un appuntamento ne cambia operatore e orario ma non i servizi: per cambiare i
  servizi si annulla e si reinserisce. È una semplificazione accettata, da rivedere se il
  salone la trova scomoda.
