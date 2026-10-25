import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RiquadroCambioPassword } from './riquadro-cambio-password';

const cambiaFinto = vi.fn();
const esciFinto = vi.fn();
const scollegaFinto = vi.fn();

vi.mock('../servizi/gestione', () => ({
  cambiaPassword: (dati: unknown) => cambiaFinto(dati),
}));

vi.mock('../autenticazione/contesto-sessione', () => ({
  usaSessione: () => ({
    utente: { id: 'u1', nome: 'Luca', cognome: 'Bianchi', ruolo: 'titolare' },
    inCaricamento: false,
    accedi: vi.fn(),
    esci: esciFinto,
    scollega: scollegaFinto,
  }),
}));

function disegna() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RiquadroCambioPassword />} />
        <Route path="/accesso" element={<p>Pagina di accesso</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function compila(utente: ReturnType<typeof userEvent.setup>) {
  await utente.type(screen.getByLabelText('Password attuale'), 'password-vecchia-1');
  await utente.type(screen.getByLabelText('Nuova password'), 'password-nuova-di-prova-1');
  await utente.click(screen.getByRole('button', { name: 'Cambia password' }));
}

describe('RiquadroCambioPassword', () => {
  beforeEach(() => {
    cambiaFinto.mockReset();
    esciFinto.mockReset();
    scollegaFinto.mockReset();
    cambiaFinto.mockResolvedValue(undefined);
  });

  it('dopo il cambio dimentica l’utente senza chiamare l’uscita, che darebbe 401', async () => {
    const utente = userEvent.setup();
    disegna();

    await compila(utente);

    await waitFor(() => expect(cambiaFinto).toHaveBeenCalledTimes(1));
    expect(scollegaFinto).toHaveBeenCalledTimes(1);
    // Il backend ha già chiuso la sessione e cancellato i cookie.
    expect(esciFinto).not.toHaveBeenCalled();
    expect(await screen.findByText('Pagina di accesso')).toBeInTheDocument();
  });

  it('mostra l’errore dell’API e resta dov’è', async () => {
    cambiaFinto.mockRejectedValue(new Error('Password attuale non corretta.'));
    const utente = userEvent.setup();
    disegna();

    await compila(utente);

    expect(await screen.findByRole('alert')).toHaveTextContent('Password non cambiata.');
    expect(scollegaFinto).not.toHaveBeenCalled();
  });

  it('non chiama l’API se la nuova password è troppo corta', async () => {
    const utente = userEvent.setup();
    disegna();

    await utente.type(screen.getByLabelText('Password attuale'), 'password-vecchia-1');
    await utente.type(screen.getByLabelText('Nuova password'), 'corta');
    await utente.click(screen.getByRole('button', { name: 'Cambia password' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(cambiaFinto).not.toHaveBeenCalled();
  });
});
