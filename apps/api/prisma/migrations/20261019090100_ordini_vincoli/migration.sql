-- Vincoli di integrità della vendita online, aggiunti a mano.
--
-- Stanno in una migrazione a parte perché citano le cause di movimento
-- introdotte dalla precedente: PostgreSQL rifiuta l'uso di un valore di enum
-- nella stessa transazione che lo aggiunge.

-- Un pagamento appartiene a una caparra oppure a un ordine, mai a entrambi e
-- mai a nessuno dei due: è l'unica difesa contro un pagamento orfano.
ALTER TABLE "pagamenti"
  ADD CONSTRAINT "pagamenti_un_solo_collegamento" CHECK (
    ("appuntamentoId" IS NOT NULL) <> ("ordineId" IS NOT NULL)
  );

-- Importi dell'ordine. Il controllo sul residuo lega fra loro i quattro
-- importi: se l'aritmetica del carrello sbagliasse, l'ordine non si scrive.
ALTER TABLE "ordini"
  ADD CONSTRAINT "ordini_importi_validi" CHECK (
    "totaleRigheCentesimi" >= 0
    AND "speseConsegnaCentesimi" >= 0
    AND "creditoUsatoCentesimi" >= 0
    AND "daPagareCentesimi" >= 0
  ),
  ADD CONSTRAINT "ordini_residuo_coerente" CHECK (
    "daPagareCentesimi" = "totaleRigheCentesimi" + "speseConsegnaCentesimi" - "creditoUsatoCentesimi"
  ),
  -- Il ritiro in negozio non costa nulla. La spedizione resta da definire:
  -- finché non lo è, nessun ordine può portare spese.
  ADD CONSTRAINT "ordini_consegna_coerente" CHECK (
    "tipoConsegna" <> 'ritiro_in_negozio' OR "speseConsegnaCentesimi" = 0
  ),
  -- Lo stato e le date raccontano la stessa storia.
  ADD CONSTRAINT "ordini_attesa_con_scadenza" CHECK (
    "stato" <> 'in_attesa_pagamento' OR "bloccoScadeIl" IS NOT NULL
  ),
  ADD CONSTRAINT "ordini_pagamento_datato" CHECK (
    "stato" NOT IN ('pagato', 'in_preparazione', 'pronto_per_ritiro', 'spedito', 'consegnato', 'rimborsato')
    OR "pagatoIl" IS NOT NULL
  ),
  ADD CONSTRAINT "ordini_consegna_datata" CHECK (
    "stato" <> 'consegnato' OR "consegnatoIl" IS NOT NULL
  ),
  ADD CONSTRAINT "ordini_annullamento_coerente" CHECK (
    "stato" <> 'annullato'
    OR ("annullatoIl" IS NOT NULL AND btrim("motivoAnnullamento") <> '')
  );

-- Righe dell'ordine: almeno un pezzo, prezzo non negativo.
ALTER TABLE "righe_ordine"
  ADD CONSTRAINT "righe_ordine_quantita_valida" CHECK ("quantita" > 0),
  ADD CONSTRAINT "righe_ordine_prezzo_valido" CHECK ("prezzoCentesimi" >= 0);

-- Resi: il recesso non esige una ragione dal cliente, ma il rifiuto del
-- titolare sì, e porta sempre la data della decisione e chi l'ha presa.
ALTER TABLE "richieste_reso"
  ADD CONSTRAINT "richieste_reso_importi_validi" CHECK (
    "importoRimborsoCentesimi" >= 0 AND "creditoRestituitoCentesimi" >= 0
  ),
  ADD CONSTRAINT "richieste_reso_decisione_datata" CHECK (
    "stato" = 'richiesto' OR ("decisoIl" IS NOT NULL AND "decisaDaId" IS NOT NULL)
  ),
  ADD CONSTRAINT "richieste_reso_rifiuto_motivato" CHECK (
    "stato" <> 'rifiutato' OR btrim("motivoRifiuto") <> ''
  ),
  ADD CONSTRAINT "richieste_reso_rimborso_datato" CHECK (
    "stato" <> 'rimborsato' OR "rimborsatoIl" IS NOT NULL
  );

-- Righe rese: almeno un pezzo.
ALTER TABLE "righe_reso"
  ADD CONSTRAINT "righe_reso_quantita_valida" CHECK ("quantita" > 0);

-- I movimenti di magazzino hanno tre cause nuove: il vincolo sul segno e
-- quello sul collegamento vanno rifatti per comprenderle.
ALTER TABLE "movimenti_magazzino"
  DROP CONSTRAINT "movimenti_magazzino_segno_coerente",
  DROP CONSTRAINT "movimenti_magazzino_vendita_coerente";

ALTER TABLE "movimenti_magazzino"
  -- Ogni causa ha un segno solo: la prenotazione di un ordine toglie pezzi,
  -- il rilascio e il reso li rimettono.
  ADD CONSTRAINT "movimenti_magazzino_segno_coerente" CHECK (
    ("causa" IN ('vendita', 'prenotazione_ordine') AND "quantita" < 0)
    OR ("causa" IN ('annullamento_vendita', 'rilascio_ordine', 'reso_ordine') AND "quantita" > 0)
    OR "causa" IN ('carico', 'correzione')
  ),
  ADD CONSTRAINT "movimenti_magazzino_vendita_coerente" CHECK (
    "causa" NOT IN ('vendita', 'annullamento_vendita') OR "venditaId" IS NOT NULL
  ),
  -- I movimenti nati da un ordine lo indicano sempre, come quelli nati da una
  -- vendita al banco: senza, il registro non si ricostruisce.
  ADD CONSTRAINT "movimenti_magazzino_ordine_coerente" CHECK (
    "causa" NOT IN ('prenotazione_ordine', 'rilascio_ordine', 'reso_ordine')
    OR "ordineId" IS NOT NULL
  );

-- Il credito di un movimento guarda a un appuntamento o a un ordine, non a
-- entrambi: un movimento con due origini non si saprebbe come leggere.
ALTER TABLE "movimenti_credito"
  ADD CONSTRAINT "movimenti_credito_una_sola_origine" CHECK (
    "appuntamentoId" IS NULL OR "ordineId" IS NULL
  );

-- Ordini da far scadere: l'attività periodica li cerca per questo.
CREATE INDEX "ordini_da_far_scadere"
  ON "ordini"("bloccoScadeIl")
  WHERE "stato" = 'in_attesa_pagamento';
