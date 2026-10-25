import { describe, expect, it } from 'vitest';
import { messaggioInvito } from './messaggio-invito';

const RECAPITI = { email: 'andrea.conti@cliente.test', numeroWhatsapp: '+393405550002' };

describe('messaggioInvito', () => {
  it('nomina l’indirizzo quando l’invito parte via e-mail', () => {
    const messaggio = messaggioInvito('email', RECAPITI);

    expect(messaggio.tono).toBe('conferma');
    expect(messaggio.testo).toContain('andrea.conti@cliente.test');
  });

  it('nomina il numero quando l’invito parte su WhatsApp', () => {
    const messaggio = messaggioInvito('whatsapp', RECAPITI);

    expect(messaggio.tono).toBe('conferma');
    expect(messaggio.testo).toContain('+393405550002');
  });

  it('avverte quando non c’è nessun recapito su cui mandarlo', () => {
    const messaggio = messaggioInvito('nessuno', { email: null, numeroWhatsapp: null });

    expect(messaggio.tono).toBe('avviso');
    expect(messaggio.testo).toContain('Consegna tu il link');
  });
});
