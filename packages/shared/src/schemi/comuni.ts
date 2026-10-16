import { z } from 'zod';

/** Lunghezza minima della password, allineata alle raccomandazioni OWASP. */
export const LUNGHEZZA_MINIMA_PASSWORD = 12;
export const LUNGHEZZA_MASSIMA_PASSWORD = 128;

export const schemaEmail = z
  .string()
  .trim()
  .min(1, 'Inserisci un indirizzo e-mail.')
  .max(254, "L'indirizzo e-mail è troppo lungo.")
  .toLowerCase()
  .pipe(z.email('Inserisci un indirizzo e-mail valido.'));

export const schemaPassword = z
  .string()
  .min(
    LUNGHEZZA_MINIMA_PASSWORD,
    `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`,
  )
  .max(LUNGHEZZA_MASSIMA_PASSWORD, 'La password è troppo lunga.');

/** Numero di telefono in formato E.164 (es. +393401234567). */
export const schemaNumeroWhatsapp = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Inserisci il numero in formato internazionale, es. +393401234567.');

export const schemaNome = z
  .string()
  .trim()
  .min(2, 'Il nome deve avere almeno 2 caratteri.')
  .max(60, 'Il nome è troppo lungo.');

export const schemaCognome = z
  .string()
  .trim()
  .min(2, 'Il cognome deve avere almeno 2 caratteri.')
  .max(60, 'Il cognome è troppo lungo.');
