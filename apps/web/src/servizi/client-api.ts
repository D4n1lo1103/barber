/**
 * Client HTTP verso l'API. Le richieste viaggiano con i cookie di sessione e,
 * per i metodi che modificano dati, con il token CSRF letto dal cookie.
 */
const URL_API = import.meta.env.VITE_URL_API ?? 'http://localhost:3000/api';

const METODI_SICURI = new Set(['GET', 'HEAD', 'OPTIONS']);
const NOME_COOKIE_CSRF = 'csrf';

export interface ErroreCampo {
  campo: string;
  messaggio: string;
}

/** Errore restituito dall'API, con messaggio già leggibile dall'utente. */
export class ErroreApi extends Error {
  constructor(
    readonly stato: number,
    messaggio: string,
    readonly errori: ErroreCampo[] = [],
  ) {
    super(messaggio);
    this.name = 'ErroreApi';
  }
}

export function leggiTokenCsrf(): string | undefined {
  return document.cookie
    .split('; ')
    .find((voce) => voce.startsWith(`${NOME_COOKIE_CSRF}=`))
    ?.split('=')[1];
}

function estraiMessaggio(stato: number, corpo: unknown): string {
  if (corpo && typeof corpo === 'object') {
    const dati = corpo as { messaggio?: unknown; message?: unknown };

    if (typeof dati.messaggio === 'string') {
      return dati.messaggio;
    }

    if (typeof dati.message === 'string') {
      return dati.message;
    }
  }

  if (stato === 401) {
    return 'Sessione scaduta. Accedi di nuovo.';
  }

  if (stato >= 500) {
    return 'Servizio momentaneamente non disponibile. Riprova.';
  }

  return 'Operazione non riuscita.';
}

export async function chiamaApi<T>(
  percorso: string,
  opzioni: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  const metodo = opzioni.metodo ?? 'GET';
  const intestazioni: Record<string, string> = {};

  if (opzioni.corpo !== undefined) {
    intestazioni['Content-Type'] = 'application/json';
  }

  if (!METODI_SICURI.has(metodo)) {
    const tokenCsrf = leggiTokenCsrf();

    if (tokenCsrf) {
      intestazioni['x-csrf-token'] = tokenCsrf;
    }
  }

  let risposta: Response;

  try {
    risposta = await fetch(`${URL_API}${percorso}`, {
      method: metodo,
      credentials: 'include',
      headers: intestazioni,
      body: opzioni.corpo === undefined ? undefined : JSON.stringify(opzioni.corpo),
    });
  } catch {
    throw new ErroreApi(0, 'Connessione non disponibile. Controlla la rete e riprova.');
  }

  if (risposta.status === 204) {
    return undefined as T;
  }

  const corpo = await risposta.json().catch(() => undefined);

  if (!risposta.ok) {
    const errori = Array.isArray((corpo as { errori?: ErroreCampo[] })?.errori)
      ? ((corpo as { errori: ErroreCampo[] }).errori ?? [])
      : [];

    throw new ErroreApi(risposta.status, estraiMessaggio(risposta.status, corpo), errori);
  }

  return corpo as T;
}
