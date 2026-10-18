import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { clsx } from 'clsx';
import { startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import type { Appuntamento, FasciaSettimanale, Operatore, Servizio } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Caricamento } from '../../componenti/caricamento';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import {
  leggiAppuntamenti,
  leggiOrariApertura,
  leggiPersonale,
  leggiServizi,
} from '../../servizi/gestione';
import { formattaDataBreve } from '../../utilita/formati';
import {
  dataDiVista,
  dataDiVistaDaGiorno,
  giornoDaDataDiVista,
  istanteDaDataDiVista,
  spostaDiGiorni,
} from '../../utilita/fuso-vista';
import { CalendarioAgenda, type EventoAgenda } from './calendario-agenda';
import { ModaleDettaglioAppuntamento } from './modale-dettaglio-appuntamento';
import { ModaleNuovoAppuntamento } from './modale-nuovo-appuntamento';

/** Fascia mostrata in agenda se il salone non ha ancora orari di apertura. */
const APERTURA_PREDEFINITA = { minutoInizio: 8 * 60, minutoFine: 20 * 60 };

type Vista = 'giorno' | 'settimana';

export function PaginaAgenda() {
  const { stato } = usaInstallazione();
  // Il giorno mostrato sta nell'indirizzo: l'agenda di una data precisa è
  // condivisibile e resta la stessa dopo un ricaricamento.
  const [parametri, impostaParametri] = useSearchParams();
  const [vista, impostaVista] = useState<Vista>(
    parametri.get('vista') === 'settimana' ? 'settimana' : 'giorno',
  );
  const [dataVista, impostaDataVista] = useState(() => {
    const richiesto = parametri.get('giorno');

    if (richiesto && /^\d{4}-\d{2}-\d{2}$/.test(richiesto)) {
      return dataDiVistaDaGiorno(richiesto);
    }

    const adesso = dataDiVista(new Date());

    return new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());
  });
  const [operatori, impostaOperatori] = useState<Operatore[]>([]);
  const [servizi, impostaServizi] = useState<Servizio[]>([]);
  const [apertura, impostaApertura] = useState<FasciaSettimanale[]>([]);
  const [appuntamenti, impostaAppuntamenti] = useState<Appuntamento[]>([]);
  const [operatoreFiltrato, impostaOperatoreFiltrato] = useState<string | 'tutti'>('tutti');
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [nuovoAperto, impostaNuovoAperto] = useState(false);
  const [bozzaNuovo, impostaBozzaNuovo] = useState<{
    operatoreId: string;
    giorno: string;
    orario: string | null;
  } | null>(null);
  const [dettaglio, impostaDettaglio] = useState<Appuntamento | null>(null);

  const granularita = stato?.granularitaSlotMinuti ?? 15;
  const operatoriAttivi = useMemo(
    () => operatori.filter((operatore) => operatore.attivo),
    [operatori],
  );

  /** Primo giorno mostrato: il giorno stesso, o il lunedì nella vista settimanale. */
  const primoGiorno = useMemo(() => {
    const riferimento = vista === 'settimana' ? startOfWeek(dataVista, { locale: it }) : dataVista;

    return giornoDaDataDiVista(riferimento);
  }, [dataVista, vista]);

  useEffect(() => {
    let annullato = false;

    Promise.all([leggiPersonale(), leggiServizi(), leggiOrariApertura()])
      .then(([elencoPersonale, elencoServizi, orari]) => {
        if (!annullato) {
          impostaOperatori(elencoPersonale.personale);
          impostaServizi(elencoServizi.servizi);
          impostaApertura(orari.fasce);
        }
      })
      .catch((motivo: unknown) => {
        if (!annullato) {
          impostaErrore(motivo instanceof Error ? motivo.message : 'Dati non disponibili.');
        }
      });

    return () => {
      annullato = true;
    };
  }, []);

  const caricaAppuntamenti = useCallback(async () => {
    impostaCaricamento(true);

    try {
      const risposta = await leggiAppuntamenti({
        dal: primoGiorno,
        giorni: vista === 'settimana' ? 7 : 1,
        operatoreId: operatoreFiltrato === 'tutti' ? undefined : operatoreFiltrato,
      });

      impostaAppuntamenti(risposta.appuntamenti);
      impostaErrore(null);
    } catch (motivo) {
      impostaErrore(motivo instanceof Error ? motivo.message : 'Agenda non disponibile.');
    } finally {
      impostaCaricamento(false);
    }
  }, [primoGiorno, vista, operatoreFiltrato]);

  useEffect(() => {
    void caricaAppuntamenti();
  }, [caricaAppuntamenti]);

  useEffect(() => {
    impostaParametri(
      { giorno: giornoDaDataDiVista(dataVista), vista },
      { replace: true, preventScrollReset: true },
    );
  }, [dataVista, vista, impostaParametri]);

  const eventi: EventoAgenda[] = useMemo(
    () =>
      appuntamenti.map((appuntamento) => ({
        id: appuntamento.id,
        inizio: dataDiVista(appuntamento.inizio),
        fine: dataDiVista(appuntamento.fine),
        operatoreId: appuntamento.operatore.id,
        appuntamento,
      })),
    [appuntamenti],
  );

  const colonne = useMemo(
    () =>
      (operatoreFiltrato === 'tutti'
        ? operatoriAttivi
        : operatoriAttivi.filter((operatore) => operatore.id === operatoreFiltrato)
      ).map((operatore) => ({
        id: operatore.id,
        nome: `${operatore.nome} ${operatore.cognome}`,
      })),
    [operatoriAttivi, operatoreFiltrato],
  );

  const [minutoApertura, minutoChiusura] = useMemo(() => {
    if (apertura.length === 0) {
      return [APERTURA_PREDEFINITA.minutoInizio, APERTURA_PREDEFINITA.minutoFine];
    }

    return [
      Math.min(...apertura.map((fascia) => fascia.minutoInizio)),
      Math.max(...apertura.map((fascia) => fascia.minutoFine)),
    ];
  }, [apertura]);

  function apriNuovo(giorno: string, orario: string | null, operatoreId?: string) {
    const scelto =
      operatoreId ??
      (operatoreFiltrato !== 'tutti' ? operatoreFiltrato : operatoriAttivi[0]?.id) ??
      '';

    if (!scelto) {
      impostaErrore('Nessun operatore attivo: crea prima il personale.');

      return;
    }

    impostaBozzaNuovo({ operatoreId: scelto, giorno, orario });
    impostaNuovoAperto(true);
  }

  function sostituisci(aggiornato: Appuntamento) {
    impostaAppuntamenti((precedenti) => {
      const senza = precedenti.filter((voce) => voce.id !== aggiornato.id);

      return [...senza, aggiornato].sort((primo, secondo) =>
        primo.inizio.localeCompare(secondo.inizio),
      );
    });
    void caricaAppuntamenti();
  }

  const etichettaPeriodo =
    vista === 'giorno'
      ? formattaDataBreve(istanteDaDataDiVista(dataVista))
      : `${formattaDataBreve(istanteDaDataDiVista(dataDiVistaDaGiorno(primoGiorno)))} – ${formattaDataBreve(
          istanteDaDataDiVista(spostaDiGiorni(dataDiVistaDaGiorno(primoGiorno), 6)),
        )}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-testo-tenue">Agenda</p>
          <h1 className="text-2xl font-semibold tracking-tight">{etichettaPeriodo}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/clienti">
            <Pulsante variante="secondario">
              <Users size={16} aria-hidden /> Clienti
            </Pulsante>
          </Link>
          <Pulsante onClick={() => apriNuovo(primoGiorno, null)}>
            <Plus size={16} aria-hidden /> Nuovo appuntamento
          </Pulsante>
        </div>
      </div>

      <Superficie className="mt-6 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Periodo precedente"
            onClick={() =>
              impostaDataVista((precedente) =>
                spostaDiGiorni(precedente, vista === 'settimana' ? -7 : -1),
              )
            }
            className="rounded-[var(--radius-campo)] p-2 text-testo-tenue transition-colors hover:bg-fondo-elevato hover:text-testo"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <Pulsante
            variante="discreto"
            onClick={() => {
              const oggi = dataDiVista(new Date());

              impostaDataVista(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()));
            }}
          >
            <CalendarDays size={16} aria-hidden /> Oggi
          </Pulsante>
          <button
            type="button"
            aria-label="Periodo successivo"
            onClick={() =>
              impostaDataVista((precedente) =>
                spostaDiGiorni(precedente, vista === 'settimana' ? 7 : 1),
              )
            }
            className="rounded-[var(--radius-campo)] p-2 text-testo-tenue transition-colors hover:bg-fondo-elevato hover:text-testo"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div
          className="flex overflow-hidden rounded-[var(--radius-pillola)] border border-bordo"
          role="group"
          aria-label="Vista dell’agenda"
        >
          {(['giorno', 'settimana'] as const).map((valore) => (
            <button
              key={valore}
              type="button"
              aria-pressed={vista === valore}
              onClick={() => impostaVista(valore)}
              className={clsx(
                'px-4 py-2 text-sm font-medium capitalize transition-colors duration-[var(--durata-breve)]',
                vista === valore
                  ? 'bg-accento text-su-accento'
                  : 'text-testo-tenue hover:text-testo',
              )}
            >
              {valore}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Operatore">
          <button
            type="button"
            aria-pressed={operatoreFiltrato === 'tutti'}
            onClick={() => impostaOperatoreFiltrato('tutti')}
            className={clsx(
              'rounded-[var(--radius-pillola)] border px-3 py-1.5 text-sm transition-colors duration-[var(--durata-breve)]',
              operatoreFiltrato === 'tutti'
                ? 'border-accento bg-accento/15 text-testo'
                : 'border-bordo text-testo-tenue hover:text-testo',
            )}
          >
            Tutti
          </button>
          {operatoriAttivi.map((operatore) => (
            <button
              key={operatore.id}
              type="button"
              aria-pressed={operatoreFiltrato === operatore.id}
              onClick={() => impostaOperatoreFiltrato(operatore.id)}
              className={clsx(
                'rounded-[var(--radius-pillola)] border px-3 py-1.5 text-sm transition-colors duration-[var(--durata-breve)]',
                operatoreFiltrato === operatore.id
                  ? 'border-accento bg-accento/15 text-testo'
                  : 'border-bordo text-testo-tenue hover:text-testo',
              )}
            >
              {operatore.nome}
            </button>
          ))}
        </div>
      </Superficie>

      {errore && (
        <div className="mt-4">
          <Avviso tono="errore">{errore}</Avviso>
        </div>
      )}

      <div className="mt-4 h-[72dvh] min-h-[32rem]">
        {inCaricamento && appuntamenti.length === 0 ? (
          <Caricamento messaggio="Caricamento dell’agenda" compatto />
        ) : (
          <CalendarioAgenda
            eventi={eventi}
            vista={vista}
            data={dataVista}
            granularitaMinuti={granularita}
            minutoApertura={minutoApertura}
            minutoChiusura={minutoChiusura}
            colonne={colonne}
            onSelezionaSlot={(inizio, operatoreId) =>
              apriNuovo(
                giornoDaDataDiVista(inizio),
                istanteDaDataDiVista(inizio).toISOString(),
                operatoreId,
              )
            }
            onSelezionaEvento={impostaDettaglio}
          />
        )}
      </div>

      {bozzaNuovo && (
        <ModaleNuovoAppuntamento
          aperto={nuovoAperto}
          onChiudi={() => impostaNuovoAperto(false)}
          onCreato={sostituisci}
          operatori={operatoriAttivi}
          servizi={servizi}
          operatoreIniziale={bozzaNuovo.operatoreId}
          giornoIniziale={bozzaNuovo.giorno}
          orarioIniziale={bozzaNuovo.orario}
        />
      )}

      <ModaleDettaglioAppuntamento
        appuntamento={dettaglio}
        onChiudi={() => impostaDettaglio(null)}
        onAggiornato={sostituisci}
      />
    </main>
  );
}
