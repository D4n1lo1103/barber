import request from 'supertest';
import {
  avviaApplicazioneDiProva,
  creaUtenteDiProva,
  leggiCookie,
  rimuoviDatiDiProva,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const PASSWORD = 'password-di-prova-123';
const ORIGINE_CONSENTITA = process.env.ORIGINE_WEB ?? 'http://localhost:5173';

describe('Autenticazione, sessioni e permessi', () => {
  let contesto: ContestoDiProva;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
  });

  beforeEach(() => {
    // I test condividono lo stesso indirizzo IP: senza azzeramento
    // il limite di frequenza bloccherebbe i casi successivi.
    contesto.limiti.azzera();
  });

  afterAll(async () => {
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  async function accedi(email: string, password = PASSWORD) {
    const risposta = await chiama()
      .post('/api/autenticazione/accesso')
      .set('Origin', ORIGINE_CONSENTITA)
      .send({ email, password });

    const intestazioni = risposta.headers['set-cookie'] as unknown as string[] | undefined;

    return {
      risposta,
      cookie: intestazioni?.map((valore) => valore.split(';')[0]).join('; ') ?? '',
      tokenCsrf: leggiCookie(intestazioni, 'csrf') ?? '',
    };
  }

  it('rifiuta credenziali errate senza rivelare se l utente esiste', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);

    const esistente = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: utente.email, password: 'password-errata-123' });
    const inesistente = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: `ignoto${Date.now()}@prova.integrazione`, password: 'password-errata-123' });

    expect(esistente.status).toBe(401);
    expect(inesistente.status).toBe(401);
    expect(esistente.body.message).toBe(inesistente.body.message);
  });

  it('rifiuta dati di accesso non validi con messaggi per campo', async () => {
    const risposta = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: 'non-una-email', password: '' });

    expect(risposta.status).toBe(400);
    expect(risposta.body.errori).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'email' })]),
    );
  });

  it('nega l accesso a un account disattivato', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD, { attivo: false });

    const { risposta } = await accedi(utente.email);

    expect(risposta.status).toBe(401);
  });

  it('crea una sessione valida e restituisce l utente corrente', async () => {
    const utente = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);

    const { risposta, cookie } = await accedi(utente.email);
    const io = await chiama().get('/api/autenticazione/io').set('Cookie', cookie);

    expect(risposta.status).toBe(200);
    expect(risposta.body.utente.email).toBe(utente.email);
    expect(risposta.body.utente).not.toHaveProperty('passwordHash');
    expect(io.body.utente.id).toBe(utente.id);
  });

  it('non espone il token di sessione al JavaScript della pagina', async () => {
    const utente = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);

    const { risposta } = await accedi(utente.email);
    const intestazioni = risposta.headers['set-cookie'] as unknown as string[];
    const cookieSessione = intestazioni.find((valore) => valore.startsWith('sessione='));

    expect(cookieSessione).toContain('HttpOnly');
    expect(cookieSessione).toContain('SameSite=Strict');
  });

  it('richiede il token CSRF nelle richieste che modificano dati', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const { cookie, tokenCsrf } = await accedi(utente.email);

    const senzaToken = await chiama().post('/api/autenticazione/uscita').set('Cookie', cookie);
    const origineEstranea = await chiama()
      .post('/api/autenticazione/uscita')
      .set('Cookie', cookie)
      .set('Origin', 'https://sito-estraneo.example')
      .set('x-csrf-token', tokenCsrf);
    const conToken = await chiama()
      .post('/api/autenticazione/uscita')
      .set('Cookie', cookie)
      .set('x-csrf-token', tokenCsrf);

    expect(senzaToken.status).toBe(403);
    expect(origineEstranea.status).toBe(403);
    expect(conToken.status).toBe(204);
  });

  it('invalida la sessione dopo l uscita', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const { cookie, tokenCsrf } = await accedi(utente.email);

    await chiama()
      .post('/api/autenticazione/uscita')
      .set('Cookie', cookie)
      .set('x-csrf-token', tokenCsrf)
      .expect(204);

    await chiama().get('/api/autenticazione/io').set('Cookie', cookie).expect(401);
  });

  it('riserva al titolare l elenco del personale', async () => {
    const titolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const dipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const cliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);

    const accessoTitolare = await accedi(titolare.email);
    const accessoDipendente = await accedi(dipendente.email);
    const accessoCliente = await accedi(cliente.email);

    await chiama().get('/api/utenti/personale').set('Cookie', accessoTitolare.cookie).expect(200);
    await chiama().get('/api/utenti/personale').set('Cookie', accessoDipendente.cookie).expect(403);
    await chiama().get('/api/utenti/personale').set('Cookie', accessoCliente.cookie).expect(403);
    await chiama().get('/api/utenti/personale').expect(401);
  });

  it('revoca tutte le sessioni dopo un cambio password', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const primaSessione = await accedi(utente.email);
    const secondaSessione = await accedi(utente.email);
    const passwordNuova = 'password-nuova-di-prova-1';

    await chiama()
      .post('/api/autenticazione/cambio-password')
      .set('Cookie', primaSessione.cookie)
      .set('x-csrf-token', primaSessione.tokenCsrf)
      .send({ passwordAttuale: PASSWORD, passwordNuova })
      .expect(204);

    await chiama().get('/api/autenticazione/io').set('Cookie', primaSessione.cookie).expect(401);
    await chiama().get('/api/autenticazione/io').set('Cookie', secondaSessione.cookie).expect(401);

    const nuovoAccesso = await accedi(utente.email, passwordNuova);
    expect(nuovoAccesso.risposta.status).toBe(200);
  });

  it('blocca i tentativi di accesso ripetuti dallo stesso indirizzo', async () => {
    const utente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);

    for (let tentativo = 0; tentativo < 5; tentativo += 1) {
      await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email: utente.email, password: 'password-errata-123' })
        .expect(401);
    }

    const risposta = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: utente.email, password: PASSWORD });

    expect(risposta.status).toBe(429);
    expect(risposta.body.messaggio).toContain('Troppi tentativi');
  });

  it('espone lo stato del servizio senza autenticazione', async () => {
    const risposta = await chiama().get('/api/stato').expect(200);

    expect(risposta.body).toEqual({ stato: 'attivo', database: 'raggiungibile' });
  });
});
