import request from 'supertest';
import { MODELLI_WHATSAPP_PREDEFINITI } from '@barber/shared';
import {
  accediPerProva,
  avviaApplicazioneDiProva,
  configuraSalone,
  creaUtenteDiProva,
  PREFISSO_NUMERO_PROVA,
  rimuoviDatiDiProva,
  type ContestoDiProva,
} from './applicazione-di-prova.js';
import { PromemoriaAttivita } from '../src/notifiche/promemoria.attivita.js';

const PASSWORD = 'password-di-prova-123';

/** Impostazioni con i messaggi WhatsApp attivi. */
const WHATSAPP_ATTIVO = {
  attivo: true,
  idNumero: '123456789012345',
  modelli: MODELLI_WHATSAPP_PREDEFINITI,
} as const;

const WHATSAPP_SPENTO = {
  attivo: false,
  idNumero: '',
  modelli: MODELLI_WHATSAPP_PREDEFINITI,
} as const;

describe('Messaggi WhatsApp', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let cliente: { cookie: string; tokenCsrf: string };
  let idCliente: string;
  let emailCliente: string;

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function come(
    sessione: { cookie: string; tokenCsrf: string },
    richiesta: request.Test,
  ): request.Test {
    return richiesta.set('Cookie', sessione.cookie).set('x-csrf-token', sessione.tokenCsrf);
  }

  function impostaWhatsapp(dati: unknown) {
    return come(titolare, chiama().put('/api/impostazioni/whatsapp').send(dati));
  }

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const utenteCliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
    idCliente = utenteCliente.id;
    emailCliente = utenteCliente.email;

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    contesto.email.svuota();
    contesto.whatsapp.svuota();
    await contesto.prisma.tokenUtente.deleteMany({ where: { utenteId: idCliente } });
    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: {
        numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}70001`,
        numeroVerificato: false,
        consensoWhatsappIl: new Date(),
        consensoTrattamentoIl: new Date(),
        emailVerificata: true,
        attivo: true,
      },
    });
    await impostaWhatsapp(WHATSAPP_ATTIVO).expect(200);
    contesto.limiti.azzera();
    cliente = await accediPerProva(contesto, emailCliente, PASSWORD);
  });

  afterAll(async () => {
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  describe('Impostazioni', () => {
    it('le cambia solo il titolare e dichiara se il token è configurato', async () => {
      await come(dipendente, chiama().get('/api/impostazioni/whatsapp')).expect(403);

      const lette = await come(titolare, chiama().get('/api/impostazioni/whatsapp')).expect(200);

      expect(lette.body).toMatchObject({
        attivo: true,
        idNumero: WHATSAPP_ATTIVO.idNumero,
        modelli: MODELLI_WHATSAPP_PREDEFINITI,
        // Nei test non c'è token: i messaggi vengono solo registrati.
        tokenConfigurato: false,
        finto: true,
      });
      // Il token non viene mai restituito, nemmeno vuoto.
      expect(lette.body).not.toHaveProperty('token');
    });

    it('rifiuta l’attivazione senza numero mittente e i nomi di modello non validi', async () => {
      await impostaWhatsapp({ ...WHATSAPP_ATTIVO, idNumero: '' }).expect(400);
      await impostaWhatsapp({
        ...WHATSAPP_ATTIVO,
        modelli: { ...MODELLI_WHATSAPP_PREDEFINITI, promemoria: 'Nome Non Valido' },
      }).expect(400);
    });

    it('l’invio di prova dichiara che il messaggio è stato solo registrato', async () => {
      const esito = await come(
        titolare,
        chiama().post('/api/impostazioni/whatsapp/prova').send({ numeroWhatsapp: '+393405550099' }),
      ).expect(201);

      expect(esito.body.canale).toBe('whatsapp');
      expect(esito.body.inviato).toBe(true);
      expect(esito.body.dettaglio).toContain('registrato');
      expect(contesto.whatsapp.messaggi).toHaveLength(1);
    });
  });

  describe('Scelta del canale', () => {
    let contatore = 0;

    /**
     * Crea una scheda cliente dal personale. Ogni scheda usa un numero
     * diverso: il sistema rifiuta i duplicati, come deve.
     */
    function creaScheda(modifiche: Record<string, unknown> = {}) {
      contatore += 1;

      return come(
        dipendente,
        chiama()
          .post('/api/clienti')
          .send({
            nome: 'Prova',
            cognome: 'Canale',
            numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}7100${contatore}`,
            consensoWhatsapp: true,
            ...modifiche,
          }),
      );
    }

    it('l’invito va su WhatsApp quando il cliente ha dato il consenso', async () => {
      await creaScheda().expect(201);

      expect(contesto.whatsapp.messaggi).toHaveLength(1);
      expect(contesto.whatsapp.messaggi[0]?.modello).toBe(
        MODELLI_WHATSAPP_PREDEFINITI.invitoAttivazione,
      );
      // Il link di attivazione viaggia come parametro del pulsante.
      expect(contesto.whatsapp.messaggi[0]?.parametroPulsante).toContain('/attivazione?token=');
      expect(contesto.email.messaggi).toHaveLength(0);
    });

    it('senza consenso l’invito va via e-mail', async () => {
      await creaScheda({
        consensoWhatsapp: false,
        email: `canale.email${Date.now()}@prova.integrazione`,
      }).expect(201);

      expect(contesto.whatsapp.messaggi).toHaveLength(0);
      expect(contesto.email.messaggi.at(-1)?.oggetto).toContain('attiva il tuo account');
    });

    it('con WhatsApp disattivato nelle impostazioni si usa l’e-mail', async () => {
      await impostaWhatsapp(WHATSAPP_SPENTO).expect(200);

      await creaScheda({ email: `canale.spento${Date.now()}@prova.integrazione` }).expect(201);

      expect(contesto.whatsapp.messaggi).toHaveLength(0);
      expect(contesto.email.messaggi).toHaveLength(1);
    });

    it('senza alcun recapito utilizzabile nessun messaggio parte, ma la scheda si crea', async () => {
      await impostaWhatsapp(WHATSAPP_SPENTO).expect(200);

      // Nessuna e-mail e WhatsApp spento: il link resta al personale.
      const creata = await creaScheda().expect(201);

      expect(creata.body.token).toBeDefined();
      expect(contesto.whatsapp.messaggi).toHaveLength(0);
      expect(contesto.email.messaggi).toHaveLength(0);
    });
  });

  describe('Verifica del numero', () => {
    it('invia un codice su WhatsApp e lo accetta una volta sola', async () => {
      const inviato = await come(cliente, chiama().post('/api/area-cliente/numero/codice')).expect(
        201,
      );

      expect(inviato.body.canale).toBe('whatsapp');
      const messaggio = contesto.whatsapp.messaggi.at(-1);
      expect(messaggio?.modello).toBe(MODELLI_WHATSAPP_PREDEFINITI.verificaNumero);

      const codice = messaggio?.parametri[0] ?? '';
      expect(codice).toMatch(/^[0-9]{6}$/);

      await come(
        cliente,
        chiama().post('/api/area-cliente/numero/verifica').send({ codice }),
      ).expect(204);

      const aggiornato = await contesto.prisma.utente.findUniqueOrThrow({
        where: { id: idCliente },
      });
      expect(aggiornato.numeroVerificato).toBe(true);

      // Il codice è a uso singolo.
      contesto.limiti.azzera();
      await come(
        cliente,
        chiama().post('/api/area-cliente/numero/verifica').send({ codice }),
      ).expect(400);
    });

    it('rifiuta un codice sbagliato e non verifica il numero', async () => {
      await come(cliente, chiama().post('/api/area-cliente/numero/codice')).expect(201);

      await come(
        cliente,
        chiama().post('/api/area-cliente/numero/verifica').send({ codice: '000001' }),
      ).expect(400);

      const aggiornato = await contesto.prisma.utente.findUniqueOrThrow({
        where: { id: idCliente },
      });
      expect(aggiornato.numeroVerificato).toBe(false);
    });

    it('con WhatsApp spento il codice arriva via e-mail', async () => {
      await impostaWhatsapp(WHATSAPP_SPENTO).expect(200);
      contesto.limiti.azzera();

      const inviato = await come(cliente, chiama().post('/api/area-cliente/numero/codice')).expect(
        201,
      );

      expect(inviato.body.canale).toBe('email');
      expect(contesto.email.messaggi.at(-1)?.oggetto).toContain('codice di verifica');
    });

    it('non verifica un numero già verificato su un altro account', async () => {
      const altro = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      await contesto.prisma.utente.update({
        where: { id: altro.id },
        data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}70001`, numeroVerificato: true },
      });

      contesto.limiti.azzera();
      await come(cliente, chiama().post('/api/area-cliente/numero/codice')).expect(201);
      const codice = contesto.whatsapp.messaggi.at(-1)?.parametri[0] ?? '';

      await come(
        cliente,
        chiama().post('/api/area-cliente/numero/verifica').send({ codice }),
      ).expect(409);
    });

    it('un numero già verificato non richiede altri codici', async () => {
      await contesto.prisma.utente.update({
        where: { id: idCliente },
        data: { numeroVerificato: true },
      });

      await come(cliente, chiama().post('/api/area-cliente/numero/codice')).expect(409);
    });
  });

  describe('Promemoria', () => {
    /** Appuntamento confermato fra le ore indicate. */
    async function appuntamentoFra(ore: number): Promise<string> {
      const operatore = await contesto.prisma.utente.findFirstOrThrow({
        where: { ruolo: 'titolare' },
      });
      const inizio = new Date(Date.now() + ore * 60 * 60 * 1000);
      const creato = await contesto.prisma.appuntamento.create({
        data: {
          clienteId: idCliente,
          operatoreId: operatore.id,
          inizio,
          fine: new Date(inizio.getTime() + 30 * 60_000),
          durataMinuti: 30,
          prezzoTotaleCentesimi: 2000,
          stato: 'confermato',
          senzaCaparra: true,
          servizi: {
            create: [{ nome: 'Taglio promemoria', prezzoCentesimi: 2000, durataMinuti: 30 }],
          },
        },
      });

      return creato.id;
    }

    afterEach(async () => {
      await contesto.prisma.appuntamento.deleteMany({ where: { clienteId: idCliente } });
    });

    it('avvisa solo gli appuntamenti entro l’anticipo, e una volta sola', async () => {
      // L'anticipo predefinito è di 24 ore.
      const vicino = await appuntamentoFra(3);
      const lontano = await appuntamentoFra(48);
      const attivita = contesto.app.get(PromemoriaAttivita);

      expect(await attivita.inviaDovuti()).toBe(1);
      expect(contesto.whatsapp.messaggi).toHaveLength(1);
      expect(contesto.whatsapp.messaggi[0]?.modello).toBe(MODELLI_WHATSAPP_PREDEFINITI.promemoria);

      // Un secondo passaggio non manda nulla: il promemoria è già segnato.
      expect(await attivita.inviaDovuti()).toBe(0);
      expect(contesto.whatsapp.messaggi).toHaveLength(1);

      const avvisato = await contesto.prisma.appuntamento.findUniqueOrThrow({
        where: { id: vicino },
      });
      const nonAvvisato = await contesto.prisma.appuntamento.findUniqueOrThrow({
        where: { id: lontano },
      });
      expect(avvisato.promemoriaInviatoIl).not.toBeNull();
      expect(nonAvvisato.promemoriaInviatoIl).toBeNull();
    });

    it('non avvisa gli appuntamenti annullati', async () => {
      const id = await appuntamentoFra(3);
      await contesto.prisma.appuntamento.update({
        where: { id },
        data: { stato: 'annullato', motivoAnnullamento: 'dal_salone' },
      });

      expect(await contesto.app.get(PromemoriaAttivita).inviaDovuti()).toBe(0);
      expect(contesto.whatsapp.messaggi).toHaveLength(0);
    });

    it('senza consenso il promemoria arriva via e-mail', async () => {
      await contesto.prisma.utente.update({
        where: { id: idCliente },
        data: { consensoWhatsappIl: null },
      });
      await appuntamentoFra(5);

      expect(await contesto.app.get(PromemoriaAttivita).inviaDovuti()).toBe(1);
      expect(contesto.whatsapp.messaggi).toHaveLength(0);
      expect(contesto.email.messaggi.at(-1)?.oggetto).toContain('promemoria');
    });
  });
});
