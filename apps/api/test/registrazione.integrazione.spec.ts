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
const PASSWORD_NUOVA = 'password-nuova-di-prova-9';

describe('Registrazione del cliente, verifica e reimpostazione della password', () => {
  let contesto: ContestoDiProva;
  let marcatore = 0;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    contesto.email.svuota();
    marcatore += 1;
    await contesto.prisma.utente.deleteMany({
      where: { OR: [{ ruolo: 'cliente' }, { email: { endsWith: SUFFISSO_PROVA } }] },
    });
  });

  afterAll(async () => {
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function datiRegistrazione(modifiche: Record<string, unknown> = {}) {
    return {
      nome: 'Marta',
      cognome: 'Esposito',
      email: `marta-${marcatore}${SUFFISSO_PROVA}`,
      numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}${String(20000 + marcatore)}`,
      password: PASSWORD,
      consensoTrattamento: true,
      consensoWhatsapp: false,
      ...modifiche,
    };
  }

  /** Estrae il token dal link contenuto nell'ultima e-mail inviata. */
  function tokenDallEmail(indirizzo: string, percorso: string): string {
    const messaggio = contesto.email.ultimoPer(indirizzo);
    const corrispondenza = new RegExp(`${percorso}\\?token=([^\\s]+)`).exec(messaggio?.testo ?? '');

    return decodeURIComponent(corrispondenza?.[1] ?? '');
  }

  describe('Registrazione autonoma', () => {
    it('crea il cliente, raccoglie i consensi e invia la verifica', async () => {
      const dati = datiRegistrazione({ consensoWhatsapp: true });

      const risposta = await chiama()
        .post('/api/autenticazione/registrazione')
        .send(dati)
        .expect(201);

      expect(risposta.body).toEqual({ email: dati.email });

      const cliente = await contesto.prisma.utente.findUniqueOrThrow({
        where: { email: dati.email },
      });
      expect(cliente.ruolo).toBe('cliente');
      expect(cliente.emailVerificata).toBe(false);
      expect(cliente.consensoTrattamentoIl).not.toBeNull();
      expect(cliente.consensoWhatsappIl).not.toBeNull();
      // La verifica del numero arriva con WhatsApp, nella fase 7.
      expect(cliente.numeroVerificato).toBe(false);

      const messaggio = contesto.email.ultimoPer(dati.email);
      expect(messaggio?.oggetto).toContain('conferma il tuo indirizzo');
      expect(messaggio?.testo).toContain('/verifica-email?token=');
    });

    it('senza consenso al trattamento la registrazione è rifiutata', async () => {
      await chiama()
        .post('/api/autenticazione/registrazione')
        .send(datiRegistrazione({ consensoTrattamento: false }))
        .expect(400);

      expect(contesto.email.messaggi).toHaveLength(0);
    });

    it('registra il consenso WhatsApp solo se dato', async () => {
      const dati = datiRegistrazione();
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);

      const cliente = await contesto.prisma.utente.findUniqueOrThrow({
        where: { email: dati.email },
      });
      expect(cliente.consensoWhatsappIl).toBeNull();
    });

    it('non si accede finché l’indirizzo non è confermato', async () => {
      const dati = datiRegistrazione();
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);

      const rifiutato = await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email: dati.email, password: PASSWORD })
        .expect(401);
      expect(rifiutato.body.message).toContain('Conferma');

      await chiama()
        .post('/api/autenticazione/verifica-email')
        .send({ token: tokenDallEmail(dati.email, '/verifica-email') })
        .expect(204);

      await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email: dati.email, password: PASSWORD })
        .expect(200);
    });

    it('rifiuta un token di verifica già usato o inventato', async () => {
      const dati = datiRegistrazione();
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);
      const token = tokenDallEmail(dati.email, '/verifica-email');

      await chiama().post('/api/autenticazione/verifica-email').send({ token }).expect(204);
      await chiama().post('/api/autenticazione/verifica-email').send({ token }).expect(400);
      await chiama()
        .post('/api/autenticazione/verifica-email')
        .send({ token: 'token-inventato-abcdefghi' })
        .expect(400);
    });

    it('rinvia la verifica e risponde allo stesso modo per indirizzi inesistenti', async () => {
      const dati = datiRegistrazione();
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);
      contesto.email.svuota();

      await chiama()
        .post('/api/autenticazione/verifica-email/rinvio')
        .send({ email: dati.email })
        .expect(204);
      expect(contesto.email.ultimoPer(dati.email)).toBeDefined();

      await chiama()
        .post('/api/autenticazione/verifica-email/rinvio')
        .send({ email: `ignoto-${marcatore}${SUFFISSO_PROVA}` })
        .expect(204);
    });

    it('rifiuta e-mail e numeri già collegati a un account', async () => {
      const dati = datiRegistrazione();
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);

      await chiama()
        .post('/api/autenticazione/registrazione')
        .send(datiRegistrazione({ email: dati.email }))
        .expect(409);

      const perNumero = await chiama()
        .post('/api/autenticazione/registrazione')
        .send(
          datiRegistrazione({
            // Indirizzo diverso: il conflitto deve arrivare dal numero.
            email: `altra-${marcatore}${SUFFISSO_PROVA}`,
            numeroWhatsapp: dati.numeroWhatsapp,
          }),
        )
        .expect(409);
      expect(perNumero.body.message).toContain('numero');
    });
  });

  describe('Scheda creata dal personale', () => {
    /** Scheda come la crea il personale: numero, nessuna password. */
    async function schedaDelSalone(numero: string) {
      return contesto.prisma.utente.create({
        data: {
          nome: 'Marta',
          cognome: 'Esposito',
          numeroWhatsapp: numero,
          ruolo: 'cliente',
          note: 'Preferisce il sabato.',
        },
      });
    }

    it('non si impossessa della scheda di un altro indicandone il numero', async () => {
      const numero = `${PREFISSO_NUMERO_PROVA}${String(30000 + marcatore)}`;
      const scheda = await schedaDelSalone(numero);

      const dati = datiRegistrazione({ numeroWhatsapp: numero });
      await chiama().post('/api/autenticazione/registrazione').send(dati).expect(201);

      // La scheda del salone resta intatta: nome, assenza di password e note.
      const invariata = await contesto.prisma.utente.findUniqueOrThrow({
        where: { id: scheda.id },
      });
      expect(invariata.email).toBeNull();
      expect(invariata.passwordHash).toBeNull();
      expect(invariata.note).toBe('Preferisce il sabato.');

      // Il nuovo account è separato, con il numero ancora da verificare.
      const nuovo = await contesto.prisma.utente.findUniqueOrThrow({
        where: { email: dati.email },
      });
      expect(nuovo.id).not.toBe(scheda.id);
      expect(nuovo.numeroVerificato).toBe(false);
    });

    it('non rivela che quel numero è già di un cliente del salone', async () => {
      const numero = `${PREFISSO_NUMERO_PROVA}${String(31000 + marcatore)}`;
      await schedaDelSalone(numero);

      const conScheda = await chiama()
        .post('/api/autenticazione/registrazione')
        .send(datiRegistrazione({ numeroWhatsapp: numero }))
        .expect(201);
      const senzaScheda = await chiama()
        .post('/api/autenticazione/registrazione')
        .send(
          datiRegistrazione({
            email: `ignoto-${marcatore}${SUFFISSO_PROVA}`,
            numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}${String(32000 + marcatore)}`,
          }),
        )
        .expect(201);

      expect(Object.keys(conScheda.body)).toEqual(['email']);
      expect(Object.keys(senzaScheda.body)).toEqual(Object.keys(conScheda.body));
    });

    it('rifiuta un numero già verificato da un altro account', async () => {
      const numero = `${PREFISSO_NUMERO_PROVA}${String(33000 + marcatore)}`;
      await contesto.prisma.utente.create({
        data: {
          nome: 'Luca',
          cognome: 'Verdi',
          email: `luca-${marcatore}${SUFFISSO_PROVA}`,
          numeroWhatsapp: numero,
          ruolo: 'cliente',
          numeroVerificato: true,
        },
      });

      const risposta = await chiama()
        .post('/api/autenticazione/registrazione')
        .send(datiRegistrazione({ numeroWhatsapp: numero }))
        .expect(409);

      expect(risposta.body.message).toContain('numero');
    });
  });

  describe('Reimpostazione della password', () => {
    it('invia il link, cambia la password e revoca le sessioni', async () => {
      const utente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      const sessione = await accediPerProva(contesto, utente.email, PASSWORD);
      contesto.email.svuota();

      await chiama()
        .post('/api/autenticazione/reset-password')
        .send({ email: utente.email })
        .expect(204);

      const token = tokenDallEmail(utente.email, '/reimposta-password');
      expect(token.length).toBeGreaterThan(20);

      await chiama()
        .post('/api/autenticazione/reset-password/conferma')
        .send({ token, password: PASSWORD_NUOVA })
        .expect(204);

      // La sessione aperta prima del cambio non vale più.
      await chiama().get('/api/autenticazione/io').set('Cookie', sessione.cookie).expect(401);

      await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email: utente.email, password: PASSWORD })
        .expect(401);
      await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email: utente.email, password: PASSWORD_NUOVA })
        .expect(200);
    });

    it('non rivela se un indirizzo è registrato', async () => {
      await chiama()
        .post('/api/autenticazione/reset-password')
        .send({ email: `ignoto-${marcatore}${SUFFISSO_PROVA}` })
        .expect(204);

      expect(contesto.email.messaggi).toHaveLength(0);
    });

    it('un token di reimpostazione vale una sola volta', async () => {
      const utente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      await chiama()
        .post('/api/autenticazione/reset-password')
        .send({ email: utente.email })
        .expect(204);
      const token = tokenDallEmail(utente.email, '/reimposta-password');

      await chiama()
        .post('/api/autenticazione/reset-password/conferma')
        .send({ token, password: PASSWORD_NUOVA })
        .expect(204);
      await chiama()
        .post('/api/autenticazione/reset-password/conferma')
        .send({ token, password: 'ancora-un-altra-password-1' })
        .expect(400);
    });
  });

  describe('Attivazione di una scheda creata dal personale', () => {
    async function creaSchedaSenzaEmail() {
      const numero = `${PREFISSO_NUMERO_PROVA}${String(40000 + marcatore)}`;
      const titolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
      const sessione = await accediPerProva(contesto, titolare.email, PASSWORD);
      contesto.limiti.azzera();

      const creazione = await chiama()
        .post('/api/clienti')
        .set('Cookie', sessione.cookie)
        .set('x-csrf-token', sessione.tokenCsrf)
        .send({ nome: 'Luigi', cognome: 'Carbone', numeroWhatsapp: numero })
        .expect(201);

      return creazione.body as { cliente: { id: string }; token: string };
    }

    it('chiede l’indirizzo e-mail quando la scheda non ne ha uno', async () => {
      const creazione = await creaSchedaSenzaEmail();

      const senzaEmail = await chiama()
        .post('/api/autenticazione/attivazione')
        .send({ token: creazione.token, password: PASSWORD })
        .expect(400);
      expect(senzaEmail.body.message).toContain('e-mail');

      const email = `luigi-${marcatore}${SUFFISSO_PROVA}`;
      await chiama()
        .post('/api/autenticazione/attivazione')
        .send({ token: creazione.token, password: PASSWORD, email })
        .expect(204);

      const attivato = await contesto.prisma.utente.findUniqueOrThrow({
        where: { id: creazione.cliente.id },
      });
      expect(attivato.email).toBe(email);
      expect(attivato.emailVerificata).toBe(true);
      expect(attivato.consensoTrattamentoIl).not.toBeNull();

      await chiama()
        .post('/api/autenticazione/accesso')
        .send({ email, password: PASSWORD })
        .expect(200);
    });

    it('rifiuta un indirizzo già usato da un altro account', async () => {
      const altro = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      const creazione = await creaSchedaSenzaEmail();

      await chiama()
        .post('/api/autenticazione/attivazione')
        .send({ token: creazione.token, password: PASSWORD, email: altro.email })
        .expect(409);
    });
  });
});
