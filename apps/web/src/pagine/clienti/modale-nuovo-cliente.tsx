import { useEffect, useState } from 'react';
import { schemaCreazioneCliente, type Cliente } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { creaCliente } from '../../servizi/gestione';
import { messaggioInvito } from './messaggio-invito';

const BOZZA_VUOTA = {
  nome: '',
  cognome: '',
  numeroWhatsapp: '',
  email: '',
  note: '',
  consensoWhatsapp: false,
};

/**
 * Scheda cliente creata dal personale. La password non viene mai impostata qui:
 * al salvataggio il sistema invia da sé l'invito, su WhatsApp o via e-mail, e
 * mostra il link come riserva, per poterlo dettare o consegnare a mano.
 */
export function ModaleNuovoCliente({
  aperto,
  onChiudi,
  onCreato,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onCreato: (cliente: Cliente) => void;
}) {
  const [bozza, impostaBozza] = useState(BOZZA_VUOTA);
  const [errori, impostaErrori] = useState<Record<string, string>>({});
  const [errore, impostaErrore] = useState<string | null>(null);
  const [invito, impostaInvito] = useState<{
    collegamento: string;
    messaggio: ReturnType<typeof messaggioInvito>;
  } | null>(null);
  const [inInvio, impostaInvio] = useState(false);

  useEffect(() => {
    if (aperto) {
      impostaBozza(BOZZA_VUOTA);
      impostaErrori({});
      impostaErrore(null);
      impostaInvito(null);
    }
  }, [aperto]);

  function aggiorna(campo: keyof typeof BOZZA_VUOTA, valore: string | boolean) {
    impostaBozza((precedente) => ({ ...precedente, [campo]: valore }));
  }

  async function invia() {
    const validazione = schemaCreazioneCliente.safeParse({
      ...bozza,
      email: bozza.email.trim() === '' ? undefined : bozza.email,
    });

    if (!validazione.success) {
      impostaErrori(
        Object.fromEntries(
          validazione.error.issues.map((problema) => [String(problema.path[0]), problema.message]),
        ),
      );

      return;
    }

    impostaErrori({});
    impostaErrore(null);
    impostaInvio(true);

    try {
      const esito = await creaCliente(validazione.data);

      onCreato(esito.cliente);
      impostaInvito({
        collegamento: `${window.location.origin}/attivazione?token=${encodeURIComponent(esito.token)}`,
        messaggio: messaggioInvito(esito.canale, esito.cliente),
      });
    } catch (motivo) {
      impostaErrore(motivo instanceof Error ? motivo.message : 'Scheda non salvata.');
    } finally {
      impostaInvio(false);
    }
  }

  return (
    <Modale
      aperto={aperto}
      titolo="Nuova scheda cliente"
      descrizione="Bastano nome, cognome e numero WhatsApp."
      onChiudi={onChiudi}
    >
      {invito ? (
        <div className="space-y-4">
          <Avviso tono={invito.messaggio.tono}>Scheda creata. {invito.messaggio.testo}</Avviso>
          <p className="break-all rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-xs">
            {invito.collegamento}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante
              variante="secondario"
              onClick={() => void navigator.clipboard?.writeText(invito.collegamento)}
            >
              Copia il link
            </Pulsante>
            <Pulsante onClick={onChiudi}>Chiudi</Pulsante>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etichetta="Nome"
              value={bozza.nome}
              onChange={(evento) => aggiorna('nome', evento.target.value)}
              errore={errori.nome}
              autoComplete="off"
            />
            <Campo
              etichetta="Cognome"
              value={bozza.cognome}
              onChange={(evento) => aggiorna('cognome', evento.target.value)}
              errore={errori.cognome}
              autoComplete="off"
            />
          </div>

          <Campo
            etichetta="Numero WhatsApp"
            value={bozza.numeroWhatsapp}
            onChange={(evento) => aggiorna('numeroWhatsapp', evento.target.value)}
            errore={errori.numeroWhatsapp}
            suggerimento="Formato internazionale, es. +393401234567."
            inputMode="tel"
            autoComplete="off"
          />

          <Campo
            etichetta="E-mail (facoltativa)"
            value={bozza.email}
            onChange={(evento) => aggiorna('email', evento.target.value)}
            errore={errori.email}
            type="email"
            autoComplete="off"
          />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={bozza.consensoWhatsapp}
              onChange={(evento) => aggiorna('consensoWhatsapp', evento.target.checked)}
              className="mt-0.5 accent-[var(--color-accento)]"
            />
            <span>
              Acconsente a ricevere messaggi su WhatsApp
              <span className="block text-xs text-testo-tenue">
                Chiedilo al cliente: senza consenso conferme, promemoria e invito vanno via e-mail.
                Potrà cambiarlo dalla propria area.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <label htmlFor="note-cliente" className="block text-sm font-medium">
              Note
            </label>
            <textarea
              id="note-cliente"
              value={bozza.note}
              onChange={(evento) => aggiorna('note', evento.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
            />
          </div>

          {errore && <Avviso tono="errore">{errore}</Avviso>}

          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante variante="secondario" onClick={onChiudi}>
              Annulla
            </Pulsante>
            <Pulsante onClick={() => void invia()} disabled={inInvio}>
              {inInvio ? 'Salvataggio…' : 'Crea scheda'}
            </Pulsante>
          </div>
        </div>
      )}
    </Modale>
  );
}
