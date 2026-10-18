import { describe, expect, it } from '@jest/globals';
import { canaleDaUsare } from './canale.js';

const COMPLETO = {
  nome: 'Giulia',
  email: 'giulia@example.test',
  numeroWhatsapp: '+393330000001',
  consensoWhatsapp: true,
};

describe('Scelta del canale di un messaggio di servizio', () => {
  it('usa WhatsApp quando il salone lo ha attivo, c’è il consenso e il numero', () => {
    expect(canaleDaUsare({ whatsappAttivo: true, destinatario: COMPLETO })).toBe('whatsapp');
  });

  it('ripiega sull’e-mail senza consenso, senza numero o con WhatsApp disattivo', () => {
    expect(
      canaleDaUsare({
        whatsappAttivo: true,
        destinatario: { ...COMPLETO, consensoWhatsapp: false },
      }),
    ).toBe('email');
    expect(
      canaleDaUsare({ whatsappAttivo: true, destinatario: { ...COMPLETO, numeroWhatsapp: null } }),
    ).toBe('email');
    expect(canaleDaUsare({ whatsappAttivo: false, destinatario: COMPLETO })).toBe('email');
  });

  it('non ha canale quando mancano sia l’e-mail sia il numero con consenso', () => {
    expect(
      canaleDaUsare({
        whatsappAttivo: true,
        destinatario: { ...COMPLETO, email: null, consensoWhatsapp: false },
      }),
    ).toBe('nessuno');
    expect(
      canaleDaUsare({
        whatsappAttivo: false,
        destinatario: { ...COMPLETO, email: null },
      }),
    ).toBe('nessuno');
  });

  it('una scheda con solo il numero e il consenso riceve su WhatsApp', () => {
    expect(
      canaleDaUsare({ whatsappAttivo: true, destinatario: { ...COMPLETO, email: null } }),
    ).toBe('whatsapp');
  });
});
