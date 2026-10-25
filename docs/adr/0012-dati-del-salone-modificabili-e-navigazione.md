# ADR 0012 — Dati del salone modificabili e navigazione del personale

- **Stato**: accettata
- **Data**: 2026-10-25
- **Fase**: trasversale (modifica alle fasi 1 e 2)

## Contesto

Il titolare ha segnalato (25/10/2026) di non riuscire a raggiungere le impostazioni una
volta entrato nell'applicazione. L'analisi ha trovato tre cose distinte:

1. La rotta `/impostazioni` e il suo collegamento esistevano, ma **solo sul pannello
   iniziale**. Da agenda, clienti o vendite non c'era modo di tornarci se non col tasto
   indietro del browser. I collegamenti fra le pagine erano estemporanei: l'agenda portava
   ai clienti, i clienti all'agenda, impostazioni e vendite al pannello.
2. I dati decisi nella **procedura guidata al primo avvio** — nome del salone, recapiti,
   profilo, granularità degli slot, minuti di blocco dello slot, vendita online — non erano
   modificabili: mancava sia la schermata sia l'endpoint.
3. L'endpoint `POST /autenticazione/cambio-password` esisteva dalla fase 0, ma **nessuna
   schermata lo usava**: per cambiare la password bisognava passare dal percorso «password
   dimenticata» e dall'e-mail.

Il capitolato elenca fra le impostazioni modificabili dal titolare servizi, prezzi, durate,
personale, orari, regole della caparra, prodotti e magazzino. Non nomina i dati del salone,
che tratta come «configurazione di installazione»: la decisione è stata presa con il
titolare prima di implementarla.

## Decisione

1. **Barra di navigazione fissa per il personale**, resa una sola volta sopra le rotte e
   presente su ogni pagina: Pannello, Agenda, Clienti, Vendite e, per il solo titolare,
   Impostazioni del salone, più il cambio di tema e l'uscita. Su schermo stretto le voci
   stanno dietro un menu, per non togliere larghezza all'agenda, che in negozio si usa da
   tablet. I collegamenti estemporanei fra le pagine sono stati rimossi: duplicarli nella
   barra darebbe due elementi con lo stesso nome.
2. **I dati del salone diventano modificabili** dal titolare, in una nuova scheda _Salone_
   delle impostazioni: nome, indirizzo, città, telefono, e-mail, granularità degli slot,
   minuti di blocco e vendita online.
3. **Il profilo resta immutabile.** Cambiarlo a salone avviato ribalterebbe catalogo
   predefinito, durate tipiche e palette di accento su dati già in uso, e non esiste una
   regola che dica che cosa dovrebbe succedere ai servizi già a catalogo. Si sceglie una
   volta sola, al primo avvio.
4. **La granularità non si cambia alla cieca.** Il salvataggio rifiuta un valore con cui
   le durate dei servizi attivi non sono multiple, elencando quali correggere prima: è lo
   stesso vincolo che la procedura guidata applica al catalogo iniziale, perché l'agenda
   compone gli appuntamenti sommando durate e una durata fuori passo non troverebbe mai uno
   slot.
5. **Cambio password nell'interfaccia per tutti i ruoli**: per il personale nel pannello,
   per il cliente nella scheda _Profilo e dati_. Il riquadro è lo stesso componente.
6. **Selettore del tema anche per il cliente**, nell'intestazione della sua area: stava
   solo nel pannello del personale, dove il cliente non arriva mai.

## Conseguenze

- Ogni sezione è raggiungibile da ogni pagina, in un clic, e il ruolo decide che cosa
  compare: il dipendente non vede la voce delle impostazioni, oltre a non poter entrare
  nella rotta, che resta protetta anche lato backend.
- Il pannello perde i pulsanti di scorciatoia, che la barra ora ripete ovunque: resta la
  pagina di benvenuto, con il saluto e un collegamento all'agenda del giorno.
- Cambiare la granularità **non tocca gli appuntamenti già presi**, che restano al loro
  orario: il nuovo passo vale per la disponibilità futura. L'interfaccia lo dice prima di
  salvare.
- Chi cambia la propria password viene disconnesso da tutti i dispositivi, perché il
  backend revoca le sessioni: il messaggio lo annuncia e riporta all'accesso.
- Resta fuori da questa decisione il cambio di **profilo** del salone. Se servirà, andrà
  deciso a parte, insieme a che cosa fare di catalogo, durate e appuntamenti esistenti.
