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
