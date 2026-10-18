import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  schemaEvasioneRichiesta,
  type DatiEvasioneRichiesta,
  type RichiestaCancellazione,
} from '@barber/shared';
import { ClientiServizio } from '../clienti/clienti.servizio.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { AreaClienteServizio } from './area-cliente.servizio.js';

/**
 * Richieste di cancellazione dei dati (GDPR), lato salone. Le evade solo il
 * titolare: anonimizzare una scheda è un'operazione non reversibile.
 */
@Controller('cancellazioni')
@UseGuards(RuoliGuardia)
@Ruoli('titolare')
export class CancellazioniController {
  constructor(
    private readonly areaCliente: AreaClienteServizio,
    private readonly clienti: ClientiServizio,
  ) {}

  @Get()
  elenca(): Promise<{ richieste: RichiestaCancellazione[] }> {
    return this.areaCliente.elencaRichieste().then((richieste) => ({ richieste }));
  }

  @Post(':id/evasione')
  evadi(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaEvasioneRichiesta)) dati: DatiEvasioneRichiesta,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<RichiestaCancellazione> {
    return this.areaCliente.evadiRichiesta(id, dati, utente.id, (clienteId) =>
      this.clienti.anonimizza(clienteId),
    );
  }
}
