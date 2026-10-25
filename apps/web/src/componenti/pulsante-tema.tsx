import { Pulsante } from './pulsante';
import { usaTema } from '../tema/contesto-tema';

/** Interruttore fra tema scuro e chiaro, uguale per il personale e per i clienti. */
export function PulsanteTema({
  variante = 'secondario',
}: {
  variante?: 'secondario' | 'discreto';
}) {
  const { tema, alterna } = usaTema();

  return (
    <Pulsante
      variante={variante}
      onClick={alterna}
      aria-label={`Passa al tema ${tema === 'scuro' ? 'chiaro' : 'scuro'}`}
    >
      Tema {tema === 'scuro' ? 'chiaro' : 'scuro'}
    </Pulsante>
  );
}
