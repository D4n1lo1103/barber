import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttivitaModule } from '../attivita/attivita.module.js';
import { ambienteBooleano, type Ambiente } from '../configurazione/ambiente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImpostazioniModule } from '../impostazioni/impostazioni.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MITTENTE_EMAIL, type MittenteEmail } from './mittente-email.js';
import { MittenteRegistro } from './mittente-registro.js';
import { MittenteSmtp } from './mittente-smtp.js';
import { MITTENTE_WHATSAPP, type MittenteWhatsapp } from './mittente-whatsapp.js';
import { MittenteWhatsappCloud } from './mittente-whatsapp-cloud.js';
import { MittenteWhatsappNonConfigurato } from './mittente-whatsapp-non-configurato.js';
import { MittenteWhatsappRegistro } from './mittente-whatsapp-registro.js';
import { NotificheServizio } from './notifiche.servizio.js';
import { PromemoriaAttivita } from './promemoria.attivita.js';

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

/**
 * Il token di WhatsApp sta nell'ambiente, l'identificativo del numero mittente
 * nel database: il mittente reale si costruisce solo quando il token c'è. Senza
 * token i messaggi vengono registrati e tutto arriva via e-mail, che è il
 * ripiego previsto dai requisiti.
 *
 * L'identificativo del numero viene letto all'avvio: cambiandolo dalle
 * impostazioni serve un riavvio del servizio, operazione da installazione.
 */
async function creaMittenteWhatsapp(
  configurazione: ConfigService<Ambiente, true>,
  prisma: PrismaService,
): Promise<MittenteWhatsapp> {
  const token = configurazione.get('WHATSAPP_TOKEN', { infer: true });
  const installazione = await prisma.installazione.findFirst({
    select: { whatsappIdNumero: true },
  });
  const idNumero = installazione?.whatsappIdNumero ?? '';
  const registro = new Logger('NotificheModule');

  if (!token || idNumero === '') {
    // In produzione i messaggi non si registrano mai: conterrebbero link di
    // attivazione e codici di verifica, cioè credenziali in chiaro nei log.
    if (configurazione.get('NODE_ENV', { infer: true }) === 'production') {
      registro.warn('WhatsApp non configurato: i messaggi di servizio vanno via e-mail.');

      return new MittenteWhatsappNonConfigurato();
    }

    registro.warn(
      'WhatsApp non configurato: i messaggi vengono registrati nei log e inviati via e-mail.',
    );

    return new MittenteWhatsappRegistro();
  }

  return new MittenteWhatsappCloud(
    token,
    idNumero,
    configurazione.get('WHATSAPP_VERSIONE_API', { infer: true }),
  );
}

@Module({
  imports: [AttivitaModule, forwardRef(() => ImpostazioniModule), PrismaModule],
  providers: [
    { provide: MITTENTE_EMAIL, useFactory: creaMittente, inject: [ConfigService] },
    {
      provide: MITTENTE_WHATSAPP,
      useFactory: creaMittenteWhatsapp,
      inject: [ConfigService, PrismaService],
    },
    NotificheServizio,
    PromemoriaAttivita,
  ],
  exports: [NotificheServizio, PromemoriaAttivita, MITTENTE_EMAIL, MITTENTE_WHATSAPP],
})
export class NotificheModule {}
