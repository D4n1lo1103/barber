import request from 'supertest';
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

describe('Prodotti, magazzino e vendite', () => {
  let contesto: ContestoDiProva;
  let titolare: { cookie: string; tokenCsrf: string };
  let dipendente: { cookie: string; tokenCsrf: string };
  let cliente: { cookie: string; tokenCsrf: string };
  let idCliente: string;
  let idShampoo: string;
  let idCera: string;

  function chiama() {
    return request(contesto.app.getHttpServer());
  }

  function come(
    sessione: { cookie: string; tokenCsrf: string },
    richiesta: request.Test,
  ): request.Test {
    return richiesta.set('Cookie', sessione.cookie).set('x-csrf-token', sessione.tokenCsrf);
  }

  async function giacenza(id: string): Promise<number> {
    const prodotto = await contesto.prisma.prodotto.findUniqueOrThrow({ where: { id } });

    return prodotto.giacenza;
  }

  beforeAll(async () => {
    contesto = await avviaApplicazioneDiProva();
    await rimuoviDatiDiProva(contesto);
    await configuraSalone(contesto, 15);

    const utenteTitolare = await creaUtenteDiProva(contesto, 'titolare', PASSWORD);
    const utenteDipendente = await creaUtenteDiProva(contesto, 'dipendente', PASSWORD);
    const utenteCliente = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
    idCliente = utenteCliente.id;

    await contesto.prisma.utente.update({
      where: { id: idCliente },
      data: { numeroWhatsapp: `${PREFISSO_NUMERO_PROVA}80001` },
    });

    contesto.limiti.azzera();
    titolare = await accediPerProva(contesto, utenteTitolare.email, PASSWORD);
    dipendente = await accediPerProva(contesto, utenteDipendente.email, PASSWORD);
    cliente = await accediPerProva(contesto, utenteCliente.email, PASSWORD);
  });

  beforeEach(async () => {
    contesto.limiti.azzera();
    await contesto.prisma.movimentoMagazzino.deleteMany();
    await contesto.prisma.rigaVendita.deleteMany();
    await contesto.prisma.vendita.deleteMany();
    await contesto.prisma.prodotto.deleteMany();

    const shampoo = await contesto.prisma.prodotto.create({
      data: { nome: 'Shampoo di prova', prezzoCentesimi: 1800, giacenza: 10, scortaMinima: 3 },
    });
    const cera = await contesto.prisma.prodotto.create({
      data: { nome: 'Cera di prova', prezzoCentesimi: 1200, giacenza: 2, scortaMinima: 5 },
    });
    idShampoo = shampoo.id;
    idCera = cera.id;
  });

  afterAll(async () => {
    await contesto.prisma.movimentoMagazzino.deleteMany();
    await contesto.prisma.rigaVendita.deleteMany();
    await contesto.prisma.vendita.deleteMany();
    await contesto.prisma.prodotto.deleteMany();
    await rimuoviDatiDiProva(contesto);
    await contesto.app.close();
  });

  describe('Catalogo', () => {
    it('lo gestisce solo il titolare, il personale lo consulta', async () => {
      await come(dipendente, chiama().get('/api/prodotti')).expect(200);
      await come(cliente, chiama().get('/api/prodotti')).expect(403);

      await come(
        dipendente,
        chiama().post('/api/prodotti').send({ nome: 'Olio', prezzoCentesimi: 900 }),
      ).expect(403);

      const creato = await come(
        titolare,
        chiama()
          .post('/api/prodotti')
          .send({ nome: 'Olio da barba', prezzoCentesimi: 900, giacenza: 4, scortaMinima: 2 }),
      ).expect(201);

      expect(creato.body).toMatchObject({ giacenza: 4, sottoScorta: false, attivo: true });

      // Anche la giacenza iniziale lascia un movimento.
      const movimenti = await come(
        titolare,
        chiama().get(`/api/prodotti/${creato.body.id}/movimenti`),
      ).expect(200);
      expect(movimenti.body).toEqual([
        expect.objectContaining({ causa: 'carico', quantita: 4, giacenzaFinale: 4 }),
      ]);
    });

    it('rifiuta due prodotti con lo stesso nome', async () => {
      await come(
        titolare,
        chiama().post('/api/prodotti').send({ nome: 'Shampoo di prova', prezzoCentesimi: 1000 }),
      ).expect(409);
    });

    it('la modifica non tocca la giacenza', async () => {
      const modificato = await come(
        titolare,
        chiama().patch(`/api/prodotti/${idShampoo}`).send({ prezzoCentesimi: 2000, giacenza: 999 }),
      ).expect(200);

      expect(modificato.body.prezzoCentesimi).toBe(2000);
      // Il campo giacenza non è previsto dallo schema: viene ignorato.
      expect(modificato.body.giacenza).toBe(10);
    });

    it('il prodotto disattivato esce dal listino del personale', async () => {
      await come(titolare, chiama().delete(`/api/prodotti/${idCera}`)).expect(200);

      const perDipendente = await come(dipendente, chiama().get('/api/prodotti')).expect(200);
      const perTitolare = await come(titolare, chiama().get('/api/prodotti')).expect(200);

      expect(perDipendente.body.map((prodotto: { id: string }) => prodotto.id)).not.toContain(
        idCera,
      );
      expect(perTitolare.body.map((prodotto: { id: string }) => prodotto.id)).toContain(idCera);
    });

    it('segnala i prodotti arrivati alla scorta minima', async () => {
      const avvisi = await come(dipendente, chiama().get('/api/prodotti/sotto-scorta')).expect(200);

      // La cera ha 2 pezzi con soglia 5; lo shampoo 10 con soglia 3.
      expect(avvisi.body).toHaveLength(1);
      expect(avvisi.body[0]).toMatchObject({ id: idCera, sottoScorta: true });
    });
  });

  describe('Giacenze', () => {
    it('le corregge solo il titolare, con motivo obbligatorio', async () => {
      await come(
        dipendente,
        chiama()
          .post(`/api/prodotti/${idShampoo}/movimenti`)
          .send({ quantita: 5, causa: 'carico', motivo: 'Consegna.' }),
      ).expect(403);

      await come(
        titolare,
        chiama()
          .post(`/api/prodotti/${idShampoo}/movimenti`)
          .send({ quantita: 5, causa: 'carico', motivo: '' }),
      ).expect(400);

      const caricato = await come(
        titolare,
        chiama()
          .post(`/api/prodotti/${idShampoo}/movimenti`)
          .send({ quantita: 5, causa: 'carico', motivo: 'Consegna del fornitore.' }),
      ).expect(201);

      expect(caricato.body.giacenza).toBe(15);
    });

    it('una correzione non può portare la giacenza sotto zero', async () => {
      const rifiutata = await come(
        titolare,
        chiama()
          .post(`/api/prodotti/${idCera}/movimenti`)
          .send({ quantita: -5, causa: 'correzione', motivo: 'Inventario.' }),
      ).expect(409);

      expect(rifiutata.body.message).toContain('sotto zero');
      expect(await giacenza(idCera)).toBe(2);
    });

    it('il database rifiuta una giacenza negativa anche scrivendoci direttamente', async () => {
      await expect(
        contesto.prisma.prodotto.update({ where: { id: idCera }, data: { giacenza: -1 } }),
      ).rejects.toThrow();
    });
  });

  describe('Vendita in negozio', () => {
    it('scarica il magazzino e copia nome e prezzo nelle righe', async () => {
      const vendita = await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({
            righe: [
              { prodottoId: idShampoo, quantita: 2 },
              { prodottoId: idCera, quantita: 1 },
            ],
            clienteId: idCliente,
            note: 'Pagato in contanti.',
          }),
      ).expect(201);

      // 2 × 18,00 € + 1 × 12,00 €.
      expect(vendita.body.totaleCentesimi).toBe(4800);
      expect(vendita.body.righe).toHaveLength(2);
      expect(vendita.body.cliente.id).toBe(idCliente);
      expect(vendita.body.registrataDa).not.toBeNull();

      expect(await giacenza(idShampoo)).toBe(8);
      expect(await giacenza(idCera)).toBe(1);

      // Ogni riga lascia un movimento di scarico collegato alla vendita.
      const movimenti = await contesto.prisma.movimentoMagazzino.findMany({
        where: { venditaId: vendita.body.id },
      });
      expect(movimenti).toHaveLength(2);
      expect(movimenti.every((movimento) => movimento.quantita < 0)).toBe(true);

      // Un cambio di listino non altera la vendita registrata.
      await come(
        titolare,
        chiama().patch(`/api/prodotti/${idShampoo}`).send({ prezzoCentesimi: 2500 }),
      ).expect(200);
      const riletta = await come(
        dipendente,
        chiama().get('/api/vendite').query({ clienteId: idCliente }),
      ).expect(200);
      expect(riletta.body.vendite[0].totaleCentesimi).toBe(4800);
    });

    it('somma le righe ripetute dello stesso prodotto', async () => {
      await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({
            righe: [
              { prodottoId: idCera, quantita: 1 },
              { prodottoId: idCera, quantita: 1 },
            ],
          }),
      ).expect(201);

      expect(await giacenza(idCera)).toBe(0);
    });

    it('rifiuta una vendita oltre la giacenza e non scarica nulla', async () => {
      const rifiutata = await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({
            righe: [
              { prodottoId: idShampoo, quantita: 1 },
              { prodottoId: idCera, quantita: 3 },
            ],
          }),
      ).expect(409);

      expect(rifiutata.body.message).toContain('Cera di prova');
      // La transazione è atomica: nemmeno lo shampoo viene scaricato.
      expect(await giacenza(idShampoo)).toBe(10);
      expect(await giacenza(idCera)).toBe(2);
      expect(await contesto.prisma.vendita.count()).toBe(0);
    });

    it('rifiuta un prodotto non più in vendita', async () => {
      await come(titolare, chiama().delete(`/api/prodotti/${idCera}`)).expect(200);

      await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({ righe: [{ prodottoId: idCera, quantita: 1 }] }),
      ).expect(400);
    });

    it('due vendite simultanee non portano la giacenza sotto zero', async () => {
      // Due pezzi disponibili, due richieste da due pezzi nello stesso istante:
      // una sola può riuscire.
      const richieste = [1, 2].map(() =>
        come(
          dipendente,
          chiama()
            .post('/api/vendite')
            .send({ righe: [{ prodottoId: idCera, quantita: 2 }] }),
        ),
      );

      const esiti = await Promise.all(
        richieste.map((richiesta) => richiesta.then((r) => r.status)),
      );

      expect(esiti.filter((stato) => stato === 201)).toHaveLength(1);
      expect(esiti.filter((stato) => stato === 409)).toHaveLength(1);
      expect(await giacenza(idCera)).toBe(0);
    });

    it('il cliente non vede né registra vendite', async () => {
      await come(cliente, chiama().get('/api/vendite')).expect(403);
      await come(
        cliente,
        chiama()
          .post('/api/vendite')
          .send({ righe: [{ prodottoId: idShampoo, quantita: 1 }] }),
      ).expect(403);
    });

    it('l’annullamento ripristina la giacenza e resta tracciato', async () => {
      const vendita = await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({ righe: [{ prodottoId: idShampoo, quantita: 3 }] }),
      ).expect(201);
      expect(await giacenza(idShampoo)).toBe(7);

      const annullata = await come(
        dipendente,
        chiama()
          .post(`/api/vendite/${vendita.body.id}/annullamento`)
          .send({ motivo: 'Prodotto sbagliato.' }),
      ).expect(201);

      expect(annullata.body.annullataIl).not.toBeNull();
      expect(annullata.body.motivoAnnullamento).toBe('Prodotto sbagliato.');
      expect(await giacenza(idShampoo)).toBe(10);

      // Non si annulla due volte.
      await come(
        dipendente,
        chiama().post(`/api/vendite/${vendita.body.id}/annullamento`).send({ motivo: 'Di nuovo.' }),
      ).expect(409);
    });

    it('rifiuta un appuntamento di un altro cliente', async () => {
      const operatore = await contesto.prisma.utente.findFirstOrThrow({
        where: { ruolo: 'titolare' },
      });
      const altro = await creaUtenteDiProva(contesto, 'cliente', PASSWORD);
      const inizio = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const appuntamento = await contesto.prisma.appuntamento.create({
        data: {
          clienteId: altro.id,
          operatoreId: operatore.id,
          inizio,
          fine: new Date(inizio.getTime() + 30 * 60_000),
          durataMinuti: 30,
          prezzoTotaleCentesimi: 2000,
          stato: 'confermato',
          senzaCaparra: true,
        },
      });

      await come(
        dipendente,
        chiama()
          .post('/api/vendite')
          .send({
            righe: [{ prodottoId: idShampoo, quantita: 1 }],
            clienteId: idCliente,
            appuntamentoId: appuntamento.id,
          }),
      ).expect(400);

      await contesto.prisma.appuntamento.delete({ where: { id: appuntamento.id } });
    });
  });
});
