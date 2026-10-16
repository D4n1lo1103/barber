import request from 'supertest';
import {
  accediPerProva,
  avviaApplicazioneDiProva,
  configuraSalone,
  creaUtenteDiProva,
  rimuoviDatiDiProva,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const PASSWORD = 'password-di-prova-123';

/** 9:00–13:00 e 15:00–19:00, dal lunedì al venerdì. */
function aperturaStandard() {
  return [1, 2, 3, 4, 5].flatMap((giornoSettimana) => [
    { giornoSettimana, minutoInizio: 540, minutoFine: 780 },
    { giornoSettimana, minutoInizio: 900, minutoFine: 1140 },
  ]);
}

describe('Orari del salone, degli operatori e assenze', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let idDipendente: string;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    idDipendente = utenteDipendente.id;

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.assenza.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();
  });

  afterAll(async () => {
    await contesto.prisma.assenza.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function comeTitolare(richiesta: request.Test) {
    return richiesta.set('Cookie', titolare.cookie).set('x-csrf-token', titolare.tokenCsrf);
  }

  function impostaApertura(fasce = aperturaStandard()) {
    return comeTitolare(chiama().put('/api/orari/apertura').send({ fasce }));
  }

  describe('Orari di apertura', () => {
    it('solo il titolare li modifica, tutto il personale li consulta', async () => {
      await impostaApertura().expect(200);

      await chiama()
        .put('/api/orari/apertura')
        .set('Cookie', dipendente.cookie)
        .set('x-csrf-token', dipendente.tokenCsrf)
        .send({ fasce: [] })
        .expect(403);

      const lettura = await chiama()
        .get('/api/orari/apertura')
        .set('Cookie', dipendente.cookie)
        .expect(200);

      expect(lettura.body.fasce).toHaveLength(10);
    });

    it('rifiuta una fascia con chiusura prima dell apertura', async () => {
      const risposta = await impostaApertura([
        { giornoSettimana: 1, minutoInizio: 780, minutoFine: 540 },
      ]).expect(400);

      expect(risposta.body.errori).toEqual(
        expect.arrayContaining([expect.objectContaining({ campo: 'fasce.0.minutoFine' })]),
      );
    });

    it('rifiuta due fasce sovrapposte nello stesso giorno', async () => {
      await impostaApertura([
        { giornoSettimana: 1, minutoInizio: 540, minutoFine: 780 },
        { giornoSettimana: 1, minutoInizio: 700, minutoFine: 900 },
      ]).expect(400);
    });

    it('accetta fasce uguali in giorni diversi', async () => {
      await impostaApertura([
        { giornoSettimana: 1, minutoInizio: 540, minutoFine: 780 },
        { giornoSettimana: 2, minutoInizio: 540, minutoFine: 780 },
      ]).expect(200);
    });

    it('rifiuta un giorno della settimana fuori intervallo', async () => {
      await impostaApertura([{ giornoSettimana: 8, minutoInizio: 540, minutoFine: 780 }]).expect(
        400,
      );
    });
  });

  describe('Orari di lavoro degli operatori', () => {
    it('accetta un orario compreso negli orari di apertura', async () => {
      await impostaApertura().expect(200);

      const risposta = await comeTitolare(
        chiama()
          .put(`/api/orari/operatori/${idDipendente}`)
          .send({
            fasce: [
              { giornoSettimana: 1, minutoInizio: 540, minutoFine: 780 },
              { giornoSettimana: 1, minutoInizio: 900, minutoFine: 1140 },
            ],
          }),
      ).expect(200);

      expect(risposta.body.fasce).toHaveLength(2);
    });

    it('rifiuta un orario fuori dagli orari di apertura', async () => {
      await impostaApertura().expect(200);

      const risposta = await comeTitolare(
        chiama()
          .put(`/api/orari/operatori/${idDipendente}`)
          .send({ fasce: [{ giornoSettimana: 1, minutoInizio: 480, minutoFine: 780 }] }),
      ).expect(400);

      expect(risposta.body.message).toContain('fuori dagli orari di apertura');
    });

    it('rifiuta un orario in un giorno di chiusura', async () => {
      await impostaApertura().expect(200);

      await comeTitolare(
        chiama()
          .put(`/api/orari/operatori/${idDipendente}`)
          .send({ fasce: [{ giornoSettimana: 7, minutoInizio: 540, minutoFine: 780 }] }),
      ).expect(400);
    });

    it('impedisce di restringere l apertura lasciando operatori fuori orario', async () => {
      await impostaApertura().expect(200);
      await comeTitolare(
        chiama()
          .put(`/api/orari/operatori/${idDipendente}`)
          .send({ fasce: [{ giornoSettimana: 1, minutoInizio: 540, minutoFine: 780 }] }),
      ).expect(200);

      const risposta = await impostaApertura([
        { giornoSettimana: 1, minutoInizio: 600, minutoFine: 780 },
      ]).expect(400);

      expect(risposta.body.message).toContain('Aggiorna prima gli orari di lavoro');
    });

    it('restituisce 404 per un operatore inesistente', async () => {
      await chiama()
        .get('/api/orari/operatori/3f2c1b4e-0000-4000-8000-000000000999')
        .set('Cookie', titolare.cookie)
        .expect(404);
    });
  });

  describe('Assenze', () => {
    function creaAssenza(dati: Record<string, unknown> = {}) {
      return comeTitolare(
        chiama()
          .post('/api/orari/assenze')
          .send({
            operatoreId: idDipendente,
            tipo: 'ferie',
            inizio: '2026-08-03T00:00:00.000Z',
            fine: '2026-08-17T00:00:00.000Z',
            note: 'Ferie estive',
            ...dati,
          }),
      );
    }

    it('registra un periodo di ferie', async () => {
      const risposta = await creaAssenza().expect(201);

      expect(risposta.body.tipo).toBe('ferie');
      expect(risposta.body.inizio).toBe('2026-08-03T00:00:00.000Z');
    });

    it('rifiuta un intervallo con fine precedente all inizio', async () => {
      await creaAssenza({
        inizio: '2026-08-17T00:00:00.000Z',
        fine: '2026-08-03T00:00:00.000Z',
      }).expect(400);
    });

    it('rifiuta due assenze sovrapposte dello stesso operatore', async () => {
      await creaAssenza().expect(201);

      const risposta = await creaAssenza({
        tipo: 'altro',
        inizio: '2026-08-10T00:00:00.000Z',
        fine: '2026-08-20T00:00:00.000Z',
      }).expect(400);

      expect(risposta.body.message).toContain('si sovrappone');
    });

    it('accetta due assenze consecutive', async () => {
      await creaAssenza().expect(201);

      await creaAssenza({
        tipo: 'riposo',
        inizio: '2026-08-17T00:00:00.000Z',
        fine: '2026-08-18T00:00:00.000Z',
      }).expect(201);
    });

    it('filtra le assenze per operatore e per periodo', async () => {
      await creaAssenza().expect(201);

      const nelPeriodo = await chiama()
        .get('/api/orari/assenze?dal=2026-08-01T00:00:00.000Z&al=2026-08-31T00:00:00.000Z')
        .set('Cookie', dipendente.cookie)
        .expect(200);
      const fuoriPeriodo = await chiama()
        .get('/api/orari/assenze?dal=2026-09-01T00:00:00.000Z&al=2026-09-30T00:00:00.000Z')
        .set('Cookie', dipendente.cookie)
        .expect(200);

      expect(nelPeriodo.body.assenze).toHaveLength(1);
      expect(fuoriPeriodo.body.assenze).toHaveLength(0);
    });

    it('solo il titolare registra e rimuove le assenze', async () => {
      const creata = await creaAssenza().expect(201);

      await chiama()
        .post('/api/orari/assenze')
        .set('Cookie', dipendente.cookie)
        .set('x-csrf-token', dipendente.tokenCsrf)
        .send({
          operatoreId: idDipendente,
          tipo: 'riposo',
          inizio: '2026-09-01T00:00:00.000Z',
          fine: '2026-09-02T00:00:00.000Z',
        })
        .expect(403);

      await comeTitolare(chiama().delete(`/api/orari/assenze/${creata.body.id}`)).expect(204);
      expect(await contesto.prisma.assenza.count()).toBe(0);
    });
  });
});
