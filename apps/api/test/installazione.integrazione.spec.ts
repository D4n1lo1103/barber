import request from 'supertest';
import { CONFIGURAZIONI_PROFILO } from '@barber/shared';
import {
  avviaApplicazioneDiProva,
  azzeraInstallazione,
  rimuoviDatiDiProva,
  type ContestoDiProva,
} from './applicazione-di-prova.js';

const CHIAVE = process.env.CHIAVE_INSTALLAZIONE ?? '';
const EMAIL_TITOLARE = 'titolare-procedura@prova.integrazione';

function datiValidi() {
  const configurazione = CONFIGURAZIONI_PROFILO.barbiere;

  return {
    profilo: 'barbiere' as const,
    salone: {
      nomeSalone: 'Salone di prova',
      indirizzo: 'Via delle Prove 1',
      citta: 'Bologna',
      telefono: '+393401234567',
      emailSalone: 'salone@prova.integrazione',
    },
    titolare: {
      nome: 'Luca',
      cognome: 'Bianchi',
      email: EMAIL_TITOLARE,
      password: 'password-di-prova-123',
    },
    granularitaSlotMinuti: configurazione.granularitaSlotMinuti,
    minutiBloccoSlot: configurazione.minutiBloccoSlot,
    venditaOnlineAttiva: false,
    servizi: configurazione.catalogoIniziale.map((servizio) => ({ ...servizio })),
  };
}

describe('Procedura guidata al primo avvio', () => {
  let contesto: ContestoDiProva;

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await azzeraInstallazione(contesto);
    await rimuoviDatiDiProva(contesto);
  });

  afterAll(async () => {
    await azzeraInstallazione(contesto);
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function inviaProcedura(dati: object, chiave = CHIAVE) {
    return chiama()
      .post('/api/installazione/procedura-guidata')
      .set('x-chiave-installazione', chiave)
      .send(dati);
  }

  it('segnala che l installazione non è ancora configurata', async () => {
    const risposta = await chiama().get('/api/installazione').expect(200);

    expect(risposta.body).toEqual({
      configurata: false,
      profilo: null,
      nomeSalone: null,
      venditaOnlineAttiva: false,
      granularitaSlotMinuti: 15,
    });
  });

  it('propone il catalogo predefinito del profilo richiesto', async () => {
    const barbiere = await chiama().get('/api/installazione/profili/barbiere').expect(200);
    const parrucchiere = await chiama().get('/api/installazione/profili/parrucchiere').expect(200);

    expect(barbiere.body.granularitaSlotMinuti).toBe(15);
    expect(barbiere.body.catalogoIniziale[0].nome).toBe('Taglio uomo');
    expect(parrucchiere.body.catalogoIniziale).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'Colore' })]),
    );
    await chiama().get('/api/installazione/profili/altro').expect(400);
  });

  it('rifiuta la procedura senza la chiave di installazione', async () => {
    await inviaProcedura(datiValidi(), '').expect(403);
    await inviaProcedura(datiValidi(), 'chiave-sbagliata-ma-lunga').expect(403);

    expect(await contesto.prisma.installazione.count()).toBe(0);
    expect(await contesto.prisma.utente.count({ where: { ruolo: 'titolare' } })).toBe(0);
  });

  it('rifiuta durate dei servizi non multiple della granularità', async () => {
    const dati = datiValidi();
    dati.granularitaSlotMinuti = 30;

    const risposta = await inviaProcedura(dati).expect(400);

    expect(risposta.body.errori).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'servizi',
          messaggio: expect.stringContaining('multiple'),
        }),
      ]),
    );
  });

  it('rifiuta una password del titolare troppo corta', async () => {
    const dati = datiValidi();
    dati.titolare.password = 'corta';

    const risposta = await inviaProcedura(dati).expect(400);

    expect(risposta.body.errori).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'titolare.password' })]),
    );
  });

  it('configura il salone, crea il titolare e il catalogo iniziale', async () => {
    await inviaProcedura(datiValidi()).expect(204);

    const installazione = await contesto.prisma.installazione.findFirstOrThrow();
    const titolare = await contesto.prisma.utente.findUniqueOrThrow({
      where: { email: EMAIL_TITOLARE },
    });
    const servizi = await contesto.prisma.servizio.findMany({ orderBy: { ordine: 'asc' } });

    expect(installazione.configurata).toBe(true);
    expect(installazione.profilo).toBe('barbiere');
    expect(installazione.granularitaSlotMin).toBe(15);
    expect(titolare.ruolo).toBe('titolare');
    expect(titolare.passwordHash).toMatch(/^\$argon2id\$/);
    expect(servizi).toHaveLength(CONFIGURAZIONI_PROFILO.barbiere.catalogoIniziale.length);
    expect(servizi[0]?.nome).toBe('Taglio uomo');
  });

  it('propone gli orari di apertura predefiniti, con domenica e lunedì chiusi', async () => {
    await inviaProcedura(datiValidi()).expect(204);

    const apertura = await contesto.prisma.orarioApertura.findMany();
    const titolare = await contesto.prisma.utente.findUniqueOrThrow({
      where: { email: EMAIL_TITOLARE },
    });
    const orariTitolare = await contesto.prisma.orarioOperatore.findMany({
      where: { operatoreId: titolare.id },
    });
    const giorniAperti = [...new Set(apertura.map((fascia) => fascia.giornoSettimana))].sort();

    expect(giorniAperti).toEqual([2, 3, 4, 5, 6]);
    expect(apertura).toHaveLength(CONFIGURAZIONI_PROFILO.barbiere.aperturaPredefinita.length);
    // Il titolare è anche operatore: lavora in tutte le fasce di apertura.
    expect(orariTitolare).toHaveLength(apertura.length);
  });

  it('permette al titolare creato di accedere subito', async () => {
    await inviaProcedura(datiValidi()).expect(204);

    const accesso = await chiama()
      .post('/api/autenticazione/accesso')
      .send({ email: EMAIL_TITOLARE, password: 'password-di-prova-123' })
      .expect(200);

    expect(accesso.body.utente.ruolo).toBe('titolare');
  });

  it('può essere completata una sola volta', async () => {
    await inviaProcedura(datiValidi()).expect(204);

    const secondoTentativo = await inviaProcedura({
      ...datiValidi(),
      titolare: { ...datiValidi().titolare, email: `altro-${EMAIL_TITOLARE}` },
    });

    expect(secondoTentativo.status).toBe(409);
    expect(await contesto.prisma.installazione.count()).toBe(1);
    expect(await contesto.prisma.utente.count({ where: { ruolo: 'titolare' } })).toBe(1);
  });

  it('non lascia dati a metà se la creazione fallisce', async () => {
    const dati = datiValidi();
    dati.servizi = [dati.servizi[0]!, { ...dati.servizi[0]! }];

    await inviaProcedura(dati).expect(409);

    expect(await contesto.prisma.installazione.count()).toBe(0);
    expect(await contesto.prisma.utente.count({ where: { email: EMAIL_TITOLARE } })).toBe(0);
    expect(await contesto.prisma.servizio.count()).toBe(0);
  });

  it('dopo la configurazione lo stato espone profilo e nome del salone', async () => {
    await inviaProcedura(datiValidi()).expect(204);

    const risposta = await chiama().get('/api/installazione').expect(200);

    expect(risposta.body).toEqual({
      configurata: true,
      profilo: 'barbiere',
      nomeSalone: 'Salone di prova',
      venditaOnlineAttiva: false,
      // L'agenda ha bisogno della granularità scelta nella procedura guidata.
      granularitaSlotMinuti: 15,
    });
  });
});
