# ADR 0006 — Chiusure del salone

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fase**: 3 — Agenda lato personale (completamento)

## Contesto

I requisiti descrivono gli orari di apertura settimanali e le assenze dei singoli operatori,
ma non le chiusure dell'intera attività. La domanda era rimasta aperta in `docs/TODO.md`.

Il titolare ha chiarito due casi distinti:

1. **Chiusure abituali**: domenica e lunedì. Sono la normalità della settimana tipo.
2. **Festività e chiusure straordinarie**: il salone resta chiuso in giorni specifici, e in
   quei giorni **tutti** gli operatori risultano occupati. Deve esistere **un solo flusso**
   per registrarle, non un'assenza da inserire operatore per operatore.

## Decisione

1. **Nessuna tabella nuova.** Le chiusure abituali sono semplicemente giorni senza fasce di
   apertura; le chiusure straordinarie sono assenze di tutti gli operatori. La proposta
   iniziale di una tabella `chiusure` dedicata viene scartata: avrebbe duplicato la logica di
   indisponibilità già usata dall'agenda e dal calcolo della disponibilità.
2. **Apertura predefinita nel profilo.** `aperturaPredefinita` (da martedì a sabato,
   9:00–13:00 e 15:00–19:00) vive nella configurazione del profilo. La procedura guidata la
   applica insieme agli orari di lavoro del titolare, che è anche operatore: una nuova
   installazione ha quindi domenica e lunedì chiusi, modificabili subito dalle impostazioni.
   Resta una configurazione, non una regola cablata.
3. **Nuovo tipo di assenza `chiusura`.** Distingue le chiusure dalle ferie e dai riposi, così
   l'agenda e i futuri KPI possono leggerle per quello che sono. Le assenze di questo tipo
   nascono e muoiono solo dal flusso delle chiusure: lo schema dell'assenza singola non le
   accetta e la rimozione di una singola riga viene rifiutata, per non lasciare una chiusura
   valida solo per una parte del personale.
4. **Un flusso unico.** `POST /orari/chiusure` (solo titolare) riceve primo giorno, ultimo
   giorno compreso e motivo, e registra un'assenza `chiusura` per ogni operatore in servizio.
   `GET /orari/chiusure` restituisce le chiusure raggruppate per periodo e motivo, con il
   numero di operatori coinvolti; `DELETE /orari/chiusure` le rimuove per tutti.
   I giorni sono interi: dalla mezzanotte locale del primo giorno a quella successiva
   all'ultimo.
5. **Nessuna chiusura sopra appuntamenti o assenze.** La registrazione viene rifiutata se nel
   periodo ci sono appuntamenti in agenda o assenze già presenti, indicando l'operatore da
   sistemare: coerente con la regola che un appuntamento non può cadere durante
   un'indisponibilità.
6. **Operatori aggiunti dopo.** Chi viene creato quando una chiusura futura esiste già ne
   eredita le assenze, altrimenti risulterebbe prenotabile a salone chiuso.

## Conseguenze

- Il calcolo della disponibilità non cambia: le chiusure sono assenze e sono già escluse
  dagli slot liberi.
- Il calendario delle festività non è precaricato: il titolare registra le chiusure che gli
  servono, con un motivo libero. Se in futuro servisse un elenco di festività italiane, si
  potrà proporre come scorciatoia sopra questo stesso flusso.
- Una chiusura registrata e poi rimossa non lascia tracce: se servirà uno storico delle
  chiusure, andrà aggiunto con il registro di audit previsto per la fase 6.
