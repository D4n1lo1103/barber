-- Vendita online: ordini, righe, resi e pagamento polimorfo.
--
-- I vincoli di integrità stanno nella migrazione successiva: PostgreSQL non
-- permette di usare un valore di enum nella stessa transazione che lo
-- aggiunge, e i vincoli dei movimenti citano le cause nuove.

-- CreateEnum
CREATE TYPE "StatoOrdine" AS ENUM ('in_attesa_pagamento', 'pagato', 'in_preparazione', 'pronto_per_ritiro', 'spedito', 'consegnato', 'annullato', 'rimborsato');

-- CreateEnum
CREATE TYPE "TipoConsegna" AS ENUM ('ritiro_in_negozio', 'spedizione');

-- CreateEnum
CREATE TYPE "StatoRichiestaReso" AS ENUM ('richiesto', 'approvato', 'rifiutato', 'rimborsato');

-- AlterEnum: la giacenza si muove anche per gli ordini online.
ALTER TYPE "CausaMovimentoMagazzino" ADD VALUE 'prenotazione_ordine';
ALTER TYPE "CausaMovimentoMagazzino" ADD VALUE 'rilascio_ordine';
ALTER TYPE "CausaMovimentoMagazzino" ADD VALUE 'reso_ordine';

-- AlterTable
ALTER TABLE "installazione" ADD COLUMN "minutiBloccoOrdine" INTEGER NOT NULL DEFAULT 20;

-- AlterTable: il pagamento serve la caparra di un appuntamento oppure un ordine.
ALTER TABLE "pagamenti" ADD COLUMN "ordineId" UUID;
ALTER TABLE "pagamenti" ALTER COLUMN "appuntamentoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "movimenti_credito" ADD COLUMN "ordineId" UUID;

-- AlterTable
ALTER TABLE "movimenti_magazzino" ADD COLUMN "ordineId" UUID;

-- CreateTable
CREATE TABLE "ordini" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" UUID NOT NULL,
    "stato" "StatoOrdine" NOT NULL DEFAULT 'in_attesa_pagamento',
    "tipoConsegna" "TipoConsegna" NOT NULL DEFAULT 'ritiro_in_negozio',
    "totaleRigheCentesimi" INTEGER NOT NULL,
    "speseConsegnaCentesimi" INTEGER NOT NULL DEFAULT 0,
    "creditoUsatoCentesimi" INTEGER NOT NULL DEFAULT 0,
    "daPagareCentesimi" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "bloccoScadeIl" TIMESTAMP(3),
    "pagatoIl" TIMESTAMP(3),
    "prontoIl" TIMESTAMP(3),
    "consegnatoIl" TIMESTAMP(3),
    "annullatoIl" TIMESTAMP(3),
    "motivoAnnullamento" TEXT NOT NULL DEFAULT '',
    "annullatoDaId" UUID,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordini_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "righe_ordine" (
    "id" UUID NOT NULL,
    "ordineId" UUID NOT NULL,
    "prodottoId" UUID,
    "nome" TEXT NOT NULL,
    "prezzoCentesimi" INTEGER NOT NULL,
    "quantita" INTEGER NOT NULL,

    CONSTRAINT "righe_ordine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "richieste_reso" (
    "id" UUID NOT NULL,
    "ordineId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "stato" "StatoRichiestaReso" NOT NULL DEFAULT 'richiesto',
    "motivoCliente" TEXT NOT NULL DEFAULT '',
    "motivoRifiuto" TEXT NOT NULL DEFAULT '',
    "importoRimborsoCentesimi" INTEGER NOT NULL DEFAULT 0,
    "riferimentoRimborso" TEXT,
    "creditoRestituitoCentesimi" INTEGER NOT NULL DEFAULT 0,
    "richiestoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisoIl" TIMESTAMP(3),
    "decisaDaId" UUID,
    "rimborsatoIl" TIMESTAMP(3),

    CONSTRAINT "richieste_reso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "righe_reso" (
    "id" UUID NOT NULL,
    "resoId" UUID NOT NULL,
    "rigaOrdineId" UUID NOT NULL,
    "quantita" INTEGER NOT NULL,

    CONSTRAINT "righe_reso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordini_numero_key" ON "ordini"("numero");

-- CreateIndex
CREATE INDEX "ordini_clienteId_creatoIl_idx" ON "ordini"("clienteId", "creatoIl");

-- CreateIndex
CREATE INDEX "ordini_stato_creatoIl_idx" ON "ordini"("stato", "creatoIl");

-- CreateIndex
CREATE INDEX "ordini_bloccoScadeIl_idx" ON "ordini"("bloccoScadeIl");

-- CreateIndex
CREATE INDEX "righe_ordine_ordineId_idx" ON "righe_ordine"("ordineId");

-- CreateIndex
CREATE INDEX "righe_ordine_prodottoId_idx" ON "righe_ordine"("prodottoId");

-- CreateIndex
CREATE INDEX "richieste_reso_ordineId_idx" ON "richieste_reso"("ordineId");

-- CreateIndex
CREATE INDEX "richieste_reso_clienteId_richiestoIl_idx" ON "richieste_reso"("clienteId", "richiestoIl");

-- CreateIndex
CREATE INDEX "richieste_reso_stato_richiestoIl_idx" ON "richieste_reso"("stato", "richiestoIl");

-- CreateIndex
CREATE UNIQUE INDEX "righe_reso_resoId_rigaOrdineId_key" ON "righe_reso"("resoId", "rigaOrdineId");

-- CreateIndex
CREATE INDEX "righe_reso_rigaOrdineId_idx" ON "righe_reso"("rigaOrdineId");

-- CreateIndex
CREATE INDEX "pagamenti_ordineId_idx" ON "pagamenti"("ordineId");

-- CreateIndex
CREATE INDEX "movimenti_credito_ordineId_idx" ON "movimenti_credito"("ordineId");

-- CreateIndex
CREATE INDEX "movimenti_magazzino_ordineId_idx" ON "movimenti_magazzino"("ordineId");

-- AddForeignKey
ALTER TABLE "ordini" ADD CONSTRAINT "ordini_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordini" ADD CONSTRAINT "ordini_annullatoDaId_fkey" FOREIGN KEY ("annullatoDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_ordine" ADD CONSTRAINT "righe_ordine_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "ordini"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_ordine" ADD CONSTRAINT "righe_ordine_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "prodotti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "richieste_reso" ADD CONSTRAINT "richieste_reso_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "ordini"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "richieste_reso" ADD CONSTRAINT "richieste_reso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "richieste_reso" ADD CONSTRAINT "richieste_reso_decisaDaId_fkey" FOREIGN KEY ("decisaDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_reso" ADD CONSTRAINT "righe_reso_resoId_fkey" FOREIGN KEY ("resoId") REFERENCES "richieste_reso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "righe_reso" ADD CONSTRAINT "righe_reso_rigaOrdineId_fkey" FOREIGN KEY ("rigaOrdineId") REFERENCES "righe_ordine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "ordini"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_credito" ADD CONSTRAINT "movimenti_credito_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "ordini"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_magazzino" ADD CONSTRAINT "movimenti_magazzino_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "ordini"("id") ON DELETE SET NULL ON UPDATE CASCADE;
