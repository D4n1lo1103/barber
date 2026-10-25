import type { CanaleInvito, Cliente } from '@barber/shared';

/**
 * L'invito ad attivare l'account parte da solo, su WhatsApp o via e-mail. Il
 * personale deve sapere dov'è andato: senza questo messaggio il link a schermo
 * sembra l'unico modo per consegnarlo.
 */
export function messaggioInvito(
  canale: CanaleInvito,
  cliente: Pick<Cliente, 'email' | 'numeroWhatsapp'>,
): { tono: 'conferma' | 'avviso'; testo: string } {
  if (canale === 'whatsapp') {
    return {
      tono: 'conferma',
      testo: `Invito inviato su WhatsApp al numero ${cliente.numeroWhatsapp ?? ''}. Il link qui sotto serve solo se non arriva.`,
    };
  }

  if (canale === 'email') {
    return {
      tono: 'conferma',
      testo: `Invito inviato per e-mail a ${cliente.email ?? ''}. Il link qui sotto serve solo se non arriva.`,
    };
  }

  return {
    tono: 'avviso',
    testo:
      'La scheda non ha un’e-mail e non ha il consenso ai messaggi WhatsApp: l’invito non è partito. Consegna tu il link al cliente.',
  };
}
