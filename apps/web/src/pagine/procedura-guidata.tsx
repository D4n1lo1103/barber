import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CONFIGURAZIONI_PROFILO,
  MODELLI_WHATSAPP_PREDEFINITI,
  GRANULARITA_SLOT_AMMESSE,
  PROFILI,
  schemaProceduraGuidata,
  type DatiProceduraGuidata,
  type Profilo,
  type ServizioIniziale,
} from '@barber/shared';
import { Avviso } from '../componenti/avviso';
import { Campo } from '../componenti/campo';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { usaInstallazione } from '../installazione/contesto-installazione';
import { ErroreApi } from '../servizi/client-api';
import { completaProceduraGuidata } from '../servizi/installazione';

const PASSI = ['Profilo', 'Salone', 'Agenda', 'Messaggi', 'Servizi', 'Titolare'] as const;

type Passo = number;

function formattaPrezzo(centesimi: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    centesimi / 100,
  );
}

interface Bozza {
  profilo: Profilo;
  nomeSalone: string;
  indirizzo: string;
  citta: string;
  telefono: string;
  emailSalone: string;
  granularitaSlotMinuti: number;
  minutiBloccoSlot: number;
  venditaOnlineAttiva: boolean;
  whatsappAttivo: boolean;
  whatsappIdNumero: string;
  serviziScelti: Record<string, boolean>;
  nome: string;
  cognome: string;
  email: string;
  password: string;
  chiaveInstallazione: string;
}

function bozzaIniziale(profilo: Profilo): Bozza {
  const configurazione = CONFIGURAZIONI_PROFILO[profilo];

  return {
    profilo,
    nomeSalone: '',
    indirizzo: '',
    citta: '',
    telefono: '',
    emailSalone: '',
    granularitaSlotMinuti: configurazione.granularitaSlotMinuti,
    minutiBloccoSlot: configurazione.minutiBloccoSlot,
    venditaOnlineAttiva: false,
    whatsappAttivo: false,
    whatsappIdNumero: '',
    serviziScelti: Object.fromEntries(
      configurazione.catalogoIniziale.map((servizio) => [servizio.nome, true]),
    ),
    nome: '',
    cognome: '',
    email: '',
    password: '',
    chiaveInstallazione: '',
  };
}

function serviziSelezionati(bozza: Bozza): ServizioIniziale[] {
  return CONFIGURAZIONI_PROFILO[bozza.profilo].catalogoIniziale
    .filter((servizio) => bozza.serviziScelti[servizio.nome])
    .map((servizio) => ({ ...servizio }));
}

function componiDati(bozza: Bozza): DatiProceduraGuidata {
  return {
    profilo: bozza.profilo,
    salone: {
      nomeSalone: bozza.nomeSalone,
      indirizzo: bozza.indirizzo,
      citta: bozza.citta,
      telefono: bozza.telefono,
      emailSalone: bozza.emailSalone,
    },
    titolare: {
      nome: bozza.nome,
      cognome: bozza.cognome,
      email: bozza.email,
      password: bozza.password,
    },
    granularitaSlotMinuti: bozza.granularitaSlotMinuti,
    minutiBloccoSlot: bozza.minutiBloccoSlot,
    venditaOnlineAttiva: bozza.venditaOnlineAttiva,
    whatsapp: {
      attivo: bozza.whatsappAttivo,
      idNumero: bozza.whatsappIdNumero.trim(),
      // I nomi dei modelli partono da quelli predefiniti e si cambiano dalle
      // impostazioni: nella procedura guidata serve solo l'essenziale.
      modelli: MODELLI_WHATSAPP_PREDEFINITI,
    },
    servizi: serviziSelezionati(bozza),
  } as DatiProceduraGuidata;
}

export function PaginaProceduraGuidata() {
  const { aggiorna } = usaInstallazione();
  const [passo, impostaPasso] = useState<Passo>(0);
  const [bozza, impostaBozza] = useState<Bozza>(() => bozzaIniziale('barbiere'));
  const [errori, impostaErrori] = useState<Record<string, string>>({});
  const [erroreGenerale, impostaErroreGenerale] = useState<string | null>(null);
  const [inInvio, impostaInInvio] = useState(false);

  // L'accento segue il profilo scelto, già durante la procedura.
  useEffect(() => {
    document.documentElement.dataset.profilo = bozza.profilo;
  }, [bozza.profilo]);

  function modifica<Chiave extends keyof Bozza>(chiave: Chiave, valore: Bozza[Chiave]) {
    impostaBozza((precedente) => ({ ...precedente, [chiave]: valore }));
  }

  function cambiaProfilo(profilo: Profilo) {
    impostaBozza((precedente) => ({
      ...bozzaIniziale(profilo),
      nomeSalone: precedente.nomeSalone,
      indirizzo: precedente.indirizzo,
      citta: precedente.citta,
      telefono: precedente.telefono,
      emailSalone: precedente.emailSalone,
      nome: precedente.nome,
      cognome: precedente.cognome,
      email: precedente.email,
      password: precedente.password,
      chiaveInstallazione: precedente.chiaveInstallazione,
    }));
  }

  function erroriDelPasso(indice: Passo): Record<string, string> {
    const esito = schemaProceduraGuidata.safeParse(componiDati(bozza));
    const trovati: Record<string, string> = {};

    if (!esito.success) {
      for (const problema of esito.error.issues) {
        trovati[problema.path.join('.')] = problema.message;
      }
    }

    const campiDelPasso: Record<number, string[]> = {
      0: ['profilo'],
      1: [
        'salone.nomeSalone',
        'salone.indirizzo',
        'salone.citta',
        'salone.telefono',
        'salone.emailSalone',
      ],
      2: ['granularitaSlotMinuti', 'minutiBloccoSlot'],
      3: ['whatsapp.idNumero', 'whatsapp.modelli'],
      4: ['servizi'],
      5: ['titolare.nome', 'titolare.cognome', 'titolare.email', 'titolare.password'],
    };

    return Object.fromEntries(
      Object.entries(trovati).filter(([campo]) => campiDelPasso[indice]?.includes(campo)),
    );
  }

  function avanti() {
    const trovati = erroriDelPasso(passo);
    impostaErrori(trovati);

    if (Object.keys(trovati).length === 0) {
      impostaPasso((precedente) => Math.min(precedente + 1, PASSI.length - 1));
    }
  }

  function indietro() {
    impostaErrori({});
    impostaPasso((precedente) => Math.max(precedente - 1, 0));
  }

  async function invia() {
    impostaErroreGenerale(null);
    const esito = schemaProceduraGuidata.safeParse(componiDati(bozza));

    if (!esito.success) {
      const trovati: Record<string, string> = {};
      for (const problema of esito.error.issues) {
        trovati[problema.path.join('.')] = problema.message;
      }
      impostaErrori(trovati);
      impostaErroreGenerale('Controlla i dati inseriti: alcuni campi non sono validi.');

      return;
    }

    if (bozza.chiaveInstallazione.trim().length === 0) {
      impostaErrori({ chiave: 'Inserisci la chiave di installazione.' });

      return;
    }

    impostaInInvio(true);

    try {
      await completaProceduraGuidata(esito.data, bozza.chiaveInstallazione.trim());
      await aggiorna();
    } catch (problema) {
      impostaErroreGenerale(
        problema instanceof ErroreApi ? problema.message : 'Configurazione non riuscita. Riprova.',
      );
    } finally {
      impostaInInvio(false);
    }
  }

  const catalogo = CONFIGURAZIONI_PROFILO[bozza.profilo].catalogoIniziale;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <Superficie className="p-6 sm:p-8" sollevata>
        <p className="text-sm text-testo-tenue">
          Passo {passo + 1} di {PASSI.length} · {PASSI[passo]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Configurazione del salone</h1>

        <ol className="mt-6 flex gap-2" aria-label="Avanzamento della procedura">
          {PASSI.map((nome, indice) => (
            <li
              key={nome}
              aria-current={indice === passo ? 'step' : undefined}
              className={`h-1.5 flex-1 rounded-[var(--radius-pillola)] transition-colors duration-[var(--durata-media)] ${
                indice <= passo ? 'bg-accento' : 'bg-bordo'
              }`}
            >
              <span className="sr-only">{nome}</span>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div
            key={passo}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 space-y-5"
          >
            {passo === 0 && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Tipo di attività</legend>
                {PROFILI.map((profilo) => (
                  <label
                    key={profilo}
                    className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-campo)] border p-4 transition-colors duration-[var(--durata-breve)] ${
                      bozza.profilo === profilo ? 'border-accento' : 'border-bordo'
                    }`}
                  >
                    <input
                      type="radio"
                      name="profilo"
                      value={profilo}
                      checked={bozza.profilo === profilo}
                      onChange={() => cambiaProfilo(profilo)}
                      className="mt-1 accent-[var(--color-accento)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {CONFIGURAZIONI_PROFILO[profilo].etichetta}
                      </span>
                      <span className="block text-xs text-testo-tenue">
                        {CONFIGURAZIONI_PROFILO[profilo].catalogoIniziale.length} servizi proposti,
                        slot da {CONFIGURAZIONI_PROFILO[profilo].granularitaSlotMinuti} minuti.
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {passo === 1 && (
              <>
                <Campo
                  etichetta="Nome del salone"
                  value={bozza.nomeSalone}
                  onChange={(evento) => modifica('nomeSalone', evento.target.value)}
                  errore={errori['salone.nomeSalone']}
                  autoComplete="organization"
                />
                <Campo
                  etichetta="Indirizzo"
                  value={bozza.indirizzo}
                  onChange={(evento) => modifica('indirizzo', evento.target.value)}
                  errore={errori['salone.indirizzo']}
                  autoComplete="street-address"
                />
                <Campo
                  etichetta="Città"
                  value={bozza.citta}
                  onChange={(evento) => modifica('citta', evento.target.value)}
                  errore={errori['salone.citta']}
                />
                <Campo
                  etichetta="Telefono"
                  value={bozza.telefono}
                  onChange={(evento) => modifica('telefono', evento.target.value)}
                  errore={errori['salone.telefono']}
                  suggerimento="Formato internazionale, es. +393401234567"
                  inputMode="tel"
                />
                <Campo
                  etichetta="E-mail del salone"
                  type="email"
                  value={bozza.emailSalone}
                  onChange={(evento) => modifica('emailSalone', evento.target.value)}
                  errore={errori['salone.emailSalone']}
                />
              </>
            )}

            {passo === 2 && (
              <>
                <div className="space-y-2">
                  <label htmlFor="granularita" className="block text-sm font-medium">
                    Durata di uno slot dell&apos;agenda
                  </label>
                  <select
                    id="granularita"
                    value={bozza.granularitaSlotMinuti}
                    onChange={(evento) =>
                      modifica('granularitaSlotMinuti', Number(evento.target.value))
                    }
                    className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm outline-none focus:border-accento"
                  >
                    {GRANULARITA_SLOT_AMMESSE.map((minuti) => (
                      <option key={minuti} value={minuti}>
                        {minuti} minuti
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-testo-tenue">
                    Le durate dei servizi devono essere multiple di questo valore.
                  </p>
                </div>

                <Campo
                  etichetta="Blocco dello slot durante il pagamento (minuti)"
                  type="number"
                  min={5}
                  max={60}
                  value={bozza.minutiBloccoSlot}
                  onChange={(evento) => modifica('minutiBloccoSlot', Number(evento.target.value))}
                  errore={errori['minutiBloccoSlot']}
                  suggerimento="Tempo entro cui il cliente deve completare il pagamento della caparra."
                />

                <label className="flex items-start gap-3 rounded-[var(--radius-campo)] border border-bordo p-4">
                  <input
                    type="checkbox"
                    checked={bozza.venditaOnlineAttiva}
                    onChange={(evento) => modifica('venditaOnlineAttiva', evento.target.checked)}
                    className="mt-1 accent-[var(--color-accento)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Vendita online dei prodotti</span>
                    <span className="block text-xs text-testo-tenue">
                      I clienti possono acquistare prodotti dalla web app. Attivabile anche in
                      seguito.
                    </span>
                  </span>
                </label>
              </>
            )}

            {passo === 3 && (
              <>
                <p className="text-sm text-testo-tenue">
                  I messaggi di servizio (conferme, promemoria e inviti) possono viaggiare su
                  WhatsApp per i clienti che danno il consenso. Senza consenso, senza numero o se
                  l’invio non riesce, il messaggio parte via e-mail.
                </p>

                <label className="flex items-start gap-3 rounded-[var(--radius-campo)] border border-bordo p-4">
                  <input
                    type="checkbox"
                    checked={bozza.whatsappAttivo}
                    onChange={(evento) => modifica('whatsappAttivo', evento.target.checked)}
                    className="mt-1 accent-[var(--color-accento)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Messaggi WhatsApp</span>
                    <span className="block text-xs text-testo-tenue">
                      Attivabile anche in seguito dalle impostazioni, scheda Messaggi.
                    </span>
                  </span>
                </label>

                {bozza.whatsappAttivo && (
                  <Campo
                    etichetta="Identificativo del numero mittente"
                    value={bozza.whatsappIdNumero}
                    onChange={(evento) => modifica('whatsappIdNumero', evento.target.value)}
                    errore={errori['whatsapp.idNumero']}
                    inputMode="numeric"
                    suggerimento="«Phone number ID» nella console di Meta. Non è un segreto."
                  />
                )}

                <Avviso tono="informazione">
                  Il token di accesso di WhatsApp è un segreto e non si imposta da qui: va nel file
                  di configurazione del server, nella variabile WHATSAPP_TOKEN. Finché manca, i
                  messaggi partono solo via e-mail.
                </Avviso>
              </>
            )}

            {passo === 4 && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  Catalogo iniziale ({serviziSelezionati(bozza).length} selezionati)
                </legend>
                {catalogo.map((servizio) => (
                  <label
                    key={servizio.nome}
                    className="flex items-start gap-3 rounded-[var(--radius-campo)] border border-bordo p-3"
                  >
                    <input
                      type="checkbox"
                      checked={bozza.serviziScelti[servizio.nome] ?? false}
                      onChange={(evento) =>
                        modifica('serviziScelti', {
                          ...bozza.serviziScelti,
                          [servizio.nome]: evento.target.checked,
                        })
                      }
                      className="mt-1 accent-[var(--color-accento)]"
                    />
                    <span className="flex-1">
                      <span className="flex justify-between gap-3 text-sm font-semibold">
                        {servizio.nome}
                        <span className="text-testo-tenue">
                          {formattaPrezzo(servizio.prezzoCentesimi)} · {servizio.durataMinuti} min
                        </span>
                      </span>
                      <span className="block text-xs text-testo-tenue">{servizio.descrizione}</span>
                    </span>
                  </label>
                ))}
                {errori['servizi'] && <Avviso tono="errore">{errori['servizi']}</Avviso>}
                <p className="text-xs text-testo-tenue">
                  Potrai modificare prezzi, durate e servizi in qualsiasi momento.
                </p>
              </fieldset>
            )}

            {passo === 5 && (
              <>
                <Campo
                  etichetta="Nome"
                  value={bozza.nome}
                  onChange={(evento) => modifica('nome', evento.target.value)}
                  errore={errori['titolare.nome']}
                  autoComplete="given-name"
                />
                <Campo
                  etichetta="Cognome"
                  value={bozza.cognome}
                  onChange={(evento) => modifica('cognome', evento.target.value)}
                  errore={errori['titolare.cognome']}
                  autoComplete="family-name"
                />
                <Campo
                  etichetta="E-mail del titolare"
                  type="email"
                  value={bozza.email}
                  onChange={(evento) => modifica('email', evento.target.value)}
                  errore={errori['titolare.email']}
                  autoComplete="email"
                />
                <Campo
                  etichetta="Password"
                  type="password"
                  value={bozza.password}
                  onChange={(evento) => modifica('password', evento.target.value)}
                  errore={errori['titolare.password']}
                  suggerimento="Almeno 12 caratteri."
                  autoComplete="new-password"
                />
                <Campo
                  etichetta="Chiave di installazione"
                  type="password"
                  value={bozza.chiaveInstallazione}
                  onChange={(evento) => modifica('chiaveInstallazione', evento.target.value)}
                  errore={errori['chiave']}
                  suggerimento="La trovi nel file di configurazione del server (CHIAVE_INSTALLAZIONE)."
                />
              </>
            )}

            {erroreGenerale && <Avviso tono="errore">{erroreGenerale}</Avviso>}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Pulsante variante="discreto" onClick={indietro} disabled={passo === 0 || inInvio}>
            Indietro
          </Pulsante>

          {passo < PASSI.length - 1 ? (
            <Pulsante onClick={avanti}>Avanti</Pulsante>
          ) : (
            <Pulsante onClick={() => void invia()} disabled={inInvio}>
              {inInvio ? 'Configurazione in corso…' : 'Completa la configurazione'}
            </Pulsante>
          )}
        </div>
      </Superficie>
    </main>
  );
}
