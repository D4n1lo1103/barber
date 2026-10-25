import request from 'supertest';
import {
  accediPerProva,
  avviaApplicazioneDiProva,
  configuraSalone,
  creaUtenteDiProva,
  PREFISSO_NUMERO_PROVA,
  rimuoviDatiDiProva,
  SUFFISSO_PROVA,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const PASSWORD = 'password-di-prova-123';

describe('Schede clienti create dal personale', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let cliente: { cookie: string; tokenCsrf: string };

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const utenteCliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
    cliente = await accediPerProva(contesto, utenteCliente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.utente.deleteMany({
      where: { numeroWhatsapp: { startsWith: PREFISSO_NUMERO_PROVA } },
    });
  });

  afterAll(async () => {
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

  function datiCliente(scostamento = 1) {
    return {
      nome: 'Marco',
      cognome: 'Rossi',
      numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}${String(scostamento).padStart(5, '0')}`,
    };
  }

  it('crea la scheda col solo numero WhatsApp e restituisce l’invito', async () => {
    const risposta = await come(dipendente, chiama().post('/api/clienti').send(datiCliente()))
      .expect(201)
      .then((esito) => esito.body);

    expect(risposta.cliente).toMatchObject({
      nome: 'Marco',
      cognome: 'Rossi',
      email: null,
      accountAttivato: false,
      attivo: true,
    });
    // Il personale non conosce né imposta la password: riceve solo l'invito.
    expect(typeof risposta.token).toBe('string');
    expect(risposta.token.length).toBeGreaterThan(20);
    expect(risposta.cliente).not.toHaveProperty('passwordHash');

    const salvato = await contesto.prisma.utente.findUnique({
      where: { id: risposta.cliente.id },
    });
    expect(salvato?.passwordHash).toBeNull();
    expect(salvato?.ruolo).toBe('cliente');
  });

  it('non crea duplicati: segnala la scheda collegata al numero', async () => {
    await come(dipendente, chiama().post('/api/clienti').send(datiCliente())).expect(201);

    const risposta = await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(), nome: 'Marco', cognome: 'Bianchi' }),
    ).expect(409);

    expect(risposta.body.message).toContain('Marco Rossi');
  });

  it('rifiuta un indirizzo e-mail già usato', async () => {
    const email = `cliente-doppio${SUFFISSO_PROVA}`;

    await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(1), email }),
    ).expect(201);

    await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(2), email }),
    ).expect(409);
  });

  it('valida i dati in ingresso', async () => {
    await come(
      dipendente,
      chiama().post('/api/clienti').send({ nome: 'A', cognome: 'Rossi', numeroWhatsapp: '340' }),
    ).expect(400);
  });

  it('cerca per nome e per numero, con paginazione', async () => {
    await come(dipendente, chiama().post('/api/clienti').send(datiCliente(1))).expect(201);
    await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(2), nome: 'Giulia', cognome: 'Zanzibarini' }),
    ).expect(201);

    // Cognome volutamente insolito: nel database di sviluppo ci sono anche i
    // clienti dei dati demo.
    const perNome = await come(dipendente, chiama().get('/api/clienti?cerca=zanzibarini')).expect(
      200,
    );
    expect(perNome.body.clienti).toHaveLength(1);
    expect(perNome.body.clienti[0].nome).toBe('Giulia');

    const perNumero = await come(
      dipendente,
      chiama().get(`/api/clienti?cerca=${encodeURIComponent(datiCliente(1).numeroWhatsapp)}`),
    ).expect(200);
    expect(perNumero.body.clienti).toHaveLength(1);

    const prima = await come(dipendente, chiama().get('/api/clienti?perPagina=1&pagina=1')).expect(
      200,
    );
    expect(prima.body.clienti).toHaveLength(1);
    expect(prima.body.totale).toBeGreaterThanOrEqual(2);
    expect(prima.body.perPagina).toBe(1);
  });

  it('modifica la scheda e rifiuta un numero già di un altro cliente', async () => {
    const primo = await come(dipendente, chiama().post('/api/clienti').send(datiCliente(1)))
      .expect(201)
      .then((esito) => esito.body.cliente);
    await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(2), nome: 'Giulia', cognome: 'Verdi' }),
    ).expect(201);

    const modificato = await come(
      titolare,
      chiama().patch(`/api/clienti/${primo.id}`).send({ note: 'Preferisce il sabato.' }),
    ).expect(200);
    expect(modificato.body.note).toBe('Preferisce il sabato.');

    await come(
      titolare,
      chiama()
        .patch(`/api/clienti/${primo.id}`)
        .send({ numeroWhatsapp: datiCliente(2).numeroWhatsapp }),
    ).expect(409);
  });

  it('manda l’invito all’indirizzo e-mail della scheda e dice su quale recapito è partito', async () => {
    contesto.email.svuota();
    const email = `invito${Date.now()}@prova.integrazione`;

    const risposta = await come(
      dipendente,
      chiama()
        .post('/api/clienti')
        .send({ ...datiCliente(70), email }),
    )
      .expect(201)
      .then((esito) => esito.body);

    expect(risposta.canale).toBe('email');
    expect(contesto.email.ultimoPer(email)?.testo).toContain(risposta.token);
  });

  it('senza e-mail e senza consenso WhatsApp l’invito non parte e il personale lo sa', async () => {
    const risposta = await come(dipendente, chiama().post('/api/clienti').send(datiCliente(71)))
      .expect(201)
      .then((esito) => esito.body);

    expect(risposta.canale).toBe('nessuno');
  });

  it('rigenera l’invito finché il cliente non ha attivato l’account', async () => {
    const creato = await come(dipendente, chiama().post('/api/clienti').send(datiCliente()))
      .expect(201)
      .then((esito) => esito.body.cliente);

    const nuovo = await come(
      dipendente,
      chiama().post(`/api/clienti/${creato.id}/invito`).send({}),
    ).expect(201);
    expect(typeof nuovo.body.token).toBe('string');

    await contesto.prisma.utente.update({
      where: { id: creato.id },
      data: { passwordHash: 'finto' },
    });

    await come(dipendente, chiama().post(`/api/clienti/${creato.id}/invito`).send({})).expect(409);
  });

  it('non è raggiungibile dai clienti né senza sessione', async () => {
    await come(cliente, chiama().get('/api/clienti')).expect(403);
    await come(cliente, chiama().post('/api/clienti').send(datiCliente())).expect(403);
    await chiama().get('/api/clienti').expect(401);
  });

  it('restituisce 404 per una scheda inesistente', async () => {
    await come(
      dipendente,
      chiama().get('/api/clienti/2f1c9b4a-0000-4000-8000-000000000000'),
    ).expect(404);
  });
});
