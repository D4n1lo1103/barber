import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida il corpo della richiesta con uno schema Zod condiviso
 * e restituisce messaggi d'errore in italiano, campo per campo.
 */
export class ValidazioneZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valore: unknown): T {
    const esito = this.schema.safeParse(valore);

    if (!esito.success) {
      const errori = esito.error.issues.map((problema) => ({
        campo: problema.path.join('.'),
        messaggio: problema.message,
      }));

      throw new BadRequestException({ messaggio: 'Dati non validi.', errori });
    }

    return esito.data;
  }
}
