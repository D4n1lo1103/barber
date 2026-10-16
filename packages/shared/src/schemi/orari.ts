import { z } from 'zod';
import { GIORNI_SETTIMANA, MINUTI_IN_UN_GIORNO, trovaSovrapposizione } from '../dominio/orari.js';
import { schemaIdentificativo } from './servizi.js';

export const TIPI_ASSENZA = ['ferie', 'riposo', 'altro'] as const;

export type TipoAssenza = (typeof TIPI_ASSENZA)[number];

export const ETICHETTE_ASSENZA: Readonly<Record<TipoAssenza, string>> = {
  ferie: 'Ferie',
  riposo: 'Giorno di riposo',
  altro: 'Altra assenza',
};

const schemaMinuto = z
  .number()
  .int('Indica un orario valido.')
  .min(0, 'Indica un orario valido.')
  .max(MINUTI_IN_UN_GIORNO, 'Indica un orario valido.');

export const schemaFasciaSettimanale = z
  .object({
    giornoSettimana: z
      .number()
      .int()
      .refine(
        (valore) => (GIORNI_SETTIMANA as readonly number[]).includes(valore),
        'Giorno della settimana non valido.',
      ),
    minutoInizio: schemaMinuto,
    minutoFine: schemaMinuto,
  })
  .refine((fascia) => fascia.minutoInizio < fascia.minutoFine, {
    message: "L'orario di chiusura deve essere successivo a quello di apertura.",
    path: ['minutoFine'],
  });

/** Fascia oraria ricorrente, legata a un giorno della settimana. */
export type FasciaSettimanale = z.infer<typeof schemaFasciaSettimanale>;

/** Le fasce dello stesso giorno non possono sovrapporsi. */
function senzaSovrapposizioniPerGiorno(fasce: readonly FasciaSettimanale[]): boolean {
  return GIORNI_SETTIMANA.every(
    (giorno) =>
      trovaSovrapposizione(fasce.filter((fascia) => fascia.giornoSettimana === giorno)) === null,
  );
}

export const schemaOrariApertura = z
  .object({
    fasce: z.array(schemaFasciaSettimanale).max(21, 'Troppe fasce di apertura.'),
  })
  .refine((dati) => senzaSovrapposizioniPerGiorno(dati.fasce), {
    message: 'Due fasce dello stesso giorno si sovrappongono.',
    path: ['fasce'],
  });

export type DatiOrariApertura = z.infer<typeof schemaOrariApertura>;

export const schemaOrariOperatore = z
  .object({
    fasce: z.array(schemaFasciaSettimanale).max(21, 'Troppe fasce di lavoro.'),
  })
  .refine((dati) => senzaSovrapposizioniPerGiorno(dati.fasce), {
    message: 'Due fasce dello stesso giorno si sovrappongono.',
    path: ['fasce'],
  });

export type DatiOrariOperatore = z.infer<typeof schemaOrariOperatore>;

export const schemaCreazioneAssenza = z
  .object({
    operatoreId: schemaIdentificativo,
    tipo: z.enum(TIPI_ASSENZA),
    /** Istanti in UTC: l'intervallo comprende l'inizio ed esclude la fine. */
    inizio: z.iso.datetime({ message: 'Data di inizio non valida.' }),
    fine: z.iso.datetime({ message: 'Data di fine non valida.' }),
    note: z.string().trim().max(300).default(''),
  })
  .refine((dati) => new Date(dati.fine) > new Date(dati.inizio), {
    message: 'La fine deve essere successiva all’inizio.',
    path: ['fine'],
  });

export type DatiCreazioneAssenza = z.infer<typeof schemaCreazioneAssenza>;

export const schemaAssenza = z.object({
  id: z.uuid(),
  operatoreId: z.uuid(),
  tipo: z.enum(TIPI_ASSENZA),
  inizio: z.string(),
  fine: z.string(),
  note: z.string(),
});

export type Assenza = z.infer<typeof schemaAssenza>;
