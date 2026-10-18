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

/** Primo mercoledì utile: giorno lavorativo entro i 60 giorni consentiti. */
function prossimoMercoledi(): string {
  let giorno = new Date(Date.now() + GIORNO_IN_MILLISECONDI);

  while (giornoSettimanaLocale(giorno) !== 3) {
    giorno = new Date(giorno.getTime() + GIORNO_IN_MILLISECONDI);
  }

  return dataLocale(giorno);
}

describe('Area del cliente', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let cliente: { cookie: string; tokenCsrf: string };
  let idOperatore: string;
  let idCliente: string;
  let idTaglio: string;
  let idPiega: string;
  let idDisattivato: string;
  let emailCliente: string;
  let hashPassword: string;
  const giorno = prossimoMercoledi();

  function alle(ore: number, minuti = 0): string {
    return istanteDaDataLocale(giorno, ore * 60 + minuti)!.toISOString();
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
    hashPassword = await contesto.autenticazione.calcolaHashPassword(PASSWORD);

    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}50001`, consensoTrattamentoIl: new Date() },
    });

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    contesto.email.svuota();
    // Un test anonimizza la scheda e revoca la sessione: si riparte sempre da
    // un cliente utilizzabile, con una sessione nuova.
    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: {
        nome: 'Utente',
        cognome: 'DiProva',
        email: emailCliente,
        numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}50001`,
        passwordHash: hashPassword,
        attivo: true,
        emailVerificata: true,
        anonimizzataIl: null,
        consensoTrattamentoIl: new Date(),
      },
    });
    await contesto.prisma.richiestaCancellazione.deleteMany();
    await contesto.prisma.appuntamento.deleteMany();
    await contesto.prisma.servizio.deleteMany();
    await contesto.prisma.orarioOperatore.deleteMany();
    await contesto.prisma.orarioApertura.deleteMany();
    await contesto.prisma.installazione.updateMany({
      data: { oreLimitePreavviso: 24, spostamentoComeAnnullamento: false },
    });

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
        nome: 'Taglio area cliente',
        prezzoCentesimi: 2500,
        durataMinuti: 30,
        operatoriAbilitati: { create: [{ operatoreId: idOperatore }] },
      },
    });
    const piega = await contesto.prisma.servizio.create({
      data: {
        nome: 'Piega area cliente',
        prezzoCentesimi: 2000,
        durataMinuti: 30,
        operatoriAbilitati: { create: [{ operatoreId: idOperatore }] },
      },
    });
    const disattivato = await contesto.prisma.servizio.create({
      data: {
        nome: 'Servizio ritirato',
        prezzoCentesimi: 1000,
        durataMinuti: 15,
        attivo: false,
        operatoriAbilitati: { create: [{ operatoreId: idOperatore }] },
      },
    });

    idTaglio = taglio.id;
    idPiega = piega.id;
    idDisattivato = disattivato.id;

    contesto.limiti.azzera();
    cliente = await accediPerProva(contesto, emailCliente, PASSWORD);
  });

  afterAll(async () => {
    await contesto.prisma.richiestaCancellazione.deleteMany();
    await contesto.prisma.appuntamento.deleteMany();
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

  function prenota(modifiche: Record<string, unknown> = {}): request.Test {
    return come(
      cliente,
      chiama()
        .post('/api/area-cliente/appuntamenti')
        .send({
          operatoreId: idOperatore,
          servizioIds: [idTaglio],
          inizio: alle(10),
          ...modifiche,
        }),
    );
  }

  describe('Catalogo e disponibilità', () => {
    it('mostra solo i servizi attivi e gli operatori in servizio', async () => {
      const risposta = await come(cliente, chiama().get('/api/area-cliente/catalogo')).expect(200);
      const nomi = risposta.body.servizi.map((servizio: { nome: string }) => servizio.nome);

      expect(nomi).toContain('Taglio area cliente');
      expect(nomi).not.toContain('Servizio ritirato');
      // Nel database di sviluppo ci sono anche gli operatori dei dati demo.
      expect(
        risposta.body.operatori.some((operatore: { id: string }) => operatore.id === idOperatore),
      ).toBe(true);
      expect(
        risposta.body.operatori.every((operatore: { attivo: boolean }) => operatore.attivo),
      ).toBe(true);
    });

    it('non propone orari nelle due ore successive', async () => {
      const oggi = dataLocale(new Date());
      const risposta = await come(
        cliente,
        chiama().get(
          `/api/area-cliente/disponibilita?operatoreId=${idOperatore}&servizioIds=${idTaglio}&dal=${oggi}`,
        ),
      ).expect(200);

      const limite = Date.now() + 2 * 60 * 60 * 1000;
      for (const slot of risposta.body.giorni[0].slot as string[]) {
        expect(new Date(slot).getTime()).toBeGreaterThanOrEqual(limite);
      }
    });

    it('non è raggiungibile dal personale', async () => {
      await come(titolare, chiama().get('/api/area-cliente/catalogo')).expect(403);
      await chiama().get('/api/area-cliente/appuntamenti').expect(401);
    });
  });

  describe('Prenotazione dall’app', () => {
    it('prenota più servizi con lo stesso operatore e riceve la conferma', async () => {
      const risposta = await prenota({ servizioIds: [idTaglio, idPiega] }).expect(201);
      const appuntamento = risposta.body.appuntamento;

      expect(appuntamento.stato).toBe('confermato');
      expect(appuntamento.durataMinuti).toBe(60);
      expect(appuntamento.prezzoTotaleCentesimi).toBe(4500);
      expect(appuntamento.puoAnnullare).toBe(true);

      const salvato = await contesto.prisma.appuntamento.findFirstOrThrow({
        where: { clienteId: idCliente },
      });
      // Prenotazione del cliente: nessun autore fra il personale e caparra
      // secondo le regole del salone.
      expect(salvato.creatoDaId).toBeNull();
      expect(salvato.senzaCaparra).toBe(false);

      const messaggio = contesto.email.messaggi.at(-1);
      expect(messaggio?.oggetto).toContain('appuntamento confermato');
    });

    it('rifiuta un orario entro le due ore', async () => {
      const risposta = await prenota({
        inizio: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).expect(400);

      expect(risposta.body.message).toContain('2 ore');
    });

    it('rifiuta un servizio disattivato e un operatore non abilitato', async () => {
      await prenota({ servizioIds: [idDisattivato] }).expect(400);
      await prenota({ operatoreId: idCliente }).expect(404);
    });

    it('non accetta il flag "senza caparra" nemmeno se inviato', async () => {
      await prenota({ senzaCaparra: true }).expect(201);

      const salvato = await contesto.prisma.appuntamento.findFirstOrThrow({
        where: { clienteId: idCliente },
      });
      expect(salvato.senzaCaparra).toBe(false);
    });

    it('rifiuta un orario già occupato', async () => {
      await prenota().expect(201);
      await prenota().expect(409);
    });
  });

  describe('Spostamento e annullamento dall’app', () => {
    async function appuntamentoDiProva(): Promise<string> {
      const risposta = await prenota().expect(201);

      return risposta.body.appuntamento.id as string;
    }

    it('sposta entro il limite di preavviso', async () => {
      const id = await appuntamentoDiProva();

      const spostato = await come(
        cliente,
        chiama()
          .post(`/api/area-cliente/appuntamenti/${id}/spostamento`)
          .send({ inizio: alle(16) }),
      ).expect(201);

      expect(spostato.body.appuntamento.inizio).toBe(alle(16));
    });

    it('annulla entro il limite e registra un annullamento tempestivo', async () => {
      const id = await appuntamentoDiProva();

      const annullato = await come(
        cliente,
        chiama().post(`/api/area-cliente/appuntamenti/${id}/annullamento`).send({}),
      ).expect(201);

      expect(annullato.body.appuntamento.stato).toBe('annullato');

      const salvato = await contesto.prisma.appuntamento.findUniqueOrThrow({ where: { id } });
      expect(salvato.motivoAnnullamento).toBe('tempestivo');
    });

    it('oltre il limite di preavviso il cliente non può più agire dall’app', async () => {
      const id = await appuntamentoDiProva();

      // Limite di due settimane: l'appuntamento è più vicino, quindi tardivo.
      await come(
        titolare,
        chiama().put('/api/impostazioni/regole').send({
          oreLimitePreavviso: 336,
          spostamentoComeAnnullamento: false,
          oreAnticipoPromemoria: 24,
        }),
      ).expect(200);

      const elenco = await come(cliente, chiama().get('/api/area-cliente/appuntamenti')).expect(
        200,
      );
      expect(elenco.body.appuntamenti[0].puoAnnullare).toBe(false);

      const rifiutato = await come(
        cliente,
        chiama().post(`/api/area-cliente/appuntamenti/${id}/annullamento`).send({}),
      ).expect(400);
      expect(rifiutato.body.message).toContain('Contatta il salone');

      await come(
        cliente,
        chiama()
          .post(`/api/area-cliente/appuntamenti/${id}/spostamento`)
          .send({ inizio: alle(16) }),
      ).expect(400);
    });

    it('non si toccano gli appuntamenti di altri clienti', async () => {
      const altro = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      const suo = await contesto.prisma.appuntamento.create({
        data: {
          clienteId: altro.id,
          operatoreId: idOperatore,
          inizio: new Date(alle(11)),
          fine: new Date(alle(11, 30)),
          durataMinuti: 30,
          prezzoTotaleCentesimi: 2500,
          stato: 'confermato',
        },
      });

      await come(
        cliente,
        chiama().post(`/api/area-cliente/appuntamenti/${suo.id}/annullamento`).send({}),
      ).expect(404);
    });
  });

  describe('Profilo e consensi', () => {
    it('legge il profilo e revoca il consenso WhatsApp', async () => {
      await contesto.prisma.utente.update({
        where: { id: idCliente },
        data: { consensoWhatsappIl: new Date() },
      });

      const profilo = await come(cliente, chiama().get('/api/area-cliente/profilo')).expect(200);
      expect(profilo.body.consensoWhatsappIl).not.toBeNull();
      // Il numero resta da verificare fino ai messaggi WhatsApp (fase 7).
      expect(profilo.body.numeroVerificato).toBe(false);

      const aggiornato = await come(
        cliente,
        chiama().patch('/api/area-cliente/profilo').send({ consensoWhatsapp: false }),
      ).expect(200);
      expect(aggiornato.body.consensoWhatsappIl).toBeNull();
    });

    it('rifiuta un numero già collegato a un altro account', async () => {
      const altro = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      await contesto.prisma.utente.update({
        where: { id: altro.id },
        data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}50002` },
      });

      await come(
        cliente,
        chiama()
          .patch('/api/area-cliente/profilo')
          .send({ numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}50002` }),
      ).expect(409);
    });

    it('esporta i propri dati con lo storico', async () => {
      await prenota().expect(201);

      const risposta = await come(cliente, chiama().get('/api/area-cliente/dati')).expect(200);

      expect(risposta.body.profilo.id).toBe(idCliente);
      expect(risposta.body.appuntamenti).toHaveLength(1);
      expect(risposta.body.appuntamenti[0].servizi).toEqual(['Taglio area cliente']);
      expect(risposta.body.esportatoIl).toBeDefined();
    });
  });

  describe('Cancellazione dei dati', () => {
    it('registra la richiesta e rifiuta i doppioni', async () => {
      const risposta = await come(
        cliente,
        chiama().post('/api/area-cliente/cancellazione').send({ motivo: 'Non vengo più.' }),
      ).expect(201);

      expect(risposta.body.stato).toBe('in_attesa');
      expect(risposta.body.motivo).toBe('Non vengo più.');

      await come(cliente, chiama().post('/api/area-cliente/cancellazione').send({})).expect(409);

      const corrente = await come(cliente, chiama().get('/api/area-cliente/cancellazione')).expect(
        200,
      );
      expect(corrente.body.richiesta.stato).toBe('in_attesa');
    });

    it('il titolare la evade anonimizzando la scheda, ma non con appuntamenti in agenda', async () => {
      await prenota().expect(201);
      const richiesta = await come(
        cliente,
        chiama().post('/api/area-cliente/cancellazione').send({}),
      ).expect(201);

      const elenco = await come(titolare, chiama().get('/api/cancellazioni')).expect(200);
      expect(elenco.body.richieste[0].appuntamentiFuturi).toBe(1);

      const bloccata = await come(
        titolare,
        chiama()
          .post(`/api/cancellazioni/${richiesta.body.id}/evasione`)
          .send({ azione: 'anonimizza', nota: '' }),
      ).expect(400);
      expect(bloccata.body.message).toContain('appuntamenti in agenda');

      await contesto.prisma.appuntamento.updateMany({
        where: { clienteId: idCliente },
        data: { stato: 'annullato', motivoAnnullamento: 'tempestivo', annullatoIl: new Date() },
      });

      const evasa = await come(
        titolare,
        chiama()
          .post(`/api/cancellazioni/${richiesta.body.id}/evasione`)
          .send({ azione: 'anonimizza', nota: 'Dati rimossi.' }),
      ).expect(201);
      expect(evasa.body.stato).toBe('evasa');

      const scheda = await contesto.prisma.utente.findUniqueOrThrow({ where: { id: idCliente } });
      expect(scheda.email).toBeNull();
      expect(scheda.numeroWhatsapp).toBeNull();
      expect(scheda.cognome).toBe('cancellato');
      expect(scheda.attivo).toBe(false);
      expect(scheda.anonimizzataIl).not.toBeNull();
      // Lo storico resta, senza riferimenti personali.
      expect(await contesto.prisma.appuntamento.count({ where: { clienteId: idCliente } })).toBe(1);

      // La sessione del cliente è stata revocata.
      await come(cliente, chiama().get('/api/area-cliente/profilo')).expect(401);
    });

    it('il cliente non evade le richieste', async () => {
      const richiesta = await come(
        cliente,
        chiama().post('/api/area-cliente/cancellazione').send({}),
      ).expect(201);

      await come(cliente, chiama().get('/api/cancellazioni')).expect(403);
      await come(
        cliente,
        chiama()
          .post(`/api/cancellazioni/${richiesta.body.id}/evasione`)
          .send({ azione: 'rifiuta', nota: '' }),
      ).expect(403);
    });
  });

  describe('Regole del salone', () => {
    it('le cambia solo il titolare e rifiuta valori fuori intervallo', async () => {
      await come(
        cliente,
        chiama().put('/api/impostazioni/regole').send({
          oreLimitePreavviso: 12,
          spostamentoComeAnnullamento: true,
          oreAnticipoPromemoria: 12,
        }),
      ).expect(403);

      const salvate = await come(
        titolare,
        chiama().put('/api/impostazioni/regole').send({
          oreLimitePreavviso: 48,
          spostamentoComeAnnullamento: true,
          oreAnticipoPromemoria: 12,
        }),
      ).expect(200);
      expect(salvate.body).toEqual({
        oreLimitePreavviso: 48,
        spostamentoComeAnnullamento: true,
        oreAnticipoPromemoria: 12,
      });

      await come(
        titolare,
        chiama().put('/api/impostazioni/regole').send({
          oreLimitePreavviso: 1000,
          spostamentoComeAnnullamento: false,
          oreAnticipoPromemoria: 24,
        }),
      ).expect(400);

      // Lo stato pubblico riporta le regole: l'area clienti le mostra.
      const stato = await chiama().get('/api/installazione').expect(200);
      expect(stato.body.oreLimitePreavviso).toBe(48);
      expect(stato.body.spostamentoComeAnnullamento).toBe(true);
    });
  });
});
