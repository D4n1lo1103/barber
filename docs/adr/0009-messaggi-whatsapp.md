# ADR 0009 — Messaggi WhatsApp

- **Stato**: accettata
- **Data**: 2026-10-18
- **Fase**: 7 — WhatsApp (completa l'MVP)

## Contesto

I requisiti chiedono conferme, promemoria e inviti su WhatsApp, con ripiego via e-mail quando
manca il consenso o l'invio fallisce, usando modelli approvati da Meta. Il titolare ha chiesto
che **i dati di WhatsApp si impostino in fase di configurazione** e, non avendo ancora le
credenziali di Meta, che tutto sia verificabile con dati di prova.

Restavano aperte tre domande: dove mettere il token, come far convivere il consenso GDPR con
l'invito ad attivare l'account, e come programmare i promemoria.

## Decisione

1. **Il token nell'ambiente, il resto nelle impostazioni.** `WHATSAPP_TOKEN` sta in `.env`
   come le altre credenziali; attivazione, identificativo del numero mittente e nomi dei
   modelli stanno nel database e si impostano nella procedura guidata (passo «Messaggi») e
   nella scheda _Messaggi_. Il motivo è concreto: i backup notturni del database vengono
   scaricati sul PC dello sviluppatore, e un token di Meta lì dentro sarebbe una credenziale
   in giro per sempre. L'interfaccia dichiara se il token è presente, invece di far credere
   che i messaggi partano: è la stessa scelta fatta per Stripe e per l'SMTP.
2. **Mittente dietro interfaccia, con una realizzazione finta.** `MittenteWhatsapp` ha due
   realizzazioni: WhatsApp Cloud API di Meta e un mittente che registra i messaggi in memoria
   e nei log, usato quando mancano token o numero mittente e mai in produzione. Così lo
   sviluppo e i test coprono tutti i flussi senza credenziali, e i clienti di prova nel seed
   coprono ogni combinazione di canale.
3. **La scelta del canale è una funzione pura.** `canaleDaUsare` decide da tre fatti:
   WhatsApp attivo nel salone, consenso del cliente, numero presente. Se manca uno dei tre si
   usa l'e-mail; senza nessun recapito non c'è canale e l'operazione prosegue comunque, perché
   un messaggio non consegnato non deve impedire una prenotazione.
4. **Un invio WhatsApp fallito non viene ritentato: si ripiega subito sull'e-mail.** Ritentare
   e poi ripiegare rischierebbe di consegnare due messaggi per lo stesso evento. L'e-mail di
   ripiego viaggia nella stessa attività in coda, quindi è la coda a garantire la consegna.
5. **Il consenso per le schede create dal personale lo registra il personale.** Il cliente al
   telefono non può spuntare nulla: nel pannello di creazione della scheda c'è una casella con
   cui il dipendente registra il consenso dichiarato a voce, e da quella dipende il canale
   dell'invito. Senza consenso l'invito va via e-mail; senza e-mail il link resta a schermo e
   si detta. Il cliente può poi revocare il consenso dalla propria area.
6. **Promemoria come attività ricorrente, non programmata per appuntamento.** Ogni cinque
   minuti un'attività cerca gli appuntamenti confermati che entrano nella finestra
   dell'anticipo e non hanno ancora `promemoriaInviatoIl`. Il campo viene segnato **prima**
   dell'invio, quindi un secondo passaggio non manda nulla. Un'attività per appuntamento
   avrebbe avuto due difetti: un cambio dell'anticipo non avrebbe più valso per gli
   appuntamenti già presi, e uno spostamento avrebbe lasciato un promemoria programmato
   all'orario sbagliato.
7. **Verifica del numero con un codice di sei cifre.** Il codice arriva su WhatsApp, che è il
   canale da verificare, e via e-mail se il salone non ha ancora attivato i messaggi. Nel
   database resta solo l'hash, legato all'utente: due persone possono ricevere per caso lo
   stesso codice, e `tokenHash` è unico. Validità di quindici minuti, limite di frequenza
   sulle rotte, codice a uso singolo, e rifiuto se quel numero è già verificato su un altro
   account.

## Conseguenze

- Finché il titolare non ha le credenziali di Meta il software funziona: tutti i messaggi
  vanno via e-mail e l'interfaccia lo dice chiaramente. Con le credenziali basta compilare il
  passo «Messaggi» e inserire il token nel file di configurazione.
- **I testi dei modelli nel codice sono una proposta.** I modelli vanno registrati e approvati
  da Meta prima dell'uso reale, e i nomi vanno riportati nella scheda _Messaggi_: se un nome
  non corrisponde, Meta rifiuta il messaggio e il cliente riceve l'e-mail.
- L'identificativo del numero mittente viene letto all'avvio del servizio: cambiarlo richiede
  un riavvio, operazione da installazione. Se in futuro servisse cambiarlo a caldo, il
  mittente andrà costruito a ogni invio invece che una volta sola.
- Un numero verificato non viene ancora usato per collegare automaticamente le schede create
  dal personale: il collegamento resta quello della fase 4, sulla registrazione. Ora che la
  verifica esiste, si potrà stringere la regola se servirà.
