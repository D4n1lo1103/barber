# ADR 0004 — Rappresentazione di orari ricorrenti e assenze

- **Stato**: accettata
- **Data**: 2026-10-16
- **Fase**: 2 — Personale, servizi e orari

## Contesto

Il salone ha orari di apertura settimanali e ogni operatore ha i propri orari di lavoro.
Le assenze (ferie, riposi, altro) sono invece periodi con una data di inizio e una di fine.
Il requisito tecnico impone di salvare tutto in UTC e di mostrare in `Europe/Rome`, con test
sui giorni di cambio dell'ora legale.

Applicare alla lettera "tutto in UTC" agli orari settimanali sarebbe sbagliato: "apriamo
alle 9" è un orario locale che resta alle 9 anche quando cambia l'ora legale, mentre il
corrispondente istante UTC si sposta di un'ora due volte l'anno.

## Decisione

1. **Orari ricorrenti come minuti locali.** `orari_apertura` e `orari_operatori` salvano
   `giornoSettimana` (1 = lunedì … 7 = domenica, ISO-8601) e due interi: minuti dalla
   mezzanotte nel fuso del salone. Non sono istanti e non subiscono l'ora legale.
2. **Assenze come istanti UTC.** `assenze` usa `inizio` e `fine` in UTC, con intervallo
   che comprende l'inizio ed esclude la fine.
3. **Integrità nel database, non solo nel codice.** Con `btree_gist`:
   - vincoli `CHECK` su giorno valido, fascia dentro la giornata e inizio minore della fine;
   - vincoli `EXCLUDE` che impediscono fasce sovrapposte nello stesso giorno (per il salone
     e per ciascun operatore) e assenze sovrapposte dello stesso operatore.
     La stessa verifica esiste anche negli schemi Zod condivisi, per dare messaggi chiari.
4. **Orari di lavoro contenuti nell'apertura.** Un operatore non può lavorare quando il
   salone è chiuso: il controllo vale sia quando si modificano gli orari dell'operatore sia
   quando si restringono quelli del salone, che in quel caso viene rifiutata con l'indicazione
   di chi resterebbe fuori orario.
5. **Sostituzione completa invece di modifiche parziali.** Gli orari si salvano inviando
   l'intero elenco di fasce: elimina le ambiguità sulle modifiche concorrenti e semplifica
   l'interfaccia.

## Conseguenze

- Il calcolo della disponibilità (fase 3) dovrà combinare orari locali e istanti UTC:
  per ogni giorno si costruiscono gli istanti a partire dai minuti locali nel fuso
  `Europe/Rome`, tenendo conto del cambio dell'ora legale.
- I giorni di chiusura sono semplicemente giorni senza fasce: non serve una tabella di
  eccezioni per la settimana tipo.
- Le chiusure straordinarie (festività, ferie dell'intero salone) non sono ancora previste
  dai requisiti: sono annotate fra le domande aperte in `docs/TODO.md`.
