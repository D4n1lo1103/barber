import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cliente, Operatore, Servizio, Ruolo } from '@barber/shared';
import { ModaleNuovoAppuntamento } from './modale-nuovo-appuntamento';

const creaFinto = vi.fn();
let ruoloCorrente: Ruolo = 'titolare';

vi.mock('../../autenticazione/contesto-sessione', () => ({
  usaSessione: () => ({
    utente: { id: 'utente-1', nome: 'Luca', cognome: 'Bianchi', ruolo: ruoloCorrente },
    inCaricamento: false,
    accedi: vi.fn(),
    esci: vi.fn(),
  }),
}));

vi.mock('../../servizi/gestione', () => ({
  creaAppuntamento: (dati: unknown) => creaFinto(dati),
  // Il giorno di prova è di chiusura: nessuno slot libero da proporre.
  leggiDisponibilita: () => Promise.resolve({ giorni: [{ giorno: '2026-10-25', slot: [] }] }),
  leggiClienti: () => Promise.resolve({ clienti: [CLIENTE], totale: 1, pagina: 1, perPagina: 8 }),
}));

const CLIENTE: Cliente = {
  id: 'cliente-1',
  nome: 'Andrea',
  cognome: 'Conti',
  numeroWhatsapp: '+393405550002',
  email: 'andrea.conti@cliente.test',
  note: '',
  attivo: true,
  accountAttivato: true,
  consensoWhatsapp: false,
  creatoIl: '2026-10-01T10:00:00.000Z',
};

const OPERATORI: Operatore[] = [
  {
    id: 'operatore-1',
    nome: 'Luca',
    cognome: 'Bianchi',
    email: 'titolare@salone.test',
    numeroWhatsapp: null,
    ruolo: 'titolare',
    attivo: true,
    accountAttivato: true,
  },
];

const SERVIZI: Servizio[] = [
  {
    id: 'servizio-1',
    nome: 'Taglio uomo',
    descrizione: '',
    prezzoCentesimi: 2000,
    durataMinuti: 30,
    attivo: true,
    ordine: 0,
    operatoriAbilitati: ['operatore-1'],
  },
];

function disegna() {
  return render(
    <ModaleNuovoAppuntamento
      aperto
      onChiudi={vi.fn()}
      onCreato={vi.fn()}
      operatori={OPERATORI}
      servizi={SERVIZI}
      operatoreIniziale="operatore-1"
      giornoIniziale="2026-10-25"
      orarioIniziale={null}
    />,
  );
}

async function scegliClienteEServizio(utente: ReturnType<typeof userEvent.setup>) {
  await utente.type(screen.getByRole('textbox', { name: 'Cliente' }), 'Conti');
  await utente.click(await screen.findByRole('button', { name: /Conti/ }));
  await utente.click(screen.getByRole('checkbox', { name: /Taglio uomo/ }));
}

describe('ModaleNuovoAppuntamento', () => {
  beforeEach(() => {
    creaFinto.mockReset();
    creaFinto.mockResolvedValue({ id: 'appuntamento-1' });
    ruoloCorrente = 'titolare';
  });

  it('dice quale dato manca, invece di elencarli tutti', async () => {
    const utente = userEvent.setup();
    disegna();

    await utente.click(screen.getByRole('button', { name: 'Salva appuntamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scegli il cliente.');

    await utente.type(screen.getByRole('textbox', { name: 'Cliente' }), 'Conti');
    await utente.click(await screen.findByRole('button', { name: /Conti/ }));
    await utente.click(screen.getByRole('button', { name: 'Salva appuntamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scegli almeno un servizio.');

    await utente.click(screen.getByRole('checkbox', { name: /Taglio uomo/ }));
    await utente.click(screen.getByRole('button', { name: 'Salva appuntamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scegli l’orario');

    expect(creaFinto).not.toHaveBeenCalled();
  });

  it('il titolare prenota fuori orario con giorno e ora liberi', async () => {
    const utente = userEvent.setup();
    disegna();

    await scegliClienteEServizio(utente);
    await utente.click(screen.getByRole('checkbox', { name: /Fuori orario/ }));
    await utente.type(screen.getByLabelText('Ora'), '21:40');
    await utente.click(screen.getByRole('button', { name: 'Salva appuntamento' }));

    await waitFor(() => expect(creaFinto).toHaveBeenCalledTimes(1));
    expect(creaFinto.mock.calls[0]?.[0]).toMatchObject({
      clienteId: 'cliente-1',
      operatoreId: 'operatore-1',
      servizioIds: ['servizio-1'],
      forzato: true,
      // 21:40 a Roma, con l'ora solare già in vigore il 25 ottobre 2026.
      inizio: '2026-10-25T20:40:00.000Z',
    });
  });

  it('al dipendente l’interruttore non è nemmeno offerto', async () => {
    ruoloCorrente = 'dipendente';
    disegna();

    expect(screen.queryByRole('checkbox', { name: /Fuori orario/ })).toBeNull();
  });
});
