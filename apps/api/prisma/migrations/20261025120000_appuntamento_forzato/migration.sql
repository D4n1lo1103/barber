-- Appuntamento inserito dal titolare in deroga ai vincoli dell'agenda.
ALTER TABLE "appuntamenti"
  ADD COLUMN "forzato" BOOLEAN NOT NULL DEFAULT false;

-- Il vincolo di esclusione resta la difesa contro le doppie prenotazioni, ma
-- non si applica alle righe forzate: il titolare può sovrapporre un
-- appuntamento a quelli già fissati. Un appuntamento forzato non partecipa al
-- vincolo in nessuna delle due direzioni, quindi non impedisce né subisce la
-- sovrapposizione. Resta il controllo applicativo, che calcola la
-- disponibilità tenendo conto anche degli appuntamenti forzati.
ALTER TABLE "appuntamenti"
  DROP CONSTRAINT "appuntamenti_senza_sovrapposizioni";

ALTER TABLE "appuntamenti"
  ADD CONSTRAINT "appuntamenti_senza_sovrapposizioni" EXCLUDE USING gist (
    "operatoreId" WITH =,
    tsrange("inizio", "fine", '[)') WITH &&
  ) WHERE ("stato" <> 'annullato' AND NOT "forzato");
