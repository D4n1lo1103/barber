import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttivitaModule } from '../attivita/attivita.module.js';
import type { Ambiente } from '../configurazione/ambiente.js';
import { ImpostazioniModule } from '../impostazioni/impostazioni.module.js';
import { CaparraServizio } from './caparra.servizio.js';
import { FornitoreFinto } from './fornitore-finto.js';
import { FornitoreStripe } from './fornitore-stripe.js';
import { FORNITORE_PAGAMENTI, type FornitorePagamenti } from './fornitore-pagamenti.js';
import { PagamentiController } from './pagamenti.controller.js';
import { PagamentiServizio } from './pagamenti.servizio.js';
import { ScadenzaBloccoAttivita } from './scadenza-blocco.attivita.js';

/**
 * Senza le chiavi di Stripe i pagamenti non sono reali: viene usato il
 * fornitore finto, che apre una pagina locale dove si sceglie l'esito. In
 * produzione le chiavi sono obbligatorie e la loro mancanza interrompe
 * l'avvio, per non far credere che i pagamenti funzionino.
 */
function creaFornitore(configurazione: ConfigService<Ambiente, true>): FornitorePagamenti {
  const chiaveSegreta = configurazione.get('STRIPE_CHIAVE_SEGRETA', { infer: true });
  const segretoWebhook = configurazione.get('STRIPE_SEGRETO_WEBHOOK', { infer: true });
  const inProduzione = configurazione.get('NODE_ENV', { infer: true }) === 'production';
  const registro = new Logger('PagamentiModule');

  if (chiaveSegreta && segretoWebhook) {
    return new FornitoreStripe(
      chiaveSegreta,
      segretoWebhook,
      configurazione.get('STRIPE_CHIAVE_PUBBLICABILE', { infer: true }) ?? null,
    );
  }

  if (inProduzione) {
    throw new Error(
      'STRIPE_CHIAVE_SEGRETA e STRIPE_SEGRETO_WEBHOOK sono obbligatorie in produzione: ' +
        'senza di esse la caparra non si può incassare.',
    );
  }

  registro.warn(
    'Stripe non configurato: i pagamenti sono finti e nessun denaro viene movimentato.',
  );

  return new FornitoreFinto(configurazione.get('ORIGINE_WEB', { infer: true }));
}

@Module({
  imports: [AttivitaModule, ImpostazioniModule],
  controllers: [PagamentiController],
  providers: [
    { provide: FORNITORE_PAGAMENTI, useFactory: creaFornitore, inject: [ConfigService] },
    CaparraServizio,
    PagamentiServizio,
    ScadenzaBloccoAttivita,
  ],
  exports: [CaparraServizio, PagamentiServizio, ScadenzaBloccoAttivita, FORNITORE_PAGAMENTI],
})
export class PagamentiModule {}
