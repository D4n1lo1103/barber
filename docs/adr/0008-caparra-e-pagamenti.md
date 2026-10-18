# ADR 0008 — Caparra e pagamenti

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fase**: 6 — Caparra e pagamenti Stripe

## Contesto

La caparra è denaro reale di persone reali: va incassata, restituita, trattenuta e sempre
rendicontata. I requisiti fissano le regole di trattamento ma lasciavano aperte quattro
domande, risolte con il titolare.

## Decisione

1. **La caparra si governa dalle impostazioni.** Il salone decide se applicarla, con quale
   percentuale e in che forma restituirla (rimborso o credito) dalla scheda _Regole_. Una
   migrazione fissa i limiti nel database (percentuale fra 1 e 100, caparra non superiore al
   prezzo). Un'installazione nuova parte con la caparra **disattivata** e la restituzione per
   **rimborso**. L'importo viene copiato sull'appuntamento alla prenotazione: cambiare la
   percentuale non altera gli appuntamenti già fissati.
2. **La caparra riguarda solo le prenotazioni online del cliente.** Si paga online al momento
   della prenotazione, e al telefono il cliente non può farlo: un appuntamento inserito dal
   personale nasce confermato e senza caparra, anche con la caparra attiva. Il flag «senza
   caparra» non è più una spunta nel pannello, perché non avrebbe effetto; resta la colonna,
   vera su ogni appuntamento inserito dal personale.
3. **Stripe Checkout ospitato, dietro un'interfaccia.** `FornitorePagamenti` ha due
   realizzazioni: Stripe e un fornitore finto, usato quando mancano le chiavi (sviluppo e
   test) e mai costruito in produzione, dove la loro assenza interrompe l'avvio. Checkout
   ospitato invece dell'SDK nel browser per tre motivi: nessun dato di carta tocca il nostro
   codice, nessuna libreria di Stripe nel frontend, e 3-D Secure gestito dal fornitore.
   Il fornitore finto apre una pagina locale dove si sceglie l'esito, che percorre poi la
   stessa strada di un evento vero.
4. **Lo stato del pagamento è definitivo solo dopo l'evento firmato.** Il ritorno del browser
   non conferma nulla. Ogni evento viene verificato per firma e registrato per
   identificativo in `eventi_pagamento` **prima** di essere elaborato: un secondo invio, che
   i fornitori fanno di routine, non produce doppi movimenti. Un importo diverso da quello
   atteso non conferma l'appuntamento.
5. **Registro dei movimenti come unica verità.** `movimenti_caparra` e `movimenti_credito`
   non si modificano né si cancellano: sono il registro di audit, con data, importo, autore e
   motivo. Caparra pagata, trattenuta e saldo del credito si **calcolano dai movimenti**, così
   non esiste un totale da tenere allineato. Un vincolo del database rifiuta una restituzione
   discrezionale senza motivo e senza autore.
6. **Il credito copre quello che può.** Il credito viene scalato dalla caparra e il resto si
   paga con carta, così non resta credito fermo. Se la differenza scendesse sotto il minimo
   accettato dal fornitore (50 centesimi) si usa un po' meno credito e si lascia da pagare
   esattamente quel minimo. Il credito speso vale come caparra pagata: se la differenza non
   viene pagata, la scadenza del blocco lo restituisce.
7. **Lo spostamento «trattato come un annullamento» annulla e riprenota.** Con quella regola
   e una caparra pagata, lo spostamento del cliente annulla l'appuntamento (tempestivo, con
   la caparra restituita secondo le regole) e ne crea uno nuovo sull'orario scelto, con la
   propria caparra. Con la regola dello spostamento libero l'appuntamento si sposta e la
   caparra resta dov'è. È la lettura letterale del requisito e tiene le due regole distinte.
8. **La scadenza del blocco non dipende dalla coda.** Un'attività pg-boss differita libera lo
   slot all'istante giusto, ma i blocchi scaduti vengono chiusi anche prima di calcolare la
   disponibilità e prima di occupare uno slot. Così un passaggio mancato della coda non lascia
   uno slot occupato per sempre: il vincolo di esclusione del database non può escludere gli
   appuntamenti in attesa, perché `now()` non è utilizzabile in un indice.

## Conseguenze

- Il frontend non contiene nulla di Stripe: cambiare fornitore significa scrivere una nuova
  realizzazione dell'interfaccia.
- Lo sviluppo e i test non hanno bisogno di chiavi: 19 test di integrazione coprono conferma,
  idempotenza, firma non valida, scadenza, rimborso, credito e restituzione discrezionale. Il
  test end-to-end della caparra gira in un progetto a sé, dopo gli altri, perché attivare la
  caparra cambia il comportamento di tutte le prenotazioni.
- Un pagamento riuscito su uno slot già liberato resta possibile (il cliente paga all'ultimo
  istante): viene registrato nei log come anomalia e la caparra risulta pagata su un
  appuntamento annullato, così il titolare la vede fra i movimenti e può restituirla.
- La contabilità vera non è in ambito: il registro dei movimenti è la base su cui costruire i
  KPI della fase 10 e, se arriverà, la gestione della cassa.
