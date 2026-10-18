import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { PaginaRegistrazione } from './registrazione';

const registraFinto = vi.fn();

vi.mock('../installazione/contesto-installazione', () => ({
  usaInstallazione: () => ({
    stato: {
      configurata: true,
      profilo: 'barbiere',
      nomeSalone: 'Barberia di prova',
      venditaOnlineAttiva: false,
      granularitaSlotMinuti: 15,
      oreLimitePreavviso: 24,
      spostamentoComeAnnullamento: false,
    },
    inCaricamento: false,
    errore: null,
    aggiorna: vi.fn(),
  }),
}));

vi.mock('../servizi/gestione', () => ({
  registraCliente: (dati: unknown) => registraFinto(dati),
  rinviaVerificaEmail: vi.fn(),
}));

function disegna() {
  return render(
    <MemoryRouter>
      <PaginaRegistrazione />
    </MemoryRouter>,
  );
}

async function compila(utente: ReturnType<typeof userEvent.setup>) {
  await utente.type(screen.getByLabelText('Nome'), 'Marta');
  await utente.type(screen.getByLabelText('Cognome'), 'Esposito');
  await utente.type(screen.getByLabelText('E-mail'), 'marta@cliente.test');
  await utente.type(screen.getByLabelText('Numero WhatsApp'), '+393401234567');
  await utente.type(screen.getByLabelText('Password'), 'password-di-prova-1');
}

describe('PaginaRegistrazione', () => {
  it('senza consenso al trattamento non chiama l API', async () => {
    registraFinto.mockReset();
    const utente = userEvent.setup();
    disegna();

    await compila(utente);
    await utente.click(screen.getByRole('button', { name: /Crea l/ }));

    expect(registraFinto).not.toHaveBeenCalled();
    expect(await screen.findByText(/devi accettare il trattamento/i)).toBeInTheDocument();
  });

  it('invia i consensi separati e poi invita a controllare la posta', async () => {
    registraFinto.mockReset();
    registraFinto.mockResolvedValue({
      email: 'marta@cliente.test',
      collegataASchedaEsistente: false,
    });
    const utente = userEvent.setup();
    disegna();

    await compila(utente);
    await utente.click(screen.getByRole('checkbox', { name: /trattamento dei miei dati/i }));
    await utente.click(screen.getByRole('checkbox', { name: /WhatsApp/i }));
    await utente.click(screen.getByRole('button', { name: /Crea l/ }));

    await waitFor(() => expect(registraFinto).toHaveBeenCalledTimes(1));
    expect(registraFinto).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'marta@cliente.test',
        consensoTrattamento: true,
        consensoWhatsapp: true,
      }),
    );

    expect(await screen.findByText(/Controlla la tua e-mail/i)).toBeInTheDocument();
  });

  it('segnala una password troppo corta', async () => {
    registraFinto.mockReset();
    const utente = userEvent.setup();
    disegna();

    await utente.type(screen.getByLabelText('Nome'), 'Marta');
    await utente.type(screen.getByLabelText('Cognome'), 'Esposito');
    await utente.type(screen.getByLabelText('E-mail'), 'marta@cliente.test');
    await utente.type(screen.getByLabelText('Numero WhatsApp'), '+393401234567');
    await utente.type(screen.getByLabelText('Password'), 'corta');
    await utente.click(screen.getByRole('checkbox', { name: /trattamento dei miei dati/i }));
    await utente.click(screen.getByRole('button', { name: /Crea l/ }));

    expect(registraFinto).not.toHaveBeenCalled();
    // Il messaggio di errore è collegato al campo, a differenza del
    // suggerimento che ripete la stessa regola.
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(
      await screen.findByText('La password deve avere almeno 12 caratteri.'),
    ).toBeInTheDocument();
  });
});
