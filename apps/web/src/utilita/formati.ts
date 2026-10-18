/** Formati italiani usati in tutta l'interfaccia. */
const FORMATO_EURO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

const FORMATO_DATA = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Rome',
});

export function formattaPrezzo(centesimi: number): string {
  return FORMATO_EURO.format(centesimi / 100);
}

/** Converte "12,50" o "12.50" in centesimi; null se il valore non è valido. */
export function centesimiDaPrezzo(valore: string): number | null {
  const normalizzato = valore.trim().replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(normalizzato)) {
    return null;
  }

  return Math.round(Number(normalizzato) * 100);
}

export function prezzoDaCentesimi(centesimi: number): string {
  return (centesimi / 100).toFixed(2).replace('.', ',');
}

export function formattaData(valore: string | Date): string {
  return FORMATO_DATA.format(typeof valore === 'string' ? new Date(valore) : valore);
}

export function formattaDurata(minuti: number): string {
  if (minuti < 60) {
    return `${minuti} min`;
  }

  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;

  return resto === 0 ? `${ore} h` : `${ore} h ${resto} min`;
}

const FORMATO_ORA = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

const FORMATO_DATA_BREVE = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'Europe/Rome',
});

/** Ora nel fuso del salone, es. "09:30". */
export function formattaOra(valore: string | Date): string {
  return FORMATO_ORA.format(typeof valore === 'string' ? new Date(valore) : valore);
}

/** Data breve nel fuso del salone, es. "mer 15 lug". */
export function formattaDataBreve(valore: string | Date): string {
  return FORMATO_DATA_BREVE.format(typeof valore === 'string' ? new Date(valore) : valore);
}

/** Intervallo di un appuntamento, es. "09:00–09:45". */
export function formattaIntervallo(inizio: string | Date, fine: string | Date): string {
  return `${formattaOra(inizio)}–${formattaOra(fine)}`;
}
