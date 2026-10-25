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

function datiSalone(modifiche: Record<string, unknown> = {}) {
  return {
    nomeSalone: 'Barberia di prova',
    indirizzo: 'Via delle Prove 1',
    citta: 'Bologna',
    telefono: '+393401234567',
    emailSalone: 'salone@prova.integrazione',
    granularitaSlotMinuti: 15,
    minutiBloccoSlot: 10,
    venditaOnlineAttiva: false,
    ...modifiche,
  };
}

describe('Dati del salone', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.servizio.deleteMany();
    await configuraSalone(contesto, 15);
  });

  afterAll(async () => {
    await contesto.prisma.servizio.deleteMany();
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

  it('restituisce i dati del salone, profilo compreso', async () => {
    const risposta = await come(titolare, chiama().get('/api/impostazioni/salone')).expect(200);

    expect(risposta.body).toMatchObject({
      profilo: 'barbiere',
      nomeSalone: 'Salone di prova',
      granularitaSlotMinuti: 15,
      minutiBloccoSlot: 10,
      venditaOnlineAttiva: false,
    });
  });

  it('salva le modifiche del titolare e lascia il profilo invariato', async () => {
    const risposta = await come(
      titolare,
      chiama()
        .put('/api/impostazioni/salone')
        .send(datiSalone({ nomeSalone: 'Barberia Nuova', granularitaSlotMinuti: 30 })),
    ).expect(200);

    expect(risposta.body).toMatchObject({
      profilo: 'barbiere',
      nomeSalone: 'Barberia Nuova',
      granularitaSlotMinuti: 30,
    });

    // Lo stato pubblico dell'installazione è quello che legge tutta l'app.
    const stato = await chiama().get('/api/installazione').expect(200);
    expect(stato.body).toMatchObject({ nomeSalone: 'Barberia Nuova', granularitaSlotMinuti: 30 });
  });

  it('rifiuta una granularità con cui le durate dei servizi non tornano', async () => {
    await contesto.prisma.servizio.create({
      data: { nome: 'Taglio e barba', prezzoCentesimi: 3000, durataMinuti: 45, ordine: 0 },
    });

    const risposta = await come(
      titolare,
      chiama()
        .put('/api/impostazioni/salone')
        .send(datiSalone({ granularitaSlotMinuti: 30 })),
    ).expect(400);

    expect(risposta.body.message).toContain('Taglio e barba');
  });

  it('conta anche i servizi disattivati, che la riattivazione rimetterebbe in agenda', async () => {
    await contesto.prisma.servizio.create({
      data: {
        nome: 'Colore spento',
        prezzoCentesimi: 4000,
        durataMinuti: 45,
        ordine: 0,
        attivo: false,
      },
    });

    const risposta = await come(
      titolare,
      chiama()
        .put('/api/impostazioni/salone')
        .send(datiSalone({ granularitaSlotMinuti: 30 })),
    ).expect(400);

    expect(risposta.body.message).toContain('Colore spento');
  });

  it('salva i recapiti anche con una durata fuori passo, se la granularità non cambia', async () => {
    await contesto.prisma.servizio.create({
      data: { nome: 'Taglio lungo', prezzoCentesimi: 3000, durataMinuti: 50, ordine: 0 },
    });

    const risposta = await come(
      titolare,
      chiama()
        .put('/api/impostazioni/salone')
        .send(datiSalone({ nomeSalone: 'Barberia Rinominata', granularitaSlotMinuti: 15 })),
    ).expect(200);

    expect(risposta.body.nomeSalone).toBe('Barberia Rinominata');
  });

  it('nega al dipendente sia la lettura sia la modifica', async () => {
    await come(dipendente, chiama().get('/api/impostazioni/salone')).expect(403);
    await come(dipendente, chiama().put('/api/impostazioni/salone').send(datiSalone())).expect(403);
  });
});
