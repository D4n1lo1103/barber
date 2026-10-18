import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../stili/agenda.css';
import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Appuntamento } from '@barber/shared';
import { formattaIntervallo } from '../../utilita/formati';

const localizzatore = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (data: Date) => startOfWeek(data, { locale: it }),
  getDay,
  locales: { it },
});

/** Testi della libreria in italiano: l'interfaccia è solo in italiano. */
const MESSAGGI = {
  date: 'Data',
  time: 'Ora',
  event: 'Appuntamento',
  allDay: 'Tutto il giorno',
  week: 'Settimana',
  day: 'Giorno',
  today: 'Oggi',
  previous: 'Precedente',
  next: 'Successivo',
  noEventsInRange: 'Nessun appuntamento in questo periodo.',
  showMore: (quanti: number) => `+ altri ${quanti}`,
};

export interface EventoAgenda {
  id: string;
  inizio: Date;
  fine: Date;
  appuntamento: Appuntamento;
  operatoreId: string;
}

export interface ColonnaOperatore {
  id: string;
  nome: string;
}

export function CalendarioAgenda({
  eventi,
  vista,
  data,
  granularitaMinuti,
  minutoApertura,
  minutoChiusura,
  colonne,
  onSelezionaSlot,
  onSelezionaEvento,
}: {
  eventi: EventoAgenda[];
  vista: 'giorno' | 'settimana';
  data: Date;
  granularitaMinuti: number;
  minutoApertura: number;
  minutoChiusura: number;
  /** Una colonna per operatore nella vista giornaliera. */
  colonne?: ColonnaOperatore[];
  onSelezionaSlot: (inizio: Date, operatoreId?: string) => void;
  onSelezionaEvento: (appuntamento: Appuntamento) => void;
}) {
  const [oraMinima, oraMassima] = useMemo(() => {
    const giorno = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    const minima = new Date(giorno.getTime() + minutoApertura * 60_000);
    const massima = new Date(giorno.getTime() + minutoChiusura * 60_000);

    return [minima, massima];
  }, [data, minutoApertura, minutoChiusura]);

  return (
    <Calendar<EventoAgenda, ColonnaOperatore>
      className="agenda-salone"
      localizer={localizzatore}
      culture="it"
      messages={MESSAGGI}
      events={eventi}
      startAccessor={(evento) => evento.inizio}
      endAccessor={(evento) => evento.fine}
      titleAccessor={(evento) =>
        `${evento.appuntamento.cliente.nome} ${evento.appuntamento.cliente.cognome}`
      }
      tooltipAccessor={(evento) =>
        `${formattaIntervallo(evento.appuntamento.inizio, evento.appuntamento.fine)} · ` +
        evento.appuntamento.servizi.map((servizio) => servizio.nome).join(', ')
      }
      date={data}
      view={vista === 'giorno' ? Views.DAY : Views.WEEK}
      views={[Views.DAY, Views.WEEK]}
      // La navigazione e il cambio vista stanno nella barra dell'agenda.
      onNavigate={() => undefined}
      onView={() => undefined}
      toolbar={false}
      step={granularitaMinuti}
      timeslots={1}
      min={oraMinima}
      max={oraMassima}
      selectable
      longPressThreshold={250}
      onSelectSlot={(intervallo) =>
        onSelezionaSlot(
          intervallo.start,
          typeof intervallo.resourceId === 'string' ? intervallo.resourceId : undefined,
        )
      }
      onSelectEvent={(evento) => onSelezionaEvento(evento.appuntamento)}
      eventPropGetter={(evento) => ({
        className: `evento-${evento.appuntamento.stato}`,
      })}
      resources={vista === 'giorno' && colonne && colonne.length > 1 ? colonne : undefined}
      resourceIdAccessor={(colonna) => colonna.id}
      resourceTitleAccessor={(colonna) => colonna.nome}
      resourceAccessor={(evento) => evento.operatoreId}
      components={{ event: EventoCompatto }}
    />
  );
}

/** Contenuto di un appuntamento in agenda: cliente, orario e servizi. */
function EventoCompatto({ event }: { event: EventoAgenda }) {
  const { appuntamento } = event;

  return (
    <div className="leading-tight">
      <p className="truncate text-xs font-semibold">
        {appuntamento.cliente.nome} {appuntamento.cliente.cognome}
      </p>
      <p className="truncate text-[0.68rem] text-testo-tenue">
        {formattaIntervallo(appuntamento.inizio, appuntamento.fine)}
      </p>
      <p className="truncate text-[0.68rem]">
        {appuntamento.servizi.map((servizio) => servizio.nome).join(' + ')}
      </p>
    </div>
  );
}
