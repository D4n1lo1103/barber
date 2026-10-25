# Design system

Fonte unica di colori, spaziature, raggi, ombre e animazioni dell'interfaccia.
I token sono definiti in `apps/web/src/stili/globale.css` e usati da tutti i componenti:
**nessun componente scrive colori letterali**.

## Principi

- Tema **scuro di default**, tema chiaro disponibile e ricordato sul dispositivo.
- Superfici traslucide con sfocatura, su un fondo con alone luminoso nella tinta del profilo.
- Animazioni brevi (140–360 ms): non devono rallentare il lavoro in negozio.
- `prefers-reduced-motion` rispettato a livello globale.
- Contrasti conformi a WCAG 2.1 AA; il colore non è mai l'unico veicolo di significato.

## Token di colore

| Token                                                  | Ruolo                                  |
| ------------------------------------------------------ | -------------------------------------- |
| `--color-fondo`                                        | Sfondo della pagina                    |
| `--color-fondo-elevato`                                | Campi e superfici piene                |
| `--color-superficie`                                   | Superficie traslucida (card, pannelli) |
| `--color-superficie-solida`                            | Variante opaca, per contenuti densi    |
| `--color-bordo`, `--color-bordo-forte`                 | Bordi e separatori                     |
| `--color-testo`, `--color-testo-tenue`                 | Testo principale e secondario          |
| `--color-accento`, `--color-accento-forte`             | Azione primaria, stato attivo          |
| `--color-su-accento`                                   | Testo sopra una superficie di accento  |
| `--color-errore`, `--color-avviso`, `--color-conferma` | Stati                                  |

### Accento per profilo

L'accento cambia con il profilo dell'installazione: l'attributo `data-profilo`
sull'elemento `<html>` è impostato dal contesto dell'installazione.

| Profilo        | Nome       | Accento                | Accento forte          |
| -------------- | ---------- | ---------------------- | ---------------------- |
| `barbiere`     | Rosso lama | `oklch(0.64 0.2 25)`   | `oklch(0.55 0.22 25)`  |
| `parrucchiere` | Lavanda    | `oklch(0.74 0.13 310)` | `oklch(0.64 0.15 310)` |

Nel tema chiaro gli accenti sono scuriti (`oklch(0.55 …)`) per mantenere il contrasto
del testo bianco sopra il pulsante primario.

> **Accento barbiere e colore di errore.** Il rosso dell'accento è vicino al rosso
> degli errori. Per questo `--color-errore` è spostato verso il magenta
> (`oklch(0.63 0.23 2)`) e ogni messaggio di stato porta un prefisso testuale
> ("Errore:", "Attenzione:", "Fatto:"), come richiede WCAG 1.4.1.

## Raggi, ombre, tipografia

| Token                 | Valore           | Uso                      |
| --------------------- | ---------------- | ------------------------ |
| `--radius-campo`      | `0.75rem`        | Campi, pulsanti          |
| `--radius-superficie` | `1.25rem`        | Card e pannelli          |
| `--radius-pillola`    | `9999px`         | Indicatori, etichette    |
| `--shadow-superficie` | ombra bassa      | Superfici a riposo       |
| `--shadow-sollevata`  | ombra profonda   | Superfici in primo piano |
| `--font-sans`         | Inter, system-ui | Tutta l'interfaccia      |

## Animazioni

| Token            | Valore                           | Uso                                |
| ---------------- | -------------------------------- | ---------------------------------- |
| `--durata-breve` | 140 ms                           | Stati dei controlli (hover, focus) |
| `--durata-media` | 240 ms                           | Comparse, cambi di passo           |
| `--durata-lunga` | 360 ms                           | Transizioni di pagina              |
| `--curva-uscita` | `cubic-bezier(0.22, 1, 0.36, 1)` | Curva standard                     |

## Componenti di base

In `apps/web/src/componenti/`:

| Componente    | Scopo                                                 | Note di accessibilità                                                              |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Superficie`  | Contenitore traslucido, variante `sollevata`          | —                                                                                  |
| `Pulsante`    | Azioni, varianti `primario`, `secondario`, `discreto` | Stato disabilitato visibile e annunciato                                           |
| `Campo`       | Campo di testo con etichetta                          | Etichetta, suggerimento ed errore collegati con `aria-describedby`, `aria-invalid` |
| `Avviso`      | Messaggio di stato                                    | `role="alert"` per gli errori, `role="status"` altrimenti, prefisso testuale       |
| `Caricamento` | Attesa                                                | `role="status"`, `aria-live="polite"`                                              |

## Come aggiungere un componente

1. Usa solo token: nessun valore di colore, raggio o durata scritto a mano.
2. Verifica il componente nei due temi e nei due profili.
3. Garantisci la navigazione da tastiera e il focus visibile (`:focus-visible` è globale).
4. Se il componente comunica uno stato, aggiungi testo o icona oltre al colore.

## login

┌────────────┬────────────────────────────┐
│ Ruolo │ E-mail │  
├────────────┼────────────────────────────┤
│ Titolare │ titolare@salone.test │
├────────────┼────────────────────────────┤
│ Dipendente │ dipendente@salone.test │
├────────────┼────────────────────────────┤
│ Dipendente │ dipendente2@salone.test │
├────────────┼────────────────────────────┤
│ Cliente │ giulia.rossi@cliente.test │
├────────────┼────────────────────────────┤
│ Cliente │ andrea.conti@cliente.test │
├────────────┼────────────────────────────┤
│ Cliente │ elena.moretti@cliente.test │
└────────────┴────────────────────────────┘

password uguale per tutti: password-demo-salone
