-- CreateEnum
CREATE TYPE "CausaMovimentoMagazzino" AS ENUM ('vendita', 'annullamento_vendita', 'carico', 'correzione');

-- CreateTable
CREATE TABLE "prodotti" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL DEFAULT '',
    "prezzoCentesimi" INTEGER NOT NULL,
    "giacenza" INTEGER NOT NULL DEFAULT 0,
    "scortaMinima" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prodotti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendite" (
    "id" UUID NOT NULL,
    "clienteId" UUID,
    "appuntamentoId" UUID,
    "totaleCentesimi" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "registrataDaId" UUID,
    "annullataIl" TIMESTAMP(3),
    "annullataDaId" UUID,
    "motivoAnnullamento" TEXT NOT NULL DEFAULT '',
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "righe_vendita" (
    "id" UUID NOT NULL,
    "venditaId" UUID NOT NULL,
    "prodottoId" UUID,
    "nome" TEXT NOT NULL,
    "prezzoCentesimi" INTEGER NOT NULL,
    "quantita" INTEGER NOT NULL,

    CONSTRAINT "righe_vendita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimenti_magazzino" (
    "id" UUID NOT NULL,
    "prodottoId" UUID NOT NULL,
    "causa" "CausaMovimentoMagazzino" NOT NULL,
    "quantita" INTEGER NOT NULL,
    "giacenzaFinale" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "venditaId" UUID,
    "autoreId" UUID,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimenti_magazzino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prodotti_nome_key" ON "prodotti"("nome");

-- CreateIndex
CREATE INDEX "prodotti_attivo_ordine_idx" ON "prodotti"("attivo", "ordine");

-- CreateIndex
CREATE INDEX "vendite_creataIl_idx" ON "vendite"("creataIl");

-- CreateIndex
CREATE INDEX "vendite_clienteId_creataIl_idx" ON "vendite"("clienteId", "creataIl");

-- CreateIndex
CREATE INDEX "vendite_appuntamentoId_idx" ON "vendite"("appuntamentoId");

-- CreateIndex
CREATE INDEX "righe_vendita_venditaId_idx" ON "righe_vendita"("venditaId");

-- CreateIndex
CREATE INDEX "righe_vendita_prodottoId_idx" ON "righe_vendita"("prodottoId");

-- CreateIndex
CREATE INDEX "movimenti_magazzino_prodottoId_creatoIl_idx" ON "movimenti_magazzino"("prodottoId", "creatoIl");

-- CreateIndex
CREATE INDEX "movimenti_magazzino_venditaId_idx" ON "movimenti_magazzino"("venditaId");

-- AddForeignKey
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "appuntamenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_registrataDaId_fkey" FOREIGN KEY ("registrataDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_annullataDaId_fkey" FOREIGN KEY ("annullataDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_vendita" ADD CONSTRAINT "righe_vendita_venditaId_fkey" FOREIGN KEY ("venditaId") REFERENCES "vendite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_vendita" ADD CONSTRAINT "righe_vendita_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "prodotti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_magazzino" ADD CONSTRAINT "movimenti_magazzino_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "prodotti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_magazzino" ADD CONSTRAINT "movimenti_magazzino_venditaId_fkey" FOREIGN KEY ("venditaId") REFERENCES "vendite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_magazzino" ADD CONSTRAINT "movimenti_magazzino_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────

-- La giacenza non può andare sotto zero: è la regola decisa dal titolare, e il
-- database la fa rispettare anche se il controllo applicativo venisse aggirato
-- o se due vendite arrivassero nello stesso istante.
ALTER TABLE "prodotti"
  ADD CONSTRAINT "prodotti_giacenza_non_negativa" CHECK ("giacenza" >= 0),
  ADD CONSTRAINT "prodotti_scorta_non_negativa" CHECK ("scortaMinima" >= 0),
  ADD CONSTRAINT "prodotti_prezzo_valido" CHECK ("prezzoCentesimi" >= 0);

-- Righe di vendita: almeno un pezzo e prezzo non negativo.
ALTER TABLE "righe_vendita"
  ADD CONSTRAINT "righe_vendita_quantita_valida" CHECK ("quantita" > 0),
  ADD CONSTRAINT "righe_vendita_prezzo_valido" CHECK ("prezzoCentesimi" >= 0);

-- Una vendita vale almeno zero e, se annullata, porta sempre data e motivo.
ALTER TABLE "vendite"
  ADD CONSTRAINT "vendite_totale_valido" CHECK ("totaleCentesimi" >= 0),
  ADD CONSTRAINT "vendite_annullamento_coerente" CHECK (
    "annullataIl" IS NULL OR btrim("motivoAnnullamento") <> ''
  );

-- Un movimento di magazzino sposta qualcosa: quantità mai nulla e giacenza
-- risultante mai negativa. La correzione manuale richiede un motivo e un
-- autore: senza, non sarebbe tracciabile.
ALTER TABLE "movimenti_magazzino"
  ADD CONSTRAINT "movimenti_magazzino_quantita_valida" CHECK ("quantita" <> 0),
  ADD CONSTRAINT "movimenti_magazzino_giacenza_valida" CHECK ("giacenzaFinale" >= 0),
  ADD CONSTRAINT "movimenti_magazzino_correzione_motivata" CHECK (
    "causa" <> 'correzione' OR (btrim("motivo") <> '' AND "autoreId" IS NOT NULL)
  ),
  -- Lo scarico per vendita toglie pezzi, il ripristino li rimette: la causa
  -- e il segno devono raccontare la stessa cosa.
  ADD CONSTRAINT "movimenti_magazzino_segno_coerente" CHECK (
    ("causa" = 'vendita' AND "quantita" < 0)
    OR ("causa" = 'annullamento_vendita' AND "quantita" > 0)
    OR "causa" IN ('carico', 'correzione')
  ),
  -- I movimenti legati a una vendita la indicano sempre.
  ADD CONSTRAINT "movimenti_magazzino_vendita_coerente" CHECK (
    "causa" NOT IN ('vendita', 'annullamento_vendita') OR "venditaId" IS NOT NULL
  );

-- Prodotti sotto la scorta minima: l'avviso al personale li cerca per questo.
CREATE INDEX "prodotti_sotto_scorta"
  ON "prodotti"("nome")
  WHERE "attivo" AND "scortaMinima" > 0;
