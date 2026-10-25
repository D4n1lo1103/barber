import { useEffect, useState } from 'react';
import { Pulsante } from './pulsante';
import { applicaTema, leggiTemaSalvato, type Tema } from '../tema/tema';

/** Interruttore fra tema scuro e chiaro, uguale per il personale e per i clienti. */
export function PulsanteTema({
  variante = 'secondario',
}: {
  variante?: 'secondario' | 'discreto';
}) {
  const [tema, impostaTema] = useState<Tema>(() => leggiTemaSalvato());

  useEffect(() => {
    applicaTema(tema);
  }, [tema]);

  return (
    <Pulsante
      variante={variante}
      onClick={() => impostaTema(tema === 'scuro' ? 'chiaro' : 'scuro')}
      aria-label={`Passa al tema ${tema === 'scuro' ? 'chiaro' : 'scuro'}`}
    >
      Tema {tema === 'scuro' ? 'chiaro' : 'scuro'}
    </Pulsante>
  );
}
