import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttivitaModule } from '../attivita/attivita.module.js';
import { ambienteBooleano, type Ambiente } from '../configurazione/ambiente.js';
import { MITTENTE_EMAIL, type MittenteEmail } from './mittente-email.js';
import { MittenteRegistro } from './mittente-registro.js';
import { MittenteSmtp } from './mittente-smtp.js';
import { NotificheServizio } from './notifiche.servizio.js';

/**
 * Senza `SMTP_HOST` l'invio reale è disattivato e i messaggi restano nei log:
 * comodo in sviluppo e nei test. In produzione la configurazione mancante è un
 * errore e l'avvio si interrompe, per non far credere che le e-mail partano.
 */
function creaMittente(configurazione: ConfigService<Ambiente, true>): MittenteEmail {
  const host = configurazione.get('SMTP_HOST', { infer: true });
  const inProduzione = configurazione.get('NODE_ENV', { infer: true }) === 'production';

  if (!host) {
    if (inProduzione) {
      throw new Error('SMTP_HOST è obbligatoria in produzione: senza SMTP le e-mail non partono.');
    }

    new Logger('NotificheModule').warn(
      'SMTP non configurato: le e-mail non vengono inviate, solo registrate nei log.',
    );

    return new MittenteRegistro();
  }

  return new MittenteSmtp({
    host,
    porta: configurazione.get('SMTP_PORTA', { infer: true }),
    utente: configurazione.get('SMTP_UTENTE', { infer: true }),
    password: configurazione.get('SMTP_PASSWORD', { infer: true }),
    mittente: configurazione.get('SMTP_MITTENTE', { infer: true }),
    tlsImplicito: ambienteBooleano(configurazione.get('SMTP_TLS_IMPLICITO', { infer: true })),
  });
}

@Module({
  imports: [AttivitaModule],
  providers: [
    { provide: MITTENTE_EMAIL, useFactory: creaMittente, inject: [ConfigService] },
    NotificheServizio,
  ],
  exports: [NotificheServizio, MITTENTE_EMAIL],
})
export class NotificheModule {}
