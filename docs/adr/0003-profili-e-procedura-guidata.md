# ADR 0003 — Profili di attività e procedura guidata al primo avvio

- **Stato**: accettata
- **Data**: 2026-10-16
- **Fase**: 1 — Configurazione salone

## Contesto

La stessa codebase serve barbieri e parrucchieri e viene installata una volta per salone.
Le differenze fra i due profili (catalogo iniziale, durate, granularità degli slot,
terminologia, accento) non devono diventare condizioni sparse nel codice. Inoltre la prima
apertura dell'applicazione avviene su un database vuoto: serve un modo per creare
l'installazione e il primo account.

## Decisione

1. **Configurazione del profilo come dato.** `packages/shared/src/dominio/configurazione-profilo.ts`
   contiene, per ciascun profilo, etichette, granularità e blocco slot predefiniti, accento e
   catalogo iniziale. Backend e frontend leggono la configurazione; non esistono condizioni
   sul profilo nella logica di business.
2. **Accento applicato come token.** Il profilo è esposto dall'attributo `data-profilo`
   sull'elemento radice e ridefinisce le variabili `--color-accento*`. Un nuovo profilo
   richiede una voce di configurazione e un blocco di token, non modifiche ai componenti.
3. **Procedura guidata al primo avvio**, pubblica ma protetta da una **chiave di
   installazione** (`CHIAVE_INSTALLAZIONE`), nota solo a chi predispone il server.
   Senza chiave, chiunque raggiungesse il dominio prima del titolare potrebbe configurare
   il salone e crearsi un account da amministratore.
4. **Una sola installazione.** La tabella `installazione` ha la colonna `riga` unica con
   vincolo `CHECK (riga = 1)`, aggiunto da migrazione SQL manuale. La procedura rifiuta
   un secondo completamento con `409 Conflict`.
5. **Creazione atomica.** Installazione, account del titolare e catalogo iniziale sono
   creati in un'unica transazione: un fallimento non lascia un'installazione a metà.
6. **Durate coerenti con gli slot.** Lo schema Zod condiviso impone che ogni durata sia
   multipla della granularità scelta, così l'agenda può sempre comporre gli appuntamenti.

## Alternative valutate

- **Procedura senza chiave, protetta solo dal "primo che arriva"**: scartata, è una finestra
  di acquisizione dell'account amministratore.
- **Profilo come colonna letta con condizioni nel codice**: scartata, è esattamente ciò che
  il principio di codebase universale vuole evitare.
- **Configurazione del profilo nel database**: non necessaria. Catalogo e valori predefiniti
  servono solo al primo avvio; dopo la configurazione tutto è modificabile dal titolare e
  vive già nel database.

## Conseguenze

- La chiave di installazione va consegnata al titolare (o inserita da chi installa) e
  documentata nella procedura di installazione del README.
- Aggiungere un profilo significa aggiungere una voce di configurazione, i token di accento
  e i relativi test: nessuna modifica alla logica.
- I cataloghi predefiniti sono vincolati dalla granularità del profilo: i test lo verificano
  automaticamente per ogni profilo.
