import { Injectable } from '@nestjs/common';

interface Conteggio {
  richieste: number;
  finestraScadeIl: number;
}

/**
 * Conteggio delle richieste in memoria con finestra fissa.
 * L'installazione di un salone gira in un solo processo applicativo,
 * quindi non serve uno stato condiviso fra istanze.
 */
@Injectable()
export class LimiteFrequenzaServizio {
  private readonly conteggi = new Map<string, Conteggio>();
  private ultimaPulizia = Date.now();

  /** Registra una richiesta e indica se il limite è stato superato. */
  registra(chiave: string, massimo: number, finestraSecondi: number): boolean {
    const adesso = Date.now();
    this.puliscScadute(adesso);

    const conteggio = this.conteggi.get(chiave);

    if (!conteggio || conteggio.finestraScadeIl <= adesso) {
      this.conteggi.set(chiave, {
        richieste: 1,
        finestraScadeIl: adesso + finestraSecondi * 1000,
      });

      return true;
    }

    conteggio.richieste += 1;

    return conteggio.richieste <= massimo;
  }

  /** Secondi da attendere prima di poter riprovare. */
  secondiDiAttesa(chiave: string): number {
    const conteggio = this.conteggi.get(chiave);

    if (!conteggio) {
      return 0;
    }

    return Math.max(0, Math.ceil((conteggio.finestraScadeIl - Date.now()) / 1000));
  }

  azzera(): void {
    this.conteggi.clear();
  }

  private puliscScadute(adesso: number): void {
    if (adesso - this.ultimaPulizia < 60_000) {
      return;
    }

    for (const [chiave, conteggio] of this.conteggi) {
      if (conteggio.finestraScadeIl <= adesso) {
        this.conteggi.delete(chiave);
      }
    }

    this.ultimaPulizia = adesso;
  }
}
