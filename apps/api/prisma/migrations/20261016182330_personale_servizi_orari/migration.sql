
-- CreateEnum
CREATE TYPE "TipoAssenza" AS ENUM ('ferie', 'riposo', 'altro');

-- CreateTable
CREATE TABLE "servizi_operatori" (
    "servizioId" UUID NOT NULL,
    "operatoreId" UUID NOT NULL,

    CONSTRAINT "servizi_operatori_pkey" PRIMARY KEY ("servizioId","operatoreId")
);

-- CreateTable
CREATE TABLE "orari_apertura" (
    "id" UUID NOT NULL,
    "giornoSettimana" INTEGER NOT NULL,
    "minutoInizio" INTEGER NOT NULL,
    "minutoFine" INTEGER NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orari_apertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orari_operatori" (
    "id" UUID NOT NULL,
    "operatoreId" UUID NOT NULL,
    "giornoSettimana" INTEGER NOT NULL,
    "minutoInizio" INTEGER NOT NULL,
    "minutoFine" INTEGER NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orari_operatori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assenze" (
    "id" UUID NOT NULL,
    "operatoreId" UUID NOT NULL,
    "tipo" "TipoAssenza" NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggiornataIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assenze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inviti_attivazione" (
    "id" UUID NOT NULL,
    "utenteId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scadeIl" TIMESTAMP(3) NOT NULL,
    "usatoIl" TIMESTAMP(3),
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inviti_attivazione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servizi_operatori_operatoreId_idx" ON "servizi_operatori"("operatoreId");

-- CreateIndex
CREATE INDEX "orari_apertura_giornoSettimana_idx" ON "orari_apertura"("giornoSettimana");

-- CreateIndex
CREATE INDEX "orari_operatori_operatoreId_giornoSettimana_idx" ON "orari_operatori"("operatoreId", "giornoSettimana");

-- CreateIndex
CREATE INDEX "assenze_operatoreId_inizio_idx" ON "assenze"("operatoreId", "inizio");

-- CreateIndex
CREATE UNIQUE INDEX "inviti_attivazione_tokenHash_key" ON "inviti_attivazione"("tokenHash");

-- CreateIndex
CREATE INDEX "inviti_attivazione_utenteId_idx" ON "inviti_attivazione"("utenteId");

-- AddForeignKey
ALTER TABLE "servizi_operatori" ADD CONSTRAINT "servizi_operatori_servizioId_fkey" FOREIGN KEY ("servizioId") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servizi_operatori" ADD CONSTRAINT "servizi_operatori_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orari_operatori" ADD CONSTRAINT "orari_operatori_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assenze" ADD CONSTRAINT "assenze_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inviti_attivazione" ADD CONSTRAINT "inviti_attivazione_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Vincoli di integrità aggiunti manualmente ────────────────────────────────
-- L'estensione btree_gist permette di combinare uguaglianza su colonne semplici
-- e sovrapposizione su intervalli nello stesso vincolo di esclusione.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Orari di apertura: giorno valido, fascia dentro la giornata e non vuota.
ALTER TABLE "orari_apertura"
  ADD CONSTRAINT "orari_apertura_giorno_valido" CHECK ("giornoSettimana" BETWEEN 1 AND 7),
  ADD CONSTRAINT "orari_apertura_fascia_valida" CHECK (
    "minutoInizio" >= 0 AND "minutoFine" <= 1440 AND "minutoInizio" < "minutoFine"
  );

-- Due fasce di apertura dello stesso giorno non possono sovrapporsi.
ALTER TABLE "orari_apertura"
  ADD CONSTRAINT "orari_apertura_senza_sovrapposizioni" EXCLUDE USING gist (
    "giornoSettimana" WITH =,
    int4range("minutoInizio", "minutoFine") WITH &&
  );

-- Orari di lavoro degli operatori: stesse regole, per operatore.
ALTER TABLE "orari_operatori"
  ADD CONSTRAINT "orari_operatori_giorno_valido" CHECK ("giornoSettimana" BETWEEN 1 AND 7),
  ADD CONSTRAINT "orari_operatori_fascia_valida" CHECK (
    "minutoInizio" >= 0 AND "minutoFine" <= 1440 AND "minutoInizio" < "minutoFine"
  );

ALTER TABLE "orari_operatori"
  ADD CONSTRAINT "orari_operatori_senza_sovrapposizioni" EXCLUDE USING gist (
    "operatoreId" WITH =,
    "giornoSettimana" WITH =,
    int4range("minutoInizio", "minutoFine") WITH &&
  );

-- Assenze: intervallo non vuoto e senza sovrapposizioni per lo stesso operatore.
ALTER TABLE "assenze"
  ADD CONSTRAINT "assenze_intervallo_valido" CHECK ("fine" > "inizio");

ALTER TABLE "assenze"
  ADD CONSTRAINT "assenze_senza_sovrapposizioni" EXCLUDE USING gist (
    "operatoreId" WITH =,
    tsrange("inizio", "fine") WITH &&
  );

-- Servizi: prezzo non negativo e durata positiva.
ALTER TABLE "servizi"
  ADD CONSTRAINT "servizi_prezzo_valido" CHECK ("prezzoCentesimi" >= 0),
  ADD CONSTRAINT "servizi_durata_valida" CHECK ("durataMinuti" > 0);
