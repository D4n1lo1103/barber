-- AlterTable
-- L'e-mail diventa facoltativa: una scheda cliente creata dal personale può
-- avere solo il numero WhatsApp. L'indice unico resta valido perché
-- PostgreSQL ammette più valori nulli.
ALTER TABLE "utenti" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "utenti" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';

-- CreateEnum
CREATE TYPE "StatoAppuntamento" AS ENUM ('in_attesa_pagamento', 'confermato', 'completato', 'annullato', 'mancata_presentazione');

-- CreateEnum
CREATE TYPE "MotivoAnnullamento" AS ENUM ('tempestivo', 'tardivo', 'dal_salone', 'pagamento_non_completato');

-- CreateTable
CREATE TABLE "appuntamenti" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "operatoreId" UUID NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "durataMinuti" INTEGER NOT NULL,
    "prezzoTotaleCentesimi" INTEGER NOT NULL,
    "stato" "StatoAppuntamento" NOT NULL,
    "motivoAnnullamento" "MotivoAnnullamento",
    "noteAnnullamento" TEXT NOT NULL DEFAULT '',
    "senzaCaparra" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "creatoDaId" UUID,
    "annullatoDaId" UUID,
    "annullatoIl" TIMESTAMP(3),
    "completatoIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appuntamenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appuntamenti_servizi" (
    "id" UUID NOT NULL,
    "appuntamentoId" UUID NOT NULL,
    "servizioId" UUID,
    "nome" TEXT NOT NULL,
    "prezzoCentesimi" INTEGER NOT NULL,
    "durataMinuti" INTEGER NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appuntamenti_servizi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appuntamenti_operatoreId_inizio_idx" ON "appuntamenti"("operatoreId", "inizio");

-- CreateIndex
CREATE INDEX "appuntamenti_clienteId_inizio_idx" ON "appuntamenti"("clienteId", "inizio");

-- CreateIndex
CREATE INDEX "appuntamenti_stato_inizio_idx" ON "appuntamenti"("stato", "inizio");

-- CreateIndex
CREATE INDEX "appuntamenti_servizi_appuntamentoId_ordine_idx" ON "appuntamenti_servizi"("appuntamentoId", "ordine");

-- CreateIndex
CREATE INDEX "appuntamenti_servizi_servizioId_idx" ON "appuntamenti_servizi"("servizioId");

-- AddForeignKey
ALTER TABLE "appuntamenti" ADD CONSTRAINT "appuntamenti_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appuntamenti" ADD CONSTRAINT "appuntamenti_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appuntamenti" ADD CONSTRAINT "appuntamenti_creatoDaId_fkey" FOREIGN KEY ("creatoDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appuntamenti" ADD CONSTRAINT "appuntamenti_annullatoDaId_fkey" FOREIGN KEY ("annullatoDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appuntamenti_servizi" ADD CONSTRAINT "appuntamenti_servizi_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "appuntamenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appuntamenti_servizi" ADD CONSTRAINT "appuntamenti_servizi_servizioId_fkey" FOREIGN KEY ("servizioId") REFERENCES "servizi"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────

-- Intervallo non vuoto, durata e prezzo coerenti.
ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_intervallo_valido" CHECK ("fine" > "inizio"),
  ADD CONSTRAINT "appuntamenti_durata_valida" CHECK ("durataMinuti" > 0),
  ADD CONSTRAINT "appuntamenti_prezzo_valido" CHECK ("prezzoTotaleCentesimi" >= 0);

-- Il motivo dell'annullamento esiste solo per gli appuntamenti annullati.
ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_motivo_coerente" CHECK (
    ("stato" = 'annullato') = ("motivoAnnullamento" IS NOT NULL)
  );

-- Doppie prenotazioni: due appuntamenti dello stesso operatore non possono
-- sovrapporsi. Gli appuntamenti annullati liberano lo slot e restano esclusi
-- dal vincolo. L'intervallo comprende l'inizio ed esclude la fine, così un
-- appuntamento può iniziare nell'istante in cui finisce il precedente.
ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_senza_sovrapposizioni" EXCLUDE USING gist (
    "operatoreId" WITH =,
    tsrange("inizio", "fine", '[)') WITH &&
  ) WHERE ("stato" <> 'annullato');

-- Servizi copiati nell'appuntamento: prezzo non negativo e durata positiva.
ALTER TABLE "appuntamenti_servizi"
  ADD CONSTRAINT "appuntamenti_servizi_prezzo_valido" CHECK ("prezzoCentesimi" >= 0),
  ADD CONSTRAINT "appuntamenti_servizi_durata_valida" CHECK ("durataMinuti" > 0);
