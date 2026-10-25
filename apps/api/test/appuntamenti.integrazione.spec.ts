import request from 'supertest';
import {
  dataLocale,
  giornoSettimanaLocale,
  istanteDaDataLocale,
  type Appuntamento,
} from '@barber/shared';
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

/** Primo mercoledì utile: giorno lavorativo, dentro i 60 giorni consentiti. */
function prossimoMercoledi(): string {
  let giorno = new Date(Date.now() + GIORNO_IN_MILLISECONDI);

  while (giornoSettimanaLocale(giorno) !== 3) {
    giorno = new Date(giorno.getTime() + GIORNO_IN_MILLISECONDI);
  }

  return dataLocale(giorno);
}

describe('Agenda del personale', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let sessioneCliente: { cookie: string; tokenCsrf: string };
  let idTitolare: string;
  let idDipendente: string;
  let idCliente: string;
  let idTaglio: string;
  let idBarba: string;
  let idColore: string;
  const giorno = prossimoMercoledi();

  /** Orario locale del salone nel giorno di prova, in formato ISO UTC. */
  function alle(ore: number, minuti = 0): string {
    return istanteDaDataLocale(giorno, ore * 60 + minuti)!.toISOString();
  }

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const utenteCliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
    idTitolare = utenteTitolare.id;
    idDipendente = utenteDipendente.id;
    idCliente = utenteCliente.id;

    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}10001` },
    });

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
    sessioneCliente = await accediPerProva(contesto, utenteCliente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.appuntamento.deleteMany();
    await contesto.prisma.assenza.deleteMany();
    await contesto.prisma.servizio.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();

    // Salone aperto 9:00–13:00 e 15:00–19:00 dal lunedì al venerdì;
    // entrambi gli operatori lavorano negli stessi orari.
    const fasce = [1, 2, 3, 4, 5].flatMap((giornoSettimana) => [
      { giornoSettimana, minutoInizio: 540, minutoFine: 780 },
      { giornoSettimana, minutoInizio: 900, minutoFine: 1140 },
    ]);

    await contesto.prisma.orarioApertura.createMany({ data: fasce });
    await contesto.prisma.orarioOperatore.createMany({
      data: [idTitolare, idDipendente].flatMap((operatoreId) =>
        fasce.map((fascia) => ({ ...fascia, operatoreId })),
      ),
    });

    const taglio = await contesto.prisma.servizio.create({
      data: {
        nome: 'Taglio di prova',
        prezzoCentesimi: 2000,
        durataMinuti: 30,
        operatoriAbilitati: {
          create: [{ operatoreId: idTitolare }, { operatoreId: idDipendente }],
        },
      },
    });
    const barba = await contesto.prisma.servizio.create({
      data: {
        nome: 'Barba di prova',
        prezzoCentesimi: 1000,
        durataMinuti: 15,
        operatoriAbilitati: {
          create: [{ operatoreId: idTitolare }, { operatoreId: idDipendente }],
        },
      },
    });
    // Servizio che solo il titolare è abilitato a erogare.
    const colore = await contesto.prisma.servizio.create({
      data: {
        nome: 'Colore di prova',
        prezzoCentesimi: 4000,
        durataMinuti: 60,
        operatoriAbilitati: { create: [{ operatoreId: idTitolare }] },
      },
    });

    idTaglio = taglio.id;
    idBarba = barba.id;
    idColore = colore.id;
  });

  afterAll(async () => {
    await contesto.prisma.appuntamento.deleteMany();
    await contesto.prisma.assenza.deleteMany();
    await contesto.prisma.servizio.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function come(
    sessione: { cookie: string; tokenCsrf: string },
    richiesta: request.Test,
  ): request.Test {
    return richiesta.set('Cookie', sessione.cookie).set('x-csrf-token', sessione.tokenCsrf);
  }

  function prenota(
    sessione: { cookie: string; tokenCsrf: string },
    modifiche: Record<string, unknown> = {},
  ): request.Test {
    return come(
      sessione,
      chiama()
        .post('/api/appuntamenti')
        .send({
          clienteId: idCliente,
          operatoreId: idDipendente,
          servizioIds: [idTaglio],
          inizio: alle(9),
          ...modifiche,
        }),
    );
  }

  describe('Inserimento dal personale', () => {
    it('somma durate e prezzi dei servizi scelti e conferma l’appuntamento', async () => {
      const risposta = await prenota(dipendente, { servizioIds: [idTaglio, idBarba] }).expect(201);
      const appuntamento = risposta.body as Appuntamento;

      expect(appuntamento.durataMinuti).toBe(45);
      expect(appuntamento.prezzoTotaleCentesimi).toBe(3000);
      expect(appuntamento.stato).toBe('confermato');
      expect(appuntamento.creatoDaPersonale).toBe(true);
      // Un appuntamento inserito dal personale non prevede caparra: si paga
      // online, e al telefono il cliente non può farlo.
      expect(appuntamento.senzaCaparra).toBe(true);
      expect(appuntamento.caparraCentesimi).toBe(0);
      expect(appuntamento.servizi.map((servizio) => servizio.nome)).toEqual([
        'Taglio di prova',
        'Barba di prova',
      ]);
      expect(new Date(appuntamento.fine).getTime() - new Date(appuntamento.inizio).getTime()).toBe(
        45 * 60_000,
      );
    });

    it('non chiede la caparra nemmeno con la caparra attiva nelle impostazioni', async () => {
      await come(
        titolare,
        chiama().put('/api/impostazioni/regole').send({
          oreLimitePreavviso: 24,
          spostamentoComeAnnullamento: false,
          oreAnticipoPromemoria: 24,
          caparraAttiva: true,
          caparraPercentuale: 50,
          restituzioneCaparra: 'rimborso',
        }),
      ).expect(200);

      const risposta = await prenota(dipendente).expect(201);

      expect(risposta.body.senzaCaparra).toBe(true);
      expect(risposta.body.caparraCentesimi).toBe(0);
      expect(risposta.body.stato).toBe('confermato');
    });

    it('copia nome, prezzo e durata del servizio: il listino può cambiare dopo', async () => {
      const creato = await prenota(dipendente).expect(201);

      await contesto.prisma.servizio.update({
        where: { id: idTaglio },
        data: { nome: 'Taglio rinominato', prezzoCentesimi: 9900 },
      });

      const riletto = await come(
        dipendente,
        chiama().get(`/api/appuntamenti/${creato.body.id}`),
      ).expect(200);

      expect(riletto.body.servizi[0].nome).toBe('Taglio di prova');
      expect(riletto.body.prezzoTotaleCentesimi).toBe(2000);
    });

    it('un dipendente può prenotare anche sull’agenda di un collega', async () => {
      await prenota(dipendente, { operatoreId: idTitolare }).expect(201);
    });

    it('rifiuta un orario fuori dagli orari di lavoro dell’operatore', async () => {
      // 14:00 cade nella pausa fra le due fasce.
      const risposta = await prenota(dipendente, { inizio: alle(14) }).expect(400);

      expect(risposta.body.message).toContain('09:00');
    });

    it('rifiuta un appuntamento che sfora la fine della fascia', async () => {
      await prenota(dipendente, { inizio: alle(12, 45), servizioIds: [idTaglio] }).expect(400);
    });

    it('rifiuta un orario non allineato alla granularità', async () => {
      const risposta = await prenota(dipendente, { inizio: alle(9, 7) }).expect(400);

      expect(risposta.body.message).toContain('15 minuti');
    });

    it('rifiuta un operatore non abilitato a tutti i servizi scelti', async () => {
      const risposta = await prenota(dipendente, { servizioIds: [idTaglio, idColore] }).expect(400);

      expect(risposta.body.message).toContain('Colore di prova');
    });

    it('rifiuta la sovrapposizione con un appuntamento già presente', async () => {
      await prenota(dipendente).expect(201);

      await prenota(dipendente, { inizio: alle(9, 15) }).expect(409);
    });

    it('lascia prenotare nell’istante in cui finisce l’appuntamento precedente', async () => {
      await prenota(dipendente).expect(201);

      await prenota(dipendente, { inizio: alle(9, 30) }).expect(201);
    });

    it('rifiuta un orario coperto da un’assenza dell’operatore', async () => {
      await contesto.prisma.assenza.create({
        data: {
          operatoreId: idDipendente,
          tipo: 'ferie',
          inizio: new Date(alle(8)),
          fine: new Date(alle(13)),
        },
      });

      await prenota(dipendente).expect(409);
    });

    it('rifiuta un orario dentro una chiusura del salone', async () => {
      await come(
        titolare,
        chiama().post('/api/orari/chiusure').send({ dal: giorno, al: giorno, motivo: 'Festività' }),
      ).expect(201);

      // La chiusura rende occupati tutti gli operatori, non solo uno.
      await prenota(dipendente).expect(409);
      await prenota(dipendente, { operatoreId: idTitolare, inizio: alle(10) }).expect(409);
    });

    it('rifiuta le date oltre i limiti consentiti', async () => {
      const fraTreMesi = new Date(Date.now() + 90 * GIORNO_IN_MILLISECONDI);
      const dieciGiorniFa = new Date(Date.now() - 10 * GIORNO_IN_MILLISECONDI);

      await prenota(dipendente, {
        inizio: istanteDaDataLocale(dataLocale(fraTreMesi), 540)!.toISOString(),
      }).expect(400);
      await prenota(dipendente, {
        inizio: istanteDaDataLocale(dataLocale(dieciGiorniFa), 540)!.toISOString(),
      }).expect(400);
    });

    it('valida i dati e rifiuta servizi ripetuti o assenti', async () => {
      await prenota(dipendente, { servizioIds: [] }).expect(400);
      await prenota(dipendente, { servizioIds: [idTaglio, idTaglio] }).expect(400);
      await prenota(dipendente, { inizio: 'domani alle nove' }).expect(400);
    });

    it('non è raggiungibile dai clienti né senza sessione', async () => {
      await prenota(sessioneCliente).expect(403);
      await chiama().get(`/api/appuntamenti?dal=${giorno}`).expect(401);
    });
  });

  describe('Prenotazione forzata del titolare', () => {
    it('inserisce fuori dagli orari di lavoro dell’operatore', async () => {
      // 14:00 cade nella pausa fra le due fasce: senza deroga verrebbe rifiutato.
      const risposta = await prenota(titolare, { inizio: alle(14), forzato: true }).expect(201);

      expect((risposta.body as Appuntamento).forzato).toBe(true);
    });

    it('inserisce su un orario non allineato alla granularità', async () => {
      await prenota(titolare, { inizio: alle(9, 7), forzato: true }).expect(201);
    });

    it('inserisce sopra un appuntamento già presente, sullo stesso operatore', async () => {
      await prenota(dipendente).expect(201);

      await prenota(titolare, { inizio: alle(9, 15), forzato: true }).expect(201);
    });

    it('inserisce dentro un’assenza dell’operatore', async () => {
      await contesto.prisma.assenza.create({
        data: {
          operatoreId: idDipendente,
          tipo: 'ferie',
          inizio: new Date(alle(8)),
          fine: new Date(alle(13)),
        },
      });

      await prenota(titolare, { forzato: true }).expect(201);
    });

    it('inserisce in un giorno di chiusura del salone', async () => {
      await come(
        titolare,
        chiama().post('/api/orari/chiusure').send({ dal: giorno, al: giorno, motivo: 'Festività' }),
      ).expect(201);

      await prenota(titolare, { forzato: true }).expect(201);
    });

    it('rifiuta la deroga al dipendente', async () => {
      const risposta = await prenota(dipendente, { inizio: alle(14), forzato: true }).expect(403);

      expect(risposta.body.message).toContain('titolare');
    });

    it('resta dentro i limiti di data anche per il titolare', async () => {
      const fraTreMesi = new Date(Date.now() + 90 * GIORNO_IN_MILLISECONDI);

      await prenota(titolare, {
        inizio: istanteDaDataLocale(dataLocale(fraTreMesi), 540)!.toISOString(),
        forzato: true,
      }).expect(400);
    });

    it('un appuntamento forzato toglie comunque lo slot alle prenotazioni normali', async () => {
      await prenota(titolare, { forzato: true }).expect(201);

      await prenota(dipendente).expect(409);
    });

    it('non compare fra gli slot liberi proposti', async () => {
      await prenota(titolare, { forzato: true }).expect(201);

      const risposta = await come(
        dipendente,
        chiama()
          .get('/api/appuntamenti/disponibilita')
          .query({ operatoreId: idDipendente, servizioIds: idTaglio, dal: giorno }),
      ).expect(200);

      expect(risposta.body.giorni[0].slot).not.toContain(alle(9));
    });
  });

  describe('Doppie prenotazioni simultanee', () => {
    it('su due richieste contemporanee solo una va a buon fine', async () => {
      const esiti = await Promise.all([
        prenota(dipendente).ok(() => true),
        prenota(dipendente).ok(() => true),
      ]);
      const codici = esiti.map((esito) => esito.status).sort();

      expect(codici).toEqual([201, 409]);

      const salvati = await contesto.prisma.appuntamento.count({
        where: { operatoreId: idDipendente, stato: { not: 'annullato' } },
      });
      expect(salvati).toBe(1);
    });
  });

  describe('Disponibilità', () => {
    function disponibilita(parametri: Record<string, string> = {}) {
      const query = new URLSearchParams({
        operatoreId: idDipendente,
        servizioIds: idTaglio,
        dal: giorno,
        ...parametri,
      });

      return come(dipendente, chiama().get(`/api/appuntamenti/disponibilita?${query.toString()}`));
    }

    it('propone solo gli slot dentro gli orari di lavoro', async () => {
      const risposta = await disponibilita().expect(200);
      const slot: string[] = risposta.body.giorni[0].slot;

      expect(risposta.body.giorni).toHaveLength(1);
      expect(slot[0]).toBe(alle(9));
      // 9:00–12:30 e 15:00–18:30 con slot da 15 minuti per un servizio da 30.
      expect(slot).toHaveLength(30);
      expect(slot).not.toContain(alle(13));
      expect(slot).toContain(alle(15));
    });

    it('esclude gli orari occupati da un appuntamento', async () => {
      await prenota(dipendente).expect(201);

      const slot: string[] = await disponibilita()
        .expect(200)
        .then((esito) => esito.body.giorni[0].slot);

      expect(slot).not.toContain(alle(9));
      expect(slot).not.toContain(alle(9, 15));
      expect(slot).toContain(alle(9, 30));
    });

    it('può escludere l’appuntamento che si sta spostando', async () => {
      const creato = await prenota(dipendente).expect(201);

      const slot: string[] = await disponibilita({ escludiAppuntamentoId: creato.body.id })
        .expect(200)
        .then((esito) => esito.body.giorni[0].slot);

      expect(slot).toContain(alle(9));
    });

    it('restituisce un giorno per ciascuno di quelli richiesti', async () => {
      const risposta = await disponibilita({ giorni: '7' }).expect(200);

      expect(risposta.body.giorni).toHaveLength(7);
      expect(risposta.body.giorni[0].giorno).toBe(giorno);
    });

    it('rifiuta un operatore non abilitato ai servizi scelti', async () => {
      await disponibilita({ servizioIds: idColore }).expect(400);
    });
  });

  describe('Tutela degli appuntamenti già fissati', () => {
    it('rifiuta orari di lavoro che lascerebbero fuori un appuntamento futuro', async () => {
      await prenota(dipendente, { inizio: alle(11) }).expect(201);

      const risposta = await come(
        titolare,
        chiama()
          .put(`/api/orari/operatori/${idDipendente}`)
          .send({ fasce: [{ giornoSettimana: 3, minutoInizio: 540, minutoFine: 600 }] }),
      ).expect(400);

      expect(risposta.body.message).toContain('11:00');
    });

    it('rifiuta un’assenza che coprirebbe un appuntamento in agenda', async () => {
      await prenota(dipendente, { inizio: alle(11) }).expect(201);

      const risposta = await come(
        titolare,
        chiama()
          .post('/api/orari/assenze')
          .send({
            operatoreId: idDipendente,
            tipo: 'ferie',
            inizio: alle(9),
            fine: alle(13),
          }),
      ).expect(400);

      expect(risposta.body.message).toContain('appuntamenti in agenda');
    });

    it('accetta l’assenza se l’appuntamento è stato annullato', async () => {
      const creato = await prenota(dipendente, { inizio: alle(11) }).expect(201);

      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${creato.body.id}/annullamento`)
          .send({ motivo: 'tempestivo' }),
      ).expect(201);

      await come(
        titolare,
        chiama()
          .post('/api/orari/assenze')
          .send({ operatoreId: idDipendente, tipo: 'ferie', inizio: alle(9), fine: alle(13) }),
      ).expect(201);
    });
  });

  describe('Agenda e storico', () => {
    it('elenca gli appuntamenti del giorno e filtra per operatore', async () => {
      await prenota(dipendente).expect(201);
      await prenota(dipendente, { operatoreId: idTitolare, inizio: alle(10) }).expect(201);

      const tutti = await come(dipendente, chiama().get(`/api/appuntamenti?dal=${giorno}`)).expect(
        200,
      );
      expect(tutti.body.appuntamenti).toHaveLength(2);

      const soloTitolare = await come(
        dipendente,
        chiama().get(`/api/appuntamenti?dal=${giorno}&operatoreId=${idTitolare}`),
      ).expect(200);
      expect(soloTitolare.body.appuntamenti).toHaveLength(1);
      expect(soloTitolare.body.appuntamenti[0].operatore.id).toBe(idTitolare);
    });

    it('restituisce lo storico del cliente dal più recente', async () => {
      await prenota(dipendente).expect(201);
      await prenota(dipendente, { inizio: alle(11) }).expect(201);

      const storico = await come(
        dipendente,
        chiama().get(`/api/appuntamenti/cliente/${idCliente}`),
      ).expect(200);

      expect(storico.body.appuntamenti).toHaveLength(2);
      expect(storico.body.appuntamenti[0].inizio).toBe(alle(11));
    });

    it('rifiuta una data non valida', async () => {
      await come(dipendente, chiama().get('/api/appuntamenti?dal=18-10-2026')).expect(400);
    });
  });

  describe('Spostamento, annullamento, mancata presentazione e completamento', () => {
    async function appuntamentoDiProva(): Promise<Appuntamento> {
      const risposta = await prenota(dipendente).expect(201);

      return risposta.body as Appuntamento;
    }

    it('sposta l’appuntamento su un orario libero, mantenendo la durata', async () => {
      const appuntamento = await appuntamentoDiProva();

      const spostato = await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(16) }),
      ).expect(201);

      expect(spostato.body.inizio).toBe(alle(16));
      expect(spostato.body.durataMinuti).toBe(30);
    });

    it('rifiuta lo spostamento su uno slot occupato o fuori orario', async () => {
      const appuntamento = await appuntamentoDiProva();
      await prenota(dipendente, { inizio: alle(10) }).expect(201);

      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(10) }),
      ).expect(409);

      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(14) }),
      ).expect(400);
    });

    it('rifiuta lo spostamento su un operatore non abilitato', async () => {
      const risposta = await prenota(dipendente, {
        operatoreId: idTitolare,
        servizioIds: [idColore],
      }).expect(201);

      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${risposta.body.id}/spostamento`)
          .send({ inizio: alle(10), operatoreId: idDipendente }),
      ).expect(400);
    });

    it('annulla indicando il motivo e libera lo slot', async () => {
      const appuntamento = await appuntamentoDiProva();

      const annullato = await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/annullamento`)
          .send({ motivo: 'tardivo', note: 'Avvisato per telefono.' }),
      ).expect(201);

      expect(annullato.body.stato).toBe('annullato');
      expect(annullato.body.motivoAnnullamento).toBe('tardivo');

      const salvato = await contesto.prisma.appuntamento.findUnique({
        where: { id: appuntamento.id },
      });
      expect(salvato?.annullatoDaId).not.toBeNull();
      expect(salvato?.annullatoIl).not.toBeNull();
      expect(salvato?.noteAnnullamento).toBe('Avvisato per telefono.');

      // Lo slot torna disponibile.
      await prenota(dipendente).expect(201);
    });

    it('richiede un motivo valido per l’annullamento', async () => {
      const appuntamento = await appuntamentoDiProva();

      await come(
        dipendente,
        chiama().post(`/api/appuntamenti/${appuntamento.id}/annullamento`).send({}),
      ).expect(400);
      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/annullamento`)
          .send({ motivo: 'pagamento_non_completato' }),
      ).expect(400);
    });

    it('la mancata presentazione tiene occupato lo slot', async () => {
      const appuntamento = await appuntamentoDiProva();

      const segnato = await come(
        dipendente,
        chiama().post(`/api/appuntamenti/${appuntamento.id}/mancata-presentazione`).send({}),
      ).expect(201);
      expect(segnato.body.stato).toBe('mancata_presentazione');

      await prenota(dipendente).expect(409);
    });

    it('il completamento è manuale e chiude il ciclo di vita', async () => {
      const appuntamento = await appuntamentoDiProva();

      const completato = await come(
        dipendente,
        chiama().post(`/api/appuntamenti/${appuntamento.id}/completamento`).send({}),
      ).expect(201);
      expect(completato.body.stato).toBe('completato');

      // Da completato non si torna indietro.
      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/annullamento`)
          .send({ motivo: 'tardivo' }),
      ).expect(400);
      await come(
        dipendente,
        chiama()
          .post(`/api/appuntamenti/${appuntamento.id}/spostamento`)
          .send({ inizio: alle(16) }),
      ).expect(400);
    });

    it('il titolare può chiudere un appuntamento inserito da un dipendente', async () => {
      const appuntamento = await appuntamentoDiProva();

      const completato = await come(
        titolare,
        chiama().post(`/api/appuntamenti/${appuntamento.id}/completamento`).send({}),
      ).expect(201);

      expect(completato.body.stato).toBe('completato');
    });

    it('restituisce 404 su un appuntamento inesistente', async () => {
      await come(
        dipendente,
        chiama().get('/api/appuntamenti/2f1c9b4a-0000-4000-8000-000000000000'),
      ).expect(404);
    });
  });
});
