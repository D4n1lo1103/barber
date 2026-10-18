-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('attivazione', 'verifica_email', 'reset_password');

-- CreateEnum
CREATE TYPE "StatoRichiestaCancellazione" AS ENUM ('in_attesa', 'evasa', 'rifiutata');

-- AlterTable
-- Consensi GDPR separati, verifica del numero (codice via WhatsApp, fase 7) e
-- momento dell'anonimizzazione su richiesta del cliente.
ALTER TABLE "utenti"
  ADD COLUMN "numeroVerificato" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consensoTrattamentoIl" TIMESTAMP(3),
  ADD COLUMN "consensoWhatsappIl" TIMESTAMP(3),
  ADD COLUMN "anonimizzataIl" TIMESTAMP(3);

-- I conti già esistenti sono stati creati dal salone prima della raccolta dei
-- consensi: restano senza consenso registrato, che verrà chiesto all'accesso.

-- AlterTable
-- Regole di annullamento e spostamento, configurabili dal titolare.
ALTER TABLE "installazione"
  ADD COLUMN "oreLimitePreavviso" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "spostamentoComeAnnullamento" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "oreAnticipoPromemoria" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
-- Gli inviti di attivazione diventano token a uso singolo con uno scopo:
-- attivazione, verifica dell'e-mail o reimpostazione della password.
ALTER TABLE "inviti_attivazione" RENAME TO "token_utente";
ALTER TABLE "token_utente" ADD COLUMN "tipo" "TipoToken" NOT NULL DEFAULT 'attivazione';
ALTER TABLE "token_utente" RENAME CONSTRAINT "inviti_attivazione_pkey" TO "token_utente_pkey";
ALTER TABLE "token_utente"
  RENAME CONSTRAINT "inviti_attivazione_utenteId_fkey" TO "token_utente_utenteId_fkey";
ALTER INDEX "inviti_attivazione_tokenHash_key" RENAME TO "token_utente_tokenHash_key";
DROP INDEX "inviti_attivazione_utenteId_idx";
CREATE INDEX "token_utente_utenteId_tipo_idx" ON "token_utente"("utenteId", "tipo");

-- CreateTable
CREATE TABLE "richieste_cancellazione" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "stato" "StatoRichiestaCancellazione" NOT NULL DEFAULT 'in_attesa',
    "motivo" TEXT NOT NULL DEFAULT '',
    "notaTitolare" TEXT NOT NULL DEFAULT '',
    "richiestaIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evasaIl" TIMESTAMP(3),
    "evasaDaId" UUID,

    CONSTRAINT "richieste_cancellazione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "richieste_cancellazione_stato_richiestaIl_idx" ON "richieste_cancellazione"("stato", "richiestaIl");

-- CreateIndex
CREATE INDEX "richieste_cancellazione_clienteId_idx" ON "richieste_cancellazione"("clienteId");

-- AddForeignKey
ALTER TABLE "richieste_cancellazione" ADD CONSTRAINT "richieste_cancellazione_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "richieste_cancellazione" ADD CONSTRAINT "richieste_cancellazione_evasaDaId_fkey" FOREIGN KEY ("evasaDaId") REFERENCES "utenti"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────

-- Le regole temporali devono restare in un intervallo sensato.
ALTER TABLE "installazione"
  ADD CONSTRAINT "installazione_preavviso_valido" CHECK ("oreLimitePreavviso" BETWEEN 0 AND 336),
  ADD CONSTRAINT "installazione_promemoria_valido" CHECK ("oreAnticipoPromemoria" BETWEEN 1 AND 168);

-- Una richiesta evasa o rifiutata porta sempre la data in cui è stata chiusa.
ALTER TABLE "richieste_cancellazione"
  ADD CONSTRAINT "richieste_cancellazione_chiusura_coerente" CHECK (
    ("stato" = 'in_attesa') = ("evasaIl" IS NULL)
  );
