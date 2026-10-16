-- CreateEnum
CREATE TYPE "Ruolo" AS ENUM ('titolare', 'dipendente', 'cliente');

-- CreateEnum
CREATE TYPE "Profilo" AS ENUM ('barbiere', 'parrucchiere');

-- CreateTable
CREATE TABLE "utenti" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "numeroWhatsapp" TEXT,
    "ruolo" "Ruolo" NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificata" BOOLEAN NOT NULL DEFAULT false,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,
    "ultimoAccessoIl" TIMESTAMP(3),

    CONSTRAINT "utenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessioni" (
    "id" UUID NOT NULL,
    "utenteId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfHash" TEXT NOT NULL,
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scadeIl" TIMESTAMP(3) NOT NULL,
    "revocataIl" TIMESTAMP(3),
    "indirizzoIp" TEXT,
    "agenteUtente" TEXT,

    CONSTRAINT "sessioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installazione" (
    "id" UUID NOT NULL,
    "profilo" "Profilo" NOT NULL,
    "nomeSalone" TEXT NOT NULL,
    "configurata" BOOLEAN NOT NULL DEFAULT false,
    "granularitaSlotMin" INTEGER NOT NULL DEFAULT 15,
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornataIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installazione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utenti_email_key" ON "utenti"("email");

-- CreateIndex
CREATE INDEX "utenti_ruolo_attivo_idx" ON "utenti"("ruolo", "attivo");

-- CreateIndex
CREATE UNIQUE INDEX "sessioni_tokenHash_key" ON "sessioni"("tokenHash");

-- CreateIndex
CREATE INDEX "sessioni_utenteId_idx" ON "sessioni"("utenteId");

-- CreateIndex
CREATE INDEX "sessioni_scadeIl_idx" ON "sessioni"("scadeIl");

-- AddForeignKey
ALTER TABLE "sessioni" ADD CONSTRAINT "sessioni_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
