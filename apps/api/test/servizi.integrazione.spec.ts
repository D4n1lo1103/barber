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

describe('Catalogo dei servizi', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let idTitolare: string;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    idTitolare = utenteTitolare.id;

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.servizio.deleteMany();
  });

  afterAll(async () => {
    await contesto.prisma.servizio.deleteMany();
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function comeTitolare(richiesta: request.Test) {
    return richiesta.set('Cookie', titolare.cookie).set('x-csrf-token', titolare.tokenCsrf);
  }

  function creaServizio(dati: Record<string, unknown> = {}) {
    return comeTitolare(
      chiama()
        .post('/api/servizi')
        .send({
          nome: 'Taglio uomo',
          descrizione: 'Taglio e styling.',
          prezzoCentesimi: 2000,
          durataMinuti: 30,
          operatoriAbilitati: [],
          ...dati,
        }),
    );
  }

  it('solo il titolare può creare un servizio', async () => {
    await creaServizio().expect(201);
    await chiama()
      .post('/api/servizi')
      .set('Cookie', dipendente.cookie)
      .set('x-csrf-token', dipendente.tokenCsrf)
      .send({ nome: 'Barba', prezzoCentesimi: 1200, durataMinuti: 15 })
      .expect(403);
    await chiama().post('/api/servizi').send({}).expect(401);
  });

  it('il dipendente può consultare il catalogo', async () => {
    await creaServizio().expect(201);

    const risposta = await chiama()
      .get('/api/servizi')
      .set('Cookie', dipendente.cookie)
      .expect(200);

    expect(risposta.body.servizi).toHaveLength(1);
  });

  it('rifiuta una durata non multipla della granularità dell agenda', async () => {
    const risposta = await creaServizio({ durataMinuti: 20 }).expect(400);

    expect(risposta.body.message).toContain('multiplo di 15');
  });

  it('rifiuta un prezzo negativo e un nome troppo corto', async () => {
    const prezzo = await creaServizio({ prezzoCentesimi: -100 }).expect(400);
    const nome = await creaServizio({ nome: 'A' }).expect(400);

    expect(prezzo.body.errori).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'prezzoCentesimi' })]),
    );
    expect(nome.body.errori).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'nome' })]),
    );
  });

  it('rifiuta due servizi con lo stesso nome', async () => {
    await creaServizio().expect(201);

    await creaServizio().expect(409);
  });

  it('collega gli operatori abilitati e rifiuta operatori inesistenti', async () => {
    const creato = await creaServizio({ operatoriAbilitati: [idTitolare] }).expect(201);

    expect(creato.body.operatoriAbilitati).toEqual([idTitolare]);

    await creaServizio({
      nome: 'Barba',
      durataMinuti: 15,
      operatoriAbilitati: ['3f2c1b4e-0000-4000-8000-000000000999'],
    }).expect(400);
  });

  it('modifica prezzo, durata e abilitazioni di un servizio', async () => {
    const creato = await creaServizio().expect(201);

    const modificato = await comeTitolare(
      chiama()
        .patch(`/api/servizi/${creato.body.id}`)
        .send({ prezzoCentesimi: 2500, durataMinuti: 45, operatoriAbilitati: [idTitolare] }),
    ).expect(200);

    expect(modificato.body.prezzoCentesimi).toBe(2500);
    expect(modificato.body.durataMinuti).toBe(45);
    expect(modificato.body.operatoriAbilitati).toEqual([idTitolare]);
  });

  it('disattiva un servizio senza cancellarlo dallo storico', async () => {
    const creato = await creaServizio().expect(201);

    const disattivato = await comeTitolare(
      chiama().delete(`/api/servizi/${creato.body.id}`),
    ).expect(200);

    expect(disattivato.body.attivo).toBe(false);
    expect(await contesto.prisma.servizio.count()).toBe(1);
  });

  it('riordina il catalogo', async () => {
    const primo = await creaServizio({ nome: 'Taglio uomo' }).expect(201);
    const secondo = await creaServizio({ nome: 'Barba', durataMinuti: 15 }).expect(201);

    const riordinato = await comeTitolare(
      chiama()
        .put('/api/servizi/ordine')
        .send({ idOrdinati: [secondo.body.id, primo.body.id] }),
    ).expect(200);

    expect(riordinato.body.servizi.map((servizio: { nome: string }) => servizio.nome)).toEqual([
      'Barba',
      'Taglio uomo',
    ]);
  });

  it('rifiuta un riordino incompleto', async () => {
    const primo = await creaServizio().expect(201);
    await creaServizio({ nome: 'Barba', durataMinuti: 15 }).expect(201);

    await comeTitolare(
      chiama()
        .put('/api/servizi/ordine')
        .send({ idOrdinati: [primo.body.id] }),
    ).expect(400);
  });

  it('richiede il token CSRF per le modifiche', async () => {
    await chiama()
      .post('/api/servizi')
      .set('Cookie', titolare.cookie)
      .send({ nome: 'Barba', prezzoCentesimi: 1200, durataMinuti: 15 })
      .expect(403);
  });
});
