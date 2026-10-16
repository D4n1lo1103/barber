import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { PaginaAccesso } from './accesso';
import { ErroreApi } from '../servizi/client-api';

const accediFinto = vi.fn();
let utenteCorrente: unknown = null;

vi.mock('../installazione/contesto-installazione', () => ({
  usaInstallazione: () => ({
    stato: {
      configurata: true,
      profilo: 'barbiere',
      nomeSalone: 'Barberia di prova',
      venditaOnlineAttiva: false,
    },
    inCaricamento: false,
    errore: null,
    aggiorna: vi.fn(),
  }),
}));

vi.mock('../autenticazione/contesto-sessione', () => ({
  usaSessione: () => ({
    utente: utenteCorrente,
    inCaricamento: false,
    accedi: accediFinto,
    esci: vi.fn(),
  }),
}));

function disegna() {
  return render(
    <MemoryRouter>
      <PaginaAccesso />
    </MemoryRouter>,
  );
}

describe('PaginaAccesso', () => {
  it('mostra un errore di validazione senza chiamare l API', async () => {
    utenteCorrente = null;
    accediFinto.mockReset();
    disegna();

    await userEvent.type(screen.getByLabelText('E-mail'), 'non-una-email');
    await userEvent.type(screen.getByLabelText('Password'), 'password-lunga-1');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(accediFinto).not.toHaveBeenCalled();
  });

  it('invia le credenziali valide all API', async () => {
    utenteCorrente = null;
    accediFinto.mockReset().mockResolvedValue(undefined);
    disegna();

    await userEvent.type(screen.getByLabelText('E-mail'), 'titolare@salone.test');
    await userEvent.type(screen.getByLabelText('Password'), 'password-demo-salone');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() =>
      expect(accediFinto).toHaveBeenCalledWith('titolare@salone.test', 'password-demo-salone'),
    );
  });

  it('mostra il messaggio restituito dall API in caso di credenziali errate', async () => {
    utenteCorrente = null;
    accediFinto.mockReset().mockRejectedValue(new ErroreApi(401, 'Credenziali non valide.'));
    disegna();

    await userEvent.type(screen.getByLabelText('E-mail'), 'titolare@salone.test');
    await userEvent.type(screen.getByLabelText('Password'), 'password-sbagliata-1');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenziali non valide.');
  });
});
