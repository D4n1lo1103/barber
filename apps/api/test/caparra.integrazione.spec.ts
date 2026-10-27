import request from 'supertest';
import { dataLocale, giornoSettimanaLocale, istanteDaDataLocale } from '@barber/shared';
import {
  accediPerProva,
  avviaApplicazioneDiProva,
  configuraSalone,
  creaUtenteDiProva,
  PREFISSO_NUMERO_PROVA,
  rimuoviDatiDiProva,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const PASSWORD = 'password-di-prova-123';
const GIORNO_IN_MILLISECONDI = 24 * 60 * 60 * 1000;

/** Regole con la caparra attiva: il resto sono i valori di partenza. */
const REGOLE = {
  oreLimitePreavviso: 24,
  spostamentoComeAnnullamento: false,
  oreAnticipoPromemoria: 24,
  caparraAttiva: true,
  caparraPercentuale: 50,
  restituzioneCaparra: 'rimborso',
} as const;

/** Primo giovedì utile: giorno lavorativo oltre il limite di preavviso. */
function prossimoGiovedi(): string {
  let giorno = new Date(Date.now() + 3 * GIORNO_IN_MILLISECONDI);

  while (giornoSettimanaLocale(giorno) !== 4) {
    giorno = new Date(giorno.getTime() + GIORNO_IN_MILLISECONDI);
  }

  return dataLocale(giorno);
}

describe('Caparra e pagamenti', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let cliente: { cookie: string; tokenCsrf: string };
  let idOperatore: string;
  let idCliente: string;
  let idTaglio: string;
  let emailCliente: string;
  const giorno = prossimoGiovedi();

  function alle(ore: number, minuti = 0): string {
    return istanteDaDataLocale(giorno, ore * 60 + minuti)!.toISOString();
  }

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function come(
    sessione: { cookie: string; tokenCsrf: string },
    richiesta: request.Test,
  ): request.Test {
    return richiesta.set('Cookie', sessione.cookie).set('x-csrf-token', sessione.tokenCsrf);
  }

  /** Prenota e restituisce l'appuntamento creato. */
  async function prenotato(inizio = alle(10)) {
    const risposta = await prenota(inizio).expect(201);

    return risposta.body.appuntamento as {
      id: string;
      stato: string;
      caparraCentesimi: number;
      caparraPagataCentesimi: number;
      caparraDaPagareCentesimi: number;
      bloccoScadeIl: string | null;
    };
  }

  function prenota(inizio = alle(10)): request.Test {
    return come(
      cliente,
      chiama()
        .post('/api/area-cliente/appuntamenti')
        .send({ operatoreId: idOperatore, servizioIds: [idTaglio], inizio }),
    );
  }

  /** Avvia il pagamento e restituisce il riferimento del fornitore finto. */
  async function avviaPagamento(appuntamentoId: string): Promise<string> {
    const risposta = await come(
      cliente,
      chiama().post(`/api/pagamenti/appuntamenti/${appuntamentoId}`),
    ).expect(201);

    const indirizzo = new URL(risposta.body.urlPagamento as string);

    return indirizzo.searchParams.get('riferimento')!;
  }

  /** Simula l'evento del fornitore: è la stessa via del webhook firmato. */
  function esito(riferimento: string, esitoScelto: 'riuscito' | 'fallito' | 'scaduto') {
    return chiama().post('/api/pagamenti/finto/esito').send({ riferimento, esito: esitoScelto });
  }

  async function salvato(appuntamentoId: string) {
    return contesto.prisma.appuntamento.findUniqueOrThrow({ where: { id: appuntamentoId } });
  }

  async function movimenti(appuntamentoId: string) {
    return contesto.prisma.movimentoCaparra.findMany({
      where: { appuntamentoId },
      orderBy: { creatoIl: 'asc' },
      select: { tipo: true, importoCentesimi: true, motivo: true, autoreId: true },
    });
  }

  async function saldoCredito(): Promise<number> {
    const somma = await contesto.prisma.movimentoCredito.aggregate({
      where: { clienteId: idCliente },
      _sum: { importoCentesimi: true },
    });

    return somma._sum.importoCentesimi ?? 0;
  }

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteCliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
    idOperatore = utenteTitolare.id;
    idCliente = utenteCliente.id;
    emailCliente = utenteCliente.email;

    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}60001`, consensoTrattamentoIl: new Date() },
    });

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    contesto.email.svuota();
    await contesto.prisma.movimentoCredito.deleteMany();
    await contesto.prisma.movimentoCaparra.deleteMany();
    await contesto.prisma.pagamento.deleteMany();
    await contesto.prisma.eventoPagamento.deleteMany();
    await contesto.prisma.appuntamento.deleteMany();
    await contesto.prisma.servizio.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();

    const fasce = [1, 2, 3, 4, 5, 6].flatMap((giornoSettimana) => [
      { giornoSettimana, minutoInizio: 540, minutoFine: 780 },
      { giornoSettimana, minutoInizio: 900, minutoFine: 1140 },
    ]);
    await contesto.prisma.orarioApertura.createMany({ data: fasce });
    await contesto.prisma.orarioOperatore.createMany({
      data: fasce.map((fascia) => ({ ...fascia, operatoreId: idOperatore })),
    });

    const taglio = await contesto.prisma.servizio.create({
      data: {
        nome: 'Taglio con caparra',
        prezzoCentesimi: 3000,
        durataMinuti: 30,
        operatoriAbilitati: { create: [{ operatoreId: idOperatore }] },
      },
    });
    idTaglio = taglio.id;

    await come(titolare, chiama().put('/api/impostazioni/regole').send(REGOLE)).expect(200);

    contesto.limiti.azzera();
    cliente = await accediPerProva(contesto, emailCliente, PASSWORD);
  });

  afterAll(async () => {
    await contesto.prisma.movimentoCredito.deleteMany();
    await contesto.prisma.movimentoCaparra.deleteMany();
    await contesto.prisma.pagamento.deleteMany();
    await contesto.prisma.eventoPagamento.deleteMany();
    await contesto.prisma.appuntamento.deleteMany();
    await contesto.prisma.servizio.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  describe('Pagamento della caparra', () => {
    it('blocca lo slot in attesa del pagamento e non conferma prima dell’evento', async () => {
      const risposta = await prenotato();

      expect(risposta.stato).toBe('in_attesa_pagamento');
      // 50% di 30,00 €.
      expect(risposta.caparraCentesimi).toBe(1500);
      expect(risposta.caparraPagataCentesimi).toBe(0);
      expect(risposta.bloccoScadeIl).not.toBeNull();
      // La conferma arriva solo a pagamento avvenuto.
      expect(contesto.email.messaggi).toHaveLength(0);

      const pagamento = await come(
        cliente,
        chiama().post(`/api/pagamenti/appuntamenti/${risposta.id}`),
      ).expect(201);
      expect(pagamento.body.importoCentesimi).toBe(1500);
      expect(await salvato(risposta.id)).toMatchObject({ stato: 'in_attesa_pagamento' });
    });

    it('conferma l’appuntamento quando arriva l’evento e registra la caparra pagata', async () => {
      const appuntamento = await prenotato();
      const riferimento = await avviaPagamento(appuntamento.id);

      await esito(riferimento, 'riuscito').expect(204);

      expect(await salvato(appuntamento.id)).toMatchObject({
        stato: 'confermato',
        bloccoScadeIl: null,
      });
      expect(await movimenti(appuntamento.id)).toEqual([
        expect.objectContaining({ tipo: 'pagata', importoCentesimi: 1500, autoreId: null }),
      ]);
    });

    it('ignora lo stesso evento ricevuto due volte', async () => {
      const appuntamento = await prenotato();
      const riferimento = await avviaPagamento(appuntamento.id);

      await esito(riferimento, 'riuscito').expect(204);
      await esito(riferimento, 'riuscito').expect(204);

      // Un solo movimento: l'evento ripetuto non muove denaro una seconda volta.
      expect(await movimenti(appuntamento.id)).toHaveLength(1);
    });

    it('un evento senza firma valida non conferma nulla', async () => {
      const appuntamento = await prenotato();
      await avviaPagamento(appuntamento.id);

      await chiama()
        .post('/api/pagamenti/webhook')
        .set('Content-Type', 'application/json')
        .send({ id: 'evt_falso', tipo: 'finto.riuscito', esito: 'riuscito' })
        .expect(400);

      expect(await salvato(appuntamento.id)).toMatchObject({ stato: 'in_attesa_pagamento' });
      expect(await movimenti(appuntamento.id)).toHaveLength(0);
    });

    it('un pagamento non riuscito lascia lo slot in attesa fino alla scadenza', async () => {
      const appuntamento = await prenotato();
      const riferimento = await avviaPagamento(appuntamento.id);

      await esito(riferimento, 'fallito').expect(204);

      expect(await salvato(appuntamento.id)).toMatchObject({ stato: 'in_attesa_pagamento' });
      const pagamento = await contesto.prisma.pagamento.findFirstOrThrow({
        where: { appuntamentoId: appuntamento.id },
      });
      expect(pagamento.stato).toBe('fallito');
    });

    it('alla scadenza del blocco lo slot torna libero e si può riprenotare', async () => {
      const appuntamento = await prenotato();

      // Il blocco scade: nei test la coda è in linea, quindi si forza l'istante.
      await contesto.prisma.appuntamento.update({
        where: { id: appuntamento.id },
        data: { bloccoScadeIl: new Date(Date.now() - 1000) },
      });

      const nuovo = await prenotato();

      expect(await salvato(appuntamento.id)).toMatchObject({
        stato: 'annullato',
        motivoAnnullamento: 'pagamento_non_completato',
      });
      expect(nuovo.id).not.toBe(appuntamento.id);
    });

    it('non si paga un appuntamento di un altro cliente', async () => {
      const appuntamento = await prenotato();

      await come(titolare, chiama().post(`/api/pagamenti/appuntamenti/${appuntamento.id}`)).expect(
        403,
      );
    });
  });

  describe('Restituzione della caparra', () => {
    /** Prenota e porta a termine il pagamento. */
    async function prenotaEPaga(inizio = alle(10)) {
      const appuntamento = await prenotato(inizio);
      const riferimento = await avviaPagamento(appuntamento.id);
      await esito(riferimento, 'riuscito').expect(204);

      return appuntamento.id as string;
    }

    it('l’annullamento tempestivo del cliente rimborsa la caparra', async () => {
      const id = await prenotaEPaga();

      await come(
        cliente,
        chiama().post(`/api/area-cliente/appuntamenti/${id}/annullamento`),
      ).expect(201);

      expect(await movimenti(id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'rimborsata', importoCentesimi: 1500 }),
      ]);
      const pagamento = await contesto.prisma.pagamento.findFirstOrThrow({
        where: { appuntamentoId: id, stato: 'rimborsato' },
      });
      expect(pagamento.riferimentoRimborso).toContain('rimborso_finto');
      // Nessun credito: la forma scelta dal salone è il rimborso.
      expect(await saldoCredito()).toBe(0);
    });

    it('due annullamenti simultanei restituiscono la caparra una volta sola', async () => {
      const id = await prenotaEPaga();
      contesto.limiti.azzera();

      const annulla = () =>
        come(cliente, chiama().post(`/api/area-cliente/appuntamenti/${id}/annullamento`));
      const [primo, secondo] = await Promise.all([annulla(), annulla()]);

      // Uno solo passa. L'altro viene rifiutato: con 409 se ha corso davvero
      // in parallelo, con 400 se è arrivato quando il primo aveva già chiuso.
      const esiti = [primo.status, secondo.status].sort();
      expect(esiti[0]).toBe(201);
      expect([400, 409]).toContain(esiti[1]);

      const rimborsi = (await movimenti(id)).filter((movimento) => movimento.tipo === 'rimborsata');
      expect(rimborsi).toHaveLength(1);
      expect(await saldoCredito()).toBe(0);
    });

    it('con la restituzione in credito l’annullamento tempestivo accredita il cliente', async () => {
      await come(
        titolare,
        chiama()
          .put('/api/impostazioni/regole')
          .send({ ...REGOLE, restituzioneCaparra: 'credito' }),
      ).expect(200);
      const id = await prenotaEPaga();

      await come(
        cliente,
        chiama().post(`/api/area-cliente/appuntamenti/${id}/annullamento`),
      ).expect(201);

      expect(await movimenti(id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'convertita_in_credito', importoCentesimi: 1500 }),
      ]);
      expect(await saldoCredito()).toBe(1500);
    });

    it('l’annullamento tardivo registrato dal personale trattiene la caparra', async () => {
      const id = await prenotaEPaga();

      await come(
        titolare,
        chiama()
          .post(`/api/appuntamenti/${id}/annullamento`)
          .send({ motivo: 'tardivo', note: 'Avvisato due ore prima.' }),
      ).expect(201);

      expect(await movimenti(id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'trattenuta', importoCentesimi: 1500 }),
      ]);
      expect(await saldoCredito()).toBe(0);
    });

    it('l’annullamento dal salone rimborsa per intero anche con la restituzione in credito', async () => {
      await come(
        titolare,
        chiama()
          .put('/api/impostazioni/regole')
          .send({ ...REGOLE, restituzioneCaparra: 'credito' }),
      ).expect(200);
      const id = await prenotaEPaga();

      await come(
        titolare,
        chiama()
          .post(`/api/appuntamenti/${id}/annullamento`)
          .send({ motivo: 'dal_salone', note: 'Operatore influenzato.' }),
      ).expect(201);

      expect(await movimenti(id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'rimborsata', importoCentesimi: 1500 }),
      ]);
      expect(await saldoCredito()).toBe(0);
    });

    it('la mancata presentazione trattiene la caparra, il completamento la scala', async () => {
      const idMancato = await prenotaEPaga(alle(10));
      const idCompletato = await prenotaEPaga(alle(11));

      await come(
        titolare,
        chiama().post(`/api/appuntamenti/${idMancato}/mancata-presentazione`),
      ).expect(201);
      await come(titolare, chiama().post(`/api/appuntamenti/${idCompletato}/completamento`)).expect(
        201,
      );

      expect(await movimenti(idMancato)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'trattenuta', importoCentesimi: 1500 }),
      ]);
      expect(await movimenti(idCompletato)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'scalata', importoCentesimi: 1500 }),
      ]);
    });
  });

  describe('Restituzione discrezionale', () => {
    async function trattieni(): Promise<string> {
      const appuntamento = await prenotato();
      const riferimento = await avviaPagamento(appuntamento.id);
      await esito(riferimento, 'riuscito').expect(204);
      await come(
        titolare,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/annullamento`)
          .send({ motivo: 'tardivo', note: '' }),
      ).expect(201);

      return appuntamento.id as string;
    }

    it('solo il titolare la esegue, con motivazione obbligatoria', async () => {
      const id = await trattieni();

      await come(
        cliente,
        chiama()
          .post(`/api/pagamenti/appuntamenti/${id}/restituzione`)
          .send({ forma: 'credito', motivo: 'Cliente abituale.' }),
      ).expect(403);

      await come(
        titolare,
        chiama().post(`/api/pagamenti/appuntamenti/${id}/restituzione`).send({
          forma: 'credito',
          motivo: '',
        }),
      ).expect(400);

      await come(
        titolare,
        chiama().post(`/api/pagamenti/appuntamenti/${id}/restituzione`).send({
          forma: 'credito',
          motivo: 'Cliente abituale, prima dimenticanza.',
        }),
      ).expect(204);

      expect(await movimenti(id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'trattenuta' }),
        expect.objectContaining({
          tipo: 'restituita_discrezionale',
          importoCentesimi: 1500,
          motivo: 'Cliente abituale, prima dimenticanza.',
        }),
      ]);
      expect(await saldoCredito()).toBe(1500);
    });

    it('non si restituisce due volte, né dove non c’è nulla di trattenuto', async () => {
      const id = await trattieni();
      const corpo = { forma: 'rimborso', motivo: 'Restituzione concordata.' };

      await come(
        titolare,
        chiama().post(`/api/pagamenti/appuntamenti/${id}/restituzione`).send(corpo),
      ).expect(204);
      await come(
        titolare,
        chiama().post(`/api/pagamenti/appuntamenti/${id}/restituzione`).send(corpo),
      ).expect(400);
    });
  });

  describe('Credito del cliente', () => {
    async function accredita(importoCentesimi: number): Promise<void> {
      await contesto.prisma.movimentoCredito.create({
        data: { clienteId: idCliente, importoCentesimi, motivo: 'Credito di prova.' },
      });
    }

    it('un credito sufficiente copre la caparra e conferma subito l’appuntamento', async () => {
      await accredita(2000);

      const risposta = await prenotato();

      expect(risposta.stato).toBe('confermato');
      expect(risposta.caparraPagataCentesimi).toBe(1500);
      expect(risposta.bloccoScadeIl).toBeNull();
      // Il credito speso resta tracciato: 20,00 € meno i 15,00 € della caparra.
      expect(await saldoCredito()).toBe(500);
      // L'appuntamento è confermato, quindi la conferma parte subito.
      expect(contesto.email.messaggi.at(-1)?.oggetto).toContain('appuntamento confermato');
    });

    it('un credito parziale copre una parte e lascia la differenza da pagare', async () => {
      await accredita(1000);

      const appuntamento = await prenotato();

      expect(appuntamento.stato).toBe('in_attesa_pagamento');
      expect(appuntamento.caparraPagataCentesimi).toBe(1000);
      expect(await saldoCredito()).toBe(0);

      const pagamento = await come(
        cliente,
        chiama().post(`/api/pagamenti/appuntamenti/${appuntamento.id}`),
      ).expect(201);
      // Si paga solo la differenza: 15,00 € meno i 10,00 € di credito.
      expect(pagamento.body.importoCentesimi).toBe(500);
    });

    it('se la differenza non viene pagata il credito usato torna al cliente', async () => {
      await accredita(1000);
      const appuntamento = await prenotato();
      expect(await saldoCredito()).toBe(0);

      await contesto.prisma.appuntamento.update({
        where: { id: appuntamento.id },
        data: { bloccoScadeIl: new Date(Date.now() - 1000) },
      });

      // Basta consultare la disponibilità: i blocchi scaduti vengono chiusi
      // prima di contare gli slot liberi.
      await come(
        cliente,
        chiama()
          .get('/api/area-cliente/disponibilita')
          .query({ operatoreId: idOperatore, servizioIds: idTaglio, dal: giorno, giorni: 1 }),
      ).expect(200);

      expect(await salvato(appuntamento.id)).toMatchObject({
        stato: 'annullato',
        motivoAnnullamento: 'pagamento_non_completato',
      });
      expect(await saldoCredito()).toBe(1000);
    });

    it('due prenotazioni simultanee non spendono due volte lo stesso credito', async () => {
      // Credito per una sola caparra da 15,00 €.
      await accredita(1500);

      const [prima, seconda] = await Promise.all([prenota(alle(10)), prenota(alle(11))]);
      const esiti = [prima.status, seconda.status].sort();

      // La prima passa sempre. La seconda o viene rifiutata, perché il credito
      // è stato appena speso, o passa senza credito e con la caparra da pagare:
      // quello che non può succedere è spenderlo due volte.
      expect(esiti[0]).toBe(201);
      expect([201, 409]).toContain(esiti[1]);

      const movimentiNegativi = await contesto.prisma.movimentoCredito.findMany({
        where: { clienteId: idCliente, importoCentesimi: { lt: 0 } },
      });
      expect(movimentiNegativi).toHaveLength(1);
      expect(movimentiNegativi[0]?.importoCentesimi).toBe(-1500);
      // Il saldo non va mai sotto zero.
      expect(await saldoCredito()).toBe(0);

      // Una prenotazione rifiutata non lascia dietro di sé un appuntamento.
      const appuntamenti = await contesto.prisma.appuntamento.count({
        where: { clienteId: idCliente },
      });
      expect(appuntamenti).toBe(esiti.filter((stato) => stato === 201).length);
    });
  });

  describe('Spostamento trattato come un annullamento', () => {
    it('restituisce la caparra e chiede una nuova caparra sul nuovo orario', async () => {
      await come(
        titolare,
        chiama()
          .put('/api/impostazioni/regole')
          .send({ ...REGOLE, spostamentoComeAnnullamento: true, restituzioneCaparra: 'credito' }),
      ).expect(200);

      const appuntamento = await prenotato(alle(10));
      const riferimento = await avviaPagamento(appuntamento.id);
      await esito(riferimento, 'riuscito').expect(204);

      const spostato = await come(
        cliente,
        chiama()
          .post(`/api/area-cliente/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(11) }),
      ).expect(201);

      // Il vecchio appuntamento è annullato e la caparra è tornata in credito.
      expect(await salvato(appuntamento.id)).toMatchObject({
        stato: 'annullato',
        motivoAnnullamento: 'tempestivo',
      });
      expect(await movimenti(appuntamento.id)).toEqual([
        expect.objectContaining({ tipo: 'pagata' }),
        expect.objectContaining({ tipo: 'convertita_in_credito', importoCentesimi: 1500 }),
      ]);

      // Il nuovo appuntamento è un'altra riga, con la propria caparra: il
      // credito appena restituito la copre per intero.
      expect(spostato.body.appuntamento.id).not.toBe(appuntamento.id);
      expect(spostato.body.appuntamento.stato).toBe('confermato');
      expect(spostato.body.appuntamento.caparraPagataCentesimi).toBe(1500);
      expect(await saldoCredito()).toBe(0);
    });

    it('con lo spostamento libero l’appuntamento si sposta e la caparra resta', async () => {
      const appuntamento = await prenotato(alle(10));
      const riferimento = await avviaPagamento(appuntamento.id);
      await esito(riferimento, 'riuscito').expect(204);

      const spostato = await come(
        cliente,
        chiama()
          .post(`/api/area-cliente/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(11) }),
      ).expect(201);

      expect(spostato.body.appuntamento.id).toBe(appuntamento.id);
      expect(spostato.body.appuntamento.stato).toBe('confermato');
      expect(await movimenti(appuntamento.id)).toEqual([
        expect.objectContaining({ tipo: 'pagata', importoCentesimi: 1500 }),
      ]);
    });
  });
});
