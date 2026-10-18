import type { Fascia, GiornoSettimana } from './orari.js';
import type { Profilo } from './profilo.js';

/** Servizio del catalogo iniziale proposto dalla procedura guidata. */
export interface ServizioPredefinito {
  nome: string;
  descrizione: string;
  /** Prezzo in centesimi di euro, IVA inclusa. */
  prezzoCentesimi: number;
  durataMinuti: number;
}

/** Tonalità di accento del profilo, espresse in oklch. */
export interface AccentoProfilo {
  accento: string;
  accentoForte: string;
  /** Colore del testo sopra una superficie di accento piena. */
  testoSuAccento: string;
}

/** Fascia di apertura predefinita, legata a un giorno della settimana. */
export interface AperturaPredefinita extends Fascia {
  giornoSettimana: GiornoSettimana;
}

export interface ConfigurazioneProfilo {
  profilo: Profilo;
  /** Nome del profilo mostrato nell'interfaccia. */
  etichetta: string;
  /** Come il profilo chiama chi eroga i servizi, al singolare. */
  etichettaOperatore: string;
  etichettaOperatoriPlurale: string;
  /** Granularità predefinita degli slot dell'agenda, in minuti. */
  granularitaSlotMinuti: number;
  /** Minuti di blocco dello slot durante il pagamento della caparra. */
  minutiBloccoSlot: number;
  accento: AccentoProfilo;
  catalogoIniziale: readonly ServizioPredefinito[];
  /** Orari di apertura proposti al primo avvio, modificabili dal titolare. */
  aperturaPredefinita: readonly AperturaPredefinita[];
}

/**
 * Giorni di chiusura predefiniti: domenica e lunedì. Non sono una regola
 * cablata, ma il punto di partenza proposto dalla procedura guidata: un giorno
 * è chiuso semplicemente perché non ha fasce di apertura.
 */
export const GIORNI_CHIUSURA_PREDEFINITI: readonly GiornoSettimana[] = [7, 1];

/** Da martedì a sabato, 9:00–13:00 e 15:00–19:00. */
const APERTURA_PREDEFINITA: readonly AperturaPredefinita[] = ([2, 3, 4, 5, 6] as const).flatMap(
  (giornoSettimana) => [
    { giornoSettimana, minutoInizio: 9 * 60, minutoFine: 13 * 60 },
    { giornoSettimana, minutoInizio: 15 * 60, minutoFine: 19 * 60 },
  ],
);

/**
 * Granularità selezionabili nella procedura guidata.
 * Le durate dei servizi devono esserne multipli.
 */
export const GRANULARITA_SLOT_AMMESSE = [5, 10, 15, 20, 30] as const;

export type GranularitaSlot = (typeof GRANULARITA_SLOT_AMMESSE)[number];

const CATALOGO_BARBIERE: readonly ServizioPredefinito[] = [
  {
    nome: 'Taglio uomo',
    descrizione: 'Taglio con forbici o macchinetta, lavaggio e styling.',
    prezzoCentesimi: 2000,
    durataMinuti: 30,
  },
  {
    nome: 'Taglio e barba',
    descrizione: 'Taglio completo con rifinitura della barba.',
    prezzoCentesimi: 3000,
    durataMinuti: 45,
  },
  {
    nome: 'Barba',
    descrizione: 'Rasatura e modellatura della barba con panno caldo.',
    prezzoCentesimi: 1200,
    durataMinuti: 15,
  },
  {
    nome: 'Taglio bambino',
    descrizione: 'Taglio per bambini fino a dodici anni.',
    prezzoCentesimi: 1500,
    durataMinuti: 30,
  },
  {
    nome: 'Rasatura a zero',
    descrizione: 'Rasatura completa a macchinetta.',
    prezzoCentesimi: 1000,
    durataMinuti: 15,
  },
  {
    nome: 'Shampoo e styling',
    descrizione: 'Lavaggio e messa in piega.',
    prezzoCentesimi: 1000,
    durataMinuti: 15,
  },
];

const CATALOGO_PARRUCCHIERE: readonly ServizioPredefinito[] = [
  {
    nome: 'Taglio donna',
    descrizione: 'Taglio con lavaggio e piega.',
    prezzoCentesimi: 3000,
    durataMinuti: 60,
  },
  {
    nome: 'Piega',
    descrizione: 'Lavaggio e messa in piega con phon.',
    prezzoCentesimi: 2000,
    durataMinuti: 45,
  },
  {
    nome: 'Colore',
    descrizione: 'Colorazione completa, lavaggio e piega.',
    prezzoCentesimi: 5500,
    durataMinuti: 120,
  },
  {
    nome: 'Colpi di sole',
    descrizione: 'Schiariture con stagnola, lavaggio e piega.',
    prezzoCentesimi: 7000,
    durataMinuti: 150,
  },
  {
    nome: 'Trattamento ricostruttivo',
    descrizione: 'Trattamento per capelli sfibrati con piega.',
    prezzoCentesimi: 3500,
    durataMinuti: 60,
  },
  {
    nome: 'Taglio uomo',
    descrizione: 'Taglio con lavaggio e styling.',
    prezzoCentesimi: 2000,
    durataMinuti: 30,
  },
];

/**
 * Configurazione dei due profili. Le differenze fra barbiere e parrucchiere
 * vivono qui: nel resto del codice si legge la configurazione, non il profilo.
 */
export const CONFIGURAZIONI_PROFILO: Readonly<Record<Profilo, ConfigurazioneProfilo>> = {
  barbiere: {
    profilo: 'barbiere',
    etichetta: 'Barbiere',
    etichettaOperatore: 'Barbiere',
    etichettaOperatoriPlurale: 'Barbieri',
    granularitaSlotMinuti: 15,
    minutiBloccoSlot: 10,
    accento: {
      accento: 'oklch(0.64 0.2 25)',
      accentoForte: 'oklch(0.55 0.22 25)',
      testoSuAccento: 'oklch(0.98 0.005 25)',
    },
    catalogoIniziale: CATALOGO_BARBIERE,
    aperturaPredefinita: APERTURA_PREDEFINITA,
  },
  parrucchiere: {
    profilo: 'parrucchiere',
    etichetta: 'Parrucchiere',
    etichettaOperatore: 'Parrucchiere',
    etichettaOperatoriPlurale: 'Parrucchieri',
    // Slot da 15 minuti: i servizi del parrucchiere hanno durate molto diverse
    // fra loro (dalla piega alla colorazione) e vanno composti con precisione.
    granularitaSlotMinuti: 15,
    minutiBloccoSlot: 15,
    accento: {
      accento: 'oklch(0.74 0.13 310)',
      accentoForte: 'oklch(0.64 0.15 310)',
      testoSuAccento: 'oklch(0.16 0.02 310)',
    },
    catalogoIniziale: CATALOGO_PARRUCCHIERE,
    aperturaPredefinita: APERTURA_PREDEFINITA,
  },
};

export function configurazioneProfilo(profilo: Profilo): ConfigurazioneProfilo {
  return CONFIGURAZIONI_PROFILO[profilo];
}
