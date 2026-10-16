# ADR 0002 — Backend in ESM e limite di frequenza senza dipendenze

- **Stato**: accettata
- **Data**: 2026-10-16
- **Fase**: 0 — Fondamenta

## Contesto

NestJS 12, la versione corrente, è distribuito **solo come moduli ES**. Il backend deve
quindi essere ESM: `"type": "module"`, `moduleResolution: NodeNext`, estensione `.js` negli
import relativi e Jest in modalità ESM.

In questo contesto `@nestjs/throttler`, la libreria usuale per il limite di frequenza, è
ancora CommonJS: sotto Jest ESM genera un ciclo `require(esm)` non ammesso dalla specifica
ECMAScript e impedisce l'esecuzione dei test di integrazione.

## Decisione

1. **Il backend è ESM.** Il pacchetto condiviso `@barber/shared` viene pubblicato in doppio
   formato (CommonJS ed ESM) per restare utilizzabile anche da strumenti CommonJS.
2. **Limite di frequenza implementato nel progetto**: decoratore `@LimiteDiFrequenza`,
   guardia globale e servizio con finestra fissa in memoria. Applicato ad accesso e cambio
   password (5 richieste al minuto per IP) e, nelle fasi successive, a registrazione, reset
   password, verifica del telefono e prenotazione.

## Conseguenze

- Lo stato del limite vive nel processo: accettabile perché ogni installazione serve un solo
  salone con un singolo processo applicativo. Se in futuro servissero più istanze, il
  conteggio andrà spostato su PostgreSQL mantenendo la stessa interfaccia del servizio.
- Il limite in memoria si azzera al riavvio: non protegge da un attacco distribuito e lento,
  per il quale restano l'hashing Argon2id e il monitoraggio.
- I test devono azzerare il servizio fra i casi, perché condividono lo stesso indirizzo IP.
