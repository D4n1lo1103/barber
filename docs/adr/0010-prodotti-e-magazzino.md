# ADR 0010 — Prodotti, magazzino e vendite in negozio

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fase**: 8 — Prodotti e magazzino

## Contesto

Il salone vende prodotti al banco. Servono un catalogo, una giacenza che resti attendibile e
una registrazione delle vendite da cui, in futuro, nasceranno i KPI. Il titolare ha deciso
tre cose: la giacenza non può andare sotto zero, le correzioni manuali sono solo sue, e la
vendita **non** produce documenti per il cliente.

## Decisione

1. **La giacenza non va sotto zero, e lo garantiscono tre livelli.** Il controllo applicativo
   dà un messaggio utile («di «Cera» ci sono 2 pezzi, ne servono 3»); l'aggiornamento è
   **condizionato** (`WHERE giacenza >= quantita`), quindi due vendite simultanee non possono
   scendere sotto zero; un `CHECK` del database è l'ultima difesa. Un test di integrazione
   lancia due vendite nello stesso istante sull'ultimo pezzo e verifica che una sola riesca.
2. **La giacenza non si scrive, si muove.** Non esiste un campo «giacenza» modificabile
   nell'interfaccia: ogni variazione passa da un movimento con data, quantità, autore, motivo
   e giacenza risultante, e i movimenti non si modificano né si cancellano. Anche la giacenza
   iniziale di un prodotto nuovo è un carico: il magazzino non ha righe che nascono dal nulla.
   Un vincolo del database rifiuta una correzione senza motivo o senza autore.
3. **Catalogo e giacenze solo al titolare, vendite a tutto il personale.** Il dipendente
   vende — e vendendo scarica il magazzino — ma non corregge le quantità né cambia i prezzi.
   È la decisione del titolare, e segue la stessa linea dei dati economici della fase 6.
4. **Vendita e scarico nella stessa transazione.** Non esiste una vendita senza movimenti, né
   un movimento di vendita senza vendita; se un prodotto non ha abbastanza pezzi, l'intera
   vendita viene rifiutata e nulla viene scaricato. Nome e prezzo sono copiati nelle righe,
   come già per i servizi negli appuntamenti: un cambio di listino non riscrive il passato.
5. **La vendita non produce documenti.** Resta una registrazione interna. Scontrini, fatture
   e registratore telematico dipendono dalla gestione della cassa, ancora da definire: il
   codice non fa nulla in merito, ma le vendite sono già la base su cui innestarla.
6. **L'errore si corregge annullando, non cancellando.** Una vendita sbagliata si annulla con
   un motivo obbligatorio: la riga resta, la giacenza torna come prima e il ripristino lascia
   il suo movimento. Così il magazzino si può ricostruire movimento per movimento.
7. **La scorta minima è un avviso, non un blocco.** Un prodotto sotto soglia si vende ancora
   (finché ci sono pezzi); la soglia a zero disattiva l'avviso. L'avviso lo vede tutto il
   personale, nella pagina delle vendite e nella scheda Prodotti.

## Conseguenze

- Il magazzino è ricostruibile dai movimenti, quindi una giacenza sbagliata si può spiegare:
  è la stessa scelta fatta per i movimenti della caparra nella fase 6.
- Due vendite dello stesso prodotto nello stesso istante possono far fallire la seconda con un
  conflitto: è il comportamento voluto, e il messaggio dice al personale di ricontrollare.
- Il modello non copre fornitori, ordini di acquisto, lotti o scadenze: non sono richiesti.
  Se serviranno, i movimenti di carico sono il punto da cui partire.
- La vendita online della fase 9 userà lo stesso catalogo e gli stessi movimenti, aggiungendo
  gli stati dell'ordine: la giacenza non avrà bisogno di un secondo meccanismo.
