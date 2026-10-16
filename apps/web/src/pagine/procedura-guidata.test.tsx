import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONFIGURAZIONI_PROFILO } from '@barber/shared';
import { PaginaProceduraGuidata } from './procedura-guidata';
import { ErroreApi } from '../servizi/client-api';

const completaFinto = vi.fn();
const aggiornaFinto = vi.fn();

vi.mock('../servizi/installazione', () => ({
  completaProceduraGuidata: (...argomenti: unknown[]) => completaFinto(...argomenti),
}));

vi.mock('../installazione/contesto-installazione', () => ({
  usaInstallazione: () => ({
    stato: null,
    inCaricamento: false,
    errore: null,
    aggiorna: aggiornaFinto,
  }),
}));

async function compilaFinoAiServizi() {
  render(<PaginaProceduraGuidata />);

  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));

  await userEvent.type(await screen.findByLabelText('Nome del salone'), 'Barberia Centrale');
  await userEvent.type(screen.getByLabelText('Indirizzo'), 'Via Garibaldi 14');
  await userEvent.type(screen.getByLabelText('Città'), 'Bologna');
  await userEvent.type(screen.getByLabelText('Telefono'), '+393401112233');
  await userEvent.type(screen.getByLabelText('E-mail del salone'), 'info@barberia.test');
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));

  await screen.findByLabelText("Durata di uno slot dell'agenda");
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  await screen.findByText(/Catalogo iniziale/);
}

async function compilaTitolare() {
  await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
  await userEvent.type(await screen.findByLabelText('Nome'), 'Luca');
  await userEvent.type(screen.getByLabelText('Cognome'), 'Bianchi');
  await userEvent.type(screen.getByLabelText('E-mail del titolare'), 'luca@barberia.test');
  await userEvent.type(screen.getByLabelText('Password'), 'password-di-prova-123');
}

describe('PaginaProceduraGuidata', () => {
  beforeEach(() => {
    completaFinto.mockReset().mockResolvedValue(undefined);
    aggiornaFinto.mockReset();
    document.documentElement.dataset.profilo = '';
  });

  it('parte dal profilo barbiere e applica l accento corrispondente', () => {
    render(<PaginaProceduraGuidata />);

    expect(screen.getByRole('radio', { name: /Barbiere/ })).toBeChecked();
    expect(document.documentElement.dataset.profilo).toBe('barbiere');
  });

  it('cambiando profilo aggiorna accento e catalogo proposto', async () => {
    render(<PaginaProceduraGuidata />);

    await userEvent.click(screen.getByRole('radio', { name: /Parrucchiere/ }));

    expect(document.documentElement.dataset.profilo).toBe('parrucchiere');
  });

  it('non avanza dai dati del salone se i campi non sono validi', async () => {
    render(<PaginaProceduraGuidata />);
    await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    await userEvent.type(await screen.findByLabelText('Nome del salone'), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    expect(await screen.findByText('Indica il nome del salone.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome del salone')).toBeInTheDocument();
  });

  it('mostra il catalogo del profilo e consente di escludere un servizio', async () => {
    await compilaFinoAiServizi();

    const catalogo = CONFIGURAZIONI_PROFILO.barbiere.catalogoIniziale;
    expect(
      screen.getByText(`Catalogo iniziale (${catalogo.length} selezionati)`),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(catalogo[0]!.nome) }));

    expect(
      screen.getByText(`Catalogo iniziale (${catalogo.length - 1} selezionati)`),
    ).toBeInTheDocument();
  });

  it('richiede la chiave di installazione prima di inviare', async () => {
    await compilaFinoAiServizi();
    await compilaTitolare();

    await userEvent.click(screen.getByRole('button', { name: 'Completa la configurazione' }));

    expect(await screen.findByText('Inserisci la chiave di installazione.')).toBeInTheDocument();
    expect(completaFinto).not.toHaveBeenCalled();
  });

  it('invia i dati completi e aggiorna lo stato dell installazione', async () => {
    await compilaFinoAiServizi();
    await compilaTitolare();
    await userEvent.type(screen.getByLabelText('Chiave di installazione'), 'chiave-di-prova-1234');

    await userEvent.click(screen.getByRole('button', { name: 'Completa la configurazione' }));

    await waitFor(() => expect(completaFinto).toHaveBeenCalledTimes(1));
    const [dati, chiave] = completaFinto.mock.calls[0]!;
    expect(chiave).toBe('chiave-di-prova-1234');
    expect(dati).toMatchObject({
      profilo: 'barbiere',
      salone: { nomeSalone: 'Barberia Centrale', citta: 'Bologna' },
      titolare: { email: 'luca@barberia.test' },
      granularitaSlotMinuti: 15,
    });
    expect(dati.servizi).toHaveLength(CONFIGURAZIONI_PROFILO.barbiere.catalogoIniziale.length);
    expect(aggiornaFinto).toHaveBeenCalled();
  });

  it('mostra il messaggio dell API quando la configurazione fallisce', async () => {
    completaFinto.mockRejectedValue(new ErroreApi(403, 'Chiave di installazione non valida.'));
    await compilaFinoAiServizi();
    await compilaTitolare();
    await userEvent.type(screen.getByLabelText('Chiave di installazione'), 'chiave-sbagliata-123');

    await userEvent.click(screen.getByRole('button', { name: 'Completa la configurazione' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chiave di installazione non valida.',
    );
  });
});
