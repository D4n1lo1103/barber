import request from 'supertest';
import {
  accediPerProva,
  avviaApplicazioneDiProva,
  configuraSalone,
  creaUtenteDiProva,
  rimuoviDatiDiProva,
  SUFFISSO_PROVA,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const PASSWORD = 'password-di-prova-123';

describe('Gestione del personale', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let idTitolare: string;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    idTitolare = utenteTitolare.id;

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.utente.deleteMany({
      where: { email: { startsWith: 'nuovo-' }, ruolo: 'dipendente' },
    });
  });

  afterAll(async () => {
    await contesto.prisma.utente.deleteMany({ where: { email: { startsWith: 'nuovo-' } } });
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function comeTitolare(richiesta: request.Test) {
    return richiesta.set('Cookie', titolare.cookie).set('x-csrf-token', titolare.tokenCsrf);
  }

  function creaDipendente(dati: Record<string, unknown> = {}) {
    return comeTitolare(
      chiama()
        .post('/api/personale')
        .send({
          nome: 'Marco',
          cognome: 'Neri',
          email: `nuovo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${SUFFISSO_PROVA}`,
          ...dati,
        }),
    );
  }

  it('solo il titolare crea account del personale', async () => {
    await creaDipendente().expect(201);
    await chiama()
      .post('/api/personale')
      .set('Cookie', dipendente.cookie)
      .set('x-csrf-token', dipendente.tokenCsrf)
      .send({ nome: 'Ada', cognome: 'Blu', email: `nuovo-x${SUFFISSO_PROVA}` })
      .expect(403);
  });

  it('crea il dipendente senza password e con un invito di attivazione', async () => {
    const risposta = await creaDipendente().expect(201);

    const creato = await contesto.prisma.utente.findUniqueOrThrow({
      where: { id: risposta.body.operatore.id },
    });

    expect(creato.passwordHash).toBeNull();
    expect(risposta.body.operatore.accountAttivato).toBe(false);
    expect(typeof risposta.body.token).toBe('string');
    expect(risposta.body.token.length).toBeGreaterThanOrEqual(32);

    // Nel database resta solo l'hash del token.
    const invito = await contesto.prisma.invitoAttivazione.findFirstOrThrow({
      where: { utenteId: creato.id },
    });
    expect(invito.tokenHash).not.toBe(risposta.body.token);
  });

  it('un account non ancora attivato non può accedere', async () => {
    const risposta = await creaDipendente().expect(201);
    contesto.limiti.azzera();

    await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: risposta.body.operatore.email, password: PASSWORD })
      .expect(401);
  });

  it('il dipendente attiva l account scegliendo la password', async () => {
    const creazione = await creaDipendente().expect(201);
    const nuovaPassword = 'password-scelta-dal-dipendente';

    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: nuovaPassword })
      .expect(204);

    contesto.limiti.azzera();
    const accesso = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: creazione.body.operatore.email, password: nuovaPassword })
      .expect(200);

    expect(accesso.body.utente.ruolo).toBe('dipendente');
  });

  it('un invito può essere usato una sola volta', async () => {
    const creazione = await creaDipendente().expect(201);

    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: 'password-scelta-1234' })
      .expect(204);

    contesto.limiti.azzera();
    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: 'altra-password-5678' })
      .expect(400);
  });

  it('rifiuta un token di attivazione sconosciuto o scaduto', async () => {
    const creazione = await creaDipendente().expect(201);
    await contesto.prisma.invitoAttivazione.updateMany({
      where: { utenteId: creazione.body.operatore.id },
      data: { scadeIl: new Date(Date.now() - 1000) },
    });

    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: 'password-scelta-1234' })
      .expect(400);

    contesto.limiti.azzera();
    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: 'token-inesistente-ma-lungo-abbastanza', password: 'password-scelta-1234' })
      .expect(400);
  });

  it('rifiuta un indirizzo e-mail già usato', async () => {
    const primo = await creaDipendente().expect(201);

    await creaDipendente({ email: primo.body.operatore.email }).expect(409);
  });

  it('disattiva un dipendente e ne revoca le sessioni', async () => {
    const creazione = await creaDipendente().expect(201);
    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: 'password-scelta-1234' })
      .expect(204);

    contesto.limiti.azzera();
    const sessione = await accediPerProva(
      contesto,
      creazione.body.operatore.email,
      'password-scelta-1234',
    );
    await chiama().get('/api/autenticazione/io').set('Cookie', sessione.cookie).expect(200);

    await comeTitolare(chiama().delete(`/api/personale/${creazione.body.operatore.id}`)).expect(
      200,
    );

    await chiama().get('/api/autenticazione/io').set('Cookie', sessione.cookie).expect(401);
  });

  it('non permette di disattivare il titolare né se stessi', async () => {
    const risposta = await comeTitolare(chiama().delete(`/api/personale/${idTitolare}`)).expect(
      400,
    );

    expect(risposta.body.message).toContain('titolare');
  });

  it('riattiva un dipendente disattivato', async () => {
    const creazione = await creaDipendente().expect(201);
    const id = creazione.body.operatore.id;

    await comeTitolare(chiama().delete(`/api/personale/${id}`)).expect(200);
    const riattivato = await comeTitolare(
      chiama().post(`/api/personale/${id}/riattivazione`),
    ).expect(201);

    expect(riattivato.body.attivo).toBe(true);
  });

  it('rigenera l invito e invalida il precedente', async () => {
    const creazione = await creaDipendente().expect(201);

    const nuovo = await comeTitolare(
      chiama().post(`/api/personale/${creazione.body.operatore.id}/invito`),
    ).expect(201);

    expect(nuovo.body.token).not.toBe(creazione.body.token);

    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: creazione.body.token, password: 'password-scelta-1234' })
      .expect(400);

    contesto.limiti.azzera();
    await chiama()
      .post('/api/personale/attivazione')
      .send({ token: nuovo.body.token, password: 'password-scelta-1234' })
      .expect(204);
  });

  it('tutto il personale vede i colleghi', async () => {
    const risposta = await chiama()
      .get('/api/personale')
      .set('Cookie', dipendente.cookie)
      .expect(200);

    expect(risposta.body.personale.length).toBeGreaterThanOrEqual(2);
    expect(risposta.body.personale[0]).not.toHaveProperty('passwordHash');
  });
});
