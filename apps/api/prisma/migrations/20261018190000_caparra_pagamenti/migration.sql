-- CreateEnum
CREATE TYPE "FormaRestituzione" AS ENUM ('rimborso', 'credito');

-- CreateEnum
CREATE TYPE "StatoPagamento" AS ENUM ('avviato', 'riuscito', 'fallito', 'annullato', 'rimborsato');

-- CreateEnum
CREATE TYPE "TipoMovimentoCaparra" AS ENUM ('pagata', 'rimborsata', 'convertita_in_credito', 'trattenuta', 'scalata', 'restituita_discrezionale');

-- AlterTable
ALTER TABLE "appuntamenti" ADD COLUMN     "bloccoScadeIl" TIMESTAMP(3),
ADD COLUMN     "caparraCentesimi" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "installazione" ADD COLUMN     "caparraAttiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "caparraPercentuale" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "restituzioneCaparra" "FormaRestituzione" NOT NULL DEFAULT 'rimborso';

-- CreateTable
CREATE TABLE "pagamenti" (
    "id" UUID NOT NULL,
    "appuntamentoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "importoCentesimi" INTEGER NOT NULL,
    "stato" "StatoPagamento" NOT NULL DEFAULT 'avviato',
    "riferimento" TEXT NOT NULL,
    "riferimentoRimborso" TEXT,
    "erroreFornitore" TEXT NOT NULL DEFAULT '',
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimenti_caparra" (
    "id" UUID NOT NULL,
    "appuntamentoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "tipo" "TipoMovimentoCaparra" NOT NULL,
    "importoCentesimi" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "autoreId" UUID,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimenti_caparra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimenti_credito" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "importoCentesimi" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "appuntamentoId" UUID,
    "autoreId" UUID,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimenti_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventi_pagamento" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ricevutoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elaboratoIl" TIMESTAMP(3),
    "esito" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "eventi_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_riferimento_key" ON "pagamenti"("riferimento");

-- CreateIndex
CREATE INDEX "pagamenti_appuntamentoId_idx" ON "pagamenti"("appuntamentoId");

-- CreateIndex
CREATE INDEX "pagamenti_clienteId_idx" ON "pagamenti"("clienteId");

-- CreateIndex
CREATE INDEX "pagamenti_stato_idx" ON "pagamenti"("stato");

-- CreateIndex
CREATE INDEX "movimenti_caparra_appuntamentoId_creatoIl_idx" ON "movimenti_caparra"("appuntamentoId", "creatoIl");

-- CreateIndex
CREATE INDEX "movimenti_caparra_clienteId_creatoIl_idx" ON "movimenti_caparra"("clienteId", "creatoIl");

-- CreateIndex
CREATE INDEX "movimenti_credito_clienteId_creatoIl_idx" ON "movimenti_credito"("clienteId", "creatoIl");

-- CreateIndex
CREATE INDEX "movimenti_credito_appuntamentoId_idx" ON "movimenti_credito"("appuntamentoId");

-- CreateIndex
CREATE INDEX "eventi_pagamento_ricevutoIl_idx" ON "eventi_pagamento"("ricevutoIl");

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "appuntamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_caparra" ADD CONSTRAINT "movimenti_caparra_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "appuntamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_caparra" ADD CONSTRAINT "movimenti_caparra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_caparra" ADD CONSTRAINT "movimenti_caparra_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_credito" ADD CONSTRAINT "movimenti_credito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_credito" ADD CONSTRAINT "movimenti_credito_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "appuntamenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimenti_credito" ADD CONSTRAINT "movimenti_credito_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────

-- La percentuale della caparra è una percentuale, e la caparra dovuta non è
-- mai negativa.
ALTER TABLE "installazione"
  ADD CONSTRAINT "installazione_caparra_percentuale_valida" CHECK (
    "caparraPercentuale" BETWEEN 1 AND 100
  );

ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_caparra_valida" CHECK (
    "caparraCentesimi" >= 0 AND "caparraCentesimi" <= "prezzoTotaleCentesimi"
  );

-- Il blocco dello slot esiste solo mentre si attende il pagamento: negli altri
-- stati la scadenza non ha significato e va azzerata.
ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_blocco_coerente" CHECK (
    "bloccoScadeIl" IS NULL OR "stato" = 'in_attesa_pagamento'
  );

-- Importi dei movimenti: la caparra si muove sempre per importi positivi,
-- mentre il credito usa il segno (positivo in accredito, negativo in utilizzo)
-- e non ammette righe nulle.
ALTER TABLE "movimenti_caparra"
  ADD CONSTRAINT "movimenti_caparra_importo_valido" CHECK ("importoCentesimi" > 0);

ALTER TABLE "movimenti_credito"
  ADD CONSTRAINT "movimenti_credito_importo_valido" CHECK ("importoCentesimi" <> 0);

-- Una restituzione discrezionale senza motivazione non è tracciabile: il
-- motivo è obbligatorio e deve essere scritto da una persona.
ALTER TABLE "movimenti_caparra"
  ADD CONSTRAINT "movimenti_caparra_discrezionale_motivata" CHECK (
    "tipo" <> 'restituita_discrezionale'
    OR (btrim("motivo") <> '' AND "autoreId" IS NOT NULL)
  );

-- Un pagamento vale almeno un centesimo, e il riferimento del rimborso esiste
-- solo per i pagamenti rimborsati.
ALTER TABLE "pagamenti"
  ADD CONSTRAINT "pagamenti_importo_valido" CHECK ("importoCentesimi" > 0),
  ADD CONSTRAINT "pagamenti_rimborso_coerente" CHECK (
    "riferimentoRimborso" IS NULL OR "stato" = 'rimborsato'
  );

-- Un solo pagamento ancora in corso per appuntamento: evita di aprire due
-- operazioni presso il fornitore per lo stesso slot.
CREATE UNIQUE INDEX "pagamenti_un_solo_avviato_per_appuntamento"
  ON "pagamenti"("appuntamentoId")
  WHERE "stato" = 'avviato';
