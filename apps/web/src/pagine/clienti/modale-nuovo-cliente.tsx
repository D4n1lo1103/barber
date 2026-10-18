import { useEffect, useState } from 'react';
import { schemaCreazioneCliente, type Cliente } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { creaCliente } from '../../servizi/gestione';

const BOZZA_VUOTA = { nome: '', cognome: '', numeroWhatsapp: '', email: '', note: '' };

/**
 * Scheda cliente creata dal personale. La password non viene mai impostata qui:
 * al salvataggio il sistema produce un link di attivazione da consegnare al
 * cliente (dalla fase 7 lo invia da sé via WhatsApp o e-mail).
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
  const [collegamento, impostaCollegamento] = useState<string | null>(null);
  const [inInvio, impostaInvio] = useState(false);

  useEffect(() => {
    if (aperto) {
      impostaBozza(BOZZA_VUOTA);
      impostaErrori({});
      impostaErrore(null);
      impostaCollegamento(null);
    }
  }, [aperto]);

  function aggiorna(campo: keyof typeof BOZZA_VUOTA, valore: string) {
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
      impostaCollegamento(
        `${window.location.origin}/attivazione?token=${encodeURIComponent(esito.token)}`,
      );
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
      {collegamento ? (
        <div className="space-y-4">
          <Avviso tono="conferma">
            Scheda creata. Consegna al cliente questo link per attivare l’account e scegliere la
            password.
          </Avviso>
          <p className="break-all rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-xs">
            {collegamento}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante
              variante="secondario"
              onClick={() => void navigator.clipboard?.writeText(collegamento)}
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
