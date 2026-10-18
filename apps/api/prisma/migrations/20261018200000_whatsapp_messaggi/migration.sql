-- AlterEnum
ALTER TYPE "TipoToken" ADD VALUE 'verifica_numero';

-- AlterTable
ALTER TABLE "appuntamenti" ADD COLUMN     "promemoriaInviatoIl" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "installazione" ADD COLUMN     "whatsappAttivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappIdNumero" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whatsappModelloConferma" TEXT NOT NULL DEFAULT 'conferma_prenotazione',
ADD COLUMN     "whatsappModelloInvito" TEXT NOT NULL DEFAULT 'invito_attivazione',
ADD COLUMN     "whatsappModelloPromemoria" TEXT NOT NULL DEFAULT 'promemoria_appuntamento',
ADD COLUMN     "whatsappModelloVerifica" TEXT NOT NULL DEFAULT 'verifica_numero';


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────

-- Con i messaggi WhatsApp attivi servono il numero mittente e i nomi dei
-- modelli approvati: senza, nessun messaggio potrebbe partire.
ALTER TABLE "installazione"
  ADD CONSTRAINT "installazione_whatsapp_coerente" CHECK (
    NOT "whatsappAttivo"
    OR (
      btrim("whatsappIdNumero") <> ''
      AND btrim("whatsappModelloConferma") <> ''
      AND btrim("whatsappModelloPromemoria") <> ''
      AND btrim("whatsappModelloInvito") <> ''
      AND btrim("whatsappModelloVerifica") <> ''
    )
  );

-- Il promemoria si invia una sola volta per appuntamento: l'indice serve
-- all'attività periodica, che cerca gli appuntamenti ancora da avvisare.
CREATE INDEX "appuntamenti_promemoria_da_inviare"
  ON "appuntamenti"("inizio")
  WHERE "stato" = 'confermato' AND "promemoriaInviatoIl" IS NULL;
