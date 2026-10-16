
-- AlterTable
ALTER TABLE "installazione" ADD COLUMN     "citta" TEXT NOT NULL,
ADD COLUMN     "emailSalone" TEXT NOT NULL,
ADD COLUMN     "indirizzo" TEXT NOT NULL,
ADD COLUMN     "minutiBloccoSlot" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "riga" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "telefono" TEXT NOT NULL,
ADD COLUMN     "venditaOnlineAttiva" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "servizi" (
    "nome" TEXT NOT NULL,
    "id" UUID NOT NULL,
    "descrizione" TEXT NOT NULL DEFAULT '',
    "prezzoCentesimi" INTEGER NOT NULL,
    "durataMinuti" INTEGER NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servizi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servizi_attivo_ordine_idx" ON "servizi"("attivo", "ordine");

-- CreateIndex
CREATE UNIQUE INDEX "servizi_nome_key" ON "servizi"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "installazione_riga_key" ON "installazione"("riga");


-- Vincolo manuale: l'installazione serve un solo salone, quindi la tabella
-- "installazione" può contenere al massimo una riga. La colonna "riga" è
-- unica e vincolata al valore 1.
ALTER TABLE "installazione"
  ADD CONSTRAINT "installazione_riga_unica" CHECK ("riga" = 1);
