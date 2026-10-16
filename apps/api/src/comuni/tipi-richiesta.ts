import type { Request } from 'express';
import type { Ruolo } from '@barber/shared';

export interface UtenteRichiesta {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: Ruolo;
  attivo: boolean;
}

export interface RichiestaAutenticata extends Request {
  utente?: UtenteRichiesta;
  tokenSessione?: string;
  csrfHashSessione?: string;
}
